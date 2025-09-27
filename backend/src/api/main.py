from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import redis
import json
import logging
import os
from typing import List, Dict, Any
import asyncio
from datetime import datetime, timedelta
import pandas as pd

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="IoT Energy Monitor API - Consumer Side")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Redis connection
def get_redis_client():
    redis_host = os.getenv('REDIS_HOST', 'redis')
    return redis.Redis(host=redis_host, port=6379, db=0, decode_responses=True)

# Producer Status Tracker
class ProducerStatusTracker:
    def __init__(self):
        self.last_data_time = None
        self.producer_timeout = 30  # 30 seconds timeout
        self.is_producer_active = False
    
    def update_data_received(self):
        """Called when new data is received from producer"""
        self.last_data_time = datetime.utcnow()
        self.is_producer_active = True
    
    def check_producer_status(self):
        """Check if producer is still active"""
        if self.last_data_time is None:
            return False
        
        time_since_last_data = datetime.utcnow() - self.last_data_time
        if time_since_last_data.total_seconds() > self.producer_timeout:
            self.is_producer_active = False
            return False
        
        return True
    
    def get_producer_status(self):
        """Get current producer status"""
        is_active = self.check_producer_status()
        return {
            "is_active": is_active,
            "last_data_time": self.last_data_time.isoformat() if self.last_data_time else None,
            "time_since_last_data": (datetime.utcnow() - self.last_data_time).total_seconds() if self.last_data_time else None
        }

# Initialize the producer status tracker
producer_tracker = ProducerStatusTracker()

# WebSocket manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"New WebSocket connection. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: Dict[str, Any]):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.warning(f"Failed to send to WebSocket: {e}")
                disconnected.append(connection)
        
        for connection in disconnected:
            self.active_connections.remove(connection)

manager = ConnectionManager()

def get_sensor_data(sensor_id: str = None) -> List[Dict]:
    """Retrieve sensor data from Redis"""
    sensors_data = []
    
    try:
        redis_client = get_redis_client()
        if sensor_id:
            # Get specific sensor
            key = f"sensor:{sensor_id}"
            data = redis_client.get(key)
            if data:
                sensors_data.append(json.loads(data))
        else:
            # Get all sensors
            for key in redis_client.scan_iter("sensor:*"):
                try:
                    data = redis_client.get(key)
                    if data:
                        sensors_data.append(json.loads(data))
                except Exception as e:
                    logger.warning(f"Error reading sensor data from Redis: {e}")
                    continue
    except Exception as e:
        logger.error(f"Error retrieving sensor data: {e}")
    
    return sensors_data

def get_realtime_sensor_data() -> Dict[str, Any]:
    """Get real-time sensor data for WebSocket"""
    sensors_data = get_sensor_data()
    
    # Update producer status based on data availability
    if sensors_data:
        producer_tracker.update_data_received()
    else:
        # If no data, check if producer is still active
        producer_tracker.check_producer_status()
    
    if not sensors_data:
        return {
            "sensors": [],
            "stats": {
                "total_energy_consumption": 0,
                "total_readings": 0,
                "anomaly_count": 0,
                "average_consumption": 0,
                "status_normal": 0,
                "status_warning": 0,
                "status_critical": 0
            },
            "producer_status": producer_tracker.get_producer_status()
        }
    
    # Transform sensor data to match frontend expectations
    transformed_sensors = []
    for sensor in sensors_data:
        transformed_sensors.append({
            "id": sensor.get("sensor_id", "unknown"),
            "name": sensor.get("name", f"Sensor {sensor.get('sensor_id', 'unknown')}"),
            "location": sensor.get("location", "Unknown"),
            "status": sensor.get("status", "normal"),
            "current": sensor.get("current", 0),
            "voltage": sensor.get("voltage", 0),
            "power": sensor.get("power", 0),
            "energy_consumption": sensor.get("energy_consumption", 0),
            "temperature": sensor.get("temperature", 0),
            "pressure": sensor.get("pressure", 0),
            "power_factor": sensor.get("power_factor", 0.9),
            "is_anomaly": sensor.get("is_anomaly", False),
            "timestamp": sensor.get("timestamp", datetime.utcnow().isoformat())
        })
    
    # Calculate stats in the format expected by frontend
    df = pd.DataFrame(sensors_data)
    stats = {
        "total_energy_consumption": round(df['energy_consumption'].sum(), 2),
        "total_readings": len(sensors_data),
        "anomaly_count": len(df[df['is_anomaly'] == True]),
        "average_consumption": round(df['energy_consumption'].mean(), 2),
        "status_normal": len(df[df['status'] == 'normal']),
        "status_warning": len(df[df['status'] == 'warning']),
        "status_critical": len(df[df['status'] == 'critical'])
    }
    
    return {
        "sensors": transformed_sensors,
        "stats": stats,
        "producer_status": producer_tracker.get_producer_status()
    }

