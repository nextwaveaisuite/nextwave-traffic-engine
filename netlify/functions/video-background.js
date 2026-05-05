// netlify/functions/video-background.js
// Netlify BACKGROUND function — 15 minute timeout, no UI blocking
// Generates D-ID talking head video from VSL script
// Saves video URL to Supabase funnels table when done
// Bridge page polls /video-status?slug=xxx to check progress
//
// BACKGROUND FUNCTIONS:
// - Must be in netlify/functions/ with filename ending in -background.js
// - Called with POST, returns 202 immediately
// - Continues running up to 15 minutes after response
// - Docs: https://docs.netlify.com/functions/background-functions/

import { supabase } from './_supabase.js'

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const { script, slug, voice, avatar } = JSON.parse(event.body || '{}')

  if (!script || !slug) {
    return { statusCode: 400, body: JSON.stringify({ error: 'script and slug are required' }) }
  }

  const didKey = process.env.DID_API_KEY
  if (!didKey) {
    // Update funnel record to show video not available
    await supabase.from('funnels').update({
      vsl_video_url:    null,
      vsl_video_status: 'no_key'
    }).eq('slug', slug)
    return { statusCode: 200, body: JSON.stringify({ status: 'no_key' }) }
  }

  // Mark as processing immediately
  await supabase.from('funnels').update({
    vsl_video_status: 'processing'
  }).eq('slug', slug)

  const authHeader    = 'Basic ' + Buffer.from(didKey + ':').toString('base64')
  const presenterUrl  = avatar || 'https://create-images-results.d-id.com/DefaultPresenters/Emma_f/image.png'
  const voiceId       = voice  || 'en-US-JennyNeural'

  try {
    // ── STEP 1: CREATE TALK ──────────────────────────────
    const createRes = await fetch('https://api.d-id.com/talks', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': authHeader,
        'Accept':        'application/json'
      },
      body: JSON.stringify({
        source_url: presenterUrl,
        script: {
          type:     'text',
          input:    script,
          provider: {
            type:     'microsoft',
            voice_id: voiceId
          }
        },
        config: { fluent: true, pad_audio: 0.0, stitch: true }
      })
    })

    const createData = await createRes.json()

    if (!createRes.ok || !createData.id) {
      throw new Error('D-ID create failed: ' + (createData.description || JSON.stringify(createData)))
    }

    const talkId = createData.id

    // Save talk ID so bridge page can show "generating" state
    await supabase.from('funnels').update({
      vsl_talk_id:      talkId,
      vsl_video_status: 'processing'
    }).eq('slug', slug)

    // ── STEP 2: POLL FOR COMPLETION (up to 10 minutes) ───
    let videoUrl = null
    let attempts = 0
    const maxAttempts = 120  // 120 × 5s = 10 minutes

    while (attempts < maxAttempts) {
      await sleep(5000)
      attempts++

      const pollRes  = await fetch(`https://api.d-id.com/talks/${talkId}`, {
        headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
      })
      const pollData = await pollRes.json()

      if (pollData.status === 'done') {
        videoUrl = pollData.result_url
        break
      }

      if (pollData.status === 'error') {
        throw new Error('D-ID render error: ' + (pollData.error?.description || 'Unknown'))
      }
    }

    if (!videoUrl) {
      await supabase.from('funnels').update({ vsl_video_status: 'timeout' }).eq('slug', slug)
      return { statusCode: 200, body: JSON.stringify({ status: 'timeout' }) }
    }

    // ── STEP 3: SAVE VIDEO URL TO SUPABASE ────────────────
    await supabase.from('funnels').update({
      vsl_video_url:    videoUrl,
      vsl_video_status: 'ready'
    }).eq('slug', slug)

    console.log('D-ID video ready for slug:', slug, '—', videoUrl)
    return { statusCode: 200, body: JSON.stringify({ status: 'ready', videoUrl }) }

  } catch(err) {
    console.error('video-background error:', err.message)
    await supabase.from('funnels').update({
      vsl_video_status: 'error'
    }).eq('slug', slug)
    return { statusCode: 200, body: JSON.stringify({ status: 'error', message: err.message }) }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
