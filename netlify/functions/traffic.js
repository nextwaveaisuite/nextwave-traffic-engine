// netlify/functions/traffic.js
// Returns aggregated stats for the dashboard overview

import { supabase } from './_supabase.js'

export async function handler(event) {
  try {
    const range = event.queryStringParameters?.range || '7d'

    const now  = new Date()
    const from = new Date(now)
    if      (range === '24h') from.setHours(from.getHours() - 24)
    else if (range === '30d') from.setDate(from.getDate() - 30)
    else                      from.setDate(from.getDate() - 7)

    const fromISO = from.toISOString()

    const [evRes, leadsRes, linksRes] = await Promise.all([
      supabase.from('events').select('*').gte('created_at', fromISO).order('created_at', { ascending: false }),
      supabase.from('leads').select('email,funnel_id,created_at').gte('created_at', fromISO).order('created_at', { ascending: false }).limit(50),
      supabase.from('links').select('slug,label,clicks,original_url,created_at').order('clicks', { ascending: false }).limit(20)
    ])

    const events = evRes.data    || []
    const leads  = leadsRes.data || []
    const links  = linksRes.data || []

    const stats = {
      leads:       events.filter(e => e.type === 'lead').length,
      clicks:      events.filter(e => e.type === 'click').reduce((s, e) => s + (e.value || 0), 0),
      conversions: events.filter(e => e.type === 'conversion').length,
      revenue:     events.filter(e => e.type === 'conversion').reduce((s, e) => s + (e.value || 0), 0)
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stats, recentLeads: leads, topLinks: links, range })
    }

  } catch (err) {
    console.error('traffic.js error:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    }
  }
}
