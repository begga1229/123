#!/usr/bin/env node
/* Formula Studio — AI mode tests (docs/ARCHITECTURE.md §16).
 *
 *   node tests/ai-test.js [--no-browser] [--verbose]
 *
 * Starts mock HTTP servers on random localhost ports and drives EFS.ai through them:
 *   (a) a mock Anthropic Messages API, called through the REAL official SDK (@anthropic-ai/sdk) via baseURL;
 *   (b) a mock Ollama server (/api/tags, /api/chat honoring `format`);
 *   (c) a mock OpenAI-compatible server (/v1/models, /v1/chat/completions; rejects response_format to exercise the retry);
 *   (d) Chromium: a file:// page loading assets/js/vendor/anthropic-sdk.min.js + the engine + the ai files, generating
 *       a formula against the mock Anthropic server (CORS) — proves the browser bundle works with dangerouslyAllowBrowser.
 * Prints a pass/fail table; exit code 1 on any failure. No real API key is needed or used.
 *
 * Environment:
 *   EFS_ANTHROPIC_SDK  path of the @anthropic-ai/sdk package for Node (default: the dev scratch install, else require.resolve)
 *   EFS_NODE_MODULES   directory containing playwright (default: the dev scratch vendor node_modules)
 *   EFS_CHROMIUM       Chromium executable (default: /opt/pw-browsers/chromium-1194/chrome-linux/chrome when present)
 */
'use strict';

var fs = require('fs');
var os = require('os');
var path = require('path');
var http = require('http');

process.stdout.on('error', function (e) { if (e && e.code === 'EPIPE') process.exit(process.exitCode || 0); });

var ROOT = path.resolve(__dirname, '..');
var ARGS = process.argv.slice(2);
var VERBOSE = ARGS.indexOf('--verbose') >= 0 || ARGS.indexOf('-v') >= 0;
var NO_BROWSER = ARGS.indexOf('--no-browser') >= 0;
var SCRATCH = '/tmp/claude-0/-home-user/3c06d0af-2468-5bff-b340-5bb3f4f5cc1d/scratchpad';
var DEFAULT_SDK = SCRATCH + '/ai-core/node_modules/@anthropic-ai/sdk';
var DEFAULT_VENDOR = SCRATCH + '/vendor/node_modules';
var DEFAULT_CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
var AI_FILES = ['assets/js/ai/ai.js', 'assets/js/ai/provider-anthropic.js', 'assets/js/ai/provider-local.js'];

