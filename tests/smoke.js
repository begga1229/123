#!/usr/bin/env node
/* Formula Studio — Playwright browser smoke test (ARCHITECTURE.md §14).
 *
 *   node tests/smoke.js [--root <dir>] [--headed] [--timeout <ms>] [--url <file:// url>] [--strict-console]
 *
 * Flow: open index.html via file:// → wait for the prompt → upload tests/fixtures/sample-tr.xlsx through
 * input[type=file] → type "Tutar sütununu topla" + Enter → wait for a formula card containing TOPLA or SUM →
 * type a per-row request → click "apply" and "download" (download intercepted and saved to tests/output/) →
 * screenshots tests/screenshots/desktop.png and mobile.png → summary. Any `pageerror` fails the run;
 * console errors are reported (and fail the run with --strict-console).
 *
 * Selectors are tolerant: data-testid attributes are preferred ('prompt', 'generate', 'formula', 'apply',
 * 'download', 'file-input'), with role/text fallbacks (TR / RU / EN button labels).
 *
 * Playwright is loaded from $EFS_NODE_MODULES/playwright (default: the scratch vendor directory) or from a
 * regular `playwright` install; Chromium is searched under $PLAYWRIGHT_BROWSERS_PATH (default /opt/pw-browsers)
 * when launch() cannot find its bundled build.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var cp = require('child_process');

var DEFAULT_VENDOR = '/tmp/claude-0/-home-user/3c06d0af-2468-5bff-b340-5bb3f4f5cc1d/scratchpad/vendor/node_modules';
var VENDOR = process.env.EFS_NODE_MODULES || DEFAULT_VENDOR;

/* A closed pipe (e.g. `node tests/smoke.js | head`) must not turn into an unhandled exception. */
process.stdout.on('error', function (e) { if (e && e.code === 'EPIPE') process.exit(process.exitCode || 0); });

/* ------------------------------------------------------------------ options ------------------------------------------------------------------ */
var args = (function (argv) {
  var o = { root: null, headed: false, timeout: 15000, url: null, strictConsole: false, help: false };
  for (var i = 0; i < argv.length; i++) {
    var a = argv[i];
    if (a === '--root') o.root = argv[++i];
    else if (a.indexOf('--root=') === 0) o.root = a.slice(7);
    else if (a === '--headed') o.headed = true;
    else if (a === '--timeout') o.timeout = parseInt(argv[++i], 10);
    else if (a.indexOf('--timeout=') === 0) o.timeout = parseInt(a.slice(10), 10);
    else if (a === '--url') o.url = argv[++i];
    else if (a.indexOf('--url=') === 0) o.url = a.slice(6);
    else if (a === '--strict-console') o.strictConsole = true;
    else if (a === '--help' || a === '-h') o.help = true;
    else { process.stderr.write('Unknown option: ' + a + '\n'); o.help = true; }
  }
  if (!(o.timeout > 0)) o.timeout = 15000;
  return o;
})(process.argv.slice(2));

if (args.help) {
  process.stdout.write([
    'Usage: node tests/smoke.js [options]',
    '  --root <dir>        repository root (default: parent of tests/)',
    '  --url <url>         page to open (default: file://<root>/index.html)',
    '  --headed            show the browser window',
    '  --timeout <ms>      per-step timeout (default 15000)',
    '  --strict-console    treat console errors like page errors (fail the run)',
    '  EFS_NODE_MODULES    node_modules containing playwright (and exceljs for the fallback fixture)',
    '  PLAYWRIGHT_BROWSERS_PATH  where Chromium builds live (default /opt/pw-browsers)',
    ''
  ].join('\n'));
  process.exit(0);
}

var ROOT = args.root ? path.resolve(args.root) : path.resolve(__dirname, '..');
var INDEX = path.join(ROOT, 'index.html');
var URL = args.url || ('file://' + INDEX);
var OUT_DIR = path.join(ROOT, 'tests', 'output');
var SHOT_DIR = path.join(ROOT, 'tests', 'screenshots');
var FIXTURE = path.join(ROOT, 'tests', 'fixtures', 'sample-tr.xlsx');
var MAKE_SAMPLES = path.join(ROOT, 'tests', 'fixtures', 'make-samples.js');

