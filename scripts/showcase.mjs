// Generates showcase.html — a data-driven verification report that runs the real
// routing engine over representative prompts and renders the actual output.
// Run: `node scripts/showcase.mjs`  (writes ../showcase.html)
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync } from 'node:fs';

import { route, costCompare, listModels, getRegistry } from '../src/core/router.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const reg = getRegistry();
const cny = reg.meta.currency_pair_usd_cny ?? 7.2;

const samples = [
  {
    title: '中文财报推理',
    prompt: '用中文分析这份财报的核心风险与分红可持续性。',
    args: { prompt: '用中文分析这份财报的核心风险与分红可持续性。', required_capabilities: ['chinese', 'reasoning'], region: 'CN', priority: 'cost' },
  },
  {
    title: '代码生成（全球）',
    prompt: 'Write a Python function to backtest a moving-average crossover strategy.',
    args: { prompt: 'Write a Python function to backtest a moving-average crossover strategy.', required_capabilities: ['code'], region: 'global', priority: 'cost' },
  },
  {
    title: '图像理解（Vision）',
    prompt: 'Describe the trends visible in this candlestick-chart screenshot.',
    args: { prompt: 'Describe the trends visible in this candlestick-chart screenshot.', required_capabilities: ['vision'], region: 'global', priority: 'cost' },
  },
  {
    title: '长上下文摘要',
    prompt: 'Summarize this 80-page legal contract and list the risky clauses.',
    args: { prompt: 'Summarize this 80-page legal contract and list the risky clauses.', required_capabilities: ['long_context'], region: 'global', priority: 'cost' },
  },
  {
    title: '低延迟优先',
    prompt: 'Classify this customer-support ticket into one of 5 categories.',
    args: { prompt: 'Classify this customer-support ticket into one of 5 categories.', priority: 'latency' },
  },
  {
    title: '高质量优先',
    prompt: 'Produce a rigorous proof of the Law of Large Numbers (weak form).',
    args: { prompt: 'Produce a rigorous proof of the Law of Large Numbers (weak form).', priority: 'quality' },
  },
  {
    title: '大陆可用 + 视觉',
    prompt: '识别这张商品图里的文字并翻译。',
    args: { prompt: '识别这张商品图里的文字并翻译。', required_capabilities: ['vision', 'chinese'], region: 'CN', priority: 'cost' },
  },
  {
    title: '不可能组合（应返回 ok:false）',
    prompt: 'anything',
    args: { prompt: 'anything', required_capabilities: ['vision', 'chinese'], region: 'CN', include_paid: false },
  },
];

for (const s of samples) {
  s.result = route(s.args);
  s.compare = costCompare({ prompt: s.args.prompt, max_output_tokens: s.args.max_output_tokens, required_capabilities: s.args.required_capabilities, region: s.args.region });
}

const freeCount = reg.models.filter((m) => m.free).length;
const paidCount = reg.models.length - freeCount;
const providers = new Set(reg.models.map((m) => m.provider_name)).size;

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function modelRow(m) {
  return `<tr><td>${esc(m.name)}</td><td>${esc(m.provider)}</td><td>${m.free ? '<span class="tag tag-free">FREE</span>' : '<span class="tag tag-paid">PAID</span>'}</td><td>$${m.cost_usd.toFixed(4)}</td><td>¥${m.cost_cny.toFixed(3)}</td><td>${esc((m.capabilities || []).join(', '))}</td></tr>`;
}

