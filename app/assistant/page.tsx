'use client'

import { useEffect, useState } from 'react'
import Navigation from '@/components/Navigation'

export default function AssistantPage() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [disclaimer, setDisclaimer] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem('selectedUserId')
    if (stored) {
      setSelectedUserId(stored)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUserId || !question.trim()) return

    setLoading(true)
    setResponse('')
    setDisclaimer('')

    try {
      const res = await fetch('/api/llm-budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          userQuestion: question,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setResponse(data.response || 'No response received')
        setDisclaimer(data.disclaimer || '')
      } else {
        const errorMsg = data.message || data.error || 'Failed to get response'
        const details = data.details ? `\n\nDetails: ${data.details}` : ''
        const fullError = data.fullError ? `\n\nFull Error: ${data.fullError}` : ''
        setResponse(`Error: ${errorMsg}${details}${fullError}`)
        setDisclaimer(data.disclaimer || '')
      }
    } catch (error: any) {
      setResponse(`Error: ${error.message || 'Network error occurred'}`)
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
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-black dark:text-white mb-8">
          LLM Budget Assistant
        </h1>

        <div className="mb-8">
          <p className="text-black dark:text-white mb-4">
            Ask questions about your budget, spending patterns, or get
            suggestions for saving money.
          </p>
          <p className="text-sm text-black dark:text-gray-300 mb-6">
            Example questions:
          </p>
          <ul className="list-disc list-inside text-sm text-black dark:text-gray-300 mb-6 space-y-1">
            <li>How can I save an extra $300 per month?</li>
            <li>Which categories could I cut back on?</li>
            <li>What if I reduce my subscriptions by 20%?</li>
            <li>What are my biggest expense categories?</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="mb-8">
          <div className="mb-4">
            <label className="block text-sm font-medium text-black dark:text-white mb-2">
              Your Question
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full border border-black dark:border-gray-700 px-4 py-3 text-black dark:text-white bg-white dark:bg-gray-900 min-h-32"
              placeholder="Ask a question about your budget..."
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="border border-black dark:border-gray-700 px-6 py-2 text-black dark:text-white bg-white dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Asking...' : 'Ask Assistant'}
          </button>
        </form>

        {response && (
          <div className="border border-black dark:border-gray-700 p-6 bg-white dark:bg-gray-800">
            <h2 className="text-xl font-bold text-black dark:text-white mb-4">Response</h2>
            <div className="text-black dark:text-white whitespace-pre-wrap mb-4">
              {response}
            </div>
            {disclaimer && (
              <div className="text-sm text-black dark:text-gray-300 border-t border-black dark:border-gray-700 pt-4 mt-4">
                {disclaimer}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

