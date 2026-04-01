"""
Research-aligned sensor bands (VoltAI / industrial monitoring).

All classifiers use the same pattern:
  if value < low_bound → LOW
  elif value < medium_upper → MEDIUM
  elif value < high_upper → HIGH
  else → CRITICAL

Baselines (rated / nominal / operating / energy baseline) are supplied per sensor;
percentage-based metrics compare the live reading to those baselines.
"""

from __future__ import annotations

from typing import Any, Dict, Tuple

# --- Published constants (documentation + UI / API) ---

TEMP_C = {"low_max": 20.0, "medium_max": 60.0, "high_max": 80.0}
# Current as % of rated load
CURRENT_PCT = {"low_max": 40.0, "medium_max": 70.0, "high_max": 90.0}
# Voltage as ratio vs nominal (IEC-style window + danger at extremes)
VOLTAGE_RATIO = {"critical_low": 0.85, "low_max": 0.90, "medium_max": 1.10, "high_max": 1.20}
# Vibration mm/s (ISO 10816 style bands)
VIBRATION_MMS = {"low_max": 1.8, "medium_max": 4.5, "high_max": 7.1}
# Energy vs baseline (%)
ENERGY_PCT = {"low_max": 70.0, "medium_max": 110.0, "high_max": 130.0}
# Pressure vs operating pressure (%)
PRESSURE_PCT = {"low_max": 60.0, "medium_max": 100.0, "high_max": 120.0}


def classify_temperature_c(temperature_c: float) -> str:
    t = float(temperature_c)
    if t < TEMP_C["low_max"]:
        return "LOW"
    if t < TEMP_C["medium_max"]:
        return "MEDIUM"
    if t < TEMP_C["high_max"]:
        return "HIGH"
    return "CRITICAL"


def classify_current_pct_of_rated(current_a: float, rated_current_a: float) -> str:
    if rated_current_a <= 0:
        return "MEDIUM"
    pct = float(current_a) / float(rated_current_a) * 100.0
    if pct < CURRENT_PCT["low_max"]:
        return "LOW"
    if pct < CURRENT_PCT["medium_max"]:
        return "MEDIUM"
    if pct < CURRENT_PCT["high_max"]:
        return "HIGH"
    return "CRITICAL"


def classify_voltage_v(voltage_v: float, nominal_voltage_v: float) -> str:
    if nominal_voltage_v <= 0:
        return "MEDIUM"
    r = float(voltage_v) / float(nominal_voltage_v)
    if r < VOLTAGE_RATIO["critical_low"] or r > VOLTAGE_RATIO["high_max"]:
        return "CRITICAL"
    if r < VOLTAGE_RATIO["low_max"]:
        return "LOW"
    if r <= VOLTAGE_RATIO["medium_max"]:
        return "MEDIUM"
    if r <= VOLTAGE_RATIO["high_max"]:
        return "HIGH"
    return "CRITICAL"


def classify_vibration_mm_s(vibration_mm_s: float) -> str:
    v = float(vibration_mm_s)
    if v < VIBRATION_MMS["low_max"]:
        return "LOW"
    if v < VIBRATION_MMS["medium_max"]:
        return "MEDIUM"
    if v < VIBRATION_MMS["high_max"]:
        return "HIGH"
    return "CRITICAL"


def classify_energy_pct_of_baseline(energy_kwh: float, energy_baseline_kwh: float) -> str:
    if energy_baseline_kwh <= 0:
        return "MEDIUM"
    pct = float(energy_kwh) / float(energy_baseline_kwh) * 100.0
    if pct < ENERGY_PCT["low_max"]:
        return "LOW"
    if pct < ENERGY_PCT["medium_max"]:
        return "MEDIUM"
    if pct < ENERGY_PCT["high_max"]:
        return "HIGH"
    return "CRITICAL"


def classify_pressure_pct_of_operating(pressure_bar: float, operating_pressure_bar: float) -> str:
    if operating_pressure_bar <= 0:
        return "MEDIUM"
    pct = float(pressure_bar) / float(operating_pressure_bar) * 100.0
    if pct < PRESSURE_PCT["low_max"]:
        return "LOW"
    if pct < PRESSURE_PCT["medium_max"]:
        return "MEDIUM"
    if pct < PRESSURE_PCT["high_max"]:
        return "HIGH"
    return "CRITICAL"


def _metric_alert_severity(metric_key: str, band: str) -> int:
    """
    Map a band label to dashboard severity for that metric only.

    0 = does not contribute to alerts (healthy / idle / excellent as per spec).
    1 = warning.
    2 = critical.

    Important: temperature LOW (<20°C) is idle/underutilized — not an alert.
    Current LOW (<40% rated) and energy LOW (<70% baseline) are likewise non-fault.
    Vibration LOW/MEDIUM are acceptable per ISO-style bands.
    """
    if band == "MEDIUM":
        return 0

    if band == "CRITICAL":
        return 2

    if band == "HIGH":
        return 1

    if band == "LOW":
        if metric_key == "temperature_c":
            return 0  # idle / underutilized, not overheating
        if metric_key == "current_pct_rated":
            return 0  # light load, not overload
        if metric_key == "energy_vs_baseline":
            return 0  # below baseline / underuse
        if metric_key in ("vibration_mm_s",):
            return 0  # excellent / acceptable
        if metric_key == "voltage":
            return 1  # 85–90% nominal: mild undervoltage, worth warning
        if metric_key == "pressure_pct_operating":
            return 1  # <60% operating: possible underpressure

    return 0


