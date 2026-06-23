#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
echo "==> docker compose --profile local up -d --build"
bash "$(dirname "$0")/compose.sh" --profile local up -d --build
echo ""
echo "Local stack started — see deploy/README.md for URLs"
