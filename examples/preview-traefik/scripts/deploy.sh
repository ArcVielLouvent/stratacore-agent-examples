#!/usr/bin/env bash
set -euo pipefail
PR="$1"; SHA="$2"
[[ "$PR" =~ ^[0-9]+$ ]] || { echo "bad PR number"; exit 1; }
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "bad sha"; exit 1; }
DIR="/srv/previews/pr-$PR"
REPO="${PREVIEW_REPO:-https://github.com/YOUR_ORG/YOUR_REPO.git}"   # private repo: use a deploy key
[ -d "$DIR/.git" ] || git clone "$REPO" "$DIR"
cd "$DIR"
git fetch origin "pull/$PR/head"
git checkout -f "$SHA"
PR="$PR" docker compose -p "pr-$PR" up -d --build
