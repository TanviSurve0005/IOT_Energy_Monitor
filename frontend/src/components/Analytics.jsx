import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useEnergy } from '../context/EnergyContext';
import { computeEfficiencyScore } from '../utils/efficiencyScore';
import { seriesEndpointPercentChange, formatTrendPercentDisplay } from '../utils/trendPercent';
import { 
  BarChart3, 
  TrendingUp, 
  Download,
  Filter,
  Zap,
  Gauge
} from 'lucide-react';

/** Merge dense time-series into fewer buckets (avg) so bars stay readable. */
function bucketChartData(raw, maxBuckets = 36) {
  if (!raw?.length) return [];
  if (raw.length <= maxBuckets) return raw.map((d) => ({ ...d }));
  const bucketSize = Math.ceil(raw.length / maxBuckets);
  const out = [];
  for (let i = 0; i < raw.length; i += bucketSize) {
    const slice = raw.slice(i, i + bucketSize);
    const avg = slice.reduce((s, p) => s + p.value, 0) / slice.length;
    const first = slice[0];
    const last = slice[slice.length - 1];
    const t0 = first.timestamp ? new Date(first.timestamp) : null;
    const t1 = last.timestamp ? new Date(last.timestamp) : null;
    let label = '';
    if (t0 && t1) {
      label =
        t0.toDateString() === t1.toDateString()
          ? `${String(t0.getHours()).padStart(2, '0')}:${String(t0.getMinutes()).padStart(2, '0')}`
          : `${t0.getMonth() + 1}/${t0.getDate()} ${t0.getHours()}h`;
    } else {
      label = `${first.label}–${last.label}`;
    }
    out.push({
      label,
      value: avg,
      timestamp: first.timestamp,
      _rangeEnd: last.timestamp,
    });
  }
  return out;
}

