#!/usr/bin/env bash
set -euo pipefail
echo "==> docker compose up -d --build"
bash "$(dirname "$0")/compose.sh" up -d --build
echo "  Frontend  http://localhost:5101"
echo "  API       http://localhost:5201"
