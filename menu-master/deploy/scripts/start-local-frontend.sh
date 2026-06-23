#!/usr/bin/env bash
set -euo pipefail
APP_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FRONTEND_ENV="$APP_ROOT/frontend/.env.local"
FRONTEND_EXAMPLE="$APP_ROOT/frontend/.env.local.example"
[[ ! -f "$FRONTEND_ENV" && -f "$FRONTEND_EXAMPLE" ]] && cp "$FRONTEND_EXAMPLE" "$FRONTEND_ENV"
bash "$(dirname "$0")/compose.sh" up main-frontend -d --build
echo "  UI  http://localhost:5173"
