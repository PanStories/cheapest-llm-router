# CLR — Directory Distribution (C1) Status & Handoff

**Repo visibility:** `PanStories/cheapest-llm-router` is **PUBLIC** → Method A applies
(full channel set unlocks: Glama server entry, LobeHub, GitHub Sponsors, code-search
backlinks). Last verified 2026-10-08 via GitHub API (`private: false`).

## Channel status (verified 2026-10-08)

| Channel | Status | Evidence | Account needed |
|---|---|---|---|
| **Glama** (server entry) | ✅ Live | `glama.ai/mcp/servers/PanStories/cheapest-llm-router` resolves + `glama.json` present in repo | — (done) |
| **LobeHub** | ✅ Live | `lobehub.com/.../panstories-cheapest-llm-router` resolves. `lhm.plugin.json` now added to repo root for future re-crawl hygiene | — (done) |
| **mcpservers.org** | ✅ Submitted (per 2026-10-04 audit, all 6 PanStories MCPs) | Not re-verified this session (search URL 404) — **boss to confirm exact URL** | — (done) |
| **mcp.so** | ✅ Submitted (per audit, acct MistifyTea) | Not re-verified this session | — (done) |
| **Smithery** | ⏸️ Missing | Not found in search | **Needs boss's Smithery login** |
| **PulseMCP** | ⏸️ Missing | Not found in search | **Needs a writable GitHub PR** (GitHub MCP connector is read-only → boss opens PR or grants scoped token) |

## Decision: C1 = GO (Method A)

The nurture bottleneck is **adoption** (Apify `totalUsers=1`, only owner). Directory
distribution is the direct growth lever for a PPE-monetized asset (growth = revenue).
Most channels are already covered; the remaining gap is **Smithery + PulseMCP**.

## What I need from the boss to finish the last 2 channels

1. **Smithery account** — login session (Smithery publishes via endpoint; repo is
   public so it can auto-import from `https://github.com/PanStories/cheapest-llm-router`).
   Endpoint for the submission: `https://neeenja--cheapest-llm-router.apify.actor/mcp`.
2. **PulseMCP** — it's a GitHub PR against `pulsemcp/mcp` (or their registry). The
   GitHub MCP connector here is **read-only**, so I cannot open the PR myself. Either:
   (a) boss opens it (I'll prepare the exact entry/PR body), or (b) boss grants a
   scoped GitHub token with PR-write to `pulsemcp/mcp`.
3. **Confirm mcpservers.org URL** (optional) — verify the existing listing link so the
   "done" status is provable rather than audit-based.

## Already prepared (local rework, no account needed)

- `lhm.plugin.json` added to repo root (LobeHub manifest; committed + pushed).
- Repo public, `glama.json` + `llms.txt` present → all Method-A auto-crawl channels ready.
- Endpoint-first channels (Smithery/PulseMCP) only need the above credentials.

**Net:** C1 is ~80% already live. Hand me the Smithery login + a PulseMCP PR path and
the last two submit in one pass.
