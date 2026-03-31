"""
Kafka to Redis Bridge - Simple Consumer
Directly consumes from Kafka and stores in Redis (bypassing complex ML processing)
"""

import json
import redis
from kafka import KafkaConsumer
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    logger.info("Starting Kafka to Redis Bridge...")
    
    # Initialize Redis
    redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)
    redis_client.ping()
    logger.info("Connected to Redis")
    
    # Initialize Kafka consumer
    consumer = KafkaConsumer(
        'sensor-data',
        bootstrap_servers=['localhost:9092'],
        value_deserializer=lambda x: json.loads(x.decode('utf-8')),
        auto_offset_reset='latest',
        group_id='redis-bridge-consumer',
        enable_auto_commit=True,
        consumer_timeout_ms=5000
    )
    
    logger.info("Connected to Kafka")
    logger.info("Waiting for messages...")
    
    message_count = 0
    
    try:
        for message in consumer:
            try:
                data = message.value
                message_count += 1
                
                # Store raw sensor data in Redis
                sensor_key = f"sensor:{data.get('sensor_id', 'unknown')}"
                redis_client.setex(sensor_key, 600, json.dumps(data))
                
                # Update stats
                stats_key = "dashboard:stats"
                redis_client.hincrbyfloat(stats_key, "total_energy", data.get('energy_consumption', 0))
                redis_client.hincrby(stats_key, "total_readings", 1)
                
                if message_count % 50 == 0:
                    logger.info(f"✅ Stored {message_count} messages in Redis")
                
                if message_count % 100 == 0:
                    keys_count = redis_client.dbsize()
                    logger.info(f"Redis database size: {keys_count} keys")
                    
            except Exception as e:
                logger.error(f"Error processing message: {e}")
                continue
                
    except KeyboardInterrupt:
        logger.info("Stopped by user")
    finally:
        consumer.close()
        logger.info("Bridge stopped")

if __name__ == "__main__":
    main()
