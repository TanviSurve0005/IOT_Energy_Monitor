import pandas as pd
from datetime import datetime
import numpy as np
from typing import List, Dict, Any, Tuple

# Rotating copy so the UI does not show fifteen identical “Shift load” cards.
_SHIFT_VARIANTS: List[Tuple[str, str, str]] = [
    ("Stagger draw to off-peak", "Move {device} into night/weekend windows when kWh is cheapest.", "🌙"),
    ("Tariff-aware run blocks", "Schedule {device} in shoulder then off-peak to reduce $/kWh.", "📉"),
    ("Peak-window avoidance", "Shift {device} {hint} outside 9–17 on-peak pricing.", "⚡"),
    ("Load reshaping", "Pre-cool or pre-heat {device} before peak; trim premium hours.", "📊"),
    ("Demand charge relief", "Reduce coincident peak from {device} by time-shifting cycles.", "💡"),
]

_DEVICE_HINTS = {
    "cooling_tower": "condenser cycles",
    "compressor": "compressed-air demand",
    "motor": "motor starts",
    "pump": "pumping bursts",
    "conveyor": "material handling",
    "furnace": "thermal batches",
    "generator": "test/load runs",
    "default": "operating cycles",
}

_EFFICIENCY_VARIANTS: List[Tuple[str, str]] = [
    ("Right-size {device} load", "{device} is drawing well above fleet average — tune setpoints or VFD."),
    ("Baseline drift on {device}", "{device} exceeds typical kWh; audit leaks, belts, or fouling."),
    ("Fleet outlier — {device}", "Trim {device} consumption toward plant mean without hurting output."),
]

_OPS_NIGHT_VARIANTS: List[Tuple[str, str]] = [
    ("Night curtailment — {device}", "Park {device} overnight; load is in bottom fleet quartile."),
    ("Off-hours standby trim", "{device} at {loc}: reduce aux power after last production block."),
    ("Silent hours shutdown", "Consolidate {device} runtime into day shift; save off-peak parasitic load."),
]

_OPS_DAY_VARIANTS: List[Tuple[str, str]] = [
    ("Idle load hunt — {device}", "{device} at {loc}: low relative kWh — verify interlocks and VFD min speed."),
    ("Standby optimization", "Trim {device} keep-alive energy while line changeovers complete."),
]


