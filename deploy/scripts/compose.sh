#!/usr/bin/env bash
set -euo pipefail
COMPOSE_FILE="$(cd "$(dirname "$0")/.." && pwd)/docker-compose.yml"
exec docker compose -f "$COMPOSE_FILE" "$@"
