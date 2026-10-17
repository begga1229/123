#!/usr/bin/env node
/* Formula Studio — specification-based test runner (ARCHITECTURE.md §14).
 *
 *   node tests/run.js [--only tr|ru|en|dialect[,…]] [--verbose] [--min 0.9] [--json <path>]
 *                     [--strict-case] [--root <dir>] [--help]
 *
 * Loads the engine modules in the documented order (vendor + ui skipped), runs the generation suites
 * (tests/cases.tr.json, cases.ru.json, cases.en.json) through EFS.generate.run and the dialect suite
 * (tests/dialect-cases.json) through EFS.localize.translateFormula + formulaReader/ast round trips.
 *
 * Comparison (§14): strip ALL whitespace, compare case-insensitively (Turkish İ/I/ı folded).
 *   pass  — the best candidate equals one of `expect`
 *   soft  — another top-5 candidate equals one of `expect` (best did not)
 *   fail  — nothing matched, or the module threw
 * A match that differs only by letter case is still a pass but is counted as "case-only" and listed
 * in the report (with --strict-case it is downgraded to soft).
 * Exit code 1 when the overall pass rate or any executed suite's pass rate is below --min (default 0.9),
 * or when a case file / fixture cannot be read. The runner never crashes on a module exception:
 * the exception is recorded as a failure with its message.
 *
 * Environment: EFS_NODE_MODULES — directory with exceljs / xlsx / hot-formula-parser; when present they are
 * exposed as the browser globals (ExcelJS, XLSX, formulaParser) so workbook/evaluator modules can load.
 */
'use strict';

var fs = require('fs');
var path = require('path');

/* A closed pipe (e.g. `node tests/run.js | head`) must not turn into an unhandled exception. */
process.stdout.on('error', function (e) { if (e && e.code === 'EPIPE') process.exit(process.exitCode || 0); });

/* ------------------------------------------------------------------ options ------------------------------------------------------------------ */
var DEFAULT_VENDOR = '/tmp/claude-0/-home-user/3c06d0af-2468-5bff-b340-5bb3f4f5cc1d/scratchpad/vendor/node_modules';
var MODULE_ORDER = [
  'assets/js/core/namespace.js',
  'assets/js/i18n/strings.js',
  'assets/js/catalog/part-math.js',
  'assets/js/catalog/part-stat.js',
  'assets/js/catalog/part-logic-lookup-text.js',
  'assets/js/catalog/part-date-fin-info-db.js',
  'assets/js/catalog/part-eng-web-cube-compat.js',
  'assets/js/catalog/catalog.js',
  'assets/js/nlp/normalize.js',
  'assets/js/nlp/lexicon.js',
  'assets/js/engine/ast.js',
  'assets/js/engine/localize.js',
  'assets/js/engine/formula-reader.js',
  'assets/js/engine/explain.js',
  'assets/js/nlp/parser.js',
  'assets/js/nlp/intents.js',
  'assets/js/engine/generate.js',
  'assets/js/workbook/workbook.js',
  'assets/js/workbook/evaluator.js'
];
var SUITE_FILES = { tr: 'tests/cases.tr.json', ru: 'tests/cases.ru.json', en: 'tests/cases.en.json', dialect: 'tests/dialect-cases.json' };
var ALL_SUITES = ['tr', 'ru', 'en', 'dialect'];

function parseArgs(argv) {
  var o = { only: null, verbose: false, min: 0.9, json: null, strictCase: false, root: null, help: false };
  for (var i = 0; i < argv.length; i++) {
    var a = argv[i];
    if (a === '--only') o.only = String(argv[++i] || '');
    else if (a.indexOf('--only=') === 0) o.only = a.slice(7);
    else if (a === '--verbose' || a === '-v') o.verbose = true;
    else if (a === '--min') o.min = parseFloat(argv[++i]);
    else if (a.indexOf('--min=') === 0) o.min = parseFloat(a.slice(6));
    else if (a === '--json') o.json = String(argv[++i] || '');
    else if (a.indexOf('--json=') === 0) o.json = a.slice(7);
    else if (a === '--strict-case') o.strictCase = true;
    else if (a === '--root') o.root = String(argv[++i] || '');
    else if (a.indexOf('--root=') === 0) o.root = a.slice(7);
    else if (a === '--help' || a === '-h') o.help = true;
    else { process.stderr.write('Unknown option: ' + a + '\n'); o.help = true; }
  }
  if (!(o.min >= 0 && o.min <= 1)) o.min = 0.9;
  return o;
}

