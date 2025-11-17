'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import Navigation from '@/components/Navigation'
import Modal from '@/components/Modal'
import { useModal } from '@/hooks/useModal'
import { getLightTint } from '@/constants/colors'
import { formatCurrency } from '@/lib/format'

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
  const [aiSuggesting, setAiSuggesting] = useState<Record<string, boolean>>({})
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, { categoryName: string; confidence: number; reasoning: string }>>({})
  const [batchCategorizing, setBatchCategorizing] = useState<'ai' | 'smart' | null>(null)
  const [aiProvider, setAiProvider] = useState<'claude' | 'openai'>('claude')
  const [showAiProviderDropdown, setShowAiProviderDropdown] = useState(false)
  const [recentlyChangedId, setRecentlyChangedId] = useState<string | null>(null)
  const [showScrollToButton, setShowScrollToButton] = useState(false)
  const transactionRefs = useRef<Record<string, HTMLDivElement | HTMLTableRowElement | null>>({})
  const modal = useModal()

  const fetchTransactions = useCallback(async () => {
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
  }, [selectedUserId, year, month])

  const fetchData = useCallback(async (userId: string) => {
    setLoading(true)
    try {
      // Initialize preset categories first (idempotent - won't create duplicates)
      await fetch('/api/expense-categories/initialize-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })

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

      if (userId === selectedUserId) {
        await fetchTransactions()
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedUserId, fetchTransactions])

  useEffect(() => {
    const stored = localStorage.getItem('selectedUserId')
    if (stored) {
      setSelectedUserId(stored)
      fetchData(stored)
    }
  }, [fetchData])

  useEffect(() => {
    if (selectedUserId) {
      fetchTransactions()
    }
  }, [selectedUserId, year, month, fetchTransactions])

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
        const newTransaction = await res.json()
        // Optimistically add to local state
        setTransactions((prev) => [newTransaction, ...prev])
        setShowForm(false)
        setFormData({
          date: new Date().toISOString().split('T')[0],
          description: '',
          amount: '',
          type: 'expense',
          incomeSourceId: '',
          expenseCategoryId: '',
        })
      } else {
        // If creation failed, refresh to get accurate state
        await fetchTransactions()
        const errorData = await res.json()
        modal.showError(`Failed to create transaction: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error creating transaction:', error)
      await fetchTransactions() // Refresh on error
      modal.showError('Error creating transaction')
    }
  }

  const handleDelete = async (id: string) => {
    modal.showConfirm(
      'Are you sure you want to delete this transaction?',
      async () => {
        // Optimistically remove from UI
        setTransactions((prev) => prev.filter((t) => t.id !== id))

        try {
          const res = await fetch(`/api/transactions?id=${id}`, { method: 'DELETE' })

          if (!res.ok) {
            // If delete failed, refresh to restore accurate state
            await fetchTransactions()
            modal.showError('Failed to delete transaction')
          }
          // If successful, the optimistic update is already in place
        } catch (error) {
          console.error('Error deleting transaction:', error)
          // Revert on error
          await fetchTransactions()
          modal.showError('Failed to delete transaction')
        }
      },
      'Delete Transaction'
    )
  }

  const handleCategoryChange = async (
    transactionId: string,
    categoryId: string,
    type: 'expense' | 'income'
  ) => {
    // Optimistically update the UI immediately
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id === transactionId) {
          if (type === 'expense') {
            const category = expenseCategories.find((c) => c.id === categoryId)
            return {
              ...t,
              expenseCategoryId: categoryId,
              expenseCategory: category || null,
            }
          } else {
            const source = incomeSources.find((s) => s.id === categoryId)
            return {
              ...t,
              incomeSourceId: categoryId,
              incomeSource: source || null,
            }
          }
        }
        return t
      })
    )

    // Track the recently changed transaction and show scroll button (desktop only)
    setRecentlyChangedId(transactionId)
    setShowScrollToButton(true)

    try {
      const updateData =
        type === 'expense'
          ? { id: transactionId, expenseCategoryId: categoryId }
          : { id: transactionId, incomeSourceId: categoryId }

      const res = await fetch('/api/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      if (!res.ok) {
        // If update failed, revert the optimistic update
        await fetchTransactions()
        setShowScrollToButton(false)
        setRecentlyChangedId(null)
        const errorData = await res.json()
        modal.showError(`Failed to update category: ${errorData.error || 'Unknown error'}`)
      }
      // If successful, the optimistic update is already in place, no need to refresh
    } catch (error) {
      console.error('Error updating transaction category:', error)
      // Revert on error
      await fetchTransactions()
      setShowScrollToButton(false)
      setRecentlyChangedId(null)
      modal.showError('Failed to update category')
    }
  }

  const handleScrollToChanged = () => {
    if (!recentlyChangedId) return

    const element = transactionRefs.current[recentlyChangedId]
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Add a highlight effect with orange ring
      element.classList.add('ring-4', 'ring-orange-500', 'dark:ring-orange-400', 'ring-opacity-75')
      setTimeout(() => {
        element.classList.remove('ring-4', 'ring-orange-500', 'dark:ring-orange-400', 'ring-opacity-75')
      }, 2000)
    }
    setShowScrollToButton(false)
    setRecentlyChangedId(null)
  }

  const handleQuickCategory = async (transactionId: string, categoryName: string) => {
    if (!selectedUserId) return
    
    // Find or create the category
    let category = expenseCategories.find(
      (cat) => cat.name.toLowerCase() === categoryName.toLowerCase()
    )

    if (!category) {
      // Category doesn't exist, create it
      try {
        const res = await fetch('/api/expense-categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: selectedUserId,
            name: categoryName,
            type: 'variable',
          }),
        })

        if (res.ok) {
          category = await res.json()
          // Update local state with new category
          setExpenseCategories((prev) => [...prev, category])
        } else {
          modal.showError('Failed to create category')
          return
        }
      } catch (error) {
        console.error('Error creating category:', error)
        modal.showError('Error creating category')
        return
      }
    }

    // Apply the category to the transaction (this will optimistically update)
    if (category) {
      await handleCategoryChange(transactionId, category.id, 'expense')
    }
  }

  const handleCreateCategoryAndAssign = async (
    transactionId: string,
    categoryName: string
  ) => {
    if (!selectedUserId) return

    try {
      // Create the category
      const createRes = await fetch('/api/expense-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          name: categoryName,
          type: 'variable', // Default to variable, user can change later
        }),
      })

      if (!createRes.ok) {
        modal.showError('Failed to create category')
        return
      }

      const newCategory = await createRes.json()

      // Assign it to the transaction
      await handleCategoryChange(transactionId, newCategory.id, 'expense')
    } catch (error) {
      console.error('Error creating category:', error)
      modal.showError('Failed to create category')
    }
  }

  const handleAiSuggest = async (transaction: any) => {
    if (!selectedUserId) return

    // Only suggest for uncategorized expense transactions
    if (transaction.type !== 'expense' || transaction.expenseCategoryId) {
      return
    }

    setAiSuggesting((prev) => ({ ...prev, [transaction.id]: true }))

    try {
      const res = await fetch('/api/categorization-rules/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          merchantName: transaction.merchantName || transaction.description,
          description: transaction.description,
          amount: transaction.amount,
        }),
      })

      if (res.ok) {
        const suggestion = await res.json()
        setAiSuggestions((prev) => ({ ...prev, [transaction.id]: suggestion }))
      } else {
        const error = await res.json()
        if (res.status === 503) {
          modal.showError('AI categorization is not available. Please set ANTHROPIC_API_KEY in your environment variables.')
        } else {
          modal.showError(`Failed to get AI suggestion: ${error.error || 'Unknown error'}`)
        }
      }
    } catch (error) {
      console.error('Error getting AI suggestion:', error)
      modal.showError('Failed to get AI suggestion')
    } finally {
      setAiSuggesting((prev) => ({ ...prev, [transaction.id]: false }))
    }
  }

  const handleAcceptAiSuggestion = async (transaction: any, suggestion: { categoryName: string }) => {
    if (!selectedUserId) return

    // Find or create the category
    let category = expenseCategories.find(
      (cat) => cat.name.toLowerCase() === suggestion.categoryName.toLowerCase()
    )

    if (!category) {
      // Create the category
      try {
        const createRes = await fetch('/api/expense-categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: selectedUserId,
            name: suggestion.categoryName,
            type: 'variable',
          }),
        })

        if (createRes.ok) {
          category = await createRes.json()
          await fetchData(selectedUserId)
        } else {
          modal.showError('Failed to create category')
          return
        }
      } catch (error) {
        console.error('Error creating category:', error)
        modal.showError('Failed to create category')
        return
      }
    }

    // Assign the category
    await handleCategoryChange(transaction.id, category.id, 'expense')
    
    // Clear the suggestion
    const newSuggestions = { ...aiSuggestions }
    delete newSuggestions[transaction.id]
    setAiSuggestions(newSuggestions)
  }

  const handleSort = useCallback((field: 'date' | 'description' | 'amount' | 'type' | 'category') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }, [sortField, sortDirection])

  const handleBatchCategorize = async (type: 'ai' | 'smart') => {
    if (!selectedUserId) return

    // Get all uncategorized transactions
    // A transaction is uncategorized if:
    // - For expenses: expenseCategoryId is null/undefined, OR expenseCategory name is "Uncategorized" or "N/A"
    // - For income: incomeSourceId is null/undefined
    const uncategorizedTransactions = transactions.filter((t) => {
      if (t.type === 'expense') {
        // Expense is uncategorized if:
        // 1. No category ID assigned, OR
        // 2. Category exists but is named "Uncategorized" or "N/A"
        const hasNoCategory = !t.expenseCategoryId
        const isUncategorizedCategory = t.expenseCategory && 
          (t.expenseCategory.name === 'Uncategorized' || t.expenseCategory.name === 'N/A')
        return hasNoCategory || isUncategorizedCategory
      } else if (t.type === 'income') {
        // Income is uncategorized if no income source ID assigned
        return !t.incomeSourceId
      }
      return false
    })

    if (uncategorizedTransactions.length === 0) {
      modal.showWarning('No uncategorized transactions found in the current month!')
      return
    }

    // Show breakdown of what will be processed
    const expenseCount = uncategorizedTransactions.filter(t => t.type === 'expense').length
    const incomeCount = uncategorizedTransactions.filter(t => t.type === 'income').length
    const breakdown = []
    if (expenseCount > 0) breakdown.push(`${expenseCount} expense${expenseCount > 1 ? 's' : ''}`)
    if (incomeCount > 0) breakdown.push(`${incomeCount} income source${incomeCount > 1 ? 's' : ''}`)
    
    const message = `Categorize ${uncategorizedTransactions.length} uncategorized transaction${uncategorizedTransactions.length > 1 ? 's' : ''} (${breakdown.join(', ')}) using ${type === 'ai' ? 'AI' : 'smart rules'}?`

    modal.showConfirm(
      message,
      () => {
        // Continue with categorization - only uncategorized transactions will be processed
        performCategorization(type, uncategorizedTransactions)
      },
      'Confirm Categorization'
    )
  }

  const performCategorization = async (type: 'ai' | 'smart', uncategorizedTransactions: any[]) => {
    if (!selectedUserId) return

    setBatchCategorizing(type)

    try {
      const endpoint = type === 'ai' 
        ? '/api/transactions/categorize-ai'
        : '/api/transactions/categorize-smart'

      const body: any = {
        userId: selectedUserId,
        transactionIds: uncategorizedTransactions.map((t) => t.id),
      }

      // Add provider for AI categorization
      if (type === 'ai') {
        body.provider = aiProvider
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      let result: any = {}
      try {
        result = await res.json()
      } catch (e) {
        console.error('Failed to parse response:', e)
        modal.showError('Failed to parse server response. Please check the console for details.')
        return
      }

      if (res.ok) {
        // Ensure we have valid numbers
        const categorized = typeof result.categorized === 'number' ? result.categorized : 0
        const total = typeof result.total === 'number' ? result.total : uncategorizedTransactions.length
        const message = result.message || ''
        
        if (categorized > 0) {
          modal.showSuccess(`Successfully categorized ${categorized} out of ${total} transaction(s)!${message ? ` ${message}` : ''}`)
        } else {
          modal.showWarning(`No transactions were categorized.${message ? ` ${message}` : ' Make sure you have categorization rules set up or AI is properly configured.'}`)
        }
        await fetchTransactions()
        await fetchData(selectedUserId) // Refresh categories
      } else {
        let errorMessage = 'Unknown error'
        errorMessage = result.error || result.message || errorMessage
        
        if (res.status === 503) {
          modal.showError('AI categorization is not available. Please set ANTHROPIC_API_KEY in your environment variables.')
        } else {
          modal.showError(`Failed to categorize: ${errorMessage}`)
        }
      }
    } catch (error: any) {
      console.error(`Error in batch ${type} categorization:`, error)
      modal.showError(`Error categorizing transactions: ${error.message || 'Unknown error'}`)
    } finally {
      setBatchCategorizing(null)
    }
  }

  // Memoize sorted transactions to avoid re-sorting on every render
  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
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
  }, [transactions, sortField, sortDirection])

  // Create a map for O(1) category lookup instead of O(n) find
  const categoryMap = useMemo(() => {
    const map = new Map<string, { colorHex?: string }>()
    expenseCategories.forEach((cat) => {
      map.set(cat.id, { colorHex: cat.colorHex })
    })
    return map
  }, [expenseCategories])

  const getCategoryColor = useCallback((transaction: any): string => {
    if (transaction.type === 'expense' && transaction.expenseCategory) {
      const category = categoryMap.get(transaction.expenseCategory.id)
      return category?.colorHex || '#FDE2E4'
    }
    return '#FFFFFF'
  }, [categoryMap])

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
    <div className="min-h-screen bg-white dark:bg-gray-900 relative">
      <Navigation selectedUserId={selectedUserId} />
      {/* Scroll to changed item button - Desktop only */}
      {showScrollToButton && recentlyChangedId && (
        <button
          onClick={handleScrollToChanged}
          className="hidden md:flex fixed right-4 bottom-4 z-50 items-center justify-center w-12 h-12 rounded-lg border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-800 text-black dark:text-white shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 hover:scale-110"
          title="Scroll to recently changed item"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 10l7-7m0 0l7 7m-7-7v18"
            />
          </svg>
        </button>
      )}
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 sm:mb-6 lg:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black dark:text-white">Transactions</h1>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="w-full sm:w-auto border border-black dark:border-gray-700 px-4 py-2 text-sm sm:text-base text-black dark:text-white bg-white dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 hover:text-white transition-colors"
            >
              Add Transaction
            </button>
          )}
        </div>

        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 sm:flex-initial">
            <label className="block text-xs sm:text-sm font-medium text-black dark:text-white mb-1">
              Year
            </label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="w-full border border-black dark:border-gray-700 px-3 py-2 text-sm sm:text-base text-black dark:text-white bg-white dark:bg-gray-900"
            />
          </div>
          <div className="flex-1 sm:flex-initial">
            <label className="block text-xs sm:text-sm font-medium text-black dark:text-white mb-1">
              Month
            </label>
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="w-full border border-black dark:border-gray-700 px-3 py-2 text-sm sm:text-base text-black dark:text-white bg-white dark:bg-gray-900"
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
          <div className="flex items-end gap-2 flex-wrap">
            <button
              onClick={() => handleBatchCategorize('smart')}
              disabled={batchCategorizing !== null}
              className="border border-black dark:border-gray-700 px-4 py-2 text-sm sm:text-base text-black dark:text-white bg-white dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Use smart rules and algorithms to categorize all uncategorized transactions"
            >
              {batchCategorizing === 'smart' ? 'Categorizing...' : 'Smart Categorize'}
            </button>
            <div className="relative">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleBatchCategorize('ai')}
                  disabled={batchCategorizing !== null}
                  className="flex items-center gap-2 border border-black dark:border-gray-700 px-4 py-2 text-sm sm:text-base text-black dark:text-white bg-white dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Use AI to categorize all uncategorized transactions"
                >
                  {batchCategorizing === 'ai' ? (
                    'Categorizing...'
                  ) : (
                    <>
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M12 0L14.09 8.26L22 10L14.09 11.74L12 20L9.91 11.74L2 10L9.91 8.26L12 0Z" />
                        <path d="M19 15L19.5 17.5L22 18L19.5 18.5L19 21L18.5 18.5L16 18L18.5 17.5L19 15Z" />
                        <path d="M5 17L5.5 19.5L8 20L5.5 20.5L5 23L4.5 20.5L2 20L4.5 19.5L5 17Z" />
                      </svg>
                      AI Categorize ({aiProvider === 'claude' ? 'Claude' : 'OpenAI'})
                    </>
                  )}
                </button>
                {!batchCategorizing && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowAiProviderDropdown(!showAiProviderDropdown)
                    }}
                    className="px-2 py-2 text-xs border border-black dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="Select AI provider"
                  >
                    ▼
                  </button>
                )}
              </div>
              {showAiProviderDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowAiProviderDropdown(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-50 border border-black dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg min-w-[120px]">
                    <button
                      onClick={() => {
                        setAiProvider('claude')
                        setShowAiProviderDropdown(false)
                      }}
                      className={`w-full text-left px-4 py-2 text-sm text-black dark:text-white hover:bg-black dark:hover:bg-gray-700 hover:text-white ${
                        aiProvider === 'claude' ? 'bg-gray-100 dark:bg-gray-700' : ''
                      }`}
                    >
                      Claude
                    </button>
                    <button
                      onClick={() => {
                        setAiProvider('openai')
                        setShowAiProviderDropdown(false)
                      }}
                      className={`w-full text-left px-4 py-2 text-sm text-black dark:text-white hover:bg-black dark:hover:bg-gray-700 hover:text-white ${
                        aiProvider === 'openai' ? 'bg-gray-100 dark:bg-gray-700' : ''
                      }`}
                    >
                      OpenAI
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-4 sm:mb-6 lg:mb-8 border border-black dark:border-gray-700 p-4 sm:p-6 bg-white dark:bg-gray-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
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
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="submit"
                className="w-full sm:w-auto border border-black dark:border-gray-700 px-4 py-2 text-sm sm:text-base text-black dark:text-white bg-white dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 hover:text-white transition-colors"
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
                className="w-full sm:w-auto border border-black dark:border-gray-700 px-4 py-2 text-sm sm:text-base text-black dark:text-white bg-white dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {sortedTransactions.map((transaction) => {
            const categoryColor = getCategoryColor(transaction)
            const rowTint = getLightTint(categoryColor, 0.45)

            return (
              <div
                key={transaction.id}
                ref={(el) => {
                  transactionRefs.current[transaction.id] = el
                }}
                className="border border-black dark:border-gray-700 p-4 bg-white dark:bg-gray-800 transition-all duration-300"
                style={{ backgroundColor: rowTint }}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-black dark:text-white">
                      {transaction.description}
                    </div>
                    <div className="text-xs text-black dark:text-gray-400 mt-1">
                      {new Date(transaction.date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right ml-2">
                    <div className="text-lg font-semibold text-black dark:text-white">
                      ${formatCurrency(transaction.amount)}
                    </div>
                    <div className="text-xs text-black dark:text-gray-400 capitalize">
                      {transaction.type}
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  {transaction.type === 'income' ? (
                    <select
                      value={transaction.incomeSourceId || ''}
                      onChange={(e) =>
                        handleCategoryChange(transaction.id, e.target.value, 'income')
                      }
                      className="w-full border border-black dark:border-gray-700 px-2 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-900"
                    >
                      <option value="">Select source</option>
                      {incomeSources.map((source) => (
                        <option key={source.id} value={source.id}>
                          {source.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <select
                          value={transaction.expenseCategoryId || ''}
                          onChange={(e) => {
                            if (e.target.value === '__NEW__') {
                              const newName = prompt('Enter new category name:')
                              if (newName && newName.trim()) {
                                handleCreateCategoryAndAssign(transaction.id, newName.trim())
                              }
                            } else {
                              handleCategoryChange(transaction.id, e.target.value, 'expense')
                            }
                          }}
                          className="flex-1 border border-black dark:border-gray-700 px-2 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-900"
                        >
                          <option value="">Select category</option>
                          {expenseCategories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                          <option value="__NEW__">+ Create New Category</option>
                        </select>
                        {(!transaction.expenseCategoryId || 
                          !transaction.expenseCategory || 
                          transaction.expenseCategory.name === 'Uncategorized' || 
                          transaction.expenseCategory.name === 'N/A') && (
                          <button
                            onClick={() => handleQuickCategory(transaction.id, 'Dining & Drinks')}
                            className="px-3 py-2 text-xs font-medium border border-black dark:border-gray-600 text-black dark:text-white bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center"
                            title="Quick assign: Dining & Drinks"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              {/* Fork - left side */}
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 3v6m0 0v10m0-10h1.5M5 9H3.5m10-6v6m0 0v10m0-10h1.5M15 9h-1.5"
                              />
                              {/* Knife - right side */}
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 3l-4 4v13"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 3l-2 2"
                              />
                            </svg>
                          </button>
                        )}
                        {!transaction.expenseCategoryId && (
                          <button
                            onClick={() => handleAiSuggest(transaction)}
                            disabled={aiSuggesting[transaction.id]}
                            className="px-3 py-2 text-xs border border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Get AI category suggestion"
                          >
                            {aiSuggesting[transaction.id] ? '...' : 'AI'}
                          </button>
                        )}
                      </div>
                      {aiSuggestions[transaction.id] && (
                        <div className="p-2 border border-blue-600 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded">
                          <div className="text-xs text-blue-800 dark:text-blue-200 mb-1">
                            <strong>AI Suggestion:</strong> {aiSuggestions[transaction.id].categoryName}
                            {aiSuggestions[transaction.id].confidence && (
                              <span className="ml-1">({Math.round(aiSuggestions[transaction.id].confidence * 100)}% confidence)</span>
                            )}
                          </div>
                          {aiSuggestions[transaction.id].reasoning && (
                            <div className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                              {aiSuggestions[transaction.id].reasoning}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAcceptAiSuggestion(transaction, aiSuggestions[transaction.id])}
                              className="px-2 py-1 text-xs border border-green-600 dark:border-green-500 text-green-600 dark:text-green-400 bg-white dark:bg-gray-800 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => {
                                const newSuggestions = { ...aiSuggestions }
                                delete newSuggestions[transaction.id]
                                setAiSuggestions(newSuggestions)
                              }}
                              className="px-2 py-1 text-xs border border-gray-600 dark:border-gray-500 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/20 transition-colors"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="mt-2">
                  <button
                    onClick={() => handleDelete(transaction.id)}
                    className="text-sm text-red-600 dark:text-red-400 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
          {sortedTransactions.length === 0 && (
            <div className="border border-black dark:border-gray-700 p-4 text-center text-sm text-black dark:text-white bg-white dark:bg-gray-800">
              No transactions found for this period
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block border border-black dark:border-gray-700 bg-white dark:bg-gray-800">
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
                    ref={(el) => {
                      transactionRefs.current[transaction.id] = el
                    }}
                    className="border-b border-black dark:border-gray-700 transition-all duration-300"
                    style={{ backgroundColor: rowTint }}
                  >
                  <td className="p-3 text-sm text-black dark:text-white">
                    {new Date(transaction.date).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-sm text-black dark:text-white">{transaction.description}</td>
                  <td className="p-3">
                    {transaction.type === 'income' ? (
                      <select
                        value={transaction.incomeSourceId || ''}
                        onChange={(e) =>
                          handleCategoryChange(transaction.id, e.target.value, 'income')
                        }
                        className="w-full border border-black dark:border-gray-700 px-2 py-1 text-sm text-black dark:text-white bg-white dark:bg-gray-900"
                      >
                        <option value="">Select source</option>
                        {incomeSources.map((source) => (
                          <option key={source.id} value={source.id}>
                            {source.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex gap-1">
                          <select
                            value={transaction.expenseCategoryId || ''}
                            onChange={(e) => {
                              if (e.target.value === '__NEW__') {
                                const newName = prompt('Enter new category name:')
                                if (newName && newName.trim()) {
                                  handleCreateCategoryAndAssign(transaction.id, newName.trim())
                                }
                              } else {
                                handleCategoryChange(transaction.id, e.target.value, 'expense')
                              }
                            }}
                            className="flex-1 border border-black dark:border-gray-700 px-2 py-1 text-sm text-black dark:text-white bg-white dark:bg-gray-900"
                          >
                            <option value="">Select category</option>
                            {expenseCategories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                            <option value="__NEW__">+ Create New</option>
                          </select>
                          {(!transaction.expenseCategoryId || 
                            !transaction.expenseCategory || 
                            transaction.expenseCategory.name === 'Uncategorized' || 
                            transaction.expenseCategory.name === 'N/A') && (
                            <button
                              onClick={() => handleQuickCategory(transaction.id, 'Dining & Drinks')}
                              className="px-2 py-1 text-xs font-medium border border-black dark:border-gray-600 text-black dark:text-white bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center"
                              title="Quick assign: Dining & Drinks"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                {/* Fork - left side */}
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 3v6m0 0v10m0-10h1.5M5 9H3.5m10-6v6m0 0v10m0-10h1.5M15 9h-1.5"
                                />
                                {/* Knife - right side */}
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 3l-4 4v13"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 3l-2 2"
                                />
                              </svg>
                            </button>
                          )}
                          {!transaction.expenseCategoryId && (
                            <button
                              onClick={() => handleAiSuggest(transaction)}
                              disabled={aiSuggesting[transaction.id]}
                              className="px-2 py-1 text-xs border border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Get AI category suggestion"
                            >
                              {aiSuggesting[transaction.id] ? '...' : 'AI'}
                            </button>
                          )}
                        </div>
                        {aiSuggestions[transaction.id] && (
                          <div className="p-2 border border-blue-600 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
                            <div className="text-blue-800 dark:text-blue-200 mb-1">
                              <strong>AI:</strong> {aiSuggestions[transaction.id].categoryName}
                              {aiSuggestions[transaction.id].confidence && (
                                <span className="ml-1">({Math.round(aiSuggestions[transaction.id].confidence * 100)}%)</span>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleAcceptAiSuggestion(transaction, aiSuggestions[transaction.id])}
                                className="px-2 py-0.5 border border-green-600 dark:border-green-500 text-green-600 dark:text-green-400 bg-white dark:bg-gray-800 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => {
                                  const newSuggestions = { ...aiSuggestions }
                                  delete newSuggestions[transaction.id]
                                  setAiSuggestions(newSuggestions)
                                }}
                                className="px-2 py-0.5 border border-gray-600 dark:border-gray-500 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/20 transition-colors"
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-sm text-right text-black dark:text-white">
                    ${formatCurrency(transaction.amount)}
                  </td>
                  <td className="p-3 text-sm text-center text-black dark:text-white capitalize">
                    {transaction.type}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => handleDelete(transaction.id)}
                      className="text-sm text-black dark:text-white hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                  </tr>
                  )
                })}
                {sortedTransactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-3 text-center text-sm text-black dark:text-white">
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

