import json
import random
import time
from datetime import datetime
from kafka import KafkaProducer
import logging
import os
import socket

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SensorSimulator:
    def __init__(self, kafka_broker=None):
        if kafka_broker is None:
            # Get producer laptop IP from environment or auto-detect
            producer_ip = os.getenv('HOST_IP', self._get_local_ip())
            kafka_broker = f"{producer_ip}:9092"
        
        self.kafka_broker = kafka_broker
        self.producer = self._initialize_kafka_producer()
        self.sensors = self._initialize_sensors()
        self.total_sensors = 300  # Fixed number of active sensors
        logger.info(f"Initialized {len(self.sensors)} sensors on Kafka broker: {kafka_broker}")
    
    def _get_local_ip(self):
        """Get local IP address for Kafka advertising"""
        try:
            # Connect to a remote server to determine local IP
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            s.close()
            return local_ip
        except:
            return "localhost"
    
    def _initialize_kafka_producer(self):
        """Initialize Kafka producer with retry logic"""
        attempts = 0
        max_attempts = 30
        
        while attempts < max_attempts:
            try:
                producer = KafkaProducer(
                    bootstrap_servers=[self.kafka_broker],
                    value_serializer=lambda x: json.dumps(x).encode('utf-8'),
                    retries=5,
                    acks='all',  # Ensure data is replicated
                    linger_ms=100,  # Batch messages for efficiency
                    batch_size=16384  # 16KB batch size
                )
                logger.info(f"Successfully connected to Kafka at {self.kafka_broker}")
                return producer
            except Exception as e:
                attempts += 1
                logger.warning(f"Attempt {attempts}/{max_attempts}: Failed to connect to Kafka at {self.kafka_broker}: {e}")
                if attempts >= max_attempts:
                    raise Exception(f"Failed to connect to Kafka after {max_attempts} attempts")
                time.sleep(2)
    
    def _initialize_sensors(self):
        """Initialize exactly 300 sensors that will be reused in each iteration"""
        sensors = []
        device_types = ['motor', 'compressor', 'conveyor', 'furnace', 'pump', 'generator', 'cooling_tower']
        locations = ['floor_a', 'floor_b', 'floor_c', 'assembly_line', 'warehouse', 'production_a', 'production_b']
        
        # Create exactly 300 sensors
        for i in range(self.total_sensors):
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
        
        logger.info(f"Initialized {len(sensors)} sensors (fixed set for all iterations)")
        return sensors
    
    def generate_sensor_data(self):
        """Generate and stream sensor data to Kafka using the same 300 sensors"""
        batch_size = 50  # Increased batch size for 300 sensors
        logger.info(f"Starting sensor data generation with {self.total_sensors} active sensors...")
        
        try:
            iteration_count = 0
            while True:
                iteration_count += 1
                batch_data = []
                start_time = time.time()
                
                logger.info(f"Starting iteration {iteration_count} with {len(self.sensors)} sensors")
                
                # Use the same 300 sensors for each iteration
                for sensor in self.sensors:
                    data = self._generate_sensor_reading(sensor)
                    batch_data.append(data)
                    
                    # Send batch when size is reached
                    if len(batch_data) >= batch_size:
                        self._send_batch(batch_data)
                        batch_data = []
                
                # Send remaining data
                if batch_data:
                    self._send_batch(batch_data)
                
                logger.info(f"Completed iteration {iteration_count} - processed {len(self.sensors)} sensors")
                
                # Adaptive sleep based on processing time
                processing_time = time.time() - start_time
                sleep_time = max(2, 10 - processing_time)  # Ensure at least 2 seconds between iterations
                time.sleep(sleep_time)
                
        except KeyboardInterrupt:
            logger.info("Stopping sensor simulator...")
        except Exception as e:
            logger.error(f"Error in sensor data generation: {e}")
        finally:
            self.producer.close()
    
    def _generate_sensor_reading(self, sensor):
        """Generate a single sensor reading for the same sensor"""
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
        
        return {
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
            'power_factor': round(random.uniform(0.85, 0.95), 2),
            'producer_host': os.getenv('HOST_IP', 'unknown'),
            'is_anomaly': status in ['critical', 'warning']
        }
    
    def _send_batch(self, batch_data):
        """Send a batch of sensor data to Kafka"""
        try:
            for data_point in batch_data:
                future = self.producer.send(
                    'sensor-data', 
                    value=data_point,
                    key=data_point['sensor_id'].encode()  # Partition by sensor_id
                )
                # Optional: Wait for acknowledgment
                # future.get(timeout=10)
            
            self.producer.flush()  # Ensure all messages are sent
            logger.info(f"Sent batch of {len(batch_data)} sensor readings to Kafka")
            
        except Exception as e:
            logger.error(f"Failed to send batch to Kafka: {e}")

    def get_sensor_count(self):
        """Get the current number of active sensors"""
        return len(self.sensors)
    
    def get_sensor_list(self):
        """Get list of all sensor IDs"""
        return [sensor['sensor_id'] for sensor in self.sensors]

if __name__ == "__main__":
    simulator = SensorSimulator()
    simulator.generate_sensor_data()