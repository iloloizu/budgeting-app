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
    return <div className="text-black">Loading users...</div>
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-light text-black mb-4">Select User</h2>
      {users.length > 0 && (
        <div className="space-y-2">
          {users.map((user) => (
            <button
              key={user.id}
              onClick={() => onUserSelect(user.id)}
              className="w-full text-left border border-black px-4 py-3 hover:bg-black hover:text-white transition-colors"
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
          className="border border-black px-4 py-2 text-black hover:bg-black hover:text-white transition-colors"
        >
          Create New User
        </button>
      ) : (
        <form onSubmit={handleCreateUser} className="space-y-4 border border-black p-6">
          <div>
            <label className="block text-sm font-medium text-black mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-black px-3 py-2 text-black bg-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-black mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-black px-3 py-2 text-black bg-white"
              required
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="border border-black px-4 py-2 text-black hover:bg-black hover:text-white transition-colors"
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
              className="border border-black px-4 py-2 text-black hover:bg-black hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

