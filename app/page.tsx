'use client'

import { useEffect, useState } from 'react'
import UserSelector from '@/components/UserSelector'
import Navigation from '@/components/Navigation'

export default function Home() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('selectedUserId')
    if (stored) {
      setSelectedUserId(stored)
    }
  }, [])

  const handleUserSelect = (userId: string) => {
    setSelectedUserId(userId)
    localStorage.setItem('selectedUserId', userId)
  }

  if (!selectedUserId) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-4 py-16">
          <h1 className="text-4xl font-light text-black mb-8">Budget App</h1>
          <UserSelector onUserSelect={handleUserSelect} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Navigation selectedUserId={selectedUserId} />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-light text-black mb-8">Dashboard</h1>
        <DashboardContent userId={selectedUserId} />
      </div>
    </div>
  )
}

function DashboardContent({ userId }: { userId: string }) {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [budget, setBudget] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBudget()
    fetchTransactions()
  }, [userId, currentMonth, currentYear])

  const fetchBudget = async () => {
    try {
      const res = await fetch(
        `/api/budget?userId=${userId}&year=${currentYear}&month=${currentMonth}`
      )
      if (res.ok) {
        const data = await res.json()
        setBudget(data)
      }
    } catch (error) {
      console.error('Error fetching budget:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTransactions = async () => {
    try {
      const res = await fetch(
        `/api/transactions?userId=${userId}&year=${currentYear}&month=${currentMonth}`
      )
      if (res.ok) {
        const data = await res.json()
        setTransactions(data)
      }
    } catch (error) {
      console.error('Error fetching transactions:', error)
    }
  }

  if (loading) {
    return <div className="text-black">Loading...</div>
  }

  const actualIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)
  const actualExpenses = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)
  const actualSavings = actualIncome - actualExpenses

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="border border-black p-6">
          <h3 className="text-sm font-medium text-black mb-2">
            Planned Income
          </h3>
          <p className="text-3xl font-light text-black">
            ${budget?.totalPlannedIncome?.toFixed(2) || '0.00'}
          </p>
          <p className="text-sm text-black mt-2">
            Actual: ${actualIncome.toFixed(2)}
          </p>
        </div>
        <div className="border border-black p-6">
          <h3 className="text-sm font-medium text-black mb-2">
            Planned Expenses
          </h3>
          <p className="text-3xl font-light text-black">
            ${budget?.totalPlannedExpenses?.toFixed(2) || '0.00'}
          </p>
          <p className="text-sm text-black mt-2">
            Actual: ${actualExpenses.toFixed(2)}
          </p>
        </div>
        <div className="border border-black p-6">
          <h3 className="text-sm font-medium text-black mb-2">
            Planned Savings
          </h3>
          <p className="text-3xl font-light text-black">
            ${budget?.totalPlannedSavings?.toFixed(2) || '0.00'}
          </p>
          <p className="text-sm text-black mt-2">
            Actual: ${actualSavings.toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  )
}

