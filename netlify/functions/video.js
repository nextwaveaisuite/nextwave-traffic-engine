// netlify/functions/video.js
// Generates a VSL talking-head video using D-ID API
// D-ID takes a script + avatar image and renders a video of someone speaking the script
// Docs: https://docs.d-id.com
// Requires: DID_API_KEY in Netlify environment variables
// Get a key at: https://studio.d-id.com (free tier available)

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const body   = JSON.parse(event.body || '{}')
    const script = body.script?.trim()
    const voice  = body.voice  || 'en-US-JennyNeural'  // Microsoft Azure voice
    const avatar = body.avatar || null  // URL to presenter image, optional

    if (!script) {
      return { statusCode: 400, body: JSON.stringify({ error: 'script is required' }) }
    }

    const didKey = process.env.DID_API_KEY
    if (!didKey) {
      // No D-ID key — return script-only mode so the bridge page still works
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode:    'script_only',
          script,
          message: 'D-ID API key not configured. Bridge page will display script as text. Add DID_API_KEY to Netlify environment variables to enable video generation.'
        })
      }
    }

    // Default presenter image — professional, neutral
    const presenterUrl = avatar || 'https://create-images-results.d-id.com/DefaultPresenters/Emma_f/image.png'

    // Step 1: Create a talk video
    const createRes = await fetch('https://api.d-id.com/talks', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Basic ${Buffer.from(didKey + ':').toString('base64')}`
      },
      body: JSON.stringify({
        source_url: presenterUrl,
        script: {
          type:     'text',
          input:    script,
          provider: {
            type:    'microsoft',
            voice_id: voice
          }
        },
        config: {
          fluent:     true,
          pad_audio:  0.0
        }
      })
    })

    const createData = await createRes.json()

    if (!createRes.ok) {
      throw new Error(`D-ID create error: ${createData.description || createData.message || JSON.stringify(createData)}`)
    }

    const talkId = createData.id
    if (!talkId) {
      throw new Error('D-ID did not return a talk ID')
    }

    // Step 2: Poll for completion (max 60 seconds)
    let videoUrl = null
    let attempts = 0
    const maxAttempts = 24  // 24 × 2.5s = 60 seconds

    while (attempts < maxAttempts) {
      await sleep(2500)
      attempts++

      const statusRes = await fetch(`https://api.d-id.com/talks/${talkId}`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(didKey + ':').toString('base64')}`
        }
      })
      const statusData = await statusRes.json()

      if (statusData.status === 'done') {
        videoUrl = statusData.result_url
        break
      }

      if (statusData.status === 'error') {
        throw new Error(`D-ID render failed: ${statusData.error?.description || 'Unknown error'}`)
      }

      // Continue polling if status is 'created' or 'started'
    }

    if (!videoUrl) {
      // Video still processing — return the talk ID so client can poll later
      return {
        statusCode: 202,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode:    'processing',
          talkId,
          message: 'Video is being generated. Poll /video/status?id=' + talkId + ' to check progress.'
        })
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode:     'video',
        talkId,
        videoUrl,
        script
      })
    }

  } catch (err) {
    console.error('video.js error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
