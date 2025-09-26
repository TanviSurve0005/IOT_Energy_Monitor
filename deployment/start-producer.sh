#!/bin/bash

# Get local IP address
HOST_IP=$(hostname -I | awk '{print $1}')
echo "Starting Producer on IP: $HOST_IP"

# Export environment variables
export HOST_IP=$HOST_IP

# Start Kafka and sensor simulator
docker-compose -f docker-compose-producer.yml up -d

echo "Producer started successfully!"
echo "Kafka is running on: $HOST_IP:9092"
echo "Share this IP with the consumer laptop"