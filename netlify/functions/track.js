export async function handler(event){
  const redirect=event.queryStringParameters.redirect
  return {statusCode:302, headers:{Location:redirect}}
}
