import React, { useState, useMemo } from 'react'
import useClassStream from '../../hooks/useClassStream'
import StudentCard from '../../components/StudentCard'

export const DashboardPage: React.FC = () => {
  // TODO: Replace with actual class selector from auth context or URL params
  const [selectedClassId, setSelectedClassId] = useState('class-001')

  // Fetch live student data
  const { studentsLive, connectionState, isInitializing } = useClassStream(
    selectedClassId
  )
  
  // Handle class selection change
  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId)
  }

  // Convert to array and sort by name
  const studentsArray = useMemo(() => {
    return Object.values(studentsLive)
      .filter((student) => student && student.student_id)
      .sort((a, b) => (a.student_name || '').localeCompare(b.student_name || ''))
  }, [studentsLive])

  // Classes list (mock - would come from backend in production)
  const classes = useMemo(
    () => [
      { id: 'class-001', name: 'Grade 10 - Mathematics' },
      { id: 'class-002', name: 'Grade 10 - Science' },
      { id: 'class-003', name: 'Grade 9 - English' }
    ],
    []
  )

  // Connection status badge
  const connectionBadge = useMemo(() => {
    switch (connectionState) {
      case 'open':
        return { bg: 'bg-green-900/30', border: 'border-green-600', text: 'text-green-300', label: 'Live' }
      case 'connecting':
        return { bg: 'bg-yellow-900/30', border: 'border-yellow-600', text: 'text-yellow-300', label: 'Connecting...' }
      default:
        return { bg: 'bg-red-900/30', border: 'border-red-600', text: 'text-red-300', label: 'Offline' }
    }
  }, [connectionState])

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Top header bar */}
      <div className="border-b border-slate-700 bg-slate-800/50 backdrop-blur">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-white">Live Class Dashboard</h1>

            {/* Connection status badge */}
            <div
              className={`text-xs font-semibold px-3 py-1 rounded-full border ${connectionBadge.bg} ${connectionBadge.border} ${connectionBadge.text}`}
            >
              {connectionBadge.label}
            </div>
          </div>

          {/* Class selector dropdown */}
          <select
            value={selectedClassId}
            onChange={(e) => handleClassChange(e.target.value)}
            className="px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm font-medium hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          >
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>

        {/* Live student count */}
        <div className="px-6 pb-2 text-sm text-slate-400">
          {studentsArray.length} student{studentsArray.length !== 1 ? 's' : ''} online
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {/* Loading state - 3 skeleton cards */}
          {isInitializing && studentsArray.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-slate-800 rounded-xl p-4 border border-slate-700 animate-pulse"
                >
                  {/* Skeleton name */}
                  <div className="h-6 bg-slate-700 rounded w-3/4 mb-3"></div>

                  {/* Skeleton focus bar */}
                  <div className="h-3 bg-slate-700 rounded-full mb-4"></div>

                  {/* Skeleton badge */}
                  <div className="h-6 bg-slate-700 rounded-full w-20 mb-3"></div>

                  {/* Skeleton timestamp */}
                  <div className="h-4 bg-slate-700 rounded w-1/2 mt-4 pt-3 border-t border-slate-700"></div>
                </div>
              ))}
            </div>
          ) : studentsArray.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center h-96 text-center">
              <div className="text-6xl mb-4 text-slate-600">👥</div>
              <h3 className="text-xl font-semibold text-slate-300 mb-2">No students online</h3>
              <p className="text-slate-500">
                Students will appear here when they join a session in this class
              </p>
            </div>
          ) : (
            // Student cards grid - responsive: 3 cols desktop, 2 cols tablet, 1 col mobile
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {studentsArray.map((student) => (
                <StudentCard key={student.student_id} student={student} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
