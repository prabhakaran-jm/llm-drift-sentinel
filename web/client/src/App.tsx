import { useState, useEffect } from 'react'
import ChatInterface from './components/ChatInterface'
import StatusBar from './components/StatusBar'
import './App.css'

interface HealthStatus {
  status: string
  mode: string
  telemetry: string
}

function App() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkHealth()
    // Poll health every 30 seconds
    const interval = setInterval(checkHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  const checkHealth = async () => {
    try {
      const response = await fetch('/api/health')
      if (response.ok) {
        const data = await response.json()
        setHealthStatus(data)
      }
    } catch (error) {
      console.error('Health check failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>LLM Drift & Abuse Sentinel</h1>
        <p className="subtitle">Monitor and detect drift and abuse in LLM applications</p>
      </header>
      <StatusBar healthStatus={healthStatus} isLoading={isLoading} />
      <main className="app-main">
        <ChatInterface />
      </main>
    </div>
  )
}

export default App