var args = parseArgs(process.argv.slice(2));
if (args.help) {
  process.stdout.write([
    'Usage: node tests/run.js [options]',
    '  --only tr|ru|en|dialect   run one suite (comma-separated list allowed)',
    '  --verbose, -v              print every case with its status',
    '  --min 0.9                  minimum pass rate (0..1) for exit code 0',
    '  --json <path>              write a machine-readable report (every failure with top-5 candidates)',
    '  --strict-case              count case-only matches as soft instead of pass',
    '  --root <dir>               repository root (default: parent of tests/)',
    '  EFS_NODE_MODULES=<dir>     node_modules with exceljs/xlsx/hot-formula-parser (exposed as browser globals)',
    ''
  ].join('\n'));
  process.exit(0);
}

var ROOT = args.root ? path.resolve(args.root) : path.resolve(__dirname, '..');
var VENDOR = process.env.EFS_NODE_MODULES || DEFAULT_VENDOR;
var selected = ALL_SUITES.slice();
if (args.only) {
  selected = args.only.split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
  var bad = selected.filter(function (s) { return ALL_SUITES.indexOf(s) < 0; });
  if (bad.length) { process.stderr.write('Unknown suite(s): ' + bad.join(', ') + ' (expected tr|ru|en|dialect)\n'); process.exit(2); }
}

/* ------------------------------------------------------------------ helpers ------------------------------------------------------------------ */
function pad(s, n, right) {
  s = String(s == null ? '' : s);
  var w = strWidth(s);
  if (w >= n) return s;
  var fill = new Array(n - w + 1).join(' ');
  return right ? fill + s : s + fill;
}
function strWidth(s) { return Array.from(String(s)).length; }
function truncate(s, n) {
  s = String(s == null ? '' : s);
  var chars = Array.from(s);
  return chars.length <= n ? s : chars.slice(0, Math.max(0, n - 1)).join('') + '…';
}
function pct(num, den) { return den ? (100 * num / den).toFixed(1) + '%' : 'n/a'; }
function errText(e) {
  if (!e) return 'unknown error';
  if (typeof e === 'string') return e;
  var msg = e.message || (e.toString && e.toString()) || JSON.stringify(e);
  if (e.position != null) msg += ' (position ' + e.position + ')';
  return String(msg);
}
function firstLine(s) { return String(s || '').split('\n')[0]; }

/** Canonical form for comparison: no whitespace, no leading '='. */
function canon(formula) {
  var s = String(formula == null ? '' : formula).replace(/\s+/g, '');
  if (s.charAt(0) === '=') s = s.slice(1);
  return s;
}
/** Case-insensitive canonical form; Turkish dotted/dotless i are folded together. */
function canonCI(formula) {
  return canon(formula).toLowerCase().replace(/i̇/g, 'i').replace(/ı/g, 'i');
}
function compareOne(got, expects) {
  // returns 'exact' | 'ci' | null
  var g = canon(got), gci = canonCI(got);
  if (!g) return null;
  var ci = false;
  for (var i = 0; i < expects.length; i++) {
    if (canon(expects[i]) === g) return 'exact';
    if (canonCI(expects[i]) === gci) ci = true;
  }
  return ci ? 'ci' : null;
}
function withEquals(f) {
  if (f == null) return null;
  f = String(f);
  return f.charAt(0) === '=' ? f : '=' + f;
}

/* ------------------------------------------------------------------ module loading ------------------------------------------------------------------ */
function exposeVendorGlobals(dir) {
  var out = { dir: dir, exposed: [], missing: [] };
  if (!dir || !fs.existsSync(dir)) { out.missing.push('(directory not found)'); return out; }
  var g = globalThis;
  var wanted = [
    { global: 'ExcelJS', pkg: 'exceljs' },
    { global: 'XLSX', pkg: 'xlsx' },
    { global: 'formulaParser', pkg: 'hot-formula-parser' }
  ];
  for (var i = 0; i < wanted.length; i++) {
    if (g[wanted[i].global]) { out.exposed.push(wanted[i].global + ' (already set)'); continue; }
    try { g[wanted[i].global] = require(path.join(dir, wanted[i].pkg)); out.exposed.push(wanted[i].global); }
    catch (e) { out.missing.push(wanted[i].pkg + ': ' + firstLine(errText(e))); }
  }
  return out;
}

