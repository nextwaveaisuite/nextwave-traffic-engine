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
    const name = body.name?.trim() || 'funnel'
    const link = body.link?.trim() || null
    const copy = body.copy || null

    // Build slug
    const slug = name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'funnel'

    const siteUrl   = process.env.SITE_URL || 'https://nextwave-traffic-engine.netlify.app'
    const pageUrl   = `${siteUrl}/funnel/${slug}`
    const bridgeUrl = `${siteUrl}/bridge/${slug}`
    const hasVideo  = !!process.env.DID_API_KEY && !!copy?.vslScript

    console.log('createPage: saving slug =', slug, '| hasVideo =', hasVideo)

    // ── UPSERT — handles duplicate slugs gracefully ───────
    // If slug already exists, update it with new copy
    // onConflict: 'slug' requires a unique constraint on slug column
    const record = {
      funnel_name:      name,
      affiliate_link:   link,
      slug,
      copy:             copy ? JSON.stringify(copy) : null,
      vsl_video_url:    null,
      vsl_video_status: hasVideo ? 'processing' : 'no_key',
      created_at:       new Date().toISOString()
    }

    // Try upsert first
    let data, error
    const upsertRes = await supabase
      .from('funnels')
      .upsert([record], { onConflict: 'slug' })
      .select()
      .single()

    data  = upsertRes.data
    error = upsertRes.error

    // If upsert failed (e.g. no unique constraint) try plain insert
    if (error) {
      console.warn('createPage upsert error:', error.message, '— trying insert')

      // Try deleting existing record first then inserting
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
      throw new Error(error.message || 'Supabase insert failed — ' + JSON.stringify(error))
    }

    if (!data) {
      console.error('createPage: no data returned from Supabase')
      throw new Error('Supabase returned no data — record may not have saved')
    }

    console.log('createPage: saved successfully, id =', data.id || 'unknown')

    // ── TRIGGER BACKGROUND VIDEO ──────────────────────────
    if (hasVideo) {
      fetch(`${siteUrl}/.netlify/functions/video-background`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ script: copy.vslScript, slug, voice: 'en-US-JennyNeural' })
      }).catch(e => console.warn('Background video non-fatal:', e.message))
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url:         pageUrl,
        bridgeUrl,
        slug,
        videoStatus: hasVideo ? 'processing' : 'no_key',
        data
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