var PROMPT_1 = 'Tutar sütununu topla';
var FORMULA_1 = '(TOPLA|SUM)\\s*\\(';
var PROMPT_2 = 'Tutar 100\'den büyükse "Yüksek" değilse "Düşük" yaz';
var FORMULA_2 = '(EĞER|IF)\\s*\\(';

/* ------------------------------------------------------------------ bookkeeping ------------------------------------------------------------------ */
var steps = [];
var pageErrors = [];
var consoleErrors = [];
var consoleWarnings = [];
var requestFailures = [];
var warnings = [];

function log(msg) { process.stdout.write(msg + '\n'); }
function firstLine(s) { return String(s == null ? '' : s).split('\n')[0]; }
function errText(e) { return e && (e.message || String(e)) || 'unknown error'; }
function warn(msg) { warnings.push(msg); log('  warning: ' + msg); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function step(name, critical, fn) {
  var rec = { name: name, status: 'pass', detail: '', ms: 0, critical: critical };
  var t0 = Date.now();
  log('> ' + name);
  try {
    var detail = await fn();
    rec.detail = detail == null ? '' : String(detail);
    if (rec.detail) log('  ' + rec.detail);
  } catch (e) {
    rec.status = 'fail';
    rec.detail = firstLine(errText(e));
    log('  FAIL: ' + rec.detail);
  }
  rec.ms = Date.now() - t0;
  steps.push(rec);
  return rec.status === 'pass';
}
function skip(name, why) { steps.push({ name: name, status: 'skip', detail: why, ms: 0 }); log('> ' + name + '\n  skipped: ' + why); }

/* ------------------------------------------------------------------ prerequisites ------------------------------------------------------------------ */
function loadPlaywright() {
  var tried = [];
  var candidates = [path.join(VENDOR, 'playwright'), 'playwright', path.join(VENDOR, 'playwright-core'), 'playwright-core'];
  for (var i = 0; i < candidates.length; i++) {
    try { var pw = require(candidates[i]); if (pw && pw.chromium) return { pw: pw, from: candidates[i] }; }
    catch (e) { tried.push(candidates[i] + ' (' + firstLine(errText(e)) + ')'); }
  }
  throw new Error('Playwright not found. Tried: ' + tried.join('; ') + '. Set EFS_NODE_MODULES to a node_modules directory containing playwright.');
}

function findChromiumExecutable() {
  var bases = [];
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) bases.push(process.env.PLAYWRIGHT_BROWSERS_PATH);
  bases.push('/opt/pw-browsers');
  bases.push(path.join(process.env.HOME || '/root', '.cache', 'ms-playwright'));
  var found = [];
  bases.forEach(function (base) {
    var entries;
    try { entries = fs.readdirSync(base); } catch (e) { return; }
    entries.forEach(function (name) {
      var m = /^(chromium|chromium_headless_shell)-(\d+)$/.exec(name);
      if (!m) return;
      var build = parseInt(m[2], 10);
      var rel = m[1] === 'chromium' ? ['chrome-linux/chrome', 'chrome-linux/headless_shell', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-win/chrome.exe'] : ['chrome-linux/headless_shell', 'chrome-mac/headless_shell', 'chrome-win/headless_shell.exe'];
      rel.forEach(function (r, idx) {
        var p = path.join(base, name, r);
        if (fs.existsSync(p)) found.push({ path: p, build: build, full: m[1] === 'chromium' && idx === 0 ? 1 : 0 });
      });
    });
  });
  ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'].forEach(function (p) {
    if (fs.existsSync(p)) found.push({ path: p, build: 0, full: 1 });
  });
  found.sort(function (a, b) { return (b.full - a.full) || (b.build - a.build); });
  return found.length ? found[0].path : null;
}

