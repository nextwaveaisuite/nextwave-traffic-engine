// netlify/functions/ai.js
// Generates psychologically-driven funnel copy using Claude
// Uses direct response copywriting frameworks:
// — Pain Agitation Solution (PAS)
// — Future pacing
// — Identity-based triggers
// — Fear of loss + desire amplification
// — Pattern interrupts
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
        body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not set in Netlify environment variables' })
      }
    }

    const systemPrompt = `You are a world-class direct response copywriter with 20 years of experience writing copy that converts cold traffic into buyers.

Your copy is built on proven psychological principles:

CORE FRAMEWORKS YOU USE:
- Pain Agitation Solution (PAS): Identify the exact pain, twist the knife, then present the solution
- Future Pacing: Paint a vivid picture of their life AFTER the transformation
- Identity Shift: Speak to who they WANT to become, not just what they want to buy
- Fear of Loss: Loss aversion is 2x stronger than desire for gain — use it
- Pattern Interrupt: Open with something unexpected that stops the scroll
- Specificity: Specific numbers, timeframes and outcomes convert better than vague claims
- Social Proof Framing: Make them feel others like them have already made this decision
- Micro-Commitments: Each line should make them nod yes before the next ask

PSYCHOLOGICAL TRIGGERS YOU EMBED:
- Curiosity gaps that compel reading to the end
- "That's me" moments where the reader feels deeply understood
- Subtle urgency without fake pressure
- Authority through specificity, not boasting
- Tribal identity — "people like us do things like this"

COPY RULES:
- Write at 6th grade reading level — simple, punchy, direct
- Short sentences. White space. Rhythm.
- Never use buzzwords like "game-changer", "revolutionary", "unlock your potential"
- Every line must earn its place — if it doesn't advance the sale, cut it
- The headline must stop them cold. It speaks to their #1 desire or #1 fear.
- The hook must make them feel: "This person GETS me"
- Benefits must be outcomes, not features — not "daily lessons" but "wake up knowing exactly what to do"

You are writing for ${source} traffic — people who clicked an ad and are skeptical. You have 3 seconds to earn their attention.

Respond ONLY with a raw JSON object. No markdown. No backticks. No explanation. Start with { and end with }.`

    const userPrompt = `Write high-converting direct response funnel copy for this offer: "${prompt}"

Use the Pain Agitation Solution framework. The copy must:
1. Open with a pattern interrupt headline that speaks to the reader's deepest desire or biggest fear
2. A subheadline that creates curiosity and promises a specific transformation
3. A hook that agitates the pain — make them feel understood, almost uncomfortably so
4. Benefits written as specific life outcomes, not product features
5. A CTA that creates identity alignment ("Yes, I want to be the kind of person who…")
6. Email subject using curiosity gap or open loop
7. Email body that continues the conversation like a trusted friend, not a salesman

Return exactly this JSON — no other text:
{
  "headline": "Pattern interrupt headline — speaks to desire or fear, under 12 words, creates curiosity or shock",
  "subheadline": "Specific transformation promise with timeframe or mechanism, under 20 words",
  "hook": "3-4 sentences. Agitate the pain. Use 'you' language. Make them feel seen. End with a pivot to hope.",
  "bullets": [
    "Specific outcome benefit — what their life looks like after, not what the product does",
    "Specific outcome benefit with number or timeframe if possible",
    "Removes a specific objection they have right now",
    "Future pacing — paint the picture of their transformed life",
    "Social proof framing — others like them have already done this"
  ],
  "cta": "Identity-aligned CTA, first person, max 7 words — 'Yes, show me how' style",
  "emailSubject": "Curiosity gap or open loop subject line — makes not opening feel like a loss",
  "emailBody": "Two paragraphs. First: continues the pain agitation, makes them feel the cost of inaction. Second: presents the solution as inevitable, creates urgency through opportunity cost not fake deadlines. Conversational tone, short sentences."
}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model:      'claude-opus-4-5',
        max_tokens: 1500,
        system:     systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Anthropic API error ${response.status}: ${errText}`)
    }

    const aiData  = await response.json()
    let   rawText = aiData.content?.[0]?.text || ''

    // Strip markdown code fences if Claude added them despite instructions
    rawText = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    // Extract JSON object in case there is any surrounding text
    const jsonStart = rawText.indexOf('{')
    const jsonEnd   = rawText.lastIndexOf('}')
    if (jsonStart !== -1 && jsonEnd !== -1) {
      rawText = rawText.slice(jsonStart, jsonEnd + 1)
    }

    let result
    try {
      result = JSON.parse(rawText)
    } catch (parseErr) {
      console.error('JSON parse failed. Raw:', rawText.slice(0, 300))
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'AI response could not be parsed. Try again. Raw: ' + rawText.slice(0, 200)
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
