const https = require('https');

module.exports = async function handler(req, res) {
  try {
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

    // Parse the HA_URL
    let parsedUrl;
    try {
      parsedUrl = new URL(HA_URL);
    } catch (e) {
      return res.status(500).json({ error: 'Invalid HA_URL', details: e.message });
    }

    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: `/api/${apiPath}`,
      method: req.method || 'GET',
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
          res.setHeader('Content-Type', contentType);
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
        res.status(500).json({ error: 'Proxy request failed', details: error.message });
        resolve();
      });

      if (req.method !== 'GET' && req.body) {
        proxyReq.write(JSON.stringify(req.body));
      }
      proxyReq.end();
    });
  } catch (error) {
    return res.status(500).json({ error: 'Handler error', details: error.message, stack: error.stack });
  }
};
