import React from 'react'
import { Outlet } from 'react-router-dom'

const ParentLayout: React.FC = () => {
  return (
    <div className="parent-layout">
      <h1>Parent Dashboard</h1>
      <Outlet />
    </div>
  )
}

export default ParentLayout