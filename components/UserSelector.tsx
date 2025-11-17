'use client'

import { useEffect, useState } from 'react'
import Modal from './Modal'
import { useModal } from '@/hooks/useModal'

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
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const modal = useModal()

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

  const handleDeleteClick = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering the select action
    setDeleteConfirm(userId)
  }

  const handleDeleteConfirm = async (userId: string) => {
    try {
      const res = await fetch(`/api/users?userId=${userId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        // Remove user from list
        setUsers(users.filter(u => u.id !== userId))
        // Clear selected user if it was the deleted one
        const selectedUserId = localStorage.getItem('selectedUserId')
        if (selectedUserId === userId) {
          localStorage.removeItem('selectedUserId')
        }
        setDeleteConfirm(null)
      } else {
        const data = await res.json()
        modal.showError(data.error || 'Failed to delete user')
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      modal.showError('Failed to delete user')
    }
  }

  const handleDeleteCancel = () => {
    setDeleteConfirm(null)
  }

  if (loading) {
    return <div className="text-black dark:text-white">Loading users...</div>
  }

  return (
    <div className="space-y-6">
      <Modal
        isOpen={modal.isOpen}
        onClose={modal.closeModal}
        title={modal.modalOptions.title}
        message={modal.modalOptions.message}
        type={modal.modalOptions.type}
        confirmText={modal.modalOptions.confirmText}
        cancelText={modal.modalOptions.cancelText}
        onConfirm={modal.modalOptions.onConfirm}
        showCancel={modal.modalOptions.showCancel}
      />
      <h2 className="text-2xl font-bold text-black dark:text-white mb-4">Select User</h2>
      {users.length > 0 && (
        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="relative group"
            >
              {deleteConfirm === user.id ? (
                <div className="border border-red-600 dark:border-red-500 px-4 py-3 bg-red-50 dark:bg-red-900/20">
                  <div className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                    Are you sure you want to delete this account?
                  </div>
                  <div className="text-xs text-black dark:text-gray-300 mb-3">
                    <div className="font-medium">{user.name}</div>
                    <div>{user.email}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDeleteConfirm(user.id)}
                      className="px-3 py-1 text-sm border border-red-600 dark:border-red-500 text-red-600 dark:text-red-400 bg-white dark:bg-gray-800 hover:bg-red-600 dark:hover:bg-red-700 hover:text-white transition-colors"
                    >
                      Yes, Delete
                    </button>
                    <button
                      onClick={handleDeleteCancel}
                      className="px-3 py-1 text-sm border border-black dark:border-gray-700 text-black dark:text-white bg-white dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onUserSelect(user.id)}
                    className="flex-1 text-left border border-black dark:border-gray-700 px-4 py-3 text-black dark:text-white bg-white dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 hover:text-white transition-colors"
                  >
                    <div className="font-medium">{user.name}</div>
                    <div className="text-sm">{user.email}</div>
                  </button>
                  <button
                    onClick={(e) => handleDeleteClick(user.id, e)}
                    className="px-3 py-3 border border-red-600 dark:border-red-500 text-red-600 dark:text-red-400 bg-white dark:bg-gray-800 hover:bg-red-600 dark:hover:bg-red-700 hover:text-white transition-colors"
                    title="Delete account"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
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

