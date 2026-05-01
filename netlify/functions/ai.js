// netlify/functions/ai.js
// Generates funnel copy using Claude API
// Requires: ANTHROPIC_API_KEY in Netlify environment variables

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const body   = event.body ? JSON.parse(event.body) : {}
    const prompt = body.prompt || body.niche || ''
    const source = body.source || 'trafficzest'

    if (!prompt) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'prompt is required' })
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'ANTHROPIC_API_KEY is not configured in Netlify environment variables' })
      }
    }

    const systemPrompt = `You are an expert affiliate marketing copywriter.
The user is running paid traffic from ${source}.
Respond ONLY with a raw JSON object. No markdown. No code fences. No backticks. No explanation.
Just the JSON object, starting with { and ending with }.`

    const userPrompt = `Write affiliate funnel copy for this offer: "${prompt}"

Return exactly this JSON structure with no extra text:
{
  "headline": "short punchy headline under 10 words",
  "subheadline": "supporting line under 18 words",
  "hook": "2-3 sentences identifying the core pain point",
  "bullets": ["benefit one", "benefit two", "benefit three", "benefit four", "benefit five"],
  "cta": "call to action button text, max 6 words",
  "emailSubject": "follow-up email subject line",
  "emailBody": "2 short paragraphs for the follow-up email"
}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Anthropic API error ${response.status}: ${errText}`)
    }

    const aiData  = await response.json()
    let rawText   = aiData.content?.[0]?.text || ''

    // Strip markdown code fences if Claude added them despite instructions
    rawText = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    // Find the JSON object in case there's any surrounding text
    const jsonStart = rawText.indexOf('{')
    const jsonEnd   = rawText.lastIndexOf('}')
    if (jsonStart !== -1 && jsonEnd !== -1) {
      rawText = rawText.slice(jsonStart, jsonEnd + 1)
    }

    let result
    try {
      result = JSON.parse(rawText)
    } catch (parseErr) {
      // If still can't parse, return a safe fallback with the raw text for debugging
      console.error('JSON parse failed. Raw text was:', rawText)
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'AI returned invalid JSON. Raw response: ' + rawText.slice(0, 200)
        })
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result })
    }

  } catch (err) {
    console.error('ai.js error:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    }
  }
}
