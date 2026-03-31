import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';

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
  
  // Add producer status state
  const [producerStatus, setProducerStatus] = useState({
    is_active: true,
    last_data_time: null,
    time_since_last_data: null
  });

  // Use ref to store WebSocket instance and connection state
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const isConnectingRef = useRef(false);

  // API base URL - points to consumer laptop's API
  const API_BASE_URL = import.meta.env.VITE_API_URL || `http://192.168.137.16:8000`;

  // WebSocket connection for real-time updates
  const connectWebSocket = () => {
    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current || (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      isConnectingRef.current = true;
      
      // Close existing connection if any
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      // Create new WebSocket connection
      const wsUrl = API_BASE_URL.replace('http', 'ws') + '/ws';
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        console.log('✅ Connected to consumer API via WebSocket at:', wsUrl);
        setIsConnected(true);
        isConnectingRef.current = false;
        setLoading(false);
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          console.log('📩 WebSocket message received:', message.type, {
            sensorCount: message.sensors?.length || 0,
            stats: message.stats,
            producerStatus: message.producer_status
          });
          
          switch (message.type) {
            case 'initial_data':
              console.log('✅ Setting initial data with', message.sensors?.length || 0, 'sensors');
              setRealTimeData(prev => ({
                ...prev,
                stats: message.stats || {},
                sensors: message.sensors || []
              }));
              if (message.producer_status) {
                setProducerStatus(message.producer_status);
              }
              setIsConnected(true);
              setLoading(false);
              break;
              
            case 'realtime_update':
              console.log('🔄 Updating real-time data with', message.sensors?.length || 0, 'sensors');
              setRealTimeData(prev => ({
                ...prev,
                stats: message.stats || {},
                sensors: message.sensors || []
              }));
              if (message.producer_status) {
                setProducerStatus(message.producer_status);
              }
              break;
              
            case 'producer_disconnected':
              setProducerStatus(message.producer_status);
              // Clear real-time data when producer disconnects
              setRealTimeData({
                stats: {},
                sensors: [],
                alerts: [],
                anomalies: []
              });
              console.warn('⚠️ Producer has stopped sending data:', message.message);
              break;
              
            case 'critical_alert':
              // Handle critical alerts
              console.warn('🚨 Critical alert received:', message.data);
              break;
              
            default:
              console.log('Unknown message type:', message.type);
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      socket.onclose = (event) => {
        console.log('🔌 WebSocket connection closed:', event.code, event.reason);
        setIsConnected(false);
        isConnectingRef.current = false;
        
        // Clear data when disconnected
        setRealTimeData({
          stats: {},
          sensors: [],
          alerts: [],
          anomalies: []
        });
        
        // Attempt to reconnect after a delay
        if (event.code !== 1000) { // Don't reconnect if closed normally
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('🔄 Attempting to reconnect WebSocket...');
            connectWebSocket();
          }, 5000);
        }
      };

      socket.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setIsConnected(false);
        isConnectingRef.current = false;
      };

    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      setIsConnected(false);
      isConnectingRef.current = false;
    }
  };

  // Fetch initial data and connect WebSocket
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        console.log('🔄 Fetching initial data from:', API_BASE_URL);
        
        // Fetch dashboard stats
        const statsResponse = await axios.get(`${API_BASE_URL}/api/dashboard/stats`);
        console.log('📊 Stats response:', statsResponse.data);
        setRealTimeData(prev => ({
          ...prev,
          stats: statsResponse.data
        }));

        // Fetch sensors
        const sensorsResponse = await axios.get(`${API_BASE_URL}/api/sensors`);
        console.log('🔌 Sensors response:', sensorsResponse.data);
        setRealTimeData(prev => ({
          ...prev,
          sensors: sensorsResponse.data.sensors || []
        }));

        // Set connected state when data is successfully fetched
        setIsConnected(true);
        setLoading(false);
        
        console.log('✅ Successfully connected to API and fetched initial data');
      } catch (error) {
        console.error('❌ Error fetching initial data:', error);
        console.error('❌ API URL:', API_BASE_URL);
        setIsConnected(false);
        setLoading(false);
      }
    };

    fetchInitialData();
    connectWebSocket();

    // Cleanup function
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      // Properly close WebSocket connection
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
        wsRef.current = null;
      }
    };
  }, []);

  // Fetch optimization suggestions (simulated - would come from ML service)
  const fetchOptimizationSuggestions = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/optimization/suggestions`);
      setOptimizationSuggestions(response.data.suggestions || []);
    } catch (error) {
      console.error('❌ Error fetching optimization suggestions:', error);
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
      const response = await axios.get(`${API_BASE_URL}/api/analytics/history?hours=${hours}`);
      console.log('📥 Historical data fetched:', response.data.data?.length || 0, 'points');
      setHistoricalData(response.data.data || []);
    } catch (error) {
      console.error('❌ Error fetching historical data:', error);
    }
  };

  // Fetch sensors
  const fetchSensors = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/sensors`);
      setRealTimeData(prev => ({
        ...prev,
        sensors: response.data.sensors || []
      }));
    } catch (error) {
      console.error('❌ Error fetching sensors:', error);
    }
  };

  // Control device
  const controlDevice = async (deviceId, action) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/devices/${deviceId}/control`, {
        action: action
      });
      return response.data;
    } catch (error) {
      console.error('❌ Error controlling device:', error);
      throw error;
    }
  };


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
    totalCost: (realTimeData.stats.total_energy_consumption || 0) * 0.12, // Assuming $0.12 per kWh
    // Map API field names to frontend expectations
    total_energy: realTimeData.stats.total_energy_consumption || 0,
    critical_sensors: realTimeData.stats.status_critical || 0,
    total_sensors: realTimeData.stats.total_readings || 0,
    efficiency_score: realTimeData.sensors.length > 0 
      ? Math.round((1 - (realTimeData.stats.anomaly_count || 0) / (realTimeData.stats.total_readings || 1)) * 100)
      : 0,
    avg_temperature: realTimeData.stats.average_consumption || 0,
    total_power: realTimeData.stats.average_consumption || 0
  };

  // Debug logging
  useEffect(() => {
    console.log('🔍 EnergyContext Debug:', {
      isConnected,
      loading,
      statsCount: Object.keys(realTimeData.stats).length,
      sensorsCount: realTimeData.sensors.length,
      derivedStats: derivedStats
    });
  }, [isConnected, loading, realTimeData.stats, realTimeData.sensors, derivedStats]);

  const contextValue = {
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
    consumerHost,
    producerHost,
    kafkaStatus,
    producerStatus,
    isProducerActive: producerStatus.is_active,
    
    // Actions
    fetchOptimizationSuggestions,
    fetchHistoricalData,
    fetchSensors,
    controlDevice,
    connectWebSocket,
  };

  return (
    <EnergyContext.Provider value={contextValue}>
      {children}
    </EnergyContext.Provider>
  );
};

export default EnergyContext;

