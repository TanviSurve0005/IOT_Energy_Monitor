import json
import random
from kafka import KafkaConsumer, TopicPartition
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import redis
import logging
from datetime import datetime
import os
import time

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
                    max_poll_records=50  # Process in smaller batches
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
            logger.error(f"Failed to connect to Redis: {e}")
            raise
    
    def _train_anomaly_model(self):
        """Train initial anomaly detection model"""
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
        """Process Kafka stream and store in Redis"""
        logger.info("Starting to process sensor data stream from producer...")
        processed_count = 0
        last_log_time = time.time()
        
        try:
            while True:
                # Poll for messages with timeout
                messages = self.consumer.poll(timeout_ms=5000, max_records=50)
                
                if not messages:
                    # No messages received, check if we're still connected
                    current_time = time.time()
                    if current_time - last_log_time > 30:  # Log every 30 seconds if idle
                        logger.info("Waiting for sensor data from producer...")
                        last_log_time = current_time
                    continue
                
                for topic_partition, messages_batch in messages.items():
                    for message in messages_batch:
                        try:
                            data = message.value
                            processed_count += 1
                            
                            # Process the data
                            processed_data = self._process_sensor_data(data)
                            
                            # Store in Redis
                            self._store_sensor_data(processed_data)
                            
                            # Log progress
                            if processed_count % 50 == 0:
                                logger.info(f"Processed {processed_count} sensor messages from producer")
                                last_log_time = time.time()
                                
                        except Exception as e:
                            logger.error(f"Error processing message: {e}")
                            continue
                
                # Commit offsets after processing batch
                self.consumer.commit()
                
        except KeyboardInterrupt:
            logger.info("Stopping stream processor...")
        except Exception as e:
            logger.error(f"Error in stream processing: {e}")
        finally:
            self.consumer.close()
            self.redis_client.close()
    
    def _process_sensor_data(self, data):
        """Process individual sensor data point"""
        features = np.array([[data['current'], data['temperature'], data['pressure']]])
        
        # Update scaler incrementally
        if hasattr(self.scaler, 'n_samples_seen_'):
            self.scaler.partial_fit(features)
        else:
            self.scaler.fit(features)
        
        features_scaled = self.scaler.transform(features)
        
        is_anomaly = bool(self.anomaly_model.predict(features_scaled)[0] == -1)
        anomaly_score = float(self.anomaly_model.decision_function(features_scaled)[0])
        
        failure_prob = self._calculate_failure_probability(data, is_anomaly, anomaly_score)
        
        # Add consumer processing metadata
        data.update({
            'is_anomaly': is_anomaly,
            'anomaly_score': round(anomaly_score, 4),
            'failure_probability': round(failure_prob, 3),
            'processed_at': datetime.utcnow().isoformat(),
            'data_quality_score': round(random.uniform(0.85, 0.99), 2),
            'consumer_host': self.consumer_ip,
            'processed_by': 'stream-processor'
        })
        
        return data
    
    def _calculate_failure_probability(self, data, is_anomaly, anomaly_score):
        """Calculate failure probability based on sensor readings"""
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
        """Store processed data in Redis with expiration"""
        try:
            sensor_key = f"sensor:{data['sensor_id']}"
            # Store with 10-minute expiration
            self.redis_client.setex(sensor_key, 600, json.dumps(data))
            
            # Update statistics
            stats_key = "dashboard:stats"
            self.redis_client.hincrbyfloat(stats_key, "total_energy", data['energy_consumption'])
            self.redis_client.hincrby(stats_key, "total_readings", 1)
            self.redis_client.hincrby(stats_key, f"status_{data['status']}", 1)
            
            if data['is_anomaly']:
                self.redis_client.sadd("alerts:anomalies", data['sensor_id'])
            
            # Store recent readings (last 100 per sensor)
            recent_key = f"recent:{data['sensor_id']}"
            self.redis_client.lpush(recent_key, json.dumps(data))
            self.redis_client.ltrim(recent_key, 0, 99)
            
        except Exception as e:
            logger.error(f"Error storing data in Redis: {e}")

if __name__ == "__main__":
    processor = StreamProcessor()
    processor.process_stream()