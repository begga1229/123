#!/usr/bin/env node
/*
 * Formula Studio — desktop build (docs/ARCHITECTURE.md §17).
 *
 *   EFS_DEV_NODE_MODULES=/path/with/electron+packager/node_modules node tools/build-desktop.js [--platform=win32,linux] [--no-zip]
 *
 * Needs (dev only, never shipped): npm i electron@37.10.3 @electron/packager@20.3.0
 * Produces:
 *   dist/FormulaStudio-win32-x64/FormulaStudio.exe     Windows app folder (portable, no installer)
 *   dist/FormulaStudio-linux-x64/FormulaStudio         Linux build (used for automated testing)
 *   dist/FormulaStudio-Windows-x64.zip                 the Windows folder + README.txt, deterministic order
 *
 * Only an allow-list of files is shipped (index.html, assets/, electron/, package.json, README.md, docs/*.md).
 * Personal workbooks in the repo root, tests/, tools/, .git, node_modules, dist … are never copied.
 * The sample workbooks tests/fixtures/sample-*.xlsx are copied into the app as samples/.
 * The Windows exe icon and version info are written with resedit (pure JS, no wine needed).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const NM = path.resolve(process.env.EFS_DEV_NODE_MODULES || path.join(ROOT, 'node_modules'));
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const APP_NAME = 'FormulaStudio';
const ZIP_NAME = 'FormulaStudio-Windows-x64.zip';
// Chromium UI locales kept in the build (others fall back to en-US); saves ~40 MB.
const KEEP_LOCALES = ['en-US', 'en-GB', 'tr', 'ru', 'uk'];

// ------------------------------------------------------------------ arguments

const argv = process.argv.slice(2);
function argOf(name, def) {
  const hit = argv.find((a) => a.indexOf('--' + name + '=') === 0);
  return hit ? hit.slice(name.length + 3) : def;
}
const PLATFORMS = argOf('platform', 'win32,linux').split(',').map((s) => s.trim()).filter(Boolean);
const MAKE_ZIP = argv.indexOf('--no-zip') === -1;

// ------------------------------------------------------------------ what gets shipped

const TOP_LEVEL_ALLOW = ['index.html', 'package.json', 'README.md', 'assets', 'electron', 'docs'];

/**
 * Ignore function for @electron/packager. `rel` is the path relative to the repo root with a leading "/"
 * (forward slashes). Returns true to EXCLUDE the file.
 */
function ignore(rel) {
  if (!rel) return false;
  const p = rel.replace(/\\/g, '/');
  const parts = p.split('/').filter(Boolean);
  if (!parts.length) return false;
  if (TOP_LEVEL_ALLOW.indexOf(parts[0]) === -1) return true;      // .git, node_modules, dist, tests, tools, *.xlsx, start.* …
  const base = parts[parts.length - 1];
  if (/\.(xlsx|xlsm|xls|ods|csv|log)$/i.test(base)) return true;   // never ship workbooks or logs from the app tree
  if (base === '.DS_Store' || base === 'Thumbs.db') return true;
  if (parts[0] === 'docs' && parts.length > 1 && !/\.md$/i.test(base)) return true;  // docs: markdown only, no screenshots
  if (parts[0] === 'electron' && parts[1] === 'node_modules') return true;
  return false;
}

// ------------------------------------------------------------------ hooks

function copySamples(buildPath) {
  const src = path.join(ROOT, 'tests', 'fixtures');
  const dst = path.join(buildPath, 'samples');
  if (!fs.existsSync(src)) return;
  const files = fs.readdirSync(src).filter((f) => /^sample-.*\.xlsx$/i.test(f)).sort();
  if (!files.length) return;
  fs.mkdirSync(dst, { recursive: true });
  files.forEach((f) => fs.copyFileSync(path.join(src, f), path.join(dst, f)));
}

function trimLocales(buildPath) {
  const dir = path.join(buildPath, 'locales');
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach((f) => {
    const m = /^(.+)\.pak(\.info)?$/.exec(f);
    if (m && KEEP_LOCALES.indexOf(m[1]) === -1) fs.rmSync(path.join(dir, f), { force: true });
  });
}

// ------------------------------------------------------------------ helpers

