import os
from typing import Dict, Any

class Config:
    """Configuration management for the application"""
    
    # Kafka Configuration
    KAFKA_BROKER = os.getenv('KAFKA_BROKER', 'localhost:9092')
    KAFKA_TOPIC = os.getenv('KAFKA_TOPIC', 'sensor-data')
    
    # Redis Configuration
    REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
    REDIS_PORT = int(os.getenv('REDIS_PORT', '6379'))
    REDIS_DB = int(os.getenv('REDIS_DB', '0'))
    
    # API Configuration
    API_HOST = os.getenv('API_HOST', '0.0.0.0')
    API_PORT = int(os.getenv('API_PORT', '8000'))
    
    # Sensor Configuration
    TOTAL_SENSORS = int(os.getenv('TOTAL_SENSORS', '300'))
    DATA_INTERVAL = int(os.getenv('DATA_INTERVAL', '5'))  # seconds
    
    # ML Configuration
    ANOMALY_CONTAMINATION = float(os.getenv('ANOMALY_CONTAMINATION', '0.1'))
    FAILURE_THRESHOLD = float(os.getenv('FAILURE_THRESHOLD', '0.7'))
    
    @classmethod
    def get_all(cls) -> Dict[str, Any]:
        """Get all configuration values"""
        return {
            'kafka_broker': cls.KAFKA_BROKER,
            'kafka_topic': cls.KAFKA_TOPIC,
            'redis_host': cls.REDIS_HOST,
            'redis_port': cls.REDIS_PORT,
            'api_host': cls.API_HOST,
            'api_port': cls.API_PORT,
            'total_sensors': cls.TOTAL_SENSORS,
            'data_interval': cls.DATA_INTERVAL
        }

# Global configuration instance
config = Config()