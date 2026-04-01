import React, { useState, useEffect } from 'react';
import { useEnergy } from '../context/EnergyContext';
import { Search, Filter, Zap, Thermometer, Gauge, MapPin } from 'lucide-react';

const SensorCard = ({ sensor, onControl, actionState }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'critical': return '#ef4444';
      case 'warning': return '#f59e0b';
      default: return '#10b981';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'critical': return '🔴';
      case 'warning': return '🟡';
      default: return '🟢';
    }
  };

  const isBusy = actionState?.loading === true;
  const statusMessage = actionState?.message || '';
  const statusType = actionState?.success === false ? 'error' : 'success';

  return (
    <div className={`sensor-card ${sensor.status}`}>
      <div className="sensor-header">
        <div className="sensor-info">
          <div className="sensor-id">{sensor.sensor_id}</div>
          <div className="sensor-type">{sensor.device_type}</div>
        </div>
        <div className={`sensor-status ${sensor.status}`}>
          <span>{getStatusIcon(sensor.status)} {sensor.status.toUpperCase()}</span>
        </div>
      </div>

      <div className="sensor-location">
        <MapPin size={12} />
        <span>{sensor.location}</span>
      </div>

      <div className="sensor-metrics">
        <div className="metric">
          <div className="metric-label">
            <Zap size={12} />
            <span>Current</span>
          </div>
          <div className="metric-value">{sensor.current}A</div>
        </div>
        
        <div className="metric">
          <div className="metric-label">
            <Thermometer size={12} />
            <span>Temperature</span>
          </div>
          <div className="metric-value">{sensor.temperature}°C</div>
        </div>
        
        <div className="metric">
          <div className="metric-label">
            <Gauge size={12} />
            <span>Pressure</span>
          </div>
          <div className="metric-value">{sensor.pressure}bar</div>
        </div>
        
        <div className="metric">
          <div className="metric-label">Energy</div>
          <div className="metric-value">{sensor.energy_consumption}kWh</div>
        </div>
      </div>

      <div className="sensor-analytics">
        <div className="analytics-item">
          <span>Failure Risk:</span>
          <span className={`risk-${sensor.failure_probability > 0.7 ? 'high' : sensor.failure_probability > 0.3 ? 'medium' : 'low'}`}>
            {(sensor.failure_probability * 100).toFixed(1)}%
          </span>
        </div>
        <div className="analytics-item">
          <span>Anomaly Score:</span>
          <span>{sensor.anomaly_score?.toFixed(3) || '0.000'}</span>
        </div>
      </div>

      <div className="sensor-actions">
        <button 
          className="btn-secondary"
          onClick={() => onControl(sensor.sensor_id, 'restart')}
          disabled={isBusy}
        >
          {isBusy && actionState?.action === 'restart' ? 'Restarting...' : 'Restart'}
        </button>
        <button 
          className="btn-primary"
          onClick={() => onControl(sensor.sensor_id, 'shutdown')}
          disabled={isBusy}
        >
          {isBusy && actionState?.action === 'shutdown' ? 'Shutting down...' : 'Shutdown'}
        </button>
      </div>

      {statusMessage && (
        <div
          style={{
            marginTop: '0.5rem',
            padding: '0.45rem 0.6rem',
            borderRadius: '0.45rem',
            fontSize: '0.75rem',
            color: statusType === 'error' ? '#fecaca' : '#bbf7d0',
            background: statusType === 'error' ? 'rgba(127, 29, 29, 0.45)' : 'rgba(6, 78, 59, 0.45)',
            border: statusType === 'error' ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(16,185,129,0.5)',
          }}
        >
          {statusMessage}
        </div>
      )}

      <div className="sensor-timestamp">
        Last update: {new Date(sensor.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
};

const SensorGrid = () => {
  const { realTimeData, fetchSensors, controlDevice } = useEnergy();
  const [filteredSensors, setFilteredSensors] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [actionStates, setActionStates] = useState({});
  const [confirmState, setConfirmState] = useState({ open: false, sensorId: '' });
  const sensorsPerPage = 12;

  useEffect(() => {
    fetchSensors(100, 0);
  }, []);

  useEffect(() => {
    let filtered = realTimeData.sensors || [];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(sensor =>
        sensor.sensor_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sensor.device_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sensor.location.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(sensor => sensor.status === statusFilter);
    }

    // Apply location filter
    if (locationFilter !== 'all') {
      filtered = filtered.filter(sensor => sensor.location === locationFilter);
    }

    setFilteredSensors(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [realTimeData.sensors, searchTerm, statusFilter, locationFilter]);

  const executeControl = async (sensorId, action) => {
    setActionStates(prev => ({
      ...prev,
      [sensorId]: {
        loading: true,
        action,
        success: undefined,
        message: '',
      },
    }));

    try {
      const result = await controlDevice(sensorId, action);
      setActionStates(prev => ({
        ...prev,
        [sensorId]: {
          loading: false,
          action,
          success: !!result?.success,
          message: result?.message || `${action} command sent.`,
        },
      }));

      setTimeout(() => {
        setActionStates(prev => {
          const next = { ...prev };
          delete next[sensorId];
          return next;
        });
      }, 2500);
    } catch (error) {
      setActionStates(prev => ({
        ...prev,
        [sensorId]: {
          loading: false,
          action,
          success: false,
          message: `Failed to ${action} ${sensorId}.`,
        },
      }));
    }
  };

  const handleControl = async (sensorId, action) => {
    if (action === 'shutdown') {
      setConfirmState({ open: true, sensorId });
      return;
    }
    await executeControl(sensorId, action);
  };

  // Pagination
  const totalPages = Math.ceil(filteredSensors.length / sensorsPerPage);
  const startIndex = (currentPage - 1) * sensorsPerPage;
  const currentSensors = filteredSensors.slice(startIndex, startIndex + sensorsPerPage);

  // Get unique locations for filter
  const locations = [...new Set((realTimeData.sensors || []).map(s => s.location))];

  return (
    <div className="sensor-grid-page">
      <div className="page-header">
        <h1>Sensor Management</h1>
        <p>Monitor and control all IoT sensors in the factory</p>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search sensors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="normal">Normal</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>

          <select 
            value={locationFilter} 
            onChange={(e) => setLocationFilter(e.target.value)}
          >
            <option value="all">All Locations</option>
            {locations.map(location => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid-stats">
        <div className="stat">
          <span>Total Sensors:</span>
          <strong>{filteredSensors.length}</strong>
        </div>
        <div className="stat">
          <span>Normal:</span>
          <strong style={{color: '#10b981'}}>
            {filteredSensors.filter(s => s.status === 'normal').length}
          </strong>
        </div>
        <div className="stat">
          <span>Warning:</span>
          <strong style={{color: '#f59e0b'}}>
            {filteredSensors.filter(s => s.status === 'warning').length}
          </strong>
        </div>
        <div className="stat">
          <span>Critical:</span>
          <strong style={{color: '#ef4444'}}>
            {filteredSensors.filter(s => s.status === 'critical').length}
          </strong>
        </div>
      </div>

      {/* Sensor Grid */}
      <div className="sensors-grid">
        {currentSensors.map(sensor => (
          <SensorCard 
            key={sensor.sensor_id} 
            sensor={sensor} 
            onControl={handleControl}
            actionState={actionStates[sensor.sensor_id]}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            Previous
          </button>
          
          <span>Page {currentPage} of {totalPages}</span>
          
          <button 
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Next
          </button>
        </div>
      )}

      {filteredSensors.length === 0 && (
        <div className="no-sensors">
          <Zap size={48} />
          <h3>No sensors found</h3>
          <p>Try adjusting your search or filters</p>
        </div>
      )}

      {confirmState.open && (
        <div className="sensor-modal-overlay">
          <div className="sensor-modal">
            <h3>Confirm Shutdown</h3>
            <p>
              Are you sure you want to shutdown <strong>{confirmState.sensorId}</strong>?
            </p>
            <div className="sensor-modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setConfirmState({ open: false, sensorId: '' })}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={async () => {
                  const id = confirmState.sensorId;
                  setConfirmState({ open: false, sensorId: '' });
                  await executeControl(id, 'shutdown');
                }}
              >
                Confirm Shutdown
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SensorGrid;