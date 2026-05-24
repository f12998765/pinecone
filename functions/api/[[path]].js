export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  url.hostname = env.LINKDING_HOST;
  const headers = new Headers(request.headers);
  headers.set('Host', env.LINKDING_HOST);
  return fetch(url.toString(), { headers });
}