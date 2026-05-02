// netlify/functions/ai.js
// Generates offer-specific, congruent funnel copy + VSL bridge script
// The VSL and opt-in copy are written to match the EXACT offer being promoted
// so there is zero disconnect between the funnel and the offer page
// Requires: ANTHROPIC_API_KEY in Netlify environment variables

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {}

    // ── OFFER DETAILS ─────────────────────────────────────────────
    // The more specific these are, the more congruent the copy
    const niche       = body.prompt || body.niche || ''          // e.g. "weight loss"
    const offerName   = body.offerName   || ''                   // e.g. "Ikaria Lean Belly Juice"
    const offerPromise= body.offerPromise|| ''                   // e.g. "Lose 30lbs in 90 days using a Japanese morning ritual"
    const price       = body.price       || ''                   // e.g. "$67 one-time"
    const guarantee   = body.guarantee   || ''                   // e.g. "180-day money back guarantee"
    const bonuses     = body.bonuses     || ''                   // e.g. "Bonus 1: Metabolic Reset Guide, Bonus 2: VIP coaching"
    const mechanism   = body.mechanism   || ''                   // e.g. "Targets ceramide compounds that trap fat in cells"
    const avatar      = body.avatar      || ''                   // e.g. "women over 40 who have tried every diet"
    const source      = body.source      || 'trafficzest'
    const scrapedCopy = body.scrapedCopy || ''                   // auto-extracted from offer page if URL was scraped

    if (!niche && !offerName) {
      return { statusCode: 400, body: JSON.stringify({ error: 'At minimum, enter your niche or offer name' }) }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured in Netlify environment variables' }) }
    }

    // ── BUILD OFFER CONTEXT ────────────────────────────────────────
    // Assemble everything we know about the offer into a clear brief
    const offerContext = buildOfferContext({
      niche, offerName, offerPromise, price, guarantee,
      bonuses, mechanism, avatar, scrapedCopy
    })

    // ── SYSTEM PROMPT ──────────────────────────────────────────────
    const systemPrompt = `You are a world-class direct response copywriter specialising in affiliate marketing funnels.

Your single most important rule: CONGRUENCE.
Every word of copy you write must match the specific offer exactly.
The opt-in page, the VSL script, and the affiliate offer page must feel like one continuous conversation.
When a visitor reads your funnel and then lands on the offer page, their reaction must be:
"Yes — this is exactly what I expected. I'm in the right place."

If there is ANY disconnect between the funnel copy and the offer, conversions collapse. This is the #1 killer of affiliate campaigns.

CONGRUENCE CHECKLIST — every piece of copy must pass this:
✓ The headline promise matches what the offer actually delivers
✓ The mechanism you mention is the SAME mechanism the offer uses
✓ The avatar you write for matches the offer's target buyer exactly
✓ The price/guarantee/bonuses match what is on the offer page
✓ The VSL script sets up the offer page — the visitor arrives already nodding
✓ Nothing in the funnel promises something the offer cannot deliver

COPYWRITING PRINCIPLES:
- Pain Agitation Solution (PAS): exact pain → twist the knife → this offer solves it
- Future Pacing: show their life AFTER using this specific product
- Specificity: use the actual offer name, actual mechanism, actual price — never vague
- Pattern Interrupt: open with something that stops them cold
- Identity Shift: speak to who they want to become
- Fear of Loss: what they lose by NOT taking this specific offer today
- Write at 6th grade level — short sentences, punchy, direct
- Never use buzzwords: "game-changer", "revolutionary", "unlock potential"

VSL SCRIPT RULES:
- The VSL introduces and pre-sells THIS specific offer by name
- Mention the mechanism — the unique thing this offer does that others don't
- Address the #1 objection they will have before it surfaces
- The CTA tells them exactly what to do next — "click the button below to get [offer name]"
- Spoken word tone — conversational, trusted friend, not salesperson
- 250-300 words = approximately 2 minutes at natural speaking pace
- The last sentence of the VSL should set up the offer page perfectly

Traffic source: ${source} — cold, sceptical traffic that clicked an ad. 3 seconds to earn attention.

Respond ONLY with raw JSON. No markdown. No backticks. No explanation. Start with { end with }.`

    // ── USER PROMPT ────────────────────────────────────────────────
    const userPrompt = `Write a complete, congruent funnel for this specific affiliate offer:

${offerContext}

CRITICAL: Every headline, hook, bullet, and VSL word must reference THIS specific offer.
Do not write generic copy. Write copy that could only be about this exact offer.
If the offer name is known, use it. If the mechanism is known, name it specifically.
If the price is known, mention it. If the guarantee is known, use it as a trust builder.

Return EXACTLY this JSON — no other text:
{
  "headline": "Specific headline about THIS offer — the exact transformation it delivers, under 12 words. Uses the offer's core promise or mechanism.",
  "subheadline": "Specific supporting line naming the offer or its unique mechanism, under 20 words.",
  "hook": "3-4 sentences. Names the exact pain this offer solves. Uses 'you' language. References the specific avatar. Ends with pivot to this specific solution.",
  "bullets": [
    "Specific benefit FROM THIS OFFER — what the buyer gets, not generic",
    "The unique mechanism this offer uses — what makes it different from everything else they have tried",
    "Removes the #1 objection specific to this type of offer",
    "Future pace using this offer's specific promised outcome with timeframe",
    "Credibility point specific to this offer — guarantee, testimonial angle, or proven track record"
  ],
  "cta": "First-person CTA referencing the offer by name or its outcome, max 7 words",
  "emailSubject": "Subject line referencing the specific offer or its mechanism — curiosity gap",
  "emailBody": "Two paragraphs. Para 1: reminds them of the pain and why other things failed — specific to this niche. Para 2: presents THIS specific offer as the thing they have been looking for, mentions the guarantee to reduce risk, clear CTA to click back.",
  "vslTitle": "VSL title shown above the video — references the offer promise, under 10 words",
  "vslScript": "Complete 260-300 word VSL script for natural spoken delivery. MUST: [HOOK 30w] Open with a bold statement about the specific pain or desire this offer addresses. [RAPPORT 50w] Describe their exact situation so well they lean in — no pitch yet, just empathy. [AGITATION 40w] The cost of staying where they are. Make it personal and specific. [PIVOT 20w] One sentence that signals everything is about to change. [OFFER INTRODUCTION 60w] Introduce THIS specific offer by name. Mention the mechanism — the unique thing it does. Be specific, not vague. [PROOF/GUARANTEE 30w] Reference the guarantee or social proof to neutralise risk. [CTA 30w] Tell them exactly what to click, what they will see next, and that the offer page has all the details. Set up the offer page perfectly.",
  "vslCta": "Bridge page button text — references offer name or outcome, first person, max 6 words",
  "vslSubtext": "One line of reassurance below button referencing the guarantee or low risk, under 12 words"
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
        max_tokens: 2500,
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

    // Strip markdown fences
    rawText = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    // Extract JSON object
    const jsonStart = rawText.indexOf('{')
    const jsonEnd   = rawText.lastIndexOf('}')
    if (jsonStart !== -1 && jsonEnd !== -1) {
      rawText = rawText.slice(jsonStart, jsonEnd + 1)
    }

    let result
    try {
      result = JSON.parse(rawText)
    } catch (parseErr) {
      console.error('JSON parse failed:', rawText.slice(0, 300))
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'AI returned invalid JSON. Please try again.' })
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result })
    }

  } catch (err) {
    console.error('ai.js error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}

// ── BUILD OFFER CONTEXT ────────────────────────────────────────
// Assembles everything known about the offer into a clear brief for Claude
function buildOfferContext({ niche, offerName, offerPromise, price, guarantee, bonuses, mechanism, avatar, scrapedCopy }) {
  const lines = []

  if (niche)        lines.push(`Niche / category: ${niche}`)
  if (offerName)    lines.push(`Offer name: ${offerName}`)
  if (offerPromise) lines.push(`Core promise: ${offerPromise}`)
  if (mechanism)    lines.push(`Unique mechanism: ${mechanism}`)
  if (avatar)       lines.push(`Target buyer: ${avatar}`)
  if (price)        lines.push(`Price: ${price}`)
  if (guarantee)    lines.push(`Guarantee: ${guarantee}`)
  if (bonuses)      lines.push(`Bonuses: ${bonuses}`)

  if (scrapedCopy) {
    lines.push(`\nKey copy extracted from offer page:\n${scrapedCopy.slice(0, 1200)}`)
  }

  if (lines.length === 0) {
    lines.push('No offer details provided — write the best copy possible for the niche.')
  }

  return lines.join('\n')
}
