#!/usr/bin/env bash
set -euo pipefail
C="$(dirname "$0")/compose.sh"
bash "$C" --profile agent down -v
bash "$C" --profile agent up -d --build
