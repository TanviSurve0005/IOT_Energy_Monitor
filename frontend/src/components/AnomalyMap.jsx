import React from 'react';
import { MapPin } from 'lucide-react';

const AnomalyMap = ({ sensors = [] }) => {
  const factoryLayout = [
    { id: 'floor_a', name: 'Production Line A' },
    { id: 'floor_b', name: 'Production Line B' },
    { id: 'assembly_line', name: 'Assembly' },
    { id: 'warehouse', name: 'Warehouse' },
    { id: 'quality_control', name: 'Quality Control' },
    { id: 'packaging', name: 'Packaging' },
    { id: 'shipping', name: 'Shipping' },
    { id: 'maintenance', name: 'Maintenance' },
    { id: 'office', name: 'Control Office' }
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

  const getAreaState = (area) => {
    if (area.critical > 0) return 'critical';
    if (area.warning > 0) return 'warning';
    return 'normal';
  };

  const getAreaStatus = (area) => {
    if (area.critical > 0) return 'Critical';
    if (area.warning > 0) return 'Warning';
    return 'Normal';
  };

  const getHealthPercent = (area) => {
    if (!area.total) return 100;
    const score = ((area.normal + area.warning * 0.55) / area.total) * 100;
    return Math.max(0, Math.min(100, Math.round(score)));
  };

  const totalSensors = areaStats.reduce((sum, a) => sum + a.total, 0);
  const totalCritical = areaStats.reduce((sum, a) => sum + a.critical, 0);
  const totalWarning = areaStats.reduce((sum, a) => sum + a.warning, 0);
  const totalNormal = areaStats.reduce((sum, a) => sum + a.normal, 0);
  const overallHealth = totalSensors
    ? Math.round(((totalNormal + totalWarning * 0.55) / totalSensors) * 100)
    : 100;

  return (
    <div className="anomaly-map">
      <div className="factory-overview-shell">
        <div className="factory-overview-top">
          <div className="factory-kpi">
            <span className="label">Overall Health</span>
            <span className="value">{overallHealth}%</span>
          </div>
          <div className="factory-kpi">
            <span className="label">Total Sensors</span>
            <span className="value">{totalSensors}</span>
          </div>
          <div className="factory-kpi critical">
            <span className="label">Critical</span>
            <span className="value">{totalCritical}</span>
          </div>
          <div className="factory-kpi warning">
            <span className="label">Warning</span>
            <span className="value">{totalWarning}</span>
          </div>
        </div>

        <div className="factory-zone-list">
          {areaStats.map((area) => {
            const state = getAreaState(area);
            const health = getHealthPercent(area);
            const criticalPct = area.total ? (area.critical / area.total) * 100 : 0;
            const warningPct = area.total ? (area.warning / area.total) * 100 : 0;
            const normalPct = area.total ? (area.normal / area.total) * 100 : 100;

            return (
              <div key={area.id} className={`factory-zone-row ${state}`}>
                <div className="zone-main">
                  <div className="zone-title">
                    <MapPin size={12} />
                    <span>{area.name}</span>
                  </div>
                  <div className="zone-sub">
                    <span>{area.total} sensors</span>
                    <span className={`zone-status ${state}`}>{getAreaStatus(area)}</span>
                  </div>
                </div>

                <div className="zone-health-bar" title={`${health}% healthy`}>
                  <span className="seg critical" style={{ width: `${criticalPct}%` }} />
                  <span className="seg warning" style={{ width: `${warningPct}%` }} />
                  <span className="seg normal" style={{ width: `${normalPct}%` }} />
                </div>

                <div className="zone-metrics">
                  <span className="critical">C {area.critical}</span>
                  <span className="warning">W {area.warning}</span>
                  <span className="normal">N {area.normal}</span>
                  <span className="health">{health}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AnomalyMap;