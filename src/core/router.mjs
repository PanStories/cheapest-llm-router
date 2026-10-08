// Cheapest-LLM Router — core routing engine (zero dependencies).
//
// This module is the single source of truth for all routing logic. It is
// imported by the MCP stdio server (src/server.mjs), the Apify hosted handler
// (src/handler.mjs), the verification showcase (scripts/showcase.mjs) and the
// unit tests (tests/router.test.mjs). Keeping it dependency-free means the
// actual product logic can be verified with plain `node` — no install needed.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const USD_CNY = 7.2;
const LATENCY_RANK = { low: 0, medium: 1, high: 2 };

let REGISTRY = null;

export function loadRegistry(path) {
  const p = path || join(__dirname, '..', '..', 'data', 'models.json');
  REGISTRY = JSON.parse(readFileSync(p, 'utf8'));
  return REGISTRY;
}

export function getRegistry() {
  if (!REGISTRY) loadRegistry();
  return REGISTRY;
}

export function getUsdCny() {
  return getRegistry().meta?.currency_pair_usd_cny ?? USD_CNY;
}

// Token estimation heuristic — no external tokenizer dependency.
// CJK characters ≈ 1.6 tokens; other characters ≈ 0.25 tokens (≈ 4 chars/token).
export function estimateTokens(text) {
  if (!text) return 0;
  const str = String(text);
  const cjk = (str.match(/[⺀-鿿＀-￯]/g) || []).length;
  const other = str.length - cjk;
  return Math.max(1, Math.ceil(cjk * 1.6 + other * 0.25));
}

function round(n) {
  return Math.round((n + Number.EPSILON) * 1e6) / 1e6;
}

function regionOk(model, region) {
  if (!region || region === 'global') return true;
  return (model.region || []).includes(region);
}

function capabilityOk(model, required) {
  if (!required || required.length === 0) return true;
  const caps = new Set(model.capabilities || []);
  return required.every((c) => caps.has(c));
}

function costFor(model, inTok, outTok) {
  if (model.free) return 0;
  const pin = model.price_in_per_1m_usd ?? 0;
  const pout = model.price_out_per_1m_usd ?? 0;
  return (inTok * pin + outTok * pout) / 1e6;
}

function score(model, inTok, outTok) {
  return {
    cost: costFor(model, inTok, outTok),
    latency: LATENCY_RANK[model.latency_tier] ?? 1,
    quality: model.quality_score ?? 50,
  };
}

function summarize(s, inTok, outTok, cny) {
  return {
    id: s.model.id,
    name: s.model.name,
    provider: s.model.provider_name,
    access_path: s.model.access_path,
    model_ref: s.model.model_ref,
    free: s.model.free,
    free_quota: s.model.free ? s.model.free_quota || null : null,
    requires_paid_plan: s.model.requires_paid_plan || null,
    plan_note: s.model.requires_paid_plan ? s.model.plan_note || null : null,
    pricing_unverified: s.model.pricing_unverified || false,
    cost_usd: round(s.cost),
    cost_cny: round(s.cost * cny),
    latency_tier: s.model.latency_tier,
    quality_score: s.model.quality_score,
    context_window: s.model.context_window,
    region: s.model.region,
    capabilities: s.model.capabilities,
    notes: s.model.notes || null,
  };
}

// Build the ranked candidate list given routing inputs.
export function planRoutes(input = {}) {
  const {
    prompt = '',
    max_output_tokens = 512,
    required_capabilities = [],
    region = 'global',
    priority = 'cost',
    include_paid = true,
  } = input;

  const registry = getRegistry();
  const cny = getUsdCny();
  const inTok = estimateTokens(prompt);
  const outTok = Math.max(1, Math.floor(Number(max_output_tokens) || 512));

  const candidates = registry.models.filter((m) => {
    if (!capabilityOk(m, required_capabilities)) return false;
    if (!regionOk(m, region)) return false;
    if (!include_paid && !m.free) return false;
    return true;
  });

  const scored = candidates.map((m) => ({ model: m, ...score(m, inTok, outTok) }));

  scored.sort((a, b) => {
    if (priority === 'latency') {
      if (a.latency !== b.latency) return a.latency - b.latency;
      return a.cost - b.cost;
    }
    if (priority === 'quality') {
      if (a.quality !== b.quality) return b.quality - a.quality;
      return a.cost - b.cost;
    }
    // default: cost
    if (a.cost !== b.cost) return a.cost - b.cost;
    // free beats paid at equal cost; among free prefer larger quota then lower latency
    if (a.model.free !== b.model.free) return a.model.free ? -1 : 1;
    // Among paid models at equal token cost, prefer one you can reach without
    // buying a subscription (e.g. Kimi K2.6 on Cloudflare needs Workers Paid).
    const pa = a.model.requires_paid_plan ? 1 : 0;
    const pb = b.model.requires_paid_plan ? 1 : 0;
    if (pa !== pb) return pa - pb;
    if (a.model.free && b.model.free) {
      const qa = a.model.free_quota_score ?? 0;
      const qb = b.model.free_quota_score ?? 0;
      if (qa !== qb) return qb - qa;
      return a.latency - b.latency;
    }
    return a.latency - b.latency;
  });

  return { inTok, outTok, cny, scored };
}

