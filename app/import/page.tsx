'use client'

import { useEffect, useState } from 'react'
import Navigation from '@/components/Navigation'
import { formatCurrency } from '@/lib/format'

interface PreviewTransaction {
  date: string
  amount: number
  type: 'income' | 'expense'
  description: string
  merchantName?: string
  categoryId?: string
  incomeSourceId?: string
  fingerprint: string
  ruleUsed?: string
  isDuplicate: boolean
}

export default function ImportPage() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'upload' | 'preview' | 'complete'>('upload')
  const [expenseCategories, setExpenseCategories] = useState<any[]>([])
  const [incomeSources, setIncomeSources] = useState<any[]>([])
  const [editingCategory, setEditingCategory] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('selectedUserId')
    if (stored) {
      setSelectedUserId(stored)
      fetchCategories(stored)
    }
  }, [])

  const fetchCategories = async (userId: string) => {
    try {
      const [categoriesRes, incomeRes] = await Promise.all([
        fetch(`/api/expense-categories?userId=${userId}`),
        fetch(`/api/income-sources?userId=${userId}`),
      ])

      if (categoriesRes.ok) {
        const categories = await categoriesRes.json()
        setExpenseCategories(categories)
      }

      if (incomeRes.ok) {
        const income = await incomeRes.json()
        setIncomeSources(income)
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const handleFileUpload = async () => {
    if (!file || !selectedUserId) return

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('userId', selectedUserId)
      formData.append('targetYear', year.toString())
      formData.append('targetMonth', month.toString())
      formData.append('action', 'preview')

      const res = await fetch('/api/import/csv', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (res.ok) {
        setPreview(data.preview)
        setStep('preview')
        setError(null)
      } else {
        const errorMsg = data.error || data.message || 'Failed to parse CSV'
        const errorDetails = JSON.stringify(data, null, 2)
        setError(`Error: ${errorMsg}\n\nDetails:\n${errorDetails}`)
        console.error('Import error:', data)
      }
    } catch (error: any) {
      console.error('Error uploading file:', error)
      setError(`Failed to upload file: ${error.message || 'Unknown error'}\n\nStack: ${error.stack || 'No stack trace'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCategoryChange = (
    fingerprint: string,
    categoryId: string,
    type: 'expense' | 'income'
  ) => {
    setEditingCategory({
      ...editingCategory,
      [fingerprint]: categoryId,
    })

    // Update preview
    if (preview?.transactions) {
      const updated = preview.transactions.map((t: PreviewTransaction) => {
        if (t.fingerprint === fingerprint) {
          if (type === 'expense') {
            return { ...t, categoryId, incomeSourceId: undefined }
          } else {
            return { ...t, incomeSourceId: categoryId, categoryId: undefined }
          }
        }
        return t
      })
      setPreview({ ...preview, transactions: updated })
    }
  }

  const handleImport = async () => {
    if (!selectedUserId || !preview) return

    setLoading(true)
    try {
      // Prepare transactions with user edits
      const transactionsToImport = preview.transactions.map((t: PreviewTransaction) => {
        const editedCategory = editingCategory[t.fingerprint]
        return {
          ...t,
          categoryId: editedCategory && t.type === 'expense' ? editedCategory : t.categoryId,
          incomeSourceId: editedCategory && t.type === 'income' ? editedCategory : t.incomeSourceId,
        }
      })

      const formData = new FormData()
      formData.append('userId', selectedUserId)
      formData.append('targetYear', year.toString())
      formData.append('targetMonth', month.toString())
      formData.append('transactions', JSON.stringify(transactionsToImport))
      formData.append('action', 'import')

      const res = await fetch('/api/import/csv', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        setStep('complete')
        setPreview({
          ...preview,
          imported: data.imported || 0,
          skipped: data.skipped || 0,
        })
        setError(null)
      } else {
        const errorData = await res.json()
        const errorMsg = errorData.error || 'Failed to import transactions'
        const errorDetails = JSON.stringify(errorData, null, 2)
        setError(`Error: ${errorMsg}\n\nDetails:\n${errorDetails}`)
      }
    } catch (error: any) {
      console.error('Error importing:', error)
      setError(`Failed to import transactions: ${error.message || 'Unknown error'}\n\nStack: ${error.stack || 'No stack trace'}`)
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
      <div className="min-h-screen bg-white dark:bg-gray-900">
        <div className="max-w-2xl mx-auto px-4 py-16">
          <p className="text-black dark:text-white">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Navigation selectedUserId={selectedUserId} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black dark:text-white mb-4 sm:mb-6 lg:mb-8">Import Transactions (CSV)</h1>
        
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 border border-black dark:border-gray-700 bg-white dark:bg-gray-800">
          <p className="text-xs sm:text-sm text-black dark:text-gray-300">
            Upload a CSV file exported from Rocket Money to import your transactions. 
            The app will automatically categorize transactions and help you track your spending.
          </p>
        </div>

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

        {step === 'upload' && (
          <div className="space-y-6">
            <div className="border border-black dark:border-gray-700 p-6 bg-white dark:bg-gray-800">
              <h2 className="text-2xl font-bold text-black dark:text-white mb-4">Step 1: Upload CSV File</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-black dark:text-white mb-2">
                    Select CSV File
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="w-full border border-black dark:border-gray-700 px-3 py-2 text-black dark:text-white bg-white dark:bg-gray-900"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-black dark:text-white mb-1">Year</label>
                    <input
                      type="number"
                      value={year}
                      onChange={(e) => setYear(parseInt(e.target.value))}
                      className="w-full border border-black dark:border-gray-700 px-3 py-2 text-black dark:text-white bg-white dark:bg-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-black dark:text-white mb-1">Month</label>
                    <select
                      value={month}
                      onChange={(e) => setMonth(parseInt(e.target.value))}
                      className="w-full border border-black dark:border-gray-700 px-3 py-2 text-black dark:text-white bg-white dark:bg-gray-900"
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

                <button
                  onClick={handleFileUpload}
                  disabled={!file || loading}
                  className="border border-black dark:border-gray-700 px-6 py-2 text-black dark:text-white bg-white dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Processing...' : 'Preview Transactions'}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'preview' && preview && (
          <div className="space-y-6">
            <div className="border border-black dark:border-gray-700 p-6 bg-white dark:bg-gray-800">
              <h2 className="text-2xl font-bold text-black dark:text-white mb-4">
                Step 2: Review & Edit Categories
              </h2>

              <div className="mb-4 text-sm text-black dark:text-gray-300">
                <p>
                  Total rows in {new Date(year, month - 1).toLocaleString('default', {
                    month: 'long',
                  })}{' '}
                  {year}: {preview.totalRows}
                </p>
                <p>To import: {preview.toImport}</p>
                <p className="text-red-600 dark:text-red-400">Duplicates (will be skipped): {preview.duplicates}</p>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {preview.transactions.map((t: PreviewTransaction) => (
                  <div
                    key={t.fingerprint}
                    className={`border border-black dark:border-gray-700 p-4 bg-white dark:bg-gray-800 ${
                      t.isDuplicate ? 'bg-gray-100 dark:bg-gray-700' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="text-base font-medium text-black dark:text-white">
                          {t.merchantName || t.description}
                        </div>
                        <div className="text-xs text-black dark:text-gray-400 mt-1">
                          {new Date(t.date).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right ml-2">
                        <div className="text-lg font-semibold text-black dark:text-white">
                          ${formatCurrency(t.amount)}
                        </div>
                        <div className="text-xs text-black dark:text-gray-400 capitalize">
                          {t.type}
                        </div>
                      </div>
                    </div>
                    {t.isDuplicate ? (
                      <div className="mt-3">
                        <span className="text-sm text-red-600 dark:text-red-400 font-medium">Duplicate - Will be skipped</span>
                      </div>
                    ) : (
                      <>
                        <div className="mt-3">
                          <label className="block text-xs text-black dark:text-gray-400 mb-1">
                            Category
                          </label>
                          {t.type === 'expense' ? (
                            <select
                              value={
                                editingCategory[t.fingerprint] ||
                                t.categoryId ||
                                ''
                              }
                              onChange={(e) =>
                                handleCategoryChange(t.fingerprint, e.target.value, 'expense')
                              }
                              className="w-full border border-black dark:border-gray-700 px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-900"
                            >
                              <option value="">Select category</option>
                              {expenseCategories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <select
                              value={
                                editingCategory[t.fingerprint] ||
                                t.incomeSourceId ||
                                ''
                              }
                              onChange={(e) =>
                                handleCategoryChange(t.fingerprint, e.target.value, 'income')
                              }
                              className="w-full border border-black dark:border-gray-700 px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-900"
                            >
                              <option value="">Select source</option>
                              {incomeSources.map((source) => (
                                <option key={source.id} value={source.id}>
                                  {source.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        {t.ruleUsed && (
                          <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                            Auto-categorized: {t.ruleUsed}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block border border-black dark:border-gray-700 bg-white dark:bg-gray-800">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-black dark:border-gray-700">
                      <th className="text-left p-3 text-sm font-medium text-black dark:text-white">Date</th>
                      <th className="text-left p-3 text-sm font-medium text-black dark:text-white">Merchant</th>
                      <th className="text-right p-3 text-sm font-medium text-black dark:text-white">Amount</th>
                      <th className="text-left p-3 text-sm font-medium text-black dark:text-white">Type</th>
                      <th className="text-left p-3 text-sm font-medium text-black dark:text-white">Category</th>
                      <th className="text-left p-3 text-sm font-medium text-black dark:text-white">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.transactions.map((t: PreviewTransaction) => (
                      <tr
                        key={t.fingerprint}
                        className={`border-b border-black dark:border-gray-700 ${
                          t.isDuplicate ? 'bg-gray-100 dark:bg-gray-700' : ''
                        }`}
                      >
                        <td className="p-3 text-sm text-black dark:text-white">
                          {new Date(t.date).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-sm text-black dark:text-white">{t.merchantName || t.description}</td>
                        <td className="p-3 text-sm text-right text-black dark:text-white">
                          ${formatCurrency(t.amount)}
                        </td>
                        <td className="p-3 text-sm text-black dark:text-white capitalize">{t.type}</td>
                        <td className="p-3">
                          {t.isDuplicate ? (
                            <span className="text-sm text-red-600 dark:text-red-400">Duplicate</span>
                          ) : t.type === 'expense' ? (
                            <select
                              value={
                                editingCategory[t.fingerprint] ||
                                t.categoryId ||
                                ''
                              }
                              onChange={(e) =>
                                handleCategoryChange(t.fingerprint, e.target.value, 'expense')
                              }
                              className="w-full border border-black dark:border-gray-700 px-2 py-1 text-sm text-black dark:text-white bg-white dark:bg-gray-900"
                            >
                              <option value="">Select category</option>
                              {expenseCategories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <select
                              value={
                                editingCategory[t.fingerprint] ||
                                t.incomeSourceId ||
                                ''
                              }
                              onChange={(e) =>
                                handleCategoryChange(t.fingerprint, e.target.value, 'income')
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
                          )}
                        </td>
                        <td className="p-3 text-sm text-black dark:text-white">
                          {t.ruleUsed && (
                            <span className="text-gray-600 dark:text-gray-400">Auto: {t.ruleUsed}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex gap-4">
                <button
                  onClick={() => setStep('upload')}
                  className="border border-black dark:border-gray-700 px-6 py-2 text-black dark:text-white bg-white dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 hover:text-white transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={loading}
                  className="border border-black dark:border-gray-700 px-6 py-2 text-black dark:text-white bg-white dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Importing...' : 'Import Transactions'}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'complete' && preview && (
          <div className="border border-black dark:border-gray-700 p-6 bg-white dark:bg-gray-800">
            <h2 className="text-2xl font-bold text-black dark:text-white mb-4">Import Complete!</h2>
            <div className="space-y-2 text-black dark:text-white">
              <p>Imported: {preview.imported || 0} transactions</p>
              <p>Skipped duplicates: {preview.skipped || 0}</p>
            </div>
            <button
              onClick={() => {
                setStep('upload')
                setFile(null)
                setPreview(null)
                setEditingCategory({})
              }}
              className="mt-6 border border-black px-6 py-2 text-black hover:bg-black hover:text-white transition-colors"
            >
              Import Another File
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

