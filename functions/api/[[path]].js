const ALLOWED_PATH_PREFIXES = ['/api/bookmarks', '/api/tags', '/api/user_profile', '/api/asset', '/api/bundles'];

export async function onRequest({ request, env }) {
  if (!env.LINKDING_HOST) {
    return new Response('Server misconfigured: LINKDING_HOST is not set', { status: 500 });
  }
  const url = new URL(request.url);
  if (!ALLOWED_PATH_PREFIXES.some(p => url.pathname === p || url.pathname.startsWith(p + '/'))) {
    return new Response('Not Found', { status: 404 });
  }
  let target;
  try {
    target = new URL(`${url.protocol}//${env.LINKDING_HOST}${url.pathname}${url.search}`);
  } catch {
    return new Response('Invalid LINKDING_HOST', { status: 500 });
  }
  const headers = new Headers(request.headers);
  headers.set('Host', env.LINKDING_HOST);
  return fetch(target.toString(), { headers });
}