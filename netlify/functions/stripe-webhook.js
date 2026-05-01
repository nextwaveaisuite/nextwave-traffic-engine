// netlify/functions/stripe-webhook.js
// Handles Stripe webhook events
// Activates user plans after successful payment
// Requires: STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY

import { supabase } from './_supabase.js'

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const signature     = event.headers['stripe-signature']
  const rawBody       = event.body

  // Verify webhook signature
  if (webhookSecret) {
    try {
      const isValid = await verifyStripeSignature(rawBody, signature, webhookSecret)
      if (!isValid) {
        console.error('Invalid Stripe webhook signature')
        return { statusCode: 400, body: 'Invalid signature' }
      }
    } catch (err) {
      console.error('Signature verification error:', err)
      return { statusCode: 400, body: 'Signature error' }
    }
  }

  let stripeEvent
  try {
    stripeEvent = JSON.parse(rawBody)
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' }
  }

  const eventType = stripeEvent.type
  const data      = stripeEvent.data?.object

  console.log('Stripe webhook received:', eventType)

  try {
    switch (eventType) {

      // ── SUBSCRIPTION CREATED / UPDATED ──────────────────
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const customerId = data.customer
        const status     = data.status // active, past_due, cancelled
        const priceId    = data.items?.data?.[0]?.price?.id
        const plan       = getPlanFromPriceId(priceId)

        if (status === 'active' && plan) {
          const email = await getEmailFromCustomer(customerId)
          if (email) {
            await activateUserPlan(email, plan, customerId, data.id)
            console.log(`Plan activated: ${email} → ${plan}`)
          }
        }
        break
      }

      // ── ONE-TIME PAYMENT (LIFETIME) ──────────────────────
      case 'checkout.session.completed': {
        const email  = data.customer_email || data.customer_details?.email
        const plan   = data.metadata?.plan
        const mode   = data.mode

        if (mode === 'payment' && email && plan) {
          // One-time purchase (lifetime)
          await activateUserPlan(email, plan, data.customer, null)
          console.log(`Lifetime activated: ${email}`)
        }

        // Track affiliate referral if present
        const refCode = data.metadata?.ref
        if (refCode && email) {
          await trackAffiliateConversion(refCode, email, data.amount_total / 100, plan)
        }
        break
      }

      // ── SUBSCRIPTION CANCELLED ───────────────────────────
      case 'customer.subscription.deleted': {
        const customerId = data.customer
        const email      = await getEmailFromCustomer(customerId)
        if (email) {
          await supabase
            .from('users')
            .update({ plan: 'free', plan_status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('email', email)
          console.log(`Plan cancelled: ${email}`)
        }
        break
      }

      // ── PAYMENT FAILED ───────────────────────────────────
      case 'invoice.payment_failed': {
        const customerId = data.customer
        const email      = await getEmailFromCustomer(customerId)
        if (email) {
          await supabase
            .from('users')
            .update({ plan_status: 'past_due', updated_at: new Date().toISOString() })
            .eq('email', email)
          console.log(`Payment failed: ${email}`)
        }
        break
      }
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) }

  } catch (err) {
    console.error('Webhook handler error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}

// ── HELPERS ────────────────────────────────────────────────

async function activateUserPlan(email, plan, stripeCustomerId, subscriptionId) {
  const now = new Date().toISOString()

  // Upsert user record
  const { error } = await supabase
    .from('users')
    .upsert([{
      email,
      plan,
      plan_status:         'active',
      stripe_customer_id:  stripeCustomerId  || null,
      stripe_sub_id:       subscriptionId    || null,
      plan_activated_at:   now,
      updated_at:          now
    }], { onConflict: 'email' })

  if (error) console.error('activateUserPlan error:', error)

  // Log revenue event
  const planRevenue = { starter: 19, pro: 49, scale: 99, lifetime: 997 }
  await supabase.from('conversions').insert([{
    email,
    funnel_name: 'stripe-' + plan,
    revenue:     planRevenue[plan] || 0,
    created_at:  now
  }])
}

async function getEmailFromCustomer(customerId) {
  if (!customerId) return null
  const stripeKey = process.env.STRIPE_SECRET_KEY
  try {
    const res  = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
      headers: { 'Authorization': `Bearer ${stripeKey}` }
    })
    const data = await res.json()
    return data.email || null
  } catch { return null }
}

function getPlanFromPriceId(priceId) {
  if (!priceId) return null
  const map = {
    [process.env.STRIPE_PRICE_STARTER]:  'starter',
    [process.env.STRIPE_PRICE_PRO]:      'pro',
    [process.env.STRIPE_PRICE_SCALE]:    'scale',
    [process.env.STRIPE_PRICE_LIFETIME]: 'lifetime'
  }
  return map[priceId] || null
}

async function trackAffiliateConversion(refCode, email, amount, plan) {
  try {
    // Find affiliate by ref code
    const { data: affiliate } = await supabase
      .from('affiliates')
      .select('id,email,commission_rate')
      .eq('ref_code', refCode)
      .maybeSingle()

    if (!affiliate) return

    const commissionRate = affiliate.commission_rate || 0.30
    const commission     = Math.round(amount * commissionRate * 100) / 100

    await supabase.from('affiliate_conversions').insert([{
      affiliate_id:  affiliate.id,
      referee_email: email,
      plan,
      sale_amount:   amount,
      commission,
      status:        'pending',
      created_at:    new Date().toISOString()
    }])

    console.log(`Affiliate conversion tracked: ${refCode} earns $${commission}`)
  } catch(e) { console.warn('Affiliate tracking error:', e.message) }
}

// Simple HMAC-SHA256 signature verification for Stripe webhooks
async function verifyStripeSignature(payload, signature, secret) {
  if (!signature) return false
  const parts     = signature.split(',')
  const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1]
  const sig       = parts.find(p => p.startsWith('v1='))?.split('=')[1]
  if (!timestamp || !sig) return false

  const signedPayload = `${timestamp}.${payload}`
  const key    = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload))
  const hex    = Array.from(new Uint8Array(signed)).map(b => b.toString(16).padStart(2,'0')).join('')
  return hex === sig
}
