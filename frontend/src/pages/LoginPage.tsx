import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface LoginFormData {
  email: string
  password: string
  role: 'student' | 'teacher' | 'parent'
}

const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login } = useAuth()
  
  // Get role from URL params, default to student
  const urlRole = (searchParams.get('role') || 'student') as 'student' | 'teacher' | 'parent'

  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
    role: urlRole
  })
  
  const [error, setError] = useState<string>('')
  const [loadingState, setLoadingState] = useState<'idle' | 'loading'>('idle')

  useEffect(() => {
    setFormData(prev => ({ ...prev, role: urlRole }))
  }, [urlRole])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    if (error) setError('')
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoadingState('loading')

    try {
      if (!formData.email || !formData.password) {
        setError('Please fill in all fields')
        setLoadingState('idle')
        return
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email)) {
        setError('Please enter a valid email address')
        setLoadingState('idle')
        return
      }

      await login(formData.email, formData.password, formData.role)

      const roleRoutes: Record<string, string> = {
        student: '/student/session',
        teacher: '/teacher/dashboard',
        parent: '/parent/overview'
      }

      navigate(roleRoutes[formData.role])
    } catch (err) {
      if (err instanceof Error) {
        const errorMessage = err.message
        if (errorMessage.includes('401')) {
          setError('Invalid email or password')
        } else if (errorMessage.includes('403')) {
          setError('Wrong role selected')
        } else if (
          errorMessage.includes('ECONNREFUSED') ||
          errorMessage.includes('Network') ||
          errorMessage.includes('cannot connect')
        ) {
          setError('Cannot reach server — check your connection')
        } else {
          setError(errorMessage || 'Login failed. Please try again.')
        }
      } else if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Cannot reach server — check your connection')
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
      setLoadingState('idle')
    }
  }

  const roleName = {
    student: 'Student',
    teacher: 'Teacher',
    parent: 'Parent'
  }[formData.role]

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-xl font-display font-bold text-ink mb-2" style={{ fontSize: 'clamp(56px, 10vw, 140px)' }}>
            LUMIO
          </h1>
          <p className="text-sm text-muted font-mono" style={{ letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            — Welcome back, {roleName.toLowerCase()}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-surface border border-border p-12 mb-8">
          {/* Error Message */}
          {error && (
            <div className="mb-8 p-4 bg-red-50 border-[1.5px] border-red-600">
              <p className="text-red-600 text-sm font-mono">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="form-label">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                disabled={loadingState === 'loading'}
                placeholder="name@example.com"
                className="input-field"
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                disabled={loadingState === 'loading'}
                placeholder="••••••••"
                className="input-field"
              />
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loadingState === 'loading'}
              className="btn-accent w-full"
            >
              {loadingState === 'loading' ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Register Link */}
          <p className="text-center text-muted text-sm font-mono mt-8" style={{ letterSpacing: '0.02em' }}>
            New here?{' '}
            <a
              href={`/register?role=${formData.role}`}
              className="text-accent hover:underline font-bold transition-colors"
            >
              Create an account
            </a>
          </p>
        </div>

        {/* Footer */}
        <div className="text-center text-muted text-xs font-mono" style={{ letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          <p>© 2026 Lumio — by Unblur</p>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
