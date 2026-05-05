// supabase.js — Browser Supabase client
// Used by: funnel.html, bridge.html, dashboard.html
// Uses the ANON (public) key — safe to expose in browser
// DO NOT use the service_role key here

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL  = 'https://nfqoxklkokrkaabmvzps.supabase.co'   // e.g. https://xxxx.supabase.co
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mcW94a2xrb2tya2FhYm12enBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1Mzk4OTMsImV4cCI6MjA5MzExNTg5M30.Y6clpSQdRvsERc_1d3pN-HHCTy0_lO-EmnSZP-0_m3I'       // starts with eyJ...

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
