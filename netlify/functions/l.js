import { supabase } from "../../supabase.js";

export const handler = async (event) => {

  const slug = event.path.split("/").pop();

  const { data } = await supabase
    .from("links")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!data) {
    return {
      statusCode: 404,
      body: "Link not found"
    };
  }

  await supabase
    .from("links")
    .update({ clicks: data.clicks + 1 })
    .eq("slug", slug);

  return {
    statusCode: 302,
    headers: {
      Location: data.original_url
    }
  };
};