const cards = samples
  .map((s, i) => {
    const r = s.result;
    const status = r.ok ? '<span class="tag tag-ok">ROUTED</span>' : '<span class="tag tag-bad">NO MATCH</span>';
    const chosen = r.ok
      ? `<div class="chosen">
           <div class="chosen-name">${esc(r.chosen.name)}</div>
           <div class="chosen-meta">${esc(r.chosen.provider)} · ${r.chosen.free ? '免费' : '付费'} · ${r.chosen.latency_tier} latency · quality ${r.chosen.quality_score}</div>
           <div class="chosen-cost">est. cost: $${r.estimated_cost_usd.toFixed(4)} / ¥${r.estimated_cost_cny.toFixed(3)} · ${r.estimated_input_tokens} in + ${r.estimated_output_tokens} out tokens</div>
           <div class="reasoning">${esc(r.reasoning)}</div>
           <div class="fb">Fallbacks: ${r.ok ? r.fallback_chain.map((f) => esc(f.name)).join(' → ') : '—'}</div>
         </div>`
      : `<div class="chosen"><div class="chosen-name">${esc(r.reasoning || r.message)}</div></div>`;
    const cmp = s.compare.comparisons
      .slice(0, 6)
      .map(modelRow)
      .join('');
    return `<section class="card">
      <header class="card-head"><span class="idx">${i + 1}</span><h3>${esc(s.title)}</h3>${status}</header>
      <div class="prompt">${esc(s.prompt)}</div>
      ${chosen}
      <details class="raw"><summary>Cost comparison (top 6)</summary>
        <table class="cmp"><thead><tr><th>#</th><th>Model</th><th>Provider</th><th>Tier</th><th>$/call</th><th>¥/call</th><th>Caps</th></tr></thead><tbody>${cmp}</tbody></table>
        <p class="savings">Max savings vs most expensive reachable: $${s.compare.max_savings_usd.toFixed(4)} / ¥${s.compare.max_savings_cny.toFixed(3)} (${esc(s.compare.cheapest_model)} → ${esc(s.compare.most_expensive_model)})</p>
      </details>
      <details class="raw"><summary>Raw JSON (route result)</summary><pre>${esc(JSON.stringify(r, null, 2))}</pre></details>
    </section>`;
  })
  .join('\n');

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Cheapest-LLM Router — Verification Showcase</title>
<style>
  :root{
    --bg:#0f172a; --panel:#111c34; --panel-2:#16233f; --ink:#e8eef7; --muted:#9fb0c8;
    --line:#23324f; --accent:#2dd4bf; --accent-2:#3b82f6; --free:#22c55e; --paid:#f59e0b;
    --ok:#22c55e; --bad:#ef4444; --radius:14px; --mono:'SFMono-Regular',ui-monospace,Menlo,Consolas,monospace;
  }
  *{box-sizing:border-box}
  body{margin:0;background:linear-gradient(180deg,#0b1220,#0f172a 240px);color:var(--ink);
    font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Noto Sans SC',sans-serif;line-height:1.55}
  .wrap{max-width:980px;margin:0 auto;padding:32px 20px 80px}
  header.top{display:flex;align-items:center;gap:14px;margin-bottom:8px}
  .logo{width:42px;height:42px;flex:0 0 42px}
  h1{font-size:24px;margin:0;letter-spacing:.3px}
  .sub{color:var(--muted);font-size:14px;margin:2px 0 0}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:22px 0 6px}
  .stat{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:14px 16px}
  .stat .n{font-size:26px;font-weight:700;color:var(--accent)}
  .stat .l{color:var(--muted);font-size:12px;margin-top:2px}
  .note{background:var(--panel-2);border:1px solid var(--line);border-left:3px solid var(--accent-2);
    border-radius:10px;padding:14px 16px;margin:22px 0;font-size:13.5px;color:var(--muted)}
  .note b{color:var(--ink)}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:18px;margin:16px 0}
  .card-head{display:flex;align-items:center;gap:10px}
  .card-head h3{margin:0;font-size:16px}
  .idx{width:24px;height:24px;border-radius:50%;background:var(--panel-2);border:1px solid var(--line);
    display:inline-flex;align-items:center;justify-content:center;font-size:12px;color:var(--muted)}
  .prompt{color:var(--muted);font-size:13.5px;margin:10px 0;border-left:2px solid var(--line);padding-left:10px}
  .chosen{background:var(--panel-2);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:6px 0}
  .chosen-name{font-weight:700;font-size:15px;color:var(--accent)}
  .chosen-meta{color:var(--muted);font-size:12.5px;margin-top:3px}
  .chosen-cost{color:var(--ink);font-size:13px;margin-top:6px;font-family:var(--mono)}
  .reasoning{color:var(--muted);font-size:12.5px;margin-top:8px}
  .fb{color:var(--muted);font-size:12px;margin-top:6px}
  .tag{font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid var(--line);font-family:var(--mono)}
  .tag-free{color:var(--free);border-color:rgba(34,197,94,.4)}
  .tag-paid{color:var(--paid);border-color:rgba(245,158,11,.4)}
  .tag-ok{color:var(--ok);border-color:rgba(34,197,94,.4)}
  .tag-bad{color:var(--bad);border-color:rgba(239,68,68,.4)}
  details.raw{margin-top:10px;border-top:1px dashed var(--line);padding-top:8px}
  details.raw summary{cursor:pointer;color:var(--accent-2);font-size:12.5px}
  pre{background:#0a1322;border:1px solid var(--line);border-radius:8px;padding:12px;overflow:auto;
    font-family:var(--mono);font-size:11.5px;color:#cfe3ff;max-height:320px}
  table.cmp{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px}
  table.cmp th,table.cmp td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);color:var(--muted)}
  table.cmp th{color:var(--ink);font-weight:600}
  .savings{color:var(--accent);font-size:12.5px;margin:8px 0 0}
  footer{color:var(--muted);font-size:12px;margin-top:30px;border-top:1px solid var(--line);padding-top:16px}
  footer code{color:#cfe3ff}
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <svg class="logo" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="6" y="18" width="12" height="12" rx="3" stroke="#2dd4bf" stroke-width="2"/>
      <rect x="30" y="6" width="12" height="12" rx="3" stroke="#3b82f6" stroke-width="2"/>
      <rect x="30" y="30" width="12" height="12" rx="3" stroke="#22c55e" stroke-width="2"/>
      <path d="M18 24 H30 M36 12 V18 M36 36 V30" stroke="#9fb0c8" stroke-width="2"/>
    </svg>
    <div>
      <h1>Cheapest-LLM Router</h1>
      <div class="sub">Verification Showcase — 真实路由引擎输出（非摘要）</div>
    </div>
  </header>

  <div class="stats">
    <div class="stat"><div class="n">${reg.models.length}</div><div class="l">收录模型</div></div>
    <div class="stat"><div class="n">${freeCount}</div><div class="l">免费通道</div></div>
    <div class="stat"><div class="n">${paidCount}</div><div class="l">廉价付费兜底</div></div>
    <div class="stat"><div class="n">${providers}</div><div class="l">来源厂商</div></div>
  </div>

  <div class="note">
    <b>这是什么：</b>给定一条 prompt，路由器自动选出<b>当下最便宜且可达</b>的模型（优先免费通道：Kimi K2.6 / Qwen / DeepSeek / Cloudflare Workers AI / Groq / Gemini 等），并给出兜底链与成本估算。
    下表每个样本都是<b>路由引擎真实计算</b>的结果（含 Raw JSON 可展开核对字节）。
    <br/><b>数据源：</b>复用 Free &amp; Cheap Tokens（FACT）已核验的促销清单 + 市场标价。价格为<b>指示性 USD/百万token</b>，生产前请以各厂商定价页为准。
  </div>

  ${cards}

  <footer>
    <p><b>Agent 如何消费：</b>本 MCP 为 <b>pull-based、read-only</b>。Agent 经 <code>initialize → tools/list → tools/call(route)</code> 主动拉取；
    拿到 <code>chosen.model_ref + access_path</code> 后，自行用对应厂商的 OpenAI 兼容接口发起调用。路由结果仅作为<b>约束建议</b>，不修改 agent 权重或 system prompt。</p>
    <p><b>本工具不做什么（诚实边界）：</b>① 不替你发起真实推理请求（只选路由）；② 不缓存或存储你的 prompt（hosted 持久缓存为付费能力）；
    ③ 不保证免费额度实时可用（额度由厂商控制，可能 429）；④ 价格随厂商变动，请以官方为准。</p>
    <p>Generated ${new Date().toISOString().slice(0, 10)} · Cheapest-LLM Router v0.2.0 · MIT</p>
  </footer>
</div>
</body>
</html>`;

const outPath = join(__dirname, '..', 'showcase.html');
writeFileSync(outPath, html, 'utf8');
console.log('[ok] showcase.html written ->', outPath, `(${samples.length} samples)`);
