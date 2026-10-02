# SPEC — Cheapest-LLM Router v0.1.0

> 生成日期：2026-10-02 · 基于 opp-2-ideas Top-1 机会「Cheapest-LLM Router MCP」· 状态：MVP 已验证
> 设计参照：Design MCP skill（SPEC-as-Contract）。本工具为单一用途 utility，未启用完整 7 人专家团流程（≤2h/天、零新学习）。

---

## 1. 产品定义

- **一句话**：给定 prompt，自动路由到最便宜且可达的免费/廉价 LLM，复用 FACT 的模型通道。
- **目标用户**：AI Agent 开发者、个人副业者、成本敏感型自动化工作流。
- **核心问题**：免费/廉价模型分散在 10+ 厂商，且额度/区域/能力各异，手动选型成本高。

## 2. MVP 范围（锁定）

| 优先级 | 功能 | 验收摘要 | 评分 |
|--------|------|----------|------|
| P0 | `route` 工具 | 输入 prompt→输出最便宜可达模型+成本+兜底链 | 核心 |
| P0 | 模型注册表（复用 FACT） | ≥15 个免费 + ≤4 个付费兜底，含能力/区域/价格 | 核心 |
| P0 | 零依赖 stdio MCP server | 纯 node 启动，无需 npm install | 核心 |
| P1 | `cost_compare` 工具 | 全模型成本排序 + 最大节省额 | 变现层 |
| P1 | `list_models` 工具 | 按 capability/region/free 过滤 | 辅助 |
| P1 | `cache_route` 工具 | 进程内缓存命中演示 | 变现层 |
| P2 | Apify PPE 托管 | actor.json + handler（可选依赖） | 分发 |

## 3. 明确不做（Out-of-Scope）

| 功能 | 原因 | 何时考虑 |
|------|------|----------|
| 真实发起推理请求 | 只做路由，避免承担调用成本/合规 | v2 可作为可选代理层 |
| 持久化缓存/账号体系 | 超出 MVP，属 hosted 付费能力 | 上架后 |
| 爬虫自动刷新价格 | FACT 已有人工核验流程 | 复用 FACT |
| 联盟返佣 | 合规负担重（FTC/广告法） | 永不 |

## 4. 技术架构

| 层 | 技术 | 版本 | 锁定原因 |
|----|------|------|----------|
| 运行时 | Node.js | ≥20 | 用户环境/零依赖首选 |
| MCP 传输（stdio） | 手写 JSON-RPC | 2025-06-18 | 零依赖即可跑 |
| MCP 传输（hosted） | @modelcontextprotocol/sdk + Express | 1.30.1 / 5.2.1 | 复用 FACT 已验证栈 |
| 数据 | data/models.json | — | 单一事实源 |
| 部署 | Apify PPE（可选） | — | 无月费、按事件计费 |

## 5. API 端点清单（MCP tools）

| Tool | 输入 | 输出 |
|------|------|------|
| `route` | prompt, max_output_tokens?, required_capabilities?, region?, priority?, include_paid? | chosen / fallback_chain / estimated_cost_usd / estimated_cost_cny / reasoning |
| `cost_compare` | prompt, max_output_tokens?, required_capabilities?, region? | comparisons[] / max_savings_usd / max_savings_cny |
| `list_models` | capability?, region?, free_only? | models[] |
| `cache_route` | 同 route | 同 route + cached:bool |

## 6. 数据库/存储

无。注册表为静态策展 JSON；`cache_route` 仅进程内 Map（hosted 持久缓存为付费能力）。

## 7. 页面清单

无 Web UI 依赖。验证用 `showcase.html`（数据驱动、只读展示）。

## 8. Design Tokens（showcase 用）

- 主色 `--accent:#2dd4bf`（teal）/ `--accent-2:#3b82f6`（blue），深底 `--bg:#0f172a`。
- **P0 红线**：无 emoji 图标（用 inline SVG）、无紫粉渐变、无占位文案、颜色全部走 CSS 变量。

## 9. 验收标准（EARS）

| 编号 | 功能 | 标准 | 优先级 |
|------|------|------|--------|
| AC-01 | route | When 输入合法 prompt，系统**必须**返回 ok:true 且 chosen.free 或付费成本已算 | P0 |
| AC-02 | route | If 无可达模型，系统**必须**返回 ok:false + reason | P0 |
| AC-03 | route | While region=CN，系统**必须**只返回 region 含 CN 的模型 | P0 |
| AC-04 | cost_compare | When 调用，系统**必须**返回按成本升序的 comparisons[] | P1 |
| AC-05 | cache_route | When 相同输入第二次调用，系统**必须**返回 cached:true | P1 |

## 10. 边界与约束

- 不调任何外部付费 API（纯本地计算）。
- region=CN 含义：大陆免 VPN 可达；global 模型从 CN 经 VPN 可用但被排除。
- 价格指示性，以厂商官方为准。

## 11. 内嵌已知坑

| 坑 | 指纹 | 根因 | 修法 |
|----|------|------|------|
| stdio 协议：stdout 混日志 | node stdio | 任何 stdout 非 JSON 会破坏 JSON-RPC | 日志走 stderr，stdout 仅换行分隔 JSON |
| 中文 token 低估 | tokenizer | 中文 1 字≈1.6 token | 估算式对 CJK 加权 |

## 12. 端到端验证步骤

```bash
node --test tests/           # 全部单元测试绿
node scripts/mcp-smoke.mjs   # initialize→tools/list→tools/call(route) 全绿
node scripts/showcase.mjs    # 生成 showcase.html（真实输出）
```

## 13. 变更记录

| 日期 | 变更 | 原因 | 影响 |
|------|------|------|------|
| 2026-10-02 | v0.1.0 初始 MVP | opp-2-ideas Top-1 | 全量 |
