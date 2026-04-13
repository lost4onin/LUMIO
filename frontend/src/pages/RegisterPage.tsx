import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface RegisterFormData {
  name: string
  email: string
  password: string
  confirmPassword: string
  role: 'student' | 'teacher' | 'parent'
}

interface FormErrors {
  name?: string
  email?: string
  password?: string
  confirmPassword?: string
}

const RegisterPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { register, isLoading } = useAuth()

  // Get role from URL params, default to student
  const urlRole = (searchParams.get('role') || 'student') as 'student' | 'teacher' | 'parent'

  const [formData, setFormData] = useState<RegisterFormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: urlRole
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [generalError, setGeneralError] = useState<string>('')
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
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }))
    }
    if (generalError) setGeneralError('')
  }

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Full name is required'
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email)) {
        newErrors.email = 'Please enter a valid email address'
      }
    }

    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setGeneralError('')
    setLoadingState('loading')

    if (!validateForm()) {
      setLoadingState('idle')
      return
    }

    try {
      await register(formData.name, formData.email, formData.password, formData.role)

      const roleRoute: Record<string, string> = {
        student: '/student/session',
        teacher: '/teacher/dashboard',
        parent: '/parent/overview'
      }

      navigate(roleRoute[formData.role])
    } catch (err) {
      if (err instanceof Error) {
        setGeneralError(err.message || 'Registration failed. Please try again.')
      } else {
        setGeneralError('An unexpected error occurred. Please try again.')
      }
      setLoadingState('idle')
    }
  }

  const roleName = {
    student: 'Student',
    teacher: 'Teacher',
    parent: 'Parent'
  }[formData.role]

  return (    <div className="min-h-screen bg-bg flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-xl font-display font-bold text-ink mb-2" style={{ fontSize: 'clamp(56px, 10vw, 140px)' }}>
            LUMIO
          </h1>
          <p className="text-sm text-muted font-mono" style={{ letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            — Create Account
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-surface border border-border p-12 mb-8">
          {/* General Error Message */}
          {generalError && (
            <div className="mb-8 p-4 bg-red-50 border-[1.5px] border-red-600">
              <p className="text-red-600 text-sm font-mono">{generalError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Full Name Field */}
            <div>
              <label htmlFor="name" className="form-label">
                Full Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                disabled={loadingState === 'loading'}
                placeholder="John Doe"
                className={`input-field ${
                  errors.name ? 'border-red-600' : ''
                }`}
              />
              {errors.name && (
                <p className="text-red-600 text-xs mt-2 font-mono">{errors.name}</p>
              )}
            </div>

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
                className={`input-field ${
                  errors.email ? 'border-red-600' : ''
                }`}
              />
              {errors.email && (
                <p className="text-red-600 text-xs mt-2 font-mono">{errors.email}</p>
              )}
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
                className={`input-field ${
                  errors.password ? 'border-red-600' : ''
                }`}
              />
              {errors.password && (
                <p className="text-red-600 text-xs mt-2 font-mono">{errors.password}</p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <label htmlFor="confirmPassword" className="form-label">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                disabled={loadingState === 'loading'}
                placeholder="••••••••"
                className={`input-field ${
                  errors.confirmPassword ? 'border-red-600' : ''
                }`}
              />
              {errors.confirmPassword && (
                <p className="text-red-600 text-xs mt-2 font-mono">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Create Account Button */}
            <button
              type="submit"
              disabled={loadingState === 'loading'}
              className="btn-accent w-full"
            >
              {loadingState === 'loading' ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          {/* Login Link */}
          <p className="text-center text-muted text-sm font-mono mt-8" style={{ letterSpacing: '0.02em' }}>
            Already registered?{' '}
            <a
              href={`/login?role=${formData.role}`}
              className="text-accent hover:underline font-bold transition-colors"
            >
              Sign In
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

export default RegisterPage