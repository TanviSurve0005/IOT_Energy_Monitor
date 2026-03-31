"""Quick test to verify Kafka consumption is working"""
import json
from kafka import KafkaConsumer

print("Testing Kafka consumer...")
consumer = KafkaConsumer(
    'sensor-data',
    bootstrap_servers=['localhost:9092'],
    value_deserializer=lambda x: json.loads(x.decode('utf-8')),
    auto_offset_reset='latest',
    group_id='test-consumer-manual',
    enable_auto_commit=True,
    consumer_timeout_ms=10000
)

print("Consumer created, waiting for messages...")
try:
    for message in consumer:
        print(f"✅ Received: {message.value['sensor_id']} - Current: {message.value['current']}A")
except Exception as e:
    print(f"Error: {e}")
finally:
    consumer.close()
    print("Consumer closed")
