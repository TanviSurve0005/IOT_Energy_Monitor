import React from 'react';
import { Zap, Activity, BarChart3, Lightbulb, Wifi, WifiOff } from 'lucide-react';
import { useEnergy } from '../context/EnergyContext';

const Navbar = ({ activeTab, setActiveTab }) => {
  const { isConnected } = useEnergy();

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'sensors', label: 'Sensors', icon: Zap },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'optimization', label: 'Optimization', icon: Lightbulb }
  ];

  return (
    <nav className="navbar">
      <div className="nav-content">
        <div className="nav-brand">
          <Zap size={24} />
          <span>Smart Energy Monitor</span>
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? <Wifi size={16} /> : <WifiOff size={16} />}
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>

        <div className="nav-tabs">
          {tabs.map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <IconComponent size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;