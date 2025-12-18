import { useEffect, useState, useRef } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  safetyScore?: number
  safetyLabel?: string
  tokensIn?: number
  tokensOut?: number
  requestId?: string
}

interface LiveTickerProps {
  messages: Message[]
  onLogClick?: (messageId?: string, sessionId?: string) => void
}

export default function LiveTicker({ messages, onLogClick }: LiveTickerProps) {
  const [logEntries, setLogEntries] = useState<Array<{ text: string; messageId?: string; sessionId?: string }>>([])
  const loggedMessageIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    // Only generate logs for new messages (not already logged)
    const newLogs: Array<{ text: string; messageId?: string; sessionId?: string }> = []
    const loggedIds = loggedMessageIdsRef.current
    
    messages.forEach((msg) => {
      // Skip if we've already logged this message
      if (loggedIds.has(msg.id)) {
        return
      }
      
      const timestamp = msg.timestamp.toISOString()
      const sessionId = msg.id.substring(0, 8)
      
      if (msg.role === 'user') {
        newLogs.push({
          text: `[INFO] ${timestamp} Gateway received request ${sessionId}... (${msg.content.length} chars)`,
          messageId: msg.id,
          sessionId,
        })
        loggedIds.add(msg.id)
      } else if (msg.role === 'assistant') {
        if (msg.safetyScore !== undefined && msg.safetyScore < 0.5) {
          newLogs.push({
            text: `[WARN] ${timestamp} Safety check: ${msg.safetyLabel || 'RISKY'} detected (score: ${(msg.safetyScore * 100).toFixed(0)}%)`,
            messageId: msg.id,
            sessionId,
          })
        } else {
          newLogs.push({
            text: `[INFO] ${timestamp} Response generated: ${msg.tokensIn || 0} in, ${msg.tokensOut || 0} out tokens`,
            messageId: msg.id,
            sessionId,
          })
        }
        loggedIds.add(msg.id)
        
        if (msg.safetyLabel === 'PROMPT_INJECTION' || msg.safetyLabel === 'JAILBREAK') {
          newLogs.push({
            text: `[ALERT] ${timestamp} Sentinel Policy triggered: Blocked ${msg.safetyLabel} attempt`,
            messageId: msg.id,
            sessionId,
          })
        }
      }
    })

    // Add system log only once when first message arrives
    if (messages.length > 0 && !loggedIds.has('__system_init__')) {
      newLogs.push({
        text: `[DEBUG] ${new Date().toISOString()} Tokenizer warm-up complete. Model loaded.`,
      })
      loggedIds.add('__system_init__')
    }

    if (newLogs.length > 0) {
      setLogEntries((prev) => [...prev, ...newLogs].slice(-20)) // Keep last 20 logs
    }
  }, [messages])

  // Add periodic system logs
  useEffect(() => {
    const interval = setInterval(() => {
      setLogEntries((prev) => [
        ...prev,
        { text: `[INFO] ${new Date().toISOString()} Gateway connection established (tls_v1.3)` },
      ].slice(-20))
    }, 30000) // Every 30 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <footer className="h-10 dark:bg-[#1a1a1a] bg-slate-100 border-t dark:border-[#27272a] border-slate-200 flex items-center shrink-0 overflow-hidden relative z-20">
      <div className="px-5 bg-[#facc15] h-full flex items-center justify-center text-black text-xs font-bold font-mono shrink-0 z-30 shadow-[4px_0_15px_rgba(0,0,0,0.5)]">
        <span className="relative flex h-2 w-2 mr-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-black opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-black"></span>
        </span>
        LIVE LOGS
      </div>
      <div className="flex items-center gap-8 px-4 w-full h-full text-[11px] font-mono dark:bg-[#0c0c0c] bg-white relative overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-8 dark:bg-gradient-to-r dark:from-[#0c0c0c] bg-gradient-to-r from-white to-transparent z-10"></div>
        <div className="absolute inset-y-0 right-0 w-8 dark:bg-gradient-to-l dark:from-[#0c0c0c] bg-gradient-to-l from-white to-transparent z-10"></div>
        <div className="flex gap-16 items-center whitespace-nowrap animate-[marquee_60s_linear_infinite] hover:[animation-play-state:paused]">
          {logEntries.length === 0 ? (
            <span className="dark:text-white/30 text-slate-500 flex items-center gap-3">
              <span className="text-[#10b981] font-bold">INFO</span>
              <span>Waiting for activity...</span>
            </span>
          ) : (
            logEntries.map((logEntry, idx) => {
              const level = logEntry.text.match(/\[(\w+)\]/)?.[1] || 'INFO'
              const colorMap: Record<string, string> = {
                INFO: 'text-[#10b981]',
                WARN: 'text-[#ef4444]',
                ALERT: 'text-[#facc15]',
                DEBUG: 'text-[#60a5fa]',
                ERROR: 'text-[#ef4444]',
              }
              const isClickable = logEntry.messageId || logEntry.sessionId
              return (
                <span 
                  key={idx} 
                  onClick={() => {
                    if (isClickable && onLogClick) {
                      onLogClick(logEntry.messageId, logEntry.sessionId)
                    }
                  }}
                  className={`dark:text-white/70 text-slate-700 flex items-center gap-3 ${
                    isClickable ? 'cursor-pointer hover:dark:text-white hover:text-slate-900 hover:underline transition-all' : 'cursor-default'
                  }`}
                  title={isClickable ? 'Click to view session' : undefined}
                >
                  <span className={`${colorMap[level] || 'dark:text-white/50 text-slate-500'} font-bold`}>[{level}]</span>
                  <span className="dark:text-white/50 text-slate-600">{logEntry.text.split('] ')[1]}</span>
                </span>
              )
            })
          )}
        </div>
      </div>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-100%); }
        }
        .animate-\\[marquee_60s_linear_infinite\\] {
          animation: marquee 60s linear infinite;
        }
      `}</style>
    </footer>
  )
}

