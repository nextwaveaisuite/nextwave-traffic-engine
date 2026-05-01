// netlify/functions/create-checkout.js
// Creates a Stripe Checkout session for plan purchases
// Requires: STRIPE_SECRET_KEY in Netlify environment variables

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const { plan, email, name } = JSON.parse(event.body || '{}')
    const stripeKey = process.env.STRIPE_SECRET_KEY

    if (!stripeKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured in Netlify environment variables' })
      }
    }

    const siteUrl = process.env.SITE_URL || 'https://nextwave-traffic-engine.netlify.app'

    // Price configuration — replace these with your actual Stripe Price IDs
    // Create these in Stripe Dashboard → Products → Add Product
    const prices = {
      starter:  process.env.STRIPE_PRICE_STARTER  || 'price_starter_placeholder',
      pro:      process.env.STRIPE_PRICE_PRO       || 'price_pro_placeholder',
      scale:    process.env.STRIPE_PRICE_SCALE     || 'price_scale_placeholder',
      lifetime: process.env.STRIPE_PRICE_LIFETIME  || 'price_lifetime_placeholder'
    }

    const priceId = prices[plan]
    if (!priceId || priceId.includes('placeholder')) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: `Price ID for "${plan}" not configured. Add STRIPE_PRICE_${plan.toUpperCase()} to Netlify environment variables.`
        })
      }
    }

    // Determine if recurring or one-time
    const isLifetime = plan === 'lifetime'

    const sessionBody = {
      mode:                isLifetime ? 'payment' : 'subscription',
      success_url:         `${siteUrl}/thankyou.html?plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:          `${siteUrl}/checkout.html?plan=${plan}&cancelled=true`,
      line_items: [{
        price:    priceId,
        quantity: 1
      }],
      metadata: { plan, name: name || '' },
      allow_promotion_codes: true
    }

    // Pre-fill email if provided
    if (email) sessionBody.customer_email = email

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type':  'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(flattenForStripe(sessionBody)).toString()
    })

    const session = await response.json()

    if (!response.ok) {
      throw new Error(session.error?.message || 'Stripe error')
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url, sessionId: session.id })
    }

  } catch (err) {
    console.error('create-checkout error:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    }
  }
}

// Flatten nested object for Stripe's form-encoded API
function flattenForStripe(obj, prefix = '') {
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key
    if (value !== null && value !== undefined) {
      if (typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, flattenForStripe(value, fullKey))
      } else if (Array.isArray(value)) {
        value.forEach((item, i) => {
          if (typeof item === 'object') {
            Object.assign(result, flattenForStripe(item, `${fullKey}[${i}]`))
          } else {
            result[`${fullKey}[${i}]`] = item
          }
        })
      } else {
        result[fullKey] = String(value)
      }
    }
  }
  return result
}
