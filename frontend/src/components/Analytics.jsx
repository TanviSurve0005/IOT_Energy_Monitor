import React, { useState, useEffect } from 'react';
import { useEnergy } from '../context/EnergyContext';
import { 
  BarChart3, 
  TrendingUp, 
  Calendar, 
  Download,
  Filter,
  Clock,
  Zap,
  Thermometer,
  Gauge
} from 'lucide-react';

const AnalyticsChart = ({ title, data, color = '#3b82f6' }) => {
  const canvasRef = React.useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.length) return;

    const ctx = canvas.getContext('2d');
    const padding = 40;
    const chartWidth = canvas.width - padding * 2;
    const chartHeight = canvas.height - padding * 2;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Find data range
    const values = data.map(d => d.value);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const valueRange = maxValue - minValue || 1;

    // Draw grid
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    
    // Horizontal grid lines
    for (let i = 0; i <= 4; i++) {
      const y = padding + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(canvas.width - padding, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw bars
    const barWidth = chartWidth / data.length * 0.6;
    
    data.forEach((item, index) => {
      const x = padding + (chartWidth / data.length) * index + (chartWidth / data.length - barWidth) / 2;
      const barHeight = ((item.value - minValue) / valueRange) * chartHeight;
      const y = padding + chartHeight - barHeight;

      // Bar
      ctx.fillStyle = color;
      ctx.fillRect(x, y, barWidth, barHeight);

      // Value label
      ctx.fillStyle = '#f1f5f9';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(item.value.toFixed(1), x + barWidth / 2, y - 5);
    });

  }, [data, color]);

  return (
    <div className="chart-container">
      <div className="chart-header">
        <h3 className="chart-title">{title}</h3>
        <div className="chart-actions">
          <button className="btn-icon" title="Download data">
            <Download size={16} />
          </button>
        </div>
      </div>
      <canvas 
        ref={canvasRef} 
        width={600} 
        height={300}
        style={{ width: '100%', height: '300px' }}
      />
    </div>
  );
};

const AnalyticsCard = ({ title, value, change, icon: Icon, color }) => (
  <div className="analytics-card">
    <div className="analytics-header">
      <div className={`analytics-icon ${color}`}>
        <Icon size={20} />
      </div>
      <div className="analytics-trend">
        <span className={change >= 0 ? 'positive' : 'negative'}>
          {change >= 0 ? '↗' : '↘'} {Math.abs(change)}%
        </span>
      </div>
    </div>
    <div className="analytics-content">
      <h3>{title}</h3>
      <div className="analytics-value">{value}</div>
      <div className="analytics-subtitle">Last 24 hours</div>
    </div>
  </div>
);

