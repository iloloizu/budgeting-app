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
      <div className="min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-4 py-16">
          <p className="text-black">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Navigation selectedUserId={selectedUserId} />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-light text-black mb-8">
          LLM Budget Assistant
        </h1>

        <div className="mb-8">
          <p className="text-black mb-4">
            Ask questions about your budget, spending patterns, or get
            suggestions for saving money.
          </p>
          <p className="text-sm text-black mb-6">
            Example questions:
          </p>
          <ul className="list-disc list-inside text-sm text-black mb-6 space-y-1">
            <li>How can I save an extra $300 per month?</li>
            <li>Which categories could I cut back on?</li>
            <li>What if I reduce my subscriptions by 20%?</li>
            <li>What are my biggest expense categories?</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="mb-8">
          <div className="mb-4">
            <label className="block text-sm font-medium text-black mb-2">
              Your Question
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full border border-black px-4 py-3 text-black bg-white min-h-32"
              placeholder="Ask a question about your budget..."
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="border border-black px-6 py-2 text-black hover:bg-black hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Asking...' : 'Ask Assistant'}
          </button>
        </form>

        {response && (
          <div className="border border-black p-6">
            <h2 className="text-xl font-light text-black mb-4">Response</h2>
            <div className="text-black whitespace-pre-wrap mb-4">
              {response}
            </div>
            {disclaimer && (
              <div className="text-sm text-black border-t border-black pt-4 mt-4">
                {disclaimer}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

