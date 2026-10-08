#!/usr/bin/env node
// Cheapest-LLM Router — zero-dependency MCP server (stdio transport).
//
// Implements the Model Context Protocol JSON-RPC surface by hand so the server
// runs with plain `node` — no SDK install required. Exposes four tools:
//   route         — pick the cheapest reachable model + fallback chain
//   cost_compare  — ranked cost report across all reachable models
//   list_models   — filtered registry listing
//   cache_route   — route with an in-process cache (monetization demo)
//
// Logs go to stderr; stdout is reserved strictly for newline-delimited JSON-RPC.

import { createInterface } from 'node:readline';
import {
  route,
  costCompare,
  listModels,
  RouteCache,
} from './core/router.mjs';

const SERVER_NAME = 'cheapest-llm-router';
const SERVER_VERSION = '0.2.2';
const PROTOCOL_VERSION = '2025-06-18';

const cache = new RouteCache();

const TOOLS = [
  {
    name: 'route',
    description:
      'Given a prompt, pick a reachable model by cost (free tiers first, then the lowest-cost paid option). Returns the chosen model, estimated cost (USD + CNY), a fallback chain, reasoning, and the saving vs the priciest reachable model. Draws from a curated registry of provider models (Kimi K2.6, Qwen, DeepSeek, Cloudflare Workers AI, Groq, Gemini, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'The task prompt to route. Token estimate is derived from it.' },
        max_output_tokens: { type: 'integer', default: 512, description: 'Expected output tokens for cost estimation.' },
        required_capabilities: {
          type: 'array',
          items: { type: 'string', enum: ['text', 'code', 'reasoning', 'vision', 'chinese', 'long_context', 'tool_use'] },
          description: 'Capabilities the model must support, e.g. ["chinese","reasoning"].',
        },
        region: { type: 'string', enum: ['global', 'CN'], default: 'global', description: 'CN = mainland-accessible without VPN.' },
        priority: { type: 'string', enum: ['cost', 'latency', 'quality'], default: 'cost', description: 'Routing objective.' },
        include_paid: { type: 'boolean', default: true, description: 'Allow paid models as fallback when no free model fits.' },
      },
      required: ['prompt'],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'cost_compare',
    description:
      'Rank every reachable model by estimated cost for a given prompt size. Produces a cost-comparison report including the maximum saving vs the most expensive reachable model.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'The task prompt to size.' },
        max_output_tokens: { type: 'integer', default: 512 },
        required_capabilities: { type: 'array', items: { type: 'string' } },
        region: { type: 'string', enum: ['global', 'CN'], default: 'global' },
      },
      required: ['prompt'],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'list_models',
    description: 'List the curated model registry with optional filters (capability / region / free-only).',
    inputSchema: {
      type: 'object',
      properties: {
        capability: { type: 'string', description: 'Filter by capability, e.g. "vision".' },
        region: { type: 'string', enum: ['global', 'CN'], description: 'Filter by region.' },
        free_only: { type: 'boolean', default: false, description: 'Only free-tier models.' },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'cache_route',
    description:
      'Same as route, but checks an in-process cache first. Repeated identical requests return the cached plan with cached=true. A persistent per-account cache is a hosted paid feature.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        max_output_tokens: { type: 'integer', default: 512 },
        required_capabilities: { type: 'array', items: { type: 'string' } },
        region: { type: 'string', enum: ['global', 'CN'], default: 'global' },
        priority: { type: 'string', enum: ['cost', 'latency', 'quality'], default: 'cost' },
        include_paid: { type: 'boolean', default: true },
      },
      required: ['prompt'],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

function textResult(obj) {
  return {
    content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }],
    structuredContent: obj,
  };
}

function dispatch(name, args = {}) {
  switch (name) {
    case 'route':
      return textResult(route(args));
    case 'cost_compare':
      return textResult(costCompare(args));
    case 'list_models':
      return textResult(listModels(args));
    case 'cache_route':
      return textResult(cache.routeWithCache(args));
    default:
      return null;
  }
}

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

const rl = createInterface({ input: process.stdin, terminal: false });

rl.on('line', (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return; // ignore malformed lines
  }
  if (!msg || typeof msg !== 'object') return;

  const id = msg.id;
  const method = msg.method;

  // Notifications (no id) — acknowledge silently.
  if (id === undefined || id === null) return;

  if (method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      },
    });
    return;
  }

  if (method === 'tools/list') {
    send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    return;
  }

  if (method === 'tools/call') {
    const name = msg.params?.name;
    const args = msg.params?.arguments || {};
    const result = dispatch(name, args);
    if (!result) {
      send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown tool: ${name}` } });
      return;
    }
    send({ jsonrpc: '2.0', id, result });
    return;
  }

  if (method === 'ping') {
    send({ jsonrpc: '2.0', id, result: {} });
    return;
  }

  // resources/list, prompts/list, etc. — gracefully empty.
  if (method === 'resources/list' || method === 'prompts/list') {
    send({ jsonrpc: '2.0', id, result: { [method === 'resources/list' ? 'resources' : 'prompts']: [] } });
    return;
  }

  send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
});

process.on('SIGINT', () => process.exit(0));
