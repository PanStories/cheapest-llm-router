# Cheapest-LLM Router (CLR)

> Route any prompt to the cheapest reachable LLM — free tiers first, cheapest paid fallback second.
> Reuses the free-model channels of [Free &amp; Cheap Tokens (FACT)](https://github.com/PanStories/free-and-cheap-tokens) (Qwen · DeepSeek · Groq · Gemini · Hunyuan · GLM …).
> A **zero-dependency** MCP server (runs over stdio with plain `node src/server.mjs` — no install, no npm) with 4 tools: `route` · `cost_compare` · `list_models` · `cache_route`.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%3E%3D20-339933)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-2025--06--18-purple)](https://modelcontextprotocol.io)
[![Pay-Per-Event](https://img.shields.io/badge/Pricing-Pay--Per--Event-success)](https://apify.com/neeenja/cheapest-llm-router)
[![M8ven Verified](https://m8ven.ai/badge/mcp/panstories-cheapest-llm-router-1y31ap?variant=verified)](https://m8ven.ai/mcp/panstories/cheapest-llm-router?s=readme)

🌐 **[English](#english)** · **[简体中文](#简体中文)** · **[繁體中文](#繁體中文)**

| It lives at | Link |
|---|---|
| MCP endpoint (hosted) | `https://neeenja--cheapest-llm-router.apify.actor/mcp` |
| Apify Store | https://apify.com/neeenja/cheapest-llm-router |
| Source | https://github.com/PanStories/cheapest-llm-router |

---

<a id="english"></a>
# English

**Current version: 0.2.2**

Route any prompt to the cheapest reachable LLM — free tiers first, cheapest paid fallback second.

**Cheapest-LLM Router** is an [MCP](https://modelcontextprotocol.io) server that, given a prompt, automatically picks the **cheapest model that can actually serve it** — free models first, then the lowest-cost paid fallback — and returns the cost in both USD and CNY plus a fallback chain and plain-English reasoning. It does **not** call any model; it only does the routing math, so it costs nothing to run and nothing to call except the tiny Apify Pay-Per-Event fee when hosted.

## Why this exists

- **Model routing is the single biggest cost lever** — published 2026 teardowns put it at 30–40% of an agent's bill ([HermesOS, 2026](https://hermesos.cloud/blog/ai-agent-api-cost-optimization)), and 60–80% on the simple-task slice ([Compresr, 2026](https://compresr.ai/blog/llm-api-costs-optimization-guide)).
- **Decision happens before the call** — unlike LiteLLM/OpenRouter/Helicone, which sit in the request path and measure spend afterwards, this server advises inside the assistant's reasoning loop, so the model itself can choose the cheap route.
- **Free cloud tiers, not just local Ollama** — the registry tracks 14 models with a genuine $0 cloud tier (Qwen3-Plus, DeepSeek-V3, Hunyuan-Pro, Groq, Gemini 2.5 Flash, GLM-4-Plus …). Most competing routers only offer "free" via self-hosted Ollama.
- **Mainland-China reachability** — `region=CN` filters to models reachable without a VPN; no other router MCP models this.
- **Zero marginal cost** — routing is pure local computation; no paid API is ever called.

## What you get (MCP tools)

| Tool | What it does |
|------|--------------|
| `route` | prompt → cheapest reachable model + USD/CNY cost estimate + fallback chain + reasoning |
| `cost_compare` | ranks **every** reachable model by cost and reports the max savings vs the most expensive |
| `list_models` | filtered registry listing (capability / region / free-only) |
| `cache_route` | same as `route`, but demonstrates the in-process cache (`cached: true` on repeat hits) |

### `route` input
```json
{
  "prompt": "Analyze the core risks of this earnings report",
  "max_output_tokens": 512,
  "required_capabilities": ["chinese", "reasoning"],
  "region": "CN",
  "priority": "cost",
  "include_paid": true
}
```

### `route` output (excerpt)
```json
{
  "ok": true,
  "chosen": { "name": "Qwen3-Plus (via Aliyun Bailian)", "free": true, "cost_usd": 0 },
  "fallback_chain": [ "Kimi K2 (Moonshot direct trial)", "DeepSeek-V3 (via SiliconFlow)" ],
  "estimated_cost_usd": 0,
  "estimated_cost_cny": 0,
  "reasoning": "Routed by lowest cost. Estimated 18 input + 512 output tokens. Cheapest reachable is Qwen3-Plus ... free. No token cost."
}
```

## Quick start

### 1. Run locally (stdio, zero install)
```bash
git clone https://github.com/PanStories/cheapest-llm-router.git
cd cheapest-llm-router
node src/server.mjs          # plain node — no npm install needed
```

### 2. Verify (no dependencies)
```bash
node --test tests/                     # routing core unit tests
node scripts/mcp-smoke.mjs             # end-to-end MCP protocol smoke test
node scripts/http-e2e-test.mjs         # Streamable HTTP transport test (needs deps)
node scripts/showcase.mjs              # generate showcase.html from real routing output
```

### 3. Host remotely (Apify Pay-Per-Event)
```bash
npm install                            # pulls express + MCP SDK + apify (hosted variant only)
apify login && apify push              # requires Apify KYC first
```
The hosted MCP endpoint is then reachable at `https://neeenja--cheapest-llm-router.apify.actor/mcp` (Bearer-token auth).

## Connect it to your client

**stdio** (`mcp.json`) — for local desktop clients:
```json
{
  "mcpServers": {
    "cheapest-llm-router": {
      "command": "node",
      "args": ["/abs/path/cheapest-llm-router/src/server.mjs"]
    }
  }
}
```

**hosted** (remote, via [`mcp-remote`](https://www.npmjs.com/package/mcp-remote)) — Apify's gateway requires a per-request Bearer token:
```json
{
  "mcpServers": {
    "cheapest-llm-router": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://neeenja--cheapest-llm-router.apify.actor/mcp",
        "--header", "Authorization: Bearer <YOUR_APIFY_TOKEN>"
      ]
    }
  }
}
```

## Pricing (Pay-Per-Event)

No subscription, no monthly fee. You pay only when a tool actually runs:

| Event | Price (USD) |
|-------|-------------|
| `initialize` / `tools/list` / `report-issue` | **free** |
| `route` | $0.0005 |
| `cost_compare` | $0.001 |
| `list_models` / `cache_route` | $0.0005 |

Free events are never billed, so agents can connect and discover tools at zero cost. Apify also grants ~$5/month of free platform credits (≈ thousands of calls).

## How routing works
1. **Token estimate** — CJK ≈ 1.6 tokens/char, other text ≈ 0.25 tokens/char (no external tokenizer).
2. **Reachability filter** — `required_capabilities ⊆ model capabilities` and `region` match (`CN` = mainland-accessible without a VPN).
3. **Cost** — free = $0; paid = `(in×pin + out×pout) / 1e6`.
4. **Ranking** — `cost` (default: free first, then by free-quota then latency; paid by cost) · `latency` · `quality`.
5. **Fallback chain** — the next 3 reachable models.

> ⚠️ Prices are **indicative** (USD per 1M tokens) and drift with providers; verify on each provider's pricing page before production.

## What it does NOT do (honest boundaries)
1. It does **not** send real inference requests — it only selects a route.
2. It does **not** cache/store your prompts (a persistent per-account cache is a hosted paid feature).
3. It does **not** guarantee free quotas are live (provider-controlled; may return 429).
4. Prices change; always trust the provider's official page.

## Development

| Script | Purpose |
|--------|---------|
| `node src/server.mjs` | stdio MCP server (zero dependency) |
| `node src/http.mjs` | HTTP MCP server (`PORT=3000`) for local/dev |
| `node --test tests/` | routing core unit tests |
| `node scripts/mcp-smoke.mjs` | stdio MCP protocol smoke test |
| `node scripts/http-e2e-test.mjs` | HTTP transport e2e (`PORT=3100`) |
| `node scripts/showcase.mjs` | build `showcase.html` from real output |

Project layout:
```
cheapest-llm-router/
├── data/models.json        curated model registry (reuses FACT's verified list)
├── src/core/router.mjs     routing engine (zero-dependency, single source of truth)
├── src/server.mjs          zero-dependency stdio MCP server (default, verified)
├── src/http.mjs            self-managed HTTP MCP server (Apify Standby)
├── src/handler.mjs         MCP server factory (shared by both transports)
├── src/billing.mjs         Apify Pay-Per-Event billing (hosted only)
├── tests/router.test.mjs   unit tests (node --test)
├── scripts/                smoke / http-e2e / showcase scripts
└── .actor/                 Apify actor.json + Dockerfile + schemas
```

## License

[MIT](LICENSE) — fork, self-host, self-modify freely.

---

<a id="简体中文"></a>
# 简体中文

**当前版本：0.2.2**

> 把任意 prompt 路由到最便宜的可达大模型 —— 先用免费额度，再退到最低价付费模型。

**Cheapest-LLM Router** 是一个 [MCP](https://modelcontextprotocol.io) 服务器：给定一条 prompt，它会自动选出**当下最便宜且能真正服务它的模型**——优先免费模型，其次最低成本的付费兜底——并以美元和人民币双币种返回成本、兜底链与推理说明。它**不会**真正调用任何模型，只做路由计算，因此本地运行零成本，托管后除极低的 Apify 按事件计费外也无其他开销。

## 为什么做这个

- **模型路由是最大成本杠杆**——2026 年拆解数据显示它占一个 Agent 账单的 30–40%（[HermesOS, 2026](https://hermesos.cloud/blog/ai-agent-api-cost-optimization)），在简单任务上甚至高达 60–80%（[Compresr, 2026](https://compresr.ai/blog/llm-api-costs-optimization-guide)）。
- **决策发生在调用之前**——与 LiteLLM / OpenRouter / Helicone 不同（它们都在请求路径里、事后才计量花费），本服务在助手的推理循环内部给建议，让模型自己就能选便宜的路线。
- **真正的云端免费额度，不止本地 Ollama**——注册表追踪 14 个具备真·$0 云端额度的模型（Qwen3-Plus、DeepSeek-V3、Hunyuan-Pro、Groq、Gemini 2.5 Flash、GLM-4-Plus …）。多数竞品路由只靠自托管 Ollama 提供"免费"。
- **中国大陆可达性**——`region=CN` 过滤出免 VPN 即可访问的模型；没有其他路由 MCP 做这件事。
- **零边际成本**——路由是纯本地计算，从不调用任何付费 API。

## 你得到什么（MCP 工具）

| 工具 | 作用 |
|------|------|
| `route` | 给定 prompt → 最便宜可达模型 + 美元/人民币成本估算 + 兜底链 + 推理说明 |
| `cost_compare` | 把**所有**可达模型按成本排序，并给出相比最贵模型的最大节省额 |
| `list_models` | 按 capability / region / free-only 过滤的模型清单 |
| `cache_route` | 同 `route`，但演示进程内缓存（重复命中返回 `cached: true`） |

### `route` 入参
```json
{
  "prompt": "分析这份财报的核心风险",
  "max_output_tokens": 512,
  "required_capabilities": ["chinese", "reasoning"],
  "region": "CN",
  "priority": "cost",
  "include_paid": true
}
```

### `route` 出参（节选）
```json
{
  "ok": true,
  "chosen": { "name": "Qwen3-Plus (via Aliyun Bailian)", "free": true, "cost_usd": 0 },
  "fallback_chain": [ "Kimi K2 (Moonshot direct trial)", "DeepSeek-V3 (via SiliconFlow)" ],
  "estimated_cost_usd": 0,
  "estimated_cost_cny": 0,
  "reasoning": "Routed by lowest cost. Estimated 18 input + 512 output tokens. Cheapest reachable is Qwen3-Plus ... free. No token cost."
}
```

## 快速开始

### 1. 本地跑（stdio，零安装）
```bash
git clone https://github.com/PanStories/cheapest-llm-router.git
cd cheapest-llm-router
node src/server.mjs          # 直接跑，无需 npm install
```

### 2. 验证（无需依赖）
```bash
node --test tests/                     # 路由核心单元测试
node scripts/mcp-smoke.mjs             # MCP 协议端到端冒烟测试
node scripts/http-e2e-test.mjs         # Streamable HTTP 传输测试（需装依赖）
node scripts/showcase.mjs              # 用真实路由输出生成 showcase.html
```

### 3. 远程托管（Apify 按事件计费）
```bash
npm install                            # 仅托管变体需要：express + MCP SDK + apify
apify login && apify push              # 需先完成 Apify KYC
```
托管后的 MCP 端点：`https://neeenja--cheapest-llm-router.apify.actor/mcp`（Bearer token 鉴权）。

## 接入你的客户端

**stdio**（`mcp.json`）——本地桌面客户端：
```json
{
  "mcpServers": {
    "cheapest-llm-router": {
      "command": "node",
      "args": ["/绝对路径/cheapest-llm-router/src/server.mjs"]
    }
  }
}
```

**托管**（远程，借助 [`mcp-remote`](https://www.npmjs.com/package/mcp-remote)）——Apify 网关要求每次请求带 Bearer token：
```json
{
  "mcpServers": {
    "cheapest-llm-router": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://neeenja--cheapest-llm-router.apify.actor/mcp",
        "--header", "Authorization: Bearer <你的_APIFY_TOKEN>"
      ]
    }
  }
}
```

## 定价（按事件计费）

无订阅、无月费，只在工具真正运行时付费：

| 事件 | 价格（美元） |
|------|-------------|
| `initialize` / `tools/list` / `report-issue` | **免费** |
| `route` | $0.0005 |
| `cost_compare` | $0.001 |
| `list_models` / `cache_route` | $0.0005 |

免费事件永不计费，Agent 可零成本连接与发现工具。Apify 另送约 $5/月的免费平台额度（≈ 数千次调用）。

## 路由逻辑

1. **Token 估算**：CJK 字符 ≈ 1.6 token，其他文本 ≈ 0.25 token（无外部 tokenizer）。
2. **可达性过滤**：`required_capabilities ⊆ 模型能力` 且 `region` 匹配（`CN` = 大陆免 VPN 可达）。
3. **成本计算**：免费模型 = $0；付费 = `(in×pin + out×pout) / 1e6`。
4. **排序**：`cost`（默认：免费优先 → 免费内按免费额度再按延迟；付费按成本升序）· `latency` · `quality`。
5. **兜底链**：次优 3 个可达模型。

> ⚠️ 价格为**指示性**（美元/百万 token），随厂商变动；生产前请以各厂商定价页为准。

## 本工具不做什么（诚实边界）

1. 不替你发起真实推理请求——只选路由。
2. 不缓存/存储你的 prompt（hosted 持久缓存为付费能力）。
3. 不保证免费额度实时可用（额度由厂商控制，可能 429）。
4. 价格随厂商变动，请以官方为准。

## 开发

| 脚本 | 用途 |
|------|------|
| `node src/server.mjs` | stdio MCP 服务器（零依赖） |
| `node src/http.mjs` | HTTP MCP 服务器（`PORT=3000`），本地/开发用 |
| `node --test tests/` | 路由核心单元测试 |
| `node scripts/mcp-smoke.mjs` | stdio MCP 协议冒烟测试 |
| `node scripts/http-e2e-test.mjs` | HTTP 传输端到端（`PORT=3100`） |
| `node scripts/showcase.mjs` | 用真实输出生成 `showcase.html` |

项目结构：
```
cheapest-llm-router/
├── data/models.json        策展模型注册表（复用 FACT 已核验清单）
├── src/core/router.mjs     路由引擎（零依赖，唯一事实源）
├── src/server.mjs          零依赖 stdio MCP 服务器（默认、已验证）
├── src/http.mjs            自托管 HTTP MCP 服务器（Apify Standby）
├── src/handler.mjs         MCP 服务器工厂（两个传输共用）
├── src/billing.mjs         Apify 按事件计费（仅托管）
├── tests/router.test.mjs   单元测试（node --test）
├── scripts/                冒烟 / HTTP e2e / 展示脚本
└── .actor/                 Apify actor.json + Dockerfile + schema
```

## 许可证

[MIT](LICENSE)——可 fork、自部署、自托管、自修改。

---

<a id="繁體中文"></a>
# 繁體中文

**當前版本：0.2.2**

> 把任意 prompt 路由到最便宜的可達大型語言模型 —— 先用免費額度，再退到最低價付費模型。

**Cheapest-LLM Router** 是一個 [MCP](https://modelcontextprotocol.io) 伺服器：給定一條 prompt，它會自動選出**當下最便宜且能真正服務它的模型**——優先免費模型，其次最低成本的付費兜底——並以美元與人民幣雙幣種回傳成本、兜底鏈與推理說明。它**不會**真正呼叫任何模型，只做路由計算，因此本地執行零成本，託管後除極低的 Apify 按事件計費外也無其他開銷。

## 為什麼做這個

- **模型路由是最大成本槓桿**——2026 年拆解數據顯示它佔一個 Agent 帳單的 30–40%（[HermesOS, 2026](https://hermesos.cloud/blog/ai-agent-api-cost-optimization)），在簡單任務上甚至高達 60–80%（[Compresr, 2026](https://compresr.ai/blog/llm-api-costs-optimization-guide)）。
- **決策發生在呼叫之前**——與 LiteLLM / OpenRouter / Helicone 不同（它們都在請求路徑裡、事後才計量花費），本服務在助手的推理循環內部給建議，讓模型自己就能選便宜的路線。
- **真正的雲端免費額度，不止本地 Ollama**——註冊表追蹤 14 個具備真·$0 雲端額度的模型（Qwen3-Plus、DeepSeek-V3、Hunyuan-Pro、Groq、Gemini 2.5 Flash、GLM-4-Plus …）。多數競品路由只靠自託管 Ollama 提供「免費」。
- **中國大陸可達性**——`region=CN` 過濾出免 VPN 即可訪問的模型；沒有其他路由 MCP 做這件事。
- **零邊際成本**——路由是純本地計算，從不呼叫任何付費 API。

## 你得到什麼（MCP 工具）

| 工具 | 作用 |
|------|------|
| `route` | 給定 prompt → 最便宜可達模型 + 美元/人民幣成本估算 + 兜底鏈 + 推理說明 |
| `cost_compare` | 把**所有**可達模型按成本排序，並給出相比最貴模型的最大節省額 |
| `list_models` | 按 capability / region / free-only 過濾的模型清單 |
| `cache_route` | 同 `route`，但示範程序內快取（重複命中回傳 `cached: true`） |

### `route` 入參
```json
{
  "prompt": "分析這份財報的核心風險",
  "max_output_tokens": 512,
  "required_capabilities": ["chinese", "reasoning"],
  "region": "CN",
  "priority": "cost",
  "include_paid": true
}
```

### `route` 出參（節選）
```json
{
  "ok": true,
  "chosen": { "name": "Qwen3-Plus (via Aliyun Bailian)", "free": true, "cost_usd": 0 },
  "fallback_chain": [ "Kimi K2 (Moonshot direct trial)", "DeepSeek-V3 (via SiliconFlow)" ],
  "estimated_cost_usd": 0,
  "estimated_cost_cny": 0,
  "reasoning": "Routed by lowest cost. Estimated 18 input + 512 output tokens. Cheapest reachable is Qwen3-Plus ... free. No token cost."
}
```

## 快速開始

### 1. 本地執行（stdio，零安裝）
```bash
git clone https://github.com/PanStories/cheapest-llm-router.git
cd cheapest-llm-router
node src/server.mjs          # 直接執行，無需 npm install
```

### 2. 驗證（無需依賴）
```bash
node --test tests/                     # 路由核心單元測試
node scripts/mcp-smoke.mjs             # MCP 協定端到端冒煙測試
node scripts/http-e2e-test.mjs         # Streamable HTTP 傳輸測試（需裝依賴）
node scripts/showcase.mjs              # 用真實路由輸出生成 showcase.html
```

### 3. 遠端託管（Apify 按事件計費）
```bash
npm install                            # 僅託管變體需要：express + MCP SDK + apify
apify login && apify push              # 需先完成 Apify KYC
```
託管後的 MCP 端點：`https://neeenja--cheapest-llm-router.apify.actor/mcp`（Bearer token 鑑權）。

## 接入你的客戶端

**stdio**（`mcp.json`）——本地桌面客戶端：
```json
{
  "mcpServers": {
    "cheapest-llm-router": {
      "command": "node",
      "args": ["/絕對路徑/cheapest-llm-router/src/server.mjs"]
    }
  }
}
```

**託管**（遠端，借助 [`mcp-remote`](https://www.npmjs.com/package/mcp-remote)）——Apify 閘道要求每次請求帶 Bearer token：
```json
{
  "mcpServers": {
    "cheapest-llm-router": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://neeenja--cheapest-llm-router.apify.actor/mcp",
        "--header", "Authorization: Bearer <你的_APIFY_TOKEN>"
      ]
    }
  }
}
```

## 定價（按事件計費）

無訂閱、無月費，只在工具真正執行時付費：

| 事件 | 價格（美元） |
|------|-------------|
| `initialize` / `tools/list` / `report-issue` | **免費** |
| `route` | $0.0005 |
| `cost_compare` | $0.001 |
| `list_models` / `cache_route` | $0.0005 |

免費事件永不计費，Agent 可零成本連線與發現工具。Apify 另送約 $5/月的免費平台額度（≈ 數千次呼叫）。

## 路由邏輯

1. **Token 估算**：CJK 字元 ≈ 1.6 token，其他文字 ≈ 0.25 token（無外部 tokenizer）。
2. **可達性過濾**：`required_capabilities ⊆ 模型能力` 且 `region` 匹配（`CN` = 大陸免 VPN 可達）。
3. **成本計算**：免費模型 = $0；付費 = `(in×pin + out×pout) / 1e6`。
4. **排序**：`cost`（預設：免費優先 → 免費內按免費額度再按延遲；付費按成本升序）· `latency` · `quality`。
5. **兜底鏈**：次優 3 個可達模型。

> ⚠️ 價格為**指示性**（美元/百萬 token），隨廠商變動；生產前請以各廠商定價頁為準。

## 本工具不做什么（誠實邊界）

1. 不替你發起真實推理請求——只選路由。
2. 不快取/儲存你的 prompt（託管持久快取為付費能力）。
3. 不保證免費額度即時可用（額度由廠商控制，可能 429）。
4. 價格隨廠商變動，請以官方為準。

## 開發

| 腳本 | 用途 |
|------|------|
| `node src/server.mjs` | stdio MCP 伺服器（零依賴） |
| `node src/http.mjs` | HTTP MCP 伺服器（`PORT=3000`），本地/開發用 |
| `node --test tests/` | 路由核心單元測試 |
| `node scripts/mcp-smoke.mjs` | stdio MCP 協定冒煙測試 |
| `node scripts/http-e2e-test.mjs` | HTTP 傳輸端到端（`PORT=3100`） |
| `node scripts/showcase.mjs` | 用真實輸出生成 `showcase.html` |

專案結構：
```
cheapest-llm-router/
├── data/models.json        策展模型註冊表（複用 FACT 已核驗清單）
├── src/core/router.mjs     路由引擎（零依賴，唯一事實源）
├── src/server.mjs          零依賴 stdio MCP 伺服器（預設、已驗證）
├── src/http.mjs            自託管 HTTP MCP 伺服器（Apify Standby）
├── src/handler.mjs         MCP 伺服器工廠（兩個傳輸共用）
├── src/billing.mjs         Apify 按事件計費（僅託管）
├── tests/router.test.mjs   單元測試（node --test）
├── scripts/                冒煙 / HTTP e2e / 展示腳本
└── .actor/                 Apify actor.json + Dockerfile + schema
```

## 授權

[MIT](LICENSE)——可 fork、自部署、自託管、自修改。

---

## Support · 赞助 · 贊助

**EN** — **Cheapest-LLM Router** is open source (MIT), ad-free. It is funded by the community, not by ads. If it powers your agents or workflow, please support it:
- ☕ Ko-fi (the **Sponsor** ❤️ button on this repo routes here): https://ko-fi.com/panstories

**简体中文** — **Cheapest-LLM Router** 开源（MIT）、无广告，由社区资助而非广告。若它支撑了你的智能体或工作流，欢迎赞助：点本仓库的 **Sponsor** 按钮（跳转 Ko-fi）或前往 https://ko-fi.com/panstories

**繁體中文** — **Cheapest-LLM Router** 開源（MIT）、無廣告，由社群資助而非廣告。若它支撐了你的智能體或工作流，歡迎贊助：點本倉庫的 **Sponsor** 按鈕（導向 Ko-fi）或前往 https://ko-fi.com/panstories

Thank you! · 谢谢 · 謝謝 💙
