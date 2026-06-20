const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  url.hostname = env.LINKDING_HOST;
  const headers = new Headers(request.headers);
  headers.set("Host", env.LINKDING_HOST);

  const res = await fetch(url.toString(), { headers });
  const resHeaders = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) resHeaders.set(k, v);

  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: resHeaders });
}