const AnalyticsChart = ({
  title,
  data,
  color = '#3b82f6',
  seriesLabel = 'Series',
  yAxisLabel = 'Value',
  valueDecimals = 1,
}) => {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [hover, setHover] = useState(null);
  const [resizeTick, setResizeTick] = useState(0);

  const displayData = useMemo(() => bucketChartData(data, 40), [data]);
  const isBucketed = (data?.length || 0) > displayData.length;

  const formatVal = useCallback(
    (v) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(valueDecimals) : '—'),
    [valueDecimals]
  );

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => setResizeTick((t) => t + 1));
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !displayData.length) return;

    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = wrap.clientWidth || 600;
    const cssH = 300;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const padding = { top: 16, right: 16, bottom: 52, left: 56 };
    const chartWidth = cssW - padding.left - padding.right;
    const chartHeight = cssH - padding.top - padding.bottom;

    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
    ctx.fillRect(0, 0, cssW, cssH);

    const values = displayData.map((d) => d.value);
    let minValue = Math.min(...values);
    let maxValue = Math.max(...values);
    const span = maxValue - minValue;
    const pad = span > 0 ? span * 0.08 : Math.max(Math.abs(maxValue) * 0.05, 1);
    minValue -= pad * 0.25;
    maxValue += pad;
    const valueRange = Math.max(maxValue - minValue, 1e-6);
    const step = valueRange / 5;
    const flat = span < 1e-9;

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(cssW - padding.right, y);
      ctx.stroke();
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const value = minValue + step * (5 - i);
      const y = padding.top + (chartHeight / 5) * i;
      ctx.fillText(value.toFixed(valueDecimals), padding.left - 8, y + 4);
    }

    const n = displayData.length;
    const barSpacing = chartWidth / n;
    const barWidth = Math.max(2, barSpacing * 0.62);
    const hi = hover?.index;

    displayData.forEach((item, index) => {
      const x = padding.left + barSpacing * index + (barSpacing - barWidth) / 2;
      let barHeight = flat
        ? chartHeight * 0.45
        : ((item.value - minValue) / valueRange) * chartHeight;
      if (!flat && barHeight < 2) barHeight = 2;
      const y = padding.top + chartHeight - barHeight;
      const isHi = hi === index;

      if (isHi) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.fillRect(padding.left + barSpacing * index, padding.top, barSpacing, chartHeight);
      }

      const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, color);

      ctx.fillStyle = gradient;
      ctx.globalAlpha = 0.92;
      ctx.fillRect(x, y, barWidth, barHeight);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = isHi ? '#f1f5f9' : color;
      ctx.globalAlpha = isHi ? 1 : 0.45;
      ctx.lineWidth = isHi ? 2 : 1;
      ctx.strokeRect(x, y, barWidth, barHeight);
      ctx.globalAlpha = 1;
    });

    const labelStep = Math.max(1, Math.ceil(n / 8));
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let index = 0; index < n; index += labelStep) {
      const x = padding.left + barSpacing * index + barSpacing / 2;
      const text = displayData[index].label;
      ctx.save();
      ctx.translate(x, padding.top + chartHeight + 14);
      ctx.rotate(-0.4);
      const short = text.length > 16 ? `${text.slice(0, 14)}…` : text;
      ctx.fillText(short, 0, 0);
      ctx.restore();
    }

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      isBucketed ? 'Time (each bar is an average over a time window)' : 'Time',
      cssW / 2,
      cssH - 8
    );

    ctx.save();
    ctx.translate(14, padding.top + chartHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(yAxisLabel, 0, 0);
    ctx.restore();
  }, [displayData, color, hover, yAxisLabel, valueDecimals, isBucketed, resizeTick]);

  const onMove = (e) => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !displayData.length) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cssW = wrap.clientWidth || 600;
    const padding = { top: 16, right: 16, bottom: 52, left: 56 };
    const chartWidth = cssW - padding.left - padding.right;
    const chartHeight = 300 - padding.top - padding.bottom;
    const n = displayData.length;
    const barSpacing = chartWidth / n;
    const ix = Math.floor((mx - padding.left) / barSpacing);
    if (ix < 0 || ix >= n || mx < padding.left || mx > cssW - padding.right) {
      setHover(null);
      return;
    }
    if (my < padding.top || my > padding.top + chartHeight) {
      setHover(null);
      return;
    }
    setHover({
      index: ix,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      item: displayData[ix],
    });
  };

  const onLeave = () => setHover(null);

  if (!data?.length) {
    return (
      <div className="analytics-chart">
        <div className="chart-header">
          <h4>{title}</h4>
        </div>
        <div className="analytics-chart-empty">
          <p>No chart data for this time range yet.</p>
          <span>Try another range or wait for historical data to load.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-chart">
      <div className="chart-header">
        <h4>{title}</h4>
        <div className="chart-legend analytics-chart-legend-full">
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: color }} />
            <span className="legend-text-full">{seriesLabel}</span>
          </div>
        </div>
      </div>
      <p className="analytics-chart-hint">
        {isBucketed
          ? `Showing ${displayData.length} bars (averaged from ${data.length} data points). Hover a bar for the exact value.`
          : 'Hover a bar to read the value and time range.'}
      </p>
      <div className="chart-container analytics-chart-canvas-wrap" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={title}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          style={{ width: '100%', height: '300px', display: 'block', cursor: 'crosshair' }}
        />
        {hover && (
          <div
            className="analytics-chart-tooltip"
            style={{
              left: Math.min(
                Math.max(hover.x + 12, 8),
                (wrapRef.current?.clientWidth || 400) - 160
              ),
              top: Math.max(hover.y - 48, 8),
            }}
          >
            <div className="analytics-chart-tooltip-title">{seriesLabel}</div>
            <div className="analytics-chart-tooltip-value">{formatVal(hover.item.value)}</div>
            <div className="analytics-chart-tooltip-meta">{hover.item.label}</div>
          </div>
        )}
      </div>
    </div>
  );
};

