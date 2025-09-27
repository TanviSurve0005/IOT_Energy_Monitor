from kafka import KafkaConsumer
import json
import logging
from .config import get_kafka_config

class EnergyDataConsumer:
    def __init__(self, topic, group_id=None):
        self.config = get_kafka_config()
        self.consumer = KafkaConsumer(
            topic,
            bootstrap_servers=[self.config['bootstrap_servers']],
            auto_offset_reset='earliest',
            enable_auto_commit=True,
            group_id=group_id or 'energy-consumer-group',
            value_deserializer=lambda x: json.loads(x.decode('utf-8')),
            key_deserializer=lambda x: json.loads(x.decode('utf-8')) if x else None
        )
        logging.info(f"Kafka Consumer initialized for topic: {topic}")

    def consume_messages(self, callback):
        """Consume messages and pass them to callback function"""
        try:
            for message in self.consumer:
                callback(message.value, message.key)
        except KeyboardInterrupt:
            logging.info("Consumer stopped")
        finally:
            self.close()

    def close(self):
        self.consumer.close()