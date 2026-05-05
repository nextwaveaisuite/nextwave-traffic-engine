// netlify/functions/scrape-offer.js
// Level 3 scraper — follows redirects including Wave Links (wvlnk.io/l/xxx)
// Extracts deep offer page content for congruent AI copy generation
//
// HANDLES:
// - Wave Links: wvlnk.io/l/xxx → follows redirect to real offer
// - Direct affiliate URLs: clickbank, jvzoo, warriorplus etc
// - Extracts: headline, subheads, price, guarantee, bonuses, bullets, mechanism

import { supabase } from './_supabase.js'

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const { url } = JSON.parse(event.body || '{}')
    if (!url) return { statusCode: 400, body: JSON.stringify({ error: 'url is required' }) }

    let parsedUrl
    try { parsedUrl = new URL(url) } catch {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid URL — must include https://' }) }
    }

    // ── STEP 1: RESOLVE WAVE LINK REDIRECTS ──────────────
    // If this is a Wave Link (wvlnk.io/l/ or nextwave.../l/) follow the redirect
    let finalUrl     = parsedUrl.href
    let resolvedFrom = null

    const isWaveLink = parsedUrl.hostname === 'wvlnk.io'
      || parsedUrl.hostname === 'nextwave-traffic-engine.netlify.app'
      || parsedUrl.hostname === 'traffic.nextwaveaisuite.com'

    if (isWaveLink && parsedUrl.pathname.startsWith('/l/')) {
      // Extract slug from Wave Link
      const slug = parsedUrl.pathname.replace('/l/', '').split('/')[0]

      // Look up original URL in Supabase links table
      const { data: linkRow } = await supabase
        .from('links')
        .select('original_url, label')
        .eq('slug', slug)
        .maybeSingle()

      if (linkRow?.original_url) {
        resolvedFrom = finalUrl
        finalUrl     = linkRow.original_url
        console.log('Wave Link resolved:', resolvedFrom, '→', finalUrl)
      } else {
        // Wave Link not in DB — try HTTP follow
        try {
          const headRes = await fetch(finalUrl, {
            method:   'HEAD',
            redirect: 'follow',
            signal:   AbortSignal.timeout(5000)
          })
          if (headRes.url && headRes.url !== finalUrl) {
            resolvedFrom = finalUrl
            finalUrl     = headRes.url
          }
        } catch(e) {
          console.warn('HEAD redirect follow failed:', e.message)
        }
      }
    }

    // ── STEP 2: FETCH OFFER PAGE ──────────────────────────
    let html = ''
    try {
      const fetchRes = await fetch(finalUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
          'Accept':     'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        },
        redirect: 'follow',
        signal:   AbortSignal.timeout(8000)
      })

      if (!fetchRes.ok) {
        return {
          statusCode: 200,
          body: JSON.stringify({
            success:      false,
            resolvedFrom,
            resolvedTo:   finalUrl,
            message:      `Offer page returned status ${fetchRes.status}. Some pages block automated requests. Fill in offer details manually for best results.`
          })
        }
      }

      html = await fetchRes.text()
    } catch(e) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success:    false,
          resolvedTo: finalUrl,
          message:    'Could not reach offer page. Fill in offer details manually — the more specific you are, the more congruent your copy will be.'
        })
      }
    }

    // ── STEP 3: DEEP CONTENT EXTRACTION ──────────────────
    const strip  = s => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    const clean  = s => s.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim()

    // Title and meta
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
    const title      = titleMatch ? strip(titleMatch[1]).slice(0,120) : ''

    const ogTitle = (html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)/i)||[])[1] || ''
    const ogDesc  = (html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)/i)||[])[1] || ''
    const metaDesc= (html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)/i)||[])[1] || ''

    // Headlines
    const h1s = [...html.matchAll(/<h1[^>]*>(.*?)<\/h1>/gis)].map(m => strip(m[1])).filter(h => h.length > 5 && h.length < 250).slice(0,3)
    const h2s = [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/gis)].map(m => strip(m[1])).filter(h => h.length > 5 && h.length < 200).slice(0,6)
    const h3s = [...html.matchAll(/<h3[^>]*>(.*?)<\/h3>/gis)].map(m => strip(m[1])).filter(h => h.length > 5 && h.length < 150).slice(0,6)

    // Bullet points — strong conversion signals
    const bullets = [...html.matchAll(/<li[^>]*>(.*?)<\/li>/gis)]
      .map(m => strip(m[1]))
      .filter(b => b.length > 10 && b.length < 200)
      .slice(0, 10)

    // Price patterns
    const pricePatterns = html.match(/\$[\d,]+(?:\.\d{2})?(?:\s*(?:one.time|\/mo|per month|today|only|now))?/gi) || []
    const prices        = [...new Set(pricePatterns)].slice(0, 5)

    // Guarantee patterns
    const guaranteeMatches = html.match(/(\d+)[-\s]*day[s]?\s*(?:money.back|refund|guarantee|trial)/gi) || []
    const guarantee        = guaranteeMatches[0] || ''

    // Bonus sections
    const bonusMatches = [...html.matchAll(/bonus\s*#?\s*\d+[:\s]+([^<\n]{10,100})/gi)].map(m => m[1].trim()).slice(0,5)

    // CTA buttons — reveal offer positioning
    const ctaMatches = [...html.matchAll(/(?:value=|>)\s*([^<"]{5,60}(?:now|today|free|access|get|buy|order|claim)[^<"]{0,40})/gi)]
      .map(m => clean(m[1])).filter(c => c.length > 5).slice(0,4)

    // Body text — first 2500 meaningful characters
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    const bodyClean = bodyMatch
      ? clean(strip(bodyMatch[1])).slice(0, 2500)
      : clean(strip(html)).slice(0, 2500)

    const extracted = {
      url:       finalUrl,
      title:     ogTitle || title,
      headline:  h1s[0]  || '',
      h1s, h2s, h3s,
      metaDesc:  ogDesc  || metaDesc,
      bullets,
      prices,
      guarantee,
      bonuses:   bonusMatches,
      ctas:      ctaMatches,
      bodyText:  bodyClean
    }

    // ── STEP 4: BUILD AI BRIEF ────────────────────────────
    const summary = buildSummary(extracted)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success:     true,
        resolvedFrom,
        resolvedTo:  finalUrl,
        extracted,
        summary,
        message:     resolvedFrom
          ? `Wave Link resolved to offer page and analysed successfully.`
          : `Offer page analysed. Key details extracted — review and fill any gaps.`
      })
    }

  } catch(err) {
    console.error('scrape-offer error:', err)
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: false,
        message: 'Could not extract offer details. Fill in manually for best results.'
      })
    }
  }
}

function buildSummary({ title, headline, h1s, h2s, h3s, metaDesc, bullets, prices, guarantee, bonuses, ctas, bodyText }) {
  const parts = []
  if (title)           parts.push(`Page title: ${title}`)
  if (headline)        parts.push(`Main headline: ${headline}`)
  if (h1s?.length)     parts.push(`H1 headlines: ${h1s.join(' | ')}`)
  if (h2s?.length)     parts.push(`Subheadlines: ${h2s.join(' | ')}`)
  if (h3s?.length)     parts.push(`Supporting heads: ${h3s.join(' | ')}`)
  if (metaDesc)        parts.push(`Description: ${metaDesc}`)
  if (bullets?.length) parts.push(`Bullet points: ${bullets.join(' | ')}`)
  if (prices?.length)  parts.push(`Prices found: ${prices.join(', ')}`)
  if (guarantee)       parts.push(`Guarantee: ${guarantee}`)
  if (bonuses?.length) parts.push(`Bonuses: ${bonuses.join(' | ')}`)
  if (ctas?.length)    parts.push(`CTA copy: ${ctas.join(' | ')}`)
  if (bodyText)        parts.push(`Page content:\n${bodyText.slice(0, 1500)}`)
  return parts.join('\n')
}
