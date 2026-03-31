# Complete Backend Restart Script
# Restarts all backend components to ensure fresh data

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "RESTARTING BACKEND SERVICES" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

cd D:\Piyu\dev_projects\IOT\backend

# Set environment variables
$env:REDIS_HOST = "localhost"
$env:KAFKA_BROKER = "localhost:9092"

Write-Host "`n[1/3] Starting Working Kafka Consumer..." -ForegroundColor Yellow
Start-Job -Name "KafkaConsumer" -ScriptBlock {
    Set-Location $using:PWD
    $env:REDIS_HOST = "localhost"
    $env:KAFKA_BROKER = "localhost:9092"
    python working-kafka-consumer.py
}

Write-Host "⏳ Waiting for consumer to connect..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "`n[2/3] Starting ML Stream Processor..." -ForegroundColor Yellow
Start-Job -Name "MLProcessor" -ScriptBlock {
    Set-Location $using:PWD
    $env:REDIS_HOST = "localhost"
    python simulate-stream-processor.py
}

Write-Host "⏳ Waiting for ML processor to enrich data..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "`n[3/3] Verifying Data..." -ForegroundColor Yellow

# Check Redis
$redisKeys = docker exec redis redis-cli DBSIZE | Select-String "integer"
if ($redisKeys) {
    Write-Host "  ✅ Redis has $($redisKeys.ToString().Split()[-1]) keys" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Redis check failed" -ForegroundColor Yellow
}

# Check jobs
$jobs = Get-Job
foreach ($job in $jobs) {
    if ($job.State -eq 'Running') {
        Write-Host "  ✅ $($job.Name) is running" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  $($job.Name) state: $($job.State)" -ForegroundColor Yellow
    }
}

Write-Host "`n======================================================================" -ForegroundColor Cyan
Write-Host "✅ BACKEND SERVICES STARTED" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "`nRunning Services:" -ForegroundColor White
Write-Host "  • Kafka Consumer (consuming from Kafka → Redis)" -ForegroundColor Cyan
Write-Host "  • ML Stream Processor (enriching with anomaly scores)" -ForegroundColor Cyan
Write-Host "  • API Server (already on port 8000)" -ForegroundColor Cyan

Write-Host "`nTo view logs:" -ForegroundColor White
Write-Host "  Get-Job -Name KafkaConsumer | Receive-Job" -ForegroundColor Gray
Write-Host "  Get-Job -Name MLProcessor | Receive-Job" -ForegroundColor Gray

Write-Host "`nTo stop services:" -ForegroundColor White
Write-Host "  Get-Job | Stop-Job" -ForegroundColor Gray
Write-Host "  Get-Job | Remove-Job" -ForegroundColor Gray

Write-Host "`nData should be available in ~10 seconds!" -ForegroundColor Yellow
