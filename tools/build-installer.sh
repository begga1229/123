#!/usr/bin/env sh
# Formula Studio — one-file Windows installer (FormulaStudio-Setup-<version>.exe) from dist/FormulaStudio-win32-x64.
# Needs makensis (NSIS 3). On Linux the electron-builder NSIS bundle works:  NSISDIR=<nsis dir> sh tools/build-installer.sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION=$(node -p "require('$ROOT/package.json').version")
SRC="$ROOT/dist/FormulaStudio-win32-x64"
[ -d "$SRC" ] || { echo "Build the Windows app first: node tools/build-desktop.js --platform=win32"; exit 1; }
MAKENSIS="${MAKENSIS:-${NSISDIR:+$NSISDIR/linux/makensis}}"
MAKENSIS="${MAKENSIS:-makensis}"
"$MAKENSIS" -V2 -DSRC="$SRC" -DOUT="$ROOT/dist/FormulaStudio-Setup-$VERSION.exe" -DVERSION="$VERSION" -DICON="$ROOT/assets/icons/icon.ico" "$ROOT/tools/installer.nsi"
ls -la "$ROOT/dist/FormulaStudio-Setup-$VERSION.exe"
