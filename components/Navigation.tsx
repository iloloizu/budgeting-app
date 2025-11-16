'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

interface User {
  id: string
  name: string
  email: string
}

export default function Navigation({ selectedUserId }: { selectedUserId: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)

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
    { href: '/import', label: 'Import CSV' },
    { href: '/assistant', label: 'LLM Assistant' },
  ]

  return (
    <nav className="border-b border-black bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? 'text-black border-b-2 border-black'
                    : 'text-black hover:opacity-70'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="relative">
            {currentUser && (
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2 text-sm text-black hover:opacity-70"
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
            )}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 border border-black bg-white shadow-lg z-50">
                <div className="p-2 border-b border-black">
                  <div className="text-sm font-medium text-black">{currentUser?.name}</div>
                  <div className="text-xs text-black">{currentUser?.email}</div>
                </div>
                <button
                  onClick={handleSwitchUser}
                  className="w-full text-left px-4 py-2 text-sm text-black hover:bg-black hover:text-white transition-colors"
                >
                  Switch User
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-black hover:bg-black hover:text-white transition-colors"
                >
                  Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {showUserMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowUserMenu(false)}
        />
      )}
    </nav>
  )
}

