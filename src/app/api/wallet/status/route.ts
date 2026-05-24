import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getAuthUser } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/wallet/status
 * Returns the connected wallet info for the authenticated user.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch wallet info (may not exist)
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('soonsnap_wallets')
      .select('wallet_address, tier')
      .eq('user_id', user.id)
      .maybeSingle()

    if (walletError) {
      console.error('Wallet fetch error:', walletError)
      // Don't fail — just treat as no wallet
    }

    if (!wallet) {
      return NextResponse.json({
        connected: false,
        walletAddress: null,
        tier: 'free',
        soonakBalance: 0,
      })
    }

    // Fetch credits for balance display
    const { data: credits } = await supabaseAdmin
      .from('soonsnap_credits')
      .select('balance')
      .eq('user_id', user.id)
      .single()

    // Also check stripe subscription status for accurate tier
    const { data: stripeCustomer } = await supabaseAdmin
      .from('soonsnap_stripe_customers')
      .select('subscription_status')
      .eq('user_id', user.id)
      .single()

    // Determine effective tier: pro overrides holder/free
    let effectiveTier = wallet.tier || 'free'
    if (stripeCustomer?.subscription_status === 'active') {
      effectiveTier = 'pro'
    }

    return NextResponse.json({
      connected: true,
      walletAddress: wallet.wallet_address,
      tier: effectiveTier,
      soonakBalance: credits?.balance ?? 0,
    })
  } catch (error) {
    console.error('Wallet status error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
