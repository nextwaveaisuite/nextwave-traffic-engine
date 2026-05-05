// netlify/functions/deleteLink.js
// Deletes a Wave Link from Supabase using service role key
// The browser anon key may not have DELETE permissions even with RLS disabled
// This function runs server-side with full permissions

import { supabase } from './_supabase.js'

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const { slug, action, id } = JSON.parse(event.body || '{}')

    if (!slug) {
      return { statusCode: 400, body: JSON.stringify({ error: 'slug is required' }) }
    }

    if (action === 'reset') {
      // Reset click count
      const { error } = await supabase
        .from('links')
        .update({ clicks: 0 })
        .eq('slug', slug)

      if (error) throw error
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, action: 'reset', slug })
      }
    }

    // Default action: delete
    const { error } = await supabase
      .from('links')
      .delete()
      .eq('slug', slug)

    if (error) throw error

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, action: 'deleted', slug })
    }

  } catch(err) {
    console.error('deleteLink error:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Delete failed' })
    }
  }
}
