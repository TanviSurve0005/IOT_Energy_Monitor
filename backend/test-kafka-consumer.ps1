# Test Kafka Consumer - PowerShell Script
# This script tests if the stream processor can connect to Kafka

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "KAFKA CONSUMER CONNECTION TEST" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# Set environment variables
Write-Host "`n[Setup] Configuring environment..." -ForegroundColor Yellow

# Get or set PRODUCER_IP
if ($env:PRODUCER_IP) {
    Write-Host "  PRODUCER_IP: $($env:PRODUCER_IP)" -ForegroundColor Green
} else {
    Write-Host "  PRODUCER_IP not set. Using default (localhost)" -ForegroundColor Yellow
    $env:PRODUCER_IP = "localhost"
}

# Set KAFKA_BROKER
$env:KAFKA_BROKER = "$($env:PRODUCER_IP):9092"
Write-Host "  KAFKA_BROKER: $($env:KAFKA_BROKER)" -ForegroundColor Green

# Test network connectivity first
Write-Host "`n[Test 0] Checking network connectivity..." -ForegroundColor Yellow
try {
    $testConnection = Test-NetConnection -ComputerName $env:PRODUCER_IP -Port 9092 -InformationLevel Quiet
    if ($testConnection) {
        Write-Host "  ✅ Network connection to $($env:PRODUCER_IP):9092 successful" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Cannot connect to $($env:PRODUCER_IP):9092" -ForegroundColor Red
        Write-Host "`nTroubleshooting tips:" -ForegroundColor Yellow
        Write-Host "  1. Ensure producer machine is running" -ForegroundColor White
        Write-Host "  2. Check firewall allows port 9092" -ForegroundColor White
        Write-Host "  3. Verify PRODUCER_IP is correct" -ForegroundColor White
        exit 1
    }
} catch {
    Write-Host "  ⚠️  Network test skipped: $_" -ForegroundColor Yellow
}

# Run Python test script
Write-Host "`n[Test 1] Running Kafka consumer test..." -ForegroundColor Yellow
Set-Location -Path (Split-Path -Parent $MyInvocation.MyCommand.Path)

try {
    & python test-kafka-consumer.py
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n======================================================================" -ForegroundColor Green
        Write-Host "✅ ALL TESTS PASSED!" -ForegroundColor Green
        Write-Host "======================================================================" -ForegroundColor Green
        Write-Host "`nYour stream processor is ready to consume messages from Kafka!" -ForegroundColor Cyan
    } else {
        Write-Host "`n======================================================================" -ForegroundColor Red
        Write-Host "❌ TESTS FAILED" -ForegroundColor Red
        Write-Host "======================================================================" -ForegroundColor Red
        Write-Host "`nPlease check the error messages above and fix the issues." -ForegroundColor Yellow
    }
} catch {
    Write-Host "`n❌ Error running test: $_" -ForegroundColor Red
    Write-Host "`nMake sure Python and kafka-python library are installed:" -ForegroundColor Yellow
    Write-Host "  pip install kafka-python" -ForegroundColor White
}
