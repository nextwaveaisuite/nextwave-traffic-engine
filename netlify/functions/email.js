export async function handler(event) {
  try {
    const body = event.body ? JSON.parse(event.body) : {}
    const email = body.email

    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No email provided" })
      }
    }

    // TODO: send to Supabase or email tool API
    console.log("Lead captured:", email)

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
