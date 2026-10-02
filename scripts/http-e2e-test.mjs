// Local HTTP end-to-end test for the Streamable HTTP MCP transport.
// Starts src/http.mjs on a test port, then runs initialize -> tools/list ->
// tools/call(route). Run: `PORT=3100 node scripts/http-e2e-test.mjs`
import { setTimeout as sleep } from 'node:timers/promises';

process.env.PORT = process.env.PORT || '3100';
const BASE = `http://127.0.0.1:${process.env.PORT}`;
const HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json, text/event-stream',
};

async function rpc(method, params, id) {
  const r = await fetch(`${BASE}/mcp`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${text}`);
  if (r.headers.get('content-type')?.includes('application/json')) return JSON.parse(text);
  return text;
}

async function main() {
  await import('../src/http.mjs'); // starts listening on PORT
  await sleep(500);

  const root = await fetch(`${BASE}/`);
  if (root.status !== 200) throw new Error(`readiness GET / returned ${root.status}`);
  console.log('[ok] GET / ->', root.status, '(readiness probe ready)');

  const init = await rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'http-e2e', version: '1.0.0' },
  }, 1);
  console.log('[ok] initialize ->', init.result.serverInfo.name, init.result.serverInfo.version);

  const list = await rpc('tools/list', {}, 2);
  const names = list.result.tools.map((t) => t.name).sort();
  console.log('[ok] tools/list ->', names.join(', '));
  if (list.result.tools.length !== 4 || JSON.stringify(names) !== JSON.stringify(['cache_route', 'cost_compare', 'list_models', 'route'])) {
    throw new Error('expected exactly 4 tools: route, cost_compare, list_models, cache_route');
  }

  const call = await rpc('tools/call', {
    name: 'route',
    arguments: { prompt: '用中文总结这份研报的核心观点', required_capabilities: ['chinese', 'reasoning'] },
  }, 3);
  const payload = JSON.parse(call.result.content[0].text);
  console.log('[ok] tools/call(route) ->', payload.chosen.name, '| cost $' + payload.estimated_cost_usd, '|', payload.fallback_chain.length, 'fallbacks');
  if (!payload.ok || payload.chosen.free !== true) throw new Error('route did not resolve a free model');

  const cc = await rpc('tools/call', {
    name: 'cost_compare',
    arguments: { prompt: 'write a 200-line parser', max_output_tokens: 4096 },
  }, 4);
  const ccPayload = JSON.parse(cc.result.content[0].text);
  console.log('[ok] tools/call(cost_compare) ->', ccPayload.comparisons.length, 'models ranked, max savings $' + ccPayload.max_savings_usd);
  if (ccPayload.comparisons.length < 5) throw new Error('cost_compare returned too few models');

  console.log('\nALL HTTP E2E CHECKS PASSED');
  process.exit(0);
}

main().catch((e) => {
  console.error('HTTP E2E FAILED:', e.message);
  process.exit(1);
});
