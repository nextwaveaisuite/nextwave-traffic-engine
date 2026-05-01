// netlify/functions/track.js
// Logs conversion events to Supabase and notifies Forge Mail

import { supabase } from './_supabase.js'

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const body   = JSON.parse(event.body || '{}')
    const email  = body.email?.trim()?.toLowerCase() || null
    const funnel = body.funnel || 'default'
    const value  = Number(body.value) || 10
    const type   = body.type || 'conversion'

    await supabase.from('events').insert([{
      type,
      value,
      funnel_id:  funnel,
      email,
      created_at: new Date().toISOString()
    }])

    // Notify Forge Mail (non-blocking)
    const forgeKey = process.env.FORGE_MAIL_API_KEY
    if (forgeKey && email) {
      fetch('https://mail.nextwaveaisuite.com/api/events', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${forgeKey}`
        },
        body: JSON.stringify({ email, event: type, funnel })
      }).catch(e => console.warn('Forge Mail event ping non-fatal:', e.message))
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, type, value })
    }

  } catch (err) {
    console.error('track.js error:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    }
  }
}
