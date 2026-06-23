#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export AMS_COMPOSE_FILE="$REPO_ROOT/menu-master/docker-compose.yml"

echo "==> docker compose up -d --build (menu-master)"
bash "$(dirname "$0")/compose.sh" up -d --build

echo ""
echo "Local stack started (main app)"
echo "  Main UI     http://localhost:8080"
echo "  Main API    http://localhost:7001/api/health"
echo "  PostgreSQL  localhost:5432"
echo "  Redis       localhost:6379"
echo ""
echo "Full stack:  ams local:all"
echo "Infra only:  ams local:infra"
echo "Stop:        ams local:down"
