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
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = canvas.width - padding.left - padding.right;
    const chartHeight = canvas.height - padding.top - padding.bottom;

    // Clear canvas with gradient background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGradient.addColorStop(0, 'rgba(59, 130, 246, 0.02)');
    bgGradient.addColorStop(1, 'rgba(59, 130, 246, 0.05)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Find data range
    const values = data.map(d => d.value);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const valueRange = maxValue - minValue || 1;
    const step = valueRange / 5;

    // Draw modern grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    
    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(canvas.width - padding.right, y);
      ctx.stroke();
    }
    
    // Vertical grid lines
    for (let i = 0; i <= data.length; i++) {
      const x = padding.left + (chartWidth / data.length) * i;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + chartHeight);
      ctx.stroke();
    }

    // Draw Y-axis labels
    ctx.fillStyle = 'var(--text-secondary)';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const value = minValue + step * (5 - i);
      const y = padding.top + (chartHeight / 5) * i;
      ctx.fillText(value.toFixed(1), padding.left - 10, y + 3);
    }

    // Draw modern bars with glassmorphism effect
    const barWidth = chartWidth / data.length * 0.7;
    const barSpacing = chartWidth / data.length;
    
    data.forEach((item, index) => {
      const x = padding.left + barSpacing * index + (barSpacing - barWidth) / 2;
      const barHeight = ((item.value - minValue) / valueRange) * chartHeight;
      const y = padding.top + chartHeight - barHeight;

      // Create modern gradient
      const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
      gradient.addColorStop(0, color + 'FF');
      gradient.addColorStop(0.3, color + 'E6');
      gradient.addColorStop(0.7, color + 'CC');
      gradient.addColorStop(1, color + 'B3');

      // Bar shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(x + 3, y + 3, barWidth, barHeight);
      ctx.fillRect(x + 2, y + 2, barWidth, barHeight);

      // Main bar with gradient
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth, barHeight);

      // Glassmorphism highlight
      const highlightGradient = ctx.createLinearGradient(0, y, 0, y + barHeight * 0.4);
      highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
      highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0.1)');
      ctx.fillStyle = highlightGradient;
      ctx.fillRect(x, y, barWidth, barHeight * 0.4);

      // Modern border
      ctx.strokeStyle = color + '80';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, barWidth, barHeight);

      // Value label with modern styling
      ctx.fillStyle = 'var(--text-primary)';
      ctx.font = 'bold 11px system-ui';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
      ctx.shadowBlur = 1;
      ctx.fillText(item.value.toFixed(1), x + barWidth / 2, y - 8);
      ctx.shadowBlur = 0;
      
      // Time label with modern styling
      ctx.fillStyle = 'var(--text-secondary)';
      ctx.font = '9px system-ui';
      ctx.fillText(item.label, x + barWidth / 2, y + barHeight + 25);
    });

    // Add axis labels
    ctx.fillStyle = 'var(--text-primary)';
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(15, padding.top + chartHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Value (kWh)', 0, 0);
    ctx.restore();
    
    ctx.fillText('Time →', canvas.width / 2, canvas.height - 5);
  }, [data, color]);

  return (
    <div className="analytics-chart">
      <div className="chart-header">
        <h4>{title}</h4>
        <div className="chart-legend">
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: color }}></div>
            <span>Energy Consumption</span>
          </div>
        </div>
      </div>
      <div className="chart-container">
        <canvas 
          ref={canvasRef} 
          width={500} 
          height={250}
          style={{ width: '100%', height: '250px' }}
        />
      </div>
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
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

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

  const generateReport = async () => {
    setIsGeneratingReport(true);
    
    // Simulate report generation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Create CSV content
    const csvContent = [
      ['VoltAI Energy Analytics Report'],
      [`Generated: ${new Date().toLocaleDateString()}`],
      [`Time Range: Last ${timeRange} hours`],
      [''],
      ['Key Performance Indicators'],
      ['Metric', 'Current Value', 'Change (%)', 'Status'],
      ['Energy Consumption', `${currentStats.total_energy?.toFixed(1) || 0} kWh`, energyChange.toFixed(1), energyChange >= 0 ? 'Good' : 'Needs Attention'],
      ['System Efficiency', `${currentStats.efficiency_score?.toFixed(1) || 0}%`, efficiencyChange.toFixed(1), efficiencyChange >= 0 ? 'Good' : 'Needs Attention'],
      ['Active Sensors', currentStats.total_sensors || 0, '2.1', 'Good'],
      ['Avg Temperature', `${currentStats.avg_temperature?.toFixed(1) || 0}°C`, '-1.2', 'Good'],
      ['Data Latency', '<1s', '0.0', 'Excellent'],
      ['System Uptime', '99.8%', '0.1', 'Excellent'],
      [''],
      ['Energy Consumption Data'],
      ['Timestamp', 'Energy (kWh)', 'Status'],
      ...analyticsData.map(item => [
        item.label,
        item.value.toFixed(2),
        item.value > 50 ? 'High' : item.value > 30 ? 'Medium' : 'Low'
      ])
    ].map(row => row.join(',')).join('\n');
    
    // Create and download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `VoltAI-Energy-Report-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setIsGeneratingReport(false);
  };

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
          <button 
            className="btn-primary"
            onClick={generateReport}
            disabled={isGeneratingReport}
          >
            <Download size={16} />
            {isGeneratingReport ? 'Generating...' : 'Download CSV'}
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