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
  const { realTimeData, isConnected, isProducerActive, producerStatus } = useEnergy();
  const [criticalAlerts, setCriticalAlerts] = useState([]);

  // Debug logging
  useEffect(() => {
    console.log('🔍 Dashboard Debug:', {
      isConnected,
      isProducerActive,
      realTimeData,
      stats: realTimeData.stats,
      sensorsCount: realTimeData.sensors?.length || 0
    });
  }, [isConnected, isProducerActive, realTimeData]);

  useEffect(() => {
    // Process alerts when connected to API
    if (isConnected && realTimeData.sensors && realTimeData.sensors.length > 0) {
      const alerts = realTimeData.sensors
        .filter(sensor => sensor.status === 'critical')
        .slice(0, 5);
      setCriticalAlerts(alerts);
    } else {
      // Clear alerts when disconnected
      setCriticalAlerts([]);
    }
  }, [realTimeData.sensors, isConnected]);

  // Show data when connected to API (producer status is optional)
  const shouldShowData = isConnected;
  const stats = shouldShowData ? (realTimeData.stats || {}) : {};

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Smart Energy Monitoring Dashboard</h1>
        <p>Real-time factory energy consumption and safety monitoring</p>
        <div className="connection-badge">
          <div className={`status-dot ${shouldShowData ? 'connected' : 'disconnected'}`}></div>
          {shouldShowData ? 'Live Data Streaming' : 'Data Stream Disconnected'}
        </div>
      </div>

      {/* Disconnection Warning */}
      {!shouldShowData && (
        <div className="disconnection-warning">
          <div className="warning-content">
            <AlertTriangle size={24} className="warning-icon" />
            <div className="warning-text">
              <h3>Data Stream Disconnected</h3>
              <p>
                {!isConnected 
                  ? 'Unable to connect to the consumer API. Please check your network connection.'
                  : 'Connection status unknown. Please refresh the page.'
                }
              </p>
              {producerStatus.last_data_time && (
                <p className="last-data-time">
                  Last data received: {new Date(producerStatus.last_data_time).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Statistics Grid */}
      <div className="stats-grid">
        <StatCard
          icon={Zap}
          title="Total Energy Consumption"
          value={shouldShowData ? `${stats.total_energy || 0} kWh` : '--'}
          subtitle={shouldShowData ? "Current hour" : "No data available"}
          trend={shouldShowData ? 2.3 : null}
          color={shouldShowData ? "blue" : "disabled"}
        />
        
        <StatCard
          icon={AlertTriangle}
          title="Critical Alerts"
          value={shouldShowData ? (stats.critical_sensors || 0) : '--'}
          subtitle={shouldShowData ? "Requiring immediate attention" : "No data available"}
          color={shouldShowData ? "critical" : "disabled"}
        />
        
        <StatCard
          icon={Activity}
          title="Active Sensors"
          value={shouldShowData ? (stats.total_sensors || 0) : '--'}
          subtitle={shouldShowData ? "Online devices" : "No data available"}
          color={shouldShowData ? "green" : "disabled"}
        />
        
        <StatCard
          icon={TrendingUp}
          title="System Efficiency"
          value={shouldShowData ? `${stats.efficiency_score || 0}%` : '--'}
          subtitle={shouldShowData ? "Overall performance" : "No data available"}
          color={shouldShowData ? "purple" : "disabled"}
        />
        
        <StatCard
          icon={Thermometer}
          title="Average Temperature"
          value={shouldShowData ? `${stats.avg_temperature || 0}°C` : '--'}
          subtitle={shouldShowData ? "Across all devices" : "No data available"}
          color={shouldShowData ? "orange" : "disabled"}
        />
        
        <StatCard
          icon={DollarSign}
          title="Hourly Cost"
          value={shouldShowData ? `$${((stats.total_energy || 0) * 0.12).toFixed(2)}` : '--'}
          subtitle={shouldShowData ? "Based on current usage" : "No data available"}
          color={shouldShowData ? "green" : "disabled"}
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
                  {shouldShowData ? (
                    <span className="legend-item">
                      <div className="legend-color blue"></div>
                      Energy (kWh)
                    </span>
                  ) : (
                    <span className="legend-item disabled">
                      <div className="legend-color disabled"></div>
                      No Data Available
                    </span>
                  )}
                </div>
              </div>
              {shouldShowData ? (
                <RealTimeChart />
              ) : (
                <div className="no-data-placeholder">
                  <div className="no-data-icon">📊</div>
                  <h4>No Data Available</h4>
                  <p>Connect to producer to view real-time energy consumption</p>
                </div>
              )}
            </div>
          </div>

          <div className="map-section">
            <div className="chart-container">
              <div className="chart-header">
                <h3 className="chart-title">Factory Floor Monitoring</h3>
                <div className="chart-legend">
                  {shouldShowData ? (
                    <>
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
                    </>
                  ) : (
                    <span className="legend-item disabled">
                      <div className="legend-color disabled"></div>
                      No Data Available
                    </span>
                  )}
                </div>
              </div>
              {shouldShowData ? (
                <AnomalyMap sensors={realTimeData.sensors || []} />
              ) : (
                <div className="no-data-placeholder">
                  <div className="no-data-icon">🏭</div>
                  <h4>No Sensor Data</h4>
                  <p>Connect to producer to view factory floor monitoring</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="sidebar">
          <div className="alerts-section">
            <div className="section-header">
              <AlertTriangle size={20} />
              <h3>Critical Alerts</h3>
              <span className="badge">{shouldShowData ? criticalAlerts.length : 0}</span>
            </div>
            
            <div className="alerts-list">
              {shouldShowData ? (
                criticalAlerts.length > 0 ? (
                  criticalAlerts.map(alert => (
                    <AlertItem key={alert.sensor_id} alert={alert} />
                  ))
                ) : (
                  <div className="no-alerts">
                    <div className="no-alerts-icon">✅</div>
                    <p>No critical alerts</p>
                    <span>All systems operating normally</span>
                  </div>
                )
              ) : (
                <div className="no-alerts">
                  <div className="no-alerts-icon">⚠️</div>
                  <p>No data available</p>
                  <span>Connect to producer to view alerts</span>
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
                <div className="quick-stat-value">{shouldShowData ? '<1s' : 'N/A'}</div>
              </div>
              
              <div className="quick-stat">
                <div className="quick-stat-label">Connection</div>
                <div className={`quick-stat-value ${shouldShowData ? 'connected' : 'disconnected'}`}>
                  {shouldShowData ? 'Active' : 'Disconnected'}
                </div>
              </div>
              
              <div className="quick-stat">
                <div className="quick-stat-label">Anomalies</div>
                <div className="quick-stat-value">{shouldShowData ? (stats.anomaly_count || 0) : '--'}</div>
              </div>
              
              <div className="quick-stat">
                <div className="quick-stat-label">Avg Power</div>
                <div className="quick-stat-value">{shouldShowData ? (stats.total_power || 0) + 'A' : '--'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;