// MCP protocol smoke test: spawns the stdio server, performs initialize ->
// tools/list -> tools/call(route), and asserts the wire format is correct.
// Run: `node scripts/mcp-smoke.mjs`
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER = join(__dirname, '..', 'src', 'server.mjs');

function rpc(child, method, params, id) {
  return new Promise((resolve, reject) => {
    const onLine = (line) => {
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        return;
      }
      if (msg.id === id) {
        child.stdout.off('data', onData);
        resolve(msg);
      }
    };
    const onData = (buf) => {
      const text = buf.toString();
      for (const l of text.split('\n')) if (l.trim()) onLine(l);
    };
    child.stdout.on('data', onData);
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), 5000);
  });
}

const child = spawn('node', [SERVER], { stdio: ['pipe', 'pipe', 'inherit'] });

try {
  const init = await rpc(child, 'initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'smoke', version: '1.0.0' },
  }, 1);
  assert.equal(init.result.serverInfo.name, 'cheapest-llm-router');
  console.log('[ok] initialize ->', init.result.serverInfo.name, init.result.serverInfo.version);

  const list = await rpc(child, 'tools/list', {}, 2);
  assert.equal(list.result.tools.length, 4);
  const names = list.result.tools.map((t) => t.name).sort();
  console.log('[ok] tools/list ->', names.join(', '));
  assert.deepEqual(names, ['cache_route', 'cost_compare', 'list_models', 'route']);

  const call = await rpc(
    child,
    'tools/call',
    { name: 'route', arguments: { prompt: '用中文总结这篇研报的核心观点', required_capabilities: ['chinese', 'reasoning'] } },
    3
  );
  const payload = JSON.parse(call.result.content[0].text);
  assert.equal(payload.ok, true);
  assert.equal(payload.chosen.free, true);
  assert.equal(payload.estimated_cost_usd, 0);
  console.log('[ok] tools/call(route) ->', payload.chosen.name, '| cost $0 |', payload.fallback_chain.length, 'fallbacks');

  const cc = await rpc(
    child,
    'tools/call',
    { name: 'cost_compare', arguments: { prompt: 'write a 200-line parser', max_output_tokens: 4096 } },
    4
  );
  const ccPayload = JSON.parse(cc.result.content[0].text);
  assert.ok(ccPayload.comparisons.length >= 5);
  console.log('[ok] tools/call(cost_compare) ->', ccPayload.comparisons.length, 'models ranked, max savings $' + ccPayload.max_savings_usd);

  console.log('\nALL MCP SMOKE CHECKS PASSED');
  child.kill();
  process.exit(0);
} catch (err) {
  console.error('SMOKE FAILED:', err.message);
  child.kill();
  process.exit(1);
}
