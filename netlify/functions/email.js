// netlify/functions/email.js
import { supabase } from './_supabase.js'

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  try {
    const body   = JSON.parse(event.body || '{}')
    const email  = body.email?.trim()?.toLowerCase()  // ← was [body.email](http://body.email)
    const funnel = body.funnel || 'default'

    if (!email) return { statusCode: 400, body: JSON.stringify({ error: 'email required' }) }

    await supabase.from('leads').upsert([{ email, funnel_id: funnel }], { onConflict: 'email' })
    await supabase.from('events').insert([{ type: 'lead', value: 1, funnel_id: funnel }])

    // Forge Mail — non-blocking, won't break flow if it fails
    const forgeKey = process.env.FORGE_MAIL_API_KEY
    if (forgeKey) {
      fetch('https://mail.nextwaveaisuite.com/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${forgeKey}` },
        body: JSON.stringify({ email, list: 'nextwave-revenue-os', tags: [funnel] })
      }).catch(e => console.warn('Forge Mail failed:', e.message))
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
