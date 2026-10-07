// Cheapest-LLM Router — MCP server factory (shared by both transports).
//
// This module builds an MCP server from the same routing core used by the stdio
// server (src/core/router.mjs). It is imported by:
//   - src/http.mjs  (Apify Standby HTTP transport)
//
// The stdio server (src/server.mjs) is hand-rolled JSON-RPC and does NOT use the
// SDK, so it runs with zero dependencies. This factory uses the official MCP
// SDK and is only loaded by the hosted (HTTP) variant.

import { z } from 'zod';
import { route, costCompare, listModels, RouteCache } from './core/router.mjs';

const cache = new RouteCache();

const CAP_ENUM = ['text', 'code', 'reasoning', 'vision', 'chinese', 'long_context', 'tool_use'];

// Zod raw shapes (the MCP SDK consumes these for input validation).
const TOOL_SCHEMAS = {
  route: {
    description:
      'Given a prompt, route it to the cheapest reachable free/cheap LLM. Returns the chosen model, estimated cost (USD + CNY), a fallback chain, and reasoning. Reuses Free & Cheap Tokens model channels (Kimi K2.6, Qwen, DeepSeek, Cloudflare Workers AI, Groq, Gemini, etc.).',
    shape: {
      prompt: z.string().describe('The task prompt to route. Token estimate is derived from it.'),
      max_output_tokens: z.number().int().optional().default(512).describe('Expected output tokens for cost estimation.'),
      required_capabilities: z
        .array(z.enum(CAP_ENUM))
        .optional()
        .describe('Capabilities the model must support, e.g. ["chinese","reasoning"].'),
      region: z.enum(['global', 'CN']).optional().default('global').describe('CN = mainland-accessible without VPN.'),
      priority: z.enum(['cost', 'latency', 'quality']).optional().default('cost').describe('Routing objective.'),
      include_paid: z.boolean().optional().default(true).describe('Allow paid models as fallback when no free model fits.'),
    },
  },
  cost_compare: {
    description:
      'Rank every reachable model by estimated cost for a given prompt size. Produces a cost-comparison report (the monetization "report layer") including max savings vs the most expensive reachable model.',
    shape: {
      prompt: z.string().describe('The task prompt to size.'),
      max_output_tokens: z.number().int().optional().default(512),
      required_capabilities: z.array(z.string()).optional(),
      region: z.enum(['global', 'CN']).optional().default('global'),
    },
  },
  list_models: {
    description: 'List the curated model registry with optional filters (capability / region / free-only).',
    shape: {
      capability: z.string().optional().describe('Filter by capability, e.g. "vision".'),
      region: z.enum(['global', 'CN']).optional().describe('Filter by region.'),
      free_only: z.boolean().optional().default(false).describe('Only free-tier models.'),
    },
  },
  cache_route: {
    description:
      'Same as route, but checks an in-process cache first. Demonstrates the advanced caching layer: repeated identical requests return the cached plan with cached=true. A persistent per-account cache is a hosted paid feature.',
    shape: {
      prompt: z.string(),
      max_output_tokens: z.number().int().optional().default(512),
      required_capabilities: z.array(z.string()).optional(),
      region: z.enum(['global', 'CN']).optional().default('global'),
      priority: z.enum(['cost', 'latency', 'quality']).optional().default('cost'),
      include_paid: z.boolean().optional().default(true),
    },
  },
};

const TOOL_IMPLS = {
  route: (a) => route(a),
  cost_compare: (a) => costCompare(a),
  list_models: (a) => listModels(a),
  cache_route: (a) => cache.routeWithCache(a),
};

export async function createMcpServer() {
  const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
  const server = new McpServer({ name: 'cheapest-llm-router', version: '0.2.0' });

  for (const [name, meta] of Object.entries(TOOL_SCHEMAS)) {
    server.tool(name, meta.description, meta.shape, async (args) => {
      const result = TOOL_IMPLS[name](args);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    });
  }

  return server;
}

// NOTE: the Apify HTTP transport now lives in src/http.mjs (self-managed
// Express server, stateless Streamable HTTP at /mcp). This file only exposes
// createMcpServer() — shared by both the stdio server and the HTTP entry.
