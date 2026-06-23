#!/usr/bin/env bash
set -euo pipefail
COMPOSE="$(dirname "$0")/compose.sh"
echo "==> docker compose down -v (main stack)"
bash "$COMPOSE" down -v
echo "==> docker compose up -d --build"
bash "$COMPOSE" up -d --build
