"""
Test Kafka Consumer Connection
This script verifies that the stream processor can connect to Kafka and consume messages
"""

import os
import sys
import time
import json
from kafka import KafkaConsumer, KafkaAdminClient
from kafka.admin import NewTopic

def test_kafka_connection():
    """Test basic Kafka connectivity"""
    kafka_broker = os.getenv('KAFKA_BROKER', os.getenv('PRODUCER_IP', 'localhost') + ':9092')
    
    print(f"🔍 Testing Kafka connection to: {kafka_broker}")
    
    try:
        # Try to create admin client
        admin_client = KafkaAdminClient(
            bootstrap_servers=[kafka_broker],
            client_id='test-connection',
            api_version=(0, 10, 1)
        )
        
        print("✅ Successfully connected to Kafka Admin API")
        
        # List all topics
        topics = admin_client.list_topics()
        print(f"📋 Available Kafka topics: {topics}")
        
        # Check if sensor-data topic exists
        if 'sensor-data' in topics:
            print("✅ Topic 'sensor-data' exists")
        else:
            print("⚠️  Topic 'sensor-data' does not exist. It will be auto-created when producer sends data.")
        
        return True
        
    except Exception as e:
        print(f"❌ Failed to connect to Kafka: {e}")
        return False

def test_consumer_subscription():
    """Test consumer subscription and message consumption"""
    kafka_broker = os.getenv('KAFKA_BROKER', os.getenv('PRODUCER_IP', 'localhost') + ':9092')
    
    print(f"\n🔍 Testing consumer subscription to Kafka at: {kafka_broker}")
    
    try:
        consumer = KafkaConsumer(
            'sensor-data',
            bootstrap_servers=[kafka_broker],
            value_deserializer=lambda x: json.loads(x.decode('utf-8')),
            auto_offset_reset='latest',
            group_id='test-consumer-group',
            enable_auto_commit=True,
            consumer_timeout_ms=10000,
            api_version=(0, 10, 1),
            security_protocol='PLAINTEXT'
        )
        
        print("✅ Kafka consumer initialized")
        
        # Get topic metadata
        topics = consumer.topics()
        print(f"📋 Available topics: {topics}")
        
        partitions = consumer.partitions_for_topic('sensor-data')
        print(f"📊 Partitions for 'sensor-data': {partitions}")
        
        # Subscribe to topic
        consumer.subscribe(['sensor-data'])
        print("✅ Subscribed to 'sensor-data' topic")
        
        # Wait for partition assignment
        time.sleep(2)
        
        assignment = consumer.assignment()
        print(f"📌 Partition assignment: {assignment}")
        
        # Try to poll for messages
        print("\n⏳ Polling for messages (waiting 15 seconds)...")
        messages = consumer.poll(timeout_ms=15000, max_records=10)
        
        if messages:
            total_messages = sum(len(records) for records in messages.values())
            print(f"✅ Received {total_messages} messages!")
            
            # Show first message as sample
            for topic_partition, records in messages.items():
                for msg in records[:1]:
                    print(f"\n📨 Sample message from {topic_partition}:")
                    print(f"   Offset: {msg.offset}")
                    print(f"   Key: {msg.key}")
                    print(f"   Value: {json.dumps(msg.value, indent=2)[:200]}...")
                break
        else:
            print("⚠️  No messages received. Make sure the producer is running and sending data.")
        
        consumer.close()
        print("\n✅ Consumer closed successfully")
        
        return True
        
    except Exception as e:
        print(f"❌ Consumer test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("="*70)
    print("KAFKA CONSUMER CONNECTION TEST")
    print("="*70)
    
    # Test 1: Basic connection
    print("\n[Test 1/2] Testing basic Kafka connection...")
    if not test_kafka_connection():
        print("\n❌ Basic connection test FAILED")
        print("\nTroubleshooting tips:")
        print("  1. Ensure Kafka is running on the producer machine")
        print("  2. Check that PRODUCER_IP environment variable is set correctly")
        print("  3. Verify network connectivity between consumer and producer")
        print("  4. Check firewall rules allow traffic on port 9092")
        return False
    
    # Test 2: Consumer subscription
    print("\n[Test 2/2] Testing consumer subscription...")
    if not test_consumer_subscription():
        print("\n❌ Consumer subscription test FAILED")
        print("\nTroubleshooting tips:")
        print("  1. Ensure the producer has created the 'sensor-data' topic")
        print("  2. Check that Kafka is configured to auto-create topics")
        print("  3. Verify the consumer group ID is not blocked")
        return False
    
    print("\n" + "="*70)
    print("✅ ALL TESTS PASSED!")
    print("="*70)
    print("\nYour stream processor should now be able to consume messages from Kafka.")
    print("Make sure the producer is running to see real-time data.")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
