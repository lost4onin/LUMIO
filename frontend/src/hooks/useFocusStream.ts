import { useEffect, useRef, useCallback, useState } from 'react'
import { FocusPayload } from '../types'

interface UseFocusStreamReturn {
  sendFocus: (payload: FocusPayload) => void
  connectionState: 'connecting' | 'open' | 'closed'
}

const useFocusStream = (
  studentId: string,
  classId: string,
  active: boolean
): UseFocusStreamReturn => {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectCountRef = useRef<number>(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [connectionState, setConnectionState] = useState<'connecting' | 'open' | 'closed'>('closed')

  const MAX_RETRIES = 5
  const RECONNECT_DELAY = 2000 // 2 seconds

  // Get WebSocket URL
  const getWebSocketURL = useCallback((): string => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
    const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws'
    const host = apiUrl.replace(/^https?:\/\//, '').split(':')[0]
    const wsHost = apiUrl.includes('localhost') ? 'localhost:8000' : host

    return `${wsProtocol}://${wsHost}/ws/focus/${studentId}`
  }, [studentId])

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current) return

    setConnectionState('connecting')

    try {
      const wsUrl = getWebSocketURL()
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log(`[FOCUS STREAM] Connected to ${wsUrl}`)
        setConnectionState('open')
        reconnectCountRef.current = 0
      }

      ws.onerror = (event) => {
        console.error('[FOCUS STREAM] WebSocket error:', event)
        setConnectionState('closed')
      }

      ws.onclose = () => {
        console.log('[FOCUS STREAM] WebSocket closed, attempting reconnect...')
        setConnectionState('closed')
        wsRef.current = null

        // Auto-reconnect with exponential backoff
        if (reconnectCountRef.current < MAX_RETRIES && active) {
          reconnectCountRef.current += 1
          console.log(
            `[FOCUS STREAM] Reconnection attempt ${reconnectCountRef.current}/${MAX_RETRIES}`
          )

          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, RECONNECT_DELAY)
        } else if (reconnectCountRef.current >= MAX_RETRIES) {
          console.error('[FOCUS STREAM] Max reconnection attempts reached')
        }
      }

      wsRef.current = ws
    } catch (error) {
      console.error('[FOCUS STREAM] Failed to create WebSocket:', error)
      setConnectionState('closed')
    }
  }, [active, getWebSocketURL])

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    setConnectionState('closed')
    reconnectCountRef.current = 0
  }, [])

  // Send focus data with class_id appended
  const sendFocus = useCallback(
    (payload: FocusPayload) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.warn('[FOCUS STREAM] WebSocket not connected, skipping send')
        return
      }

      const enrichedPayload = {
        ...payload,
        class_id: classId
      }

      try {
        wsRef.current.send(JSON.stringify(enrichedPayload))
      } catch (error) {
        console.error('[FOCUS STREAM] Failed to send focus data:', error)
      }
    },
    [classId]
  )

  // Lifecycle: connect/disconnect based on active state
  useEffect(() => {
    if (active) {
      connect()
    } else {
      disconnect()
    }

    return () => {
      // Cleanup on unmount
      if (!active) {
        disconnect()
      }
    }
  }, [active, connect, disconnect])

  return {
    sendFocus,
    connectionState
  }
}

export default useFocusStream
