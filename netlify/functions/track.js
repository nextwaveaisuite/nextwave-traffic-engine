import { supabase } from "../../supabase.js";

export const handler = async (event) => {

  const body = JSON.parse(event.body || "{}");
  const email = body.email || null;

  await supabase.from("events").insert([
    { type: "conversion", value: 10 }
  ]);

  /* OPTIONAL: notify Forge Mail of conversion */
  if (email) {
    try {
      await fetch("https://mail.nextwaveaisuite.com/api/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.FORGE_MAIL_API_KEY}`
        },
        body: JSON.stringify({
          email,
          event: "conversion"
        })
      });
    } catch (e) {}
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true })
  };
};
