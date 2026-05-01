// netlify/functions/email.js
// Captures a lead: saves to Supabase, syncs to Forge Mail

import { supabase } from './_supabase.js'

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const body   = JSON.parse(event.body || '{}')
    const email  = body.email?.trim()?.toLowerCase()
    const name   = body.name?.trim()  || null
    const funnel = body.funnel?.trim() || 'default'

    if (!email || !email.includes('@')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'A valid email is required' })
      }
    }

    // Save lead — upsert so duplicate emails don't error
    const { error: leadErr } = await supabase
      .from('leads')
      .upsert([{
        email,
        name,
        funnel_id:  funnel,
        created_at: new Date().toISOString()
      }], { onConflict: 'email' })

    if (leadErr) throw leadErr

    // Log event
    await supabase.from('events').insert([{
      type:       'lead',
      value:      1,
      funnel_id:  funnel,
      email,
      created_at: new Date().toISOString()
    }])

    // Sync to Forge Mail (non-blocking — never breaks the flow)
    const forgeKey = process.env.FORGE_MAIL_API_KEY
    if (forgeKey) {
      fetch('https://mail.nextwaveaisuite.com/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${forgeKey}`
        },
        body: JSON.stringify({
          email,
          name,
          list: 'nextwave-revenue-os',
          tags: [funnel]
        })
      }).catch(e => console.warn('Forge Mail sync non-fatal error:', e.message))
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, email })
    }

  } catch (err) {
    console.error('email.js error:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    }
  }
}
