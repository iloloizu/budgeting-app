'use client'

import { useEffect, useState, useMemo } from 'react'
import Navigation from '@/components/Navigation'
import CategoryColorPicker from '@/components/CategoryColorPicker'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { PASTEL_PALETTE, getLightTint } from '@/constants/colors'
import { formatCurrency } from '@/lib/format'

export default function ReportsPage() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [savingsProjection, setSavingsProjection] = useState<any[]>([])
  const [categorySpending, setCategorySpending] = useState<any>(null)
  const [expenseCategories, setExpenseCategories] = useState<any[]>([])
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
  }, [selectedUserId, year])

  const fetchData = async (userId: string) => {
    setLoading(true)
    try {
      const [projectionRes, spendingRes, categoriesRes] = await Promise.all([
        fetch(`/api/reports/savings-projection?userId=${userId}`),
        fetch(`/api/reports/category-spending?userId=${userId}&year=${year}`),
        fetch(`/api/expense-categories?userId=${userId}`),
      ])

      if (projectionRes.ok) {
        const projection = await projectionRes.json()
        setSavingsProjection(projection)
      }

      if (spendingRes.ok) {
        const spending = await spendingRes.json()
        setCategorySpending(spending)
      }

      if (categoriesRes.ok) {
        const categories = await categoriesRes.json()
        setExpenseCategories(categories)
      }
    } catch (error) {
      console.error('Error fetching reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleColorChange = async (categoryId: string, newColor: string) => {
    try {
      setError(null)
      const res = await fetch(`/api/expense-categories/${categoryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colorHex: newColor }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        const errorText = `Failed to update color\n\nStatus: ${res.status}\nError: ${errorData.error || 'Unknown error'}\nMessage: ${errorData.message || 'No message'}\nDetails: ${JSON.stringify(errorData, null, 2)}`
        setError(errorText)
        throw new Error(errorData.error || 'Failed to update color')
      }

      const updated = await res.json()
      
      // Update local state
      setExpenseCategories((prev) =>
        prev.map((cat) =>
          cat.id === categoryId ? { ...cat, colorHex: newColor } : cat
        )
      )
      
      // Refresh category spending to update charts
      if (selectedUserId) {
        const spendingRes = await fetch(
          `/api/reports/category-spending?userId=${selectedUserId}&year=${year}`
        )
        if (spendingRes.ok) {
          const spending = await spendingRes.json()
          setCategorySpending(spending)
        }
      }
    } catch (error: any) {
      console.error('Error updating color:', error)
      if (!error.message.includes('Failed to update color')) {
        const errorText = `Error updating color\n\nError: ${error.message || 'Unknown error'}\nStack: ${error.stack || 'No stack trace'}\nDetails: ${JSON.stringify(error, null, 2)}`
        setError(errorText)
      }
    }
  }

  const getCategoryColor = (categoryName: string): string => {
    const category = expenseCategories.find(
      (cat) => cat.name === categoryName
    )
    return category?.colorHex || PASTEL_PALETTE[0]
  }

  // Memoize chart data to avoid recalculation - MUST be before conditional returns
  const chartData = useMemo(() => {
    return savingsProjection.map((item) => ({
      month: `${item.monthName} ${item.year}`,
      savings: item.plannedSavings,
      income: item.plannedIncome,
      expenses: item.plannedExpenses,
    }))
  }, [savingsProjection])

  // Create category map for O(1) lookup instead of O(n) find - MUST be before conditional returns
  const categoryMap = useMemo(() => {
    const map = new Map<string, { id: string; colorHex?: string }>()
    expenseCategories.forEach((cat) => {
      map.set(cat.name, { id: cat.id, colorHex: cat.colorHex })
    })
    return map
  }, [expenseCategories])

  // Memoize pie data to avoid recalculation - MUST be before conditional returns
  const pieData = useMemo(() => {
    if (!categorySpending?.categories) return []
    
    return categorySpending.categories.map((cat: any) => {
      const category = categoryMap.get(cat.categoryName)
      return {
        name: cat.categoryName,
        value: cat.totalSpent,
        color: category?.colorHex || PASTEL_PALETTE[0],
        categoryId: category?.id,
      }
    })
  }, [categorySpending, categoryMap])

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black dark:text-white mb-4 sm:mb-6 lg:mb-8">Reports</h1>

        {error && (
          <div className="mb-6 border-2 border-red-600 dark:border-red-500 bg-red-50 dark:bg-red-900/20 p-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-medium text-red-900 dark:text-red-300">Error</h3>
              <button
                onClick={() => setError(null)}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
              >
                ×
              </button>
            </div>
            <textarea
              readOnly
              value={error}
              className="w-full h-64 p-3 border border-red-300 dark:border-red-700 bg-white dark:bg-gray-900 text-black dark:text-white font-mono text-sm"
              onClick={(e) => e.currentTarget.select()}
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(error)
                alert('Error message copied to clipboard!')
              }}
              className="mt-2 border border-red-600 dark:border-red-500 px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-600 dark:hover:bg-red-700 hover:text-white transition-colors"
            >
              Copy Error to Clipboard
            </button>
          </div>
        )}

        <div className="mb-8 sm:mb-12">
          <h2 className="text-xl sm:text-2xl font-bold text-black dark:text-white mb-4 sm:mb-6">
            12-Month Savings Projection
          </h2>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {savingsProjection.map((item, index) => (
              <div
                key={index}
                className="border border-black dark:border-gray-700 p-4 bg-white dark:bg-gray-800"
              >
                <div className="text-base font-medium text-black dark:text-white mb-3">
                  {item.monthName} {item.year}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-black dark:text-gray-400">Income</span>
                    <span className="text-sm font-medium text-black dark:text-white">
                      ${formatCurrency(item.plannedIncome)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-black dark:text-gray-400">Expenses</span>
                    <span className="text-sm font-medium text-black dark:text-white">
                      ${formatCurrency(item.plannedExpenses)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-black dark:border-gray-700">
                    <span className="text-sm font-medium text-black dark:text-white">Savings</span>
                    <span className={`text-sm font-semibold ${
                      item.plannedSavings >= 0 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      ${formatCurrency(item.plannedSavings)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block border border-black dark:border-gray-700 bg-white dark:bg-gray-800">
            <table className="w-full">
              <thead>
                <tr className="border-b border-black dark:border-gray-700">
                  <th className="text-left p-3 text-sm font-medium text-black dark:text-white">
                    Month
                  </th>
                  <th className="text-right p-3 text-sm font-medium text-black dark:text-white">
                    Planned Income
                  </th>
                  <th className="text-right p-3 text-sm font-medium text-black dark:text-white">
                    Planned Expenses
                  </th>
                  <th className="text-right p-3 text-sm font-medium text-black dark:text-white">
                    Planned Savings
                  </th>
                </tr>
              </thead>
              <tbody>
                {savingsProjection.map((item, index) => (
                  <tr key={index} className="border-b border-black dark:border-gray-700">
                    <td className="p-3 text-sm text-black dark:text-white">
                      {item.monthName} {item.year}
                    </td>
                    <td className="p-3 text-sm text-right text-black dark:text-white">
                      ${formatCurrency(item.plannedIncome)}
                    </td>
                    <td className="p-3 text-sm text-right text-black dark:text-white">
                      ${formatCurrency(item.plannedExpenses)}
                    </td>
                    <td className="p-3 text-sm text-right text-black dark:text-white">
                      ${formatCurrency(item.plannedSavings)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="h-64 sm:h-80 lg:h-96 border border-black dark:border-gray-700 p-2 sm:p-4 bg-white dark:bg-gray-800">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                <XAxis dataKey="month" stroke="#000" />
                <YAxis stroke="#000" />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="savings"
                  stroke="#000000"
                  strokeWidth={2}
                  name="Savings"
                />
                <Line
                  type="monotone"
                  dataKey="income"
                  stroke="#666666"
                  strokeWidth={2}
                  name="Income"
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  stroke="#999999"
                  strokeWidth={2}
                  name="Expenses"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-black dark:text-white">
              Category Spending for {year}
            </h2>
            <div className="w-full sm:w-auto">
                  <label className="block text-xs sm:text-sm font-medium text-black dark:text-white mb-1">
                    Year
                  </label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value))}
                    className="w-full sm:w-auto border border-black dark:border-gray-700 px-3 py-2 text-sm sm:text-base text-black dark:text-white bg-white dark:bg-gray-900"
              />
            </div>
          </div>

          {categorySpending && categorySpending.categories.length > 0 ? (
            <>
                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-3">
                    {categorySpending.categories.map((cat: any) => {
                      const category = expenseCategories.find(
                        (c) => c.name === cat.categoryName
                      )
                      const color = category?.colorHex || PASTEL_PALETTE[0]
                      const lightTint = getLightTint(color, 0.1)

                      return (
                        <div
                          key={cat.categoryId || cat.categoryName}
                          className="border border-black dark:border-gray-700 p-4 bg-white dark:bg-gray-800"
                          style={{ backgroundColor: lightTint }}
                        >
                          <div className="flex items-center gap-3 mb-3">
                            {category ? (
                              <CategoryColorPicker
                                color={category.colorHex}
                                onChange={(newColor) => handleColorChange(category.id, newColor)}
                                categoryName={cat.categoryName}
                                usedColors={expenseCategories
                                  .filter((c) => c.id !== category.id && c.colorHex)
                                  .map((c) => c.colorHex!)}
                              />
                            ) : (
                              <div
                                className="w-6 h-6 rounded border border-black dark:border-gray-700 flex-shrink-0"
                                style={{ backgroundColor: color }}
                              />
                            )}
                            <div className="flex-1">
                              <div className="text-base font-medium text-black dark:text-white">
                                {cat.categoryName}
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-black dark:text-gray-400">Total Spent</span>
                              <span className="text-base font-semibold text-black dark:text-white">
                                ${formatCurrency(cat.totalSpent)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-black dark:text-gray-400">% of Total</span>
                              <span className="text-base font-semibold text-black dark:text-white">
                                {cat.percentage.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    <div className="border-t-2 border-black dark:border-gray-700 pt-3 mt-3">
                      <div className="flex justify-between">
                        <span className="text-base font-medium text-black dark:text-white">Total</span>
                        <span className="text-lg font-semibold text-black dark:text-white">
                          ${formatCurrency(categorySpending.totalExpenses)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block border border-black dark:border-gray-700 bg-white dark:bg-gray-800">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-black dark:border-gray-700">
                          <th className="text-left p-3 text-sm font-medium text-black dark:text-white">
                            Color
                          </th>
                          <th className="text-left p-3 text-sm font-medium text-black dark:text-white">
                            Category
                          </th>
                          <th className="text-right p-3 text-sm font-medium text-black dark:text-white">
                            Total Spent
                          </th>
                          <th className="text-right p-3 text-sm font-medium text-black dark:text-white">
                            % of Total
                          </th>
                        </tr>
                      </thead>
                  <tbody>
                    {categorySpending.categories.map((cat: any) => {
                      const category = expenseCategories.find(
                        (c) => c.name === cat.categoryName
                      )
                      const color = category?.colorHex || PASTEL_PALETTE[0]
                      const lightTint = getLightTint(color, 0.1)

                      return (
                        <tr
                          key={cat.categoryId || cat.categoryName}
                          className="border-b border-black dark:border-gray-700"
                          style={{ backgroundColor: lightTint }}
                        >
                          <td className="p-3">
                            {category ? (
                              <CategoryColorPicker
                                color={category.colorHex}
                                onChange={(newColor) => handleColorChange(category.id, newColor)}
                                categoryName={cat.categoryName}
                                usedColors={expenseCategories
                                  .filter((c) => c.id !== category.id && c.colorHex)
                                  .map((c) => c.colorHex!)}
                              />
                            ) : (
                              <div
                                className="w-6 h-6 rounded border border-black dark:border-gray-700"
                                style={{ backgroundColor: color }}
                              />
                            )}
                          </td>
                          <td className="p-3 text-sm text-black dark:text-white">{cat.categoryName}</td>
                          <td className="p-3 text-sm text-right text-black dark:text-white">
                            ${formatCurrency(cat.totalSpent)}
                          </td>
                          <td className="p-3 text-sm text-right text-black dark:text-white">
                            {cat.percentage.toFixed(1)}%
                          </td>
                        </tr>
                      )
                    })}
                    <tr className="border-t-2 border-black dark:border-gray-700 font-medium">
                      <td className="p-3"></td>
                      <td className="p-3 text-sm text-black dark:text-white">Total</td>
                      <td className="p-3 text-sm text-right text-black dark:text-white">
                        ${formatCurrency(categorySpending.totalExpenses)}
                      </td>
                      <td className="p-3 text-sm text-right text-black dark:text-white">100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>

                  <div className="h-64 sm:h-80 lg:h-96 border border-black dark:border-gray-700 p-2 sm:p-4 relative bg-white dark:bg-gray-800">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="40%"
                      cy="50%"
                      labelLine={false}
                      label={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color || PASTEL_PALETTE[index % PASTEL_PALETTE.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any) => `$${formatCurrency(Number(value))}`}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid black',
                        borderRadius: '4px',
                        padding: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                
                    {/* Custom Legend */}
                    <div className="absolute top-2 right-2 sm:top-4 sm:right-4 border border-black dark:border-gray-700 bg-white dark:bg-gray-800 p-2 sm:p-3 max-h-48 sm:max-h-80 overflow-y-auto text-xs sm:text-sm">
                      <div className="text-xs font-medium text-black dark:text-white mb-2">Categories</div>
                      <div className="space-y-1">
                        {pieData.map((entry, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 text-xs"
                          >
                            <div
                              className="w-4 h-4 rounded border border-black dark:border-gray-700 flex-shrink-0"
                              style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-black dark:text-white truncate max-w-[150px]" title={entry.name}>
                              {entry.name}
                            </span>
                            <span className="text-black dark:text-white font-medium ml-auto">
                              ${formatCurrency(entry.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
              </div>
            </>
          ) : (
                <div className="border border-black dark:border-gray-700 p-8 text-center text-black dark:text-white bg-white dark:bg-gray-800">
                  No spending data available for {year}
                </div>
          )}
        </div>
      </div>
    </div>
  )
}