class EnergyOptimizer:
    def __init__(self):
        self.peak_hours = list(range(9, 18))  # 9 AM to 5 PM
        self.energy_rates = {
            'off_peak': 0.08,  # $/kWh overnight
            'shoulder': 0.12,  # $/kWh morning/evening
            'on_peak': 0.18    # $/kWh business hours
        }
        self.maintenance_threshold = 0.7
        self.efficiency_threshold = 1.3  # 30% above average
    
    def generate_suggestions(self, sensors_data: List[Dict]) -> List[Dict]:
        if not sensors_data:
            return []
        
        df = pd.DataFrame(sensors_data)
        for col, default in (
            ('failure_probability', 0.0),
            ('is_anomaly', False),
            ('energy_consumption', 0.0),
            ('status', 'normal'),
        ):
            if col not in df.columns:
                df[col] = default
        df['energy_consumption'] = pd.to_numeric(df['energy_consumption'], errors='coerce').fillna(0)
        df['failure_probability'] = pd.to_numeric(df['failure_probability'], errors='coerce').fillna(0)

        suggestions = []
        current_hour = datetime.now().hour
        current_time = datetime.now()
        
        # 1. Peak Hour Optimization Suggestions
        peak_suggestions = self._generate_peak_suggestions(df, current_hour)
        suggestions.extend(peak_suggestions)
        
        # 2. Maintenance Suggestions
        maintenance_suggestions = self._generate_maintenance_suggestions(df)
        suggestions.extend(maintenance_suggestions)
        
        # 3. Efficiency Suggestions
        efficiency_suggestions = self._generate_efficiency_suggestions(df)
        suggestions.extend(efficiency_suggestions)
        
        # 4. Operational Suggestions
        operational_suggestions = self._generate_operational_suggestions(df, current_time)
        suggestions.extend(operational_suggestions)
        
        diversified = self._diversify_suggestions(suggestions, limit=15)
        return diversified

    def _variant_index(self, sensor_id: str, row_index: int) -> int:
        sid = str(sensor_id or "")
        return (sum(ord(c) for c in sid) + row_index * 7) % 256

    def _shift_copy(self, device_type: str, sensor_id: str, row_index: int) -> Tuple[str, str, str]:
        dt = str(device_type or "asset")
        hint = _DEVICE_HINTS.get(dt, _DEVICE_HINTS["default"])
        vi = self._variant_index(sensor_id, row_index)
        title, desc_tpl, icon = _SHIFT_VARIANTS[vi % len(_SHIFT_VARIANTS)]
        return title, desc_tpl.format(device=dt, hint=hint), icon

    def _diversify_suggestions(self, suggestions: List[Dict], limit: int = 15) -> List[Dict]:
        """Round-robin by suggestion type so the list mixes maintenance, cost, efficiency, ops."""
        priority_rank = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}

        def sort_key(s: Dict) -> Tuple[int, float]:
            pr = priority_rank.get(s.get('priority', 'low'), 3)
            savings = float(s.get('potential_savings') or 0)
            return (pr, -savings)

        by_type: Dict[str, List[Dict]] = {}
        for s in suggestions:
            t = s.get('type') or 'other'
            by_type.setdefault(t, []).append(s)
        for t in by_type:
            by_type[t].sort(key=sort_key)

        preferred_order = [
            'predictive_maintenance',
            'cost_optimization',
            'energy_efficiency',
            'operational_optimization',
        ]
        out: List[Dict] = []
        ptr = 0
        while len(out) < limit:
            progressed = False
            for _ in range(len(preferred_order)):
                t = preferred_order[ptr % len(preferred_order)]
                ptr += 1
                bucket = by_type.get(t, [])
                if bucket:
                    out.append(bucket.pop(0))
                    progressed = True
                    if len(out) >= limit:
                        break
            if not progressed:
                break
        for t, bucket in by_type.items():
            while bucket and len(out) < limit:
                out.append(bucket.pop(0))
        return out[:limit]

    def _generate_peak_suggestions(self, df: pd.DataFrame, current_hour: int) -> List[Dict]:
        suggestions = []
        if df['energy_consumption'].sum() <= 0:
            return suggestions
        n = len(df)
        k = max(1, int(np.ceil(n * 0.25)))
        high_consumption = df.nlargest(k, 'energy_consumption')
        # Fewer duplicate “shift” cards; top consumers still get unique copy via variant index.
        max_shift_cards = 5
        high_consumption = high_consumption.head(max_shift_cards * 3)

        if current_hour in self.peak_hours:
            added = 0
            for idx, (_, sensor) in enumerate(high_consumption.iterrows()):
                if added >= max_shift_cards:
                    break
                if sensor['failure_probability'] < 0.4:
                    hourly_consumption = float(sensor['energy_consumption'] or 0)
                    potential_savings = hourly_consumption * (
                        self.energy_rates['on_peak'] - self.energy_rates['off_peak']
                    )
                    if potential_savings > 0.05:
                        title, desc, icon = self._shift_copy(sensor['device_type'], sensor['sensor_id'], idx)
                        suggestions.append({
                            'type': 'cost_optimization',
                            'sensor_id': sensor['sensor_id'],
                            'device_type': sensor['device_type'],
                            'location': sensor['location'],
                            'title': title,
                            'description': desc,
                            'current_cost': round(hourly_consumption * self.energy_rates['on_peak'], 2),
                            'potential_savings': round(potential_savings, 2),
                            'savings_per_day': round(potential_savings * 8, 2),
                            'priority': 'high' if potential_savings > 2 else 'medium',
                            'action': 'schedule_shift',
                            'icon': icon
                        })
                        added += 1
        else:
            added = 0
            for idx, (_, sensor) in enumerate(high_consumption.iterrows()):
                if added >= max_shift_cards:
                    break
                if sensor['failure_probability'] < 0.5:
                    hourly_consumption = float(sensor['energy_consumption'] or 0)
                    potential_savings = hourly_consumption * (
                        self.energy_rates['shoulder'] - self.energy_rates['off_peak']
                    )
                    if potential_savings > 0.05:
                        title, desc, icon = self._shift_copy(sensor['device_type'], sensor['sensor_id'], idx + 3)
                        suggestions.append({
                            'type': 'cost_optimization',
                            'sensor_id': sensor['sensor_id'],
                            'device_type': sensor['device_type'],
                            'location': sensor['location'],
                            'title': title,
                            'description': desc,
                            'current_cost': round(hourly_consumption * self.energy_rates['shoulder'], 2),
                            'potential_savings': round(potential_savings, 2),
                            'savings_per_day': round(potential_savings * 6, 2),
                            'priority': 'medium',
                            'action': 'schedule_shift',
                            'icon': icon
                        })
                        added += 1

        return suggestions
    
    def _generate_maintenance_suggestions(self, df: pd.DataFrame) -> List[Dict]:
        suggestions = []
        high_risk = df[df['failure_probability'] > self.maintenance_threshold]
        
        _maint_titles = (
            ("Condition-based service — {d}", "Elevated failure risk on {d}; align inspection with next outage window."),
            ("Predictive work order", "{d} trending toward fault; vibration/thermal check recommended."),
            ("Risk-ranked maintenance", "{d} exceeds reliability threshold — prioritize this week."),
        )
        for idx, (_, sensor) in enumerate(high_risk.iterrows()):
            risk_factor = sensor['failure_probability']
            hourly_energy = float(sensor.get('energy_consumption', 0) or 0)
            potential_savings = round(max(0.5, risk_factor * hourly_energy * self.energy_rates['on_peak']), 2)
            dt = str(sensor['device_type'])
            title_tpl, desc_tpl = _maint_titles[idx % len(_maint_titles)]
            suggestions.append({
                'type': 'predictive_maintenance',
                'sensor_id': sensor['sensor_id'],
                'device_type': sensor['device_type'],
                'location': sensor['location'],
                'title': title_tpl.format(d=dt),
                'description': desc_tpl.format(d=dt),
                'risk_score': round(risk_factor, 3),
                'potential_savings': potential_savings,
                'urgency': 'critical' if risk_factor > 0.85 else 'high',
                'factors': self._identify_risk_factors(sensor),
                'priority': 'critical',
                'action': 'schedule_maintenance',
                'icon': '🛠️'
            })
        
        return suggestions
    
    def _generate_efficiency_suggestions(self, df: pd.DataFrame) -> List[Dict]:
        suggestions = []
        avg_consumption = float(df['energy_consumption'].mean() or 0)
        if avg_consumption <= 0:
            return suggestions
        inefficient = df[df['energy_consumption'] > avg_consumption * self.efficiency_threshold]
        inefficient = inefficient.nlargest(8, 'energy_consumption')

        for idx, (_, sensor) in enumerate(inefficient.iterrows()):
            efficiency_ratio = sensor['energy_consumption'] / avg_consumption
            excess_kwh = max(0, float(sensor['energy_consumption']) - float(avg_consumption))
            potential_savings = round(max(0.5, excess_kwh * self.energy_rates['shoulder']), 2)
            dt = str(sensor['device_type'])
            title_tpl, desc_tpl = _EFFICIENCY_VARIANTS[idx % len(_EFFICIENCY_VARIANTS)]
            title = title_tpl.format(device=dt)
            desc = desc_tpl.format(device=dt)
            desc = f"{desc} Currently {efficiency_ratio:.1f}× fleet mean kWh."
            suggestions.append({
                'type': 'energy_efficiency',
                'sensor_id': sensor['sensor_id'],
                'device_type': sensor['device_type'],
                'location': sensor['location'],
                'title': title,
                'description': desc,
                'current_consumption': round(sensor['energy_consumption'], 2),
                'average_consumption': round(avg_consumption, 2),
                'efficiency_ratio': round(efficiency_ratio, 2),
                'potential_savings': potential_savings,
                'priority': 'high' if efficiency_ratio > 1.6 else 'medium',
                'action': 'efficiency_audit',
                'icon': '⚡'
            })
        
        return suggestions
    
    def _generate_operational_suggestions(self, df: pd.DataFrame, current_time: datetime) -> List[Dict]:
        suggestions = []
        
        if df['energy_consumption'].sum() <= 0:
            return suggestions
        # Low usage vs fleet (relative), not absolute kWh — avoids never matching real data.
        low_cutoff = float(df['energy_consumption'].quantile(0.15))
        low_usage = df[df['energy_consumption'] <= max(low_cutoff, 1e-6)]

        max_ops = 4
        if current_time.hour < 6 or current_time.hour > 20:  # Night hours
            added = 0
            for idx, (_, sensor) in enumerate(low_usage.iterrows()):
                if added >= max_ops:
                    break
                if sensor['device_type'] in ['pump', 'cooling_tower', 'conveyor']:
                    ec = float(sensor['energy_consumption'] or 0)
                    title_tpl, desc_tpl = _OPS_NIGHT_VARIANTS[idx % len(_OPS_NIGHT_VARIANTS)]
                    dt = str(sensor['device_type'])
                    loc = str(sensor['location'])
                    suggestions.append({
                        'type': 'operational_optimization',
                        'sensor_id': sensor['sensor_id'],
                        'device_type': sensor['device_type'],
                        'location': sensor['location'],
                        'title': title_tpl.format(device=dt, loc=loc),
                        'description': desc_tpl.format(device=dt, loc=loc),
                        'current_consumption': round(ec, 2),
                        'potential_savings': round(max(0.5, ec * self.energy_rates['off_peak'] * 8), 2),
                        'priority': 'low',
                        'action': 'schedule_shutdown',
                        'icon': '🌙'
                    })
                    added += 1
        else:
            day_candidates = low_usage.nsmallest(5, 'energy_consumption')
            for idx, (_, sensor) in enumerate(day_candidates.iterrows()):
                if idx >= max_ops:
                    break
                ec = float(sensor['energy_consumption'] or 0)
                title_tpl, desc_tpl = _OPS_DAY_VARIANTS[idx % len(_OPS_DAY_VARIANTS)]
                dt = str(sensor['device_type'])
                loc = str(sensor['location'])
                suggestions.append({
                    'type': 'operational_optimization',
                    'sensor_id': sensor['sensor_id'],
                    'device_type': sensor['device_type'],
                    'location': sensor['location'],
                    'title': title_tpl.format(device=dt, loc=loc),
                    'description': desc_tpl.format(device=dt, loc=loc),
                    'current_consumption': round(ec, 2),
                    'potential_savings': round(max(0.35, ec * self.energy_rates['shoulder'] * 4), 2),
                    'priority': 'low',
                    'action': 'efficiency_audit',
                    'icon': '⚡'
                })
        
        return suggestions
    
    def _identify_risk_factors(self, sensor: pd.Series) -> List[str]:
        factors = []
        if sensor['temperature'] > 75: factors.append('high_temperature')
        if sensor['current'] > 70: factors.append('high_current')
        if sensor['pressure'] > 12: factors.append('high_pressure')
        if sensor['is_anomaly']: factors.append('behavior_anomaly')
        if sensor['status'] == 'critical': factors.append('critical_status')
        return factors
    
    def _get_priority_score(self, suggestion: Dict) -> int:
        priority_map = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
        return priority_map.get(suggestion.get('priority', 'low'), 3)

# Utility function for quick access
def get_energy_optimizer():
    return EnergyOptimizer()