function loadModules() {
  var res = { loaded: [], failed: [], missing: [] };
  for (var i = 0; i < MODULE_ORDER.length; i++) {
    var rel = MODULE_ORDER[i], abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) { res.missing.push(rel); continue; }
    try { require(abs); res.loaded.push(rel); }
    catch (e) { res.failed.push({ file: rel, error: firstLine(errText(e)), stack: e && e.stack ? String(e.stack).split('\n').slice(0, 4).join('\n') : null }); }
  }
  return res;
}

function readJSON(rel) {
  var abs = path.join(ROOT, rel);
  var text = fs.readFileSync(abs, 'utf8');
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  var data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error(rel + ' must contain a JSON array');
  return data;
}

/* ------------------------------------------------------------------ generation suite ------------------------------------------------------------------ */
function candidateFormula(cand, EFS) {
  if (!cand) return null;
  if (typeof cand.formulaEN === 'string' && cand.formulaEN) return withEquals(cand.formulaEN);
  if (cand.ast && EFS.ast && typeof EFS.ast.serialize === 'function') {
    try { return withEquals(EFS.ast.serialize(cand.ast, { dialect: 'en', withEquals: true, uiLang: 'en' })); } catch (e) { /* fall through */ }
  }
  if (typeof cand.formula === 'string' && cand.formula) return withEquals(cand.formula);
  return null;
}

function runGenerationSuite(lang, cases, contexts, EFS) {
  var suite = { name: lang, total: 0, pass: 0, soft: 0, fail: 0, caseOnly: 0, durationMs: 0, records: [] };
  var t0 = Date.now();
  for (var i = 0; i < cases.length; i++) {
    var c = cases[i] || {};
    var expects = [].concat(c.expect == null ? [] : c.expect).map(String);
    var ctxKey = c.ctx == null ? 'none' : String(c.ctx);
    var style = c.style === 'classic' ? 'classic' : 'modern';
    var rec = {
      id: c.id || (lang + '-#' + (i + 1)), text: c.text, ctx: ctxKey, style: style, note: c.note || '',
      expected: expects, got: null, top5: [], intent: null, confidence: null, kind: null,
      status: 'fail', reason: null, caseOnly: false, error: null, ms: 0
    };
    suite.total++;
    if (!expects.length) { rec.reason = 'case has no expect'; finish(); continue; }
    if (!Object.prototype.hasOwnProperty.call(contexts, ctxKey)) { rec.reason = 'unknown ctx "' + ctxKey + '" (expected tr|ru|en|none)'; finish(); continue; }
    if (!EFS || !EFS.generate || typeof EFS.generate.run !== 'function') { rec.reason = 'EFS.generate.run is not available'; finish(); continue; }
    var ctx = contexts[ctxKey];
    var opts = { dialect: 'en', uiLang: lang, style: style };
    var c0 = Date.now();
    try {
      var res = EFS.generate.run(String(c.text == null ? '' : c.text), ctx, opts);
      rec.ms = Date.now() - c0;
      rec.kind = res && res.kind || null;
      var cands = (res && Array.isArray(res.candidates)) ? res.candidates : [];
      var best = (res && res.best) || cands[0] || null;
      rec.top5 = [];
      for (var k = 0; k < Math.min(5, cands.length); k++) {
        var cf = candidateFormula(cands[k], EFS);
        rec.top5.push({ formula: cf, intent: cands[k] && cands[k].intent || null, confidence: cands[k] && typeof cands[k].confidence === 'number' ? cands[k].confidence : null });
      }
      rec.got = candidateFormula(best, EFS);
      rec.intent = best && best.intent || null;
      rec.confidence = best && typeof best.confidence === 'number' ? best.confidence : null;
      if (best && best.missing && best.missing.length) rec.missing = best.missing.map(function (m) { return m && m.slot || m; });
      if (!rec.got) {
        rec.reason = 'no candidate (kind=' + rec.kind + (res && res.message ? ', message: ' + firstLine(res.message.en || res.message[lang] || JSON.stringify(res.message)) : '') + ')';
      } else {
        var m = compareOne(rec.got, expects);
        if (m === 'exact') { rec.status = 'pass'; }
        else if (m === 'ci') { rec.caseOnly = true; rec.status = args.strictCase ? 'soft' : 'pass'; rec.reason = 'case-only mismatch'; }
        else {
          rec.reason = 'best candidate differs';
          for (var j = 1; j < rec.top5.length; j++) {
            if (rec.top5[j].formula && compareOne(rec.top5[j].formula, expects)) { rec.status = 'soft'; rec.reason = 'matched by candidate #' + (j + 1); rec.softIndex = j + 1; break; }
          }
        }
      }
    } catch (e) {
      rec.ms = Date.now() - c0;
      rec.status = 'fail';
      rec.error = errText(e);
      rec.stack = e && e.stack ? String(e.stack).split('\n').slice(0, 5).join('\n') : null;
      rec.reason = 'exception: ' + firstLine(rec.error);
    }
    finish();
  }
  suite.durationMs = Date.now() - t0;
  return suite;

  function finish() {
    if (rec.status === 'pass') suite.pass++;
    else if (rec.status === 'soft') suite.soft++;
    else suite.fail++;
    if (rec.caseOnly) suite.caseOnly++;
    suite.records.push(rec);
    if (args.verbose) printVerbose(rec);
  }
}

