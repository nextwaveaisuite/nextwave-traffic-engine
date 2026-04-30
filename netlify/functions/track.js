// netlify/functions/track.js
import { supabase } from './_supabase.js'

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  try {
    const body  = JSON.parse(event.body || '{}')
    const email = body.email?.trim()?.toLowerCase() || null  // ← was [body.email](http://body.email)
    const value = Number(body.value) || 10
    const funnel = body.funnel || 'default'

    await supabase.from('events').insert([{ type: 'conversion', value, funnel_id: funnel, email }])

    const forgeKey = process.env.FORGE_MAIL_API_KEY
    if (forgeKey && email) {
      fetch('https://mail.nextwaveaisuite.com/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${forgeKey}` },
        body: JSON.stringify({ email, event: 'conversion' })
      }).catch(() => {})
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
