import redis
import json
from datetime import datetime

# Connect to Redis
r = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

print(f"Redis ping: {r.ping()}")

# Create test sensors with anomaly scores and failure probability
test_sensors = []
for i in range(10):
    sensor = {
        'sensor_id': f'sensor_{i:03d}',
        'name': f'Sensor {i}',
        'device_type': ['motor', 'pump', 'compressor'][i % 3],
        'location': ['floor_a', 'floor_b', 'assembly_line'][i % 3],
        'current': round(20 + i * 2, 1),
        'voltage': 220,
        'power': round((20 + i * 2) * 220 / 1000, 2),
        'energy_consumption': round(10 + i * 1.5, 2),
        'temperature': round(30 + i, 1),
        'pressure': round(5 + i * 0.5, 2),
        'status': 'normal' if i < 7 else 'warning',
        'is_anomaly': False,
        'anomaly_score': round(-0.5 + (i * 0.1), 4),  # Negative score = normal
        'failure_probability': round(0.1 + (i * 0.05), 3),
        'timestamp': datetime.utcnow().isoformat()
    }
    test_sensors.append(sensor)
    key = f'sensor:{sensor["sensor_id"]}'
    r.setex(key, 600, json.dumps(sensor))
    print(f"✅ Stored {key}")

# Verify
keys = r.keys('sensor:*')
print(f"\n📊 Total sensors in Redis: {len(keys)}")

if keys:
    sample = json.loads(r.get(keys[0]))
    print(f"Sample sensor: {sample['sensor_id']} - {sample['status']}")

print("\n✅ Test data ready! Refresh your frontend at http://localhost:3000")