/* ------------------------------------------------------------------ dialect suite ------------------------------------------------------------------ */
function runDialectSuite(triples, EFS) {
  var suite = { name: 'dialect', total: 0, pass: 0, soft: 0, fail: 0, caseOnly: 0, durationMs: 0, records: [] };
  var t0 = Date.now();
  var L = EFS && EFS.localize, R = EFS && EFS.formulaReader, A = EFS && EFS.ast;
  var haveTranslate = L && typeof L.translateFormula === 'function';
  var haveRoundTrip = R && typeof R.parse === 'function' && A && typeof A.serialize === 'function';
  for (var i = 0; i < triples.length; i++) {
    var tcase = triples[i] || {};
    var base = tcase.id || ('d-' + String(i + 1).padStart(3, '0'));
    var checks = [
      { tag: 'en→tr', run: function (t) { return L.translateFormula(t.en, 'en', 'tr'); }, expect: 'tr', from: 'en', avail: haveTranslate, what: 'EFS.localize.translateFormula' },
      { tag: 'en→ru', run: function (t) { return L.translateFormula(t.en, 'en', 'ru'); }, expect: 'ru', from: 'en', avail: haveTranslate, what: 'EFS.localize.translateFormula' },
      { tag: 'tr→en', run: function (t) { return L.translateFormula(t.tr, 'tr', 'en'); }, expect: 'en', from: 'tr', avail: haveTranslate, what: 'EFS.localize.translateFormula' },
      { tag: 'ru→en', run: function (t) { return L.translateFormula(t.ru, 'ru', 'en'); }, expect: 'en', from: 'ru', avail: haveTranslate, what: 'EFS.localize.translateFormula' },
      { tag: 'roundtrip:en', run: function (t) { return A.serialize(R.parse(t.en, 'en'), { dialect: 'en', withEquals: true, uiLang: 'en' }); }, expect: 'en', from: 'en', avail: haveRoundTrip, what: 'EFS.formulaReader.parse + EFS.ast.serialize' },
      { tag: 'roundtrip:tr', run: function (t) { return A.serialize(R.parse(t.tr, 'tr'), { dialect: 'tr', withEquals: true, uiLang: 'tr' }); }, expect: 'tr', from: 'tr', avail: haveRoundTrip, what: 'EFS.formulaReader.parse + EFS.ast.serialize' },
      { tag: 'roundtrip:ru', run: function (t) { return A.serialize(R.parse(t.ru, 'ru'), { dialect: 'ru', withEquals: true, uiLang: 'ru' }); }, expect: 'ru', from: 'ru', avail: haveRoundTrip, what: 'EFS.formulaReader.parse + EFS.ast.serialize' }
    ];
    for (var k = 0; k < checks.length; k++) {
      var chk = checks[k];
      var rec = { id: base + ':' + chk.tag, text: tcase[chk.from], ctx: 'dialect', style: null, note: tcase.note || '', expected: [tcase[chk.expect]], got: null, top5: [], intent: chk.tag, confidence: null, status: 'fail', reason: null, caseOnly: false, error: null, ms: 0 };
      suite.total++;
      if (typeof tcase.en !== 'string' || typeof tcase.tr !== 'string' || typeof tcase.ru !== 'string') { rec.reason = 'triple must have en, tr and ru strings'; }
      else if (!chk.avail) { rec.reason = chk.what + ' is not available'; }
      else {
        var c0 = Date.now();
        try {
          var out = chk.run(tcase);
          rec.ms = Date.now() - c0;
          rec.got = out == null ? null : withEquals(String(out));
          rec.top5 = rec.got ? [{ formula: rec.got, intent: chk.tag, confidence: null }] : [];
          var m = rec.got ? compareOne(rec.got, rec.expected) : null;
          if (m === 'exact') rec.status = 'pass';
          else if (m === 'ci') { rec.caseOnly = true; rec.status = args.strictCase ? 'soft' : 'pass'; rec.reason = 'case-only mismatch'; }
          else rec.reason = rec.got ? 'translation differs' : 'empty result';
        } catch (e) {
          rec.ms = Date.now() - c0;
          rec.error = errText(e);
          rec.stack = e && e.stack ? String(e.stack).split('\n').slice(0, 5).join('\n') : null;
          rec.reason = 'exception: ' + firstLine(rec.error);
        }
      }
      if (rec.status === 'pass') suite.pass++; else if (rec.status === 'soft') suite.soft++; else suite.fail++;
      if (rec.caseOnly) suite.caseOnly++;
      suite.records.push(rec);
      if (args.verbose) printVerbose(rec);
    }
  }
  suite.durationMs = Date.now() - t0;
  return suite;
}

