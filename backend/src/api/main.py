from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import redis
import json
import logging
import os
import random
from typing import List, Dict, Any
import asyncio
from datetime import datetime, timedelta
import pandas as pd

logging.basicConfig(level=logging.DEBUG)
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
                logger.warning(f"No data found for sensor {sensor_id}")
        else:
            # Get all sensors - use keys() instead of scan_iter() for better compatibility
            try:
                sensor_keys = redis_client.keys("sensor:*")
                logger.debug(f"Found {len(sensor_keys)} sensor keys in Redis")
                
                if not sensor_keys:
                    logger.warning("No sensor keys found in Redis")
                
                for key in sensor_keys:
                    try:
                        data = redis_client.get(key)
                        if data:
                            sensors_data.append(json.loads(data))
                    except Exception as e:
                        logger.warning(f"Error reading sensor data from Redis key {key}: {e}")
                        continue
            except Exception as e:
                logger.error(f"Error scanning Redis keys: {e}")
    except Exception as e:
        logger.error(f"Error retrieving sensor data: {e}")
    
    return sensors_data

def get_realtime_sensor_data() -> Dict[str, Any]:
    """Get real-time sensor data for WebSocket"""
    sensors_data = get_sensor_data()
    
    # Update producer status based on data availability
    if sensors_data:
        producer_tracker.update_data_received()
        logger.debug(f"Retrieved {len(sensors_data)} sensors from Redis")
    else:
        # If no data, check if producer is still active
        producer_tracker.check_producer_status()
        logger.warning("No sensor data available in Redis")
    
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
    try:
        df = pd.DataFrame(sensors_data)
        stats = {
            "total_energy_consumption": round(float(df['energy_consumption'].sum()), 2),
            "total_readings": int(len(sensors_data)),
            "anomaly_count": int(len(df[df['is_anomaly'] == True])),
            "average_consumption": round(float(df['energy_consumption'].mean()), 2),
            "status_normal": int(len(df[df['status'] == 'normal'])),
            "status_warning": int(len(df[df['status'] == 'warning'])),
            "status_critical": int(len(df[df['status'] == 'critical']))
        }
        logger.debug(f"Calculated stats: {stats}")
    except Exception as e:
        logger.error(f"Error calculating stats: {e}")
        logger.error(f"Sensors data: {sensors_data[:3] if sensors_data else 'None'}")
        # Return default stats if calculation fails
        stats = {
            "total_energy_consumption": 0,
            "total_readings": len(sensors_data),
            "anomaly_count": 0,
            "average_consumption": 0,
            "status_normal": 0,
            "status_warning": 0,
            "status_critical": 0
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
        
        # Check Redis data
        sensor_keys = redis_client.keys("sensor:*")
        sample_data = None
        if sensor_keys:
            sample_key = sensor_keys[0]
            sample_data = redis_client.get(sample_key)
            logger.info(f"Redis health: {len(sensor_keys)} sensors, sample: {sample_key}")
        
        return {
            "status": "healthy",
            "redis": "connected",
            "sensor_count": len(sensor_keys) if sensor_keys else 0,
            "sample_sensor": sample_data,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Redis connection failed: {e}")

@app.get("/api/sensors")
async def get_all_sensors():
    """Get all sensor data from Redis"""
    try:
        sensors_data = get_sensor_data()
        
        logger.info(f"Retrieved {len(sensors_data)} sensors from Redis")
        
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


@app.get("/api/optimization/suggestions")
async def get_optimization_suggestions():
    """Get AI-powered optimization suggestions based on sensor data"""
    try:
        sensors_data = get_sensor_data()
        
        if not sensors_data:
            return {"suggestions": []}
        
        suggestions = []
        df = pd.DataFrame(sensors_data)
        
        # Generate suggestions based on sensor patterns
        # 1. High energy consumption devices
        high_consumption = df.nlargest(3, 'energy_consumption')
        for _, sensor in high_consumption.iterrows():
            if sensor['energy_consumption'] > 25:  # Threshold
                suggestions.append({
                    "id": f"opt_{sensor['sensor_id']}_energy",
                    "title": "High Energy Consumption Alert",
                    "description": f"{sensor['device_type']} at {sensor['location']} is consuming {sensor['energy_consumption']} kWh. Consider scheduling operation during off-peak hours.",
                    "action": "schedule_shift",
                    "priority": "high" if sensor['energy_consumption'] > 30 else "medium",
                    "device_type": sensor['device_type'],
                    "location": sensor['location'],
                    "sensor_id": sensor['sensor_id'],
                    "potential_savings": round(sensor['energy_consumption'] * 0.15, 2),
                    "risk_score": 0.3
                })
        
        # 2. Anomaly detection - sensors with anomalies
        anomaly_sensors = df[df['is_anomaly'] == True]
        for _, sensor in anomaly_sensors.iterrows():
            suggestions.append({
                "id": f"opt_{sensor['sensor_id']}_anomaly",
                "title": "Anomaly Detected - Maintenance Required",
                "description": f"{sensor['device_type']} at {sensor['location']} showing anomalous behavior (score: {sensor.get('anomaly_score', 0):.3f}). Schedule preventive maintenance.",
                "action": "schedule_maintenance",
                "priority": "critical" if sensor.get('failure_probability', 0) > 0.7 else "high",
                "device_type": sensor['device_type'],
                "location": sensor['location'],
                "sensor_id": sensor['sensor_id'],
                "potential_savings": round(50 + (sensor.get('failure_probability', 0) * 100), 2),
                "risk_score": sensor.get('failure_probability', 0.5)
            })
        
        # 3. Warning status sensors
        warning_sensors = df[df['status'] == 'warning']
        for _, sensor in warning_sensors.iterrows():
            suggestions.append({
                "id": f"opt_{sensor['sensor_id']}_warning",
                "title": "Performance Degradation Warning",
                "description": f"{sensor['device_type']} at {sensor['location']} operating in warning state. Temperature: {sensor['temperature']}°C, Pressure: {sensor['pressure']} bar. Investigate calibration.",
                "action": "efficiency_audit",
                "priority": "medium",
                "device_type": sensor['device_type'],
                "location": sensor['location'],
                "sensor_id": sensor['sensor_id'],
                "potential_savings": round(20 + (sensor['temperature'] * 0.5), 2),
                "risk_score": 0.4
            })
        
        logger.info(f"Generated {len(suggestions)} optimization suggestions")
        
        return {"suggestions": suggestions}
        
    except Exception as e:
        logger.error(f"Error generating suggestions: {e}", exc_info=True)
        return {"suggestions": [], "error": str(e)}


@app.get("/api/analytics/history")
async def get_analytics_history(hours: int = 24):
    """Get historical analytics data for charts"""
    try:
        sensors_data = get_sensor_data()
        
        if not sensors_data:
            return {"data": []}
        
        df = pd.DataFrame(sensors_data)
        
        # Generate historical data points (simulated time-series based on current data)
        historical_data = []
        now = datetime.utcnow()
        
        for i in range(min(hours, 168)):  # Max 7 days (168 hours)
            timestamp = now - timedelta(hours=i)
            variation = 1 + (random.uniform(-0.2, 0.2) * (i / hours))
            
            historical_data.append({
                "timestamp": timestamp.isoformat(),
                "energy_consumption": round(float(df['energy_consumption'].sum()) * variation / hours, 2),
                "efficiency_score": round(85 + random.uniform(-5, 5), 1),
                "active_sensors": int(len(df)),
                "avg_temperature": round(float(df['temperature'].mean()) + random.uniform(-2, 2), 1),
                "anomaly_rate": round((len(df[df['is_anomaly'] == True]) / len(df)) + random.uniform(-0.05, 0.05), 3)
            })
        
        historical_data.sort(key=lambda x: x['timestamp'])
        logger.info(f"Generated {len(historical_data)} historical data points")
        
        return {"data": historical_data}
        
    except Exception as e:
        logger.error(f"Error generating historical data: {e}", exc_info=True)
        return {"data": [], "error": str(e)}


@app.post("/api/devices/{device_id}/control")
async def control_device(device_id: str, action: dict):
    """Control IoT device (restart, shutdown, etc.)"""
    try:
        action_type = action.get('action', '')
        
        logger.info(f"Device control request: {device_id} - {action_type}")
        
        # In a real system, this would send commands to actual hardware
        # For now, just log and return success
        return {
            "success": True,
            "message": f"Device {device_id} {action_type} command sent successfully",
            "device_id": device_id,
            "action": action_type,
            "status": "completed"
        }
        
    except Exception as e:
        logger.error(f"Error controlling device: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
        logger.info(f"Sending initial WebSocket data: {len(initial_data['sensors'])} sensors")
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
            
            if len(realtime_data["sensors"]) > 0:
                logger.debug(f"Sending WebSocket update: {len(realtime_data['sensors'])} sensors")
            
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