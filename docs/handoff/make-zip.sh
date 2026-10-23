#!/usr/bin/env sh
# Build the distributable ZIP of Formula Studio (app files only; no git, no node_modules, no user data).
set -e
REPO=/home/user/123
OUT_DIR=/home/user/123/dist
NAME=FormulaStudio-v1.0.0
STAGE=$(mktemp -d)
mkdir -p "$OUT_DIR" "$STAGE/$NAME"
cd "$REPO"
cp -r index.html assets docs README.md start.bat start.sh electron package.json "$STAGE/$NAME/"
mkdir -p "$STAGE/$NAME/tests/fixtures"
cp tests/*.js tests/*.json "$STAGE/$NAME/tests/" 2>/dev/null || true
cp tests/fixtures/*.js tests/fixtures/*.xlsx "$STAGE/$NAME/tests/fixtures/" 2>/dev/null || true
# Windows-friendly line endings for the .bat only; everything else stays as-is.
rm -f "$OUT_DIR/$NAME.zip"
(cd "$STAGE" && python3 -c "
import os, zipfile, sys
name = sys.argv[1]; out = sys.argv[2]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for root, dirs, files in os.walk(name):
        dirs.sort(); files.sort()
        for f in files:
            p = os.path.join(root, f)
            z.write(p, p)
print('wrote', out)
" "$NAME" "$OUT_DIR/$NAME.zip")
rm -rf "$STAGE"
ls -la "$OUT_DIR/$NAME.zip"
python3 -c "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); n=z.namelist(); print(len(n),'files'); print('\n'.join(x for x in n if x.count('/')<=2)[:1500])" "$OUT_DIR/$NAME.zip"
