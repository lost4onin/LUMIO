import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { apiClient } from '../../lib/api'
import CVModule from '../../components/CVModule'
import FocusBar from '../../components/FocusBar'
import { FocusPayload } from '../../types'

type Subject = 'Math' | 'Science' | 'Language' | 'History' | 'Other'

export const SessionPage: React.FC = () => {
  // Auth state
  const { user } = useAuth()
  const studentId = user?.id || ''

  // Session state
  const [sessionActive, setSessionActive] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [selectedSubject, setSelectedSubject] = useState<Subject>('Math')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // Focus tracking state
  const [currentFocusScore, setCurrentFocusScore] = useState(0.5)
  const [currentCause, setCurrentCause] = useState<string>('')

  // Webcam state
  const [webcamActive, setWebcamActive] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout

    if (sessionActive) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1)
      }, 1000)
    }

    return () => clearInterval(interval)
  }, [sessionActive])

  // Format elapsed time as mm:ss
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Handle focus data from CVModule
  const handleFocusData = useCallback((payload: FocusPayload) => {
    setCurrentFocusScore(payload.focus_score)
    // Cause label would come from the backend classification
    // For now, we show a simplified label based on focus score
  }, [])

  // Start session
  const handleStartSession = async () => {
    if (!studentId) {
      console.error('Student ID not available')
      return
    }

    try {
      const response = await apiClient.post<{ session_id: string }>(
        '/sessions/start',
        {
          student_id: studentId,
          subject: selectedSubject
        }
      )

      if (response.data.session_id) {
        setSessionId(response.data.session_id)
        setSessionActive(true)
        setElapsedSeconds(0)
        setCurrentFocusScore(0.5)
        setCurrentCause('')

        // Start webcam
        await startWebcam()
      }
    } catch (error) {
      console.error('Failed to start session:', error)
    }
  }

  // End session
  const handleStopSession = async () => {
    if (!sessionId) {
      console.error('Session ID not available')
      return
    }

    try {
      await apiClient.post('/sessions/end', {
        session_id: sessionId
      })

      setSessionActive(false)
      setSessionId(null)
      setElapsedSeconds(0)

      // Stop webcam
      stopWebcam()
    } catch (error) {
      console.error('Failed to end session:', error)
    }
  }

  // Start webcam
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 160 },
          height: { ideal: 120 },
          facingMode: 'user'
        },
        audio: false
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setWebcamActive(true)
      }
    } catch (error) {
      console.error('Failed to access webcam:', error)
    }
  }

  // Stop webcam
  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setWebcamActive(false)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopWebcam()
    }
  }, [])

  // Subject options
  const subjects: Subject[] = ['Math', 'Science', 'Language', 'History', 'Other']

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-white">Session</h1>
          <div className="text-3xl font-mono font-bold text-emerald-400">
            {formatTime(elapsedSeconds)}
          </div>
        </div>

        {/* Webcam preview in top-right */}
        {webcamActive && (
          <div className="rounded-lg overflow-hidden border border-slate-600 bg-slate-700">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              width={160}
              height={120}
              className="block"
            />
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="px-6 py-8 max-w-4xl mx-auto">
        {/* Subject selector */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Select Subject
          </label>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value as Subject)}
            disabled={sessionActive}
            className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white font-medium hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {subjects.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </select>
        </div>

        {/* Start/Stop button */}
        <div className="mb-12">
          {!sessionActive ? (
            <button
              onClick={handleStartSession}
              className="w-full px-6 py-4 rounded-lg bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white font-bold text-lg transition transform hover:scale-105 active:scale-95 shadow-lg"
            >
              Start Session
            </button>
          ) : (
            <button
              onClick={handleStopSession}
              className="w-full px-6 py-4 rounded-lg bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-bold text-lg transition transform hover:scale-105 active:scale-95 shadow-lg"
            >
              Stop Session
            </button>
          )}
        </div>

        {/* Status text */}
        <div className="mb-8 h-6">
          {sessionActive ? (
            <p className="text-emerald-400 font-semibold text-center">
              ✓ Session active — focus is being tracked
            </p>
          ) : (
            <p className="text-slate-400 font-semibold text-center">
              Session paused
            </p>
          )}
        </div>

        {/* Focus Bar section */}
        {sessionActive && (
          <div className="mb-12">
            <h2 className="text-lg font-semibold text-white mb-4">Focus Level</h2>
            <FocusBar
              focusScore={currentFocusScore}
              causeLabel={currentCause || undefined}
              className="mt-4"
            />
          </div>
        )}

        {/* CVModule - headless, only processes when active */}
        {sessionActive && sessionId && (
          <div className="hidden">
            <CVModule
              studentId={studentId}
              classId={sessionId}
              onFocusData={handleFocusData}
              active={true}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default SessionPage
