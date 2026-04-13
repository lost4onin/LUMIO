import React from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const TeacherLayout: React.FC = () => {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  return (
    <div className="flex h-screen bg-bg">
      {/* Sidebar */}
      <aside className="w-64 bg-surface border-r border-border flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <h1 className="text-2xl font-display font-bold text-ink">
            LUMIO
          </h1>
          <p className="text-muted text-xs mt-1 font-mono" style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}>— Teacher</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          <NavLink
            to="/teacher/dashboard"
            className={({ isActive }) =>
              `block px-4 py-3 font-mono text-sm transition ${
                isActive
                  ? 'bg-surface text-accent border-l-2 border-accent'
                  : 'text-ink hover:text-accent hover:bg-bg/50'
              }`
            }
            style={{ letterSpacing: '0.05em' }}
          >
            ✦ Dashboard
          </NavLink>
          <NavLink
            to="/teacher/chatbot"
            className={({ isActive }) =>
              `block px-4 py-3 font-mono text-sm transition ${
                isActive
                  ? 'bg-surface text-accent border-l-2 border-accent'
                  : 'text-ink hover:text-accent hover:bg-bg/50'
              }`
            }
            style={{ letterSpacing: '0.05em' }}
          >
            ✦ Chatbot
          </NavLink>
          <NavLink
            to="/teacher/homework"
            className={({ isActive }) =>
              `block px-4 py-3 font-mono text-sm transition ${
                isActive
                  ? 'bg-surface text-accent border-l-2 border-accent'
                  : 'text-ink hover:text-accent hover:bg-bg/50'
              }`
            }
            style={{ letterSpacing: '0.05em' }}
          >
            ✦ Homework
          </NavLink>
        </nav>

        {/* Logout Button */}
        <div className="px-4 py-6 border-t border-border">
          <button
            onClick={handleLogout}
            className="btn-destructive w-full text-sm"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-bg">
        <div className="p-12">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default TeacherLayout
