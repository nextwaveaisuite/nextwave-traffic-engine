// netlify/functions/createPage.js
// Saves funnel to Supabase and triggers background D-ID video generation
// Video generates asynchronously — bridge page polls for status

import { supabase } from './_supabase.js'

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const name = body.name?.trim() || 'funnel'
    const link = body.link?.trim() || null
    const copy = body.copy || null

    const slug = name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 60)

    const siteUrl   = process.env.SITE_URL || 'https://nextwave-traffic-engine.netlify.app'
    const pageUrl   = `${siteUrl}/funnel/${slug}`
    const bridgeUrl = `${siteUrl}/bridge/${slug}`

    // Save funnel with status 'processing' if D-ID key exists
    const hasVideo = !!process.env.DID_API_KEY && !!copy?.vslScript
    const { data, error } = await supabase
      .from('funnels')
      .insert([{
        funnel_name:      name,
        affiliate_link:   link,
        slug,
        copy:             copy || null,
        vsl_video_url:    null,
        vsl_video_status: hasVideo ? 'processing' : 'no_key',
        created_at:       new Date().toISOString()
      }])
      .select()
      .single()

    if (error) throw error

    // ── TRIGGER BACKGROUND VIDEO GENERATION ──────────────
    // Background function returns 202 immediately, generates video async
    // Bridge page polls /.netlify/functions/video-status?slug=xxx
    if (hasVideo) {
      fetch(`${siteUrl}/.netlify/functions/video-background`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          script: copy.vslScript,
          slug,
          voice:  'en-US-JennyNeural'
        })
      }).catch(e => console.warn('Background video trigger non-fatal:', e.message))
      // Non-blocking — do not await
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url:          pageUrl,
        bridgeUrl,
        slug,
        videoStatus:  hasVideo ? 'processing' : 'no_key',
        data
      })
    }

  } catch(err) {
    console.error('createPage error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
