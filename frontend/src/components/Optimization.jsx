import React, { useState, useEffect } from 'react';
import { useEnergy } from '../context/EnergyContext';
import {
  Lightbulb,
  Zap,
  DollarSign,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Play,
  Pause,
  Settings
} from 'lucide-react';

const SuggestionCard = ({ suggestion, onApply }) => {
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return '#ef4444';
      case 'high': return '#f59e0b';
      case 'medium': return '#3b82f6';
      default: return '#64748b';
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'schedule_shift': return '🕒';
      case 'schedule_maintenance': return '🛠️';
      case 'efficiency_audit': return '📊';
      case 'schedule_shutdown': return '⏸️';
      default: return '💡';
    }
  };

  return (
    <div className={`suggestion-card priority-${suggestion.priority}`}>
      <div className="suggestion-header">
        <div className="suggestion-type">
          <span className="action-icon">{getActionIcon(suggestion.action)}</span>
          <span className="suggestion-title">{suggestion.title}</span>
        </div>
        <div 
          className="priority-badge"
          style={{ backgroundColor: getPriorityColor(suggestion.priority) }}
        >
          {suggestion.priority}
        </div>
      </div>

      <div className="suggestion-content">
        <p>{suggestion.description}</p>
        
        <div className="suggestion-details">
          <div className="detail-item">
            <Zap size={14} />
            <span>Device: {sensor_id}</span>
          </div>
          <div className="detail-item">
            <Settings size={14} />
            <span>Type: {suggestion.device_type}</span>
          </div>
          <div className="detail-item">
            <TrendingUp size={14} />
            <span>Location: {suggestion.location}</span>
          </div>
        </div>

        {suggestion.potential_savings && (
          <div className="savings-indicator">
            <DollarSign size={14} />
            <span>Potential savings: ${suggestion.potential_savings}/hour</span>
          </div>
        )}

        {suggestion.risk_score && (
          <div className="risk-indicator">
            <AlertTriangle size={14} />
            <span>Risk score: {(suggestion.risk_score * 100).toFixed(1)}%</span>
          </div>
        )}
      </div>

      <div className="suggestion-actions">
        <button 
          className="btn-primary"
          onClick={() => onApply(suggestion)}
        >
          <CheckCircle size={16} />
          Apply Suggestion
        </button>
        <button className="btn-secondary">
          <Clock size={16} />
          Schedule
        </button>
        <button className="btn-text">
          More Info
        </button>
      </div>

      <div className="suggestion-footer">
        <span className="suggestion-source">AI Recommendation</span>
        <span className="suggestion-confidence">Confidence: 92%</span>
      </div>
    </div>
  );
};

