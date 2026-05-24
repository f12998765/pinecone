export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  url.hostname = env.LINKDING_HOST;
  return fetch(url.toString(), { headers: request.headers });
}