async function launchBrowser(pw) {
  var opts = { headless: !args.headed, chromiumSandbox: false, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] };
  try {
    var b = await pw.chromium.launch(opts);
    return { browser: b, how: 'bundled Chromium' };
  } catch (e) {
    var exe = findChromiumExecutable();
    if (!exe) throw new Error('chromium.launch() failed (' + firstLine(errText(e)) + ') and no Chromium executable was found under ' + (process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers'));
    log('  launch() failed (' + firstLine(errText(e)) + '); retrying with executablePath=' + exe);
    var b2 = await pw.chromium.launch(Object.assign({}, opts, { executablePath: exe }));
    return { browser: b2, how: 'executablePath ' + exe };
  }
}

/** Make sure a sample workbook exists; returns the path to use. */
function ensureFixture() {
  if (fs.existsSync(FIXTURE)) return { path: FIXTURE, how: 'fixture' };
  if (fs.existsSync(MAKE_SAMPLES)) {
    log('  fixture missing; running tests/fixtures/make-samples.js');
    var r = cp.spawnSync(process.execPath, [MAKE_SAMPLES], { cwd: ROOT, env: Object.assign({}, process.env, { EFS_NODE_MODULES: VENDOR }), timeout: 60000, encoding: 'utf8' });
    if (r.status !== 0) warn('make-samples.js exited with ' + r.status + ': ' + firstLine(r.stderr || r.stdout));
    if (fs.existsSync(FIXTURE)) return { path: FIXTURE, how: 'make-samples.js' };
  }
  // Fallback: build a workbook that mirrors tests/fixtures/contexts.js (tr) with ExcelJS.
  var ExcelJS;
  try { ExcelJS = require(path.join(VENDOR, 'exceljs')); } catch (e) { try { ExcelJS = require('exceljs'); } catch (e2) { throw new Error('sample-tr.xlsx is missing and exceljs is not available to build a fallback (' + firstLine(errText(e2)) + ')'); } }
  var out = path.join(OUT_DIR, 'sample-tr.xlsx');
  var wb = new ExcelJS.Workbook();
  var ws = wb.addWorksheet('Satışlar');
  ws.addRow(['Ürün', 'Kategori', 'Adet', 'Birim Fiyat', 'Tutar', 'Tarih', 'Satış Temsilcisi', 'Şehir', 'Durum', 'İndirim', 'Doğum Tarihi', 'E-posta', 'Ad Soyad']);
  var products = [['P001', 'Kalem', 'Kırtasiye', 4.5], ['P002', 'Defter', 'Kırtasiye', 12], ['P003', 'Çikolata', 'Gıda', 25], ['P004', 'Bisküvi', 'Gıda', 8.75], ['P005', 'Silgi', 'Kırtasiye', 2]];
  var reps = ['Ayşe', 'Mehmet', 'Zeynep', 'Ali'], cities = ['İstanbul', 'Ankara', 'İzmir'], statuses = ['Ödendi', 'Bekliyor'];
  for (var i = 0; i < 40; i++) {
    var p = products[i % products.length], qty = (i % 7) + 1, price = p[3];
    ws.addRow([p[0], p[2], qty, price, qty * price, new Date(2024, i % 12, (i % 27) + 1), reps[i % reps.length], cities[i % cities.length], statuses[i % statuses.length], (i % 3) * 0.05, new Date(1980 + (i % 25), i % 12, (i % 27) + 1), 'kisi' + (i + 1) + '@ornek.com', reps[i % reps.length] + ' Yılmaz']);
  }
  var ws2 = wb.addWorksheet('Ürünler');
  ws2.addRow(['Ürün Kodu', 'Ürün Adı', 'Fiyat']);
  products.forEach(function (p) { ws2.addRow([p[0], p[1], p[3]]); });
  return { path: out, how: 'fallback built with exceljs', promise: wb.xlsx.writeFile(out) };
}

async function verifyWorkbook(file) {
  var ExcelJS;
  try { ExcelJS = require(path.join(VENDOR, 'exceljs')); } catch (e) { try { ExcelJS = require('exceljs'); } catch (e2) { return 'exceljs not available; skipped content verification'; } }
  var wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  var formulas = [], sheets = [];
  wb.eachSheet(function (ws) {
    sheets.push(ws.name);
    ws.eachRow(function (row, rowNumber) {
      row.eachCell(function (cell) {
        var f = cell.formula || (cell.value && typeof cell.value === 'object' && cell.value.formula);
        if (f && formulas.length < 5) formulas.push(ws.name + '!' + cell.address + ' =' + f);
        else if (f) formulas.length++;
      });
    });
  });
  if (!formulas.length) warn('downloaded workbook contains no formula cells (apply may not have written anything)');
  return 'sheets: ' + sheets.join(', ') + ' · formula cells: ' + formulas.length + (formulas.length ? ' · e.g. ' + formulas.slice(0, 3).join(' | ') : '');
}

/* ------------------------------------------------------------------ page helpers ------------------------------------------------------------------ */
async function firstVisible(page, selectors) {
  for (var i = 0; i < selectors.length; i++) {
    var sel = selectors[i];
    var loc = typeof sel === 'function' ? sel(page) : page.locator(sel);
    var n = 0;
    try { n = await loc.count(); } catch (e) { n = 0; }
    for (var k = 0; k < n; k++) {
      var item = loc.nth(k);
      var vis = false;
      try { vis = await item.isVisible(); } catch (e) { vis = false; }
      if (vis) return { locator: item, selector: typeof sel === 'function' ? sel.label : sel };
    }
  }
  return null;
}
function roleButton(regex, label) { var f = function (page) { return page.getByRole('button', { name: regex }); }; f.label = label; return f; }

async function locatePrompt(page) {
  return firstVisible(page, ['[data-testid="prompt"]', 'textarea#prompt', 'textarea[name="prompt"]', '#prompt', 'textarea', '[contenteditable="true"]']);
}
async function locateFileInput(page) {
  var sels = ['[data-testid="file-input"]', 'input[type="file"]'];
  for (var i = 0; i < sels.length; i++) { var loc = page.locator(sels[i]); if (await loc.count()) return { locator: loc.first(), selector: sels[i] }; }
  return null;
}

/** Wait until a formula element whose text matches `regexSource` exists; returns its text. */
async function waitForFormula(page, regexSource, timeout) {
  var handle = await page.waitForFunction(function (src) {
    var re = new RegExp(src, 'i');
    var primary = document.querySelectorAll('[data-testid="formula"]');
    if (primary.length) {
      for (var i = 0; i < primary.length; i++) { var t = (primary[i].textContent || '').trim(); if (re.test(t)) return t; }
      return null;
    }
    var nodes = document.querySelectorAll('code, pre, output, .formula, [class*="formula"], [class*="result"]');
    for (var j = 0; j < nodes.length; j++) {
      var txt = (nodes[j].textContent || '').trim();
      if (txt.charAt(0) === '=' && re.test(txt) && txt.length < 400) return txt;
    }
    return null;
  }, regexSource, { timeout: timeout, polling: 200 });
  var text = await handle.jsonValue();
  await handle.dispose();
  return text;
}

async function submitPrompt(page, text, regexSource) {
  var p = await locatePrompt(page);
  if (!p) throw new Error('prompt textarea not found');
  await p.locator.click();
  await p.locator.fill('');
  await p.locator.fill(text);
  await p.locator.press('Enter');
  try {
    return await waitForFormula(page, regexSource, Math.min(args.timeout, 6000));
  } catch (e) {
    var gen = await firstVisible(page, ['[data-testid="generate"]', roleButton(/oluştur|üret|generate|сформир|создать|получить|формул|formül/i, 'generate button')]);
    if (!gen) throw new Error('no formula matching /' + regexSource + '/ after Enter, and no generate button found');
    log('  Enter did not produce a formula in time; clicking ' + gen.selector);
    await gen.locator.click();
    return await waitForFormula(page, regexSource, args.timeout);
  }
}

/* ------------------------------------------------------------------ main ------------------------------------------------------------------ */
async function main() {
  log('Formula Studio smoke test — ' + URL);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  if (!args.url && !fs.existsSync(INDEX)) { log('index.html not found at ' + INDEX); return 2; }

  var pwInfo;
  try { pwInfo = loadPlaywright(); log('playwright from ' + pwInfo.from); }
  catch (e) { log(errText(e)); return 2; }

  var fixture;
  try { fixture = ensureFixture(); if (fixture.promise) await fixture.promise; log('sample workbook: ' + fixture.path + ' (' + fixture.how + ')'); }
  catch (e) { log('sample workbook unavailable: ' + firstLine(errText(e))); fixture = null; }

  var launched;
  try { launched = await launchBrowser(pwInfo.pw); log('browser: ' + launched.how); }
  catch (e) { log(errText(e)); return 2; }
  var browser = launched.browser;
  var exitCode = 0;
  var watchdog = setTimeout(function () { log('Watchdog: smoke test exceeded ' + (args.timeout * 12 / 1000) + 's; aborting'); process.exit(1); }, args.timeout * 12);

  try {
    var context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, locale: 'tr-TR' });
    var page = await context.newPage();
    page.on('pageerror', function (e) { pageErrors.push(firstLine(errText(e))); });
    page.on('console', function (m) {
      var type = m.type();
      if (type === 'error') consoleErrors.push(firstLine(m.text()));
      else if (type === 'warning') consoleWarnings.push(firstLine(m.text()));
    });
    page.on('requestfailed', function (r) { requestFailures.push(r.url() + ' (' + (r.failure() && r.failure().errorText) + ')'); });

    var ok = await step('open ' + URL, true, async function () {
      await page.goto(URL, { waitUntil: 'load', timeout: args.timeout });
      var title = await page.title();
      return 'title: ' + (title || '(empty)');
    });

    if (ok) ok = await step('wait for the prompt textarea', true, async function () {
      await page.waitForSelector('[data-testid="prompt"], textarea, [contenteditable="true"]', { state: 'visible', timeout: args.timeout });
      var p = await locatePrompt(page);
      if (!p) throw new Error('prompt not visible');
      return 'found via ' + p.selector;
    });

    if (ok) {
      if (!fixture) skip('upload sample workbook', 'no sample workbook available');
      else await step('upload sample workbook via input[type=file]', false, async function () {
        var input = await locateFileInput(page);
        if (!input) throw new Error('no file input found (expected data-testid="file-input" or input[type=file])');
        await input.locator.setInputFiles(fixture.path);
        // Wait for the workbook to be reflected in the UI (sheet tab / header cell with "Tutar"), tolerant of slow parsing.
        var seen = false;
        try {
          await page.waitForFunction(function () { return /Tutar/.test(document.body && document.body.innerText || ''); }, null, { timeout: args.timeout, polling: 250 });
          seen = true;
        } catch (e) { warn('"Tutar" header did not appear in the page after upload (workbook panel may render differently)'); }
        return 'uploaded via ' + input.selector + (seen ? ' · header "Tutar" visible' : '');
      });
    }

    var formula1 = null;
    if (ok) ok = await step('generate: "' + PROMPT_1 + '" → formula with TOPLA or SUM', true, async function () {
      formula1 = await submitPrompt(page, PROMPT_1, FORMULA_1);
      return 'formula card: ' + formula1;
    });

    var formula2 = null;
    if (ok) await step('generate per-row: "' + PROMPT_2 + '" → formula with EĞER or IF', false, async function () {
      formula2 = await submitPrompt(page, PROMPT_2, FORMULA_2);
      return 'formula card: ' + formula2;
    });

    var applied = false;
    if (ok) applied = await step('apply the formula to the workbook', false, async function () {
      var btn = await firstVisible(page, ['[data-testid="apply"]', roleButton(/uygula|apply|примен|вставить|записать/i, 'apply button')]);
      if (!btn) throw new Error('apply button not found (expected data-testid="apply" or a button labelled Uygula/Apply/Применить)');
      await btn.locator.click();
      await sleep(500);
      return 'clicked ' + btn.selector;
    });

    if (ok) await step('download the modified workbook', false, async function () {
      var btn = await firstVisible(page, ['[data-testid="download"]', roleButton(/indir|download|скачать|сохранить/i, 'download button')]);
      if (!btn) throw new Error('download button not found (expected data-testid="download" or a button labelled İndir/Download/Скачать)');
      var waiting = page.waitForEvent('download', { timeout: args.timeout });
      await btn.locator.click();
      var download = await waiting;
      var suggested = download.suggestedFilename() || 'smoke-output.xlsx';
      if (!/\.(xlsx|xlsm|xls|csv|ods)$/i.test(suggested)) suggested += '.xlsx';
      var target = path.join(OUT_DIR, 'smoke-' + suggested.replace(/[^\w.\-À-ɏЀ-ӿ]+/g, '_'));
      await download.saveAs(target);
      var size = fs.statSync(target).size;
      if (!size) throw new Error('downloaded file is empty: ' + target);
      var info = '';
      try { info = await verifyWorkbook(target); } catch (e) { warn('could not parse the downloaded workbook: ' + firstLine(errText(e))); }
      if (!applied) warn('download succeeded but the apply step had failed; the file may be unmodified');
      return 'saved ' + target + ' (' + size + ' bytes)' + (info ? ' · ' + info : '');
    });

    await step('screenshot desktop (1440×900) → tests/screenshots/desktop.png', false, async function () {
      var file = path.join(SHOT_DIR, 'desktop.png');
      await page.screenshot({ path: file, fullPage: true });
      return file + ' (' + fs.statSync(file).size + ' bytes)';
    });

    await step('screenshot mobile (390×844) → tests/screenshots/mobile.png', false, async function () {
      await page.setViewportSize({ width: 390, height: 844 });
      await sleep(400);
      var overflow = await page.evaluate(function () { var d = document.documentElement; return { sw: d.scrollWidth, iw: window.innerWidth }; });
      if (overflow.sw > overflow.iw + 1) warn('horizontal overflow at 390px: scrollWidth ' + overflow.sw + ' > innerWidth ' + overflow.iw);
      var file = path.join(SHOT_DIR, 'mobile.png');
      await page.screenshot({ path: file, fullPage: true });
      return file + ' (' + fs.statSync(file).size + ' bytes)' + (overflow.sw > overflow.iw + 1 ? '' : ' · no horizontal scroll');
    });

    await context.close();
  } catch (e) {
    log('Unexpected error: ' + errText(e));
    exitCode = 1;
  } finally {
    clearTimeout(watchdog);
    try { await browser.close(); } catch (e) { /* ignore */ }
  }

  /* ---------------- summary ---------------- */
  log('\nSummary');
  log('=======');
  steps.forEach(function (s) {
    var tag = s.status === 'pass' ? 'PASS' : s.status === 'skip' ? 'SKIP' : 'FAIL';
    log(tag + '  ' + s.name + (s.ms ? '  (' + (s.ms / 1000).toFixed(1) + 's)' : '') + (s.status !== 'pass' && s.detail ? '\n      ' + s.detail : ''));
  });
  var failed = steps.filter(function (s) { return s.status === 'fail'; });
  log('steps: ' + steps.length + ' · failed: ' + failed.length + ' · skipped: ' + steps.filter(function (s) { return s.status === 'skip'; }).length);
  log('page errors: ' + pageErrors.length);
  pageErrors.forEach(function (e) { log('  pageerror: ' + e); });
  log('console errors: ' + consoleErrors.length + (consoleErrors.length ? ' (shown below' + (args.strictConsole ? ', strict' : ', not fatal') + ')' : ''));
  consoleErrors.slice(0, 20).forEach(function (e) { log('  console.error: ' + e); });
  if (consoleWarnings.length) log('console warnings: ' + consoleWarnings.length);
  if (requestFailures.length) { log('failed requests: ' + requestFailures.length); requestFailures.slice(0, 10).forEach(function (r) { log('  ' + r); }); }
  if (warnings.length) { log('warnings: ' + warnings.length); warnings.forEach(function (w) { log('  - ' + w); }); }

  if (failed.length) exitCode = 1;
  if (pageErrors.length) exitCode = 1;
  if (args.strictConsole && consoleErrors.length) exitCode = 1;
  log('\nResult: ' + (exitCode === 0 ? 'OK' : 'FAILED') + ' (exit code ' + exitCode + ')');
  return exitCode;
}

main().then(function (code) { process.exitCode = code; }, function (e) { log('Smoke test crashed: ' + (e && e.stack || errText(e))); process.exitCode = 1; });
