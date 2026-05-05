// netlify/functions/createLink.js
// Creates a cloaked tracking link AND generates a Wave Link (short URL via tinyurl.com API)
//
// HOW IT WORKS:
// 1. User pastes affiliate URL
// 2. NextWave creates a tracking link: nextwave-traffic-engine.netlify.app/l/slug
// 3. That tracking link is shortened via a free URL shortening API
// 4. Returns a clean short URL: https://tinyurl.com/xxxxxxxx
// 5. User shares the Wave Link — redirects through NextWave (click tracked)
//    then on to the affiliate offer
//
// CHAIN: tinyurl.com/xxx → nextwave.app/l/slug → affiliate offer
// Tracking fires on the middle hop — every click is counted

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
      return { statusCode: 400, body: JSON.stringify({ error: 'url is required' }) }
    }
    try { new URL(url) } catch {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid URL — must include https://' }) }
    }

    // Generate slug if not provided — short, clean, 5 chars
    if (!slug) {
      slug = generateSlug(5)
    }

    // Sanitise slug
    slug = slug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40)

    if (!slug) slug = generateSlug(5)

    // Check slug isn't already taken — if so, append random chars
    const { data: existing } = await supabase
      .from('links')
      .select('slug')
      .eq('slug', slug)
      .maybeSingle()

    if (existing) {
      slug = slug + '-' + generateSlug(3)
    }

    const siteUrl     = process.env.SITE_URL || 'https://nextwave-traffic-engine.netlify.app'
    const trackingUrl = `${siteUrl}/l/${slug}`

    // ── GENERATE TINYURL ─────────────────────────────────────────
    // Free URL shortening API — no key required
    // We shorten the NextWave tracking URL so tracking still fires
    let tinyUrl = null
    try {
      const tinyRes = await fetch(
        `https://tinyurl.com/api-create.php?url=${encodeURIComponent(trackingUrl)}`,
        {
          headers: { 'User-Agent': 'NextWave/1.0' },
          signal: AbortSignal.timeout(5000)
        }
      )

      if (tinyRes.ok) {
        const tinyText = (await tinyRes.text()).trim()
        // Validate it looks like a valid short URL
        if (tinyText.startsWith('https://tinyurl.com/') || tinyText.startsWith('http://tinyurl.com/')) {
          tinyUrl = tinyText
        }
      }
    } catch (e) {
      // Wave Link API failed — non-fatal, continue without short URL
      console.warn('Wave Link API non-fatal error:', e.message)
    }

    // ── SAVE TO SUPABASE ─────────────────────────────────────────
    const { data, error } = await supabase
      .from('links')
      .insert([{
        slug,
        original_url: url,
        label:        label,
        tiny_url:     tinyUrl,
        clicks:       0,
        created_at:   new Date().toISOString()
      }])
      .select()
      .single()

    if (error) throw error

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        short_link:   trackingUrl,   // NextWave tracking link
        tiny_url:     tinyUrl,       // Wave Link — short URL for sharing
        share_link:   tinyUrl || trackingUrl,  // best link to share
        data
      })
    }

  } catch (err) {
    console.error('createLink error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}

// Generates a short random slug
function generateSlug(length = 5) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789' // no confusable chars
  let result  = ''
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}
