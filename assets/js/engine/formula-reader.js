/* Formula Studio — formula reader (EFS.formulaReader): tokenizer + precedence-climbing parser for Excel
 * formulas in the EN, TR or RU dialect, dialect detection, reference shifting. See docs/ARCHITECTURE.md §6. */
(function (root, factory) {
  var EFS = root.EFS || (root.EFS = {});
  var api = factory(EFS, root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (EFS, root) {
  'use strict';
  var formulaReader = {};

  var MAX_COL = 16384, MAX_ROW = 1048576;

  /* ------------------------------------------------------------------ character classes */
  var ID_START = 'A-Za-z_\\\\À-ÖØ-öø-ɏͰ-ϿЀ-ӿ';
  var ID_CONT = ID_START + '0-9.';
  var RE_IDENT = new RegExp('^[' + ID_START + '][' + ID_CONT + ']*');
  var RE_ID_CONT_CHAR = new RegExp('^[' + ID_CONT + ']');
  var RE_SHEET_UNQUOTED = new RegExp('^((?:\\[[^\\]]*\\])?[' + ID_START + '][' + ID_CONT + ']*(?::[' + ID_START + '][' + ID_CONT + ']*)?)!');
  var RE_SHEET_QUOTED = /^'((?:[^']|'')+)'!/;
  var RE_REF = /^(?:\$?[A-Za-z]{1,3}\$?\d+(?::\$?[A-Za-z]{1,3}\$?\d+)?|\$?[A-Za-z]{1,3}:\$?[A-Za-z]{1,3}|\$?\d+:\$?\d+)/;
  var RE_NUM = {
    en: /^(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?/,
    tr: /^(?:\d+(?:[,.]\d+)?|[,.]\d+)(?:[Ee][+-]?\d+)?/,
    ru: /^(?:\d+(?:[,.]\d+)?|[,.]\d+)(?:[Ee][+-]?\d+)?/
  };

  /* ------------------------------------------------------------------ errors */
  var MESSAGES = {
    unexpected_char:     { tr: 'Beklenmeyen karakter: “{0}”',                     ru: 'Неожиданный символ: «{0}»',                          en: 'Unexpected character: "{0}"' },
    unterminated_string: { tr: 'Kapatılmamış metin (çift tırnak eksik)',          ru: 'Незакрытая строка (не хватает кавычки)',             en: 'Unterminated string (missing closing quote)' },
    unterminated_quote:  { tr: 'Sayfa adı için kapatma tırnağı eksik',            ru: 'Не закрыта кавычка в имени листа',                   en: 'Unterminated sheet name quote' },
    unterminated_bracket:{ tr: 'Köşeli parantez kapatılmamış',                    ru: 'Не закрыта квадратная скобка',                       en: 'Unclosed square bracket' },
    unexpected_end:      { tr: 'Formül beklenmedik şekilde bitti',                ru: 'Формула неожиданно закончилась',                     en: 'Unexpected end of formula' },
    unexpected_token:    { tr: 'Beklenmeyen ifade: “{0}”',                        ru: 'Неожиданный элемент: «{0}»',                         en: 'Unexpected token: "{0}"' },
    expected_rparen:     { tr: 'Kapatma parantezi “)” bekleniyordu',              ru: 'Ожидалась закрывающая скобка «)»',                   en: 'Expected closing parenthesis ")"' },
    expected_rbrace:     { tr: 'Dizi sabiti için “}” bekleniyordu',               ru: 'Ожидалась «}» для константы массива',                en: 'Expected "}" to close the array constant' },
    expected_lparen:     { tr: 'İşlev adından sonra “(” bekleniyordu',            ru: 'После имени функции ожидалась «(»',                  en: 'Expected "(" after function name' },
    empty_formula:       { tr: 'Formül boş',                                      ru: 'Формула пуста',                                      en: 'Formula is empty' },
    bad_array:           { tr: 'Dizi satırlarının uzunlukları eşit olmalı',       ru: 'Строки массива должны быть одинаковой длины',        en: 'Array rows must have the same length' },
    empty_array:         { tr: 'Dizi sabiti boş olamaz',                          ru: 'Константа массива не может быть пустой',             en: 'Array constant cannot be empty' },
    unknown_error:       { tr: 'Bilinmeyen hata değeri: “{0}”',                   ru: 'Неизвестное значение ошибки: «{0}»',                 en: 'Unknown error value: "{0}"' },
    bad_reference:       { tr: 'Geçersiz başvuru: “{0}”',                         ru: 'Недопустимая ссылка: «{0}»',                         en: 'Invalid reference: "{0}"' },
    trailing_input:      { tr: 'Formül sonunda fazladan ifade: “{0}”',            ru: 'Лишний элемент в конце формулы: «{0}»',              en: 'Unexpected trailing input: "{0}"' },
    missing_operand:     { tr: 'İşleç için değer eksik: “{0}”',                   ru: 'Не хватает операнда для оператора «{0}»',            en: 'Missing operand for operator "{0}"' }
  };
  formulaReader.MESSAGES = MESSAGES;

  function syntaxError(code, position, detail) {
    var tpl = MESSAGES[code] || MESSAGES.unexpected_token;
    var d = detail == null ? '' : String(detail);
    var msg = { tr: tpl.tr.replace('{0}', d), ru: tpl.ru.replace('{0}', d), en: tpl.en.replace('{0}', d) };
    var err = {
      name: 'FormulaSyntaxError',
      code: code,
      position: position,
      detail: d,
      message: msg,
      toString: function () { return 'FormulaSyntaxError: ' + msg.en + ' (position ' + position + ')'; }
    };
    return err;
  }
  formulaReader.isSyntaxError = function (e) { return !!e && e.name === 'FormulaSyntaxError'; };
  /** Text of a syntax error in one language (also accepts ordinary Error objects). */
  formulaReader.errorText = function (e, lang) {
    if (!e) return '';
    if (e.message && typeof e.message === 'object') return e.message[lang] || e.message.en || '';
    return String(e.message || e);
  };

  /* ------------------------------------------------------------------ helpers */
  function loc() { return EFS.localize || null; }
  function A() { return EFS.ast; }
  function fold(s) {
    var L = loc();
    if (L && L.fold) return L.fold(s);
    return String(s == null ? '' : s).toLowerCase();
  }
  function colIndex(letters) {
    var n = 0; letters = letters.toUpperCase();
    for (var i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
    return n;
  }
  function colLetter(n) {
    var s = '';
    while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
    return s;
  }
  formulaReader.columnIndex = colIndex;
  formulaReader.columnLetter = colLetter;

  /** Validate that the text matched by RE_REF is inside Excel's grid limits. */
  function refIsValid(text) {
    var parts = text.replace(/\$/g, '').split(':');
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i], m;
      if ((m = /^([A-Za-z]{1,3})(\d+)$/.exec(p))) { if (colIndex(m[1]) > MAX_COL || +m[2] < 1 || +m[2] > MAX_ROW) return false; }
      else if ((m = /^([A-Za-z]{1,3})$/.exec(p))) { if (colIndex(m[1]) > MAX_COL) return false; }
      else if ((m = /^(\d+)$/.exec(p))) { if (+m[1] < 1 || +m[1] > MAX_ROW) return false; }
      else return false;
    }
    return true;
  }
  function normalizeRefText(text) {
    return text.replace(/[a-z]/g, function (c) { return c.toUpperCase(); });
  }

  var BOOL_FOLDS = { 'true': true, 'false': false, 'dogru': true, 'yanlis': false, 'истина': true, 'ложь': false };
  function boolValue(ident) {
    var f = fold(ident);
    return Object.prototype.hasOwnProperty.call(BOOL_FOLDS, f) ? BOOL_FOLDS[f] : null;
  }

  var FALLBACK_ERRORS = ['#GETTING_DATA', '#VERİ_ALINIYOR', '#ПОЛУЧЕНИЕ_ДАННЫХ', '#DIV/0!', '#SAYI/0!', '#ДЕЛ/0!', '#VALUE!', '#DEĞER!', '#ЗНАЧ!',
    '#REF!', '#BAŞV!', '#ССЫЛКА!', '#NAME?', '#AD?', '#ИМЯ?', '#NUM!', '#SAYI!', '#ЧИСЛО!', '#NULL!', '#BOŞ!', '#ПУСТО!',
    '#SPILL!', '#TAŞMA!', '#ПЕРЕНОС!', '#CALC!', '#HESAP!', '#ВЫЧИСЛ!', '#N/A', '#YOK', '#Н/Д'];
  var _errLits = null;
  function errorLiterals() {
    if (_errLits) return _errLits;
    var L = loc();
    var list = (L && L.allErrorLiterals) ? L.allErrorLiterals() : FALLBACK_ERRORS.slice();
    list.sort(function (a, b) { return b.length - a.length; });
    _errLits = list.map(function (s) { return { text: s, fold: fold(s) }; });
    return _errLits;
  }
  function errorToEN(text) {
    var L = loc();
    if (L && L.errToEN) return L.errToEN(text) || text.toUpperCase();
    return text.toUpperCase();
  }

  function canonicalFunctionName(raw) {
    var name = raw.replace(/^_xl(?:fn|ws|pm|udf)\./i, '');
    var L = loc();
    if (L && L.toEN) { var en = L.toEN(name); if (en) return en; }
    var cat = EFS.catalog;
    if (cat && cat.byName) { var e = cat.byName(name); if (e) return e.name; }
    if (L && L.upper) return L.upper(name);
    return name.toUpperCase();
  }

  /* ------------------------------------------------------------------ tokenizer */
  /**
   * formulaReader.tokenize(text, dialect) → tokens.
   * Token: { type, value, start, end, [raw], [sheet], [num], [en] }.
   * types: func ref num str bool err op lparen rparen sep lbrace rbrace rowsep colsep name percent ws placeholder
   */
  formulaReader.tokenize = function (text, dialect) {
    text = String(text == null ? '' : text);
    if (dialect !== 'tr' && dialect !== 'ru') dialect = 'en';
    var numRe = RE_NUM[dialect];
    var arr = dialect === 'tr' ? { col: '\\', row: ';' } : dialect === 'ru' ? { col: ';', row: ':' } : { col: ',', row: ';' };
    var tokens = [];
    var i = 0, n = text.length;
    var inBraces = 0;

    // optional leading '=' (after leading whitespace)
    while (i < n && /\s/.test(text[i])) i++;
    if (text[i] === '=') i++;

    while (i < n) {
      var ch = text[i];
      var rest = text.slice(i);
      var m;

      // whitespace
      if (/\s/.test(ch)) {
        var ws = i;
        while (i < n && /\s/.test(text[i])) i++;
        tokens.push({ type: 'ws', value: text.slice(ws, i), start: ws, end: i });
        continue;
      }

      // string literal
      if (ch === '"') {
        var j = i + 1, buf = '';
        var closed = false;
        while (j < n) {
          if (text[j] === '"') {
            if (text[j + 1] === '"') { buf += '"'; j += 2; continue; }
            closed = true; j++; break;
          }
          buf += text[j]; j++;
        }
        if (!closed) throw syntaxError('unterminated_string', i);
        tokens.push({ type: 'str', value: buf, start: i, end: j, raw: text.slice(i, j) });
        i = j;
        continue;
      }

      // placeholder «label»
      if (ch === '«') {
        var close = text.indexOf('»', i + 1);
        if (close < 0) throw syntaxError('unexpected_char', i, ch);
        tokens.push({ type: 'placeholder', value: text.slice(i + 1, close).trim(), start: i, end: close + 1 });
        i = close + 1;
        continue;
      }

      // array constants: separators inside braces
      if (inBraces) {
        if (ch === arr.col) { tokens.push({ type: 'colsep', value: ch, start: i, end: i + 1 }); i++; continue; }
        if (ch === arr.row) { tokens.push({ type: 'rowsep', value: ch, start: i, end: i + 1 }); i++; continue; }
        if (ch === '}') { inBraces--; tokens.push({ type: 'rbrace', value: ch, start: i, end: i + 1 }); i++; continue; }
      }

      // error literal
      if (ch === '#') {
        var lits = errorLiterals(), hit = null;
        for (var k = 0; k < lits.length; k++) {
          var cand = text.substr(i, lits[k].text.length);
          if (fold(cand) === lits[k].fold) { hit = cand; break; }
        }
        if (!hit) {
          var bad = /^#[^\s(),;!?]*[!?]?/.exec(rest);
          throw syntaxError('unknown_error', i, bad ? bad[0] : '#');
        }
        tokens.push({ type: 'err', value: errorToEN(hit), raw: hit, start: i, end: i + hit.length });
        i += hit.length;
        continue;
      }

      // structured reference starting with '[' (e.g. [@Amount], [@[Unit Price]])
      if (ch === '[') {
        var endB = scanBrackets(text, i);
        tokens.push({ type: 'name', value: text.slice(i, endB), start: i, end: endB });
        i = endB;
        continue;
      }

      // '@' implicit intersection
      if (ch === '@') {
        var afterAt = text.slice(i + 1);
        var mr = !inBraces && RE_REF.exec(afterAt);
        if (mr && refIsValid(mr[0]) && !RE_ID_CONT_CHAR.test(afterAt.slice(mr[0].length)) && afterAt[mr[0].length] !== '(') {
          var refText = '@' + normalizeRefText(mr[0]);
          var endR = i + 1 + mr[0].length;
          if (text[endR] === '#') { refText += '#'; endR++; }
          tokens.push({ type: 'ref', value: refText, start: i, end: endR });
          i = endR;
          continue;
        }
        if (afterAt[0] === '[') {
          var endB2 = scanBrackets(text, i + 1);
          tokens.push({ type: 'name', value: text.slice(i, endB2), start: i, end: endB2 });
          i = endB2;
          continue;
        }
        var mi = RE_IDENT.exec(afterAt);
        if (mi) {
          tokens.push({ type: 'name', value: '@' + mi[0], start: i, end: i + 1 + mi[0].length });
          i += 1 + mi[0].length;
          continue;
        }
        throw syntaxError('unexpected_char', i, ch);
      }

      // sheet-qualified reference or name: 'Sheet name'!A1 / Sheet1!A:A / Sheet1!Name
      if (!inBraces && (ch === "'" || (m = RE_SHEET_UNQUOTED.exec(rest)))) {
        var sheetName, prefixLen;
        if (ch === "'") {
          var mq = RE_SHEET_QUOTED.exec(rest);
          if (!mq) throw syntaxError('unterminated_quote', i);
          sheetName = mq[1].replace(/''/g, "'");
          prefixLen = mq[0].length;
        } else {
          sheetName = m[1];
          prefixLen = m[0].length;
        }
        var afterSheet = text.slice(i + prefixLen);
        var atPrefix = '';
        if (afterSheet[0] === '@') { atPrefix = '@'; afterSheet = afterSheet.slice(1); }
        var mr2 = RE_REF.exec(afterSheet);
        if (mr2 && refIsValid(mr2[0]) && !RE_ID_CONT_CHAR.test(afterSheet.slice(mr2[0].length)) && afterSheet[mr2[0].length] !== '(') {
          var rt = atPrefix + normalizeRefText(mr2[0]);
          var endS = i + prefixLen + atPrefix.length + mr2[0].length;
          if (text[endS] === '#') { rt += '#'; endS++; }
          tokens.push({ type: 'ref', value: rt, sheet: sheetName, start: i, end: endS });
          i = endS;
          continue;
        }
        var mn = RE_IDENT.exec(afterSheet);
        if (mn) {
          var endN = i + prefixLen + atPrefix.length + mn[0].length;
          tokens.push({ type: 'name', value: text.slice(i, endN), start: i, end: endN });
          i = endN;
          continue;
        }
        throw syntaxError('bad_reference', i, text.slice(i, i + prefixLen + 1));
      }

      // plain cell / range / column / row reference
      if (!inBraces && (m = RE_REF.exec(rest)) && refIsValid(m[0]) && !RE_ID_CONT_CHAR.test(rest.slice(m[0].length)) && rest[m[0].length] !== '(') {
        var rtxt = normalizeRefText(m[0]);
        var endRef = i + m[0].length;
        if (text[endRef] === '#') { rtxt += '#'; endRef++; }
        tokens.push({ type: 'ref', value: rtxt, start: i, end: endRef });
        i = endRef;
        continue;
      }

      // number
      if ((m = numRe.exec(rest)) && !(dialect === 'en' && m[0] === '.')) {
        var numText = m[0];
        var val = parseFloat(numText.replace(',', '.'));
        tokens.push({ type: 'num', value: numText, num: val, start: i, end: i + numText.length });
        i += numText.length;
        continue;
      }

      // identifier: function / boolean / name / structured reference
      if ((m = RE_IDENT.exec(rest))) {
        var ident = m[0];
        var after = rest.slice(ident.length);
        var wsLen = 0;
        while (wsLen < after.length && /\s/.test(after[wsLen])) wsLen++;
        if (after[wsLen] === '(') {
          tokens.push({ type: 'func', value: canonicalFunctionName(ident), raw: ident, start: i, end: i + ident.length });
          i += ident.length;
          continue;
        }
        if (after[0] === '[') {
          var endSR = scanBrackets(text, i + ident.length);
          tokens.push({ type: 'name', value: text.slice(i, endSR), start: i, end: endSR });
          i = endSR;
          continue;
        }
        var bv = boolValue(ident);
        if (bv !== null) {
          tokens.push({ type: 'bool', value: bv, raw: ident, start: i, end: i + ident.length });
          i += ident.length;
          continue;
        }
        tokens.push({ type: 'name', value: ident, start: i, end: i + ident.length });
        i += ident.length;
        continue;
      }

      // operators and punctuation
      var two = text.substr(i, 2);
      if (two === '<>' || two === '<=' || two === '>=') { tokens.push({ type: 'op', value: two, start: i, end: i + 2 }); i += 2; continue; }
      switch (ch) {
        case '+': case '-': case '*': case '/': case '^': case '&': case '=': case '<': case '>':
          tokens.push({ type: 'op', value: ch, start: i, end: i + 1 }); i++; continue;
        case '%': tokens.push({ type: 'percent', value: ch, start: i, end: i + 1 }); i++; continue;
        case '(': tokens.push({ type: 'lparen', value: ch, start: i, end: i + 1 }); i++; continue;
        case ')': tokens.push({ type: 'rparen', value: ch, start: i, end: i + 1 }); i++; continue;
        case '{': inBraces++; tokens.push({ type: 'lbrace', value: ch, start: i, end: i + 1 }); i++; continue;
        case '}': tokens.push({ type: 'rbrace', value: ch, start: i, end: i + 1 }); i++; continue;
        case ',': case ';':
          // lenient: both characters act as argument separators outside array constants
          tokens.push({ type: 'sep', value: ch, start: i, end: i + 1 }); i++; continue;
        case ':': tokens.push({ type: 'op', value: ':', start: i, end: i + 1 }); i++; continue;
        default: break;
      }
      throw syntaxError('unexpected_char', i, ch);
    }
    return tokens;

    function scanBrackets(s, from) {
      var depth = 0, p = from;
      while (p < s.length) {
        var c = s[p];
        if (c === "'") { p += 2; continue; }   // escape char inside structured references
        if (c === '[') depth++;
        else if (c === ']') { depth--; if (depth === 0) return p + 1; }
        p++;
      }
      throw syntaxError('unterminated_bracket', from);
    }
  };

  /* ------------------------------------------------------------------ parser */
  function Parser(tokens, text) {
    this.text = text;
    this.toks = [];
    var space = false;
    for (var i = 0; i < tokens.length; i++) {
      if (tokens[i].type === 'ws') { space = true; continue; }
      tokens[i].spaceBefore = space;
      this.toks.push(tokens[i]);
      space = false;
    }
    this.pos = 0;
  }
  Parser.prototype.peek = function () { return this.toks[this.pos] || null; };
  Parser.prototype.next = function () { return this.toks[this.pos++] || null; };
  Parser.prototype.is = function (type, value) {
    var t = this.peek();
    return !!t && t.type === type && (value === undefined || t.value === value);
  };
  Parser.prototype.fail = function (code, tok, detail) {
    var position = tok ? tok.start : this.text.length;
    if (!tok) throw syntaxError('unexpected_end', position);
    throw syntaxError(code, position, detail === undefined ? tokenText(tok) : detail);
  };
  function tokenText(tok) {
    if (!tok) return '';
    if (tok.type === 'str') return '"' + tok.value + '"';
    if (tok.type === 'bool') return tok.raw || String(tok.value);
    if (tok.type === 'func') return tok.raw || tok.value;
    return String(tok.value);
  }

  Parser.prototype.parseFormula = function () {
    if (!this.toks.length) throw syntaxError('empty_formula', 0);
    var node = this.parseExpression();
    var t = this.peek();
    if (t) this.fail('trailing_input', t);
    return node;
  };
  Parser.prototype.parseExpression = function () { return this.parseComparison(); };

  Parser.prototype.parseComparison = function () {
    var left = this.parseConcat();
    while (this.is('op') && /^(=|<>|<=|>=|<|>)$/.test(this.peek().value)) {
      var op = this.next().value;
      var right = this.parseConcat();
      left = A().op(op, left, right);
    }
    return left;
  };
  Parser.prototype.parseConcat = function () {
    var left = this.parseAdditive();
    while (this.is('op', '&')) { this.next(); left = A().op('&', left, this.parseAdditive()); }
    return left;
  };
  Parser.prototype.parseAdditive = function () {
    var left = this.parseMultiplicative();
    while (this.is('op', '+') || this.is('op', '-')) { var op = this.next().value; left = A().op(op, left, this.parseMultiplicative()); }
    return left;
  };
  Parser.prototype.parseMultiplicative = function () {
    var left = this.parsePower();
    while (this.is('op', '*') || this.is('op', '/')) { var op = this.next().value; left = A().op(op, left, this.parsePower()); }
    return left;
  };
  Parser.prototype.parsePower = function () {
    var left = this.parsePercent();
    while (this.is('op', '^')) { this.next(); left = A().op('^', left, this.parsePercent()); }   // left-associative in Excel
    return left;
  };
  Parser.prototype.parsePercent = function () {
    var node = this.parseUnary();
    while (this.is('percent')) { this.next(); node = A().percent(node); }
    return node;
  };
  Parser.prototype.parseUnary = function () {
    if (this.is('op', '-') || this.is('op', '+')) {
      var tok = this.next();
      if (!this.peek()) throw syntaxError('missing_operand', tok.start, tok.value);
      return A().unary(tok.value, this.parseUnary());
    }
    return this.parseRangeOps();
  };
  /** Reference operators: ':' between reference-returning operands and ' ' (intersection) between references. */
  Parser.prototype.parseRangeOps = function () {
    var left = this.parsePrimary();
    for (;;) {
      if (this.is('op', ':')) {
        this.next();
        left = A().op(':', left, this.parsePrimary());
        continue;
      }
      var t = this.peek();
      if (t && t.type === 'lparen' && !t.spaceBefore && (left.t === 'func' || left.t === 'call')) {
        // immediate call of a function-valued expression: LAMBDA(x,x*2)(A1)
        left = A().call(left, this.parseArgs());
        continue;
      }
      if (t && t.spaceBefore && (t.type === 'ref' || t.type === 'lparen' || t.type === 'func' || t.type === 'name') && isRefLike(left)) {
        left = A().op(' ', left, this.parsePrimary());
        continue;
      }
      break;
    }
    return left;
  };
  function isRefLike(node) {
    return !!node && (node.t === 'ref' || node.t === 'name' || (node.t === 'op' && (node.op === ':' || node.op === ' ')) ||
      (node.t === 'paren' && isRefLike(node.arg)) || (node.t === 'func' && /^(INDEX|OFFSET|INDIRECT|CHOOSE|IF)$/.test(node.name)));
  }

  Parser.prototype.parsePrimary = function () {
    var t = this.next();
    var ast = A();
    if (!t) throw syntaxError('unexpected_end', this.text.length);
    switch (t.type) {
      case 'num': return ast.num(t.num);
      case 'str': return ast.str(t.value);
      case 'bool': return ast.bool(t.value);
      case 'err': return ast.err(t.value);
      case 'ref': return ast.ref(t.value, t.sheet);
      case 'name': return ast.name(t.value);
      case 'placeholder': return ast.placeholder(t.value, { tr: t.value, ru: t.value, en: t.value });
      case 'func': return this.parseCall(t);
      case 'lparen': {
        var inner = this.parseExpression();
        if (!this.is('rparen')) this.fail('expected_rparen', this.peek());
        this.next();
        return ast.paren(inner);
      }
      case 'lbrace': return this.parseArray(t);
      case 'op':
        if (t.value === '-' || t.value === '+') { this.pos--; return this.parseUnary(); }
        this.fail('unexpected_token', t);
        break;
      default:
        this.fail('unexpected_token', t);
    }
    return null;
  };

  Parser.prototype.parseCall = function (funcTok) {
    if (!this.is('lparen')) this.fail('expected_lparen', this.peek());
    return A().func(funcTok.value, this.parseArgs());
  };
  /** '(' args ')' → [node...]; empty slots become {t:'empty'}. */
  Parser.prototype.parseArgs = function () {
    var ast = A();
    this.next();   // '('
    var args = [];
    if (this.is('rparen')) { this.next(); return args; }
    for (;;) {
      if (this.is('sep')) { args.push(ast.empty()); this.next(); continue; }
      if (this.is('rparen')) { args.push(ast.empty()); this.next(); break; }   // trailing empty argument after a separator
      if (!this.peek()) throw syntaxError('unexpected_end', this.text.length);
      args.push(this.parseExpression());
      if (this.is('sep')) {
        this.next();
        if (this.is('rparen')) { args.push(ast.empty()); this.next(); break; }
        continue;
      }
      if (this.is('rparen')) { this.next(); break; }
      this.fail('expected_rparen', this.peek());
    }
    return args;
  };

  Parser.prototype.parseArray = function (openTok) {
    var ast = A();
    var rows = [[]];
    if (this.is('rbrace')) this.fail('empty_array', this.peek());
    for (;;) {
      if (!this.peek()) throw syntaxError('unexpected_end', this.text.length);
      rows[rows.length - 1].push(this.parseExpression());
      if (this.is('colsep')) { this.next(); continue; }
      if (this.is('rowsep')) { this.next(); rows.push([]); continue; }
      if (this.is('rbrace')) { this.next(); break; }
      this.fail('expected_rbrace', this.peek());
    }
    for (var r = 1; r < rows.length; r++) if (rows[r].length !== rows[0].length) throw syntaxError('bad_array', openTok.start);
    return ast.array(rows);
  };

  /** formulaReader.parse(text, dialect|'auto') → AST. Throws { name:'FormulaSyntaxError', message:{tr,ru,en}, position }. */
  formulaReader.parse = function (text, dialect) {
    text = String(text == null ? '' : text);
    if (!dialect || dialect === 'auto') dialect = formulaReader.detectDialect(text);
    if (!A()) throw new Error('EFS.ast is not loaded');
    if (!text.replace(/^\s*=?\s*/, '').length) throw syntaxError('empty_formula', 0);
    var tokens = formulaReader.tokenize(text, dialect);
    return new Parser(tokens, text).parseFormula();
  };

  /** Parse (lenient) and return null on a syntax error. */
  formulaReader.tryParse = function (text, dialect) {
    try { return formulaReader.parse(text, dialect); } catch (e) { return null; }
  };

  /* ------------------------------------------------------------------ dialect detection */
  /** 'en' | 'tr' | 'ru' from function names, literals, separators and decimal commas. */
  formulaReader.detectDialect = function (text) {
    var L = loc();
    if (L && L.detectDialect) return L.detectDialect(text);
    text = String(text == null ? '' : text).replace(/"(?:[^"]|"")*"/g, '""').replace(/'(?:[^']|'')*'!/g, "'S'!");
    if (/[Ѐ-ӿ][Ѐ-ӿA-Za-z0-9_.]*\s*\(/.test(text) || /ИСТИНА|ЛОЖЬ/.test(text)) return 'ru';
    if (/[çğıİöşüÇĞÖŞÜ][^\s(]*\s*\(/.test(text) || /DOĞRU|YANLIŞ|\{[^}]*\\/.test(text)) return 'tr';
    if (/;/.test(text) && /\d,\d/.test(text)) return 'tr';
    return 'en';
  };

  /* ------------------------------------------------------------------ reference shifting */
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /** Shift one reference text ('A1', '$A$1:B2', 'A:A', '1:1', '@A1:A5', 'A1#'); relative parts only. */
  formulaReader.shiftRefText = function (text, rowDelta, colDelta) {
    rowDelta = rowDelta | 0; colDelta = colDelta | 0;
    var m = /^(@?)(.*?)(#?)$/.exec(String(text));
    var body = m[2].split(':').map(shiftPart).join(':');
    return m[1] + body + m[3];
    function shiftPart(p) {
      var c;
      if ((c = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/.exec(p))) {
        var col = c[1] ? c[2] : colLetter(clamp(colIndex(c[2]) + colDelta, 1, MAX_COL));
        var row = c[3] ? +c[4] : clamp(+c[4] + rowDelta, 1, MAX_ROW);
        return c[1] + col.toUpperCase() + c[3] + row;
      }
      if ((c = /^(\$?)([A-Za-z]{1,3})$/.exec(p))) {
        return c[1] + (c[1] ? c[2].toUpperCase() : colLetter(clamp(colIndex(c[2]) + colDelta, 1, MAX_COL)));
      }
      if ((c = /^(\$?)(\d+)$/.exec(p))) {
        return c[1] + (c[1] ? c[2] : clamp(+c[2] + rowDelta, 1, MAX_ROW));
      }
      return p;
    }
  };

  /** New AST with relative reference parts moved by (rowDelta, colDelta). Names/structured refs untouched. */
  formulaReader.shiftRefs = function (tree, rowDelta, colDelta) {
    var ast = A();
    return ast.transform(tree, function (n) {
      if (n.t === 'ref') n.ref = formulaReader.shiftRefText(n.ref, rowDelta, colDelta);
      return n;
    });
  };

  /** Shift a formula string and render it back in the same dialect ('=' kept iff present). */
  formulaReader.shiftFormula = function (text, rowDelta, colDelta, dialect) {
    text = String(text == null ? '' : text);
    var d = (!dialect || dialect === 'auto') ? formulaReader.detectDialect(text) : dialect;
    var tree = formulaReader.parse(text, d);
    var shifted = formulaReader.shiftRefs(tree, rowDelta, colDelta);
    return A().serialize(shifted, { dialect: d, withEquals: /^\s*=/.test(text) });
  };

  /** [{ ref, sheet }] used by a formula (unique, in order of appearance). */
  formulaReader.listRefs = function (text, dialect) {
    return A().refsUsed(formulaReader.parse(text, dialect || 'auto'));
  };

  /** Functions used by a formula (EN canonical names). */
  formulaReader.listFunctions = function (text, dialect) {
    return A().functionsUsed(formulaReader.parse(text, dialect || 'auto'));
  };

  /** Convenience: re-render a formula in another dialect. */
  formulaReader.toDialect = function (text, toDialect, fromDialect) {
    text = String(text == null ? '' : text);
    var tree = formulaReader.parse(text, fromDialect || 'auto');
    return A().serialize(tree, { dialect: toDialect || 'en', withEquals: /^\s*=/.test(text) });
  };

  /** True when the text parses as a formula (any dialect). */
  formulaReader.isValid = function (text, dialect) { return formulaReader.tryParse(text, dialect) !== null; };

  EFS.formulaReader = formulaReader;
  return formulaReader;
});
