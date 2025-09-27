#!/bin/bash
# Consumer Startup Script for Linux/Mac
# This script sets the environment variables and starts the consumer services

echo "Setting up Consumer Environment..."

# Set Producer IP (where Kafka is running)
export PRODUCER_IP=192.168.137.195

# Get Consumer IP (this machine's IP)
export HOST_IP=$(hostname -I | awk '{print $1}')

echo "Producer IP: $PRODUCER_IP"
echo "Consumer IP: $HOST_IP"

# Update the consumer.env file with the detected IP
cat > consumer.env << EOF
# Consumer Environment Configuration
# Set these values before running docker-compose

# Producer IP (where Kafka is running)
PRODUCER_IP=$PRODUCER_IP

# Consumer IP (this machine's IP)
HOST_IP=$HOST_IP
EOF

echo "Starting Consumer Services..."
docker-compose -f docker-compose-consumer.yml up --build