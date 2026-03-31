# 🚀 Quick Start - Test the Kafka Fix

## Step-by-Step Guide

### Prerequisites ✅
Make sure you have:
- [ ] Producer running on producer laptop (Kafka + Sensor Simulator)
- [ ] Docker installed on consumer laptop
- [ ] Python installed on consumer laptop
- [ ] Network connectivity between laptops

### Step 1: Set Producer IP

Open PowerShell and set your producer's IP address:

```powershell
cd D:\Piyu\dev_projects\IOT\backend

# Replace with your actual producer laptop IP
$env:PRODUCER_IP = "192.168.137.195"
```

### Step 2: Test Network Connection

```powershell
# Test if you can reach the producer's Kafka port
Test-NetConnection -ComputerName $env:PRODUCER_IP -Port 9092
```

**Expected:** `TcpTestSucceeded : True`

**If Failed:** Check firewall settings and ensure Kafka is running on producer.

### Step 3: Run Kafka Consumer Test

```powershell
# Run the comprehensive test
.\test-kafka-consumer.ps1
```

**Expected Output:**
```
✅ Network connection successful
✅ Successfully connected to Kafka Admin API
✅ Topic 'sensor-data' exists
✅ Received X messages!
✅ ALL TESTS PASSED!
```

### Step 4: Start Full Consumer Stack (Optional)

If the test passes, start the full consumer deployment:

```powershell
cd ..\deployment

# Update consumer.env if needed
notepad consumer.env
# Ensure PRODUCER_IP and HOST_IP are correct

# Start all consumer services
docker-compose -f docker-compose-consumer.yml up --build
```

### Step 5: Monitor Logs

In a new PowerShell window:

```powershell
cd deployment
docker-compose -f docker-compose-consumer.yml logs -f stream-processor
```

**Look for:**
- ✅ "Successfully connected to Kafka consumer at..."
- ✅ "Processing message X from sensor sensor_XXX"
- ✅ "Stored data for sensor_XXX in Redis"

### Step 6: Verify Data in Redis

```bash
# Connect to Redis
docker exec -it deployment_redis_1 redis-cli

# Check sensor data
KEYS sensor:*
GET sensor:sensor_001

# Should show enriched data with anomaly scores
```

### Step 7: Open Dashboard

Open browser and navigate to: `http://localhost:3000`

You should see:
- ✅ Real-time sensor data
- ✅ Live charts updating
- ✅ Anomaly detection working
- ✅ Statistics being calculated

---

## Troubleshooting

### ❌ Test Fails - "Cannot connect to Kafka"

**Solution:**
1. Verify producer IP is correct
2. Ensure Kafka is running: `docker ps | grep kafka` on producer
3. Check firewall allows port 9092
4. Test from another machine if possible

### ❌ Test Passes but No Messages

**Solution:**
1. Ensure sensor simulator is running on producer
2. Check producer logs: `docker logs <producer-container>`
3. Verify topic has data: Use Kafka tools to list messages

### ❌ Consumer Disconnects Frequently

**Solution:**
1. Check network stability
2. Increase timeout values in processor.py
3. Verify Kafka broker configuration
4. Check for resource constraints

---

## Success Indicators ✨

You know it's working when:

1. ✅ Test script shows "ALL TESTS PASSED"
2. ✅ Logs show "Processing message..." every few seconds
3. ✅ Redis contains sensor data with anomaly scores
4. ✅ Dashboard displays real-time updates
5. ✅ Anomalies are detected and highlighted

---

## Need Help?

- **Detailed Fix Documentation**: See `ISSUE-2-FIXED.md`
- **Full Architecture**: See `PROJECT-EXPLANATION.md`
- **Original Issue**: See project issue tracker

---

**Last Updated**: 2026-03-30  
**Status**: ✅ Ready to Test
