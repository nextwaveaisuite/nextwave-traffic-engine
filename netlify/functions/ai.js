// netlify/functions/ai.js
export async function handler(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  try {
    const { prompt } = JSON.parse(event.body || '{}')
    if (!prompt) return { statusCode: 400, body: JSON.stringify({ error: 'prompt required' }) }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        system: 'You are an expert affiliate marketing copywriter. Respond only with valid JSON, no markdown.',
        messages: [{
          role: 'user',
          content: `Create affiliate funnel copy for: "${prompt}". 
Return ONLY this JSON:
{
  "headline": "...",
  "subheadline": "...",
  "hook": "...",
  "bullets": ["...", "...", "...", "...", "..."],
  "cta": "...",
  "emailSubject": "...",
  "emailBody": "..."
}`
        }]
      })
    })

    const data = await res.json()
    const result = JSON.parse(data.content?.[0]?.text || '{}')

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result })
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
