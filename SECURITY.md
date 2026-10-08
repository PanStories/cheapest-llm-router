# Security Policy

## Scope

Cheapest-LLM Router (CLR) is a **routing-only** MCP server. It performs local
routing math over a bundled, curated model registry. It never calls a model
provider API, never forwards your prompts anywhere, and stores no user data.
The hosted variant runs the same read-only logic behind Apify's Pay-Per-Event
gateway.

## Reporting a Vulnerability

If you believe you have found a security issue, please report it **privately**
via GitHub's private vulnerability reporting (do NOT open a public issue):

https://github.com/PanStories/cheapest-llm-router/security/advisories/new

Include the affected version, reproduction steps, and impact. We aim to
acknowledge reports within 72 hours.

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.2.x   | ✅        |
| < 0.2   | ❌        |

## Disclosure

We follow coordinated disclosure: we confirm the issue, ship a fix, and credit
the reporter (unless anonymity is requested) in the release notes.
