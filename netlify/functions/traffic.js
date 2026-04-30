export async function handler(){
  const posts=["Post 1","Post 2","Post 3"]
  return {statusCode:200, body: JSON.stringify(posts)}
}
