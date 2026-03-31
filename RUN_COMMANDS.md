# IoT Energy Monitor - Run Commands

This guide uses **one PC** with **multiple terminals**.

## Prerequisites

- Docker Desktop running
- Python installed
- Node.js + npm installed

---

## Terminal 1 - Start Kafka and Zookeeper (Docker)

```bash
cd d:/IOT-Energy-monitor/deployment
export HOST_IP=127.0.0.1
docker compose -f docker-compose-producer.yml down
docker compose -f docker-compose-producer.yml up -d zookeeper kafka
```

Verify Kafka port is open:

```bash
docker ps | findstr 9092
```

---

## Terminal 2 - Start Redis (Docker)

If Redis is not already running:

```bash
docker run -d --name iot-redis -p 6379:6379 redis:alpine
```

If already created but stopped:

```bash
docker start iot-redis
```

---

## Terminal 3 - Start Producer (Host Python)

```bash
cd d:/IOT-Energy-monitor/backend
export KAFKA_BROKER=127.0.0.1:9092
python run_producer.py
```

---

## Terminal 4 - Start Consumer (Host Python)

```bash
cd d:/IOT-Energy-monitor/backend
export KAFKA_BROKER=127.0.0.1:9092
export REDIS_HOST=127.0.0.1
python run_consumer.py
```

---

## Terminal 5 - Start Backend API (Host Python)

```bash
cd d:/IOT-Energy-monitor/backend
export REDIS_HOST=127.0.0.1
python run_api.py
```

Check health:

```bash
# Browser:
# http://localhost:8000/health
# http://localhost:8000/api/docs
```

---

## Terminal 6 - Start Frontend

```bash
cd d:/IOT-Energy-monitor/frontend
npm install
npm run dev
```

Open in browser:

```text
http://localhost:3000
```

---

## Stop Commands

### Stop Kafka/Zookeeper compose stack

```bash
cd d:/IOT-Energy-monitor/deployment
docker compose -f docker-compose-producer.yml down
```

### Stop Redis container

```bash
docker stop iot-redis
```

### Remove Redis container (optional)

```bash
docker rm iot-redis
```

---

## Quick Troubleshooting

### Docker engine not running

```bash
docker version
```

If Server section is missing, start/restart Docker Desktop.

### Kafka broker not reachable

Check:

```bash
docker ps | findstr 9092
```

### Redis refused connection

Check:

```bash
docker ps | findstr 6379
```

### Frontend shows Disconnected

Confirm API is running and `/ws` is accepted in API terminal logs.
