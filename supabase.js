import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://nfqoxklkokrkaabmvzps.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mcW94a2xrb2tya2FhYm12enBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1Mzk4OTMsImV4cCI6MjA5MzExNTg5M30.Y6clpSQdRvsERc_1d3pN-HHCTy0_lO-EmnSZP-0_m3I'

export const supabase = createClient(supabaseUrl, supabaseKey)