/* ------------------------------------------------------------------ module loading (same order as tests/run.js) */
function moduleOrder() {
  var fallback = ['assets/js/core/namespace.js', 'assets/js/i18n/strings.js', 'assets/js/catalog/part-math.js', 'assets/js/catalog/part-stat.js',
    'assets/js/catalog/part-logic-lookup-text.js', 'assets/js/catalog/part-date-fin-info-db.js', 'assets/js/catalog/part-eng-web-cube-compat.js',
    'assets/js/catalog/catalog.js', 'assets/js/nlp/normalize.js', 'assets/js/nlp/lexicon.js', 'assets/js/engine/ast.js', 'assets/js/engine/localize.js',
    'assets/js/engine/formula-reader.js', 'assets/js/engine/explain.js', 'assets/js/nlp/parser.js', 'assets/js/nlp/intents.js',
    'assets/js/nlp/intents-aggregate.js', 'assets/js/nlp/intents-logic.js', 'assets/js/nlp/intents-lookup.js', 'assets/js/nlp/intents-text.js',
    'assets/js/nlp/intents-date.js', 'assets/js/nlp/intents-math.js', 'assets/js/nlp/intents-finance-array.js', 'assets/js/engine/generate.js'];
  try {
    var src = fs.readFileSync(path.join(ROOT, 'tests/run.js'), 'utf8');
    var m = /var MODULE_ORDER = (\[[\s\S]*?\]);/.exec(src);
    var list = m ? JSON.parse(m[1].replace(/'/g, '"').replace(/,\s*\]$/, ']')) : null;
    if (Array.isArray(list) && list.length) return list.filter(function (f) { return !/^assets\/js\/(workbook|ui|vendor)\//.test(f); });
  } catch (e) { /* fall back */ }
  return fallback;
}
var LOAD_ERRORS = [];
function loadModules() {
  moduleOrder().concat(AI_FILES).forEach(function (f) {
    try { require(path.join(ROOT, f)); } catch (e) { LOAD_ERRORS.push({ file: f, message: String(e && e.message || e).split('\n')[0] }); }
  });
}
function resolveSdk() {
  var cands = [process.env.EFS_ANTHROPIC_SDK, DEFAULT_SDK].filter(Boolean);
  for (var i = 0; i < cands.length; i++) { try { require.resolve(cands[i]); return cands[i]; } catch (e) { /* next */ } }
  try { return path.dirname(require.resolve('@anthropic-ai/sdk/package.json')); } catch (e) { return null; }
}

/* ------------------------------------------------------------------ tiny test harness */
var RESULTS = [];
function check(cond, message) { if (!cond) throw new Error(message); }
function eq(actual, expected, message) { if (actual !== expected) throw new Error(message + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual)); }
function test(group, name, fn) { TESTS.push({ group: group, name: name, fn: fn }); }
var TESTS = [];
function skip(reason) { var e = new Error(reason); e.skip = true; throw e; }

/* ------------------------------------------------------------------ mock HTTP servers */
function readBody(req) {
  return new Promise(function (resolve) { var chunks = []; req.on('data', function (c) { chunks.push(c); }); req.on('end', function () { resolve(Buffer.concat(chunks).toString('utf8')); }); });
}
function sendJson(res, status, obj, headers) {
  var body = typeof obj === 'string' ? obj : JSON.stringify(obj);
  var h = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (headers) Object.keys(headers).forEach(function (k) { h[k] = headers[k]; });
  res.writeHead(status, h);
  res.end(body);
}
function listen(handler) {
  return new Promise(function (resolve) {
    var srv = http.createServer(handler);
    srv.listen(0, '127.0.0.1', function () { resolve({ server: srv, url: 'http://127.0.0.1:' + srv.address().port }); });
  });
}
/** A port with nothing listening on it (connection refused). */
function closedPort() {
  return new Promise(function (resolve) { var s = http.createServer(); s.listen(0, '127.0.0.1', function () { var p = s.address().port; s.close(function () { resolve(p); }); }); });
}

/* (a) mock Anthropic Messages API. `anth.script` is a queue of responses: { status, json, headers, delay } or a function(req). */
var anth = { requests: [], preflights: [], script: [] };
function anthropicMessage(text, stopReason, extra) {
  var m = { id: 'msg_mock_' + (anth.requests.length + 1), type: 'message', role: 'assistant', model: 'claude-opus-5-5',
    content: text == null ? [] : [{ type: 'text', text: text }], stop_reason: stopReason || 'end_turn', stop_sequence: null,
    usage: { input_tokens: 1200, output_tokens: 80, cache_creation_input_tokens: 0, cache_read_input_tokens: 1000 } };
  if (extra) Object.keys(extra).forEach(function (k) { m[k] = extra[k]; });
  return m;
}
function answer(formula, extra) {
  var a = { formula: formula, mode: 'cell', target_cell: '', explanation: 'Açıklama.', assumptions: [], question: '' };
  if (extra) Object.keys(extra).forEach(function (k) { a[k] = extra[k]; });
  return JSON.stringify(a);
}
function anthropicHandler(req, res) {
  if (req.method === 'OPTIONS') {
    anth.preflights.push({ url: req.url, headers: req.headers });
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || '*', 'Access-Control-Max-Age': '600' });
    return res.end();
  }
  readBody(req).then(function (body) {
    var rec = { method: req.method, url: req.url, headers: req.headers, raw: body, body: null };
    try { rec.body = JSON.parse(body); } catch (e) { rec.body = null; }
    anth.requests.push(rec);
    if (req.method !== 'POST' || !/^\/v1\/messages(\?|$)/.test(req.url)) return sendJson(res, 404, { type: 'error', error: { type: 'not_found_error', message: 'Not found: ' + req.url } });
    var step = anth.script.length ? anth.script.shift() : { status: 500, json: { type: 'error', error: { type: 'api_error', message: 'mock script exhausted' } } };
    if (typeof step === 'function') step = step(rec);
    var go = function () { sendJson(res, step.status || 200, step.json, Object.assign({ 'request-id': 'req_mock' }, step.headers || {})); };
    if (step.delay) setTimeout(go, step.delay); else go();
  });
}

/* (b) mock Ollama */
var oll = { requests: [], script: [], models: ['qwen2.5-coder:7b', 'llama3.1:8b'] };
function ollamaHandler(req, res) {
  readBody(req).then(function (body) {
    var rec = { method: req.method, url: req.url, headers: req.headers, body: null };
    try { rec.body = body ? JSON.parse(body) : null; } catch (e) { rec.body = null; }
    oll.requests.push(rec);
    if (req.method === 'GET' && req.url === '/api/tags') return sendJson(res, 200, { models: oll.models.map(function (n) { return { name: n, model: n, size: 1 }; }) });
    if (req.method === 'POST' && req.url === '/api/chat') {
      if (!rec.body || !rec.body.format || typeof rec.body.format !== 'object') return sendJson(res, 400, { error: 'format (JSON schema) expected by this mock' });
      var step = oll.script.length ? oll.script.shift() : { text: '{}' };
      if (typeof step === 'function') step = step(rec);
      return sendJson(res, step.status || 200, step.json || { model: rec.body.model, created_at: new Date().toISOString(), message: { role: 'assistant', content: step.text }, done: true, done_reason: step.doneReason || 'stop', prompt_eval_count: 900, eval_count: 60 });
    }
    sendJson(res, 404, { error: 'not found' });
  });
}

/* (c) mock OpenAI-compatible server (LM Studio-like). `oai.reject` lists response_format types answered with 400. */
var oai = { requests: [], script: [], reject: ['json_schema'] };
function openaiHandler(req, res) {
  readBody(req).then(function (body) {
    var rec = { method: req.method, url: req.url, headers: req.headers, body: null };
    try { rec.body = body ? JSON.parse(body) : null; } catch (e) { rec.body = null; }
    oai.requests.push(rec);
    if (req.method === 'GET' && req.url === '/v1/models') return sendJson(res, 200, { object: 'list', data: [{ id: 'local-model', object: 'model' }, { id: 'second-model', object: 'model' }] });
    if (req.method === 'POST' && req.url === '/v1/chat/completions') {
      var rf = rec.body && rec.body.response_format;
      if (rf && oai.reject.indexOf(rf.type) >= 0) return sendJson(res, 400, { error: { message: "'response_format.type' must be 'text' or not given", type: 'invalid_request_error' } });
      var step = oai.script.length ? oai.script.shift() : { text: '{}' };
      if (typeof step === 'function') step = step(rec);
      return sendJson(res, 200, { id: 'chatcmpl-mock', object: 'chat.completion', model: rec.body.model, choices: [{ index: 0, message: { role: 'assistant', content: step.text }, finish_reason: step.finish || 'stop' }], usage: { prompt_tokens: 900, completion_tokens: 60 } });
    }
    sendJson(res, 404, { error: { message: 'not found' } });
  });
}

/* ------------------------------------------------------------------ shared state for the tests */
var E = null, CTX = null, URLS = {}, SDK_PATH = null;
var GOOD_TR = '=SUMIFS(E2:E200,B2:B200,"Gıda",H2:H200,"Ankara")';
var GOOD_TR_LOCAL = '=ÇOKETOPLA(E2:E200;B2:B200;"Gıda";H2:H200;"Ankara")';
var TR_REQUEST = 'Ankara’daki Gıda kategorisi satışlarının toplam tutarını bul';
function anthSettings(extra) {
  var s = { mode: 'anthropic', anthropic: { apiKey: 'sk-ant-test-key', baseURL: URLS.anthropic, model: 'claude-opus-5-5', effort: 'medium' }, fallbackToRules: true, maxRepairs: 2, sendSamples: false };
  if (extra) Object.keys(extra).forEach(function (k) { if (k === 'anthropic') Object.assign(s.anthropic, extra.anthropic); else s[k] = extra[k]; });
  return s;
}
function trOpts(settings, extra) { var o = { dialect: 'tr', uiLang: 'tr', style: 'modern', settings: settings }; if (extra) Object.keys(extra).forEach(function (k) { o[k] = extra[k]; }); return o; }
function resetAnth(script) { anth.requests = []; anth.script = script.slice(); }
function needSdk() { if (!SDK_PATH) skip('@anthropic-ai/sdk not found (set EFS_ANTHROPIC_SDK)'); }
function userPayload(rec, i) { var m = rec.body.messages[i == null ? 0 : i]; return JSON.parse(typeof m.content === 'string' ? m.content : m.content[0].text); }
function textOf(content) { return typeof content === 'string' ? content : (content || []).map(function (b) { return b.text || ''; }).join(''); }

/* ------------------------------------------------------------------ (a) Anthropic through the real SDK */
test('anthropic', 'good TR answer → TR dialect formula + request contract', function () {
  needSdk();
  resetAnth([{ json: anthropicMessage(answer(GOOD_TR, { explanation: 'Ankara’daki Gıda satışlarının toplamı.', assumptions: ['Tutar sütunu toplandı.'] })) }]);
  return E.ai.generate(TR_REQUEST, CTX.tr, trOpts(anthSettings())).then(function (r) {
    eq(r.source, 'ai', 'source'); eq(r.provider, 'anthropic', 'provider'); eq(r.kind, 'formula', 'kind');
    eq(r.best.formula, GOOD_TR_LOCAL, 'TR formula'); eq(r.best.formulaEN, GOOD_TR, 'EN formula');
    eq(r.best.intent, 'ai', 'intent'); eq(r.best.confidence, 0.9, 'confidence');
    check(r.best.explanation && typeof r.best.explanation.summary === 'string' && r.best.explanation.summary.length > 0, 'explainAST summary missing');
    eq(r.best.target && r.best.target.kind, 'cell', 'target kind'); eq(r.best.target.cell, 'N2', 'target cell');
    eq(r.best.assumptions[0].tr, 'Tutar sütunu toplandı.', 'assumption'); eq(r.aiNotes.explanation, 'Ankara’daki Gıda satışlarının toplamı.', 'aiNotes.explanation');
    eq(r.fallbackReason, null, 'fallbackReason'); eq(anth.requests.length, 1, 'request count');
    var rq = anth.requests[0], h = rq.headers, b = rq.body;
    // SDK 1.x (API version 2026-10-21) sends the key as "Authorization: Bearer"; older SDKs used x-api-key. Accept either.
    check(h['x-api-key'] === 'sk-ant-test-key' || h.authorization === 'Bearer sk-ant-test-key', 'API key header (x-api-key or Authorization: Bearer) missing: ' + JSON.stringify({ x: h['x-api-key'], a: h.authorization }));
    check(!!h['anthropic-version'], 'anthropic-version header missing');
    check(String(h['anthropic-beta'] || '').split(',').map(function (s) { return s.trim(); }).indexOf('server-side-fallback-2026-07-01') >= 0, 'anthropic-beta must contain server-side-fallback-2026-07-01, got ' + h['anthropic-beta']);
    eq(h['anthropic-dangerous-direct-browser-access'], 'true', 'dangerous-direct-browser-access header');
    eq(b.model, 'claude-opus-5-5', 'model'); eq(b.max_tokens, 16000, 'max_tokens'); eq(b.fallbacks, 'default', 'fallbacks');
    check(!('betas' in b), 'betas must travel as a header, not in the body');
    eq(b.output_config && b.output_config.format && b.output_config.format.type, 'json_schema', 'output_config.format.type');
    eq(b.output_config.effort, 'medium', 'effort');
    var sch = b.output_config.format.schema;
    eq(sch.additionalProperties, false, 'schema additionalProperties');
    eq(sch.required.slice().sort().join(','), Object.keys(sch.properties).sort().join(','), 'every property required');
    check(Array.isArray(b.system) && b.system[0].type === 'text' && b.system[0].cache_control && b.system[0].cache_control.type === 'ephemeral', 'system block with cache_control');
    ['temperature', 'top_p', 'top_k', 'thinking'].forEach(function (k) { check(!(k in b), k + ' must not be sent'); });
    eq(b.messages.length, 1, 'messages'); eq(b.messages[0].role, 'user', 'role');
    var p = userPayload(rq);
    eq(p.lang, 'tr', 'payload lang'); eq(p.style, 'modern', 'payload style'); eq(p.sheet.name, 'Satışlar', 'payload sheet'); eq(p.sheet.firstDataRow, 2, 'firstDataRow');
    eq(p.columns.length, 13, 'columns'); eq(p.columns[4].dataRange, 'E2:E200', 'dataRange'); check(!('samples' in p.columns[0]), 'samples must be off by default');
    eq(Object.keys(p.otherSheets).join(), 'Ürünler', 'otherSheets'); eq(p.request, TR_REQUEST, 'request text');
  });
});

test('anthropic', 'samples are sent only when sendSamples is on', function () {
  needSdk();
  resetAnth([{ json: anthropicMessage(answer(GOOD_TR)) }]);
  return E.ai.generate(TR_REQUEST, CTX.tr, trOpts(anthSettings({ sendSamples: true }))).then(function (r) {
    eq(r.source, 'ai', 'source');
    var p = userPayload(anth.requests[0]);
    check(Array.isArray(p.columns[0].samples) && p.columns[0].samples[0] === 'Kalem', 'samples expected on column A');
  });
});

test('anthropic', 'unknown function → repair round (append-only) → good answer', function () {
  needSdk();
  var bad = answer('=SUMIFSX(E2:E200,B2:B200,"Gıda")');
  resetAnth([{ json: anthropicMessage(bad) }, { json: anthropicMessage(answer(GOOD_TR)) }]);
  return E.ai.generate(TR_REQUEST, CTX.tr, trOpts(anthSettings())).then(function (r) {
    eq(r.source, 'ai', 'source'); eq(r.best.formula, GOOD_TR_LOCAL, 'formula after repair'); eq(r.attempts, 2, 'attempts');
    eq(anth.requests.length, 2, 'request count');
    var m1 = anth.requests[0].body.messages, m2 = anth.requests[1].body.messages;
    eq(m2.length, 3, 'repair conversation length');
    eq(JSON.stringify(m2[0]), JSON.stringify(m1[0]), 'first turn unchanged (append-only)');
    eq(m2[1].role, 'assistant', 'second turn role'); eq(textOf(m2[1].content), bad, 'previous answer echoed verbatim');
    eq(m2[2].role, 'user', 'third turn role'); check(/Unknown function SUMIFSX/.test(textOf(m2[2].content)), 'validation error listed: ' + textOf(m2[2].content));
    eq(JSON.stringify(anth.requests[1].body.system), JSON.stringify(anth.requests[0].body.system), 'system prompt unchanged (cacheable)');
  });
});

test('anthropic', 'non-existent column Z → repair → good answer', function () {
  needSdk();
  resetAnth([{ json: anthropicMessage(answer('=SUMIFS(Z2:Z200,B2:B200,"Gıda",H2:H200,"Ankara")')) }, { json: anthropicMessage(answer(GOOD_TR)) }]);
  return E.ai.generate(TR_REQUEST, CTX.tr, trOpts(anthSettings())).then(function (r) {
    eq(r.source, 'ai', 'source'); eq(r.best.formulaEN, GOOD_TR, 'formula after repair');
    var fb = textOf(anth.requests[1].body.messages[2].content);
    check(/Column Z does not exist/.test(fb) && /E \(Tutar\)/.test(fb), 'column error with the available columns: ' + fb);
  });
});

test('anthropic', 'refusal → fallback to rules with fallbackReason (category shown)', function () {
  needSdk();
  resetAnth([{ json: anthropicMessage(null, 'refusal', { stop_details: { type: 'refusal', category: 'cyber', explanation: null } }) }]);
  return E.ai.generate(TR_REQUEST, CTX.tr, trOpts(anthSettings())).then(function (r) {
    eq(r.source, 'rules', 'source'); eq(r.aiError, 'refusal', 'aiError'); eq(anth.requests.length, 1, 'no repair after a refusal');
    check(r.fallbackReason && /reddetti/.test(r.fallbackReason.tr) && /cyber/.test(r.fallbackReason.tr), 'TR reason: ' + JSON.stringify(r.fallbackReason));
    check(/отказалась/.test(r.fallbackReason.ru) && /declined/.test(r.fallbackReason.en), 'RU/EN reason');
  });
});

test('anthropic', '401 → AuthenticationError → "API anahtarı geçersiz" (fallback off → rejects)', function () {
  needSdk();
  resetAnth([{ status: 401, json: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } } }]);
  return E.ai.generate(TR_REQUEST, CTX.tr, trOpts(anthSettings({ fallbackToRules: false }))).then(function () { throw new Error('expected a rejection'); }, function (e) {
    eq(e.code, 'auth', 'code'); eq(e.msg.tr, 'API anahtarı geçersiz.', 'TR'); eq(e.msg.ru, 'Неверный ключ API.', 'RU'); eq(e.msg.en, 'Invalid API key.', 'EN');
    eq(anth.requests.length, 1, '401 is not retried');
  });
});