async function loadPackager() {
  const dir = path.join(NM, '@electron', 'packager');
  if (!fs.existsSync(dir)) {
    throw new Error('@electron/packager not found in ' + NM +
      '\nInstall it: npm i electron@37.10.3 @electron/packager@20.3.0 (then set EFS_DEV_NODE_MODULES to that node_modules)');
  }
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  let entry = 'dist/index.js';
  const exp = meta.exports && (meta.exports['.'] || meta.exports);
  if (typeof exp === 'string') entry = exp;
  else if (exp && typeof exp.import === 'string') entry = exp.import;
  else if (exp && exp.import && exp.import.default) entry = exp.import.default;
  else if (meta.main) entry = meta.main;
  const mod = await import(pathToFileURL(path.join(dir, entry)).href);
  return mod.packager || mod.default;
}

function electronVersion() {
  if (process.env.EFS_ELECTRON_VERSION) return process.env.EFS_ELECTRON_VERSION;
  try {
    return JSON.parse(fs.readFileSync(path.join(NM, 'electron', 'package.json'), 'utf8')).version;
  } catch (e) {
    return '37.10.3';
  }
}

function dirSize(dir) {
  let total = 0;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) total += dirSize(p);
    else if (ent.isFile()) total += fs.statSync(p).size;
  }
  return total;
}

/** Refuse to package if any shipped script has a syntax error (e.g. a file caught mid-edit). */
function preflight() {
  const vm = require('vm');
  const bad = [];
  (function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      const rel = '/' + path.relative(ROOT, p).split(path.sep).join('/');
      if (ignore(rel)) continue;
      if (ent.isDirectory()) walk(p);
      else if (/\.js$/.test(ent.name)) {
        try { new vm.Script(fs.readFileSync(p, 'utf8'), { filename: rel }); } catch (e) { bad.push(rel + ': ' + e.message); }
      }
    }
  })(ROOT);
  ['index.html', 'electron/main.js', 'electron/preload.js', 'assets/icons/icon.png', 'assets/icons/icon.ico'].forEach((f) => {
    if (!fs.existsSync(path.join(ROOT, f))) bad.push('/' + f + ': missing');
  });
  if (bad.length) throw new Error('preflight failed, nothing was packaged:\n  ' + bad.join('\n  '));
}

function mb(n) { return (n / 1024 / 1024).toFixed(1) + ' MB'; }

// ------------------------------------------------------------------ README inside the zip

function readmeText(version) {
  return [
    'Formula Studio ' + version + ' — Windows (64-bit)',
    '==================================================',
    '',
    'TÜRKÇE',
    '------',
    '1. ZIP dosyasına sağ tıklayın → "Tümünü ayıkla…" ve bir klasöre çıkarın',
    '   (ZIP\'in içinden doğrudan çalıştırmayın).',
    '2. FormulaStudio-win32-x64 klasörünü açın ve FormulaStudio.exe dosyasına çift tıklayın.',
    '3. Uygulama imzasız olduğu için Windows SmartScreen uyarı gösterebilir:',
    '   "Ek bilgi" → "Yine de çalıştır" seçeneğine tıklayın.',
    '4. Kurulum ve internet gerekmez; dosyalarınız bilgisayarınızdan çıkmaz.',
    '   İsterseniz exe\'ye sağ tıklayıp "Masaüstüne kısayol oluştur" diyebilirsiniz.',
    '   Örnek Excel dosyaları: FormulaStudio-win32-x64\\resources\\app\\samples',
    '',
    'РУССКИЙ',
    '-------',
    '1. Щёлкните ZIP правой кнопкой → «Извлечь всё…» и распакуйте в любую папку',
    '   (не запускайте программу прямо из архива).',
    '2. Откройте папку FormulaStudio-win32-x64 и дважды щёлкните FormulaStudio.exe.',
    '3. Программа не подписана, поэтому Windows SmartScreen может показать предупреждение:',
    '   нажмите «Подробнее» → «Выполнить в любом случае».',
    '4. Установка и интернет не нужны; ваши файлы не покидают компьютер.',
    '   Ярлык на рабочем столе: правый щелчок по exe → «Отправить» → «Рабочий стол».',
    '   Примеры файлов Excel: FormulaStudio-win32-x64\\resources\\app\\samples',
    '',
    'ENGLISH',
    '-------',
    '1. Right-click the ZIP → "Extract All…" and extract it to any folder',
    '   (do not run the app from inside the ZIP).',
    '2. Open the FormulaStudio-win32-x64 folder and double-click FormulaStudio.exe.',
    '3. The app is not code-signed, so Windows SmartScreen may warn you:',
    '   click "More info" → "Run anyway".',
    '4. No installation and no internet needed; your files never leave your computer.',
    '   Sample workbooks: FormulaStudio-win32-x64\\resources\\app\\samples',
    ''
  ].join('\r\n');
}

