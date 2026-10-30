#!/usr/bin/env bash
# Build and redeploy to the Hetzner box (us.pinkstrokes.com). Caddy (aeyez compose) proxies to the
# `ghostline` container on the aeyez_default network; coturn runs as `ghostline-turn` (host network).
# Secrets live only on the server in /root/ghost-line/.env (TURN_SECRET, TURN_URLS).
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
rsync -az --delete --exclude node_modules --exclude .certs --exclude .env --exclude turnserver.conf \
  dist server shared package.json package-lock.json root@us.pinkstrokes.com:/root/ghost-line/
ssh root@us.pinkstrokes.com 'docker restart ghostline >/dev/null && sleep 8 && docker logs --tail 3 ghostline'
curl -s -o /dev/null -w "https://us.pinkstrokes.com -> %{http_code}\n" https://us.pinkstrokes.com/
