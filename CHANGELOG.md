# Changelog

## 0.1.0 (2026-10-02)

- Initial MVP of Cheapest-LLM Router MCP.
- Zero-dependency stdio MCP server (hand-written JSON-RPC, protocol 2025-06-18).
- Curated model registry reusing Free & Cheap Tokens (FACT) verified promos: 15 free channels (Kimi K2.6 via Cloudflare Workers AI, Qwen3-Plus/Bailian, DeepSeek-V3/SiliconFlow, Hunyuan-Pro, Llama-3.1/Groq, Gemini 2.5 Flash, OpenRouter :free, GitHub Models, Doubao 1.5 Pro, GLM-4-Plus/Zhipu, Qwen2.5-VL) + paid fallbacks/references.
- Tools: `route`, `cost_compare`, `list_models`, `cache_route`.
- Routing by cost / latency / quality with capability + region reachability filters and fallback chain.
- Verification: unit tests (`node --test`), MCP protocol smoke test, data-driven `showcase.html`.
- Apify Pay-Per-Event blueprint (`.actor/actor.json` + `handler.mjs` + `Dockerfile`) — optional hosted path.
