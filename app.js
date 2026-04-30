import { supabase } from './supabase.js'

export async function createFunnel(userId, name, link) {
  return await supabase.from('funnels').insert([
    { user_id: userId, funnel_name: name, affiliate_link: link }
  ])
}

export async function useCredit(userId) {
  const { data } = await supabase.from('users').select('credits').eq('id', userId).single()
  if (!data || data.credits <= 0) return alert("No credits")
  await supabase.from('users').update({ credits: data.credits - 1 }).eq('id', userId)
}
