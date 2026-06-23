#!/usr/bin/env bash
# 统一 Docker Compose 入口（对齐 cartoon-agent deploy/scripts/compose.sh）
set -euo pipefail
DEPLOY_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="${AMS_COMPOSE_FILE:-$DEPLOY_DIR/docker-compose.yml}"
exec docker compose -f "$COMPOSE_FILE" "$@"
