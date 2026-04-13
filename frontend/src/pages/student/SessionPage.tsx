import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useCauseLabel, FocusEvent } from '../../hooks/useCauseLabel'
import { useInterval } from '../../hooks/useInterval'
import { apiClient } from '../../lib/api'
import CVModule from '../../components/CVModule'
import FocusBar from '../../components/FocusBar'
import { FocusPayload } from '../../types'

type Subject = 'Math' | 'Science' | 'Language' | 'History' | 'Other'

export const SessionPage: React.FC = () => {
  const { user } = useAuth()
  const studentId = user?.id || ''

  const [sessionActive, setSessionActive] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [selectedSubject, setSelectedSubject] = useState<Subject>('Math')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  const [currentFocusScore, setCurrentFocusScore] = useState(0.5)
  const [currentCause, setCurrentCause] = useState<string>('')
  const [apiError, setApiError] = useState<string>('')
  const [webcamError, setWebcamError] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const [webcamActive, setWebcamActive] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const focusPayloadRef = useRef<FocusPayload | null>(null)

  const { cause, confidence, pushFocusEvent } = useCauseLabel()

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (sessionActive) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [sessionActive])

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleFocusData = useCallback((payload: FocusPayload) => {
    focusPayloadRef.current = payload
    const focusEvent: FocusEvent = {
      focus_score: payload.focus_score,
      timestamp: payload.ts,
      blink_rate: payload.blink_rate,
      head_pose_x: payload.head_pose_deg,
      gaze_score: payload.focus_score
    }
    pushFocusEvent(focusEvent)
  }, [pushFocusEvent])

  const handleUpdateFocusScore = useCallback(() => {
    if (focusPayloadRef.current) {
      setCurrentFocusScore(focusPayloadRef.current.focus_score)
    }
  }, [])

  useInterval(handleUpdateFocusScore, sessionActive ? 1000 : null, [sessionActive])

  useEffect(() => {
    if (cause) setCurrentCause(cause)
  }, [cause])

  const handleStartSession = async () => {
    if (!studentId) { setApiError('Student ID not available'); return }
    if (isLoading) { setApiError('Request already in progress, please wait...'); return }

    setIsLoading(true)
    setApiError('')

    try {
      const response = await apiClient.post<{ session_id: string }>('/sessions/start', {
        student_id: studentId,
        subject: selectedSubject
      })

      if (response.data.session_id) {
        setSessionId(response.data.session_id)
        setSessionActive(true)
        setElapsedSeconds(0)
        setCurrentFocusScore(0.5)
        setCurrentCause('')
        focusPayloadRef.current = null
        setWebcamError('')
        await startWebcam()
      }
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Failed to start session')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStopSession = async () => {
    if (!sessionId) { setApiError('No active session to stop'); return }
    if (isLoading) { setApiError('Request already in progress, please wait...'); return }

    setIsLoading(true)
    setApiError('')
    stopWebcam()

    try {
      await apiClient.post('/sessions/end', { session_id: sessionId })
      setSessionActive(false)
      setSessionId(null)
      setElapsedSeconds(0)
      setCurrentCause('')
      focusPayloadRef.current = null
    } catch (error) {
      if (sessionId) await startWebcam()
      setApiError(error instanceof Error ? error.message : 'Failed to end session')
    } finally {
      setIsLoading(false)
    }
  }

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setWebcamActive(true)
        setWebcamError('')
      }
    } catch (error) {
      setWebcamError(error instanceof Error ? error.message : 'Failed to access webcam')
    }
  }

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setWebcamActive(false)
    }
  }

  useEffect(() => { return () => { stopWebcam() } }, [])

  const subjects: Subject[] = ['Math', 'Science', 'Language', 'History', 'Other']

  return (
    <div className="space-y-0">
      {/* Top bar */}
      <div className="flex items-center justify-between pb-8 border-b border-border mb-8">
        <div className="flex items-center gap-6">
          <h1 className="font-display font-bold text-ink" style={{ fontSize: 'clamp(28px, 4vw, 42px)' }}>
            Session
          </h1>
          <div className="font-mono text-accent text-2xl font-bold" style={{ letterSpacing: '0.05em' }}>
            {formatTime(elapsedSeconds)}
          </div>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-3">
          {sessionActive ? (
            <span className="badge" style={{ background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--bg)' }}>
              ✦ Session Active
            </span>
          ) : (
            <span className="badge-outline">Session Paused</span>
          )}
        </div>
      </div>

      {/* Main two-panel layout when session active */}
      {sessionActive ? (
        <div className="flex gap-0 border border-border" style={{ minHeight: '60vh' }}>
          {/* Left: Webcam + CV overlay (~40%) */}
          <div className="session-cv-panel" style={{ width: '40%', flexShrink: 0 }}>
            {webcamActive ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{ width: '100%', display: 'block', opacity: 0.92, filter: 'contrast(1.05) saturate(0.9)' }}
                />
                {/* CV overlay canvas would go here */}
                <div
                  className="font-mono text-xs p-3 absolute top-3 left-3"
                  style={{
                    background: 'rgba(245,244,240,0.85)',
                    color: 'var(--ink)',
                    letterSpacing: '0.1em',
                    lineHeight: 1.8
                  }}
                >
                  GAZE&nbsp;&nbsp;&nbsp;{(currentFocusScore * 0.87 + 0.13).toFixed(2)}<br />
                  BLINK&nbsp;&nbsp;{Math.round(10 + currentFocusScore * 8)}/min<br />
                  POSE&nbsp;&nbsp;&nbsp;+3° / -1°<br />
                  FOCUS&nbsp;&nbsp;{currentFocusScore.toFixed(2)}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted font-mono text-sm">
                ✦ Webcam initializing...
              </div>
            )}
          </div>

          {/* Right: Lesson / content panel (~60%) */}
          <div className="flex-1 p-10 border-l border-border bg-surface">
            <div className="section-marker mb-6">Lesson Content</div>
            <h2 className="font-display font-bold text-ink text-xl mb-4">{selectedSubject}</h2>
            <p className="font-mono text-sm text-muted leading-relaxed mb-8">
              Your adaptive lesson content will appear here during the session. The AI tutor adjusts
              pacing based on your real-time focus level.
            </p>

            {/* Cause + confidence */}
            {currentCause && confidence > 0 && (
              <div className="border border-border p-4 mb-6">
                <span className="section-marker">Detection</span>
                <p className="font-mono text-sm text-ink mt-2">
                  ✦ {currentCause} — confidence {Math.round(confidence * 100)}%
                </p>
              </div>
            )}

            {/* Stop button */}
            <button
              onClick={handleStopSession}
              disabled={isLoading}
              className="btn-destructive"
            >
              {isLoading ? 'Stopping...' : '✦ Stop Session'}
            </button>
          </div>
        </div>
      ) : (
        /* Pre-session: subject selector + start */
        <div className="max-w-lg">
          <div className="mb-8">
            <label className="form-label">Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value as Subject)}
              className="input-field w-full"
            >
              {subjects.map((subject) => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleStartSession}
            disabled={isLoading}
            className="btn-accent w-full"
          >
            {isLoading ? 'Starting...' : '✦ Start Session'}
          </button>
        </div>
      )}

      {/* Focus Bar — full width below panels */}
      {sessionActive && (
        <div className="mt-0 border border-border border-t-0 p-6 bg-surface">
          <FocusBar focusScore={currentFocusScore} causeLabel={currentCause || undefined} />
        </div>
      )}

      {/* Error messages */}
      {apiError && (
        <div className="mt-6 p-4 bg-red-50 border-[1.5px] border-red-600">
          <p className="text-red-600 text-sm font-mono">{apiError}</p>
        </div>
      )}
      {webcamError && (
        <div className="mt-4 p-4 border-[1.5px] border-border bg-surface">
          <p className="text-muted text-sm font-mono">✦ Webcam: {webcamError} (session continues without preview)</p>
        </div>
      )}

      {/* CVModule — headless, only when active */}
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
  )
}

export default SessionPage