test('anthropic', '401 with fallbackToRules → rules result + reason', function () {
  needSdk();
  resetAnth([{ status: 401, json: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } } }]);
  return E.ai.generate(TR_REQUEST, CTX.tr, trOpts(anthSettings())).then(function (r) {
    eq(r.source, 'rules', 'source'); eq(r.aiError, 'auth', 'aiError'); eq(r.fallbackReason.tr, 'API anahtarı geçersiz.', 'reason');
  });
});

test('anthropic', 'connection refused → APIConnectionError → offline fallback', function () {
  needSdk();
  return closedPort().then(function (port) {
    var s = anthSettings({ anthropic: { baseURL: 'http://127.0.0.1:' + port, apiKey: 'sk-ant-offline' } });
    return E.ai.generate(TR_REQUEST, CTX.tr, trOpts(s));
  }).then(function (r) {
    eq(r.source, 'rules', 'source'); eq(r.aiError, 'offline', 'aiError');
    check(/bağlanılamadı/.test(r.fallbackReason.tr) && /Не удалось подключиться/.test(r.fallbackReason.ru), 'offline reason: ' + JSON.stringify(r.fallbackReason));
  });
});

test('anthropic', 'max_tokens → repair asks for a shorter LET formula', function () {
  needSdk();
  resetAnth([{ json: anthropicMessage('{"formula":"=IF(AND(E2>1,', 'max_tokens') }, { json: anthropicMessage(answer(GOOD_TR)) }]);
  return E.ai.generate(TR_REQUEST, CTX.tr, trOpts(anthSettings())).then(function (r) {
    eq(r.source, 'ai', 'source'); eq(anth.requests.length, 2, 'requests');
    var last = textOf(anth.requests[1].body.messages[2].content);
    check(/max_tokens/.test(last) && /LET/.test(last) && /SHORTER/.test(last), 'repair text: ' + last);
  });
});

