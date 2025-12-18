interface Message {
  id: string
  safetyScore?: number
  safetyLabel?: 'CLEAN' | 'TOXIC' | 'PII' | 'JAILBREAK' | 'PROMPT_INJECTION' | 'RISKY'
  driftScore?: number
  tokensIn?: number
  tokensOut?: number
  requestId?: string
}

interface InspectorPanelProps {
  selectedMessage: Message | null
  modelName?: string
  onViewTrace?: () => void
}

export default function InspectorPanel({ selectedMessage, modelName, onViewTrace }: InspectorPanelProps) {
  if (!selectedMessage) {
    return (
      <aside className="w-[30%] dark:bg-[#1a1a1a] bg-white border-l dark:border-white/5 border-slate-200 flex flex-col shrink-0 shadow-2xl z-30">
        <div className="p-5 border-b dark:border-white/10 border-slate-200 dark:bg-[#1a1a1a] bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2 text-[#facc15] mb-1">
            <span className="material-symbols-outlined text-[18px]">query_stats</span>
            <h4 className="font-bold text-sm uppercase tracking-wider dark:text-white text-slate-900">Inspector</h4>
          </div>
          <p className="dark:text-white/50 text-slate-500 text-xs pl-7">Select a message to view details</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center dark:bg-[#0c0c0c] bg-slate-50 rounded-lg dark:border-[#27272a] border-slate-200 border p-12 max-w-sm">
            <span className="material-symbols-outlined text-6xl dark:text-white/20 text-slate-300 mb-4 block">query_stats</span>
            <p className="text-lg font-medium dark:text-white/50 text-slate-600">No message selected</p>
            <p className="text-sm dark:text-white/30 text-slate-400 mt-2">Select a message to view detailed analysis</p>
          </div>
        </div>
      </aside>
    )
  }

  const safetyScore = selectedMessage.safetyScore ?? 1.0
  const safetyPercent = Math.round(safetyScore * 100)
  const isCritical = safetyScore < 0.3
  const isRisky = safetyScore < 0.5

  // Map safetyLabel to detector display
  const getDetectorInfo = (label?: string) => {
    switch (label) {
      case 'PROMPT_INJECTION':
        return { name: 'Prompt Injection (Direct)', confidence: 92, color: '#ef4444' }
      case 'JAILBREAK':
        return { name: 'Jailbreak Attempt', confidence: 88, color: '#ef4444' }
      case 'TOXIC':
        return { name: 'Toxic Language', confidence: 85, color: '#ef4444' }
      case 'PII':
        return { name: 'PII Detection', confidence: 75, color: '#fb923c' }
      case 'RISKY':
        return { name: 'Risky Content', confidence: 60, color: '#fb923c' }
      default:
        return null
    }
  }

  const detectorInfo = getDetectorInfo(selectedMessage.safetyLabel)

  return (
    <aside className="w-[30%] dark:bg-[#1a1a1a] bg-white border-l dark:border-white/5 border-slate-200 flex flex-col shrink-0 shadow-2xl z-30">
      <div className="p-5 border-b dark:border-white/10 border-slate-200 dark:bg-[#1a1a1a] bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2 text-[#facc15] mb-1">
          <span className="material-symbols-outlined text-[18px]">query_stats</span>
          <h4 className="font-bold text-sm uppercase tracking-wider dark:text-white text-slate-900">Inspector</h4>
        </div>
        <p className="dark:text-white/50 text-slate-500 text-xs pl-7">Deep dive analysis for message {selectedMessage.id}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Safety Score Card */}
        <div className="dark:bg-[#0c0c0c]/50 bg-slate-50 rounded-xl p-5 dark:border-white/10 border-slate-200 border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="dark:text-white/70 text-slate-700 text-sm font-medium">Safety Score</span>
            <div className={`flex items-center gap-1.5 ${isCritical ? 'text-[#ef4444] animate-pulse' : isRisky ? 'text-[#fb923c]' : 'text-[#10b981]'}`}>
              <span className="material-symbols-outlined text-[18px]">
                {isCritical ? 'warning' : isRisky ? 'gpp_maybe' : 'verified_user'}
              </span>
              <span className="font-bold text-sm tracking-wide">
                {isCritical ? 'CRITICAL' : isRisky ? 'RISKY' : 'CLEAN'}
              </span>
            </div>
          </div>
          <div className="relative h-4 w-full dark:bg-white/5 bg-slate-200 rounded-full overflow-hidden mb-2 dark:ring-1 dark:ring-white/5 ring-1 ring-slate-300">
            <div className="absolute left-[25%] top-0 bottom-0 w-px dark:bg-[#0c0c0c]/30 bg-white z-10"></div>
            <div className="absolute left-[50%] top-0 bottom-0 w-px dark:bg-[#0c0c0c]/30 bg-white z-10"></div>
            <div className="absolute left-[75%] top-0 bottom-0 w-px dark:bg-[#0c0c0c]/30 bg-white z-10"></div>
            <div
              className={`h-full rounded-full relative z-0 shadow-[0_0_15px_rgba(239,68,68,0.5)] ${
                isCritical
                  ? 'bg-gradient-to-r from-[#ef4444] via-[#fb923c] to-[#ef4444]'
                  : isRisky
                  ? 'bg-gradient-to-r from-[#fb923c] to-[#facc15]'
                  : 'bg-gradient-to-r from-[#10b981] to-[#34d399]'
              }`}
              style={{ width: `${safetyPercent}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs font-mono mt-2">
            <span className="dark:text-white/30 text-slate-400">0</span>
            <span className={`font-bold text-lg ${isCritical ? 'text-[#ef4444]' : isRisky ? 'text-[#fb923c]' : 'text-[#10b981]'}`}>
              {safetyPercent}
              <span className="text-sm font-normal dark:text-white/50 text-slate-500">/100</span>
            </span>
            <span className="dark:text-white/30 text-slate-400">100</span>
          </div>
        </div>

        {/* Active Detectors */}
        <div>
          <h5 className="dark:text-white/40 text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-3 pl-1 flex items-center gap-2">
            Active Detectors
            {detectorInfo && <span className="bg-[#ef4444] text-white text-[9px] px-1.5 py-px rounded-full font-bold">1</span>}
          </h5>
          <div className="space-y-2.5">
            {detectorInfo ? (
              <div className="flex flex-col p-3 rounded-lg bg-[#ef4444]/5 border border-[#ef4444]/20 hover:bg-[#ef4444]/10 cursor-pointer group shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#ef4444] text-[18px]">code_off</span>
                    <span className="dark:text-white/90 text-slate-900 text-sm font-medium">{detectorInfo.name}</span>
                  </div>
                  <span className="text-[#ef4444] text-xs font-mono font-bold">{detectorInfo.confidence}%</span>
                </div>
                <div className="h-1.5 w-full dark:bg-[#0c0c0c]/40 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#ef4444] rounded-full"
                    style={{ width: `${detectorInfo.confidence}%` }}
                  ></div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col p-3 rounded-lg dark:bg-white/5 bg-slate-100 dark:border-white/5 border-slate-200 border opacity-50 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#10b981] text-[18px]">sentiment_satisfied</span>
                    <span className="dark:text-white/90 text-slate-900 text-sm font-medium">Toxic Language</span>
                  </div>
                  <span className="text-[#10b981] text-xs font-mono font-bold">2%</span>
                </div>
                <div className="h-1.5 w-full dark:bg-[#0c0c0c]/40 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-[#10b981] w-[2%] rounded-full"></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Metrics */}
        <div>
          <h5 className="dark:text-white/40 text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-3 pl-1">Metrics</h5>
          <div className="grid grid-cols-2 gap-3">
            <div className="dark:bg-[#0c0c0c]/50 bg-slate-50 p-3 rounded-lg dark:border-white/5 border-slate-200 border hover:dark:border-white/10 hover:border-slate-300 shadow-sm">
              <div className="dark:text-white/40 text-slate-500 text-[10px] uppercase font-bold mb-1 truncate">Input Tokens</div>
              <div className="dark:text-white text-slate-900 font-mono text-sm">{selectedMessage.tokensIn ?? 0}</div>
            </div>
            <div className="dark:bg-[#0c0c0c]/50 bg-slate-50 p-3 rounded-lg dark:border-white/5 border-slate-200 border hover:dark:border-white/10 hover:border-slate-300 shadow-sm">
              <div className="dark:text-white/40 text-slate-500 text-[10px] uppercase font-bold mb-1 truncate">Output Tokens</div>
              <div className="dark:text-white text-slate-900 font-mono text-sm">{selectedMessage.tokensOut ?? 0}</div>
            </div>
            <div className="dark:bg-[#0c0c0c]/50 bg-slate-50 p-3 rounded-lg dark:border-white/5 border-slate-200 border hover:dark:border-white/10 hover:border-slate-300 shadow-sm">
              <div className="dark:text-white/40 text-slate-500 text-[10px] uppercase font-bold mb-1 truncate">Total Tokens</div>
              <div className="dark:text-white text-slate-900 font-mono text-sm">
                {(selectedMessage.tokensIn ?? 0) + (selectedMessage.tokensOut ?? 0)}
              </div>
            </div>
            <div className="dark:bg-[#0c0c0c]/50 bg-slate-50 p-3 rounded-lg dark:border-white/5 border-slate-200 border hover:dark:border-white/10 hover:border-slate-300 shadow-sm">
              <div className="dark:text-white/40 text-slate-500 text-[10px] uppercase font-bold mb-1 truncate">Model</div>
              <div className="dark:text-white text-slate-900 font-mono text-sm truncate">{modelName ?? 'N/A'}</div>
            </div>
          </div>
        </div>

        {/* Raw Payload */}
        <div className="flex flex-col flex-1 min-h-0">
          <h5 className="dark:text-white/40 text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-3 pl-1">Raw Payload</h5>
          <div className="dark:bg-[#0c0c0c] bg-slate-50 rounded-lg dark:border-white/10 border-slate-200 border font-mono text-[11px] leading-relaxed overflow-hidden flex flex-col shadow-inner">
            <div className="dark:bg-white/5 bg-slate-100 px-3 py-1.5 dark:border-white/5 border-slate-200 border-b flex items-center justify-between">
              <span className="dark:text-white/40 text-slate-600 font-bold text-[10px] uppercase">JSON Payload</span>
              <button
                onClick={() => {
                  const payload = JSON.stringify(
                    {
                      requestId: selectedMessage.requestId || selectedMessage.id,
                      role: 'assistant',
                      content: '...',
                      safetyScore: selectedMessage.safetyScore,
                      safetyLabel: selectedMessage.safetyLabel,
                      tokensIn: selectedMessage.tokensIn,
                      tokensOut: selectedMessage.tokensOut,
                    },
                    null,
                    2
                  )
                  navigator.clipboard.writeText(payload)
                }}
                className="material-symbols-outlined text-[14px] dark:text-white/40 text-slate-500 cursor-pointer hover:dark:text-white hover:text-slate-700"
                title="Copy"
              >
                content_copy
              </button>
            </div>
            <div className="p-3 overflow-auto whitespace-pre font-mono dark:text-[#60a5fa] text-blue-700 bg-slate-50 dark:bg-[#0c0c0c]">
              {JSON.stringify(
                {
                  requestId: selectedMessage.requestId || selectedMessage.id,
                  role: 'assistant',
                  content: '...',
                  safetyScore: selectedMessage.safetyScore,
                  safetyLabel: selectedMessage.safetyLabel,
                  tokensIn: selectedMessage.tokensIn,
                  tokensOut: selectedMessage.tokensOut,
                },
                null,
                2
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="p-5 border-t dark:border-white/10 border-slate-200 dark:bg-[#0c0c0c] bg-white mt-auto">
        <button
          onClick={onViewTrace}
          className="w-full py-3 bg-[#facc15] hover:bg-[#fbbf24] text-black font-bold rounded-lg text-sm shadow-[0_0_20px_rgba(250,204,21,0.2)] hover:shadow-[0_0_25px_rgba(250,204,21,0.4)] flex items-center justify-center gap-2 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]">troubleshoot</span>
          View Full Trace
        </button>
      </div>
    </aside>
  )
}

