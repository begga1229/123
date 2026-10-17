/* Formula Studio — AST (EFS.ast): node constructors, dialect-aware serializer and tree helpers.
 * See docs/ARCHITECTURE.md §4. Plain ES2019, UMD-lite wrapper, no dependencies at load time. */
(function (root, factory) {
  var EFS = root.EFS || (root.EFS = {});
  var api = factory(EFS, root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (EFS, root) {
  'use strict';
  var ast = {};

  /* ------------------------------------------------------------------ dialect tables */
  var DIALECTS = {
    en: { sep: ',', dec: '.', arrCol: ',',  arrRow: ';' },
    tr: { sep: ';', dec: ',', arrCol: '\\', arrRow: ';' },
    ru: { sep: ';', dec: ',', arrCol: ';',  arrRow: ':' }
  };
  ast.DIALECTS = DIALECTS;
  ast.dialectInfo = function (dialect) { return DIALECTS[dialect] || DIALECTS.en; };

  /* Default trilingual labels for placeholder slots (used when a node carries no label). */
  var SLOT_LABELS = {
    range:          { tr: 'aralık',               ru: 'диапазон',                  en: 'range' },
    criteria_range: { tr: 'koşul aralığı',        ru: 'диапазон условия',          en: 'criteria range' },
    criteria:       { tr: 'koşul',                ru: 'условие',                   en: 'criteria' },
    condition:      { tr: 'koşul',                ru: 'условие',                   en: 'condition' },
    sum_range:      { tr: 'toplanacak aralık',    ru: 'диапазон суммирования',     en: 'sum range' },
    value:          { tr: 'değer',                ru: 'значение',                  en: 'value' },
    value_if_true:  { tr: 'doğruysa değer',       ru: 'значение, если истина',     en: 'value if true' },
    value_if_false: { tr: 'yanlışsa değer',       ru: 'значение, если ложь',       en: 'value if false' },
    lookup_value:   { tr: 'aranan değer',         ru: 'искомое значение',          en: 'lookup value' },
    lookup_range:   { tr: 'arama aralığı',        ru: 'диапазон поиска',           en: 'lookup range' },
    return_range:   { tr: 'dönüş aralığı',        ru: 'диапазон возврата',         en: 'return range' },
    table:          { tr: 'tablo',                ru: 'таблица',                   en: 'table' },
    table_array:    { tr: 'tablo aralığı',        ru: 'таблица',                   en: 'table array' },
    col_index:      { tr: 'sütun numarası',       ru: 'номер столбца',             en: 'column number' },
    text:           { tr: 'metin',                ru: 'текст',                     en: 'text' },
    number:         { tr: 'sayı',                 ru: 'число',                     en: 'number' },
    count:          { tr: 'adet',                 ru: 'количество',                en: 'count' },
    n:              { tr: 'n',                    ru: 'n',                         en: 'n' },
    date:           { tr: 'tarih',                ru: 'дата',                      en: 'date' },
    start_date:     { tr: 'başlangıç tarihi',     ru: 'начальная дата',            en: 'start date' },
    end_date:       { tr: 'bitiş tarihi',         ru: 'конечная дата',             en: 'end date' },
    cell:           { tr: 'hücre',                ru: 'ячейка',                    en: 'cell' },
    column:         { tr: 'sütun',                ru: 'столбец',                   en: 'column' },
    row:            { tr: 'satır',                ru: 'строка',                    en: 'row' },
    sheet:          { tr: 'sayfa',                ru: 'лист',                      en: 'sheet' },
    delimiter:      { tr: 'ayırıcı',              ru: 'разделитель',               en: 'delimiter' },
    separator:      { tr: 'ayırıcı',              ru: 'разделитель',               en: 'separator' },
    rate:           { tr: 'faiz oranı',           ru: 'ставка',                    en: 'rate' },
    nper:           { tr: 'dönem sayısı',         ru: 'число периодов',            en: 'number of periods' },
    pv:             { tr: 'anapara',              ru: 'сумма кредита',             en: 'principal' },
    decimals:       { tr: 'basamak sayısı',       ru: 'число знаков',              en: 'decimals' },
    old_text:       { tr: 'eski metin',           ru: 'старый текст',              en: 'old text' },
    new_text:       { tr: 'yeni metin',           ru: 'новый текст',               en: 'new text' },
    start:          { tr: 'başlangıç',            ru: 'начало',                    en: 'start' },
    length:         { tr: 'uzunluk',              ru: 'длина',                     en: 'length' },
    array:          { tr: 'dizi',                 ru: 'массив',                    en: 'array' },
    format:         { tr: 'biçim',                ru: 'формат',                    en: 'format' },
    unit:           { tr: 'birim',                ru: 'единица',                   en: 'unit' },
    holidays:       { tr: 'tatiller',             ru: 'праздники',                 en: 'holidays' },
    divisor:        { tr: 'bölen',                ru: 'делитель',                  en: 'divisor' },
    percent:        { tr: 'yüzde',                ru: 'процент',                   en: 'percent' },
    not_found:      { tr: 'bulunamadı metni',     ru: 'текст, если не найдено',    en: 'not-found text' }
  };
  ast.SLOT_LABELS = SLOT_LABELS;

  /* ------------------------------------------------------------------ constructors */
  function isNode(x) { return !!x && typeof x === 'object' && typeof x.t === 'string'; }
  ast.isNode = isNode;

  /** Coerce primitives into nodes (numbers → num, strings → str, booleans → bool, null → empty). */
  function toNode(x) {
    if (isNode(x)) return x;
    if (x === null || x === undefined) return { t: 'empty' };
    if (typeof x === 'number') return { t: 'num', v: x };
    if (typeof x === 'boolean') return { t: 'bool', v: x };
    if (typeof x === 'string') return { t: 'str', v: x };
    return { t: 'str', v: String(x) };
  }
  ast.toNode = toNode;

  ast.func = function (name) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (args.length === 1 && Array.isArray(args[0])) args = args[0];
    return { t: 'func', name: String(name).toUpperCase(), args: args.map(toNode) };
  };

  var RE_REF_BODY = /^(@?)(\$?[A-Za-z]{1,3}\$?\d+(?::\$?[A-Za-z]{1,3}\$?\d+)?|\$?[A-Za-z]{1,3}:\$?[A-Za-z]{1,3}|\$?\d+:\$?\d+)(#?)$/;
  /** Reference node. ast.ref('A1:B2', 'Ürünler') or ast.ref("'Satış Raporu'!A1") (sheet split automatically). */
  ast.ref = function (text, sheet) {
    text = String(text == null ? '' : text).trim();
    if ((sheet === undefined || sheet === null) && text.indexOf('!') >= 0) {
      var split = ast.splitSheet(text);
      text = split.ref; sheet = split.sheet;
    }
    var m = RE_REF_BODY.exec(text);
    if (m) text = m[1] + m[2].toUpperCase() + m[3];
    var node = { t: 'ref', ref: text };
    if (sheet !== undefined && sheet !== null && sheet !== '') node.sheet = String(sheet);
    return node;
  };
  /** "'Satış Raporu'!A1" → { sheet:'Satış Raporu', ref:'A1' }; "A1" → { sheet:undefined, ref:'A1' }. */
  ast.splitSheet = function (text) {
    text = String(text == null ? '' : text);
    var m = /^'((?:[^']|'')*)'!(.*)$/.exec(text);
    if (m) return { sheet: m[1].replace(/''/g, "'"), ref: m[2] };
    var i = text.lastIndexOf('!');
    if (i > 0) return { sheet: text.slice(0, i), ref: text.slice(i + 1) };
    return { sheet: undefined, ref: text };
  };
  ast.num = function (v) { return { t: 'num', v: typeof v === 'number' ? v : Number(String(v).replace(',', '.')) }; };
  ast.str = function (v) { return { t: 'str', v: String(v == null ? '' : v) }; };
  ast.bool = function (v) {
    if (typeof v === 'string') { var f = v.trim().toUpperCase(); v = !(f === 'FALSE' || f === 'YANLIŞ' || f === 'ЛОЖЬ' || f === '0' || f === ''); }
    return { t: 'bool', v: !!v };
  };
  ast.err = function (v) { return { t: 'err', v: String(v || '#N/A').toUpperCase() }; };
  ast.op = function (op, left, right) { return { t: 'op', op: op, left: toNode(left), right: toNode(right) }; };
  ast.unary = function (op, arg) { return { t: 'unary', op: op === '+' ? '+' : '-', arg: toNode(arg) }; };
  ast.percent = function (arg) { return { t: 'percent', arg: toNode(arg) }; };
  ast.paren = function (arg) { return { t: 'paren', arg: toNode(arg) }; };
  ast.array = function (rows) {
    if (!Array.isArray(rows)) rows = [[rows]];
    if (rows.length && !Array.isArray(rows[0])) rows = [rows];
    return { t: 'array', rows: rows.map(function (r) { return r.map(toNode); }) };
  };
  ast.name = function (n) { return { t: 'name', name: String(n) }; };
  ast.placeholder = function (slot, label) {
    var node = { t: 'placeholder', slot: String(slot || 'value') };
    if (label) node.label = typeof label === 'string' ? { tr: label, ru: label, en: label } : label;
    else if (SLOT_LABELS[node.slot]) node.label = SLOT_LABELS[node.slot];
    else node.label = { tr: node.slot, ru: node.slot, en: node.slot };
    return node;
  };
  ast.empty = function () { return { t: 'empty' }; };
  /** Immediate call of a function-valued expression, e.g. LAMBDA(x,x*2)(A1) (extension: { t:'call', callee, args }). */
  ast.call = function (callee) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (args.length === 1 && Array.isArray(args[0])) args = args[0];
    return { t: 'call', callee: toNode(callee), args: args.map(toNode) };
  };

  /* ------------------------------------------------------------------ precedence */
  // Excel (high → low): reference ':' , intersection ' ' , unary -/+ , % , ^ , * / , + - , & , comparisons
  var PREC = { ATOM: 10, RANGE: 9, ISECT: 8, UNARY: 7, PERCENT: 6, POW: 5, MUL: 4, ADD: 3, CONCAT: 2, CMP: 1 };
  ast.PREC = PREC;
  function opPrec(op) {
    switch (op) {
      case ':': return PREC.RANGE;
      case ' ': return PREC.ISECT;
      case '^': return PREC.POW;
      case '*': case '/': return PREC.MUL;
      case '+': case '-': return PREC.ADD;
      case '&': return PREC.CONCAT;
      case '=': case '<>': case '<': case '>': case '<=': case '>=': return PREC.CMP;
      default: return PREC.CMP;
    }
  }
  ast.opPrecedence = opPrec;
  function nodePrec(node) {
    if (!node) return PREC.ATOM;
    switch (node.t) {
      case 'op': return opPrec(node.op);
      case 'unary': return PREC.UNARY;
      case 'percent': return PREC.PERCENT;
      case 'num': return (node.v < 0 || (node.v === 0 && 1 / node.v < 0)) ? PREC.UNARY : PREC.ATOM;
      default: return PREC.ATOM;
    }
  }
  ast.precedence = nodePrec;

  /* ------------------------------------------------------------------ serialization helpers */
  var RE_SHEET_PLAIN = /^[A-Za-z_À-ÖØ-öø-ɏЀ-ӿ][A-Za-z0-9_À-ÖØ-öø-ɏЀ-ӿ]*$/;
  var RE_LOOKS_LIKE_CELL = /^[A-Za-z]{1,3}\d+$/;
  var RE_LOOKS_LIKE_R1C1 = /^R\d*C\d*$/i;
  /** True when a sheet name may be written without quotes. */
  ast.sheetNeedsQuotes = function (name) {
    name = String(name == null ? '' : name);
    if (!name) return true;
    if (!RE_SHEET_PLAIN.test(name)) return true;
    if (RE_LOOKS_LIKE_CELL.test(name) || RE_LOOKS_LIKE_R1C1.test(name)) return true;
    var up = name.toUpperCase();
    if (up === 'TRUE' || up === 'FALSE' || up === 'DOĞRU' || up === 'YANLIŞ' || up === 'ИСТИНА' || up === 'ЛОЖЬ') return true;
    return false;
  };
  ast.quoteSheet = function (name) {
    name = String(name == null ? '' : name);
    return ast.sheetNeedsQuotes(name) ? "'" + name.replace(/'/g, "''") + "'" : name;
  };

  function formatNumber(v, dialect) {
    var info = ast.dialectInfo(dialect);
    if (typeof v !== 'number' || !isFinite(v)) {
      if (v === Infinity) return '1E+308';
      if (v === -Infinity) return '-1E+308';
      return '0';
    }
    if (v === 0) return '0';
    var s = String(v);
    if (s.indexOf('e') >= 0) s = s.replace('e+', 'E+').replace('e-', 'E-').replace('e', 'E');
    if (info.dec !== '.') s = s.replace('.', info.dec);
    return s;
  }
  ast.formatNumber = formatNumber;

  function quoteString(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }
  ast.quoteString = quoteString;

  function localName(nameEN, dialect) {
    if (dialect === 'en' || !dialect) return nameEN;
    var loc = EFS.localize;
    if (loc && typeof loc.toDialect === 'function') return loc.toDialect(nameEN, dialect) || nameEN;
    return nameEN;
  }
  function boolName(v, dialect) {
    var loc = EFS.localize;
    if (loc && typeof loc.boolName === 'function') return loc.boolName(v, dialect);
    if (dialect === 'tr') return v ? 'DOĞRU' : 'YANLIŞ';
    if (dialect === 'ru') return v ? 'ИСТИНА' : 'ЛОЖЬ';
    return v ? 'TRUE' : 'FALSE';
  }
  function errName(v, dialect) {
    var loc = EFS.localize;
    if (loc && typeof loc.errName === 'function') return loc.errName(v, dialect);
    return v;
  }
  function pickLabel(node, uiLang) {
    var label = node.label;
    if (!label && SLOT_LABELS[node.slot]) label = SLOT_LABELS[node.slot];
    if (!label) return node.slot || 'value';
    if (typeof label === 'string') return label;
    return label[uiLang] || label.en || label.tr || label.ru || node.slot || 'value';
  }

  /* ------------------------------------------------------------------ serialize */
  /**
   * ast.serialize(node, { dialect:'en'|'tr'|'ru', withEquals:true, uiLang:'tr' }) → string
   * Parentheses are added only where Excel precedence requires them; explicit paren nodes are kept.
   */
  ast.serialize = function (node, opts) {
    opts = opts || {};
    var dialect = DIALECTS[opts.dialect] ? opts.dialect : 'en';
    var uiLang = opts.uiLang || (dialect === 'en' ? 'en' : dialect);
    var withEquals = opts.withEquals !== false;
    var info = DIALECTS[dialect];
    var body = ser(node);
    return withEquals ? '=' + body : body;

    function ser(n) {
      if (!n) return '';
      switch (n.t) {
        case 'num': return formatNumber(n.v, dialect);
        case 'str': return quoteString(n.v);
        case 'bool': return boolName(!!n.v, dialect);
        case 'err': return errName(n.v, dialect);
        case 'ref': return (n.sheet !== undefined && n.sheet !== null && n.sheet !== '' ? ast.quoteSheet(n.sheet) + '!' : '') + n.ref;
        case 'name': return n.name;
        case 'empty': return '';
        case 'placeholder': return '«' + pickLabel(n, uiLang) + '»';
        case 'paren': return '(' + ser(n.arg) + ')';
        case 'func': {
          var args = n.args || [];
          var parts = [];
          for (var i = 0; i < args.length; i++) parts.push(ser(args[i]));
          return localName(n.name, dialect) + '(' + parts.join(info.sep) + ')';
        }
        case 'call': {
          var cargs = n.args || [], cparts = [];
          for (var ci = 0; ci < cargs.length; ci++) cparts.push(ser(cargs[ci]));
          var callee = ser(n.callee);
          if (nodePrec(n.callee) < PREC.ATOM) callee = '(' + callee + ')';
          return callee + '(' + cparts.join(info.sep) + ')';
        }
        case 'array': {
          var rows = n.rows || [];
          var rs = [];
          for (var r = 0; r < rows.length; r++) {
            var cs = [];
            for (var c = 0; c < rows[r].length; c++) cs.push(ser(rows[r][c]));
            rs.push(cs.join(info.arrCol));
          }
          return '{' + rs.join(info.arrRow) + '}';
        }
        case 'unary': {
          var a = ser(n.arg);
          if (nodePrec(n.arg) < PREC.UNARY) a = '(' + a + ')';
          return n.op + a;
        }
        case 'percent': {
          var p = ser(n.arg);
          if (nodePrec(n.arg) < PREC.PERCENT) p = '(' + p + ')';
          return p + '%';
        }
        case 'op': {
          var prec = opPrec(n.op);
          var l = ser(n.left), rgt = ser(n.right);
          if (nodePrec(n.left) < prec) l = '(' + l + ')';
          // every Excel binary operator is left-associative (including ^), so equal precedence on the right needs parentheses
          if (nodePrec(n.right) <= prec) rgt = '(' + rgt + ')';
          return l + n.op + rgt;
        }
        default: return '';
      }
    }
  };

  /* ------------------------------------------------------------------ tree helpers */
  /** Child nodes of a node as [{ node, key, index }]. */
  ast.children = function (node) {
    var out = [];
    if (!node) return out;
    switch (node.t) {
      case 'func': (node.args || []).forEach(function (a, i) { out.push({ node: a, key: 'args', index: i }); }); break;
      case 'call': out.push({ node: node.callee, key: 'callee' }); (node.args || []).forEach(function (a, i) { out.push({ node: a, key: 'args', index: i }); }); break;
      case 'op': out.push({ node: node.left, key: 'left' }); out.push({ node: node.right, key: 'right' }); break;
      case 'unary': case 'percent': case 'paren': out.push({ node: node.arg, key: 'arg' }); break;
      case 'array': (node.rows || []).forEach(function (row, r) { row.forEach(function (c, i) { out.push({ node: c, key: 'rows', row: r, index: i }); }); }); break;
      default: break;
    }
    return out;
  };

  /** Pre-order traversal: fn(node, parent, key). Returning false from fn skips the node's children. */
  ast.walk = function (node, fn, parent, key) {
    if (!node) return;
    var r = fn(node, parent || null, key === undefined ? null : key);
    if (r === false) return;
    var kids = ast.children(node);
    for (var i = 0; i < kids.length; i++) ast.walk(kids[i].node, fn, node, kids[i].key);
  };

  ast.clone = function (node) {
    if (node === null || node === undefined) return node;
    if (Array.isArray(node)) return node.map(ast.clone);
    if (typeof node !== 'object') return node;
    var out = {};
    for (var k in node) if (Object.prototype.hasOwnProperty.call(node, k)) out[k] = ast.clone(node[k]);
    return out;
  };

  /** Bottom-up transform: fn(node) may return a replacement node (or undefined to keep it). Returns a new tree. */
  ast.transform = function (node, fn) {
    if (!node) return node;
    var n = ast.clone(node);
    return rec(n);
    function rec(x) {
      if (!x || typeof x !== 'object') return x;
      switch (x.t) {
        case 'func': x.args = (x.args || []).map(rec); break;
        case 'call': x.callee = rec(x.callee); x.args = (x.args || []).map(rec); break;
        case 'op': x.left = rec(x.left); x.right = rec(x.right); break;
        case 'unary': case 'percent': case 'paren': x.arg = rec(x.arg); break;
        case 'array': x.rows = (x.rows || []).map(function (row) { return row.map(rec); }); break;
        default: break;
      }
      var rep = fn(x);
      return rep === undefined ? x : rep;
    }
  };

  ast.functionsUsed = function (node) {
    var seen = {}, out = [];
    ast.walk(node, function (n) { if (n.t === 'func' && !seen[n.name]) { seen[n.name] = true; out.push(n.name); } });
    return out;
  };

  ast.refsUsed = function (node) {
    var seen = {}, out = [];
    ast.walk(node, function (n) {
      if (n.t !== 'ref') return;
      var key = (n.sheet || '') + '!' + n.ref;
      if (seen[key]) return;
      seen[key] = true;
      out.push({ ref: n.ref, sheet: n.sheet === undefined ? null : n.sheet });
    });
    return out;
  };

  ast.hasPlaceholders = function (node) {
    var found = false;
    ast.walk(node, function (n) { if (n.t === 'placeholder') { found = true; return false; } });
    return found;
  };

  ast.placeholders = function (node) {
    var out = [];
    ast.walk(node, function (n) { if (n.t === 'placeholder') out.push(n); });
    return out;
  };

  /** Structural equality (ignores non-semantic fields such as labels). */
  ast.equal = function (a, b) {
    if (a === b) return true;
    if (!a || !b || a.t !== b.t) return false;
    switch (a.t) {
      case 'num': return a.v === b.v || (a.v !== a.v && b.v !== b.v);
      case 'str': case 'bool': case 'err': return a.v === b.v;
      case 'ref': return a.ref === b.ref && (a.sheet || '') === (b.sheet || '');
      case 'name': return a.name === b.name;
      case 'empty': return true;
      case 'placeholder': return a.slot === b.slot;
      case 'func':
        if (a.name !== b.name || (a.args || []).length !== (b.args || []).length) return false;
        for (var i = 0; i < a.args.length; i++) if (!ast.equal(a.args[i], b.args[i])) return false;
        return true;
      case 'call':
        if (!ast.equal(a.callee, b.callee) || (a.args || []).length !== (b.args || []).length) return false;
        for (var ci = 0; ci < a.args.length; ci++) if (!ast.equal(a.args[ci], b.args[ci])) return false;
        return true;
      case 'op': return a.op === b.op && ast.equal(a.left, b.left) && ast.equal(a.right, b.right);
      case 'unary': return a.op === b.op && ast.equal(a.arg, b.arg);
      case 'percent': case 'paren': return ast.equal(a.arg, b.arg);
      case 'array':
        if (a.rows.length !== b.rows.length) return false;
        for (var r = 0; r < a.rows.length; r++) {
          if (a.rows[r].length !== b.rows[r].length) return false;
          for (var c = 0; c < a.rows[r].length; c++) if (!ast.equal(a.rows[r][c], b.rows[r][c])) return false;
        }
        return true;
      default: return false;
    }
  };

  /** Convenience: EN-dialect text without '=' (handy for tests and explain steps). */
  ast.toEN = function (node) { return ast.serialize(node, { dialect: 'en', withEquals: false }); };

  EFS.ast = ast;
  return ast;
});
