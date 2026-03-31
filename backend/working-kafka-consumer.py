"""
Working Kafka Consumer - Direct Partition Assignment
Bypasses consumer group coordinator by manually assigning partitions
"""

import json
from kafka import KafkaConsumer, TopicPartition
import redis
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    logger.info("Starting direct partition assignment consumer...")
    
    # Initialize Redis
    redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)
    redis_client.ping()
    logger.info("Connected to Redis")
    
    # Create consumer WITHOUT group_id
    consumer = KafkaConsumer(
        bootstrap_servers=['localhost:9092'],
        value_deserializer=lambda x: json.loads(x.decode('utf-8')),
        enable_auto_commit=False,  # Manual control
        consumer_timeout_ms=5000,
        api_version=(2, 5, 0)  # Match broker version
    )
    
    logger.info("Consumer created (no group_id)")
    
    # Manually assign partition
    partition = TopicPartition('sensor-data', 0)
    consumer.assign([partition])
    
    # Seek to latest (only get new messages)
    consumer.seek_to_end(partition)  # Pass single partition, not list
    logger.info(f"Assigned to partition: {partition}, seeking to end")
    
    message_count = 0
    
    try:
        logger.info("Waiting for messages...")
        while True:
            messages = consumer.poll(timeout_ms=5000, max_records=100)
            
            if messages:
                for tp, records in messages.items():
                    for msg in records:
                        try:
                            data = msg.value
                            message_count += 1
                            
                            # Store in Redis
                            sensor_key = f"sensor:{data.get('sensor_id', 'unknown')}"
                            redis_client.setex(sensor_key, 600, json.dumps(data))
                            
                            # Update stats
                            stats_key = "dashboard:stats"
                            redis_client.hincrbyfloat(stats_key, "total_energy", data.get('energy_consumption', 0))
                            redis_client.hincrby(stats_key, "total_readings", 1)
                            
                            if message_count % 50 == 0:
                                logger.info(f"✅ Stored {message_count} messages | Redis keys: {redis_client.dbsize()}")
                            
                            if message_count % 10 == 0:
                                logger.info(f"Message {message_count}: {data['sensor_id']} - Current: {data['current']}A")
                                
                        except Exception as e:
                            logger.error(f"Error processing message: {e}")
                            continue
            else:
                logger.debug("No messages yet, waiting...")
                
    except KeyboardInterrupt:
        logger.info("Stopped by user")
    except Exception as e:
        logger.error(f"Consumer error: {e}")
    finally:
        consumer.close()
        logger.info("Consumer closed")

if __name__ == "__main__":
    main()
