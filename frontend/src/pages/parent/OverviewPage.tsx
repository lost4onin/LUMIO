import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { apiClient } from '../../lib/api'
import { FocusTrendChart } from '../../components/FocusTrendChart'

interface ProfileData {
  name: string
  risk_tier: 'low' | 'moderate' | 'needs_attention'
  for_student: string[]
  for_parent: string[]
  focus_avg_7d: number
  focus_history: Array<{ date: string; avg_focus: number }>
  homework: Array<{
    title: string
    status: 'pending' | 'submitted' | 'graded'
  }>
}

const OverviewPage: React.FC = () => {
  const { childId } = useParams<{ childId: string }>()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true)
        if (!childId) { setError('Child ID not found'); return }
        const response = await apiClient.get<ProfileData>(`/students/${childId}/profile`)
        setProfile(response.data)
        setError(null)
      } catch (err: any) {
        setError(err.message || 'Failed to load profile')
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [childId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted font-mono text-sm" style={{ animation: 'pulse 1.5s infinite' }}>Loading...</p>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-red-600 font-mono text-sm">{error || 'No profile data available'}</p>
      </div>
    )
  }

  const riskConfig = {
    low: {
      style: { background: '#f0fdf4', border: '1.5px solid #166534', color: '#166534' },
      label: 'Doing well',
    },
    moderate: {
      style: { background: '#fffbeb', border: '1.5px solid #92400e', color: '#92400e' },
      label: 'Monitor',
    },
    needs_attention: {
      style: { background: '#fef2f2', border: '1.5px solid #991b1b', color: '#991b1b' },
      label: 'Needs support',
    },
  }

  const riskStyle = riskConfig[profile.risk_tier]

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="badge-outline">Pending</span>
      case 'submitted':
        return <span className="badge" style={{ background: 'var(--ink)', color: 'var(--bg)' }}>Submitted</span>
      case 'graded':
        return <span className="badge" style={{ background: '#166534', color: '#dcfce7', borderColor: '#166534' }}>Graded</span>
      default:
        return <span className="badge-outline">{status}</span>
    }
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="pb-6 border-b border-border">
        <h1 className="font-display font-bold text-ink mb-2" style={{ fontSize: 'clamp(28px, 4vw, 42px)' }}>
          {profile.name}
        </h1>
        <p className="font-mono text-sm text-muted" style={{ letterSpacing: '0.1em' }}>
          Your child's learning overview
        </p>
      </div>

      {/* Risk tier + focus avg */}
      <div className="flex items-center gap-4">
        <span
          className="font-mono text-xs font-bold px-4 py-2 rounded-full"
          style={{ ...riskStyle.style, letterSpacing: '0.15em', textTransform: 'uppercase' }}
        >
          {riskStyle.label}
        </span>
        <span className="font-mono text-xs text-muted" style={{ letterSpacing: '0.1em' }}>
          Focus this week: {Math.round(profile.focus_avg_7d * 100)}%
        </span>
      </div>

      {/* Focus trend chart */}
      <div className="bg-surface border border-border p-8">
        <span className="section-marker mb-4 block">Focus Trends — Last 7 Days</span>
        <FocusTrendChart data={profile.focus_history} height={250} />
      </div>

      {/* Suggestions */}
      <div>
        <span className="section-marker mb-6 block">Helpful Tips for Home</span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profile.for_parent.map((suggestion, idx) => (
            <div key={idx} className="bg-surface border border-border p-5 flex gap-4">
              <span className="text-accent text-sm flex-shrink-0">✦</span>
              <p className="font-mono text-sm text-ink leading-relaxed">{suggestion}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Homework */}
      <div>
        <span className="section-marker mb-6 block">Assignments</span>
        <div className="space-y-3">
          {profile.homework.length > 0 ? (
            profile.homework.map((hw, idx) => (
              <div key={idx} className="bg-surface border border-border p-5 flex items-center justify-between">
                <p className="font-mono text-sm text-ink">{hw.title}</p>
                {getStatusBadge(hw.status)}
              </div>
            ))
          ) : (
            <p className="text-muted font-mono text-sm">✦ No assignments yet</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default OverviewPage
