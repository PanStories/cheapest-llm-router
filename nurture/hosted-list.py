#!/usr/bin/env python3
"""Live check: list_models(free_only) on the hosted Standby — must be 14 and exclude kimi-k2.6-cloudflare."""
import json, urllib.request

TOK = json.load(open(r"C:/Users/USER/.apify/auth.json", encoding="utf-8"))["token"]
URL = "https://neeenja--cheapest-llm-router.apify.actor/mcp"
H = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream",
     "Authorization": "Bearer " + TOK}

def post(p, session=None):
    headers = dict(H)
    if session: headers["Mcp-Session-Id"] = session
    req = urllib.request.Request(URL, data=json.dumps(p).encode(), headers=headers, method="POST")
    resp = urllib.request.urlopen(req, timeout=60)
    return resp.headers, resp.read().decode(errors="ignore")

def parse_sse(body):
    for line in body.splitlines():
        if line.startswith("data:"):
            c = line[5:].strip()
            if c:
                try: return json.loads(c)
                except Exception: pass
    return None

s, b = post({"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"v","version":"1"}}})
session = s.get("Mcp-Session-Id")
msg = parse_sse(b) if "text/event-stream" in (s.get("Content-Type") or "") else json.loads(b)
print("server version:", (msg or {}).get("result",{}).get("serverInfo",{}).get("version"))
post({"jsonrpc":"2.0","method":"notifications/initialized"}, session=session)
s2,b2 = post({"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_models","arguments":{"free_only":True}}}, session=session)
msg2 = parse_sse(b2) if "text/event-stream" in (s2.get("Content-Type") or "") else json.loads(b2)
if "error" in msg2:
    print("LIST_MODELS ERROR:", msg2["error"]["message"]); raise SystemExit(1)
print("raw msg2:", json.dumps(msg2, ensure_ascii=False)[:400])
text = msg2["result"]["content"][0]["text"]
payload = json.loads(text)
models = payload.get("models", payload) if isinstance(payload, dict) else payload
ids = [m["id"] for m in models]
print("free models returned:", len(models), "| count field:", payload.get("count"))
print("kimi-k2.6-cloudflare in free list?", "kimi-k2.6-cloudflare" in ids)
print("kimi-k2-moonshot-trial (genuinely free) present?", "kimi-k2-moonshot-trial" in ids)
