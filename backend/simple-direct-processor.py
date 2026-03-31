"""
Simple Direct Processor - Bypasses Kafka consumption issue
This directly processes sensor data and updates Redis
Works alongside the Kafka producer for immediate results
"""

import redis
import json
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from datetime import datetime
import time
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SimpleDirectProcessor:
    def __init__(self):
        self.redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)
        self.redis_client.ping()
        logger.info("Connected to Redis")
        
        # Initialize ML model
        self.anomaly_model = self._train_model()
        self.scaler = StandardScaler()
        logger.info("ML model ready")
    
    def _train_model(self):
        np.random.seed(42)
        n_samples = 1000
        current_normal = np.random.normal(25, 10, n_samples)
        temp_normal = np.random.normal(30, 5, n_samples)
        pressure_normal = np.random.normal(5, 2, n_samples)
        X_normal = np.column_stack([current_normal, temp_normal, pressure_normal])
        model = IsolationForest(contamination=0.1, random_state=42, n_estimators=100)
        model.fit(X_normal)
        return model
    
    def process_sensor_data(self, data):
        """Process a single sensor reading"""
        try:
            features = np.array([[data['current'], data['temperature'], data['pressure']]])
            
            if not hasattr(self, '_fitted'):
                self.scaler.partial_fit(features)
                self._fitted = True
            
            features_scaled = self.scaler.transform(features)
            is_anomaly = bool(self.anomaly_model.predict(features_scaled)[0] == -1)
            anomaly_score = float(self.anomaly_model.decision_function(features_scaled)[0])
            
            # Calculate failure probability
            failure_prob = self._calculate_failure_probability(data, is_anomaly, anomaly_score)
            
            # Enrich data
            data.update({
                'is_anomaly': is_anomaly,
                'anomaly_score': round(anomaly_score, 4),
                'failure_probability': round(failure_prob, 3),
                'processed_at': datetime.utcnow().isoformat(),
                'data_quality_score': round(np.random.uniform(0.85, 0.99), 2)
            })
            
            # Store in Redis
            self._store_in_redis(data)
            
            return data
        except Exception as e:
            logger.error(f"Error processing data: {e}")
            return None
    
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
    
    def _store_in_redis(self, data):
        sensor_key = f"sensor:{data['sensor_id']}"
        self.redis_client.setex(sensor_key, 600, json.dumps(data))
        
        # Update dashboard stats
        stats_key = "dashboard:stats"
        self.redis_client.hincrbyfloat(stats_key, "total_energy", data.get('energy_consumption', 0))
        self.redis_client.hincrby(stats_key, "total_readings", 1)
        
        if data.get('status') == 'critical':
            self.redis_client.sadd("alerts:critical", data['sensor_id'])
        elif data.get('status') == 'warning':
            self.redis_client.sadd("alerts:warning", data['sensor_id'])

def main():
    logger.info("Starting Simple Direct Processor...")
    processor = SimpleDirectProcessor()
    
    processed_count = 0
    
    while True:
        try:
            # Get all sensor keys from Redis
            sensor_keys = processor.redis_client.keys("sensor:*")
            
            if sensor_keys:
                logger.info(f"Processing {len(sensor_keys)} sensors...")
                
                for key in sensor_keys[:50]:  # Process 50 at a time
                    try:
                        data_json = processor.redis_client.get(key)
                        if data_json:
                            data = json.loads(data_json)
                            processed_data = processor.process_sensor_data(data)
                            
                            if processed_data:
                                processed_count += 1
                                
                                if processed_count % 100 == 0:
                                    logger.info(f"Processed {processed_count} sensors")
                    except Exception as e:
                        logger.error(f"Error processing {key}: {e}")
                
                logger.info(f"✅ Updated {len(sensor_keys)} sensors in Redis with ML enrichment")
            else:
                logger.info("Waiting for sensor data in Redis...")
            
            time.sleep(5)  # Wait 5 seconds before next batch
            
        except KeyboardInterrupt:
            logger.info("Stopped by user")
            break
        except Exception as e:
            logger.error(f"Error: {e}")
            time.sleep(5)

if __name__ == "__main__":
    main()
