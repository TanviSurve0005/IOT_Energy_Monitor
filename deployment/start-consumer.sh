#!/bin/bash

# Get producer IP from user or environment
PRODUCER_IP=${1:-$PRODUCER_IP}
if [ -z "$PRODUCER_IP" ]; then
    read -p "Enter Producer Laptop IP address: " PRODUCER_IP
fi

# Get consumer IP
HOST_IP=$(hostname -I | awk '{print $1}')
echo "Starting Consumer on IP: $HOST_IP, connecting to Producer: $PRODUCER_IP"

# Export environment variables
export PRODUCER_IP=$PRODUCER_IP
export HOST_IP=$HOST_IP

# Start consumer services
docker-compose -f docker-compose-consumer.yml up -d

echo "Consumer started successfully!"
echo "Frontend available at: http://$HOST_IP:3000"
echo "API available at: http://$HOST_IP:8000"