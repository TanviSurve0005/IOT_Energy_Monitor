#!/bin/bash

# IoT Energy Monitor - Complete Setup Script
echo "🚀 Starting IoT Energy Monitor Setup..."
echo "=========================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "📖 Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! command -v docker compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install it first."
    exit 1
fi

# Create project directory
mkdir -p iot-energy-monitor
cd iot-energy-monitor

echo "📁 Creating project structure..."
mkdir -p backend/src/{data_simulator,stream_processor,ml_models,api,utils}
mkdir -p frontend/src/{components,context,styles}
mkdir -p deployment
mkdir -p .vscode

echo "✅ Project structure created!"

# Run the fix-errors script after setup
echo "🔧 Setting up error fixes..."
chmod +x ../fix-errors.sh
../fix-errors.sh

echo ""
echo "🎉 Setup complete!"
echo "=================="
echo ""
echo "🚀 To start the application:"
echo "   docker-compose -f deployment/docker-compose.yml up --build"
echo ""
echo "🌐 Access points:"
echo "   • Dashboard: http://localhost:3000"
echo "   • API Docs: http://localhost:8000/api/docs"
echo ""
echo "💡 The VS Code import errors are now fixed!"