import React, { useEffect, useState } from 'react';
import { useEnergy } from '../context/EnergyContext';
import { 
  Zap, 
  AlertTriangle, 
  Activity, 
  TrendingUp,
  Clock,
  Thermometer,
  Gauge,
  DollarSign
} from 'lucide-react';
import RealTimeChart from './RealTimeChart';
import AnomalyMap from './AnomalyMap';

const StatCard = ({ icon: Icon, title, value, subtitle, trend, color = 'default' }) => (
  <div className={`stat-card ${color} fade-in`}>
    <div className="stat-icon">
      <Icon size={24} />
    </div>
    <div className="stat-content">
      <h3>{title}</h3>
      <div className="stat-value">{value}</div>
      <div className="stat-subtitle">{subtitle}</div>
      {trend && (
        <div className={`stat-trend ${trend > 0 ? 'positive' : 'negative'}`}>
          {trend > 0 ? '↗' : '↘'} {Math.abs(trend)}%
        </div>
      )}
    </div>
  </div>
);

const AlertItem = ({ alert }) => (
  <div className="alert-item fade-in">
    <AlertTriangle size={16} className="alert-icon" />
    <div className="alert-content">
      <strong>{alert.sensor_id}</strong>
      <span>{alert.device_type} • {alert.location}</span>
      <div className="alert-metrics">
        <span>Current: {alert.current}A</span>
        <span>Temp: {alert.temperature}°C</span>
        <span>Pressure: {alert.pressure}bar</span>
      </div>
    </div>
    <div className="alert-timestamp">
      {new Date(alert.timestamp).toLocaleTimeString()}
    </div>
  </div>
);

const Dashboard = () => {
  const { realTimeData, isConnected } = useEnergy();
  const [criticalAlerts, setCriticalAlerts] = useState([]);

  useEffect(() => {
    if (realTimeData.sensors && realTimeData.sensors.length > 0) {
      const alerts = realTimeData.sensors
        .filter(sensor => sensor.status === 'critical')
        .slice(0, 5);
      setCriticalAlerts(alerts);
    }
  }, [realTimeData.sensors]);

  const stats = realTimeData.stats || {};

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Smart Energy Monitoring Dashboard</h1>
        <p>Real-time factory energy consumption and safety monitoring</p>
        <div className="connection-badge">
          <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></div>
          {isConnected ? 'Live Data Streaming' : 'Connection Lost'}
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="stats-grid">
        <StatCard
          icon={Zap}
          title="Total Energy Consumption"
          value={`${stats.total_energy || 0} kWh`}
          subtitle="Current hour"
          trend={2.3}
          color="blue"
        />
        
        <StatCard
          icon={AlertTriangle}
          title="Critical Alerts"
          value={stats.critical_sensors || 0}
          subtitle="Requiring immediate attention"
          color="critical"
        />
        
        <StatCard
          icon={Activity}
          title="Active Sensors"
          value={stats.total_sensors || 0}
          subtitle="Online devices"
          color="green"
        />
        
        <StatCard
          icon={TrendingUp}
          title="System Efficiency"
          value={`${stats.efficiency_score || 0}%`}
          subtitle="Overall performance"
          color="purple"
        />
        
        <StatCard
          icon={Thermometer}
          title="Average Temperature"
          value={`${stats.avg_temperature || 0}°C`}
          subtitle="Across all devices"
          color="orange"
        />
        
        <StatCard
          icon={DollarSign}
          title="Hourly Cost"
          value={`$${((stats.total_energy || 0) * 0.12).toFixed(2)}`}
          subtitle="Based on current usage"
          color="green"
        />
      </div>

      {/* Main Content Area */}
      <div className="dashboard-content">
        <div className="content-column">
          <div className="chart-section">
            <div className="chart-container">
              <div className="chart-header">
                <h3 className="chart-title">Real-time Energy Consumption</h3>
                <div className="chart-legend">
                  <span className="legend-item">
                    <div className="legend-color blue"></div>
                    Energy (kWh)
                  </span>
                </div>
              </div>
              <RealTimeChart />
            </div>
          </div>

          <div className="map-section">
            <div className="chart-container">
              <div className="chart-header">
                <h3 className="chart-title">Factory Floor Monitoring</h3>
                <div className="chart-legend">
                  <span className="legend-item">
                    <div className="legend-color green"></div>
                    Normal
                  </span>
                  <span className="legend-item">
                    <div className="legend-color orange"></div>
                    Warning
                  </span>
                  <span className="legend-item">
                    <div className="legend-color red"></div>
                    Critical
                  </span>
                </div>
              </div>
              <AnomalyMap sensors={realTimeData.sensors || []} />
            </div>
          </div>
        </div>

        <div className="sidebar">
          <div className="alerts-section">
            <div className="section-header">
              <AlertTriangle size={20} />
              <h3>Critical Alerts</h3>
              <span className="badge">{criticalAlerts.length}</span>
            </div>
            
            <div className="alerts-list">
              {criticalAlerts.length > 0 ? (
                criticalAlerts.map(alert => (
                  <AlertItem key={alert.sensor_id} alert={alert} />
                ))
              ) : (
                <div className="no-alerts">
                  <div className="no-alerts-icon">✅</div>
                  <p>No critical alerts</p>
                  <span>All systems operating normally</span>
                </div>
              )}
            </div>
          </div>

          <div className="quick-stats">
            <div className="section-header">
              <Clock size={20} />
              <h3>System Status</h3>
            </div>
            
            <div className="quick-stats-grid">
              <div className="quick-stat">
                <div className="quick-stat-label">Data Latency</div>
                <div className="quick-stat-value">{isConnected ? '<1s' : 'N/A'}</div>
              </div>
              
              <div className="quick-stat">
                <div className="quick-stat-label">Uptime</div>
                <div className="quick-stat-value">99.8%</div>
              </div>
              
              <div className="quick-stat">
                <div className="quick-stat-label">Anomalies</div>
                <div className="quick-stat-value">{stats.anomaly_count || 0}</div>
              </div>
              
              <div className="quick-stat">
                <div className="quick-stat-label">Avg Power</div>
                <div className="quick-stat-value">{stats.total_power || 0}A</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;