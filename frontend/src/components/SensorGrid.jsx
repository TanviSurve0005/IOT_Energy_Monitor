import React, { useState, useEffect } from 'react';
import { useEnergy } from '../context/EnergyContext';
import { Search, Filter, Zap, Thermometer, Gauge, MapPin } from 'lucide-react';

const SensorCard = ({ sensor, onControl }) => {
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
        >
          Restart
        </button>
        <button 
          className="btn-primary"
          onClick={() => onControl(sensor.sensor_id, 'shutdown')}
        >
          Shutdown
        </button>
      </div>

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

  const handleControl = async (sensorId, action) => {
    const result = await controlDevice(sensorId, action);
    // Show notification (you could add a toast system here)
    console.log(result.message);
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
    </div>
  );
};

export default SensorGrid;