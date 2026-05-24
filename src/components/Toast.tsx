'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
}

export interface ToastContextValue {
  toasts: Toast[]
  showToast: (message: string, type?: ToastType) => void
  dismissToast: (id: string) => void
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a <ToastProvider>')
  return ctx
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

let counter = 0
function uid() {
  return `toast-${Date.now()}-${++counter}`
}

const AUTO_DISMISS_MS = 4000

const TYPE_CONFIG: Record<
  ToastType,
  { border: string; icon: React.ReactNode }
> = {
  success: {
    border: 'border-l-green-500',
    icon: <CheckCircle className="h-5 w-5 shrink-0 text-green-500" />,
  },
  error: {
    border: 'border-l-red-500',
    icon: <XCircle className="h-5 w-5 shrink-0 text-red-500" />,
  },
  info: {
    border: 'border-l-blue-500',
    icon: <Info className="h-5 w-5 shrink-0 text-blue-500" />,
  },
}

/* ------------------------------------------------------------------ */
/*  ToastItem                                                          */
/* ------------------------------------------------------------------ */

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast
  onDismiss: (id: string) => void
}) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  // Trigger slide‑in after mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // Auto‑dismiss
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setVisible(false)
      // Wait for exit animation before removing
      setTimeout(() => onDismiss(toast.id), 300)
    }, AUTO_DISMISS_MS)

    return () => clearTimeout(timerRef.current)
  }, [toast.id, onDismiss])

  const { border, icon } = TYPE_CONFIG[toast.type]

  return (
    <div
      className={[
        // Base card
        'flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg',
        // Colored left border
        'border-l-4',
        border,
        // Slide‑in / slide‑out
        'transition-all duration-300 ease-in-out',
        visible
          ? 'translate-x-0 opacity-100'
          : 'translate-x-[120%] opacity-0',
      ].join(' ')}
      role="alert"
    >
      {icon}
      <p className="flex-1 text-sm leading-snug text-[#F8F9FC]">
        {toast.message}
      </p>
      <button
        onClick={() => {
          clearTimeout(timerRef.current)
          setVisible(false)
          setTimeout(() => onDismiss(toast.id), 300)
        }}
        className="shrink-0 rounded-md p-0.5 text-[#F8F9FC]/40 transition hover:text-[#F8F9FC]/70"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  ToastRenderer                                                      */
/* ------------------------------------------------------------------ */

export function ToastRenderer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[9999] flex flex-col-reverse gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto w-80">
          <ToastItem toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  )
}
