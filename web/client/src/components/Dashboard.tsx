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

interface DashboardProps {
  messages: Message[]
  flaggedSessions: Set<string>
}

export default function Dashboard({ messages, flaggedSessions }: DashboardProps) {
  // Calculate statistics
  const totalMessages = messages.length
  const assistantMessages = messages.filter(m => m.role === 'assistant')
  const totalTokens = messages.reduce((sum, m) => sum + (m.tokensIn || 0) + (m.tokensOut || 0), 0)
  
  const safetyStats = {
    clean: assistantMessages.filter(m => m.safetyLabel === 'CLEAN' || (m.safetyScore && m.safetyScore >= 0.7)).length,
    risky: assistantMessages.filter(m => m.safetyLabel === 'RISKY' || m.safetyLabel === 'PII' || (m.safetyScore && m.safetyScore >= 0.3 && m.safetyScore < 0.7)).length,
    critical: assistantMessages.filter(m => m.safetyLabel === 'TOXIC' || m.safetyLabel === 'JAILBREAK' || m.safetyLabel === 'PROMPT_INJECTION' || (m.safetyScore && m.safetyScore < 0.3)).length,
  }
  
  const avgSafetyScore = assistantMessages.length > 0
    ? assistantMessages.reduce((sum, m) => sum + (m.safetyScore || 1), 0) / assistantMessages.length
    : 1
  
  const avgDriftScore = assistantMessages.filter(m => m.driftScore !== undefined).length > 0
    ? assistantMessages
        .filter(m => m.driftScore !== undefined)
        .reduce((sum, m) => sum + (m.driftScore || 0), 0) / assistantMessages.filter(m => m.driftScore !== undefined).length
    : 0
  
  const flaggedCount = flaggedSessions.size
  const uniqueModels = new Set(messages.filter(m => m.modelName).map(m => m.modelName)).size

  return (
    <div className="flex-1 overflow-y-auto p-6 dark:bg-[#0c0c0c] bg-slate-50">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold dark:text-white text-slate-900">Dashboard</h2>
            <p className="text-sm dark:text-white/50 text-slate-600 mt-1">Overview of LLM Sentinel activity</p>
          </div>
          <a
            href="https://app.datadoghq.com/dashboard/dna-pyc-73v"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-[#632CA6] hover:bg-[#7B3FC0] text-white rounded-lg shadow-sm"
          >
            <span className="material-symbols-outlined text-lg">open_in_new</span>
            Open Datadog Dashboard
          </a>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="dark:bg-[#1a1a1a] bg-white dark:border-[#27272a] border-slate-200 border rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="dark:text-white/50 text-slate-600 text-sm">Total Messages</span>
              <span className="material-symbols-outlined text-[#facc15]">chat</span>
            </div>
            <div className="text-2xl font-bold dark:text-white text-slate-900">{totalMessages}</div>
            <div className="text-xs dark:text-white/40 text-slate-500 mt-1">{assistantMessages.length} assistant responses</div>
          </div>

          <div className="dark:bg-[#1a1a1a] bg-white dark:border-[#27272a] border-slate-200 border rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="dark:text-white/50 text-slate-600 text-sm">Total Tokens</span>
              <span className="material-symbols-outlined text-[#facc15]">token</span>
            </div>
            <div className="text-2xl font-bold dark:text-white text-slate-900">{totalTokens.toLocaleString()}</div>
            <div className="text-xs dark:text-white/40 text-slate-500 mt-1">{uniqueModels} model{uniqueModels !== 1 ? 's' : ''} used</div>
          </div>

          <div className="dark:bg-[#1a1a1a] bg-white dark:border-[#27272a] border-slate-200 border rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="dark:text-white/50 text-slate-600 text-sm">Avg Safety Score</span>
              <span className="material-symbols-outlined text-[#10b981]">verified_user</span>
            </div>
            <div className="text-2xl font-bold dark:text-white text-slate-900">{(avgSafetyScore * 100).toFixed(0)}%</div>
            <div className="text-xs dark:text-white/40 text-slate-500 mt-1">
              {avgSafetyScore >= 0.7 ? 'Safe' : avgSafetyScore >= 0.3 ? 'Risky' : 'Critical'}
            </div>
          </div>

          <div className="dark:bg-[#1a1a1a] bg-white dark:border-[#27272a] border-slate-200 border rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="dark:text-white/50 text-slate-600 text-sm">Avg Drift Score</span>
              <span className="material-symbols-outlined text-[#facc15]">trending_up</span>
            </div>
            <div className="text-2xl font-bold dark:text-white text-slate-900">{(avgDriftScore * 100).toFixed(2)}%</div>
            <div className="text-xs dark:text-white/40 text-slate-500 mt-1">
              {avgDriftScore < 0.05 ? 'Stable' : avgDriftScore < 0.15 ? 'Moderate' : 'High drift'}
            </div>
          </div>

          <div className="dark:bg-[#1a1a1a] bg-white dark:border-[#27272a] border-slate-200 border rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="dark:text-white/50 text-slate-600 text-sm">Flagged Sessions</span>
              <span className="material-symbols-outlined text-[#ef4444]">flag</span>
            </div>
            <div className="text-2xl font-bold dark:text-white text-slate-900">{flaggedCount}</div>
            <div className="text-xs dark:text-white/40 text-slate-500 mt-1">Requires review</div>
          </div>
        </div>

        {/* Safety Breakdown */}
        <div className="dark:bg-[#1a1a1a] bg-white dark:border-[#27272a] border-slate-200 border rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-bold dark:text-white text-slate-900 mb-4">Safety Breakdown</h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm dark:text-white/70 text-slate-700">Clean</span>
                <span className="text-sm font-bold text-[#10b981]">{safetyStats.clean}</span>
              </div>
              <div className="h-2 dark:bg-white/5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#10b981] rounded-full"
                  style={{ width: `${totalMessages > 0 ? (safetyStats.clean / totalMessages) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm dark:text-white/70 text-slate-700">Risky</span>
                <span className="text-sm font-bold text-[#fb923c]">{safetyStats.risky}</span>
              </div>
              <div className="h-2 dark:bg-white/5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#fb923c] rounded-full"
                  style={{ width: `${totalMessages > 0 ? (safetyStats.risky / totalMessages) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm dark:text-white/70 text-slate-700">Critical</span>
                <span className="text-sm font-bold text-[#ef4444]">{safetyStats.critical}</span>
              </div>
              <div className="h-2 dark:bg-white/5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#ef4444] rounded-full"
                  style={{ width: `${totalMessages > 0 ? (safetyStats.critical / totalMessages) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="dark:bg-[#1a1a1a] bg-white dark:border-[#27272a] border-slate-200 border rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-bold dark:text-white text-slate-900 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {messages.slice(-5).reverse().map((msg) => (
              <div key={msg.id} className="flex items-center gap-3 p-3 dark:bg-[#0c0c0c] bg-slate-50 rounded-lg dark:border-[#27272a] border-slate-200 border shadow-sm">
                <div className={`w-2 h-2 rounded-full ${
                  msg.safetyScore && msg.safetyScore < 0.3 ? 'bg-[#ef4444]' :
                  msg.safetyScore && msg.safetyScore < 0.7 ? 'bg-[#fb923c]' : 'bg-[#10b981]'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm dark:text-white text-slate-900 truncate">{msg.content.substring(0, 60)}...</div>
                  <div className="text-xs dark:text-white/40 text-slate-500 mt-1">
                    {msg.timestamp.toLocaleTimeString()} • {msg.safetyLabel || 'CLEAN'}
                  </div>
                </div>
                <div className="text-xs dark:text-white/50 text-slate-600 font-mono">
                  {((msg.tokensIn || 0) + (msg.tokensOut || 0)).toLocaleString()} tokens
                </div>
              </div>
            ))}
            {messages.length === 0 && (
              <div className="text-center py-12 dark:bg-[#0c0c0c] bg-slate-50 rounded-lg dark:border-[#27272a] border-slate-200 border">
                <span className="material-symbols-outlined text-6xl dark:text-white/20 text-slate-300 mb-4 block">inbox</span>
                <p className="text-lg font-medium dark:text-white/50 text-slate-600">No activity yet</p>
                <p className="text-sm dark:text-white/30 text-slate-400 mt-2">Start a conversation to see activity here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

