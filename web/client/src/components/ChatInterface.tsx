import { useState, useRef, useEffect } from 'react'
import './ChatInterface.css'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  tokensIn?: number
  tokensOut?: number
  modelName?: string
}

interface ChatResponse {
  requestId: string
  response: string
  tokensIn: number
  tokensOut: number
  modelName: string
  modelVersion: string
}

function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

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
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage.content }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.details || errorData.error || 'Failed to get response')
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
      }

      setMessages((prev) => [...prev, assistantMessage])
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
    <div className="chat-interface">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="welcome-message">
            <h2>Welcome to LLM Drift & Abuse Sentinel</h2>
            <p>Start a conversation with the LLM. Your interactions are monitored for drift and safety issues.</p>
          </div>
        )}
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role}`}>
            <div className="message-content">
              <div className="message-header">
                <span className="message-role">{message.role === 'user' ? 'You' : 'Assistant'}</span>
                <span className="message-time">
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </div>
              <div className="message-text">{message.content}</div>
              {message.role === 'assistant' && message.modelName && (
                <div className="message-meta">
                  <span>Model: {message.modelName}</span>
                  {message.tokensIn !== undefined && message.tokensOut !== undefined && (
                    <span>
                      Tokens: {message.tokensIn} in / {message.tokensOut} out
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message assistant">
            <div className="message-content">
              <div className="loading-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form className="chat-input-form" onSubmit={handleSubmit}>
        {error && (
          <div className="error-banner">
            {error}
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}
        <div className="input-container">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            className="chat-input"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="send-button"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default ChatInterface

