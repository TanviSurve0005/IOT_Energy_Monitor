# Consumer Setup Instructions

This guide explains how to set up the consumer side of the IoT energy monitoring system to connect to a remote Kafka producer.

## Prerequisites

1. Docker and Docker Compose installed
2. Network connectivity to the producer machine (IP: 192.168.137.195)
3. Producer machine running Kafka and sensor simulator

## Quick Start

### Option 1: Using the Startup Scripts (Recommended)

#### For Windows:
```bash
# Navigate to the deployment directory
cd d:\Piyu\projects\IOT\deployment

# Run the Windows startup script
start-consumer.bat
```

#### For Linux/Mac:
```bash
# Navigate to the deployment directory
cd /path/to/IOT/deployment

# Make the script executable
chmod +x start-consumer.sh

# Run the startup script
./start-consumer.sh
```

### Option 2: Manual Setup

1. **Set Environment Variables:**
   ```bash
   # Set the producer IP (where Kafka is running)
   export PRODUCER_IP=192.168.137.195
   
   # Set the consumer IP (this machine's IP)
   export HOST_IP=$(hostname -I | awk '{print $1}')
   ```

2. **Update the consumer.env file:**
   ```bash
   # Edit consumer.env and set the correct IPs
   PRODUCER_IP=192.168.137.195
   HOST_IP=192.168.137.196  # Replace with your actual IP
   ```

3. **Start the services:**
   ```bash
   docker-compose -f docker-compose-consumer.yml up --build
   ```

## Configuration Details

### Environment Variables

- `PRODUCER_IP`: IP address of the machine running Kafka (producer side)
- `HOST_IP`: IP address of this machine (consumer side)

### Services

The consumer setup includes:

1. **Redis**: Data storage and caching
2. **Stream Processor**: Consumes data from Kafka and processes it
3. **ML Optimizer**: Runs machine learning optimization algorithms
4. **Backend API**: REST API for the frontend
5. **Frontend**: Web interface for monitoring

### Network Configuration

- The consumer connects to Kafka on the producer machine at `PRODUCER_IP:9092`
- The frontend is accessible at `http://HOST_IP:3000`
- The API is accessible at `http://HOST_IP:8000`

## Troubleshooting

### Connection Issues

If you see connection errors like "ECONNREFUSED":

1. **Verify Producer IP**: Make sure the `PRODUCER_IP` is correct and the producer machine is running
2. **Check Network Connectivity**: Test if you can reach the producer machine:
   ```bash
   ping 192.168.137.195
   telnet 192.168.137.195 9092
   ```
3. **Check Producer Status**: Ensure the producer's Kafka is running and accessible

### Environment Variable Issues

If environment variables are not being read:

1. **Check consumer.env file**: Ensure it exists and has the correct values
2. **Verify docker-compose**: Make sure the `env_file` directive is present in docker-compose-consumer.yml
3. **Restart services**: Stop and restart the containers after making changes

### Logs

To view logs for specific services:

```bash
# View all logs
docker-compose -f docker-compose-consumer.yml logs

# View specific service logs
docker-compose -f docker-compose-consumer.yml logs stream-processor
docker-compose -f docker-compose-consumer.yml logs backend-api
```

## File Structure

```
deployment/
├── docker-compose-consumer.yml    # Consumer services configuration
├── consumer.env                   # Environment variables
├── start-consumer.bat            # Windows startup script
├── start-consumer.sh             # Linux/Mac startup script
└── README-CONSUMER.md            # This file
```

## Next Steps

1. Run the startup script or manually set up the environment
2. Monitor the logs to ensure successful connection to the producer
3. Access the frontend at `http://HOST_IP:3000` to view the dashboard
4. Check the API at `http://HOST_IP:8000/docs` for API documentation
