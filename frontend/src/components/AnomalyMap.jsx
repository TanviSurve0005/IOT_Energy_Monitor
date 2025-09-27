import React from 'react';
import { MapPin, AlertTriangle, CheckCircle } from 'lucide-react';

const AnomalyMap = ({ sensors = [] }) => {
  // Organized factory floor layout with proper grid structure - full width
  const factoryLayout = [
    // Row 1: Production Lines
    { id: 'floor_a', name: 'Production Line A', x: 20, y: 20, width: 180, height: 70, row: 1, col: 1 },
    { id: 'floor_b', name: 'Production Line B', x: 220, y: 20, width: 180, height: 70, row: 1, col: 2 },
    { id: 'assembly_line', name: 'Assembly', x: 420, y: 20, width: 180, height: 70, row: 1, col: 3 },
    
    // Row 2: Storage and Processing
    { id: 'warehouse', name: 'Warehouse', x: 20, y: 110, width: 200, height: 70, row: 2, col: 1 },
    { id: 'quality_control', name: 'Quality Control', x: 240, y: 110, width: 180, height: 70, row: 2, col: 2 },
    { id: 'packaging', name: 'Packaging', x: 440, y: 110, width: 160, height: 70, row: 2, col: 3 },
    
    // Row 3: Final Processing
    { id: 'shipping', name: 'Shipping', x: 20, y: 200, width: 180, height: 60, row: 3, col: 1 },
    { id: 'maintenance', name: 'Maintenance', x: 220, y: 200, width: 180, height: 60, row: 3, col: 2 },
    { id: 'office', name: 'Control Office', x: 420, y: 200, width: 180, height: 60, row: 3, col: 3 },
  ];

  // Count sensors per area
  const areaStats = factoryLayout.map(area => {
    const areaSensors = sensors.filter(s => s.location === area.id);
    const critical = areaSensors.filter(s => s.status === 'critical').length;
    const warning = areaSensors.filter(s => s.status === 'warning').length;
    const normal = areaSensors.filter(s => s.status === 'normal').length;

    return {
      ...area,
      sensors: areaSensors,
      critical,
      warning,
      normal,
      total: areaSensors.length
    };
  });

  const getAreaColor = (area) => {
    if (area.critical > 0) return '#ef4444';
    if (area.warning > 0) return '#f59e0b';
    return '#10b981';
  };

  const getAreaStatus = (area) => {
    if (area.critical > 0) return 'Critical';
    if (area.warning > 0) return 'Warning';
    return 'Normal';
  };

  return (
    <div className="anomaly-map">
      <div className="map-container" style={{ 
        position: 'relative', 
        height: '100%', 
        background: 'var(--bg-secondary)', 
        width: '100%', 
        overflow: 'hidden', 
        borderRadius: '0.5rem',
        border: '1px solid var(--border-color)',
        boxShadow: '0 4px 12px var(--shadow)',
        flex: 1
      }}>
        {/* Grid background for better organization */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `
            linear-gradient(to right, var(--border-color) 1px, transparent 1px),
            linear-gradient(to bottom, var(--border-color) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          opacity: 0.3,
          pointerEvents: 'none'
        }} />
        
        {/* Factory layout visualization */}
        {areaStats.map(area => (
          <div
            key={area.id}
            className="factory-area"
            style={{
              position: 'absolute',
              left: area.x,
              top: area.y,
              width: area.width,
              height: area.height,
              border: `2px solid ${getAreaColor(area)}`,
              background: `${getAreaColor(area)}15`,
              borderRadius: '8px',
              padding: '8px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: `0 2px 8px ${getAreaColor(area)}30`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.02)';
              e.currentTarget.style.zIndex = '10';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.zIndex = '1';
            }}
          >
            <div className="area-header" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
              <MapPin size={10} />
              <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-primary)', flex: 1 }}>{area.name}</span>
            </div>
            
            <div className="area-stats" style={{ fontSize: '8px', lineHeight: '1.2', flex: 1 }}>
              <div style={{ color: 'var(--text-secondary)', marginBottom: '2px' }}>Sensors: {area.total}</div>
              <div style={{ 
                color: area.critical > 0 ? '#ef4444' : area.warning > 0 ? '#f59e0b' : '#10b981', 
                fontWeight: 'bold',
                fontSize: '9px',
                marginBottom: '2px'
              }}>
                {getAreaStatus(area)}
              </div>
              {area.critical > 0 && <div style={{ color: '#ef4444', fontSize: '7px' }}>Critical: {area.critical}</div>}
              {area.warning > 0 && <div style={{ color: '#f59e0b', fontSize: '7px' }}>Warning: {area.warning}</div>}
            </div>

            {/* Sensor dots indicator */}
            <div style={{ 
              position: 'absolute', 
              bottom: '4px', 
              right: '4px', 
              display: 'flex', 
              gap: '2px', 
              flexWrap: 'wrap', 
              maxWidth: '60%',
              justifyContent: 'flex-end'
            }}>
              {area.sensors.slice(0, 8).map(sensor => (
                <div
                  key={sensor.sensor_id}
                  style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    background: sensor.status === 'critical' ? '#ef4444' : 
                               sensor.status === 'warning' ? '#f59e0b' : '#10b981',
                    border: '1px solid rgba(255,255,255,0.3)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                  }}
                  title={`${sensor.sensor_id} - ${sensor.status}`}
                />
              ))}
              {area.sensors.length > 8 && (
                <div style={{ 
                  fontSize: '6px', 
                  color: 'var(--text-muted)', 
                  marginLeft: '2px',
                  background: 'var(--bg-tertiary)',
                  padding: '1px 3px',
                  borderRadius: '3px',
                  border: '1px solid var(--border-color)'
                }}>+{area.sensors.length - 8}</div>
              )}
            </div>
          </div>
        ))}

      </div>
    </div>
  );
};

export default AnomalyMap;