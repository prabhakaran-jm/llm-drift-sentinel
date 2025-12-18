interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  tokensIn?: number
  tokensOut?: number
  modelName?: string
  safetyScore?: number
  safetyLabel?: 'CLEAN' | 'TOXIC' | 'PII' | 'JAILBREAK' | 'PROMPT_INJECTION' | 'RISKY'
  driftScore?: number
  baselineReady?: boolean
  requestId?: string
}

interface AlertsViewProps {
  messages: Message[]
  flaggedSessions: Set<string>
  onNavigateToSession?: (sessionId: string) => void
  onDeleteFlaggedSession?: (sessionId: string) => void
}

export default function AlertsView({ messages, flaggedSessions, onNavigateToSession, onDeleteFlaggedSession }: AlertsViewProps) {
  // Generate alerts from messages
  const alerts = messages
    .filter(m => m.role === 'assistant')
    .map(msg => {
      // Check for critical safety labels (always alert)
      const isCriticalLabel = msg.safetyLabel === 'TOXIC' || 
                              msg.safetyLabel === 'JAILBREAK' || 
                              msg.safetyLabel === 'PROMPT_INJECTION'
      
      // Determine severity
      const severity = 
        (msg.safetyScore && msg.safetyScore < 0.3) || isCriticalLabel ? 'critical' :
        (msg.safetyScore && msg.safetyScore < 0.5) || 
        (msg.safetyLabel === 'PII' || msg.safetyLabel === 'RISKY') ||
        (msg.driftScore && msg.driftScore > 0.4) ? 'warning' :
        null
      
      if (!severity) return null
      
      return {
        id: msg.id,
        timestamp: msg.timestamp,
        severity,
        type: msg.safetyLabel || (msg.driftScore && msg.driftScore > 0.4 ? 'DRIFT' : 'UNKNOWN'),
        message: msg.content.substring(0, 100),
        safetyScore: msg.safetyScore,
        driftScore: msg.driftScore,
        requestId: msg.requestId,
      }
    })
    .filter(Boolean)
    .reverse() // Most recent first

  const criticalAlerts = alerts.filter(a => a?.severity === 'critical').length
  const warningAlerts = alerts.filter(a => a?.severity === 'warning').length

  return (
    <div className="flex-1 overflow-y-auto p-6 dark:bg-[#0c0c0c] bg-slate-50">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold dark:text-white text-slate-900">Alerts</h2>
            <p className="text-sm dark:text-white/50 text-slate-600 mt-1">Security and drift alerts from your LLM interactions</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-lg shadow-sm">
              <span className="w-2 h-2 bg-[#ef4444] rounded-full animate-pulse"></span>
              <span className="text-sm font-bold text-[#ef4444]">{criticalAlerts} Critical</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#fb923c]/10 border border-[#fb923c]/20 rounded-lg shadow-sm">
              <span className="w-2 h-2 bg-[#fb923c] rounded-full"></span>
              <span className="text-sm font-bold text-[#fb923c]">{warningAlerts} Warnings</span>
            </div>
          </div>
        </div>

        {/* Alerts List */}
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="dark:bg-[#1a1a1a] bg-white dark:border-[#27272a] border-slate-200 border rounded-lg p-12 text-center shadow-sm">
              <span className="material-symbols-outlined text-6xl dark:text-white/20 text-slate-300 mb-4 block">notifications_off</span>
              <p className="text-lg font-medium dark:text-white/50 text-slate-600">No alerts</p>
              <p className="text-sm dark:text-white/30 text-slate-400 mt-2">All messages are within safe thresholds</p>
            </div>
          ) : (
            alerts.map((alert) => {
              if (!alert) return null
              
              const severityColors: Record<'critical' | 'warning', { bg: string; border: string; text: string; icon: string }> = {
                critical: {
                  bg: 'bg-[#ef4444]/10',
                  border: 'border-[#ef4444]/20',
                  text: 'text-[#ef4444]',
                  icon: 'error',
                },
                warning: {
                  bg: 'bg-[#fb923c]/10',
                  border: 'border-[#fb923c]/20',
                  text: 'text-[#fb923c]',
                  icon: 'warning',
                },
              }
              
              const colors = severityColors[alert.severity as 'critical' | 'warning']
              
              return (
                <div
                  key={alert.id}
                  className={`dark:bg-[#1a1a1a] bg-white border ${colors.border} rounded-lg p-4 hover:dark:bg-[#1a1a1a]/80 hover:bg-slate-50 shadow-sm`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${colors.bg}`}>
                      <span className={`material-symbols-outlined ${colors.text}`}>{colors.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm font-bold uppercase ${colors.text}`}>
                          {alert.severity}
                        </span>
                        <span className="text-xs dark:text-white/40 text-slate-500 font-mono">
                          {alert.type}
                        </span>
                        <span className="text-xs dark:text-white/40 text-slate-500">
                          {alert.timestamp.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm dark:text-white/70 text-slate-700 mb-2 line-clamp-2">{alert.message}...</p>
                      <div className="flex items-center gap-4 text-xs dark:text-white/50 text-slate-600">
                        {alert.safetyScore !== undefined && (
                          <span>Safety: {(alert.safetyScore * 100).toFixed(0)}%</span>
                        )}
                        {alert.driftScore !== undefined && (
                          <span>Drift: +{(alert.driftScore * 100).toFixed(0)}%</span>
                        )}
                        <span className="font-mono">ID: {alert.requestId?.substring(0, 8)}</span>
                      </div>
                    </div>
                    <button className="dark:text-white/40 text-slate-400 hover:dark:text-white hover:text-slate-700">
                      <span className="material-symbols-outlined">more_vert</span>
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Flagged Sessions */}
        {flaggedSessions.size > 0 && (
          <div className="dark:bg-[#1a1a1a] bg-white dark:border-[#27272a] border-slate-200 border rounded-lg p-6 mt-6 shadow-sm">
            <h3 className="text-lg font-bold dark:text-white text-slate-900 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#ef4444]">flag</span>
              Flagged Sessions
            </h3>
            <div className="space-y-2">
              {Array.from(flaggedSessions).map((sessionId) => (
                <div key={sessionId} className="flex items-center justify-between p-3 dark:bg-[#0c0c0c] bg-slate-50 rounded-lg dark:border-[#27272a] border-slate-200 border shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 bg-[#ef4444] rounded-full"></span>
                    <span className="text-sm dark:text-white text-slate-900 font-mono">Session #{sessionId}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        if (onNavigateToSession) {
                          onNavigateToSession(sessionId)
                        }
                      }}
                      className="text-xs dark:text-white/50 text-slate-500 hover:dark:text-white hover:text-slate-700 px-3 py-1.5 rounded-md hover:bg-white/5 transition-colors"
                    >
                      View Details
                    </button>
                    <button 
                      onClick={() => {
                        if (onDeleteFlaggedSession) {
                          onDeleteFlaggedSession(sessionId)
                        }
                      }}
                      className="text-xs dark:text-[#ef4444] text-red-600 hover:dark:text-[#ef4444]/80 hover:text-red-700 px-3 py-1.5 rounded-md hover:bg-[#ef4444]/10 transition-colors flex items-center gap-1"
                      title="Delete flagged session"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

