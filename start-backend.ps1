# Complete Backend Startup Script
# This script starts all backend components in the correct order

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "STARTING BACKEND - IOT Energy Monitor" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# Set environment variables
$env:REDIS_HOST = "localhost"
$env:KAFKA_BROKER = "localhost:9092"
$env:PRODUCER_IP = "localhost"
$env:HOST_IP = "localhost"

Write-Host "`n[Step 1/4] Checking Docker services..." -ForegroundColor Yellow

# Check if Kafka is running
$kafkaStatus = docker ps --filter "name=kafka" --format "{{.Status}}"
if ($kafkaStatus -like "*Up*") {
    Write-Host "  ✅ Kafka is running" -ForegroundColor Green
} else {
    Write-Host "  ❌ Kafka is not running. Please start it first." -ForegroundColor Red
    Write-Host "     Run: docker-compose -f deployment/docker-compose-producer.yml up -d" -ForegroundColor Yellow
    exit 1
}

# Check if Redis is running
$redisStatus = docker ps --filter "name=redis" --format "{{.Status}}"
if ($redisStatus -like "*Up*") {
    Write-Host "  ✅ Redis is running" -ForegroundColor Green
} else {
    Write-Host "  ❌ Redis is not running. Please start it first." -ForegroundColor Red
    Write-Host "     Run: docker-compose -f deployment/docker-compose-consumer.yml up -d redis" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n[Step 2/4] Testing Kafka connection..." -ForegroundColor Yellow
try {
    $testResult = python test-kafka-consumer.py
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Kafka connection test passed" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Kafka test had issues but continuing..." -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ⚠️  Kafka test failed: $_" -ForegroundColor Yellow
}

Write-Host "`n[Step 3/4] Starting API Server..." -ForegroundColor Yellow
$apiJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    $env:REDIS_HOST = "localhost"
    $env:KAFKA_BROKER = "localhost:9092"
    python -m src.api.main
}
Write-Host "  ⏳ API server starting on http://localhost:8000" -ForegroundColor Yellow

# Wait for API to start
Start-Sleep -Seconds 3

Write-Host "`n[Step 4/4] Starting Stream Processor..." -ForegroundColor Yellow
$streamJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    $env:REDIS_HOST = "localhost"
    $env:KAFKA_BROKER = "localhost:9092"
    python -c "from src.stream_processor.processor import StreamProcessor; processor = StreamProcessor(); processor.process_stream()"
}
Write-Host "  ⏳ Stream processor starting..." -ForegroundColor Yellow

# Wait for stream processor to connect
Start-Sleep -Seconds 5

Write-Host "`n[Verification] Checking services..." -ForegroundColor Yellow

# Check API health
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -TimeoutSec 5 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "  ✅ API Server is healthy" -ForegroundColor Green
    }
} catch {
    Write-Host "  ⚠️  API health check failed: $_" -ForegroundColor Yellow
}

# Check Redis data
$redisKeys = docker exec redis redis-cli KEYS "sensor:*" | Measure-Object -Line
Write-Host "  📊 Redis sensor keys: $redisKeys" -ForegroundColor Yellow

Write-Host "`n======================================================================" -ForegroundColor Cyan
Write-Host "✅ BACKEND STARTED SUCCESSFULLY" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "`nServices running:" -ForegroundColor White
Write-Host "  • API Server: http://localhost:8000" -ForegroundColor Cyan
Write-Host "  • Health Check: http://localhost:8000/health" -ForegroundColor Cyan
Write-Host "  • WebSocket: ws://localhost:8000/ws" -ForegroundColor Cyan
Write-Host "  • Stream Processor: Running (consuming from Kafka)" -ForegroundColor Cyan
Write-Host "  • Kafka Broker: localhost:9092" -ForegroundColor Cyan
Write-Host "  • Redis: localhost:6379" -ForegroundColor Cyan

Write-Host "`nTo view logs:" -ForegroundColor White
Write-Host "  API Server:     Get-Job | Receive-Job" -ForegroundColor Gray
Write-Host "  Stream Processor: Get-Job | Receive-Job" -ForegroundColor Gray

Write-Host "`nTo stop services:" -ForegroundColor White
Write-Host "  Get-Job | Stop-Job" -ForegroundColor Gray
Write-Host "  Get-Job | Remove-Job" -ForegroundColor Gray

Write-Host "`nPress Ctrl+C to exit and stop monitoring..." -ForegroundColor Yellow

# Keep monitoring
try {
    while ($true) {
        Start-Sleep -Seconds 10
        
        # Check jobs
        $jobs = Get-Job
        foreach ($job in $jobs) {
            if ($job.State -eq "Failed") {
                Write-Host "`n⚠️  Job '$($job.Name)' failed!" -ForegroundColor Red
                Receive-Job $job
            }
        }
        
        # Quick health check
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -TimeoutSec 2 -UseBasicParsing
            if ($response.StatusCode -ne 200) {
                Write-Host "`n⚠️  API health check failed (Status: $($response.StatusCode))" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "`n⚠️  API health check error: $_" -ForegroundColor Yellow
        }
    }
} catch [System.ConsoleCancelEventArgs] {
    Write-Host "`n`nStopping services..." -ForegroundColor Yellow
    Get-Job | Stop-Job
    Get-Job | Remove-Job
    Write-Host "All services stopped." -ForegroundColor Yellow
}
