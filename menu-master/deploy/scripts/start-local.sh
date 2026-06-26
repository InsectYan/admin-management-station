#!/usr/bin/env bash
set -euo pipefail
APP_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND_ENV="$APP_ROOT/backend/.env"
BACKEND_EXAMPLE="$APP_ROOT/backend/.env.example"
FRONTEND_ENV="$APP_ROOT/frontend/.env.local"
FRONTEND_EXAMPLE="$APP_ROOT/frontend/.env.local.example"

[[ ! -f "$BACKEND_ENV" && -f "$BACKEND_EXAMPLE" ]] && cp "$BACKEND_EXAMPLE" "$BACKEND_ENV"
[[ ! -f "$FRONTEND_ENV" && -f "$FRONTEND_EXAMPLE" ]] && cp "$FRONTEND_EXAMPLE" "$FRONTEND_ENV"

SCRIPT_DIR="$(dirname "$0")"
bash "$SCRIPT_DIR/compose.sh" up -d postgres
node "$SCRIPT_DIR/sync-subapps.mjs"
bash "$SCRIPT_DIR/compose.sh" up -d --build
echo "  Frontend  http://localhost:5173"
echo "  Main API  http://localhost:7001/api/health"
