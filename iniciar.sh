#!/bin/bash
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Falta instalar Node.js: https://nodejs.org (version LTS)"; exit 1; }
[ -f .env ] || cp .env.example .env
[ -d node_modules ] || npm install || exit 1
echo "Abri http://localhost:3000 en tu navegador (no cierres esta ventana)."
( sleep 8; (command -v open >/dev/null && open http://localhost:3000) || (command -v xdg-open >/dev/null && xdg-open http://localhost:3000) ) &
npm run dev