test('anthropic', 'classic style: XLOOKUP rejected → repair with VLOOKUP', function () {
  needSdk();
  var fill = { mode: 'fill' };
  resetAnth([{ json: anthropicMessage(answer('=XLOOKUP(A2,Ürünler!$B$2:$B$50,Ürünler!$C$2:$C$50)', fill)) },
    { json: anthropicMessage(answer('=VLOOKUP(A2,Ürünler!$B$2:$C$50,2,FALSE)', fill)) }]);
  return E.ai.generate('Ürünün fiyatını Ürünler sayfasından getir', CTX.tr, trOpts(anthSettings(), { style: 'classic' })).then(function (r) {
    eq(r.source, 'ai', 'source'); eq(r.best.formula, '=DÜŞEYARA(A2;Ürünler!$B$2:$C$50;2;YANLIŞ)', 'classic TR formula');
    check(/XLOOKUP is not available in Excel 2016/.test(textOf(anth.requests[1].body.messages[2].content)), 'classic error listed');
    eq(userPayload(anth.requests[0]).style, 'classic', 'style in payload');
    eq(r.best.target.kind, 'fill', 'fill target'); eq(r.best.target.fillRange, 'N2:N200', 'fillRange');
  });
});

test('anthropic', 'fill formula: relative lookup ranges are made absolute', function () {
  needSdk();
  resetAnth([{ json: anthropicMessage(answer('=XLOOKUP(A2,Ürünler!B2:B50,Ürünler!C2:C50,"Bulunamadı")', { mode: 'fill', target_cell: 'P2' })) }]);
  return E.ai.generate('Her ürünün fiyatını P sütununa getir', CTX.tr, trOpts(anthSettings())).then(function (r) {
    eq(r.best.formulaEN, '=XLOOKUP(A2,Ürünler!$B$2:$B$50,Ürünler!$C$2:$C$50,"Bulunamadı")', 'absolute ranges');
    eq(r.best.formula, '=ÇAPRAZARA(A2;Ürünler!$B$2:$B$50;Ürünler!$C$2:$C$50;"Bulunamadı")', 'TR');
    eq(r.best.target.cell, 'P2', 'target cell'); eq(r.best.target.fillRange, 'P2:P200', 'fillRange');
    check(r.best.tags.indexOf('365') >= 0, '365 tag'); eq(r.aiNotes.fixes.length, 2, 'fix notes');
  });
});

test('anthropic', 'clarifying question lowers confidence and is surfaced', function () {
  needSdk();
  resetAnth([{ json: anthropicMessage(answer('=SUM(E2:E200)', { question: 'KDV dahil mi olsun?' })) }]);
  return E.ai.generate('toplamı bul', CTX.tr, trOpts(anthSettings())).then(function (r) {
    eq(r.best.confidence, 0.75, 'confidence'); eq(r.aiNotes.question, 'KDV dahil mi olsun?', 'question'); eq(r.best.question, 'KDV dahil mi olsun?', 'candidate question');
  });
});

