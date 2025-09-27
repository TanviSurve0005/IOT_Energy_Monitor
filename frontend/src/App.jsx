import React, { useState, useEffect } from 'react'
import Dashboard from './components/Dashboard'
import SensorGrid from './components/SensorGrid'
import Analytics from './components/Analytics'
import Optimization from './components/Optimization'
import Navbar from './components/Navbar'
import { EnergyProvider } from './context/EnergyContext'
import './styles/App.css'
import './styles/connection-states.css'

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate initial loading
    const timer = setTimeout(() => setLoading(false), 1000)
    return () => clearTimeout(timer)
  }, [])

  const renderContent = () => {
    if (loading) {
      return (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Initializing Smart Energy Monitor...</p>
        </div>
      )
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />
      case 'sensors':
        return <SensorGrid />
      case 'analytics':
        return <Analytics />
      case 'optimization':
        return <Optimization />
      default:
        return <Dashboard />
    }
  }

  return (
    <EnergyProvider>
      <div className="app">
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="main-content">
          {renderContent()}
        </main>
        
        {/* Footer */}
        <footer className="app-footer">
          <div className="footer-content">
            <p>IoT Smart Energy Monitor v2.0 | Real-time Factory Management System</p>
            <div className="footer-stats">
              <span>🟢 System Operational</span>
              <span>📊 300+ Sensors Active</span>
              <span>⚡ Real-time Monitoring</span>
            </div>
          </div>
        </footer>
      </div>
    </EnergyProvider>
  )
}

export default App