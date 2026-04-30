import { supabase } from "../../supabase.js"

export const handler = async (event) => {

  const { email } = JSON.parse(event.body || "{}")

  if (!email) {
    return { statusCode: 400, body: "No email" }
  }

  await supabase.from("leads").insert([{ email }])

  await supabase.from("events").insert([
    { type: "lead", value: 1 }
  ])

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true })
  }
}
