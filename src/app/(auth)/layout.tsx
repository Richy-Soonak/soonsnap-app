export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen auth-bg">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-gradient-to-br from-void via-card to-void border-r border-border">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <rect x="0" y="12" width="24" height="24" rx="4" fill="#2A2B2D" />
              <rect x="3" y="6" width="24" height="24" rx="4" fill="#43C4CC" />
              <rect x="6" y="0" width="24" height="24" rx="4" fill="#FDCA57" />
              <text x="18" y="17" textAnchor="middle" fill="#0F0F1A" fontSize="14" fontWeight="700" fontFamily="sans-serif">S</text>
            </svg>
            <span className="text-2xl font-bold tracking-tight">SoonSnap</span>
          </div>
          <p className="text-[#555] text-sm mt-1">A SOONAK product</p>
        </div>

        <div>
          <h1 className="text-4xl font-bold leading-tight">
            Any Website.<br />
            Any Video.<br />
            <span className="text-gold">In Seconds.</span>
          </h1>
          <p className="text-[#999] mt-4 max-w-md">
            Paste a URL. Pick a style. Get a polished, animated promo video — powered by AI.
          </p>
        </div>

        <p className="text-xs text-[#444]">
          © 2026 SoonSnap. A SOONAK product.
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8">
        {children}
      </div>
    </div>
  )
}
