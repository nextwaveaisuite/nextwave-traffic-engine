// netlify/functions/createPage.js
// Saves a funnel record to Supabase and returns its URL

import { supabase } from './_supabase.js'

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const name = body.name?.trim() || 'funnel'
    const link = body.link?.trim() || null
    const copy = body.copy         || null

    // Build a clean slug
    const slug = name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 60)

    const siteUrl = process.env.SITE_URL || 'https://nextwave-traffic-engine.netlify.app'
    const pageUrl = `${siteUrl}/funnel/${slug}`

    const { data, error } = await supabase
      .from('funnels')
      .insert([{
        funnel_name:    name,
        affiliate_link: link,
        slug,
        copy:           copy ? copy : null,
        created_at:     new Date().toISOString()
      }])
      .select()
      .single()

    if (error) throw error

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: pageUrl, slug, data })
    }

  } catch (err) {
    console.error('createPage error:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    }
  }
}
