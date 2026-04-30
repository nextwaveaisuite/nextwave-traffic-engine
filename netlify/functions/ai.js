export async function handler(event){
  const {prompt}=JSON.parse(event.body)
  return {statusCode:200, body: JSON.stringify({result:`AI Funnel for ${prompt}`})}
}
