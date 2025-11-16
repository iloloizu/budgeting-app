'use client'

import { useState } from 'react'

const PASSWORD = 'jaevin101'

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Simulate a small delay for better UX
    await new Promise(resolve => setTimeout(resolve, 300))

    if (password === PASSWORD) {
      localStorage.setItem('authenticated', 'true')
      onLogin()
    } else {
      setError('Incorrect password. Please try again.')
      setPassword('')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full border border-black dark:border-gray-700 p-8 bg-white dark:bg-gray-800">
        <h1 className="text-3xl font-bold text-black dark:text-white mb-2">Fortis Wealth</h1>
        <p className="text-sm text-black dark:text-gray-400 mb-6">Please enter your password to continue</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-black dark:text-white mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError('')
              }}
              className="w-full border border-black dark:border-gray-700 px-4 py-2 text-black dark:text-white bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-gray-500"
              placeholder="Enter password"
              autoFocus
              disabled={loading}
            />
          </div>
          
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full border border-black dark:border-gray-700 px-4 py-2 text-black dark:text-white bg-white dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  )
}

