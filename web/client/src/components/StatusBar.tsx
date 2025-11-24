import './StatusBar.css'

interface HealthStatus {
  status: string
  mode: string
  telemetry: string
}

interface StatusBarProps {
  healthStatus: HealthStatus | null
  isLoading: boolean
}

function StatusBar({ healthStatus, isLoading }: StatusBarProps) {
  if (isLoading) {
    return (
      <div className="status-bar">
        <div className="status-item">
          <span className="status-dot loading"></span>
          <span>Checking connection...</span>
        </div>
      </div>
    )
  }

  if (!healthStatus) {
    return (
      <div className="status-bar error">
        <div className="status-item">
          <span className="status-dot error"></span>
          <span>Gateway unavailable</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`status-bar ${healthStatus.status === 'ok' ? 'success' : 'error'}`}>
      <div className="status-item">
        <span className={`status-dot ${healthStatus.status === 'ok' ? 'success' : 'error'}`}></span>
        <span>Gateway: {healthStatus.status === 'ok' ? 'Connected' : 'Error'}</span>
      </div>
      <div className="status-item">
        <span>Mode: {healthStatus.mode === 'stub' ? 'Stub (Testing)' : 'Vertex AI'}</span>
      </div>
      <div className="status-item">
        <span>Telemetry: {healthStatus.telemetry === 'enabled' ? '✓ Enabled' : '✗ Disabled'}</span>
      </div>
    </div>
  )
}

export default StatusBar

