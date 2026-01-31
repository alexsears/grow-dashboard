export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  const HA_URL = process.env.HA_URL;
  const HA_TOKEN = process.env.HA_TOKEN;

  if (!HA_URL || !HA_TOKEN) {
    return new Response(JSON.stringify({
      error: 'Home Assistant not configured',
      hasUrl: !!HA_URL,
      hasToken: !!HA_TOKEN
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(request.url);
  const apiPath = url.searchParams.get('path') || '';
  const targetUrl = `${HA_URL}/api/${apiPath}`;

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        'Authorization': `Bearer ${HA_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: request.method !== 'GET' ? await request.text() : undefined,
    });

    const data = await response.text();
    const contentType = response.headers.get('content-type') || 'text/plain';

    return new Response(data, {
      status: response.status,
      headers: { 'Content-Type': contentType }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to connect to Home Assistant',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