const Optimization = () => {
  const { optimizationSuggestions, fetchOptimizationSuggestions, realTimeData } = useEnergy();
  const [activeFilter, setActiveFilter] = useState('all');
  const [appliedSuggestions, setAppliedSuggestions] = useState([]);
  const [autoOptimize, setAutoOptimize] = useState(false);

  useEffect(() => {
    fetchOptimizationSuggestions();
    
    // Refresh suggestions every 30 seconds if auto-optimize is enabled
    if (autoOptimize) {
      const interval = setInterval(fetchOptimizationSuggestions, 30000);
      return () => clearInterval(interval);
    }
  }, [autoOptimize]);

  const handleApplySuggestion = async (suggestion) => {
    // Simulate applying the suggestion
    console.log('Applying suggestion:', suggestion);
    
    // Add to applied suggestions
    setAppliedSuggestions(prev => [...prev, {
      ...suggestion,
      appliedAt: new Date().toISOString(),
      status: 'applied'
    }]);
    
    // Show success message
    alert(`Suggestion applied successfully! ${suggestion.potential_savings ? `Estimated savings: $${suggestion.potential_savings}/hour` : ''}`);
  };

  const filteredSuggestions = optimizationSuggestions.filter(suggestion => {
    if (activeFilter === 'all') return true;
    return suggestion.priority === activeFilter;
  });

  const stats = realTimeData.stats || {};
  const totalPotentialSavings = optimizationSuggestions.reduce(
    (sum, suggestion) => sum + (suggestion.potential_savings || 0), 0
  );

  return (
    <div className="optimization-page">
      <div className="page-header">
        <div>
          <h1>Energy Optimization</h1>
          <p>AI-powered suggestions to reduce costs and improve efficiency</p>
        </div>
        
        <div className="optimization-controls">
          <div className="auto-optimize-toggle">
            <label>
              <input
                type="checkbox"
                checked={autoOptimize}
                onChange={(e) => setAutoOptimize(e.target.checked)}
              />
              <span className="toggle-slider"></span>
              Auto-Optimize
            </label>
          </div>
          
          <button 
            className="btn-primary"
            onClick={fetchOptimizationSuggestions}
          >
            <Lightbulb size={16} />
            Refresh Suggestions
          </button>
        </div>
      </div>

      {/* Optimization Overview */}
      <div className="optimization-overview">
        <div className="overview-card">
          <div className="overview-icon">
            <Zap size={24} />
          </div>
          <div className="overview-content">
            <h3>Current Consumption</h3>
            <div className="overview-value">{stats.total_energy?.toFixed(1) || 0} kWh</div>
            <div className="overview-subtitle">Real-time usage</div>
          </div>
        </div>

        <div className="overview-card">
          <div className="overview-icon">
            <DollarSign size={24} />
          </div>
          <div className="overview-content">
            <h3>Potential Savings</h3>
            <div className="overview-value">${totalPotentialSavings.toFixed(2)}/h</div>
            <div className="overview-subtitle">From active suggestions</div>
          </div>
        </div>

        <div className="overview-card">
          <div className="overview-icon">
            <TrendingUp size={24} />
          </div>
          <div className="overview-content">
            <h3>Efficiency Score</h3>
            <div className="overview-value">{stats.efficiency_score?.toFixed(1) || 0}%</div>
            <div className="overview-subtitle">System performance</div>
          </div>
        </div>

        <div className="overview-card">
          <div className="overview-icon">
            <CheckCircle size={24} />
          </div>
          <div className="overview-content">
            <h3>Applied Optimizations</h3>
            <div className="overview-value">{appliedSuggestions.length}</div>
            <div className="overview-subtitle">Active improvements</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="optimization-filters">
        <div className="filter-buttons">
          {['all', 'critical', 'high', 'medium', 'low'].map(filter => (
            <button
              key={filter}
              className={`filter-btn ${activeFilter === filter ? 'active' : ''}`}
              onClick={() => setActiveFilter(filter)}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
              <span className="filter-count">
                {filter === 'all' 
                  ? optimizationSuggestions.length 
                  : optimizationSuggestions.filter(s => s.priority === filter).length
                }
              </span>
            </button>
          ))}
        </div>

        <div className="filter-info">
          <span>Showing {filteredSuggestions.length} suggestions</span>
          <span>•</span>
          <span>Last updated: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Suggestions Grid */}
      <div className="suggestions-grid">
        {filteredSuggestions.length > 0 ? (
          filteredSuggestions.map((suggestion, index) => (
            <SuggestionCard
              key={`${suggestion.sensor_id}-${index}`}
              suggestion={suggestion}
              onApply={handleApplySuggestion}
            />
          ))
        ) : (
          <div className="no-suggestions">
            <Lightbulb size={48} />
            <h3>No optimization suggestions available</h3>
            <p>All systems are currently optimized, or check back later for new recommendations.</p>
          </div>
        )}
      </div>

      {/* Applied Suggestions */}
      {appliedSuggestions.length > 0 && (
        <div className="applied-suggestions">
          <h3>Recently Applied Optimizations</h3>
          <div className="applied-list">
            {appliedSuggestions.slice(0, 5).map((suggestion, index) => (
              <div key={index} className="applied-item">
                <CheckCircle size={16} className="applied-icon" />
                <div className="applied-content">
                  <span className="applied-title">{suggestion.title}</span>
                  <span className="applied-time">
                    Applied {new Date(suggestion.appliedAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="applied-status">Active</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Optimization Tips */}
      <div className="optimization-tips">
        <h3>💡 Pro Tips for Maximum Efficiency</h3>
        <div className="tips-grid">
          <div className="tip-card">
            <div className="tip-icon">🌙</div>
            <h4>Off-Peak Scheduling</h4>
            <p>Run high-energy processes during off-peak hours (8 PM - 6 AM) to reduce electricity costs by up to 40%.</p>
          </div>
          
          <div className="tip-card">
            <div className="tip-icon">🔄</div>
            <h4>Equipment Maintenance</h4>
            <p>Regular maintenance can improve equipment efficiency by 15-20% and extend lifespan by 30%.</p>
          </div>
          
          <div className="tip-card">
            <div className="tip-icon">🌡️</div>
            <h4>Temperature Control</h4>
            <p>Maintain optimal operating temperatures to prevent energy waste and equipment stress.</p>
          </div>
          
          <div className="tip-card">
            <div className="tip-icon">📊</div>
            <h4>Continuous Monitoring</h4>
            <p>Real-time monitoring helps identify inefficiencies before they become costly problems.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Optimization;