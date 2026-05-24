import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getAuthUser } from '@/lib/supabase-admin'
import { checkSoonakBalance, determineTier } from '@/lib/solana'

export const dynamic = 'force-dynamic'

/**
 * POST /api/wallet/connect
 * Connects a Solana wallet, checks $SOONAK balance, and upserts the wallet record.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { walletAddress } = body as { walletAddress?: string }

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'walletAddress is required' },
        { status: 400 }
      )
    }

    // Validate wallet address format (basic check)
    if (walletAddress.length < 32 || walletAddress.length > 44) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      )
    }

    // Check $SOONAK token balance
    const balance = await checkSoonakBalance(walletAddress)
    const tier = determineTier(balance)

    // Upsert wallet record
    const { error: upsertError } = await supabaseAdmin
      .from('soonsnap_wallets')
      .upsert(
        {
          user_id: user.id,
          wallet_address: walletAddress,
          tier,
          verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (upsertError) {
      console.error('Wallet upsert error:', upsertError)
      return NextResponse.json(
        { error: 'Failed to save wallet' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      walletAddress,
      tier,
      balance,
    })
  } catch (error) {
    console.error('Wallet connect error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