test('anthropic', '429 → retried by the SDK, then RateLimitError message', function () {
  needSdk();
  var rl = { status: 429, json: { type: 'error', error: { type: 'rate_limit_error', message: 'rate limited' } }, headers: { 'retry-after-ms': '20' } };
  resetAnth([rl, rl, rl]);
  return E.ai.generate(TR_REQUEST, CTX.tr, trOpts(anthSettings())).then(function (r) {
    eq(r.aiError, 'rate', 'aiError'); eq(anth.requests.length, 3, 'maxRetries 2 → 3 requests'); check(/sınır/.test(r.fallbackReason.tr), 'TR reason');
  });
});

test('anthropic', '400 BadRequestError shows the API message', function () {
  needSdk();
  resetAnth([{ status: 400, json: { type: 'error', error: { type: 'invalid_request_error', message: 'output_config.format: schema too complex' } } }]);
  return E.ai.generate(TR_REQUEST, CTX.tr, trOpts(anthSettings())).then(function (r) {
    eq(r.aiError, 'bad_request', 'aiError'); check(/schema too complex/.test(r.fallbackReason.en) && /reddedildi/.test(r.fallbackReason.tr), 'message shown: ' + r.fallbackReason.en);
  });
});

test('anthropic', '529 overloaded → InternalServerError → overloaded message', function () {
  needSdk();
  var ov = { status: 529, json: { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }, headers: { 'retry-after-ms': '10' } };
  resetAnth([ov, ov, ov]);
  return E.ai.generate(TR_REQUEST, CTX.tr, trOpts(anthSettings())).then(function (r) {
    eq(r.aiError, 'overloaded', 'aiError'); check(/перегружен/.test(r.fallbackReason.ru), 'RU reason');
  });
});

test('anthropic', 'Haiku model: no fallbacks parameter / beta (no server-side fallback there)', function () {
  needSdk();
  resetAnth([{ json: anthropicMessage(answer(GOOD_TR)) }]);
  return E.ai.generate(TR_REQUEST, CTX.tr, trOpts(anthSettings({ anthropic: { model: 'claude-haiku-5-5', effort: 'low' } }))).then(function (r) {
    eq(r.source, 'ai', 'source'); var b = anth.requests[0].body;
    eq(b.model, 'claude-haiku-5-5', 'model'); check(!('fallbacks' in b), 'no fallbacks'); eq(b.output_config.effort, 'low', 'effort');
    check(!/server-side-fallback/.test(anth.requests[0].headers['anthropic-beta'] || ''), 'no fallback beta');
  });
});

test('anthropic', 'ai.abort() cancels the in-flight request (APIUserAbortError)', function () {
  needSdk();
  resetAnth([{ json: anthropicMessage(answer(GOOD_TR)), delay: 1500 }]);
  var p = E.ai.generate(TR_REQUEST, CTX.tr, trOpts(anthSettings()));
  setTimeout(function () { E.ai.abort(); }, 150);
  return p.then(function (r) {
    eq(r.cancelled, true, 'cancelled'); eq(r.kind, 'empty', 'kind'); eq(r.message.tr, 'İstek iptal edildi.', 'message'); eq(r.candidates.length, 0, 'no candidates');
  });
});

test('anthropic', 'explain mode (=…) and empty text never call the model', function () {
  needSdk();
  resetAnth([]);
  return E.ai.generate('=SUMIF(A1:A5,">3")', CTX.tr, trOpts(anthSettings())).then(function (r) {
    eq(r.source, 'rules', 'source'); eq(r.kind, 'explain', 'kind'); eq(r.fallbackReason, null, 'no fallbackReason');
    return E.ai.generate('   ', CTX.tr, trOpts(anthSettings()));
  }).then(function (r) { eq(r.kind, 'empty', 'empty kind'); eq(anth.requests.length, 0, 'no requests'); });
});

test('anthropic', 'missing API key → rules with a trilingual reason', function () {
  resetAnth([]);
  return E.ai.generate(TR_REQUEST, CTX.tr, trOpts(anthSettings({ anthropic: { apiKey: '' } }))).then(function (r) {
    eq(r.source, 'rules', 'source'); eq(r.aiError, 'no_key', 'aiError'); check(/anahtar/.test(r.fallbackReason.tr), 'reason'); eq(anth.requests.length, 0, 'no request');
  });
});

test('anthropic', 'testConnection: tiny plain request (max_tokens 16, same betas/fallbacks)', function () {
  needSdk();
  resetAnth([{ json: anthropicMessage('OK') }]);
  return E.ai.testConnection(anthSettings()).then(function (r) {
    eq(r.ok, true, 'ok'); eq(r.message.tr, 'Bağlantı başarılı.', 'message');
    var b = anth.requests[0].body;
    eq(b.max_tokens, 16, 'max_tokens'); eq(b.fallbacks, 'default', 'fallbacks'); check(!b.output_config, 'no structured output'); check(!b.system, 'no system');
    resetAnth([{ status: 401, json: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } } }]);
    return E.ai.testConnection(anthSettings());
  }).then(function (r) { eq(r.ok, false, 'not ok'); eq(r.code, 'auth', 'code'); eq(r.message.ru, 'Неверный ключ API.', 'RU'); });
});

test('anthropic', 'mode off → rule engine, no request', function () {
  resetAnth([]);
  return E.ai.generate(TR_REQUEST, CTX.tr, trOpts({ mode: 'off' })).then(function (r) { eq(r.source, 'rules', 'source'); eq(r.fallbackReason, null, 'no reason'); eq(anth.requests.length, 0, 'no request'); });
});

/* ------------------------------------------------------------------ (b) Ollama */
var GOOD_RU = '=SUMIFS(E2:E200,B2:B200,"Еда",H2:H200,"Москва")';
function ollSettings(extra) { var s = { mode: 'ollama', ollama: { url: URLS.ollama, model: '' }, fallbackToRules: true, maxRepairs: 2 }; if (extra) Object.keys(extra).forEach(function (k) { if (k === 'ollama') Object.assign(s.ollama, extra.ollama); else s[k] = extra[k]; }); return s; }
function ruOpts(settings) { return { dialect: 'ru', uiLang: 'ru', style: 'modern', settings: settings }; }

