import React, { useState, useMemo } from 'react'
import useClassStream from '../../hooks/useClassStream'
import StudentCard from '../../components/StudentCard'

export const DashboardPage: React.FC = () => {
  const [selectedClassId, setSelectedClassId] = useState('class-001')
  const { studentsLive, connectionState, isInitializing } = useClassStream(selectedClassId)

  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId)
  }

  const studentsArray = useMemo(() => {
    return Object.values(studentsLive)
      .filter((student) => student && student.student_id)
      .sort((a, b) => (a.student_name || '').localeCompare(b.student_name || ''))
  }, [studentsLive])

  const classes = useMemo(
    () => [
      { id: 'class-001', name: 'Grade 10 — Mathematics' },
      { id: 'class-002', name: 'Grade 10 — Science' },
      { id: 'class-003', name: 'Grade 9 — English' }
    ],
    []
  )

  const connectionBadge = useMemo(() => {
    switch (connectionState) {
      case 'open':
        return { className: 'badge', style: { background: '#166534', color: '#dcfce7', borderColor: '#166534' }, label: '✦ Live' }
      case 'connecting':
        return { className: 'badge-outline', style: {}, label: 'Connecting...' }
      default:
        return { className: 'badge', style: { background: '#991b1b', color: '#fee2e2', borderColor: '#991b1b' }, label: 'Offline' }
    }
  }, [connectionState])

  return (
    <div>
      {/* Header */}
      <div className="pb-6 border-b border-border mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h1 className="font-display font-bold text-ink" style={{ fontSize: 'clamp(28px, 4vw, 42px)' }}>
              Live Dashboard
            </h1>
            <span className={connectionBadge.className} style={connectionBadge.style}>
              {connectionBadge.label}
            </span>
          </div>

          <select
            value={selectedClassId}
            onChange={(e) => handleClassChange(e.target.value)}
            className="input-field"
            style={{ width: 'auto' }}
          >
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>{cls.name}</option>
            ))}
          </select>
        </div>

        <p className="font-mono text-xs text-muted" style={{ letterSpacing: '0.1em' }}>
          {studentsArray.length} student{studentsArray.length !== 1 ? 's' : ''} online
        </p>
      </div>

      {/* Content */}
      {isInitializing && studentsArray.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface border border-border p-6" style={{ animation: 'pulse 1.5s infinite' }}>
              <div className="h-6 bg-bg rounded mb-3" style={{ width: '75%' }} />
              <div className="h-2 bg-bg rounded-full mb-4" />
              <div className="h-5 bg-bg rounded-full mb-3" style={{ width: '80px' }} />
              <div className="h-4 bg-bg rounded mt-4 pt-3 border-t border-border" style={{ width: '50%' }} />
            </div>
          ))}
        </div>
      ) : studentsArray.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="font-mono text-sm text-muted mb-2">✦ No students online</p>
          <p className="font-mono text-xs text-muted">
            Students will appear here when they join a session in this class
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {studentsArray.map((student) => (
            <StudentCard key={student.student_id} student={student} />
          ))}
        </div>
      )}
    </div>
  )
}

export default DashboardPage
