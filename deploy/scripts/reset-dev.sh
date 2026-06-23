#!/usr/bin/env bash
set -euo pipefail
DIR="$(dirname "$0")"
bash "$DIR/compose.sh" --profile local down -v
bash "$DIR/start-local.sh"
