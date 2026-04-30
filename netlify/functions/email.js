export async function handler(event) {
  try {
    const body = event.body ? JSON.parse(event.body) : {}
    const email = body.email

    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No email" })
      }
    }

    // 👉 SEND TO FORGE MAIL
    await fetch("https://mail.nextwaveaisuite.com/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        source: "traffic-engine",
        offer: "nextwave"
      })
    })

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    }

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    }
  }
}
