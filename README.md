# 17_mission_ctrl


Here’s a concise **README-style file** summarizing the formulas and calculations for your IoT energy monitoring system:

---

# IoT Energy Monitoring System – Metrics & Calculations

This document summarizes the key metrics computed in the system, along with the formulas used.

---

## **1. Total Energy Consumption**

**Definition:** Total energy consumed by all sensors.
**Formula:**

```
Energy (kWh) = Current (A) × Voltage (V) / 1000
Total Energy = Σ energy_consumption of all sensors
```

---

## **2. Current Hour Change**

**Definition:** % change in energy consumption compared to the previous hour.
**Formula:**

```
Current Hour Change (%) = (CurrentHourEnergy - PreviousHourEnergy) / PreviousHourEnergy × 100
```

---

## **3. Critical Alerts**

**Definition:** Number of sensors in a critical state.
**Logic:**

```
critical_alerts = count of sensors where status == 'critical'
```

---

## **4. Active Sensors**

**Definition:** Number of online sensors actively sending data.
**Logic:**

```
active_sensors = count of initialized sensors
```

---

## **5. System Efficiency**

**Definition:** Overall performance of the system.
**Formula (example):**

```
System Efficiency (%) = (Number of Normal Sensors / Total Sensors) × 100
```

---

## **6. Average Temperature**

**Definition:** Mean temperature across all devices.
**Formula:**

```
Average Temperature (°C) = Σ sensor_temperature / total_sensors
```

---

## **7. Hourly Cost**

**Definition:** Estimated cost of energy consumption per hour.
**Formula:**

```
Hourly Cost ($) = Σ sensor_energy_consumption × rate_per_kWh
rate_per_kWh depends on time:
- Off-Peak: $0.08/kWh
- Shoulder: $0.12/kWh
- On-Peak: $0.18/kWh
```

---

### Notes:

* Energy readings come from the `energy_consumption` field in the sensor data.
* Critical alerts and system efficiency use thresholds defined in the monitoring logic (`status` and `failure_probability`).
* Hourly cost is calculated using time-based electricity rates.