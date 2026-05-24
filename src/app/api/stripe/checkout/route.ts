import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin, getAuthUser } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
})

const PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID!
const CREDITS_10_PRICE_ID = process.env.STRIPE_CREDITS_10_PRICE_ID!
const CREDITS_50_PRICE_ID = process.env.STRIPE_CREDITS_50_PRICE_ID!

// Map price IDs to credit amounts for one-time payments
const CREDIT_AMOUNTS: Record<string, number> = {
  [CREDITS_10_PRICE_ID]: 10,
  [CREDITS_50_PRICE_ID]: 50,
}

/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout session for Pro subscription or credit pack purchase.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { priceId } = body as { priceId?: string }

    if (!priceId) {
      return NextResponse.json(
        { error: 'priceId is required' },
        { status: 400 }
      )
    }

    // Validate price ID
    const validPriceIds = [PRO_PRICE_ID, CREDITS_10_PRICE_ID, CREDITS_50_PRICE_ID]
    if (!validPriceIds.includes(priceId)) {
      return NextResponse.json(
        { error: 'Invalid price ID' },
        { status: 400 }
      )
    }

    // Get or create Stripe customer
    let { data: customerRecord } = await supabaseAdmin
      .from('soonsnap_stripe_customers')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single()

    let customerId: string

    if (customerRecord?.stripe_customer_id) {
      customerId = customerRecord.stripe_customer_id
    } else {
      // Create Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          user_id: user.id,
        },
      })
      customerId = customer.id

      // Upsert customer record
      await supabaseAdmin
        .from('soonsnap_stripe_customers')
        .upsert(
          {
            user_id: user.id,
            stripe_customer_id: customerId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
    }

    // Determine checkout mode
    const isSubscription = priceId === PRO_PRICE_ID
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode: isSubscription ? 'subscription' : 'payment',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/credits?success=true`,
      cancel_url: `${origin}/credits?canceled=true`,
      metadata: {
        user_id: user.id,
      },
    }

    // Add credit amount to metadata for one-time payments
    if (!isSubscription && CREDIT_AMOUNTS[priceId]) {
      sessionParams.metadata!.credit_amount = String(CREDIT_AMOUNTS[priceId])
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
