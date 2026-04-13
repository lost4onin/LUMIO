import React, { useState, useEffect, useMemo, useRef } from 'react'
import { apiClient } from '../../lib/api'
import ChatInterface from '../../components/ChatInterface'

interface Student {
  id: string
  name: string
  risk_tier?: 'low' | 'moderate' | 'needs_attention'
}

export const ChatbotPage: React.FC = () => {
  const selectedClassId = 'class-001'
  const [selectedStudentId, setSelectedStudentId] = useState<string | undefined>(undefined)
  const [students, setStudents] = useState<Student[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const fillInputRef = useRef<((text: string) => void) | null>(null)

  const suggestedQuestions = useMemo(
    () => [
      'What should I do for a distracted student?',
      'How can I support a fatigued learner?',
      'What breaks do you recommend for long sessions?'
    ],
    []
  )

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const response = await apiClient.get<{ students: Student[] }>(`/classes/${selectedClassId}/students`)
        setStudents(response.data.students || [])
        setSelectedStudentId(undefined)
      } catch (error) {
        console.error('Failed to fetch students:', error)
        setStudents([])
      }
    }
    fetchStudents()
  }, [selectedClassId])

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId),
    [students, selectedStudentId]
  )

  const getRiskBadge = (tier?: string) => {
    switch (tier) {
      case 'low':
        return { style: { background: '#f0fdf4', border: '1.5px solid #166534', color: '#166534' }, label: 'Low Risk' }
      case 'moderate':
        return { style: { background: '#fffbeb', border: '1.5px solid #92400e', color: '#92400e' }, label: 'Moderate Risk' }
      case 'needs_attention':
        return { style: { background: '#fef2f2', border: '1.5px solid #991b1b', color: '#991b1b' }, label: 'Needs Attention' }
      default:
        return { style: {}, label: '' }
    }
  }

  const fillSuggestion = (suggestion: string) => {
    if (fillInputRef.current) fillInputRef.current(suggestion)
  }

  const handleSuggestFill = (callback: (text: string) => void) => {
    ;(fillInputRef as React.MutableRefObject<(text: string) => void | null>).current = callback
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 96px)' }}>
      {/* Header */}
      <div className="pb-6 border-b border-border mb-6">
        <h1 className="font-display font-bold text-ink mb-4" style={{ fontSize: 'clamp(28px, 4vw, 42px)' }}>
          AI Teaching Assistant
        </h1>

        <div className="flex items-center gap-4">
          <label className="form-label" style={{ marginBottom: 0 }}>Student Context</label>
          <select
            value={selectedStudentId || ''}
            onChange={(e) => setSelectedStudentId(e.target.value || undefined)}
            className="input-field"
            style={{ width: 'auto' }}
          >
            <option value="">No student context</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>{student.name}</option>
            ))}
          </select>

          {selectedStudent && (() => {
            const risk = getRiskBadge(selectedStudent.risk_tier)
            return (
              <span
                className="font-mono text-xs font-bold px-3 py-2 rounded-full"
                style={{ ...risk.style, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}
              >
                {selectedStudent.name} — {risk.label}
              </span>
            )
          })()}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Chat interface */}
        <div className="flex-1 flex flex-col min-w-0 border border-border overflow-hidden">
          <ChatInterface
            endpoint="/rag/teacher"
            studentId={selectedStudentId}
            onSuggestFill={handleSuggestFill}
          />
        </div>

        {/* Sidebar */}
        <div
          className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 overflow-hidden`}
        >
          <div className="bg-surface border border-border p-5 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <span className="section-marker">Suggestions</span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-muted hover:text-ink font-mono text-xs transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              {suggestedQuestions.map((question, idx) => (
                <button
                  key={idx}
                  onClick={() => fillSuggestion(question)}
                  className="w-full text-left px-4 py-3 border border-border bg-bg hover:border-ink text-ink font-mono text-xs transition"
                >
                  ✦ {question}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-10 h-10 bg-surface border border-border flex items-center justify-center text-muted hover:text-ink transition"
          >
            ◀
          </button>
        )}
      </div>
    </div>
  )
}

export default ChatbotPage
