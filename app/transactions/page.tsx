'use client'

import { useEffect, useState } from 'react'
import Navigation from '@/components/Navigation'

export default function TransactionsPage() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [transactions, setTransactions] = useState<any[]>([])
  const [incomeSources, setIncomeSources] = useState<any[]>([])
  const [expenseCategories, setExpenseCategories] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    type: 'expense',
    incomeSourceId: '',
    expenseCategoryId: '',
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('selectedUserId')
    if (stored) {
      setSelectedUserId(stored)
      fetchData(stored)
    }
  }, [])

  useEffect(() => {
    if (selectedUserId) {
      fetchTransactions()
    }
  }, [selectedUserId, year, month])

  const fetchData = async (userId: string) => {
    setLoading(true)
    try {
      const [incomeRes, categoriesRes] = await Promise.all([
        fetch(`/api/income-sources?userId=${userId}`),
        fetch(`/api/expense-categories?userId=${userId}`),
      ])

      if (incomeRes.ok) {
        const income = await incomeRes.json()
        setIncomeSources(income.filter((s: any) => s.isActive))
      }

      if (categoriesRes.ok) {
        const categories = await categoriesRes.json()
        setExpenseCategories(categories)
      }

      await fetchTransactions()
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTransactions = async () => {
    if (!selectedUserId) return
    try {
      const res = await fetch(
        `/api/transactions?userId=${selectedUserId}&year=${year}&month=${month}`
      )
      if (res.ok) {
        const data = await res.json()
        setTransactions(data)
      }
    } catch (error) {
      console.error('Error fetching transactions:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUserId) return

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          ...formData,
          amount: parseFloat(formData.amount),
        }),
      })

      if (res.ok) {
        await fetchTransactions()
        setShowForm(false)
        setFormData({
          date: new Date().toISOString().split('T')[0],
          description: '',
          amount: '',
          type: 'expense',
          incomeSourceId: '',
          expenseCategoryId: '',
        })
      }
    } catch (error) {
      console.error('Error creating transaction:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      try {
        await fetch(`/api/transactions?id=${id}`, { method: 'DELETE' })
        await fetchTransactions()
      } catch (error) {
        console.error('Error deleting transaction:', error)
      }
    }
  }

  if (!selectedUserId) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-4 py-16">
          <p className="text-black">Please select a user first.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Navigation selectedUserId={selectedUserId} />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <p className="text-black">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Navigation selectedUserId={selectedUserId} />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-light text-black">Transactions</h1>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="border border-black px-4 py-2 text-black hover:bg-black hover:text-white transition-colors"
            >
              Add Transaction
            </button>
          )}
        </div>

        <div className="mb-6 flex gap-4">
          <div>
            <label className="block text-sm font-medium text-black mb-1">
              Year
            </label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="border border-black px-3 py-2 text-black bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-black mb-1">
              Month
            </label>
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="border border-black px-3 py-2 text-black bg-white"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(year, m - 1).toLocaleString('default', {
                    month: 'long',
                  })}
                </option>
              ))}
            </select>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-8 border border-black p-6">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-black mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                  className="w-full border border-black px-3 py-2 text-black bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-1">
                  Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value })
                  }
                  className="w-full border border-black px-3 py-2 text-black bg-white"
                >
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full border border-black px-3 py-2 text-black bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-1">
                  Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  className="w-full border border-black px-3 py-2 text-black bg-white"
                  required
                />
              </div>
              {formData.type === 'income' ? (
                <div>
                  <label className="block text-sm font-medium text-black mb-1">
                    Income Source
                  </label>
                  <select
                    value={formData.incomeSourceId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        incomeSourceId: e.target.value,
                      })
                    }
                    className="w-full border border-black px-3 py-2 text-black bg-white"
                    required
                  >
                    <option value="">Select source</option>
                    {incomeSources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-black mb-1">
                    Expense Category
                  </label>
                  <select
                    value={formData.expenseCategoryId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        expenseCategoryId: e.target.value,
                      })
                    }
                    className="w-full border border-black px-3 py-2 text-black bg-white"
                    required
                  >
                    <option value="">Select category</option>
                    {expenseCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="border border-black px-4 py-2 text-black hover:bg-black hover:text-white transition-colors"
              >
                Add Transaction
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setFormData({
                    date: new Date().toISOString().split('T')[0],
                    description: '',
                    amount: '',
                    type: 'expense',
                    incomeSourceId: '',
                    expenseCategoryId: '',
                  })
                }}
                className="border border-black px-4 py-2 text-black hover:bg-black hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="border border-black">
          <table className="w-full">
            <thead>
              <tr className="border-b border-black">
                <th className="text-left p-3 text-sm font-medium text-black">
                  Date
                </th>
                <th className="text-left p-3 text-sm font-medium text-black">
                  Description
                </th>
                <th className="text-left p-3 text-sm font-medium text-black">
                  Category/Source
                </th>
                <th className="text-right p-3 text-sm font-medium text-black">
                  Amount
                </th>
                <th className="text-center p-3 text-sm font-medium text-black">
                  Type
                </th>
                <th className="text-center p-3 text-sm font-medium text-black">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.id} className="border-b border-black">
                  <td className="p-3 text-black">
                    {new Date(transaction.date).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-black">{transaction.description}</td>
                  <td className="p-3 text-black">
                    {transaction.type === 'income'
                      ? transaction.incomeSource?.name || '-'
                      : transaction.expenseCategory?.name || '-'}
                  </td>
                  <td className="p-3 text-right text-black">
                    ${transaction.amount.toFixed(2)}
                  </td>
                  <td className="p-3 text-center text-black capitalize">
                    {transaction.type}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => handleDelete(transaction.id)}
                      className="text-black hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-3 text-center text-black">
                    No transactions found for this period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

