import React, { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { apiClient } from '../../lib/api'
import { FocusTrendChart } from '../../components/FocusTrendChart'

interface ProgressData {
  xp_points: number
  streak_days: number
  total_sessions: number
  total_study_time_min: number
  focus_avg_7d: number
  focus_history: Array<{ date: string; avg_focus: number }>
  recent_sessions: Array<{
    id: string
    subject: string
    date: string
    duration_min: number
    avg_focus: number
  }>
}

const ProgressPage: React.FC = () => {
  const { user } = useAuth()
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        setLoading(true)
        const response = await apiClient.get<ProgressData>(`/students/${user?.id}/progress`)
        setProgress(response.data)
        setError(null)
      } catch (err: any) {
        // Use mock data for demo if API isn't ready
        setProgress({
          xp_points: 2450,
          streak_days: 12,
          total_sessions: 34,
          total_study_time_min: 1260,
          focus_avg_7d: 0.74,
          focus_history: [
            { date: '2026-03-22', avg_focus: 0.68 },
            { date: '2026-03-23', avg_focus: 0.72 },
            { date: '2026-03-24', avg_focus: 0.65 },
            { date: '2026-03-25', avg_focus: 0.78 },
            { date: '2026-03-26', avg_focus: 0.81 },
            { date: '2026-03-27', avg_focus: 0.74 },
            { date: '2026-03-28', avg_focus: 0.76 },
          ],
          recent_sessions: [
            { id: '1', subject: 'Math', date: '2026-03-28', duration_min: 45, avg_focus: 0.76 },
            { id: '2', subject: 'Science', date: '2026-03-27', duration_min: 30, avg_focus: 0.74 },
            { id: '3', subject: 'Language', date: '2026-03-26', duration_min: 50, avg_focus: 0.81 },
            { id: '4', subject: 'History', date: '2026-03-25', duration_min: 35, avg_focus: 0.78 },
            { id: '5', subject: 'Math', date: '2026-03-24', duration_min: 40, avg_focus: 0.65 },
          ],
        })
        setError(null)
      } finally {
        setLoading(false)
      }
    }
    fetchProgress()
  }, [user?.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted font-mono text-sm" style={{ animation: 'pulse 1.5s infinite' }}>Loading progress...</p>
      </div>
    )
  }

  if (!progress) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-red-600 font-mono text-sm">{error || 'No progress data available'}</p>
      </div>
    )
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch { return dateStr }
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="pb-6 border-b border-border">
        <h1 className="font-display font-bold text-ink" style={{ fontSize: 'clamp(28px, 4vw, 42px)' }}>
          Progress
        </h1>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-t border-l border-border">
        <div className="p-6 border-r border-b border-border">
          <div className="font-display font-bold text-ink" style={{ fontSize: 'clamp(28px, 4vw, 48px)', letterSpacing: '-0.03em' }}>
            {progress.xp_points.toLocaleString()}
          </div>
          <div className="font-mono text-xs text-muted mt-2" style={{ letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            XP Points
          </div>
        </div>

        <div className="p-6 border-r border-b border-border">
          <div className="font-display font-bold text-ink" style={{ fontSize: 'clamp(28px, 4vw, 48px)', letterSpacing: '-0.03em' }}>
            {progress.streak_days}<span style={{ color: 'var(--accent)' }}>d</span>
          </div>
          <div className="font-mono text-xs text-muted mt-2" style={{ letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Streak
          </div>
        </div>

        <div className="p-6 border-r border-b border-border">
          <div className="font-display font-bold text-ink" style={{ fontSize: 'clamp(28px, 4vw, 48px)', letterSpacing: '-0.03em' }}>
            {progress.total_sessions}
          </div>
          <div className="font-mono text-xs text-muted mt-2" style={{ letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Sessions
          </div>
        </div>

        <div className="p-6 border-r border-b border-border">
          <div className="font-display font-bold text-ink" style={{ fontSize: 'clamp(28px, 4vw, 48px)', letterSpacing: '-0.03em' }}>
            {Math.round(progress.focus_avg_7d * 100)}<span style={{ color: 'var(--accent)' }}>%</span>
          </div>
          <div className="font-mono text-xs text-muted mt-2" style={{ letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Avg Focus (7d)
          </div>
        </div>
      </div>

      {/* Focus trend chart */}
      <div className="bg-surface border border-border p-8">
        <span className="section-marker mb-4 block">Focus Trends — Last 7 Days</span>
        <FocusTrendChart data={progress.focus_history} height={250} />
      </div>

      {/* Recent sessions */}
      <div>
        <span className="section-marker mb-6 block">Recent Sessions</span>
        <div className="space-y-3">
          {progress.recent_sessions.map((session) => (
            <div key={session.id} className="bg-surface border border-border p-5 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <span className="font-display font-bold text-ink">{session.subject}</span>
                <span className="font-mono text-xs text-muted">{formatDate(session.date)}</span>
                <span className="font-mono text-xs text-muted">{session.duration_min} min</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-20 h-2 bg-bg border border-border rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${Math.round(session.avg_focus * 100)}%`,
                      background: session.avg_focus < 0.45 ? 'var(--accent)' : 'var(--ink)'
                    }}
                  />
                </div>
                <span className="font-mono text-xs text-muted" style={{ letterSpacing: '0.1em', width: '36px', textAlign: 'right' }}>
                  {Math.round(session.avg_focus * 100)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Study time */}
      <div className="bg-surface border border-border p-6 flex items-center gap-4">
        <span className="text-accent text-sm">✦</span>
        <span className="font-mono text-sm text-ink">
          Total study time: <strong>{Math.round(progress.total_study_time_min / 60)}h {progress.total_study_time_min % 60}m</strong>
        </span>
      </div>
    </div>
  )
}

export default ProgressPage