test('ollama', 'good RU answer (model auto-picked from /api/tags, format = schema)', function () {
  oll.requests = []; oll.script = [{ text: answer(GOOD_RU, { explanation: 'Сумма продаж категории «Еда» в Москве.' }) }];
  return E.ai.generate('Сумма продаж категории Еда в Москве', CTX.ru, ruOpts(ollSettings())).then(function (r) {
    eq(r.source, 'ai', 'source'); eq(r.provider, 'ollama', 'provider');
    eq(r.best.formula, '=СУММЕСЛИМН(E2:E200;B2:B200;"Еда";H2:H200;"Москва")', 'RU formula');
    var chat = oll.requests.filter(function (q) { return q.url === '/api/chat'; })[0];
    eq(chat.body.model, 'qwen2.5-coder:7b', 'auto model'); eq(chat.body.stream, false, 'stream'); eq(chat.body.options.temperature, 0.1, 'temperature');
    eq(chat.body.format.type, 'object', 'format schema'); eq(chat.body.messages[0].role, 'system', 'system message'); eq(chat.body.messages[1].role, 'user', 'user message');
    eq(r.model, 'qwen2.5-coder:7b', 'result model');
  });
});

test('ollama', 'repair round with a local model (string assistant turn)', function () {
  oll.requests = []; oll.script = [{ text: 'Вот формула: =СУММ(E2:E200)' }, { text: answer(GOOD_RU) }];
  return E.ai.generate('Сумма продаж категории Еда в Москве', CTX.ru, ruOpts(ollSettings({ ollama: { model: 'llama3.1:8b' } }))).then(function (r) {
    eq(r.source, 'ai', 'source');
    var chats = oll.requests.filter(function (q) { return q.url === '/api/chat'; });
    eq(chats.length, 2, 'two chat calls'); eq(chats[1].body.messages.length, 4, 'system + user + assistant + user');
    eq(chats[1].body.messages[2].content, 'Вот формула: =СУММ(E2:E200)', 'assistant echoed'); eq(chats[1].body.model, 'llama3.1:8b', 'chosen model');
  });
});

test('ollama', 'listLocalModels + testConnection', function () {
  return E.ai.listLocalModels('ollama', ollSettings()).then(function (list) {
    eq(list.join(','), 'qwen2.5-coder:7b,llama3.1:8b', 'models');
    return E.ai.testConnection(ollSettings());
  }).then(function (r) { eq(r.ok, true, 'ok'); eq(r.models.length, 2, 'models'); check(/2/.test(r.message.tr), 'message'); });
});

test('ollama', 'connection refused → hint (ollama serve / OLLAMA_ORIGINS) + fallback', function () {
  return closedPort().then(function (port) {
    return E.ai.generate('Сумма продаж категории Еда в Москве', CTX.ru, ruOpts(ollSettings({ ollama: { url: 'http://127.0.0.1:' + port, model: 'x' } })));
  }).then(function (r) {
    eq(r.source, 'rules', 'source'); eq(r.aiError, 'local_offline_ollama', 'aiError');
    check(/ollama serve/.test(r.fallbackReason.ru) && /OLLAMA_ORIGINS=\*/.test(r.fallbackReason.ru) && /настольной/.test(r.fallbackReason.ru), 'RU hint');
    check(/ollama serve/.test(r.fallbackReason.tr) && /OLLAMA_ORIGINS=\*/.test(r.fallbackReason.tr) && /masaüstü/.test(r.fallbackReason.tr), 'TR hint');
  });
});

test('ollama', 'desktop transport window.efsDesktop.http is used when present', function () {
  var calls = [];
  globalThis.efsDesktop = { isDesktop: true, http: function (req) {
    calls.push(req);
    return fetch(req.url, { method: req.method, headers: req.headers, body: req.body || undefined }).then(function (res) { return res.text().then(function (t) { return { status: res.status, body: t }; }); });
  } };
  oll.requests = []; oll.script = [{ text: answer(GOOD_RU) }];
  return E.ai.generate('Сумма продаж категории Еда в Москве', CTX.ru, ruOpts(ollSettings({ ollama: { model: 'qwen2.5-coder:7b' } }))).then(function (r) {
    delete globalThis.efsDesktop;
    eq(r.source, 'ai', 'source'); eq(calls.length, 1, 'desktop http calls'); eq(calls[0].method, 'POST', 'method'); check(typeof calls[0].body === 'string', 'string body');
  }, function (e) { delete globalThis.efsDesktop; throw e; });
});

/* ------------------------------------------------------------------ (c) OpenAI-compatible */
function oaiSettings(extra) { var s = { mode: 'openaiCompat', openaiCompat: { url: URLS.openai + '/v1', model: '', apiKey: '' }, fallbackToRules: true, maxRepairs: 2 }; if (extra) Object.keys(extra).forEach(function (k) { if (k === 'openaiCompat') Object.assign(s.openaiCompat, extra.openaiCompat); else s[k] = extra[k]; }); return s; }

test('openaiCompat', '400 on json_schema → retry with json_object; JSON extracted from prose', function () {
  oai.requests = []; oai.reject = ['json_schema'];
  oai.script = [{ text: 'Sure! Here is the answer:\n```json\n' + answer('=SUMIFS(E2:E200,B2:B200,"Food",H2:H200,"London")') + '\n```' }];
  return E.ai.generate('total Amount for Food in London', CTX.en, { dialect: 'en', uiLang: 'en', style: 'modern', settings: oaiSettings() }).then(function (r) {
    eq(r.source, 'ai', 'source'); eq(r.provider, 'openaiCompat', 'provider'); eq(r.best.formula, '=SUMIFS(E2:E200,B2:B200,"Food",H2:H200,"London")', 'EN formula');
    var posts = oai.requests.filter(function (q) { return q.method === 'POST'; });
    eq(posts.length, 2, 'two POSTs'); eq(posts[0].body.response_format.type, 'json_schema', 'first json_schema');
    eq(posts[0].body.response_format.json_schema.name, 'formula', 'schema name'); eq(posts[1].body.response_format.type, 'json_object', 'then json_object');
    eq(posts[0].body.model, 'local-model', 'auto model from /v1/models'); eq(posts[0].body.messages[0].role, 'system', 'system');
  });
});

test('openaiCompat', 'server rejects every response_format → plain request; Bearer key sent', function () {
  oai.requests = []; oai.reject = ['json_schema', 'json_object'];
  oai.script = [{ text: answer('=SUM(E2:E200)') }];
  return E.ai.generate('sum the Amount column', CTX.en, { dialect: 'en', uiLang: 'en', settings: oaiSettings({ openaiCompat: { model: 'second-model', apiKey: 'lm-key' } }) }).then(function (r) {
    eq(r.source, 'ai', 'source'); var posts = oai.requests.filter(function (q) { return q.method === 'POST'; });
    eq(posts.length, 3, 'three POSTs'); check(!('response_format' in posts[2].body), 'last without response_format');
    eq(posts[0].headers.authorization, 'Bearer lm-key', 'Authorization header');
    oai.reject = ['json_schema'];
  });
});