// ------------------------------------------------------------------ zip (Python zipfile, deterministic)

const ZIP_PY = [
  'import os, sys, zipfile',
  'src, out, readme = sys.argv[1], sys.argv[2], sys.argv[3]',
  'base = os.path.basename(src.rstrip(os.sep))',
  'parent = os.path.dirname(src.rstrip(os.sep))',
  'entries = []',
  'for d, dirs, files in os.walk(src):',
  '    dirs.sort()',
  '    for f in sorted(files):',
  '        entries.append(os.path.join(d, f))',
  'entries.sort(key=lambda p: os.path.relpath(p, parent).replace(os.sep, "/"))',
  'tmp = out + ".tmp"',
  'with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:',
  '    def add(path, arc):',
  '        zi = zipfile.ZipInfo(arc, date_time=(2026, 1, 1, 0, 0, 0))',
  '        zi.compress_type = zipfile.ZIP_DEFLATED',
  '        mode = os.stat(path).st_mode & 0o777',
  '        zi.external_attr = ((0o100000 | (mode or 0o644)) << 16)',
  '        zi.create_system = 3',
  '        with open(path, "rb") as fh:',
  '            z.writestr(zi, fh.read(), compresslevel=9)',
  '    add(readme, "README.txt")',
  '    for p in entries:',
  '        add(p, os.path.relpath(p, parent).replace(os.sep, "/"))',
  'os.replace(tmp, out)',
  'print(len(entries) + 1)'
].join('\n');

function makeZip(winDir, version) {
  const readme = path.join(DIST, 'README.txt');
  fs.writeFileSync(readme, '﻿' + readmeText(version), 'utf8');   // BOM: Notepad shows Cyrillic/Turkish correctly
  fs.copyFileSync(readme, path.join(winDir, 'README.txt'));
  const out = path.join(DIST, ZIP_NAME);
  const r = spawnSync('python3', ['-I', '-c', ZIP_PY, winDir, out, readme], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('zip failed: ' + (r.stderr || r.error));
  fs.rmSync(readme, { force: true });
  return { file: out, count: Number(String(r.stdout).trim()) };
}

// ------------------------------------------------------------------ main

async function main() {
  preflight();
  const packager = await loadPackager();
  const version = PKG.version || '1.0.0';
  const ev = electronVersion();
  fs.mkdirSync(DIST, { recursive: true });
  console.log('Formula Studio ' + version + ' · Electron ' + ev + ' · targets: ' + PLATFORMS.join(', '));

  const results = {};
  for (const platform of PLATFORMS) {
    const opts = {
      dir: ROOT,
      out: DIST,
      name: APP_NAME,
      executableName: APP_NAME,
      platform: platform,
      arch: 'x64',
      electronVersion: ev,
      appVersion: version,
      buildVersion: version,
      appCopyright: 'Copyright © 2026 Formula Studio (MIT)',
      asar: false,
      prune: false,
      overwrite: true,
      junk: true,
      quiet: true,
      ignore: ignore,
      afterExtract: [async ({ buildPath }) => trimLocales(buildPath)],
      afterCopy: [async ({ buildPath }) => copySamples(buildPath)]
    };
    if (platform === 'win32') {
      opts.icon = path.join(ROOT, 'assets', 'icons', 'icon.ico');
      opts.win32metadata = {
        CompanyName: 'Formula Studio',
        ProductName: 'Formula Studio',
        FileDescription: 'Formula Studio',
        OriginalFilename: APP_NAME + '.exe',
        InternalName: APP_NAME
      };
    }
    const paths = await packager(opts);
    results[platform] = paths[0];
    console.log('  ' + platform + ': ' + path.relative(ROOT, paths[0]) + '  (' + mb(dirSize(paths[0])) + ')');
  }

  if (MAKE_ZIP && results.win32) {
    const z = makeZip(results.win32, version);
    console.log('  zip: ' + path.relative(ROOT, z.file) + '  (' + mb(fs.statSync(z.file).size) + ', ' + z.count + ' files)');
  }
}

if (require.main === module) {
  main().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
}

module.exports = { ignore, readmeText };
