export async function handler(event){
  const {name,link}=JSON.parse(event.body)
  const url="https://yourdomain.netlify.app/"+name.replace(/\s/g,'-')
  return {statusCode:200, body: JSON.stringify({url})}
}
