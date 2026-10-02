# Cheapest-LLM Router (CLR)

> Route any prompt to the **cheapest reachable free/cheap LLM** — automatically.
> Reuses the free-model channels of [Free &amp; Cheap Tokens (FACT)](https://github.com/PanStories/free-and-cheap-tokens) (Kimi K2.6 · Qwen · DeepSeek · Cloudflare Workers AI · Groq · Gemini …).
> A **zero-dependency** MCP server (runs over stdio, no `npm install`) with 4 tools: `route` · `cost_compare` · `list_models` · `cache_route`.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%3E%3D20-339933)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-2025--06--18-purple)](https://modelcontextprotocol.io)
[![Pay-Per-Event](https://img.shields.io/badge/Pricing-Pay--Per--Event-success)](https://apify.com/neeenja/cheapest-llm-router)

🌐 **[English](#english)** · **[简体中文](#简体中文)** · **[繁體中文](#繁體中文)**

| It lives at | Link |
|---|---|
| MCP endpoint (hosted) | `https://neeenja--cheapest-llm-router.apify.actor/mcp` |
| Apify Store | https://apify.com/neeenja/cheapest-llm-router |
| Source | https://github.com/PanStories/cheapest-llm-router |

---

<a id="english"></a>
# English

**Cheapest-LLM Router** is an [MCP](https://modelcontextprotocol.io) server that, given a prompt, automatically picks the **cheapest model that can actually serve it** — free models first, then the lowest-cost paid fallback — and returns the cost in both USD and CNY plus a fallback chain and plain-English reasoning. It does **not** call any model; it only does the routing math, so it costs nothing to run and nothing to call except the tiny Apify Pay-Per-Event fee when hosted.

## Why this exists

- **Zero new learning** — it reuses the curated model list and free channels already built for [FACT](https://github.com/PanStories/free-and-cheap-tokens).
- **Zero marginal cost** — routing is pure local computation; no paid API is ever called.
- **100% brand synergy** — it complements FACT's "free/cheap tokens" positioning and cross-sells to the same users.
- **Monetization** — advanced routing / caching / the cost-comparison report layer is the hosted paid tier.
- **Cold-start revenue estimate** — ¥0–¥500/month via FACT-user conversion.

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

**Cheapest-LLM Router** 是一个 [MCP](https://modelcontextprotocol.io) 服务器：给定一条 prompt，它会自动选出**当下最便宜且能真正服务它的模型**——优先免费模型，其次最低成本的付费兜底——并以美元和人民币双币种返回成本、兜底链与推理说明。它**不会**真正调用任何模型，只做路由计算，因此本地运行零成本，托管后除极低的 Apify 按事件计费外也无其他开销。

## 为什么做这个

- **零新学习**——直接复用为 [FACT](https://github.com/PanStories/free-and-cheap-tokens) 策展的模型清单与免费通道。
- **零边际成本**——路由是纯本地计算，从不调用任何付费 API。
- **100% 品牌协同**——与 FACT「免费/廉价 token」定位天然互补，可向同一批用户交叉转化。
- **变现点**——高级路由 / 缓存 / 成本对比报表层即托管的付费能力。
- **冷启动月收入预估**——¥0–¥500（靠 FACT 用户转化）。

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

**Cheapest-LLM Router** 是一個 [MCP](https://modelcontextprotocol.io) 伺服器：給定一條 prompt，它會自動選出**當下最便宜且能真正服務它的模型**——優先免費模型，其次最低成本的付費兜底——並以美元與人民幣雙幣種回傳成本、兜底鏈與推理說明。它**不會**真正呼叫任何模型，只做路由計算，因此本地執行零成本，託管後除極低的 Apify 按事件計費外也無其他開銷。

## 為什麼做這個

- **零新學習**——直接複用為 [FACT](https://github.com/PanStories/free-and-cheap-tokens) 策展的模型清單與免費通道。
- **零邊際成本**——路由是純本地計算，從不呼叫任何付費 API。
- **100% 品牌協同**——與 FACT「免費/廉價 token」定位天然互補，可向同一批用戶交叉轉化。
- **變現點**——進階路由 / 快取 / 成本對比報表層即託管的付費能力。
- **冷啟動月收入預估**——¥0–¥500（靠 FACT 用戶轉化）。

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
