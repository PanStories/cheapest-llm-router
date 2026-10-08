#!/usr/bin/env python3
"""Live verification of the hosted CLR Standby MCP endpoint."""
import json, urllib.request, urllib.error, sys

TOK = json.load(open(r"C:/Users/USER/.apify/auth.json", encoding="utf-8"))["token"]
URL = "https://neeenja--cheapest-llm-router.apify.actor/mcp"
H = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
    "Authorization": "Bearer " + TOK,
}

def post(payload, session=None, notify=False):
    headers = dict(H)
    if session:
        headers["Mcp-Session-Id"] = session
    if notify:
        headers["Accept"] = "application/json, text/event-stream"
    data = json.dumps(payload).encode()
    req = urllib.request.Request(URL, data=data, headers=headers, method="POST")
    try:
        resp = urllib.request.urlopen(req, timeout=60)
    except urllib.error.HTTPError as e:
        return e.code, e.headers, e.read().decode(errors="ignore")
    body = resp.read().decode(errors="ignore")
    return resp.status, resp.headers, body

def parse_sse(body):
    for line in body.splitlines():
        if line.startswith("data:"):
            chunk = line[5:].strip()
            if chunk:
                try:
                    return json.loads(chunk)
                except json.JSONDecodeError:
                    pass
    return None

# 1) initialize
s, hdr, body = post({
    "jsonrpc": "2.0", "id": 1, "method": "initialize",
    "params": {"protocolVersion": "2025-06-18",
               "capabilities": {}, "clientInfo": {"name": "verify", "version": "1"}},
})
print("initialize status:", s, "| session:", hdr.get("Mcp-Session-Id"))
msg = parse_sse(body) if "text/event-stream" in (hdr.get("Content-Type") or "") else json.loads(body)
print("server:", (msg or {}).get("result", {}).get("serverInfo"))

session = hdr.get("Mcp-Session-Id")

# 2) initialized notification
post({"jsonrpc": "2.0", "method": "notifications/initialized"}, session=session, notify=True)

# 3) route call — simple reasoning prompt, global, include free
s2, hdr2, body2 = post({
    "jsonrpc": "2.0", "id": 2, "method": "tools/call",
    "params": {"name": "route", "arguments": {
        "prompt": "Summarize this earnings report in Chinese",
        "max_output_tokens": 512, "required_capabilities": ["chinese", "reasoning"],
        "region": "global", "priority": "cost", "include_paid": True}},
}, session=session)
msg2 = parse_sse(body2) if "text/event-stream" in (hdr2.get("Content-Type") or "") else json.loads(body2)
res = (msg2 or {}).get("result", {})
text = res.get("content", [{}])[0].get("text", "") if isinstance(res.get("content"), list) else str(res)
try:
    parsed = json.loads(text)
except Exception:
    parsed = None
if parsed:
    print("chosen:", parsed.get("chosen", {}).get("name"), "| free:", parsed.get("chosen", {}).get("free"),
          "| requires_paid_plan:", parsed.get("chosen", {}).get("requires_paid_plan"))
    print("fallbacks:", [f.get("name") for f in parsed.get("fallback_chain", [])])
    print("estimated_cost_usd:", parsed.get("estimated_cost_usd"))
    print("savings:", json.dumps(parsed.get("savings")))
else:
    print("RAW:", text[:400])