const AnalyticsCard = ({ title, value, change, icon: Icon, color }) => {
  const pct = formatTrendPercentDisplay(change);
  return (
  <div className="analytics-card">
    <div className="analytics-header">
      <div className={`analytics-icon ${color}`}>
        <Icon size={20} />
      </div>
      <div className="analytics-trend">
        <span className={change >= 0 ? 'positive' : 'negative'}>
          {change >= 0 ? '↗' : '↘'} {pct}%
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
};

const Analytics = () => {
  const { historicalData, realTimeData, fetchHistoricalData } = useEnergy();
  const [timeRange, setTimeRange] = useState('24');
  const [activeTab, setActiveTab] = useState('energy');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  useEffect(() => {
    fetchHistoricalData(parseInt(timeRange, 10));
  }, [timeRange]);

  const timeLabel = (ts) =>
    new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  // Process data for charts
  const energyData = historicalData.map((point) => ({
    label: timeLabel(point.timestamp),
    value: point.energy_consumption,
    timestamp: point.timestamp
  }));

  const efficiencyData = historicalData.map((point) => ({
    label: timeLabel(point.timestamp),
    value: point.efficiency_score,
    timestamp: point.timestamp
  }));

  const sensorData = historicalData.map((point) => ({
    label: timeLabel(point.timestamp),
    value: point.active_sensors,
    timestamp: point.timestamp
  }));

  // Calculate analytics metrics
  const currentStats = realTimeData.stats || {};
  const totalEnergy = Number(currentStats.total_energy ?? currentStats.total_energy_consumption ?? 0);
  const efficiencyScore = Number(computeEfficiencyScore(currentStats, realTimeData.sensors || []));
  // Trend vs same series as the chart (first → last), not cumulative total vs interval average.
  const energyChange = seriesEndpointPercentChange(historicalData, (p) => p.energy_consumption);
  const efficiencyChange = seriesEndpointPercentChange(historicalData, (p) => p.efficiency_score);

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
      ['Energy Consumption', `${totalEnergy.toFixed(1)} kWh`, String(formatTrendPercentDisplay(energyChange)), energyChange >= 0 ? 'Good' : 'Needs Attention'],
      ['System Efficiency', `${efficiencyScore.toFixed(1)}%`, String(formatTrendPercentDisplay(efficiencyChange)), efficiencyChange >= 0 ? 'Good' : 'Needs Attention'],
      ['Active Sensors', currentStats.total_sensors || 0, '2.1', 'Good'],
      ['Avg Temperature', `${currentStats.avg_temperature?.toFixed(1) || 0}°C`, '-1.2', 'Good'],
      ['Data Latency', '<1s', '0.0', 'Excellent'],
      ['System Uptime', '99.8%', '0.1', 'Excellent'],
      [''],
      ['Energy Consumption Data'],
      ['Timestamp', 'Energy (kWh)', 'Status'],
      ...energyData.map(item => [
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
          value={`${totalEnergy.toFixed(1)} kWh`}
          change={energyChange}
          color="blue"
        />
        <AnalyticsCard
          icon={TrendingUp}
          title="System Efficiency"
          value={`${efficiencyScore.toFixed(1)}%`}
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
              seriesLabel="Energy (kWh)"
              yAxisLabel="Energy (kWh)"
              valueDecimals={1}
            />
          )}
          {activeTab === 'efficiency' && (
            <AnalyticsChart
              title="System Efficiency Trend"
              data={efficiencyData}
              color="#10b981"
              seriesLabel="Efficiency (%)"
              yAxisLabel="Efficiency (%)"
              valueDecimals={1}
            />
          )}
          {activeTab === 'sensors' && (
            <AnalyticsChart
              title="Active Sensors Monitoring"
              data={sensorData}
              color="#8b5cf6"
              seriesLabel="Active sensors (count)"
              yAxisLabel="Sensor count"
              valueDecimals={0}
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