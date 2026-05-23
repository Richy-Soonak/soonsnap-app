import { Settings } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Settings</h1>
      <p className="text-[#999] text-sm mb-10">Manage your account and preferences</p>
      <div className="rounded-2xl border border-dashed border-border p-12 text-center">
        <Settings size={40} className="mx-auto text-[#444] mb-4" />
        <h3 className="text-lg font-medium mb-2">Coming in Stage 5</h3>
        <p className="text-[#999] text-sm">Profile, connected wallet, tier info, and preferences</p>
      </div>
    </div>
  )
}
