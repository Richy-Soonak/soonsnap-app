import type { Metadata } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/ToastProvider'

export const metadata: Metadata = {
  title: 'SoonSnap — AI Website-to-Video',
  description: 'Turn any website into a polished, animated promo video.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-void antialiased">
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  )
}
