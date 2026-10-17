#!/usr/bin/env sh
# Formula Studio — çevrimdışı başlatıcı / офлайн-запуск / offline launcher.
# Opens index.html in the default browser. No server, no internet needed.
DIR="$(cd "$(dirname "$0")" && pwd)"
FILE="$DIR/index.html"
if command -v xdg-open >/dev/null 2>&1; then xdg-open "$FILE";
elif command -v open >/dev/null 2>&1; then open "$FILE";
else echo "Open this file in your browser: $FILE"; fi
