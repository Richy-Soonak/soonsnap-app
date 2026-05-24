'use client'

import React from 'react'
import { Loader2 } from 'lucide-react'

interface LoadingSpinnerProps {
  /** Tailwind size class applied to the icon, e.g. 'h-8 w-8'. Defaults to 'h-6 w-6'. */
  size?: string
  /** Optional label rendered below the spinner. */
  label?: string
}

export function LoadingSpinner({
  size = 'h-6 w-6',
  label,
}: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <Loader2
        className={`${size} animate-spin text-teal`}
        aria-hidden="true"
      />
      {label && (
        <p className="text-sm font-medium text-gold">{label}</p>
      )}
    </div>
  )
}
