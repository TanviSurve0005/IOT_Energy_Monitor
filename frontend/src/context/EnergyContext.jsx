import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

const EnergyContext = createContext();

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
    alerts: [],
    anomalies: []
  });
  const [optimizationSuggestions, setOptimizationSuggestions] = useState([]);
  const [historicalData, setHistoricalData] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [consumerHost, setConsumerHost] = useState('');
  const [producerHost, setProducerHost] = useState('');
  const [kafkaStatus, setKafkaStatus] = useState('disconnected');

  // API base URL - points to consumer laptop's API
  const API_BASE_URL = `http://${window.location.hostname}:8000`;

  // Socket.io connection for real-time updates
  const connectWebSocket = () => {
    try {
      const socket = io(API_BASE_URL, {
        transports: ['websocket', 'polling'],
        timeout: 10000
      });

      socket.on('connect', () => {
        console.log('✅ Connected to consumer API via WebSocket');
        setIsConnected(true);
        setKafkaStatus('connected');
        setLoading(false);
      });

      socket.on('stats_update', (data) => {
        setRealTimeData(prev => ({
          ...prev,
          stats: data.data
        }));
      });

      socket.on('sensor_update', (data) => {
        const sensorData = data.data;
        
        // Update sensors list
        setRealTimeData(prev => {
          const filteredSensors = prev.sensors.filter(s => s.sensor_id !== sensorData.sensor_id);
          const updatedSensors = [...filteredSensors, sensorData].slice(-100); // Keep last 100 readings
          
          // Update alerts if anomaly detected
          let updatedAlerts = prev.alerts;
          let updatedAnomalies = prev.anomalies;
          
          if (sensorData.is_anomaly) {
            updatedAnomalies = [sensorData, ...prev.anomalies].slice(-20);
          }
          
          if (sensorData.status === 'critical') {
            updatedAlerts = [sensorData, ...prev.alerts.filter(a => a.sensor_id !== sensorData.sensor_id)].slice(-10);
          }

          return {
            ...prev,
            sensors: updatedSensors,
            alerts: updatedAlerts,
            anomalies: updatedAnomalies
          };
        });
      });

      socket.on('disconnect', (reason) => {
        console.log('❌ Disconnected from consumer API:', reason);
        setIsConnected(false);
        setKafkaStatus('disconnected');
        
        // Attempt reconnect after 5 seconds
        setTimeout(() => {
          console.log('🔄 Attempting to reconnect...');
          connectWebSocket();
        }, 5000);
      });

      socket.on('connect_error', (error) => {
        console.error('❌ Connection error:', error);
        setIsConnected(false);
        setKafkaStatus('error');
        setLoading(false);
      });

      socket.on('kafka_status', (status) => {
        setKafkaStatus(status);
      });

      return socket;
    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      setIsConnected(false);
      setLoading(false);
      return null;
    }
  };

  // Fetch initial data from consumer API
  const fetchInitialData = async () => {
    try {
      setLoading(true);
      
      const [statsResponse, sensorsResponse, healthResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/dashboard/stats`),
        axios.get(`${API_BASE_URL}/api/sensors`),
        axios.get(`${API_BASE_URL}/health`)
      ]);

      setRealTimeData(prev => ({
        ...prev,
        stats: statsResponse.data,
        sensors: sensorsResponse.data.sensors || []
      }));

      setConsumerHost(healthResponse.data.consumer_host || 'Unknown');
      setProducerHost(sensorsResponse.data.sensors[0]?.producer_host || 'Unknown');

      console.log('✅ Initial data loaded successfully');
    } catch (error) {
      console.error('❌ Error fetching initial data:', error);
      
      // Fallback to mock data if API is unavailable
      if (error.code === 'NETWORK_ERROR' || error.response?.status >= 500) {
        console.log('🔄 Using mock data as fallback');
        setRealTimeData(prev => ({
          ...prev,
          stats: {
            total_energy_consumption: 0,
            total_readings: 0,
            anomaly_count: 0,
            average_consumption: 0,
            status_normal: 0,
            status_warning: 0,
            status_critical: 0
          },
          sensors: []
        }));
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch sensors data with pagination
  const fetchSensors = async (limit = 100, offset = 0) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/sensors?limit=${limit}&offset=${offset}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching sensors:', error);
      return { sensors: [], count: 0 };
    }
  };

  // Fetch optimization suggestions (simulated - would come from ML service)
  const fetchOptimizationSuggestions = async () => {
    try {
      // Simulate API call to ML optimization service
      const mockSuggestions = generateMockSuggestions(realTimeData.sensors);
      setOptimizationSuggestions(mockSuggestions);
      return mockSuggestions;
    } catch (error) {
      console.error('Error fetching optimization suggestions:', error);
      return [];
    }
  };

  // Generate mock optimization suggestions based on sensor data
  const generateMockSuggestions = (sensors) => {
    if (!sensors || sensors.length === 0) return [];

    const suggestions = [];

    // Analyze sensor data for optimization opportunities
    sensors.forEach(sensor => {
      if (sensor.energy_consumption > 10) {
        suggestions.push({
          id: `opt-${sensor.sensor_id}-1`,
          sensor_id: sensor.sensor_id,
          device_type: sensor.device_type,
          location: sensor.location,
          title: 'High Energy Consumption Detected',
          description: `Consider optimizing ${sensor.device_type} operation during peak hours`,
          type: 'energy_efficiency',
          priority: 'high',
          potential_savings: (sensor.energy_consumption * 0.15).toFixed(2),
          action: 'schedule_optimization'
        });
      }

      if (sensor.temperature > 70) {
        suggestions.push({
          id: `opt-${sensor.sensor_id}-2`,
          sensor_id: sensor.sensor_id,
          device_type: sensor.device_type,
          location: sensor.location,
          title: 'High Temperature Alert',
          description: `Device temperature is elevated. Consider maintenance or cooling improvement`,
          type: 'maintenance',
          priority: 'medium',
          potential_savings: 'N/A',
          action: 'schedule_maintenance'
        });
      }

      if (sensor.failure_probability > 0.7) {
        suggestions.push({
          id: `opt-${sensor.sensor_id}-3`,
          sensor_id: sensor.sensor_id,
          device_type: sensor.device_type,
          location: sensor.location,
          title: 'High Failure Probability',
          description: `Predictive maintenance recommended for ${sensor.device_type}`,
          type: 'predictive_maintenance',
          priority: 'critical',
          potential_savings: 'Preventative',
          action: 'immediate_maintenance'
        });
      }
    });

    return suggestions.slice(0, 10); // Return top 10 suggestions
  };

  // Fetch historical data (simulated)
  const fetchHistoricalData = async (hours = 24) => {
    try {
      // Simulate historical data based on current readings
      const mockHistory = generateMockHistoricalData(hours);
      setHistoricalData(mockHistory);
      return mockHistory;
    } catch (error) {
      console.error('Error fetching historical data:', error);
      return [];
    }
  };

  // Generate mock historical data
  const generateMockHistoricalData = (hours) => {
    const history = [];
    const now = new Date();
    
    for (let i = hours; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
      history.push({
        timestamp: timestamp.toISOString(),
        energy_consumption: Math.random() * 100 + 50, // Random between 50-150
        average_temperature: Math.random() * 30 + 40, // Random between 40-70
        anomaly_count: Math.floor(Math.random() * 5),
        active_sensors: Math.floor(Math.random() * 50) + 10 // Random between 10-60
      });
    }
    
    return history;
  };

  // Control device (send command to consumer API)
  const controlDevice = async (sensorId, action, parameters = {}) => {
    try {
      // This would call the consumer API to send commands back to producer if needed
      const response = await axios.post(`${API_BASE_URL}/api/control`, {
        sensor_id: sensorId,
        action: action,
        parameters: parameters,
        timestamp: new Date().toISOString()
      });

      console.log(`✅ Device control command sent: ${sensorId} - ${action}`);
      return { success: true, message: `Command sent successfully`, data: response.data };
    } catch (error) {
      console.error('❌ Error controlling device:', error);
      return { 
        success: false, 
        message: 'Failed to send control command',
        error: error.response?.data?.detail || error.message 
      };
    }
  };

  // Manual connection test
  const testConnection = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/health`);
      setIsConnected(true);
      setKafkaStatus('connected');
      return { success: true, data: response.data };
    } catch (error) {
      setIsConnected(false);
      setKafkaStatus('disconnected');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Refresh all data
  const refreshData = async () => {
    await fetchInitialData();
    await fetchOptimizationSuggestions();
    await fetchHistoricalData();
  };

  useEffect(() => {
    const socket = connectWebSocket();
    fetchInitialData();

    // Set up periodic data refresh
    const refreshInterval = setInterval(() => {
      if (isConnected) {
        fetchOptimizationSuggestions();
      }
    }, 30000); // Refresh every 30 seconds

    return () => {
      if (socket) {
        socket.disconnect();
      }
      clearInterval(refreshInterval);
    };
  }, [isConnected]);

  // Calculate derived statistics
  const derivedStats = {
    ...realTimeData.stats,
    totalSensors: realTimeData.sensors.length,
    criticalSensors: realTimeData.sensors.filter(s => s.status === 'critical').length,
    warningSensors: realTimeData.sensors.filter(s => s.status === 'warning').length,
    normalSensors: realTimeData.sensors.filter(s => s.status === 'normal').length,
    averageEfficiency: realTimeData.sensors.length > 0 
      ? realTimeData.sensors.reduce((sum, sensor) => sum + (sensor.power_factor || 0.9), 0) / realTimeData.sensors.length 
      : 0,
    totalCost: (realTimeData.stats.total_energy_consumption || 0) * 0.12 // Assuming $0.12 per kWh
  };

  const value = {
    // Data
    realTimeData: {
      ...realTimeData,
      stats: derivedStats
    },
    optimizationSuggestions,
    historicalData,
    
    // Status
    isConnected,
    loading,
    kafkaStatus,
    consumerHost,
    producerHost,
    
    // API functions
    fetchSensors,
    fetchOptimizationSuggestions,
    fetchHistoricalData,
    controlDevice,
    testConnection,
    refreshData,
    
    // Connection management
    connectWebSocket,
    API_BASE_URL
  };

  return (
    <EnergyContext.Provider value={value}>
      {children}
    </EnergyContext.Provider>
  );
};