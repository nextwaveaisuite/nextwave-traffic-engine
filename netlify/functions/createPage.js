// netlify/functions/createPage.js
import { supabase } from './_supabase.js'

export async function handler(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  try {
    const body = JSON.parse(event.body || '{}')
    const name = body.name || 'funnel'   // ← was [body.name](http://body.name)
    const link = body.link || '#'        // ← was [body.link](http://body.link)
    const copy = body.copy || null

    const slug    = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const baseUrl = process.env.SITE_URL || 'https://nextwave-traffic-engine.netlify.app'

    await supabase.from('funnels').insert([{
      funnel_name: name,
      affiliate_link: link,
      slug,
      copy: copy ? JSON.stringify(copy) : null
    }])

    return {
      statusCode: 200,
      body: JSON.stringify({ url: `${baseUrl}/funnel/${slug}`, slug })
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
