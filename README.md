# IoT Smart Energy Monitor

Real-time industrial energy management platform that simulates 300+ sensors, streams telemetry through Kafka, enriches it with anomaly/failure analytics, persists the latest state in Redis, and exposes dashboards plus APIs for operators.

## Key Capabilities
- **High-fidelity simulation** – `SensorSimulator` publishes realistic current/temperature/pressure data with injected anomalies to Kafka.
- **Stream analytics** – `StreamProcessor` consumes the topic, standardizes readings, applies an Isolation Forest model, computes failure probabilities, and fan-outs enriched data to Redis sets/hashes.
- **Operational API** – FastAPI service (`src/api/main.py`) exposes REST + WebSocket endpoints for dashboards, alerting, and producer health tracking.
- **Rich front-end** – Vite/React UI (`frontend/`) renders real-time dashboards, sensor grids, analytics, and optimization guidance via context-provided WebSocket data.
- **Deployment-ready** – `deployment/` includes docker-compose stacks, env templates, and helper scripts for running the consumer side against a remote Kafka producer.

## Architecture at a Glance
```
┌─────────────┐    sensor-data     ┌──────────────────┐        ┌──────────────┐
│SensorSimulator│ ───────────────▶ │Kafka (producer IP)│ ─────▶ │StreamProcessor│
└─────────────┘                    └──────────────────┘        └──────┬───────┘
                                                                         │ enriched events
                                                                         ▼
                                                                   ┌─────────┐
                                                                   │ Redis   │
                                                                   └────┬────┘
                                                                        │
                                   REST/WS             VITE API URL     │
                                ┌────────────┐  HTTP  ┌───────────────┐ │
                                │FastAPI API │◀──────▶│React Frontend │◀┘
                                └────────────┘        └───────────────┘
```

## Repository Layout
```
backend/
  main.py                  # Launch simulator + processor + FastAPI
  requirements.txt
  src/
    api/main.py            # REST + WebSocket surface
    data_simulator/        # Kafka producer (300 static sensors)
    stream_processor/      # Kafka consumer + ML anomaly detection
    ml_models/optimizer.py # Predictive + cost optimization logic
    kafka/                 # Low-level producer/consumer helpers
    utils/                 # Shared configuration helpers
frontend/
  src/App.jsx              # Tabbed UI shell
  src/context/EnergyContext.jsx
  src/components/…         # Dashboard, charts, optimization cards
deployment/
  docker-compose-consumer.yml
  docker-compose-producer.yml
  consumer.env
  start-consumer.(bat|sh)
setup-project.sh, fix-errors.sh   # Bootstrap helpers
```

## Technology Stack
- **Data pipeline** – Kafka (kafka-python), Redis
- **Backend** – FastAPI, Uvicorn, scikit-learn, pandas, numpy
- **Frontend** – React 18, Vite, Chart.js/Recharts, Axios, WebSockets
- **Containerization** – Docker Compose for multi-service orchestration

## Getting Started (Manual Dev Setup)
1. **Prerequisites**
   - Python 3.11+ with `pip`
   - Node 18+ / npm 9+
   - Kafka cluster reachable at `KAFKA_BROKER`
   - Redis 7+ (or use `docker run redis:alpine`)

2. **Backend**
   ```bash
   cd backend
   python -m venv .venv && .\.venv\Scripts\activate  # Windows
   pip install -r requirements.txt
   set KAFKA_BROKER=192.168.x.x:9092
   set REDIS_HOST=localhost
   python main.py
   ```
   `main.py` spawns the simulator, stream processor, and FastAPI (`http://localhost:8000`).

3. **Frontend**
   ```bash
   cd frontend
   npm install
   set VITE_API_URL=http://localhost:8000
   npm run dev -- --host 0.0.0.0 --port 3000
   ```
   Visit `http://localhost:3000`.

## Dockerized Consumer Deployment
Use this path when Kafka runs on a different machine and you only need the consumer/dashboard stack.

```bash
cd deployment
cp consumer.env.example consumer.env  # if needed
# set PRODUCER_IP=<Kafka host> and HOST_IP=<this machine>
./start-consumer.sh                   # or start-consumer.bat on Windows
# or directly:
docker compose -f docker-compose-consumer.yml up --build
```
Services started: `redis`, `stream-processor`, `ml-optimizer`, `backend-api`, `frontend`. The dashboard lives at `http://HOST_IP:3000`, FastAPI docs at `http://HOST_IP:8000/docs`.

## Environment Variables
| Name | Default | Where Used | Notes |
| --- | --- | --- | --- |
| `KAFKA_BROKER` | `kafka:9092` | Simulator, processor, API | Use `PRODUCER_IP:9092` when consuming remotely |
| `HOST_IP` | auto-detected | Simulator, API, docker envs | Advertises current host for clients |
| `REDIS_HOST` | `redis` | Stream processor, API | Set to `localhost` for manual runs |
| `TOTAL_SENSORS` | 300 | Sensor simulator | Controls sensor pool size |
| `API_PORT` | 8000 | FastAPI | Override exposed port if needed |
| `VITE_API_URL` | `http://192.168.137.16:8000` | Frontend | Must point to reachable API |

## API Surface (FastAPI)
- `GET /` – service metadata/health.
- `GET /health` – Redis connectivity check.
- `GET /api/sensors` / `/api/sensors/{id}` – latest sensor payloads from Redis.
- `GET /api/dashboard/stats` – aggregate metrics (total energy, anomalies, status bins).
- `GET /api/energy-data/realtime` – combined sensors + stats + producer status payload.
- `GET /api/producer/status` – last heartbeat from simulator.
- `WS /ws` – pushes initial snapshot, periodic updates, critical alert bursts, and producer disconnect notifications every 3 seconds.

## Analytics & Optimization
- **Anomaly detection** – Isolation Forest trained on synthetic baselines with dynamic scoring and `failure_probability` heuristics.
- **Optimizer** – `EnergyOptimizer` computes peak-shifting, maintenance, efficiency, and operational suggestions with priority scores, factoring in consumption quantiles, risk thresholds, and contextual day/hour info.
- **Frontend rendering** – `EnergyContext` stores stats, derives counts/costs/efficiency, and powers widgets in `Dashboard`, `SensorGrid`, `Analytics`, `Optimization`.

## Troubleshooting & Tips
- If the frontend shows “Disconnected”, inspect WebSocket logs (browser console) and FastAPI logs for producer status.
- Use `docker-compose -f deployment/docker-compose-consumer.yml logs -f backend-api` to debug REST/Redis.
- Ensure Kafka listener is reachable from the consumer host (`telnet PRODUCER_IP 9092`) when running cross-network.
- Redis entries expire after 10 minutes (`setex` TTL); without continuous stream the dashboard will empty out.

## Next Steps
- Integrate the optimizer output with `/api/optimization/suggestions`.
- Add historical storage (InfluxDB/Timescale) for the `/api/analytics/history` endpoint consumed by the frontend.
- Write tests around `StreamProcessor._calculate_failure_probability` and add load metrics for >1k sensors.
