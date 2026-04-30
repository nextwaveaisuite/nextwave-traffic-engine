export async function handler(event) {
  try {
    const body = event.body ? JSON.parse(event.body) : {}
    const name = body.name || "funnel"
    const link = body.link || "#"

    const url = `https://nextwave-traffic-engine.netlify.app/funnel/${name.replace(/\s/g,'-')}`

    return {
      statusCode: 200,
      body: JSON.stringify({ url })
    }

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    }
  }
}
