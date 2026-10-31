#!/usr/bin/env bash
set -euo pipefail
PR="$1"
[[ "$PR" =~ ^[0-9]+$ ]] || { echo "bad PR number"; exit 1; }
DIR="/srv/previews/pr-$PR"
if [ -d "$DIR" ]; then
  cd "$DIR"
  PR="$PR" docker compose -p "pr-$PR" down -v --remove-orphans
  cd /srv/previews && rm -rf "$DIR"
fi
