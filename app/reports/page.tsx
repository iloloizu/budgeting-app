'use client'

import { useEffect, useState } from 'react'
import Navigation from '@/components/Navigation'
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

const COLORS = ['#000000', '#333333', '#666666', '#999999', '#CCCCCC']

export default function ReportsPage() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [savingsProjection, setSavingsProjection] = useState<any[]>([])
  const [categorySpending, setCategorySpending] = useState<any>(null)
  const [year, setYear] = useState(new Date().getFullYear())
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
  }, [selectedUserId, year])

  const fetchData = async (userId: string) => {
    setLoading(true)
    try {
      const [projectionRes, spendingRes] = await Promise.all([
        fetch(`/api/reports/savings-projection?userId=${userId}`),
        fetch(`/api/reports/category-spending?userId=${userId}&year=${year}`),
      ])

      if (projectionRes.ok) {
        const projection = await projectionRes.json()
        setSavingsProjection(projection)
      }

      if (spendingRes.ok) {
        const spending = await spendingRes.json()
        setCategorySpending(spending)
      }
    } catch (error) {
      console.error('Error fetching reports:', error)
    } finally {
      setLoading(false)
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

  const chartData = savingsProjection.map((item) => ({
    month: `${item.monthName} ${item.year}`,
    savings: item.plannedSavings,
    income: item.plannedIncome,
    expenses: item.plannedExpenses,
  }))

  const pieData =
    categorySpending?.categories.map((cat: any) => ({
      name: cat.categoryName,
      value: cat.totalSpent,
    })) || []

  return (
    <div className="min-h-screen bg-white">
      <Navigation selectedUserId={selectedUserId} />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-light text-black mb-8">Reports</h1>

        <div className="mb-12">
          <h2 className="text-2xl font-light text-black mb-6">
            12-Month Savings Projection
          </h2>

          <div className="mb-6 border border-black">
            <table className="w-full">
              <thead>
                <tr className="border-b border-black">
                  <th className="text-left p-3 text-sm font-medium text-black">
                    Month
                  </th>
                  <th className="text-right p-3 text-sm font-medium text-black">
                    Planned Income
                  </th>
                  <th className="text-right p-3 text-sm font-medium text-black">
                    Planned Expenses
                  </th>
                  <th className="text-right p-3 text-sm font-medium text-black">
                    Planned Savings
                  </th>
                </tr>
              </thead>
              <tbody>
                {savingsProjection.map((item, index) => (
                  <tr key={index} className="border-b border-black">
                    <td className="p-3 text-black">
                      {item.monthName} {item.year}
                    </td>
                    <td className="p-3 text-right text-black">
                      ${item.plannedIncome.toFixed(2)}
                    </td>
                    <td className="p-3 text-right text-black">
                      ${item.plannedExpenses.toFixed(2)}
                    </td>
                    <td className="p-3 text-right text-black">
                      ${item.plannedSavings.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="h-96 border border-black p-4">
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
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-light text-black">
              Category Spending for {year}
            </h2>
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
          </div>

          {categorySpending && categorySpending.categories.length > 0 ? (
            <>
              <div className="mb-6 border border-black">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-black">
                      <th className="text-left p-3 text-sm font-medium text-black">
                        Category
                      </th>
                      <th className="text-right p-3 text-sm font-medium text-black">
                        Total Spent
                      </th>
                      <th className="text-right p-3 text-sm font-medium text-black">
                        % of Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {categorySpending.categories.map((cat: any) => (
                      <tr key={cat.categoryId} className="border-b border-black">
                        <td className="p-3 text-black">{cat.categoryName}</td>
                        <td className="p-3 text-right text-black">
                          ${cat.totalSpent.toFixed(2)}
                        </td>
                        <td className="p-3 text-right text-black">
                          {cat.percentage.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-black font-medium">
                      <td className="p-3 text-black">Total</td>
                      <td className="p-3 text-right text-black">
                        ${categorySpending.totalExpenses.toFixed(2)}
                      </td>
                      <td className="p-3 text-right text-black">100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="h-96 border border-black p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="border border-black p-8 text-center text-black">
              No spending data available for {year}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

