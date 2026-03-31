import redis
import json
from datetime import datetime
import random

r = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

print("🔄 Continuously updating Redis with simulated stream processor data...")

while True:
    try:
        # Simulate what stream processor does - add anomaly scores and failure probability
        # Process ALL 300 sensors
        for i in range(300):
            base_data = {
                'sensor_id': f'sensor_{i:03d}',
                'name': f'Sensor {i}',
                'device_type': ['motor', 'pump', 'compressor', 'conveyor', 'generator', 'cooling_tower', 'furnace'][i % 7],
                'location': ['floor_a', 'floor_b', 'floor_c', 'assembly_line', 'warehouse', 'production_a', 'production_b'][i % 7],
                'current': round(20 + (i % 5) * 2 + random.uniform(-1, 1), 1),
                'voltage': 220,
                'power': round((20 + (i % 5) * 2) * 220 / 1000, 2),
                'energy_consumption': round(10 + i * 2 + random.uniform(-0.5, 0.5), 2),
                'temperature': round(30 + (i % 5) + random.uniform(-0.5, 0.5), 1),
                'pressure': round(5 + (i % 5) * 0.5 + random.uniform(-0.2, 0.2), 2),
            }
            
            # Add stream processor calculated fields - realistic distribution for 300 sensors
            if i < 250:  # 83% normal
                status = 'normal'
                anomaly_score = round(-0.8 + (i * 0.005) + random.uniform(-0.05, 0.05), 4)
                failure_prob = round(0.1 + (i * 0.002) + random.uniform(-0.02, 0.02), 3)
                is_anomaly = False
            elif i < 280:  # 10% warning
                status = 'warning'
                anomaly_score = round(-0.2 + (i * 0.01) + random.uniform(-0.05, 0.05), 4)
                failure_prob = round(0.4 + (i * 0.005) + random.uniform(-0.05, 0.05), 3)
                is_anomaly = False
            else:  # 7% critical/anomaly
                status = 'critical'
                anomaly_score = round(0.3 + (i * 0.015) + random.uniform(-0.05, 0.05), 4)
                failure_prob = round(0.75 + (i * 0.008) + random.uniform(-0.05, 0.05), 3)
                is_anomaly = True
            
            sensor_data = {
                **base_data,
                'status': status,
                'is_anomaly': is_anomaly,
                'anomaly_score': anomaly_score,
                'failure_probability': failure_prob,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            key = f'sensor:{sensor_data["sensor_id"]}'
            r.setex(key, 300, json.dumps(sensor_data))
        
        print(f"✅ Updated {len(r.keys('sensor:*'))} sensors in Redis with fresh data")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    
    import time
    time.sleep(5)  # Update every 5 seconds
