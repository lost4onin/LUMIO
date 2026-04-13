import React, { useState, useRef, useEffect, useCallback } from 'react'
import { apiClient } from '../lib/api'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: string[]
  timestamp: number
}

interface RagResponse {
  answer: string
  sources: string[]
}

interface ChatInterfaceProps {
  endpoint: string
  studentId?: string
  onSuggestFill?: (callback: (text: string) => void) => void
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ endpoint, studentId, onSuggestFill }) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (onSuggestFill) {
      onSuggestFill((text: string) => {
        setInputValue(text)
        setTimeout(() => inputRef.current?.focus(), 0)
      })
    }
  }, [onSuggestFill])

  const handleSendMessage = useCallback(
    async (messageText?: string) => {
      const textToSend = messageText !== undefined ? messageText : inputValue.trim()
      if (!textToSend) return

      const userMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: textToSend,
        timestamp: Date.now()
      }

      setMessages((prev) => [...prev, userMessage])
      if (messageText === undefined) setInputValue('')
      setError('')
      setIsLoading(true)

      try {
        const response = await apiClient.post<RagResponse>(endpoint, {
          message: textToSend,
          student_id: studentId
        })

        const assistantMessage: Message = {
          id: `msg-${Date.now()}-response`,
          role: 'assistant',
          content: response.data.answer,
          sources: response.data.sources || [],
          timestamp: Date.now()
        }

        setMessages((prev) => [...prev, assistantMessage])
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to send message'
        setError(errorMsg)
        console.error('Chat error:', err)
      } finally {
        setIsLoading(false)
      }
    },
    [inputValue, endpoint, studentId]
  )

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const toggleSources = (messageId: string) => {
    setExpandedSources((prev) => ({
      ...prev,
      [messageId]: !prev[messageId]
    }))
  }

  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 0)
  }, [messages])

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted">
            <p className="text-center font-mono text-sm">Start a conversation about your class or a specific student</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id}>
              {/* Message bubble */}
              <div
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                } mb-3`}
              >
                <div
                  className={`max-w-xs lg:max-w-md xl:max-w-lg px-6 py-4 border-[1.5px] ${
                    message.role === 'user'
                      ? 'bg-accent border-accent text-bg'
                      : 'bg-surface border-border text-ink'
                  }`}
                  style={{ borderRadius: '12px' }}
                >
                  <p className="text-sm font-mono whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>

              {/* Sources section */}
              {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                <div className="flex justify-start mb-4">
                  <div className="max-w-xs lg:max-w-md xl:max-w-lg">
                    <button
                      onClick={() => toggleSources(message.id)}
                      className="text-xs text-accent hover:text-accent/80 font-mono font-bold flex items-center gap-2 transition"
                      style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
                    >
                      <span>{expandedSources[message.id] ? '▼' : '▶'}</span>
                      Sources ({message.sources.length})
                    </button>

                    {expandedSources[message.id] && (
                      <div className="mt-3 space-y-2 pl-4 border-l-[1.5px] border-border">
                        {message.sources.map((source, idx) => (
                          <p key={idx} className="text-xs text-muted font-mono">
                            ✦ {source}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-surface border-[1.5px] border-border px-6 py-4" style={{ borderRadius: '12px' }}>
              <div className="flex gap-3">
                <div className="w-2 h-2 bg-ink rounded-full" style={{ animation: 'pulse 0.7s infinite' }}></div>
                <div className="w-2 h-2 bg-ink rounded-full" style={{ animation: 'pulse 0.7s infinite 0.1s' }}></div>
                <div className="w-2 h-2 bg-ink rounded-full" style={{ animation: 'pulse 0.7s infinite 0.2s' }}></div>
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border-[1.5px] border-red-600 p-4">
            <p className="text-xs text-red-600 font-mono">{error}</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-border bg-surface p-6">
        <div className="flex gap-4">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything..."
            disabled={isLoading}
            className="input-field flex-1"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={isLoading || !inputValue.trim()}
            className="btn-accent whitespace-nowrap"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChatInterface
