# Cheapest-LLM Router — Apify Standby Actor Dockerfile.
#
# Architecture: self-managed Express server (src/http.mjs) listening on
# APIFY_CONTAINER_PORT, serving the MCP Streamable HTTP endpoint at /mcp.
# usesStandbyMode keeps a warm container; webServerMcpPath exposes /mcp.
# Pay-Per-Event: $0 idle cost — we only pay when a tool call earns.
#
# Base: apify/actor-node:24-slim (Node 24 LTS + Apify runtime/bootstrap).

FROM apify/actor-node:24-slim

WORKDIR /home/my-user/

# Cache the dependency layer.
COPY package.json ./
RUN npm install --no-audit --no-fund

# Runtime source (install already pulled express + MCP SDK + apify).
COPY . ./

ENV NODE_ENV=production
ENV APIFY_CONTAINER_PORT=4321

EXPOSE 4321

CMD ["node", "src/http.mjs"]
