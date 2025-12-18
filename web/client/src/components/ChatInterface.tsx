import { useState, useEffect, useMemo } from 'react'
import Sidebar from './Sidebar'
import ChatWindow from './ChatWindow'
import InspectorPanel from './InspectorPanel'
import LiveTicker from './LiveTicker'
import NewRuleModal from './NewRuleModal'
import TraceModal from './TraceModal'
import Dashboard from './Dashboard'
import AlertsView from './AlertsView'
import SettingsModal from './SettingsModal'
import { evaluateRules } from '../utils/rulesStorage'
import { saveMessages, loadMessages, saveFlaggedSessions, loadFlaggedSessions, saveSessionMessages, loadSessionMessages, getAllSessionIds, deleteSession } from '../utils/messageStorage'
import { getApiUrl } from '../config'

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

interface ChatResponse {
  requestId: string
  response: string
  tokensIn: number
  tokensOut: number
  modelName: string
  modelVersion: string
  safetyScore?: number
  safetyLabel?: 'CLEAN' | 'TOXIC' | 'PII' | 'JAILBREAK' | 'PROMPT_INJECTION' | 'RISKY'
  driftScore?: number
  baselineReady?: boolean
}

function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [activeView, setActiveView] = useState('sessions')
  const [modelName, setModelName] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewRuleModal, setShowNewRuleModal] = useState(false)
  const [showTraceModal, setShowTraceModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [flaggedSessions, setFlaggedSessions] = useState<Set<string>>(loadFlaggedSessions())
  const [ruleTriggered, setRuleTriggered] = useState<{ ruleName: string; action: string } | null>(null)
  const [sessionMessages, setSessionMessages] = useState<Map<string, Message[]>>(new Map())
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)

  // Load messages from localStorage on mount
  useEffect(() => {
    const savedMessages = loadMessages()
    if (savedMessages.length > 0) {
      setMessages(savedMessages)
      // Determine session ID from messages
      const sessionIdFromMessages = getSessionIdFromMessages(savedMessages)
      setCurrentSessionId(sessionIdFromMessages)
      setSessionMessages(prev => {
        const newMap = new Map(prev)
        newMap.set(sessionIdFromMessages, savedMessages)
        return newMap
      })
      // Also ensure it's saved in session storage
      saveSessionMessages(sessionIdFromMessages, savedMessages)
      // Auto-select last assistant message if available
      const lastAssistant = savedMessages.filter(m => m.role === 'assistant').pop()
      if (lastAssistant) {
        setSelectedMessage(lastAssistant)
      }
    }
    
    // Also load all other sessions into memory for quick access
    const allSessionIds = getAllSessionIds()
    allSessionIds.forEach(sessionId => {
      const sessionMsgs = loadSessionMessages(sessionId)
      if (sessionMsgs.length > 0) {
        setSessionMessages(prev => {
          const newMap = new Map(prev)
          newMap.set(sessionId, sessionMsgs)
          return newMap
        })
      }
    })
  }, [])

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      // Determine or set session ID
      let sessionIdToUse = currentSessionId
      if (!sessionIdToUse) {
        sessionIdToUse = getSessionIdFromMessages(messages)
        setCurrentSessionId(sessionIdToUse)
      }
      
      // Save to session-specific storage
      saveSessionMessages(sessionIdToUse, messages)
      // Also save as current messages for backward compatibility
      saveMessages(messages)
      // Store messages by session ID in memory for quick access
      setSessionMessages(prev => {
        const newMap = new Map(prev)
        newMap.set(sessionIdToUse, messages)
        return newMap
      })
    }
  }, [messages, currentSessionId])

  // Save flagged sessions to localStorage
  useEffect(() => {
    if (flaggedSessions.size > 0) {
      saveFlaggedSessions(flaggedSessions)
    }
  }, [flaggedSessions])

  // Get model name from last assistant message
  useEffect(() => {
    const lastAssistant = messages.filter(m => m.role === 'assistant').pop()
    if (lastAssistant?.modelName) {
      setModelName(lastAssistant.modelName)
    }
  }, [messages])

  // Filter messages based on search query
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages
    
    const query = searchQuery.toLowerCase()
    return messages.filter(msg => 
      msg.content.toLowerCase().includes(query) ||
      msg.id.toLowerCase().includes(query) ||
      msg.requestId?.toLowerCase().includes(query) ||
      msg.safetyLabel?.toLowerCase().includes(query) ||
      msg.modelName?.toLowerCase().includes(query)
    )
  }, [messages, searchQuery])

  // Get current session ID - use stored session ID or derive from first message
  const sessionId = currentSessionId || (messages.length > 0 ? getSessionIdFromMessages(messages) : 'new')
  const isSessionFlagged = flaggedSessions.has(sessionId)
  
  // Helper function to get consistent session ID from messages
  function getSessionIdFromMessages(msgs: Message[]): string {
    if (msgs.length === 0) return 'new'
    
    // Strategy: Find the first user message (which typically starts the session)
    // and use its ID's first 8 characters as the session ID
    const firstUserMsg = msgs.find(m => m.role === 'user')
    if (firstUserMsg) {
      // Use first 8 chars of first user message ID as session ID
      const sessionId = firstUserMsg.id.substring(0, 8)
      // Verify all messages belong to this session by checking if they share the same prefix
      // or if they're part of the same conversation (all messages should be close in time)
      const allMatch = msgs.every(m => {
        // Check if message ID starts with session ID (for user messages)
        // or if it's an assistant message that's part of the same conversation
        return m.id.substring(0, 8) === sessionId || 
               m.requestId?.substring(0, 8) === sessionId ||
               (m.role === 'assistant' && msgs.indexOf(m) > 0) // Assistant messages after first user message
      })
      if (allMatch) {
        return sessionId
      }
    }
    
    // Fallback: use first message's ID (could be assistant if restored incorrectly)
    // But try to find a common pattern
    const firstMsg = msgs[0]
    if (firstMsg.role === 'assistant' && firstMsg.requestId) {
      // If first is assistant, try to find related user message
      const relatedUser = msgs.find(m => m.role === 'user' && 
        Math.abs(m.timestamp.getTime() - firstMsg.timestamp.getTime()) < 60000) // Within 1 minute
      if (relatedUser) {
        return relatedUser.id.substring(0, 8)
      }
      // Use requestId prefix as fallback
      return firstMsg.requestId.substring(0, 8)
    }
    
    // Last resort: use first 8 chars of first message ID
    return firstMsg.id.substring(0, 8)
  }

  const handleFlagSession = () => {
    if (isSessionFlagged) {
      setFlaggedSessions(prev => {
        const newSet = new Set(prev)
        newSet.delete(sessionId)
        return newSet
      })
      console.log(`[FlagSession] Unflagged session ${sessionId}`)
    } else {
      setFlaggedSessions(prev => new Set(prev).add(sessionId))
      console.log(`[FlagSession] Flagged session ${sessionId}`)
      // In production, this would call an API endpoint
      // fetch(`/api/sessions/${sessionId}/flag`, { method: 'POST' })
    }
  }

  const handleNewSession = () => {
    if (messages.length === 0) return
    
    if (confirm('Start a new session? This will clear the current conversation.')) {
      // Save current session before clearing (if it has messages)
      if (messages.length > 0 && sessionId) {
        saveSessionMessages(sessionId, messages)
      }
      
      setMessages([])
      setSelectedMessage(null)
      setError(null)
      setSearchQuery('')
      setRuleTriggered(null)
      setCurrentSessionId(null) // Reset session ID for new session
      // Clear only current session from localStorage (preserve other sessions)
      localStorage.removeItem('llm-sentinel-messages')
      console.log('[ChatInterface] New session started, previous session saved')
    }
  }

  const handleNavigateToSession = (sessionId: string) => {
    // Switch to Sessions view
    setActiveView('sessions')
    // Clear search query so all messages are visible
    setSearchQuery('')
    
    // Try to restore messages from memory first
    const sessionMsgs = sessionMessages.get(sessionId)
    if (sessionMsgs && sessionMsgs.length > 0) {
      setMessages(sessionMsgs)
      setCurrentSessionId(sessionId)
      // Select the last assistant message if available
      const lastAssistant = sessionMsgs.filter(m => m.role === 'assistant').pop()
      if (lastAssistant) {
        setSelectedMessage(lastAssistant)
      }
      console.log(`[ChatInterface] Navigated to session ${sessionId} from memory (${sessionMsgs.length} messages)`)
      return
    }
    
    // If not in memory, load from session-specific storage
    const restoredMessages = loadSessionMessages(sessionId)
    if (restoredMessages.length > 0) {
      setMessages(restoredMessages)
      setCurrentSessionId(sessionId)
      // Store in session map for future access
      setSessionMessages(prev => {
        const newMap = new Map(prev)
        newMap.set(sessionId, restoredMessages)
        return newMap
      })
      const lastAssistant = restoredMessages.filter(m => m.role === 'assistant').pop()
      if (lastAssistant) {
        setSelectedMessage(lastAssistant)
      }
      console.log(`[ChatInterface] Restored session ${sessionId} from localStorage (${restoredMessages.length} messages)`)
      return
    }
    
    // Fallback: try to find messages with matching session ID prefix from all stored sessions
    const allSessionIds = getAllSessionIds()
    let foundMessages: Message[] = []
    for (const storedSessionId of allSessionIds) {
      if (storedSessionId.startsWith(sessionId) || sessionId.startsWith(storedSessionId)) {
        const msgs = loadSessionMessages(storedSessionId)
        if (msgs.length > 0) {
          foundMessages = msgs
          break
        }
      }
    }
    
    if (foundMessages.length > 0) {
      setMessages(foundMessages)
      setCurrentSessionId(sessionId)
      // Store in session map and save to session storage with correct ID
      setSessionMessages(prev => {
        const newMap = new Map(prev)
        newMap.set(sessionId, foundMessages)
        return newMap
      })
      saveSessionMessages(sessionId, foundMessages)
      const lastAssistant = foundMessages.filter(m => m.role === 'assistant').pop()
      if (lastAssistant) {
        setSelectedMessage(lastAssistant)
      }
      console.log(`[ChatInterface] Restored session ${sessionId} from stored sessions (${foundMessages.length} messages)`)
    } else {
      // No messages found
      console.warn(`[ChatInterface] Session ${sessionId} not found`)
      alert(`Session ${sessionId} not found. The session may have been cleared.`)
    }
  }
  
  const handleDeleteFlaggedSession = (sessionId: string) => {
    if (confirm(`Are you sure you want to delete flagged session ${sessionId}? This will remove all messages from this session.`)) {
      // Remove from flagged sessions
      setFlaggedSessions(prev => {
        const newSet = new Set(prev)
        newSet.delete(sessionId)
        return newSet
      })
      
      // Remove from session storage using utility function
      deleteSession(sessionId)
      
      // Remove from memory
      setSessionMessages(prev => {
        const newMap = new Map(prev)
        newMap.delete(sessionId)
        return newMap
      })
      
      // If this is the current session, clear it
      if (currentSessionId === sessionId) {
        setMessages([])
        setSelectedMessage(null)
        setCurrentSessionId(null)
      }
      
      console.log(`[ChatInterface] Deleted flagged session ${sessionId}`)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(getApiUrl('/api/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage.content }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.details || errorData.error || 'Failed to get response'
        
        // Handle rate limit errors (429) specially
        if (response.status === 429 || errorData.errorType === 'rate_limit') {
          const retryAfter = errorData.retryAfter || 60
          throw new Error(`Rate limit exceeded. Vertex AI is temporarily unavailable. Please wait ${retryAfter} seconds before trying again.`)
        }
        
        throw new Error(errorMessage)
      }

      const data: ChatResponse = await response.json()

      const assistantMessage: Message = {
        id: data.requestId,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        tokensIn: data.tokensIn,
        tokensOut: data.tokensOut,
        modelName: data.modelName,
        safetyScore: data.safetyScore,
        safetyLabel: data.safetyLabel,
        driftScore: data.driftScore,
        baselineReady: data.baselineReady,
        requestId: data.requestId,
      }

      setMessages((prev) => {
        const updated = [...prev, assistantMessage]
        // Ensure session ID is set when we add the first assistant message
        if (!currentSessionId && prev.length > 0) {
          const sessionId = getSessionIdFromMessages(updated)
          setCurrentSessionId(sessionId)
        }
        return updated
      })
      // Auto-select the new assistant message for inspector
      setSelectedMessage(assistantMessage)
      
      // Evaluate rules
      const ruleResult = evaluateRules(
        assistantMessage.safetyScore,
        assistantMessage.safetyLabel,
        assistantMessage.driftScore
      )
      
      if (ruleResult.matched && ruleResult.rule) {
        console.log(`[Rule] ${ruleResult.rule.name} triggered! Action: ${ruleResult.action}`)
        
        // Show visual feedback
        setRuleTriggered({
          ruleName: ruleResult.rule.name,
          action: ruleResult.action || 'Unknown',
        })
        
        // Auto-hide after 5 seconds
        setTimeout(() => setRuleTriggered(null), 5000)
        
        // Execute action based on rule
        if (ruleResult.action === 'Send Alert') {
          // Show browser notification if enabled
          if (Notification.permission === 'granted') {
            new Notification('LLM Sentinel Alert', {
              body: `Rule "${ruleResult.rule.name}" triggered: ${assistantMessage.safetyLabel || 'Safety issue detected'}`,
              icon: '/favicon.ico',
            })
          }
        } else if (ruleResult.action === 'Block Request') {
          // In production, this would prevent the response
          console.warn('[Rule] Request would be blocked in production')
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      setError(errorMessage)
      
      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${errorMessage}`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-1 h-full overflow-hidden dark:bg-[#0c0c0c] bg-slate-50">
      <Sidebar activeView={activeView} onViewChange={setActiveView} onSettingsClick={() => setShowSettingsModal(true)} />
      
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Header */}
        <header className="h-16 border-b dark:border-[#27272a] border-slate-200 dark:bg-[#1a1a1a]/80 bg-white/80 backdrop-blur-md flex items-center justify-between px-6 z-20 shrink-0 sticky top-0">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold tracking-tight dark:text-white text-slate-900 flex items-center gap-3">
              LLM Sentinel{' '}
              <span className="text-xs font-mono px-2 py-0.5 rounded dark:bg-[#1a1a1a] bg-slate-100 text-[#facc15] border border-[#facc15]/20">
                LIVE
              </span>
            </h1>
            <div className="hidden md:flex items-center gap-2 pl-4 border-l dark:border-[#27272a] border-slate-200 ml-2">
              <span className="flex h-2 w-2 rounded-full bg-[#10b981]"></span>
              <span className="text-xs dark:text-slate-400 text-slate-600">System Operational</span>
            </div>
          </div>
          <div className="flex items-center gap-4 flex-1 justify-end max-w-2xl">
            <div className="relative w-full max-w-md group hidden lg:block">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="material-symbols-outlined dark:text-slate-400 text-slate-500 text-lg group-focus-within:text-[#facc15] transition-colors">
                  search
                </span>
              </div>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-1.5 border dark:border-[#27272a] border-slate-200 rounded-md leading-5 dark:bg-[#1a1a1a] bg-white dark:text-slate-200 text-slate-900 dark:placeholder-slate-400 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#facc15] focus:border-[#facc15] sm:text-sm shadow-sm"
                placeholder="Search logs, session IDs, or IP addresses..."
                type="text"
              />
              <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                <span className="text-xs dark:text-slate-400 text-slate-500 dark:border-[#27272a] border-slate-200 px-1.5 py-0.5 rounded dark:bg-black/30 bg-slate-100">⌘K</span>
              </div>
            </div>
            <button
              onClick={() => setShowNewRuleModal(true)}
              className="hidden lg:flex items-center gap-2 bg-white text-black px-3 py-1.5 rounded-md text-sm font-bold hover:bg-gray-200 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              New Rule
            </button>
          </div>
        </header>

        {/* Main Content Area - 70/30 Split */}
        <div className="flex-1 flex overflow-hidden relative">
          {activeView === 'sessions' ? (
            <>
              <ChatWindow
                messages={filteredMessages}
                isLoading={isLoading}
                onMessageSelect={setSelectedMessage}
                selectedMessageId={selectedMessage?.id}
                searchQuery={searchQuery}
                sessionId={sessionId}
                isFlagged={isSessionFlagged}
                onFlagSession={handleFlagSession}
                onNewSession={handleNewSession}
              />
              <InspectorPanel 
                selectedMessage={selectedMessage} 
                modelName={modelName}
                onViewTrace={() => setShowTraceModal(true)}
              />
            </>
          ) : activeView === 'dashboard' ? (
            <Dashboard messages={messages} flaggedSessions={flaggedSessions} />
          ) : activeView === 'alerts' ? (
            <AlertsView 
              messages={messages} 
              flaggedSessions={flaggedSessions}
              onNavigateToSession={handleNavigateToSession}
              onDeleteFlaggedSession={handleDeleteFlaggedSession}
            />
          ) : null}
        </div>

        {/* Input Area */}
        <div className="shrink-0 p-4 dark:bg-[#0c0c0c] bg-white border-t dark:border-white/10 border-slate-200 shadow-sm">
          {ruleTriggered && (
            <div className="mb-3 p-3 bg-[#facc15]/10 border border-[#facc15]/30 text-[#facc15] rounded-lg text-sm flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">rule</span>
                <span>
                  <strong>Rule Triggered:</strong> {ruleTriggered.ruleName} → {ruleTriggered.action}
                </span>
              </div>
              <button
                onClick={() => setRuleTriggered(null)}
                className="material-symbols-outlined text-lg hover:bg-[#facc15]/20 rounded p-1"
              >
                close
              </button>
            </div>
          )}
          {error && (
            <div className={`mb-3 p-3 border rounded-lg text-sm flex items-center justify-between ${
              error.includes('Rate limit') || error.includes('429')
                ? 'bg-[#fb923c]/10 border-[#fb923c]/20 text-[#fb923c]'
                : 'bg-[#ef4444]/10 border-[#ef4444]/20 text-[#ef4444]'
            }`}>
              <div className="flex items-start gap-2 flex-1">
                <span className="material-symbols-outlined text-lg mt-0.5">
                  {error.includes('Rate limit') || error.includes('429') ? 'schedule' : 'error'}
                </span>
                <div className="flex-1">
                  <span className="font-semibold block mb-1">
                    {error.includes('Rate limit') || error.includes('429') ? 'Rate Limit Exceeded' : 'Error'}
                  </span>
                  <span className="text-xs opacity-90">{error}</span>
                </div>
              </div>
              <button
                onClick={() => setError(null)}
                className={`material-symbols-outlined text-lg hover:bg-white/10 rounded p-1 ml-2`}
              >
                close
              </button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                disabled={isLoading}
                className="w-full dark:bg-[#1a1a1a] bg-white dark:border-white/10 border-slate-200 dark:text-white text-slate-900 dark:placeholder-white/30 placeholder-slate-400 rounded-xl py-3.5 pl-4 pr-12 focus:outline-none focus:border-[#facc15]/50 focus:ring-1 focus:ring-[#facc15]/50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-[#facc15] hover:bg-[#fbbf24] disabled:bg-white/5 disabled:text-white/20 text-black rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[20px]">send</span>
              </button>
            </div>
          </form>
        </div>

        {/* Live Ticker */}
        <LiveTicker 
          messages={messages}
          onLogClick={(messageId, sessionId) => {
            if (sessionId) {
              handleNavigateToSession(sessionId)
            } else if (messageId) {
              // Find the message and select it
              const msg = messages.find(m => m.id === messageId || m.requestId === messageId)
              if (msg) {
                setActiveView('sessions')
                setSelectedMessage(msg)
                setSearchQuery('') // Clear search to show all messages
              }
            }
          }}
        />
      </div>

      {/* Modals */}
      <NewRuleModal 
        isOpen={showNewRuleModal} 
        onClose={() => setShowNewRuleModal(false)}
        onRuleCreated={() => {
          // Rules are stored in localStorage, no need to refresh
          console.log('[ChatInterface] Rule created, stored in localStorage')
        }}
      />
      <TraceModal isOpen={showTraceModal} onClose={() => setShowTraceModal(false)} message={selectedMessage} />
      <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
    </div>
  )
}

export default ChatInterface
