/* Formula Studio — EFS.evaluator
 * Evaluates EN-dialect formulas against a SheetModel for the result preview.
 * Wraps formulaParser.Parser (vendored hot-formula-parser) and feeds it cell/range values from the sheet model.
 *
 * On top of the raw parser it adds what the preview needs:
 *   - Excel-accurate SUMIF/COUNTIF/AVERAGEIF(S)/MAXIFS/MINIFS criteria (wildcards, case-insensitive, operators),
 *   - lookups (VLOOKUP/HLOOKUP/XLOOKUP/INDEX/MATCH/XMATCH), IFS, DATEDIF, TEXT, TEXTJOIN, VALUE, dynamic arrays,
 *   - dates as Excel serial numbers everywhere (TODAY/NOW/DATE return serials, so date arithmetic works),
 *   - IFERROR/IFNA/ISERROR/ISNUMBER… wrappers (the parser aborts on inner errors, so they are resolved here),
 *   - classic array idioms SUMPRODUCT((r=x)*(r2)), FILTER(range, r="x"), MAX(IF(r="x", r2)),
 *   - whole-column refs (A:A) and cross-sheet refs via the workbook model.
 * Anything else that the parser cannot do is reported as { supported:false } — evaluate() never throws. */
(function (root, factory) {
  var EFS = root.EFS || (root.EFS = {});
  var api = factory(EFS, root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (EFS, root) {
  'use strict';
  var evaluator = {};

  /* ------------------------------------------------------------------ */
  /* Settings, constants                                                  */
  /* ------------------------------------------------------------------ */

  var locale = 'tr';                      // affects TEXT() names, decimal separator in display, UPPER/LOWER
  evaluator.setLocale = function (lang) { if (lang === 'tr' || lang === 'ru' || lang === 'en') locale = lang; return locale; };
  evaluator.getLocale = function () { return locale; };

  var EPOCH = Date.UTC(1899, 11, 30);
  var MS_DAY = 86400000;
  var MAX_DEPTH = 8;                      // nested evaluation of formula cells without cached results
  var VBASE = 10000, VSPAN = 2000;        // virtual column block used to map other sheets' refs (see crossSheet)
  var MAX_VSHEETS = 4;

  var VALID_ERRORS = { '#ERROR!': 1, '#DIV/0!': 1, '#NAME?': 1, '#N/A': 1, '#NUM!': 1, '#VALUE!': 1, '#REF!': 1, '#NULL!': 1 };

  evaluator.MESSAGES = {
    'cross-sheet': { tr: 'Önizleme, başka bir sayfaya başvuran formüller için kullanılamıyor (sayfa bulunamadı).', ru: 'Предпросмотр недоступен для формул со ссылкой на другой лист (лист не найден).', en: 'Preview is unavailable for formulas referring to another sheet (sheet not found).' },
    'placeholder': { tr: 'Formülde doldurulmamış alanlar var; önce eksik bilgileri tamamlayın.', ru: 'В формуле есть незаполненные части; сначала укажите недостающие данные.', en: 'The formula still has unfilled slots; complete the missing information first.' },
    'array-formula': { tr: 'Bu dizi formülü önizlemede hesaplanamıyor; Excel’de doğru çalışır.', ru: 'Эта формула массива не вычисляется в предпросмотре; в Excel она будет работать.', en: 'This array formula cannot be computed in the preview; it works in Excel.' },
    'structured-ref': { tr: 'Tablo başvuruları (Tablo1[Sütun]) önizlemede desteklenmiyor.', ru: 'Структурированные ссылки (Таблица1[Столбец]) не поддерживаются в предпросмотре.', en: 'Structured references (Table1[Column]) are not supported in the preview.' },
    'unsupported': { tr: 'Önizleme bu işlevi desteklemiyor: {names}. Formül Excel’de çalışır.', ru: 'Предпросмотр не поддерживает функцию: {names}. Формула будет работать в Excel.', en: 'The preview does not support this function: {names}. The formula works in Excel.' },
    'syntax': { tr: 'Formül çözümlenemedi (söz dizimi hatası veya desteklenmeyen yapı).', ru: 'Не удалось разобрать формулу (синтаксическая ошибка или неподдерживаемая конструкция).', en: 'The formula could not be parsed (syntax error or unsupported construct).' },
    'no-parser': { tr: 'Formül hesaplayıcı (formula-parser) yüklenemedi.', ru: 'Не удалось загрузить вычислитель формул (formula-parser).', en: 'The formula engine (formula-parser) could not be loaded.' },
    '#DIV/0!': { tr: 'Sıfıra bölme hatası.', ru: 'Деление на ноль.', en: 'Division by zero.' },
    '#N/A': { tr: 'Değer bulunamadı (#YOK).', ru: 'Значение не найдено (#Н/Д).', en: 'Value not available (#N/A).' },
    '#VALUE!': { tr: 'Yanlış türde bir değer kullanıldı (#DEĞER!).', ru: 'Использовано значение неверного типа (#ЗНАЧ!).', en: 'A value of the wrong type was used (#VALUE!).' },
    '#REF!': { tr: 'Geçersiz hücre başvurusu (#BAŞV!).', ru: 'Недопустимая ссылка на ячейку (#ССЫЛКА!).', en: 'Invalid cell reference (#REF!).' },
    '#NAME?': { tr: 'Tanınmayan ad veya işlev (#AD?).', ru: 'Нераспознанное имя или функция (#ИМЯ?).', en: 'Unrecognised name or function (#NAME?).' },
    '#NUM!': { tr: 'Geçersiz sayısal değer (#SAYI!).', ru: 'Недопустимое числовое значение (#ЧИСЛО!).', en: 'Invalid numeric value (#NUM!).' },
    '#NULL!': { tr: 'Kesişmeyen aralıklar (#BOŞ!).', ru: 'Непересекающиеся диапазоны (#ПУСТО!).', en: 'Ranges do not intersect (#NULL!).' },
    '#ERROR!': { tr: 'Formül hesaplanamadı.', ru: 'Не удалось вычислить формулу.', en: 'The formula could not be computed.' }
  };

  /** Trilingual description of an evaluate() result's error (or null when there is none). */
  evaluator.describe = function (result) {
    if (!result || !result.error) return null;
    var key = result.error;
    var m = evaluator.MESSAGES[key] || evaluator.MESSAGES['#ERROR!'];
    if (key === 'unsupported' || (key === '#NAME?' && result.missing && result.missing.length)) {
      var names = (result.missing || []).join(', ') || '?';
      var u = evaluator.MESSAGES.unsupported;
      return { tr: u.tr.replace('{names}', names), ru: u.ru.replace('{names}', names), en: u.en.replace('{names}', names) };
    }
    return { tr: m.tr, ru: m.ru, en: m.en };
  };

  /* ------------------------------------------------------------------ */
  /* Library access                                                       */
  /* ------------------------------------------------------------------ */

  function nodeRequire(name) {
    if (typeof require !== 'function') return null;
    var base = (typeof process !== 'undefined' && process.env && process.env.EFS_NODE_MODULES) || '';
    if (base) { try { return require(base.replace(/\/+$/, '') + '/' + name); } catch (e) { /* fall through */ } }
    try { return require(name); } catch (e2) { return null; }
  }
  var _HFP = null;
  function getHFP() {
    if (_HFP) return _HFP;
    if (root.formulaParser && root.formulaParser.Parser) return (_HFP = root.formulaParser);
    var m = nodeRequire('hot-formula-parser');
    if (m && m.Parser) _HFP = m;
    return _HFP;
  }
  evaluator.getParserCtor = function () { var h = getHFP(); return h ? h.Parser : null; };

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                        */
  /* ------------------------------------------------------------------ */

  function err(code) { var e = new Error(code); e.excel = code; return e; }
  function isArr(v) { return Array.isArray(v); }
  function isBlank(v) { return v === null || v === undefined || v === ''; }
  function toSerial(d) {
    return (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()) - EPOCH) / MS_DAY;
  }
  function fromSerial(n) { return new Date(Math.round(EPOCH + Number(n) * MS_DAY)); }
  evaluator.toSerial = toSerial;
  evaluator.fromSerial = fromSerial;

  function columnLetter(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  function columnIndex(letters) { var n = 0; letters = String(letters).toUpperCase(); for (var i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64); return n; }

  function lower(s) { s = String(s); return locale === 'tr' ? s.toLocaleLowerCase('tr') : s.toLowerCase(); }
  function upper(s) { s = String(s); return locale === 'tr' ? s.toLocaleUpperCase('tr') : s.toUpperCase(); }

  function toMatrix(v) {
    if (!isArr(v)) return [[v]];
    if (!v.length) return [];
    if (!isArr(v[0])) return v.map(function (x) { return [x]; });
    return v;
  }
  function flat(v) {
    if (!isArr(v)) return [v];
    var out = [];
    for (var i = 0; i < v.length; i++) {
      if (isArr(v[i])) { for (var j = 0; j < v[i].length; j++) out.push(v[i][j]); }
      else out.push(v[i]);
    }
    return out;
  }
  function flatAll(params, from) {
    var out = [];
    for (var i = from || 0; i < params.length; i++) out = out.concat(flat(params[i]));
    return out;
  }
  function scalar(v) { return isArr(v) ? flat(v)[0] : v; }

  /** Lenient numeric parsing of text in EN/TR/RU writing. */
  function parseNum(s) {
    if (typeof s !== 'string') return null;
    var W = EFS.workbook;
    if (W && W.parseNumberText) { var p = W.parseNumberText(s); return p ? p.v : null; }
    s = s.trim().replace(/\s/g, '');
    if (/^[-+]?\d+(\.\d+)?$/.test(s)) return parseFloat(s);
    if (/^[-+]?\d+,\d+$/.test(s)) return parseFloat(s.replace(',', '.'));
    return null;
  }
  function parseDate(s) {
    var W = EFS.workbook;
    if (W && W.parseDateText) return W.parseDateText(s);
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(s).trim());
    if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(String(s).trim());
    if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    return null;
  }

  function num(v) {
    if (typeof v === 'number') { if (!isFinite(v)) throw err('#NUM!'); return v; }
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (isBlank(v)) return 0;
    if (v instanceof Date) return toSerial(v);
    if (isArr(v)) return num(flat(v)[0]);
    if (typeof v === 'string') {
      var n = parseNum(v);
      if (n != null) return n;
      var d = parseDate(v);
      if (d) return toSerial(d);
      var t = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(v.trim());
      if (t) return ((+t[1]) * 3600 + (+t[2]) * 60 + (+(t[3] || 0))) / 86400;
    }
    throw err('#VALUE!');
  }
  function int(v) { return Math.floor(num(v)); }
  function str(v) {
    if (isBlank(v)) return '';
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (v instanceof Date) return String(toSerial(v));
    if (isArr(v)) return str(flat(v)[0]);
    if (typeof v === 'number') return numberToText(v);
    return String(v);
  }
  function numberToText(v) {
    var s = String(v);
    if (/e/i.test(s)) { s = v.toFixed(10).replace(/\.?0+$/, ''); }
    return s;
  }
  function bool(v) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (isBlank(v)) return false;
    if (isArr(v)) return bool(flat(v)[0]);
    if (typeof v === 'string') { var u = v.trim().toUpperCase(); if (u === 'TRUE') return true; if (u === 'FALSE') return false; var n = parseNum(v); if (n != null) return n !== 0; throw err('#VALUE!'); }
    return !!v;
  }
  function optional(params, i) { return params.length > i && params[i] !== undefined; }

  /* ------------------------------------------------------------------ */
  /* Formula text scanning                                                */
  /* ------------------------------------------------------------------ */

  /** Split into segments {str, text}; single-quoted runs count as strings when singleAsString is true. */
  function segments(text, singleAsString) {
    var out = [], i = 0, n = text.length, buf = '';
    function flush() { if (buf) { out.push({ str: false, text: buf }); buf = ''; } }
    while (i < n) {
      var ch = text[i];
      if (ch === '"') {
        flush();
        var j = i + 1, lit = '"';
        while (j < n) {
          if (text[j] === '"') { if (text[j + 1] === '"') { lit += '""'; j += 2; continue; } lit += '"'; j++; break; }
          lit += text[j]; j++;
        }
        out.push({ str: true, text: lit }); i = j; continue;
      }
      if (ch === "'") {
        var k = i + 1, q = "'";
        while (k < n) {
          if (text[k] === "'") { if (text[k + 1] === "'") { q += "''"; k += 2; continue; } q += "'"; k++; break; }
          q += text[k]; k++;
        }
        if (singleAsString) { flush(); out.push({ str: true, text: q }); }
        else buf += q;
        i = k; continue;
      }
      buf += ch; i++;
    }
    flush();
    return out;
  }
  function mapCode(text, fn, singleAsString) {
    return segments(text, singleAsString).map(function (s) { return s.str ? s.text : fn(s.text); }).join('');
  }
  function codeOnly(text, singleAsString) {
    return segments(text, singleAsString).map(function (s) { return s.str ? ' ' : s.text; }).join('');
  }

  /** Index of the ')' matching the '(' at openIdx, string-aware; -1 when unbalanced. */
  function matchParen(text, openIdx) {
    var depth = 0, i = openIdx, n = text.length;
    while (i < n) {
      var ch = text[i];
      if (ch === '"' || ch === "'") {
        var j = i + 1;
        while (j < n) { if (text[j] === ch) { if (text[j + 1] === ch) { j += 2; continue; } break; } j++; }
        i = j + 1; continue;
      }
      if (ch === '(') depth++;
      else if (ch === ')') { depth--; if (depth === 0) return i; }
      i++;
    }
    return -1;
  }

  /** Split a call body into top-level arguments (string/paren aware). */
  function splitTop(text, sep) {
    var out = [], depth = 0, cur = '', i = 0, n = text.length;
    while (i < n) {
      var ch = text[i];
      if (ch === '"' || ch === "'") {
        var j = i + 1;
        while (j < n) { if (text[j] === ch) { if (text[j + 1] === ch) { j += 2; continue; } break; } j++; }
        cur += text.slice(i, j + 1); i = j + 1; continue;
      }
      if (ch === '(' || ch === '{') depth++;
      else if (ch === ')' || ch === '}') depth--;
      if (depth === 0 && ch === sep) { out.push(cur); cur = ''; i++; continue; }
      cur += ch; i++;
    }
    out.push(cur);
    return out;
  }
  function splitArgs(body) { return body.trim() === '' ? [] : splitTop(body, ','); }

  /** Last call of one of `names` starting before `limit`: {name, start, open, close} or null. */
  function lastCall(text, names, limit) {
    var re = new RegExp('(?<![A-Za-z0-9_.])(' + names.join('|').replace(/\./g, '\\.') + ')\\s*\\(', 'gi');
    var code = codeOnly(text, true), m, best = null;
    while ((m = re.exec(code))) {
      if (m.index >= limit) break;
      var open = m.index + m[0].length - 1;
      var close = matchParen(text, open);
      if (close < 0) continue;
      best = { name: m[1].toUpperCase(), start: m.index, open: open, close: close };
    }
    return best;
  }

  var RANGE_RE_SRC = '\\$?[A-Za-z]{1,3}\\$?\\d+:\\$?[A-Za-z]{1,3}\\$?\\d+';
  var CELL_RE_SRC = '\\$?[A-Za-z]{1,3}\\$?\\d+';
  function isRangeToken(s) { return new RegExp('^' + RANGE_RE_SRC + '$').test(s.trim()); }
  function stripParens(s) {
    s = s.trim();
    while (s[0] === '(' && matchParen(s, 0) === s.length - 1) s = s.slice(1, -1).trim();
    return s;
  }

  /* ------------------------------------------------------------------ */
  /* Preparation pipeline                                                 */
  /* ------------------------------------------------------------------ */

  function stripEquals(f) { return String(f == null ? '' : f).replace(/^\s*=\s*/, '').trim(); }

  function sheetByName(wb, name) {
    if (!wb || !wb.sheets) return null;
    var want = String(name).replace(/''/g, "'");
    var fold = EFS.normalize && EFS.normalize.fold ? EFS.normalize.fold : function (s) { return String(s).toLowerCase(); };
    for (var i = 0; i < wb.sheets.length; i++) if (wb.sheets[i].name === want) return wb.sheets[i];
    for (var j = 0; j < wb.sheets.length; j++) if (fold(wb.sheets[j].name) === fold(want)) return wb.sheets[j];
    return null;
  }

  var SHEET_REF_RE = /(?:'((?:[^']|'')+)'|([A-Za-z_À-ɏЀ-ӿ][\w.À-ɏЀ-ӿ]*))!(\$?[A-Za-z]{1,3}\$?\d+(?::\$?[A-Za-z]{1,3}\$?\d+)?|\$?[A-Za-z]{1,3}:\$?[A-Za-z]{1,3}|\$?\d+:\$?\d+)/g;

  function sheetDims(sheet) {
    var rows = Math.max(1, (sheet && (sheet.rowCount || sheet.lastRow)) || 1);
    var cols = Math.max(1, (sheet && sheet.colCount) || 1);
    return { rows: rows, cols: cols };
  }

  function expandWhole(ref, dims) {
    var m = /^(\$?)([A-Za-z]{1,3}):(\$?)([A-Za-z]{1,3})$/.exec(ref);
    if (m) return m[1] + m[2].toUpperCase() + (m[1] ? '$' : '') + '1:' + m[3] + m[4].toUpperCase() + (m[3] ? '$' : '') + dims.rows;
    m = /^(\$?)(\d+):(\$?)(\d+)$/.exec(ref);
    if (m) return (m[1] ? '$' : '') + 'A' + m[1] + m[2] + ':' + (m[3] ? '$' : '') + columnLetter(dims.cols) + m[3] + m[4];
    return ref;
  }

  function shiftColumns(ref, offset) {
    return ref.replace(/(\$?)([A-Za-z]{1,3})(\$?)(\d+)/g, function (all, dc, col, dr, row) {
      return dc + columnLetter(columnIndex(col) + offset) + dr + row;
    });
  }

  /** Rewrite Sheet!A1 refs into a virtual column block; returns {text, vsheets} or {error}. */
  function crossSheet(text, env) {
    var vsheets = [], failed = null;
    var out = mapCode(text, function (code) {
      return code.replace(SHEET_REF_RE, function (all, quoted, bare, ref) {
        if (failed) return all;
        var name = quoted != null ? quoted : bare;
        var sheet = sheetByName(env.wb, name);
        if (!sheet) { failed = 'cross-sheet'; return all; }
        var slot = vsheets.indexOf(sheet);
        if (slot < 0) { if (vsheets.length >= MAX_VSHEETS) { failed = 'cross-sheet'; return all; } vsheets.push(sheet); slot = vsheets.length - 1; }
        var dims = sheetDims(sheet);
        var full = expandWhole(ref, dims);
        var maxCol = 0;
        full.replace(/[A-Za-z]{1,3}(?=\$?\d)/g, function (c) { maxCol = Math.max(maxCol, columnIndex(c)); return c; });
        if (maxCol > VSPAN) { failed = 'cross-sheet'; return all; }
        return shiftColumns(full, VBASE + slot * VSPAN);
      });
    }, false);
    if (failed) return { error: failed };
    return { text: out, vsheets: vsheets };
  }

  function expandLocalWhole(text, env) {
    var dims = sheetDims(env.sheet);
    return mapCode(text, function (code) {
      code = code.replace(/(?<![\w!'.:$À-ɏЀ-ӿ])(\$?)([A-Za-z]{1,3}):(\$?)([A-Za-z]{1,3})(?![\w(])/g, function (all, d1, c1, d2, c2) {
        return expandWhole(d1 + c1 + ':' + d2 + c2, dims);
      });
      code = code.replace(/(?<![\w!'.:$])(\$?)(\d+):(\$?)(\d+)(?![\w:])/g, function (all, d1, r1, d2, r2) {
        return expandWhole(d1 + r1 + ':' + d2 + r2, dims);
      });
      return code;
    }, false);
  }

  var ALIASES = {
    'PERCENTILE.INC': 'PERCENTILEINC', 'PERCENTILE.EXC': 'PERCENTILEEXC', 'PERCENTILE': 'PERCENTILEINC',
    'PERCENTRANK.INC': 'PERCENTRANKINC', 'PERCENTRANK.EXC': 'PERCENTRANKEXC', 'PERCENTRANK': 'PERCENTRANKINC',
    'QUARTILE': 'QUARTILE.INC', 'CEILING.MATH': 'CEILINGMATH', 'CEILING.PRECISE': 'CEILINGPRECISE', 'ISO.CEILING': 'CEILINGPRECISE',
    'FLOOR.MATH': 'FLOOR', 'FLOOR.PRECISE': 'FLOOR', 'STDEV': 'STDEV.S', 'VAR': 'VAR.S', 'MODE': 'MODE.SNGL',
    'FORECAST.LINEAR': 'FORECAST', 'COVAR': 'COVARIANCE.P', 'BINOMDIST': 'BINOM.DIST', 'NORMDIST': 'NORM.DIST',
    'NORMSDIST': 'NORM.S.DIST', 'NORMINV': 'NORM.INV', 'CONFIDENCE.NORM': 'CONFIDENCE', 'CRITBINOM': 'BINOM.INV',
    'WORKDAY.INTL': 'WORKDAY', 'NETWORKDAYS.INTL': 'NETWORKDAYS'
  };
  function applyAliases(text) {
    return mapCode(text, function (code) {
      return code.replace(/(?<![A-Za-z0-9_.])([A-Za-z][A-Za-z0-9_.]*)(\s*\()/g, function (all, name, p) {
        var u = name.toUpperCase();
        return ALIASES.hasOwnProperty(u) ? ALIASES[u] + p : all;
      });
    }, true);
  }

  /** The parser has no "" escape inside strings: move such literals to single quotes. */
  function normalizeStrings(text) {
    return segments(text, false).map(function (s) {
      if (!s.str || s.text.indexOf('""') < 0 || s.text.length < 4) return s.text;
      var inner = s.text.slice(1, -1).replace(/""/g, '"');
      if (inner.indexOf("'") < 0) return "'" + inner + "'";
      return '"' + inner.replace(/"/g, '”') + '"';
    }).join('');
  }

  /** Literal text for a scalar value (used when substituting resolved sub-expressions). */
  function literal(v) {
    if (v instanceof Date) v = toSerial(v);
    if (typeof v === 'number') { var s = numberToText(v); return v < 0 ? '(' + s + ')' : s; }
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (isBlank(v)) return '""';
    if (isArr(v)) return null;
    var t = String(v);
    if (t.indexOf('"') < 0) return '"' + t + '"';
    if (t.indexOf("'") < 0) return "'" + t + "'";
    return '"' + t.replace(/"/g, '”') + '"';
  }

  var CMP_RE = new RegExp('^(' + RANGE_RE_SRC + ')\\s*(<>|>=|<=|=|<|>)\\s*([\\s\\S]+)$');
  var CMP_REV_RE = new RegExp('^([\\s\\S]+?)\\s*(<>|>=|<=|=|<|>)\\s*(' + RANGE_RE_SRC + ')$');
  var FLIP = { '<': '>', '>': '<', '<=': '>=', '>=': '<=', '=': '=', '<>': '<>' };

  /** `(range op value)` / `--(range op value)` → { range, op, value } or null. */
  function parseComparison(s) {
    s = stripParens(s);
    var m = /^--\s*\(([\s\S]*)\)$/.exec(s) || /^N\(([\s\S]*)\)$/i.exec(s) || /^1\*\(([\s\S]*)\)$/.exec(s) || /^\(([\s\S]*)\)\*1$/.exec(s);
    if (m && matchParen('(' + m[1] + ')', 0) === m[1].length + 1) s = stripParens(m[1]);
    var c = CMP_RE.exec(s);
    if (c && splitTop(c[3], ',').length === 1 && !/[()]/.test(codeOnly(c[3], true).replace(/\([^()]*\)/g, ''))) return { range: c[1], op: c[2], value: c[3].trim() };
    c = CMP_REV_RE.exec(s);
    if (c && splitTop(c[1], ',').length === 1 && !isRangeToken(c[1])) return { range: c[3], op: FLIP[c[2]], value: c[1].trim() };
    return null;
  }
  function cmpCall(fn, c) { return fn + '(' + c.range + ',"' + c.op + '",' + c.value + ')'; }

  function factorsOf(expr) {
    var parts = splitTop(stripParens(expr), '*');
    return parts.map(function (p) { return p.trim(); });
  }

  /** Rewrite classic array idioms into EFS_* helper calls. */
  function rewriteArrayIdioms(text) {
    var limit = text.length, guard = 0;
    while (guard++ < 50) {
      var call = lastCall(text, ['SUMPRODUCT', 'FILTER', 'MAX', 'MIN', 'SUM', 'AVERAGE', 'COUNT', 'MEDIAN', 'LARGE', 'SMALL'], limit);
      if (!call) break;
      limit = call.start;
      var body = text.slice(call.open + 1, call.close);
      var args = splitArgs(body);
      var replaced = null;
      if (call.name === 'SUMPRODUCT') {
        var newArgs = [];
        var uniq = args.length === 1 && new RegExp('^1\\s*/\\s*COUNTIF\\(\\s*(' + RANGE_RE_SRC + ')\\s*,\\s*\\1\\s*\\)$', 'i').exec(stripParens(args[0]));
        if (uniq) { text = text.slice(0, call.start) + 'COUNTUNIQUE(' + uniq[1] + ')' + text.slice(call.close + 1); continue; }
        for (var i = 0; i < args.length; i++) {
          var factors = factorsOf(args[i]);
          if (factors.length === 1) {
            var c1 = parseComparison(factors[0]);
            newArgs.push(c1 ? cmpCall('EFS_CMPN', c1) : args[i]);
            continue;
          }
          var ok = true, conv = [];
          for (var f = 0; f < factors.length; f++) {
            var fc = parseComparison(factors[f]);
            if (fc) conv.push(cmpCall('EFS_CMPN', fc));
            else if (isRangeToken(stripParens(factors[f]))) conv.push(stripParens(factors[f]));
            else { ok = false; break; }
          }
          newArgs.push(ok ? conv.join(',') : args[i]);
        }
        replaced = 'SUMPRODUCT(' + newArgs.join(',') + ')';
      } else if (call.name === 'FILTER' && args.length >= 2) {
        var inc = args[1];
        var andParts = factorsOf(inc);
        var mask = null;
        if (andParts.length > 1) {
          var cs = andParts.map(parseComparison);
          if (cs.every(Boolean)) mask = 'EFS_ALL(' + cs.map(function (c) { return cmpCall('EFS_CMP', c); }).join(',') + ')';
        } else {
          var orParts = splitTop(stripParens(inc), '+').map(function (p) { return p.trim(); });
          if (orParts.length > 1) {
            var os = orParts.map(parseComparison);
            if (os.every(Boolean)) mask = 'EFS_ANY(' + os.map(function (c) { return cmpCall('EFS_CMP', c); }).join(',') + ')';
          } else {
            var single = parseComparison(inc);
            if (single) mask = cmpCall('EFS_CMP', single);
          }
        }
        if (mask) { args[1] = mask; replaced = 'FILTER(' + args.join(',') + ')'; }
      } else if (args.length >= 1 && /^IF\s*\(/i.test(args[0].trim())) {
        var ifText = args[0].trim();
        var ifOpen = ifText.indexOf('(');
        var ifClose = matchParen(ifText, ifOpen);
        if (ifClose === ifText.length - 1) {
          var ifArgs = splitArgs(ifText.slice(ifOpen + 1, ifClose));
          if (ifArgs.length >= 2 && ifArgs.length <= 3 && (ifArgs.length === 2 || /^\s*(""|''|0)?\s*$/.test(ifArgs[2]))) {
            var conds = factorsOf(ifArgs[0]).map(parseComparison);
            var valueRange = stripParens(ifArgs[1]);
            if (conds.every(Boolean) && isRangeToken(valueRange)) {
              args[0] = 'EFS_FILTERBY(' + valueRange + ',' + conds.map(function (c) { return cmpCall('EFS_CMP', c); }).join(',') + ')';
              replaced = call.name + '(' + args.join(',') + ')';
            }
          }
        }
      }
      if (replaced != null) text = text.slice(0, call.start) + replaced + text.slice(call.close + 1);
    }
    return text;
  }

  /** Index of the next `ch` outside string literals, or -1. */
  function indexOutsideStrings(text, ch, from) {
    var i = from || 0, n = text.length;
    while (i < n) {
      var c = text[i];
      if (c === '"' || c === "'") {
        var j = i + 1;
        while (j < n) { if (text[j] === c) { if (text[j + 1] === c) { j += 2; continue; } break; } j++; }
        i = j + 1; continue;
      }
      if (c === ch) return i;
      i++;
    }
    return -1;
  }

  /** Array constants {1,2;3,4} are not in the parser grammar: turn them into EFS_ARRAY(rows,cols,...) calls. */
  function rewriteArrayConstants(text) {
    var from = 0, guard = 0;
    while (guard++ < 50) {
      var open = indexOutsideStrings(text, '{', from);
      if (open < 0) break;
      var close = indexOutsideStrings(text, '}', open + 1);
      if (close < 0) break;
      var rows = splitTop(text.slice(open + 1, close), ';').map(function (r) { return splitTop(r, ',').map(function (v) { return v.trim(); }); });
      var cols = rows[0].length;
      if (!rows.every(function (r) { return r.length === cols; })) { from = close + 1; continue; }
      var call = 'EFS_ARRAY(' + rows.length + ',' + cols + ',' + rows.map(function (r) { return r.join(','); }).join(',') + ')';
      text = text.slice(0, open) + call + text.slice(close + 1);
      from = open + call.length;
    }
    return text;
  }

  var LEFTOVER_RE = new RegExp('(' + RANGE_RE_SRC + ')\\s*(<>|>=|<=|=|<|>)|(<>|>=|<=|=|<|>)\\s*(' + RANGE_RE_SRC + ')(?![\\w(])');
  function hasRangeComparison(text) { return LEFTOVER_RE.test(codeOnly(text, true)); }

  var _supportedSet = null;
  function supportedSet() {
    if (_supportedSet) return _supportedSet;
    var set = Object.create(null);
    var h = getHFP();
    var list = (h && h.SUPPORTED_FORMULAS) || [];
    for (var i = 0; i < list.length; i++) set[String(list[i]).toUpperCase()] = true;
    Object.keys(CUSTOM).forEach(function (k) { set[k] = true; });
    WRAPPERS.forEach(function (k) { set[k] = true; });
    ['TRUE', 'FALSE', 'NULL'].forEach(function (k) { set[k] = true; });
    _supportedSet = set;
    return set;
  }
  function functionsIn(text) {
    var code = codeOnly(text, true), re = /(?<![A-Za-z0-9_.])([A-Za-z_][A-Za-z0-9_.]*)\s*\(/g, m, out = [];
    while ((m = re.exec(code))) { var u = m[1].toUpperCase(); if (out.indexOf(u) < 0) out.push(u); }
    return out;
  }

  /** { supported, missing:[names] } — which functions of a formula the preview cannot compute. */
  evaluator.isSupported = function (formulaEN) {
    var text = applyAliases(stripEquals(formulaEN));
    var set = supportedSet();
    var missing = functionsIn(text).filter(function (n) { return !set[n]; });
    return { supported: missing.length === 0, missing: missing };
  };
  evaluator.supportedFunctions = function () { return Object.keys(supportedSet()).filter(function (n) { return n.indexOf('EFS_') !== 0; }).sort(); };

  /* ------------------------------------------------------------------ */
  /* Environment and value access                                         */
  /* ------------------------------------------------------------------ */

  var EMPTY = { v: null, f: null, t: 'z' };

  function recAt(sheet, row, col) {
    if (!sheet) return EMPTY;
    if (typeof sheet.cellAt === 'function') return sheet.cellAt(row, col) || EMPTY;
    if (typeof sheet.getCell === 'function') return sheet.getCell(columnLetter(col) + row) || EMPTY;
    return EMPTY;
  }

  function makeEnv(sheet, wb, depth, parent) {
    return {
      sheet: sheet, wb: wb, depth: depth || 0, vsheets: [],
      cache: parent ? parent.cache : Object.create(null),
      stack: parent ? parent.stack : Object.create(null)
    };
  }

  function formulaCellValue(env, sheet, row, col, rec) {
    var key = (sheet.index != null ? sheet.index : sheet.name) + ':' + row + ':' + col;
    if (key in env.cache) return env.cache[key];
    if (env.stack[key]) throw err('#REF!');
    if (env.depth >= MAX_DEPTH) return null;
    env.stack[key] = true;
    var r;
    try { r = evalText(rec.f, makeEnv(sheet, env.wb, env.depth + 1, env)); }
    finally { delete env.stack[key]; }
    if (r.error) throw err(VALID_ERRORS[r.error] ? r.error : '#VALUE!');
    var v = r.value;
    if (v instanceof Date) v = toSerial(v);
    if (isArr(v)) v = flat(v)[0];
    if (v === undefined) v = null;
    env.cache[key] = v;
    return v;
  }

  function cellValue(env, row, col, inRange) {
    var sheet = env.sheet;
    if (col > VBASE) {
      var slot = Math.floor((col - VBASE - 1) / VSPAN);
      col = ((col - VBASE - 1) % VSPAN) + 1;
      sheet = env.vsheets[slot];
      if (!sheet) throw err('#REF!');
    }
    var rec = recAt(sheet, row, col);
    switch (rec.t) {
      case 'n': return rec.v;
      case 's': return rec.v;
      case 'b': return rec.v;
      case 'd': return rec.v instanceof Date ? toSerial(rec.v) : rec.v;
      case 'e': throw err(VALID_ERRORS[rec.v] ? rec.v : '#VALUE!');
      default:
        if (rec.f) { var v = formulaCellValue(env, sheet, row, col, rec); return v === null && !inRange ? '' : v; }
        return inRange ? null : '';
    }
  }

  function rangeValues(env, s, e) {
    var out = [];
    for (var r = s.row.index; r <= e.row.index; r++) {
      var row = [];
      for (var c = s.column.index; c <= e.column.index; c++) row.push(cellValue(env, r + 1, c + 1, true));
      out.push(row);
    }
    return out;
  }

  var parsers = [], envStack = [];
  function getParser(depth) {
    if (parsers[depth]) return parsers[depth];
    var Parser = evaluator.getParserCtor();
    if (!Parser) return null;
    var p = new Parser();
    Object.keys(CUSTOM).forEach(function (name) {
      p.setFunction(name, function (params) { return CUSTOM[name](params || [], envStack[depth]); });
    });
    p.on('callCellValue', function (coord, done) { done(cellValue(envStack[depth], coord.row.index + 1, coord.column.index + 1, false)); });
    p.on('callRangeValue', function (s, e, done) { done(rangeValues(envStack[depth], s, e)); });
    parsers[depth] = p;
    return p;
  }

  /** Parse prepared text with the parser; returns { value, error }. */
  function rawEval(text, env) {
    var p = getParser(env.depth);
    if (!p) return { value: null, error: '#ERROR!' };
    envStack[env.depth] = env;
    var r;
    try { r = p.parse(text); }
    catch (e) { return { value: null, error: (e && VALID_ERRORS[e.message]) ? e.message : '#ERROR!' }; }
    if (r.error) return { value: null, error: r.error };
    return { value: r.result === undefined ? null : r.result, error: null };
  }

  var WRAPPERS = ['IFERROR', 'IFNA', 'ISERROR', 'ISERR', 'ISNA', 'ISNUMBER', 'ISTEXT', 'ISNONTEXT', 'ISLOGICAL'];

  /** Resolve error-tolerant wrapper calls bottom-up by evaluating their arguments separately. */
  function resolveWrappers(text, env) {
    var limit = text.length, guard = 0;
    while (guard++ < 60) {
      var call = lastCall(text, WRAPPERS, limit);
      if (!call) break;
      limit = call.start;
      var args = splitArgs(text.slice(call.open + 1, call.close));
      if (!args.length) continue;
      var inner = rawEval(args[0], env);
      var out;
      switch (call.name) {
        case 'IFERROR':
          out = inner.error ? (args.length > 1 ? rawEval(args[1], env) : { value: '', error: null }) : inner; break;
        case 'IFNA':
          out = inner.error === '#N/A' ? (args.length > 1 ? rawEval(args[1], env) : { value: '', error: null }) : inner; break;
        case 'ISERROR': out = { value: !!inner.error, error: null }; break;
        case 'ISERR': out = { value: !!inner.error && inner.error !== '#N/A', error: null }; break;
        case 'ISNA': out = { value: inner.error === '#N/A', error: null }; break;
        case 'ISNUMBER': out = { value: !inner.error && typeof scalar(inner.value) === 'number', error: null }; break;
        case 'ISTEXT': out = { value: !inner.error && typeof scalar(inner.value) === 'string' && scalar(inner.value) !== '', error: null }; break;
        case 'ISNONTEXT': out = { value: !!inner.error || !(typeof scalar(inner.value) === 'string' && scalar(inner.value) !== ''), error: null }; break;
        case 'ISLOGICAL': out = { value: !inner.error && typeof scalar(inner.value) === 'boolean', error: null }; break;
        default: continue;
      }
      var lit;
      if (out.error) lit = VALID_ERRORS[out.error] ? out.error : '#VALUE!';
      else { lit = literal(out.value); if (lit == null) continue; }
      text = text.slice(0, call.start) + lit + text.slice(call.close + 1);
    }
    return text;
  }

  /** Core: prepare + evaluate prepared text in env. Returns { value, error, supported, missing, prepared }. */
  function evalText(formula, env) {
    var text = stripEquals(formula);
    if (!text) return { value: null, error: null, supported: true, prepared: '' };
    if (/[«»‹›]/.test(text)) return { value: null, error: 'placeholder', supported: false, prepared: text };
    if (!evaluator.getParserCtor()) return { value: null, error: 'no-parser', supported: false, prepared: text };

    // Formulas written in another dialect (names/separators) are translated to EN when the localizer is loaded.
    var L = EFS.localize;
    if (L && typeof L.detectDialect === 'function' && typeof L.translateFormula === 'function') {
      try {
        var d = L.detectDialect(text);
        if (d && d !== 'en') { var tr = L.translateFormula(text, d, 'en'); if (tr) text = stripEquals(tr); }
      } catch (e) { /* keep text */ }
    }
    if (/\[@|[A-Za-z0-9_]\[[^\]]*\]/.test(codeOnly(text, false))) return { value: null, error: 'structured-ref', supported: false, prepared: text };

    var cs = crossSheet(text, env);
    if (cs.error) return { value: null, error: cs.error, supported: false, prepared: text };
    env.vsheets = cs.vsheets;
    text = expandLocalWhole(cs.text, env);
    text = applyAliases(text);
    text = normalizeStrings(text);
    text = rewriteArrayConstants(text);
    text = rewriteArrayIdioms(text);
    if (hasRangeComparison(text)) return { value: null, error: 'array-formula', supported: false, prepared: text };

    var set = supportedSet();
    var missing = functionsIn(text).filter(function (n) { return !set[n]; });
    if (missing.length) return { value: null, error: '#NAME?', supported: false, missing: missing, prepared: text };

    text = resolveWrappers(text, env);
    var r = rawEval(text, env);
    if (r.error === '#NAME?') return { value: null, error: '#NAME?', supported: false, missing: [], prepared: text };
    if (r.error === '#ERROR!') return { value: null, error: '#ERROR!', supported: false, prepared: text };
    return { value: r.value, error: r.error, supported: true, prepared: text };
  }

  /* ------------------------------------------------------------------ */
  /* Result typing and display                                            */
  /* ------------------------------------------------------------------ */

  var DATE_FUNCS = /^(TODAY|NOW|DATE|EDATE|EOMONTH|WORKDAY|DATEVALUE|WORKDAY\.INTL)$/;
  var NUMERIC_FUNCS = /^(DATEDIF|DAYS|DAYS360|NETWORKDAYS|NETWORKDAYS\.INTL|YEAR|MONTH|DAY|WEEKDAY|WEEKNUM|ISOWEEKNUM|HOUR|MINUTE|SECOND|COUNT|COUNTA|COUNTIF|COUNTIFS|COUNTBLANK|SUM|SUMIF|SUMIFS|SUMPRODUCT|LEN|ROUND|ROUNDUP|ROUNDDOWN|ABS|MOD|RANK|RANK\.EQ|RANK\.AVG|LARGE|SMALL|INT|VALUE|YEARFRAC|AVERAGE|AVERAGEIF|AVERAGEIFS|MEDIAN|STDEV\.S|STDEV\.P|VAR\.S|VAR\.P|ROWS|COLUMNS|FIND|SEARCH|PMT|FV|PV|NPV|IRR)$/;

  function outermostFunction(text) {
    var m = /^\s*([A-Za-z_][A-Za-z0-9_.]*)\s*\(/.exec(text);
    if (!m) return null;
    var open = text.indexOf('(');
    return matchParen(text, open) === text.trim().length - 1 ? m[1].toUpperCase() : null;
  }

  function referencesDate(text, env) {
    var code = codeOnly(text, true), re = /(?<![A-Za-z0-9_.])\$?([A-Za-z]{1,3})\$?(\d+)/g, m;
    while ((m = re.exec(code))) {
      var col = columnIndex(m[1]), row = +m[2];
      if (col > VBASE) continue;
      var rec = recAt(env.sheet, row, col);
      if (rec.t === 'd') return true;
      if (rec.t === 'n' && rec.numFmt && EFS.workbook && EFS.workbook.isDateFormat && EFS.workbook.isDateFormat(rec.numFmt)) return true;
    }
    return false;
  }

  function looksLikeDate(text, value, env) {
    if (typeof value !== 'number' || value < 20000 || value >= 120000) return false;
    var outer = outermostFunction(text);
    if (outer && DATE_FUNCS.test(outer)) return true;
    if (outer && NUMERIC_FUNCS.test(outer)) return false;
    var code = codeOnly(text, true);
    if (/[*\/^]/.test(code)) return false;
    var names = functionsIn(text);
    for (var i = 0; i < names.length; i++) if (NUMERIC_FUNCS.test(names[i])) return false;
    return referencesDate(text, env);
  }

  function decimalSep(lang) { return lang === 'en' ? '.' : ','; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function formatNumberDisplay(v, lang) {
    if (!isFinite(v)) return String(v);
    var neg = v < 0, abs = Math.abs(v);
    var text = abs >= 1e15 ? String(abs) : (Math.round(abs * 10000) / 10000).toFixed(4).replace(/\.?0+$/, '');
    return (neg ? '-' : '') + text.replace('.', decimalSep(lang));
  }
  function formatDateDisplay(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return '';
    var s = pad2(d.getUTCDate()) + '.' + pad2(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear();
    if (d.getUTCHours() || d.getUTCMinutes() || d.getUTCSeconds()) s += ' ' + pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes());
    return s;
  }
  function boolDisplay(v, lang) {
    if (lang === 'tr') return v ? 'DOĞRU' : 'YANLIŞ';
    if (lang === 'ru') return v ? 'ИСТИНА' : 'ЛОЖЬ';
    return v ? 'TRUE' : 'FALSE';
  }
  function errorDisplay(code, lang) {
    var L = EFS.localize;
    if (L && typeof L.errName === 'function' && VALID_ERRORS[code]) { try { return L.errName(code, lang) || code; } catch (e) { return code; } }
    return code;
  }

  /** Human-readable text for a computed value. opts: { type, lang } */
  function formatValue(value, opts) {
    opts = opts || {};
    var lang = opts.lang || locale;
    if (value === null || value === undefined || value === '') return '';
    if (value instanceof Date) return formatDateDisplay(value);
    if (isArr(value)) {
      var items = flat(value), shown = items.slice(0, 6).map(function (x) { return formatValue(x, { lang: lang }); });
      return shown.join('; ') + (items.length > 6 ? '; …' : '');
    }
    if (typeof value === 'number') return opts.type === 'date' ? formatDateDisplay(fromSerial(value)) : formatNumberDisplay(value, lang);
    if (typeof value === 'boolean') return boolDisplay(value, lang);
    return String(value);
  }
  evaluator.formatValue = formatValue;

  function typeOf(value, isDate) {
    if (value === null || value === undefined || value === '') return 'empty';
    if (isArr(value)) return 'array';
    if (value instanceof Date || isDate) return 'date';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'bool';
    return 'text';
  }

  /* ------------------------------------------------------------------ */
  /* Public API                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * evaluator.evaluate(formulaEN, sheetModel, workbookModel, opts) →
   *   { value, error, supported, type, display, missing, formula }
   * Never throws. opts: { lang:'tr'|'ru'|'en' (display), dialect (error names) }
   */
  evaluator.evaluate = function (formulaEN, sheet, wb, opts) {
    opts = opts || {};
    var lang = opts.lang || locale;
    var dialect = opts.dialect || (lang === 'en' ? 'en' : lang);
    var out = { formula: stripEquals(formulaEN), value: null, error: null, supported: true, type: 'empty', display: '', missing: [] };
    try {
      var env = makeEnv(sheet || null, wb || (sheet && sheet.workbook) || null, 0, null);
      var r = evalText(formulaEN, env);
      out.error = r.error;
      out.supported = r.supported !== false;
      out.missing = r.missing || [];
      if (r.error) {
        out.type = 'error';
        out.display = VALID_ERRORS[r.error] ? errorDisplay(r.error, dialect) : '';
        return out;
      }
      var v = r.value;
      var isDate = typeof v === 'number' && looksLikeDate(r.prepared, v, env);
      out.value = v;
      out.type = typeOf(v, isDate);
      out.display = formatValue(v, { type: out.type, lang: lang });
      if (out.type === 'array') { var m = toMatrix(v); out.rows = m.length; out.cols = m.length ? m[0].length : 0; }
    } catch (e) {
      out.error = (e && VALID_ERRORS[e.message]) ? e.message : '#ERROR!';
      out.supported = !!(e && VALID_ERRORS[e.message]);
      out.type = 'error';
      out.display = VALID_ERRORS[out.error] ? errorDisplay(out.error, dialect) : '';
    }
    return out;
  };

  function shift(text, rowDelta, colDelta) {
    var fr = EFS.formulaReader;
    if (fr && typeof fr.shiftFormula === 'function') { try { return fr.shiftFormula(text, rowDelta, colDelta, 'en'); } catch (e) { /* fallback */ } }
    var W = EFS.workbook;
    if (W && typeof W.shiftFormula === 'function') return W.shiftFormula(text, rowDelta, colDelta);
    return text;
  }

  /**
   * evaluator.preview(formulaEN, sheetModel, workbookModel, { fillRange, anchorRow, rows:5, cell }) →
   *   [ { address, row, formula, value, error, display, type, supported } ]
   */
  evaluator.preview = function (formulaEN, sheet, wb, opts) {
    opts = opts || {};
    var rows = Math.max(1, parseInt(opts.rows, 10) || 5);
    var base = stripEquals(formulaEN);
    var out = [];
    try {
      var W = EFS.workbook;
      var rc = opts.fillRange && W && W.rect ? W.rect(opts.fillRange) : null;
      if (!rc && opts.fillRange) {
        var m = /^\$?([A-Za-z]{1,3})\$?(\d+)(?::\$?([A-Za-z]{1,3})\$?(\d+))?$/.exec(String(opts.fillRange).trim());
        if (m) rc = { top: +m[2], bottom: m[4] ? +m[4] : +m[2], left: columnIndex(m[1]), right: m[3] ? columnIndex(m[3]) : columnIndex(m[1]) };
      }
      if (rc) {
        var anchor = opts.anchorRow != null ? parseInt(opts.anchorRow, 10) : rc.top;
        if (!isFinite(anchor)) anchor = rc.top;
        var last = Math.min(rc.bottom, rc.top + rows - 1);
        for (var r = rc.top; r <= last; r++) {
          var f = r === anchor ? base : shift(base, r - anchor, 0);
          var res = evaluator.evaluate(f, sheet, wb, opts);
          res.address = columnLetter(rc.left) + r; res.row = r;
          out.push(res);
        }
      } else {
        var single = evaluator.evaluate(base, sheet, wb, opts);
        single.address = opts.cell || null; single.row = opts.cell && /\d+$/.test(opts.cell) ? parseInt(/(\d+)$/.exec(opts.cell)[1], 10) : null;
        out.push(single);
      }
    } catch (e) {
      out.push({ address: null, row: null, formula: base, value: null, error: '#ERROR!', display: '', type: 'error', supported: false, missing: [] });
    }
    return out;
  };

  /* ------------------------------------------------------------------ */
  /* Custom functions                                                     */
  /* ------------------------------------------------------------------ */

  function wildcardRe(pat) {
    var out = '';
    for (var i = 0; i < pat.length; i++) {
      var ch = pat[i];
      if (ch === '~' && i + 1 < pat.length) { out += pat[i + 1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); i++; }
      else if (ch === '*') out += '[\\s\\S]*';
      else if (ch === '?') out += '[\\s\\S]';
      else out += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp('^' + out + '$');
  }
  function hasWildcard(s) { return typeof s === 'string' && /[*?]/.test(s.replace(/~[*?~]/g, '')); }

  function compileCriteria(c) {
    c = scalar(c);
    if (c instanceof Date) c = toSerial(c);
    if (typeof c === 'number') return { op: '=', kind: 'num', val: c };
    if (typeof c === 'boolean') return { op: '=', kind: 'bool', val: c };
    if (isBlank(c)) return { op: '=', kind: 'blank' };
    var s = String(c), m = /^(<>|>=|<=|=|<|>)([\s\S]*)$/.exec(s), op = '=', rest = s;
    if (m) { op = m[1]; rest = m[2]; }
    if (rest === '') return { op: op === '<>' ? '<>' : '=', kind: 'blank' };
    var n = parseNum(rest);
    if (n != null) return { op: op, kind: 'num', val: n };
    var u = rest.trim().toUpperCase();
    if (u === 'TRUE' || u === 'FALSE') return { op: op, kind: 'bool', val: u === 'TRUE' };
    var d = parseDate(rest);
    if (d) return { op: op, kind: 'num', val: toSerial(d) };
    return { op: op, kind: 'text', val: rest, low: lower(rest), re: (op === '=' || op === '<>') ? wildcardRe(lower(rest)) : null };
  }
  function cmpOp(a, b, op) {
    switch (op) {
      case '=': return a === b; case '<>': return a !== b; case '>': return a > b;
      case '<': return a < b; case '>=': return a >= b; case '<=': return a <= b;
    }
    return false;
  }
  function matchCriteria(v, cr) {
    if (v instanceof Date) v = toSerial(v);
    switch (cr.kind) {
      case 'blank': { var b = isBlank(v); return cr.op === '<>' ? !b : b; }
      case 'bool':
        if (typeof v === 'boolean') return cmpOp(v, cr.val, cr.op === '<>' ? '<>' : '=');
        return cr.op === '<>';
      case 'num':
        if (typeof v === 'number') return cmpOp(v, cr.val, cr.op);
        if (cr.op === '=' && typeof v === 'string' && parseNum(v) === cr.val) return true;
        if (cr.op === '<>') return true;
        return false;
      default:
        if (typeof v === 'string') {
          var lv = lower(v);
          if (cr.re) { var hit = cr.re.test(lv); return cr.op === '<>' ? !hit : hit; }
          return cmpOp(lv, cr.low, cr.op);
        }
        return cr.op === '<>';
    }
  }

  function dimsOf(m) { return { rows: m.length, cols: m.length ? m[0].length : 0 }; }
  function criteriaPairs(params, from) {
    var pairs = [], dims = null;
    for (var i = from; i + 1 < params.length; i += 2) {
      var m = toMatrix(params[i]);
      var d = dimsOf(m);
      if (!dims) dims = d;
      else if (d.rows !== dims.rows || d.cols !== dims.cols) throw err('#VALUE!');
      pairs.push({ m: m, cr: compileCriteria(params[i + 1]) });
    }
    if (!pairs.length) throw err('#VALUE!');
    return { pairs: pairs, dims: dims };
  }
  function eachMatch(cp, fn) {
    for (var r = 0; r < cp.dims.rows; r++) {
      for (var c = 0; c < cp.dims.cols; c++) {
        var ok = true;
        for (var p = 0; p < cp.pairs.length; p++) if (!matchCriteria(cp.pairs[p].m[r][c], cp.pairs[p].cr)) { ok = false; break; }
        if (ok) fn(r, c);
      }
    }
  }
  function valueAt(m, r, c) { var row = m[r]; return row ? row[c] : null; }
  /** Criteria given as a range (COUNTIF(r,r) idiom) yield one result per criterion. */
  function perCriteria(crit, fn) {
    if (!isArr(crit)) return fn(crit);
    return toMatrix(crit).map(function (row) { return row.map(function (c) { return fn(c); }); });
  }
  function numbersWhere(valueRange, cp) {
    var m = toMatrix(valueRange), out = [];
    eachMatch(cp, function (r, c) { var v = valueAt(m, r, c); if (v instanceof Date) v = toSerial(v); if (typeof v === 'number') out.push(v); });
    return out;
  }
  function sumOf(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }

  function numbersOnly(params) {
    return flatAll(params).map(function (v) { return v instanceof Date ? toSerial(v) : v; }).filter(function (v) { return typeof v === 'number'; });
  }

  /* --- lookup helpers --- */
  function typeRank(v) { return typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : typeof v === 'boolean' ? 2 : -1; }
  function normVal(v) { if (v instanceof Date) return toSerial(v); if (isBlank(v)) return null; return v; }
  function eqVal(a, b) {
    a = normVal(a); b = normVal(b);
    if (a === null || b === null) return (a === null || a === '') && (b === null || b === '');
    if (typeof a === 'string' && typeof b === 'string') return lower(a) === lower(b);
    return a === b;
  }
  function compareVal(a, b) {
    a = normVal(a); b = normVal(b);
    if (a === null) a = typeof b === 'string' ? '' : 0;
    if (b === null) b = typeof a === 'string' ? '' : 0;
    var ra = typeRank(a), rb = typeRank(b);
    if (ra !== rb) return ra - rb;
    if (typeof a === 'string') { var la = lower(a), lb = lower(b); return la < lb ? -1 : la > lb ? 1 : 0; }
    return a < b ? -1 : a > b ? 1 : 0;
  }
  function matchesLookup(cell, v, wildcard) {
    if (wildcard && typeof v === 'string' && hasWildcard(v)) return typeof cell === 'string' && wildcardRe(lower(v)).test(lower(cell));
    return eqVal(cell, v);
  }
  function findIndex(list, v, mode, searchMode) {
    var n = list.length, i;
    var order = [];
    if (searchMode === -1 || searchMode === -2) for (i = n - 1; i >= 0; i--) order.push(i); else for (i = 0; i < n; i++) order.push(i);
    v = normVal(v);
    if (mode === 0 || mode === 2) {
      for (i = 0; i < n; i++) if (matchesLookup(list[order[i]], v, mode === 2)) return order[i];
      return -1;
    }
    var best = -1;
    for (i = 0; i < n; i++) {
      var idx = order[i], cell = normVal(list[idx]);
      if (cell === null || typeRank(cell) !== typeRank(v)) continue;
      if (eqVal(cell, v)) return idx;
      var c = compareVal(cell, v);
      if (mode === -1 && c < 0 && (best < 0 || compareVal(cell, list[best]) > 0)) best = idx;
      if (mode === 1 && c > 0 && (best < 0 || compareVal(cell, list[best]) < 0)) best = idx;
    }
    return best;
  }
  function column(m, c) { return m.map(function (row) { return row[c]; }); }

  /* --- date helpers --- */
  function ymd(serial) { var d = fromSerial(Math.floor(serial)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), dow: d.getUTCDay() }; }
  function serialOf(y, m, d) { return (Date.UTC(y, m - 1, d) - EPOCH) / MS_DAY; }
  function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function todaySerial() { var n = new Date(); return serialOf(n.getFullYear(), n.getMonth() + 1, n.getDate()); }
  function holidaysOf(v) { return flat(v === undefined ? [] : v).map(function (h) { return isBlank(h) ? null : Math.floor(num(h)); }).filter(function (h) { return h !== null; }); }
  function isWorkday(serial, holidays) { var dow = ymd(serial).dow; return dow !== 0 && dow !== 6 && holidays.indexOf(serial) < 0; }

  var NAMES = {
    en: { months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], monthsGen: null,
      monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], daysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] },
    tr: { months: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'], monthsGen: null,
      monthsShort: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
      days: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'], daysShort: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'] },
    ru: { months: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
      monthsGen: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
      monthsShort: ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
      days: ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'], daysShort: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'] }
  };

  function localizeFormatCodes(fmt) {
    var f = fmt;
    if (/[ДМГчс]/i.test(f) && !/[dmyhs]/i.test(f.replace(/"[^"]*"/g, ''))) {
      f = f.replace(/Д/gi, 'd').replace(/М/gi, 'm').replace(/Г/gi, 'y').replace(/ч/gi, 'h').replace(/с/gi, 's');
    }
    if (/^[gaGAyY.\-/ :hHsS]+$/.test(f) && /[gaGA]/.test(f)) {
      f = f.replace(/[gG]/g, 'd').replace(/[aA]/g, 'm');
    }
    return f;
  }
  function isDateFmt(fmt) {
    var f = fmt.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').replace(/\\./g, '');
    if (/^general$/i.test(f.trim())) return false;
    if (/[#0?]/.test(f) && !/[dyhs]/i.test(f)) return false;
    return /[dyhs]/i.test(f) || (/m/i.test(f) && !/[#0%@]/.test(f));
  }
  function formatDateTokens(serial, fmt) {
    var d = fromSerial(serial), names = NAMES[locale] || NAMES.en;
    var frac = serial - Math.floor(serial);
    var totalSec = Math.round(frac * 86400);
    var H = Math.floor(totalSec / 3600), M = Math.floor((totalSec % 3600) / 60), S = totalSec % 60;
    var ampm = /AM\/PM|A\/P/i.test(fmt);
    var hasDay = /(^|[^d])d{1,2}(?!d)/i.test(fmt.replace(/"[^"]*"/g, ''));
    var re = /yyyy|yy|mmmmm|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s|AM\/PM|A\/P|"[^"]*"|\[[^\]]*\]|\\.|[\s\S]/gi;
    var out = '', m, prevHour = false, tokens = fmt.match(re) || [];
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i], tl = t.toLowerCase();
      var next = (tokens[i + 1] || '').toLowerCase();
      switch (tl) {
        case 'yyyy': out += d.getUTCFullYear(); prevHour = false; break;
        case 'yy': out += pad2(d.getUTCFullYear() % 100); prevHour = false; break;
        case 'mmmmm': out += (names.months[d.getUTCMonth()])[0]; break;
        case 'mmmm': out += (hasDay && names.monthsGen ? names.monthsGen : names.months)[d.getUTCMonth()]; break;
        case 'mmm': out += names.monthsShort[d.getUTCMonth()]; break;
        case 'mm': case 'm':
          if (prevHour || next === 's' || next === 'ss' || (tokens[i + 1] === ':' && /^s/i.test(tokens[i + 2] || ''))) out += tl === 'mm' ? pad2(M) : M;
          else out += tl === 'mm' ? pad2(d.getUTCMonth() + 1) : (d.getUTCMonth() + 1);
          prevHour = false; break;
        case 'dddd': out += names.days[d.getUTCDay()]; break;
        case 'ddd': out += names.daysShort[d.getUTCDay()]; break;
        case 'dd': out += pad2(d.getUTCDate()); break;
        case 'd': out += d.getUTCDate(); break;
        case 'hh': case 'h': { var h = ampm ? ((H % 12) || 12) : H; out += tl === 'hh' ? pad2(h) : h; prevHour = true; break; }
        case 'ss': out += pad2(S); prevHour = false; break;
        case 's': out += S; prevHour = false; break;
        case 'am/pm': out += H < 12 ? 'AM' : 'PM'; break;
        case 'a/p': out += H < 12 ? 'A' : 'P'; break;
        default:
          if (t[0] === '"') out += t.slice(1, -1);
          else if (t[0] === '[') { /* colour / condition */ }
          else if (t[0] === '\\') out += t.slice(1);
          else { out += t; if (t !== ':') prevHour = prevHour && t === ':'; }
      }
    }
    return out;
  }
  function groupSepOf() { return locale === 'en' ? ',' : locale === 'ru' ? ' ' : '.'; }
  function formatNumberPattern(v, fmt) {
    var sections = fmt.split(';');
    var sec = sections[0], neg = v < 0;
    if (sections.length >= 2 && neg) { sec = sections[1]; v = Math.abs(v); neg = false; }
    if (sections.length >= 3 && v === 0) sec = sections[2];
    if (/^general$/i.test(sec.replace(/"[^"]*"/g, '').trim())) return formatNumberDisplay(v, locale);
    var clean = sec.replace(/\[[^\]]*\]/g, '');
    var percent = clean.replace(/"[^"]*"/g, '').indexOf('%') >= 0;
    var coreM = /[#0?]+(?:,[#0?]+)*(?:\.[#0?]+)?/.exec(clean.replace(/"[^"]*"/g, function (q) { return q.replace(/[#0?.,]/g, '_'); }));
    if (!coreM) return formatNumberDisplay(v, locale);
    var core = coreM[0];
    var prefix = clean.slice(0, coreM.index), suffix = clean.slice(coreM.index + core.length);
    function lit(s) { return s.replace(/"([^"]*)"/g, '$1').replace(/\\(.)/g, '$1').replace(/[_*]./g, ' ').replace(/[?]/g, ''); }
    var parts = core.split('.');
    var intPat = parts[0], fracPat = parts[1] || '';
    var grouping = intPat.indexOf(',') >= 0;
    var minInt = (intPat.replace(/,/g, '').match(/0/g) || []).length;
    var decimals = fracPat.length, minDec = (fracPat.match(/0/g) || []).length;
    var val = percent ? v * 100 : v;
    var abs = Math.abs(val);
    var fixed = abs.toFixed(decimals);
    var ip = fixed.split('.')[0], fp = fixed.split('.')[1] || '';
    while (fp.length > minDec && fp[fp.length - 1] === '0') fp = fp.slice(0, -1);
    if (ip === '0' && minInt === 0 && (fp || decimals)) ip = '';
    while (ip.length < minInt) ip = '0' + ip;
    if (grouping) ip = ip.replace(/\B(?=(\d{3})+(?!\d))/g, groupSepOf());
    var body = ip + (fp ? decimalSep(locale) + fp : '');
    return (neg || val < 0 ? '-' : '') + lit(prefix) + body + lit(suffix);
  }

  function roundTo(v, digits, mode) {
    var d = Math.floor(num(digits)), x = num(v);
    var f = Math.pow(10, d), y = x * f;
    var eps = 1e-9 * Math.max(1, Math.abs(y));
    if (mode === 'up') y = y > 0 ? Math.ceil(y - eps) : Math.floor(y + eps);
    else if (mode === 'down') y = y > 0 ? Math.floor(y + eps) : Math.ceil(y - eps);
    else y = y >= 0 ? Math.floor(y + 0.5 + eps) : -Math.floor(-y + 0.5 + eps);
    var out = y / f;
    return d > 0 ? parseFloat(out.toFixed(Math.min(15, d))) : out;
  }

  var CUSTOM = {
    /* --- conditional aggregates --- */
    SUMIF: function (p) { if (p.length < 2) throw err('#VALUE!'); return perCriteria(p[1], function (c) { var cp = criteriaPairs([p[0], c], 0); return sumOf(numbersWhere(optional(p, 2) ? p[2] : p[0], cp)); }); },
    SUMIFS: function (p) { if (p.length < 3) throw err('#VALUE!'); var cp = criteriaPairs(p, 1); return sumOf(numbersWhere(p[0], cp)); },
    COUNTIF: function (p) { if (p.length < 2) throw err('#VALUE!'); return perCriteria(p[1], function (c) { var cp = criteriaPairs([p[0], c], 0), n = 0; eachMatch(cp, function () { n++; }); return n; }); },
    COUNTIFS: function (p) { if (p.length < 2) throw err('#VALUE!'); var cp = criteriaPairs(p, 0), n = 0; eachMatch(cp, function () { n++; }); return n; },
    AVERAGEIF: function (p) { if (p.length < 2) throw err('#VALUE!'); return perCriteria(p[1], function (c) { var cp = criteriaPairs([p[0], c], 0); var a = numbersWhere(optional(p, 2) ? p[2] : p[0], cp); if (!a.length) throw err('#DIV/0!'); return sumOf(a) / a.length; }); },
    AVERAGEIFS: function (p) { if (p.length < 3) throw err('#VALUE!'); var cp = criteriaPairs(p, 1); var a = numbersWhere(p[0], cp); if (!a.length) throw err('#DIV/0!'); return sumOf(a) / a.length; },
    MAXIFS: function (p) { if (p.length < 3) throw err('#VALUE!'); var cp = criteriaPairs(p, 1); var a = numbersWhere(p[0], cp); return a.length ? Math.max.apply(null, a) : 0; },
    MINIFS: function (p) { if (p.length < 3) throw err('#VALUE!'); var cp = criteriaPairs(p, 1); var a = numbersWhere(p[0], cp); return a.length ? Math.min.apply(null, a) : 0; },

    /* --- logic --- */
    IFS: function (p) { for (var i = 0; i + 1 < p.length; i += 2) if (bool(p[i])) return p[i + 1]; throw err('#N/A'); },
    IFERROR: function (p) { return p[0] === undefined ? '' : p[0]; },     // only reached when the inner value did not error
    IFNA: function (p) { return p[0] === undefined ? '' : p[0]; },
    ISERROR: function () { return false; },                               // same: an erroring argument never gets here
    ISERR: function () { return false; },
    ISNA: function () { return false; },
    ISBLANK: function (p) { var v = scalar(p[0]); return v === null || v === undefined || v === ''; },
    EFS_ARRAY: function (p) {
      var rows = int(p[0]), cols = int(p[1]), out = [], k = 2;
      for (var r = 0; r < rows; r++) { var row = []; for (var c = 0; c < cols; c++) row.push(p[k++]); out.push(row); }
      return out;
    },

    /* --- lookups --- */
    VLOOKUP: function (p) {
      if (p.length < 3) throw err('#VALUE!');
      var m = toMatrix(p[1]), idx = int(p[2]), approx = optional(p, 3) ? bool(p[3]) : true;
      if (idx < 1 || (m.length && idx > m[0].length)) throw err('#REF!');
      var hit = findIndex(column(m, 0), scalar(p[0]), approx ? -1 : 2, 1);
      if (hit < 0) throw err('#N/A');
      var v = m[hit][idx - 1]; return isBlank(v) ? '' : v;
    },
    HLOOKUP: function (p) {
      if (p.length < 3) throw err('#VALUE!');
      var m = toMatrix(p[1]), idx = int(p[2]), approx = optional(p, 3) ? bool(p[3]) : true;
      if (idx < 1 || idx > m.length) throw err('#REF!');
      var hit = findIndex(m[0], scalar(p[0]), approx ? -1 : 2, 1);
      if (hit < 0) throw err('#N/A');
      var v = m[idx - 1][hit]; return isBlank(v) ? '' : v;
    },
    XLOOKUP: function (p) {
      if (p.length < 3) throw err('#VALUE!');
      var lk = toMatrix(p[1]), rt = toMatrix(p[2]);
      var mode = optional(p, 4) ? int(p[4]) : 0, search = optional(p, 5) ? int(p[5]) : 1;
      var vertical = lk.length >= 1 && (lk[0].length === 1 || lk.length > 1);
      var list = vertical ? column(lk, 0) : lk[0];
      var hit = findIndex(list, scalar(p[0]), mode, search);
      if (hit < 0) { if (optional(p, 3)) return p[3]; throw err('#N/A'); }
      if (vertical) { var row = rt[hit]; if (!row) throw err('#REF!'); return row.length === 1 ? (isBlank(row[0]) ? '' : row[0]) : [row]; }
      var col = column(rt, hit); if (col.some(function (x) { return x === undefined; })) throw err('#REF!');
      return col.length === 1 ? (isBlank(col[0]) ? '' : col[0]) : col.map(function (x) { return [x]; });
    },
    XMATCH: function (p) {
      if (p.length < 2) throw err('#VALUE!');
      var hit = findIndex(flat(p[1]), scalar(p[0]), optional(p, 2) ? int(p[2]) : 0, optional(p, 3) ? int(p[3]) : 1);
      if (hit < 0) throw err('#N/A'); return hit + 1;
    },
    MATCH: function (p) {
      if (p.length < 2) throw err('#VALUE!');
      var type = optional(p, 2) ? int(p[2]) : 1;
      var hit = findIndex(flat(p[1]), scalar(p[0]), type === 0 ? 2 : type > 0 ? -1 : 1, 1);
      if (hit < 0) throw err('#N/A'); return hit + 1;
    },
    INDEX: function (p) {
      if (p.length < 2) throw err('#VALUE!');
      var m = toMatrix(p[0]);
      if (!m.length) throw err('#REF!');
      var r = int(p[1]), c = optional(p, 2) ? int(p[2]) : (m.length === 1 && p.length === 2 ? r : 1);
      if (m.length === 1 && p.length === 2) r = 1;
      if (r === 0 && c === 0) return m;
      if (r === 0) return column(m, c - 1).map(function (x) { return [x]; });
      if (c === 0) return [m[r - 1]];
      if (r < 1 || r > m.length || c < 1 || c > m[0].length) throw err('#REF!');
      var v = m[r - 1][c - 1]; return isBlank(v) ? '' : v;
    },
    CHOOSE: function (p) { var i = int(p[0]); if (i < 1 || i >= p.length) throw err('#VALUE!'); return p[i]; },

    /* --- statistics --- */
    LARGE: function (p) { var a = numbersOnly([p[0]]).sort(function (x, y) { return y - x; }); var k = int(p[1]); if (k < 1 || k > a.length) throw err('#NUM!'); return a[k - 1]; },
    SMALL: function (p) { var a = numbersOnly([p[0]]).sort(function (x, y) { return x - y; }); var k = int(p[1]); if (k < 1 || k > a.length) throw err('#NUM!'); return a[k - 1]; },
    RANK: function (p) { return CUSTOM['RANK.EQ'](p); },
    'RANK.EQ': function (p) {
      var v = num(p[0]), a = numbersOnly([p[1]]), asc = optional(p, 2) ? bool(p[2]) : false;
      if (a.indexOf(v) < 0) throw err('#N/A');
      var n = 0; for (var i = 0; i < a.length; i++) if (asc ? a[i] < v : a[i] > v) n++;
      return n + 1;
    },
    'RANK.AVG': function (p) {
      var v = num(p[0]), a = numbersOnly([p[1]]), asc = optional(p, 2) ? bool(p[2]) : false;
      var better = 0, same = 0;
      for (var i = 0; i < a.length; i++) { if (a[i] === v) same++; else if (asc ? a[i] < v : a[i] > v) better++; }
      if (!same) throw err('#N/A');
      return better + (same + 1) / 2;
    },
    COUNTUNIQUE: function (p) { var seen = Object.create(null), n = 0; flatAll(p).forEach(function (v) { if (isBlank(v)) return; var k = (typeof v) + ':' + (typeof v === 'string' ? lower(v) : v); if (!seen[k]) { seen[k] = 1; n++; } }); return n; },

    /* --- rounding --- */
    ROUND: function (p) { return roundTo(p[0], optional(p, 1) ? p[1] : 0, 'half'); },
    ROUNDUP: function (p) { return roundTo(p[0], optional(p, 1) ? p[1] : 0, 'up'); },
    ROUNDDOWN: function (p) { return roundTo(p[0], optional(p, 1) ? p[1] : 0, 'down'); },

    /* --- text --- */
    TEXT: function (p) {
      var v = scalar(p[0]), fmt = str(p[1]);
      if (v instanceof Date) v = toSerial(v);
      if (fmt.indexOf('@') >= 0) return str(v);
      if (typeof v === 'string') { var n = parseNum(v); if (n == null) { var d = parseDate(v); if (!d) return v; n = toSerial(d); } v = n; }
      if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
      if (isBlank(v)) v = 0;
      fmt = localizeFormatCodes(fmt);
      return isDateFmt(fmt) ? formatDateTokens(v, fmt) : formatNumberPattern(v, fmt);
    },
    TEXTJOIN: function (p) {
      if (p.length < 3) throw err('#VALUE!');
      var delim = str(scalar(p[0])), ignore = bool(p[1]);
      var items = flatAll(p, 2);
      if (ignore) items = items.filter(function (v) { return !isBlank(v); });
      return items.map(str).join(delim);
    },
    CONCAT: function (p) { return flatAll(p).map(str).join(''); },
    CONCATENATE: function (p) { return p.map(function (v) { return str(scalar(v)); }).join(''); },
    VALUE: function (p) { var v = scalar(p[0]); if (typeof v === 'number') return v; if (typeof v === 'boolean') throw err('#VALUE!'); return num(v); },
    NUMBERVALUE: function (p) {
      var s = str(scalar(p[0])).trim(); if (s === '') return 0;
      var dec = optional(p, 1) ? str(p[1]) : decimalSep(locale), grp = optional(p, 2) ? str(p[2]) : groupSepOf();
      var pct = (s.match(/%/g) || []).length; s = s.replace(/%/g, '').replace(/\s/g, '');
      if (grp) s = s.split(grp).join('');
      if (dec && dec !== '.') s = s.split(dec).join('.');
      if (!/^[-+]?\d*(\.\d+)?$/.test(s) || s === '' || s === '-' || s === '+') throw err('#VALUE!');
      var v = parseFloat(s); for (var i = 0; i < pct; i++) v /= 100; return v;
    },
    N: function (p) { var v = scalar(p[0]); if (typeof v === 'number') return v; if (typeof v === 'boolean') return v ? 1 : 0; if (v instanceof Date) return toSerial(v); return 0; },
    T: function (p) { var v = scalar(p[0]); return typeof v === 'string' ? v : ''; },
    LEN: function (p) { return str(scalar(p[0])).length; },
    TRIM: function (p) { return str(scalar(p[0])).replace(/\s+/g, ' ').trim(); },
    UPPER: function (p) { return upper(str(scalar(p[0]))); },
    LOWER: function (p) { return lower(str(scalar(p[0]))); },
    PROPER: function (p) {
      return lower(str(scalar(p[0]))).replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, function (all, pre, ch) { return pre + upper(ch); });
    },
    SUBSTITUTE: function (p) {
      if (p.length < 3) throw err('#VALUE!');
      var text = str(scalar(p[0])), oldT = str(scalar(p[1])), newT = str(scalar(p[2]));
      if (oldT === '') return text;
      if (!optional(p, 3)) return text.split(oldT).join(newT);
      var inst = int(p[3]); if (inst < 1) throw err('#VALUE!');
      var idx = -1, from = 0;
      for (var i = 0; i < inst; i++) { idx = text.indexOf(oldT, from); if (idx < 0) return text; from = idx + oldT.length; }
      return text.slice(0, idx) + newT + text.slice(idx + oldT.length);
    },
    SEARCH: function (p) {
      if (p.length < 2) throw err('#VALUE!');
      var find = lower(str(scalar(p[0]))), within = lower(str(scalar(p[1]))), start = optional(p, 2) ? int(p[2]) : 1;
      if (start < 1 || start > within.length + 1) throw err('#VALUE!');
      var hay = within.slice(start - 1), idx = -1;
      if (hasWildcard(find)) { var m = new RegExp(wildcardRe(find).source.replace(/^\^/, '').replace(/\$$/, '')).exec(hay); idx = m ? m.index : -1; }
      else idx = hay.indexOf(find);
      if (idx < 0) throw err('#VALUE!');
      return idx + start;
    },
    TEXTBEFORE: function (p) {
      var text = str(scalar(p[0])), delim = str(scalar(p[1])), inst = optional(p, 2) ? int(p[2]) : 1, ci = optional(p, 3) ? bool(p[3]) : false;
      var t = ci ? lower(text) : text, d = ci ? lower(delim) : delim;
      var idx = nthIndex(t, d, inst);
      if (idx < 0) { if (optional(p, 5)) return p[5]; throw err('#N/A'); }
      return text.slice(0, idx);
    },
    TEXTAFTER: function (p) {
      var text = str(scalar(p[0])), delim = str(scalar(p[1])), inst = optional(p, 2) ? int(p[2]) : 1, ci = optional(p, 3) ? bool(p[3]) : false;
      var t = ci ? lower(text) : text, d = ci ? lower(delim) : delim;
      var idx = nthIndex(t, d, inst);
      if (idx < 0) { if (optional(p, 5)) return p[5]; throw err('#N/A'); }
      return text.slice(idx + delim.length);
    },
    TEXTSPLIT: function (p) {
      var text = str(scalar(p[0])), cd = optional(p, 1) ? str(scalar(p[1])) : '', rd = optional(p, 2) ? str(scalar(p[2])) : '';
      var rows = rd ? text.split(rd) : [text];
      return rows.map(function (r) { return cd ? r.split(cd) : [r]; });
    },

    /* --- dates --- */
    TODAY: function () { return todaySerial(); },
    NOW: function () { var n = new Date(); return todaySerial() + (n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds()) / 86400; },
    DATE: function (p) {
      if (p.length < 3) throw err('#VALUE!');
      var y = int(p[0]), m = int(p[1]), d = int(p[2]);
      if (y >= 0 && y < 1900) y += 1900;
      var s = serialOf(y, m, d);
      if (s < 0) throw err('#NUM!');
      return s;
    },
    DATEVALUE: function (p) { var v = scalar(p[0]); if (typeof v === 'number') return Math.floor(v); var d = parseDate(str(v)); if (!d) throw err('#VALUE!'); return Math.floor(toSerial(d)); },
    DATEDIF: function (p) {
      if (p.length < 3) throw err('#VALUE!');
      var s = Math.floor(num(p[0])), e = Math.floor(num(p[1])), unit = str(p[2]).toUpperCase();
      if (s > e) throw err('#NUM!');
      var a = ymd(s), b = ymd(e);
      var years = b.y - a.y - ((b.m < a.m || (b.m === a.m && b.d < a.d)) ? 1 : 0);
      var months = (b.y - a.y) * 12 + (b.m - a.m) - (b.d < a.d ? 1 : 0);
      switch (unit) {
        case 'Y': return years;
        case 'M': return months;
        case 'D': return e - s;
        case 'YM': return months - years * 12;
        case 'MD': { if (b.d >= a.d) return b.d - a.d; var pm = b.m === 1 ? 12 : b.m - 1, py = b.m === 1 ? b.y - 1 : b.y; return daysInMonth(py, pm) - a.d + b.d; }
        case 'YD': { var anniv = serialOf(b.y, a.m, Math.min(a.d, daysInMonth(b.y, a.m))); if (anniv > e) anniv = serialOf(b.y - 1, a.m, Math.min(a.d, daysInMonth(b.y - 1, a.m))); return e - anniv; }
      }
      throw err('#NUM!');
    },
    WORKDAY: function (p) {
      if (p.length < 2) throw err('#VALUE!');
      var s = Math.floor(num(p[0])), days = int(p[1]), hol = holidaysOf(p[2]);
      var step = days < 0 ? -1 : 1, left = Math.abs(days), cur = s;
      while (left > 0) { cur += step; if (isWorkday(cur, hol)) left--; }
      return cur;
    },
    NETWORKDAYS: function (p) {
      if (p.length < 2) throw err('#VALUE!');
      var s = Math.floor(num(p[0])), e = Math.floor(num(p[1])), hol = holidaysOf(p[2]);
      var sign = 1; if (s > e) { var t = s; s = e; e = t; sign = -1; }
      var n = 0; for (var d = s; d <= e; d++) if (isWorkday(d, hol)) n++;
      return n * sign;
    },
    /* The parser's own date functions go through local time and shift dates west of UTC: UTC-based versions. */
    YEAR: function (p) { return ymd(num(p[0])).y; },
    MONTH: function (p) { return ymd(num(p[0])).m; },
    DAY: function (p) { return ymd(num(p[0])).d; },
    DAYS: function (p) { return Math.floor(num(p[0])) - Math.floor(num(p[1])); },
    WEEKDAY: function (p) {
      var dow = ymd(num(p[0])).dow, type = optional(p, 1) ? int(p[1]) : 1;
      switch (type) {
        case 1: case 17: return dow + 1;
        case 2: case 11: return ((dow + 6) % 7) + 1;
        case 3: return (dow + 6) % 7;
        case 12: return ((dow + 5) % 7) + 1; case 13: return ((dow + 4) % 7) + 1; case 14: return ((dow + 3) % 7) + 1;
        case 15: return ((dow + 2) % 7) + 1; case 16: return ((dow + 1) % 7) + 1;
      }
      throw err('#NUM!');
    },
    WEEKNUM: function (p) {
      var s = Math.floor(num(p[0])), type = optional(p, 1) ? int(p[1]) : 1;
      if (type === 21) return CUSTOM.ISOWEEKNUM([s]);
      var a = ymd(s), jan1 = serialOf(a.y, 1, 1), jan1Dow = ymd(jan1).dow;
      var startMap = { 1: 0, 2: 1, 11: 1, 12: 2, 13: 3, 14: 4, 15: 5, 16: 6, 17: 0 };
      if (!(type in startMap)) throw err('#NUM!');
      var offset = (jan1Dow - startMap[type] + 7) % 7;
      return Math.floor((s - jan1 + offset) / 7) + 1;
    },
    ISOWEEKNUM: function (p) {
      var s = Math.floor(num(p[0])), a = ymd(s);
      var thursday = s + 3 - ((a.dow + 6) % 7);
      var ty = ymd(thursday).y, jan1 = serialOf(ty, 1, 1);
      return Math.floor((thursday - jan1) / 7) + 1;
    },
    EOMONTH: function (p) { var a = ymd(num(p[0])), months = int(p[1]); return serialOf(a.y, a.m + months + 1, 0); },
    EDATE: function (p) {
      var a = ymd(num(p[0])), months = int(p[1]);
      var target = new Date(Date.UTC(a.y, a.m - 1 + months, 1));
      var ty = target.getUTCFullYear(), tm = target.getUTCMonth() + 1;
      return serialOf(ty, tm, Math.min(a.d, daysInMonth(ty, tm)));
    },
    YEARFRAC: function (p) {
      var s = Math.floor(num(p[0])), e = Math.floor(num(p[1])), basis = optional(p, 2) ? int(p[2]) : 0;
      if (s > e) { var t = s; s = e; e = t; }
      var a = ymd(s), b = ymd(e);
      switch (basis) {
        case 0: return CUSTOM.DAYS360([s, e, false]) / 360;
        case 4: return CUSTOM.DAYS360([s, e, true]) / 360;
        case 2: return (e - s) / 360;
        case 3: return (e - s) / 365;
        case 1: {
          if (a.y === b.y) return (e - s) / (serialOf(a.y + 1, 1, 1) - serialOf(a.y, 1, 1));
          var years = b.y - a.y + 1, days = serialOf(b.y + 1, 1, 1) - serialOf(a.y, 1, 1);
          return (e - s) / (days / years);
        }
      }
      throw err('#NUM!');
    },
    HOUR: function (p) { var v = num(p[0]); var t = Math.round((v - Math.floor(v)) * 86400); return Math.floor(t / 3600) % 24; },
    MINUTE: function (p) { var v = num(p[0]); var t = Math.round((v - Math.floor(v)) * 86400); return Math.floor((t % 3600) / 60); },
    SECOND: function (p) { var v = num(p[0]); var t = Math.round((v - Math.floor(v)) * 86400); return t % 60; },
    DAYS360: function (p) {
      var a = ymd(Math.floor(num(p[0]))), b = ymd(Math.floor(num(p[1]))), eu = optional(p, 2) ? bool(p[2]) : false;
      var d1 = a.d, d2 = b.d;
      if (eu) { if (d1 === 31) d1 = 30; if (d2 === 31) d2 = 30; }
      else { if (d1 === 31 || (a.m === 2 && d1 === daysInMonth(a.y, 2))) d1 = 30; if (d2 === 31 && d1 === 30) d2 = 30; }
      return (b.y - a.y) * 360 + (b.m - a.m) * 30 + (d2 - d1);
    },

    /* --- dynamic arrays --- */
    UNIQUE: function (p) {
      var m = toMatrix(p[0]), byCol = optional(p, 1) ? bool(p[1]) : false, once = optional(p, 2) ? bool(p[2]) : false;
      if (byCol) m = transpose(m);
      var keys = m.map(function (row) { return row.map(function (v) { v = normVal(v); return v === null ? '' : (typeof v) + ':' + (typeof v === 'string' ? lower(v) : v); }).join('\u0001'); });
      var counts = Object.create(null); keys.forEach(function (k) { counts[k] = (counts[k] || 0) + 1; });
      var seen = Object.create(null), out = [];
      m.forEach(function (row, i) { var k = keys[i]; if (seen[k]) return; seen[k] = 1; if (once && counts[k] !== 1) return; out.push(row.slice()); });
      if (!out.length) throw err('#N/A');
      return byCol ? transpose(out) : out;
    },
    FILTER: function (p) {
      if (p.length < 2) throw err('#VALUE!');
      var m = toMatrix(p[0]), inc = p[1];
      var mask = isArr(inc) ? flat(inc) : null, out = [];
      if (!mask) { if (bool(inc)) out = m; }
      else if (mask.length === m.length) { for (var r = 0; r < m.length; r++) if (truthy(mask[r])) out.push(m[r].slice()); }
      else if (m.length && mask.length === m[0].length) { out = m.map(function (row) { return row.filter(function (v, c) { return truthy(mask[c]); }); }); if (!out[0].length) out = []; }
      else throw err('#VALUE!');
      if (!out.length) { if (optional(p, 2)) return p[2]; throw err('#N/A'); }
      return out;
    },
    SORT: function (p) {
      var m = toMatrix(p[0]).map(function (r) { return r.slice(); }), idx = optional(p, 1) ? int(p[1]) : 1, order = optional(p, 2) ? int(p[2]) : 1, byCol = optional(p, 3) ? bool(p[3]) : false;
      if (byCol) m = transpose(m);
      if (idx < 1 || (m.length && idx > m[0].length)) throw err('#VALUE!');
      m.sort(function (a, b) { return compareVal(a[idx - 1], b[idx - 1]) * (order < 0 ? -1 : 1); });
      return byCol ? transpose(m) : m;
    },
    SORTBY: function (p) {
      var m = toMatrix(p[0]), keys = [];
      for (var i = 1; i < p.length; i += 2) keys.push({ k: flat(p[i]), o: optional(p, i + 1) ? int(p[i + 1]) : 1 });
      var idx = m.map(function (_, i) { return i; });
      idx.sort(function (a, b) { for (var k = 0; k < keys.length; k++) { var c = compareVal(keys[k].k[a], keys[k].k[b]) * (keys[k].o < 0 ? -1 : 1); if (c) return c; } return a - b; });
      return idx.map(function (i) { return m[i].slice(); });
    },
    SEQUENCE: function (p) {
      var rows = int(p[0]), cols = optional(p, 1) ? int(p[1]) : 1, start = optional(p, 2) ? num(p[2]) : 1, step = optional(p, 3) ? num(p[3]) : 1;
      if (rows < 1 || cols < 1 || rows * cols > 100000) throw err('#VALUE!');
      var out = [], v = start;
      for (var r = 0; r < rows; r++) { var row = []; for (var c = 0; c < cols; c++) { row.push(v); v += step; } out.push(row); }
      return out;
    },
    TAKE: function (p) {
      var m = toMatrix(p[0]), rows = optional(p, 1) && p[1] !== null ? int(p[1]) : m.length, cols = optional(p, 2) ? int(p[2]) : (m.length ? m[0].length : 0);
      var r = rows >= 0 ? m.slice(0, rows) : m.slice(rows);
      var out = r.map(function (row) { return cols >= 0 ? row.slice(0, cols) : row.slice(cols); });
      if (!out.length || !out[0].length) throw err('#N/A');
      return out;
    },
    DROP: function (p) {
      var m = toMatrix(p[0]), rows = optional(p, 1) && p[1] !== null ? int(p[1]) : 0, cols = optional(p, 2) ? int(p[2]) : 0;
      var r = rows >= 0 ? m.slice(rows) : m.slice(0, m.length + rows);
      var out = r.map(function (row) { return cols >= 0 ? row.slice(cols) : row.slice(0, row.length + cols); });
      if (!out.length || !out[0].length) throw err('#N/A');
      return out;
    },
    TRANSPOSE: function (p) { return transpose(toMatrix(p[0])); },

    /* --- internal helpers for array idioms --- */
    EFS_CMP: function (p) { var m = toMatrix(p[0]), op = str(p[1]), v = scalar(p[2]); return m.map(function (row) { return row.map(function (c) { return cmpCells(c, v, op); }); }); },
    EFS_CMPN: function (p) { var m = toMatrix(p[0]), op = str(p[1]), v = scalar(p[2]); return m.map(function (row) { return row.map(function (c) { return cmpCells(c, v, op) ? 1 : 0; }); }); },
    EFS_ALL: function (p) { return combineMasks(p, function (a, b) { return a && b; }); },
    EFS_ANY: function (p) { return combineMasks(p, function (a, b) { return a || b; }); },
    EFS_FILTERBY: function (p) {
      var m = toMatrix(p[0]), masks = p.slice(1).map(toMatrix), out = [];
      for (var r = 0; r < m.length; r++) for (var c = 0; c < m[r].length; c++) {
        var ok = true;
        for (var k = 0; k < masks.length; k++) if (!truthy(valueAt(masks[k], r, c))) { ok = false; break; }
        if (ok) out.push([m[r][c]]);
      }
      return out;
    }
  };

  function nthIndex(text, delim, inst) {
    if (delim === '') return inst > 0 ? 0 : text.length;
    var idx = -1, from = 0, i;
    if (inst > 0) { for (i = 0; i < inst; i++) { idx = text.indexOf(delim, from); if (idx < 0) return -1; from = idx + delim.length; } return idx; }
    if (inst < 0) { from = text.length; for (i = 0; i < -inst; i++) { idx = text.lastIndexOf(delim, from - 1); if (idx < 0) return -1; from = idx; } return idx; }
    return -1;
  }
  function truthy(v) { if (typeof v === 'boolean') return v; if (typeof v === 'number') return v !== 0; if (isBlank(v)) return false; try { return bool(v); } catch (e) { return false; } }
  function transpose(m) { if (!m.length) return []; var out = []; for (var c = 0; c < m[0].length; c++) { var row = []; for (var r = 0; r < m.length; r++) row.push(m[r][c]); out.push(row); } return out; }
  function combineMasks(p, fn) {
    var ms = p.map(toMatrix), base = ms[0];
    return base.map(function (row, r) { return row.map(function (v, c) { var acc = truthy(v); for (var k = 1; k < ms.length; k++) acc = fn(acc, truthy(valueAt(ms[k], r, c))); return acc; }); });
  }
  function cmpCells(a, b, op) {
    a = normVal(a); b = normVal(b);
    if (a === null && b === null) return op === '=' || op === '<=' || op === '>=';
    if (a === null) a = typeof b === 'string' ? '' : 0;
    if (b === null) b = typeof a === 'string' ? '' : 0;
    if (typeRank(a) !== typeRank(b)) { if (op === '=') return false; if (op === '<>') return true; return cmpOp(typeRank(a), typeRank(b), op); }
    if (typeof a === 'string') return cmpOp(lower(a), lower(b), op);
    return cmpOp(a, b, op);
  }

  evaluator.customFunctions = CUSTOM;

  EFS.evaluator = evaluator;
  return evaluator;
});
