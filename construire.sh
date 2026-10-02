#!/bin/bash
# Construit app.js : tout le site (src/ + three) en un seul fichier, téléchargé d'un coup par index.html (v18).
# À relancer après chaque modification de src/. Écrit aussi sa taille dans index.html (pour le pourcentage).
set -e; cd "$(dirname "$0")"
$(command -v esbuild >/dev/null && echo esbuild || echo "npx --yes esbuild@0.24.0") src/main.js --bundle --format=esm --minify --charset=utf8 \
  --alias:three=./vendor/three@0.170.0/three.module.min.js --alias:three/addons=./vendor/three@0.170.0/addons \
  --external:'https://*' --outfile=app.js --log-level=warning
taille=$(wc -c < app.js); sed -i "s/data-taille=\"[0-9]*\"/data-taille=\"$taille\"/" index.html; echo "app.js : $taille octets"
