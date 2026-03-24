import React from 'react'
import { Outlet } from 'react-router-dom'

const TeacherLayout: React.FC = () => {
  return (
    <div className="teacher-layout">
      <h1>Teacher Dashboard</h1>
      <Outlet />
    </div>
  )
}

export default TeacherLayout