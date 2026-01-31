const https = require('https');

module.exports = async function handler(req, res) {
  const HA_URL = process.env.HA_URL;
  const HA_TOKEN = process.env.HA_TOKEN;

  if (!HA_URL || !HA_TOKEN) {
    return res.status(500).json({
      error: 'Home Assistant not configured',
      hasUrl: !!HA_URL,
      hasToken: !!HA_TOKEN
    });
  }

  const apiPath = req.query.path || '';
  const url = new URL(`/api/${apiPath}`, HA_URL);

  const options = {
    hostname: url.hostname,
    port: 443,
    path: url.pathname,
    method: req.method,
    headers: {
      'Authorization': `Bearer ${HA_TOKEN}`,
      'Content-Type': 'application/json',
    },
  };

  return new Promise((resolve) => {
    const proxyReq = https.request(options, (proxyRes) => {
      let data = '';
      proxyRes.on('data', (chunk) => { data += chunk; });
      proxyRes.on('end', () => {
        const contentType = proxyRes.headers['content-type'] || '';
        if (contentType.includes('application/json')) {
          try {
            res.status(proxyRes.statusCode).json(JSON.parse(data));
          } catch {
            res.status(proxyRes.statusCode).send(data);
          }
        } else {
          res.status(proxyRes.statusCode).send(data);
        }
        resolve();
      });
    });

    proxyReq.on('error', (error) => {
      console.error('Proxy error:', error);
      res.status(500).json({ error: 'Failed to connect to Home Assistant', details: error.message });
      resolve();
    });

    if (req.method !== 'GET' && req.body) {
      proxyReq.write(JSON.stringify(req.body));
    }
    proxyReq.end();
  });
};
