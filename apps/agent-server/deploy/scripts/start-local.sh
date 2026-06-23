#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/compose.sh" --profile agent up -d --build
echo "  Agent API  http://localhost:7003"
