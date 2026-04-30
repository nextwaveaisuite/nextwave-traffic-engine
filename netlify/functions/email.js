export async function handler(event){
  const {email}=JSON.parse(event.body)
  console.log("Captured:",email)
  return {statusCode:200, body:"ok"}
}
