#!/usr/bin/env bash
set -euo pipefail
C="$(dirname "$0")/compose.sh"
bash "$C" down -v
bash "$C" up -d --build
