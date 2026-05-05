// netlify/functions/_supabase.js
// Shared Supabase client — imported by all other functions
// Uses service role key (server-side only, never expose to browser)

import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY

if (!url || !key) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in Netlify environment variables')
}

export const supabase = createClient(url, key)
