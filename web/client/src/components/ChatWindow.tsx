import { useRef, useEffect } from 'react'

// Drift Sparkline Component
function DriftSparkline({ driftScore }: { driftScore?: number }) {
  if (driftScore === undefined) {
    return (
      <svg className="w-10 h-4" fill="none" viewBox="0 0 40 16" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M1 14L8 14L15 14L22 14L30 14L39 14"
          stroke="#3f3f46"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        ></path>
      </svg>
    )
  }

  // Generate sparkline data based on drift score
  // Higher drift = more variation in the line
  const points = []
  const baseY = 12
  const variation = driftScore * 8 // Scale drift to visual variation
  
  for (let i = 0; i <= 9; i++) {
    const x = (i / 9) * 38 + 1
    // Create a trend that reflects drift: higher drift = more upward trend
    const y = baseY - (driftScore * 10) - (Math.sin(i * 0.5) * variation * 0.5)
    points.push({ x, y: Math.max(2, Math.min(14, y)) })
  }

  const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaData = pathData + ` L ${points[points.length - 1].x} 16 L 1 16 Z`

  const color = driftScore > 0.3 ? '#fb923c' : driftScore > 0.15 ? '#facc15' : '#10b981'

  return (
    <svg className="w-10 h-4" fill="none" viewBox="0 0 40 16" xmlns="http://www.w3.org/2000/svg">
      <path
        d={areaData}
        fill={color}
        fillOpacity="0.1"
      />
      <path
        d={pathData}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  )
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  safetyScore?: number
  safetyLabel?: 'CLEAN' | 'TOXIC' | 'PII' | 'JAILBREAK' | 'PROMPT_INJECTION' | 'RISKY'
  driftScore?: number
  baselineReady?: boolean
  tokensIn?: number
  tokensOut?: number
  modelName?: string
  requestId?: string
}

interface ChatWindowProps {
  messages: Message[]
  isLoading: boolean
  onMessageSelect?: (message: Message) => void
  selectedMessageId?: string
  searchQuery?: string
  sessionId?: string
  isFlagged?: boolean
  onFlagSession?: () => void
  onNewSession?: () => void
}

