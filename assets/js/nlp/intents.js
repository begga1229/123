/* Formula Studio — EFS.intents (core): intent registry, ranking and the shared helper toolkit.
 * The actual intents live in intents-aggregate.js, intents-logic.js, intents-lookup.js, intents-text.js,
 * intents-date.js, intents-math.js and intents-finance-array.js; each of them calls EFS.intents.register([...])
 * at load time (this file is guaranteed to load first). See docs/ARCHITECTURE.md §9 and §15.
 *
 * Contract recap:
 *   intents.list                      → [IntentDef] (copy of the registry, registration order)
 *   intents.register(defs)            → adds / replaces definitions by id
 *   intents.get(id)                   → IntentDef | null
 *   intents.rank(pq, ctx, opts)       → Candidate[] sorted by confidence desc (top 5), IFERROR-wrapped when asked
 *   intents.helpers (alias intents.H) → toolkit used by the intent files (ranges, criteria, defaults, targets …)
 * Plain ES2019, no dependencies at load time: EFS.ast / EFS.normalize / EFS.catalog are resolved lazily. */
(function (root, factory) {
  var EFS = root.EFS || (root.EFS = {});
  var api = factory(EFS, root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (EFS, root) {
  'use strict';
  var intents = {};
  var registry = [];
  var byId = {};
  var H = {};

  /* ------------------------------------------------------------------ lazy module access */
  function A() { return EFS.ast; }
  function N() { return EFS.normalize || null; }
  function U() { return EFS.util; }
  function safe(fn, fallback) { try { var v = fn(); return v === undefined ? fallback : v; } catch (e) { return fallback; } }
  H.ast = A; H.safe = safe;

  /* ------------------------------------------------------------------ trilingual strings */
  function T(tr, ru, en) { return { tr: tr, ru: ru, en: en }; }
  H.T = T;
  /** Fill %name% placeholders in every language of a trilingual template. */
  H.msg = function (tpl, vars) {
    vars = vars || {};
    var out = {};
    ['tr', 'ru', 'en'].forEach(function (l) {
      var s = tpl ? (tpl[l] || tpl.en || '') : '';
      out[l] = s.replace(/%(\w+)%/g, function (m, k) { return vars[k] === undefined || vars[k] === null ? '' : String(vars[k]); });
    });
    return out;
  };
  H.pick = function (obj, lang) { return U().pick(obj, lang); };
  H.lang = function (pq, opts) { return (opts && opts.uiLang) || (pq && pq.lang) || 'tr'; };
  H.YES = T('Evet', 'Да', 'Yes');
  H.NO = T('Hayır', 'Нет', 'No');
  H.NOT_FOUND = T('Bulunamadı', 'Не найдено', 'Not found');
  H.DUPLICATE = T('Tekrar', 'Дубликат', 'Duplicate');
  H.OVERDUE = T('Gecikti', 'Просрочено', 'Overdue');
  H.ERROR_TEXT = T('Hata', 'Ошибка', 'Error');
  /** Pick the language-specific default literal (Evet / Да / Yes …) as a string node. */
  H.word = function (tri, lang) { return A().str(U().pick(tri, lang)); };

  function fold(s) {
    var n = N();
    if (n && typeof n.fold === 'function') { var r = safe(function () { return n.fold(s); }, null); if (typeof r === 'string') return r; }
    return String(s == null ? '' : s).replace(/[İIı]/g, 'i').replace(/[Çç]/g, 'c').replace(/[Ğğ]/g, 'g').replace(/[Öö]/g, 'o').replace(/[Şş]/g, 's').replace(/[Üü]/g, 'u').replace(/[Ёё]/g, 'е').toLowerCase();
  }
  H.fold = fold;
  /** Regex test over the folded request text (fallback for words the lexicon may not expose as concepts). */
  H.rawHas = function (pq, re) { return !!(pq && pq.text) && re.test(fold(pq.text)); };

  /* ------------------------------------------------------------------ style / options */
  H.modern = function (opts) { return !(opts && opts.style === 'classic'); };
  H.classic = function (opts) { return !!(opts && opts.style === 'classic'); };

  /* ------------------------------------------------------------------ context helpers */
  H.firstRow = function (ctx) { return (ctx && ctx.firstDataRow > 0) ? ctx.firstDataRow : 2; };
  H.lastRow = function (ctx) { return (ctx && ctx.lastRow > 0) ? ctx.lastRow : null; };
  H.headers = function (ctx) { return (ctx && Array.isArray(ctx.headers)) ? ctx.headers : []; };
  H.headerByCol = function (ctx, col) {
    var hs = H.headers(ctx); col = String(col || '').toUpperCase();
    for (var i = 0; i < hs.length; i++) if (String(hs[i].col).toUpperCase() === col) return hs[i];
    return null;
  };
  H.headerByName = function (ctx, name) {
    var hs = H.headers(ctx), f = fold(name);
    for (var i = 0; i < hs.length; i++) if (fold(hs[i].name) === f) return hs[i];
    return null;
  };
  H.headersOfType = function (ctx, type) { return H.headers(ctx).filter(function (h) { return h.type === type; }); };
  /** Position (1-based) of a column letter among the context headers; 0 when unknown. */
  H.colPos = function (ctx, col) {
    var hs = H.headers(ctx); col = String(col || '').toUpperCase();
    for (var i = 0; i < hs.length; i++) if (String(hs[i].col).toUpperCase() === col) return i + 1;
    return U().columnIndex(col) || 0;
  };
  /** First empty column after the last header (§15.3), e.g. 'N' for the test contexts. */
  H.freeCol = function (ctx) {
    var hs = H.headers(ctx);
    if (!hs.length) return null;
    var max = 0;
    for (var i = 0; i < hs.length; i++) max = Math.max(max, U().columnIndex(hs[i].col));
    return U().columnLetter(max + 1);
  };
  /** Whole data block of the sheet: { text:'A2:M200', first:'A', last:'M' } or null. */
  H.dataBlock = function (ctx) {
    var hs = H.headers(ctx);
    if (!hs.length || !H.lastRow(ctx)) return null;
    var min = Infinity, max = 0;
    for (var i = 0; i < hs.length; i++) { var n = U().columnIndex(hs[i].col); min = Math.min(min, n); max = Math.max(max, n); }
    var a = U().columnLetter(min), b = U().columnLetter(max);
    return { text: a + H.firstRow(ctx) + ':' + b + H.lastRow(ctx), first: a, last: b };
  };
  /** Other sheet description from ctx.otherSheets (case/diacritic-insensitive by name). */
  H.otherSheet = function (ctx, name) {
    if (!ctx || !ctx.otherSheets || !name) return null;
    if (ctx.otherSheets[name]) return ctx.otherSheets[name];
    var f = fold(name), keys = Object.keys(ctx.otherSheets);
    for (var i = 0; i < keys.length; i++) if (fold(keys[i]) === f) return ctx.otherSheets[keys[i]];
    return null;
  };
  H.otherSheetName = function (ctx, name) {
    if (!ctx || !ctx.otherSheets || !name) return name;
    if (ctx.otherSheets[name]) return name;
    var f = fold(name), keys = Object.keys(ctx.otherSheets);
    for (var i = 0; i < keys.length; i++) if (fold(keys[i]) === f) return keys[i];
    return name;
  };

  /* ------------------------------------------------------------------ reference helpers */
  /** Normalised copy of a parser ref (or a plain text) → { text, sheet, col, col2, row, row2, kind, type, headerName, source }. */
  H.refOf = function (r, ctx) {
    if (!r) return null;
    if (typeof r === 'string') {
      var split = A().splitSheet(r), pr = U().parseRange(split.ref) || {};
      var kind = /^\$?[A-Za-z]{1,3}:\$?[A-Za-z]{1,3}$/.test(split.ref) ? 'column' : (pr.row === pr.row2 && pr.col === pr.col2 ? 'cell' : 'range');
      r = { text: split.ref, sheet: split.sheet || null, col: pr.col, col2: pr.col2, row: pr.row, row2: pr.row2, kind: kind, source: 'explicit', headerName: null };
    }
    var o = {
      text: r.text || r.full || '', sheet: r.sheet || null, col: r.col || null, col2: r.col2 || r.col || null, row: r.row || null, row2: r.row2 || r.row || null,
      kind: r.kind || 'range', type: r.type || null, headerName: r.headerName || null, source: r.source || 'explicit', tokenIndex: r.tokenIndex, usedBy: r.usedBy || null, raw: r
    };
    if (!o.col) { var p = U().parseRange(o.text); if (p) { o.col = p.col; o.col2 = p.col2; o.row = p.row; o.row2 = p.row2; } }
    if (!o.type && ctx && !o.sheet) { var h = H.headerByCol(ctx, o.col); if (h) o.type = h.type; }
    if (!o.type && o.sheet && ctx) { var os = H.otherSheet(ctx, o.sheet); if (os) { var oh = (os.headers || []).filter(function (x) { return x.col === o.col; })[0]; if (oh) o.type = oh.type; } }
    return o;
  };
  /** "$E$2:$E$200" from "E2:E200"; "$E:$E" from "E:E"; "$A$2" from "A2". Already-absolute parts are kept. */
  H.absText = function (text) {
    return String(text || '').split(':').map(function (part) {
      var m = /^\$?([A-Za-z]{1,3})\$?(\d+)?$/.exec(part);
      if (!m) { var m2 = /^\$?(\d+)$/.exec(part); return m2 ? '$' + m2[1] : part; }
      return '$' + m[1].toUpperCase() + (m[2] ? '$' + m[2] : '');
    }).join(':');
  };
  H.rangeNode = function (r, abs) { r = H.refOf(r); return A().ref(abs ? H.absText(r.text) : r.text, r.sheet); };
  /** Text of the per-row cell authored for the first data row: E2:E200 → E2, E:E → E2, A5 → A5 (sheet kept). */
  H.cellText = function (r, ctx) {
    r = H.refOf(r);
    if (!r) return null;
    if (r.kind === 'cell') return r.text.replace(/\$/g, '');
    var row = (r.kind === 'range' && r.row) ? r.row : H.firstRow(ctx);
    if (r.sheet && ctx) { var os = H.otherSheet(ctx, r.sheet); if (os && os.firstDataRow && r.kind !== 'range') row = os.firstDataRow; }
    return (r.col || 'A') + row;
  };
  H.cellNode = function (r, ctx) { r = H.refOf(r); return A().ref(H.cellText(r, ctx), r.sheet); };
  /** Per-row cell text of a target column / plain column letter: ('N', ctx) → 'N2'. */
  H.colCell = function (col, ctx) { return String(col).toUpperCase() + H.firstRow(ctx); };
  H.colRange = function (col, ctx) { var l = H.lastRow(ctx); return l ? col + H.firstRow(ctx) + ':' + col + l : col + ':' + col; };
  H.isRangeLike = function (r) { return !!r && (r.kind === 'range' || r.kind === 'column' || r.kind === 'row'); };
  H.isCell = function (r) { return !!r && r.kind === 'cell'; };
  H.refType = function (r, ctx) { r = H.refOf(r, ctx); return r ? r.type : null; };
  /** Label used in explanations: header name when known, else the ref text. */
  H.label = function (r) { r = H.refOf(r); return r ? (r.headerName || (r.sheet ? r.sheet + '!' + r.text : r.text)) : ''; };

  var USED_BY_CONDITION = { condition: 1, conditionValue: 1 };
  /** Parser refs with optional filtering. opts: { free:true (not used by conditions / target), kinds:[...], type:'number', sheet:null|'any'|name, noTarget:true }. */
  H.refs = function (pq, opts) {
    opts = opts || {};
    var out = [], list = (pq && pq.refs) || [];
    var live = opts.free ? H.liveUsed(pq) : null;
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (!r) continue;
      if (opts.free && (r.isTarget || (USED_BY_CONDITION[r.usedBy] && live.indexOf(r) >= 0))) continue;
      if (opts.noTarget !== false && (r.isTarget || H.isResultRef(pq, r))) continue;
      if (opts.notUsed && r.usedBy) continue;
      if (opts.kinds && opts.kinds.indexOf(r.kind) < 0) continue;
      if (opts.type && r.type && r.type !== opts.type) continue;
      if (opts.sheet === null && r.sheet) continue;
      if (opts.sheet && opts.sheet !== 'any' && r.sheet !== opts.sheet) continue;
      if (opts.onlySheet && !r.sheet) continue;
      out.push(r);
    }
    return out;
  };
  /** Refs really consumed by the conditions that survive H.conds (parser noise does not lock a column). */
  H.liveUsed = function (pq) {
    if (!pq) return [];
    if (pq.__liveUsed) return pq.__liveUsed;
    var out = [], cs = H.conds(pq);
    for (var i = 0; i < cs.length; i++) {
      if (cs[i].refObj) out.push(cs[i].refObj);
      if (cs[i].valueRefObj) out.push(cs[i].valueRefObj);
    }
    try { Object.defineProperty(pq, '__liveUsed', { value: out, enumerable: false, configurable: true }); } catch (e) { /* ignore */ }
    return out;
  };
  H.isResultRef = function (pq, r) {
    if (!r || r.source !== 'explicit' || r.kind !== 'cell') return false;
    var toks = pq.tokens || [];
    for (var k = 1; k <= 3; k++) { var t = toks[r.tokenIndex - k]; if (!t) break; var f = fold(t.norm); if (/^(sonucu|sonuç|результат|result)/.test(f)) return true; if (t.type === 'word' && !/^(в|во|to|into|in|hücresine|ячейк|cell)/.test(f)) break; }
    return false;
  };
  H.freeRefs = function (pq) { return H.refs(pq, { free: true }); };
  H.sheetRefs = function (pq) { return H.refs(pq, { onlySheet: true }); };
  H.localRefs = function (pq, free) { return H.refs(pq, { sheet: null, free: !!free }); };
  /** Refs sorted by position in the text. */
  H.byPosition = function (list) { return list.slice().sort(function (a, b) { return (a.tokenIndex || 0) - (b.tokenIndex || 0); }); };

  /** Default ref from the context: first header of the wanted type(s) → ref-like object with source 'default'. */
  H.defaultHeader = function (ctx, types) {
    types = Array.isArray(types) ? types : [types];
    var hs = H.headers(ctx);
    for (var t = 0; t < types.length; t++) {
      for (var i = 0; i < hs.length; i++) {
        var h = hs[i];
        if (!types[t] || h.type === types[t]) return { text: h.dataRange || H.colRange(h.col, ctx), kind: 'range', sheet: null, col: h.col, col2: h.col, row: H.firstRow(ctx), row2: H.lastRow(ctx), type: h.type, headerName: h.name, source: 'default' };
      }
    }
    return null;
  };

  /** Resolve the main operand of an intent: the first free ref (preferring `type`), else a default header of that type
   *  (assumption recorded on `cand`), else a placeholder (missing[] filled). Returns { ref, placeholder, node(abs), cell }. */
  H.mainRef = function (pq, ctx, cand, want) {
    want = want || {};
    var types = want.type ? [].concat(want.type) : [];
    var pool = want.pool || H.refs(pq, { free: want.free !== false, sheet: want.sheet === undefined ? null : want.sheet });
    if (want.kinds) pool = pool.filter(function (r) { return want.kinds.indexOf(r.kind) >= 0; });
    var chosen = null;
    for (var t = 0; t < types.length && !chosen; t++) for (var i = 0; i < pool.length; i++) if (pool[i].type === types[t]) { chosen = pool[i]; break; }
    if (!chosen && pool.length && !want.strictType) chosen = pool[0];
    if (!chosen && pool.length && want.strictType) for (var k = 0; k < pool.length; k++) if (!pool[k].type) { chosen = pool[k]; break; }
    var ref = chosen ? H.refOf(chosen, ctx) : null;
    if (!ref && ctx && !want.noDefault) {
      ref = H.headerByWord(pq, ctx, types) || H.defaultHeader(ctx, types.length ? types.concat([null]) : [null]);
      if (ref && cand) H.assume(cand, T('“%h%” sütunu (%r%) varsayıldı.', 'Предполагается столбец «%h%» (%r%).', 'Assumed the “%h%” column (%r%).'), { h: ref.headerName, r: ref.text });
    }
    var slot = want.slot || 'range';
    if (!ref) {
      if (cand) H.miss(cand, slot, want.ask || T('Hangi aralık kullanılacak?', 'Какой диапазон использовать?', 'Which range should be used?'), H.headerOptions(ctx, types[0]));
      return { ref: null, placeholder: true, node: A().placeholder(slot), cell: A().placeholder(want.cellSlot || 'cell') };
    }
    return { ref: ref, placeholder: false, node: H.rangeNode(ref, !!want.abs), cell: H.cellNode(ref, ctx) };
  };
  /** A header whose name equals (folded, stem-aware) a word of the request, e.g. RU "Сумма" / "Скидка" used as an operation word. */
  H.headerByWord = function (pq, ctx, types, from, to) {
    var toks = (pq && pq.tokens) || [], hs = H.headers(ctx);
    types = (types || []).filter(Boolean);
    to = to == null ? toks.length : to; from = from || 0;
    for (var i = from; i < to && i < toks.length; i++) {
      var t = toks[i];
      if (!t || t.type !== 'word') continue;
      var f = fold(t.norm), st = fold(t.stem || t.norm);
      for (var k = 0; k < hs.length; k++) {
        var hn = fold(hs[k].name);
        if (hn.indexOf(' ') >= 0 || hn.length < 3) continue;
        if (types.length && hs[k].type && types.indexOf(hs[k].type) < 0) continue;
        var sing = f.replace(/ies$/, 'y').replace(/(s|x|ch|sh)es$/, '$1').replace(/s$/, '');
        var hit = hn === f || hn === sing || (st.length >= 3 && hn.indexOf(st) === 0 && hn.length - st.length <= 2) || (f.length >= 4 && hn.indexOf(f.slice(0, Math.max(4, f.length - 2))) === 0 && Math.abs(hn.length - f.length) <= 2);
        if (hit) return { text: hs[k].dataRange || H.colRange(hs[k].col, ctx), kind: 'range', sheet: null, col: hs[k].col, col2: hs[k].col, row: H.firstRow(ctx), row2: H.lastRow(ctx), type: hs[k].type, headerName: hs[k].name, source: 'default', tokenIndex: i };
      }
    }
    return null;
  };
  /** Header refs whose own word carries one of the given operation concepts ("Скидка 20% на Сумму": Скидка is the operation). */
  H.withoutOpRefs = function (pq, refs, concepts) {
    var out = refs.filter(function (r) {
      if (r.source !== 'header') return true;
      var toks = pq.tokens || [];
      for (var i = r.tokenIndex; i < (r.tokenEnd || r.tokenIndex + 1); i++) { var t = toks[i]; if (t && t.concepts && t.concepts.some(function (c) { return concepts.indexOf(c.concept) >= 0; })) return false; }
      return true;
    });
    return out.length ? out : refs;
  };
  H.headerOptions = function (ctx, type) {
    return H.headers(ctx).filter(function (h) { return !type || h.type === type; }).slice(0, 12).map(function (h) { return { label: h.name + ' (' + h.col + ')', value: h.dataRange }; });
  };
  H.assume = function (cand, tpl, vars) { if (cand) (cand.assumptions = cand.assumptions || []).push(H.msg(tpl, vars)); return cand; };
  H.miss = function (cand, slot, tpl, options) {
    if (!cand) return cand;
    var m = H.msg(tpl, {}); m.slot = slot; if (options && options.length) m.options = options;
    (cand.missing = cand.missing || []).push(m);
    return cand;
  };

  /* ------------------------------------------------------------------ concepts */
  H.has = function (pq, c) { return !!(pq && typeof pq.has === 'function' ? pq.has(c) : (pq && pq.concepts || []).some(function (x) { return x.concept === c; })); };
  H.any = function (pq, list) { for (var i = 0; i < list.length; i++) if (H.has(pq, list[i])) return true; return false; };
  H.all = function (pq, list) { for (var i = 0; i < list.length; i++) if (!H.has(pq, list[i])) return false; return true; };
  H.count = function (pq, c) { var n = 0; ((pq && pq.concepts) || []).forEach(function (x) { if (x.concept === c) n++; }); return n; };
  H.idx = function (pq, c) { return pq && typeof pq.indexOf === 'function' ? pq.indexOf(c) : -1; };
  var AGG = ['SUM', 'TOTAL', 'AVERAGE', 'COUNT', 'COUNT_NONEMPTY', 'COUNT_EMPTY', 'MAX', 'MIN', 'MEDIAN', 'MODE', 'STDEV', 'VARIANCE', 'PRODUCT', 'RANK', 'NTH_LARGEST', 'NTH_SMALLEST', 'COUNT_UNIQUE', 'SUBTOTAL'];
  H.AGG = AGG;
  H.hasAggregate = function (pq) { return H.any(pq, AGG); };
  /** Explicit Excel function names the user typed (EN canonical). */
  H.fx = function (pq) { return (pq && pq.explicitFunctions) || []; };
  H.wants = function (pq, names) { names = [].concat(names); var fx = H.fx(pq); for (var i = 0; i < fx.length; i++) if (names.indexOf(fx[i]) >= 0) return true; return false; };

  /* ------------------------------------------------------------------ numbers / literals / dates */
  H.nums = function (pq, opts) {
    opts = opts || {};
    var live = opts.free ? H.liveNumIdx(pq) : null;
    return ((pq && pq.numbers) || []).filter(function (n) {
      if (opts.free && n.usedBy && (n.usedBy !== 'condition' || live[n.tokenIndex])) return false;
      if (opts.percent === true && !n.isPercent) return false;
      if (opts.percent === false && n.isPercent) return false;
      if (opts.noDate && H.dateFromRaw(n.raw)) return false;
      return true;
    });
  };
  H.lits = function (pq, opts) { opts = opts || {}; return ((pq && pq.literals) || []).filter(function (l) { return !(opts.free && l.usedBy); }); };
  H.ords = function (pq) { return (pq && pq.ordinals) || []; };
  /** dd.mm.yyyy / dd/mm/yyyy / dd-mm-yyyy / yyyy-mm-dd → { y, m, d } or null. */
  H.dateFromRaw = function (raw) {
    var s = String(raw == null ? '' : raw).trim();
    var m = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/.exec(s);
    if (m) return { d: +m[1], m: +m[2], y: +m[3] };
    m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (m) return { y: +m[1], m: +m[2], d: +m[3] };
    return null;
  };
  H.dateNode = function (p) { return A().func('DATE', p.y, p.m, p.d); };
  /** Raw text of the number token that produced a condition value (for date detection). */
  H.rawOfValue = function (pq, cond, which) {
    var list = (pq && pq.numbers) || [];
    var val = which === 2 ? cond.value2 : cond.value;
    if (which !== 2 && cond.valueTokenIndex != null) for (var i = 0; i < list.length; i++) if (list[i].tokenIndex === cond.valueTokenIndex) return list[i].raw;
    for (var j = 0; j < list.length; j++) if (list[j].value === val && (which !== 2 || list[j].tokenIndex !== cond.valueTokenIndex)) return list[j].raw;
    return null;
  };

  /* ------------------------------------------------------------------ conditions */
  var OPS = { '>': 1, '>=': 1, '<': 1, '<=': 1, '=': 1, '<>': 1 };
  var NOISE_VALUES = { 'en': 1, 'cok': 1, 'daha': 1, 'ise': 1, 'olan': 1, 'olanlar': 1, 'satis': 1, 'satislar': 1, 'satislarin': 1, 'deger': 1, 'degeri': 1, 'sayi': 1, 'sayisi': 1, 'the': 1, 'a': 1, 'an': 1, 'is': 1, 'are': 1, 'than': 1, 'value': 1, 'values': 1, 'самый': 1, 'самая': 1, 'очень': 1, 'значение': 1, 'значения': 1, 'продаж': 1, 'продажи': 1, 'строк': 1, 'строки': 1, 'чем': 1 };
  /** Conditions cleaned of parser noise (bare equality with a plain word that carries concepts, or no value at all). */
  H.conds = function (pq) {
    if (!pq) return [];
    if (pq.__conds) return pq.__conds;
    var out = [], list = pq.conditions || [];
    var logicOrAgg = H.any(pq, ['IF', 'THEN', 'ELSE', 'FILTER', 'COUNT', 'SUM', 'AVERAGE', 'MAX', 'MIN', 'TOTAL']) || (pq.flags && pq.flags.question);
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (!c || !c.op) continue;
      // "%10 fazlası" / "на 10% больше": a percent next to a comparator word is arithmetic unless an IF/aggregate asks for a test
      if (c.isPercent && !logicOrAgg && (c.op === '>' || c.op === '<' || c.op === '>=' || c.op === '<=')) continue;
      if (!logicOrAgg && typeof c.value === 'number' && !c.valueRef && H.any(pq, NUMERIC_TRANSFORMS) && (c.op === '>' || c.op === '<' || c.op === '>=' || c.op === '<=' || c.op === 'between')) continue;
      c = fixCondition(pq, c);
      if (c.op === 'empty' || c.op === 'notEmpty') {
        // "boşlukla birleştir" / "через пробел": a SPACE word is not an emptiness test
        var ct = pq.tokens && pq.tokens[c.tokenIndex];
        var spaceWord = ct && ct.concepts && ct.concepts.some(function (x) { return x.concept === 'SPACE'; });
        if (spaceWord && H.any(pq, ['CONCAT', 'JOIN_WITH', 'TRIM', 'SUBSTITUTE', 'REPLACE'])) continue;
        out.push(c); continue;
      }
      if (c.value == null && c.valueRef == null && c.value2 == null) continue;
      if (c.op === '=' && c.value == null && c.valueRef && !c.refObj) continue;                      // "Is Quantity …" is not a test
      if (c.op === 'between' && !c.valueRef && (typeof c.value !== 'number' || typeof c.value2 !== 'number')) continue;
      if (c.valueRefObj && c.refObj && c.valueRefObj === c.refObj) continue;
      if (typeof c.value === 'string' && !c.valueRef) {
        var tok = pq.tokens && pq.tokens[c.valueTokenIndex];
        if (tok && tok.type !== 'string' && !H.dateFromRaw(tok.raw || '')) {
          // an unquoted word used as a value: drop parser noise (words that carry concepts, function words, lowercase verbs/nouns)
          if (tok.concepts && tok.concepts.length) continue;
          if (NOISE_VALUES[fold(tok.norm)]) continue;
          if (c.implicit !== true && tok.type === 'word' && !/^[\p{Lu}]/u.test(tok.raw || '')) continue;
          if (c.implicit && !/^[\p{Lu}]/u.test(tok.raw || '')) continue;
        }
      }
      out.push(c);
    }
    var extra = syntheticConds(pq, out);
    if (extra.length) { out = out.concat(extra).sort(function (a, b) { return a.position - b.position; }); var prev = null; for (var q = 0; q < out.length; q++) { if (out[q].synthetic && prev && !out[q].conjunction) out[q].conjunction = 'AND'; prev = out[q]; } }
    try { Object.defineProperty(pq, '__conds', { value: out, enumerable: false, configurable: true }); } catch (e) { /* ignore */ }
    return out;
  };
  var NUMERIC_TRANSFORMS = ['ROUND', 'ROUND_UP', 'ROUND_DOWN', 'DECIMALS', 'LEFT_CHARS', 'RIGHT_CHARS', 'MID_CHARS', 'CHARACTER', 'ADD_DAYS', 'ADD_MONTHS', 'ADD_YEARS', 'SEQUENCE', 'REPEAT', 'POWER', 'MOD', 'TO_TEXT', 'TEXT_FORMAT', 'WORKDAY'];
  /** Comparator corrections the parser cannot see: "не в городе X" → <>, "встречается X" → = (occurs, not contains). */
  function fixCondition(pq, c) {
    var toks = pq.tokens || [], out = c;
    var cmp = toks[c.tokenIndex];
    if (c.op === 'contains' && cmp && /^встреча/.test(fold(cmp.norm))) { out = Object.assign({}, c, { op: '=' }); }
    if (out.op === '=' && !out.hasNot) {
      var start = Math.max(0, Math.min(out.tokenIndex, out.valueTokenIndex != null ? out.valueTokenIndex : out.tokenIndex) - 3), end = Math.max(out.tokenIndex, out.valueTokenIndex != null ? out.valueTokenIndex : out.tokenIndex);
      var refTok = out.refObj ? out.refObj.tokenIndex : -1;
      for (var i = start; i < end; i++) {
        var t = toks[i];
        if (!t || t.type !== 'word') continue;
        if (/^(не|değil|not)$/.test(fold(t.norm)) && i >= refTok && !(t.concepts || []).some(function (x) { return x.concept === 'ELSE' || x.concept === 'NOT_EMPTY' || x.concept === 'NEQ'; })) { out = Object.assign({}, out, { op: '<>', hasNot: true }); break; }
      }
    }
    return out;
  }
  /** Implicit equality the parser skipped: header ref … [не] "literal" within two tokens (also handles "Категория не "Еда""). */
  function syntheticConds(pq, existing) {
    var out = [], lits = pq.literals || [], refs = pq.refs || [], toks = pq.tokens || [];
    for (var i = 0; i < lits.length; i++) {
      var l = lits[i];
      if (l.usedBy || existing.some(function (c) { return c.valueTokenIndex === l.tokenIndex; })) continue;
      var prev = toks[l.tokenIndex - 1];
      if (prev && (prev.concepts || []).some(function (x) { return x.concept === 'THEN' || x.concept === 'ELSE' || x.concept === 'IF' || x.concept === 'OR' || x.concept === 'AND' || x.concept === 'RETURN' || x.concept === 'NOT_FOUND' || x.concept === 'IFERROR'; })) continue;
      var ref = null, neg = false;
      for (var k = 1; k <= 3 && !ref; k++) {
        var t = toks[l.tokenIndex - k];
        if (!t) break;
        if (/^(не|değil|not)$/.test(fold(t.norm))) { neg = true; continue; }
        if (t.type === 'punct') continue;
        ref = refs.filter(function (r) { return r.source === 'header' && r.tokenIndex <= t.index && (r.tokenEnd || r.tokenIndex + 1) > t.index && !r.isTarget; })[0] || null;
        if (!ref) break;
      }
      if (!ref || existing.some(function (c) { return c.refObj === ref && Math.abs(c.position - l.tokenIndex) <= 1; })) continue;
      out.push({ ref: ref.full || ref.text, refObj: ref, op: neg ? '<>' : '=', value: l.value, value2: null, valueRef: null, valueKind: 'str', isPercent: false, conjunction: null, position: l.tokenIndex, tokenIndex: l.tokenIndex, tokenEnd: l.tokenIndex + 1, start: l.start, end: l.end, hasIf: false, valueTokenIndex: l.tokenIndex, concept: neg ? 'NEQ' : 'EQ', synthetic: true });
    }
    return out;
  }
  /** Token indexes of numbers consumed by the surviving conditions. */
  H.liveNumIdx = function (pq) {
    var set = {}, cs = H.conds(pq), nums = (pq && pq.numbers) || [];
    for (var i = 0; i < cs.length; i++) {
      var c = cs[i];
      if (c.valueTokenIndex != null) set[c.valueTokenIndex] = true;
      if (c.value2 != null) for (var k = 0; k < nums.length; k++) if (nums[k].value === c.value2 && nums[k].tokenIndex !== c.valueTokenIndex && nums[k].tokenIndex > (c.valueTokenIndex || -1)) { set[nums[k].tokenIndex] = true; break; }
    }
    return set;
  };
  /** "D2'den E2'ye" / "B2 ile A2 arasındaki" are merged by the parser into one same-row range: split it back into two cells. */
  H.pairFromRange = function (pq) {
    var list = (pq && pq.refs) || [];
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (r && r.source === 'explicit' && r.kind === 'range' && r.row && r.row === r.row2 && r.col !== r.col2 && !r.isTarget) {
        var mk = function (col) { return { text: col + r.row, kind: 'cell', sheet: r.sheet || null, col: col, col2: col, row: r.row, row2: r.row, type: r.type || null, headerName: null, source: 'explicit', tokenIndex: r.tokenIndex, usedBy: r.usedBy }; };
        var a = mk(r.col), b = mk(r.col2); b.tokenIndex = r.tokenIndex + 1;
        // the merged phrase may start at a preposition ("from D2 to E2"): locate the real ref tokens
        var toks = pq.tokens || [], end = r.tokenEnd || r.tokenIndex + 3;
        for (var t = r.tokenIndex; t < Math.min(toks.length, end + 1); t++) {
          if (toks[t] && toks[t].type === 'ref') { var up = String(toks[t].raw || '').toUpperCase().replace(/\$/g, '').replace(/[’'][^]*$/, ''); if (up === a.text) a.tokenIndex = t; else if (up === b.text) b.tokenIndex = t; }
        }
        return [a, b];
      }
    }
    return null;
  };
  /** "E2'yi C2'ye böl" / "Умножь A2 на B2": a dative/accusative cell the parser took for a target is really an operand. */
  H.targetIsOperand = function (pq) {
    var t = pq && pq.target;
    if (!t || !t.ref || t.ref.kind !== 'cell' || H.has(pq, 'WRITE')) return false;
    return H.any(pq, ['DIVIDE', 'MULTIPLY', 'PLUS', 'MINUS', 'ADD', 'CONCAT', 'DIFFERENCE', 'MOD', 'PERCENT_CHANGE', 'PERCENT', 'DATE_DIFF', 'NETWORKDAYS']) && !H.rawHas(pq, /sonucu|результат|result/);
  };
  H.condRef = function (cond, ctx) { return cond && (cond.refObj || cond.ref) ? H.refOf(cond.refObj || cond.ref, ctx) : null; };
  /** Comparison value as an AST node: number, DATE(...) for date literals, string, or the per-row cell of a ref. */
  H.condValue = function (cond, pq, ctx, which) {
    var v = which === 2 ? cond.value2 : cond.value;
    if (which !== 2 && cond.valueRef) { var vr = cond.valueRefObj || cond.valueRef; return H.cellNode(vr, ctx); }
    if (typeof v === 'number') {
      var raw = H.rawOfValue(pq, cond, which), dp = H.dateFromRaw(raw);
      if (dp) return H.dateNode(dp);
      if (cond.isPercent && which !== 2) return A().percent(v);
      return A().num(v);
    }
    var dp2 = H.dateFromRaw(v);
    if (dp2) return H.dateNode(dp2);
    return A().str(v == null ? '' : v);
  };
  function critText(op, valueNode) {
    if (valueNode.t === 'num') return A().str(op + A().formatNumber(valueNode.v, 'en'));
    if (valueNode.t === 'str') return op === '=' ? A().str(valueNode.v) : A().str(op + valueNode.v);
    if (valueNode.t === 'percent') return A().op('&', A().str(op), valueNode);
    return A().op('&', A().str(op), valueNode); // ">"&B2 or ">"&DATE(...)
  }
  /** Criteria for SUMIF/COUNTIF-family per §15.4, as [{ op, crit }] (between → two entries). */
  H.criteria = function (cond, pq, ctx) {
    var op = cond.op;
    if (op === 'empty') return [{ op: op, crit: A().str('') }];
    if (op === 'notEmpty') return [{ op: op, crit: A().str('<>') }];
    if (op === 'between') return [{ op: '>=', crit: critText('>=', H.condValue(cond, pq, ctx, 1)) }, { op: '<=', crit: critText('<=', H.condValue(cond, pq, ctx, 2)) }];
    var v = H.condValue(cond, pq, ctx, 1);
    if (op === 'contains') return [{ op: op, crit: A().str('*' + (v.v == null ? '' : v.v) + '*') }];
    if (op === 'startsWith') return [{ op: op, crit: A().str((v.v == null ? '' : v.v) + '*') }];
    if (op === 'endsWith') return [{ op: op, crit: A().str('*' + (v.v == null ? '' : v.v)) }];
    if (!OPS[op]) op = '=';
    if (op === '=' && v.t === 'num') return [{ op: op, crit: v }];
    return [{ op: op, crit: critText(op, v) }];
  };
  /** [{ range: node, crit: node }] pairs for every condition; `fallback` is used for conditions without their own ref. */
  H.criteriaPairs = function (conds, pq, ctx, fallbackRef, abs) {
    var pairs = [], lastRef = fallbackRef || null;
    for (var i = 0; i < conds.length; i++) {
      var c = conds[i], ref = H.condRef(c, ctx) || lastRef;
      if (ref) lastRef = ref;
      var rangeNode = ref ? H.rangeNode(ref, !!abs) : A().placeholder('criteria_range');
      var list = H.criteria(c, pq, ctx);
      for (var k = 0; k < list.length; k++) pairs.push({ range: rangeNode, crit: list[k].crit, ref: ref, cond: c });
    }
    return pairs;
  };
  /** Per-row (or whole-range when rowwise=false) boolean expression for a condition, e.g. E2>100, B2="Gıda", AND(E2>=100,E2<=500). */
  H.condExpr = function (cond, pq, ctx, fallbackRef, rowwise) {
    rowwise = rowwise !== false;
    var ref = H.condRef(cond, ctx) || fallbackRef || null;
    var cell = ref ? (rowwise ? H.cellNode(ref, ctx) : H.rangeNode(ref, false)) : A().placeholder('cell');
    var op = cond.op;
    if (op === 'empty') return A().op('=', cell, A().str(''));
    if (op === 'notEmpty') return A().op('<>', cell, A().str(''));
    if (op === 'between') return A().func('AND', A().op('>=', cell, H.condValue(cond, pq, ctx, 1)), A().op('<=', cell, H.condValue(cond, pq, ctx, 2)));
    var v = H.condValue(cond, pq, ctx, 1);
    if (op === 'contains') return A().func('ISNUMBER', A().func('SEARCH', v, cell));
    if (op === 'startsWith') return A().op('=', A().func('LEFT', cell, String(v.v == null ? '' : v.v).length), v);
    if (op === 'endsWith') return A().op('=', A().func('RIGHT', cell, String(v.v == null ? '' : v.v).length), v);
    if (!OPS[op]) op = '=';
    return A().op(op, cell, v);
  };
  /** Join boolean expressions with AND/OR (single expression returned as is). */
  H.joinExprs = function (exprs, conj) {
    exprs = exprs.filter(Boolean);
    if (exprs.length === 1) return exprs[0];
    return A().func(conj === 'OR' ? 'OR' : 'AND', exprs);
  };
  /** Conjunction used between the given conditions ('OR' when any explicit OR, else 'AND'). */
  H.conjunction = function (conds, pq) {
    for (var i = 0; i < conds.length; i++) if (conds[i].conjunction === 'OR') return 'OR';
    return H.has(pq, 'OR') && !H.has(pq, 'AND') ? 'OR' : 'AND';
  };
  /** Range-wise product of conditions for classic array formulas: (B2:B200="Gıda")*(H2:H200="Ankara") or a single comparison. */
  H.condProduct = function (conds, pq, ctx, fallbackRef) {
    var exprs = conds.map(function (c) { return H.condExpr(c, pq, ctx, fallbackRef, false); });
    if (exprs.length === 1) return exprs[0];
    var node = A().paren(exprs[0]);
    for (var i = 1; i < exprs.length; i++) node = A().op('*', node, A().paren(exprs[i]));
    return node;
  };

  /* ------------------------------------------------------------------ values (then / else) */
  /** Parser value { kind:'str'|'num'|'ref'|'blank', value } → AST node (null when absent). */
  H.valueNode = function (v, ctx) {
    if (!v) return null;
    if (v.kind === 'blank') return A().str('');
    if (v.kind === 'num') return A().num(v.value);
    if (v.kind === 'ref') return H.cellNode(v.ref || v.value, ctx);
    if (v.kind === 'bool') return A().bool(v.value);
    return A().str(v.value == null ? '' : v.value);
  };
  /** then / else nodes with §15.5 defaults (Evet/Hayır, Да/Нет, Yes/No; "boş bırak" → ""). */
  H.thenElse = function (pq, ctx, opts) {
    var lang = H.lang(pq, opts), blank = H.has(pq, 'BLANK');
    var thenNode = H.valueNode(pq.thenValue, ctx), elseNode = H.valueNode(pq.elseValue, ctx);
    var defaults = { then: !thenNode, else: !elseNode };
    if (!thenNode) thenNode = (blank && elseNode && !(pq.elseValue && pq.elseValue.kind === 'blank')) ? A().str('') : H.word(H.YES, lang);
    if (!elseNode) elseNode = blank ? A().str('') : H.word(H.NO, lang);
    return { then: thenNode, else: elseNode, defaults: defaults };
  };

  /* ------------------------------------------------------------------ targets (§15.2 / §15.3) */
  /** Target for a candidate. kind 'fill' = per-row formula, 'cell' = single result. primary = main ref (for the cell below the data). */
  H.target = function (pq, ctx, kind, primary) {
    var t = pq && pq.target, first = H.firstRow(ctx), last = H.lastRow(ctx);
    if (t && H.targetIsOperand(pq)) t = null;
    if (t && t.cell) {
      if (t.explicitCell || kind === 'cell') return { kind: 'cell', cell: t.cell };
      var col = t.col || U().splitAddress(t.cell).col;
      return { kind: 'fill', cell: col + first, fillRange: last ? col + first + ':' + col + last : col + first };
    }
    if (!ctx) return null;
    if (kind === 'fill') {
      var fc = H.freeCol(ctx) || 'A';
      return { kind: 'fill', cell: fc + first, fillRange: last ? fc + first + ':' + fc + last : fc + first };
    }
    var p = primary ? H.refOf(primary, ctx) : null;
    if (p && !p.sheet && p.col && p.kind !== 'cell') {
      var below = (p.row2 || last || first) + 1;
      return { kind: 'cell', cell: p.col + below };
    }
    var free = H.freeCol(ctx) || 'A';
    return { kind: 'cell', cell: free + first };
  };
  /** Heuristic: should the request be answered per row (fill)? */
  H.rowwise = function (pq, ctx) {
    if (!pq) return false;
    if (pq.flags && pq.flags.eachRow) return true;
    if (pq.target && !pq.target.explicitCell) return true;
    return H.refs(pq, {}).some(function (r) { return r.kind === 'cell'; });
  };

  /* ------------------------------------------------------------------ candidates */
  H.cand = function (id, ast, o) {
    o = o || {};
    return {
      intent: id, confidence: typeof o.confidence === 'number' ? o.confidence : null, ast: ast,
      explain: o.explain || null, assumptions: o.assumptions || [], missing: o.missing || [],
      target: o.target === undefined ? null : o.target, tags: o.tags || [], alternatives: o.alternatives || []
    };
  };
  H.serializeEN = function (ast) { return safe(function () { return A().serialize(ast, { dialect: 'en', withEquals: true, uiLang: 'en' }); }, ''); };
  H.clamp = function (v) { return Math.max(0, Math.min(1, Number(v) || 0)); };
  /** Score builder: base plus bonuses, capped to 1. */
  H.score = function (base) { var s = base; for (var i = 1; i < arguments.length; i++) s += (arguments[i] || 0); return H.clamp(s); };
  H.usesFunction = function (ast, names) {
    names = [].concat(names);
    var used = safe(function () { return A().functionsUsed(ast); }, []);
    for (var i = 0; i < used.length; i++) if (names.indexOf(used[i]) >= 0) return true;
    return false;
  };

  /* ------------------------------------------------------------------ IFERROR wrapping (§15.11) */
  H.errorFallback = function (pq, ctx, opts) {
    var lang = H.lang(pq, opts);
    var idx = H.idx(pq, 'IFERROR');
    // a literal / number / blank after the IFERROR marker
    var lits = H.lits(pq), nums = H.nums(pq);
    var pick = null;
    for (var i = 0; i < lits.length; i++) if (lits[i].tokenIndex > idx && (!lits[i].usedBy || lits[i].usedBy === 'else' || lits[i].usedBy === 'then')) { pick = A().str(lits[i].value); break; }
    if (!pick) for (var j = 0; j < nums.length; j++) if (nums[j].tokenIndex > idx && !nums[j].usedBy && !nums[j].isPercent) { pick = A().num(nums[j].value); break; }
    if (!pick && pq.elseValue && pq.elseValue.tokenIndex > idx) pick = H.valueNode(pq.elseValue, ctx);
    if (!pick && pq.thenValue && pq.thenValue.tokenIndex > idx) pick = H.valueNode(pq.thenValue, ctx);
    if (!pick && H.has(pq, 'BLANK')) pick = A().str('');
    if (!pick && H.rawHas(pq, /\b(0|sıfır|sifir|ноль|zero)\b/) && /(^|[^\d])0([^\d]|$)/.test(pq.text.slice(Math.max(0, (pq.tokens[idx] || { start: 0 }).start)))) pick = A().num(0);
    return pick || A().str('');
  };
  H.wantsIfError = function (pq) { return !!(pq && ((pq.flags && pq.flags.ignoreErrors) || H.has(pq, 'IFERROR') || H.wantsIfNa(pq))); };
  H.wantsIfNa = function (pq) { return H.rawHas(pq, /#(n\/a|yok|н\/д)/) || H.rawHas(pq, /\bifna\b|eğeryoksa|egeryoksa|еснд/); };
  H.wrapError = function (cand, pq, ctx, opts) {
    if (!cand || !cand.ast || cand.handlesError) return cand;
    var fn = H.wantsIfNa(pq) ? 'IFNA' : 'IFERROR';
    if (H.usesFunction(cand.ast, ['IFERROR', 'IFNA'])) return cand;
    var inner = cand.ast, fb = H.errorFallback(pq, ctx, opts);
    cand.ast = A().func(fn, inner, fb);
    var lang = H.lang(pq, opts);
    var fbText = fb.t === 'str' && fb.v === '' ? H.pick(T('boş', 'пусто', 'blank'), lang) : H.serializeEN(fb).slice(1);
    cand.explain = H.msg(T('%x%; hata olursa %f% gösterir.', '%x%; при ошибке показывает %f%.', '%x%; on error shows %f%.'), { x: cand.explain ? H.pick(cand.explain, lang).replace(/\.$/, '') : fn, f: fbText });
    if (cand.tags.indexOf('error') < 0) cand.tags.push('error');
    return cand;
  };

  /* ------------------------------------------------------------------ registry */
  Object.defineProperty(intents, 'list', { get: function () { return registry.slice(); } });
  intents.register = function (defs) {
    defs = [].concat(defs || []);
    for (var i = 0; i < defs.length; i++) {
      var d = defs[i];
      if (!d || !d.id || typeof d.match !== 'function' || typeof d.build !== 'function') continue;
      d.category = d.category || 'meta';
      d.title = d.title || T(d.id, d.id, d.id);
      d.examples = d.examples || { tr: [], ru: [], en: [] };
      if (byId[d.id]) { registry[registry.indexOf(byId[d.id])] = d; } else registry.push(d);
      byId[d.id] = d;
    }
    return registry.length;
  };
  intents.get = function (id) { return byId[id] || null; };
  intents.examples = function (lang) {
    var out = [];
    for (var i = 0; i < registry.length; i++) { var ex = registry[i].examples && registry[i].examples[lang]; if (ex) for (var k = 0; k < ex.length; k++) out.push({ intent: registry[i].id, text: ex[k] }); }
    return out;
  };

  /* ------------------------------------------------------------------ ranking */
  var MISSING_PENALTY = 0.12, FX_BONUS = 0.12, FX_PENALTY = 0.08;
  intents.rank = function (pq, ctx, opts) {
    opts = opts || {};
    if (!pq) return [];
    var all = [], order = 0;
    for (var i = 0; i < registry.length; i++) {
      var def = registry[i];
      var score = safe(function () { return def.match(pq, ctx, opts); }, 0);
      if (!(score > 0)) continue;
      var built = safe(function () { return def.build(pq, ctx, opts); }, null);
      if (!built) continue;
      built = [].concat(built);
      for (var k = 0; k < built.length; k++) {
        var c = built[k];
        if (!c || !c.ast) continue;
        c.intent = c.intent || def.id;
        c.assumptions = c.assumptions || []; c.missing = c.missing || []; c.tags = c.tags || []; c.alternatives = c.alternatives || [];
        var conf = typeof c.confidence === 'number' ? Math.min(c.confidence, Math.max(score, c.confidence - 0.2)) : score;
        conf -= MISSING_PENALTY * c.missing.length;
        c.confidence = Math.max(0.05, H.clamp(conf));
        c._order = order++;
        all.push(c);
      }
    }
    var fx = H.fx(pq);
    if (fx.length) {
      for (var f = 0; f < all.length; f++) {
        var uses = H.usesFunction(all[f].ast, fx);
        all[f].confidence = H.clamp(all[f].confidence + (uses ? FX_BONUS : -FX_PENALTY));
      }
    }
    if (H.wantsIfError(pq)) for (var w = 0; w < all.length; w++) H.wrapError(all[w], pq, ctx, opts);
    all.sort(function (a, b) { return (b.confidence - a.confidence) || (a._order - b._order); });
    var seen = {}, out = [];
    for (var j = 0; j < all.length; j++) {
      var key = H.serializeEN(all[j].ast);
      all[j].formulaKey = key;
      if (seen[key]) { if (out.length && out[0] !== all[j]) continue; }
      seen[key] = true;
      delete all[j]._order;
      out.push(all[j]);
      if (out.length >= 5) break;
    }
    for (var q = 0; q < out.length; q++) {
      out[q].confidence = Math.round(out[q].confidence * 100) / 100;
      var alts = out[q].alternatives || [];
      for (var z = 0; z < alts.length; z++) {
        if (typeof alts[z].confidence !== 'number') alts[z].confidence = Math.max(0.05, out[q].confidence - 0.1);
        if (H.wantsIfError(pq)) H.wrapError(alts[z], pq, ctx, opts);
      }
    }
    return out;
  };

  intents.helpers = H;
  intents.H = H;
  EFS.intents = intents;
  return intents;
});
