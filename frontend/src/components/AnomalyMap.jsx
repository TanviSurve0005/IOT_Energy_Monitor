import React from 'react';
import { MapPin, AlertTriangle, CheckCircle } from 'lucide-react';

const AnomalyMap = ({ sensors = [] }) => {
  // Simulate factory floor layout
  const factoryLayout = [
    { id: 'floor_a', name: 'Production Line A', x: 20, y: 30, width: 200, height: 100 },
    { id: 'floor_b', name: 'Production Line B', x: 240, y: 30, width: 200, height: 100 },
    { id: 'assembly_line', name: 'Assembly', x: 20, y: 150, width: 150, height: 120 },
    { id: 'warehouse', name: 'Warehouse', x: 190, y: 150, width: 250, height: 120 },
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
      <div className="map-container" style={{ position: 'relative', height: '400px', background: '#1e293b' }}>
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
              background: `${getAreaColor(area)}20`,
              borderRadius: '8px',
              padding: '8px',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
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
              <MapPin size={12} />
              <span style={{ fontSize: '10px', fontWeight: 'bold' }}>{area.name}</span>
            </div>
            
            <div className="area-stats" style={{ fontSize: '9px', lineHeight: '1.2' }}>
              <div>Sensors: {area.total}</div>
              <div style={{ color: area.critical > 0 ? '#ef4444' : area.warning > 0 ? '#f59e0b' : '#10b981' }}>
                Status: {getAreaStatus(area)}
              </div>
              {area.critical > 0 && <div>Critical: {area.critical}</div>}
              {area.warning > 0 && <div>Warning: {area.warning}</div>}
            </div>

            {/* Sensor dots */}
            <div style={{ position: 'absolute', bottom: '4px', right: '4px', display: 'flex', gap: '2px' }}>
              {area.sensors.slice(0, 10).map(sensor => (
                <div
                  key={sensor.sensor_id}
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: sensor.status === 'critical' ? '#ef4444' : 
                               sensor.status === 'warning' ? '#f59e0b' : '#10b981'
                  }}
                  title={`${sensor.sensor_id} - ${sensor.status}`}
                />
              ))}
              {area.sensors.length > 10 && (
                <div style={{ fontSize: '8px', color: '#94a3b8' }}>+{area.sensors.length - 10}</div>
              )}
            </div>
          </div>
        ))}

        {/* Legend */}
        <div style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          background: 'rgba(30, 41, 59, 0.9)',
          padding: '8px 12px',
          borderRadius: '6px',
          border: '1px solid #334155'
        }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Legend</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%' }}></div>
              <span>Normal</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '8px', height: '8px', background: '#f59e0b', borderRadius: '50%' }}></div>
              <span>Warning</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '8px', height: '8px', background: '#ef4444', borderRadius: '50%' }}></div>
              <span>Critical</span>
            </div>
          </div>
        </div>

        {/* Status summary */}
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'rgba(30, 41, 59, 0.9)',
          padding: '12px',
          borderRadius: '6px',
          border: '1px solid #334155',
          minWidth: '120px'
        }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>Factory Status</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Total Areas:</span>
              <span>{factoryLayout.length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981' }}>
              <span>Normal:</span>
              <span>{areaStats.filter(a => a.critical === 0 && a.warning === 0).length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f59e0b' }}>
              <span>Warning:</span>
              <span>{areaStats.filter(a => a.warning > 0 && a.critical === 0).length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
              <span>Critical:</span>
              <span>{areaStats.filter(a => a.critical > 0).length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnomalyMap;