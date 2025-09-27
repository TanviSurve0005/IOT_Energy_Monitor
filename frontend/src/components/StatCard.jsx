import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const StatCard = ({ title, value, icon, trend, color = 'blue' }) => {
  const getTrendIcon = () => {
    if (trend === null) return null;
    
    switch (trend) {
      case 'up':
        return <TrendingUp className="trend-icon trend-up" />;
      case 'down':
        return <TrendingDown className="trend-icon trend-down" />;
      default:
        return <Minus className="trend-icon trend-neutral" />;
    }
  };

  const getColorClass = () => {
    const colorMap = {
      blue: 'stat-card-blue',
      green: 'stat-card-green',
      orange: 'stat-card-orange',
      purple: 'stat-card-purple',
      red: 'stat-card-red',
      yellow: 'stat-card-yellow',
      critical: 'stat-card-red',
      disabled: 'stat-card-disabled'
    };
    return colorMap[color] || 'stat-card-blue';
  };

  const isDisabled = color === 'disabled';

  return (
    <div className={`stat-card ${getColorClass()} ${isDisabled ? 'disabled' : ''}`}>
      <div className="stat-card-header">
        <div className="stat-card-icon">
          {icon}
        </div>
        {!isDisabled && (
          <div className="stat-card-trend">
            {getTrendIcon()}
          </div>
        )}
      </div>
      <div className="stat-card-content">
        <h3 className="stat-card-title">{title}</h3>
        <div className={`stat-card-value ${isDisabled ? 'disabled' : ''}`}>{value}</div>
      </div>
    </div>
  );
};

export default StatCard;