/* ------------------------------------------------------------------ output ------------------------------------------------------------------ */
function statusTag(rec) {
  if (rec.status === 'pass') return rec.caseOnly ? 'PASS~' : 'PASS ';
  if (rec.status === 'soft') return 'SOFT ';
  return 'FAIL ';
}
function printVerbose(rec) {
  var line = statusTag(rec) + ' ' + pad(rec.id, 20) + ' ' + truncate(rec.text, 70);
  process.stdout.write(line + '\n');
  if (rec.status !== 'pass' || rec.caseOnly) {
    process.stdout.write('       expected: ' + rec.expected.join('  |  ') + '\n');
    process.stdout.write('       got:      ' + (rec.got == null ? '(none)' : rec.got) + (rec.intent && rec.ctx !== 'dialect' ? '   [' + rec.intent + (rec.confidence != null ? ' ' + rec.confidence.toFixed(2) : '') + ']' : '') + '\n');
    if (rec.reason) process.stdout.write('       reason:   ' + rec.reason + '\n');
    if (rec.status === 'soft' && rec.top5.length > 1) process.stdout.write('       top-5:    ' + rec.top5.map(function (t) { return t.formula || '(none)'; }).join('  |  ') + '\n');
  }
}

function printFailureTable(suite) {
  var rows = suite.records.filter(function (r) { return r.status === 'fail'; });
  if (!rows.length) return;
  var cols = process.stdout.columns || 160;
  var wId = 18, wInt = 22;
  var rest = Math.max(40, cols - wId - wInt - 10);
  var wExp = Math.floor(rest / 2), wGot = rest - wExp;
  process.stdout.write('\nFailures in suite "' + suite.name + '" (' + rows.length + '):\n');
  process.stdout.write(pad('id', wId) + ' | ' + pad('expected', wExp) + ' | ' + pad('got (best)', wGot) + ' | ' + pad('intent / reason', wInt) + '\n');
  process.stdout.write(new Array(wId + wExp + wGot + wInt + 10).join('-') + '\n');
  rows.forEach(function (r) {
    var exp = r.expected[0] + (r.expected.length > 1 ? ' (+' + (r.expected.length - 1) + ')' : '');
    var got = r.got == null ? (r.error ? 'ERROR: ' + firstLine(r.error) : '(none)') : r.got;
    var why = r.error ? 'exception' : (r.intent && r.ctx !== 'dialect' ? r.intent + (r.confidence != null ? ' ' + r.confidence.toFixed(2) : '') : (r.reason || ''));
    process.stdout.write(pad(truncate(r.id, wId), wId) + ' | ' + pad(truncate(exp, wExp), wExp) + ' | ' + pad(truncate(got, wGot), wGot) + ' | ' + truncate(why, wInt) + '\n');
  });
  var softRows = suite.records.filter(function (r) { return r.status === 'soft'; });
  if (softRows.length && !args.verbose) process.stdout.write('(' + softRows.length + ' soft match(es) not listed; use --verbose)\n');
}

