from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import json
import os
import redis
import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any
import pandas as pd
from ml_models.optimizer import EnergyOptimizer

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="IoT Monitor API",
    description="Real-time energy consumption monitoring and optimization system",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components
REDIS_HOST = os.getenv('REDIS_HOST', 'redis')
REDIS_PORT = int(os.getenv('REDIS_PORT', '6379'))

redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0, decode_responses=True)
try:
    redis_client.ping()  # Test connection
    logger.info(f"Redis connection established at {REDIS_HOST}:{REDIS_PORT}")
except redis.ConnectionError:
    # Do not crash the app; endpoints will handle degraded state until Redis is ready
    logger.warning(f"Failed to connect to Redis at {REDIS_HOST}:{REDIS_PORT}. Running in degraded mode until Redis is available.")

optimizer = EnergyOptimizer()

# WebSocket connection manager
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

# Utility functions
def get_sensor_data(sensor_id: str = None) -> List[Dict]:
    """Retrieve sensor data from Redis"""
    sensors_data = []
    
    try:
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

def calculate_dashboard_stats() -> Dict[str, Any]:
    """Calculate comprehensive dashboard statistics"""
    sensors_data = get_sensor_data()
    
    if not sensors_data:
        return {
            "total_energy": 0,
            "critical_sensors": 0,
            "warning_sensors": 0,
            "total_sensors": 0,
            "efficiency_score": 100,
            "total_power": 0,
            "avg_temperature": 0,
            "avg_pressure": 0,
            "anomaly_count": 0,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    df = pd.DataFrame(sensors_data)
    
    total_energy = df['energy_consumption'].sum()
    critical_sensors = len(df[df['status'] == 'critical'])
    warning_sensors = len(df[df['status'] == 'warning'])
    total_sensors = len(df)
    anomaly_count = len(df[df['is_anomaly'] == True])
    
    # Calculate efficiency score (0-100)
    critical_penalty = critical_sensors * 3
    warning_penalty = warning_sensors * 1
    anomaly_penalty = anomaly_count * 2
    efficiency_score = max(0, 100 - critical_penalty - warning_penalty - anomaly_penalty)
    
    return {
        "total_energy": round(total_energy, 2),
        "critical_sensors": critical_sensors,
        "warning_sensors": warning_sensors,
        "total_sensors": total_sensors,
        "efficiency_score": round(efficiency_score, 1),
        "total_power": round(df['current'].sum(), 1),
        "avg_temperature": round(df['temperature'].mean(), 1),
        "avg_pressure": round(df['pressure'].mean(), 2),
        "anomaly_count": anomaly_count,
        "timestamp": datetime.utcnow().isoformat()
    }

# API Routes
@app.get("/")
async def root():
    return {
        "message": "IoT Smart Energy Monitor API",
        "version": "2.0.0",
        "status": "operational",
        "timestamp": datetime.utcnow().isoformat(),
        "endpoints": {
            "documentation": "/api/docs",
            "sensors": "/api/sensors",
            "dashboard": "/api/dashboard/stats",
            "optimization": "/api/optimization/suggestions",
            "health": "/api/health",
            "websocket": "/ws"
        }
    }

@app.get("/api/sensors")
async def get_all_sensors(limit: int = 100, offset: int = 0):
    """Get all sensor data with pagination"""
    sensors_data = get_sensor_data()
    
    # Apply pagination
    paginated_data = sensors_data[offset:offset + limit]
    
    return {
        "sensors": paginated_data,
        "pagination": {
            "total": len(sensors_data),
            "limit": limit,
            "offset": offset,
            "has_more": offset + limit < len(sensors_data)
        },
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/api/sensors/{sensor_id}")
async def get_sensor(sensor_id: str):
    """Get specific sensor data"""
    sensor_data = get_sensor_data(sensor_id)
    
    if not sensor_data:
        raise HTTPException(status_code=404, detail="Sensor not found")
    
    return {
        "sensor": sensor_data[0],
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/api/dashboard/stats")
async def get_dashboard_stats():
    """Get comprehensive dashboard statistics"""
    stats = calculate_dashboard_stats()
    return JSONResponse(content=stats)

@app.get("/api/optimization/suggestions")
async def get_optimization_suggestions(limit: int = 10):
    """Get energy optimization suggestions"""
    sensors_data = get_sensor_data()
    suggestions = optimizer.generate_suggestions(sensors_data)[:limit]
    
    return {
        "suggestions": suggestions,
        "total_generated": len(suggestions),
        "generated_at": datetime.utcnow().isoformat()
    }

@app.get("/api/analytics/history")
async def get_analytics_history(hours: int = 24):
    """Get historical analytics data (simulated)"""
    # In a real system, this would query a time-series database
    end_time = datetime.utcnow()
    start_time = end_time - timedelta(hours=hours)
    
    # Generate simulated historical data
    history = []
    current_time = start_time
    
    while current_time <= end_time:
        # Simulate data points with some variation
        base_energy = 1500  # Base energy consumption
        hour_variation = abs(12 - current_time.hour)  # Peak around noon
        energy = base_energy * (1 - hour_variation * 0.03) * (0.9 + 0.2 * (current_time.minute / 60))
        
        history.append({
            "timestamp": current_time.isoformat(),
            "energy_consumption": round(energy, 2),
            "active_sensors": 280 + int(20 * (current_time.minute / 60)),
            "efficiency_score": 85 + int(10 * (current_time.minute / 60))
        })
        
        current_time += timedelta(minutes=5)  # 5-minute intervals
    
    return {
        "history": history[-100:],  # Return last 100 points
        "time_range": {
            "start": start_time.isoformat(),
            "end": end_time.isoformat()
        }
    }

@app.get("/api/health")
async def health_check():
    """Comprehensive health check endpoint"""
    redis_healthy = False
    try:
        redis_healthy = redis_client.ping()
    except:
        pass
    
    sensors_data = get_sensor_data()
    
    return {
        "status": "healthy" if redis_healthy and sensors_data else "degraded",
        "components": {
            "redis": "healthy" if redis_healthy else "unhealthy",
            "sensor_data": "available" if sensors_data else "unavailable",
            "api": "healthy"
        },
        "metrics": {
            "active_sensors": len(sensors_data),
            "redis_connected": redis_healthy,
            "uptime": "unknown"  # Would be calculated in real deployment
        },
        "timestamp": datetime.utcnow().isoformat()
    }

# WebSocket endpoint for real-time updates
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    
    try:
        # Send initial data
        initial_stats = calculate_dashboard_stats()
        await websocket.send_json({
            "type": "initial_data",
            "data": initial_stats,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Keep sending updates
        while True:
            stats = calculate_dashboard_stats()
            
            await websocket.send_json({
                "type": "stats_update",
                "data": stats,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            # Send sensor alerts if any critical issues
            critical_sensors = [s for s in get_sensor_data() if s.get('status') == 'critical']
            if critical_sensors:
                await websocket.send_json({
                    "type": "critical_alert",
                    "data": {
                        "count": len(critical_sensors),
                        "sensors": critical_sensors[:5]  # Send first 5 critical sensors
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

# Error handlers
@app.exception_handler(404)
async def not_found_handler(request, exc):
    return JSONResponse(
        status_code=404,
        content={"error": "Endpoint not found", "path": request.url.path}
    )

@app.exception_handler(500)
async def internal_error_handler(request, exc):
    logger.error(f"Internal server error: {exc}")
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error"}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")