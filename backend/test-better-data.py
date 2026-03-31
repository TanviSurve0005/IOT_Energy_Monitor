import redis
import json
from datetime import datetime

# Connect to Redis
r = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

print(f"Redis ping: {r.ping()}")

# Create 300 test sensors with realistic data including critical ones
test_sensors = []
for i in range(300):
    # Create varied sensor data
    if i < 270:  # Normal sensors (90%)
        status = 'normal'
        current = round(20 + (i % 5) * 2, 1)
        temperature = round(30 + (i % 5), 1)
        pressure = round(5 + (i % 5) * 0.5, 2)
        anomaly_score = round(-0.8 + (i * 0.002), 4)
        failure_prob = round(0.1 + (i * 0.001), 3)
    elif i < 290:  # Warning sensors (6.7%)
        status = 'warning'
        current = round(45 + (i % 10), 1)
        temperature = round(65 + (i % 10), 1)
        pressure = round(12 + (i % 10) * 0.5, 2)
        anomaly_score = round(-0.2 + (i * 0.01), 4)
        failure_prob = round(0.4 + (i * 0.01), 3)
    else:  # Critical sensors (3.3%)
        status = 'critical'
        current = round(70 + (i % 10), 1)
        temperature = round(85 + (i % 10), 1)
        pressure = round(18 + (i % 10) * 0.3, 2)
        anomaly_score = round(0.3 + (i * 0.01), 4)
        failure_prob = round(0.75 + (i * 0.005), 3)
    
    sensor = {
        'sensor_id': f'sensor_{i:03d}',
        'name': f'Sensor {i}',
        'device_type': ['motor', 'pump', 'compressor', 'conveyor', 'generator'][i % 5],
        'location': ['floor_a', 'floor_b', 'assembly_line', 'warehouse', 'production_a'][i % 5],
        'current': current,
        'voltage': 220,
        'power': round(current * 220 / 1000, 2),
        'energy_consumption': round(10 + i * 2, 2),
        'temperature': temperature,
        'pressure': pressure,
        'status': status,
        'is_anomaly': (status == 'critical'),
        'anomaly_score': anomaly_score,
        'failure_probability': failure_prob,
        'timestamp': datetime.utcnow().isoformat()
    }
    test_sensors.append(sensor)
    key = f'sensor:{sensor["sensor_id"]}'
    r.setex(key, 600, json.dumps(sensor))
    print(f"✅ Stored {key} - {status.upper()}")

# Verify
keys = r.keys('sensor:*')
print(f"\n📊 Total sensors in Redis: {len(keys)}")

# Count by status
normal_count = len([s for s in test_sensors if s['status'] == 'normal'])
warning_count = len([s for s in test_sensors if s['status'] == 'warning'])
critical_count = len([s for s in test_sensors if s['status'] == 'critical'])

print(f"🟢 Normal: {normal_count}")
print(f"🟡 Warning: {warning_count}")
print(f"🔴 Critical: {critical_count}")

if keys:
    sample = json.loads(r.get(keys[0]))
    print(f"\nSample sensor: {sample['sensor_id']}")
    print(f"  Status: {sample['status']}")
    print(f"  Anomaly Score: {sample['anomaly_score']}")
    print(f"  Failure Probability: {sample['failure_probability']}")

print("\n✅ Test data ready! Refresh your frontend at http://localhost:3000")
