'use client'

import { useEffect } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  message: string
  type?: 'info' | 'success' | 'error' | 'warning'
  confirmText?: string
  cancelText?: string
  onConfirm?: () => void
  showCancel?: boolean
}

export default function Modal({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  confirmText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  showCancel = false,
}: ModalProps) {
  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm()
    }
    onClose()
  }

  const typeStyles = {
    info: {
      border: 'border-blue-600 dark:border-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      text: 'text-blue-800 dark:text-blue-200',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    success: {
      border: 'border-green-600 dark:border-green-500',
      bg: 'bg-green-50 dark:bg-green-900/20',
      text: 'text-green-800 dark:text-green-200',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    error: {
      border: 'border-red-600 dark:border-red-500',
      bg: 'bg-red-50 dark:bg-red-900/20',
      text: 'text-red-800 dark:text-red-200',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    warning: {
      border: 'border-yellow-600 dark:border-yellow-500',
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      text: 'text-yellow-800 dark:text-yellow-200',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
  }

  const styles = typeStyles[type]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70"
      onClick={onClose}
    >
      <div
        className={`relative max-w-md w-full border-2 ${styles.border} ${styles.bg} p-6 rounded-lg shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-black dark:hover:text-white transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Icon and Title */}
        <div className="flex items-start gap-4 mb-4">
          <div className={`flex-shrink-0 ${styles.text}`}>
            {styles.icon}
          </div>
          <div className="flex-1">
            {title && (
              <h3 className={`text-lg font-bold mb-2 ${styles.text}`}>
                {title}
              </h3>
            )}
            <p className={`text-sm ${styles.text} whitespace-pre-wrap`}>
              {message}
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 justify-end mt-6">
          {showCancel && (
            <button
              onClick={onClose}
              className="border border-black dark:border-gray-700 px-4 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 hover:text-white transition-colors"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={handleConfirm}
            className={`border-2 ${styles.border} px-4 py-2 text-sm font-medium ${styles.text} bg-white dark:bg-gray-800 hover:opacity-80 transition-opacity`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

