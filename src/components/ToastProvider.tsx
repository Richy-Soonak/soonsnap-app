'use client'

import React, { useCallback, useState } from 'react'
import {
  Toast,
  ToastContext,
  ToastRenderer,
  ToastType,
} from './Toast'

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setToasts((prev) => [...prev, { id, message, type }])
    },
    [],
  )

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <ToastRenderer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  )
}
