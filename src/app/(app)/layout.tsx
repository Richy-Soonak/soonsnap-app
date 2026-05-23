'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  LayoutDashboard,
  Film,
  CreditCard,
  Wallet,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react'

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'My Videos', href: '/videos', icon: Film },
  { label: 'Credits', href: '/credits', icon: CreditCard },
  { label: 'Wallet', href: '/wallet', icon: Wallet },
  { label: 'Settings', href: '/settings', icon: Settings },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [userEmail, setUserEmail] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [tier] = useState('free')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/login')
        return
      }
      setUserEmail(data.user.email ?? '')
    })
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const tierLabel = tier === 'holder' ? 'SOONAK Holder' : tier === 'pro' ? 'Pro' : 'Free'
  const tierColor = tier === 'holder' ? 'text-gold' : tier === 'pro' ? 'text-teal' : 'text-[#999]'

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <Link href="/dashboard" className="flex items-center gap-2.5" onClick={() => setSidebarOpen(false)}>
            <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
              <rect x="0" y="12" width="24" height="24" rx="4" fill="#2A2B2D" />
              <rect x="3" y="6" width="24" height="24" rx="4" fill="#43C4CC" />
              <rect x="6" y="0" width="24" height="24" rx="4" fill="#FDCA57" />
              <text x="18" y="17" textAnchor="middle" fill="#0F0F1A" fontSize="14" fontWeight="700" fontFamily="sans-serif">S</text>
            </svg>
            <span className="text-lg font-bold">SoonSnap</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-[#999]">
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-gold/10 text-gold'
                    : 'text-[#999] hover:bg-white/5 hover:text-[#F8F9FC]'
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User section */}
        <div className="border-t border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#999] truncate max-w-[140px]">{userEmail}</span>
            <span className={`text-xs font-medium ${tierColor}`}>{tierLabel}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-[#666] hover:text-red-400 transition-colors w-full"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {/* Top bar (mobile) */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="text-[#999]">
            <Menu size={22} />
          </button>
          <span className="font-bold">SoonSnap</span>
          <div className="w-6" />
        </div>

        <div className="p-6 lg:p-10">
          {children}
        </div>
      </main>
    </div>
  )
}
