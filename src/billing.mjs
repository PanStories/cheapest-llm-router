// Billing integration for Apify Pay-Per-Event (PPE).
//
// Mirrors the proven pattern from Free & Cheap Tokens (FaCT):
//   - Only PAID MCP tool calls are charged.
//   - initialize / tools/list / report-issue are free and never charged.
//   - Charging is best-effort: any failure is logged and never blocks the
//     response, so a billing hiccup can never break the MCP endpoint.
//
// Event names MUST match the pricingEvents declared in .actor/actor.json.

const EVENT_BY_TOOL = {
  route: 'mcp-route',
  cost_compare: 'mcp-cost-compare',
  list_models: 'mcp-list-models',
  cache_route: 'mcp-cache-route',
};

let actorModPromise = null;
let initPromise = null;

function isAtHome() {
  // Apify sets APIFY_IS_AT_HOME="1" on the platform; locally it is undefined.
  return !!process.env.APIFY_IS_AT_HOME;
}

function extractToolName(body) {
  const msgs = Array.isArray(body) ? body : [body];
  for (const m of msgs) {
    if (m && m.method === 'tools/call' && m.params && m.params.name) {
      return m.params.name;
    }
  }
  return null;
}

export async function chargeForRequest(body) {
  if (!isAtHome()) return; // local / dev — never charge
  const tool = extractToolName(body);
  const event = tool ? EVENT_BY_TOOL[tool] : null;
  if (!event) return; // free events and non-tool messages
  try {
    if (!actorModPromise) {
      actorModPromise = import('apify').then((m) => m.Actor).catch(() => null);
    }
    const Actor = await actorModPromise;
    if (!Actor) return;
    if (!initPromise) initPromise = Actor.init();
    await initPromise;
    await Actor.charge({ eventName: event });
  } catch (err) {
    console.warn(`[PPE charge skipped] ${event}: ${err && err.message ? err.message : err}`);
  }
}
