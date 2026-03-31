"""
Kafka Consumer Debug Script
Tests different consumer configurations to identify the issue
"""

import json
from kafka import KafkaConsumer, TopicPartition
import time

print("="*70)
print("KAFKA CONSUMER DEBUG TEST")
print("="*70)

# Test 1: Basic connection with earliest offset
print("\n[Test 1] Testing with auto_offset_reset='earliest'...")
try:
    consumer1 = KafkaConsumer(
        'sensor-data',
        bootstrap_servers=['localhost:9092'],
        value_deserializer=lambda x: json.loads(x.decode('utf-8')),
        auto_offset_reset='earliest',  # Try earliest instead of latest
        group_id='debug-test-earliest',
        enable_auto_commit=True,
        consumer_timeout_ms=5000
    )
    
    print(f"✅ Consumer created successfully")
    print(f"   Topics: {consumer1.topics()}")
    print(f"   Partitions for sensor-data: {consumer1.partitions_for_topic('sensor-data')}")
    
    # Manually assign partitions
    partitions = [TopicPartition('sensor-data', 0)]
    consumer1.assign(partitions)
    print(f"   Manually assigned partitions: {partitions}")
    
    # Seek to beginning
    consumer1.seek_to_beginning()
    print(f"   Seeking to beginning...")
    
    print("   Waiting for messages (10 seconds)...")
    count = 0
    for message in consumer1:
        count += 1
        print(f"   ✅ Received message {count}: {message.value['sensor_id']}")
        if count >= 5:
            break
    
    if count == 0:
        print("   ⚠️  No messages received even with earliest offset")
    
    consumer1.close()
    print(f"   Consumer closed\n")
    
except Exception as e:
    print(f"❌ Test 1 failed: {e}\n")

# Test 2: Try without group_id (anonymous consumer)
print("\n[Test 2] Testing without group_id (anonymous consumer)...")
try:
    consumer2 = KafkaConsumer(
        'sensor-data',
        bootstrap_servers=['localhost:9092'],
        value_deserializer=lambda x: json.loads(x.decode('utf-8')),
        auto_offset_reset='earliest',
        enable_auto_commit=False,
        consumer_timeout_ms=5000
        # No group_id - creates anonymous consumer
    )
    
    print(f"✅ Anonymous consumer created")
    print(f"   Subscription: {consumer2.subscription()}")
    
    # Wait for partition assignment
    time.sleep(2)
    assignment = consumer2.assignment()
    print(f"   Partition assignment: {assignment}")
    
    if not assignment:
        print("   ⚠️  Still no partition assignment!")
        print("   This suggests a broker-consumer networking issue")
    else:
        print(f"   Waiting for messages (10 seconds)...")
        count = 0
        for message in consumer2:
            count += 1
            print(f"   ✅ Message {count}: Offset={message.offset}")
            if count >= 5:
                break
        
        if count == 0:
            print("   ⚠️  No messages received")
    
    consumer2.close()
    print(f"   Consumer closed\n")
    
except Exception as e:
    print(f"❌ Test 2 failed: {e}\n")

# Test 3: Check topic metadata
print("\n[Test 3] Checking topic metadata...")
try:
    consumer3 = KafkaConsumer(
        bootstrap_servers=['localhost:9092'],
        consumer_timeout_ms=2000
    )
    
    topics = consumer3.topics()
    print(f"✅ All topics: {topics}")
    
    if 'sensor-data' in topics:
        print(f"✅ Topic 'sensor-data' exists")
        
        # Get partition info
        partitions = consumer3.partitions_for_topic('sensor-data')
        print(f"   Partitions: {partitions}")
        
        if partitions:
            for partition in partitions:
                tp = TopicPartition('sensor-data', partition)
                print(f"   Partition {partition}: Assigned but offsets unknown")
    else:
        print(f"⚠️  Topic 'sensor-data' does not exist!")
        print(f"   Producer may not have sent data yet or topic auto-creation is disabled")
    
    consumer3.close()
    
except Exception as e:
    print(f"❌ Test 3 failed: {e}")

print("\n" + "="*70)
print("DEBUG SUMMARY")
print("="*70)
print("""
Key Findings:
1. If partition assignment is empty (set()), it's a consumer group coordination issue
2. If topics exist but no messages, check producer is actually sending
3. If earliest offset doesn't work, messages may have expired or topic is empty

Next Steps:
- Try different consumer group IDs
- Check Kafka broker logs for consumer group errors
- Verify producer is continuously sending (not just once)
- Consider using docker-compose Kafka configuration with proper listeners
""")
