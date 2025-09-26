from kafka import KafkaProducer
import json
import logging
from .config import get_kafka_config

class EnergyDataProducer:
    def __init__(self):
        self.config = get_kafka_config()
        self.producer = KafkaProducer(
            bootstrap_servers=[self.config['bootstrap_servers']],
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            key_serializer=lambda v: json.dumps(v).encode('utf-8'),
            acks='all',
            retries=3
        )
        self.topics = self.config['topics']
        logging.info("Kafka Producer initialized")

    def send_sensor_data(self, sensor_data):
        try:
            future = self.producer.send(
                self.topics['sensor_data'],
                key={'sensor_id': sensor_data['sensor_id']},
                value=sensor_data
            )
            future.get(timeout=10)
            logging.info(f"Sent sensor data: {sensor_data['sensor_id']}")
            return True
        except Exception as e:
            logging.error(f"Failed to send sensor data: {e}")
            return False

    def send_processed_data(self, processed_data):
        try:
            self.producer.send(
                self.topics['processed_data'],
                value=processed_data
            )
            logging.info("Sent processed data")
        except Exception as e:
            logging.error(f"Failed to send processed data: {e}")

    def send_anomaly(self, anomaly_data):
        try:
            self.producer.send(
                self.topics['anomalies'],
                value=anomaly_data
            )
            logging.info(f"Sent anomaly alert: {anomaly_data}")
        except Exception as e:
            logging.error(f"Failed to send anomaly: {e}")

    def send_optimization(self, optimization_data):
        try:
            self.producer.send(
                self.topics['optimization'],
                value=optimization_data
            )
            logging.info("Sent optimization data")
        except Exception as e:
            logging.error(f"Failed to send optimization: {e}")

    def close(self):
        self.producer.close()