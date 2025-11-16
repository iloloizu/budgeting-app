'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import UserSelector from '@/components/UserSelector'
import Navigation from '@/components/Navigation'
import { formatCurrency } from '@/lib/format'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

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
    // Refresh to update navigation
    window.location.href = '/'
  }

  if (!selectedUserId) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black dark:text-white mb-6 sm:mb-8">Fortis Wealth</h1>
          <UserSelector onUserSelect={handleUserSelect} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Navigation selectedUserId={selectedUserId} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black dark:text-white mb-4 sm:mb-6 lg:mb-8">Dashboard</h1>
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

  const fetchBudget = useCallback(async () => {
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
    }
  }, [userId, currentYear, currentMonth])

  const fetchTransactions = useCallback(async () => {
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
    } finally {
      setLoading(false)
    }
  }, [userId, currentYear, currentMonth])

  useEffect(() => {
    if (userId) {
      fetchBudget()
      fetchTransactions()
    }
  }, [userId, currentMonth, currentYear, fetchBudget, fetchTransactions])

  // Memoize calculations to avoid recalculating on every render
  const { actualIncome, actualExpenses, actualSavings, plannedSavings, savingsIndicator, expensesIndicator } = useMemo(() => {
    // Single O(n) pass through transactions
    let income = 0
    let expenses = 0
    
    for (const t of transactions) {
      if (t.type === 'income') {
        income += t.amount
      } else if (t.type === 'expense') {
        expenses += t.amount
      }
    }

    const savings = income - expenses
    const planned = budget?.totalPlannedSavings || 0

    return {
      actualIncome: income,
      actualExpenses: expenses,
      actualSavings: savings,
      plannedSavings: planned,
      savingsIndicator: savings >= 0 ? 'green' : 'red',
      expensesIndicator: expenses <= (budget?.totalPlannedExpenses || 0) ? 'green' : 'red',
    }
  }, [transactions, budget])

  if (loading) {
    return <div className="text-black dark:text-white">Loading...</div>
  }

  // Format month and year for display
  const monthName = new Date(currentYear, currentMonth - 1).toLocaleString('default', { month: 'long' })
  const yearDisplay = currentYear

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      <div className="mb-2 sm:mb-4">
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          Showing data for <span className="font-semibold text-black dark:text-white">{monthName} {yearDisplay}</span>
        </p>
      </div>
      
      <NetWorthChart userId={userId} />
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="border border-black dark:border-gray-700 p-4 sm:p-6 bg-white dark:bg-gray-800">
          <h3 className="text-xs sm:text-sm font-medium text-black dark:text-white mb-2">
            Actual Income
          </h3>
          <p className="text-3xl sm:text-4xl font-light text-black dark:text-white">
            ${formatCurrency(actualIncome)}
          </p>
          <p className="text-xs sm:text-sm text-black dark:text-gray-300 mt-2">
            Planned: ${formatCurrency(budget?.totalPlannedIncome)}
          </p>
        </div>
        <div className="border border-black dark:border-gray-700 p-4 sm:p-6 bg-white dark:bg-gray-800">
          <h3 className="text-xs sm:text-sm font-medium text-black dark:text-white mb-2 flex items-center gap-2">
            Actual Expenses
            {expensesIndicator === 'green' ? (
              <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            )}
          </h3>
          <p className="text-3xl sm:text-4xl font-light text-black dark:text-white">
            ${formatCurrency(actualExpenses)}
          </p>
          <p className="text-xs sm:text-sm text-black dark:text-gray-300 mt-2">
            Planned: ${formatCurrency(budget?.totalPlannedExpenses)}
          </p>
        </div>
        <div className="border border-black dark:border-gray-700 p-4 sm:p-6 bg-white dark:bg-gray-800 sm:col-span-2 lg:col-span-1">
          <h3 className="text-xs sm:text-sm font-medium text-black dark:text-white mb-2 flex items-center gap-2">
            Actual Savings
            {savingsIndicator === 'green' ? (
              <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            )}
          </h3>
          <p className={`text-3xl sm:text-4xl font-light ${
            savingsIndicator === 'green' 
              ? 'text-green-600 dark:text-green-400' 
              : 'text-red-600 dark:text-red-400'
          }`}>
            ${formatCurrency(actualSavings)}
          </p>
          <p className="text-xs sm:text-sm text-black dark:text-gray-300 mt-2">
            Planned: ${formatCurrency(plannedSavings)}
          </p>
        </div>
      </div>
    </div>
  )
}

function NetWorthChart({ userId }: { userId: string }) {
  const [netWorthData, setNetWorthData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNetWorth = useCallback(async () => {
    try {
      const res = await fetch(`/api/net-worth/snapshot?userId=${userId}&limit=12`)
      if (res.ok) {
        const data = await res.json()
        setNetWorthData(data.reverse()) // Reverse to show oldest first
      }
    } catch (error) {
      console.error('Error fetching net worth:', error)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchNetWorth()
  }, [userId, fetchNetWorth])

  const chartData = useMemo(() => {
    return netWorthData.map((snapshot) => ({
      month: `${new Date(snapshot.year, snapshot.month - 1).toLocaleString('default', { month: 'short' })} ${snapshot.year}`,
      netWorth: snapshot.netWorth,
    }))
  }, [netWorthData])

  if (loading || chartData.length === 0) {
    return null
  }

  return (
    <div className="border border-black dark:border-gray-700 p-4 sm:p-6 bg-white dark:bg-gray-800">
      <h2 className="text-lg sm:text-xl font-bold text-black dark:text-white mb-4">
        Net Worth Trend
      </h2>
      <div className="h-64 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
            <XAxis 
              dataKey="month" 
              stroke="#666"
              tick={{ fill: '#666', fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              stroke="#666"
              tick={{ fill: '#666' }}
              tickFormatter={(value) => `$${formatCurrency(value)}`}
            />
            <Tooltip 
              formatter={(value: any) => `$${formatCurrency(Number(value))}`}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid black',
                borderRadius: '4px',
                padding: '8px',
              }}
            />
            <Line 
              type="monotone" 
              dataKey="netWorth" 
              stroke="#2563eb" 
              strokeWidth={2}
              dot={{ fill: '#2563eb', r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

