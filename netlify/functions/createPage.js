// netlify/functions/createPage.js
// Saves funnel to Supabase using UPSERT (handles duplicate slugs)
// Triggers background D-ID video generation if DID_API_KEY is set

import { supabase } from './_supabase.js'

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const name     = body.name?.trim() || 'funnel'
    const link     = body.link?.trim() || null
    const copy     = body.copy || null
    const videoUrl = body.videoUrl?.trim() || null  // user's own video URL

    // Build slug
    const slug = name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'funnel'

    // If user provided their own video URL — use it directly, skip D-ID
    // If no video URL — trigger D-ID background generation if key exists
    const hasOwnVideo = !!videoUrl
    const hasVideo    = !hasOwnVideo && !!process.env.DID_API_KEY && !!copy?.vslScript

    console.log('createPage: slug =', slug, '| own video =', hasOwnVideo, '| D-ID =', hasVideo)

    // ── UPSERT — handles duplicate slugs gracefully ───────
    const record = {
      funnel_name:      name,
      affiliate_link:   link,
      slug,
      copy:             copy ? JSON.stringify(copy) : null,
      vsl_video_url:    videoUrl || null,
      vsl_video_status: hasOwnVideo ? 'ready' : hasVideo ? 'processing' : 'no_key',
      created_at:       new Date().toISOString()
    }

    let data, error
    const upsertRes = await supabase
      .from('funnels')
      .upsert([record], { onConflict: 'slug' })
      .select()
      .single()

    data  = upsertRes.data
    error = upsertRes.error

    if (error) {
      console.warn('createPage upsert error:', error.message, '— trying delete+insert')
      await supabase.from('funnels').delete().eq('slug', slug)
      const insertRes = await supabase
        .from('funnels')
        .insert([record])
        .select()
        .single()
      data  = insertRes.data
      error = insertRes.error
    }

    if (error) {
      console.error('createPage fatal error:', JSON.stringify(error))
      throw new Error(error.message || 'Supabase insert failed')
    }

    console.log('createPage: saved successfully, slug =', slug)

    // ── TRIGGER BACKGROUND VIDEO ──────────────────────────
    if (hasVideo) {
      const siteUrl = process.env.SITE_URL || 'https://nextwave-traffic-engine.netlify.app'
      fetch(`${siteUrl}/.netlify/functions/video-background`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ script: copy.vslScript, slug, voice: 'Joanna' })
      }).catch(e => console.warn('Background video non-fatal:', e.message))
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        videoStatus: hasOwnVideo ? 'ready' : hasVideo ? 'processing' : 'no_key',
        hasOwnVideo,
        saved: true
      })
    }

  } catch(err) {
    console.error('createPage unhandled error:', err.message)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Unknown error in createPage' })
    }
  }
}
