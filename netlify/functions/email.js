export async function handler(event) {
  try {
    const body = event.body ? JSON.parse(event.body) : {}
    const email = body.email || "none"

    console.log("Captured email:", email)

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