function printSummary(suites, overall) {
  process.stdout.write('\n' + pad('Suite', 10) + pad('Total', 8, true) + pad('Pass', 8, true) + pad('Soft', 8, true) + pad('Fail', 8, true) + pad('Case-only', 11, true) + pad('Rate', 9, true) + pad('Time', 9, true) + '  Status\n');
  process.stdout.write(new Array(80).join('=') + '\n');
  suites.forEach(function (s) {
    var rate = s.total ? s.pass / s.total : 0;
    var ok = s.total === 0 ? 'EMPTY' : (rate >= args.min ? 'OK' : 'BELOW MIN');
    process.stdout.write(pad(s.name, 10) + pad(s.total, 8, true) + pad(s.pass, 8, true) + pad(s.soft, 8, true) + pad(s.fail, 8, true) + pad(s.caseOnly, 11, true) + pad(pct(s.pass, s.total), 9, true) + pad((s.durationMs / 1000).toFixed(2) + 's', 9, true) + '  ' + ok + '\n');
  });
  process.stdout.write(new Array(80).join('-') + '\n');
  process.stdout.write(pad('overall', 10) + pad(overall.total, 8, true) + pad(overall.pass, 8, true) + pad(overall.soft, 8, true) + pad(overall.fail, 8, true) + pad(overall.caseOnly, 11, true) + pad(pct(overall.pass, overall.total), 9, true) + pad((overall.durationMs / 1000).toFixed(2) + 's', 9, true) + '  min ' + (args.min * 100).toFixed(0) + '%\n');
}

