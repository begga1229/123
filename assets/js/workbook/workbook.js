/* Formula Studio — EFS.workbook
 * Loads xlsx/xlsm (ExcelJS, styles preserved) and xls/csv/ods/xlsb (SheetJS → converted to an ExcelJS workbook),
 * builds a SheetModel per sheet (cells, header-row detection, typed headers, preview rows, parser context),
 * writes formulas into the workbook (single cell or filled column) and exports the result as an .xlsx blob.
 *
 * Browser globals used lazily: ExcelJS (vendor/exceljs.min.js), XLSX (vendor/xlsx.full.min.js).
 * In Node the same libraries are required from process.env.EFS_NODE_MODULES (tests only). */
(function (root, factory) {
  var EFS = root.EFS || (root.EFS = {});
  var api = factory(EFS, root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (EFS, root) {
  'use strict';
  var workbook = {};

  /* ------------------------------------------------------------------ */
  /* Constants and messages                                              */
  /* ------------------------------------------------------------------ */

  workbook.supportedExtensions = ['.xlsx', '.xlsm', '.xls', '.csv', '.txt', '.ods', '.xlsb'];
  workbook.HEADER_SCAN_ROWS = 30;      // rows inspected by detectHeaderRow
  workbook.TYPE_SAMPLE_SIZE = 50;      // non-empty values used to type a column
  workbook.LONG_TEXT = 60;             // a text cell longer than this is a "sentence", not a header

  var MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  workbook.MESSAGES = {
    sheetjsFallback: {
      tr: 'Biçimlendirme korunamadı: dosya .xls/.csv/.ods biçiminde olduğu için yalnızca değerler ve formüller aktarıldı. İndirilen dosya .xlsx olacaktır.',
      ru: 'Форматирование не сохранено: файл в формате .xls/.csv/.ods, поэтому перенесены только значения и формулы. Скачанный файл будет в формате .xlsx.',
      en: 'Formatting was not preserved: the file is .xls/.csv/.ods, so only values and formulas were imported. The downloaded file will be an .xlsx file.'
    },
    exceljsFailed: {
      tr: 'Dosya ExcelJS ile açılamadı, SheetJS ile okundu. Biçimlendirme korunamadı; yalnızca değerler ve formüller aktarıldı.',
      ru: 'Не удалось открыть файл через ExcelJS, он прочитан через SheetJS. Форматирование не сохранено; перенесены только значения и формулы.',
      en: 'The file could not be opened with ExcelJS and was read with SheetJS instead. Formatting was not preserved; only values and formulas were imported.'
    },
    macros: {
      tr: 'Makrolar (.xlsm) korunmaz; dosya .xlsx olarak indirilecek.',
      ru: 'Макросы (.xlsm) не сохраняются; файл будет скачан как .xlsx.',
      en: 'Macros (.xlsm) are not preserved; the file will be downloaded as .xlsx.'
    },
    csvEncoding: {
      tr: 'CSV dosyası UTF-8 değildi; metin {enc} kod sayfasıyla çözüldü. Harfler bozuk görünüyorsa dosyayı UTF-8 olarak kaydedin.',
      ru: 'CSV-файл не в кодировке UTF-8; текст декодирован как {enc}. Если буквы отображаются неверно, сохраните файл в UTF-8.',
      en: 'The CSV file was not UTF-8; text was decoded as {enc}. If letters look wrong, save the file as UTF-8.'
    },
    unsupportedType: {
      tr: 'Desteklenmeyen dosya türü. Desteklenen uzantılar: .xlsx, .xlsm, .xls, .csv, .ods.',
      ru: 'Неподдерживаемый тип файла. Поддерживаются: .xlsx, .xlsm, .xls, .csv, .ods.',
      en: 'Unsupported file type. Supported extensions: .xlsx, .xlsm, .xls, .csv, .ods.'
    },
    noSheets: {
      tr: 'Dosyada hiç sayfa bulunamadı.',
      ru: 'В файле не найдено ни одного листа.',
      en: 'The file contains no sheets.'
    },
    libMissing: {
      tr: 'Excel kütüphanesi (ExcelJS / SheetJS) yüklenemedi. assets/js/vendor klasörünü kontrol edin.',
      ru: 'Не удалось загрузить библиотеку Excel (ExcelJS / SheetJS). Проверьте папку assets/js/vendor.',
      en: 'The Excel library (ExcelJS / SheetJS) could not be loaded. Check the assets/js/vendor folder.'
    },
    badTarget: {
      tr: 'Formülün yazılacağı hedef (hücre veya aralık) geçersiz.',
      ru: 'Неверная цель для записи формулы (ячейка или диапазон).',
      en: 'The target to write the formula into (cell or range) is invalid.'
    },
    badSheet: {
      tr: 'Seçilen sayfa bulunamadı.',
      ru: 'Выбранный лист не найден.',
      en: 'The selected sheet was not found.'
    },
    emptyFormula: {
      tr: 'Yazılacak formül boş.',
      ru: 'Формула для записи пуста.',
      en: 'The formula to write is empty.'
    },
    readFailed: {
      tr: 'Dosya okunamadı: {detail}',
      ru: 'Не удалось прочитать файл: {detail}',
      en: 'The file could not be read: {detail}'
    },
    noDocument: {
      tr: 'İndirme yalnızca tarayıcıda yapılabilir.',
      ru: 'Скачивание возможно только в браузере.',
      en: 'Download is only available in a browser.'
    }
  };

  function msg(key, vars) {
    var m = workbook.MESSAGES[key] || { tr: key, ru: key, en: key };
    var out = { tr: m.tr, ru: m.ru, en: m.en };
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        var re = new RegExp('\\{' + k + '\\}', 'g');
        out.tr = out.tr.replace(re, vars[k]); out.ru = out.ru.replace(re, vars[k]); out.en = out.en.replace(re, vars[k]);
      });
    }
    return out;
  }

  /** Error carrying a trilingual message in .messages. */
  function efsError(key, vars) {
    var m = msg(key, vars);
    var e = new Error(m.en);
    e.messages = m;
    e.code = key;
    return e;
  }
  workbook.error = efsError;

  /* ------------------------------------------------------------------ */
  /* Environment: library access (lazy, never at load time)              */
  /* ------------------------------------------------------------------ */

  var isNode = typeof process !== 'undefined' && process.versions && !!process.versions.node && typeof window === 'undefined';

  function nodeRequire(name) {
    if (typeof require !== 'function') return null;
    var base = (typeof process !== 'undefined' && process.env && process.env.EFS_NODE_MODULES) || '';
    if (base) {
      try { return require(base.replace(/\/+$/, '') + '/' + name); } catch (e) { /* fall through */ }
    }
    try { return require(name); } catch (e2) { return null; }
  }

  var _ExcelJS = null, _XLSX = null;
  function getExcelJS() {
    if (_ExcelJS) return _ExcelJS;
    if (root.ExcelJS) return (_ExcelJS = root.ExcelJS);
    var m = nodeRequire('exceljs');
    if (m) _ExcelJS = m.Workbook ? m : (m.default || m);
    return _ExcelJS;
  }
  function getXLSX() {
    if (_XLSX) return _XLSX;
    if (root.XLSX) return (_XLSX = root.XLSX);
    var m = nodeRequire('xlsx');
    if (m) _XLSX = m.read ? m : (m.default || m);
    return _XLSX;
  }
  workbook.getExcelJS = getExcelJS;
  workbook.getXLSX = getXLSX;

  /* ------------------------------------------------------------------ */
  /* Address helpers (same semantics as EFS.util)                        */
  /* ------------------------------------------------------------------ */

  function columnLetter(n) {
    var s = ''; n = Number(n);
    while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
    return s;
  }
  function columnIndex(letters) {
    var n = 0; letters = String(letters || '').toUpperCase();
    for (var i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
    return n;
  }
  function splitAddress(addr) {
    var m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(String(addr || '').trim());
    return m ? { col: m[1].toUpperCase(), row: parseInt(m[2], 10) } : null;
  }
  function parseRange(text) {
    var t = String(text || '').trim().replace(/\$/g, '');
    var m = /^([A-Za-z]{1,3})(\d+)?:([A-Za-z]{1,3})(\d+)?$/.exec(t);
    if (m) return { col: m[1].toUpperCase(), row: m[2] ? +m[2] : null, col2: m[3].toUpperCase(), row2: m[4] ? +m[4] : null };
    m = /^([A-Za-z]{1,3})(\d+)$/.exec(t);
    if (m) return { col: m[1].toUpperCase(), row: +m[2], col2: m[1].toUpperCase(), row2: +m[2] };
    m = /^(\d+):(\d+)$/.exec(t);
    if (m) return { col: null, row: +m[1], col2: null, row2: +m[2] };
    return null;
  }
  workbook.columnLetter = columnLetter;
  workbook.columnIndex = columnIndex;
  workbook.splitAddress = splitAddress;
  workbook.parseRange = parseRange;

  /** Normalised rectangle {top,left,bottom,right} (1-based) from 'A1:D9', 'A1' or '$A$1:$B$2'. */
  function rect(rangeText) {
    var r = parseRange(rangeText);
    if (!r || !r.col) return null;
    var c1 = columnIndex(r.col), c2 = columnIndex(r.col2);
    var r1 = r.row == null ? 1 : r.row, r2 = r.row2 == null ? r1 : r.row2;
    return { top: Math.min(r1, r2), bottom: Math.max(r1, r2), left: Math.min(c1, c2), right: Math.max(c1, c2) };
  }
  workbook.rect = rect;

  /* ------------------------------------------------------------------ */
  /* Display formatting                                                  */
  /* ------------------------------------------------------------------ */

  var EPOCH = Date.UTC(1899, 11, 30);
  var MS_DAY = 86400000;

  function toSerial(d) {
    return (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()) - EPOCH) / MS_DAY;
  }
  function fromSerial(n) {
    return new Date(Math.round(EPOCH + Number(n) * MS_DAY));
  }
  workbook.toSerial = toSerial;
  workbook.fromSerial = fromSerial;

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /** True when an Excel number format renders dates/times. */
  function isDateFormat(fmt) {
    if (!fmt || typeof fmt !== 'string') return false;
    var f = fmt.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').replace(/\\./g, '');
    if (/^general$/i.test(f.trim())) return false;
    if (/[#0]/.test(f) && !/[dmyhs]/i.test(f)) return false;
    return /[dyhs]/i.test(f) || /m/i.test(f) && !/[#0%]/.test(f);
  }
  workbook.isDateFormat = isDateFormat;

  function hasTimePart(d) {
    return d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0 || d.getUTCSeconds() !== 0;
  }

  function formatDate(d, numFmt) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return '';
    var s = pad2(d.getUTCDate()) + '.' + pad2(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear();
    var wantsTime = numFmt && /[hs]/i.test(String(numFmt).replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, ''));
    var onlyTime = numFmt && !/[dy]/i.test(String(numFmt).replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '')) && wantsTime;
    if (onlyTime) return pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) + (d.getUTCSeconds() ? ':' + pad2(d.getUTCSeconds()) : '');
    if (wantsTime || hasTimePart(d)) s += ' ' + pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes());
    return s;
  }
  workbook.formatDate = formatDate;

  function decimalSep(lang) { return lang === 'en' ? '.' : ','; }
  function groupSep(lang) { return lang === 'en' ? ',' : lang === 'ru' ? ' ' : '.'; }

  function groupDigits(intText, sep) {
    return intText.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  }

  /** Format a number with a fixed or automatic number of decimals. */
  function formatNumberCore(v, decimals, auto, grouping, lang) {
    if (typeof v !== 'number' || !isFinite(v)) return String(v);
    var neg = v < 0; var abs = Math.abs(v);
    var text;
    if (auto) {
      var rounded = Math.round(abs * 10000) / 10000;
      text = rounded.toFixed(4).replace(/\.?0+$/, '');
      if (abs >= 1e15) text = String(abs);
    } else {
      text = abs.toFixed(decimals);
    }
    var parts = text.split('.');
    var intPart = grouping ? groupDigits(parts[0], groupSep(lang)) : parts[0];
    var out = intPart + (parts[1] ? decimalSep(lang) + parts[1] : '');
    return (neg ? '-' : '') + out;
  }

  var CURRENCY_RE = /(₺|€|\$|₽|£|TL|руб\.?|USD|EUR|TRY|RUB)/;

  /** Rough rendering of a number using the cell's numFmt (percent, decimals, grouping, currency). */
  function formatNumber(v, numFmt, lang) {
    lang = lang || 'tr';
    if (typeof v !== 'number' || !isFinite(v)) return String(v == null ? '' : v);
    var fmt = typeof numFmt === 'string' ? numFmt : '';
    if (fmt && isDateFormat(fmt)) return formatDate(fromSerial(v), fmt);
    var section = fmt.split(';')[0] || '';
    var literal = section.replace(/\[[^\]]*\]/g, '');
    var quoted = (literal.match(/"[^"]*"/g) || []).join(' ');
    var core = literal.replace(/"[^"]*"/g, '').replace(/\\./g, '');
    var percent = core.indexOf('%') >= 0;
    var decimals = 0, auto = true;
    var dm = /[#0]*\.([#0]+)/.exec(core);
    if (dm) { decimals = dm[1].length; auto = false; }
    else if (/[#0]/.test(core)) { decimals = 0; auto = false; }
    var grouping = /[#0],[#0]/.test(core) || /#,##/.test(core);
    var value = percent ? v * 100 : v;
    var text = formatNumberCore(value, decimals, auto, grouping, lang);
    if (percent) return text + ' %';
    var cur = CURRENCY_RE.exec(quoted) || CURRENCY_RE.exec(core) || CURRENCY_RE.exec(section);
    if (cur) {
      var sym = cur[1];
      if (sym === '$' && /\[\$[^\]]*\]/.test(section)) {
        var lm = /\[\$([^\]-]*)/.exec(section); if (lm && lm[1]) sym = lm[1];
      }
      text = /^(\$|£|USD|EUR)$/.test(sym) && lang === 'en' ? sym + text : text + ' ' + sym;
    }
    return text;
  }
  workbook.formatNumber = formatNumber;

  function boolText(v, lang) {
    if (lang === 'tr') return v ? 'DOĞRU' : 'YANLIŞ';
    if (lang === 'ru') return v ? 'ИСТИНА' : 'ЛОЖЬ';
    return v ? 'TRUE' : 'FALSE';
  }
  workbook.boolText = boolText;

  /** Display string of a cell record {v,f,t,numFmt}. */
  function displayOf(rec, lang) {
    if (!rec) return '';
    switch (rec.t) {
      case 'n': return formatNumber(rec.v, rec.numFmt, lang);
      case 'd': return formatDate(rec.v, rec.numFmt);
      case 'b': return boolText(rec.v, lang);
      case 'e': return String(rec.v);
      case 's': return String(rec.v == null ? '' : rec.v).replace(/\r?\n/g, ' ');
      default: return rec.f ? '=' + rec.f : '';
    }
  }
  workbook.displayOf = displayOf;

  /* ------------------------------------------------------------------ */
  /* Cell records                                                        */
  /* ------------------------------------------------------------------ */

  var EMPTY = { v: null, f: null, t: 'z', display: '' };

  function richTextToString(rt) {
    if (!rt || !Array.isArray(rt.richText)) return '';
    return rt.richText.map(function (p) { return p && p.text != null ? String(p.text) : ''; }).join('');
  }

  /** Normalise a plain value (not a formula wrapper) into {v,t}. */
  function recFromPlain(val) {
    if (val === null || val === undefined) return { v: null, t: 'z' };
    if (val instanceof Date) return isNaN(val.getTime()) ? { v: null, t: 'z' } : { v: val, t: 'd' };
    var ty = typeof val;
    if (ty === 'number') return isFinite(val) ? { v: val, t: 'n' } : { v: '#NUM!', t: 'e' };
    if (ty === 'string') return val === '' ? { v: null, t: 'z' } : { v: val, t: 's' };
    if (ty === 'boolean') return { v: val, t: 'b' };
    if (ty === 'object') {
      if (val.error !== undefined) return { v: String(val.error), t: 'e' };
      if (val.richText) { var s = richTextToString(val); return s === '' ? { v: null, t: 'z' } : { v: s, t: 's' }; }
      if (val.hyperlink !== undefined || val.text !== undefined) {
        var txt = val.text && typeof val.text === 'object' ? richTextToString(val.text) : (val.text == null ? String(val.hyperlink || '') : String(val.text));
        return { v: txt, t: txt === '' ? 'z' : 's', hyperlink: val.hyperlink };
      }
      if (val.result !== undefined) return recFromPlain(val.result);
      if (val.formula !== undefined || val.sharedFormula !== undefined) return { v: null, t: 'z' };
    }
    return { v: String(val), t: 's' };
  }

  /** Build a cell record from an ExcelJS cell; null when the cell holds nothing. */
  function recFromExcelCell(cell) {
    var type = cell.type;
    if (type === 0 /* Null */ || type === 1 /* Merge */) return null;
    var rec;
    if (type === 6 /* Formula */) {
      var f = null;
      try { f = cell.formula; } catch (e) { f = null; }
      if (!f && cell.value && typeof cell.value === 'object') f = cell.value.formula || null;
      var res;
      try { res = cell.result; } catch (e2) { res = undefined; }
      if (res === undefined && cell.value && typeof cell.value === 'object') res = cell.value.result;
      rec = recFromPlain(res);
      rec.f = f ? String(f) : null;
      if (rec.t === 'z' && !rec.f) return null;
    } else {
      rec = recFromPlain(cell.value);
      rec.f = null;
      if (rec.t === 'z') return null;
    }
    var nf = cell.numFmt;
    if (nf) rec.numFmt = nf;
    return rec;
  }

  function numericString(s) {
    return /^-?\d+([.,]\d+)?$/.test(String(s).trim());
  }

  /** Column type id of a record for header typing. */
  function recTypeId(rec) {
    if (!rec || rec.t === 'z' || rec.t === 'e') return null;
    if (rec.t === 'n') return 'number';
    if (rec.t === 'd') return 'date';
    if (rec.t === 'b') return 'bool';
    if (rec.t === 's') return numericString(rec.v) ? 'number' : 'text';
    return null;
  }

  /* ------------------------------------------------------------------ */
  /* SheetModel                                                          */
  /* ------------------------------------------------------------------ */

  function SheetModel(name, index) {
    this.name = name;
    this.index = index;
    this.rowCount = 0;
    this.colCount = 0;
    this.usedRange = 'A1:A1';
    this._rows = Object.create(null);   // row → { col → rec }
    this._merges = [];                  // [{top,left,bottom,right}]
    this._headerRow = null;             // null = auto-detect on first access
    this._headerAuto = true;
    this._headers = null;
    this._ctx = null;
    this._ctxVersion = -1;
    Object.defineProperty(this, 'workbook', { value: null, writable: true, enumerable: false });
    Object.defineProperty(this, '_ws', { value: null, writable: true, enumerable: false });
  }

  SheetModel.prototype._put = function (row, col, rec) {
    if (!rec) return;
    var r = this._rows[row] || (this._rows[row] = Object.create(null));
    r[col] = rec;
    if (rec.t !== 'z' || rec.f) {
      if (row > this.rowCount) this.rowCount = row;
      if (col > this.colCount) this.colCount = col;
    }
  };

  SheetModel.prototype._finish = function () {
    this.usedRange = 'A1:' + columnLetter(Math.max(1, this.colCount)) + Math.max(1, this.rowCount);
  };

  /** Raw record at (row, col), 1-based; EMPTY when nothing is there. */
  SheetModel.prototype.cellAt = function (row, col) {
    var r = this._rows[row];
    var rec = r && r[col];
    return rec || EMPTY;
  };

  /** getCell('F12') → { v, f, t, display } */
  SheetModel.prototype.getCell = function (addr, lang) {
    var a = splitAddress(addr);
    if (!a) return { v: null, f: null, t: 'z', display: '' };
    var rec = this.cellAt(a.row, columnIndex(a.col));
    return { v: rec.v, f: rec.f || null, t: rec.t, display: displayOf(rec, lang || this._lang()), numFmt: rec.numFmt };
  };

  SheetModel.prototype._lang = function () {
    return (this.workbook && this.workbook.lang) || 'tr';
  };

  SheetModel.prototype.isEmptyCell = function (row, col) {
    var rec = this.cellAt(row, col);
    return rec.t === 'z' && !rec.f;
  };

  /** Non-empty records of a row as [{col, rec}]. */
  SheetModel.prototype._rowCells = function (row) {
    var r = this._rows[row], out = [];
    if (!r) return out;
    var cols = Object.keys(r);
    for (var i = 0; i < cols.length; i++) {
      var rec = r[cols[i]];
      if (rec && (rec.t !== 'z' || rec.f)) out.push({ col: +cols[i], rec: rec });
    }
    out.sort(function (a, b) { return a.col - b.col; });
    return out;
  };

  /** Preview rows: arrays of display strings, 1-based start, colCount entries per row. */
  SheetModel.prototype.rows = function (start, count, lang) {
    start = Math.max(1, parseInt(start, 10) || 1);
    count = Math.max(0, parseInt(count, 10) || 0);
    lang = lang || this._lang();
    var out = [];
    var last = Math.min(this.rowCount, start + count - 1);
    var width = Math.max(1, this.colCount);
    for (var r = start; r <= last; r++) {
      var row = new Array(width);
      for (var c = 1; c <= width; c++) row[c - 1] = displayOf(this.cellAt(r, c), lang);
      out.push(row);
    }
    return out;
  };

  /** Merge rectangle whose master is (row,col), or null. */
  SheetModel.prototype._mergeAt = function (row, col) {
    for (var i = 0; i < this._merges.length; i++) {
      var m = this._merges[i];
      if (m.top === row && m.left === col) return m;
    }
    return null;
  };

  /* ---- header detection -------------------------------------------- */

  SheetModel.prototype._rowStats = function (row) {
    var cells = this._rowCells(row);
    var st = { row: row, nonEmpty: cells.length, text: 0, long: 0, numeric: 0, mergedWide: 0, minCol: 0, maxCol: 0, cols: [] };
    for (var i = 0; i < cells.length; i++) {
      var rec = cells[i].rec, col = cells[i].col;
      st.cols.push(col);
      if (!st.minCol || col < st.minCol) st.minCol = col;
      if (col > st.maxCol) st.maxCol = col;
      var id = recTypeId(rec);
      if (id === 'text') { st.text++; if (String(rec.v).length > workbook.LONG_TEXT) st.long++; }
      else if (id === 'number' || id === 'date' || id === 'bool') st.numeric++;
      var m = this._mergeAt(row, col);
      if (m && m.right > m.left) st.mergedWide++;
    }
    st.density = st.nonEmpty ? st.nonEmpty / (st.maxCol - st.minCol + 1) : 0;
    return st;
  };

  /** Columns holding at least one value in rows (row+1 .. row+span). */
  SheetModel.prototype._dataColumnsBelow = function (row, span) {
    var cols = Object.create(null), n = 0;
    for (var r = row + 1; r <= row + span && r <= this.rowCount; r++) {
      var cells = this._rowCells(r);
      for (var i = 0; i < cells.length; i++) if (!cols[cells[i].col]) { cols[cells[i].col] = true; n++; }
    }
    return { cols: cols, count: n };
  };

  /** Share of the data columns below that carry a label in this row. */
  function coverageOf(st, dataCols) {
    if (!dataCols.count) return 0;
    var hit = 0;
    for (var i = 0; i < st.cols.length; i++) if (dataCols.cols[st.cols[i]]) hit++;
    return hit / dataCols.count;
  }

  function headerCandidate(st, strict, statsBelow, dataCols) {
    if (st.nonEmpty < 3) return false;
    if (st.text / st.nonEmpty < 0.6) return false;
    var longAllowance = Math.max(1, Math.floor(st.nonEmpty * 0.15));
    if (st.long > longAllowance) return false;
    if (st.nonEmpty === 1 && st.mergedWide === 1) return false;   // merged title row
    if (!statsBelow.length) return false;
    if (st.density < 0.4) return false;                             // scattered "label: value   k= 1.08" rows
    if (coverageOf(st, dataCols) < 0.5) return false;               // a header labels the columns that hold data
    if (strict) {
      for (var i = 0; i < statsBelow.length; i++) if (statsBelow[i].numeric > 0) return true;
      return false;
    }
    return statsBelow[0].nonEmpty >= 2;
  }

  /** Heuristic header row (see ARCHITECTURE §11); never throws, falls back to 1. */
  function detectHeaderRow(sheet) {
    if (!sheet || typeof sheet._rowStats !== 'function') return 1;
    var maxScan = Math.min(workbook.HEADER_SCAN_ROWS, Math.max(1, sheet.rowCount));
    var stats = [], dataCols = [];
    for (var r = 1; r <= maxScan + 3; r++) stats[r] = sheet._rowStats(r);
    for (var q = 1; q <= maxScan + 1; q++) dataCols[q] = sheet._dataColumnsBelow(q, 15);
    function below(r) {
      var out = [];
      for (var k = r + 1; k <= r + 3 && k <= sheet.rowCount; k++) if (stats[k]) out.push(stats[k]);
      return out;
    }
    var passes = [true, false];
    for (var p = 0; p < passes.length; p++) {
      var strict = passes[p];
      for (var row = 1; row <= maxScan; row++) {
        if (!headerCandidate(stats[row], strict, below(row), dataCols[row])) continue;
        // A group-header row (merged captions) is often followed by the real, wider header row.
        var pick = row;
        while (pick + 1 <= maxScan && headerCandidate(stats[pick + 1], strict, below(pick + 1), dataCols[pick + 1]) && stats[pick + 1].nonEmpty > stats[pick].nonEmpty) pick++;
        return pick;
      }
    }
    return 1;
  }
  workbook.detectHeaderRow = detectHeaderRow;

  /* ---- headers ----------------------------------------------------- */

  SheetModel.prototype._analyze = function () {
    if (this._headerRow == null) { this._headerRow = detectHeaderRow(this); this._headerAuto = true; }
    if (this._headers) return;
    var hr = this._headerRow;
    var lastRow = Math.max(this.rowCount, hr + 1);
    var firstData = hr + 1;
    var headers = [];
    var width = Math.max(this.colCount, (this._rows[hr] ? Math.max.apply(null, Object.keys(this._rows[hr]).map(Number).concat([0])) : 0));
    for (var c = 1; c <= width; c++) {
      var hrec = this.cellAt(hr, c);
      var name = '';
      if (hrec.t !== 'z') name = String(displayOf(hrec, 'en')).replace(/\s*[\r\n]+\s*/g, ' ').replace(/\s+/g, ' ').trim();
      var typed = this._columnType(c, firstData, lastRow);
      if (!name && typed.type === 'empty') continue;
      if (!name) name = columnLetter(c);
      headers.push({
        name: name,
        col: columnLetter(c),
        index: c,
        type: typed.type,
        dataRange: columnLetter(c) + firstData + ':' + columnLetter(c) + lastRow,
        range: columnLetter(c) + hr + ':' + columnLetter(c) + lastRow,
        sample: typed.sample
      });
    }
    this._headers = headers;
    this._firstDataRow = firstData;
    this._lastRow = lastRow;
  };

  SheetModel.prototype._columnType = function (col, firstData, lastRow) {
    var counts = { number: 0, date: 0, text: 0, bool: 0 }, total = 0, sample = [], formulas = 0;
    for (var r = firstData; r <= lastRow && total < workbook.TYPE_SAMPLE_SIZE; r++) {
      var rec = this.cellAt(r, col);
      var id = recTypeId(rec);
      if (!id) { if (rec.f) formulas++; continue; }
      counts[id]++; total++;
      if (sample.length < 3) sample.push(sampleValue(rec));
    }
    if (!total) return { type: formulas ? 'mixed' : 'empty', sample: [] };   // formulas without cached results: content of unknown type
    var best = 'text', bestN = -1;
    ['number', 'date', 'text', 'bool'].forEach(function (k) { if (counts[k] > bestN) { bestN = counts[k]; best = k; } });
    return { type: bestN / total >= 0.6 ? best : 'mixed', sample: sample };
  };

  function sampleValue(rec) {
    if (rec.t === 'd') return rec.v.getUTCFullYear() + '-' + pad2(rec.v.getUTCMonth() + 1) + '-' + pad2(rec.v.getUTCDate());
    if (rec.t === 's') return String(rec.v).trim();
    return rec.v;
  }

  Object.defineProperty(SheetModel.prototype, 'headerRow', {
    enumerable: true,
    get: function () { this._analyze(); return this._headerRow; },
    set: function (n) { this.setHeaderRow(n); }
  });
  Object.defineProperty(SheetModel.prototype, 'firstDataRow', {
    enumerable: true, get: function () { this._analyze(); return this._firstDataRow; }
  });
  Object.defineProperty(SheetModel.prototype, 'lastRow', {
    enumerable: true, get: function () { this._analyze(); return this._lastRow; }
  });
  Object.defineProperty(SheetModel.prototype, 'headers', {
    enumerable: true, get: function () { this._analyze(); return this._headers; }
  });
  Object.defineProperty(SheetModel.prototype, 'headerAuto', {
    enumerable: true, get: function () { this._analyze(); return this._headerAuto; }
  });

  /** Set the header row manually (UI selector); null restores auto-detection. */
  SheetModel.prototype.setHeaderRow = function (n) {
    if (n == null || n === '' || n === 'auto') { this._headerRow = null; this._headerAuto = true; }
    else {
      n = parseInt(n, 10);
      if (!isFinite(n) || n < 1) n = 1;
      this._headerRow = n; this._headerAuto = false;
    }
    this._invalidate();
    return this.headerRow;
  };

  SheetModel.prototype._invalidate = function () {
    this._headers = null; this._ctx = null;
    if (this.workbook) this.workbook._version++;
  };

  /** Header entry by column letter or (folded) name. */
  SheetModel.prototype.headerByCol = function (col) {
    var letter = String(col || '').toUpperCase();
    var hs = this.headers;
    for (var i = 0; i < hs.length; i++) if (hs[i].col === letter) return hs[i];
    return null;
  };

  /** First column (letter) with neither a header nor data, after the last used column. */
  SheetModel.prototype.nextFreeColumn = function () {
    var hs = this.headers;
    var maxIdx = this.colCount;
    for (var i = 0; i < hs.length; i++) if (hs[i].index > maxIdx) maxIdx = hs[i].index;
    return columnLetter(maxIdx + 1);
  };

  /** Context object for the parser/intents (§8). Cached until the workbook changes. */
  SheetModel.prototype.toContext = function () {
    var wb = this.workbook;
    var version = wb ? wb._version : 0;
    if (this._ctx && this._ctxVersion === version) return this._ctx;
    var self = this;
    var ctx = {
      sheetName: this.name,
      sheets: wb ? wb.sheets.map(function (s) { return s.name; }) : [this.name],
      headerRow: this.headerRow,
      firstDataRow: this.firstDataRow,
      lastRow: this.lastRow,
      headers: this.headers.map(cloneHeader),
      otherSheets: {},
      activeCell: null
    };
    if (wb) {
      wb.sheets.forEach(function (s) {
        if (s === self) return;
        ctx.otherSheets[s.name] = { headerRow: s.headerRow, firstDataRow: s.firstDataRow, lastRow: s.lastRow, headers: s.headers.map(cloneHeader) };
      });
    }
    this._ctx = ctx; this._ctxVersion = version;
    return ctx;
  };

  function cloneHeader(h) {
    return { name: h.name, col: h.col, index: h.index, type: h.type, dataRange: h.dataRange, range: h.range, sample: h.sample.slice() };
  }

  workbook.SheetModel = SheetModel;

  /* ------------------------------------------------------------------ */
  /* Building sheet models from ExcelJS                                  */
  /* ------------------------------------------------------------------ */

  function mergesOf(ws) {
    var out = [];
    var raw = ws._merges;
    if (raw && typeof raw === 'object') {
      Object.keys(raw).forEach(function (k) {
        var m = raw[k];
        var r = null;
        if (m && typeof m === 'object' && m.top != null) r = { top: m.top, left: m.left, bottom: m.bottom, right: m.right };
        else if (typeof m === 'string') r = rect(m);
        else if (m && m.model) r = rect(m.model);
        else r = rect(k);
        if (r) out.push(r);
      });
      return out;
    }
    try {
      var list = (ws.model && ws.model.merges) || [];
      list.forEach(function (s) { var r = rect(s); if (r) out.push(r); });
    } catch (e) { /* ignore */ }
    return out;
  }

  function buildSheetModel(ws, index) {
    var sheet = new SheetModel(String(ws.name || ('Sheet' + (index + 1))), index);
    sheet._ws = ws;
    ws.eachRow({ includeEmpty: false }, function (row, rowNumber) {
      row.eachCell({ includeEmpty: false }, function (cell, colNumber) {
        var rec = recFromExcelCell(cell);
        if (rec) sheet._put(rowNumber, colNumber, rec);
      });
    });
    sheet._merges = mergesOf(ws);
    sheet._finish();
    return sheet;
  }
  workbook.buildSheetModel = buildSheetModel;

  /* ------------------------------------------------------------------ */
  /* Input decoding                                                      */
  /* ------------------------------------------------------------------ */

  function readFileAsArrayBuffer(file) {
    return new Promise(function (resolve, reject) {
      if (!file) return reject(efsError('readFailed', { detail: 'no file' }));
      if (typeof file.arrayBuffer === 'function') {
        file.arrayBuffer().then(resolve, reject); return;
      }
      if (typeof FileReader !== 'undefined') {
        var fr = new FileReader();
        fr.onload = function () { resolve(fr.result); };
        fr.onerror = function () { reject(efsError('readFailed', { detail: String(fr.error || 'FileReader') })); };
        fr.readAsArrayBuffer(file);
        return;
      }
      reject(efsError('readFailed', { detail: 'unsupported input' }));
    });
  }
  workbook.readFileAsArrayBuffer = readFileAsArrayBuffer;

  function toUint8(data) {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (data && data.buffer instanceof ArrayBuffer) return new Uint8Array(data.buffer, data.byteOffset || 0, data.byteLength);
    return null;
  }

  function extOf(name) {
    var m = /\.([A-Za-z0-9]+)$/.exec(String(name || ''));
    return m ? '.' + m[1].toLowerCase() : '';
  }

  function asciiHead(bytes, n) {
    var s = '';
    for (var i = 0; i < Math.min(n, bytes.length); i++) s += String.fromCharCode(bytes[i]);
    return s;
  }

  /** 'xlsx' | 'ods' | 'xls' | 'csv' | 'unknown' from magic bytes and extension. */
  function detectKind(bytes, name) {
    var ext = extOf(name);
    if (bytes && bytes.length >= 4) {
      if (bytes[0] === 0x50 && bytes[1] === 0x4B) {                 // zip container
        var head = asciiHead(bytes, 120);
        if (head.indexOf('mimetypeapplication/vnd.oasis.opendocument') >= 0 || ext === '.ods') return 'ods';
        if (ext === '.xlsb') return 'xlsb';
        return 'xlsx';
      }
      if (bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0) return 'xls';
    }
    if (ext === '.csv' || ext === '.txt' || ext === '.tsv') return 'csv';
    if (ext === '.xlsx' || ext === '.xlsm') return 'xlsx';
    if (ext === '.xls') return 'xls';
    if (ext === '.ods') return 'ods';
    if (ext === '.xlsb') return 'xlsb';
    if (bytes && bytes.length) {
      // plain text? (no NUL bytes in the first KB)
      var nul = false;
      for (var i = 0; i < Math.min(1024, bytes.length); i++) if (bytes[i] === 0) { nul = true; break; }
      if (!nul) return 'csv';
    }
    return 'unknown';
  }
  workbook.detectKind = detectKind;

  function decodeWith(bytes, label) {
    if (typeof TextDecoder === 'undefined') return null;
    try { return new TextDecoder(label).decode(bytes); } catch (e) { return null; }
  }

  /** Decode CSV bytes: BOM/UTF-8 first, otherwise windows-1254 (TR) vs windows-1251 (RU) by letter frequency. */
  function decodeText(bytes) {
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
      return { text: decodeWith(bytes.subarray(3), 'utf-8') || '', encoding: 'utf-8' };
    }
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
      var le = decodeWith(bytes.subarray(2), 'utf-16le'); if (le != null) return { text: le, encoding: 'utf-16le' };
    }
    if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
      var be = decodeWith(bytes.subarray(2), 'utf-16be'); if (be != null) return { text: be, encoding: 'utf-16be' };
    }
    var strict = null;
    try { if (typeof TextDecoder !== 'undefined') strict = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch (e) { strict = null; }
    if (strict != null) return { text: strict, encoding: 'utf-8' };
    var candidates = ['windows-1254', 'windows-1251', 'iso-8859-9', 'windows-1252'];
    var best = null, bestScore = -Infinity;
    for (var i = 0; i < candidates.length; i++) {
      var t = decodeWith(bytes, candidates[i]);
      if (t == null) continue;
      var score = scoreDecoding(t);
      if (score > bestScore) { bestScore = score; best = { text: t, encoding: candidates[i] }; }
    }
    if (best) return best;
    var loose = decodeWith(bytes, 'utf-8');
    return { text: loose == null ? asciiHead(bytes, bytes.length) : loose, encoding: 'utf-8' };
  }
  function scoreDecoding(t) {
    var good = 0, bad = 0;
    for (var i = 0; i < t.length && i < 20000; i++) {
      var c = t.charCodeAt(i);
      if ((c >= 0x400 && c <= 0x45F) || 'çğıöşüÇĞİÖŞÜ'.indexOf(t[i]) >= 0 || (c >= 0x41 && c <= 0x7A)) good++;
      else if ((c >= 0x80 && c <= 0xBF) || (c >= 0x2500 && c <= 0x25FF) || c === 0xFFFD || (c >= 0xC0 && c <= 0x24F && 'çğıöşüÇĞİÖŞÜäöüÄÖÜéèêáàâíìîóòôúùûñÉÈÊÁÀÂÍÌÎÓÒÔÚÙÛÑß'.indexOf(t[i]) < 0)) bad += 3;
    }
    return good - bad;
  }

  /** Guess the CSV delimiter from the first lines. */
  function detectDelimiter(text) {
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim() !== ''; }).slice(0, 20);
    var cands = [';', ',', '\t', '|'];
    var best = ';', bestScore = -1;
    for (var i = 0; i < cands.length; i++) {
      var d = cands[i], counts = [];
      for (var j = 0; j < lines.length; j++) {
        var inQ = false, n = 0, line = lines[j];
        for (var k = 0; k < line.length; k++) {
          var ch = line[k];
          if (ch === '"') inQ = !inQ;
          else if (!inQ && ch === d) n++;
        }
        counts.push(n);
      }
      if (!counts.length) continue;
      var min = Math.min.apply(null, counts), max = Math.max.apply(null, counts);
      var score = min > 0 ? min * 10 + (max === min ? 5 : 0) : (max > 0 ? max : 0);
      if (score > bestScore) { bestScore = score; best = d; }
    }
    return best;
  }
  workbook.detectDelimiter = detectDelimiter;

  /** Minimal RFC-4180 style CSV parser → array of rows (strings). */
  function parseCsv(text, delim) {
    var rows = [], row = [], field = '', inQ = false, i = 0, n = text.length;
    while (i < n) {
      var ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        field += ch; i++; continue;
      }
      if (ch === '"') { inQ = true; i++; continue; }
      if (ch === delim) { row.push(field); field = ''; i++; continue; }
      if (ch === '\r') { i++; continue; }
      if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += ch; i++;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
  }
  workbook.parseCsv = parseCsv;

  var MONTHS_TR = ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran', 'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık'];
  var MONTHS_RU = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  var MONTHS_EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  function monthFromName(name) {
    var n = String(name).toLowerCase();
    for (var i = 0; i < 12; i++) {
      if (n.indexOf(MONTHS_TR[i].slice(0, 3)) === 0 || n.indexOf(MONTHS_RU[i]) === 0 || n.indexOf(MONTHS_EN[i]) === 0) return i + 1;
    }
    return 0;
  }

  /** Parse a date written as dd.mm.yyyy, dd/mm/yyyy, yyyy-mm-dd, d month yyyy (TR/RU/EN), with optional time. Returns UTC Date or null. */
  function parseDateText(s) {
    s = String(s).trim();
    var m, y, mo, d, h = 0, mi = 0, sec = 0;
    var timeRe = /(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?Z?)?$/.exec(s))) { y = +m[1]; mo = +m[2]; d = +m[3]; h = +(m[4] || 0); mi = +(m[5] || 0); sec = +(m[6] || 0); }
    else if ((m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(s))) { d = +m[1]; mo = +m[2]; y = +m[3]; h = +(m[4] || 0); mi = +(m[5] || 0); sec = +(m[6] || 0); }
    else if ((m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2})$/.exec(s))) { d = +m[1]; mo = +m[2]; y = 2000 + +m[3]; }
    else if ((m = /^(\d{1,2})\s+([^\s\d]+)\.?\s+(\d{4})(?:\s+г\.?)?$/.exec(s))) { d = +m[1]; mo = monthFromName(m[2]); y = +m[3]; if (!mo) return null; }
    else return null;
    void timeRe;
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900 || y > 2200) return null;
    var dt = new Date(Date.UTC(y, mo - 1, d, h, mi, sec));
    if (dt.getUTCMonth() !== mo - 1) return null;
    return dt;
  }
  workbook.parseDateText = parseDateText;

  /** Parse a number written TR/RU/EN style ('1.234,56', '1 234,56', '12,5', '3.5', '10%', '%10'). Returns {v, numFmt?} or null. */
  function parseNumberText(s) {
    s = String(s).trim().replace(/ /g, ' ');
    if (s === '') return null;
    var pct = false;
    if (/^%\s*-?[\d.,\s]+$/.test(s)) { pct = true; s = s.replace(/^%\s*/, ''); }
    else if (/^-?[\d.,\s]+\s*%$/.test(s)) { pct = true; s = s.replace(/\s*%$/, ''); }
    var neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (/^-/.test(s)) { neg = !neg; s = s.slice(1); }
    s = s.replace(/\s+/g, '');
    var v;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) v = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) v = parseFloat(s.replace(/,/g, ''));
    else if (/^\d+,\d+$/.test(s)) v = parseFloat(s.replace(',', '.'));
    else if (/^\d+(\.\d+)?$/.test(s)) v = parseFloat(s);
    else if (/^\.\d+$/.test(s) || /^,\d+$/.test(s)) v = parseFloat('0.' + s.slice(1));
    else return null;
    if (!isFinite(v)) return null;
    if (neg) v = -v;
    if (pct) return { v: v / 100, numFmt: '0%' };
    return { v: v };
  }
  workbook.parseNumberText = parseNumberText;

  var BOOL_TEXT = { 'TRUE': true, 'FALSE': false, 'DOĞRU': true, 'YANLIŞ': false, 'ИСТИНА': true, 'ЛОЖЬ': false };

  /** Typed value for a CSV field. */
  function typeCsvField(raw) {
    if (raw == null) return null;
    var s = String(raw);
    var t = s.trim();
    if (t === '') return null;
    var up = t.toUpperCase();
    if (BOOL_TEXT.hasOwnProperty(up)) return { v: BOOL_TEXT[up], t: 'b' };
    if (/^#(N\/A|DIV\/0!|VALUE!|REF!|NAME\?|NUM!|NULL!)$/i.test(t)) return { v: up, t: 'e' };
    if (t[0] === '=' && t.length > 1) return { v: null, t: 'z', f: t.slice(1) };
    var num = parseNumberText(t);
    if (num) { var r = { v: num.v, t: 'n' }; if (num.numFmt) r.numFmt = num.numFmt; return r; }
    var dt = parseDateText(t);
    if (dt) return { v: dt, t: 'd', numFmt: hasTimePart(dt) ? 'dd.mm.yyyy hh:mm' : 'dd.mm.yyyy' };
    return { v: s.replace(/^\s+|\s+$/g, ''), t: 's' };
  }
  workbook.typeCsvField = typeCsvField;

  /* ------------------------------------------------------------------ */
  /* Converting SheetJS / CSV data into an ExcelJS workbook               */
  /* ------------------------------------------------------------------ */

  /** SheetJS Date objects are UTC-based for ODS (ISO strings) but local-time based for xls/xlsb serials;
   *  rebuild the intended calendar date/time as a UTC Date either way. */
  function sheetJsDateToUtc(d, kind) {
    var utcMidnight = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
    var localMidnight = d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0;
    var useUtc = kind === 'ods' ? true : (utcMidnight && !localMidnight);
    if (useUtc) return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()));
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()));
  }

  function sheetJsCellToExcel(cell, XLSX, kind) {
    if (!cell || cell.t === 'z') return null;
    var value = null, numFmt = typeof cell.z === 'string' ? cell.z : null;
    switch (cell.t) {
      case 'n':
        if (numFmt && isDateFormat(numFmt) && isFinite(cell.v)) value = fromSerial(cell.v);
        else value = cell.v;
        break;
      case 'd': value = cell.v instanceof Date ? sheetJsDateToUtc(cell.v, kind) : (parseDateText(cell.v) || String(cell.v)); if (!numFmt || !isDateFormat(numFmt)) numFmt = (value instanceof Date && hasTimePart(value)) ? 'dd.mm.yyyy hh:mm' : 'dd.mm.yyyy'; break;
      case 'b': value = !!cell.v; break;
      case 'e': value = { error: cell.w || errorName(cell.v) }; break;
      case 's':
      case 'str':
      default: value = cell.v == null ? null : String(cell.v); break;
    }
    if (cell.f) {
      var f = String(cell.f).replace(/^=/, '');
      value = value === null ? { formula: f } : { formula: f, result: value };
    }
    if (value === null || value === '') return null;
    return { value: value, numFmt: numFmt };
  }

  var SJ_ERRORS = { 0: '#NULL!', 7: '#DIV/0!', 15: '#VALUE!', 23: '#REF!', 29: '#NAME?', 36: '#NUM!', 42: '#N/A' };
  function errorName(code) { return SJ_ERRORS[code] || '#VALUE!'; }

  function convertSheetJsWorkbook(sjWb, XLSX, ExcelJS, kind) {
    var wb = new ExcelJS.Workbook();
    var names = sjWb.SheetNames || [];
    for (var s = 0; s < names.length; s++) {
      var sjWs = sjWb.Sheets[names[s]];
      var ws = wb.addWorksheet(uniqueSheetName(wb, names[s]));
      if (!sjWs) continue;
      var ref = sjWs['!ref'];
      if (ref) {
        var range = XLSX.utils.decode_range(ref);
        for (var r = range.s.r; r <= range.e.r; r++) {
          for (var c = range.s.c; c <= range.e.c; c++) {
            var addr = XLSX.utils.encode_cell({ r: r, c: c });
            var conv = sheetJsCellToExcel(sjWs[addr], XLSX, kind);
            if (!conv) continue;
            var cell = ws.getCell(r + 1, c + 1);
            cell.value = conv.value;
            if (conv.numFmt) cell.numFmt = conv.numFmt;
          }
        }
      }
      var merges = sjWs['!merges'] || [];
      for (var m = 0; m < merges.length; m++) {
        var mg = merges[m];
        try { ws.mergeCells(mg.s.r + 1, mg.s.c + 1, mg.e.r + 1, mg.e.c + 1); } catch (e) { /* overlapping merges in odd files */ }
      }
      var cols = sjWs['!cols'] || [];
      for (var k = 0; k < cols.length; k++) if (cols[k] && cols[k].wch) ws.getColumn(k + 1).width = cols[k].wch;
    }
    return wb;
  }

  function uniqueSheetName(wb, name) {
    var base = String(name || 'Sheet').replace(/[\[\]*?/\\:]/g, ' ').slice(0, 31) || 'Sheet';
    var n = base, i = 2;
    while (wb.getWorksheet && wb.getWorksheet(n)) n = (base.slice(0, 28) + ' ' + i++);
    return n;
  }

  function convertCsvRows(rows, ExcelJS, sheetName) {
    var wb = new ExcelJS.Workbook();
    var ws = wb.addWorksheet(sheetName || 'Sheet1');
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      for (var c = 0; c < row.length; c++) {
        var typed = typeCsvField(row[c]);
        if (!typed) continue;
        var cell = ws.getCell(r + 1, c + 1);
        if (typed.f) cell.value = { formula: typed.f };
        else if (typed.t === 'e') cell.value = { error: typed.v };
        else cell.value = typed.v;
        if (typed.numFmt) cell.numFmt = typed.numFmt;
      }
    }
    return wb;
  }

  /* ------------------------------------------------------------------ */
  /* load()                                                              */
  /* ------------------------------------------------------------------ */

  function baseName(name) {
    return String(name || '').replace(/^.*[\\/]/, '').replace(/\.[A-Za-z0-9]+$/, '') || 'workbook';
  }

  /**
   * workbook.load(fileOrBuffer, fileName) → Promise<WorkbookModel>
   * Accepts a File/Blob, ArrayBuffer, Uint8Array, Node Buffer, a CSV string (with a .csv/.txt fileName)
   * or, in Node, a file path string.
   */
  workbook.load = function (input, fileName, options) {
    options = options || {};
    return Promise.resolve().then(function () {
      if (input && typeof input === 'object' && typeof input.arrayBuffer === 'function' && (typeof Blob === 'undefined' || input instanceof Blob || input.name)) {
        fileName = fileName || input.name;
        return readFileAsArrayBuffer(input);
      }
      if (typeof input === 'string') {
        var ext = extOf(fileName);
        if (ext === '.csv' || ext === '.txt' || ext === '.tsv') return new TextEncoder().encode(input);
        if (isNode) {
          var fs = nodeRequire('fs');
          fileName = fileName || input;
          return fs.readFileSync(input);
        }
        return new TextEncoder().encode(input);
      }
      return input;
    }).then(function (data) {
      var bytes = toUint8(data);
      if (!bytes) throw efsError('readFailed', { detail: 'unsupported input type' });
      return loadBytes(bytes, fileName || 'workbook.xlsx', options);
    });
  };

  function loadBytes(bytes, fileName, options) {
    var kind = detectKind(bytes, fileName);
    var ExcelJS = getExcelJS();
    if (!ExcelJS) throw efsError('libMissing');
    var warnings = [];
    var ext = extOf(fileName);
    if (ext === '.xlsm') warnings.push(msg('macros'));

    function finish(exWb, engine) {
      var model = buildWorkbookModel(exWb, fileName, engine, warnings, options);
      return model;
    }

    if (kind === 'xlsx') {
      var exWb = new ExcelJS.Workbook();
      var ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      return exWb.xlsx.load(ab).then(function () {
        if (!exWb.worksheets || !exWb.worksheets.length) throw efsError('noSheets');
        return finish(exWb, 'exceljs');
      }, function (err) {
        var XLSX = getXLSX();
        if (!XLSX) throw err;
        warnings.push(msg('exceljsFailed'));
        var sj = XLSX.read(bytes, { type: 'array', cellDates: true, cellNF: true });
        return finish(convertSheetJsWorkbook(sj, XLSX, ExcelJS, 'xlsx'), 'sheetjs');
      });
    }
    if (kind === 'csv') {
      var dec = decodeText(bytes);
      if (dec.encoding !== 'utf-8' && dec.encoding !== 'utf-16le' && dec.encoding !== 'utf-16be') warnings.push(msg('csvEncoding', { enc: dec.encoding }));
      var delim = options.delimiter || detectDelimiter(dec.text);
      var rows = parseCsv(dec.text, delim);
      warnings.push(msg('sheetjsFallback'));
      var csvWb = convertCsvRows(rows, ExcelJS, baseName(fileName).slice(0, 31));
      return Promise.resolve(finish(csvWb, 'sheetjs'));
    }
    if (kind === 'xls' || kind === 'ods' || kind === 'xlsb') {
      var XLSX2 = getXLSX();
      if (!XLSX2) throw efsError('libMissing');
      var sj2;
      try { sj2 = XLSX2.read(bytes, { type: 'array', cellDates: true, cellNF: true }); }
      catch (e) { throw efsError('readFailed', { detail: (e && e.message) || String(e) }); }
      if (!sj2 || !sj2.SheetNames || !sj2.SheetNames.length) throw efsError('noSheets');
      warnings.push(msg('sheetjsFallback'));
      return Promise.resolve(finish(convertSheetJsWorkbook(sj2, XLSX2, ExcelJS, kind), 'sheetjs'));
    }
    throw efsError('unsupportedType');
  }

  function buildWorkbookModel(exWb, fileName, engine, warnings, options) {
    var model = {
      name: String(fileName || 'workbook.xlsx').replace(/^.*[\\/]/, ''),
      engine: engine,
      sheets: [],
      activeIndex: 0,
      warnings: warnings || [],
      lang: (options && options.lang) || 'tr',
      _version: 0
    };
    Object.defineProperty(model, 'exceljs', { value: exWb, enumerable: false, writable: true });
    var sheets = exWb.worksheets || [];
    for (var i = 0; i < sheets.length; i++) {
      var sm = buildSheetModel(sheets[i], i);
      sm.workbook = model;
      model.sheets.push(sm);
    }
    if (!model.sheets.length) throw efsError('noSheets');
    // Active sheet: the first sheet that has data.
    for (var k = 0; k < model.sheets.length; k++) if (model.sheets[k].rowCount > 0) { model.activeIndex = k; break; }
    if (options && options.analyzeAll) model.sheets.forEach(function (s) { s._analyze(); });
    return model;
  }

  /** Create an in-memory workbook model from an ExcelJS workbook you built yourself (tests, UI demos). */
  workbook.fromExcelJS = function (exWb, name) {
    return buildWorkbookModel(exWb, name || 'workbook.xlsx', 'exceljs', [], {});
  };

  /* ------------------------------------------------------------------ */
  /* Formula shifting (fallback when EFS.formulaReader is not loaded)    */
  /* ------------------------------------------------------------------ */

  /** Split formula text into segments: {str:true,text} for string literals, {str:false,text} otherwise. */
  function segments(text) {
    var out = [], i = 0, n = text.length, buf = '';
    while (i < n) {
      var ch = text[i];
      if (ch === '"') {
        if (buf) { out.push({ str: false, text: buf }); buf = ''; }
        var j = i + 1, lit = '"';
        while (j < n) {
          if (text[j] === '"') { if (text[j + 1] === '"') { lit += '""'; j += 2; continue; } lit += '"'; j++; break; }
          lit += text[j]; j++;
        }
        out.push({ str: true, text: lit }); i = j; continue;
      }
      if (ch === "'") {                                         // quoted sheet name
        var k = i + 1, q = "'";
        while (k < n) { q += text[k]; if (text[k] === "'" && text[k + 1] !== "'") { k++; break; } if (text[k] === "'") { q += "'"; k++; } k++; }
        buf += q; i = k; continue;
      }
      buf += ch; i++;
    }
    if (buf) out.push({ str: false, text: buf });
    return out;
  }
  workbook.formulaSegments = segments;

  var REF_RE = /(?<![A-Za-z0-9_.À-ɏЀ-ӿ])(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?![\w(À-ɏЀ-ӿ])/g;

  function shiftLocal(text, rowDelta, colDelta) {
    rowDelta = rowDelta || 0; colDelta = colDelta || 0;
    if (!rowDelta && !colDelta) return text;
    return segments(text).map(function (seg) {
      if (seg.str) return seg.text;
      return seg.text.replace(REF_RE, function (all, dc, col, dr, row) {
        var r = parseInt(row, 10), c = columnIndex(col);
        if (!dr) r = Math.max(1, r + rowDelta);
        if (!dc) c = Math.max(1, c + colDelta);
        if (c > 16384 || r > 1048576) return all;
        return dc + columnLetter(c) + dr + r;
      });
    }).join('');
  }

  /** Shift relative refs of an EN-dialect formula (uses EFS.formulaReader when available). */
  workbook.shiftFormula = function (text, rowDelta, colDelta) {
    var fr = EFS.formulaReader;
    if (fr && typeof fr.shiftFormula === 'function') {
      try { return fr.shiftFormula(text, rowDelta || 0, colDelta || 0, 'en'); } catch (e) { /* fallback below */ }
    }
    return shiftLocal(text, rowDelta, colDelta);
  };

  function stripEquals(f) {
    return String(f == null ? '' : f).replace(/^\s*=\s*/, '').trim();
  }
  workbook.stripEquals = stripEquals;

  /** Expand a per-row formula over a fill range → [{address,row,col,formula}]. */
  workbook.fillFormulas = function (formulaEN, fillRange, anchorRow, limit) {
    var f = stripEquals(formulaEN);
    var rc = rect(fillRange);
    if (!f || !rc) return [];
    var anchor = anchorRow != null ? parseInt(anchorRow, 10) : rc.top;
    if (!isFinite(anchor)) anchor = rc.top;
    var out = [];
    var max = limit ? Math.min(rc.bottom, rc.top + limit - 1) : rc.bottom;
    for (var r = rc.top; r <= max; r++) {
      var shifted = r === anchor ? f : workbook.shiftFormula(f, r - anchor, 0);
      out.push({ address: columnLetter(rc.left) + r, row: r, col: rc.left, formula: shifted });
    }
    return out;
  };

  /* ------------------------------------------------------------------ */
  /* applyFormula()                                                      */
  /* ------------------------------------------------------------------ */

  function resolveSheet(wb, sheetIndex) {
    if (!wb || !wb.sheets) throw efsError('badSheet');
    var idx = sheetIndex == null ? wb.activeIndex : sheetIndex;
    if (typeof idx === 'string' && !/^\d+$/.test(idx)) {
      for (var i = 0; i < wb.sheets.length; i++) if (wb.sheets[i].name === idx) { idx = i; break; }
    }
    idx = parseInt(idx, 10);
    var sheet = wb.sheets[idx];
    if (!sheet) throw efsError('badSheet');
    var ws = sheet._ws || (wb.exceljs && wb.exceljs.worksheets[idx]);
    if (!ws) throw efsError('badSheet');
    return { sheet: sheet, ws: ws, index: idx };
  }

  function copyStyle(from, to) {
    try {
      if (from && from.style && Object.keys(from.style).length) to.style = JSON.parse(JSON.stringify(from.style));
    } catch (e) { /* ignore */ }
  }

  /**
   * workbook.applyFormula(wb, sheetIndex, target, formulaEN, options) → { written:[addresses], count, header, sheet }
   * target: { cell:'F2' } | { fillRange:'F2:F200', anchorRow:2 } | 'F2' | 'F2:F200'
   * options: { header:'Durum' } writes the header text when the header cell is empty; { force:true } overwrites non-empty cells.
   */
  workbook.applyFormula = function (wb, sheetIndex, target, formulaEN, options) {
    options = options || {};
    var formula = stripEquals(formulaEN);
    if (!formula) throw efsError('emptyFormula');
    var res = resolveSheet(wb, sheetIndex);
    var sheet = res.sheet, ws = res.ws;
    if (typeof target === 'string') target = target.indexOf(':') > 0 ? { fillRange: target } : { cell: target };
    if (!target || typeof target !== 'object') throw efsError('badTarget');

    var writes = [];
    if (target.fillRange) {
      var rc = rect(target.fillRange);
      if (!rc) throw efsError('badTarget');
      var anchor = target.anchorRow != null ? target.anchorRow : rc.top;
      writes = workbook.fillFormulas(formula, target.fillRange, anchor);
      if (rc.right > rc.left) {
        // multi-column fill: shift columns too
        var extra = [];
        for (var c = rc.left + 1; c <= rc.right; c++) {
          for (var i = 0; i < writes.length; i++) {
            extra.push({ address: columnLetter(c) + writes[i].row, row: writes[i].row, col: c, formula: workbook.shiftFormula(writes[i].formula, 0, c - rc.left) });
          }
        }
        writes = writes.concat(extra);
      }
    } else if (target.cell) {
      var a = splitAddress(target.cell);
      if (!a) throw efsError('badTarget');
      writes = [{ address: a.col + a.row, row: a.row, col: columnIndex(a.col), formula: formula }];
    } else throw efsError('badTarget');

    var written = [], skipped = [];
    for (var w = 0; w < writes.length; w++) {
      var it = writes[w];
      var cell = ws.getCell(it.row, it.col);
      if (options.skipNonEmpty && cell.value !== null && cell.value !== undefined && cell.value !== '') { skipped.push(it.address); continue; }
      cell.value = { formula: it.formula };
      sheet._put(it.row, it.col, { v: null, t: 'z', f: it.formula, numFmt: cell.numFmt });
      written.push(it.address);
    }

    var headerAddr = null;
    if (options.header && writes.length) {
      var hr = sheet.headerRow;
      var hcol = writes[0].col;
      var hcell = ws.getCell(hr, hcol);
      if (hcell.value === null || hcell.value === undefined || hcell.value === '') {
        hcell.value = String(options.header);
        var neighbour = hcol > 1 ? ws.getCell(hr, hcol - 1) : null;
        copyStyle(neighbour, hcell);
        sheet._put(hr, hcol, { v: String(options.header), t: 's', f: null });
        headerAddr = columnLetter(hcol) + hr;
      }
    }
    sheet._finish();
    sheet._invalidate();
    if (wb.exceljs) wb.exceljs.calcProperties = { fullCalcOnLoad: true };
    return { written: written, count: written.length, skipped: skipped, header: headerAddr, sheet: res.index, formula: formula };
  };

  /* ------------------------------------------------------------------ */
  /* Export                                                              */
  /* ------------------------------------------------------------------ */

  /** Raw xlsx bytes (ArrayBuffer/Buffer) of the workbook, recalculation forced on open. */
  workbook.exportBuffer = function (wb) {
    return Promise.resolve().then(function () {
      if (!wb || !wb.exceljs) throw efsError('badSheet');
      wb.exceljs.calcProperties = { fullCalcOnLoad: true };
      return wb.exceljs.xlsx.writeBuffer();
    });
  };

  workbook.exportBlob = function (wb) {
    return workbook.exportBuffer(wb).then(function (buf) {
      var bytes = toUint8(buf) || buf;
      return new Blob([bytes], { type: MIME_XLSX });
    });
  };

  /** Suggested file name for the modified workbook (always .xlsx). */
  workbook.exportFileName = function (wb, suffix) {
    var base = baseName(wb && wb.name);
    return base + (suffix == null ? ' - Formula Studio' : suffix) + '.xlsx';
  };

  workbook.download = function (blob, fileName) {
    if (typeof document === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) throw efsError('noDocument');
    var name = String(fileName || 'workbook.xlsx');
    if (!/\.xlsx$/i.test(name)) name = name.replace(/\.[A-Za-z0-9]+$/, '') + '.xlsx';
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener'; a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
    return name;
  };

  /* ------------------------------------------------------------------ */
  /* Convenience                                                         */
  /* ------------------------------------------------------------------ */

  workbook.activeSheet = function (wb) { return wb && wb.sheets ? wb.sheets[wb.activeIndex] || null : null; };
  workbook.setActiveSheet = function (wb, index) { if (wb && wb.sheets[index]) wb.activeIndex = index; return workbook.activeSheet(wb); };
  workbook.setLang = function (wb, lang) { if (wb) wb.lang = lang; };
  workbook.contextOf = function (wb) { var s = workbook.activeSheet(wb); return s ? s.toContext() : null; };

  EFS.workbook = workbook;
  return workbook;
});
