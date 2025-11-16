'use client'

import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    TellerConnect: {
      setup: (config: TellerConnectConfig) => TellerConnectInstance
    }
  }
}

interface TellerConnectConfig {
  applicationId: string
  environment?: 'sandbox' | 'development' | 'production'
  products: string[]
  onSuccess: (enrollment: TellerEnrollment) => void
  onInit?: () => void
  onExit?: () => void
  onFailure?: (failure: TellerFailure) => void
  nonce?: string
}

interface TellerConnectInstance {
  open: () => void
}

interface TellerEnrollment {
  accessToken: string
  user: {
    id: string
  }
  enrollment: {
    id: string
    institution: {
      name: string
    }
  }
  signatures?: string[]
}

interface TellerFailure {
  type: string
  code: string
  message: string
}

interface TellerConnectProps {
  userId: string
  onEnrollmentSuccess: () => void
}

export default function TellerConnect({ userId, onEnrollmentSuccess }: TellerConnectProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tellerConnectRef = useRef<TellerConnectInstance | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const nonceRef = useRef<string | null>(null)

  useEffect(() => {
    // Load Teller Connect script
    const script = document.createElement('script')
    script.src = 'https://cdn.teller.io/connect/connect.js'
    script.async = false
    script.defer = false

    script.onload = () => {
      const applicationId = process.env.NEXT_PUBLIC_TELLER_APPLICATION_ID
      if (!applicationId) {
        setError('Teller Application ID not configured. Please set NEXT_PUBLIC_TELLER_APPLICATION_ID in your environment variables.')
        return
      }

      // Validate application ID format
      if (!applicationId.startsWith('app_')) {
        setError('Invalid Application ID format. It should start with "app_". Please check your NEXT_PUBLIC_TELLER_APPLICATION_ID in .env')
        return
      }

      try {
        const environment = (process.env.NEXT_PUBLIC_TELLER_ENVIRONMENT as 'sandbox' | 'development' | 'production') || 'sandbox'
        
        // Generate a nonce for signature verification
        const nonce = crypto.randomUUID()
        nonceRef.current = nonce
        
        const tellerConnect = window.TellerConnect.setup({
          applicationId,
          environment,
          products: ['balance', 'transactions', 'identity'],
          nonce,
          onInit: () => {
            setIsInitialized(true)
          },
          onSuccess: async (enrollment: TellerEnrollment) => {
            setIsLoading(true)
            setError(null)

            try {
              // Store enrollment on server with signatures for verification
              const res = await fetch('/api/teller/enrollments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId,
                  enrollmentId: enrollment.enrollment.id,
                  accessToken: enrollment.accessToken,
                  institutionId: enrollment.enrollment.institution.name,
                  institutionName: enrollment.enrollment.institution.name,
                  status: 'active',
                  nonce: nonceRef.current,
                  signatures: enrollment.signatures || [],
                }),
              })

              if (res.ok) {
                onEnrollmentSuccess()
              } else {
                const errorData = await res.json()
                setError(errorData.error || 'Failed to store enrollment')
              }
            } catch (err: any) {
              console.error('Error storing enrollment:', err)
              setError('Failed to store enrollment')
            } finally {
              setIsLoading(false)
            }
          },
          onExit: () => {
            setIsLoading(false)
          },
          onFailure: (failure: TellerFailure) => {
            let errorMsg = `Teller Connect failed: ${failure.message}`
            if (failure.message.includes('application with that id does not exist')) {
              errorMsg = `Application ID not found. Please verify your NEXT_PUBLIC_TELLER_APPLICATION_ID in .env matches your Teller Dashboard. Current value: ${applicationId.substring(0, 10)}...`
            }
            setError(errorMsg)
            setIsLoading(false)
          },
        })

        tellerConnectRef.current = tellerConnect
      } catch (err: any) {
        console.error('Error initializing Teller Connect:', err)
        setError('Failed to initialize Teller Connect')
      }
    }

    script.onerror = () => {
      setError('Failed to load Teller Connect script')
    }

    document.body.appendChild(script)

    return () => {
      // Cleanup script on unmount
      if (document.body.contains(script)) {
        document.body.removeChild(script)
      }
    }
  }, [userId, onEnrollmentSuccess])

  const handleConnect = () => {
    if (tellerConnectRef.current && isInitialized) {
      setIsLoading(true)
      setError(null)
      tellerConnectRef.current.open()
    } else {
      setError('Teller Connect is not ready yet. Please wait a moment and try again.')
    }
  }

  return (
    <div>
      <button
        onClick={handleConnect}
        disabled={isLoading || !isInitialized}
        className="w-full sm:w-auto border border-black dark:border-gray-700 px-4 py-2 text-sm sm:text-base text-black dark:text-white bg-white dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Connecting...' : 'Connect Bank Account'}
      </button>
      {error && (
        <div className="mt-2 p-2 border border-red-600 dark:border-red-500 bg-red-50 dark:bg-red-900/20">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
    </div>
  )
}