export default function ChatWindow({ 
  messages, 
  isLoading, 
  onMessageSelect, 
  selectedMessageId,
  searchQuery,
  sessionId,
  isFlagged,
  onFlagSession,
  onNewSession
}: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const getSafetyBadgeColor = (label?: string, score?: number) => {
    if (!score) return { bg: 'dark:bg-white/5 bg-slate-100', border: 'dark:border-white/10 border-slate-200', text: 'dark:text-white/50 text-slate-500', icon: 'verified_user' }
    if (score < 0.3 || label === 'TOXIC' || label === 'JAILBREAK' || label === 'PROMPT_INJECTION') {
      return { bg: 'bg-[#ef4444]/10', border: 'border-[#ef4444]/20', text: 'text-[#ef4444]', icon: 'gpp_bad' }
    }
    if (score < 0.5 || label === 'RISKY' || label === 'PII') {
      return { bg: 'bg-[#fb923c]/10', border: 'border-[#fb923c]/20', text: 'text-[#fb923c]', icon: 'gpp_maybe' }
    }
    return { bg: 'bg-[#10b981]/10', border: 'border-[#10b981]/20', text: 'text-[#10b981]', icon: 'verified_user' }
  }

  const getDriftColor = (drift?: number) => {
    if (!drift) return 'dark:text-white/30 text-slate-400'
    if (drift > 0.3) return 'text-[#fb923c]'
    if (drift > 0.15) return 'text-[#facc15]'
    return 'text-[#10b981]'
  }

  return (
    <main className="w-[70%] flex flex-col min-w-0 dark:bg-[#0c0c0c] bg-white relative border-r dark:border-white/5 border-slate-200">
      {/* Session Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b dark:border-white/5 border-slate-200 dark:bg-[#0c0c0c]/95 bg-white/95 backdrop-blur-sm z-10 shadow-sm">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h3 className="dark:text-white text-slate-900 text-lg font-bold tracking-tight">
              Session #{sessionId || messages[0]?.id.substring(0, 8) || 'new'}
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20 text-xs font-bold uppercase tracking-wide flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-[#10b981] animate-pulse"></span>
              Live Monitoring
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs dark:text-white/50 text-slate-600 font-mono">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">smart_toy</span>
              {messages.find(m => m.modelName)?.modelName || 'GPT-4-Turbo'}
            </span>
            {messages.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">schedule</span>
                Started {Math.floor((Date.now() - messages[0].timestamp.getTime()) / 60000)}m ago
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onNewSession}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#facc15]/10 hover:bg-[#facc15]/20 text-[#facc15] text-sm font-medium border border-[#facc15]/20 transition-colors"
            title="Start New Session"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Session
          </button>
          <button
            onClick={() => {
              const sessionData = {
                sessionId,
                timestamp: new Date().toISOString(),
                totalMessages: messages.length,
                messages: messages.map(msg => ({
                  id: msg.id,
                  role: msg.role,
                  content: msg.content,
                  timestamp: msg.timestamp.toISOString(),
                  tokensIn: msg.tokensIn,
                  tokensOut: msg.tokensOut,
                  modelName: msg.modelName,
                  safetyScore: msg.safetyScore,
                  safetyLabel: msg.safetyLabel,
                  driftScore: msg.driftScore,
                  baselineReady: msg.baselineReady,
                  requestId: msg.requestId,
                })),
              }
              const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `session-${sessionId}.json`
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg dark:bg-white/5 bg-slate-100 hover:dark:bg-white/10 hover:bg-slate-200 dark:text-white text-slate-900 text-sm font-medium dark:border-white/5 border-slate-200 shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">ios_share</span>
            Export
          </button>
          <button
            onClick={onFlagSession}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isFlagged
                ? 'bg-[#10b981]/10 hover:bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/20'
                : 'bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/20'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">flag</span>
            {isFlagged ? 'Unflag Session' : 'Flag Session'}
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8 scroll-smooth">
        {searchQuery && messages.length === 0 && (
          <div className="flex justify-center items-center h-full">
            <div className="text-center dark:bg-[#0c0c0c] bg-slate-50 rounded-lg dark:border-[#27272a] border-slate-200 border p-12 max-w-md">
              <span className="material-symbols-outlined text-6xl dark:text-white/20 text-slate-300 mb-4 block">search_off</span>
              <p className="text-lg font-medium dark:text-white/50 text-slate-600">No messages found</p>
              <p className="text-sm dark:text-white/30 text-slate-400 mt-2">Try a different search query</p>
            </div>
          </div>
        )}
        {messages.length === 0 && !searchQuery && (
          <div className="flex justify-center items-center h-full">
            <div className="text-center dark:bg-[#0c0c0c] bg-slate-50 rounded-lg dark:border-[#27272a] border-slate-200 border p-12 max-w-md">
              <span className="material-symbols-outlined text-6xl dark:text-white/20 text-slate-300 mb-4 block">chat_bubble_outline</span>
              <p className="text-lg font-medium dark:text-white/50 text-slate-600">Start a conversation</p>
              <p className="text-sm dark:text-white/30 text-slate-400 mt-2">Your interactions are monitored for drift and safety issues</p>
            </div>
          </div>
        )}

        {messages.length > 0 && (
          <div className="flex justify-center">
            <span className="text-[11px] font-bold dark:text-white/30 text-slate-500 dark:bg-white/5 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-wider border dark:border-transparent border-slate-200">
              {messages[0].timestamp.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </span>
          </div>
        )}

        {messages.map((message) => {
          const safetyBadge = getSafetyBadgeColor(message.safetyLabel, message.safetyScore)
          const isSelected = selectedMessageId === message.id

          if (message.role === 'user') {
            return (
              <div key={message.id} className="flex flex-col items-end gap-1 group">
                <div className="flex items-center gap-2 mb-1 px-1 opacity-60 group-hover:opacity-100 transition-opacity">
                  <span className="dark:text-white/40 text-slate-500 text-[11px] font-bold">User</span>
                  <span className="dark:text-white/60 text-slate-400 text-[11px] font-mono">{formatTime(message.timestamp)}</span>
                </div>
                <div
                  className="dark:bg-[rgba(168,85,247,0.05)] bg-purple-50 backdrop-blur-[8px] dark:border-[rgba(168,85,247,0.25)] border-purple-200 dark:text-white text-slate-900 p-4 rounded-2xl rounded-tr-sm shadow-sm max-w-[80%] text-sm leading-relaxed cursor-pointer hover:dark:border-[rgba(168,85,247,0.4)] hover:border-purple-300"
                >
                  {message.content}
                </div>
              </div>
            )
          }

          return (
            <div
              key={message.id}
              className={`flex flex-col items-start gap-2 max-w-[85%] cursor-pointer ${
                isSelected ? 'ring-2 ring-[#facc15]/50 rounded-lg p-2 -m-2' : ''
              }`}
              onClick={() => onMessageSelect?.(message)}
            >
              <div className="flex items-center gap-2 mb-1 px-1">
                <span className="text-[#facc15] text-[11px] font-bold uppercase tracking-wider">Sentinel AI</span>
                <span className="dark:text-white/60 text-slate-400 text-[11px] font-mono">{formatTime(message.timestamp)}</span>
              </div>
              <div
                className={`dark:bg-[#1a1a1a] bg-white dark:border-white/10 border-slate-200 dark:text-gray-200 text-slate-900 p-0 rounded-2xl rounded-tl-sm shadow-sm w-full relative overflow-hidden group ${
                  isSelected ? 'ring-2 ring-[#facc15]/30' : ''
                }`}
              >
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 ${
                    message.safetyScore && message.safetyScore < 0.5
                      ? 'bg-[#ef4444]'
                      : message.safetyScore && message.safetyScore < 0.7
                      ? 'bg-[#fb923c]'
                      : 'bg-[#10b981]'
                  }`}
                ></div>
                <div className="p-5">
                  <p className="leading-relaxed text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
                {/* Metadata Footer */}
                <div className="px-5 py-3 border-t dark:border-white/5 border-slate-200 dark:bg-white/[0.02] bg-slate-50 flex flex-wrap items-center gap-4">
                  {message.safetyScore !== undefined && (
                    <div className={`flex items-center gap-2 ${safetyBadge.bg} px-2.5 py-1 rounded-full border ${safetyBadge.border}`}>
                      <span className={`material-symbols-outlined ${safetyBadge.text} text-[16px]`}>
                        {safetyBadge.icon}
                      </span>
                      <span className={`text-xs font-bold ${safetyBadge.text} tracking-wide`}>
                        {message.safetyLabel || 'CLEAN'} ({(message.safetyScore * 100).toFixed(0)}%)
                      </span>
                    </div>
                  )}
                  {message.driftScore !== undefined && (
                    <>
                      <div className="h-4 w-px dark:bg-white/10 bg-slate-200"></div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] dark:text-white/40 text-slate-500 uppercase font-bold tracking-wider">Drift</span>
                        <div className="flex items-center gap-1">
                          <span className={`text-xs font-mono font-bold ${getDriftColor(message.driftScore)}`}>
                            +{(message.driftScore * 100).toFixed(0)}%
                          </span>
                          <DriftSparkline driftScore={message.driftScore} />
                        </div>
                      </div>
                    </>
                  )}
                  {!message.baselineReady && message.driftScore !== undefined && (
                    <>
                      <div className="h-4 w-px dark:bg-white/10 bg-slate-200"></div>
                      <div className="flex items-center gap-2 dark:text-white/50 text-slate-500">
                        <span className="text-[10px] uppercase font-bold dark:text-white/30 text-slate-400 tracking-wider">Status</span>
                        <span className="text-xs italic">⏳ Building baseline...</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {isLoading && (
          <div className="flex flex-col items-start gap-2 max-w-[85%]">
            <div className="dark:bg-[#1a1a1a] bg-white dark:border-white/10 border-slate-200 dark:text-gray-200 text-slate-900 p-5 rounded-2xl rounded-tl-sm shadow-sm">
              <div className="flex gap-2">
                <span className="w-2 h-2 bg-[#facc15] rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-[#facc15] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                <span className="w-2 h-2 bg-[#facc15] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </main>
  )
}

