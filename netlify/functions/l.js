// netlify/functions/l.js
// Resolves short/cloaked links and redirects — tracks click count

import { supabase } from './_supabase.js'

export const handler = async (event) => {
  try {
    // Extract slug from path: /l/abc123 → abc123
    const parts = event.path.replace(/^\/+/, '').split('/')
    const slug  = parts[parts.length - 1]

    if (!slug) {
      return { statusCode: 400, body: 'Missing slug' }
    }

    const { data, error } = await supabase
      .from('links')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()

    if (error) throw error

    if (!data) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'text/html' },
        body: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#080c14;color:#dce8f5;text-align:center;padding:60px">
          <h2>Link not found</h2>
          <p style="color:#3d5275">This short link doesn't exist or has been removed.</p>
          <a href="/" style="color:#19e6b0">← Back to NextWave</a>
        </body></html>`
      }
    }

    // Increment click count (fire and forget)
    supabase
      .from('links')
      .update({ clicks: (data.clicks || 0) + 1 })
      .eq('slug', slug)
      .then()

    // Log click event
    supabase.from('events').insert([{
      type:       'click',
      value:      1,
      meta:       slug,
      funnel_id:  data.label || slug,
      created_at: new Date().toISOString()
    }]).then()

    return {
      statusCode: 302,
      headers: {
        'Location':      data.original_url,
        'Cache-Control': 'no-cache, no-store'
      },
      body: ''
    }

  } catch (err) {
    console.error('l.js error:', err)
    return { statusCode: 500, body: 'Server error' }
  }
}
