import { useState, useCallback } from 'react'

interface ModalOptions {
  title?: string
  message: string
  type?: 'info' | 'success' | 'error' | 'warning'
  confirmText?: string
  cancelText?: string
  onConfirm?: () => void
  showCancel?: boolean
}

export function useModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [modalOptions, setModalOptions] = useState<ModalOptions>({
    message: '',
  })

  const showModal = useCallback((options: ModalOptions) => {
    setModalOptions(options)
    setIsOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setIsOpen(false)
  }, [])

  // Convenience methods
  const showAlert = useCallback((message: string, title?: string) => {
    showModal({ message, title, type: 'info' })
  }, [showModal])

  const showSuccess = useCallback((message: string, title?: string) => {
    showModal({ message, title, type: 'success' })
  }, [showModal])

  const showError = useCallback((message: string, title?: string) => {
    showModal({ message, title, type: 'error' })
  }, [showModal])

  const showWarning = useCallback((message: string, title?: string) => {
    showModal({ message, title, type: 'warning' })
  }, [showModal])

  const showConfirm = useCallback((
    message: string,
    onConfirm: () => void,
    title?: string
  ) => {
    showModal({
      message,
      title,
      type: 'warning',
      showCancel: true,
      onConfirm,
    })
  }, [showModal])

  return {
    isOpen,
    modalOptions,
    showModal,
    closeModal,
    showAlert,
    showSuccess,
    showError,
    showWarning,
    showConfirm,
  }
}

