import os

KAFKA_CONFIG = {
    'bootstrap_servers': os.getenv('KAFKA_BROKER', 'localhost:9092'),
    'client_id': 'iot-energy-monitor',
    'topics': {
        'sensor_data': 'iot-sensor-data',
        'processed_data': 'iot-processed-data',
        'anomalies': 'iot-anomalies',
        'optimization': 'iot-optimization'
    }
}

def get_kafka_config():
    return KAFKA_CONFIG