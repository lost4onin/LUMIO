import React, { useMemo, useEffect, useState } from 'react'
import FocusBar from './FocusBar'
import { StudentLiveData } from '../hooks/useClassStream'

interface StudentCardProps {
  student: StudentLiveData
}

export const StudentCard: React.FC<StudentCardProps> = ({ student }) => {
  const riskBadgeStyle = useMemo(() => {
    switch (student.risk_tier) {
      case 'low':
        return { bg: 'bg-green-50', border: 'border-green-600', text: 'text-green-600' }
      case 'moderate':
        return { bg: 'bg-yellow-50', border: 'border-yellow-600', text: 'text-yellow-600' }
      case 'needs_attention':
        return { bg: 'bg-red-50', border: 'border-red-600', text: 'text-red-600' }
      default:
        return { bg: 'bg-surface', border: 'border-border', text: 'text-ink' }
    }
  }, [student.risk_tier])

  const [formattedTime, setFormattedTime] = useState('just now')

  useEffect(() => {
    const updateTime = () => {
      const now = Date.now()
      const elapsed = now - student.updated_at
      const seconds = Math.floor(elapsed / 1000)
      const minutes = Math.floor(seconds / 60)

      if (seconds < 60) setFormattedTime(`${seconds}s ago`)
      else if (minutes < 60) setFormattedTime(`${minutes}m ago`)
      else setFormattedTime('offline')
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [student.updated_at])

  return (
    <div className="bg-surface border-[1.5px] border-border p-6 hover:border-ink transition" style={{ borderRadius: '12px' }}>
      {/* Student name */}
      <h3 className="text-ink font-display font-bold text-md mb-4 truncate" style={{ fontSize: 'clamp(22px, 3vw, 28px)' }}>{student.student_name}</h3>

      {/* Focus bar */}
      <div className="mb-6">
        <FocusBar focusScore={student.focus_score} causeLabel={student.distraction_cause} />
      </div>

      {/* Risk tier badge */}
      <div className="mb-4 flex items-center justify-between">
        <span
          className={`text-xs font-mono font-bold px-4 py-2 rounded-full border-[1.5px] ${riskBadgeStyle.bg} ${riskBadgeStyle.border} ${riskBadgeStyle.text}`}
          style={{ letterSpacing: '0.15em', textTransform: 'uppercase' }}
        >
          {student.risk_tier === 'low'
            ? 'Low Risk'
            : student.risk_tier === 'moderate'
              ? 'Moderate Risk'
              : 'Needs Attention'}
        </span>
      </div>

      {/* Cause label */}
      {student.distraction_cause && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-accent text-sm">✦</span>
          <span className="text-xs text-muted font-mono">{student.distraction_cause}</span>
        </div>
      )}

      {/* Timestamp */}
      <div className="text-xs text-muted font-mono flex items-center justify-between pt-4 border-t border-border" style={{ letterSpacing: '0.1em' }}>
        <span>UPDATED</span>
        <span>{formattedTime}</span>
      </div>
    </div>
  )
}

export default StudentCard
