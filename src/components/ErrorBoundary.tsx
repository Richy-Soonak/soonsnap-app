'use client'

import React from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  /** Optional fallback UI override */
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex min-h-[200px] items-center justify-center p-6">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-lg">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
              <AlertTriangle className="h-7 w-7 text-red-500" />
            </div>

            <h2 className="mb-2 text-lg font-semibold text-gold">
              Something went wrong
            </h2>

            <p className="mb-6 text-sm leading-relaxed text-[#F8F9FC]/60">
              An unexpected error occurred. Please try again.
            </p>

            {this.state.error && (
              <pre className="mb-6 max-h-32 overflow-auto rounded-lg bg-void p-3 text-left text-xs text-red-400">
                {this.state.error.message}
              </pre>
            )}

            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 rounded-xl bg-teal px-5 py-2.5 text-sm font-semibold text-void transition hover:brightness-110"
            >
              <RotateCcw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
