// netlify/functions/createLink.js
// Creates a cloaked/short link and stores it in Supabase

import { supabase } from './_supabase.js'

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const body  = JSON.parse(event.body || '{}')
    const url   = body.url?.trim()
    const label = body.label?.trim() || null
    let   slug  = body.slug?.trim()  || null

    // Validate URL
    if (!url) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'url is required' })
      }
    }
    try { new URL(url) } catch {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid URL — must include https://' })
      }
    }

    // Generate slug if not provided
    if (!slug) {
      slug = Math.random().toString(36).substring(2, 8)
    }

    // Sanitise slug — only lowercase letters, numbers, hyphens
    slug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')

    // Check slug isn't taken
    const { data: existing } = await supabase
      .from('links')
      .select('slug')
      .eq('slug', slug)
      .maybeSingle()

    if (existing) {
      // Auto-append random chars to avoid collision
      slug = slug + '-' + Math.random().toString(36).substring(2, 5)
    }

    // Insert link
    const { data, error } = await supabase
      .from('links')
      .insert([{
        slug,
        original_url: url,
        label,
        clicks: 0,
        created_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) throw error

    const siteUrl = process.env.SITE_URL || 'https://nextwave-traffic-engine.netlify.app'

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        short_link: `${siteUrl}/l/${slug}`,
        slug,
        data
      })
    }

  } catch (err) {
    console.error('createLink error:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    }
  }
}
