import React, { useState, useEffect } from 'react'
import { apiClient } from '../../lib/api'

interface Assignment {
  id: string
  title: string
  description: string
  due_date: string
  difficulty: number
  status: 'submitted' | 'pending' | 'overdue'
}

interface ExpandedCard {
  [id: string]: boolean
}

export const StudentHomeworkPage: React.FC = () => {
  const [classId] = useState('class-001')
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [expandedCards, setExpandedCards] = useState<ExpandedCard>({})
  const [submissionText, setSubmissionText] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        setIsLoading(true)
        const response = await apiClient.get<{ assignments: Assignment[] }>(`/homework/${classId}`)
        setAssignments(response.data.assignments || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load assignments')
      } finally {
        setIsLoading(false)
      }
    }
    fetchAssignments()
  }, [classId])

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return <span className="badge" style={{ background: '#166534', color: '#dcfce7', borderColor: '#166534' }}>Submitted</span>
      case 'pending':
        return <span className="badge-outline">Pending</span>
      case 'overdue':
        return <span className="badge" style={{ background: '#991b1b', color: '#fee2e2', borderColor: '#991b1b' }}>Overdue</span>
      default:
        return <span className="badge-outline">{status}</span>
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return dateStr
    }
  }

  const renderDifficulty = (difficulty: number) => (
    <span className="font-mono text-xs text-muted" style={{ letterSpacing: '0.1em' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ color: i < difficulty ? 'var(--accent)' : 'var(--border)' }}>✦ </span>
      ))}
    </span>
  )

  const handleSubmit = async (assignmentId: string) => {
    const text = submissionText[assignmentId]?.trim()
    if (!text) return

    setIsSubmitting((prev) => ({ ...prev, [assignmentId]: true }))

    try {
      await apiClient.post(`/homework/${assignmentId}/submit`, { text_submission: text })
      setAssignments((prev) => prev.map((a) => a.id === assignmentId ? { ...a, status: 'submitted' as const } : a))
      setSubmissionText((prev) => ({ ...prev, [assignmentId]: '' }))
      setExpandedCards((prev) => ({ ...prev, [assignmentId]: false }))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit assignment')
    } finally {
      setIsSubmitting((prev) => ({ ...prev, [assignmentId]: false }))
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted font-mono text-sm" style={{ animation: 'pulse 1.5s infinite' }}>Loading assignments...</p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="pb-8 border-b border-border mb-8">
        <h1 className="font-display font-bold text-ink" style={{ fontSize: 'clamp(28px, 4vw, 42px)' }}>
          My Assignments
        </h1>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border-[1.5px] border-red-600">
          <p className="text-red-600 text-sm font-mono">{error}</p>
        </div>
      )}

      {assignments.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-center">
          <div>
            <p className="text-muted font-mono text-sm">✦ No assignments yet</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map((assignment) => (
            <div key={assignment.id} className="bg-surface border border-border hover:border-ink transition">
              {/* Card header */}
              <button
                onClick={() => toggleCard(assignment.id)}
                className="w-full p-6 flex items-start justify-between text-left hover:bg-bg/50 transition"
              >
                <div className="flex-1">
                  <h3 className="font-display font-bold text-ink text-lg mb-3">{assignment.title}</h3>
                  <p className="font-mono text-sm text-muted mb-4">{assignment.description}</p>

                  <div className="flex items-center gap-6 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="section-marker" style={{ fontSize: '10px' }}>Difficulty</span>
                      {renderDifficulty(assignment.difficulty)}
                    </div>
                    <span className="font-mono text-xs text-muted">Due: {formatDate(assignment.due_date)}</span>
                    {getStatusBadge(assignment.status)}
                  </div>
                </div>

                <span className="ml-4 text-muted font-mono text-xs">
                  {expandedCards[assignment.id] ? '▼' : '▶'}
                </span>
              </button>

              {/* Expanded content */}
              {expandedCards[assignment.id] && (
                <div className="border-t border-border p-6 bg-bg">
                  {assignment.status === 'submitted' ? (
                    <div className="p-4 border border-border bg-surface">
                      <p className="text-sm font-mono text-ink">✦ Already submitted</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <textarea
                        value={submissionText[assignment.id] || ''}
                        onChange={(e) => setSubmissionText((prev) => ({ ...prev, [assignment.id]: e.target.value }))}
                        placeholder="Write your assignment here..."
                        className="input-field w-full resize-none"
                        rows={6}
                      />
                      <button
                        onClick={() => handleSubmit(assignment.id)}
                        disabled={isSubmitting[assignment.id] || !submissionText[assignment.id]?.trim()}
                        className="btn-accent w-full"
                      >
                        {isSubmitting[assignment.id] ? 'Submitting...' : '✦ Submit'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default StudentHomeworkPage
