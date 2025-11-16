'use client'

import { useEffect, useState } from 'react'
import Navigation from '@/components/Navigation'

export default function BudgetPage() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [incomeSources, setIncomeSources] = useState<any[]>([])
  const [expenseCategories, setExpenseCategories] = useState<any[]>([])
  const [budgetLineItems, setBudgetLineItems] = useState<Record<string, number>>({})
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
      fetchData(selectedUserId)
    }
  }, [selectedUserId, year, month])

  const fetchData = async (userId: string) => {
    setLoading(true)
    try {
      const [incomeRes, categoriesRes, budgetRes] = await Promise.all([
        fetch(`/api/income-sources?userId=${userId}`),
        fetch(`/api/expense-categories?userId=${userId}`),
        fetch(`/api/budget?userId=${userId}&year=${year}&month=${month}`),
      ])

      if (incomeRes.ok) {
        const income = await incomeRes.json()
        setIncomeSources(income)
      }

      if (categoriesRes.ok) {
        const categories = await categoriesRes.json()
        setExpenseCategories(categories)
      }

      if (budgetRes.ok) {
        const budget = await budgetRes.json()
        if (budget) {
          const lineItems: Record<string, number> = {}
          budget.budgetLineItems?.forEach((item: any) => {
            lineItems[item.expenseCategoryId] = item.plannedAmount
          })
          setBudgetLineItems(lineItems)
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveBudget = async () => {
    if (!selectedUserId) return

    const totalPlannedIncome = incomeSources
      .filter((s) => s.isActive)
      .reduce((sum, s) => sum + s.amount, 0)

    const totalPlannedExpenses = Object.values(budgetLineItems).reduce(
      (sum, amount) => sum + (amount || 0),
      0
    )

    const lineItems = Object.entries(budgetLineItems)
      .filter(([_, amount]) => amount > 0)
      .map(([categoryId, amount]) => ({
        expenseCategoryId: categoryId,
        plannedAmount: amount,
      }))

    try {
      const res = await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          year,
          month,
          totalPlannedIncome,
          totalPlannedExpenses,
          budgetLineItems: lineItems,
        }),
      })

      if (res.ok) {
        alert('Budget saved successfully')
      }
    } catch (error) {
      console.error('Error saving budget:', error)
      alert('Failed to save budget')
    }
  }

  useEffect(() => {
    const stored = localStorage.getItem('selectedUserId')
    if (!stored && !selectedUserId) {
      window.location.href = '/'
    }
  }, [selectedUserId])

  if (!selectedUserId) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-4 py-16">
          <p className="text-black">Redirecting to login...</p>
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

  const totalPlannedIncome = incomeSources
    .filter((s) => s.isActive)
    .reduce((sum, s) => sum + s.amount, 0)
  const totalPlannedExpenses = Object.values(budgetLineItems).reduce(
    (sum, amount) => sum + (amount || 0),
    0
  )
  const totalPlannedSavings = totalPlannedIncome - totalPlannedExpenses

  return (
    <div className="min-h-screen bg-white">
      <Navigation selectedUserId={selectedUserId} />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-light text-black mb-8">Monthly Budget</h1>

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

        <IncomeSection
          userId={selectedUserId}
          incomeSources={incomeSources}
          onUpdate={fetchData}
        />

        <ExpensesSection
          userId={selectedUserId}
          expenseCategories={expenseCategories}
          budgetLineItems={budgetLineItems}
          onUpdate={(items) => setBudgetLineItems(items)}
        />

        <div className="mt-8 border-t border-black pt-6">
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div>
              <div className="text-sm font-medium text-black mb-1">
                Total Planned Income
              </div>
              <div className="text-2xl font-light text-black">
                ${totalPlannedIncome.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-black mb-1">
                Total Planned Expenses
              </div>
              <div className="text-2xl font-light text-black">
                ${totalPlannedExpenses.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-black mb-1">
                Planned Savings
              </div>
              <div className="text-2xl font-light text-black">
                ${totalPlannedSavings.toFixed(2)}
              </div>
            </div>
          </div>
          <button
            onClick={handleSaveBudget}
            className="border border-black px-6 py-2 text-black hover:bg-black hover:text-white transition-colors"
          >
            Save Budget
          </button>
        </div>
      </div>
    </div>
  )
}

function IncomeSection({
  userId,
  incomeSources,
  onUpdate,
}: {
  userId: string
  incomeSources: any[]
  onUpdate: () => void
}) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    type: 'salary',
    isActive: true,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingId) {
        await fetch('/api/income-sources', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingId,
            ...formData,
            amount: parseFloat(formData.amount),
          }),
        })
      } else {
        await fetch('/api/income-sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            ...formData,
            amount: parseFloat(formData.amount),
          }),
        })
      }
      onUpdate()
      setShowAddForm(false)
      setEditingId(null)
      setFormData({ name: '', amount: '', type: 'salary', isActive: true })
    } catch (error) {
      console.error('Error saving income source:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this income source?')) {
      try {
        await fetch(`/api/income-sources?id=${id}`, { method: 'DELETE' })
        onUpdate()
      } catch (error) {
        console.error('Error deleting income source:', error)
      }
    }
  }

  const handleEdit = (source: any) => {
    setEditingId(source.id)
    setFormData({
      name: source.name,
      amount: source.amount.toString(),
      type: source.type,
      isActive: source.isActive,
    })
    setShowAddForm(true)
  }

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-light text-black">Income Sources</h2>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="border border-black px-4 py-2 text-black hover:bg-black hover:text-white transition-colors"
          >
            Add Income Source
          </button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="mb-4 border border-black p-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-black mb-1">
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full border border-black px-3 py-2 text-black bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black mb-1">
                Monthly Amount
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
                <option value="salary">Salary</option>
                <option value="bonus">Bonus</option>
                <option value="freelance">Freelance</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="mr-2"
                />
                <span className="text-sm text-black">Active</span>
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="border border-black px-4 py-2 text-black hover:bg-black hover:text-white transition-colors"
            >
              {editingId ? 'Update' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false)
                setEditingId(null)
                setFormData({
                  name: '',
                  amount: '',
                  type: 'salary',
                  isActive: true,
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
                Name
              </th>
              <th className="text-left p-3 text-sm font-medium text-black">
                Type
              </th>
              <th className="text-right p-3 text-sm font-medium text-black">
                Monthly Amount
              </th>
              <th className="text-center p-3 text-sm font-medium text-black">
                Active
              </th>
              <th className="text-center p-3 text-sm font-medium text-black">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {incomeSources.map((source) => (
              <tr key={source.id} className="border-b border-black">
                <td className="p-3 text-black">{source.name}</td>
                <td className="p-3 text-black capitalize">{source.type}</td>
                <td className="p-3 text-right text-black">
                  ${source.amount.toFixed(2)}
                </td>
                <td className="p-3 text-center text-black">
                  {source.isActive ? 'Yes' : 'No'}
                </td>
                <td className="p-3 text-center">
                  <button
                    onClick={() => handleEdit(source)}
                    className="text-black hover:underline mr-2"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(source.id)}
                    className="text-black hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ExpensesSection({
  userId,
  expenseCategories,
  budgetLineItems,
  onUpdate,
}: {
  userId: string
  expenseCategories: any[]
  budgetLineItems: Record<string, number>
  onUpdate: (items: Record<string, number>) => void
}) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({ name: '', type: 'fixed' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await fetch('/api/expense-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          ...formData,
        }),
      })
      // Refresh categories
      const res = await fetch(`/api/expense-categories?userId=${userId}`)
      if (res.ok) {
        const categories = await res.json()
        // This will trigger a re-render in parent
        window.location.reload()
      }
      setShowAddForm(false)
      setFormData({ name: '', type: 'fixed' })
    } catch (error) {
      console.error('Error creating category:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this category?')) {
      try {
        await fetch(`/api/expense-categories?id=${id}`, { method: 'DELETE' })
        window.location.reload()
      } catch (error) {
        console.error('Error deleting category:', error)
      }
    }
  }

  const fixedCategories = expenseCategories.filter((c) => c.type === 'fixed')
  const variableCategories = expenseCategories.filter(
    (c) => c.type === 'variable'
  )

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-light text-black">Expenses</h2>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="border border-black px-4 py-2 text-black hover:bg-black hover:text-white transition-colors"
          >
            Add Category
          </button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="mb-4 border border-black p-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-black mb-1">
                Category Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
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
                <option value="fixed">Fixed</option>
                <option value="variable">Variable</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="border border-black px-4 py-2 text-black hover:bg-black hover:text-white transition-colors"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false)
                setFormData({ name: '', type: 'fixed' })
              }}
              className="border border-black px-4 py-2 text-black hover:bg-black hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mb-6">
        <h3 className="text-xl font-light text-black mb-3">Fixed Expenses</h3>
        <div className="border border-black">
          <table className="w-full">
            <thead>
              <tr className="border-b border-black">
                <th className="text-left p-3 text-sm font-medium text-black">
                  Category
                </th>
                <th className="text-right p-3 text-sm font-medium text-black">
                  Planned Amount
                </th>
                <th className="text-center p-3 text-sm font-medium text-black">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {fixedCategories.map((category) => (
                <tr key={category.id} className="border-b border-black">
                  <td className="p-3 text-black">{category.name}</td>
                  <td className="p-3 text-right">
                    <input
                      type="number"
                      step="0.01"
                      value={budgetLineItems[category.id] || ''}
                      onChange={(e) =>
                        onUpdate({
                          ...budgetLineItems,
                          [category.id]: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-32 border border-black px-2 py-1 text-right text-black bg-white"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => handleDelete(category.id)}
                      className="text-black hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-light text-black mb-3">
          Variable Expenses
        </h3>
        <div className="border border-black">
          <table className="w-full">
            <thead>
              <tr className="border-b border-black">
                <th className="text-left p-3 text-sm font-medium text-black">
                  Category
                </th>
                <th className="text-right p-3 text-sm font-medium text-black">
                  Planned Amount
                </th>
                <th className="text-center p-3 text-sm font-medium text-black">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {variableCategories.map((category) => (
                <tr key={category.id} className="border-b border-black">
                  <td className="p-3 text-black">{category.name}</td>
                  <td className="p-3 text-right">
                    <input
                      type="number"
                      step="0.01"
                      value={budgetLineItems[category.id] || ''}
                      onChange={(e) =>
                        onUpdate({
                          ...budgetLineItems,
                          [category.id]: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-32 border border-black px-2 py-1 text-right text-black bg-white"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => handleDelete(category.id)}
                      className="text-black hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

