import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

/**
 * POST /api/stripe/webhook
 * Handles Stripe webhook events for subscriptions and credit purchases.
 */
export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.user_id

        if (!userId) {
          console.error('No user_id in session metadata')
          break
        }

        if (session.mode === 'subscription') {
          // Pro subscription activated
          const subscriptionId = session.subscription as string

          await supabaseAdmin
            .from('soonsnap_stripe_customers')
            .update({
              subscription_id: subscriptionId,
              subscription_status: 'active',
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId)

          // Update wallet tier to pro
          await supabaseAdmin
            .from('soonsnap_wallets')
            .update({
              tier: 'pro',
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId)
        } else if (session.mode === 'payment') {
          // Credit pack purchase
          const creditAmount = parseInt(session.metadata?.credit_amount || '0', 10)

          if (creditAmount > 0) {
            // Upsert credits: add to balance and total_purchased
            const { data: existing } = await supabaseAdmin
              .from('soonsnap_credits')
              .select('balance, total_purchased')
              .eq('user_id', userId)
              .single()

            if (existing) {
              await supabaseAdmin
                .from('soonsnap_credits')
                .update({
                  balance: existing.balance + creditAmount,
                  total_purchased: existing.total_purchased + creditAmount,
                  updated_at: new Date().toISOString(),
                })
                .eq('user_id', userId)
            } else {
              await supabaseAdmin
                .from('soonsnap_credits')
                .insert({
                  user_id: userId,
                  balance: creditAmount,
                  total_purchased: creditAmount,
                  total_used: 0,
                  updated_at: new Date().toISOString(),
                })
            }
          }
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        await supabaseAdmin
          .from('soonsnap_stripe_customers')
          .update({
            subscription_status: subscription.status,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId)

        // If subscription is no longer active, downgrade tier
        if (subscription.status !== 'active') {
          const { data: customerRecord } = await supabaseAdmin
            .from('soonsnap_stripe_customers')
            .select('user_id')
            .eq('stripe_customer_id', customerId)
            .single()

          if (customerRecord) {
            // Check if user has wallet with holder status
            const { data: wallet } = await supabaseAdmin
              .from('soonsnap_wallets')
              .select('wallet_address')
              .eq('user_id', customerRecord.user_id)
              .single()

            // Default to free; would need to re-check SOONAK balance for accurate holder tier
            const newTier = wallet ? 'free' : 'free'
            await supabaseAdmin
              .from('soonsnap_wallets')
              .update({
                tier: newTier,
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', customerRecord.user_id)
          }
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        await supabaseAdmin
          .from('soonsnap_stripe_customers')
          .update({
            subscription_status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId)

        // Downgrade tier back to free or holder
        const { data: customerRecord } = await supabaseAdmin
          .from('soonsnap_stripe_customers')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (customerRecord) {
          // Check wallet for holder eligibility
          const { data: wallet } = await supabaseAdmin
            .from('soonsnap_wallets')
            .select('wallet_address')
            .eq('user_id', customerRecord.user_id)
            .single()

          // Re-check SOONAK balance if wallet exists to determine correct tier
          let newTier: 'free' | 'holder' = 'free'
          if (wallet?.wallet_address) {
            try {
              const { checkSoonakBalance, determineTier } = await import('@/lib/solana')
              const balance = await checkSoonakBalance(wallet.wallet_address)
              newTier = determineTier(balance)
            } catch {
              newTier = 'free'
            }
          }

          await supabaseAdmin
            .from('soonsnap_wallets')
            .update({
              tier: newTier,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', customerRecord.user_id)
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }

  return NextResponse.json({ received: true })
}