/* ------------------------------------------------------------------ main ------------------------------------------------------------------ */
function main() {
  var startedAt = new Date();
  process.stdout.write('Formula Studio tests — root: ' + ROOT + '\n');
  process.stdout.write('node ' + process.version + ' · suites: ' + selected.join(', ') + ' · min pass rate: ' + (args.min * 100).toFixed(0) + '%' + (args.strictCase ? ' · strict-case' : '') + '\n');

  var vendor = exposeVendorGlobals(VENDOR);
  if (vendor.exposed.length) process.stdout.write('vendor globals: ' + vendor.exposed.join(', ') + ' (from ' + VENDOR + ')\n');
  if (vendor.missing.length) process.stdout.write('vendor globals not exposed: ' + vendor.missing.join('; ') + '\n');

  var mods = loadModules();
  process.stdout.write('modules loaded: ' + mods.loaded.length + '/' + MODULE_ORDER.length + '\n');
  if (mods.missing.length) process.stdout.write('  missing: ' + mods.missing.join(', ') + '\n');
  mods.failed.forEach(function (f) { process.stdout.write('  FAILED TO LOAD ' + f.file + ': ' + f.error + '\n'); });

  var EFS = globalThis.EFS || null;
  var api = ['generate', 'intents', 'parser', 'localize', 'formulaReader', 'ast', 'explain', 'catalog', 'lexicon', 'normalize'];
  var present = api.filter(function (k) { return EFS && EFS[k]; });
  var absent = api.filter(function (k) { return !(EFS && EFS[k]); });
  process.stdout.write('EFS modules present: ' + (present.join(', ') || '(none)') + (absent.length ? ' · absent: ' + absent.join(', ') : '') + '\n');
  if (EFS && EFS.catalog) { try { process.stdout.write('catalog entries: ' + EFS.catalog.count() + '\n'); } catch (e) { process.stdout.write('catalog.count() threw: ' + firstLine(errText(e)) + '\n'); } }

  var contexts = null, fixtureError = null;
  try {
    contexts = require(path.join(ROOT, 'tests/fixtures/contexts.js'));
    if (!contexts || typeof contexts !== 'object') throw new Error('contexts.js did not export an object');
    if (!Object.prototype.hasOwnProperty.call(contexts, 'none')) contexts.none = null;
  } catch (e) { fixtureError = errText(e); contexts = { none: null }; process.stdout.write('FIXTURE ERROR tests/fixtures/contexts.js: ' + firstLine(fixtureError) + '\n'); }

  var suites = [], fileErrors = [];
  selected.forEach(function (name) {
    var data;
    try { data = readJSON(SUITE_FILES[name]); }
    catch (e) { fileErrors.push(SUITE_FILES[name] + ': ' + firstLine(errText(e))); process.stdout.write('CASE FILE ERROR ' + SUITE_FILES[name] + ': ' + firstLine(errText(e)) + '\n'); return; }
    if (args.verbose) process.stdout.write('\n=== suite ' + name + ' (' + data.length + (name === 'dialect' ? ' triples × 7 checks' : ' cases') + ') ===\n');
    var s = name === 'dialect' ? runDialectSuite(data, EFS) : runGenerationSuite(name, data, contexts, EFS);
    suites.push(s);
  });

  var overall = { total: 0, pass: 0, soft: 0, fail: 0, caseOnly: 0, durationMs: 0 };
  suites.forEach(function (s) { overall.total += s.total; overall.pass += s.pass; overall.soft += s.soft; overall.fail += s.fail; overall.caseOnly += s.caseOnly; overall.durationMs += s.durationMs; });

  suites.forEach(printFailureTable);
  printSummary(suites, overall);

  var belowMin = suites.filter(function (s) { return s.total === 0 || s.pass / s.total < args.min; }).map(function (s) { return s.name; });
  var overallRate = overall.total ? overall.pass / overall.total : 0;
  var exitCode = 0;
  if (fileErrors.length || fixtureError) exitCode = 1;
  if (overallRate < args.min || belowMin.length) exitCode = 1;

  if (args.json) {
    var report = {
      generatedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      root: ROOT,
      node: process.version,
      options: { only: selected, min: args.min, strictCase: args.strictCase, verbose: args.verbose },
      vendor: vendor,
      modules: mods,
      efsPresent: present, efsAbsent: absent,
      fixtureError: fixtureError, caseFileErrors: fileErrors,
      summary: { overall: Object.assign({ rate: overallRate }, overall), suites: suites.map(function (s) { return { name: s.name, total: s.total, pass: s.pass, soft: s.soft, fail: s.fail, caseOnly: s.caseOnly, rate: s.total ? s.pass / s.total : 0, durationMs: s.durationMs }; }) },
      failures: [], softMatches: [], caseOnly: [], passed: []
    };
    suites.forEach(function (s) {
      s.records.forEach(function (r) {
        var entry = { suite: s.name, id: r.id, text: r.text, ctx: r.ctx, style: r.style, note: r.note, expected: r.expected, got: r.got, top5: r.top5, intent: r.intent, confidence: r.confidence, kind: r.kind, status: r.status, reason: r.reason, error: r.error, stack: r.stack || null, missing: r.missing || null, ms: r.ms };
        if (r.status === 'fail') report.failures.push(entry);
        else if (r.status === 'soft') report.softMatches.push(entry);
        else if (r.caseOnly) report.caseOnly.push(entry);
        else report.passed.push(r.id);
      });
    });
    report.exitCode = exitCode;
    try {
      var outPath = path.resolve(args.json);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
      process.stdout.write('JSON report written: ' + outPath + '\n');
    } catch (e) { process.stdout.write('Could not write JSON report: ' + firstLine(errText(e)) + '\n'); exitCode = 1; }
  }

  if (belowMin.length) process.stdout.write('Suites below the minimum pass rate: ' + belowMin.join(', ') + '\n');
  process.stdout.write('Result: ' + (exitCode === 0 ? 'OK' : 'FAILED') + ' (exit code ' + exitCode + ')\n');
  process.exitCode = exitCode;
}

try { main(); }
catch (e) {
  process.stdout.write('Runner crashed: ' + errText(e) + '\n' + (e && e.stack ? e.stack : '') + '\n');
  process.exitCode = 1;
}
