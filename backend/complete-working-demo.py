"""
Complete Working Demo: Producer + Consumer + Stream Processor
This simulates the FULL industrial IoT data flow:
1. Generates 300 sensor readings
2. Sends to Kafka (for logging/other consumers)
3. Processes with ML (anomaly detection)
4. Stores enriched data in Redis
"""

import redis
import json
from datetime import datetime
import random
import numpy as np
from sklearn.ensemble import IsolationForest
from kafka import KafkaProducer
import time

# Initialize connections
print("🚀 Initializing Complete IoT Data Flow...")
r = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)
print(f"✅ Redis connected: {r.ping()}")

producer = KafkaProducer(bootstrap_servers='localhost:9092')
print(f"✅ Kafka producer connected")

# Initialize ML model (same as stream_processor.py)
print("🤖 Training anomaly detection model...")
np.random.seed(42)
n_samples = 1000
current_normal = np.random.normal(25, 10, n_samples)
temp_normal = np.random.normal(30, 5, n_samples)
pressure_normal = np.random.normal(5, 2, n_samples)
X_normal = np.column_stack([current_normal, temp_normal, pressure_normal])
anomaly_model = IsolationForest(contamination=0.1, random_state=42, n_estimators=100)
anomaly_model.fit(X_normal)
print("✅ ML model trained (Isolation Forest)")

def calculate_failure_probability(data, is_anomaly, anomaly_score):
    """Calculate failure probability based on sensor readings and anomaly status"""
    base_score = 0.0
    
    if data['status'] == 'critical':
        base_score = 0.8
    elif data['status'] == 'warning':
        base_score = 0.5
    else:
        base_score = 0.1
    
    anomaly_boost = 0.3 if is_anomaly else 0.0
    score_boost = max(0, anomaly_score) * 0.2 if anomaly_score > 0 else 0.0
    
    final_prob = min(1.0, base_score + anomaly_boost + score_boost)
    return round(final_prob, 3)

print("\n🔄 Starting continuous data generation and processing...\n")

iteration = 0
total_processed = 0

while True:
    try:
        iteration += 1
        start_time = time.time()
        
        # Generate 300 sensors
        sensors_data = []
        for i in range(300):
            # Create realistic sensor data
            if i < 270:  # 90% normal
                status = 'normal'
                current = round(20 + (i % 5) * 2 + random.uniform(-1, 1), 1)
                temperature = round(30 + (i % 5) + random.uniform(-0.5, 0.5), 1)
                pressure = round(5 + (i % 5) * 0.5 + random.uniform(-0.2, 0.2), 2)
            elif i < 290:  # 6.7% warning
                status = 'warning'
                current = round(45 + (i % 10) + random.uniform(-2, 2), 1)
                temperature = round(65 + (i % 10) + random.uniform(-1, 1), 1)
                pressure = round(12 + (i % 10) * 0.5 + random.uniform(-0.3, 0.3), 2)
            else:  # 3.3% critical
                status = 'critical'
                current = round(70 + (i % 10) + random.uniform(-3, 3), 1)
                temperature = round(85 + (i % 10) + random.uniform(-1, 1), 1)
                pressure = round(18 + (i % 10) * 0.3 + random.uniform(-0.5, 0.5), 2)
            
            sensor = {
                'sensor_id': f'sensor_{i:03d}',
                'name': f'Sensor {i}',
                'device_type': ['motor', 'pump', 'compressor', 'conveyor', 'generator'][i % 5],
                'location': ['floor_a', 'floor_b', 'assembly_line', 'warehouse', 'production_a'][i % 5],
                'current': current,
                'voltage': 220,
                'power': round(current * 220 / 1000, 2),
                'energy_consumption': round(10 + i * 2 + random.uniform(-0.5, 0.5), 2),
                'temperature': temperature,
                'pressure': pressure,
                'status': status
            }
            sensors_data.append(sensor)
        
        print(f"\n{'='*60}")
        print(f"Iteration {iteration} - Processing {len(sensors_data)} sensors")
        print(f"{'='*60}")
        
        # Process each sensor through ML (simulating stream processor)
        processed_count = 0
        anomaly_count = 0
        
        for sensor in sensors_data:
            try:
                # Send to Kafka (producer role)
                producer.send('sensor-data', value=sensor)
                
                # Process with ML (stream processor role)
                features = np.array([[sensor['current'], sensor['temperature'], sensor['pressure']]])
                features_scaled = (features - features.mean()) / features.std() if features.std() > 0 else features
                
                is_anomaly = bool(anomaly_model.predict(features_scaled)[0] == -1)
                anomaly_score = float(anomaly_model.decision_function(features_scaled)[0])
                failure_prob = calculate_failure_probability(sensor, is_anomaly, anomaly_score)
                
                # Enrich sensor data
                sensor.update({
                    'is_anomaly': is_anomaly,
                    'anomaly_score': round(anomaly_score, 4),
                    'failure_probability': failure_prob,
                    'processed_at': datetime.utcnow().isoformat(),
                    'data_quality_score': round(random.uniform(0.85, 0.99), 2)
                })
                
                # Store in Redis (stream processor role)
                key = f"sensor:{sensor['sensor_id']}"
                r.setex(key, 300, json.dumps(sensor))
                
                processed_count += 1
                if is_anomaly:
                    anomaly_count += 1
                    
            except Exception as e:
                print(f"❌ Error processing sensor: {e}")
                continue
        
        # Send batch to Kafka
        producer.flush()
        
        elapsed = time.time() - start_time
        
        # Summary
        normal_count = len([s for s in sensors_data if s['status'] == 'normal'])
        warning_count = len([s for s in sensors_data if s['status'] == 'warning'])
        critical_count = len([s for s in sensors_data if s['status'] == 'critical'])
        
        print(f"⏱️  Processing time: {elapsed:.2f}s")
        print(f"✅ Processed: {processed_count}/{len(sensors_data)} sensors")
        print(f"🟢 Normal: {normal_count} | 🟡 Warning: {warning_count} | 🔴 Critical: {critical_count}")
        print(f"🔍 Anomalies detected: {anomaly_count} ({anomaly_count/processed_count*100:.1f}%)")
        print(f"💾 Redis keys: {len(r.keys('sensor:*'))}")
        print(f"📊 Kafka: Messages sent to 'sensor-data' topic")
        
        total_processed += processed_count
        print(f"\n📈 Total sensors processed this session: {total_processed}")
        
        # Wait before next iteration
        time.sleep(10)  # Update every 10 seconds
        
    except KeyboardInterrupt:
        print("\n\n⛔ Stopped by user")
        break
    except Exception as e:
        print(f"\n❌ Error in iteration {iteration}: {e}")
        time.sleep(5)

print("\n👋 Shutting down...")
producer.close()
