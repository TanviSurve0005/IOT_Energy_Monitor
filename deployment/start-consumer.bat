@echo off
REM Consumer Startup Script for Windows
REM This script sets the environment variables and starts the consumer services

echo Setting up Consumer Environment...

REM Set Producer IP (where Kafka is running)
set PRODUCER_IP=192.168.137.195

REM Get Consumer IP (this machine's IP)
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        set HOST_IP=%%b
        goto :found
    )
)
:found

REM Remove any leading spaces
set HOST_IP=%HOST_IP: =%

echo Producer IP: %PRODUCER_IP%
echo Consumer IP: %HOST_IP%

REM Update the consumer.env file with the detected IP
echo # Consumer Environment Configuration > consumer.env
echo # Set these values before running docker-compose >> consumer.env
echo. >> consumer.env
echo # Producer IP (where Kafka is running) >> consumer.env
echo PRODUCER_IP=%PRODUCER_IP% >> consumer.env
echo. >> consumer.env
echo # Consumer IP (this machine's IP) >> consumer.env
echo HOST_IP=%HOST_IP% >> consumer.env

echo Starting Consumer Services...
docker-compose -f docker-compose-consumer.yml up --build

pause
