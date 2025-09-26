import pandas as pd
from datetime import datetime
import numpy as np
from typing import List, Dict, Any

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
        
        # Sort by priority and return top 15
        return sorted(suggestions, key=lambda x: self._get_priority_score(x))[:15]
    
    def _generate_peak_suggestions(self, df: pd.DataFrame, current_hour: int) -> List[Dict]:
        suggestions = []
        
        if current_hour in self.peak_hours:
            high_consumption = df[df['energy_consumption'] > df['energy_consumption'].quantile(0.75)]
            
            for _, sensor in high_consumption.iterrows():
                if sensor['failure_probability'] < 0.4:  # Only suggest for reliable equipment
                    hourly_consumption = sensor['energy_consumption']
                    potential_savings = hourly_consumption * (self.energy_rates['on_peak'] - self.energy_rates['off_peak'])
                    
                    if potential_savings > 0.5:  # Only suggest if meaningful savings
                        suggestions.append({
                            'type': 'cost_optimization',
                            'sensor_id': sensor['sensor_id'],
                            'device_type': sensor['device_type'],
                            'location': sensor['location'],
                            'title': 'Shift Operation to Off-Peak Hours',
                            'description': f"Move {sensor['device_type']} operation to save on energy costs",
                            'current_cost': round(hourly_consumption * self.energy_rates['on_peak'], 2),
                            'potential_savings': round(potential_savings, 2),
                            'savings_per_day': round(potential_savings * 8, 2),  # 8 peak hours
                            'priority': 'high' if potential_savings > 2 else 'medium',
                            'action': 'schedule_shift',
                            'icon': '💰'
                        })
        
        return suggestions
    
    def _generate_maintenance_suggestions(self, df: pd.DataFrame) -> List[Dict]:
        suggestions = []
        high_risk = df[df['failure_probability'] > self.maintenance_threshold]
        
        for _, sensor in high_risk.iterrows():
            risk_factor = sensor['failure_probability']
            suggestions.append({
                'type': 'predictive_maintenance',
                'sensor_id': sensor['sensor_id'],
                'device_type': sensor['device_type'],
                'location': sensor['location'],
                'title': 'Schedule Preventive Maintenance',
                'description': 'High failure probability detected - recommend immediate inspection',
                'risk_score': round(risk_factor, 3),
                'urgency': 'critical' if risk_factor > 0.85 else 'high',
                'factors': self._identify_risk_factors(sensor),
                'priority': 'critical',
                'action': 'schedule_maintenance',
                'icon': '🛠️'
            })
        
        return suggestions
    
    def _generate_efficiency_suggestions(self, df: pd.DataFrame) -> List[Dict]:
        suggestions = []
        avg_consumption = df['energy_consumption'].mean()
        inefficient = df[df['energy_consumption'] > avg_consumption * self.efficiency_threshold]
        
        for _, sensor in inefficient.iterrows():
            efficiency_ratio = sensor['energy_consumption'] / avg_consumption
            suggestions.append({
                'type': 'energy_efficiency',
                'sensor_id': sensor['sensor_id'],
                'device_type': sensor['device_type'],
                'location': sensor['location'],
                'title': 'Energy Efficiency Improvement',
                'description': f"Consumption {efficiency_ratio:.1f}x higher than average",
                'current_consumption': round(sensor['energy_consumption'], 2),
                'average_consumption': round(avg_consumption, 2),
                'efficiency_ratio': round(efficiency_ratio, 2),
                'priority': 'medium',
                'action': 'efficiency_audit',
                'icon': '⚡'
            })
        
        return suggestions
    
    def _generate_operational_suggestions(self, df: pd.DataFrame, current_time: datetime) -> List[Dict]:
        suggestions = []
        
        # Suggest shutdown for low-usage equipment during off-hours
        if current_time.hour < 6 or current_time.hour > 20:  # Night hours
            low_usage = df[df['energy_consumption'] < 0.5]  # Very low consumption
            
            for _, sensor in low_usage.iterrows():
                if sensor['device_type'] in ['pump', 'cooling_tower', 'conveyor']:
                    suggestions.append({
                        'type': 'operational_optimization',
                        'sensor_id': sensor['sensor_id'],
                        'device_type': sensor['device_type'],
                        'location': sensor['location'],
                        'title': 'Consider Night Shutdown',
                        'description': 'Low usage equipment can be shut down during off-hours',
                        'current_consumption': round(sensor['energy_consumption'], 2),
                        'potential_savings': round(sensor['energy_consumption'] * 10, 2),  # 10 night hours
                        'priority': 'low',
                        'action': 'schedule_shutdown',
                        'icon': '🌙'
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