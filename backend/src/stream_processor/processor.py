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
    def __init__(self, kafka_broker=None, redis_host=None):
        # Get consumer laptop IP and producer IP
        self.consumer_ip = os.getenv('HOST_IP', 'localhost')
        self.producer_ip = os.getenv('PRODUCER_IP', 'localhost')
        
        if kafka_broker is None:
            kafka_broker = f"{self.producer_ip}:9092"
        if redis_host is None:
            redis_host = os.getenv('REDIS_HOST', 'redis')
        
        self.kafka_broker = kafka_broker
        self.redis_host = redis_host
        self.consumer = self._initialize_kafka_consumer()
        self.redis_client = self._initialize_redis()
        self.anomaly_model = self._train_anomaly_model()
        self.scaler = StandardScaler()
        logger.info(f"Stream processor initialized on {self.consumer_ip}, connecting to Kafka at {kafka_broker}")
    
    def _initialize_kafka_consumer(self):
        """Initialize Kafka consumer with retry logic"""
        attempts = 0
        max_attempts = 30
        
        logger.info(f"Attempting to connect to Kafka at: {self.kafka_broker}")
        
        while attempts < max_attempts:
            try:
                consumer = KafkaConsumer(
                    'sensor-data',
                    bootstrap_servers=[self.kafka_broker],
                    value_deserializer=lambda x: json.loads(x.decode('utf-8')),
                    auto_offset_reset='latest',  # Start from latest messages
                    group_id='energy-monitor-consumer-group',
                    enable_auto_commit=True,
                    consumer_timeout_ms=10000,  # Timeout after 10 seconds of no messages
                    max_poll_records=50,  # Process in smaller batches
                    api_version=(0, 10, 1),  # Specify API version for compatibility
                    security_protocol='PLAINTEXT'  # Explicitly set security protocol
                )
                logger.info(f"Successfully connected to Kafka consumer at {self.kafka_broker}")
                return consumer
            except Exception as e:
                attempts += 1
                logger.warning(f"Attempt {attempts}/{max_attempts}: Failed to connect to Kafka at {self.kafka_broker}: {e}")
                if attempts >= max_attempts:
                    raise Exception(f"Failed to connect to Kafka after {max_attempts} attempts")
                time.sleep(2)
    
    def _initialize_redis(self):
        """Initialize Redis connection"""
        try:
            client = redis.Redis(
                host=self.redis_host, 
                port=6379, 
                db=0, 
                decode_responses=True,
                socket_connect_timeout=5,
                retry_on_timeout=True
            )
            client.ping()  # Test connection
            logger.info(f"Connected to Redis at {self.redis_host}")
            return client
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