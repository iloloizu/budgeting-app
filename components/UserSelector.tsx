'use client'

import { useEffect, useState } from 'react'

interface User {
  id: string
  name: string
  email: string
}

export default function UserSelector({
  onUserSelect,
}: {
  onUserSelect: (userId: string) => void
}) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      })
      if (res.ok) {
        const newUser = await res.json()
        setUsers([...users, newUser])
        setName('')
        setEmail('')
        setShowCreateForm(false)
        onUserSelect(newUser.id)
      }
    } catch (error) {
      console.error('Error creating user:', error)
    }
  }

  if (loading) {
    return <div className="text-black dark:text-white">Loading users...</div>
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-black dark:text-white mb-4">Select User</h2>
      {users.length > 0 && (
        <div className="space-y-2">
          {users.map((user) => (
            <button
              key={user.id}
              onClick={() => onUserSelect(user.id)}
              className="w-full text-left border border-black dark:border-gray-700 px-4 py-3 text-black dark:text-white bg-white dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 hover:text-white transition-colors"
            >
              <div className="font-medium">{user.name}</div>
              <div className="text-sm">{user.email}</div>
            </button>
          ))}
        </div>
      )}
      {!showCreateForm ? (
        <button
          onClick={() => setShowCreateForm(true)}
          className="border border-black dark:border-gray-700 px-4 py-2 text-black dark:text-white bg-white dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 hover:text-white transition-colors"
        >
          Create New User
        </button>
      ) : (
        <form onSubmit={handleCreateUser} className="space-y-4 border border-black dark:border-gray-700 p-6 bg-white dark:bg-gray-800">
          <div>
            <label className="block text-sm font-medium text-black dark:text-white mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-black dark:border-gray-700 px-3 py-2 text-black dark:text-white bg-white dark:bg-gray-900"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-black dark:text-white mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-black dark:border-gray-700 px-3 py-2 text-black dark:text-white bg-white dark:bg-gray-900"
              required
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="border border-black dark:border-gray-700 px-4 py-2 text-black dark:text-white bg-white dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 hover:text-white transition-colors"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreateForm(false)
                setName('')
                setEmail('')
              }}
              className="border border-black dark:border-gray-700 px-4 py-2 text-black dark:text-white bg-white dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