test('openaiCompat', 'listLocalModels / testConnection / offline hint', function () {
  return E.ai.listLocalModels('openaiCompat', oaiSettings()).then(function (list) {
    eq(list.join(','), 'local-model,second-model', 'models');
    return E.ai.testConnection(oaiSettings());
  }).then(function (r) {
    eq(r.ok, true, 'ok');
    return closedPort();
  }).then(function (port) { return E.ai.testConnection(oaiSettings({ openaiCompat: { url: 'http://127.0.0.1:' + port + '/v1' } })); })
    .then(function (r) { eq(r.ok, false, 'offline not ok'); eq(r.code, 'local_offline_openai', 'code'); check(/LM Studio/.test(r.message.tr) && /LM Studio/.test(r.message.ru), 'hint'); });
});

/* ------------------------------------------------------------------ unit checks (settings, schema, prompt) */
test('unit', 'settings: defaults, merge, sanitize, localStorage (and a throwing one)', function () {
  var store = {};
  globalThis.localStorage = { getItem: function (k) { return k in store ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; } };
  try {
    var d = E.ai.getSettings();
    eq(d.mode, 'off', 'default mode'); eq(d.anthropic.model, 'claude-opus-5-5', 'default model'); eq(d.ollama.url, 'http://localhost:11434', 'ollama url');
    eq(d.openaiCompat.url, 'http://localhost:1234/v1', 'openai url'); eq(d.fallbackToRules, true, 'fallback'); eq(d.maxRepairs, 2, 'maxRepairs'); eq(d.sendSamples, false, 'samples');
    E.ai.saveSettings({ mode: 'ollama', ollama: { model: 'qwen' }, maxRepairs: 9, anthropic: { effort: 'bogus' } });
    var raw = JSON.parse(store['efs.ai.v1']);
    eq(raw.mode, 'ollama', 'stored mode'); eq(raw.ollama.model, 'qwen', 'stored model'); eq(raw.ollama.url, 'http://localhost:11434', 'url kept'); eq(raw.maxRepairs, 5, 'clamped');
    eq(raw.anthropic.effort, 'medium', 'sanitized effort'); eq(E.ai.isEnabled(), true, 'enabled');
    check(/Ollama/.test(E.ai.providerLabel('tr')) && /qwen/.test(E.ai.providerLabel('tr')), 'label');
    globalThis.localStorage = { getItem: function () { throw new Error('denied'); }, setItem: function () { throw new Error('denied'); } };
    var s2 = E.ai.saveSettings({ mode: 'anthropic', anthropic: { apiKey: 'k' } });
    eq(s2.mode, 'anthropic', 'save without storage'); eq(E.ai.getSettings().anthropic.apiKey, 'k', 'memory fallback');
  } finally { delete globalThis.localStorage; }
});

test('unit', 'ANSWER_SCHEMA follows the structured-output rules; SYSTEM_PROMPT size', function () {
  var s = E.ai.ANSWER_SCHEMA;
  eq(s.type, 'object', 'type'); eq(s.additionalProperties, false, 'additionalProperties');
  eq(s.required.length, Object.keys(s.properties).length, 'all required');
  var lines = E.ai.SYSTEM_PROMPT.split('\n').length;
  check(lines >= 60 && lines <= 120, 'system prompt lines: ' + lines);
  ['XLOOKUP', 'LET', 'TEXTJOIN', 'IFS', 'MAXIFS'].forEach(function (f) { check(E.ai.CLASSIC_BANNED.indexOf(f) >= 0, f + ' banned in classic'); });
});

test('unit', 'validation: placeholders, semicolons, structured refs, unknown sheet, circular target', function () {
  var v = function (f, extra) { var a = { formula: f, mode: 'cell', target_cell: '', explanation: '', assumptions: [], question: '' }; Object.assign(a, extra || {}); return E.ai.validateAnswer(a, CTX.tr, { style: 'modern' }, 'istek'); };
  check(!v('=IF(E2>1,«a»,"b")').ok, 'placeholder'); check(!v('=SUM(E2:E200;1)').ok, 'semicolon');
  check(!v('=SUM(Tablo1[Tutar])').ok, 'structured ref'); check(!v('=SUM(Sayfa9!A2:A9)').ok, 'unknown sheet');
  check(!v('=E2*2', { mode: 'fill', target_cell: 'E2' }).ok, 'circular'); check(!v('=SUM(KDV)').ok, 'unknown name');
  check(v('=LET(toplam,SUM(E2:E200),toplam*1.2)').ok, 'LET names allowed'); check(v('=Ürünler!C2*2').ok, 'other sheet column');
  check(!v('=Ürünler!F2*2').ok, 'other sheet unknown column'); check(v('=SUM(E:E)').ok, 'whole column');
});

