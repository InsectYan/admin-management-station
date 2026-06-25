#!/usr/bin/env bash
set -euo pipefail
C="$(dirname "$0")/compose.sh"
bash "$C" --profile novel down -v
bash "$C" --profile novel up -d --build
