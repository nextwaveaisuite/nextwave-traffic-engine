// netlify/functions/scrape-offer.js
// Fetches affiliate offer page and extracts key copy elements
// Follows redirects including Wave Links (wvlnk.io/l/xxx)
// No Supabase dependency — pure HTTP fetch and parse

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const { url } = JSON.parse(event.body || '{}')

    if (!url) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'url is required' })
      }
    }

    // Validate URL
    let parsedUrl
    try {
      parsedUrl = new URL(url)
    } catch {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid URL — must start with https://' })
      }
    }

    // ── STEP 1: FOLLOW REDIRECTS ──────────────────────────
    // Wave Links and cloaked URLs need to be followed to the real offer page
    let finalUrl     = parsedUrl.href
    let resolvedFrom = null

    try {
      const headRes = await fetch(parsedUrl.href, {
        method:   'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(8000)
      })

      // If the final URL is different from what was passed, we followed a redirect
      if (headRes.url && headRes.url !== parsedUrl.href) {
        resolvedFrom = parsedUrl.href
        finalUrl     = headRes.url
        console.log('Redirect followed:', resolvedFrom, '→', finalUrl)
      }

      // ── STEP 2: EXTRACT CONTENT FROM FINAL PAGE ──────────
      const html = await headRes.text()

      if (!html || html.length < 100) {
        return {
          statusCode: 200,
          body: JSON.stringify({
            success:    false,
            resolvedTo: finalUrl,
            message:    'Page returned empty content. Fill in offer details manually.'
          })
        }
      }

      const extracted = extractFromHtml(html, finalUrl)

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success:     true,
          resolvedFrom,
          resolvedTo:  finalUrl,
          extracted,
          summary:     buildSummary(extracted),
          message:     resolvedFrom
            ? 'Wave Link resolved and offer page analysed.'
            : 'Offer page analysed successfully.'
        })
      }

    } catch (fetchErr) {
      console.warn('Fetch error:', fetchErr.message)
      return {
        statusCode: 200,
        body: JSON.stringify({
          success:    false,
          resolvedTo: finalUrl,
          message:    'Could not reach the offer page (' + fetchErr.message + '). Fill in offer details manually for best results.'
        })
      }
    }

  } catch (err) {
    console.error('scrape-offer error:', err.message)
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: false,
        message: 'Extraction failed. Fill in offer details manually.'
      })
    }
  }
}

// ── EXTRACT KEY ELEMENTS FROM HTML ───────────────────────
function extractFromHtml(html, url) {
  const strip = s => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const clean = s => s.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim()

  // Title
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
  const title      = titleMatch ? strip(titleMatch[1]).slice(0, 120) : ''

  // OG tags
  const ogTitle = (html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)/i)   || [])[1] || ''
  const ogDesc  = (html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)/i) || [])[1] || ''
  const metaDesc= (html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)/i)     || [])[1] || ''

  // Headlines
  const h1s = [...html.matchAll(/<h1[^>]*>(.*?)<\/h1>/gis)]
    .map(m => strip(m[1])).filter(h => h.length > 5 && h.length < 300).slice(0, 3)

  const h2s = [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/gis)]
    .map(m => strip(m[1])).filter(h => h.length > 5 && h.length < 200).slice(0, 6)

  const h3s = [...html.matchAll(/<h3[^>]*>(.*?)<\/h3>/gis)]
    .map(m => strip(m[1])).filter(h => h.length > 5 && h.length < 150).slice(0, 6)

  // List items / bullets
  const bullets = [...html.matchAll(/<li[^>]*>(.*?)<\/li>/gis)]
    .map(m => strip(m[1]))
    .filter(b => b.length > 10 && b.length < 200)
    .slice(0, 10)

  // Prices
  const priceMatches = html.match(/\$[\d,]+(?:\.\d{2})?/gi) || []
  const prices       = [...new Set(priceMatches)].slice(0, 5)

  // Guarantee
  const gMatches  = html.match(/(\d+)[-\s]*day[s]?\s*(?:money.back|refund|guarantee)/gi) || []
  const guarantee = gMatches[0] || ''

  // Bonuses
  const bonusMatches = [...html.matchAll(/bonus\s*#?\s*\d+[:\s]+([^<\n]{10,100})/gi)]
    .map(m => m[1].trim()).slice(0, 5)

  // Body text
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const bodyClean = clean(strip(bodyMatch ? bodyMatch[1] : html)).slice(0, 2000)

  return {
    url,
    title:    ogTitle || title,
    headline: h1s[0]  || '',
    h1s, h2s, h3s,
    metaDesc: ogDesc  || metaDesc,
    bullets,
    prices,
    guarantee,
    bonuses:  bonusMatches,
    bodyText: bodyClean
  }
}

function buildSummary(e) {
  const parts = []
  if (e.title)           parts.push('Page title: ' + e.title)
  if (e.headline)        parts.push('Main headline: ' + e.headline)
  if (e.h1s?.length)     parts.push('H1: ' + e.h1s.join(' | '))
  if (e.h2s?.length)     parts.push('Subheadlines: ' + e.h2s.join(' | '))
  if (e.metaDesc)        parts.push('Description: ' + e.metaDesc)
  if (e.bullets?.length) parts.push('Bullets: ' + e.bullets.join(' | '))
  if (e.prices?.length)  parts.push('Prices: ' + e.prices.join(', '))
  if (e.guarantee)       parts.push('Guarantee: ' + e.guarantee)
  if (e.bonuses?.length) parts.push('Bonuses: ' + e.bonuses.join(' | '))
  if (e.bodyText)        parts.push('Page content:\n' + e.bodyText.slice(0, 1500))
  return parts.join('\n')
}