/* ------------------------------------------------------------------ (d) Chromium: the vendored browser bundle from file:// */
function findPlaywright() {
  var dirs = [process.env.EFS_NODE_MODULES, DEFAULT_VENDOR].filter(Boolean);
  for (var i = 0; i < dirs.length; i++) { try { return require(path.join(dirs[i], 'playwright')); } catch (e) { /* next */ } }
  try { return require('playwright'); } catch (e) { return null; }
}
test('browser', 'file:// page: AnthropicSDK bundle + ai files → formula via the mock API (CORS, dangerouslyAllowBrowser)', function () {
  if (NO_BROWSER) skip('--no-browser');
  var pw = findPlaywright();
  if (!pw) skip('playwright not found (set EFS_NODE_MODULES)');
  var url = require('url');
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'efs-ai-test-'));
  var scripts = ['assets/js/vendor/anthropic-sdk.min.js'].concat(moduleOrder(), AI_FILES, ['tests/fixtures/contexts.js']);
  var html = '<!doctype html><html><head><meta charset="utf-8"><title>ai-test</title></head><body>\n' +
    scripts.map(function (f) { return '<script src="' + url.pathToFileURL(path.join(ROOT, f)).href + '"></script>'; }).join('\n') + '\n</body></html>';
  var page = path.join(dir, 'ai-test.html');
  fs.writeFileSync(page, html, 'utf8');
  var exe = process.env.EFS_CHROMIUM || (fs.existsSync(DEFAULT_CHROMIUM) ? DEFAULT_CHROMIUM : undefined);
  var browser = null, pageErrors = [];
  resetAnth([{ json: anthropicMessage(answer(GOOD_TR)) }, { status: 401, json: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } } }]);
  anth.preflights = [];
  return pw.chromium.launch({ executablePath: exe, args: ['--no-sandbox'] }).then(function (b) {
    browser = b;
    return b.newPage();
  }).then(function (pg) {
    pg.on('pageerror', function (e) { pageErrors.push(String(e && e.message || e)); });
    return pg.goto(url.pathToFileURL(page).href).then(function () {
      return pg.evaluate(function (args) {
        var out = { sdkType: typeof (window.AnthropicSDK && window.AnthropicSDK.default), authErr: typeof (window.AnthropicSDK && window.AnthropicSDK.default && window.AnthropicSDK.default.AuthenticationError), protocol: location.protocol };
        var ctx = window.EFS_TEST_CONTEXTS.tr;
        var settings = { mode: 'anthropic', anthropic: { apiKey: 'sk-ant-browser', baseURL: args.url }, fallbackToRules: false };
        return window.EFS.ai.generate(args.text, ctx, { dialect: 'tr', uiLang: 'tr', settings: settings }).then(function (r) {
          out.source = r.source; out.formula = r.best && r.best.formula; out.summary = r.best && r.best.explanation && r.best.explanation.summary;
          return window.EFS.ai.generate(args.text, ctx, { dialect: 'tr', uiLang: 'tr', settings: settings }).then(function () { out.second = 'resolved'; }, function (e) { out.secondCode = e.code; out.secondMsg = e.msg && e.msg.tr; });
        }, function (e) { out.error = e && (e.code + ': ' + (e.msg ? e.msg.en : e.message)); }).then(function () { return out; });
      }, { url: URLS.anthropic, text: TR_REQUEST });
    });
  }).then(function (out) {
    return browser.close().then(function () { return out; });
  }, function (e) { return (browser ? browser.close() : Promise.resolve()).then(function () { throw e; }); }).then(function (out) {
    if (VERBOSE) console.log('  browser:', JSON.stringify(out), pageErrors.length ? 'pageerrors: ' + pageErrors.join(' | ') : '');
    eq(out.protocol, 'file:', 'page protocol'); eq(out.sdkType, 'function', 'AnthropicSDK.default is a constructor'); eq(out.authErr, 'function', 'error classes exposed');
    var sdkErrors = pageErrors.filter(function (m) { return /AnthropicSDK|anthropic-sdk|EFS\.ai/.test(m); });
    check(!sdkErrors.length, 'page errors from the bundle/ai files: ' + sdkErrors.join(' | '));
    check(!out.error, 'generate failed in the browser: ' + out.error);
    eq(out.source, 'ai', 'browser source'); eq(out.formula, GOOD_TR_LOCAL, 'browser formula');
    eq(out.secondCode, 'auth', 'AuthenticationError mapped with instanceof in the bundle'); eq(out.secondMsg, 'API anahtarı geçersiz.', 'TR auth message');
    var rq = anth.requests[0];
    if (VERBOSE) console.log("  browser request headers:", JSON.stringify(rq && rq.headers), "preflight:", JSON.stringify(anth.preflights[0] && anth.preflights[0].headers));
    check(rq && rq.headers['anthropic-dangerous-direct-browser-access'] === 'true', 'dangerous-direct-browser-access header from the browser');
    eq(rq.headers.origin, 'null', 'request comes from a file:// origin');
    check(anth.preflights.length >= 1, 'CORS preflight observed');
    if (pageErrors.length) RESULTS_NOTES.push('browser page errors (other modules, not failing this test): ' + pageErrors.join(' | ').slice(0, 300));
  });
});
var RESULTS_NOTES = [];

/* ------------------------------------------------------------------ runner */
function withTimeout(p, ms) {
  return new Promise(function (resolve, reject) {
    var t = setTimeout(function () { reject(new Error('timeout after ' + ms + ' ms')); }, ms);
    Promise.resolve(p).then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
  });
}
function pad(s, n) { s = String(s); return s.length >= n ? s.slice(0, n) : s + new Array(n - s.length + 1).join(' '); }

function main() {
  SDK_PATH = resolveSdk();
  if (SDK_PATH) process.env.EFS_ANTHROPIC_SDK = SDK_PATH;
  loadModules();
  E = globalThis.EFS;
  CTX = require(path.join(ROOT, 'tests/fixtures/contexts.js'));
  var servers = [];
  return Promise.all([listen(anthropicHandler), listen(ollamaHandler), listen(openaiHandler)]).then(function (list) {
    servers = list;
    URLS.anthropic = list[0].url; URLS.ollama = list[1].url; URLS.openai = list[2].url;
    var aiMissing = LOAD_ERRORS.filter(function (l) { return /assets\/js\/ai\//.test(l.file); });
    var chain = Promise.resolve();
    TESTS.forEach(function (t) {
      chain = chain.then(function () {
        var t0 = Date.now();
        if (aiMissing.length || !E || !E.ai) { RESULTS.push({ t: t, status: 'FAIL', ms: 0, msg: 'ai modules failed to load: ' + JSON.stringify(aiMissing) }); return; }
        return withTimeout(Promise.resolve().then(t.fn), t.group === 'browser' ? 90000 : 30000).then(function () {
          RESULTS.push({ t: t, status: 'PASS', ms: Date.now() - t0, msg: '' });
        }, function (e) {
          RESULTS.push({ t: t, status: e && e.skip ? 'SKIP' : 'FAIL', ms: Date.now() - t0, msg: String(e && e.message || e) });
        });
      });
    });
    return chain;
  }).then(function () {
    servers.forEach(function (s) { s.server.close(); });
    var counts = { PASS: 0, FAIL: 0, SKIP: 0 };
    console.log('\nFormula Studio — AI mode tests (§16)');
    console.log('SDK for Node: ' + (SDK_PATH || 'not found') + '\n');
    console.log(pad('status', 7) + pad('group', 14) + pad('ms', 7) + 'test');
    console.log(new Array(110).join('-'));
    RESULTS.forEach(function (r) {
      counts[r.status]++;
      console.log(pad(r.status, 7) + pad(r.t.group, 14) + pad(r.ms, 7) + r.t.name);
      if (r.msg && (r.status !== 'PASS')) console.log('       ↳ ' + r.msg);
    });
    console.log(new Array(110).join('-'));
    console.log('pass ' + counts.PASS + '   fail ' + counts.FAIL + '   skip ' + counts.SKIP + '   total ' + RESULTS.length);
    if (LOAD_ERRORS.length) console.log('\nwarning: modules that failed to load (owned by other agents; rules fallback may degrade):\n' + LOAD_ERRORS.map(function (l) { return '  ' + l.file + ': ' + l.message; }).join('\n'));
    RESULTS_NOTES.forEach(function (n) { console.log('note: ' + n); });
    process.exitCode = counts.FAIL ? 1 : 0;
    setTimeout(function () { process.exit(process.exitCode); }, 50);
  }).catch(function (e) { console.error('ai-test crashed:', e && e.stack || e); process.exit(1); });
}

main();
