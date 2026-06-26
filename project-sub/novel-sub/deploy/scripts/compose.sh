#!/usr/bin/env bash
set -euo pipefail
DEPLOY_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="${AMS_COMPOSE_FILE:-$DEPLOY_DIR/docker-compose.yml}"
ENV_FILE="$DEPLOY_DIR/config/.env.local"
ARGS=(-f "$COMPOSE_FILE")
[[ -f "$ENV_FILE" ]] && ARGS+=(--env-file "$ENV_FILE")
exec docker compose "${ARGS[@]}" "$@"
