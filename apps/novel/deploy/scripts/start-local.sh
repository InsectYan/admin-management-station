#!/usr/bin/env bash
set -euo pipefail
echo "==> docker compose --profile novel up -d --build"
bash "$(dirname "$0")/compose.sh" --profile novel up -d --build
echo "  Frontend  http://localhost:8081"
echo "  API       http://localhost:7002"
