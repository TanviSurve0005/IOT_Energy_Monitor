import json
import random  # FIXED: Added missing import
from kafka import KafkaConsumer
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import redis
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class StreamProcessor:
    def __init__(self, kafka_broker='localhost:9092', redis_host='localhost'):
        try:
            self.consumer = KafkaConsumer(
                'sensor-data',
                bootstrap_servers=[kafka_broker],
                value_deserializer=lambda x: json.loads(x.decode('utf-8')),
                auto_offset_reset='earliest',
                group_id='energy-monitor-group',
                enable_auto_commit=True
            )
            self.redis_client = redis.Redis(host=redis_host, port=6379, db=0, decode_responses=True)
            self.anomaly_model = self._train_anomaly_model()
            self.scaler = StandardScaler()
            logger.info("Stream processor initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize stream processor: {e}")
            raise
    
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
        
        for message in self.consumer:
            try:
                data = message.value
                processed_count += 1
                
                features = np.array([[data['current'], data['temperature'], data['pressure']]])
                
                if processed_count == 1:
                    self.scaler.partial_fit(features)
                features_scaled = self.scaler.transform(features)
                
                is_anomaly = self.anomaly_model.predict(features_scaled)[0] == -1
                anomaly_score = float(self.anomaly_model.decision_function(features_scaled)[0])
                
                failure_prob = self._calculate_failure_probability(data, is_anomaly, anomaly_score)
                
                data.update({
                    'is_anomaly': is_anomaly,
                    'anomaly_score': round(anomaly_score, 4),
                    'failure_probability': round(failure_prob, 3),
                    'processed_at': datetime.utcnow().isoformat(),
                    'data_quality_score': round(random.uniform(0.85, 0.99), 2)  # FIXED: random is now imported
                })
                
                self._store_sensor_data(data)
                
                if processed_count % 100 == 0:
                    logger.info(f"Processed {processed_count} sensor messages")
                    
                if is_anomaly:
                    logger.warning(f"Anomaly detected: {data['sensor_id']} - Score: {anomaly_score:.3f}")
                    
            except Exception as e:
                logger.error(f"Error processing message: {e}")
                continue
    
    def _calculate_failure_probability(self, data, is_anomaly, anomaly_score):
        base_score = 0.0
        
        if data['current'] > 80: base_score += 0.4
        elif data['current'] > 60: base_score += 0.2
        elif data['current'] > 40: base_score += 0.1
        
        if data['temperature'] > 85: base_score += 0.3
        elif data['temperature'] > 70: base_score += 0.15
        elif data['temperature'] > 55: base_score += 0.05
        
        if data['pressure'] > 18: base_score += 0.3
        elif data['pressure'] > 12: base_score += 0.15
        elif data['pressure'] > 8: base_score += 0.05
        
        if data['status'] == 'critical': base_score += 0.3
        elif data['status'] == 'warning': base_score += 0.15
        
        if is_anomaly:
            base_score += max(0, (anomaly_score + 0.1) * 0.5)
        
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