import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { computeEfficiencyScore } from '../utils/efficiencyScore';

const EnergyContext = createContext();

/** Shared stats merge — module scope so callbacks stay stable. */
function normalizeDashboardStats(stats = {}, sensors = []) {
  const validTemps = sensors
    .map((s) => Number(s?.temperature))
    .filter((t) => Number.isFinite(t));
  const sensorAvgTemp = validTemps.length
    ? validTemps.reduce((sum, t) => sum + t, 0) / validTemps.length
    : 0;
  const sensorAnomalyCount = sensors.filter((s) => s?.is_anomaly === true).length;
  const sensorCurrents = sensors.map((s) => Number(s?.current)).filter((v) => Number.isFinite(v));
  const sensorTotalPower = sensorCurrents.reduce((sum, v) => sum + v, 0);
  const sensorAvgPower = sensorCurrents.length ? sensorTotalPower / sensorCurrents.length : 0;

  const sensorCriticalCount = sensors.filter((s) => s?.status === 'critical').length;
  const sensorWarningCount = sensors.filter((s) => s?.status === 'warning').length;
  const abnormalByStatus = sensorCriticalCount + sensorWarningCount;
  const rawAnomaly = Number(stats.anomaly_count ?? stats.total_anomalies ?? sensorAnomalyCount);
  const normalizedAnomaly =
    abnormalByStatus > 0 ? Math.min(rawAnomaly, abnormalByStatus) : Math.max(0, rawAnomaly);

  return {
    ...stats,
    total_energy: stats.total_energy ?? stats.total_energy_consumption ?? 0,
    total_sensors: stats.total_sensors ?? sensors.length ?? 0,
    critical_sensors: Math.max(
      Number(stats.critical_sensors ?? 0),
      Number(stats.status_critical ?? 0),
      sensorCriticalCount
    ),
    warning_sensors: Math.max(
      Number(stats.warning_sensors ?? 0),
      Number(stats.status_warning ?? 0),
      sensorWarningCount
    ),
    avg_temperature: stats.avg_temperature ?? stats.average_temperature ?? sensorAvgTemp,
    anomaly_count: normalizedAnomaly,
    total_power: stats.total_power ?? stats.avg_power ?? sensorTotalPower,
    avg_power: stats.avg_power ?? sensorAvgPower,
    efficiency_score: computeEfficiencyScore(stats, sensors),
  };
}

export const useEnergy = () => {
  const context = useContext(EnergyContext);
  if (!context) {
    throw new Error('useEnergy must be used within an EnergyProvider');
  }
  return context;
};

