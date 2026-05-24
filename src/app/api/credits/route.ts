import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getAuthUser } from '@/lib/supabase-admin'
import { getTierLimits } from '@/lib/tiers'
import { Tier } from '@/types'

export const dynamic = 'force-dynamic'

/**
 * GET /api/credits
 * Returns the user's credit balance, usage, and tier information.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get credits
    const { data: credits, error: creditsError } = await supabaseAdmin
      .from('soonsnap_credits')
      .select('balance, total_purchased, total_used')
      .eq('user_id', user.id)
      .single()

    if (creditsError && creditsError.code !== 'PGRST116') {
      console.error('Credits fetch error:', creditsError)
      return NextResponse.json(
        { error: 'Failed to fetch credits' },
        { status: 500 }
      )
    }

    // Get wallet / tier info
    const { data: wallet } = await supabaseAdmin
      .from('soonsnap_wallets')
      .select('tier')
      .eq('user_id', user.id)
      .single()

    // Check Stripe subscription for pro tier
    const { data: stripeCustomer } = await supabaseAdmin
      .from('soonsnap_stripe_customers')
      .select('subscription_status')
      .eq('user_id', user.id)
      .single()

    // Determine effective tier
    let tier: Tier = wallet?.tier || 'free'
    if (stripeCustomer?.subscription_status === 'active') {
      tier = 'pro'
    }

    // Count today's renders (projects created today)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { count: todayRenders } = await supabaseAdmin
      .from('soonsnap_projects')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', todayStart.toISOString())

    const tierLimits = getTierLimits(tier)

    return NextResponse.json({
      balance: credits?.balance ?? 0,
      totalPurchased: credits?.total_purchased ?? 0,
      totalUsed: credits?.total_used ?? 0,
      todayRenders: todayRenders ?? 0,
      dailyLimit: tierLimits.dailyRenders,
      tier,
    })
  } catch (error) {
    console.error('Credits status error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
