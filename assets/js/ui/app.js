/* Formula Studio — UI controller (EFS.ui).
 * Wires index.html to the engine modules. Every call into another EFS.* module is resolved lazily
 * and guarded: a missing or failing module produces a translated toast, never an uncaught error.
 * Boots on DOMContentLoaded in the browser; in Node it only exposes the API (for self-tests). */
(function (root, factory) {
  var EFS = root.EFS || (root.EFS = {});
  var api = factory(EFS, root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (EFS, root) {
  'use strict';

  var ui = {};
  var doc = root.document || null;

  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------
  var state = {
    uiLang: 'tr',
    dialect: 'tr',
    dialectManual: false,
    style: 'modern',
    theme: 'dark',
    workbook: null,
    sheetIndex: 0,
    ctx: null,
    lastResult: null,
    history: [],
    activeIndex: 0,
    cardDialects: {},
    modified: false,
    fileName: '',
    libTab: 'functions',
    fnQuery: '',
    fnCat: 'all',
    fnShown: 40,
    exampleSeed: 0,
    view: 'studio',
    booted: false
  };
  ui.state = state;

  var KEYS = {
    uiLang: 'efs.uiLang',
    dialect: 'efs.dialect',
    dialectManual: 'efs.dialectManual',
    style: 'efs.style',
    theme: 'efs.theme',
    history: 'efs.history',
    libTab: 'efs.libTab'
  };
  var DIALECTS = ['en', 'tr', 'ru'];
  var HISTORY_MAX = 20;
  var PREVIEW_ROWS = 30;
  var PREVIEW_COLS = 40;
  var EVAL_ROWS = 5;
  var RECIPE_ORDER = ['aggregate', 'logic', 'lookup', 'text', 'date', 'math', 'finance', 'array', 'error', 'meta'];

  // ------------------------------------------------------------------
  // Storage (every access guarded: private mode / file:// may block it)
  // ------------------------------------------------------------------
  var store = {
    get: function (key, fallback) {
      try {
        var raw = root.localStorage ? root.localStorage.getItem(key) : null;
        if (raw == null) return fallback;
        return JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { if (root.localStorage) root.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    },
    remove: function (key) {
      try { if (root.localStorage) root.localStorage.removeItem(key); } catch (e) { /* ignore */ }
    }
  };

  // ------------------------------------------------------------------
  // i18n helpers
  // ------------------------------------------------------------------
  function t(key, params) {
    if (EFS.i18n && typeof EFS.i18n.t === 'function') return EFS.i18n.t(key, params);
    return key;
  }
  function pick(obj, lang) {
    lang = lang || state.uiLang;
    if (obj == null) return '';
    if (typeof obj === 'string') return obj;
    if (EFS.util && EFS.util.pick) return EFS.util.pick(obj, lang);
    return obj[lang] || obj.en || obj.tr || obj.ru || '';
  }
  function esc(s) {
    if (EFS.util && EFS.util.esc) return EFS.util.esc(s);
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ------------------------------------------------------------------
  // Module access & error reporting
  // ------------------------------------------------------------------
  function ModuleMissing(name) {
    this.name = 'ModuleMissing';
    this.moduleMissing = name;
    this.message = 'EFS.' + name + ' is not loaded';
  }
  ModuleMissing.prototype = Object.create(Error.prototype);

  function mod(name) {
    var m = EFS[name];
    if (!m) throw new ModuleMissing(name);
    return m;
  }
  function has(name, fn) {
    var m = EFS[name];
    return !!(m && (!fn || typeof m[fn] === 'function'));
  }
  function reportError(e, key) {
    try {
      if (root.console) {
        if (e && e.moduleMissing) { if (root.console.warn) root.console.warn('[Formula Studio]', e.message); }
        else if (root.console.error) root.console.error('[Formula Studio]', e);
      }
    } catch (ignored) { /* ignore */ }
    if (e && e.moduleMissing) {
      toast(t('toast.moduleMissing', { module: e.moduleMissing }), 'danger');
      return;
    }
    var msg = (e && (e.message || (typeof e === 'string' ? e : ''))) || t('err.generic');
    toast((key ? t(key) + ': ' : '') + msg, 'danger');
  }
  function guard(fn, key, fallback) {
    try { return fn(); } catch (e) { reportError(e, key); return fallback; }
  }
  function quiet(fn, fallback) {
    try { return fn(); } catch (e) { return fallback; }
  }

  // ------------------------------------------------------------------
  // DOM helpers
  // ------------------------------------------------------------------
  function $(id) { return doc ? doc.getElementById(id) : null; }

  /** el('div', { className, text, title, attrs:{}, dataset:{}, on:{} }, children) */
  function el(tag, opts, children) {
    var node = doc.createElement(tag);
    opts = opts || {};
    if (opts.className) node.className = opts.className;
    if (opts.text != null) node.textContent = String(opts.text);
    if (opts.title) node.title = opts.title;
    if (opts.type) node.type = opts.type;
    if (opts.value != null) node.value = opts.value;
    if (opts.placeholder) node.placeholder = opts.placeholder;
    if (opts.hidden) node.hidden = true;
    if (opts.disabled) node.disabled = true;
    if (opts.attrs) Object.keys(opts.attrs).forEach(function (k) { node.setAttribute(k, opts.attrs[k]); });
    if (opts.dataset) Object.keys(opts.dataset).forEach(function (k) { node.dataset[k] = opts.dataset[k]; });
    if (opts.on) Object.keys(opts.on).forEach(function (ev) { node.addEventListener(ev, opts.on[ev]); });
    append(node, children);
    return node;
  }
  function append(node, children) {
    if (children == null) return node;
    if (!Array.isArray(children)) children = [children];
    children.forEach(function (c) {
      if (c == null || c === false) return;
      if (typeof c === 'string' || typeof c === 'number') node.appendChild(doc.createTextNode(String(c)));
      else node.appendChild(c);
    });
    return node;
  }
  function clear(node) { if (node) while (node.firstChild) node.removeChild(node.firstChild); return node; }
  function show(node, visible) { if (node) node.hidden = !visible; }
  function setActive(container, attr, value) {
    if (!container) return;
    var buttons = container.querySelectorAll('button[data-' + attr + ']');
    for (var i = 0; i < buttons.length; i++) {
      var on = buttons[i].dataset[attr] === value;
      buttons[i].classList.toggle('is-active', on);
      buttons[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  // Static inline SVG icons (constant markup, never user data).
  var ICONS = {
    copy: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 12l4 4L19 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    checkCircle: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 12l3 3 5-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    info: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="8" r="1.1" fill="currentColor"/></svg>',
    warning: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3L2.5 20h19z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 9v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1.1" fill="currentColor"/></svg>',
    danger: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    download: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    sparkles: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" fill="currentColor"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    book: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    sheet: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M4 4h16v16H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M4 9h16M4 14h16M10 4v16" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".6"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
  };
  function icon(name) {
    var wrap = doc.createElement('span');
    wrap.className = 'ico';
    wrap.innerHTML = ICONS[name] || ICONS.info; // static markup only
    return wrap.firstChild || wrap;
  }

  // ------------------------------------------------------------------
  // Toasts
  // ------------------------------------------------------------------
  function toast(message, kind, timeout) {
    if (!doc) return;
    var host = $('toasts');
    if (!host) return;
    kind = kind || 'info';
    var iconName = kind === 'success' ? 'checkCircle' : kind === 'warn' ? 'warning' : kind === 'danger' ? 'danger' : 'info';
    var node = el('div', { className: 'toast is-' + kind, attrs: { role: 'status' } }, [icon(iconName), el('span', { text: message })]);
    host.appendChild(node);
    while (host.children.length > 4) host.removeChild(host.firstChild);
    var ms = timeout || (kind === 'danger' ? 6000 : 3200);
    root.setTimeout(function () {
      node.classList.add('is-leaving');
      root.setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 220);
    }, ms);
    return node;
  }
  ui.toast = toast;

  // ------------------------------------------------------------------
  // Formula rendering: dialect conversion + syntax highlighting
  // ------------------------------------------------------------------
  function ensureEquals(f) {
    f = String(f == null ? '' : f).trim();
    if (!f) return '';
    return f.charAt(0) === '=' ? f : '=' + f;
  }

  /** Formula text of a candidate rendered in a dialect (ast.serialize → localize → raw fallbacks). */
  function formulaFor(cand, dialect) {
    if (!cand) return '';
    dialect = dialect || state.dialect;
    if (cand.ast && has('ast', 'serialize')) {
      var s = quiet(function () { return EFS.ast.serialize(cand.ast, { dialect: dialect, withEquals: true, uiLang: state.uiLang }); }, null);
      if (s) return ensureEquals(s);
    }
    var en = cand.formulaEN || null;
    if (dialect === 'en' && en) return ensureEquals(en);
    if (en && has('localize', 'translateFormula')) {
      var tr = quiet(function () { return EFS.localize.translateFormula(en, 'en', dialect); }, null);
      if (tr) return ensureEquals(tr);
    }
    if (cand.formula && has('localize', 'translateFormula')) {
      var tr2 = quiet(function () { return EFS.localize.translateFormula(cand.formula, 'auto', dialect); }, null);
      if (tr2) return ensureEquals(tr2);
    }
    return ensureEquals(cand.formula || en || '');
  }
  ui.formulaFor = formulaFor;

  var TOKEN_CLASS = {
    func: 'tk-func', ref: 'tk-ref', name: 'tk-ref', str: 'tk-str', num: 'tk-num', bool: 'tk-num', err: 'tk-num', percent: 'tk-num',
    op: 'tk-op', sep: 'tk-op', lparen: 'tk-op', rparen: 'tk-op', lbrace: 'tk-op', rbrace: 'tk-op', rowsep: 'tk-op', colsep: 'tk-op'
  };

  var FALLBACK_RE = /("(?:[^"]|"")*")|('(?:[^']|'')*'![$A-Za-z0-9:]+)|(\$?[A-Za-z]{1,3}\$?\d+(?::\$?[A-Za-z]{1,3}\$?\d+)?|\$?[A-Za-z]{1,3}:\$?[A-Za-z]{1,3}|\$?\d+:\$?\d+)|(\d+(?:[.,]\d+)?(?:[eE][-+]?\d+)?%?)|([A-Za-zЀ-ӿÇĞİÖŞÜçğıöşü_][\wЀ-ӿÇĞİÖŞÜçğıöşü.]*)(?=\s*\()|(<>|<=|>=|[-+*\/^&=<>;,(){}%\\:@#])|(\s+)|([^\s])/g;

  function fallbackPieces(body) {
    var out = [], m;
    FALLBACK_RE.lastIndex = 0;
    while ((m = FALLBACK_RE.exec(body)) !== null) {
      if (m[1]) out.push({ cls: 'tk-str', text: m[1] });
      else if (m[2]) out.push({ cls: 'tk-ref', text: m[2] });
      else if (m[3]) out.push({ cls: 'tk-ref', text: m[3] });
      else if (m[4]) out.push({ cls: 'tk-num', text: m[4] });
      else if (m[5]) out.push({ cls: 'tk-func', text: m[5] });
      else if (m[6]) out.push({ cls: 'tk-op', text: m[6] });
      else out.push({ cls: '', text: m[0] });
      if (m[0] === '') FALLBACK_RE.lastIndex++;
    }
    return out;
  }

  /** Tokenize a formula into [{cls,text}] pieces, using EFS.formulaReader.tokenize when it agrees with the text. */
  function highlightPieces(formula, dialect) {
    formula = String(formula == null ? '' : formula);
    var hadEq = formula.charAt(0) === '=';
    var body = hadEq ? formula.slice(1) : formula;
    var pieces = [];
    if (hadEq) pieces.push({ cls: 'tk-op', text: '=' });
    var tokens = has('formulaReader', 'tokenize') ? quiet(function () { return EFS.formulaReader.tokenize(body, dialect); }, null) : null;
    if (Array.isArray(tokens) && tokens.length) {
      var rebuilt = [], pos = 0, ok = true;
      for (var i = 0; i < tokens.length; i++) {
        var tok = tokens[i];
        if (typeof tok.start !== 'number' || typeof tok.end !== 'number' || tok.start < pos || tok.end < tok.start) { ok = false; break; }
        if (tok.start > pos) rebuilt.push({ cls: '', text: body.slice(pos, tok.start) });
        rebuilt.push({ cls: TOKEN_CLASS[tok.type] || '', text: body.slice(tok.start, tok.end) });
        pos = tok.end;
      }
      if (ok) {
        if (pos < body.length) rebuilt.push({ cls: '', text: body.slice(pos) });
        var joined = rebuilt.map(function (p) { return p.text; }).join('');
        if (joined === body) return pieces.concat(rebuilt);
      }
    }
    return pieces.concat(fallbackPieces(body));
  }
  ui.highlightPieces = highlightPieces;

  function highlightInto(box, formula, dialect) {
    clear(box);
    highlightPieces(formula, dialect).forEach(function (p) {
      if (p.cls) box.appendChild(el('span', { className: p.cls, text: p.text }));
      else box.appendChild(doc.createTextNode(p.text));
    });
    return box;
  }

  // ------------------------------------------------------------------
  // Clipboard
  // ------------------------------------------------------------------
  function copyText(text, onDone) {
    text = String(text == null ? '' : text);
    var done = function (ok) { if (onDone) onDone(ok); toast(t(ok ? 'toast.copied' : 'toast.copyFailed'), ok ? 'success' : 'warn'); };
    var fallback = function () {
      try {
        var ta = el('textarea', { value: text, attrs: { readonly: 'readonly', 'aria-hidden': 'true' } });
        ta.style.position = 'fixed'; ta.style.top = '-1000px'; ta.style.opacity = '0';
        doc.body.appendChild(ta);
        ta.focus(); ta.select();
        var ok = doc.execCommand && doc.execCommand('copy');
        doc.body.removeChild(ta);
        done(!!ok);
      } catch (e) { done(false); }
    };
    try {
      if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) {
        root.navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
      } else fallback();
    } catch (e) { fallback(); }
  }
  ui.copyText = copyText;

  /** A formula box with highlighted text and a copy button (plus optional extra tools). */
  function formulaBox(formula, dialect, opts) {
    opts = opts || {};
    var box = el('div', { className: 'formula-box' + (opts.compact ? ' is-compact' : ''), attrs: { 'data-formula': formula, 'data-testid': opts.compact ? 'formula-compact' : 'formula' } });
    highlightInto(box, formula, dialect);
    var tools = el('div', { className: 'formula-tools' });
    var copyBtn = el('button', { type: 'button', className: 'btn btn-sm' + (opts.compact ? ' btn-ghost' : ''), title: t('result.copy'), attrs: { 'aria-label': t('result.copy') } },
      [icon('copy'), opts.compact ? null : el('span', { text: t('result.copy') })]);
    copyBtn.addEventListener('click', function () {
      copyText(box.getAttribute('data-formula'), function (ok) {
        if (!ok) return;
        copyBtn.classList.add('is-success');
        var label = copyBtn.querySelector('span');
        if (label) label.textContent = t('result.copied');
        root.setTimeout(function () { copyBtn.classList.remove('is-success'); if (label) label.textContent = t('result.copy'); }, 1500);
      });
    });
    tools.appendChild(copyBtn);
    if (opts.tools) append(tools, opts.tools);
    box.appendChild(tools);
    return box;
  }

  function dialectPills(current, onChange) {
    var wrap = el('div', { className: 'dialect-pills', attrs: { role: 'group', 'aria-label': t('dialect.label') } });
    DIALECTS.forEach(function (d) {
      var b = el('button', { type: 'button', className: d === current ? 'is-active' : '', text: t('dialect.' + d), title: t('dialect.' + d + 'Long'), dataset: { dialect: d } });
      b.addEventListener('click', function () { setActive(wrap, 'dialect', d); onChange(d); });
      wrap.appendChild(b);
    });
    return wrap;
  }

  // ------------------------------------------------------------------
  // Workbook helpers
  // ------------------------------------------------------------------
  function currentSheet() {
    var wb = state.workbook;
    if (!wb || !Array.isArray(wb.sheets) || !wb.sheets.length) return null;
    var i = Math.max(0, Math.min(state.sheetIndex || 0, wb.sheets.length - 1));
    return wb.sheets[i] || null;
  }

  function buildCtxFallback(sheet) {
    if (!sheet) return null;
    var wb = state.workbook;
    var ctx = {
      sheetName: sheet.name || '',
      sheets: (wb && wb.sheets || []).map(function (s) { return s.name; }),
      headerRow: sheet.headerRow || 1,
      firstDataRow: sheet.firstDataRow || ((sheet.headerRow || 1) + 1),
      lastRow: sheet.lastRow || sheet.rowCount || 2,
      headers: Array.isArray(sheet.headers) ? sheet.headers : [],
      otherSheets: {},
      activeCell: null
    };
    (wb && wb.sheets || []).forEach(function (s) {
      if (s === sheet) return;
      ctx.otherSheets[s.name] = { headers: Array.isArray(s.headers) ? s.headers : [], headerRow: s.headerRow || 1, firstDataRow: s.firstDataRow || 2, lastRow: s.lastRow || s.rowCount || 2 };
    });
    return ctx;
  }

  function refreshContext() {
    var sheet = currentSheet();
    if (!sheet) { state.ctx = null; return; }
    var ctx = null;
    if (typeof sheet.toContext === 'function') ctx = quiet(function () { return sheet.toContext(); }, null);
    state.ctx = ctx || buildCtxFallback(sheet);
  }

  function firstEmptyColumn() {
    var ctx = state.ctx;
    var n = (ctx && Array.isArray(ctx.headers) ? ctx.headers.length : 0) + 1;
    var letters = EFS.util && EFS.util.columnLetter ? EFS.util.columnLetter(n) : String.fromCharCode(64 + n);
    return letters;
  }

  function defaultTarget(cand) {
    var ctx = state.ctx;
    var first = ctx ? (ctx.firstDataRow || 2) : 2;
    var last = ctx ? (ctx.lastRow || first) : first;
    var col = firstEmptyColumn();
    var tgt = cand && cand.target ? cand.target : null;
    var kind = tgt && tgt.kind === 'fill' ? 'fill' : 'cell';
    var cell = (tgt && tgt.cell) || (col + first);
    var fillRange = (tgt && tgt.fillRange) || (col + first + ':' + col + last);
    var anchorRow = first;
    if (tgt && tgt.fillRange && EFS.util && EFS.util.parseRange) {
      var pr = EFS.util.parseRange(tgt.fillRange);
      if (pr && pr.row) anchorRow = pr.row;
    }
    return { kind: kind, cell: String(cell).toUpperCase(), fillRange: String(fillRange).toUpperCase(), anchorRow: anchorRow };
  }

  function sheetRows(sheet, start, count) {
    if (!sheet) return [];
    if (typeof sheet.rows === 'function') {
      var r = quiet(function () { return sheet.rows(start, count); }, null);
      if (Array.isArray(r)) return r;
    }
    var out = [];
    var cols = Math.min(sheet.colCount || 26, PREVIEW_COLS);
    var letter = function (n) { return EFS.util && EFS.util.columnLetter ? EFS.util.columnLetter(n) : String.fromCharCode(64 + n); };
    for (var i = 0; i < count; i++) {
      var row = [];
      for (var c = 1; c <= cols; c++) {
        var cell = typeof sheet.getCell === 'function' ? quiet(function () { return sheet.getCell(letter(c) + (start + i)); }, null) : null;
        row.push(cell ? (cell.display != null ? cell.display : (cell.v != null ? String(cell.v) : '')) : '');
      }
      out.push(row);
    }
    return out;
  }

  function headerByCol(letter) {
    var ctx = state.ctx;
    if (!ctx || !Array.isArray(ctx.headers)) return null;
    for (var i = 0; i < ctx.headers.length; i++) if (ctx.headers[i].col === letter) return ctx.headers[i];
    return null;
  }

  var TYPE_GLYPH = { number: '#', text: 'Aa', date: '◷', bool: '✓', mixed: '±', empty: '·' };

  // ------------------------------------------------------------------
  // Prompt helpers
  // ------------------------------------------------------------------
  function insertIntoPrompt(text, silent) {
    var ta = $('prompt');
    if (!ta) return;
    text = String(text == null ? '' : text);
    var v = ta.value;
    var s = typeof ta.selectionStart === 'number' ? ta.selectionStart : v.length;
    var e = typeof ta.selectionEnd === 'number' ? ta.selectionEnd : s;
    var before = v.slice(0, s), after = v.slice(e);
    var pad1 = before && !/\s$/.test(before) ? ' ' : '';
    var pad2 = after && !/^\s/.test(after) ? ' ' : '';
    ta.value = before + pad1 + text + pad2 + after;
    var pos = (before + pad1 + text).length;
    try { ta.focus(); ta.setSelectionRange(pos, pos); } catch (ignored) { /* ignore */ }
    updateLangChip();
    if (!silent) toast(t('wb.inserted', { ref: text }), 'info', 1800);
  }
  ui.insertIntoPrompt = insertIntoPrompt;

  function setPrompt(text) {
    var ta = $('prompt');
    if (!ta) return;
    ta.value = String(text == null ? '' : text);
    updateLangChip();
  }

  var langChipTimer = null;
  function updateLangChip() {
    var chip = $('lang-chip'), ta = $('prompt');
    if (!chip || !ta) return;
    var text = ta.value.trim();
    if (!text) { show(chip, false); return; }
    var lang = has('normalize', 'detectLanguage') ? quiet(function () { return EFS.normalize.detectLanguage(text); }, null) : null;
    if (!lang) { show(chip, false); return; }
    chip.textContent = t('studio.detected') + ': ' + t('lang.' + lang);
    show(chip, true);
  }

  // ------------------------------------------------------------------
  // Generation
  // ------------------------------------------------------------------
  function generate(text) {
    var ta = $('prompt');
    text = String(text != null ? text : (ta ? ta.value : '')).trim();
    if (!text) { toast(t('studio.emptyPrompt'), 'warn'); return null; }
    if (ta && ta.value.trim() !== text) ta.value = text;
    updateLangChip();
    var btn = $('generate-btn');
    if (btn) btn.disabled = true;
    var res = guard(function () {
      return mod('generate').run(text, state.ctx, { dialect: state.dialect, uiLang: state.uiLang, style: state.style });
    }, 'err.generateFailed', null);
    if (btn) btn.disabled = false;
    if (!res) return null;
    if (!Array.isArray(res.candidates)) res.candidates = [];
    res.candidates.forEach(function (c, i) { if (c && c._uid == null) c._uid = 'c' + Date.now().toString(36) + i; });
    state.lastResult = res;
    state.activeIndex = 0;
    state.cardDialects = {};
    renderResult();
    var best = res.candidates[0] || null;
    if (res.kind !== 'empty') pushHistory(text, best ? (best.formulaEN || best.formula || '') : '');
    if (state.view !== 'studio') setView('studio');
    var resultNode = $('result');
    if (resultNode && resultNode.scrollIntoView && root.innerWidth < 800) quiet(function () { resultNode.scrollIntoView({ block: 'start', behavior: 'smooth' }); });
    return res;
  }
  ui.generate = generate;

  // ------------------------------------------------------------------
  // Result rendering
  // ------------------------------------------------------------------
  function renderResult() {
    var host = $('result');
    if (!host) return;
    clear(host);
    var res = state.lastResult;
    if (!res) {
      host.appendChild(el('div', { className: 'welcome' }, [icon('sparkles'), ' ', t('studio.welcome')]));
      renderMissingModulesNotice(host);
      return;
    }
    try {
      var message = res.message ? pick(res.message) : '';
      var cands = res.candidates || [];
      if (res.kind === 'empty' || (!cands.length && !(res.suggestions && res.suggestions.length))) {
        host.appendChild(el('div', { className: 'card' }, [
          el('div', { className: 'card-head' }, el('span', { className: 'card-title' }, [icon('info'), ' ', t('studio.result')])),
          el('p', { className: 'card-message', text: message || t('studio.noResult') })
        ]));
        return;
      }
      if (res.kind === 'help') {
        host.appendChild(el('div', { className: 'card' }, [
          el('div', { className: 'card-head' }, el('span', { className: 'card-title' }, [icon('book'), ' ', t('studio.helpKind')])),
          message ? el('p', { className: 'card-message', text: message }) : null
        ]));
        if (res.suggestions && res.suggestions.length) {
          var list = el('div', { className: 'suggest-list' });
          res.suggestions.slice(0, 6).forEach(function (entry, i) { list.appendChild(fnCard(entry, { open: i === 0 })); });
          host.appendChild(el('div', { className: 'card' }, [el('div', { className: 'subsection-title', text: t('studio.suggestions') }), list]));
        }
        cands.forEach(function (c, i) { host.appendChild(candidateCard(c, i, i === 0, { isTemplate: true })); });
        return;
      }
      if (res.kind === 'explain' || res.kind === 'translate') {
        if (message) host.appendChild(el('p', { className: 'card-message', text: message }));
        if (cands.length) cands.forEach(function (c, i) { host.appendChild(candidateCard(c, i, i === 0, { showTranslations: true, hideTarget: true, hideConfidence: true })); });
        else host.appendChild(explainTextCard(res.text));
        return;
      }
      // kind === 'formula'
      if (message) host.appendChild(el('p', { className: 'card-message', text: message }));
      var idx = Math.max(0, Math.min(state.activeIndex, cands.length - 1));
      var main = cands[idx];
      host.appendChild(candidateCard(main, idx, true, {}));
      var alts = alternativesFor(res, main);
      if (alts.length) host.appendChild(alternativesCard(alts));
    } catch (e) {
      reportError(e, 'err.renderFailed');
      host.appendChild(el('div', { className: 'error-box', text: t('err.renderFailed') }));
    }
  }

  function renderMissingModulesNotice(host) {
    var required = ['generate', 'intents', 'parser', 'catalog', 'ast', 'localize', 'formulaReader', 'explain', 'workbook', 'evaluator', 'normalize', 'lexicon'];
    var missing = required.filter(function (n) { return !EFS[n]; });
    if (!missing.length) return;
    host.appendChild(el('div', { className: 'info-box', text: t('toast.moduleMissing', { module: missing.join(', ') }) }));
  }

  /** Card used when generate returned an explain/translate kind without candidates: do it locally. */
  function explainTextCard(text) {
    var card = el('div', { className: 'card is-primary' });
    var formula = ensureEquals(text);
    var dialect = detectDialect(formula);
    card.appendChild(el('div', { className: 'card-head' }, [el('span', { className: 'card-title' }, [icon('book'), ' ', t('studio.explainKind')])]));
    card.appendChild(formulaBox(formula, dialect));
    var ex = has('explain', 'explainFormula') ? guard(function () { return EFS.explain.explainFormula(formula, state.uiLang, 'auto', explainCtx()); }, 'err.explainFailed', null) : null;
    if (ex) card.appendChild(explanationBlock(ex));
    card.appendChild(translationsBlock(formula, dialect));
    return card;
  }

  function detectDialect(formula) {
    var d = has('localize', 'detectDialect') ? quiet(function () { return EFS.localize.detectDialect(formula); }, null) : null;
    if (!d && has('formulaReader', 'detectDialect')) d = quiet(function () { return EFS.formulaReader.detectDialect(formula); }, null);
    return d || state.dialect;
  }

  function explainCtx() {
    var base = state.ctx || {};
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    out.dialect = state.dialect;
    out.uiLang = state.uiLang;
    return out;
  }

  function intentTitle(id) {
    if (!id || !has('intents')) return '';
    var list = quiet(function () { return EFS.intents.list; }, null);
    if (!Array.isArray(list)) return '';
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return pick(list[i].title);
    return '';
  }

  function tagBadges(cand) {
    var out = [];
    var tags = Array.isArray(cand.tags) ? cand.tags : [];
    tags.forEach(function (tag) {
      if (tag === '365') out.push(el('span', { className: 'badge badge-info', text: t('result.tag365') }));
      else if (tag === 'volatile') out.push(el('span', { className: 'badge badge-muted', text: t('result.tagVolatile') }));
      else if (tag === 'array') out.push(el('span', { className: 'badge badge-warn', text: t('result.tagArray') }));
    });
    return out;
  }

  function confidenceBlock(conf) {
    conf = typeof conf === 'number' ? Math.max(0, Math.min(1, conf)) : 0;
    var level = conf >= 0.8 ? 'high' : conf >= 0.5 ? 'medium' : 'low';
    var meter = el('div', { className: 'meter is-' + level, attrs: { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(conf * 100)) } }, el('span'));
    meter.firstChild.style.width = Math.round(conf * 100) + '%';
    var label = t('result.conf' + level.charAt(0).toUpperCase() + level.slice(1));
    return el('div', { className: 'confidence' }, [el('span', { text: t('result.confidence') + ':' }), meter, el('span', { text: label + ' (' + Math.round(conf * 100) + '%)' })]);
  }

  function bulletList(items, cls) {
    var ul = el('ul', { className: 'bullets' + (cls ? ' ' + cls : '') });
    items.forEach(function (it) { var s = pick(it); if (s) ul.appendChild(el('li', {}, el('span', { text: s }))); });
    return ul;
  }

  function missingBlock(cand) {
    var missing = Array.isArray(cand.missing) ? cand.missing : [];
    if (!missing.length) return null;
    var block = el('div', { className: 'missing-block' });
    block.appendChild(el('div', { className: 'subsection-title', text: t('result.missing') }));
    missing.forEach(function (m) {
      var q = pick(m);
      block.appendChild(el('div', { className: 'missing-q', text: q || (m.slot || '') }));
      var chips = el('div', { className: 'chips' });
      var options = Array.isArray(m.options) && m.options.length ? m.options : [];
      if (!options.length && state.ctx && Array.isArray(state.ctx.headers)) {
        options = state.ctx.headers.map(function (h) { return { label: h.name + ' (' + h.dataRange + ')', value: h.dataRange }; });
      }
      options.forEach(function (o) {
        var label = o && o.label != null ? String(o.label) : String(o && o.value != null ? o.value : o);
        var value = o && o.value != null ? String(o.value) : label;
        var b = el('button', { type: 'button', className: 'chip', text: label, title: value });
        b.addEventListener('click', function () {
          var base = (state.lastResult && state.lastResult.text) || ($('prompt') ? $('prompt').value : '');
          generate(String(base).trim() + ' ' + value);
        });
        chips.appendChild(b);
      });
      if (chips.children.length) block.appendChild(chips);
    });
    block.appendChild(el('p', { className: 'muted small', text: t('result.missingHint') }));
    return block;
  }

  function explanationBlock(ex) {
    if (!ex) return null;
    var wrap = el('div', { className: 'subsection' });
    if (ex.error) {
      wrap.appendChild(el('div', { className: 'error-box', text: t('explain.error') + ': ' + pick(ex.error) + (typeof ex.position === 'number' ? ' (' + t('explain.position', { n: ex.position }) + ')' : '') }));
      return wrap;
    }
    wrap.appendChild(el('div', { className: 'subsection-title', text: t('result.explanation') }));
    if (ex.summary) wrap.appendChild(el('p', { text: pick(ex.summary) }));
    if (Array.isArray(ex.steps) && ex.steps.length) {
      var steps = el('div', { className: 'steps' });
      ex.steps.forEach(function (s, i) {
        var body = el('div', { className: 'step-body' });
        if (s && s.formula) {
          var f = el('div', { className: 'step-formula' });
          highlightInto(f, String(s.formula), state.dialect);
          body.appendChild(f);
        }
        if (s && (s.text || typeof s === 'string')) body.appendChild(el('div', { className: 'step-text', text: typeof s === 'string' ? s : pick(s.text) }));
        steps.appendChild(el('div', { className: 'step' }, [el('span', { className: 'step-num', text: String(i + 1) }), body]));
      });
      wrap.appendChild(el('div', { className: 'subsection-title', text: t('result.steps') }));
      wrap.appendChild(steps);
    }
    if (Array.isArray(ex.functions) && ex.functions.length) {
      var ul = el('ul', { className: 'fn-used' });
      ex.functions.forEach(function (f) {
        if (!f) return;
        var local = f.local && f.local !== f.name ? f.local : '';
        ul.appendChild(el('li', {}, [
          el('span', { className: 'fn-name', text: f.name || '' }),
          el('span', { className: 'fn-local', text: local ? local + (f.syntax ? ' · ' + f.syntax : '') : (f.syntax || '') }),
          f.desc ? el('span', { className: 'fn-desc', text: pick(f.desc) }) : null
        ]));
      });
      wrap.appendChild(el('div', { className: 'subsection-title', text: t('result.functions') }));
      wrap.appendChild(ul);
    }
    if (Array.isArray(ex.tips) && ex.tips.length) {
      wrap.appendChild(el('div', { className: 'subsection-title', text: t('result.tips') }));
      wrap.appendChild(bulletList(ex.tips, 'is-tips'));
    }
    return wrap;
  }

  function translationsBlock(formula, fromDialect) {
    var wrap = el('div', { className: 'subsection' });
    wrap.appendChild(el('div', { className: 'subsection-title', text: t('result.translations') }));
    var rows = el('div', { className: 'translations' });
    var any = false;
    DIALECTS.forEach(function (d) {
      var txt = null;
      if (has('localize', 'translateFormula')) txt = quiet(function () { return EFS.localize.translateFormula(formula, fromDialect || 'auto', d); }, null);
      if (!txt) return;
      any = true;
      rows.appendChild(el('div', { className: 'translation-row' }, [el('span', { className: 'dialect-tag', text: d.toUpperCase() }), formulaBox(ensureEquals(txt), d, { compact: true })]));
    });
    if (!any) rows.appendChild(el('p', { className: 'muted small', text: has('localize') ? t('err.translateFailed') : t('toast.moduleMissing', { module: 'localize' }) }));
    wrap.appendChild(rows);
    return wrap;
  }

  function previewBlock(cand, target) {
    var wrap = el('div', { className: 'subsection' });
    wrap.appendChild(el('div', { className: 'subsection-title', text: t('result.preview') }));
    if (!state.workbook) { wrap.appendChild(el('p', { className: 'muted small', text: t('result.previewNoFile') })); return wrap; }
    if (!has('evaluator')) { wrap.appendChild(el('p', { className: 'muted small', text: t('toast.moduleMissing', { module: 'evaluator' }) })); return wrap; }
    var sheet = currentSheet();
    var fEN = cand.formulaEN || formulaFor(cand, 'en');
    var rows = null;
    try {
      if (target.kind === 'fill' && typeof EFS.evaluator.preview === 'function') {
        rows = EFS.evaluator.preview(fEN, sheet, state.workbook, { fillRange: target.fillRange, anchorRow: target.anchorRow, rows: EVAL_ROWS });
      } else if (typeof EFS.evaluator.evaluate === 'function') {
        var r = EFS.evaluator.evaluate(fEN, sheet, state.workbook);
        rows = [{ address: target.cell, formula: fEN, value: r ? r.value : null, error: r ? (r.supported === false ? 'unsupported' : r.error) : 'unsupported' }];
      }
    } catch (e) {
      wrap.appendChild(el('p', { className: 'muted small', text: t('err.previewFailed') + ': ' + (e && e.message || '') }));
      return wrap;
    }
    if (!Array.isArray(rows) || !rows.length) { wrap.appendChild(el('p', { className: 'muted small', text: t('result.previewUnsupported') })); return wrap; }
    var table = el('table', { className: 'preview-table' });
    table.appendChild(el('thead', {}, el('tr', {}, [el('th', { text: t('result.address') }), el('th', { text: t('result.value') })])));
    var tbody = el('tbody');
    var unsupported = false;
    rows.slice(0, EVAL_ROWS).forEach(function (row) {
      var v = row ? row.value : null;
      var err = row ? row.error : null;
      var cls = 'val', txt;
      if (err === 'unsupported' || (row && row.supported === false)) { txt = t('common.dash'); cls += ' is-na'; unsupported = true; }
      else if (err) { txt = String(err); cls += ' is-error'; }
      else if (v == null || v === '') { txt = t('common.dash'); cls += ' is-na'; }
      else txt = formatValue(v);
      tbody.appendChild(el('tr', {}, [el('td', { className: 'addr', text: row && row.address ? row.address : '' }), el('td', { className: cls, text: txt })]));
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    wrap.appendChild(el('p', { className: 'muted small', text: unsupported ? t('result.previewUnsupported') : t('result.previewNote') }));
    return wrap;
  }

  function formatValue(v) {
    if (v instanceof Date) return isNaN(v.getTime()) ? String(v) : v.toISOString().slice(0, 10);
    if (typeof v === 'number') {
      if (!isFinite(v)) return String(v);
      var r = Math.round(v * 1e6) / 1e6;
      return String(r);
    }
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (Array.isArray(v)) return v.map(function (row) { return Array.isArray(row) ? row.map(formatValue).join(' | ') : formatValue(row); }).join(' ; ');
    if (v && typeof v === 'object') return v.result != null ? formatValue(v.result) : (v.error || JSON.stringify(v));
    return String(v);
  }

  function targetBlock(cand, cardIndex, target, onChange) {
    var box = el('div', { className: 'target-box' });
    box.appendChild(el('div', { className: 'subsection-title', text: t('result.target') }));
    var name = 'target-' + cardIndex + '-' + Math.random().toString(36).slice(2, 7);
    var cellInput = el('input', { type: 'text', value: target.cell, attrs: { 'aria-label': t('result.targetCell'), spellcheck: 'false' } });
    var rangeInput = el('input', { type: 'text', value: target.fillRange, attrs: { 'aria-label': t('result.fillRange'), spellcheck: 'false' } });
    var headerInput = el('input', { type: 'text', className: 'header-input', placeholder: t('result.headerPlaceholder'), attrs: { 'aria-label': t('result.header') } });
    var rCell = el('input', { type: 'radio', attrs: { name: name, value: 'cell' } });
    var rFill = el('input', { type: 'radio', attrs: { name: name, value: 'fill' } });
    rCell.checked = target.kind === 'cell';
    rFill.checked = target.kind === 'fill';
    var sync = function () {
      cellInput.disabled = !rCell.checked;
      rangeInput.disabled = !rFill.checked;
      target.kind = rFill.checked ? 'fill' : 'cell';
      target.cell = cellInput.value.trim().toUpperCase();
      target.fillRange = rangeInput.value.trim().toUpperCase();
      if (onChange) onChange(target);
    };
    [rCell, rFill].forEach(function (r) { r.addEventListener('change', sync); });
    [cellInput, rangeInput].forEach(function (i) { i.addEventListener('change', sync); });
    box.appendChild(el('div', { className: 'target-row' }, [
      el('label', {}, [rCell, el('span', { text: t('result.targetCell') })]), cellInput
    ]));
    box.appendChild(el('div', { className: 'target-row' }, [
      el('label', {}, [rFill, el('span', { text: t('result.targetFill') })]), rangeInput
    ]));
    box.appendChild(el('div', { className: 'target-row' }, [el('span', { className: 'muted small', text: t('result.header') + ':' }), headerInput]));
    var applyBtn = el('button', { type: 'button', className: 'btn btn-primary btn-sm', title: t('result.applyTitle'), attrs: { 'data-testid': 'apply' } }, [icon('check'), el('span', { text: t('result.apply') })]);
    var dlBtn = el('button', { type: 'button', className: 'btn btn-sm', disabled: !state.modified, title: t('wb.downloadTitle') }, [icon('download'), el('span', { text: t('wb.download') })]);
    applyBtn.addEventListener('click', function () {
      sync();
      var ok = applyCandidate(cand, target, headerInput.value.trim());
      if (ok) dlBtn.disabled = false;
    });
    dlBtn.addEventListener('click', downloadWorkbook);
    box.appendChild(el('div', { className: 'target-actions' }, [applyBtn, dlBtn]));
    cellInput.disabled = !rCell.checked;
    rangeInput.disabled = !rFill.checked;
    return box;
  }

  function applyCandidate(cand, target, header) {
    if (!state.workbook) { toast(t('toast.noWorkbook'), 'warn'); return false; }
    var fEN = cand.formulaEN || formulaFor(cand, 'en');
    if (!fEN) { toast(t('toast.nothingToApply'), 'warn'); return false; }
    var util = EFS.util || {};
    var tgt;
    if (target.kind === 'fill') {
      var pr = util.parseRange ? util.parseRange(target.fillRange) : null;
      if (!pr || !pr.row || !pr.col) { toast(t('toast.invalidTarget'), 'warn'); return false; }
      tgt = { fillRange: target.fillRange, anchorRow: target.anchorRow || pr.row };
    } else {
      var sa = util.splitAddress ? util.splitAddress(target.cell) : null;
      if (!sa) { toast(t('toast.invalidTarget'), 'warn'); return false; }
      tgt = { cell: target.cell };
    }
    var res = guard(function () {
      return mod('workbook').applyFormula(state.workbook, state.sheetIndex, tgt, fEN, header ? { header: header } : {});
    }, 'err.applyFailed', null);
    if (!res) return false;
    var n = typeof res.count === 'number' ? res.count : (Array.isArray(res.written) ? res.written.length : 1);
    state.modified = true;
    toast(t('toast.applied', { n: n }), 'success');
    var dl = $('download-btn');
    if (dl) dl.disabled = false;
    show($('file-modified'), true);
    refreshContext();
    renderGrid();
    return true;
  }

  function baseName(name) {
    var s = String(name || 'workbook');
    var i = s.lastIndexOf('.');
    return i > 0 ? s.slice(0, i) : s;
  }

  function fallbackDownload(blob, name) {
    var url = root.URL.createObjectURL(blob);
    var a = el('a', { attrs: { href: url, download: name } });
    doc.body.appendChild(a);
    a.click();
    root.setTimeout(function () { doc.body.removeChild(a); root.URL.revokeObjectURL(url); }, 1000);
  }

  function downloadWorkbook() {
    if (!state.workbook) { toast(t('toast.noWorkbook'), 'warn'); return; }
    var name = baseName(state.fileName || state.workbook.name) + '-formulas.xlsx';
    var wbm;
    try { wbm = mod('workbook'); } catch (e) { reportError(e); return; }
    var p = guard(function () { return wbm.exportBlob(state.workbook); }, 'toast.exportFailed', null);
    if (!p) return;
    Promise.resolve(p).then(function (blob) {
      if (!blob) throw new Error('empty');
      if (typeof wbm.download === 'function') wbm.download(blob, name); else fallbackDownload(blob, name);
      toast(t('toast.downloaded', { name: name }), 'success');
    }, function (e) {
      toast(t('toast.exportFailed', { message: e && e.message || '' }), 'danger');
    });
  }
  ui.downloadWorkbook = downloadWorkbook;

  function alternativesFor(res, main) {
    var out = [];
    (res.candidates || []).forEach(function (c, i) { if (c && c !== main) out.push({ cand: c, index: i }); });
    if (main && Array.isArray(main.alternatives)) {
      main.alternatives.forEach(function (c) {
        if (!c) return;
        var dup = (res.candidates || []).some(function (x) { return x === c || (x && c && x.formulaEN && x.formulaEN === c.formulaEN); });
        if (!dup) out.push({ cand: c, nested: true });
      });
    }
    return out.slice(0, 6);
  }

  function alternativesCard(alts) {
    var card = el('div', { className: 'card' });
    card.appendChild(el('div', { className: 'card-head' }, el('span', { className: 'card-title', text: t('result.alternatives') })));
    var list = el('div', { className: 'alt-list' });
    alts.forEach(function (a) {
      var c = a.cand;
      var f = formulaFor(c, state.dialect);
      var fbox = el('div', { className: 'alt-formula' });
      highlightInto(fbox, f, state.dialect);
      var meta = el('div', { className: 'alt-meta' }, [
        el('span', { text: intentTitle(c.intent) || (c.intent || '') }),
        typeof c.confidence === 'number' ? el('span', { text: Math.round(c.confidence * 100) + '%' }) : null
      ].concat(tagBadges(c)));
      var btn = el('button', { type: 'button', className: 'alt-item', title: t('result.promote') }, [fbox, el('div', { className: 'alt-text', text: pick(c.explain) }), meta]);
      btn.addEventListener('click', function () {
        var res = state.lastResult;
        if (!res) return;
        if (a.nested) {
          if (c._uid == null) c._uid = 'n' + Date.now().toString(36);
          res.candidates.unshift(c);
          state.activeIndex = 0;
        } else state.activeIndex = a.index;
        renderResult();
      });
      list.appendChild(btn);
    });
    card.appendChild(list);
    return card;
  }

  /** The main result card for a candidate. */
  function candidateCard(cand, index, isPrimary, opts) {
    opts = opts || {};
    var card = el('div', { className: 'card' + (isPrimary ? ' is-primary' : '') });
    if (!cand) return card;
    var key = cand._uid || ('i' + index);
    var dialect = state.cardDialects[key] || state.dialect;

    var head = el('div', { className: 'card-head' });
    var titleText = opts.isTemplate ? t('lib.insert') : (intentTitle(cand.intent) || t('result.formula'));
    head.appendChild(el('span', { className: 'card-title' }, [icon('sparkles'), ' ', titleText]));
    var meta = el('div', { className: 'card-meta' }, tagBadges(cand));
    var box;
    meta.appendChild(dialectPills(dialect, function (d) {
      state.cardDialects[key] = d;
      var f = formulaFor(cand, d);
      box.setAttribute('data-formula', f);
      var tools = box.querySelector('.formula-tools');
      clear(box);
      highlightInto(box, f, d);
      if (tools) box.appendChild(tools);
    }));
    head.appendChild(meta);
    card.appendChild(head);

    var formula = formulaFor(cand, dialect);
    box = formulaBox(formula, dialect);
    card.appendChild(box);

    if (!opts.hideConfidence && typeof cand.confidence === 'number') card.appendChild(confidenceBlock(cand.confidence));
    var sentence = pick(cand.explain);
    if (sentence) card.appendChild(el('p', { className: 'card-message', text: sentence }));

    if (Array.isArray(cand.assumptions) && cand.assumptions.length) {
      card.appendChild(el('div', { className: 'subsection' }, [el('div', { className: 'subsection-title', text: t('result.assumptions') }), bulletList(cand.assumptions)]));
    }
    var miss = missingBlock(cand);
    if (miss) card.appendChild(miss);

    var ex = cand.explanation || null;
    if (!ex && cand.ast && has('explain', 'explainAST')) ex = quiet(function () { return EFS.explain.explainAST(cand.ast, state.uiLang, explainCtx()); }, null);
    if (!ex && !cand.ast && has('explain', 'explainFormula')) ex = quiet(function () { return EFS.explain.explainFormula(cand.formulaEN || cand.formula, state.uiLang, cand.formulaEN ? 'en' : 'auto', explainCtx()); }, null);
    var exBlock = explanationBlock(ex);
    if (exBlock) card.appendChild(exBlock);

    if (opts.showTranslations) card.appendChild(translationsBlock(cand.formulaEN || formula, cand.formulaEN ? 'en' : 'auto'));

    if (!opts.hideTarget && !opts.isTemplate) {
      var target = defaultTarget(cand);
      var previewHost = el('div');
      var renderPreview = function () { clear(previewHost); previewHost.appendChild(previewBlock(cand, target)); };
      renderPreview();
      card.appendChild(previewHost);
      if (state.workbook) card.appendChild(targetBlock(cand, index, target, renderPreview));
    }
    return card;
  }

  // ------------------------------------------------------------------
  // History
  // ------------------------------------------------------------------
  function loadHistory() {
    var h = store.get(KEYS.history, []);
    state.history = Array.isArray(h) ? h.filter(function (x) { return x && typeof x.text === 'string'; }).slice(0, HISTORY_MAX) : [];
  }
  function pushHistory(text, formula) {
    state.history = state.history.filter(function (h) { return h.text !== text; });
    state.history.unshift({ text: text, formula: formula || '', ts: Date.now() });
    state.history = state.history.slice(0, HISTORY_MAX);
    store.set(KEYS.history, state.history);
    renderHistory();
  }
  function clearHistory() {
    state.history = [];
    store.remove(KEYS.history);
    renderHistory();
    toast(t('history.cleared'), 'info', 1800);
  }
  function timeLabel(ts) {
    var d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    var hh = String(d.getHours()); if (hh.length < 2) hh = '0' + hh;
    var mm = String(d.getMinutes()); if (mm.length < 2) mm = '0' + mm;
    var today = new Date();
    var sameDay = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
    if (sameDay) return hh + ':' + mm;
    var dd = String(d.getDate()); if (dd.length < 2) dd = '0' + dd;
    var mo = String(d.getMonth() + 1); if (mo.length < 2) mo = '0' + mo;
    return dd + '.' + mo + ' ' + hh + ':' + mm;
  }
  function renderHistory() {
    var list = $('history-list');
    if (!list) return;
    clear(list);
    if (!state.history.length) { list.appendChild(el('li', { className: 'history-empty', text: t('history.empty') })); return; }
    state.history.forEach(function (h) {
      var btn = el('button', { type: 'button', className: 'history-item', title: h.text }, [
        el('span', { className: 'history-text', text: h.text }),
        el('span', { className: 'history-time', text: timeLabel(h.ts) }),
        h.formula ? el('span', { className: 'history-formula', text: ensureEquals(h.formula) }) : null
      ]);
      btn.addEventListener('click', function () { setPrompt(h.text); generate(h.text); });
      list.appendChild(el('li', {}, btn));
    });
  }

  // ------------------------------------------------------------------
  // Examples
  // ------------------------------------------------------------------
  function allExamples() {
    var out = [];
    if (!has('intents')) return out;
    var list = quiet(function () { return EFS.intents.list; }, null);
    if (!Array.isArray(list)) return out;
    list.forEach(function (it) {
      if (!it || !it.examples) return;
      var arr = it.examples[state.uiLang] || it.examples.en || it.examples.tr || it.examples.ru || [];
      if (!Array.isArray(arr)) arr = [arr];
      arr.forEach(function (ex) { if (typeof ex === 'string' && ex.trim()) out.push(ex.trim()); });
    });
    return out;
  }
  function renderExamples() {
    var host = $('examples');
    if (!host) return;
    clear(host);
    var all = allExamples();
    show($('examples-wrap'), all.length > 0);
    if (!all.length) return;
    var n = Math.min(6, all.length);
    var start = (state.exampleSeed * n) % all.length;
    var chosen = [];
    for (var i = 0; i < n; i++) chosen.push(all[(start + i) % all.length]);
    chosen.forEach(function (ex) {
      var b = el('button', { type: 'button', className: 'chip chip-ellipsis', text: ex, title: ex });
      b.addEventListener('click', function () { setPrompt(ex); generate(ex); });
      host.appendChild(b);
    });
  }

  // ------------------------------------------------------------------
  // Workbook panel
  // ------------------------------------------------------------------
  function acceptedFile(name) {
    return /\.(xlsx|xlsm|xls|csv|ods)$/i.test(String(name || ''));
  }

  function loadFile(file) {
    if (!file) return;
    if (!acceptedFile(file.name)) { toast(t('toast.unsupported'), 'warn'); return; }
    var dz = $('dropzone');
    if (dz) dz.classList.add('is-busy');
    var textNode = dz ? dz.querySelector('.dropzone-text') : null;
    if (textNode) textNode.textContent = t('wb.loading');
    var finish = function () {
      if (dz) dz.classList.remove('is-busy');
      if (textNode) textNode.textContent = t('wb.drop');
    };
    var p;
    try { p = mod('workbook').load(file, file.name); } catch (e) { finish(); reportError(e, 'err.loadFailed'); return; }
    Promise.resolve(p).then(function (wb) {
      finish();
      if (!wb || !Array.isArray(wb.sheets) || !wb.sheets.length) { toast(t('wb.noSheets'), 'warn'); return; }
      state.workbook = wb;
      state.fileName = file.name;
      state.sheetIndex = typeof wb.activeIndex === 'number' ? wb.activeIndex : 0;
      state.modified = false;
      refreshContext();
      renderWorkbook();
      toast(t('toast.fileLoaded', { name: file.name }), 'success');
      var sheet = currentSheet();
      if (sheet && sheet.headerRow && sheet.headerRow !== 1) toast(t('wb.headerDetected', { n: sheet.headerRow }), 'info');
      if (state.lastResult) renderResult();
    }, function (e) {
      finish();
      if (e && e.moduleMissing) reportError(e);
      else toast(t('toast.parseError', { message: e && e.message || String(e) }), 'danger');
    });
  }
  ui.loadFile = loadFile;

  function clearWorkbook() {
    state.workbook = null;
    state.ctx = null;
    state.fileName = '';
    state.modified = false;
    state.sheetIndex = 0;
    renderWorkbook();
    if (state.lastResult) renderResult();
  }

  function renderWorkbook() {
    var wb = state.workbook;
    var loaded = !!wb;
    show($('wb-empty'), !loaded);
    show($('file-info'), loaded);
    show($('sheet-tabs'), loaded);
    show($('wb-toolbar'), loaded);
    show($('grid-wrap'), loaded);
    show($('grid-hint'), loaded);
    var dl = $('download-btn');
    if (dl) dl.disabled = !(loaded && state.modified);
    show($('file-modified'), loaded && state.modified);
    if (!loaded) { show($('wb-warnings'), false); clear($('grid')); return; }
    var nameNode = $('file-name');
    if (nameNode) { nameNode.textContent = state.fileName || wb.name || ''; nameNode.title = nameNode.textContent; }
    var engine = $('file-engine');
    if (engine) engine.textContent = wb.engine === 'sheetjs' ? t('wb.engineSheetjs') : t('wb.engineExceljs');
    renderSheetTabs();
    renderToolbar();
    renderGrid();
    renderWarnings();
  }

  function renderSheetTabs() {
    var host = $('sheet-tabs');
    var wb = state.workbook;
    if (!host || !wb) return;
    clear(host);
    wb.sheets.forEach(function (s, i) {
      var b = el('button', { type: 'button', className: i === state.sheetIndex ? 'is-active' : '', text: s.name || (t('wb.sheet') + ' ' + (i + 1)), title: s.name || '', attrs: { role: 'tab', 'aria-selected': i === state.sheetIndex ? 'true' : 'false' } });
      b.addEventListener('click', function () {
        state.sheetIndex = i;
        if (wb) wb.activeIndex = i;
        refreshContext();
        renderSheetTabs();
        renderToolbar();
        renderGrid();
        if (state.lastResult) renderResult();
      });
      host.appendChild(b);
    });
  }

  function renderToolbar() {
    var sel = $('header-row-select');
    var sheet = currentSheet();
    if (!sel || !sheet) return;
    clear(sel);
    var current = sheet.headerRow || 1;
    var max = Math.max(30, current);
    for (var i = 1; i <= max; i++) sel.appendChild(el('option', { value: String(i), text: String(i) }));
    sel.value = String(current);
    var dims = $('wb-dims');
    if (dims) dims.textContent = t('wb.rows', { n: sheet.rowCount || sheet.lastRow || 0 }) + ' · ' + t('wb.cols', { n: sheet.colCount || (sheet.headers ? sheet.headers.length : 0) });
  }

  function setHeaderRow(n) {
    var sheet = currentSheet();
    if (!sheet) return;
    n = parseInt(n, 10);
    if (!(n >= 1)) return;
    guard(function () {
      if (typeof sheet.setHeaderRow === 'function') { sheet.setHeaderRow(n); return; }
      sheet.headerRow = n;
      sheet.firstDataRow = n + 1;
      var wbm = EFS.workbook;
      if (wbm && typeof wbm.rebuildHeaders === 'function') wbm.rebuildHeaders(sheet);
      else if (wbm && typeof wbm.buildHeaders === 'function') sheet.headers = wbm.buildHeaders(sheet, n) || sheet.headers;
      else if (typeof sheet.rebuildHeaders === 'function') sheet.rebuildHeaders();
      else rebuildHeadersFallback(sheet);
    }, 'err.loadFailed');
    refreshContext();
    renderToolbar();
    renderGrid();
    if (state.lastResult) renderResult();
  }

  /** Last-resort header rebuild from the preview grid when the workbook module offers no API. */
  function rebuildHeadersFallback(sheet) {
    var row = sheetRows(sheet, sheet.headerRow, 1)[0] || [];
    var letter = function (n) { return EFS.util && EFS.util.columnLetter ? EFS.util.columnLetter(n) : String.fromCharCode(64 + n); };
    var first = sheet.headerRow + 1, last = sheet.lastRow || sheet.rowCount || first;
    var headers = [];
    row.forEach(function (v, i) {
      var name = String(v == null ? '' : v).trim();
      if (!name) return;
      var L = letter(i + 1);
      headers.push({ name: name, col: L, index: i + 1, type: 'mixed', dataRange: L + first + ':' + L + last, range: L + sheet.headerRow + ':' + L + last, sample: [] });
    });
    sheet.headers = headers;
  }

  function renderGrid() {
    var table = $('grid');
    var sheet = currentSheet();
    if (!table) return;
    clear(table);
    if (!sheet) return;
    var ctx = state.ctx;
    var headerRow = sheet.headerRow || (ctx && ctx.headerRow) || 1;
    var rows = sheetRows(sheet, 1, PREVIEW_ROWS);
    var colCount = 0;
    rows.forEach(function (r) { if (Array.isArray(r) && r.length > colCount) colCount = r.length; });
    colCount = Math.max(1, Math.min(Math.max(colCount, sheet.colCount || 0), PREVIEW_COLS));
    var letter = function (n) { return EFS.util && EFS.util.columnLetter ? EFS.util.columnLetter(n) : String.fromCharCode(64 + n); };
    var firstData = (ctx && ctx.firstDataRow) || sheet.firstDataRow || headerRow + 1;
    var lastRow = (ctx && ctx.lastRow) || sheet.lastRow || sheet.rowCount || firstData;

    var thead = el('thead');
    var htr = el('tr');
    htr.appendChild(el('th', { className: 'rownum', text: '' }));
    for (var c = 1; c <= colCount; c++) {
      (function (c) {
        var L = letter(c);
        var h = headerByCol(L);
        var range = h && h.dataRange ? h.dataRange : (L + firstData + ':' + L + lastRow);
        var th = el('th', { text: L, title: range, attrs: { scope: 'col' } });
        th.addEventListener('click', function () { insertIntoPrompt(range); });
        htr.appendChild(th);
      })(c);
    }
    thead.appendChild(htr);
    table.appendChild(thead);

    var tbody = el('tbody');
    rows.forEach(function (r, i) {
      var rowNum = i + 1;
      var isHeader = rowNum === headerRow;
      var tr = el('tr', { className: isHeader ? 'is-header' : '' });
      tr.appendChild(el('td', { className: 'rownum', text: String(rowNum) }));
      for (var c = 1; c <= colCount; c++) {
        (function (c) {
          var raw = Array.isArray(r) && r[c - 1] != null ? r[c - 1] : '';
          var txt = typeof raw === 'object' && raw !== null ? (raw.display != null ? raw.display : (raw.v != null ? String(raw.v) : '')) : String(raw);
          var isFormula = typeof raw === 'object' && raw !== null && raw.f;
          var td = el('td', { text: txt === '' ? '' : txt });
          if (txt === '') td.classList.add('is-empty');
          else if (!isHeader && /^-?[\d.,\s]+%?$/.test(txt)) td.classList.add('is-num');
          if (isFormula) td.classList.add('is-formula');
          if (txt.length > 40) td.title = txt;
          if (isHeader) {
            var h = headerByCol(letter(c));
            var name = (h && h.name) || txt;
            if (h && h.type && TYPE_GLYPH[h.type]) td.appendChild(el('span', { className: 'type-glyph', text: TYPE_GLYPH[h.type], title: t('type.' + h.type) }));
            if (name) {
              td.title = name;
              td.addEventListener('click', function () { insertIntoPrompt(name); });
            }
          }
          tr.appendChild(td);
        })(c);
      }
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
  }

  function renderWarnings() {
    var host = $('wb-warnings');
    var wb = state.workbook;
    if (!host) return;
    clear(host);
    if (!wb) { show(host, false); return; }
    var list = Array.isArray(wb.warnings) ? wb.warnings.slice() : [];
    // generic "styles not preserved" note, unless the loader already explained the fallback itself
    if (wb.engine === 'sheetjs' && !list.length) list.push({ tr: t('wb.stylesWarning'), ru: t('wb.stylesWarning'), en: t('wb.stylesWarning') });
    list.forEach(function (w) {
      var s = pick(w);
      if (s) host.appendChild(el('li', {}, [icon('warning'), el('span', { text: s })]));
    });
    show(host, host.children.length > 0);
  }

  // ------------------------------------------------------------------
  // Library: functions
  // ------------------------------------------------------------------
  function categoryLabel(id) {
    if (has('catalog', 'categoryLabel')) return quiet(function () { return EFS.catalog.categoryLabel(id, state.uiLang); }, id) || id;
    return id;
  }

  function templateFor(entry, dialect) {
    dialect = dialect || state.dialect;
    var name = has('catalog', 'localName') ? quiet(function () { return EFS.catalog.localName(entry, dialect); }, entry.name) : (entry[dialect] || entry.name);
    var sep = dialect === 'en' ? ', ' : '; ';
    var args = Array.isArray(entry.args) ? entry.args : [];
    var parts = args.map(function (a) {
      var n = (dialect !== 'en' && a[dialect]) ? a[dialect] : a.name;
      return a.optional ? '[' + n + ']' : n;
    });
    return '=' + name + '(' + parts.join(sep) + ')';
  }

  function fnCard(entry, opts) {
    opts = opts || {};
    var details = el('details', { className: 'fn-card' });
    if (opts.open) details.open = true;
    var summary = el('summary');
    var locals = [];
    if (entry.tr && entry.tr !== entry.name) locals.push('TR ' + entry.tr);
    if (entry.ru && entry.ru !== entry.name) locals.push('RU ' + entry.ru);
    summary.appendChild(el('div', { className: 'fn-title' }, [
      el('span', { className: 'fn-en', text: entry.name }),
      locals.length ? el('span', { className: 'fn-locals', text: locals.join(' · ') }) : null
    ]));
    summary.appendChild(el('span', { className: 'fn-cat', text: categoryLabel(entry.category) }));
    summary.appendChild(el('span', { className: 'fn-short', text: pick(entry.desc) }));
    details.appendChild(summary);

    var body = el('div', { className: 'fn-body' });
    var tags = el('div', { className: 'fn-tags' });
    var mv = entry.minVersion ? String(entry.minVersion) : '';
    if (mv === '2021' || mv === '365') tags.appendChild(el('span', { className: 'badge badge-info', text: t('result.tag365') }));
    else if (mv) tags.appendChild(el('span', { className: 'badge badge-muted', text: t('lib.minVersion', { v: mv }) }));
    if (entry.volatile) tags.appendChild(el('span', { className: 'badge badge-muted', text: t('lib.volatile') }));
    if (Array.isArray(entry.uncertain) && entry.uncertain.length) tags.appendChild(el('span', { className: 'badge badge-warn', text: t('lib.uncertain') + ' (' + entry.uncertain.join(', ').toUpperCase() + ')' }));
    if (tags.children.length) body.appendChild(tags);

    body.appendChild(el('div', { className: 'subsection-title', text: t('lib.names') }));
    body.appendChild(el('div', { className: 'muted small', text: 'EN ' + entry.name + ' · TR ' + (entry.tr || entry.name) + ' · RU ' + (entry.ru || entry.name) }));

    if (entry.syntax) {
      body.appendChild(el('div', { className: 'subsection-title', text: t('lib.syntax') }));
      var syn = el('div', { className: 'fn-syntax' });
      var localSyntax = entry.syntax;
      if (state.dialect !== 'en') {
        var localName = has('catalog', 'localName') ? quiet(function () { return EFS.catalog.localName(entry, state.dialect); }, entry.name) : entry.name;
        localSyntax = String(entry.syntax).replace(entry.name, localName).replace(/,\s*/g, '; ');
      }
      highlightInto(syn, localSyntax, state.dialect);
      body.appendChild(syn);
    }
    if (Array.isArray(entry.args) && entry.args.length) {
      body.appendChild(el('div', { className: 'subsection-title', text: t('lib.args') }));
      var table = el('table', { className: 'args-table' });
      table.appendChild(el('thead', {}, el('tr', {}, [el('th', { text: t('lib.argName') }), el('th', { text: '' }), el('th', { text: t('lib.argDesc') })])));
      var tb = el('tbody');
      entry.args.forEach(function (a) {
        var local = (state.uiLang !== 'en' && a[state.uiLang] && a[state.uiLang] !== a.name) ? a[state.uiLang] : '';
        var nameCell = el('td', { className: 'arg-name', text: a.name || '' });
        if (local) nameCell.appendChild(el('small', { text: local }));
        tb.appendChild(el('tr', {}, [nameCell, el('td', { className: 'arg-opt', text: a.optional ? t('lib.optional') : t('lib.required') }), el('td', { text: pick(a.desc) })]));
      });
      table.appendChild(tb);
      body.appendChild(table);
    }
    if (entry.example && entry.example.formula) {
      body.appendChild(el('div', { className: 'subsection-title', text: t('lib.example') }));
      var exFormula = ensureEquals(entry.example.formula);
      if (state.dialect !== 'en' && has('localize', 'translateFormula')) exFormula = quiet(function () { return ensureEquals(EFS.localize.translateFormula(exFormula, 'en', state.dialect)); }, exFormula);
      body.appendChild(el('div', { className: 'fn-example' }, [formulaBox(exFormula, state.dialect, { compact: true }), el('span', { text: pick(entry.example) })]));
    }
    var insertBtn = el('button', { type: 'button', className: 'btn btn-sm' }, [icon('plus'), el('span', { text: t('lib.insert') })]);
    insertBtn.addEventListener('click', function () {
      insertIntoPrompt(templateFor(entry, state.dialect), true);
      toast(t('lib.inserted'), 'success', 1800);
      if (root.innerWidth < 800) setView('studio');
      else if (doc.body.classList.contains('lib-open')) toggleLibrary(false);
    });
    body.appendChild(el('div', { className: 'row-actions' }, insertBtn));
    details.appendChild(body);
    return details;
  }

  function renderFnCats() {
    var host = $('fn-cats');
    if (!host) return;
    clear(host);
    var cats = has('catalog') ? quiet(function () { return EFS.catalog.categories; }, []) : [];
    var mk = function (id, label) {
      var b = el('button', { type: 'button', className: 'chip' + (state.fnCat === id ? ' is-active' : ''), text: label, dataset: { cat: id } });
      b.addEventListener('click', function () { state.fnCat = id; state.fnShown = 40; setActive(host, 'cat', id); renderFnList(); });
      return b;
    };
    host.appendChild(mk('all', t('lib.all')));
    (cats || []).forEach(function (c) { host.appendChild(mk(c.id, c[state.uiLang] || c.en || c.id)); });
  }

  function renderFnList() {
    var host = $('fn-list'), more = $('fn-more'), count = $('fn-count');
    if (!host) return;
    clear(host);
    if (!has('catalog')) {
      host.appendChild(el('div', { className: 'info-box', text: t('toast.moduleMissing', { module: 'catalog' }) }));
      show(more, false);
      if (count) count.textContent = '';
      return;
    }
    var list = guard(function () {
      var q = state.fnQuery.trim();
      var arr = q ? EFS.catalog.search(q, state.uiLang, 400) : EFS.catalog.list;
      return Array.isArray(arr) ? arr : [];
    }, 'err.libraryFailed', []);
    if (state.fnCat !== 'all') list = list.filter(function (e) { return e.category === state.fnCat; });
    if (count) count.textContent = t('lib.count', { n: list.length });
    if (!list.length) { host.appendChild(el('p', { className: 'muted small', text: t('lib.noResults') })); show(more, false); return; }
    var shown = list.slice(0, state.fnShown);
    var frag = doc.createDocumentFragment();
    shown.forEach(function (e, i) { frag.appendChild(fnCard(e, { open: !!state.fnQuery.trim() && i === 0 && list.length <= 3 })); });
    host.appendChild(frag);
    var rest = list.length - shown.length;
    if (rest > 0) {
      more.textContent = t('lib.showMore', { n: Math.min(rest, 40) });
      show(more, true);
      more.onclick = function () { state.fnShown += 40; renderFnList(); };
    } else show(more, false);
  }

  // ------------------------------------------------------------------
  // Library: explain / translate
  // ------------------------------------------------------------------
  function exRun(mode) {
    var input = $('ex-input'), out = $('ex-output');
    if (!input || !out) return;
    var text = input.value.trim();
    clear(out);
    if (!text) { toast(t('explain.empty'), 'warn'); return; }
    var formula = ensureEquals(text);
    var dialect = detectDialect(formula);
    var wrap = el('div', { className: 'ex-result' });
    wrap.appendChild(el('div', { className: 'chips' }, el('span', { className: 'chip chip-lang', text: t('explain.detected') + ': ' + dialect.toUpperCase() })));
    wrap.appendChild(formulaBox(formula, dialect));
    if (mode === 'explain') {
      var ex = null;
      if (has('explain', 'explainFormula')) ex = guard(function () { return EFS.explain.explainFormula(formula, state.uiLang, 'auto', explainCtx()); }, 'err.explainFailed', null);
      else toast(t('toast.moduleMissing', { module: 'explain' }), 'danger');
      var block = explanationBlock(ex);
      if (block) wrap.appendChild(block);
      else if (!ex) wrap.appendChild(el('div', { className: 'error-box', text: has('explain') ? t('err.explainFailed') : t('toast.moduleMissing', { module: 'explain' }) }));
    }
    if (mode === 'translate' || mode === 'explain') wrap.appendChild(translationsBlock(formula, 'auto'));
    out.appendChild(wrap);
  }

  // ------------------------------------------------------------------
  // Library: recipes
  // ------------------------------------------------------------------
  function renderRecipes() {
    var host = $('recipes-list');
    if (!host) return;
    clear(host);
    if (!has('intents')) { host.appendChild(el('div', { className: 'info-box', text: t('toast.moduleMissing', { module: 'intents' }) })); return; }
    var list = quiet(function () { return EFS.intents.list; }, null);
    if (!Array.isArray(list) || !list.length) { host.appendChild(el('p', { className: 'muted small', text: t('recipes.empty') })); return; }
    var groups = {};
    list.forEach(function (it) {
      if (!it) return;
      var cat = it.category || 'other';
      (groups[cat] = groups[cat] || []).push(it);
    });
    var order = RECIPE_ORDER.concat(Object.keys(groups).filter(function (k) { return RECIPE_ORDER.indexOf(k) < 0; }));
    order.forEach(function (cat) {
      var items = groups[cat];
      if (!items || !items.length) return;
      var g = el('div', { className: 'recipe-group' });
      var label = EFS.i18n && EFS.i18n.has && EFS.i18n.has('recipes.cat.' + cat) ? t('recipes.cat.' + cat) : cat;
      g.appendChild(el('div', { className: 'recipe-group-title', text: label }));
      items.forEach(function (it) {
        var r = el('div', { className: 'recipe' });
        r.appendChild(el('div', { className: 'recipe-title', text: pick(it.title) || it.id || '' }));
        var exs = it.examples ? (it.examples[state.uiLang] || it.examples.en || it.examples.tr || it.examples.ru || []) : [];
        if (!Array.isArray(exs)) exs = [exs];
        if (exs.length) {
          var chips = el('div', { className: 'chips' });
          exs.slice(0, 4).forEach(function (ex) {
            if (typeof ex !== 'string') return;
            var b = el('button', { type: 'button', className: 'chip', text: ex, title: ex });
            b.addEventListener('click', function () {
              setPrompt(ex);
              if (root.innerWidth < 800) setView('studio'); else if (doc.body.classList.contains('lib-open')) toggleLibrary(false);
              generate(ex);
            });
            chips.appendChild(b);
          });
          r.appendChild(chips);
        }
        g.appendChild(r);
      });
      host.appendChild(g);
    });
  }

  function setLibTab(tab) {
    state.libTab = tab;
    store.set(KEYS.libTab, tab);
    var tabs = $('lib-tabs');
    if (tabs) {
      var buttons = tabs.querySelectorAll('button[data-tab]');
      for (var i = 0; i < buttons.length; i++) {
        var on = buttons[i].dataset.tab === tab;
        buttons[i].classList.toggle('is-active', on);
        buttons[i].setAttribute('aria-selected', on ? 'true' : 'false');
      }
    }
    show($('lib-functions'), tab === 'functions');
    show($('lib-explain'), tab === 'explain');
    show($('lib-recipes'), tab === 'recipes');
  }

  function renderLibrary() {
    guard(function () { renderFnCats(); renderFnList(); }, 'err.libraryFailed');
    guard(function () { renderRecipes(); }, 'err.libraryFailed');
    var out = $('ex-output');
    if (out && out.children.length && $('ex-input') && $('ex-input').value.trim()) exRun(state.exMode || 'explain');
  }

  // ------------------------------------------------------------------
  // Preferences: language, dialect, style, theme, view
  // ------------------------------------------------------------------
  function applyI18n() {
    if (!doc) return;
    var nodes = doc.querySelectorAll('[data-i18n]');
    var i;
    for (i = 0; i < nodes.length; i++) nodes[i].textContent = t(nodes[i].getAttribute('data-i18n'));
    nodes = doc.querySelectorAll('[data-i18n-placeholder]');
    for (i = 0; i < nodes.length; i++) nodes[i].setAttribute('placeholder', t(nodes[i].getAttribute('data-i18n-placeholder')));
    nodes = doc.querySelectorAll('[data-i18n-title]');
    for (i = 0; i < nodes.length; i++) nodes[i].setAttribute('title', t(nodes[i].getAttribute('data-i18n-title')));
    nodes = doc.querySelectorAll('[data-i18n-aria]');
    for (i = 0; i < nodes.length; i++) nodes[i].setAttribute('aria-label', t(nodes[i].getAttribute('data-i18n-aria')));
    doc.documentElement.setAttribute('lang', state.uiLang);
    var ver = $('help-version');
    if (ver) ver.textContent = t('app.version', { v: EFS.VERSION || '1.0.0' });
    var themeBtn = $('theme-btn');
    if (themeBtn) themeBtn.title = state.theme === 'dark' ? t('theme.light') : t('theme.dark');
  }

  function setUiLang(lang, opts) {
    opts = opts || {};
    if (['tr', 'ru', 'en'].indexOf(lang) < 0) lang = 'tr';
    state.uiLang = lang;
    if (EFS.i18n && EFS.i18n.setLang) EFS.i18n.setLang(lang); else store.set(KEYS.uiLang, lang);
    if (!state.dialectManual) state.dialect = lang;
    setActive($('ui-lang'), 'lang', lang);
    setActive($('dialect-seg'), 'dialect', state.dialect);
    applyI18n();
    if (!opts.silentRender) renderAll();
    if (opts.announce) toast(t('toast.langChanged', { lang: t('lang.' + lang) }), 'info', 1600);
  }
  ui.setLang = setUiLang;

  function setDialect(d, manual) {
    if (DIALECTS.indexOf(d) < 0) return;
    state.dialect = d;
    if (manual) { state.dialectManual = true; store.set(KEYS.dialectManual, true); store.set(KEYS.dialect, d); }
    setActive($('dialect-seg'), 'dialect', d);
    state.cardDialects = {};
    renderResult();
    renderFnList();
  }
  ui.setDialect = setDialect;

  function setStyle(s) {
    state.style = s === 'classic' ? 'classic' : 'modern';
    store.set(KEYS.style, state.style);
    setActive($('style-seg'), 'style', state.style);
    if (state.lastResult && state.lastResult.text) generate(state.lastResult.text);
  }
  ui.setStyle = setStyle;

  function setTheme(theme) {
    state.theme = theme === 'light' ? 'light' : 'dark';
    store.set(KEYS.theme, state.theme);
    doc.documentElement.setAttribute('data-theme', state.theme);
    var meta = doc.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', state.theme === 'dark' ? '#0f1216' : '#ffffff');
    var btn = $('theme-btn');
    if (btn) btn.title = state.theme === 'dark' ? t('theme.light') : t('theme.dark');
  }
  ui.setTheme = setTheme;

  function setView(view) {
    state.view = ['workbook', 'studio', 'library'].indexOf(view) >= 0 ? view : 'studio';
    var layout = $('layout');
    if (layout) layout.setAttribute('data-view', state.view);
    setActive($('mobile-tabs'), 'view', state.view);
  }
  ui.setView = setView;

  function toggleLibrary(open) {
    if (!doc) return;
    var isOpen = doc.body.classList.contains('lib-open');
    if (typeof open !== 'boolean') open = !isOpen;
    doc.body.classList.toggle('lib-open', open);
    var bd = $('lib-backdrop');
    if (bd) bd.hidden = !open;
    var tg = $('lib-toggle');
    if (tg) tg.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function openHelp() {
    var d = $('help-dialog');
    if (!d) return;
    try { if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', ''); } catch (e) { d.setAttribute('open', ''); }
  }
  function closeHelp() {
    var d = $('help-dialog');
    if (!d) return;
    try { if (typeof d.close === 'function' && d.open) d.close(); else d.removeAttribute('open'); } catch (e) { d.removeAttribute('open'); }
  }

  function renderAll() {
    guard(function () { renderExamples(); }, 'err.renderFailed');
    guard(function () { renderHistory(); }, 'err.renderFailed');
    guard(function () { renderResult(); }, 'err.renderFailed');
    guard(function () { renderWorkbook(); }, 'err.renderFailed');
    renderLibrary();
    updateLangChip();
  }
  ui.renderAll = renderAll;

  // ------------------------------------------------------------------
  // Event wiring
  // ------------------------------------------------------------------
  function on(id, ev, fn) { var n = $(id); if (n) n.addEventListener(ev, fn); }

  function wireEvents() {
    // top bar
    var langSeg = $('ui-lang');
    if (langSeg) langSeg.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button[data-lang]') : null;
      if (b) setUiLang(b.dataset.lang, { announce: true });
    });
    var dSeg = $('dialect-seg');
    if (dSeg) dSeg.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button[data-dialect]') : null;
      if (b) setDialect(b.dataset.dialect, true);
    });
    var sSeg = $('style-seg');
    if (sSeg) sSeg.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button[data-style]') : null;
      if (b) setStyle(b.dataset.style);
    });
    on('theme-btn', 'click', function () {
      setTheme(state.theme === 'dark' ? 'light' : 'dark');
      toast(t('toast.themeChanged', { theme: t(state.theme === 'dark' ? 'theme.dark' : 'theme.light') }), 'info', 1400);
    });
    on('help-btn', 'click', openHelp);
    on('help-close', 'click', closeHelp);
    on('help-ok', 'click', closeHelp);
    var dlg = $('help-dialog');
    if (dlg) dlg.addEventListener('click', function (e) { if (e.target === dlg) closeHelp(); });
    on('lib-toggle', 'click', function () { toggleLibrary(); });
    on('lib-close', 'click', function () { toggleLibrary(false); });
    on('lib-backdrop', 'click', function () { toggleLibrary(false); });

    // mobile tabs
    var mt = $('mobile-tabs');
    if (mt) mt.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button[data-view]') : null;
      if (b) setView(b.dataset.view);
    });

    // workbook
    on('browse-btn', 'click', function () { var fi = $('file-input'); if (fi) fi.click(); });
    var dz = $('dropzone');
    if (dz) {
      dz.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('#browse-btn')) return;
        var fi = $('file-input'); if (fi) fi.click();
      });
      dz.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); var fi = $('file-input'); if (fi) fi.click(); } });
    }
    on('file-input', 'change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) loadFile(f);
      e.target.value = '';
    });
    var panel = $('panel-workbook');
    if (panel) {
      var dragDepth = 0;
      panel.addEventListener('dragenter', function (e) { e.preventDefault(); dragDepth++; panel.classList.add('is-over'); });
      panel.addEventListener('dragover', function (e) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; });
      panel.addEventListener('dragleave', function () { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) panel.classList.remove('is-over'); });
      panel.addEventListener('drop', function (e) {
        e.preventDefault(); dragDepth = 0; panel.classList.remove('is-over');
        var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) loadFile(f);
      });
    }
    doc.addEventListener('dragover', function (e) { e.preventDefault(); });
    doc.addEventListener('drop', function (e) { e.preventDefault(); });
    on('file-clear', 'click', clearWorkbook);
    on('header-row-select', 'change', function (e) { setHeaderRow(e.target.value); });
    on('download-btn', 'click', downloadWorkbook);

    // studio
    var prompt = $('prompt');
    if (prompt) {
      prompt.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); generate(); }
      });
      prompt.addEventListener('input', function () {
        if (langChipTimer) root.clearTimeout(langChipTimer);
        langChipTimer = root.setTimeout(updateLangChip, 180);
      });
    }
    on('generate-btn', 'click', function () { generate(); });
    on('clear-prompt', 'click', function () { setPrompt(''); if (prompt) prompt.focus(); });
    on('examples-more', 'click', function () { state.exampleSeed++; renderExamples(); });
    on('history-clear', 'click', clearHistory);

    // library
    var tabs = $('lib-tabs');
    if (tabs) tabs.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button[data-tab]') : null;
      if (b) setLibTab(b.dataset.tab);
    });
    var searchTimer = null;
    on('fn-search', 'input', function (e) {
      var v = e.target.value;
      if (searchTimer) root.clearTimeout(searchTimer);
      searchTimer = root.setTimeout(function () { state.fnQuery = v; state.fnShown = 40; renderFnList(); }, 120);
    });
    on('ex-explain-btn', 'click', function () { state.exMode = 'explain'; exRun('explain'); });
    on('ex-translate-btn', 'click', function () { state.exMode = 'translate'; exRun('translate'); });
    var exInput = $('ex-input');
    if (exInput) exInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); state.exMode = 'explain'; exRun('explain'); }
    });

    // global keys
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var d = $('help-dialog');
        if (d && d.open) { closeHelp(); return; }
        if (doc.body.classList.contains('lib-open')) { toggleLibrary(false); return; }
        return;
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        var active = doc.activeElement;
        if (active && active.id === 'ex-input') return;
        e.preventDefault();
        generate();
      }
    });

    // responsive housekeeping: close slide-over when leaving tablet width
    var lastW = root.innerWidth;
    root.addEventListener('resize', function () {
      var w = root.innerWidth;
      if ((w >= 1200 || w < 800) && doc.body.classList.contains('lib-open')) toggleLibrary(false);
      lastW = w;
    });
  }

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------
  function loadPrefs() {
    var lang = (EFS.i18n && EFS.i18n.detect) ? EFS.i18n.detect() : (store.get(KEYS.uiLang, null) || 'tr');
    state.uiLang = lang;
    state.dialectManual = store.get(KEYS.dialectManual, false) === true;
    var d = store.get(KEYS.dialect, null);
    state.dialect = state.dialectManual && DIALECTS.indexOf(d) >= 0 ? d : lang;
    var s = store.get(KEYS.style, 'modern');
    state.style = s === 'classic' ? 'classic' : 'modern';
    // dark is the default; only an explicit user choice (persisted) switches to light
    var th = store.get(KEYS.theme, 'dark');
    state.theme = th === 'light' ? 'light' : 'dark';
    var lt = store.get(KEYS.libTab, 'functions');
    state.libTab = ['functions', 'explain', 'recipes'].indexOf(lt) >= 0 ? lt : 'functions';
  }

  function init() {
    if (!doc || state.booted) return;
    state.booted = true;
    try {
      loadPrefs();
      loadHistory();
      setTheme(state.theme);
      if (EFS.i18n && EFS.i18n.setLang) EFS.i18n.setLang(state.uiLang);
      setActive($('ui-lang'), 'lang', state.uiLang);
      setActive($('dialect-seg'), 'dialect', state.dialect);
      setActive($('style-seg'), 'style', state.style);
      setLibTab(state.libTab);
      setView('studio');
      applyI18n();
      wireEvents();
      renderAll();
      var missing = ['generate', 'intents', 'parser', 'workbook'].filter(function (n) { return !EFS[n]; });
      if (missing.length) toast(t('toast.moduleMissing', { module: missing.join(', ') }), 'warn', 7000);
    } catch (e) {
      reportError(e, 'err.renderFailed');
    }
  }
  ui.init = init;

  if (doc) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
    else init();
  }

  EFS.ui = ui;
  return ui;
});
