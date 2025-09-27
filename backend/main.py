import threading
import os
from src.data_simulator.sensor_simulator import SensorSimulator
from src.stream_processor.processor import StreamProcessor
import uvicorn
from src.api.main import app
import time

def start_backend():
    print("Starting IoT Energy Monitor Backend...")
    
    # Start sensor simulator
    print("Starting sensor simulator...")
    simulator_thread = threading.Thread(target=lambda: SensorSimulator(os.getenv('KAFKA_BROKER', 'kafka:9092')).generate_sensor_data(), daemon=True)
    simulator_thread.start()
    
    # Start stream processor
    print("Starting stream processor...")
    processor_thread = threading.Thread(target=lambda: StreamProcessor(os.getenv('KAFKA_BROKER', 'kafka:9092'), os.getenv('REDIS_HOST', 'redis')).process_stream(), daemon=True)
    processor_thread.start()
    
    # Start FastAPI server
    print("Starting FastAPI server on http://0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")

if __name__ == "__main__":
    start_backend()