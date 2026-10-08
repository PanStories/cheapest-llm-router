// Cheapest-LLM Router — self-managed HTTP entry for Apify Standby.
//
// Listens on APIFY_CONTAINER_PORT (or 3000) and serves the MCP Streamable HTTP
// endpoint at /mcp. Reuses the exact routing core (src/core/router.mjs) as the
// stdio server, so the routing logic is identical and already verified.
//
// Deployment model (Apify webServerMcpPath + Standby):
//   - Dockerfile CMD runs this file; the container keeps a warm HTTP server.
//   - Apify routes https://<user>--<actor>.apify.actor/mcp to this server.
//   - The readiness probe on GET / must return 200 (or the run never goes ready).

import express from 'express';
import { createMcpServer } from './handler.mjs';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { chargeForRequest } from './billing.mjs';

const PORT = Number(process.env.APIFY_CONTAINER_PORT || process.env.PORT || 3000);

const app = express();
app.use(express.json({ limit: '2mb' }));

// Apify readiness probe + service info.
app.get('/', (req, res) => {
  if (req.headers['x-apify-container-server-readiness-probe'] !== undefined) {
    return res.status(200).end();
  }
  res.status(200).json({
    service: 'cheapest-llm-router',
    version: '0.2.2',
    transports: ['streamable-http'],
    endpoints: ['/mcp'],
  });
});

app.get('/healthz', (_req, res) => res.status(200).json({ ok: true }));

// DNS-rebinding / host guard. On Apify the gateway injects a Bearer token and
// assigns a *.apify.actor hostname, so the check is skipped there.
app.use((req, res, next) => {
  if (process.env.APIFY_IS_AT_HOME) return next();
  const host = (req.headers.host || '').split(':')[0];
  const allowed = new Set(['localhost', '127.0.0.1', process.env.APIFY_CONTAINER_HOSTNAME || '']);
  if (host && !allowed.has(host) && !host.endsWith('.apify.actor') && !host.endsWith('.apify.com')) {
    return res.status(403).json({ error: 'Forbidden host' });
  }
  next();
});

// Stateless MCP: a fresh server + transport per request (sessionIdGenerator:
// undefined). This is required for Apify Standby / PPE.
app.all('/mcp', async (req, res) => {
  if (req.method !== 'POST') {
    res.set('Allow', 'POST');
    return res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed. Use POST.' },
      id: null,
    });
  }
  try {
    await chargeForRequest(req.body);
  } catch (e) {
    console.warn('[billing] pre-check error (ignored):', e && e.message);
  }
  try {
    const server = await createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless — required for Apify Standby/PPE
      enableJsonResponse: true,
    });
    res.on('close', () => transport.close().catch(() => {}));
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: `MCP error: ${err && err.message}` },
        id: null,
      });
    }
  }
});

const server = app.listen(PORT, () => {
  console.error(`[cheapest-llm-router] HTTP MCP listening on :${PORT}`);
});

function shutdown(sig) {
  console.error(`[cheapest-llm-router] received ${sig}, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { app, server };
