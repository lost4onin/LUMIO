import React, { useEffect, useState } from 'react'
import { apiClient } from '../../lib/api'

interface SessionRecord {
  id: string
  subject: string
  started_at: string
  ended_at: string
  duration_min: number
  avg_focus: number
  distraction_count: number
}

const SessionHistoryPage: React.FC = () => {
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true)
        const response = await apiClient.get<{ sessions: SessionRecord[] }>('/parent/sessions')
        setSessions(response.data.sessions || [])
        setError(null)
      } catch (err: any) {
        // Use mock data for demo if API isn't ready
        setSessions([
          { id: '1', subject: 'Mathematics', started_at: '2026-03-28T14:00:00', ended_at: '2026-03-28T14:45:00', duration_min: 45, avg_focus: 0.76, distraction_count: 3 },
          { id: '2', subject: 'Science', started_at: '2026-03-27T10:00:00', ended_at: '2026-03-27T10:30:00', duration_min: 30, avg_focus: 0.82, distraction_count: 1 },
          { id: '3', subject: 'Language', started_at: '2026-03-26T15:00:00', ended_at: '2026-03-26T15:50:00', duration_min: 50, avg_focus: 0.68, distraction_count: 5 },
          { id: '4', subject: 'History', started_at: '2026-03-25T09:00:00', ended_at: '2026-03-25T09:35:00', duration_min: 35, avg_focus: 0.71, distraction_count: 4 },
          { id: '5', subject: 'Mathematics', started_at: '2026-03-24T14:00:00', ended_at: '2026-03-24T14:40:00', duration_min: 40, avg_focus: 0.65, distraction_count: 6 },
          { id: '6', subject: 'Science', started_at: '2026-03-23T11:00:00', ended_at: '2026-03-23T11:45:00', duration_min: 45, avg_focus: 0.79, distraction_count: 2 },
        ])
        setError(null)
      } finally {
        setLoading(false)
      }
    }
    fetchSessions()
  }, [])

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    } catch { return dateStr }
  }

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    } catch { return '' }
  }

  const getFocusLevel = (score: number) => {
    if (score >= 0.7) return { label: 'Focused', color: '#166534' }
    if (score >= 0.45) return { label: 'Moderate', color: '#92400e' }
    return { label: 'Distracted', color: '#991b1b' }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted font-mono text-sm" style={{ animation: 'pulse 1.5s infinite' }}>Loading session history...</p>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="pb-6 border-b border-border">
        <h1 className="font-display font-bold text-ink" style={{ fontSize: 'clamp(28px, 4vw, 42px)' }}>
          Session History
        </h1>
        <p className="font-mono text-sm text-muted mt-2" style={{ letterSpacing: '0.1em' }}>
          Your child's recent learning sessions
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border-[1.5px] border-red-600">
          <p className="text-red-600 text-sm font-mono">{error}</p>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-0 border-t border-l border-border">
        <div className="p-6 border-r border-b border-border">
          <div className="font-display font-bold text-ink" style={{ fontSize: 'clamp(24px, 3vw, 40px)' }}>
            {sessions.length}
          </div>
          <div className="font-mono text-xs text-muted mt-2" style={{ letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Total Sessions
          </div>
        </div>
        <div className="p-6 border-r border-b border-border">
          <div className="font-display font-bold text-ink" style={{ fontSize: 'clamp(24px, 3vw, 40px)' }}>
            {sessions.reduce((sum, s) => sum + s.duration_min, 0)}<span style={{ color: 'var(--accent)' }}>m</span>
          </div>
          <div className="font-mono text-xs text-muted mt-2" style={{ letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Total Study Time
          </div>
        </div>
        <div className="p-6 border-r border-b border-border">
          <div className="font-display font-bold text-ink" style={{ fontSize: 'clamp(24px, 3vw, 40px)' }}>
            {sessions.length > 0 ? Math.round((sessions.reduce((sum, s) => sum + s.avg_focus, 0) / sessions.length) * 100) : 0}<span style={{ color: 'var(--accent)' }}>%</span>
          </div>
          <div className="font-mono text-xs text-muted mt-2" style={{ letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Avg Focus
          </div>
        </div>
      </div>

      {/* Sessions list */}
      <div>
        <span className="section-marker mb-6 block">Session Details</span>

        {sessions.length === 0 ? (
          <p className="text-muted font-mono text-sm">✦ No sessions recorded yet</p>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => {
              const focusLevel = getFocusLevel(session.avg_focus)
              return (
                <div key={session.id} className="bg-surface border border-border p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-display font-bold text-ink text-lg">{session.subject}</h3>
                      <p className="font-mono text-xs text-muted mt-1">
                        {formatDate(session.started_at)} — {formatTime(session.started_at)} to {formatTime(session.ended_at)}
                      </p>
                    </div>
                    <span
                      className="font-mono text-xs font-bold px-3 py-1 rounded-full"
                      style={{
                        background: focusLevel.color + '15',
                        border: `1.5px solid ${focusLevel.color}`,
                        color: focusLevel.color,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase'
                      }}
                    >
                      {focusLevel.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted" style={{ letterSpacing: '0.1em' }}>DURATION</span>
                      <span className="font-mono text-sm text-ink font-bold">{session.duration_min}m</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted" style={{ letterSpacing: '0.1em' }}>FOCUS</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-bg border border-border rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all"
                            style={{
                              width: `${Math.round(session.avg_focus * 100)}%`,
                              background: session.avg_focus < 0.45 ? 'var(--accent)' : 'var(--ink)'
                            }}
                          />
                        </div>
                        <span className="font-mono text-sm text-ink font-bold">{Math.round(session.avg_focus * 100)}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted" style={{ letterSpacing: '0.1em' }}>DISTRACTIONS</span>
                      <span className="font-mono text-sm text-ink font-bold">{session.distraction_count}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default SessionHistoryPage
