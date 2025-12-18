interface Message {
  id: string
  requestId?: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  safetyScore?: number
  safetyLabel?: 'CLEAN' | 'TOXIC' | 'PII' | 'JAILBREAK' | 'PROMPT_INJECTION' | 'RISKY'
  driftScore?: number
  tokensIn?: number
  tokensOut?: number
  modelName?: string
}

interface TraceModalProps {
  isOpen: boolean
  onClose: () => void
  message: Message | null
}

export default function TraceModal({ isOpen, onClose, message }: TraceModalProps) {
  if (!isOpen || !message) return null

  const fullTrace = {
    requestId: message.requestId || message.id,
    timestamp: message.timestamp.toISOString(),
    role: message.role,
    content: message.content.substring(0, 200) + (message.content.length > 200 ? '...' : ''),
    metadata: {
      safetyScore: message.safetyScore,
      safetyLabel: message.safetyLabel,
      driftScore: message.driftScore,
      tokensIn: message.tokensIn,
      tokensOut: message.tokensOut,
      modelName: message.modelName,
    },
    trace: {
      gateway: {
        received: message.timestamp.toISOString(),
        processed: new Date(message.timestamp.getTime() + 100).toISOString(),
      },
      analyzer: {
        driftComputed: message.driftScore !== undefined,
        safetyChecked: message.safetyScore !== undefined,
      },
      datadog: {
        metricsEmitted: true,
        eventCreated: message.safetyScore && message.safetyScore < 0.5,
      },
    },
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="dark:bg-[#1a1a1a] bg-white dark:border-[#27272a] border-slate-200 border rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 dark:border-[#27272a] border-slate-200 border-b flex items-center justify-between">
          <h2 className="text-xl font-bold dark:text-white text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#facc15]">troubleshoot</span>
            Full Trace: {message.requestId || message.id}
          </h2>
          <button
            onClick={onClose}
            className="dark:text-[#a1a1aa] text-slate-500 hover:dark:text-white hover:text-slate-900 p-2 hover:dark:bg-white/5 hover:bg-slate-100 rounded-lg"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-6">
          <div className="dark:bg-[#0c0c0c] bg-slate-50 rounded-lg dark:border-[#27272a] border-slate-200 border font-mono text-sm p-4 overflow-x-auto shadow-inner">
            <pre className="dark:text-[#60a5fa] text-blue-700 whitespace-pre">
              {JSON.stringify(fullTrace, null, 2)}
            </pre>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(fullTrace, null, 2))
              }}
              className="px-4 py-2 dark:bg-[#27272a] bg-slate-200 hover:dark:bg-[#3f3f46] hover:bg-slate-300 dark:text-white text-slate-900 rounded-lg shadow-sm flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">content_copy</span>
              Copy Trace
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#facc15] hover:bg-[#fbbf24] text-black font-bold rounded-lg shadow-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

