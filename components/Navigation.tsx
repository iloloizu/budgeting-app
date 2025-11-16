'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from './ThemeProvider'

interface User {
  id: string
  name: string
  email: string
}

export default function Navigation({ selectedUserId }: { selectedUserId: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (selectedUserId) {
      fetchUser()
    }
  }, [selectedUserId])

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const users = await res.json()
        const user = users.find((u: User) => u.id === selectedUserId)
        setCurrentUser(user || null)
      }
    } catch (error) {
      console.error('Error fetching user:', error)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('selectedUserId')
    router.push('/')
    router.refresh()
  }

  const handleSwitchUser = () => {
    localStorage.removeItem('selectedUserId')
    router.push('/')
    router.refresh()
  }

  const navItems = [
    { href: '/', label: 'Dashboard' },
    { href: '/budget', label: 'Monthly Budget' },
    { href: '/transactions', label: 'Transactions' },
    { href: '/reports', label: 'Reports' },
    { href: '/net-worth', label: 'Net Worth' },
    { href: '/import', label: 'Import CSV' },
    { href: '/assistant', label: 'LLM Assistant' },
  ]

  return (
    <nav className="border-b border-black dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4 lg:space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? 'text-black dark:text-white border-b-2 border-black dark:border-white'
                    : 'text-black dark:text-gray-300 hover:opacity-70'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>

          {/* Right side actions */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                toggleTheme()
              }}
              className="p-2 rounded-md text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle dark mode"
              type="button"
            >
              {theme === 'dark' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <div className="relative">
              {currentUser && (
                <>
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="hidden sm:flex items-center space-x-2 text-sm text-black dark:text-white hover:opacity-70"
                  >
                    <span>{currentUser.name}</span>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  {/* Mobile user button */}
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="sm:hidden p-2 rounded-md text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                    aria-label="User menu"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </button>
                </>
              )}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 border border-black dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg z-50">
                  <div className="p-2 border-b border-black dark:border-gray-700">
                    <div className="text-sm font-medium text-black dark:text-white">{currentUser?.name}</div>
                    <div className="text-xs text-black dark:text-gray-400">{currentUser?.email}</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setShowUserMenu(false)
                      handleSwitchUser()
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-black dark:text-white hover:bg-black dark:hover:bg-gray-700 hover:text-white transition-colors"
                  >
                    Switch User
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setShowUserMenu(false)
                      handleLogout()
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-black dark:text-white hover:bg-black dark:hover:bg-gray-700 hover:text-white transition-colors"
                  >
                    Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-black dark:border-gray-700 relative z-50 bg-white dark:bg-gray-900">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2 text-base font-medium rounded-md transition-colors ${
                    pathname === item.href
                      ? 'bg-black dark:bg-gray-700 text-white'
                      : 'text-black dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
      {showUserMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowUserMenu(false)
          }}
        />
      )}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setMobileMenuOpen(false)
          }}
        />
      )}
    </nav>
  )
}

