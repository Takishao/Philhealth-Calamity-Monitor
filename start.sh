#!/bin/sh
set -eu
cd "$(dirname "$0")/philhealth"
command -v node >/dev/null || { echo "Install Node.js 22 or newer first."; exit 1; }
[ -d node_modules ] || npm ci
npm run seed
printf '\nOpen http://localhost:3000 — illustrative demo: cfb / demo1234\n'
exec npm start
