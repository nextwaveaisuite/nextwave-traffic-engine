// netlify/functions/createPage.js
// Saves funnel record and bridge page to Supabase
// Triggers D-ID video generation if DID_API_KEY is configured
// Returns funnel URL, bridge URL, and whether video was generated

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

    // Generate VSL video if D-ID key exists and script is available
    let vslVideoUrl = null
    const didKey    = process.env.DID_API_KEY
    const vslScript = copy?.vslScript

    if (didKey && vslScript) {
      try {
        const videoRes  = await fetch(`${siteUrl}/.netlify/functions/video`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ script: vslScript, voice: 'en-US-JennyNeural' })
        })
        const videoData = await videoRes.json()
        if (videoData.videoUrl) vslVideoUrl = videoData.videoUrl
      } catch(e) {
        console.warn('D-ID video generation error (non-fatal):', e.message)
      }
    }

    // Save to funnels table — add vsl_video_url column if needed
    const { data, error } = await supabase
      .from('funnels')
      .insert([{
        funnel_name:    name,
        affiliate_link: link,
        slug,
        copy:           copy || null,
        vsl_video_url:  vslVideoUrl,
        created_at:     new Date().toISOString()
      }])
      .select()
      .single()

    if (error) throw error

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url:        pageUrl,
        bridgeUrl,
        slug,
        videoReady: !!vslVideoUrl,
        data
      })
    }

  } catch (err) {
    console.error('createPage error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
