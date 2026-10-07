#!/usr/bin/env node
// Stage 2 competitor teardown: spawn an npx MCP server over stdio, do
// initialize -> tools/list -> one tools/call, print everything.
// Usage: node probe-stdio.mjs <pkg> [toolName] [jsonArgs]
import { spawn } from 'node:child_process';

const pkg = process.argv[2];
const toolName = process.argv[3] || null;
const toolArgs = process.argv[4] ? JSON.parse(process.argv[4]) : {};

const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const child = spawn(NPX, ['-y', pkg], {
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: process.platform === 'win32',
});
let buf = '';
const pending = new Map();
let nextId = 1;

child.stdout.on('data', (d) => {
  buf += d.toString();
  let idx;
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});
child.stderr.on('data', (d) => process.stderr.write(`[stderr] ${d}`));

function rpc(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout ${method}`)), 60000);
    pending.set(id, (m) => { clearTimeout(t); resolve(m); });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  const init = await rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'nurture-probe', version: '1.0' },
  });
  console.log('== initialize ==');
  console.log(JSON.stringify(init.result?.serverInfo ?? init, null, 1));
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  await sleep(300);

  const list = await rpc('tools/list', {});
  const tools = list.result?.tools ?? [];
  console.log(`\n== tools/list (${tools.length}) ==`);
  for (const t of tools) {
    console.log(`- ${t.name}: ${(t.description || '').slice(0, 150)}`);
    console.log(`    required: ${JSON.stringify(t.inputSchema?.required ?? [])}`);
  }

  if (toolName) {
    console.log(`\n== tools/call ${toolName} ${JSON.stringify(toolArgs)} ==`);
    const r = await rpc('tools/call', { name: toolName, arguments: toolArgs });
    const txt = r.result?.content?.[0]?.text ?? JSON.stringify(r.result ?? r.error);
    console.log(String(txt).slice(0, 1200));
  }
} catch (e) {
  console.error('FAILED:', e.message);
} finally {
  child.kill();
  process.exit(0);
}
