#!/bin/sh
set -eu
cd "$(dirname "$0")/philhealth"
command -v node >/dev/null || { echo "Install Node.js 22 or newer first."; exit 1; }
[ -d node_modules ] || npm ci
exec npm start
