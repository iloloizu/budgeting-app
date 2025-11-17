'use client'

import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { formatCurrency } from '@/lib/format'
import { getLightTint } from '@/constants/colors'
import { PASTEL_PALETTE, getNextAvailableColor } from '@/constants/colors'

interface ExpenseBucket {
  id: string
  name: string
  colorHex: string | null
  percentage: number
  order: number
  bucketCategories: Array<{
    id: string
    expenseCategory: {
      id: string
      name: string
      type: string
      colorHex: string | null
    }
  }>
}

interface ExpenseCategory {
  id: string
  name: string
  type: string
  colorHex: string | null
}

interface VariableExpensesBucketsProps {
  userId: string
  year: number
  month: number
  variableCategories: ExpenseCategory[]
  budgetLineItems: Record<string, number>
  onUpdate: (items: Record<string, number>) => void
  totalPlannedSavings: number
  totalPlannedExpenses: number
  modal: any
}

export default function VariableExpensesBuckets({
  userId,
  year,
  month,
  variableCategories,
  budgetLineItems,
  onUpdate,
  totalPlannedSavings,
  totalPlannedExpenses,
  modal,
}: VariableExpensesBucketsProps) {
  const [buckets, setBuckets] = useState<ExpenseBucket[]>([])
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null)
  const [showBucketForm, setShowBucketForm] = useState(false)
  const [editingBucket, setEditingBucket] = useState<ExpenseBucket | null>(null)
  const [bucketFormData, setBucketFormData] = useState({ name: '', percentage: 0 })

  const fetchBuckets = useCallback(async () => {
    try {
      const res = await fetch(`/api/expense-buckets?userId=${userId}&year=${year}&month=${month}`)
      if (res.ok) {
        const data = await res.json()
        setBuckets(data)
      }
    } catch (error) {
      console.error('Error fetching buckets:', error)
    }
  }, [userId, year, month])

  useEffect(() => {
    fetchBuckets()
  }, [fetchBuckets])

  // Memoize categories in buckets set for O(1) lookup
  const categoriesInBucketsSet = useMemo(() => {
    const set = new Set<string>()
    buckets.forEach((b) => {
      b.bucketCategories.forEach((bc) => {
        set.add(bc.expenseCategory.id)
      })
    })
    return set
  }, [buckets])

  // Get categories not in any bucket (memoized for performance, O(n) complexity)
  const unassignedCategories = useMemo(() => {
    return variableCategories.filter((c) => !categoriesInBucketsSet.has(c.id))
  }, [variableCategories, categoriesInBucketsSet])

  const handleDragStart = useCallback((categoryId: string) => {
    setDraggedCategory(categoryId)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(async (bucketId: string) => {
    if (!draggedCategory) return

    // Find category once (O(n) but only on drop, not on every render)
    const category = variableCategories.find((c) => c.id === draggedCategory)
    if (!category) {
      setDraggedCategory(null)
      return
    }

    // Optimistic update - use functional update for better performance
    setBuckets((prev) => {
      // Find bucket index once
      const bucketIndex = prev.findIndex((b) => b.id === bucketId)
      if (bucketIndex === -1) return prev

      // Create new array with updated bucket
      const newBuckets = [...prev]
      newBuckets[bucketIndex] = {
        ...newBuckets[bucketIndex],
        bucketCategories: [
          ...newBuckets[bucketIndex].bucketCategories,
          {
            id: `temp-${Date.now()}`,
            expenseCategory: category,
          },
        ],
      }
      return newBuckets
    })

    // Clear dragged category immediately for better UX
    const categoryIdToAdd = draggedCategory
    setDraggedCategory(null)

    try {
      const res = await fetch('/api/expense-buckets/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bucketId,
          categoryId: categoryIdToAdd,
        }),
      })

      if (res.ok) {
        // Only fetch if successful - optimistic update already shown
        await fetchBuckets()
      } else {
        // Revert on error
        await fetchBuckets()
        modal.showError('Failed to add category to bucket')
      }
    } catch (error) {
      console.error('Error adding category to bucket:', error)
      // Revert on error
      await fetchBuckets()
      modal.showError('Failed to add category to bucket')
    }
  }, [draggedCategory, variableCategories, fetchBuckets, modal])

  const handleRemoveFromBucket = useCallback(async (bucketId: string, categoryId: string) => {
    // Optimistic update - use functional update with index finding for O(n) instead of O(n*m)
    setBuckets((prev) => {
      const bucketIndex = prev.findIndex((b) => b.id === bucketId)
      if (bucketIndex === -1) return prev

      const newBuckets = [...prev]
      newBuckets[bucketIndex] = {
        ...newBuckets[bucketIndex],
        bucketCategories: newBuckets[bucketIndex].bucketCategories.filter(
          (bc) => bc.expenseCategory.id !== categoryId
        ),
      }
      return newBuckets
    })

    try {
      const res = await fetch(
        `/api/expense-buckets/categories?bucketId=${bucketId}&categoryId=${categoryId}`,
        { method: 'DELETE' }
      )

      if (res.ok) {
        await fetchBuckets()
      } else {
        // Revert on error
        await fetchBuckets()
        modal.showError('Failed to remove category from bucket')
      }
    } catch (error) {
      console.error('Error removing category from bucket:', error)
      // Revert on error
      await fetchBuckets()
      modal.showError('Failed to remove category from bucket')
    }
  }, [fetchBuckets, modal])

  const handleCreateBucket = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Optimistic update
    const tempBucket: ExpenseBucket = {
      id: `temp-${Date.now()}`,
      name: bucketFormData.name,
      colorHex: getNextAvailableColor(
        buckets.map((b) => b.colorHex).filter((c): c is string => c !== null)
      ),
      percentage: bucketFormData.percentage,
      order: buckets.length,
      bucketCategories: [],
    }
    setBuckets((prev) => [...prev, tempBucket])
    setShowBucketForm(false)
    const formData = { ...bucketFormData }
    setBucketFormData({ name: '', percentage: 0 })

    try {
      const res = await fetch('/api/expense-buckets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          name: formData.name,
          year,
          month,
          percentage: formData.percentage,
        }),
      })

      if (res.ok) {
        await fetchBuckets()
      } else {
        // Revert on error
        setBuckets((prev) => prev.filter((b) => b.id !== tempBucket.id))
        const errorData = await res.json()
        const errorMessage = errorData.error || errorData.message || 'Failed to create bucket'
        console.error('Error creating bucket:', errorData)
        modal.showError(errorMessage)
        setShowBucketForm(true)
        setBucketFormData(formData)
      }
    } catch (error) {
      console.error('Error creating bucket:', error)
      // Revert on error
      setBuckets((prev) => prev.filter((b) => b.id !== tempBucket.id))
      modal.showError('Failed to create bucket')
      setShowBucketForm(true)
      setBucketFormData(formData)
    }
  }

  const handleUpdateBucket = async (bucketId: string, updates: { name?: string; percentage?: number; colorHex?: string }) => {
    // Optimistic update
    const previousBuckets = [...buckets]
    setBuckets((prev) =>
      prev.map((b) =>
        b.id === bucketId
          ? {
              ...b,
              ...updates,
            }
          : b
      )
    )

    try {
      const res = await fetch('/api/expense-buckets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: bucketId,
          ...updates,
        }),
      })

      if (res.ok) {
        await fetchBuckets()
        setEditingBucket(null)
      } else {
        // Revert on error
        setBuckets(previousBuckets)
        modal.showError('Failed to update bucket')
      }
    } catch (error) {
      console.error('Error updating bucket:', error)
      // Revert on error
      setBuckets(previousBuckets)
      modal.showError('Failed to update bucket')
    }
  }

  const handleDeleteBucket = async (bucketId: string) => {
    modal.showConfirm(
      'Are you sure you want to delete this bucket? Categories will be moved back to unassigned.',
      async () => {
        // Optimistic update
        const bucketToDelete = buckets.find((b) => b.id === bucketId)
        setBuckets((prev) => prev.filter((b) => b.id !== bucketId))

        try {
          const res = await fetch(`/api/expense-buckets?id=${bucketId}`, {
            method: 'DELETE',
          })

          if (res.ok) {
            await fetchBuckets()
          } else {
            // Revert on error
            if (bucketToDelete) {
              setBuckets((prev) => [...prev, bucketToDelete].sort((a, b) => a.order - b.order))
            }
            modal.showError('Failed to delete bucket')
          }
        } catch (error) {
          console.error('Error deleting bucket:', error)
          // Revert on error
          if (bucketToDelete) {
            setBuckets((prev) => [...prev, bucketToDelete].sort((a, b) => a.order - b.order))
          }
          modal.showError('Failed to delete bucket')
        }
      },
      'Delete Bucket'
    )
  }

  const getBucketAmount = useCallback((percentage: number) => {
    return (totalPlannedSavings * percentage) / 100
  }, [totalPlannedSavings])

  // Calculate the current sum of category amounts in a bucket
  const getBucketCategorySum = useCallback((bucket: ExpenseBucket) => {
    return bucket.bucketCategories.reduce((sum, bc) => {
      return sum + (budgetLineItems[bc.expenseCategory.id] || 0)
    }, 0)
  }, [budgetLineItems])

  // Calculate total allocated percentage across all buckets
  const totalAllocatedPercentage = useMemo(() => {
    return buckets.reduce((sum, bucket) => sum + bucket.percentage, 0)
  }, [buckets])

  // Calculate remaining planned savings
  const remainingSavings = useMemo(() => {
    return totalPlannedSavings - buckets.reduce((sum, bucket) => sum + getBucketAmount(bucket.percentage), 0)
  }, [totalPlannedSavings, buckets, getBucketAmount])

  // Calculate total variable expenses (sum of all category amounts in buckets)
  const totalVariableExpenses = useMemo(() => {
    return buckets.reduce((sum, bucket) => sum + getBucketCategorySum(bucket), 0)
  }, [buckets, getBucketCategorySum])

  // Handle category amount change within a bucket
  // This is a guide, not a strict constraint - users can exceed bucket totals
  const handleCategoryAmountChange = useCallback((
    categoryId: string,
    newAmount: number,
    bucket: ExpenseBucket
  ) => {
    // Simply update the category amount - no strict constraints
    // The UI will show if it's over/under as a guide
    const updated = {
      ...budgetLineItems,
      [categoryId]: Math.max(0, newAmount), // Just ensure non-negative
    }

    onUpdate(updated)
  }, [budgetLineItems, onUpdate])

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-black dark:text-white">
            Variable Expenses (Buckets)
          </h3>
          {totalPlannedExpenses > 0 && (
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Variable Expenses Total: ${formatCurrency(totalVariableExpenses)} ({((totalVariableExpenses / totalPlannedExpenses) * 100).toFixed(1)}% of total expenses)
            </div>
          )}
        </div>
        {!showBucketForm && (
          <button
            onClick={() => setShowBucketForm(true)}
            className="border border-black dark:border-gray-700 px-4 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 hover:text-white transition-colors"
          >
            Add Bucket
          </button>
        )}
      </div>

      {showBucketForm && (
        <form onSubmit={handleCreateBucket} className="mb-4 border border-black dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-1">
                Bucket Name
              </label>
              <input
                type="text"
                value={bucketFormData.name}
                onChange={(e) => setBucketFormData({ ...bucketFormData, name: e.target.value })}
                className="w-full border border-black dark:border-gray-700 px-3 py-2 text-black dark:text-white bg-white dark:bg-gray-900"
                placeholder="e.g., Monthly Needs"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-1">
                % of Savings
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={bucketFormData.percentage}
                onChange={(e) =>
                  setBucketFormData({ ...bucketFormData, percentage: parseFloat(e.target.value) || 0 })
                }
                className="w-full border border-black dark:border-gray-700 px-3 py-2 text-black dark:text-white bg-white dark:bg-gray-900"
                required
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="border border-black dark:border-gray-700 px-4 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 hover:text-white transition-colors"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => {
                setShowBucketForm(false)
                setBucketFormData({ name: '', percentage: 0 })
              }}
              className="border border-black dark:border-gray-700 px-4 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Buckets */}
      <div className="space-y-6 mb-6">
        {buckets.map((bucket) => {
          const bucketAmount = getBucketAmount(bucket.percentage)
          const bucketColor = bucket.colorHex || '#E2F0CB'
          const bucketTint = getLightTint(bucketColor, 0.2)

          return (
            <div
              key={bucket.id}
              className="border-2 border-black dark:border-gray-700 rounded-lg overflow-hidden"
              style={{ borderColor: bucketColor }}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(bucket.id)}
            >
              <div
                className="p-4 border-b-2 border-black dark:border-gray-700"
                style={{ backgroundColor: bucketTint, borderColor: bucketColor }}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    {editingBucket?.id === bucket.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editingBucket.name}
                          onChange={(e) =>
                            setEditingBucket({ ...editingBucket, name: e.target.value })
                          }
                          className="w-full border border-black dark:border-gray-700 px-2 py-1 text-base font-bold text-black dark:text-white bg-white dark:bg-gray-900"
                          onBlur={() => handleUpdateBucket(bucket.id, { name: editingBucket.name })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleUpdateBucket(bucket.id, { name: editingBucket.name })
                            }
                          }}
                          autoFocus
                        />
                        <div className="flex gap-2 items-center">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={editingBucket.percentage}
                            onChange={(e) =>
                              setEditingBucket({
                                ...editingBucket,
                                percentage: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-24 border border-black dark:border-gray-700 px-2 py-1 text-sm text-black dark:text-white bg-white dark:bg-gray-900"
                            onBlur={() =>
                              handleUpdateBucket(bucket.id, { percentage: editingBucket.percentage })
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleUpdateBucket(bucket.id, { percentage: editingBucket.percentage })
                              }
                            }}
                          />
                          <span className="text-sm text-black dark:text-white">%</span>
                          <span className="text-sm text-black dark:text-white">
                            = ${formatCurrency(bucketAmount)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <h4
                          className="text-lg font-bold text-black dark:text-white cursor-pointer"
                          onClick={() => setEditingBucket(bucket)}
                        >
                          {bucket.name}
                        </h4>
                        <div className="text-sm text-black dark:text-white mt-1">
                          {bucket.percentage.toFixed(1)}% = ${formatCurrency(bucketAmount)}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 items-center ml-4">
                    <input
                      type="color"
                      value={bucket.colorHex || '#E2F0CB'}
                      onChange={(e) =>
                        handleUpdateBucket(bucket.id, { colorHex: e.target.value })
                      }
                      className="w-8 h-8 border border-black dark:border-gray-700 cursor-pointer"
                      title="Change bucket color"
                    />
                    <button
                      onClick={() => handleDeleteBucket(bucket.id)}
                      className="text-sm text-red-600 dark:text-red-400 hover:underline whitespace-nowrap"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div>Allocated: ${formatCurrency(getBucketAmount(bucket.percentage))} of Planned Savings</div>
                  <div className={`font-medium ${
                    getBucketCategorySum(bucket) > getBucketAmount(bucket.percentage) 
                      ? 'text-red-600 dark:text-red-400' 
                      : getBucketCategorySum(bucket) < getBucketAmount(bucket.percentage)
                      ? 'text-orange-600 dark:text-orange-400'
                      : 'text-green-600 dark:text-green-400'
                  }`}>
                    Current Total: ${formatCurrency(getBucketCategorySum(bucket))} 
                    {getBucketCategorySum(bucket) !== getBucketAmount(bucket.percentage) && (
                      <span className="ml-2">
                        ({getBucketCategorySum(bucket) > getBucketAmount(bucket.percentage) ? 'Over' : 'Under'} by ${formatCurrency(Math.abs(getBucketCategorySum(bucket) - getBucketAmount(bucket.percentage)))})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-black dark:border-gray-700">
                      <th className="text-left p-3 text-sm font-medium text-black dark:text-white">
                        Category
                      </th>
                      <th className="text-right p-3 text-sm font-medium text-black dark:text-white">
                        Planned Amount
                      </th>
                      <th className="text-right p-3 text-sm font-medium text-black dark:text-white">
                        % of Total
                      </th>
                      <th className="text-center p-3 text-sm font-medium text-black dark:text-white">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {bucket.bucketCategories.map((bc) => {
                      const category = bc.expenseCategory
                      const categoryColor = category.colorHex || '#E2F0CB'
                      const rowTint = getLightTint(categoryColor, 0.1)

                      return (
                        <tr
                          key={bc.id}
                          className="border-b border-black dark:border-gray-700"
                          style={{ backgroundColor: rowTint }}
                        >
                          <td className="p-3 text-sm text-black dark:text-white">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-4 h-4 rounded"
                                style={{ backgroundColor: categoryColor }}
                              />
                              {category.name}
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={budgetLineItems[category.id] || ''}
                              onChange={(e) => {
                                const newAmount = parseFloat(e.target.value) || 0
                                handleCategoryAmountChange(category.id, newAmount, bucket)
                              }}
                              className="w-32 border border-black dark:border-gray-700 px-2 py-1 text-sm text-right text-black dark:text-white bg-white dark:bg-gray-900"
                              placeholder="0.00"
                            />
                          </td>
                          <td className="p-3 text-sm text-right text-black dark:text-white">
                            {totalPlannedExpenses > 0 && budgetLineItems[category.id] > 0
                              ? `${((budgetLineItems[category.id] / totalPlannedExpenses) * 100).toFixed(1)}%`
                              : '-'}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleRemoveFromBucket(bucket.id, category.id)}
                              className="text-sm text-black dark:text-white hover:underline"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                    {bucket.bucketCategories.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-sm text-black dark:text-gray-400">
                          Drop categories here or drag from unassigned below
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>

      {/* Unassigned Categories */}
      {unassignedCategories.length > 0 && (
        <div className="mt-6">
          <h4 className="text-base font-bold text-black dark:text-white mb-3">
            Unassigned Categories (Drag to buckets above)
          </h4>
          <div className="border border-black dark:border-gray-700 bg-white dark:bg-gray-800">
            <table className="w-full">
              <thead>
                <tr className="border-b border-black dark:border-gray-700">
                  <th className="text-left p-3 text-sm font-medium text-black dark:text-white">
                    Category
                  </th>
                  <th className="text-right p-3 text-sm font-medium text-black dark:text-white">
                    Planned Amount
                  </th>
                  <th className="text-right p-3 text-sm font-medium text-black dark:text-white">
                    % of Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {unassignedCategories.map((category) => {
                  const categoryColor = category.colorHex || '#E2F0CB'
                  const rowTint = getLightTint(categoryColor, 0.1)

                  return (
                    <tr
                      key={category.id}
                      className="border-b border-black dark:border-gray-700 cursor-move"
                      style={{ backgroundColor: rowTint }}
                      draggable
                      onDragStart={() => handleDragStart(category.id)}
                    >
                      <td className="p-3 text-sm text-black dark:text-white">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: categoryColor }}
                          />
                          {category.name}
                        </div>
                      </td>
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
                          className="w-32 border border-black dark:border-gray-700 px-2 py-1 text-sm text-right text-black dark:text-white bg-white dark:bg-gray-900"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="p-3 text-sm text-right text-black dark:text-white">
                        {totalPlannedExpenses > 0 && budgetLineItems[category.id] > 0
                          ? `${((budgetLineItems[category.id] / totalPlannedExpenses) * 100).toFixed(1)}%`
                          : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary Section */}
      {buckets.length > 0 && (
        <div className="mt-6 pt-4 border-t border-black dark:border-gray-700">
          <div className="flex justify-between text-sm font-medium text-black dark:text-white">
            <span>Total Allocated Percentage:</span>
            <span className={totalAllocatedPercentage > 100 ? 'text-orange-600 dark:text-orange-400' : ''}>
              {totalAllocatedPercentage.toFixed(1)}%
              {totalAllocatedPercentage > 100 && (
                <span className="ml-2 text-xs">(Over 100% - this is okay, just a guide)</span>
              )}
            </span>
          </div>
          <div className="flex justify-between text-sm font-medium text-black dark:text-white mt-1">
            <span>Remaining Planned Savings:</span>
            <span className={remainingSavings < 0 ? 'text-orange-600 dark:text-orange-400' : ''}>
              ${formatCurrency(remainingSavings)}
            </span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-500 mt-2 italic">
            Note: Percentages are a guide to help you build your budget. You can exceed 100% if needed.
          </div>
        </div>
      )}
    </div>
  )
}

