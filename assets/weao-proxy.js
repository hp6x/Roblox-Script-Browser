// Minimal WEAO proxy without external dependencies
// Usage: node weao-proxy.js (listens on 8787)

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;
const TARGETS = [
  'https://weao.xyz',
  'https://whatexpsare.online',
  'https://whatexploitsaretra.sh',
  'https://weao.gg'
];

function sendJSON(res, status, body) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(text);
}

function handleOptions(req, res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end();
}

async function fetchUpstream(urlStr) {
  return new Promise((resolve) => {
    const url = new URL(urlStr);
    const client = url.protocol === 'http:' ? http : https;

    const req = client.request({
      method: 'GET',
      hostname: url.hostname,
      port: url.port || (url.protocol === 'http:' ? 80 : 443),
      path: url.pathname + url.search,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'WEAO-3PService',
      },
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({ status: res.statusCode || 502, body: data });
      });
    });

    req.on('error', () => resolve({ status: 502, body: '' }));
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'OPTIONS') return handleOptions(req, res);

    const m = url.pathname.match(/^\/api\/versions\/(current|future|past)$/);
    if (!m) {
      return sendJSON(res, 404, { error: 'not_found' });
    }
    const endpoint = m[1];

    for (const base of TARGETS) {
      const upstream = `${base}/api/versions/${endpoint}`;
      const r = await fetchUpstream(upstream);

      if (r.status === 429) {
        // try next target
        continue;
      }

      if (r.status >= 200 && r.status < 300) {
        // Try to ensure it is valid JSON; if not, pass through text
        try {
          const parsed = JSON.parse(r.body);
          return sendJSON(res, 200, parsed);
        } catch {
          return sendJSON(res, 200, r.body);
        }
      }
    }

    return sendJSON(res, 502, { error: 'upstream_unavailable' });
  } catch (e) {
    return sendJSON(res, 500, { error: 'proxy_error' });
  }
});

server.listen(PORT, () => {
  console.log(`[WEAO Proxy] listening on http://localhost:${PORT}`);
});
