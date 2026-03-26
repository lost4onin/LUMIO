import React, { useMemo } from 'react'
import FocusBar from './FocusBar'
import { StudentLiveData } from '../hooks/useClassStream'

interface StudentCardProps {
  student: StudentLiveData
}

export const StudentCard: React.FC<StudentCardProps> = ({ student }) => {
  // Determine risk tile badge color
  const riskBadgeStyle = useMemo(() => {
    switch (student.risk_tier) {
      case 'low':
        return { bg: 'bg-green-900/30', border: 'border-green-600', text: 'text-green-300' }
      case 'moderate':
        return { bg: 'bg-amber-900/30', border: 'border-amber-600', text: 'text-amber-300' }
      case 'needs_attention':
        return { bg: 'bg-red-900/30', border: 'border-red-600', text: 'text-red-300' }
      default:
        return { bg: 'bg-slate-900/30', border: 'border-slate-600', text: 'text-slate-300' }
    }
  }, [student.risk_tier])

  // Format last updated time
  const formattedTime = useMemo(() => {
    const now = Date.now()
    const elapsed = now - student.updated_at
    const seconds = Math.floor(elapsed / 1000)
    const minutes = Math.floor(seconds / 60)

    if (seconds < 60) return `${seconds}s ago`
    if (minutes < 60) return `${minutes}m ago`
    return 'offline'
  }, [student.updated_at])

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 hover:border-slate-600 transition shadow-lg hover:shadow-xl">
      {/* Student name */}
      <h3 className="text-white font-semibold text-lg mb-3 truncate">{student.student_name}</h3>

      {/* Focus bar */}
      <div className="mb-4">
        <FocusBar focusScore={student.focus_score} causeLabel={student.distraction_cause} />
      </div>

      {/* Risk tier badge */}
      <div className="mb-3 flex items-center justify-between">
        <span
          className={`text-xs font-semibold px-3 py-1 rounded-full border ${riskBadgeStyle.bg} ${riskBadgeStyle.border} ${riskBadgeStyle.text}`}
        >
          {student.risk_tier === 'low'
            ? 'Low Risk'
            : student.risk_tier === 'moderate'
              ? 'Moderate Risk'
              : 'Needs Attention'}
        </span>
      </div>

      {/* Cause label - only show if present */}
      {student.distraction_cause && (
        <div className="mb-3 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-400"></div>
          <span className="text-xs text-slate-400">{student.distraction_cause}</span>
        </div>
      )}

      {/* Last updated timestamp */}
      <div className="text-xs text-slate-500 flex items-center justify-between pt-3 border-t border-slate-700">
        <span>Updated</span>
        <span>{formattedTime}</span>
      </div>
    </div>
  )
}

export default StudentCard
