'use client'

import { useEffect, useState } from 'react'
import Navigation from '@/components/Navigation'
import { getLightTint } from '@/constants/colors'

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
  const [sortField, setSortField] = useState<'date' | 'description' | 'amount' | 'type' | 'category'>('date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

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

  const handleCategoryChange = async (
    transactionId: string,
    categoryId: string,
    type: 'expense' | 'income'
  ) => {
    try {
      const updateData =
        type === 'expense'
          ? { id: transactionId, expenseCategoryId: categoryId }
          : { id: transactionId, incomeSourceId: categoryId }

      await fetch('/api/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      await fetchTransactions()
    } catch (error) {
      console.error('Error updating transaction category:', error)
      alert('Failed to update category')
    }
  }

  const handleSort = (field: 'date' | 'description' | 'amount' | 'type' | 'category') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sortedTransactions = [...transactions].sort((a, b) => {
    let aValue: any
    let bValue: any

    switch (sortField) {
      case 'date':
        aValue = new Date(a.date).getTime()
        bValue = new Date(b.date).getTime()
        break
      case 'description':
        aValue = a.description.toLowerCase()
        bValue = b.description.toLowerCase()
        break
      case 'amount':
        aValue = a.amount
        bValue = b.amount
        break
      case 'type':
        aValue = a.type
        bValue = b.type
        break
      case 'category':
        if (a.type === 'income') {
          aValue = a.incomeSource?.name || ''
        } else {
          aValue = a.expenseCategory?.name || ''
        }
        if (b.type === 'income') {
          bValue = b.incomeSource?.name || ''
        } else {
          bValue = b.expenseCategory?.name || ''
        }
        break
      default:
        return 0
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  const getCategoryColor = (transaction: any): string => {
    if (transaction.type === 'expense' && transaction.expenseCategory) {
      const category = expenseCategories.find(
        (c) => c.id === transaction.expenseCategory.id
      )
      return category?.colorHex || '#FDE2E4'
    }
    // Income sources don't have colors yet, but we could add them later
    return '#FFFFFF'
  }

  useEffect(() => {
    const stored = localStorage.getItem('selectedUserId')
    if (!stored && !selectedUserId) {
      window.location.href = '/'
    }
  }, [selectedUserId])

  if (!selectedUserId) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900">
        <div className="max-w-2xl mx-auto px-4 py-16">
          <p className="text-black dark:text-white">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900">
        <Navigation selectedUserId={selectedUserId} />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <p className="text-black dark:text-white">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Navigation selectedUserId={selectedUserId} />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-black dark:text-white">Transactions</h1>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="border border-black dark:border-gray-700 px-4 py-2 text-black dark:text-white bg-white dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 hover:text-white transition-colors"
            >
              Add Transaction
            </button>
          )}
        </div>

        <div className="mb-6 flex gap-4">
          <div>
            <label className="block text-sm font-medium text-black dark:text-white mb-1">
              Year
            </label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="border border-black dark:border-gray-700 px-3 py-2 text-black dark:text-white bg-white dark:bg-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-black dark:text-white mb-1">
              Month
            </label>
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="border border-black dark:border-gray-700 px-3 py-2 text-black dark:text-white bg-white dark:bg-gray-900"
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
          <form onSubmit={handleSubmit} className="mb-8 border border-black dark:border-gray-700 p-6 bg-white dark:bg-gray-800">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">
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
                <label className="block text-sm font-medium text-black dark:text-white mb-1">
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
                <label className="block text-sm font-medium text-black dark:text-white mb-1">
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
                <label className="block text-sm font-medium text-black dark:text-white mb-1">
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
                  <label className="block text-sm font-medium text-black dark:text-white mb-1">
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
                  <label className="block text-sm font-medium text-black dark:text-white mb-1">
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
                className="border border-black dark:border-gray-700 px-4 py-2 text-black dark:text-white bg-white dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 hover:text-white transition-colors"
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
                className="border border-black dark:border-gray-700 px-4 py-2 text-black dark:text-white bg-white dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="border border-black dark:border-gray-700 bg-white dark:bg-gray-800">
            <table className="w-full">
              <thead>
                <tr className="border-b border-black dark:border-gray-700">
                  <th className="text-left p-3 text-sm font-medium text-black dark:text-white">
                    <button
                      onClick={() => handleSort('date')}
                      className="flex items-center gap-1 hover:opacity-70"
                    >
                      Date
                      {sortField === 'date' && (
                        <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </button>
                  </th>
                  <th className="text-left p-3 text-sm font-medium text-black dark:text-white">
                    <button
                      onClick={() => handleSort('description')}
                      className="flex items-center gap-1 hover:opacity-70"
                    >
                      Description
                      {sortField === 'description' && (
                        <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </button>
                  </th>
                  <th className="text-left p-3 text-sm font-medium text-black dark:text-white">
                    <button
                      onClick={() => handleSort('category')}
                      className="flex items-center gap-1 hover:opacity-70"
                    >
                      Category/Source
                      {sortField === 'category' && (
                        <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </button>
                  </th>
                  <th className="text-right p-3 text-sm font-medium text-black dark:text-white">
                    <button
                      onClick={() => handleSort('amount')}
                      className="flex items-center gap-1 hover:opacity-70 ml-auto"
                    >
                      Amount
                      {sortField === 'amount' && (
                        <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </button>
                  </th>
                  <th className="text-center p-3 text-sm font-medium text-black dark:text-white">
                    <button
                      onClick={() => handleSort('type')}
                      className="flex items-center gap-1 hover:opacity-70 mx-auto"
                    >
                      Type
                      {sortField === 'type' && (
                        <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </button>
                  </th>
                  <th className="text-center p-3 text-sm font-medium text-black dark:text-white">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedTransactions.map((transaction) => {
                  const categoryColor = getCategoryColor(transaction)
                  const rowTint = getLightTint(categoryColor, 0.45)

                  return (
                  <tr
                    key={transaction.id}
                    className="border-b border-black dark:border-gray-700"
                    style={{ backgroundColor: rowTint }}
                  >
                  <td className="p-3 text-black dark:text-white">
                    {new Date(transaction.date).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-black dark:text-white">{transaction.description}</td>
                  <td className="p-3">
                    {transaction.type === 'income' ? (
                      <select
                        value={transaction.incomeSourceId || ''}
                        onChange={(e) =>
                          handleCategoryChange(transaction.id, e.target.value, 'income')
                        }
                        className="w-full border border-black px-2 py-1 text-black bg-white"
                      >
                        <option value="">Select source</option>
                        {incomeSources.map((source) => (
                          <option key={source.id} value={source.id}>
                            {source.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        value={transaction.expenseCategoryId || ''}
                        onChange={(e) =>
                          handleCategoryChange(transaction.id, e.target.value, 'expense')
                        }
                        className="w-full border border-black px-2 py-1 text-black bg-white"
                      >
                        <option value="">Select category</option>
                        {expenseCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="p-3 text-right text-black dark:text-white">
                    ${transaction.amount.toFixed(2)}
                  </td>
                  <td className="p-3 text-center text-black dark:text-white capitalize">
                    {transaction.type}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => handleDelete(transaction.id)}
                      className="text-black dark:text-white hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                  </tr>
                  )
                })}
                {sortedTransactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-3 text-center text-black dark:text-white">
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

