#!/usr/bin/env bash
set -euo pipefail
DIR="$(dirname "$0")"
REPO_ROOT="$(cd "$DIR/../.." && pwd)"
export AMS_COMPOSE_FILE="$REPO_ROOT/menu-master/docker-compose.yml"

echo "==> docker compose down -v (main stack)"
bash "$DIR/compose.sh" down -v
bash "$DIR/start-local.sh"
