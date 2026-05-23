import { Wallet } from 'lucide-react'

export default function WalletPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Wallet</h1>
      <p className="text-[#999] text-sm mb-10">Connect your Solana wallet to unlock the Holder tier</p>
      <div className="rounded-2xl border border-dashed border-border p-12 text-center">
        <Wallet size={40} className="mx-auto text-[#444] mb-4" />
        <h3 className="text-lg font-medium mb-2">Coming in Stage 4</h3>
        <p className="text-[#999] text-sm">Solana wallet connect + $SOONAK balance verification</p>
      </div>
    </div>
  )
}