@app.get("/")
async def root():
    return {
        "message": "IoT Energy Monitor API - Consumer Side",
        "status": "running",
        "consumer_host": os.getenv('HOST_IP', 'unknown')
    }

@app.get("/health")
async def health_check():
    try:
        redis_client = get_redis_client()
        redis_client.ping()
        return {
            "status": "healthy",
            "redis": "connected",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Redis connection failed: {e}")

@app.get("/api/sensors")
async def get_all_sensors():
    """Get all sensor data from Redis"""
    try:
        sensors_data = get_sensor_data()
        
        return {
            "sensors": sensors_data,
            "count": len(sensors_data),
            "consumer_host": os.getenv('HOST_IP', 'unknown')
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching sensors: {e}")

@app.get("/api/sensors/{sensor_id}")
async def get_sensor(sensor_id: str):
    """Get specific sensor data"""
    try:
        sensor_data = get_sensor_data(sensor_id)
        
        if not sensor_data:
            raise HTTPException(status_code=404, detail="Sensor not found")
        
        return sensor_data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching sensor: {e}")

@app.get("/api/dashboard/stats")
async def get_dashboard_stats():
    """Get dashboard statistics"""
    try:
        realtime_data = get_realtime_sensor_data()
        return JSONResponse(content=realtime_data["stats"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching stats: {e}")

@app.get("/api/energy-data/realtime")
async def get_realtime_energy_data():
    """Get real-time energy data for frontend"""
    realtime_data = get_realtime_sensor_data()
    return JSONResponse(content=realtime_data)

@app.get("/api/producer/status")
async def get_producer_status():
    """Get current producer status"""
    return producer_tracker.get_producer_status()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    
    try:
        # Send initial data with sensors and stats
        initial_data = get_realtime_sensor_data()
        await websocket.send_json({
            "type": "initial_data",
            "sensors": initial_data["sensors"],
            "stats": initial_data["stats"],
            "producer_status": initial_data["producer_status"],
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Keep sending updates
        while True:
            realtime_data = get_realtime_sensor_data()
            
            await websocket.send_json({
                "type": "realtime_update",
                "sensors": realtime_data["sensors"],
                "stats": realtime_data["stats"],
                "producer_status": realtime_data["producer_status"],
                "timestamp": datetime.utcnow().isoformat()
            })
            
            # Send producer status alerts
            if not realtime_data["producer_status"]["is_active"]:
                await websocket.send_json({
                    "type": "producer_disconnected",
                    "message": "Producer has stopped sending data",
                    "producer_status": realtime_data["producer_status"],
                    "timestamp": datetime.utcnow().isoformat()
                })
            
            # Send critical alerts
            critical_sensors = [s for s in realtime_data["sensors"] if s.get('status') == 'critical']
            if critical_sensors:
                await websocket.send_json({
                    "type": "critical_alert",
                    "data": {
                        "count": len(critical_sensors),
                        "sensors": critical_sensors[:5]
                    },
                    "timestamp": datetime.utcnow().isoformat()
                })
            
            await asyncio.sleep(3)  # Update every 3 seconds
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    host = os.getenv('API_HOST', '0.0.0.0')
    port = int(os.getenv('API_PORT', '8000'))
    
    logger.info(f"Starting API server on {host}:{port}")
    uvicorn.run(app, host=host, port=port, log_level="info")