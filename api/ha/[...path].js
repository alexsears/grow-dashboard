export default async function handler(req, res) {
  const HA_URL = process.env.HA_URL;
  const HA_TOKEN = process.env.HA_TOKEN;

  if (!HA_URL || !HA_TOKEN) {
    return res.status(500).json({ error: 'Home Assistant not configured' });
  }

  // Get the path from the catch-all route
  const { path } = req.query;
  const apiPath = Array.isArray(path) ? path.join('/') : path;

  const targetUrl = `${HA_URL}/api/${apiPath}`;

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${HA_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });

    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      const data = await response.json();
      res.status(response.status).json(data);
    } else {
      const text = await response.text();
      res.status(response.status).send(text);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Failed to connect to Home Assistant', details: error.message });
  }
}
