/* Formula Studio — EFS.generate: the entry point that turns a request into ranked formula candidates.
 * generate.run(text, ctx, opts) → Result (docs/ARCHITECTURE.md §10)
 *   opts = { dialect:'en'|'tr'|'ru', uiLang:'tr'|'ru'|'en', style:'modern'|'classic' }
 *   kinds: 'empty' | 'explain' (text starts with '=') | 'help' (function help / nothing matched) | 'formula'
 * Every cross-module call (parser, intents, explain, localize, formulaReader, catalog) is resolved lazily and guarded,
 * so a failing explanation never breaks generation. Plain ES2019, UMD-lite wrapper. */
(function (root, factory) {
  var EFS = root.EFS || (root.EFS = {});
  var api = factory(EFS, root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (EFS, root) {
  'use strict';
  var generate = {};
  var DIALECTS = { en: 1, tr: 1, ru: 1 };
  var LANGS = { tr: 1, ru: 1, en: 1 };

  function safe(fn, fallback) { try { var v = fn(); return v === undefined ? fallback : v; } catch (e) { return fallback; } }
  function A() { return EFS.ast; }
  function T(tr, ru, en) { return { tr: tr, ru: ru, en: en }; }
  function pick(obj, lang) { return EFS.util && EFS.util.pick ? EFS.util.pick(obj, lang) : (obj && (obj[lang] || obj.en)) || ''; }

  function detectLang(text) {
    var n = EFS.normalize;
    var r = n && typeof n.detectLanguage === 'function' ? safe(function () { return n.detectLanguage(text); }, null) : null;
    if (LANGS[r]) return r;
    if (/[Ѐ-ӿ]/.test(text)) return 'ru';
    if (/[çğışöüÇĞİŞÖÜ]/.test(text)) return 'tr';
    return 'en';
  }
  function normOpts(opts, text, pq) {
    opts = opts || {};
    var lang = LANGS[opts.uiLang] ? opts.uiLang : ((pq && pq.lang) || detectLang(text));
    return { dialect: DIALECTS[opts.dialect] ? opts.dialect : 'en', uiLang: lang, style: opts.style === 'classic' ? 'classic' : 'modern', excelVersion: opts.excelVersion || null };
  }
  function serialize(ast, dialect, uiLang) {
    return safe(function () { return A().serialize(ast, { dialect: dialect, withEquals: true, uiLang: uiLang }); }, '');
  }
  function explainAst(ast, ctx, o) {
    var ex = EFS.explain;
    if (!ex || typeof ex.explainAST !== 'function') return null;
    return safe(function () { return ex.explainAST(ast, o.uiLang, { headers: ctx && ctx.headers || [], dialect: o.dialect, ctx: ctx }); }, null);
  }
  /** Add formula / formulaEN / explanation to a candidate (and to its alternatives). */
  function decorate(cand, ctx, o, depth) {
    if (!cand || !cand.ast) return cand;
    cand.formulaEN = serialize(cand.ast, 'en', 'en');
    cand.formula = serialize(cand.ast, o.dialect, o.uiLang);
    cand.explanation = explainAst(cand.ast, ctx, o);
    cand.assumptions = cand.assumptions || []; cand.missing = cand.missing || []; cand.tags = cand.tags || [];
    if (!depth && Array.isArray(cand.alternatives)) cand.alternatives = cand.alternatives.map(function (a) { return decorate(a, ctx, o, 1); }).filter(Boolean);
    else if (depth) cand.alternatives = [];
    return cand;
  }
  function result(kind, text, lang, extra) {
    var r = { kind: kind, lang: lang, text: text, candidates: [], best: null, message: null, suggestions: [], pq: null };
    if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) r[k] = extra[k];
    r.best = r.candidates.length ? r.candidates[0] : null;
    return r;
  }

  /* ------------------------------------------------------------------ catalog templates (help mode) */
  var SLOT_BY_ARG = { range: 'range', criteria: 'criteria', criteria_range1: 'criteria_range', criteria_range: 'criteria_range', criteria1: 'criteria', sum_range: 'sum_range', average_range: 'range', lookup_value: 'lookup_value', lookup_array: 'lookup_range', lookup_vector: 'lookup_range', return_array: 'return_range', table_array: 'table_array', col_index_num: 'col_index', row_index_num: 'row', if_not_found: 'not_found', logical_test: 'condition', value_if_true: 'value_if_true', value_if_false: 'value_if_false', value: 'value', value_if_error: 'value', text: 'text', num_chars: 'count', start_num: 'start', old_text: 'old_text', new_text: 'new_text', number: 'number', num_digits: 'decimals', divisor: 'divisor', rate: 'rate', nper: 'nper', pv: 'pv', pmt: 'value', start_date: 'start_date', end_date: 'end_date', date: 'date', serial_number: 'date', unit: 'unit', months: 'number', days: 'number', holidays: 'holidays', array: 'array', delimiter: 'delimiter', format_text: 'format', year: 'number', month: 'number', day: 'number', cell: 'cell', sheet: 'sheet' };
  function slotFor(argName) {
    var key = String(argName || '').toLowerCase().replace(/[\s\[\]…]/g, '').replace(/\d+$/, '');
    return SLOT_BY_ARG[String(argName || '').toLowerCase().replace(/[\s\[\]…]/g, '')] || SLOT_BY_ARG[key] || 'value';
  }
  /** Build a template candidate from a catalog entry: every argument becomes a labelled placeholder. */
  generate.templateFromEntry = function (entry, o) {
    if (!entry || !A()) return null;
    var args = [];
    var list = Array.isArray(entry.args) && entry.args.length ? entry.args : parseSyntaxArgs(entry.syntax);
    for (var i = 0; i < list.length; i++) {
      var a = list[i], name = typeof a === 'string' ? a : a.name;
      var label = typeof a === 'string' ? null : { tr: a.tr || name, ru: a.ru || name, en: name };
      args.push(A().placeholder(slotFor(name), label));
    }
    var ast = A().func(entry.name, args);
    var cand = {
      intent: 'explicit_function_template', confidence: 0.4, ast: ast,
      explain: { tr: pick(entry.desc, 'tr'), ru: pick(entry.desc, 'ru'), en: pick(entry.desc, 'en') },
      assumptions: [], target: null, tags: entry.minVersion ? [String(entry.minVersion)] : [], alternatives: [],
      missing: list.map(function (a) { var n = typeof a === 'string' ? a : a.name; var d = typeof a === 'string' ? null : a.desc; return { slot: slotFor(n), tr: d ? pick(d, 'tr') : n, ru: d ? pick(d, 'ru') : n, en: d ? pick(d, 'en') : n }; })
    };
    return cand;
  };
  function parseSyntaxArgs(syntax) {
    var m = /\(([\s\S]*)\)\s*$/.exec(String(syntax || ''));
    if (!m || !m[1].trim()) return [];
    return m[1].split(',').map(function (s) { return s.replace(/[\[\]\s]/g, ''); }).filter(Boolean);
  }
  function catalogSearch(text, lang, limit) {
    var c = EFS.catalog;
    if (!c || typeof c.search !== 'function') return [];
    return safe(function () { return c.search(text, lang, limit || 6); }, []) || [];
  }
  function catalogByName(name) { var c = EFS.catalog; return c && typeof c.byName === 'function' ? safe(function () { return c.byName(name); }, null) : null; }

  /* ------------------------------------------------------------------ modes */
  function runExplain(text, ctx, o) {
    var reader = EFS.formulaReader, loc = EFS.localize, ex = EFS.explain;
    var ast = reader && typeof reader.parse === 'function' ? safe(function () { return reader.parse(text, 'auto'); }, null) : null;
    var fromDialect = loc && typeof loc.detectDialect === 'function' ? safe(function () { return loc.detectDialect(text); }, 'en') : 'en';
    var cand = null;
    if (ast) {
      cand = { intent: 'explain', confidence: 1, ast: ast, explain: T('Girilen formülün açıklaması.', 'Объяснение введённой формулы.', 'Explanation of the entered formula.'), assumptions: [], missing: [], target: null, tags: [], alternatives: [] };
      cand.formulaEN = serialize(ast, 'en', 'en');
      cand.formula = serialize(ast, o.dialect, o.uiLang);
      cand.explanation = ex && typeof ex.explainFormula === 'function' ? safe(function () { return ex.explainFormula(text, o.uiLang, 'auto', { headers: ctx && ctx.headers || [], dialect: o.dialect, ctx: ctx }); }, null) : null;
      if (!cand.explanation) cand.explanation = explainAst(ast, ctx, o);
    } else {
      var err = ex && typeof ex.explainFormula === 'function' ? safe(function () { return ex.explainFormula(text, o.uiLang, 'auto', {}); }, null) : null;
      cand = { intent: 'explain', confidence: 0.2, ast: null, formula: text, formulaEN: text, explanation: err, explain: T('Formül çözümlenemedi.', 'Не удалось разобрать формулу.', 'The formula could not be parsed.'), assumptions: [], missing: [], target: null, tags: [], alternatives: [] };
    }
    var translations = {};
    ['en', 'tr', 'ru'].forEach(function (d) {
      translations[d] = ast ? serialize(ast, d, d) : (loc && typeof loc.translateFormula === 'function' ? safe(function () { return loc.translateFormula(text, 'auto', d); }, null) : null);
    });
    cand.translations = translations;
    var message = ast ? null : T('Formül sözdizimi anlaşılamadı; parantezleri ve ayırıcıları kontrol edin.', 'Синтаксис формулы не распознан; проверьте скобки и разделители.', 'The formula syntax could not be understood; check parentheses and separators.');
    return result('explain', text, o.uiLang, { candidates: [cand], translations: translations, fromDialect: fromDialect, message: message });
  }

  function helpWanted(pq, text) {
    var fx = (pq && pq.explicitFunctions) || [];
    var has = function (c) { return pq && typeof pq.has === 'function' && pq.has(c); };
    // "С помощью СУММЕСЛИ сложи …" / "… yardımıyla" / "with the help of …" name the tool to use, not a help request
    var instrument = /(^|\s)(с|при)\s+помощ\S*|yard[ıi]m[ıi]yla|with the help of/i.test(text);
    if (fx.length && ((has('HELP') && !instrument) || has('HOW_TO') || has('EXPLAIN') || has('EXAMPLE'))) return fx[0];
    if (fx.length && /nas[ıi]l kullan|ne i[şs]e yarar|nedir\??$|как (использовать|работает|пользоваться)|что делает|для чего|how (to|do i) use|what does .* do|syntax|s[öo]zdizimi|синтаксис/i.test(text)) return fx[0];
    var words = text.replace(/[?!.…]+$/g, '').trim().split(/\s+/);
    if (words.length === 1) { var e = catalogByName(words[0]); if (e && !/^[A-Za-z]{1,3}\d*$/.test(words[0])) return e.name; }
    if (fx.length === 1 && words.length <= 2) return fx[0];
    return null;
  }
  function runHelp(text, pq, ctx, o, fnName) {
    var entry = fnName ? catalogByName(fnName) : null;
    var suggestions = catalogSearch(text, o.uiLang, 6);
    if (entry) { suggestions = [entry].concat(suggestions.filter(function (s) { return s !== entry; })); }
    var candidates = [];
    if (entry) { var tpl = generate.templateFromEntry(entry, o); if (tpl) candidates.push(decorate(tpl, ctx, o)); }
    var message = entry
      ? T('“' + entry.tr + '” (' + entry.name + ') fonksiyonunun kullanımı ve şablonu aşağıda.', 'Ниже — описание и шаблон функции «' + entry.ru + '» (' + entry.name + ').', 'Usage and a template for ' + entry.name + ' are shown below.')
      : T('İsteği bir formüle dönüştüremedim. Aşağıdaki fonksiyonlar yardımcı olabilir; isteği başlık adları ve koşullarla yeniden yazmayı deneyin.', 'Не удалось превратить запрос в формулу. Возможно, помогут функции ниже; попробуйте переформулировать запрос с названиями столбцов и условиями.', 'I could not turn the request into a formula. The functions below may help; try rephrasing with column names and conditions.');
    return result('help', text, o.uiLang, { candidates: candidates, suggestions: suggestions, message: message, pq: pq, functionName: entry ? entry.name : null, entry: entry || null });
  }

  /* ------------------------------------------------------------------ main entry */
  generate.run = function (text, ctx, opts) {
    text = String(text == null ? '' : text).trim();
    var o0 = normOpts(opts, text, null);
    if (!text) return result('empty', text, o0.uiLang, { message: T('Bir istek yazın; örneğin “Tutar sütununu topla”.', 'Введите запрос, например «Сумма по столбцу Сумма».', 'Type a request, for example “Sum the Amount column”.') });
    if (text.charAt(0) === '=') return runExplain(text, ctx, o0);
    var parser = EFS.parser;
    var pq = parser && typeof parser.parse === 'function' ? safe(function () { return parser.parse(text, ctx || null); }, null) : null;
    if (!pq) pq = { lang: detectLang(text), text: text, tokens: [], literals: [], numbers: [], refs: [], concepts: [], conditions: [], explicitFunctions: [], thenValue: null, elseValue: null, target: null, flags: {}, has: function () { return false; } };
    var o = normOpts(opts, text, pq);
    var fnName = helpWanted(pq, text);
    if (fnName) return runHelp(text, pq, ctx, o, fnName);
    var ranked = EFS.intents && typeof EFS.intents.rank === 'function' ? safe(function () { return EFS.intents.rank(pq, ctx || null, o); }, []) : [];
    if (!ranked || !ranked.length) {
      var fx = pq.explicitFunctions || [];
      return runHelp(text, pq, ctx, o, fx.length ? fx[0] : null);
    }
    var candidates = ranked.map(function (c) { return decorate(c, ctx, o); });
    var fx2 = pq.explicitFunctions || [];
    if (fx2.length && candidates.length < 5) {
      var entry = catalogByName(fx2[0]);
      var already = candidates.some(function (c) { return safe(function () { return A().functionsUsed(c.ast).indexOf(entry.name) >= 0; }, false); });
      if (entry && !already) { var tpl = generate.templateFromEntry(entry, o); if (tpl) { tpl.confidence = 0.3; candidates.push(decorate(tpl, ctx, o)); } }
    }
    return result('formula', text, o.uiLang, { candidates: candidates, pq: pq, message: null, suggestions: [] });
  };

  /** Convenience for the UI: regenerate with a different dialect without re-parsing. */
  generate.render = function (cand, dialect, uiLang) {
    if (!cand || !cand.ast) return cand && cand.formula || '';
    return serialize(cand.ast, DIALECTS[dialect] ? dialect : 'en', uiLang || dialect);
  };
  generate.detectLanguage = detectLang;

  EFS.generate = generate;
  return generate;
});
