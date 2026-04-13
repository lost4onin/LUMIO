import React, { useState } from 'react'

interface ChecklistItem {
  id: string
  label: string
  passed: boolean
  notes: string
}

/**
 * QAChecklist - Development-only QA testing checklist
 * Visible only in development mode (import.meta.env.DEV === true)
 * Helps verify critical Lumio frontend functionality
 */
const QAChecklist: React.FC = () => {
  const [items, setItems] = useState<ChecklistItem[]>([
    {
      id: 'cv-module',
      label: 'CV module activates on session start (webcam LED on)',
      passed: false,
      notes: '',
    },
    {
      id: 'focus-score-change',
      label: 'focus_score changes when looking away (watch FocusBar)',
      passed: false,
      notes: '',
    },
    {
      id: 'websocket-connection',
      label: "WebSocket connection shows 'open' in browser DevTools Network tab",
      passed: false,
      notes: '',
    },
    {
      id: 'analytics-classify',
      label: '/analytics/classify called every 10s (check Network tab)',
      passed: false,
      notes: '',
    },
    {
      id: 'focus-bar-red',
      label: 'FocusBar color turns red when focus_score < 0.35',
      passed: false,
      notes: '',
    },
    {
      id: 'teacher-live-updates',
      label: 'Teacher dashboard receives live updates from student session',
      passed: false,
      notes: '',
    },
    {
      id: 'chatbot-sources',
      label: 'Teacher chatbot answers a question with sources listed',
      passed: false,
      notes: '',
    },
    {
      id: 'focus-alert-email',
      label: 'Focus alert email arrives on phone (manual trigger)',
      passed: false,
      notes: '',
    },
    {
      id: 'parent-suggestions',
      label: 'Parent dashboard shows suggestions — NO risk_score anywhere',
      passed: false,
      notes: '',
    },
    {
      id: 'homework-flow',
      label: 'Homework: submit as student → visible to teacher → grade → struggle flag',
      passed: false,
      notes: '',
    },
  ])

  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, passed: !item.passed } : item
      )
    )
  }

  const updateNotes = (id: string, notes: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, notes } : item))
    )
  }

  const exportToJson = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      passedCount: items.filter((i) => i.passed).length,
      totalCount: items.length,
      items: items.map((item) => ({
        label: item.label,
        passed: item.passed,
        notes: item.notes,
      })),
    }

    const dataStr = JSON.stringify(exportData, null, 2)
    const dataUri =
      'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr)

    const exportFileDefaultName = `lumio-qa-checklist-${new Date().toISOString().split('T')[0]}.json`

    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  const passedCount = items.filter((i) => i.passed).length
  const totalCount = items.length

  // Only render in development mode
  if (!import.meta.env.DEV) {
    return null
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">QA Checklist</h1>
        <p className="text-slate-400">
          Development testing checklist for Lumio frontend
        </p>
        <div className="mt-4 text-sm text-slate-300">
          Progress: <span className="font-semibold text-blue-400">{passedCount}</span>
          {' / '}
          <span>{totalCount}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-8 bg-slate-800 rounded-lg p-4 border border-slate-700">
        <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all duration-300"
            style={{ width: `${(passedCount / totalCount) * 100}%` }}
          />
        </div>
      </div>

      {/* Checklist items */}
      <div className="space-y-4 mb-8">
        {items.map((item) => (
          <div
            key={item.id}
            className="bg-slate-800 rounded-lg p-5 border border-slate-700 transition hover:border-slate-600"
          >
            {/* Checkbox and label */}
            <div className="flex items-start gap-4 mb-3">
              <input
                type="checkbox"
                checked={item.passed}
                onChange={() => toggleItem(item.id)}
                className="mt-1 w-5 h-5 rounded border-slate-600 text-green-500 focus:ring-green-500 cursor-pointer"
              />
              <label className="flex-1 cursor-pointer">
                <p className={`font-medium ${
                  item.passed
                    ? 'text-slate-400 line-through'
                    : 'text-slate-200'
                }`}>
                  {item.label}
                </p>
              </label>
              {item.passed && (
                <span className="text-green-400 text-sm font-semibold">✓</span>
              )}
            </div>

            {/* Notes input */}
            <div className="ml-9">
              <textarea
                value={item.notes}
                onChange={(e) => updateNotes(item.id, e.target.value)}
                placeholder="Add notes/issues found..."
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                rows={3}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Export button */}
      <div className="flex justify-end">
        <button
          onClick={exportToJson}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
        >
          Export to JSON
        </button>
      </div>

      {/* Footer note */}
      <div className="mt-8 p-4 bg-slate-800 rounded-lg border border-slate-700 text-slate-400 text-sm">
        <p>
          <span className="font-semibold">Note:</span> This checklist is only
          visible in development mode. Check all items before release.
        </p>
      </div>
    </div>
  )
}

export default QAChecklist
