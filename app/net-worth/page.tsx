'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import Navigation from '@/components/Navigation'
import TellerConnect from '@/components/TellerConnect'
import { formatCurrency } from '@/lib/format'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

export default function NetWorthPage() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [snapshots, setSnapshots] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('selectedUserId')
    if (stored) {
      setSelectedUserId(stored)
    }
  }, [])

  const fetchData = useCallback(async () => {
    if (!selectedUserId) return

    setLoading(true)
    setError(null)
    try {
      const [snapshotsRes, accountsRes] = await Promise.all([
        fetch(`/api/net-worth/snapshot?userId=${selectedUserId}&limit=24`),
        fetch(`/api/teller/accounts?userId=${selectedUserId}`),
      ])

      if (snapshotsRes.ok) {
        const data = await snapshotsRes.json()
        setSnapshots(data.reverse()) // Reverse to show oldest first
      }

      if (accountsRes.ok) {
        const data = await accountsRes.json()
        setAccounts(data)
      } else {
        const errorData = await accountsRes.json().catch(() => ({}))
        if (accountsRes.status === 404) {
          setError(errorData.message || errorData.error || 'No accounts found. Please connect your bank accounts first.')
        } else if (accountsRes.status === 500) {
          setError(errorData.error || 'Failed to fetch accounts. Check server logs for details.')
        } else {
          setError(errorData.error || `Failed to fetch accounts (${accountsRes.status})`)
        }
      }
    } catch (error: any) {
      console.error('Error fetching net worth data:', error)
      setError('Failed to load net worth data')
    } finally {
      setLoading(false)
    }
  }, [selectedUserId])

  useEffect(() => {
    if (selectedUserId) {
      fetchData()
    }
  }, [selectedUserId, fetchData])

  const handleSync = async () => {
    if (!selectedUserId) return

    setSyncing(true)
    setError(null)
    try {
      const res = await fetch('/api/net-worth/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId }),
      })

      if (res.ok) {
        await fetchData()
      } else {
        let errorData
        try {
          errorData = await res.json()
        } catch (e) {
          errorData = { error: 'Failed to parse error response' }
        }
        const errorMessage = errorData.message 
          ? `${errorData.error || 'Failed to sync accounts'}: ${errorData.message}`
          : errorData.error || 'Failed to sync accounts'
        setError(errorMessage)
        console.error('Error syncing accounts:', errorData)
        if (errorData.details) {
          console.error('Error details:', errorData.details)
        }
      }
    } catch (error: any) {
      console.error('Error syncing accounts:', error)
      setError(`Failed to sync accounts: ${error.message || 'Unknown error'}`)
    } finally {
      setSyncing(false)
    }
  }

  // Memoize chart data
  const chartData = useMemo(() => {
    return snapshots.map((snapshot) => ({
      month: `${new Date(snapshot.year, snapshot.month - 1).toLocaleString('default', { month: 'short' })} ${snapshot.year}`,
      netWorth: snapshot.netWorth,
      assets: snapshot.totalAssets,
      liabilities: snapshot.totalLiabilities,
    }))
  }, [snapshots])

  // Get latest snapshot
  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null

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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 sm:mb-6 lg:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black dark:text-white">Net Worth</h1>
          <div className="flex flex-col sm:flex-row gap-2">
            <TellerConnect userId={selectedUserId} onEnrollmentSuccess={fetchData} />
            <button
              onClick={handleSync}
              disabled={syncing}
              className="w-full sm:w-auto border border-black dark:border-gray-700 px-4 py-2 text-sm sm:text-base text-black dark:text-white bg-white dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncing ? 'Syncing...' : 'Sync Accounts'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 sm:mb-6 p-4 border border-red-600 dark:border-red-500 bg-red-50 dark:bg-red-900/20">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Disclaimer */}
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 border border-yellow-600 dark:border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
          <p className="text-xs sm:text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Disclaimer:</strong> Net worth data is provided for informational purposes only. Account balances are synced from Teller and may not reflect real-time balances. This information should not be used as the sole basis for financial decisions. Please verify all account information with your financial institutions.
          </p>
        </div>

        {/* Summary Cards */}
        {latestSnapshot && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-6 lg:mb-8">
            <div className="border border-black dark:border-gray-700 p-4 sm:p-6 bg-white dark:bg-gray-800">
              <h3 className="text-xs sm:text-sm font-medium text-black dark:text-white mb-2">Total Assets</h3>
              <p className="text-2xl sm:text-3xl font-light text-green-600 dark:text-green-400">
                ${formatCurrency(latestSnapshot.totalAssets)}
              </p>
            </div>
            <div className="border border-black dark:border-gray-700 p-4 sm:p-6 bg-white dark:bg-gray-800">
              <h3 className="text-xs sm:text-sm font-medium text-black dark:text-white mb-2">Total Liabilities</h3>
              <p className="text-2xl sm:text-3xl font-light text-red-600 dark:text-red-400">
                ${formatCurrency(latestSnapshot.totalLiabilities)}
              </p>
            </div>
            <div className="border border-black dark:border-gray-700 p-4 sm:p-6 bg-white dark:bg-gray-800">
              <h3 className="text-xs sm:text-sm font-medium text-black dark:text-white mb-2">Net Worth</h3>
              <p className={`text-2xl sm:text-3xl font-light ${
                latestSnapshot.netWorth >= 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                ${formatCurrency(latestSnapshot.netWorth)}
              </p>
            </div>
          </div>
        )}

        {/* Net Worth Chart */}
        {chartData.length > 0 && (
          <div className="mb-4 sm:mb-6 lg:mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-black dark:text-white mb-4 sm:mb-6">
              Net Worth Over Time
            </h2>
            <div className="h-64 sm:h-80 lg:h-96 border border-black dark:border-gray-700 p-2 sm:p-4 bg-white dark:bg-gray-800">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                  <XAxis 
                    dataKey="month" 
                    stroke="#666"
                    tick={{ fill: '#666' }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
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
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="netWorth" 
                    stroke="#2563eb" 
                    strokeWidth={2}
                    name="Net Worth"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="assets" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    name="Assets"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="liabilities" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    name="Liabilities"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Account List */}
        {latestSnapshot && latestSnapshot.accountBalances.length > 0 && (
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-black dark:text-white mb-4 sm:mb-6">
              Account Breakdown
            </h2>
            
            {/* Assets */}
            <div className="mb-4 sm:mb-6">
              <h3 className="text-lg sm:text-xl font-bold text-black dark:text-white mb-3">Assets</h3>
              <div className="border border-black dark:border-gray-700 bg-white dark:bg-gray-800">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-black dark:border-gray-700">
                      <th className="text-left p-3 text-sm font-medium text-black dark:text-white">Account</th>
                      <th className="text-left p-3 text-sm font-medium text-black dark:text-white">Institution</th>
                      <th className="text-left p-3 text-sm font-medium text-black dark:text-white">Type</th>
                      <th className="text-right p-3 text-sm font-medium text-black dark:text-white">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestSnapshot.accountBalances
                      .filter((ab: any) => ab.isAsset)
                      .map((ab: any) => (
                        <tr key={ab.id} className="border-b border-black dark:border-gray-700">
                          <td className="p-3 text-sm text-black dark:text-white">{ab.accountName}</td>
                          <td className="p-3 text-sm text-black dark:text-white">{ab.institutionName}</td>
                          <td className="p-3 text-sm text-black dark:text-white capitalize">{ab.accountType}</td>
                          <td className="p-3 text-sm text-right text-green-600 dark:text-green-400">
                            ${formatCurrency(ab.balance)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Liabilities */}
            {latestSnapshot.accountBalances.some((ab: any) => !ab.isAsset) && (
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-black dark:text-white mb-3">Liabilities</h3>
                <div className="border border-black dark:border-gray-700 bg-white dark:bg-gray-800">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-black dark:border-gray-700">
                        <th className="text-left p-3 text-sm font-medium text-black dark:text-white">Account</th>
                        <th className="text-left p-3 text-sm font-medium text-black dark:text-white">Institution</th>
                        <th className="text-left p-3 text-sm font-medium text-black dark:text-white">Type</th>
                        <th className="text-right p-3 text-sm font-medium text-black dark:text-white">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {latestSnapshot.accountBalances
                        .filter((ab: any) => !ab.isAsset)
                        .map((ab: any) => (
                          <tr key={ab.id} className="border-b border-black dark:border-gray-700">
                            <td className="p-3 text-sm text-black dark:text-white">{ab.accountName}</td>
                            <td className="p-3 text-sm text-black dark:text-white">{ab.institutionName}</td>
                            <td className="p-3 text-sm text-black dark:text-white capitalize">{ab.accountType}</td>
                            <td className="p-3 text-sm text-right text-red-600 dark:text-red-400">
                              ${formatCurrency(Math.abs(ab.balance))}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {snapshots.length === 0 && !loading && (
          <div className="border border-black dark:border-gray-700 p-8 text-center bg-white dark:bg-gray-800">
            <p className="text-black dark:text-white mb-4">
              No net worth data yet. Click &quot;Sync Accounts&quot; to fetch your account balances from Teller.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