function buildReasoning(best, input, inTok, outTok, savings) {
  const parts = [];
  const mode = input.priority === 'latency' ? 'lowest latency' : input.priority === 'quality' ? 'highest quality' : 'lowest cost';
  parts.push(`Routed by ${mode}.`);
  parts.push(`Estimated ${inTok} input + ${outTok} output tokens.`);
  if (best.model.free) {
    parts.push(`Cheapest reachable is ${best.model.name} — free (${best.model.free_quota}). No token cost.`);
  } else if (best.model.requires_paid_plan) {
    parts.push(`Cheapest reachable is ${best.model.name}, but it needs a paid subscription (${best.model.requires_paid_plan}) — ${best.model.plan_note || 'see provider docs'}.`);
  } else {
    parts.push(`No free model matches the constraints; cheapest paid is ${best.model.name} at $${round(best.cost).toFixed(6)} (¥${(round(best.cost * (input._cny || 7.2))).toFixed(4)}).`);
  }
  if (savings && savings.vs_most_expensive_reachable_pct > 0) {
    parts.push(`Routing here instead of the priciest reachable option (${savings.reference_model}) saves ~${savings.vs_most_expensive_reachable_pct}% ($${savings.vs_most_expensive_reachable_usd.toFixed(4)}).`);
  }
  if (input.required_capabilities && input.required_capabilities.length) {
    parts.push(`Required capabilities [${input.required_capabilities.join(', ')}] satisfied.`);
  }
  if (input.region && input.region !== 'global') {
    parts.push(`Constrained to region=${input.region} (mainland-accessible without VPN).`);
  }
  return parts.join(' ');
}

// Core tool: route a prompt to the cheapest reachable model + fallback chain.
export function route(input = {}) {
  const { inTok, outTok, cny, scored } = planRoutes(input);
  const inputWithCny = { ...input, _cny: cny };

  if (scored.length === 0) {
    return {
      ok: false,
      reason: 'no_reachable_model',
      message:
        'No model satisfies the requested capabilities/region. Try relaxing required_capabilities or set include_paid=true / region=global.',
      estimated_input_tokens: inTok,
      estimated_output_tokens: outTok,
    };
  }

  const best = scored[0];
  const fallbacks = scored.slice(1, 4).map((s) => summarize(s, inTok, outTok, cny));

  // Savings vs the priciest reachable model in the same candidate set. This is
  // the headline metric for the adoption pitch: "routing beats the expensive
  // default". A free best against a paid priciest => ~100% saving.
  const priciest = scored[scored.length - 1];
  const priciestCost = priciest ? priciest.cost : 0;
  const savedUsd = round(priciestCost - best.cost);
  const savedPct = priciestCost > 0 ? Math.round((savedUsd / priciestCost) * 1000) / 10 : 0;
  const savings = {
    vs_most_expensive_reachable_usd: savedUsd,
    vs_most_expensive_reachable_cny: round(savedUsd * cny),
    vs_most_expensive_reachable_pct: savedPct,
    reference_model: priciest ? priciest.model.name : null,
  };

  return {
    ok: true,
    chosen: summarize(best, inTok, outTok, cny),
    fallback_chain: fallbacks,
    estimated_input_tokens: inTok,
    estimated_output_tokens: outTok,
    estimated_cost_usd: round(best.cost),
    estimated_cost_cny: round(best.cost * cny),
    savings,
    priority: input.priority || 'cost',
    reasoning: buildReasoning(best, inputWithCny, inTok, outTok, savings),
  };
}

// Cost-comparison report: every reachable model with its estimated cost, ranked.
export function costCompare(input = {}) {
  const { inTok, outTok, cny, scored } = planRoutes({ ...input, include_paid: true });
  const comparisons = scored
    .map((s) => summarize(s, inTok, outTok, cny))
    .map((c, i) => ({ rank: i + 1, ...c }));
  // Reference savings vs the most expensive reachable model (often a paid baseline).
  const mostExpensive = comparisons[comparisons.length - 1];
  const cheapest = comparisons[0];
  const savingsUsd = mostExpensive ? round(mostExpensive.cost_usd - cheapest.cost_usd) : 0;
  return {
    estimated_input_tokens: inTok,
    estimated_output_tokens: outTok,
    cheapest_model: cheapest ? cheapest.name : null,
    most_expensive_model: mostExpensive ? mostExpensive.name : null,
    max_savings_usd: savingsUsd,
    max_savings_cny: round(savingsUsd * cny),
    comparisons,
  };
}

// List registry models with optional filters.
// Returns an object (never a bare array) so it is valid as MCP structuredContent.
export function listModels({ capability, region, free_only } = {}) {
  let models = getRegistry().models;
  if (capability) models = models.filter((m) => (m.capabilities || []).includes(capability));
  if (region) models = models.filter((m) => (m.region || []).includes(region));
  if (free_only) models = models.filter((m) => m.free);
  const items = models.map((m) => ({
    id: m.id,
    name: m.name,
    provider: m.provider_name,
    free: m.free,
    requires_paid_plan: m.requires_paid_plan || null,
    capabilities: m.capabilities,
    region: m.region,
    latency_tier: m.latency_tier,
    quality_score: m.quality_score,
    context_window: m.context_window,
  }));
  return { models: items, count: items.length };
}

// In-memory route cache — the monetization "advanced routing/caching" layer.
// A persistent/per-account cache is a hosted paid feature; this in-process map
// demonstrates the hit path and how much it would save on repeat calls.
export class RouteCache {
  constructor() {
    this.map = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  _key(input) {
    const { prompt, max_output_tokens, required_capabilities, region, priority, include_paid } = input;
    return JSON.stringify({
      p: prompt,
      mo: max_output_tokens,
      rc: required_capabilities,
      r: region,
      pr: priority,
      ip: include_paid,
    });
  }

  routeWithCache(input = {}) {
    const key = this._key(input);
    const hit = this.map.get(key);
    if (hit) {
      this.hits += 1;
      return { ...hit, cached: true };
    }
    this.misses += 1;
    const result = route(input);
    this.map.set(key, result);
    return { ...result, cached: false };
  }

  stats() {
    return { size: this.map.size, hits: this.hits, misses: this.misses };
  }
}
