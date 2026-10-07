#!/usr/bin/env python3
"""Peek at the live Apify Store page for cheapest-llm-router (Stage 0 fact)."""
import re
import sys

import pathlib
h = (pathlib.Path(__file__).parent / "store.html").read_text(encoding="utf-8", errors="ignore")
print("bytes:", len(h))
pats = [
    r"from \$(?:[0-9]|,|\.)+ / 1,000",
    r"Pay per event[^<]{0,60}",
    r"\$(?:0\.00[0-9]+)",
    r"<title>(.*?)</title>",
    r'name="description" content="(.*?)"',
    r"English",
    r"简体中文",
    r"繁體中文",
]
for p in pats:
    m = re.findall(p, h)
    print(f"{p[:38]:40s} -> {list(dict.fromkeys(m))[:4]}")
