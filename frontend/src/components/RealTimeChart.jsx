import React, { useEffect, useRef } from 'react';
import { useEnergy } from '../context/EnergyContext';

const RealTimeChart = () => {
  const { realTimeData } = useEnergy();
  const canvasRef = useRef(null);
  const dataHistory = useRef([]);
  const maxDataPoints = 50;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Add new data point
    if (realTimeData.stats.total_energy) {
      dataHistory.current.push({
        energy: realTimeData.stats.total_energy,
        timestamp: new Date().getTime()
      });
      
      // Keep only the last maxDataPoints
      if (dataHistory.current.length > maxDataPoints) {
        dataHistory.current = dataHistory.current.slice(-maxDataPoints);
      }
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (dataHistory.current.length < 2) return;

    // Chart dimensions
    const padding = 40;
    const chartWidth = canvas.width - padding * 2;
    const chartHeight = canvas.height - padding * 2;

    // Find data range
    const energies = dataHistory.current.map(d => d.energy);
    const minEnergy = Math.min(...energies);
    const maxEnergy = Math.max(...energies);
    const energyRange = maxEnergy - minEnergy || 1;

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
      
      // Y-axis labels
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px monospace';
      const value = maxEnergy - (energyRange / 4) * i;
      ctx.fillText(value.toFixed(0), 5, y + 4);
    }

    ctx.setLineDash([]);

    // Draw energy line
    ctx.beginPath();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';

    dataHistory.current.forEach((point, index) => {
      const x = padding + (chartWidth / (dataHistory.current.length - 1)) * index;
      const y = padding + chartHeight - ((point.energy - minEnergy) / energyRange) * chartHeight;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw gradient area under line
    const gradient = ctx.createLinearGradient(0, padding, 0, canvas.height - padding);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.05)');

    ctx.fillStyle = gradient;
    ctx.beginPath();

    // Start from bottom left
    ctx.moveTo(padding, canvas.height - padding);
    
    // Draw the line
    dataHistory.current.forEach((point, index) => {
      const x = padding + (chartWidth / (dataHistory.current.length - 1)) * index;
      const y = padding + chartHeight - ((point.energy - minEnergy) / energyRange) * chartHeight;
      ctx.lineTo(x, y);
    });

    // End at bottom right
    ctx.lineTo(canvas.width - padding, canvas.height - padding);
    ctx.closePath();
    ctx.fill();

    // Draw current value indicator
    if (dataHistory.current.length > 0) {
      const lastPoint = dataHistory.current[dataHistory.current.length - 1];
      const x = canvas.width - padding;
      const y = padding + chartHeight - ((lastPoint.energy - minEnergy) / energyRange) * chartHeight;

      // Dot
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);
      ctx.fill();

      // White border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, 2 * Math.PI);
      ctx.stroke();

      // Value text
      ctx.fillStyle = '#3b82f6';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${lastPoint.energy.toFixed(1)} kWh`, x - 10, y - 10);
    }

    // X-axis label
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Time →', canvas.width / 2, canvas.height - 10);

  }, [realTimeData.stats]);

  return (
    <div className="realtime-chart">
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={300}
        style={{ width: '100%', height: '100%', flex: 1 }}
      />
    </div>
  );
};

export default RealTimeChart;