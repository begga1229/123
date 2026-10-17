/* Formula Studio — natural-language parser (EFS.parser).
 * Turns a Turkish / Russian / English request into a ParsedQuery (see docs/ARCHITECTURE.md §8):
 * tokens, literals, numbers, references (explicit cells/ranges, column letters, header names from the
 * workbook context), concepts (via EFS.lexicon), conditions, then/else values, target, flags.
 * Plain ES2019, no dependencies at load time: EFS.normalize / EFS.lexicon / EFS.catalog are resolved lazily
 * and every one of them has a built-in fallback so the parser never throws. */
(function (root, factory) {
  var EFS = root.EFS || (root.EFS = {});
  var api = factory(EFS, root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (EFS, root) {
  'use strict';
  var parser = {};
  var MAX_TEXT = 6000;

  /* ------------------------------------------------------------------ lazy module access */
  function N() { return EFS.normalize || null; }
  function L() { return EFS.lexicon || null; }
  function C() { return EFS.catalog || null; }
  function safe(fn, fallback) {
    try { var v = fn(); return v === undefined ? fallback : v; } catch (e) { return fallback; }
  }

  /* ------------------------------------------------------------------ fallbacks for normalize */
  var TR_LOWER_MAP = { 'İ': 'i', 'I': 'ı' };
  function lower(s, lang) {
    var n = N();
    if (n && typeof n.lower === 'function') { var r = safe(function () { return n.lower(s, lang); }, null); if (typeof r === 'string') return r; }
    s = String(s == null ? '' : s);
    if (lang === 'tr') s = s.replace(/[İI]/g, function (c) { return TR_LOWER_MAP[c]; });
    return s.toLowerCase();
  }
  function foldFallback(s) {
    s = String(s == null ? '' : s);
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s[i], code = s.charCodeAt(i);
      if (code >= 0x0400 && code <= 0x04FF) {
        ch = ch.toLowerCase();
        if (ch === 'ё') ch = 'е';
        out += ch;
      } else if (ch === 'I') out += 'i';
      else if (ch === 'ı') out += 'i';
      else if (ch === 'İ') out += 'i';
      else {
        var d = ch.normalize ? ch.normalize('NFD') : ch;
        d = d.replace(/[̀-ͯ]/g, '');
        if (d === 'ß') d = 'ss';
        out += d.toLowerCase();
      }
    }
    return out;
  }
  function fold(s) {
    var n = N();
    if (n && typeof n.fold === 'function') { var r = safe(function () { return n.fold(s); }, null); if (typeof r === 'string') return r; }
    return foldFallback(s);
  }
  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur[0] = i;
      for (j = 1; j <= b.length; j++) {
        var cost = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      var t = prev; prev = cur; cur = t;
    }
    return prev[b.length];
  }
  function similarity(a, b) {
    var n = N();
    if (n && typeof n.similarity === 'function') { var r = safe(function () { return n.similarity(a, b); }, null); if (typeof r === 'number' && !isNaN(r)) return r; }
    a = foldFallback(a); b = foldFallback(b);
    var m = Math.max(a.length, b.length);
    if (!m) return 1;
    return 1 - levenshtein(a, b) / m;
  }
  var TR_SUFFIXES = ['larından', 'lerinden', 'larına', 'lerine', 'larını', 'lerini', 'ların', 'lerin', 'ları', 'leri', 'ndan', 'nden', 'ında', 'inde', 'unda', 'ünde', 'ının', 'inin', 'unun', 'ünün', 'daki', 'deki', 'taki', 'teki', 'lar', 'ler', 'dan', 'den', 'tan', 'ten', 'nın', 'nin', 'nun', 'nün', 'yla', 'yle', 'sı', 'si', 'su', 'sü', 'ın', 'in', 'un', 'ün', 'da', 'de', 'ta', 'te', 'ya', 'ye', 'la', 'le', 'ki', 'ı', 'i', 'u', 'ü', 'a', 'e'];
  var RU_SUFFIXES = ['иями', 'ями', 'ами', 'ого', 'его', 'ому', 'ему', 'ите', 'йте', 'ать', 'ять', 'ить', 'ов', 'ев', 'ей', 'ой', 'ый', 'ий', 'ая', 'яя', 'ое', 'ее', 'ые', 'ие', 'ом', 'ем', 'ах', 'ях', 'ть', 'у', 'ю', 'а', 'я', 'ы', 'и', 'е', 'о', 'ь'];
  function stemFallback(word, lang) {
    var w = String(word || '');
    var list = lang === 'tr' ? TR_SUFFIXES : lang === 'ru' ? RU_SUFFIXES : ['ing', 'ed', 'es', 's'];
    for (var i = 0; i < list.length; i++) {
      var suf = list[i];
      if (w.length - suf.length >= 3 && w.slice(-suf.length) === suf) return w.slice(0, -suf.length);
    }
    return w;
  }
  function stem(word, lang) {
    var n = N();
    if (n && typeof n.stem === 'function') { var r = safe(function () { return n.stem(word, lang); }, null); if (typeof r === 'string' && r) return r; }
    return stemFallback(word, lang);
  }
  function isCyrillic(s) { return /[Ѐ-ӿ]/.test(s); }
  var TR_HINT = /(^|[^\p{L}])(ve|ile|için|sütun|sütunu|sütununu|topla|toplam|olan|olanlar|ise|değil|değilse|hücre|satır|yaz|say|ortalama|büyük|küçük|kadar|arasında|boş|dolu|her|tüm|bu|şu|nasıl|kaç|getir|bul|ara|hesapla|yüzde|tarih|gün|ay|yıl|eğer|veya|çarp|böl|çıkar|ekle|en|az|fazla)(?=[^\p{L}]|$)/iu;
  var EN_HINT = /(^|[^\p{L}])(the|and|or|if|then|else|sum|count|average|column|row|cell|than|with|for|each|greater|less|equal|contains|blank|write|put|how|many|total|of|in|to|from|is|are|value|values|text|date|days|between|first|last|round|lookup|find|return|percent|max|min|not|at|least|most|more|over|under|times|by|where|which|show|get|give|into|put|write|cells|columns|rows|case|sensitive|match|use|using|unique|entire|whole|sheet|string|characters|character|words|word|name|list|left|right|number|numbers|per|each|every|than|then|only|all|any|none)(?=[^\p{L}]|$)/iu;
  function detectLanguage(text) {
    var n = N();
    if (n && typeof n.detectLanguage === 'function') {
      var r = safe(function () { return n.detectLanguage(text); }, null);
      if (r === 'tr' && !isCyrillic(text) && !/[çğışöüÇĞİŞÖÜ]/.test(text) && !new RegExp(TR_HINT.source, 'iu').test(text) && EN_HINT.test(text)) return 'en';
      if (r === 'tr' || r === 'ru' || r === 'en') return r;
    }
    if (isCyrillic(text)) return 'ru';
    if (/[çğışöüÇĞİŞÖÜ]/.test(text)) return 'tr';
    var trHits = (text.match(new RegExp(TR_HINT.source, 'giu')) || []).length;
    var enHits = (text.match(new RegExp(EN_HINT.source, 'giu')) || []).length;
    if (enHits > trHits) return 'en';
    return 'tr';
  }

  /* ------------------------------------------------------------------ fallback tokenizer (also used to repair) */
  var RE_SHEET_REF = /^(?:'([^']{1,64})'|([\p{L}\p{N}_.]{1,64}))!(\$?[A-Za-z]{1,3}\$?\d+(?::\$?[A-Za-z]{1,3}\$?\d+)?|\$?[A-Za-z]{1,3}:\$?[A-Za-z]{1,3}|\d+:\d+)/u;
  var RE_REF = /^(\$?[A-Za-z]{1,3}\$?\d+(?::\$?[A-Za-z]{1,3}\$?\d+)?|\$?[A-Z]{1,3}:\$?[A-Z]{1,3}|\$?[a-z]{1,3}:\$?[a-z]{1,3}|\d+:\d+)(?![\p{L}\p{N}])/u;
  var RE_CELL_FULL = /^\$?[A-Za-z]{1,3}\$?\d+$/;
  var RE_PERCENT_PRE = /^%\s?(\d+(?:[.,]\d+)?)/;
  var RE_NUMBER = /^-?\d+(?:[.,]\d{3})*(?:[.,]\d+)?%?/;
  var RE_ORDINAL = /^(\d+)(?:-?(й|го|му|ю|я|е|ой|ый|ий|ая|ое|ые|ых|ым|им|nd|st|rd|th))(?![\p{L}\p{N}])/u;
  var RE_ORDINAL_DOT = /^(\d+)\.(?=\s|$|[,;:!?)])/;
  var RE_WORD = /^[\p{L}\p{N}_][\p{L}\p{N}_.\-'’]*/u;
  var QUOTES = { '"': '"', '«': '»', '“': '”', '„': '“', '‘': '’', '\'': '\'' };

  function tokenizeFallback(text, lang, offset) {
    offset = offset || 0;
    var out = [], i = 0, n = text.length;
    function push(raw, s, e, extra) {
      var t = { raw: raw, norm: lower(raw, lang), start: offset + s, end: offset + e };
      if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) t[k] = extra[k];
      out.push(t);
    }
    while (i < n) {
      var ch = text[i];
      if (/\s/.test(ch)) { i++; continue; }
      var rest = text.slice(i), m;
      // quoted strings
      if (QUOTES[ch]) {
        var closeCh = QUOTES[ch];
        var prevCh = i > 0 ? text[i - 1] : ' ';
        var okOpen = ch !== '\'' && ch !== '’' || !/[\p{L}\p{N}]/u.test(prevCh);
        if (ch === '‘') okOpen = !/[\p{L}\p{N}]/u.test(prevCh);
        if (okOpen) {
          var j = text.indexOf(closeCh, i + 1);
          if (ch === '\'' || ch === '‘') {
            // apostrophe quote must close before a non-letter (not a suffix like A1'den)
            while (j > 0 && j + 1 < n && /[\p{L}\p{N}]/u.test(text[j + 1])) j = text.indexOf(closeCh, j + 1);
          }
          if (j > i) { push(text.slice(i, j + 1), i, j + 1, { _str: text.slice(i + 1, j) }); i = j + 1; continue; }
        }
      }
      // sheet-qualified refs
      m = RE_SHEET_REF.exec(rest);
      if (m) { push(m[0], i, i + m[0].length, { _ref: true }); i += m[0].length; continue; }
      // percent with leading %
      m = RE_PERCENT_PRE.exec(rest);
      if (m) { push(m[0], i, i + m[0].length, { _num: m[1], _pct: true }); i += m[0].length; continue; }
      // cell refs
      m = RE_REF.exec(rest);
      if (m) {
        push(m[1], i, i + m[1].length, { _ref: true }); i += m[1].length; continue;
      }
      // ordinals
      m = RE_ORDINAL.exec(rest);
      if (m) { push(m[0], i, i + m[0].length, { _ord: parseInt(m[1], 10) }); i += m[0].length; continue; }
      m = RE_ORDINAL_DOT.exec(rest);
      if (m) { push(m[0], i, i + m[0].length, { _ord: parseInt(m[1], 10), _ordDot: true }); i += m[0].length; continue; }
      // numbers
      if (/\d/.test(ch) || (ch === '-' && /^\-\d/.test(rest) && (i === 0 || /[\s(]/.test(text[i - 1])))) {
        m = RE_NUMBER.exec(rest);
        if (m) {
          var numRaw = m[0];
          // do not swallow a trailing separator that is really punctuation ("100," → "100")
          while (/[.,]$/.test(numRaw)) numRaw = numRaw.slice(0, -1);
          push(numRaw, i, i + numRaw.length, { _num: numRaw.replace(/%$/, ''), _pct: /%$/.test(numRaw) });
          i += numRaw.length; continue;
        }
      }
      // words
      m = RE_WORD.exec(rest);
      if (m) {
        var w = m[0];
        while (/[.\-'’]$/.test(w)) w = w.slice(0, -1);
        if (!w) { push(ch, i, i + 1, { _punct: true }); i++; continue; }
        push(w, i, i + w.length); i += w.length; continue;
      }
      // multi-char operators
      m = /^(<=|>=|<>|!=|==|=|<|>|≤|≥|≠)/.exec(rest);
      if (m) { push(m[0], i, i + m[0].length, { _punct: true }); i += m[0].length; continue; }
      push(ch, i, i + 1, { _punct: true }); i++;
    }
    return out;
  }

  function tokenizeText(text, lang) {
    var n = N(), toks = null;
    if (n && typeof n.tokenize === 'function') {
      toks = safe(function () { return n.tokenize(text, lang); }, null);
      if (!Array.isArray(toks)) toks = null;
    }
    if (!toks) return tokenizeFallback(text, lang, 0);
    // sanitize and repair tokens coming from EFS.normalize
    var out = [];
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (!t || typeof t.raw !== 'string') continue;
      var start = typeof t.start === 'number' ? t.start : -1;
      var end = typeof t.end === 'number' ? t.end : -1;
      if (start < 0 || end <= start || text.slice(start, end) !== t.raw) {
        // position mismatch: search the raw text from the last known end
        var from = out.length ? out[out.length - 1].end : 0;
        var pos = text.indexOf(t.raw, from);
        if (pos < 0) pos = text.indexOf(t.raw);
        if (pos < 0) continue;
        start = pos; end = pos + t.raw.length;
      }
      var raw = t.raw;
      // a single-quoted "string" glued to a word (A1'den A10'a) is really an apostrophe suffix
      if ((raw[0] === '\'' || raw[0] === '’') && raw.length > 1 && start > 0 && /[\p{L}\p{N}]/u.test(text[start - 1]) && (QUOTES[raw[0]] === raw[raw.length - 1] || /^['’][\p{L}]+$/u.test(raw))) {
        var sub = tokenizeFallback(text.slice(start, end), lang, start);
        for (var s = 0; s < sub.length; s++) out.push(sub[s]);
        continue;
      }
      out.push({ raw: raw, norm: typeof t.norm === 'string' ? t.norm : lower(raw, lang), start: start, end: end });
    }
    return out;
  }

  /** Merge "'den" style suffix pieces into the preceding token and expose token.suffix. */
  function attachSuffixes(tokens, text) {
    var out = [];
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i], prev = out[out.length - 1];
      // piece starting with apostrophe, glued to previous token
      if (prev && /^['’][\p{L}]{1,7}$/u.test(t.raw) && t.start === prev.end && !prev._str) {
        prev.base = prev.base || text.slice(prev.start, prev.end); prev.raw = text.slice(prev.start, t.end); prev.end = t.end; prev.suffix = lower(t.raw.slice(1), 'tr'); continue;
      }
      // apostrophe punct followed by a short letter piece glued to the previous token
      if (prev && (t.raw === '\'' || t.raw === '’') && t.start === prev.end && i + 1 < tokens.length && tokens[i + 1].start === t.end && /^[\p{L}]{1,7}$/u.test(tokens[i + 1].raw) && !prev._str) {
        prev.base = prev.base || text.slice(prev.start, prev.end); prev.raw = text.slice(prev.start, tokens[i + 1].end); prev.end = tokens[i + 1].end; prev.suffix = lower(tokens[i + 1].raw, 'tr'); i++; continue;
      }
      // tokenizer dropped the apostrophe: previous token ends right before it and a short piece follows
      if (prev && t.start === prev.end + 1 && /['’]/.test(text[prev.end] || '') && /^[\p{L}]{1,7}$/u.test(t.raw) && !prev._str && prev.type !== 'punct' && !/^[^\p{L}\p{N}]+$/u.test(prev.raw)) {
        prev.raw = text.slice(prev.start, t.end); prev.base = prev.base || text.slice(prev.start, prev.end); prev.end = t.end; prev.suffix = lower(t.raw, 'tr'); continue;
      }
      // token containing an apostrophe inside (A1'den, Şehir'i, 100'den)
      var m = /^(.+?)['’]([\p{L}]{1,7})$/u.exec(t.raw);
      if (m && !t._str) {
        t.base = m[1]; t.suffix = lower(m[2], 'tr');
      }
      out.push(t);
    }
    for (var k = 0; k < out.length; k++) {
      if (!out[k].base) out[k].base = out[k]._str !== undefined ? out[k].raw : out[k].raw;
    }
    return out;
  }

  /* ------------------------------------------------------------------ numbers */
  function parseNumber(raw, lang) {
    var s = String(raw || '').replace(/\s/g, '').replace(/%/g, '');
    var neg = false;
    if (s[0] === '-') { neg = true; s = s.slice(1); }
    if (!/^\d/.test(s)) return null;
    var lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.');
    var v;
    if (lastComma >= 0 && lastDot >= 0) {
      // both present: the last one is the decimal separator
      if (lastComma > lastDot) v = s.replace(/\./g, '').replace(',', '.');
      else v = s.replace(/,/g, '');
    } else if (lastComma >= 0) {
      var afterC = s.length - lastComma - 1;
      var commas = (s.match(/,/g) || []).length;
      if (commas > 1 || (afterC === 3 && lang === 'en')) v = s.replace(/,/g, '');
      else v = s.replace(',', '.');
    } else if (lastDot >= 0) {
      var afterD = s.length - lastDot - 1;
      var dots = (s.match(/\./g) || []).length;
      if (dots > 1 || (afterD === 3 && lang !== 'en' && s.length - afterD - 1 <= 3)) v = s.replace(/\./g, '');
      else v = s;
    } else v = s;
    var num = parseFloat(v);
    if (isNaN(num)) return null;
    return neg ? -num : num;
  }

  var NUMBER_WORDS = {
    tr: { 'sıfır': 0, 'bir': 1, 'iki': 2, 'üç': 3, 'dört': 4, 'beş': 5, 'altı': 6, 'yedi': 7, 'sekiz': 8, 'dokuz': 9, 'on': 10, 'yirmi': 20, 'otuz': 30, 'kırk': 40, 'elli': 50, 'altmış': 60, 'yetmiş': 70, 'seksen': 80, 'doksan': 90, 'yüz': 100, 'bin': 1000, 'milyon': 1000000 },
    ru: { 'ноль': 0, 'один': 1, 'одна': 1, 'одно': 1, 'два': 2, 'две': 2, 'три': 3, 'четыре': 4, 'пять': 5, 'шесть': 6, 'семь': 7, 'восемь': 8, 'девять': 9, 'десять': 10, 'одиннадцать': 11, 'двенадцать': 12, 'тринадцать': 13, 'четырнадцать': 14, 'пятнадцать': 15, 'шестнадцать': 16, 'семнадцать': 17, 'восемнадцать': 18, 'девятнадцать': 19, 'двадцать': 20, 'тридцать': 30, 'сорок': 40, 'пятьдесят': 50, 'шестьдесят': 60, 'семьдесят': 70, 'восемьдесят': 80, 'девяносто': 90, 'сто': 100, 'двести': 200, 'триста': 300, 'четыреста': 400, 'пятьсот': 500, 'тысяча': 1000, 'тысячи': 1000, 'тысяч': 1000, 'миллион': 1000000, 'двух': 2, 'трёх': 3, 'трех': 3, 'пяти': 5, 'десяти': 10 },
    en: { 'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90, 'hundred': 100, 'thousand': 1000, 'million': 1000000 }
  };
  var ARTICLE_ONES = { tr: { 'bir': 1 }, ru: { 'один': 1, 'одна': 1, 'одно': 1 }, en: { 'a': 1, 'an': 1 } };
  function numberWord(norm, lang) {
    var l = L();
    if (l && typeof l.numberWord === 'function') {
      var r = safe(function () { return l.numberWord(norm, lang); }, null);
      if (typeof r === 'number' && !isNaN(r)) return r;
    }
    var tbl = NUMBER_WORDS[lang] || NUMBER_WORDS.en;
    var f = fold(norm);
    if (Object.prototype.hasOwnProperty.call(tbl, norm)) return tbl[norm];
    for (var k in tbl) if (fold(k) === f) return tbl[k];
    return null;
  }
  var ORDINAL_WORDS = {
    tr: { 'birinci': 1, 'ikinci': 2, 'üçüncü': 3, 'dördüncü': 4, 'beşinci': 5, 'altıncı': 6, 'yedinci': 7, 'sekizinci': 8, 'dokuzuncu': 9, 'onuncu': 10 },
    ru: { 'первый': 1, 'первая': 1, 'первое': 1, 'первого': 1, 'первой': 1, 'второй': 2, 'вторая': 2, 'второе': 2, 'второго': 2, 'третий': 3, 'третья': 3, 'третье': 3, 'третьего': 3, 'четвёртый': 4, 'четвертый': 4, 'четвёртая': 4, 'пятый': 5, 'пятая': 5, 'шестой': 6, 'седьмой': 7, 'восьмой': 8, 'девятый': 9, 'десятый': 10 },
    en: { 'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'fifth': 5, 'sixth': 6, 'seventh': 7, 'eighth': 8, 'ninth': 9, 'tenth': 10 }
  };
  function ordinalWord(norm, lang) {
    var l = L();
    if (l && typeof l.ordinal === 'function') {
      var r = safe(function () { return l.ordinal(norm, lang); }, null);
      if (typeof r === 'number' && !isNaN(r) && r > 0) return r;
    }
    var m = /^(\d+)(?:\.|-?(?:й|го|му|ю|я|е|ой|ый|ий|ая|ое|ые|ых|ым|им|nd|st|rd|th))$/u.exec(norm);
    if (m) return parseInt(m[1], 10);
    var tbl = ORDINAL_WORDS[lang] || ORDINAL_WORDS.en;
    var f = fold(norm);
    for (var k in tbl) if (fold(k) === f) return tbl[k];
    return null;
  }

  /* ------------------------------------------------------------------ built-in vocabulary (supplements EFS.lexicon)
   * Single words: 'stem*' = prefix match (folded), 'word' = exact match. Phrases: arrays of such words. */
  var OWN = {
    tr: [
      [['büyük*', 'veya', 'eşit*'], 'GTE'], [['büyük*', 'ya', 'da', 'eşit*'], 'GTE'], [['büyük*', 'eşit*'], 'GTE'], [['büyük*', 'veya', 'daha', 'fazla*'], 'GTE'],
      [['ve', 'üzeri*'], '!GTE'], [['ve', 'üstü*'], '!GTE'], [['ve', 'yukarı*'], '!GTE'], [['ve', 'fazla*'], '!GTE'], [['veya', 'üzeri*'], '!GTE'], [['ya', 'da', 'üzeri*'], 'GTE'], [['en', 'az'], 'GTE'], [['den', 'az', 'olmayan*'], 'GTE'],
      [['küçük*', 'veya', 'eşit*'], 'LTE'], [['küçük*', 'ya', 'da', 'eşit*'], 'LTE'], [['küçük*', 'eşit*'], 'LTE'], [['küçük*', 'veya', 'daha', 'az'], 'LTE'],
      [['ve', 'altı*'], '!LTE'], [['ve', 'aşağı*'], '!LTE'], [['ve', 'azı*'], '!LTE'], [['veya', 'altı*'], '!LTE'], [['ya', 'da', 'altı*'], 'LTE'], [['en', 'fazla*'], 'LTE'], [['en', 'çok'], 'LTE'],
      [['eşit', 'değil*'], 'NEQ'], [['eşit', 'olmayan*'], 'NEQ'], [['aynı', 'olmayan*'], 'NEQ'],
      [['boş', 'olmayan*'], 'NOT_EMPTY'], [['boş', 'değil'], 'NOT_EMPTY'], [['boş', 'değilse'], ['NOT_EMPTY', 'IF']], [['dolu', 'olan*'], 'NOT_EMPTY'], [['dolu', 'ise'], ['NOT_EMPTY', 'IF']],
      [['boş', 'olan*'], 'EMPTY'], [['boş', 'ise'], ['EMPTY', 'IF']], [['boş', 'hücre*'], 'EMPTY'],
      [['boş', 'bırak*'], 'BLANK'], [['boş', 'olsun'], 'BLANK'], [['boş', 'kalsın'], 'BLANK'], [['boş', 'göster*'], 'BLANK'], [['boş', 'yaz*'], 'BLANK'], [['boş', 'döndür*'], 'BLANK'], [['boş', 'getir*'], 'BLANK'], [['boş', 'değer'], 'BLANK'], [['hiçbir', 'şey'], 'BLANK'],
      [['ile', 'başlayan*'], 'STARTS_WITH'], [['ile', 'başlıyor*'], 'STARTS_WITH'], [['ile', 'biten*'], 'ENDS_WITH'], [['ile', 'bitiyor*'], 'ENDS_WITH'],
      [['ya', 'da'], 'OR'], [['ve', 'ayrıca'], 'AND'], [['hem', 'de'], 'AND'],
      [['aksi', 'halde'], 'ELSE'], [['aksi', 'takdirde'], 'ELSE'], [['aksi', 'durumda'], 'ELSE'], [['diğer', 'durumda'], 'ELSE'], [['değil', 'ise'], 'ELSE'], [['o', 'zaman'], 'THEN'],
      [['hata', 'olursa'], 'IFERROR'], [['hata', 'varsa'], 'IFERROR'], [['hata', 'verirse'], 'IFERROR'], [['hata', 'çıkarsa'], 'IFERROR'], [['hata', 'durumunda'], 'IFERROR'], [['hata', 'alırsa*'], 'IFERROR'], [['hata', 'olduğunda'], 'IFERROR'],
      [['her', 'satır*'], 'EACH_ROW'], [['her', 'bir', 'satır*'], 'EACH_ROW'], [['satır', 'satır'], 'EACH_ROW'], [['tüm', 'satırlar*'], 'EACH_ROW'], [['bütün', 'satırlar*'], 'EACH_ROW'],
      [['harf*', 'duyarlı*'], 'CASE_SENSITIVE'], [['büyük', 'küçük', 'harf*', 'duyarlı*'], 'CASE_SENSITIVE'], [['büyük', 'küçük', 'harfe', 'duyarlı*'], 'CASE_SENSITIVE'],
      [['kaç', 'tane*'], 'QUESTION'], [['ne', 'kadar'], 'QUESTION'], [['kaç', 'farklı'], ['QUESTION', 'COUNT_UNIQUE']], [['farklı', 'değer*'], 'COUNT_UNIQUE'], [['kaç', 'çeşit'], ['QUESTION', 'COUNT_UNIQUE']],
      [['tüm', 'sütun*'], 'WHOLE_COLUMN'], [['bütün', 'sütun*'], 'WHOLE_COLUMN'],
      ['büyük*', 'GT'], ['fazla*', 'GT'], ['üzeri*', 'GT'], ['üstü*', 'GT'], ['aşan*', 'GT'], ['aşıyor*', 'GT'], ['geçen*', ['CONTAINS', 'GT']], ['geçiyor*', ['CONTAINS', 'GT']], ['yüksek*', 'GT'],
      ['küçük*', 'LT'], ['az', 'LT'], ['azsa', ['LT', 'IF']], ['altı', 'LT'], ['altında*', 'LT'], ['aşağısında*', 'LT'], ['düşük*', 'LT'],
      ['eşit*', 'EQ'], ['olan*', 'EQ'], ['olduğunda', 'EQ'], ['ise', ['IF', 'EQ', 'THEN']], ['olursa', 'IF'], ['olduğu', 'EQ'],
      ['farklı*', 'NEQ'], ['hariç*', 'NEQ'], ['dışında*', 'NEQ'], ['olmayan*', 'NEQ'], ['değilse', 'ELSE'], ['yoksa', 'ELSE'], ['olmazsa', 'ELSE'], ['değil', 'NOT'],
      ['içeren*', 'CONTAINS'], ['içeriyor*', 'CONTAINS'], ['içerir*', 'CONTAINS'], ['içersin', 'CONTAINS'], ['bulunan*', 'CONTAINS'], ['bulunduran*', 'CONTAINS'], ['içinde', 'IN'], ['içindeki*', 'IN'],
      ['boş', ['EMPTY', 'BLANK']], ['boşsa', ['EMPTY', 'IF']], ['boşlar*', 'EMPTY'], ['boşluk*', 'BLANK'], ['dolu*', 'NOT_EMPTY'], ['doluysa', ['NOT_EMPTY', 'IF']],
      ['arasında*', 'BETWEEN'], ['arası', 'BETWEEN'], ['aralığında*', 'BETWEEN'],
      ['ve', 'AND'], ['hem', 'AND'], ['ayrıca', 'AND'], ['veya', 'OR'], ['yahut', 'OR'], ['ile', 'WITH'],
      ['eğer', 'IF'], ['durumunda', 'IF'], ['halinde', 'IF'], ['olsun', 'THEN'],
      ['hata*', 'IFERROR'], ['hatalı*', 'IFERROR'],
      ['kaç*', 'QUESTION'],
      ['sütun*', 'COLUMN'], ['sutun*', 'COLUMN'], ['kolon*', 'COLUMN'], ['satır*', 'ROW'], ['satir*', 'ROW'], ['hücre*', 'CELL'], ['hucre*', 'CELL'], ['sayfa*', 'SHEET'], ['tüm', 'ALL'], ['bütün', 'ALL'], ['tamamı*', 'ALL'], ['tamamını', 'ALL'],
      ['yaz', 'WRITE'], ['yazdır*', 'WRITE'], ['yazsın', 'WRITE'], ['koy', 'WRITE'], ['doldur*', 'WRITE'], ['uygula*', 'WRITE'], ['yerleştir*', 'WRITE'], ['kaydet*', 'WRITE'], ['ekle', 'WRITE'],
      ['kadar', 'TO'], ['itibaren', 'FROM'], ['ilk', 'FIRST'], ['baştan', 'FIRST'], ['son', 'LAST'], ['sondan', 'LAST'], ['yüzde*', 'PERCENT'],
      ['her', 'EACH_ROW']
    ],
    ru: [
      [['не', 'менее'], 'GTE'], [['не', 'меньше'], 'GTE'], [['не', 'ниже'], 'GTE'], [['больше', 'или', 'равн*'], 'GTE'], [['больше', 'либо', 'равн*'], 'GTE'], [['более', 'или', 'равн*'], 'GTE'], [['как', 'минимум'], 'GTE'], [['и', 'выше'], '!GTE'], [['и', 'более'], '!GTE'], [['и', 'больше'], '!GTE'], [['или', 'больше'], '!GTE'], [['или', 'выше'], '!GTE'], [['или', 'более'], '!GTE'], [['начиная', 'с'], 'GTE'],
      [['не', 'более'], 'LTE'], [['не', 'больше'], 'LTE'], [['не', 'выше'], 'LTE'], [['не', 'превыша*'], 'LTE'], [['меньше', 'или', 'равн*'], 'LTE'], [['меньше', 'либо', 'равн*'], 'LTE'], [['менее', 'или', 'равн*'], 'LTE'], [['как', 'максимум'], 'LTE'], [['и', 'ниже'], '!LTE'], [['и', 'меньше'], '!LTE'], [['или', 'меньше'], '!LTE'], [['или', 'ниже'], '!LTE'], [['или', 'менее'], '!LTE'],
      [['не', 'равн*'], 'NEQ'], [['не', 'равен'], 'NEQ'], [['за', 'исключением'], 'NEQ'], [['не', 'является'], 'NEQ'], [['не', 'совпада*'], 'NEQ'], [['отличн*', 'от'], 'NEQ'], [['отличается', 'от'], 'NEQ'],
      [['не', 'пуст*'], 'NOT_EMPTY'], [['с', 'данными'], 'NOT_EMPTY'], [['не', 'заполнен*'], 'EMPTY'],
      [['оставь', 'пуст*'], 'BLANK'], [['оставить', 'пуст*'], 'BLANK'], [['оставлять', 'пуст*'], 'BLANK'], [['пустую', 'строку'], 'BLANK'], [['пустая', 'строка'], 'BLANK'], [['пустое', 'значение'], 'BLANK'], [['ничего', 'не', 'вывод*'], 'BLANK'], [['ничего', 'не', 'писать'], 'BLANK'], [['ничего', 'не', 'пиши'], 'BLANK'],
      [['начина*', 'с'], 'STARTS_WITH'], [['начина*', 'на'], 'STARTS_WITH'], [['заканчива*', 'на'], 'ENDS_WITH'], [['оканчива*', 'на'], 'ENDS_WITH'], [['с', 'текстом'], 'CONTAINS'], [['в', 'которых', 'есть'], 'CONTAINS'], [['где', 'есть'], 'CONTAINS'],
      [['а', 'также'], 'AND'], [['в', 'противном', 'случае'], 'ELSE'], [['в', 'ином', 'случае'], 'ELSE'], [['если', 'нет'], 'ELSE'], [['в', 'случае'], 'IF'],
      [['если', 'ошибк*'], 'IFERROR'], [['при', 'ошибке'], 'IFERROR'], [['в', 'случае', 'ошибки'], 'IFERROR'], [['когда', 'ошибк*'], 'IFERROR'],
      [['для', 'каждой', 'строк*'], 'EACH_ROW'], [['каждой', 'строк*'], 'EACH_ROW'], [['каждая', 'строка'], 'EACH_ROW'], [['в', 'каждой', 'строке'], 'EACH_ROW'], [['по', 'строкам'], 'EACH_ROW'], [['каждую', 'строку'], 'EACH_ROW'],
      [['с', 'учётом', 'регистра'], 'CASE_SENSITIVE'], [['с', 'учетом', 'регистра'], 'CASE_SENSITIVE'], [['учитывая', 'регистр'], 'CASE_SENSITIVE'], [['чувствительн*', 'к', 'регистру'], 'CASE_SENSITIVE'],
      [['сколько', 'уникальн*'], ['QUESTION', 'COUNT_UNIQUE']], [['сколько', 'разных'], ['QUESTION', 'COUNT_UNIQUE']], [['разных', 'значен*'], 'COUNT_UNIQUE'], [['уникальн*', 'значен*'], 'COUNT_UNIQUE'],
      [['весь', 'столбец'], 'WHOLE_COLUMN'], [['вся', 'колонка'], 'WHOLE_COLUMN'], [['столбец', 'целиком'], 'WHOLE_COLUMN'], [['в', 'диапазоне'], 'BETWEEN'], [['в', 'пределах'], 'BETWEEN'], [['в', 'интервале'], 'BETWEEN'],
      ['больше', 'GT'], ['более', 'GT'], ['свыше', 'GT'], ['превыша*', 'GT'], ['выше', 'GT'], ['крупнее', 'GT'], ['старше', 'GT'],
      ['меньше', 'LT'], ['менее', 'LT'], ['ниже', 'LT'], ['младше', 'LT'],
      ['равно', 'EQ'], ['равен', 'EQ'], ['равна', 'EQ'], ['равны', 'EQ'], ['равняется', 'EQ'], ['является', 'EQ'], ['совпада*', 'EQ'],
      ['кроме', 'NEQ'], ['исключая', 'NEQ'], ['отличн*', 'NEQ'],
      ['содерж*', 'CONTAINS'], ['включа*', 'CONTAINS'], ['встреча*', 'CONTAINS'],
      ['пуст*', ['EMPTY', 'BLANK']], ['незаполнен*', 'EMPTY'], ['непуст*', 'NOT_EMPTY'], ['заполнен*', 'NOT_EMPTY'],
      ['между', 'BETWEEN'],
      ['и', 'AND'], ['также', 'AND'], ['или', 'OR'], ['либо', 'OR'],
      ['если', 'IF'], ['когда', 'IF'], ['то', 'THEN'], ['тогда', 'THEN'], ['иначе', 'ELSE'],
      ['ошибк*', 'IFERROR'], ['ничего', 'BLANK'],
      ['сколько', 'QUESTION'],
      ['столбец', 'COLUMN'], ['столбц*', 'COLUMN'], ['колонк*', 'COLUMN'], ['строк*', 'ROW'], ['ячейк*', 'CELL'], ['ячее*', 'CELL'], ['лист*', 'SHEET'], ['весь', 'ALL'], ['вся', 'ALL'], ['всего', 'ALL'], ['целиком', 'ALL'], ['полностью', 'ALL'],
      ['запиши', 'WRITE'], ['записать', 'WRITE'], ['запис*', 'WRITE'], ['вставь', 'WRITE'], ['вставить', 'WRITE'], ['помести*', 'WRITE'], ['поместить', 'WRITE'], ['выведи', 'WRITE'], ['вывести', 'WRITE'], ['поставь', 'WRITE'], ['поставить', 'WRITE'], ['заполни*', 'WRITE'], ['внеси', 'WRITE'], ['внести', 'WRITE'],
      ['от', 'FROM'], ['из', 'FROM'], ['до', 'TO'], ['по', 'BY'], ['в', 'IN'], ['во', 'IN'], ['на', 'IN'], ['с', 'WITH'], ['со', 'WITH'],
      ['перв*', 'FIRST'], ['начал*', 'FIRST'], ['последн*', 'LAST'], ['процент*', 'PERCENT'], ['кажд*', 'EACH_ROW']
    ],
    en: [
      [['greater', 'than', 'or', 'equal*'], 'GTE'], [['more', 'than', 'or', 'equal*'], 'GTE'], [['at', 'least'], 'GTE'], [['or', 'more'], '!GTE'], [['or', 'higher'], '!GTE'], [['or', 'above'], '!GTE'], [['and', 'above'], '!GTE'], [['and', 'up'], '!GTE'], [['no', 'less', 'than'], 'GTE'], [['not', 'less', 'than'], 'GTE'], [['or', 'greater'], 'GTE'],
      [['less', 'than', 'or', 'equal*'], 'LTE'], [['at', 'most'], 'LTE'], [['or', 'less'], '!LTE'], [['or', 'lower'], '!LTE'], [['or', 'below'], '!LTE'], [['and', 'below'], '!LTE'], [['no', 'more', 'than'], 'LTE'], [['not', 'more', 'than'], 'LTE'], [['up', 'to'], 'LTE'], [['or', 'fewer'], 'LTE'],
      [['not', 'equal*'], 'NEQ'], [['is', 'not'], 'NEQ'], [['does', 'not', 'equal*'], 'NEQ'], [['different', 'from'], 'NEQ'], [['other', 'than'], 'NEQ'], [['isn\'t'], 'NEQ'], [['are', 'not'], 'NEQ'],
      [['not', 'blank'], 'NOT_EMPTY'], [['not', 'empty'], 'NOT_EMPTY'], [['non', 'blank'], 'NOT_EMPTY'], [['non', 'empty'], 'NOT_EMPTY'], [['non-blank'], 'NOT_EMPTY'], [['non-empty'], 'NOT_EMPTY'],
      [['leave', 'blank'], 'BLANK'], [['leave', 'empty'], 'BLANK'], [['leave', 'it', 'blank'], 'BLANK'], [['leave', 'it', 'empty'], 'BLANK'], [['empty', 'string'], 'BLANK'], [['show', 'nothing'], 'BLANK'],
      [['starts', 'with'], 'STARTS_WITH'], [['starting', 'with'], 'STARTS_WITH'], [['begins', 'with'], 'STARTS_WITH'], [['beginning', 'with'], 'STARTS_WITH'], [['ends', 'with'], 'ENDS_WITH'], [['ending', 'with'], 'ENDS_WITH'],
      [['equal', 'to'], 'EQ'], [['equals', 'to'], 'EQ'], [['same', 'as'], 'EQ'], [['in', 'case', 'of', 'error'], 'IFERROR'], [['if', 'error'], 'IFERROR'], [['on', 'error'], 'IFERROR'], [['if', 'there', 'is', 'an', 'error'], 'IFERROR'],
      [['for', 'each', 'row'], 'EACH_ROW'], [['each', 'row'], 'EACH_ROW'], [['every', 'row'], 'EACH_ROW'], [['per', 'row'], 'EACH_ROW'], [['row', 'by', 'row'], 'EACH_ROW'],
      [['case', 'sensitive'], 'CASE_SENSITIVE'], [['case-sensitive'], 'CASE_SENSITIVE'], [['match', 'case'], 'CASE_SENSITIVE'],
      [['how', 'many', 'unique'], ['QUESTION', 'COUNT_UNIQUE']], [['how', 'many', 'different'], ['QUESTION', 'COUNT_UNIQUE']], [['how', 'many', 'distinct'], ['QUESTION', 'COUNT_UNIQUE']], [['distinct', 'values'], 'COUNT_UNIQUE'], [['unique', 'values'], 'COUNT_UNIQUE'], [['how', 'many'], 'QUESTION'], [['how', 'much'], 'QUESTION'], [['if', 'not'], 'ELSE'], [['entire', 'column'], 'WHOLE_COLUMN'], [['whole', 'column'], 'WHOLE_COLUMN'], [['in', 'the', 'range'], 'BETWEEN'],
      ['greater', 'GT'], ['more', 'GT'], ['over', 'GT'], ['above', 'GT'], ['exceed*', 'GT'], ['bigger', 'GT'], ['larger', 'GT'], ['higher', 'GT'],
      ['less', 'LT'], ['under', 'LT'], ['below', 'LT'], ['smaller', 'LT'], ['lower', 'LT'], ['fewer', 'LT'],
      ['equal*', 'EQ'], ['is', 'EQ'], ['are', 'EQ'], ['matches', 'EQ'], ['except*', 'NEQ'], ['excluding', 'NEQ'],
      ['contain*', 'CONTAINS'], ['includ*', 'CONTAINS'],
      ['blank', ['EMPTY', 'BLANK']], ['empty', ['EMPTY', 'BLANK']], ['filled', 'NOT_EMPTY'], ['nonblank', 'NOT_EMPTY'], ['nonempty', 'NOT_EMPTY'],
      ['between', 'BETWEEN'],
      ['and', 'AND'], ['also', 'AND'], ['or', 'OR'], ['either', 'OR'],
      ['if', 'IF'], ['when', 'IF'], ['whenever', 'IF'], ['then', 'THEN'], ['else', 'ELSE'], ['otherwise', 'ELSE'],
      ['error*', 'IFERROR'], ['nothing', 'BLANK'],
      ['column*', 'COLUMN'], ['col', 'COLUMN'], ['cols', 'COLUMN'], ['row*', 'ROW'], ['cell*', 'CELL'], ['sheet*', 'SHEET'], ['worksheet*', 'SHEET'], ['tab', 'SHEET'], ['entire', 'ALL'], ['whole', 'ALL'], ['all', 'ALL'],
      ['write', 'WRITE'], ['put', 'WRITE'], ['fill', 'WRITE'], ['insert', 'WRITE'], ['place', 'WRITE'], ['output', 'WRITE'], ['store', 'WRITE'],
      ['from', 'FROM'], ['to', 'TO'], ['into', 'TO'], ['through', 'TO'], ['until', 'TO'], ['in', 'IN'], ['with', 'WITH'], ['first', 'FIRST'], ['last', 'LAST'], ['percent*', 'PERCENT'], ['pct', 'PERCENT'], ['each', 'EACH_ROW'], ['every', 'EACH_ROW']
    ]
  };
  var PUNCT_CONCEPTS = { '>': 'GT', '<': 'LT', '>=': 'GTE', '≥': 'GTE', '<=': 'LTE', '≤': 'LTE', '=': 'EQ', '==': 'EQ', '<>': 'NEQ', '!=': 'NEQ', '≠': 'NEQ' };

  var _ownIndex = {};
  function ownIndex(lang) {
    if (_ownIndex[lang]) return _ownIndex[lang];
    var src = OWN[lang] || OWN.en, singles = [], phrases = [];
    for (var i = 0; i < src.length; i++) {
      var key = src[i][0], concepts = Array.isArray(src[i][1]) ? src[i][1] : [src[i][1]];
      var noValueAfter = concepts.some(function (cn) { return cn[0] === '!'; });
      concepts = concepts.map(function (cn) { return cn.replace(/^!/, ''); });
      if (Array.isArray(key)) phrases.push({ words: key.map(parseStem), concepts: concepts, noValueAfter: noValueAfter });
      else singles.push({ stem: parseStem(key), concepts: concepts });
    }
    phrases.sort(function (a, b) { return b.words.length - a.words.length; });
    return (_ownIndex[lang] = { singles: singles, phrases: phrases });
  }
  function parseStem(s) {
    var prefix = /\*$/.test(s);
    var t = prefix ? s.slice(0, -1) : s;
    return { text: fold(t), prefix: prefix };
  }
  function stemMatches(st, wordFolded) {
    if (st.prefix) return wordFolded.indexOf(st.text) === 0 && wordFolded.length - st.text.length <= 8;
    return wordFolded === st.text;
  }
  function ownLookup(norm, lang) {
    var idx = ownIndex(lang), f = fold(norm), out = [];
    for (var i = 0; i < idx.singles.length; i++) {
      if (stemMatches(idx.singles[i].stem, f)) {
        var cs = idx.singles[i].concepts;
        for (var c = 0; c < cs.length; c++) out.push({ concept: cs[c], weight: idx.singles[i].stem.prefix && f !== idx.singles[i].stem.text ? 0.9 : 1 });
      }
    }
    return out;
  }

  /* ------------------------------------------------------------------ concept helpers */
  var COMPARATORS = { GT: '>', GTE: '>=', LT: '<', LTE: '<=', EQ: '=', NEQ: '<>', CONTAINS: 'contains', STARTS_WITH: 'startsWith', ENDS_WITH: 'endsWith', EMPTY: 'empty', NOT_EMPTY: 'notEmpty', BETWEEN: 'between' };
  var NO_VALUE_OPS = { EMPTY: 1, NOT_EMPTY: 1 };
  var MARKERS = { IF: 1, THEN: 1, ELSE: 1, OTHERWISE: 1 };
  var CONJ = { AND: 'AND', OR: 'OR' };
  var AGG_AMBIGUOUS = { SUM: 1, TOTAL: 1, AMOUNT: 1, COUNT: 1, COUNT_NONEMPTY: 1, COUNT_EMPTY: 1, AVERAGE: 1, MAX: 1, MIN: 1, PRODUCT: 1, MULTIPLY: 1, SUBTOTAL: 1, COUNT_UNIQUE: 1, RANK: 1 };
  var HEADER_STOP = { 'sutun': 1, 'sütun': 1, 'kolon': 1, 'satir': 1, 'hucre': 1, 'sayfa': 1, 'deger': 1, 'toplam': 1, 'столбец': 1, 'столбца': 1, 'столбцу': 1, 'столбце': 1, 'колонка': 1, 'колонке': 1, 'колонку': 1, 'строка': 1, 'ячейка': 1, 'лист': 1, 'значение': 1, 'итог': 1, 'column': 1, 'col': 1, 'row': 1, 'cell': 1, 'sheet': 1, 'value': 1, 'total': 1, 'sum': 1 };

  function hasConcept(tok, id) {
    if (!tok || !tok.concepts) return false;
    for (var i = 0; i < tok.concepts.length; i++) if (tok.concepts[i].concept === id) return true;
    return false;
  }
  function hasAnyConcept(tok, map) {
    if (!tok || !tok.concepts) return false;
    for (var i = 0; i < tok.concepts.length; i++) if (map[tok.concepts[i].concept]) return true;
    return false;
  }
  function mergeConcepts(target, list) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (!c || typeof c.concept !== 'string') continue;
      var found = false;
      for (var j = 0; j < target.length; j++) if (target[j].concept === c.concept) { found = true; if ((c.weight || 0) > (target[j].weight || 0)) target[j].weight = c.weight; break; }
      if (!found) target.push({ concept: c.concept, weight: typeof c.weight === 'number' ? c.weight : 1 });
    }
    return target;
  }
  function lexLookup(norm, lang) {
    var l = L(), out = [];
    if (l && typeof l.lookup === 'function') {
      var r = safe(function () { return l.lookup(norm, lang); }, null);
      if (Array.isArray(r)) mergeConcepts(out, r);
    }
    mergeConcepts(out, ownLookup(norm, lang));
    return out;
  }
  function removeConcept(tok, id) {
    if (!tok.concepts) return;
    tok.concepts = tok.concepts.filter(function (c) { return c.concept !== id; });
  }

  /* explicit Excel function names typed by the user */
  var FUNC_STOP = {
    tr: ['topla', 'ortalama', 'mak', 'min', 'eğer', 'eger', 've', 'veya', 'yada', 'değil', 'degil', 'sol', 'sağ', 'sag', 'bul', 'ara', 'gün', 'gun', 'ay', 'yıl', 'yil', 'saat', 'dakika', 'saniye', 'bugün', 'bugun', 'şimdi', 'simdi', 'tarih', 'zaman', 'satır', 'satir', 'sütun', 'sutun', 'hücre', 'hucre', 'bilgi', 'tür', 'tur', 'al', 'bırak', 'birak', 'sırala', 'sirala', 'filtre', 'benzersiz', 'sıralı', 'sirali', 'mod', 'var', 'büyük', 'buyuk', 'küçük', 'kucuk', 'kırp', 'kirp', 'temiz', 'yinele', 'eleman', 'doğru', 'dogru', 'yanlış', 'yanlis', 'işaret', 'isaret', 'kuvvet', 'karekök', 'karekok', 'mutlak', 'tamsayı', 'tamsayi', 'uzunluk', 'çarpım', 'carpim', 'ortanca', 'alan', 'adres', 'dolaylı', 'dolayli', 'kaydır', 'kaydir', 'metin', 'sayı', 'sayi', 'değiştir', 'degistir', 'birleştir', 'birlestir', 'yuvarla', 'indis', 'kaçıncı', 'kacinci', 'toplama', 'alttoplam', 'günsay', 'gunsay', 'ne', 'ya', 'rank', 'devrik', 'say', 'seç', 'sec', 'ozdeş', 'özdeş', 'ozdes', 'yıl', 'gün', 'saniye', 'sayfa', 'satırsay', 'sütunsay', 'kod', 'damga', 'tavan', 'taban', 'hücre', 'tek', 'çift', 'cift', 'pi', 'bugün', 'bilgi', 'etkin', 'toplam', 'bağ_değ_say', 'sapma', 'karesi', 'sıklık', 'siklik', 'yüzde', 'yuzde', 'göster', 'yerine', 'uzun', 'kısa', 'kisa'],
    ru: ['сумм', 'сумма', 'и', 'или', 'не', 'если', 'день', 'месяц', 'год', 'дата', 'время', 'час', 'минуты', 'секунды', 'сегодня', 'строка', 'столбец', 'выбор', 'просмотр', 'текст', 'значен', 'найти', 'поиск', 'заменить', 'подставить', 'сцепить', 'сцеп', 'повтор', 'адрес', 'ранг', 'медиана', 'корень', 'степень', 'целое', 'остат', 'знак', 'пи', 'тип', 'ячейка', 'уник', 'фильтр', 'сорт', 'дни', 'символ', 'макс', 'мин', 'счёт', 'счет', 'произвед', 'замена', 'объединить', 'истина', 'ложь', 'число', 'код', 'выбор', 'смещ', 'плт', 'бс', 'пс', 'чпс', 'всд', 'апл', 'ч', 'т', 'нод', 'нок', 'факт', 'лист', 'листы', 'строк', 'чистрабдни', 'рабдень', 'округл', 'совпад', 'длстр', 'пропнач', 'прописн', 'строчн', 'тдата', 'ошибка', 'ячейки', 'формула', 'площадь', 'вероятность', 'нормализация', 'перестановка', 'процент', 'дельта', 'база', 'диапазон', 'ссылка', 'двссыл', 'цена', 'доход', 'ставка', 'номинал', 'период', 'скидка', 'длит', 'индекс', 'транспонировать'],
    en: ['sum', 'if', 'and', 'or', 'not', 'left', 'right', 'mid', 'len', 'trim', 'upper', 'lower', 'proper', 'today', 'now', 'day', 'month', 'year', 'date', 'time', 'hour', 'minute', 'second', 'find', 'search', 'replace', 'text', 'value', 'row', 'column', 'rows', 'columns', 'choose', 'index', 'match', 'lookup', 'offset', 'rank', 'large', 'small', 'median', 'product', 'unique', 'filter', 'sort', 'sequence', 'abs', 'int', 'mod', 'power', 'sqrt', 'sign', 'round', 'max', 'min', 'count', 'average', 'type', 'cell', 'info', 'n', 't', 'char', 'code', 'exact', 'clean', 'rept', 'days', 'fixed', 'dollar', 'areas', 'address', 'indirect', 'true', 'false', 'even', 'odd', 'pi', 'rand', 'floor', 'ceiling', 'trunc', 'log', 'exp', 'ln', 'subtotal', 'aggregate', 'let', 'lambda', 'take', 'drop', 'switch', 'ifs', 'mode', 'var', 'area', 'base', 'delta', 'weekday', 'weeknum', 'workday', 'convert', 'combin', 'fact', 'decimal', 'single', 'image', 'formula', 'call', 'price', 'yield', 'rate', 'effect', 'nominal', 'duration', 'received', 'intercept', 'slope', 'forecast', 'trend', 'growth', 'frequency', 'quartile', 'percentile', 'phonetic', 'expand', 'wrap', 'stock', 'bin', 'hex', 'oct', 'dec', 'cube', 'field', 'disc', 'cumulative', 'standardize', 'correl', 'cov', 'dev', 'percent', 'rank', 'random', 'repeat', 'join', 'split', 'map', 'reduce', 'scan', 'sorted', 'sortby', 'return', 'transpose', 'tab', 'sheet', 'sheets', 'ids', 'na', 'isref', 'error', 'type', 'number', 'numbers', 'and', 'display', 'none', 'nothing', 'name', 'names', 'total', 'web', 'service', 'encode', 'url', 'xml', 'filter', 'choose', 'col', 'cols', 'hlookup']
  };
  var COMPOUND_FUNC_RE = /^(eger|cok|etopla|dusey|yatay|capraz|bag_|если|сумм|счёт|счет|срзнач|максесли|минесли|впр|гпр|просмотр|sumif|countif|averageif|maxif|minif|xlookup|vlookup|hlookup|iferror|ifna|textjoin|datedif)|(say|topla|ifs|мн|если|ошибка|join)$/;
  var _funcStop = {};
  function funcStop(lang) {
    if (_funcStop[lang]) return _funcStop[lang];
    var m = {}, list = FUNC_STOP[lang] || [];
    for (var i = 0; i < list.length; i++) m[fold(list[i])] = 1;
    // every language's stoplist applies to lowercase tokens (users mix languages)
    if (lang !== 'en') for (var e = 0; e < FUNC_STOP.en.length; e++) m[fold(FUNC_STOP.en[e])] = 1;
    return (_funcStop[lang] = m);
  }
  function resolveFunction(raw, lang, adjacentColumnWord) {
    var c = C();
    if (!c || typeof c.byName !== 'function') return null;
    var base = raw.replace(/[’'][\p{L}]{1,7}$/u, '');
    if (!/^[\p{L}][\p{L}\p{N}_.]*$/u.test(base) || base.length < 2) return null;
    var letters = base.replace(/[^\p{L}]/gu, '');
    var isUpper = letters.length >= 2 && letters === letters.toUpperCase() && letters !== letters.toLowerCase();
    var hasSep = /[._]/.test(base);
    var f = fold(base);
    if (isUpper) {
      if (/^[A-Z]{1,3}$/.test(base) && (adjacentColumnWord || base.length < 3)) return null; // a column letter, not SUM
      if (base.length < 3 && !hasSep) return null;
    } else if (!hasSep) {
      if (f.length < 5) return null;
      if (funcStop(lang)[f]) return null;
      if (lexLookup(base, lang).length && !COMPOUND_FUNC_RE.test(f)) return null; // an ordinary word of the language
    }
    var entry = safe(function () { return c.byName(base); }, null);
    if (!entry || !entry.name) return null;
    if (!isUpper && !hasSep && funcStop(lang)[fold(entry.name)] && f.length < 6) return null;
    return String(entry.name).toUpperCase();
  }

  /* ------------------------------------------------------------------ token classification */
  function classifyTokens(tokens, text, lang) {
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      t.index = i;
      t.concepts = [];
      t.consumed = false;
      t.value = undefined;
      var base = t.base || t.raw;
      t.norm = lower(base, lang);
      t.stem = t.norm;
      t.type = 'word';
      if (t._str !== undefined || /^["«“„‘'’].*["»”“’']$/.test(t.raw) && t.raw.length >= 2 && !t.suffix && !/^['’][\p{L}]+$/u.test(t.raw) && (t.raw[0] !== '\'' || t.raw.length > 2)) {
        t.type = 'string';
        t.value = t._str !== undefined ? t._str : t.raw.slice(1, -1);
        t.norm = lower(t.value, lang);
        continue;
      }
      if (t._punct || /^[^\p{L}\p{N}$]+$/u.test(base)) {
        t.type = 'punct';
        if (PUNCT_CONCEPTS[base]) t.concepts.push({ concept: PUNCT_CONCEPTS[base], weight: 1 });
        continue;
      }
      var m;
      if (t._ref || RE_SHEET_REF.test(base) || /^(\$?[A-Za-z]{1,3}\$?\d+(?::\$?[A-Za-z]{1,3}\$?\d+)?|\$?[A-Za-z]{1,3}:\$?[A-Za-z]{1,3})$/.test(base) && !(/^[a-z]{1,3}$/.test(base))) {
        if (/^\$?[A-Za-z]{1,3}:\$?[A-Za-z]{1,3}$/.test(base) && base !== base.toUpperCase() && !t._ref) { /* e.g. "ab:cd" is probably a word */ }
        else { t.type = 'ref'; t.value = base; continue; }
      }
      if (/^\d+:\d+$/.test(base) && t._ref) { t.type = 'ref'; t.value = base; continue; }
      m = /^%\s?(\d+(?:[.,]\d+)?)$/.exec(base) || /^(-?\d[\d.,]*)%$/.exec(base);
      if (m || t._pct) {
        var pv = parseNumber(m ? m[1] : (t._num || base), lang);
        if (pv !== null) { t.type = 'percent'; t.value = pv; t.isPercent = true; continue; }
      }
      if (t._ord !== undefined || RE_ORDINAL.test(base) || /^\d+\.$/.test(base)) {
        var isLast = i === tokens.length - 1 || tokens[i + 1].type === 'punct' && /^[.!?]$/.test(tokens[i + 1].raw);
        var od = t._ord !== undefined ? t._ord : parseInt(base, 10);
        if (/^\d+\.$/.test(base) && isLast) { t.type = 'number'; t.value = od; continue; }
        t.type = 'ordinal'; t.value = od; continue;
      }
      if (/^-?\d[\d.,]*$/.test(base)) {
        var nv = parseNumber(t._num || base, lang);
        if (nv !== null) { t.type = 'number'; t.value = nv; continue; }
      }
      // word
      t.stem = stem(t.norm, lang);
      t.concepts = lexLookup(t.norm, lang);
      // Turkish conditional suffix on a comparator: büyükse → GT + IF
      if (lang === 'tr') {
        var cm = /^(.+?)(?:y?s[ae])$/.exec(t.norm);
        if (cm && cm[1].length >= 3 && !hasConcept(t, 'ELSE')) {
          var baseConcepts = lexLookup(cm[1], lang), addIf = false;
          for (var b = 0; b < baseConcepts.length; b++) {
            if (COMPARATORS[baseConcepts[b].concept]) { addIf = true; mergeConcepts(t.concepts, [baseConcepts[b]]); }
          }
          if (addIf) mergeConcepts(t.concepts, [{ concept: 'IF', weight: 1 }]);
        }
      }
      if (hasConcept(t, 'ELSE')) { removeConcept(t, 'IF'); removeConcept(t, 'EQ'); removeConcept(t, 'NOT'); removeConcept(t, 'THEN'); }
      var nw = numberWord(t.norm, lang);
      if (nw !== null) t.numberWord = nw;
      var ow = ordinalWord(t.norm, lang);
      if (ow !== null && nw === null && !hasConcept(t, 'FIRST') && !hasConcept(t, 'LAST')) t.ordinalWord = ow;
    }
    // explicit functions (after classification so that neighbours are known)
    for (var k = 0; k < tokens.length; k++) {
      var tk = tokens[k];
      if (tk.type !== 'word') continue;
      var adj = (k > 0 && hasConcept(tokens[k - 1], 'COLUMN')) || (k + 1 < tokens.length && hasConcept(tokens[k + 1], 'COLUMN'));
      var fn = resolveFunction(tk.base || tk.raw, lang, adj);
      if (fn) { tk.type = 'function'; tk.value = fn; }
    }
  }

  /* ------------------------------------------------------------------ phrases */
  function applyPhrases(tokens, lang, concepts) {
    var spans = [];
    var l = L();
    if (l && typeof l.matchPhrases === 'function') {
      var r = safe(function () { return l.matchPhrases(tokens, lang); }, null);
      if (Array.isArray(r)) for (var i = 0; i < r.length; i++) {
        var p = r[i];
        if (!p || typeof p.concept !== 'string' || typeof p.start !== 'number' || typeof p.end !== 'number') continue;
        if (p.start < 0 || p.end > tokens.length || p.end <= p.start) continue;
        spans.push({ concept: p.concept, weight: typeof p.weight === 'number' ? p.weight : 1, start: p.start, end: p.end });
      }
    }
    // built-in phrases
    var idx = ownIndex(lang);
    for (var s = 0; s < tokens.length; s++) {
      if (tokens[s].type !== 'word' && tokens[s].type !== 'function') continue;
      for (var p2 = 0; p2 < idx.phrases.length; p2++) {
        var ph = idx.phrases[p2], ok = true, e = s;
        for (var w = 0; w < ph.words.length; w++, e++) {
          var tk = tokens[e];
          if (!tk || (tk.type !== 'word' && tk.type !== 'function') || !stemMatches(ph.words[w], fold(tk.norm))) { ok = false; break; }
        }
        if (!ok) continue;
        if (ph.noValueAfter) { var nt = tokens[e]; if (nt && (nt.type === 'number' || nt.type === 'percent' || nt.type === 'string' || nt.type === 'word' && nt.numberWord !== undefined)) continue; }
        var overl = false;
        for (var o = 0; o < spans.length; o++) if (spans[o].start < e && s < spans[o].end) { overl = spans[o].end - spans[o].start >= e - s; if (overl) break; else { spans.splice(o, 1); o--; } }
        if (overl) continue;
        for (var c = 0; c < ph.concepts.length; c++) spans.push({ concept: ph.concepts[c], weight: 1, start: s, end: e });
        break;
      }
    }
    spans.sort(function (a, b) { return a.start - b.start || b.end - a.end; });
    var used = [];
    for (var q = 0; q < spans.length; q++) {
      var sp = spans[q], clash = false;
      for (var u = 0; u < used.length; u++) if (used[u].start < sp.end && sp.start < used[u].end && !(used[u].start === sp.start && used[u].end === sp.end)) { clash = true; break; }
      if (clash) continue;
      used.push(sp);
    }
    // phrase concepts override single-token concepts inside their span
    for (var z = 0; z < used.length; z++) {
      var ps = used[z];
      for (var t = ps.start; t < ps.end; t++) { if (!tokens[t].phraseCleared) { tokens[t].concepts = []; tokens[t].phraseCleared = true; } }
    }
    rangeWordPatterns(tokens, lang);
    for (var z2 = 0; z2 < used.length; z2++) {
      var ps2 = used[z2];
      mergeConcepts(tokens[ps2.start].concepts, [{ concept: ps2.concept, weight: ps2.weight }]);
      if (ps2.concept === 'WHOLE_COLUMN') { mergeConcepts(tokens[ps2.end - 1].concepts, [{ concept: 'COLUMN', weight: 1 }]); mergeConcepts(tokens[ps2.start].concepts, [{ concept: 'ALL', weight: 1 }]); }
      tokens[ps2.start].phraseEnd = Math.max(tokens[ps2.start].phraseEnd || 0, ps2.end);
      concepts.push({ concept: ps2.concept, weight: ps2.weight, tokenIndex: ps2.start, tokenEnd: ps2.end, start: tokens[ps2.start].start, end: tokens[ps2.end - 1].end, phrase: true });
    }
  }

  function isValueTok(t) { return !!t && (t.type === 'number' || t.type === 'percent' || t.type === 'word' && t.numberWord !== undefined); }
  function rangeWordPatterns(tokens, lang) {
    var fromW = lang === 'ru' ? /^(от|со?)$/ : lang === 'en' ? /^from$/ : null;
    var toW = lang === 'ru' ? /^(до|по)$/ : lang === 'en' ? /^(to|until|through)$/ : null;
    if (!fromW) return;
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (t.type !== 'word' || t.phraseCleared && !t.concepts.length) continue;
      if (fromW.test(t.norm) && isValueTok(tokens[i + 1])) {
        var j = i + 2, toIdx = -1;
        while (tokens[j] && j <= i + 4) { if (tokens[j].type === 'word' && toW.test(tokens[j].norm) && isValueTok(tokens[j + 1])) { toIdx = j; break; } if (tokens[j].type !== 'punct' && !(tokens[j].type === 'word' && tokens[j].numberWord !== undefined)) break; j++; }
        if (toIdx >= 0) { mergeConcepts(t.concepts, [{ concept: 'BETWEEN', weight: 1 }]); tokens[toIdx].rangeTo = true; }
        else if (lang === 'ru' && t.norm === 'от') mergeConcepts(t.concepts, [{ concept: 'GTE', weight: 0.8 }]);
      } else if (toW.test(t.norm) && isValueTok(tokens[i + 1]) && lang === 'ru' && t.norm === 'до' && !t.rangeTo) {
        var hasFrom = false;
        for (var b = Math.max(0, i - 3); b < i; b++) if (tokens[b].type === 'word' && fromW.test(tokens[b].norm)) hasFrom = true;
        if (!hasFrom) mergeConcepts(t.concepts, [{ concept: 'LTE', weight: 0.8 }]);
      }
    }
  }

  /* ------------------------------------------------------------------ references */
  function colLetter(n) { return EFS.util && EFS.util.columnLetter ? EFS.util.columnLetter(n) : String.fromCharCode(64 + n); }
  function parseRefText(text) {
    var sheet = null, body = String(text || '');
    var m = /^(?:'([^']+)'|([^!]+))!(.+)$/.exec(body);
    if (m) { sheet = m[1] || m[2]; body = m[3]; }
    body = body.replace(/\$/g, '').toUpperCase();
    var r = { sheet: sheet, text: body, col: null, col2: null, row: null, row2: null, kind: 'cell' };
    var rm;
    if ((rm = /^([A-Z]{1,3})(\d+):([A-Z]{1,3})(\d+)$/.exec(body))) { r.col = rm[1]; r.row = +rm[2]; r.col2 = rm[3]; r.row2 = +rm[4]; r.kind = 'range'; }
    else if ((rm = /^([A-Z]{1,3})(\d+)$/.exec(body))) { r.col = rm[1]; r.col2 = rm[1]; r.row = +rm[2]; r.row2 = +rm[2]; r.kind = 'cell'; }
    else if ((rm = /^([A-Z]{1,3}):([A-Z]{1,3})$/.exec(body))) { r.col = rm[1]; r.col2 = rm[2]; r.kind = 'column'; }
    else if ((rm = /^(\d+):(\d+)$/.exec(body))) { r.row = +rm[1]; r.row2 = +rm[2]; r.kind = 'row'; }
    else return null;
    return r;
  }
  function makeRef(parsed, source, tokenIndex, tokenEnd, tokens) {
    var ref = {
      text: parsed.text, kind: parsed.kind, sheet: parsed.sheet || null,
      col: parsed.col, col2: parsed.col2, row: parsed.row, row2: parsed.row2,
      source: source, headerName: parsed.headerName || null, tokenIndex: tokenIndex, tokenEnd: tokenEnd,
      span: [tokens[tokenIndex].start, tokens[tokenEnd - 1].end], type: parsed.type || null, wholeColumn: !!parsed.wholeColumn,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 1, suffix: tokens[tokenEnd - 1].suffix || null, usedBy: null
    };
    return ref;
  }
  function fullText(ref) { return ref.sheet ? quoteSheet(ref.sheet) + '!' + ref.text : ref.text; }
  function quoteSheet(name) { return /[^\p{L}\p{N}_]/u.test(name) || /^\d/.test(name) ? '\'' + name.replace(/'/g, '\'\'') + '\'' : name; }

  function headerByCol(ctx, col) {
    if (!ctx || !Array.isArray(ctx.headers)) return null;
    for (var i = 0; i < ctx.headers.length; i++) if (ctx.headers[i] && String(ctx.headers[i].col).toUpperCase() === col) return ctx.headers[i];
    return null;
  }
  function typeOf(ctx, ref) {
    if (!ctx || !ref || !ref.col || ref.sheet && ref.sheet !== ctx.sheetName) {
      if (ctx && ref && ref.sheet && ctx.otherSheets && ctx.otherSheets[ref.sheet] && ref.col === ref.col2) {
        var oh = headerByCol(ctx.otherSheets[ref.sheet], ref.col); return oh ? oh.type || null : null;
      }
      return null;
    }
    if (ref.col !== ref.col2) return 'mixed';
    var h = headerByCol(ctx, ref.col);
    return h ? h.type || null : null;
  }

  var TR_DATIVE = { 'a': 1, 'e': 1, 'ya': 1, 'ye': 1, 'na': 1, 'ne': 1 };
  var TR_ABLATIVE = { 'dan': 1, 'den': 1, 'tan': 1, 'ten': 1, 'ndan': 1, 'nden': 1 };
  var SHEET_WORD_RE = /^(sayfa|лист|sheet|list)\s?\d+$/i;
  var COLUMN_WORD_RE = /^(sütun|sutun|kolon|столб|колон|column|col)/i;

  function resolveSheetName(name, ctx, exact) {
    if (!name) return null;
    var f = fold(name);
    if (ctx) {
      var names = [];
      if (Array.isArray(ctx.sheets)) names = names.concat(ctx.sheets);
      if (ctx.sheetName && names.indexOf(ctx.sheetName) < 0) names.push(ctx.sheetName);
      if (ctx.otherSheets) for (var k in ctx.otherSheets) if (names.indexOf(k) < 0) names.push(k);
      for (var i = 0; i < names.length; i++) {
        var fn = fold(names[i]);
        if (fn === f) return names[i];
      }
      if (exact) return null;
      for (var j = 0; j < names.length; j++) {
        var fj = fold(names[j]);
        if (fj.length >= 3 && (f.indexOf(fj) === 0 && f.length - fj.length <= 5 || fj.indexOf(f) === 0 && fj.length - f.length <= 2)) return names[j];
        if (similarity(fj, f) >= 0.85) return names[j];
      }
      return null;
    }
    return name;
  }

  function extractRefs(pq, tokens, ctx, text) {
    var lang = pq.lang, refs = [], i, t;
    var firstRow = ctx && ctx.firstDataRow ? +ctx.firstDataRow : null;
    var lastRow = ctx && ctx.lastRow ? +ctx.lastRow : null;

    // 1. sheet mentions
    var sheetMentions = [];
    for (i = 0; i < tokens.length; i++) {
      t = tokens[i];
      if (t.type !== 'word' || !hasConcept(t, 'SHEET')) continue;
      var cand = null, ci = -1;
      if (lang === 'tr') {
        // "Ürünler sayfasındaki": word before
        if (i > 0 && (tokens[i - 1].type === 'word' || tokens[i - 1].type === 'string') && !tokens[i - 1].concepts.length && !/^(bu|şu|o|aynı|diğer|başka|ayrı|yeni)$/.test(tokens[i - 1].norm)) { cand = tokens[i - 1].type === 'string' ? tokens[i - 1].value : tokens[i - 1].base; ci = i - 1; }
        if (!cand && i + 1 < tokens.length && tokens[i + 1].type === 'string') { cand = tokens[i + 1].value; ci = i + 1; }
      } else {
        // "на листе Товары" / "sheet Products": word after, else word before
        if (i + 1 < tokens.length && (tokens[i + 1].type === 'string' || tokens[i + 1].type === 'word' && !tokens[i + 1].concepts.length)) { cand = tokens[i + 1].type === 'string' ? tokens[i + 1].value : tokens[i + 1].base; ci = i + 1; }
        if (cand && ctx && !resolveSheetName(cand, ctx)) { cand = null; ci = -1; }
        if (!cand && i > 0 && (tokens[i - 1].type === 'word' && !tokens[i - 1].concepts.length || tokens[i - 1].type === 'string')) { cand = tokens[i - 1].type === 'string' ? tokens[i - 1].value : tokens[i - 1].base; ci = i - 1; }
      }
      if (!cand) continue;
      var resolved = resolveSheetName(cand, ctx);
      if (!resolved) { if (ctx) continue; resolved = cand; }
      sheetMentions.push({ name: resolved, tokenIndex: ci, markerIndex: i });
      tokens[ci].consumed = true; tokens[ci].sheetName = resolved; tokens[ci].usedBy = 'sheet';
    }
    // bare sheet names ("Sayfa2 A2:B50", "Ürünler!A:C" handled by ref parsing)
    for (i = 0; i < tokens.length; i++) {
      t = tokens[i];
      if (t.type !== 'word' || t.consumed || t.sheetName) continue;
      var looksSheet = SHEET_WORD_RE.test(t.base);
      var res = looksSheet ? (resolveSheetName(t.base, ctx) || t.base) : (ctx ? resolveSheetName(t.base, ctx, true) : null);
      if (!res) continue;
      if (!looksSheet) {
        // only accept a ctx sheet name when it precedes a ref or is followed/preceded by a sheet word (already handled)
        var nxt = tokens[i + 1];
        if (!(nxt && nxt.type === 'ref') && !(ctx && ctx.otherSheets && ctx.otherSheets[res])) continue;
        if (ctx && res === ctx.sheetName && !(nxt && nxt.type === 'ref')) continue;
      }
      sheetMentions.push({ name: res, tokenIndex: i, markerIndex: i });
      t.sheetName = res;
      if (looksSheet || (tokens[i + 1] && tokens[i + 1].type === 'ref')) t.consumed = true;
    }
    pq.sheets = sheetMentions;

    // 2. explicit refs
    for (i = 0; i < tokens.length; i++) {
      t = tokens[i];
      if (t.type !== 'ref') continue;
      var parsed = parseRefText(t.value);
      if (!parsed) { t.type = 'word'; continue; }
      if (parsed.sheet) parsed.sheet = resolveSheetName(parsed.sheet, ctx) || parsed.sheet;
      var ref = makeRef(parsed, 'explicit', i, i + 1, tokens);
      t.consumed = true;
      refs.push(ref);
    }
    // 3. column letters next to a column word ("A sütunu", "столбец B", "column C", "tüm A sütunu")
    for (i = 0; i < tokens.length; i++) {
      t = tokens[i];
      if (t.type !== 'word' || t.consumed || !/^[A-Z]{1,3}$/.test(t.base)) continue;
      var prevT = tokens[i - 1], nextT = tokens[i + 1];
      var colBefore = prevT && prevT.type === 'word' && hasConcept(prevT, 'COLUMN');
      var colAfter = nextT && nextT.type === 'word' && hasConcept(nextT, 'COLUMN');
      if (!colBefore && !colAfter) continue;
      var whole = false, j;
      for (j = Math.max(0, i - 3); j < i; j++) if (hasConcept(tokens[j], 'ALL') || hasConcept(tokens[j], 'WHOLE_COLUMN')) whole = true;
      if (colAfter && hasConcept(nextT, 'WHOLE_COLUMN')) whole = true;
      var colParsed;
      if (ctx && firstRow && lastRow && !whole) colParsed = { text: t.base + firstRow + ':' + t.base + lastRow, kind: 'range', col: t.base, col2: t.base, row: firstRow, row2: lastRow, sheet: null };
      else colParsed = { text: t.base + ':' + t.base, kind: 'column', col: t.base, col2: t.base, row: null, row2: null, sheet: null };
      colParsed.wholeColumn = whole;
      var start = i, end = i + 1;
      if (colAfter) end = i + 2;
      if (colBefore) start = i - 1;
      var cref = makeRef(colParsed, 'explicit', start, end, tokens);
      cref.letterOnly = true;
      cref.suffix = colAfter ? (nextT.suffix || null) : (t.suffix || null);
      cref.columnWord = colAfter ? nextT.norm : prevT.norm;
      cref.columnWordIndex = colAfter ? i + 1 : i - 1;
      cref.columnWordBefore = !!colBefore && !colAfter;
      cref.letterIndex = i;
      for (j = start; j < end; j++) tokens[j].consumed = true;
      refs.push(cref);
    }
    refs.sort(function (a, b) { return a.tokenIndex - b.tokenIndex; });

    // 4. ranges in words: "A1'den A10'a kadar", "от A1 до A10", "A1 ile A10 arası", "from A1 to A10", "A1 - A10"
    for (i = 0; i + 1 < refs.length; i++) {
      var a = refs[i], b = refs[i + 1];
      if (a.kind !== 'cell' || b.kind !== 'cell' || a.letterOnly || b.letterOnly) continue;
      if (a.sheet && b.sheet && a.sheet !== b.sheet) continue;
      var betweenToks = tokens.slice(a.tokenEnd, b.tokenIndex);
      var gapWords = betweenToks.filter(function (x) { return x.type !== 'punct'; });
      var joined = gapWords.map(function (x) { return x.norm; }).join(' ');
      var isRange = false;
      if (gapWords.length === 0 && betweenToks.length === 1 && /^[-–—:]$/.test(betweenToks[0].raw)) isRange = true;
      if (lang === 'tr') {
        var aFrom = a.suffix && TR_ABLATIVE[a.suffix], bTo = b.suffix && TR_DATIVE[b.suffix];
        if (aFrom && bTo && gapWords.length === 0) isRange = true;
        if (/^(ile|ve)$/.test(joined) && tokens[b.tokenEnd] && /^aras/.test(tokens[b.tokenEnd].norm)) isRange = true;
        if (joined === 'ile' && bTo) isRange = true;
      } else if (lang === 'ru') {
        var prevA = tokens[a.tokenIndex - 1];
        if (prevA && /^(от|с|со)$/.test(prevA.norm) && /^(до|по)$/.test(joined)) isRange = true;
        if (/^(до|по)$/.test(joined) && !(prevA && prevA.norm === 'между')) isRange = true;
        if (prevA && prevA.norm === 'между' && joined === 'и') isRange = true;
      } else {
        var prevE = tokens[a.tokenIndex - 1];
        if (/^(to|through|thru|until|till)$/.test(joined)) isRange = true;
        if (prevE && prevE.norm === 'between' && joined === 'and') isRange = true;
      }
      if (!isRange) continue;
      var merged = parseRefText((a.sheet ? quoteSheet(a.sheet) + '!' : '') + a.text + ':' + b.text);
      if (!merged) continue;
      if (!merged.sheet) merged.sheet = a.sheet || b.sheet || null;
      var mref = makeRef(merged, 'explicit', a.tokenIndex, b.tokenEnd, tokens);
      mref.suffix = null;
      for (var g = a.tokenIndex; g < b.tokenEnd; g++) tokens[g].consumed = true;
      // consume trailing "kadar"/"arası"
      var after = tokens[b.tokenEnd];
      if (after && lang === 'tr' && /^(kadar|aras)/.test(after.norm)) { after.consumed = true; mref.tokenEnd = b.tokenEnd + 1; mref.span[1] = after.end; }
      var before = tokens[a.tokenIndex - 1];
      if (before && (lang === 'ru' && /^(от|с|со|между)$/.test(before.norm) || lang === 'en' && /^(from|between)$/.test(before.norm))) { before.consumed = true; mref.tokenIndex = a.tokenIndex - 1; mref.span[0] = before.start; }
      refs.splice(i, 2, mref);
      i--;
    }

    // 5. attach sheet mentions to sheetless explicit refs that follow them
    for (var s = 0; s < sheetMentions.length; s++) {
      var sm = sheetMentions[s];
      var target = null;
      for (var r = 0; r < refs.length; r++) {
        if (refs[r].sheet || refs[r].letterOnly) continue;
        if (refs[r].tokenIndex >= sm.markerIndex && (!target || refs[r].tokenIndex < target.tokenIndex)) target = refs[r];
      }
      if (!target) for (var r2 = 0; r2 < refs.length; r2++) if (!refs[r2].sheet && !refs[r2].letterOnly && refs[r2].tokenIndex > sm.tokenIndex) { target = refs[r2]; break; }
      if (target) { target.sheet = sm.name; }
    }

    // 6. header refs
    if (ctx && Array.isArray(ctx.headers)) matchHeaders(pq, tokens, ctx, refs, text, sheetMentions);

    refs.sort(function (a, b) { return a.tokenIndex - b.tokenIndex; });
    for (var k = 0; k < refs.length; k++) {
      var rk = refs[k];
      if (rk.type === null) rk.type = typeOf(ctx, rk);
      rk.full = fullText(rk);
    }
    return refs;
  }

  /* ---- header matching */
  function headerWords(name) {
    return fold(String(name || '')).replace(/[’'`"«»“”]/g, '').split(/\s+/).filter(Boolean);
  }
  function stripVowelStem(w) {
    var s = w.replace(/[аеёиоуыэюяaeıioöuü]+$/u, '');
    return s.length >= 3 ? s : w;
  }
  var _maxSuffix = 7;
  function wordMatch(hw, ww) {
    if (hw === ww) return 1;
    var maxS = _maxSuffix;
    if (hw.length >= 2 && ww.indexOf(hw) === 0 && ww.length - hw.length <= maxS) return 0.95;
    var st = stripVowelStem(hw);
    if (st !== hw && ww.indexOf(st) === 0 && ww.length - st.length <= maxS) return 0.9;
    var soft = { t: 'd', k: 'g', p: 'b', c: 'c' };
    var lastCh = hw[hw.length - 1];
    if (soft[lastCh] && hw.length >= 3 && ww.indexOf(hw.slice(0, -1) + soft[lastCh]) === 0 && ww.length - hw.length <= maxS) return 0.9;
    var n = N();
    if (n && typeof n.startsWithStem === 'function' && hw.length >= 3 && safe(function () { return n.startsWithStem(ww, hw); }, false)) return 0.9;
    if (hw.length >= 4 && ww.length >= 4) { var sim = similarity(hw, ww); if (sim >= 0.8) return sim; }
    return 0;
  }
  function headerScore(hwords, wwords) {
    if (hwords.length !== wwords.length) return 0;
    var min = 1;
    for (var i = 0; i < hwords.length; i++) {
      var sc = wordMatch(hwords[i], wwords[i]);
      if (!sc) {
        // whole-string similarity fallback
        var simAll = similarity(hwords.join(' '), wwords.join(' '));
        return simAll >= 0.8 && hwords.join(' ').length >= 4 ? simAll * 0.9 : 0;
      }
      if (sc < min) min = sc;
    }
    return min;
  }
  function isAmbiguousHeader(name, lang) {
    var words = headerWords(name);
    if (words.length !== 1) return false;
    var cs = lexLookup(words[0], lang);
    for (var i = 0; i < cs.length; i++) if (AGG_AMBIGUOUS[cs[i].concept]) return true;
    return false;
  }
  function windowWords(tokens, s, e, text) {
    // text between first and last token, apostrophe suffix removed from the last word
    var last = tokens[e - 1];
    var endPos = last.suffix ? last.end - (last.raw.length - (last.base || last.raw).length) : last.end;
    var str = text.slice(tokens[s].start, endPos);
    return headerWords(str);
  }
  function matchHeaders(pq, tokens, ctx, refs, text, sheetMentions) {
    var lang = pq.lang;
    _maxSuffix = lang === 'tr' ? 7 : lang === 'ru' ? 4 : 3;
    var pools = [{ sheet: null, ctx: ctx }];
    for (var s = 0; s < sheetMentions.length; s++) {
      var nm = sheetMentions[s].name;
      if (ctx.otherSheets && ctx.otherSheets[nm] && Array.isArray(ctx.otherSheets[nm].headers)) {
        var dup = false; for (var d = 0; d < pools.length; d++) if (pools[d].sheet === nm) dup = true;
        if (!dup) pools.push({ sheet: nm, ctx: ctx.otherSheets[nm] });
      }
    }
    var cands = [];
    var maxWin = 4;
    for (var i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== 'word' || tokens[i].consumed) continue;
      for (var w = maxWin; w >= 1; w--) {
        var e = i + w;
        if (e > tokens.length) continue;
        var ok = true;
        for (var k = i; k < e; k++) {
          var tk = tokens[k];
          if (tk.consumed) { ok = false; break; }
          if (k > i && !(tk.type === 'word' || tk.type === 'punct' && tk.raw === '-' && tk.start === tokens[k - 1].end)) { ok = false; break; }
          if (k < e - 1 && tk.suffix) { ok = false; break; }
          if (tk.type === 'punct' && k === e - 1) { ok = false; break; }
        }
        if (!ok) continue;
        var ww = windowWords(tokens, i, e, text);
        if (!ww.length) continue;
        if (ww.length === 1 && HEADER_STOP[ww[0]]) continue;
        for (var p = 0; p < pools.length; p++) {
          var hs = pools[p].ctx.headers;
          for (var h = 0; h < hs.length; h++) {
            var hd = hs[h];
            if (!hd || !hd.name) continue;
            var hw = headerWords(hd.name);
            if (!hw.length) continue;
            var score = headerScore(hw, ww);
            if (score <= 0) continue;
            cands.push({ start: i, end: e, header: hd, sheet: pools[p].sheet, score: score, len: e - i, exact: hw.join(' ') === ww.join(' '), pool: p });
          }
        }
      }
    }
    cands.sort(function (a, b) { return b.len - a.len || b.score - a.score || a.pool - b.pool || a.start - b.start; });
    var chosen = [];
    for (var c = 0; c < cands.length; c++) {
      var cd = cands[c], clash = false;
      for (var u = 0; u < chosen.length; u++) if (chosen[u].start < cd.end && cd.start < chosen[u].end) {
        clash = true;
        if (chosen[u].start === cd.start && chosen[u].end === cd.end && chosen[u].header !== cd.header) { chosen[u].alternatives = chosen[u].alternatives || []; chosen[u].alternatives.push(cd); }
        break;
      }
      if (!clash) chosen.push(cd);
    }
    chosen.sort(function (a, b) { return a.start - b.start; });
    // decide ambiguous headers (aggregate words such as Сумма / Tutar) by column position
    function columnPosition(cd) {
      var prev = tokens[cd.start - 1], next = tokens[cd.end];
      if (prev && prev.type === 'word' && hasConcept(prev, 'COLUMN')) return 'strong';
      if (next && next.type === 'word' && hasConcept(next, 'COLUMN')) return 'strong';
      var lastTok = tokens[cd.end - 1];
      if (!cd.exact) return 'suffix';
      if (lastTok.suffix) return 'suffix';
      // condition position: "Tutar 100'den büyük", "Сумма больше 100", "Tutar büyükse"
      var look = 0, j = cd.end;
      while (tokens[j] && look < 4) {
        var tj = tokens[j];
        if (hasAnyConcept(tj, COMPARATORS)) return 'condition';
        if (tj.type === 'punct') { j++; continue; }
        if (!(tj.type === 'number' || tj.type === 'percent' || tj.type === 'string' || tj.type === 'word' && (tj.numberWord !== undefined || GLUE[tj.norm] || hasAnyConcept(tj, { WITH: 1, AND: 1, OR: 1 })))) break;
        j++; look++;
      }
      if (prev && hasAnyConcept(prev, COMPARATORS) && (lang === 'ru' || lang === 'en')) return 'condition';
      // aggregate position: "Tutar toplamı", "Tutar ortalaması", "Amount total"
      var nx2 = tokens[cd.end];
      if (nx2 && nx2.type === 'word' && hasAnyConcept(nx2, AGG_AMBIGUOUS) && fold(nx2.norm) !== fold(tokens[cd.start].norm) && !hasConcept(nx2, 'AMOUNT')) return 'aggregate';
      return null;
    }
    var kept = [];
    for (var z = 0; z < chosen.length; z++) {
      var ch = chosen[z];
      ch.ambiguous = isAmbiguousHeader(ch.header.name, lang);
      ch.position = columnPosition(ch);
      kept.push(ch);
    }
    var final = [];
    for (var f = 0; f < kept.length; f++) {
      var kc = kept[f];
      if (kc.ambiguous && !kc.position) {
        // adjacent (within 2 tokens, through a conjunction) to another header or explicit ref?
        var near = false;
        function gapOk(lo, hi) { // only punctuation / conjunctions between the two column mentions
          if (hi - lo > 2) return false;
          for (var g = lo; g < hi; g++) { var gt = tokens[g]; if (gt.type === 'punct') continue; if (!hasAnyConcept(gt, { AND: 1, OR: 1, WITH: 1 }) || hasConcept(gt, 'COLUMN')) return false; }
          return true;
        }
        for (var o = 0; o < kept.length && !near; o++) if (o !== f && !(kept[o].ambiguous && !kept[o].position) && (kept[o].start >= kc.end && gapOk(kc.end, kept[o].start) || kc.start >= kept[o].end && gapOk(kept[o].end, kc.start))) near = true;
        for (var r = 0; r < refs.length && !near; r++) if (refs[r].tokenIndex >= kc.end && gapOk(kc.end, refs[r].tokenIndex) || kc.start >= refs[r].tokenEnd && gapOk(refs[r].tokenEnd, kc.start)) near = true;
        if (!near) continue;
        kc.confidence = 0.7;
      } else if (kc.ambiguous && (kc.position === 'suffix' || kc.position === 'condition' || kc.position === 'aggregate')) kc.confidence = 0.7;
      else kc.confidence = kc.position === 'strong' ? 1 : Math.min(1, kc.score);
      final.push(kc);
    }
    // drop a weak duplicate of a header matched elsewhere with strong confidence
    var byHeader = {};
    for (var q = 0; q < final.length; q++) { var key = (final[q].sheet || '') + '|' + final[q].header.name; byHeader[key] = Math.max(byHeader[key] || 0, final[q].confidence); }
    final = final.filter(function (x) { var key = (x.sheet || '') + '|' + x.header.name; return !(x.ambiguous && x.confidence < byHeader[key]); });
    for (var m = 0; m < final.length; m++) {
      var fm = final[m], hd2 = fm.header;
      var parsed = parseRefText(hd2.dataRange || (hd2.col + (ctx.firstDataRow || 2) + ':' + hd2.col + (ctx.lastRow || 2)));
      if (!parsed) continue;
      parsed.sheet = fm.sheet;
      parsed.headerName = hd2.name;
      parsed.type = hd2.type || null;
      parsed.confidence = fm.confidence;
      var ref = makeRef(parsed, 'header', fm.start, fm.end, tokens);
      ref.headerIndex = typeof hd2.index === 'number' ? hd2.index : null;
      ref.headerCol = hd2.col;
      ref.score = fm.score;
      if (fm.alternatives) ref.alternatives = fm.alternatives.map(function (al) { return { sheet: al.sheet, headerName: al.header.name, text: al.header.dataRange || null, col: al.header.col, type: al.header.type || null }; });
      for (var t2 = fm.start; t2 < fm.end; t2++) { tokens[t2].consumed = true; tokens[t2].headerRef = ref; }
      // consume a following/preceding column word ("Tutar sütununu")
      var nx = tokens[fm.end], pv = tokens[fm.start - 1];
      if (nx && nx.type === 'word' && hasConcept(nx, 'COLUMN')) { nx.consumed = true; ref.columnWordIndex = fm.end; ref.columnSuffix = nx.suffix || null; ref.columnWord = nx.norm; }
      else if (pv && pv.type === 'word' && hasConcept(pv, 'COLUMN')) { ref.columnWordIndex = fm.start - 1; ref.columnWord = pv.norm; }
      refs.push(ref);
    }
  }

  /* ------------------------------------------------------------------ target ("F sütununa yaz", "в столбец F", "F2 hücresine") */
  function extractTarget(pq, tokens, refs, ctx) {
    var lang = pq.lang, firstRow = ctx && ctx.firstDataRow ? +ctx.firstDataRow : 2, lastRow = ctx && ctx.lastRow ? +ctx.lastRow : null;
    var hasWrite = pq.has('WRITE');
    var best = null;
    for (var i = 0; i < refs.length; i++) {
      var r = refs[i];
      if (r.source !== 'explicit') continue;
      var prev = tokens[r.tokenIndex - 1], next = tokens[r.tokenEnd], prev2 = tokens[r.tokenIndex - 2];
      var isTarget = false, strength = 0;
      if (lang === 'tr') {
        if (r.kind === 'cell' && r.suffix && TR_DATIVE[r.suffix]) { isTarget = true; strength = 2; }
        if (r.kind === 'cell' && next && next.type === 'word' && /^(hücre|hucre)/.test(next.norm) && /(sine|ye|ne|ya|na|e|a)$/.test(next.norm)) { isTarget = true; strength = 3; }
        if (r.letterOnly && r.suffix && TR_DATIVE[r.suffix] && !r.columnWordBefore) { isTarget = true; strength = 3; }
        if (r.letterOnly && r.columnWord && /^(sütun|sutun|kolon)/.test(r.columnWord) && /(sütununa|sutununa|sütuna|sutuna|kolonuna|kolona)$/.test(r.columnWord) && !r.columnWordBefore) { isTarget = true; strength = 3; }
      } else if (lang === 'ru') {
        // "в столбец F" (accusative) / "в ячейку F2" / "запиши в F2"
        var cw = r.letterOnly ? tokens[r.columnWordIndex] : null;
        var prepIdx = r.letterOnly && r.columnWordIndex < r.letterIndex ? r.columnWordIndex - 1 : r.tokenIndex - 1;
        var prep = tokens[prepIdx];
        var prepIsIn = prep && /^(в|во)$/.test(prep.norm);
        if (r.letterOnly && cw && /^(столбец|колонку|колонки|столбцы)$/.test(cw.norm) && (prepIsIn || hasWrite)) { isTarget = true; strength = 3; }
        if (r.letterOnly && cw && /^(столбце|колонке)$/.test(cw.norm) && hasWrite && prepIsIn) { isTarget = true; strength = 1; }
        if (r.kind === 'cell' && prev && /^(ячейку|ячейке)$/.test(prev.norm)) { isTarget = true; strength = 3; }
        if (r.kind === 'cell' && prepIsIn && hasWrite) { isTarget = true; strength = 2; }
        if (r.kind === 'cell' && prev && hasConcept(prev, 'WRITE')) { isTarget = true; strength = 2; }
      } else {
        var pw = prev && prev.norm, p2 = prev2 && prev2.norm;
        if (r.letterOnly) {
          var pre = tokens[(r.columnWordIndex < r.letterIndex ? r.columnWordIndex : r.tokenIndex) - 1];
          if (pre && /^(into|to)$/.test(pre.norm)) { isTarget = true; strength = 3; }
          else if (pre && pre.norm === 'in' && hasWrite) { isTarget = true; strength = 2; }
        } else if (r.kind === 'cell') {
          if (pw === 'into' || pw === 'to' && hasWrite || (pw === 'cell' && (p2 === 'in' || p2 === 'into' || p2 === 'to'))) { isTarget = true; strength = 2; }
          if (prev && hasConcept(prev, 'WRITE')) { isTarget = true; strength = 2; }
        }
      }
      if (isTarget && (!best || strength > best.strength)) best = { ref: r, strength: strength };
    }
    if (!best) return null;
    var ref = best.ref;
    refs.splice(refs.indexOf(ref), 1);
    ref.isTarget = true;
    var col = ref.col, target;
    if (ref.kind === 'cell') target = { col: col, cell: col + ref.row, row: ref.row, range: lastRow ? col + ref.row + ':' + col + lastRow : null, explicitCell: true, sheet: ref.sheet || null, ref: ref };
    else target = { col: col, cell: col + firstRow, row: firstRow, range: lastRow ? col + firstRow + ':' + col + lastRow : null, explicitCell: false, sheet: ref.sheet || null, ref: ref };
    return target;
  }

  /* ------------------------------------------------------------------ conditions */
  function valueFromToken(t, lang, refs) {
    if (!t || t.consumed && !t.headerRef && t.type !== 'ref') return null;
    if (t.type === 'number') return { kind: 'num', value: t.value, tokenIndex: t.index };
    if (t.type === 'percent') return { kind: 'num', value: t.value, isPercent: true, tokenIndex: t.index };
    if (t.type === 'string') return { kind: 'str', value: t.value, tokenIndex: t.index };
    if (t.type === 'ref' || t.headerRef) {
      var ref = t.headerRef || null;
      if (!ref) for (var i = 0; i < refs.length; i++) if (refs[i].tokenIndex <= t.index && t.index < refs[i].tokenEnd) ref = refs[i];
      if (ref) return { kind: 'ref', value: ref.full || fullText(ref), ref: ref, tokenIndex: t.index };
      return null;
    }
    if (t.type === 'word' && !t.consumed && t.numberWord !== undefined && !(ARTICLE_ONES[lang] && ARTICLE_ONES[lang][t.norm])) return { kind: 'num', value: t.numberWord, tokenIndex: t.index };
    if (t.type === 'word' && !t.consumed && !t.concepts.length && !t.sheetName) return { kind: 'str', value: t.base || t.raw, tokenIndex: t.index, word: true };
    return null;
  }
  var GLUE = { 'чем': 1, 'than': 1, 'to': 1, 'değeri': 1, 'değerini': 1, 'значения': 1, 'значение': 1, 'значению': 1, 'value': 1, 'the': 1, 'a': 1, 'an': 1, 'bir': 1, 'olanlar': 1, 'olan': 1, 'olanları': 1, 'olanların': 1, 'metni': 1, 'metnini': 1, 'kelimesi': 1, 'kelimesini': 1, 'yazısı': 1, 'ifadesi': 1, 'ifadesini': 1, 'слово': 1, 'слова': 1, 'текст': 1, 'текста': 1, 'word': 1, 'text': 1, 'string': 1 };
  function isBoundary(t) {
    if (!t) return true;
    if (t.type === 'punct') return /^[.;!?]$/.test(t.raw);
    if (hasAnyConcept(t, COMPARATORS)) return true;
    if (hasConcept(t, 'AND') || hasConcept(t, 'OR') || hasAnyConcept(t, MARKERS)) return true;
    return false;
  }
  function scanValue(tokens, from, dir, lang, refs, allowRefLeft, limit, skipConj) {
    var steps = 0, j = from;
    while (steps < (limit || 4)) {
      j += dir; steps++;
      var t = tokens[j];
      if (!t) return null;
      if (t.type === 'punct') { if (/^[.;!?]$/.test(t.raw)) return null; steps--; continue; }
      if (skipConj && t.type === 'word' && (hasConcept(t, 'AND') || hasConcept(t, 'WITH') || hasConcept(t, 'TO') || hasConcept(t, 'FROM'))) continue;
      if (t.type === 'word' && (GLUE[t.norm] || hasConcept(t, 'EQ') && t.norm !== 'ise' && (t.phraseEnd || 0) <= j + 1 && t.concepts.length === 1)) { continue; }
      if (t.type === 'word' && t.concepts.length === 1 && t.concepts[0].concept === 'EQ' && j !== from + dir) continue;
      if (isBoundary(t) && !(t.type === 'ref' || t.headerRef)) return null;
      if (t.type === 'ref' || t.headerRef) {
        if (dir < 0 && !(allowRefLeft && j === from - 1 && t.suffix && TR_ABLATIVE[t.suffix])) return null;
        var v = valueFromToken(t, lang, refs);
        return v || null;
      }
      var val = valueFromToken(t, lang, refs);
      if (val) return val;
      if (t.type === 'word' && t.concepts.length && !hasAnyConcept(t, { COLUMN: 1, CELL: 1, ROW: 1, VALUE: 1, IN: 1, WITH: 1, BY: 1, FOR: 1, TO: 1, FROM: 1, PERCENT: 1 })) return null;
    }
    return null;
  }
  function refForCondition(tokens, refs, pos, lang, valueTokenIdx, conditions) {
    var prevRef = null, nextRef = null, i;
    for (i = 0; i < refs.length; i++) {
      var r = refs[i];
      if (r.tokenEnd <= pos && r.tokenIndex !== valueTokenIdx && (valueTokenIdx === undefined || !(r.tokenIndex <= valueTokenIdx && valueTokenIdx < r.tokenEnd))) { if (!prevRef || r.tokenIndex > prevRef.tokenIndex) prevRef = r; }
      if (r.tokenIndex > pos && r.tokenIndex !== valueTokenIdx && (valueTokenIdx === undefined || !(r.tokenIndex <= valueTokenIdx && valueTokenIdx < r.tokenEnd))) { if (!nextRef || r.tokenIndex < nextRef.tokenIndex) nextRef = r; }
    }
    // the following ref must be in the same clause (no sentence boundary / conjunction between)
    if (nextRef) {
      for (i = pos + 1; i < nextRef.tokenIndex; i++) {
        var t = tokens[i];
        if (t.type === 'punct' && /^[.;!?]$/.test(t.raw) || hasConcept(t, 'AND') || hasConcept(t, 'OR') || hasAnyConcept(t, MARKERS) || i !== valueTokenIdx && hasAnyConcept(t, COMPARATORS)) { nextRef = null; break; }
      }
      if (nextRef && nextRef.tokenIndex - pos > 6) nextRef = null;
    }
    if (prevRef) {
      for (i = prevRef.tokenEnd; i < pos; i++) {
        var t2 = tokens[i];
        if (t2.type === 'punct' && /^[.;!?]$/.test(t2.raw) || hasAnyConcept(t2, { THEN: 1, ELSE: 1 })) { prevRef = null; break; }
      }
      if (prevRef && pos - prevRef.tokenEnd > 8) prevRef = null;
    }
    if (prevRef && !prevRef.usedBy) return prevRef;
    if (prevRef && prevRef.usedBy) {
      // already used by an earlier condition: prefer a fresh following ref, otherwise reuse (range on the same column)
      if (nextRef && !nextRef.usedBy) return nextRef;
      return prevRef;
    }
    if (nextRef) return nextRef;
    return null;
  }
  function pickOp(tok, value) {
    var ops = [];
    for (var i = 0; i < tok.concepts.length; i++) if (COMPARATORS[tok.concepts[i].concept]) ops.push(tok.concepts[i].concept);
    if (!ops.length) return null;
    if (ops.length === 1) return ops[0];
    var isNum = value && value.kind === 'num';
    if (ops.indexOf('GT') >= 0 && ops.indexOf('CONTAINS') >= 0) return isNum ? 'GT' : 'CONTAINS';
    if (ops.indexOf('EMPTY') >= 0) return 'EMPTY';
    // prefer the more specific comparator
    var order = ['BETWEEN', 'GTE', 'LTE', 'NEQ', 'GT', 'LT', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'NOT_EMPTY', 'EMPTY', 'EQ'];
    for (var o = 0; o < order.length; o++) if (ops.indexOf(order[o]) >= 0) return order[o];
    return ops[0];
  }
  function extractConditions(pq, tokens, refs) {
    var lang = pq.lang, conditions = [], i;
    var dirs = lang === 'tr' ? [-1, 1] : [1, -1];
    for (i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (!hasAnyConcept(t, COMPARATORS)) continue;
      if (t.consumed && !t.headerRef) continue; // e.g. 'между'/'от'/'kadar' swallowed by a word range
      if (t.type === 'punct' && !PUNCT_CONCEPTS[t.raw]) continue;
      var spanEnd = t.phraseEnd || i + 1;
      if (t.type === 'word' && /^(is|are|равно|равен|равна|равны)$/.test(t.norm) && !t.phraseEnd) {
        var nxc = tokens[i + 1]; while (nxc && nxc.type === 'punct') nxc = tokens[nxc.index + 1];
        if (nxc && (hasAnyConcept(nxc, COMPARATORS) || hasConcept(nxc, 'NOT')) && !(hasConcept(nxc, 'EMPTY') && !hasConcept(nxc, 'BLANK'))) { if (!(hasConcept(nxc, 'EMPTY'))) continue; }
      }
      var hasIf = hasConcept(t, 'IF');
      var ops = [];
      for (var c = 0; c < t.concepts.length; c++) if (COMPARATORS[t.concepts[c].concept]) ops.push(t.concepts[c].concept);
      var op = ops[0];
      var value = null, value2 = null, found = null;
      if (ops.indexOf('BETWEEN') >= 0) {
        op = 'BETWEEN';
        // TR: "100 ile 200 arasında" (values before); RU/EN: "между 100 и 200" / "between 100 and 200" (values after)
        var tryDirs = lang === 'tr' ? [-1, 1] : [1, -1];
        for (var d = 0; d < tryDirs.length && !found; d++) {
          var dir = tryDirs[d];
          var v1 = scanValue(tokens, dir > 0 ? spanEnd - 1 : i, dir, lang, refs, true, 3);
          if (!v1) continue;
          var v2 = scanValue(tokens, v1.tokenIndex, dir, lang, refs, true, 3, true);
          if (!v2) continue;
          if (dir < 0) { value = v2; value2 = v1; } else { value = v1; value2 = v2; }
          found = true;
        }
        if (!found) continue;
      } else if (NO_VALUE_OPS[op] && ops.length === 1 && !hasConcept(t, 'BLANK')) {
        found = true;
      } else {
        // lone "boş"/"пустые"/"blank" carries EMPTY + BLANK: it is a condition only in a condition-like place
        if (ops.indexOf('EMPTY') >= 0 && hasConcept(t, 'BLANK')) {
          var pv = tokens[i - 1], nx = tokens[i + 1];
          var afterMarker = false;
          for (var b = Math.max(0, i - 3); b < i; b++) if (hasAnyConcept(tokens[b], { ELSE: 1, THEN: 1, IFERROR: 1, OTHERWISE: 1 })) afterMarker = true;
          var condLike = (pv && (pv.type === 'ref' || pv.headerRef || hasConcept(pv, 'EQ') || hasConcept(pv, 'IF') && !hasConcept(pv, 'IFERROR'))) || (nx && (hasAnyConcept(nx, { CELL: 1, ROW: 1, EQ: 1, IF: 1, COUNT: 1, COUNT_EMPTY: 1 }) || nx.type === 'word' && /^(hücre|hucre|satır|satir|olan|ise|ячейк|ячее|строк|cell|row)/.test(nx.norm)));
          if (afterMarker || !condLike) continue;
          op = 'EMPTY'; found = true;
        } else {
          for (var dd = 0; dd < dirs.length && !value; dd++) {
            var from = dirs[dd] > 0 ? spanEnd - 1 : i;
            value = scanValue(tokens, from, dirs[dd], lang, refs, true, 4);
            if (value && value.kind === 'ref' && dirs[dd] > 0 && lang === 'tr') value = null; // TR: a following ref is never the compared value
          }
          if (!value) continue;
          op = pickOp(t, value);
          if (!op) continue;
          found = true;
        }
      }
      if (!found) continue;
      var valTok = value ? value.tokenIndex : undefined;
      var ref = refForCondition(tokens, refs, i, lang, valTok, conditions);
      if (value && value.kind === 'ref' && ref === value.ref) ref = refForCondition(tokens, refs, i, lang, valTok, conditions);
      var cond = {
        ref: ref ? (ref.full || fullText(ref)) : null, refObj: ref || null,
        op: COMPARATORS[op],
        value: value && value.kind !== 'ref' ? value.value : null,
        value2: value2 && value2.kind !== 'ref' ? value2.value : null,
        valueRef: value && value.kind === 'ref' ? value.value : (value2 && value2.kind === 'ref' ? value2.value : null),
        valueKind: value ? value.kind : null,
        isPercent: !!(value && value.isPercent),
        conjunction: null, position: i, tokenIndex: i, tokenEnd: spanEnd, start: t.start, end: tokens[spanEnd - 1].end,
        hasIf: hasIf, valueTokenIndex: valTok, concept: op
      };
      if (value && value.kind === 'ref') cond.valueRefObj = value.ref;
      // mark consumption
      t.consumed = true;
      for (var k = i; k < spanEnd; k++) tokens[k].consumed = true;
      if (value && value.kind !== 'ref') { tokens[value.tokenIndex].consumed = true; tokens[value.tokenIndex].usedBy = 'condition'; }
      if (value2 && value2.kind !== 'ref') { tokens[value2.tokenIndex].consumed = true; tokens[value2.tokenIndex].usedBy = 'condition'; }
      if (value && value.kind === 'ref' && value.ref) value.ref.usedBy = 'conditionValue';
      if (ref) ref.usedBy = 'condition';
      conditions.push(cond);
    }
    // implicit equality: header/explicit ref directly followed (or preceded) by an unused literal → "="
    for (i = 0; i < refs.length; i++) {
      var r = refs[i];
      if (r.usedBy) continue;
      var after = tokens[r.tokenEnd], before = tokens[r.tokenIndex - 1];
      if (after && after.type === 'punct' && /^[:=]$/.test(after.raw)) after = tokens[r.tokenEnd + 1];
      var lit = null, pos = null;
      if (after && after.type === 'string' && !after.consumed) { lit = after; pos = r.tokenIndex; }
      else if (before && before.type === 'string' && !before.consumed && r.source === 'header') { lit = before; pos = before.index; }
      else if (after && after.type === 'word' && !after.consumed && !after.concepts.length && after.type !== 'function' && /^[\p{Lu}]/u.test(after.raw) && !after.sheetName && r.source === 'header' && !(lang === 'en')) { lit = after; pos = r.tokenIndex; }
      if (!lit) continue;
      // literal must not be the then/else value of a marker right before it
      if (lit.index > 0 && hasAnyConcept(tokens[lit.index - 1], { THEN: 1, ELSE: 1 }) && tokens[lit.index - 1].index !== r.tokenEnd - 1) continue;
      lit.consumed = true; lit.usedBy = 'condition'; r.usedBy = 'condition';
      conditions.push({ ref: r.full || fullText(r), refObj: r, op: '=', value: lit.type === 'string' ? lit.value : lit.base, value2: null, valueRef: null, valueKind: 'str', isPercent: false, conjunction: null, position: pos, tokenIndex: pos, tokenEnd: Math.max(r.tokenEnd, lit.index + 1), start: Math.min(r.span[0], lit.start), end: Math.max(r.span[1], lit.end), hasIf: false, valueTokenIndex: lit.index, concept: 'EQ', implicit: lit.type !== 'string' });
    }
    conditions.sort(function (a, b) { return a.position - b.position; });
    // de-duplicate ("от 100 и выше" → one condition)
    for (i = 1; i < conditions.length; i++) {
      var a = conditions[i - 1], b2 = conditions[i];
      if (a.op === b2.op && a.value === b2.value && a.valueRef === b2.valueRef && a.ref === b2.ref) { conditions.splice(i, 1); i--; }
    }
    // conjunctions on the second and later conditions
    for (i = 1; i < conditions.length; i++) {
      var cur = conditions[i], prev = conditions[i - 1];
      var lo = Math.min(prev.tokenEnd, cur.tokenIndex), hi = Math.max(prev.tokenEnd, cur.tokenIndex);
      var lo2 = Math.min(cur.tokenIndex, cur.valueTokenIndex === undefined ? cur.tokenIndex : cur.valueTokenIndex);
      var conj = null;
      for (var s = Math.min(lo, lo2); s < Math.max(hi, cur.tokenIndex); s++) {
        var tk = tokens[s]; if (!tk) continue;
        if (hasConcept(tk, 'OR')) { conj = 'OR'; break; }
        if (hasConcept(tk, 'AND')) conj = 'AND';
      }
      if (!conj && prev.refObj && cur.refObj) {
        for (var s2 = prev.refObj.tokenEnd; s2 < cur.refObj.tokenIndex; s2++) { var tk2 = tokens[s2]; if (tk2 && hasConcept(tk2, 'OR')) { conj = 'OR'; break; } if (tk2 && hasConcept(tk2, 'AND')) conj = 'AND'; }
      }
      cur.conjunction = conj || 'AND';
    }
    return conditions;
  }

  /* ------------------------------------------------------------------ then / else */
  function valueCandidate(t, lang, refs) {
    if (!t) return null;
    if (t.type === 'punct') return null;
    if (t.usedBy === 'condition') return null;
    if (hasConcept(t, 'BLANK')) return { kind: 'blank', value: '', tokenIndex: t.index };
    if (t.type === 'number' || t.type === 'percent') return { kind: 'num', value: t.value, tokenIndex: t.index, isPercent: t.type === 'percent' };
    if (t.type === 'string') return { kind: 'str', value: t.value, tokenIndex: t.index };
    if (t.type === 'ref' || t.headerRef) {
      var ref = t.headerRef || null;
      if (!ref) for (var i = 0; i < refs.length; i++) if (refs[i].tokenIndex <= t.index && t.index < refs[i].tokenEnd) ref = refs[i];
      if (ref && ref.usedBy === 'condition' || ref && ref.isTarget) return null;
      if (ref) return { kind: 'ref', value: ref.full || fullText(ref), ref: ref, tokenIndex: t.index };
      return null;
    }
    if (t.type === 'word' && !t.consumed && t.numberWord !== undefined && !(ARTICLE_ONES[lang] && ARTICLE_ONES[lang][t.norm])) return { kind: 'num', value: t.numberWord, tokenIndex: t.index };
    if (t.type === 'word' && !t.consumed && !t.concepts.length && !t.sheetName && !/^[.,;:]$/.test(t.raw)) return { kind: 'str', value: t.base || t.raw, tokenIndex: t.index, word: true };
    return null;
  }
  function extractThenElse(pq, tokens, refs, conditions) {
    var lang = pq.lang, i;
    var thenMarks = [], elseMarks = [];
    for (i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (hasConcept(t, 'ELSE') || hasConcept(t, 'OTHERWISE')) elseMarks.push(i);
      else if (hasConcept(t, 'THEN') || hasConcept(t, 'IF') && (hasAnyConcept(t, COMPARATORS) || t.norm === 'ise')) thenMarks.push(i);
    }
    // a condition itself acts as a then-marker (TR: "100'den büyükse X", RU: "если ... больше 100 X")
    for (i = 0; i < conditions.length; i++) if (conditions[i].hasIf || lang !== 'tr' && pq.has('IF')) thenMarks.push(conditions[i].tokenEnd - 1);
    var explicitMark = {};
    for (i = 0; i < tokens.length; i++) if (hasAnyConcept(tokens[i], { THEN: 1, ELSE: 1, OTHERWISE: 1 }) && (!hasAnyConcept(tokens[i], COMPARATORS) || tokens[i].norm === 'ise')) explicitMark[i] = true;
    thenMarks.sort(function (a, b) { return a - b; });
    var firstElse = elseMarks.length ? elseMarks[0] : -1;
    var thenValue = null, elseValue = null;
    function findAfter(from, stopAt) {
      var allowWord = !!explicitMark[from] || (hasConcept(tokens[from], 'IF') && firstElse >= 0);
      for (var j = from + 1; j < tokens.length; j++) {
        if (stopAt >= 0 && j >= stopAt) return null;
        var tk = tokens[j];
        if (tk.type === 'punct') { if (/^[.;!?]$/.test(tk.raw)) return null; continue; }
        if (hasConcept(tk, 'ELSE') || hasConcept(tk, 'OTHERWISE')) return null;
        var v = valueCandidate(tk, lang, refs);
        if (v && v.word && !allowWord) v = null;
        if (v) return v;
        if (tk.type === 'word' && tk.concepts.length) {
          if (hasAnyConcept(tk, { WRITE: 1, SHOW: 1, RESULT: 1, RETURN: 1, THEN: 1, VALUE: 1, IF: 1, TO: 1, IN: 1, AND: 1 })) continue;
          return null;
        }
        if (tk.consumed) continue;
        return null;
      }
      return null;
    }
    // then: the last then-marker before the first else (or the last one overall)
    var marks = thenMarks.filter(function (m) { return firstElse < 0 || m < firstElse; });
    for (var m = marks.length - 1; m >= 0 && !thenValue; m--) thenValue = findAfter(marks[m], firstElse);
    if (!thenValue && marks.length && lang !== 'tr') {
      // RU/EN: "если E2 > 100, Высокий" – value after the whole condition
      for (var m2 = 0; m2 < marks.length && !thenValue; m2++) thenValue = findAfter(marks[m2], firstElse);
    }
    for (var e = 0; e < elseMarks.length && !elseValue; e++) elseValue = findAfter(elseMarks[e], -1);
    if (thenValue && !elseValue && firstElse < 0) {
      // "ise Evet, Hayır" is rare; only use a second literal
      var nextLit = null;
      for (i = thenValue.tokenIndex + 1; i < tokens.length; i++) if (tokens[i].type === 'string' && tokens[i].usedBy !== 'condition') { nextLit = tokens[i]; break; }
      if (nextLit) elseValue = { kind: 'str', value: nextLit.value, tokenIndex: nextLit.index };
    }
    // fallback: two free literals and an IF-like request → first = then, second = else
    if (!thenValue && !elseValue && (pq.has('IF') || conditions.length)) {
      var free = tokens.filter(function (tk) { return tk.type === 'string' && tk.usedBy !== 'condition'; });
      if (free.length >= 2) { thenValue = { kind: 'str', value: free[0].value, tokenIndex: free[0].index }; elseValue = { kind: 'str', value: free[1].value, tokenIndex: free[1].index }; }
      else if (free.length === 1 && conditions.length) {
        var lastCond = conditions[conditions.length - 1];
        if (free[0].index > lastCond.tokenIndex) thenValue = { kind: 'str', value: free[0].value, tokenIndex: free[0].index };
      }
    }
    if (thenValue && elseValue && thenValue.tokenIndex === elseValue.tokenIndex) elseValue = null;
    if (thenValue) { tokens[thenValue.tokenIndex].usedBy = 'then'; tokens[thenValue.tokenIndex].consumed = true; }
    if (elseValue) { tokens[elseValue.tokenIndex].usedBy = 'else'; tokens[elseValue.tokenIndex].consumed = true; }
    function clean(v) { if (!v) return null; var o = { kind: v.kind, value: v.kind === 'blank' ? '' : v.value, tokenIndex: v.tokenIndex }; if (v.isPercent) o.isPercent = true; if (v.ref) o.ref = v.ref; return o; }
    return { thenValue: clean(thenValue), elseValue: clean(elseValue) };
  }

  /* ------------------------------------------------------------------ numbers, literals, ordinals, flags */
  function collectNumbers(pq, tokens) {
    var lang = pq.lang, numbers = [], ordinals = [], i;
    for (i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (t.type === 'number' || t.type === 'percent') {
        var isPct = t.type === 'percent';
        var nx = tokens[i + 1], pv = tokens[i - 1];
        if (!isPct && (nx && nx.type === 'word' && hasConcept(nx, 'PERCENT') || pv && pv.type === 'word' && hasConcept(pv, 'PERCENT'))) isPct = true;
        numbers.push({ value: t.value, raw: t.raw, isPercent: isPct, tokenIndex: i, tokenEnd: i + 1, start: t.start, end: t.end, usedBy: t.usedBy || null });
        continue;
      }
      if (t.type === 'ordinal') { ordinals.push({ ordinal: t.value, value: t.value, raw: t.raw, tokenIndex: i, start: t.start, end: t.end }); continue; }
      if (t.type === 'word' && t.ordinalWord !== undefined && t.numberWord === undefined) { ordinals.push({ ordinal: t.ordinalWord, value: t.ordinalWord, raw: t.raw, tokenIndex: i, start: t.start, end: t.end, word: true }); continue; }
      if (t.type === 'word' && t.numberWord !== undefined && !t.headerRef && !t.phraseCleared) {
        // compound number words: "on iki", "двадцать три", "two hundred fifty"
        var j = i, acc = 0, cur = 0, parts = 0, lastV = null;
        while (j < tokens.length && tokens[j].type === 'word' && tokens[j].numberWord !== undefined && !tokens[j].headerRef && !tokens[j].phraseCleared) {
          var v = tokens[j].numberWord;
          if (lastV !== null && v < 100 && lastV < 100 && !(lastV >= 10 && v < 10 && lastV % 10 === 0)) break; // "üç beş" are two numbers
          if (v >= 1000) { acc += (cur || 1) * v; cur = 0; }
          else if (v >= 100) { cur = (cur || 1) * v; }
          else cur += v;
          lastV = v; parts++; j++;
        }
        var total = acc + cur;
        var single = parts === 1;
        if (single && ARTICLE_ONES[lang] && ARTICLE_ONES[lang][t.norm]) { continue; }
        var isPct2 = tokens[j] && hasConcept(tokens[j], 'PERCENT') || tokens[i - 1] && hasConcept(tokens[i - 1], 'PERCENT');
        numbers.push({ value: total, raw: pq.text.slice(t.start, tokens[j - 1].end), isPercent: !!isPct2, tokenIndex: i, tokenEnd: j, start: t.start, end: tokens[j - 1].end, fromWord: true, usedBy: t.usedBy || null });
        for (var k = i; k < j; k++) { tokens[k].type = 'number'; tokens[k].value = total; }
        i = j - 1;
      }
    }
    pq.numbers = numbers;
    pq.ordinals = ordinals;
  }
  function collectLiterals(pq, tokens) {
    var lits = [];
    for (var i = 0; i < tokens.length; i++) if (tokens[i].type === 'string') lits.push({ value: tokens[i].value, tokenIndex: i, start: tokens[i].start, end: tokens[i].end, usedBy: tokens[i].usedBy || null });
    pq.literals = lits;
  }
  function computeFlags(pq, tokens, refs) {
    var flags = { wholeColumn: false, eachRow: false, ignoreErrors: false, caseSensitive: false, question: false };
    for (var i = 0; i < refs.length; i++) if (refs[i].wholeColumn) flags.wholeColumn = true;
    if (pq.has('EACH_ROW')) {
      // a bare "her"/"each" only counts next to a row word
      for (var j = 0; j < tokens.length; j++) {
        var t = tokens[j];
        if (!hasConcept(t, 'EACH_ROW')) continue;
        if (t.phraseEnd && t.phraseEnd > j + 1) { flags.eachRow = true; break; }
        var nx = tokens[j + 1];
        if (/^(her|each|every|кажд)/.test(t.norm) && nx && (hasConcept(nx, 'ROW') || /^(satır|satir|строк|row)/.test(nx.norm))) { flags.eachRow = true; break; }
        if (!/^(her|each|every|кажд)/.test(t.norm)) { flags.eachRow = true; break; }
      }
    }
    if (pq.has('IFERROR')) flags.ignoreErrors = true;
    if (pq.has('CASE_SENSITIVE')) flags.caseSensitive = true;
    if (pq.has('QUESTION') || /\?\s*$/.test(pq.text)) flags.question = true;
    return flags;
  }

  /* ------------------------------------------------------------------ ParsedQuery helpers */
  function attachHelpers(pq) {
    var conceptSet = {};
    for (var i = 0; i < pq.concepts.length; i++) conceptSet[pq.concepts[i].concept] = true;
    pq.has = function (concept) {
      if (Array.isArray(concept)) { for (var k = 0; k < concept.length; k++) if (conceptSet[concept[k]]) return true; return false; }
      return !!conceptSet[concept];
    };
    pq.hasAll = function (list) { for (var k = 0; k < list.length; k++) if (!conceptSet[list[k]]) return false; return true; };
    pq.firstRef = function (kind) {
      for (var r = 0; r < pq.refs.length; r++) if (!kind || pq.refs[r].kind === kind || pq.refs[r].source === kind) return pq.refs[r];
      return null;
    };
    pq.refsOfType = function (type) { return pq.refs.filter(function (r) { return r.type === type; }); };
    pq.numericRefs = function () { return pq.refs.filter(function (r) { return r.type === 'number'; }); };
    pq.textRefs = function () { return pq.refs.filter(function (r) { return r.type === 'text'; }); };
    pq.dateRefs = function () { return pq.refs.filter(function (r) { return r.type === 'date'; }); };
    pq.headerRefs = function () { return pq.refs.filter(function (r) { return r.source === 'header'; }); };
    pq.explicitRefs = function () { return pq.refs.filter(function (r) { return r.source === 'explicit'; }); };
    pq.freeRefs = function () { return pq.refs.filter(function (r) { return !r.usedBy; }); };
    pq.conceptOrder = function () { return pq.concepts.map(function (c) { return c.concept; }); };
    pq.conceptAt = function (tokenIndex) { return pq.concepts.filter(function (c) { return c.tokenIndex <= tokenIndex && tokenIndex < (c.tokenEnd || c.tokenIndex + 1); }).map(function (c) { return c.concept; }); };
    pq.indexOf = function (concept) { for (var c = 0; c < pq.concepts.length; c++) if (pq.concepts[c].concept === concept) return pq.concepts[c].tokenIndex; return -1; };
    pq.lastIndexOf = function (concept) { for (var c = pq.concepts.length - 1; c >= 0; c--) if (pq.concepts[c].concept === concept) return pq.concepts[c].tokenIndex; return -1; };
    pq.refAt = function (tokenIndex) {
      for (var r = 0; r < pq.refs.length; r++) if (pq.refs[r].tokenIndex <= tokenIndex && tokenIndex < pq.refs[r].tokenEnd) return pq.refs[r];
      return null;
    };
    pq.between = function (conceptA, conceptB) {
      var a = pq.indexOf(conceptA);
      if (a < 0) return [];
      var b = -1;
      for (var c = 0; c < pq.concepts.length; c++) if (pq.concepts[c].concept === conceptB && pq.concepts[c].tokenIndex > a) { b = pq.concepts[c].tokenIndex; break; }
      if (b < 0) return [];
      var aEnd = a + 1;
      for (var c2 = 0; c2 < pq.concepts.length; c2++) if (pq.concepts[c2].concept === conceptA && pq.concepts[c2].tokenIndex === a && c2 >= 0) aEnd = Math.max(aEnd, pq.concepts[c2].tokenEnd || a + 1);
      return pq.tokens.slice(aEnd, b);
    };
    pq.numberNear = function (concept, maxDistance) {
      var idx = pq.indexOf(concept); if (idx < 0) return null;
      var best = null, dist = (maxDistance || 3) + 1;
      for (var n = 0; n < pq.numbers.length; n++) { var dn = Math.min(Math.abs(pq.numbers[n].tokenIndex - idx), Math.abs(pq.numbers[n].tokenEnd - 1 - idx)); if (dn < dist) { dist = dn; best = pq.numbers[n]; } }
      return best;
    };
    pq.freeNumbers = function () { return pq.numbers.filter(function (n) { return !n.usedBy; }); };
    pq.freeLiterals = function () { return pq.literals.filter(function (l) { return !l.usedBy; }); };
    pq.wordAt = function (i) { return pq.tokens[i] ? pq.tokens[i].norm : ''; };
    return pq;
  }

  function emptyQuery(text, lang) {
    var pq = { lang: lang || 'tr', text: text || '', tokens: [], literals: [], numbers: [], ordinals: [], refs: [], concepts: [], conditions: [], explicitFunctions: [], thenValue: null, elseValue: null, target: null, sheets: [], flags: { wholeColumn: false, eachRow: false, ignoreErrors: false, caseSensitive: false, question: false } };
    return attachHelpers(pq);
  }

  /* ------------------------------------------------------------------ main entry */
  parser.parse = function (text, ctx) {
    var original = text == null ? '' : String(text);
    if (original.length > MAX_TEXT) original = original.slice(0, MAX_TEXT);
    var lang = 'tr';
    try {
      lang = detectLanguage(original);
      if (ctx && typeof ctx !== 'object') ctx = null;
      var pq = emptyQuery(original, lang);
      if (!original.trim()) return pq;
      var tokens = attachSuffixes(tokenizeText(original, lang), original);
      classifyTokens(tokens, original, lang);
      var concepts = [];
      applyPhrases(tokens, lang, concepts);
      for (var i = 0; i < tokens.length; i++) {
        var t = tokens[i];
        for (var c = 0; c < t.concepts.length; c++) {
          var cc = t.concepts[c];
          var dupe = false;
          for (var d = 0; d < concepts.length; d++) if (concepts[d].tokenIndex === i && concepts[d].concept === cc.concept) { dupe = true; break; }
          if (!dupe) concepts.push({ concept: cc.concept, weight: cc.weight, tokenIndex: i, tokenEnd: i + 1, start: t.start, end: t.end });
        }
      }
      concepts.sort(function (a, b) { return a.start - b.start || (b.tokenEnd - b.tokenIndex) - (a.tokenEnd - a.tokenIndex); });
      pq.tokens = tokens;
      pq.concepts = concepts;
      attachHelpers(pq);
      pq.refs = extractRefs(pq, tokens, ctx, original);
      pq.target = extractTarget(pq, tokens, pq.refs, ctx);
      collectNumbers(pq, tokens);
      pq.conditions = extractConditions(pq, tokens, pq.refs);
      var te = extractThenElse(pq, tokens, pq.refs, pq.conditions);
      pq.thenValue = te.thenValue; pq.elseValue = te.elseValue;
      collectLiterals(pq, tokens);
      for (var n = 0; n < pq.numbers.length; n++) pq.numbers[n].usedBy = tokens[pq.numbers[n].tokenIndex].usedBy || null;
      var fns = [];
      for (var f = 0; f < tokens.length; f++) if (tokens[f].type === 'function' && fns.indexOf(tokens[f].value) < 0) fns.push(tokens[f].value);
      pq.explicitFunctions = fns;
      pq.flags = computeFlags(pq, tokens, pq.refs);
      if (ctx && ctx.activeCell && !pq.target) pq.activeCell = ctx.activeCell;
      // strip helper-only fields from the public token shape but keep them available
      for (var k = 0; k < tokens.length; k++) { var tk = tokens[k]; delete tk._str; delete tk._ref; delete tk._num; delete tk._pct; delete tk._ord; delete tk._ordDot; delete tk._punct; }
      return pq;
    } catch (err) {
      var fallback = emptyQuery(original, lang);
      fallback.error = { message: err && err.message ? String(err.message) : String(err) };
      return fallback;
    }
  };

  /* exposed for tests and other modules */
  parser.detectLanguage = detectLanguage;
  parser.tokenize = function (text, lang) { try { var t = attachSuffixes(tokenizeText(String(text || ''), lang || detectLanguage(String(text || ''))), String(text || '')); classifyTokens(t, String(text || ''), lang || 'tr'); return t; } catch (e) { return []; } };
  parser.parseNumber = parseNumber;
  parser.parseRefText = parseRefText;
  parser.lookupConcepts = lexLookup;
  parser.resolveFunction = resolveFunction;
  parser.COMPARATORS = COMPARATORS;
  parser.vocabulary = OWN;

  EFS.parser = parser;
  return parser;
});
