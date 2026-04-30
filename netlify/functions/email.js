import { supabase } from "../../supabase.js";

export const handler = async (event) => {

  const body = JSON.parse(event.body || "{}");
  const email = body.email;
  const funnel = body.funnel || "default";

  if (!email) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "No email" })
    };
  }

  /* 1. Save lead to Supabase */
  await supabase.from("leads").insert([
    { email, funnel_id: funnel }
  ]);

  await supabase.from("events").insert([
    { type: "lead", value: 1 }
  ]);

  /* 2. Send to Forge Mail */
  try {
    await fetch("https://mail.nextwaveaisuite.com/api/leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.FORGE_MAIL_API_KEY}`
      },
      body: JSON.stringify({
        email,
        list: "nextwave-revenue-os",
        tags: [funnel]
      })
    });
  } catch (e) {
    console.log("Forge Mail failed:", e);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true })
  };
};
