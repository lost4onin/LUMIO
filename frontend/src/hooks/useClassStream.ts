import { useEffect, useRef, useCallback, useState } from 'react'
import { apiClient } from '../lib/api'
import { FocusPayload } from '../types'

export interface StudentLiveData extends FocusPayload {
  student_id: string
  student_name: string
  risk_tier: 'low' | 'moderate' | 'needs_attention'
  distraction_cause: string
  updated_at: number
}

interface UseClassStreamReturn {
  studentsLive: Record<string, StudentLiveData>
  connectionState: 'connecting' | 'open' | 'closed'
  isInitializing: boolean
}

interface StudentInitData {
  id: string
  name: string
  risk_tier?: 'low' | 'moderate' | 'needs_attention'
}

const useClassStream = (classId: string): UseClassStreamReturn => {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectCountRef = useRef<number>(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [connectionState, setConnectionState] = useState<'connecting' | 'open' | 'closed'>(
    'closed'
  )
  const [studentsLive, setStudentsLive] = useState<Record<string, StudentLiveData>>({})
  const [isInitializing, setIsInitializing] = useState(true)

  const MAX_RETRIES = 3
  const INITIAL_RECONNECT_DELAY = 1000 // 1 second

  // Get WebSocket URL
  const getWebSocketURL = useCallback((): string => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
    const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws'
    const host = apiUrl.replace(/^https?:\/\//, '').split(':')[0]
    const wsHost = apiUrl.includes('localhost') ? 'localhost:8000' : host

    return `${wsProtocol}://${wsHost}/ws/class/${classId}`
  }, [classId])

  // Fetch initial student list
  const fetchInitialStudents = useCallback(async () => {
    try {
      const response = await apiClient.get<{ students: StudentInitData[] }>(
        `/classes/${classId}/students`
      )

      if (response.data.students) {
        const initialData: Record<string, StudentLiveData> = {}

        for (const student of response.data.students) {
          initialData[student.id] = {
            student_id: student.id,
            student_name: student.name,
            risk_tier: student.risk_tier || 'low',
            focus_score: 0.5,
            blink_rate: 0,
            head_pose_deg: 0,
            gaze_x: 0.5,
            gaze_y: 0.5,
            distraction_cause: '',
            ts: Date.now(),
            updated_at: Date.now()
          }
        }

        setStudentsLive(initialData)
        console.log(`[CLASS STREAM] Initialized ${Object.keys(initialData).length} students`)
      }
    } catch (error) {
      console.error('[CLASS STREAM] Failed to fetch initial students:', error)
    } finally {
      setIsInitializing(false)
    }
  }, [classId])

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current) return

    setConnectionState('connecting')

    try {
      const wsUrl = getWebSocketURL()
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log(`[CLASS STREAM] Connected to ${wsUrl}`)
        setConnectionState('open')
        reconnectCountRef.current = 0
      }

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data)

          // Update or add student live data
          setStudentsLive((prev) => ({
            ...prev,
            [payload.student_id]: {
              ...payload,
              updated_at: Date.now(),
              // Preserve name and risk_tier if not included in payload
              student_name: payload.student_name || prev[payload.student_id]?.student_name || '',
              risk_tier: payload.risk_tier || prev[payload.student_id]?.risk_tier || 'low',
              distraction_cause: payload.distraction_cause || ''
            }
          }))
        } catch (err) {
          console.error('[CLASS STREAM] Failed to parse message:', err)
        }
      }

      ws.onerror = (event) => {
        console.error('[CLASS STREAM] WebSocket error:', event)
        setConnectionState('closed')
      }

      ws.onclose = () => {
        console.log('[CLASS STREAM] WebSocket closed, attempting reconnect...')
        setConnectionState('closed')
        wsRef.current = null

        // Auto-reconnect with exponential backoff: 1s, 2s, 4s
        if (reconnectCountRef.current < MAX_RETRIES) {
          reconnectCountRef.current += 1
          const delayMs = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectCountRef.current - 1)

          console.log(
            `[CLASS STREAM] Reconnection attempt ${reconnectCountRef.current}/${MAX_RETRIES} in ${delayMs}ms`
          )

          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, delayMs)
        } else {
          console.error('[CLASS STREAM] Max reconnection attempts reached')
        }
      }

      wsRef.current = ws
    } catch (error) {
      console.error('[CLASS STREAM] Failed to create WebSocket:', error)
      setConnectionState('closed')
    }
  }, [getWebSocketURL])

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

  // Lifecycle: Fetch initial data and connect on mount
  useEffect(() => {
    setIsInitializing(true)

    // Fetch initial student list
    fetchInitialStudents().then(() => {
      // Then connect to WebSocket
      connect()
    })

    return () => {
      disconnect()
    }
  }, [classId, fetchInitialStudents, connect, disconnect])

  return {
    studentsLive,
    connectionState,
    isInitializing
  }
}

export default useClassStream