export const EnergyProvider = ({ children }) => {
  const [realTimeData, setRealTimeData] = useState({
    stats: {},
    sensors: [],
    alerts: []
  });
  const [optimizationSuggestions, setOptimizationSuggestions] = useState([]);
  const [historicalData, setHistoricalData] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  // WebSocket connection
  const connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:8000/ws`;
    
    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setLoading(false);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'initial_data':
          case 'stats_update':
            setRealTimeData(prev => ({
              ...prev,
              stats: normalizeDashboardStats(data.data, prev.sensors)
            }));
            break;
          
          case 'critical_alert':
            setRealTimeData(prev => ({
              ...prev,
              alerts: data.data.sensors
            }));
            break;
          
          default:
            console.log('Unknown message type:', data.type);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        // Attempt reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };

      return ws;
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setIsConnected(false);
      setLoading(false);
    }
  };

  // Fetch initial data
  const fetchInitialData = async () => {
    try {
      const [sensorsResponse, suggestionsResponse, historyResponse] = await Promise.all([
        axios.get('/api/sensors?limit=50'),
        axios.get('/api/optimization/suggestions'),
        axios.get('/api/analytics/history?hours=24')
      ]);

      setRealTimeData(prev => ({
        ...prev,
        sensors: sensorsResponse.data.sensors
      }));

      setOptimizationSuggestions(suggestionsResponse.data.suggestions);
      setHistoricalData(historyResponse.data.history);
    } catch (error) {
      console.error('Error fetching initial data:', error);
    }
  };

  // Fetch sensors data
  const fetchSensors = async (limit = 100, offset = 0) => {
    try {
      const response = await axios.get(`/api/sensors?limit=${limit}&offset=${offset}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching sensors:', error);
      return { sensors: [], pagination: { total: 0 } };
    }
  };

  // Fetch optimization suggestions
  const fetchOptimizationSuggestions = useCallback(async () => {
    try {
      const response = await axios.get('/api/optimization/suggestions');
      setOptimizationSuggestions(response.data.suggestions);
      return response.data.suggestions;
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      // Provide mock data when API fails
      const mockSuggestions = [
        {
          sensor_id: 'SENSOR_001',
          device_type: 'Motor',
          location: 'floor_a',
          title: 'Schedule Off-Peak Operation',
          description: 'Shift motor operation to off-peak hours (8 PM - 6 AM) to reduce electricity costs by 25%',
          priority: 'high',
          action: 'schedule_shift',
          potential_savings: 15.50,
          risk_score: 0.1,
          timestamp: new Date().toISOString()
        },
        {
          sensor_id: 'SENSOR_002',
          device_type: 'Compressor',
          location: 'warehouse',
          title: 'Maintenance Required',
          description: 'Compressor showing early signs of wear. Schedule preventive maintenance within 2 weeks.',
          priority: 'critical',
          action: 'schedule_maintenance',
          potential_savings: 8.75,
          risk_score: 0.8,
          timestamp: new Date().toISOString()
        },
        {
          sensor_id: 'SENSOR_003',
          device_type: 'Conveyor',
          location: 'assembly_line',
          title: 'Efficiency Audit',
          description: 'Conveyor system is 15% less efficient than optimal. Investigate equipment calibration.',
          priority: 'medium',
          action: 'efficiency_audit',
          potential_savings: 12.30,
          risk_score: 0.3,
          timestamp: new Date().toISOString()
        },
        {
          sensor_id: 'SENSOR_004',
          device_type: 'Heater',
          location: 'quality_control',
          title: 'Temperature Optimization',
          description: 'Reduce heater temperature by 5°C during non-production hours to save energy.',
          priority: 'low',
          action: 'schedule_shift',
          potential_savings: 6.20,
          risk_score: 0.1,
          timestamp: new Date().toISOString()
        }
      ];
      setOptimizationSuggestions(mockSuggestions);
      return mockSuggestions;
    }
  }, []);

  // Fetch historical data
  const fetchHistoricalData = async (hours = 24) => {
    try {
      const response = await axios.get(`/api/analytics/history?hours=${hours}`);
      setHistoricalData(response.data.history);
      return response.data.history;
    } catch (error) {
      console.error('Error fetching historical data:', error);
      return [];
    }
  };

  // Control device (simulated)
  const controlDevice = async (sensorId, action) => {
    try {
      // Simulate API call
      console.log(`Controlling device ${sensorId}: ${action}`);
      
      // In a real implementation, this would call the backend API
      return { success: true, message: `Device ${sensorId} ${action} successfully` };
    } catch (error) {
      console.error('Error controlling device:', error);
      return { success: false, message: 'Failed to control device' };
    }
  };

  /** Full sync: dashboard stats + fleet + optimizer (for Refresh / Auto-Optimize). */
  const refreshOptimizationInsights = useCallback(async () => {
    try {
      const [statsRes, sensorsRes, suggestionsRes] = await Promise.all([
        axios.get('/api/dashboard/stats'),
        axios.get('/api/sensors?limit=500'),
        axios.get('/api/optimization/suggestions'),
      ]);
      const sensors = sensorsRes.data?.sensors || [];
      setRealTimeData((prev) => ({
        ...prev,
        sensors,
        stats: normalizeDashboardStats({ ...statsRes.data }, sensors),
      }));
      const list = suggestionsRes.data?.suggestions || [];
      setOptimizationSuggestions(list);
      return {
        ok: true,
        generatedAt: suggestionsRes.data?.generated_at ?? null,
        totalGenerated: suggestionsRes.data?.total_generated ?? list.length,
      };
    } catch (e) {
      console.error('refreshOptimizationInsights failed', e);
      return { ok: false, error: e?.message || 'unknown' };
    }
  }, []);

  useEffect(() => {
    const ws = connectWebSocket();
    fetchInitialData();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  // Keep stats, sensors, and optimization suggestions aligned with Redis even if WebSocket
  // payloads are sparse or the page loaded before data existed.
  useEffect(() => {
    const syncFromApi = async () => {
      try {
        const [statsRes, sensorsRes, suggestionsRes] = await Promise.all([
          axios.get('/api/dashboard/stats'),
          axios.get('/api/sensors?limit=500'),
          axios.get('/api/optimization/suggestions'),
        ]);
        setRealTimeData((prev) => ({
          ...prev,
          sensors: sensorsRes.data.sensors || prev.sensors,
          stats: normalizeDashboardStats({ ...prev.stats, ...statsRes.data }, sensorsRes.data.sensors || prev.sensors),
        }));
        if (suggestionsRes.data?.suggestions) {
          setOptimizationSuggestions(suggestionsRes.data.suggestions);
        }
      } catch (e) {
        console.error('API sync failed:', e);
      }
    };

    syncFromApi();
    const id = setInterval(syncFromApi, 8000);
    return () => clearInterval(id);
  }, []);

  const value = {
    realTimeData,
    optimizationSuggestions,
    historicalData,
    isConnected,
    loading,
    fetchSensors,
    fetchOptimizationSuggestions,
    refreshOptimizationInsights,
    fetchHistoricalData,
    controlDevice,
    connectWebSocket
  };

  return (
    <EnergyContext.Provider value={value}>
      {children}
    </EnergyContext.Provider>
  );
};