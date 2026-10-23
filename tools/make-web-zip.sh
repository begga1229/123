#!/usr/bin/env sh
# Formula Studio — browser version ZIP (open index.html, no install, no internet).
# Ships only the app files plus sample workbooks; never personal workbooks, tests, git data or build output.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION=$(node -p "require('$ROOT/package.json').version")
NAME="FormulaStudio-Web-v$VERSION"
OUT="$ROOT/dist/FormulaStudio-Web.zip"
STAGE=$(mktemp -d)
mkdir -p "$STAGE/$NAME/samples" "$ROOT/dist"
cp -r "$ROOT/index.html" "$ROOT/assets" "$ROOT/README.md" "$ROOT/start.bat" "$ROOT/start.sh" "$STAGE/$NAME/"
cp "$ROOT"/tests/fixtures/sample-*.xlsx "$STAGE/$NAME/samples/"
rm -f "$OUT"
python3 - "$STAGE" "$NAME" "$OUT" <<'PY'
import os, sys, zipfile
stage, name, out = sys.argv[1:4]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for root, dirs, files in os.walk(os.path.join(stage, name)):
        dirs.sort(); files.sort()
        for f in files:
            p = os.path.join(root, f)
            z.write(p, os.path.relpath(p, stage))
print('wrote', out)
PY
rm -rf "$STAGE"
ls -la "$OUT"
