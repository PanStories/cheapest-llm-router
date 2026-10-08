# Changelog

## 0.2.2 (2026-10-08)

- **Trust & quality gate (M8ven / OpenAI MCP directory).** Ran the local 12-check `trust_audit.py` and fixed every actionable finding so the server is directory-grade:
  - **Tool annotations on all 4 tools.** `route`, `cost_compare`, `list_models`, `cache_route` now declare the four explicit boolean hints (`readOnlyHint:true`, `destructiveHint:false`, `idempotentHint:true`, `openWorldHint:false`) in both transports — stdio (`src/server.mjs`) and hosted SDK (`src/handler.mjs`, via `registerTool`). The OpenAI MCP directory **hard-rejects** any tool missing a hint.
  - **Tools now covered by tests.** New `tests/tools.test.mjs` connects a real MCP `Client` over `InMemoryTransport`, calls all 4 tools, and asserts each carries the canonical hint set. Suite is now 15 tests (was 13); `npm test` runs both files.
  - **Dependency + lockfile.** `@modelcontextprotocol/sdk` upgraded `1.30.1 → 1.32.1` (clears advisory GHSA-6qxp-vccf-f47h); regenerated `package-lock.json` to match `package.json` (it had drifted — `zod` was missing from the lock, which can silently break `npm ci`).
  - **Honest install path.** Removed the dead-end `npx -y cheapest-llm-router` from the README — the npm package was never published (404). The stdio server is genuinely zero-install via `git clone` + `node src/server.mjs`, and the README now says exactly that.
  - **`SECURITY.md` added** — private vulnerability-reporting policy (GitHub Security Advisories).
- Local trust audit: **0 fail / 2 warn** (both warns are the M8ven badge + publisher file, pending M8ven indexing of this repo). `npm audit`: SDK advisory cleared; the remaining 6 highs are all in the `apify` SDK's `proxy-agent`/`http-cache-semantics` chain (outside the service surface; `apify` already at latest 3.7.2).

## 0.2.1 (2026-10-08)

- **`route` now reports savings.** Every `route` (and `cache_route`) result includes a `savings` block: `vs_most_expensive_reachable_usd`, `vs_most_expensive_reachable_cny`, `vs_most_expensive_reachable_pct`, and the `reference_model` it was compared against. Routing a free-tier prompt against the priciest reachable paid model shows ~100% saving; the reasoning string now states it in plain English. Directly addresses the adoption signal that the flagship `route` tool was being underused vs `cost_compare`.

## 0.2.0 (2026-10-07)

- **Registry correctness fix.** Kimi K2.6 on Cloudflare Workers AI is no longer free — Cloudflare moved `@cf/moonshotai/kimi-k2.6` behind the Workers Paid plan on 2026-07-28 (Free plan now returns HTTP 403 / internal 5035). Added a `requires_paid_plan` flag + `plan_note` so the router surfaces the subscription requirement instead of advertising a $0 price. A separate genuinely-free **Kimi K2 (Moonshot direct trial, CN-reachable)** entry remains.
- **Router engine.** `requires_paid_plan` models now rank after truly-free models at equal cost, and the `route` reasoning explicitly warns when the cheapest match needs a paid subscription.
- **Registry stats (verified 2026-10-07).** 19 models total · 14 with a free tier · 9 reachable from mainland China without a VPN.
- **README single-source-of-truth.** All public copy now synced via `nurture/manifest.json` + `nurture_preflight.py`. English / 简体中文 / 繁體中文 "why this exists" sections rewritten with 2026 cost-lever citations (model routing = 30–40% of an agent's bill; 60–80% on simple tasks).
- **Discovery.** Added `llms.txt` for LLM-friendly indexing.

## 0.1.0 (2026-09-26)

- Initial release: 4 MCP tools (`route`, `cost_compare`, `list_models`, `cache_route`), zero-dependency stdio server, Apify Standby + Pay-Per-Event hosting.
