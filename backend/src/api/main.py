from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import redis
import json
import logging
import os
from typing import List, Dict, Any
import asyncio
from datetime import datetime

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

# WebSocket manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                self.active_connections.remove(connection)

manager = ConnectionManager()

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
        redis_client = get_redis_client()
        sensors = []
        
        # Get all sensor keys
        sensor_keys = redis_client.keys("sensor:*")
        
        for key in sensor_keys:
            sensor_data = redis_client.get(key)
            if sensor_data:
                sensors.append(json.loads(sensor_data))
        
        return {
            "sensors": sensors,
            "count": len(sensors),
            "consumer_host": os.getenv('HOST_IP', 'unknown')
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching sensors: {e}")

@app.get("/api/sensors/{sensor_id}")
async def get_sensor(sensor_id: str):
    """Get specific sensor data"""
    try:
        redis_client = get_redis_client()
        sensor_data = redis_client.get(f"sensor:{sensor_id}")
        
        if not sensor_data:
            raise HTTPException(status_code=404, detail="Sensor not found")
        
        return json.loads(sensor_data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching sensor: {e}")

@app.get("/api/dashboard/stats")
async def get_dashboard_stats():
    """Get dashboard statistics"""
    try:
        redis_client = get_redis_client()
        stats_key = "dashboard:stats"
        
        stats = redis_client.hgetall(stats_key)
        total_energy = float(stats.get('total_energy', 0))
        total_readings = int(stats.get('total_readings', 0))
        
        # Get anomaly count
        anomaly_count = redis_client.scard("alerts:anomalies")
        
        return {
            "total_energy_consumption": round(total_energy, 2),
            "total_readings": total_readings,
            "anomaly_count": anomaly_count,
            "average_consumption": round(total_energy / max(total_readings, 1), 2),
            "status_normal": int(stats.get('status_normal', 0)),
            "status_warning": int(stats.get('status_warning', 0)),
            "status_critical": int(stats.get('status_critical', 0))
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching stats: {e}")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Send initial data
        redis_client = get_redis_client()
        stats = await get_dashboard_stats()
        await websocket.send_text(json.dumps({
            "type": "initial_data",
            "data": stats
        }))
        
        # Keep connection alive and send updates
        while True:
            # Wait for any message (keep connection alive)
            await websocket.receive_text()
            
            # Send updated stats every 5 seconds
            await asyncio.sleep(5)
            stats = await get_dashboard_stats()
            await websocket.send_text(json.dumps({
                "type": "stats_update",
                "data": stats
            }))
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    host = os.getenv('API_HOST', '0.0.0.0')
    port = int(os.getenv('API_PORT', '8000'))
    
    logger.info(f"Starting API server on {host}:{port}")
    uvicorn.run(app, host=host, port=port, log_level="info")