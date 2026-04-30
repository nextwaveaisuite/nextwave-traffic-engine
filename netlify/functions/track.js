import { supabase } from "../../supabase.js"

export const handler = async () => {

  await supabase.from("events").insert([
    { type: "conversion", value: 10 }
  ])

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true })
  }
}
