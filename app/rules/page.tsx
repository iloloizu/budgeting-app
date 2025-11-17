'use client'

import { useEffect, useState, useCallback } from 'react'
import Navigation from '@/components/Navigation'
import Modal from '@/components/Modal'
import { useModal } from '@/hooks/useModal'
import CategoryColorPicker from '@/components/CategoryColorPicker'
import { PASTEL_PALETTE, getLightTint } from '@/constants/colors'

interface CategorizationRule {
  id: string
  pattern: string
  matchType: 'exact' | 'contains' | 'regex'
  category?: { id: string; name: string; type: string; colorHex: string | null }
  incomeSource?: { id: string; name: string; type: string }
  appliesTo: string
  createdAt: string
  updatedAt: string
}

export default function RulesPage() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [rules, setRules] = useState<CategorizationRule[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showCategorySection, setShowCategorySection] = useState(false)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [expenseCategories, setExpenseCategories] = useState<any[]>([])
  const [incomeSources, setIncomeSources] = useState<any[]>([])
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryType, setNewCategoryType] = useState<'fixed' | 'variable'>('variable')
  const [newIncomeSourceName, setNewIncomeSourceName] = useState('')
  const [newIncomeSourceAmount, setNewIncomeSourceAmount] = useState('')
  const [newIncomeSourceType, setNewIncomeSourceType] = useState<'salary' | 'bonus' | 'freelance' | 'other'>('salary')
  const modal = useModal()
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set())
  const [filterCategoryId, setFilterCategoryId] = useState<string>('')
  const [formData, setFormData] = useState({
    pattern: '',
    matchType: 'contains' as 'exact' | 'contains' | 'regex',
    categoryId: '',
    incomeSourceId: '',
    appliesTo: 'expense',
  })

  useEffect(() => {
    const stored = localStorage.getItem('selectedUserId')
    if (stored) {
      setSelectedUserId(stored)
    }
  }, [])

  const fetchData = useCallback(async () => {
    if (!selectedUserId) return

    setLoading(true)
    try {
      const [rulesRes, categoriesRes, incomeRes] = await Promise.all([
        fetch(`/api/categorization-rules?userId=${selectedUserId}`),
        fetch(`/api/expense-categories?userId=${selectedUserId}`),
        fetch(`/api/income-sources?userId=${selectedUserId}`),
      ])

      if (rulesRes.ok) {
        const data = await rulesRes.json()
        setRules(data)
      }

      if (categoriesRes.ok) {
        const data = await categoriesRes.json()
        // Filter out "Uncategorized" and "N/A" categories - rules can't use them
        setExpenseCategories(data.filter((cat: any) => 
          cat.name.toLowerCase() !== 'uncategorized' && cat.name.toLowerCase() !== 'n/a'
        ))
      }

      if (incomeRes.ok) {
        const data = await incomeRes.json()
        setIncomeSources(data.filter((s: any) => s.isActive))
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedUserId])

  useEffect(() => {
    if (selectedUserId) {
      fetchData()
    }
  }, [selectedUserId, fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUserId) return

    try {
      const url = editingRuleId 
        ? `/api/categorization-rules/${editingRuleId}`
        : '/api/categorization-rules'
      
      const method = editingRuleId ? 'PATCH' : 'POST'
      
      // Validate required fields before submitting
      if (formData.appliesTo === 'expense' && !formData.categoryId) {
        modal.showWarning('Please select an expense category for expense rules. Rules cannot be created without a valid category.')
        return
      }
      if (formData.appliesTo === 'income' && !formData.incomeSourceId) {
        modal.showWarning('Please select an income source for income rules. Rules cannot be created without a valid income source.')
        return
      }
      if (formData.appliesTo === 'both' && !formData.categoryId && !formData.incomeSourceId) {
        modal.showWarning('Please select at least one category or income source for "both" rules. Rules cannot be created without a valid category or income source.')
        return
      }

      // Validate pattern doesn't contain numeric IDs
      const hasNumericId = /\d{6,}/.test(formData.pattern) // 6+ consecutive digits likely an ID
      const hasUUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(formData.pattern)
      
      if (hasNumericId || hasUUID) {
        modal.showWarning('Pattern should not include transaction IDs or long numeric sequences. Use text-based patterns instead (e.g., "UBER", "STARBUCKS", "AMAZON").')
        return
      }

      // Ensure proper data structure for editing
      const body = editingRuleId
        ? {
            pattern: formData.pattern,
            matchType: formData.matchType,
            appliesTo: formData.appliesTo,
            categoryId: formData.appliesTo === 'income' ? null : (formData.categoryId || null),
            incomeSourceId: formData.appliesTo === 'expense' ? null : (formData.incomeSourceId || null),
          }
        : {
            userId: selectedUserId,
            pattern: formData.pattern,
            matchType: formData.matchType,
            appliesTo: formData.appliesTo,
            categoryId: formData.appliesTo === 'income' ? null : (formData.categoryId || null),
            incomeSourceId: formData.appliesTo === 'expense' ? null : (formData.incomeSourceId || null),
          }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        await fetchData()
        setShowAddForm(false)
        setEditingRuleId(null)
        setSelectedRuleIds(new Set())
        setFormData({
          pattern: '',
          matchType: 'contains',
          categoryId: '',
          incomeSourceId: '',
          appliesTo: 'expense',
        })
      } else {
        const error = await res.json()
        modal.showError(`Failed to ${editingRuleId ? 'update' : 'create'} rule: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error(`Error ${editingRuleId ? 'updating' : 'creating'} rule:`, error)
      modal.showError(`Error ${editingRuleId ? 'updating' : 'creating'} rule`)
    }
  }

  const handleEdit = (rule: CategorizationRule) => {
    setEditingRuleId(rule.id)
    setFormData({
      pattern: rule.pattern,
      matchType: rule.matchType as 'exact' | 'contains' | 'regex',
      categoryId: rule.category?.id || '',
      incomeSourceId: rule.incomeSource?.id || '',
      appliesTo: rule.appliesTo,
    })
    setShowAddForm(true)
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelEdit = () => {
    setShowAddForm(false)
    setEditingRuleId(null)
    setFormData({
      pattern: '',
      matchType: 'contains',
      categoryId: '',
      incomeSourceId: '',
      appliesTo: 'expense',
    })
  }

  const handleDelete = async (id: string) => {
    modal.showConfirm(
      'Are you sure you want to delete this rule?',
      async () => {
        try {
          const res = await fetch(`/api/categorization-rules?id=${id}`, {
            method: 'DELETE',
          })

          if (res.ok) {
            await fetchData()
            setSelectedRuleIds(new Set())
          } else {
            modal.showError('Failed to delete rule')
          }
        } catch (error) {
          console.error('Error deleting rule:', error)
          modal.showError('Error deleting rule')
        }
      },
      'Delete Rule'
    )
  }

  const handleToggleSelect = (ruleId: string) => {
    setSelectedRuleIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(ruleId)) {
        newSet.delete(ruleId)
      } else {
        newSet.add(ruleId)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    const filteredRules = filterCategoryId 
      ? rules.filter((r) => r.category?.id === filterCategoryId)
      : rules
    
    const filteredRuleIds = new Set(filteredRules.map((r) => r.id))
    const allFilteredSelected = filteredRuleIds.size > 0 && 
      Array.from(filteredRuleIds).every((id) => selectedRuleIds.has(id))
    
    if (allFilteredSelected) {
      // Deselect all filtered rules
      setSelectedRuleIds((prev) => {
        const newSet = new Set(prev)
        filteredRuleIds.forEach((id) => newSet.delete(id))
        return newSet
      })
    } else {
      // Select all filtered rules
      setSelectedRuleIds((prev) => {
        const newSet = new Set(prev)
        filteredRuleIds.forEach((id) => newSet.add(id))
        return newSet
      })
    }
  }

  const handleSelectByCategory = (categoryId: string) => {
    const categoryRules = rules.filter((r) => r.category?.id === categoryId)
    const categoryRuleIds = new Set(categoryRules.map((r) => r.id))
    
    // Check if all category rules are already selected
    const allSelected = categoryRuleIds.size > 0 && 
      Array.from(categoryRuleIds).every((id) => selectedRuleIds.has(id))
    
    if (allSelected) {
      // Deselect all category rules
      setSelectedRuleIds((prev) => {
        const newSet = new Set(prev)
        categoryRuleIds.forEach((id) => newSet.delete(id))
        return newSet
      })
    } else {
      // Select all category rules
      setSelectedRuleIds((prev) => {
        const newSet = new Set(prev)
        categoryRuleIds.forEach((id) => newSet.add(id))
        return newSet
      })
    }
  }

  const handleBulkDelete = () => {
    const count = selectedRuleIds.size
    modal.showConfirm(
      `Are you sure you want to delete ${count} rule${count > 1 ? 's' : ''}?`,
      async () => {
        try {
          const deletePromises = Array.from(selectedRuleIds).map((id) =>
            fetch(`/api/categorization-rules?id=${id}`, {
              method: 'DELETE',
            })
          )

          const results = await Promise.all(deletePromises)
          const failed = results.filter((res) => !res.ok)

          if (failed.length === 0) {
            await fetchData()
            setSelectedRuleIds(new Set())
            modal.showSuccess(`Successfully deleted ${count} rule${count > 1 ? 's' : ''}`)
          } else {
            modal.showError(`Failed to delete ${failed.length} of ${count} rule${count > 1 ? 's' : ''}`)
          }
        } catch (error) {
          console.error('Error deleting rules:', error)
          modal.showError('Error deleting rules')
        }
      },
      'Delete Rules'
    )
  }

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUserId || !newCategoryName.trim()) return

    try {
      const res = await fetch('/api/expense-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          name: newCategoryName.trim(),
          type: newCategoryType,
        }),
      })

      if (res.ok) {
        await fetchData()
        setNewCategoryName('')
        setNewCategoryType('variable')
      } else {
        const error = await res.json()
        modal.showError(`Failed to create category: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error creating category:', error)
      modal.showError('Error creating category')
    }
  }

  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    modal.showConfirm(
      `Are you sure you want to delete the category "${categoryName}"? This will also delete all rules using this category.`,
      async () => {
        try {
          const res = await fetch(`/api/expense-categories?id=${categoryId}`, {
            method: 'DELETE',
          })

          if (res.ok) {
            await fetchData()
          } else {
            const error = await res.json()
            modal.showError(`Failed to delete category: ${error.error || 'Unknown error'}`)
          }
        } catch (error) {
          console.error('Error deleting category:', error)
          modal.showError('Error deleting category')
        }
      },
      'Delete Category'
    )
  }

  const handleCreateIncomeSource = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUserId || !newIncomeSourceName.trim() || !newIncomeSourceAmount) return

    try {
      const res = await fetch('/api/income-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          name: newIncomeSourceName.trim(),
          amount: parseFloat(newIncomeSourceAmount),
          type: newIncomeSourceType,
          isActive: true,
        }),
      })

      if (res.ok) {
        await fetchData()
        setNewIncomeSourceName('')
        setNewIncomeSourceAmount('')
        setNewIncomeSourceType('salary')
      } else {
        const error = await res.json()
        modal.showError(`Failed to create income source: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error creating income source:', error)
      modal.showError('Error creating income source')
    }
  }

  const handleCategoryColorChange = async (categoryId: string, newColor: string) => {
    try {
      const res = await fetch(`/api/expense-categories/${categoryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colorHex: newColor }),
      })

      if (res.ok) {
        await fetchData()
      } else {
        modal.showError('Failed to update category color')
      }
    } catch (error) {
      console.error('Error updating category color:', error)
      modal.showError('Error updating category color')
    }
  }

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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black dark:text-white">
            Categorization Rules
          </h1>
          <div className="flex gap-2 flex-wrap">
            {selectedRuleIds.size > 0 && (
              <button
                onClick={handleBulkDelete}
                className="border border-red-600 dark:border-red-500 px-4 py-2 text-sm sm:text-base text-red-600 dark:text-red-400 bg-white dark:bg-gray-800 hover:bg-red-600 dark:hover:bg-red-700 hover:text-white transition-colors"
              >
                Delete Selected ({selectedRuleIds.size})
              </button>
            )}
            <button
              onClick={() => setShowCategorySection(!showCategorySection)}
              className="border border-black dark:border-gray-700 px-4 py-2 text-sm sm:text-base text-black dark:text-white bg-white dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 hover:text-white transition-colors"
            >
              {showCategorySection ? 'Hide Categories' : 'Manage Categories'}
            </button>
            <button
              onClick={() => {
                if (showAddForm) {
                  handleCancelEdit()
                } else {
                  setShowAddForm(true)
                }
              }}
              className="border border-black dark:border-gray-700 px-4 py-2 text-sm sm:text-base text-black dark:text-white bg-white dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 hover:text-white transition-colors"
            >
              {showAddForm ? 'Cancel' : 'Add Rule'}
            </button>
          </div>
        </div>

        <div className="mb-6 p-4 border border-blue-600 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20">
            <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>How it works:</strong> When you categorize a transaction (e.g., &quot;Uber Eats&quot; → &quot;Food & Dining&quot;), 
            the app automatically creates a rule. Future transactions matching that merchant will be automatically categorized. 
            You can also create custom rules with exact matches, contains, or regex patterns.
          </p>
        </div>

        {showAddForm && (
          <form onSubmit={handleSubmit} className="mb-8 p-4 sm:p-6 border border-black dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-black dark:text-white">
                {editingRuleId ? 'Edit Rule' : 'Create New Rule'}
              </h2>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white"
              >
                Cancel
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="pattern" className="block text-sm font-medium text-black dark:text-white mb-1">
                  Pattern *
                </label>
                <input
                  type="text"
                  id="pattern"
                  value={formData.pattern}
                  onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                  className="w-full border border-black dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white p-2"
                  placeholder="e.g., UBER EATS or (?i)uber.*eats"
                  required
                />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Merchant name or regex pattern
                </p>
              </div>

              <div>
                <label htmlFor="matchType" className="block text-sm font-medium text-black dark:text-white mb-1">
                  Match Type *
                </label>
                <select
                  id="matchType"
                  value={formData.matchType}
                  onChange={(e) => setFormData({ ...formData, matchType: e.target.value as any })}
                  className="w-full border border-black dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white p-2"
                >
                  <option value="contains">Contains (e.g., &quot;UBER&quot; matches &quot;UBER EATS&quot;)</option>
                  <option value="exact">Exact Match</option>
                  <option value="regex">Regex Pattern</option>
                </select>
              </div>

              <div>
                <label htmlFor="appliesTo" className="block text-sm font-medium text-black dark:text-white mb-1">
                  Applies To *
                </label>
                <select
                  id="appliesTo"
                  value={formData.appliesTo}
                  onChange={(e) => setFormData({ ...formData, appliesTo: e.target.value, categoryId: '', incomeSourceId: '' })}
                  className="w-full border border-black dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white p-2"
                >
                  <option value="expense">Expenses</option>
                  <option value="income">Income</option>
                  <option value="both">Both</option>
                </select>
              </div>

              {formData.appliesTo !== 'income' && (
                <div>
                  <label htmlFor="categoryId" className="block text-sm font-medium text-black dark:text-white mb-1">
                    Expense Category {formData.appliesTo === 'expense' ? '*' : ''}
                  </label>
                  <select
                    id="categoryId"
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full border border-black dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white p-2"
                    required={formData.appliesTo === 'expense'}
                  >
                    <option value="">Select Category</option>
                    {expenseCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formData.appliesTo !== 'expense' && (
                <div>
                  <label htmlFor="incomeSourceId" className="block text-sm font-medium text-black dark:text-white mb-1">
                    Income Source {formData.appliesTo === 'income' ? '*' : ''}
                  </label>
                  <select
                    id="incomeSourceId"
                    value={formData.incomeSourceId}
                    onChange={(e) => setFormData({ ...formData, incomeSourceId: e.target.value })}
                    className="w-full border border-black dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white p-2"
                    required={formData.appliesTo === 'income'}
                  >
                    <option value="">Select Income Source</option>
                    {incomeSources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full sm:w-auto border border-black dark:border-gray-700 px-4 py-2 text-sm sm:text-base text-black dark:text-white bg-white dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 hover:text-white transition-colors"
            >
              {editingRuleId ? 'Update Rule' : 'Create Rule'}
            </button>
          </form>
        )}

        {/* Category Management Section */}
        {showCategorySection && (
          <div className="mb-8 p-4 sm:p-6 border border-black dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <h2 className="text-xl font-bold text-black dark:text-white mb-4">Manage Categories & Income Sources</h2>
            
            {/* Create New Income Source */}
            <div className="mb-6 p-4 border border-black dark:border-gray-700 bg-white dark:bg-gray-800">
              <h3 className="text-lg font-semibold text-black dark:text-white mb-3">Create New Income Source</h3>
              <form onSubmit={handleCreateIncomeSource} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label htmlFor="newIncomeSourceName" className="block text-sm font-medium text-black dark:text-white mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    id="newIncomeSourceName"
                    value={newIncomeSourceName}
                    onChange={(e) => setNewIncomeSourceName(e.target.value)}
                    className="w-full border border-black dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white p-2"
                    placeholder="e.g., Salary"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="newIncomeSourceAmount" className="block text-sm font-medium text-black dark:text-white mb-1">
                    Amount *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    id="newIncomeSourceAmount"
                    value={newIncomeSourceAmount}
                    onChange={(e) => setNewIncomeSourceAmount(e.target.value)}
                    className="w-full border border-black dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white p-2"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="newIncomeSourceType" className="block text-sm font-medium text-black dark:text-white mb-1">
                    Type *
                  </label>
                  <select
                    id="newIncomeSourceType"
                    value={newIncomeSourceType}
                    onChange={(e) => setNewIncomeSourceType(e.target.value as any)}
                    className="w-full border border-black dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white p-2"
                  >
                    <option value="salary">Salary</option>
                    <option value="bonus">Bonus</option>
                    <option value="freelance">Freelance</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full border border-black dark:border-gray-700 px-4 py-2 text-sm sm:text-base text-black dark:text-white bg-white dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 hover:text-white transition-colors"
                  >
                    Create Income Source
                  </button>
                </div>
              </form>
            </div>

            <h2 className="text-xl font-bold text-black dark:text-white mb-4">Manage Expense Categories</h2>
            
            {/* Create New Category */}
            <form onSubmit={handleCreateCategory} className="mb-6 p-4 border border-black dark:border-gray-700 bg-white dark:bg-gray-800">
              <h3 className="text-lg font-semibold text-black dark:text-white mb-3">Create New Category</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                  <label htmlFor="newCategoryName" className="block text-sm font-medium text-black dark:text-white mb-1">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    id="newCategoryName"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="w-full border border-black dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white p-2"
                    placeholder="e.g., Food & Dining"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="newCategoryType" className="block text-sm font-medium text-black dark:text-white mb-1">
                    Type *
                  </label>
                  <select
                    id="newCategoryType"
                    value={newCategoryType}
                    onChange={(e) => setNewCategoryType(e.target.value as 'fixed' | 'variable')}
                    className="w-full border border-black dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white p-2"
                  >
                    <option value="variable">Variable</option>
                    <option value="fixed">Fixed</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full border border-black dark:border-gray-700 px-4 py-2 text-sm sm:text-base text-black dark:text-white bg-white dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 hover:text-white transition-colors"
                  >
                    Create Category
                  </button>
                </div>
              </div>
            </form>

            {/* List All Categories */}
            <div>
              <h3 className="text-lg font-semibold text-black dark:text-white mb-3">All Categories</h3>
              {expenseCategories.length === 0 ? (
                <p className="text-black dark:text-white">No categories yet. Create one above.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {expenseCategories.map((category) => {
                    const categoryColor = category.colorHex || PASTEL_PALETTE[0]
                    const usedColors = expenseCategories
                      .filter((c) => c.id !== category.id && c.colorHex)
                      .map((c) => c.colorHex!)
                    
                    return (
                      <div
                        key={category.id}
                        className="p-3 border border-black dark:border-gray-700 bg-white dark:bg-gray-800"
                        style={{ backgroundColor: getLightTint(categoryColor, 0.1) }}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <CategoryColorPicker
                            color={category.colorHex}
                            onChange={(newColor) => handleCategoryColorChange(category.id, newColor)}
                            categoryName={category.name}
                            usedColors={usedColors}
                          />
                          <div className="flex-1">
                            <div className="font-medium text-black dark:text-white">{category.name}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 capitalize">{category.type}</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="text-xs text-gray-500 dark:text-gray-500">
                            Used in {rules.filter(r => r.category?.id === category.id).length} rule(s)
                          </div>
                          <button
                            onClick={() => handleDeleteCategory(category.id, category.name)}
                            className="text-xs text-red-600 dark:text-red-400 hover:underline"
                            title="Delete category"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Filter and Selection Controls */}
        {rules.length > 0 && (
          <div className="mb-4 p-4 border border-black dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="flex-1">
                <label htmlFor="filterCategory" className="block text-sm font-medium text-black dark:text-white mb-2">
                  Filter by Category
                </label>
                <select
                  id="filterCategory"
                  value={filterCategoryId}
                  onChange={(e) => {
                    setFilterCategoryId(e.target.value)
                    setSelectedRuleIds(new Set()) // Clear selection when filter changes
                  }}
                  className="w-full sm:w-auto border border-black dark:border-gray-700 px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-900"
                >
                  <option value="">All Categories</option>
                  {expenseCategories.map((cat) => {
                    const categoryRuleCount = rules.filter((r) => r.category?.id === cat.id).length
                    if (categoryRuleCount === 0) return null
                    return (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} ({categoryRuleCount})
                      </option>
                    )
                  })}
                </select>
              </div>
              <div className="flex gap-2 flex-wrap items-end">
                {filterCategoryId && (
                  <button
                    onClick={() => handleSelectByCategory(filterCategoryId)}
                    className="border border-blue-600 dark:border-blue-500 px-4 py-2 text-sm text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800 hover:bg-blue-600 dark:hover:bg-blue-700 hover:text-white transition-colors"
                  >
                    {rules.filter((r) => r.category?.id === filterCategoryId).every((r) => selectedRuleIds.has(r.id))
                      ? 'Deselect Category'
                      : 'Select Category'}
                  </button>
                )}
                {selectedRuleIds.size > 0 && (
                  <button
                    onClick={() => setSelectedRuleIds(new Set())}
                    className="border border-gray-600 dark:border-gray-500 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 hover:bg-gray-600 dark:hover:bg-gray-700 hover:text-white transition-colors"
                  >
                    Clear Selection
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {rules.length === 0 ? (
          <div className="border border-black dark:border-gray-700 p-8 text-center bg-white dark:bg-gray-800">
            <p className="text-black dark:text-white">
              No categorization rules yet. Rules are automatically created when you categorize transactions, 
              or you can create them manually above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-black dark:border-gray-700 bg-white dark:bg-gray-800">
            <table className="min-w-full border-collapse">
              <thead>
                  <tr className="border-b border-black dark:border-gray-700">
                  <th className="text-left p-3 text-sm font-medium text-black dark:text-white w-12">
                    <input
                      type="checkbox"
                      checked={(() => {
                        const filteredRules = filterCategoryId 
                          ? rules.filter((r) => r.category?.id === filterCategoryId)
                          : rules
                        return filteredRules.length > 0 && 
                          filteredRules.every((r) => selectedRuleIds.has(r.id))
                      })()}
                      onChange={handleSelectAll}
                      className="w-4 h-4 border border-black dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white cursor-pointer"
                      aria-label="Select all rules"
                    />
                  </th>
                  <th className="text-left p-3 text-sm font-medium text-black dark:text-white">Pattern</th>
                  <th className="text-left p-3 text-sm font-medium text-black dark:text-white">Match Type</th>
                  <th className="text-left p-3 text-sm font-medium text-black dark:text-white">Category/Source</th>
                  <th className="text-left p-3 text-sm font-medium text-black dark:text-white">Category Type</th>
                  <th className="text-left p-3 text-sm font-medium text-black dark:text-white">Color</th>
                  <th className="text-left p-3 text-sm font-medium text-black dark:text-white">Applies To</th>
                  <th className="text-left p-3 text-sm font-medium text-black dark:text-white">Created</th>
                  <th className="text-right p-3 text-sm font-medium text-black dark:text-white">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules
                  .filter((rule) => {
                    if (!filterCategoryId) return true
                    return rule.category?.id === filterCategoryId
                  })
                  .map((rule) => {
                  const categoryColor = rule.category?.colorHex || PASTEL_PALETTE[0]
                  const rowTint = getLightTint(categoryColor, 0.1)
                  const isSelected = selectedRuleIds.has(rule.id)
                  
                  return (
                    <tr 
                      key={rule.id} 
                      className={`border-b border-black dark:border-gray-700 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                      style={!isSelected ? { backgroundColor: rowTint } : undefined}
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(rule.id)}
                          className="w-4 h-4 border border-black dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white cursor-pointer"
                          aria-label={`Select rule ${rule.pattern}`}
                        />
                      </td>
                      <td className="p-3 text-sm text-black dark:text-white font-mono">{rule.pattern}</td>
                      <td className="p-3 text-sm text-black dark:text-white capitalize">{rule.matchType}</td>
                      <td className="p-3 text-sm text-black dark:text-white font-medium">
                        {rule.category?.name || rule.incomeSource?.name || 'N/A'}
                      </td>
                      <td className="p-3 text-sm text-black dark:text-white capitalize">
                        {rule.category?.type || rule.incomeSource?.type || '-'}
                      </td>
                      <td className="p-3">
                        {rule.category?.colorHex && rule.category?.id ? (
                          <CategoryColorPicker
                            color={rule.category.colorHex}
                            onChange={(newColor) => handleCategoryColorChange(rule.category!.id, newColor)}
                            categoryName={rule.category.name}
                            usedColors={expenseCategories
                              .filter((c) => c.id !== rule.category!.id && c.colorHex)
                              .map((c) => c.colorHex!)}
                          />
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-3 text-sm text-black dark:text-white capitalize">{rule.appliesTo}</td>
                      <td className="p-3 text-sm text-black dark:text-white">
                        {new Date(rule.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-sm text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleEdit(rule)}
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(rule.id)}
                            className="text-red-600 dark:text-red-400 hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

