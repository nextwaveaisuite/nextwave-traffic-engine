import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = "https://cvwukmghdmmbchgchtsd.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2d3VrbWdoZG1tYmNoZ2NodHNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0Mzg4NjUsImV4cCI6MjA5MzAxNDg2NX0.4LtyvVkVVbWszu2wsItdBSrTvETbv1jPJsShIiyqnE8";

export const supabase = createClient(supabaseUrl, supabaseKey);
