#!/usr/bin/env bash
set -euo pipefail
DEPLOY_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$DEPLOY_DIR/.." && pwd)"
COMPOSE_FILE="${AMS_COMPOSE_FILE:-$DEPLOY_DIR/docker-compose.yml}"
ENV_FILE="$DEPLOY_DIR/config/.env.local"

ARGS=(-f "$COMPOSE_FILE")
if [[ -f "$ENV_FILE" ]]; then
  ARGS+=(--env-file "$ENV_FILE")
fi
exec docker compose "${ARGS[@]}" "$@"
