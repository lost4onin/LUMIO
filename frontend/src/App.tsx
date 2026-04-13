import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useCustomCursor } from './hooks/useCustomCursor'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import StudentLayout from './layouts/StudentLayout'
import TeacherLayout from './layouts/TeacherLayout'
import ParentLayout from './layouts/ParentLayout'
import ProtectedRoute from './components/ProtectedRoute'

// Student pages
import SessionPage from './pages/student/SessionPage'
import StudentHomeworkPage from './pages/student/HomeworkPage'
import ProgressPage from './pages/student/ProgressPage'

// Teacher pages
import DashboardPage from './pages/teacher/DashboardPage'
import ChatbotPage from './pages/teacher/ChatbotPage'
import TeacherHomeworkPage from './pages/teacher/HomeworkPage'

// Parent pages
import OverviewPage from './pages/parent/OverviewPage'
import SessionHistoryPage from './pages/parent/SessionHistoryPage'

function AppContent() {
  useCustomCursor()

  return (
    <Router>
      <div className="min-h-screen bg-bg">
        <Routes>
          {/* Public */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Student */}
          <Route
            path="/student"
            element={
              <ProtectedRoute role="student">
                <StudentLayout />
              </ProtectedRoute>
            }
          >
            <Route path="session" element={<SessionPage />} />
            <Route path="homework" element={<StudentHomeworkPage />} />
            <Route path="progress" element={<ProgressPage />} />
          </Route>

          {/* Teacher */}
          <Route
            path="/teacher"
            element={
              <ProtectedRoute role="teacher">
                <TeacherLayout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="chatbot" element={<ChatbotPage />} />
            <Route path="homework" element={<TeacherHomeworkPage />} />
          </Route>

          {/* Parent */}
          <Route
            path="/parent"
            element={
              <ProtectedRoute role="parent">
                <ParentLayout />
              </ProtectedRoute>
            }
          >
            <Route path="overview" element={<OverviewPage />} />
            <Route path="history" element={<SessionHistoryPage />} />
          </Route>
        </Routes>
      </div>
    </Router>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
