import React, { createContext, useContext, useState, useEffect } from 'react';
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
              stats: data.data
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
  const fetchOptimizationSuggestions = async () => {
    try {
      const response = await axios.get('/api/optimization/suggestions');
      setOptimizationSuggestions(response.data.suggestions);
      return response.data.suggestions;
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      return [];
    }
  };

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

  useEffect(() => {
    const ws = connectWebSocket();
    fetchInitialData();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  const value = {
    realTimeData,
    optimizationSuggestions,
    historicalData,
    isConnected,
    loading,
    fetchSensors,
    fetchOptimizationSuggestions,
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