// Unit tests for the routing core. Run: `node --test tests/`
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  estimateTokens,
  route,
  costCompare,
  listModels,
  RouteCache,
  loadRegistry,
} from '../src/core/router.mjs';

test('loadRegistry parses the curated data', () => {
  const reg = loadRegistry();
  assert.ok(Array.isArray(reg.models));
  assert.ok(reg.models.length >= 15, 'should have a meaningful registry');
  assert.ok(reg.models.some((m) => m.id === 'kimi-k2.6-cloudflare'));
});

test('estimateTokens: CJK costs more than latin', () => {
  const latin = estimateTokens('hello world this is english text');
  const cjk = estimateTokens('你好世界这是一个中文测试文本');
  assert.ok(cjk > latin, `CJK (${cjk}) should exceed latin (${latin})`); // not necessarily, but here true
  assert.ok(estimateTokens('') === 0 || estimateTokens('') === 1);
  assert.ok(estimateTokens('a') >= 1);
});

test('route: default picks a free model with zero cost', () => {
  const r = route({ prompt: 'Summarize this article about stocks.' });
  assert.equal(r.ok, true);
  assert.equal(r.chosen.free, true);
  assert.equal(r.estimated_cost_usd, 0);
  assert.ok(r.chosen.cost_cny === 0);
  assert.ok(Array.isArray(r.fallback_chain));
  assert.match(r.reasoning, /Routed by lowest cost/);
});

test('route: returns a savings block vs the priciest reachable model', () => {
  const r = route({ prompt: 'Summarize this article about stocks.' });
  assert.equal(r.ok, true);
  assert.ok(r.savings, 'savings block present');
  assert.equal(typeof r.savings.vs_most_expensive_reachable_pct, 'number');
  assert.ok(r.savings.vs_most_expensive_reachable_pct >= 0 && r.savings.vs_most_expensive_reachable_pct <= 100);
  // best is free; priciest reachable is a paid model → ~100% saving
  assert.ok(r.savings.vs_most_expensive_reachable_pct >= 90, `expected high saving, got ${r.savings.vs_most_expensive_reachable_pct}`);
  assert.ok(r.savings.reference_model, 'reference model named');
  assert.ok(r.reasoning.match(/saves ~\d+(\.\d+)?%/), 'reasoning mentions the saving');
});

test('route: chinese+reasoning still resolves free within global region', () => {
  const r = route({ prompt: '分析一下这份财报的核心风险', required_capabilities: ['chinese', 'reasoning'] });
  assert.equal(r.ok, true);
  assert.equal(r.chosen.free, true);
  assert.ok(r.chosen.capabilities.includes('chinese'));
});

test('route: region=CN excludes global-only free models', () => {
  const r = route({
    prompt: 'translate this sentence',
    required_capabilities: ['chinese'],
    region: 'CN',
  });
  assert.equal(r.ok, true);
  assert.ok(r.chosen.region.includes('CN'), 'chosen model must be CN-accessible');
});

test('route: vision requirement resolves to a vision-capable free model', () => {
  const r = route({ prompt: 'describe this chart image', required_capabilities: ['vision'] });
  assert.equal(r.ok, true);
  assert.ok(r.chosen.capabilities.includes('vision'));
});

test('route: no model for impossible combo returns ok:false', () => {
  const r = route({
    prompt: 'x',
    required_capabilities: ['vision', 'tool_use'],
    region: 'global',
    include_paid: false,
  });
  assert.equal(r.ok, false);
  assert.equal(r.reasoning === undefined, true);
});

test('route: quality priority prefers highest quality among free', () => {
  const r = route({ prompt: 'hard reasoning task', priority: 'quality' });
  assert.equal(r.ok, true);
  // top free quality models are Gemini/Kimi/DeepSeek; chosen quality should be high
  assert.ok(r.chosen.quality_score >= 85);
});

test('costCompare: returns ranked comparisons with savings', () => {
  const c = costCompare({ prompt: 'write a function', max_output_tokens: 1024 });
  assert.ok(c.comparisons.length >= 5);
  assert.equal(c.comparisons[0].rank, 1);
  // cheapest is a free model (cost 0) and most expensive is a paid reference
  assert.equal(c.comparisons[0].cost_usd, 0);
  assert.ok(c.max_savings_usd >= 0);
});

test('listModels: free_only filter', () => {
  const free = listModels({ free_only: true });
  assert.ok(free.models.length >= 10);
  assert.ok(free.models.every((m) => m.free === true));
  assert.equal(free.count, free.models.length);
});

test('listModels: capability filter', () => {
  const vision = listModels({ capability: 'vision' });
  assert.ok(vision.models.length >= 1);
  assert.ok(vision.models.every((m) => m.capabilities.includes('vision')));
});

test('RouteCache: second identical call is a cache hit', () => {
  const rc = new RouteCache();
  const a = rc.routeWithCache({ prompt: 'cache me' });
  const b = rc.routeWithCache({ prompt: 'cache me' });
  assert.equal(a.cached, false);
  assert.equal(b.cached, true);
  assert.equal(rc.stats().hits, 1);
  assert.equal(rc.stats().misses, 1);
});
