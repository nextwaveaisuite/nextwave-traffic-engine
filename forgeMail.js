const FORGE_MAIL_API_KEY = "YOUR_FORGE_MAIL_API_KEY";
const FORGE_MAIL_URL = "https://mail.nextwaveaisuite.com/api"; // adjust if needed

export async function sendToForgeMail(email, funnelName) {

  try {
    const res = await fetch(`${FORGE_MAIL_URL}/leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${FORGE_MAIL_API_KEY}`
      },
      body: JSON.stringify({
        email: email,
        list: "nextwave-revenue-os",
        tags: [funnelName || "default"]
      })
    });

    return await res.json();

  } catch (err) {
    console.error("Forge Mail error:", err);
  }
}