def _aggregate_operational_status(bands: Dict[str, str]) -> str:
    """Combine per-metric severities; LOW temp/current/energy do not force critical."""
    worst = 0
    for key, band in bands.items():
        worst = max(worst, _metric_alert_severity(key, band))
    if worst >= 2:
        return "critical"
    if worst >= 1:
        return "warning"
    return "normal"


def _defaults_from_reading(data: Dict[str, Any]) -> Tuple[float, float, float, float]:
    """Infer baselines if absent (keeps pipeline resilient)."""
    cur = float(data.get("current") or 0)
    pr = float(data.get("pressure") or 0)
    ec = float(data.get("energy_consumption") or 0)
    rated = float(data.get("rated_current") or max(cur * 1.25, 1.0))
    nominal = float(data.get("nominal_voltage") or 220.0)
    operating = float(data.get("operating_pressure") or max(pr * 1.2, 1.0))
    baseline = float(data.get("energy_baseline_kwh") or max(ec * 0.95, 1e-6))
    return rated, nominal, operating, baseline


def build_threshold_bands(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Compute per-metric bands from a reading dict.
    Expects: current, temperature, pressure, voltage, vibration, energy_consumption
    and optional: rated_current, nominal_voltage, operating_pressure, energy_baseline_kwh
    """
    rated, nominal, operating, baseline = _defaults_from_reading(data)

    cur = float(data.get("current") or 0)
    temp = float(data.get("temperature") or 0)
    pr = float(data.get("pressure") or 0)
    volt = float(data.get("voltage") or nominal)
    vib = float(data.get("vibration") or 0)
    ec = float(data.get("energy_consumption") or 0)

    bands = {
        "temperature_c": classify_temperature_c(temp),
        "current_pct_rated": classify_current_pct_of_rated(cur, rated),
        "voltage": classify_voltage_v(volt, nominal),
        "vibration_mm_s": classify_vibration_mm_s(vib),
        "energy_vs_baseline": classify_energy_pct_of_baseline(ec, baseline),
        "pressure_pct_operating": classify_pressure_pct_of_operating(pr, operating),
    }

    ratios = {
        "current_load_pct": round(cur / rated * 100.0, 2) if rated > 0 else None,
        "voltage_ratio_nominal": round(volt / nominal, 4) if nominal > 0 else None,
        "energy_ratio_pct": round(ec / baseline * 100.0, 2) if baseline > 0 else None,
        "pressure_ratio_pct": round(pr / operating * 100.0, 2) if operating > 0 else None,
    }

    return {"bands": bands, "ratios": ratios, "baselines_used": {
        "rated_current_a": rated,
        "nominal_voltage_v": nominal,
        "operating_pressure_bar": operating,
        "energy_baseline_kwh": baseline,
    }}


def apply_threshold_classification(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Mutates and returns `data` with threshold_bands, threshold_ratios, threshold_baselines,
    operational status (normal / warning / critical), and is_anomaly aligned with HIGH+.
    """
    out = build_threshold_bands(data)
    bands = out["bands"]
    status = _aggregate_operational_status(bands)

    data["threshold_bands"] = bands
    data["threshold_ratios"] = out["ratios"]
    data["threshold_baselines"] = out["baselines_used"]
    data["status"] = status
    data["is_anomaly"] = status in ("warning", "critical")
    return data


def thresholds_spec() -> Dict[str, Any]:
    """Static spec for API/docs."""
    return {
        "temperature_c": {
            "unit": "°C",
            "bands": "LOW < 20 | MEDIUM 20–60 | HIGH 60–80 | CRITICAL > 80",
            "edges": TEMP_C,
        },
        "current": {
            "unit": "% of rated current",
            "bands": "LOW < 40% | MEDIUM 40–70% | HIGH 70–90% | CRITICAL > 90%",
            "edges": CURRENT_PCT,
        },
        "voltage": {
            "unit": "ratio vs nominal",
            "bands": "CRITICAL < 85% or > 120% | LOW < 90% | MEDIUM 90–110% | HIGH 110–120%",
            "edges": VOLTAGE_RATIO,
        },
        "vibration": {
            "unit": "mm/s",
            "bands": "LOW < 1.8 | MEDIUM 1.8–4.5 | HIGH 4.5–7.1 | CRITICAL > 7.1",
            "edges": VIBRATION_MMS,
        },
        "energy": {
            "unit": "% of baseline kWh",
            "bands": "LOW < 70% | MEDIUM 70–110% | HIGH 110–130% | CRITICAL > 130%",
            "edges": ENERGY_PCT,
        },
        "pressure": {
            "unit": "% of operating pressure",
            "bands": "LOW < 60% | MEDIUM 60–100% | HIGH 100–120% | CRITICAL > 120%",
            "edges": PRESSURE_PCT,
        },
    }
