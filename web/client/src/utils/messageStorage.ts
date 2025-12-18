export interface Message {
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

const MESSAGES_STORAGE_KEY = 'llm-sentinel-messages'
const SESSIONS_STORAGE_KEY = 'llm-sentinel-sessions' // Store all sessions by ID
const FLAGGED_SESSIONS_KEY = 'llm-sentinel-flagged-sessions'

// Save messages for a specific session
export function saveSessionMessages(sessionId: string, messages: Message[]): void {
  try {
    // Load all sessions
    const allSessions = loadAllSessions()
    
    // Convert Date objects to ISO strings for storage
    const serialized = messages.map(msg => ({
      ...msg,
      timestamp: msg.timestamp.toISOString(),
    }))
    
    // Update this session's messages
    allSessions[sessionId] = serialized
    
    // Save all sessions back
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(allSessions))
    
    // Also save current session for backward compatibility
    if (messages.length > 0) {
      localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(serialized))
    }
  } catch (error) {
    console.error('[MessageStorage] Failed to save session messages:', error)
  }
}

// Load messages for a specific session
export function loadSessionMessages(sessionId: string): Message[] {
  try {
    const allSessions = loadAllSessions()
    const sessionData = allSessions[sessionId]
    if (!sessionData) return []
    
    // Convert ISO strings back to Date objects
    return sessionData.map((msg: Omit<Message, 'timestamp'> & { timestamp: string }) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    }))
  } catch (error) {
    console.error('[MessageStorage] Failed to load session messages:', error)
    return []
  }
}

// Load all sessions from storage
function loadAllSessions(): Record<string, Array<Omit<Message, 'timestamp'> & { timestamp: string }>> {
  try {
    const stored = localStorage.getItem(SESSIONS_STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch (error) {
    console.error('[MessageStorage] Failed to load all sessions:', error)
    return {}
  }
}

// Get all session IDs
export function getAllSessionIds(): string[] {
  try {
    const allSessions = loadAllSessions()
    return Object.keys(allSessions)
  } catch (error) {
    console.error('[MessageStorage] Failed to get session IDs:', error)
    return []
  }
}

// Delete a session and its messages
export function deleteSession(sessionId: string): void {
  try {
    const allSessions = loadAllSessions()
    delete allSessions[sessionId]
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(allSessions))
    console.log(`[MessageStorage] Deleted session ${sessionId}`)
  } catch (error) {
    console.error('[MessageStorage] Failed to delete session:', error)
  }
}

// Backward compatibility: save current messages (for current session)
export function saveMessages(messages: Message[]): void {
  if (messages.length === 0) return
  
  try {
    const currentSessionId = messages[0]?.id.substring(0, 8) || 'new'
    saveSessionMessages(currentSessionId, messages)
  } catch (error) {
    console.error('[MessageStorage] Failed to save messages:', error)
  }
}

// Backward compatibility: load current messages
export function loadMessages(): Message[] {
  try {
    // Try to load from current session key first (backward compatibility)
    const stored = localStorage.getItem(MESSAGES_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as Array<Omit<Message, 'timestamp'> & { timestamp: string }>
      return parsed.map((msg) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }))
    }
    
    // If no current session, return empty array
    return []
  } catch (error) {
    console.error('[MessageStorage] Failed to load messages:', error)
    return []
  }
}

export function saveFlaggedSessions(sessions: Set<string>): void {
  try {
    localStorage.setItem(FLAGGED_SESSIONS_KEY, JSON.stringify(Array.from(sessions)))
  } catch (error) {
    console.error('[MessageStorage] Failed to save flagged sessions:', error)
  }
}

export function loadFlaggedSessions(): Set<string> {
  try {
    const stored = localStorage.getItem(FLAGGED_SESSIONS_KEY)
    return stored ? new Set(JSON.parse(stored)) : new Set()
  } catch (error) {
    console.error('[MessageStorage] Failed to load flagged sessions:', error)
    return new Set()
  }
}

