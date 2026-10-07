#!/usr/bin/env python3
"""Stage 0 fact collector: pull live Apify facts for cheapest-llm-router.

Read-only. Prints: actor metadata, pricingInfos ledger, last-30-day run stats
(status / chargedEventCounts / tool mix via run log is fetched separately).
"""
import json
import sys
import urllib.request
from collections import Counter
from datetime import datetime, timedelta, timezone

AUTH = r"C:/Users/USER/.apify/auth.json"
API = "https://api.apify.com/v2"
ACTOR = "vYER8NboapafgX0U7"


def token():
    with open(AUTH, encoding="utf-8") as fh:
        return json.load(fh)["token"]


def api(tok, path):
    req = urllib.request.Request(API + path, headers={"Authorization": "Bearer " + tok})
    return json.loads(urllib.request.urlopen(req, timeout=45).read().decode())


def main():
    tok = token()
    act = api(tok, f"/acts/{ACTOR}")["data"]
    print("== ACTOR ==")
    for k in ("id", "name", "title", "username", "isPublic", "isDeprecated",
              "createdAt", "modifiedAt", "stats"):
        print(f"  {k}: {act.get(k)}")
    print(f"  pricingModel: {act.get('pricingModel')}")
    pi = act.get("pricingInfos") or []
    print(f"  pricingInfos records: {len(pi)}")
    for i, rec in enumerate(pi):
        print(f"    [{i}] pricingModel={rec.get('pricingModel')} "
              f"createdAt={rec.get('createdAt')} events:")
        for name, ev in (rec.get("pricingPerEvent") or {}).get("actorEvents", {}).items():
            print(f"        {name}: ${ev.get('eventPriceUsd')}")

    since = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat().replace("+00:00", "Z")
    runs = api(tok, f"/acts/{ACTOR}/runs?limit=200&desc=true")["data"]["items"]
    print(f"\n== RUNS (fetched {len(runs)}) ==")
    recent = [r for r in runs if (r.get("startedAt") or "") >= since]
    print(f"  last-30-days: {len(recent)} / all-time-fetched: {len(runs)}")
    print(f"  status mix: {dict(Counter(r.get('status') for r in runs))}")
    print(f"  charge mix: {dict(Counter(json.dumps(r.get('chargedEventCounts') or {}) for r in runs))}")
    ev = Counter()
    for r in runs:
        for k, v in (r.get("chargedEventCounts") or {}).items():
            ev[k] += v
    print(f"  total charged events: {dict(ev)}")
    print(f"  first run: {runs[-1].get('startedAt') if runs else None}")
    print(f"  latest run: {runs[0].get('startedAt') if runs else None}")
    print("\n  sample runs (latest 15):")
    for r in runs[:15]:
        print(f"    {r.get('startedAt')} {r.get('status'):10s} "
              f"charged={json.dumps(r.get('chargedEventCounts') or {})} "
              f"origin={r.get('meta', {}).get('origin')}")


if __name__ == "__main__":
    sys.exit(main())