const Analytics = () => {
  const { historicalData, realTimeData, fetchHistoricalData } = useEnergy();
  const [timeRange, setTimeRange] = useState('24h');
  const [activeTab, setActiveTab] = useState('energy');

  useEffect(() => {
    fetchHistoricalData(parseInt(timeRange));
  }, [timeRange]);

  // Process data for charts
  const energyData = historicalData.map((point, index) => ({
    label: new Date(point.timestamp).getHours() + 'h',
    value: point.energy_consumption,
    timestamp: point.timestamp
  }));

  const efficiencyData = historicalData.map(point => ({
    label: new Date(point.timestamp).getHours() + 'h',
    value: point.efficiency_score,
    timestamp: point.timestamp
  }));

  const sensorData = historicalData.map(point => ({
    label: new Date(point.timestamp).getHours() + 'h',
    value: point.active_sensors,
    timestamp: point.timestamp
  }));

  // Calculate analytics metrics
  const currentStats = realTimeData.stats || {};
  const avgEnergy = historicalData.length > 0 
    ? historicalData.reduce((sum, point) => sum + point.energy_consumption, 0) / historicalData.length 
    : 0;
  
  const energyChange = avgEnergy ? ((currentStats.total_energy - avgEnergy) / avgEnergy * 100) : 0;
  const efficiencyChange = historicalData.length > 1 
    ? ((currentStats.efficiency_score - historicalData[0].efficiency_score) / historicalData[0].efficiency_score * 100)
    : 0;

  return (
    <div className="analytics-page">
      <div className="page-header">
        <div>
          <h1>Analytics & Insights</h1>
          <p>Detailed analysis of energy consumption patterns and system performance</p>
        </div>
        <div className="header-actions">
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)}
            className="time-selector"
          >
            <option value="6">Last 6 hours</option>
            <option value="24">Last 24 hours</option>
            <option value="168">Last 7 days</option>
          </select>
          <button className="btn-primary">
            <Download size={16} />
            Export Report
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="analytics-grid">
        <AnalyticsCard
          icon={Zap}
          title="Energy Consumption"
          value={`${currentStats.total_energy?.toFixed(1) || 0} kWh`}
          change={energyChange}
          color="blue"
        />
        <AnalyticsCard
          icon={TrendingUp}
          title="System Efficiency"
          value={`${currentStats.efficiency_score?.toFixed(1) || 0}%`}
          change={efficiencyChange}
          color="green"
        />
        <AnalyticsCard
          icon={BarChart3}
          title="Active Sensors"
          value={currentStats.total_sensors || 0}
          change={2.1}
          color="purple"
        />
        <AnalyticsCard
          icon={Gauge}
          title="Avg Temperature"
          value={`${currentStats.avg_temperature?.toFixed(1) || 0}°C`}
          change={-1.2}
          color="orange"
        />
      </div>

      {/* Chart Tabs */}
      <div className="chart-tabs">
        <div className="tab-header">
          {[
            { id: 'energy', label: 'Energy Consumption', icon: Zap },
            { id: 'efficiency', label: 'Efficiency Score', icon: TrendingUp },
            { id: 'sensors', label: 'Active Sensors', icon: BarChart3 }
          ].map(tab => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <IconComponent size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="tab-content">
          {activeTab === 'energy' && (
            <AnalyticsChart
              title="Energy Consumption Over Time"
              data={energyData}
              color="#3b82f6"
            />
          )}
          {activeTab === 'efficiency' && (
            <AnalyticsChart
              title="System Efficiency Trend"
              data={efficiencyData}
              color="#10b981"
            />
          )}
          {activeTab === 'sensors' && (
            <AnalyticsChart
              title="Active Sensors Monitoring"
              data={sensorData}
              color="#8b5cf6"
            />
          )}
        </div>
      </div>

      {/* Insights Section */}
      <div className="insights-section">
        <div className="section-header">
          <h3>AI Insights & Recommendations</h3>
          <Filter size={18} />
        </div>
        
        <div className="insights-grid">
          <div className="insight-card">
            <div className="insight-header">
              <div className="insight-icon">💡</div>
              <span className="insight-category">Energy Saving</span>
            </div>
            <p>Shift high-consumption devices to off-peak hours (8 PM - 6 AM) to reduce costs by 25%</p>
            <div className="insight-metrics">
              <span>Potential Savings: $1,200/month</span>
            </div>
          </div>

          <div className="insight-card">
            <div className="insight-header">
              <div className="insight-icon">🛠️</div>
              <span className="insight-category">Maintenance</span>
            </div>
            <p>3 motors showing early signs of wear. Schedule preventive maintenance within 2 weeks.</p>
            <div className="insight-metrics">
              <span>Risk Reduction: 85%</span>
            </div>
          </div>

          <div className="insight-card">
            <div className="insight-header">
              <div className="insight-icon">⚡</div>
              <span className="insight-category">Efficiency</span>
            </div>
            <p>Production Line B is 15% less efficient than Line A. Investigate equipment calibration.</p>
            <div className="insight-metrics">
              <span>Improvement Potential: 12%</span>
            </div>
          </div>

          <div className="insight-card">
            <div className="insight-header">
              <div className="insight-icon">🌱</div>
              <span className="insight-category">Sustainability</span>
            </div>
            <p>Carbon footprint reduced by 8% this month. On track to meet quarterly targets.</p>
            <div className="insight-metrics">
              <span>CO2 Reduction: 12.5 tons</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;