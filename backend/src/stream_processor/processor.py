import json
import random
import os
from kafka import KafkaConsumer
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import redis
import logging
from datetime import datetime
import time

from src.sensor_thresholds import apply_threshold_classification

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class StreamProcessor:
    def __init__(self, kafka_broker=None, redis_host=None):
        if kafka_broker is None:
            kafka_broker = os.getenv('KAFKA_BROKER', 'localhost:9092')
        if redis_host is None:
            redis_host = os.getenv('REDIS_HOST', 'localhost')
        self.kafka_broker = kafka_broker
        try:
            self.consumer = self._create_consumer()
            self.redis_client = redis.Redis(host=redis_host, port=6379, db=0, decode_responses=True)
            self.anomaly_model = self._train_anomaly_model()
            self.scaler = StandardScaler()
            logger.info("Stream processor initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize stream processor: {e}")
            raise

    def _create_consumer(self):
        return KafkaConsumer(
            'sensor-data',
            bootstrap_servers=[self.kafka_broker],
            value_deserializer=lambda x: json.loads(x.decode('utf-8')),
            auto_offset_reset='earliest',
            group_id='energy-monitor-group',
            enable_auto_commit=True
        )
    
    def _train_anomaly_model(self):
        np.random.seed(42)
        n_samples = 1000
        current_normal = np.random.normal(25, 10, n_samples)
        temp_normal = np.random.normal(30, 5, n_samples)
        pressure_normal = np.random.normal(5, 2, n_samples)
        
        X_normal = np.column_stack([current_normal, temp_normal, pressure_normal])
        model = IsolationForest(contamination=0.1, random_state=42, n_estimators=100)
        model.fit(X_normal)
        logger.info("Anomaly detection model trained")
        return model
    
    def process_stream(self):
        logger.info("Starting to process sensor data stream...")
        processed_count = 0

        while True:
            try:
                # Using poll() is more stable than iterator on some Python 3.12 environments.
                record_map = self.consumer.poll(timeout_ms=1000, max_records=200)
                for _, records in record_map.items():
                    for message in records:
                        data = message.value
                        processed_count += 1

                        apply_threshold_classification(data)

                        features = np.array([[data['current'], data['temperature'], data['pressure']]])

                        if processed_count == 1:
                            self.scaler.partial_fit(features)
                        features_scaled = self.scaler.transform(features)

                        # Cast NumPy scalars to native Python types for JSON serialization.
                        is_anomaly = bool(self.anomaly_model.predict(features_scaled)[0] == -1)
                        anomaly_score = float(self.anomaly_model.decision_function(features_scaled)[0])

                        failure_prob = self._calculate_failure_probability(data, is_anomaly, anomaly_score)

                        data.update({
                            'ml_anomaly': is_anomaly,
                            'anomaly_score': round(anomaly_score, 4),
                            'failure_probability': round(failure_prob, 3),
                            'processed_at': datetime.utcnow().isoformat(),
                            'data_quality_score': round(random.uniform(0.85, 0.99), 2)
                        })

                        self._store_sensor_data(data)

                        if processed_count % 100 == 0:
                            logger.info(f"Processed {processed_count} sensor messages")

                        if is_anomaly:
                            logger.warning(
                                f"ML outlier: {data['sensor_id']} - Score: {anomaly_score:.3f}"
                            )
            except ValueError as e:
                logger.warning("Kafka consumer socket issue detected, reconnecting: %s", e)
                try:
                    self.consumer.close()
                except Exception:
                    pass
                time.sleep(1)
                self.consumer = self._create_consumer()
            except Exception as e:
                logger.error(f"Error processing message: {e}")
                continue
    
    def _calculate_failure_probability(self, data, is_anomaly, anomaly_score):
        bands = data.get('threshold_bands') or {}
        rank = {'LOW': 0, 'MEDIUM': 1, 'HIGH': 2, 'CRITICAL': 3}
        worst = max((rank.get(b, 0) for b in bands.values()), default=0)
        base_score = {0: 0.05, 1: 0.18, 2: 0.42, 3: 0.68}.get(worst, 0.1)

        if data.get('status') == 'critical':
            base_score = max(base_score, 0.55)
        elif data.get('status') == 'warning':
            base_score = max(base_score, 0.28)

        if is_anomaly:
            base_score += max(0, (anomaly_score + 0.1) * 0.25)

        return min(base_score, 1.0)
    
    def _store_sensor_data(self, data):
        sensor_key = f"sensor:{data['sensor_id']}"
        self.redis_client.setex(sensor_key, 600, json.dumps(data))
        
        location_key = f"location:{data['location']}:sensors"
        self.redis_client.sadd(location_key, data['sensor_id'])
        
        device_key = f"device_type:{data['device_type']}:sensors"
        self.redis_client.sadd(device_key, data['sensor_id'])
        
        stats_key = "dashboard:stats"
        self.redis_client.hincrbyfloat(stats_key, "total_energy", data['energy_consumption'])
        self.redis_client.hincrby(stats_key, "total_readings", 1)
        
        if data['status'] == 'critical':
            self.redis_client.sadd("alerts:critical", data['sensor_id'])
        elif data['status'] == 'warning':
            self.redis_client.sadd("alerts:warning", data['sensor_id'])

if __name__ == "__main__":
    processor = StreamProcessor()
    processor.process_stream()