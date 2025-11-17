'use client'

import { useEffect, useState } from 'react'
import Login from './Login'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Check if user is authenticated
    try {
      const authStatus = localStorage.getItem('authenticated') === 'true'
      setAuthenticated(authStatus)
    } catch (error) {
      // localStorage might not be available (SSR)
      console.error('Error accessing localStorage:', error)
      setAuthenticated(false)
    }
  }, [])

  const handleLogin = () => {
    setAuthenticated(true)
    localStorage.setItem('authenticated', 'true')
  }

  // Show nothing while checking authentication (only on client)
  if (!mounted || authenticated === null) {
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

