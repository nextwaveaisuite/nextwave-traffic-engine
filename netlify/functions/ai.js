export async function handler(event) {
  try {
    const body = event.body ? JSON.parse(event.body) : {}
    const prompt = body.prompt || "default"

    const response = `
AI Funnel for: ${prompt}

Headline: Discover how to win with ${prompt}

Hook: Most people struggle because they lack a system.

CTA: Click to get started.
`

    return {
      statusCode: 200,
      body: JSON.stringify({ result: response })
    }

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    }
  }
}
