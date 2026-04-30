import { supabase } from "../../supabase.js";

export const handler = async (event) => {

  const { url, slug } = JSON.parse(event.body || "{}");

  if (!url) {
    return { statusCode: 400, body: "Missing URL" };
  }

  const finalSlug = slug || Math.random().toString(36).substring(2, 8);

  const { data } = await supabase.from("links").insert([
    {
      slug: finalSlug,
      original_url: url
    }
  ]).select();

  return {
    statusCode: 200,
    body: JSON.stringify({
      short_link: `https://nextwave-traffic-engine.netlify.app/l/${finalSlug}`,
      data
    })
  };
};
