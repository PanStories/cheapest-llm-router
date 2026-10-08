// Integration test: connect to the MCP server over InMemoryTransport and
// exercise every tool + assert the four tool annotations (M8ven / OpenAI gate).
// Run: `node --test tests/`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../src/handler.mjs';

const TOOL_NAMES = ['route', 'cost_compare', 'list_models', 'cache_route'];
const EXPECTED_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

test('all four tools are registered with complete boolean annotations', async () => {
  const server = await createMcpServer();
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await server.connect(serverT);
  const client = new Client({ name: 'tools-test', version: '1.0.0' });
  await client.connect(clientT);

  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names, [...TOOL_NAMES].sort(), 'all 4 tools listed');

  for (const t of tools) {
    assert.equal(typeof t.annotations?.readOnlyHint, 'boolean', `${t.name}.readOnlyHint is boolean`);
    assert.equal(typeof t.annotations?.destructiveHint, 'boolean', `${t.name}.destructiveHint is boolean`);
    assert.equal(typeof t.annotations?.idempotentHint, 'boolean', `${t.name}.idempotentHint is boolean`);
    assert.equal(typeof t.annotations?.openWorldHint, 'boolean', `${t.name}.openWorldHint is boolean`);
    assert.deepEqual(
      {
        readOnlyHint: t.annotations.readOnlyHint,
        destructiveHint: t.annotations.destructiveHint,
        idempotentHint: t.annotations.idempotentHint,
        openWorldHint: t.annotations.openWorldHint,
      },
      EXPECTED_ANNOTATIONS,
      `${t.name} carries the canonical read-only hint set`,
    );
  }

  await client.close();
  await server.close();
});

test('each tool is callable end-to-end', async () => {
  const server = await createMcpServer();
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await server.connect(serverT);
  const client = new Client({ name: 'tools-test', version: '1.0.0' });
  await client.connect(clientT);

  const route = await client.callTool({ name: 'route', arguments: { prompt: 'Summarize this report' } });
  assert.ok(route.content?.[0]?.text, 'route returns content');

  const cmp = await client.callTool({
    name: 'cost_compare',
    arguments: { prompt: 'write code', max_output_tokens: 256 },
  });
  assert.ok(cmp.content?.[0]?.text, 'cost_compare returns content');

  const list = await client.callTool({ name: 'list_models', arguments: { free_only: true } });
  assert.ok(list.content?.[0]?.text, 'list_models returns content');

  const cache = await client.callTool({ name: 'cache_route', arguments: { prompt: 'cache this' } });
  assert.ok(cache.content?.[0]?.text, 'cache_route returns content');

  await client.close();
  await server.close();
});
