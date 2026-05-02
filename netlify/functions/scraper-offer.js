// netlify/functions/scrape-offer.js
// Fetches an affiliate offer page URL and extracts key copy elements
// so the AI can write perfectly congruent funnel copy
// Returns: offer name, promise, mechanism, price, guarantee, key bullets

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const { url } = JSON.parse(event.body || '{}')

    if (!url) {
      return { statusCode: 400, body: JSON.stringify({ error: 'url is required' }) }
    }

    // Validate URL
    let parsedUrl
    try { parsedUrl = new URL(url) } catch {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid URL — must include https://' }) }
    }

    // Fetch the offer page
    const fetchRes = await fetch(parsedUrl.href, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NextWave/1.0; +https://nextwave-traffic-engine.netlify.app)',
        'Accept':     'text/html,application/xhtml+xml'
      },
      signal: AbortSignal.timeout(8000)
    })

    if (!fetchRes.ok) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: false,
          message: `Could not fetch offer page (status ${fetchRes.status}). This is common for pages with bot protection. Enter offer details manually.`
        })
      }
    }

    const html = await fetchRes.text()

    // ── EXTRACT KEY ELEMENTS ─────────────────────────────────────
    // Pull the most valuable conversion copy from the page

    // Strip HTML tags for text extraction
    const stripHtml = str => str.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

    // Extract title
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
    const title      = titleMatch ? stripHtml(titleMatch[1]) : ''

    // Extract meta description
    const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
    const metaDesc  = metaMatch ? metaMatch[1] : ''

    // Extract OG data
    const ogTitle = (html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) || [])[1] || ''
    const ogDesc  = (html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) || [])[1] || ''

    // Extract H1, H2s (usually the headline and subheadlines)
    const h1Match   = html.match(/<h1[^>]*>(.*?)<\/h1>/is)
    const h1        = h1Match ? stripHtml(h1Match[1]).slice(0, 200) : ''
    const h2Matches = [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/gis)].map(m => stripHtml(m[1])).filter(h => h.length > 10 && h.length < 200).slice(0, 5)

    // Look for price patterns
    const pricePatterns = html.match(/\$\d+(?:\.\d{2})?(?:\s*(?:one.time|\/mo|per month|today only))?/gi) || []
    const prices        = [...new Set(pricePatterns)].slice(0, 4)

    // Look for guarantee text
    const guaranteeMatch = html.match(/(\d+)[-\s]*day[s]?\s*(?:money.back|refund|guarantee)/gi) || []
    const guarantee      = guaranteeMatch[0] || ''

    // Extract body text (first 2000 meaningful chars)
    const bodyMatch     = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    const bodyRaw       = bodyMatch ? bodyMatch[1] : html
    const bodyClean     = stripHtml(bodyRaw)
      .replace(/[^\x20-\x7E\n]/g, '')  // ASCII printable only
      .replace(/\s{3,}/g, ' ')
      .slice(0, 2000)

    // Build structured extract
    const extracted = {
      title:     ogTitle || title,
      headline:  h1,
      subheads:  h2Matches,
      metaDesc:  ogDesc || metaDesc,
      prices,
      guarantee,
      bodyText:  bodyClean
    }

    // Build summary for Claude
    const summary = buildSummary(extracted)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success:     true,
        extracted,
        summary,
        message: 'Offer page analysed. Key details extracted and pre-filled below.'
      })
    }

  } catch (err) {
    console.error('scrape-offer error:', err)

    // Scraping failed — return graceful fallback
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: false,
        message: 'Could not automatically extract offer details. This is common for pages with bot protection or JavaScript rendering. Please fill in the offer details manually — the more you provide, the more congruent your funnel copy will be.'
      })
    }
  }
}

function buildSummary(extracted) {
  const parts = []
  if (extracted.title)              parts.push(`Page title: ${extracted.title}`)
  if (extracted.headline)           parts.push(`Main headline: ${extracted.headline}`)
  if (extracted.subheads?.length)   parts.push(`Subheadlines: ${extracted.subheads.join(' | ')}`)
  if (extracted.metaDesc)           parts.push(`Description: ${extracted.metaDesc}`)
  if (extracted.prices?.length)     parts.push(`Prices found: ${extracted.prices.join(', ')}`)
  if (extracted.guarantee)          parts.push(`Guarantee: ${extracted.guarantee}`)
  if (extracted.bodyText)           parts.push(`Page content excerpt: ${extracted.bodyText.slice(0, 800)}`)
  return parts.join('\n')
}
