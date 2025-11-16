'use client'

import { useEffect, useState } from 'react'
import Login from './Login'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    // Check if user is authenticated
    const authStatus = localStorage.getItem('authenticated') === 'true'
    setAuthenticated(authStatus)
  }, [])

  const handleLogin = () => {
    setAuthenticated(true)
  }

  // Show nothing while checking authentication
  if (authenticated === null) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-black dark:text-white">Loading...</div>
      </div>
    )
  }

  // Show login if not authenticated
  if (!authenticated) {
    return <Login onLogin={handleLogin} />
  }

  // Show children if authenticated
  return <>{children}</>
}

