import React, { useState, useEffect } from 'react'
import { apiClient } from '../../lib/api'

interface StudentSubmission {
  id: string
  student_id: string
  student_name: string
  submission_text: string
  grade?: number
  submitted_at: string
}

interface Assignment {
  id: string
  title: string
  description: string
  due_date: string
  difficulty: number
  submission_count: number
  total_students: number
}

interface ExpandedCard {
  [id: string]: boolean
}

export const TeacherHomeworkPage: React.FC = () => {
  const [classId] = useState('class-001')
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [submissions, setSubmissions] = useState<Record<string, StudentSubmission[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [expandedCards, setExpandedCards] = useState<ExpandedCard>({})
  const [gradeInput, setGradeInput] = useState<Record<string, number>>({})
  const [isGrading, setIsGrading] = useState<Record<string, boolean>>({})

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

  const fetchSubmissions = async (assignmentId: string) => {
    try {
      const response = await apiClient.get<{ submissions: StudentSubmission[] }>(`/homework/${assignmentId}/submissions`)
      setSubmissions((prev) => ({ ...prev, [assignmentId]: response.data.submissions || [] }))
    } catch (err) {
      console.error('Fetch submissions error:', err)
    }
  }

  const toggleCard = async (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }))
    if (!expandedCards[id] && !submissions[id]) {
      await fetchSubmissions(id)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch { return dateStr }
  }

  const renderDifficulty = (difficulty: number) => (
    <span className="font-mono text-xs text-muted" style={{ letterSpacing: '0.1em' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ color: i < difficulty ? 'var(--accent)' : 'var(--border)' }}>✦ </span>
      ))}
    </span>
  )

  const handleGradeSubmit = async (submissionId: string) => {
    const grade = gradeInput[submissionId]
    if (grade === undefined || grade < 0 || grade > 10) {
      alert('Grade must be between 0 and 10')
      return
    }

    setIsGrading((prev) => ({ ...prev, [submissionId]: true }))

    try {
      await apiClient.patch(`/homework/submissions/${submissionId}/grade`, { grade })
      setSubmissions((prev) => {
        const updated = { ...prev }
        for (const key in updated) {
          updated[key] = updated[key].map((sub) => sub.id === submissionId ? { ...sub, grade } : sub)
        }
        return updated
      })
      setGradeInput((prev) => { const updated = { ...prev }; delete updated[submissionId]; return updated })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit grade')
    } finally {
      setIsGrading((prev) => ({ ...prev, [submissionId]: false }))
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
          Assignments & Submissions
        </h1>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border-[1.5px] border-red-600">
          <p className="text-red-600 text-sm font-mono">{error}</p>
        </div>
      )}

      {assignments.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-center">
          <p className="text-muted font-mono text-sm">✦ No assignments created yet</p>
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

                  <div className="flex items-center gap-6 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="section-marker" style={{ fontSize: '10px' }}>Difficulty</span>
                      {renderDifficulty(assignment.difficulty)}
                    </div>
                    <span className="font-mono text-xs text-muted">Due: {formatDate(assignment.due_date)}</span>
                    <span className="font-mono text-xs text-accent font-bold">
                      {assignment.submission_count} / {assignment.total_students} submitted
                    </span>
                  </div>
                </div>

                <span className="ml-4 text-muted font-mono text-xs">
                  {expandedCards[assignment.id] ? '▼' : '▶'}
                </span>
              </button>

              {/* Expanded: submissions */}
              {expandedCards[assignment.id] && (
                <div className="border-t border-border p-6 bg-bg space-y-4">
                  {submissions[assignment.id]?.length === 0 ? (
                    <p className="text-muted font-mono text-sm">✦ No submissions yet</p>
                  ) : (
                    submissions[assignment.id]?.map((submission) => (
                      <div key={submission.id} className="bg-surface border border-border p-5">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h4 className="font-display font-bold text-ink mb-1">{submission.student_name}</h4>
                            <p className="font-mono text-xs text-muted">
                              Submitted: {new Date(submission.submitted_at).toLocaleString()}
                            </p>
                          </div>

                          {submission.grade !== undefined && submission.grade < 8 && (
                            <span
                              className="font-mono text-xs font-bold px-3 py-1 rounded-full"
                              style={{ background: '#fffbeb', border: '1.5px solid #92400e', color: '#92400e', letterSpacing: '0.1em', textTransform: 'uppercase' }}
                            >
                              Needs Help
                            </span>
                          )}
                        </div>

                        {/* Submission text */}
                        <div className="mb-4 p-4 bg-bg border border-border max-h-32 overflow-y-auto">
                          <p className="text-sm font-mono text-ink whitespace-pre-wrap">{submission.submission_text}</p>
                        </div>

                        {/* Grade input */}
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={gradeInput[submission.id] ?? submission.grade ?? ''}
                            onChange={(e) =>
                              setGradeInput((prev) => ({ ...prev, [submission.id]: parseFloat(e.target.value) }))
                            }
                            placeholder="0–10"
                            className="input-field"
                            style={{ width: '80px' }}
                          />
                          <button
                            onClick={() => handleGradeSubmit(submission.id)}
                            disabled={
                              isGrading[submission.id] ||
                              gradeInput[submission.id] === undefined ||
                              gradeInput[submission.id] < 0 ||
                              gradeInput[submission.id] > 10
                            }
                            className="btn-accent"
                            style={{ padding: '10px 24px' }}
                          >
                            {isGrading[submission.id] ? 'Grading...' : '✦ Grade'}
                          </button>

                          {submission.grade !== undefined && (
                            <span className="font-mono text-sm font-bold text-accent">
                              Grade: {submission.grade}/10
                            </span>
                          )}
                        </div>
                      </div>
                    ))
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

export default TeacherHomeworkPage
