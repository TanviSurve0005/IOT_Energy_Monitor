import json
import random
import time
from datetime import datetime
from kafka import KafkaProducer
import logging
import os
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SensorSimulator:
    def __init__(self, kafka_broker=None):
        if kafka_broker is None:
            kafka_broker = os.getenv('KAFKA_BROKER', 'kafka:9092')
        try:
            # Retry connect to Kafka while broker is starting
            attempts = 0
            last_err = None
            while attempts < 30:
                try:
                    self.producer = KafkaProducer(
                        bootstrap_servers=[kafka_broker],
                        value_serializer=lambda x: json.dumps(x).encode('utf-8'),
                        retries=5
                    )
                    break
                except Exception as e:
                    last_err = e
                    attempts += 1
                    logger.info(f"Waiting for Kafka at {kafka_broker}... (attempt {attempts})")
                    time.sleep(2)
            if not hasattr(self, 'producer'):
                raise last_err
            self.sensors = self._initialize_sensors()
            logger.info(f"Initialized {len(self.sensors)} sensors")
        except Exception as e:
            logger.error(f"Failed to initialize Kafka producer: {e}")
            raise
    
    def _initialize_sensors(self):
        sensors = []
        device_types = ['motor', 'compressor', 'conveyor', 'furnace', 'pump', 'generator', 'cooling_tower']
        locations = ['floor_a', 'floor_b', 'floor_c', 'assembly_line', 'warehouse', 'production_a', 'production_b']
        
        for i in range(300):  # 300 sensors for better performance
            base_current = random.uniform(5, 50)
            base_temp = random.uniform(20, 40)
            base_pressure = random.uniform(1, 10)
            
            sensors.append({
                'sensor_id': f'sensor_{i:03d}',
                'device_type': random.choice(device_types),
                'location': random.choice(locations),
                'base_current': base_current,
                'base_temp': base_temp,
                'base_pressure': base_pressure,
                'installation_date': f"2024-{random.randint(1,12):02d}-{random.randint(1,28):02d}"
            })
        return sensors
    
    def generate_sensor_data(self):
        batch_size = 50  # Send in batches for better performance
        logger.info("Starting sensor data generation...")
        
        while True:
            batch_data = []
            for i, sensor in enumerate(self.sensors):
                # Simulate realistic patterns (day/night cycles, weekday/weekend)
                current_hour = datetime.now().hour
                is_weekday = datetime.now().weekday() < 5
                
                # Base multipliers based on time
                if 6 <= current_hour <= 18 and is_weekday:  # Daytime, weekday
                    time_multiplier = random.uniform(1.0, 1.3)
                else:  # Night or weekend
                    time_multiplier = random.uniform(0.3, 0.8)
                
                # Occasional anomalies
                anomaly_chance = random.random()
                
                if anomaly_chance < 0.02:  # 2% critical anomaly
                    current = sensor['base_current'] * random.uniform(1.8, 3.0) * time_multiplier
                    temperature = sensor['base_temp'] * random.uniform(1.5, 2.5) * time_multiplier
                    pressure = sensor['base_pressure'] * random.uniform(1.4, 2.2) * time_multiplier
                    status = 'critical'
                elif anomaly_chance < 0.08:  # 6% warning
                    current = sensor['base_current'] * random.uniform(1.2, 1.6) * time_multiplier
                    temperature = sensor['base_temp'] * random.uniform(1.1, 1.4) * time_multiplier
                    pressure = sensor['base_pressure'] * random.uniform(1.1, 1.3) * time_multiplier
                    status = 'warning'
                else:  # 92% normal
                    current = sensor['base_current'] * random.uniform(0.9, 1.1) * time_multiplier
                    temperature = sensor['base_temp'] * random.uniform(0.95, 1.05) * time_multiplier
                    pressure = sensor['base_pressure'] * random.uniform(0.95, 1.05) * time_multiplier
                    status = 'normal'
                
                data = {
                    'timestamp': datetime.utcnow().isoformat(),
                    'sensor_id': sensor['sensor_id'],
                    'device_type': sensor['device_type'],
                    'location': sensor['location'],
                    'current': round(current, 2),
                    'temperature': round(temperature, 1),
                    'pressure': round(pressure, 2),
                    'status': status,
                    'energy_consumption': round(current * 220 / 1000, 2),  # kWh
                    'voltage': 220,
                    'power_factor': round(random.uniform(0.85, 0.95), 2)
                }
                
                batch_data.append(data)
                
                # Send batch when size is reached
                if len(batch_data) >= batch_size:
                    for data_point in batch_data:
                        self.producer.send('sensor-data', value=data_point)
                    batch_data = []
                    logger.info(f"Sent batch of {batch_size} sensor readings")
            
            # Send remaining data
            if batch_data:
                for data_point in batch_data:
                    self.producer.send('sensor-data', value=data_point)
                logger.info(f"Sent final batch of {len(batch_data)} sensor readings")
            
            time.sleep(5)  # Send data every 5 seconds

if __name__ == "__main__":
    simulator = SensorSimulator()
    simulator.generate_sensor_data()