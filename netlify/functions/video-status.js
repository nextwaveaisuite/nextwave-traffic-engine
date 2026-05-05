// netlify/functions/video-status.js
// Bridge page polls this to check if D-ID video is ready
// GET /video-status?slug=make-money-online
// Returns: { status: 'processing' | 'ready' | 'error' | 'timeout' | 'no_key', videoUrl? }

import { supabase } from './_supabase.js'

export async function handler(event) {
  const slug = event.queryStringParameters?.slug

  if (!slug) {
    return { statusCode: 400, body: JSON.stringify({ error: 'slug is required' }) }
  }

  const { data, error } = await supabase
    .from('funnels')
    .select('vsl_video_url, vsl_video_status, vsl_talk_id')
    .eq('slug', slug)
    .maybeSingle()

  if (error || !data) {
    return { statusCode: 404, body: JSON.stringify({ status: 'not_found' }) }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status:   data.vsl_video_status || 'processing',
      videoUrl: data.vsl_video_url    || null,
      talkId:   data.vsl_talk_id      || null
    })
  }
}
