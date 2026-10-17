/* Formula Studio — EFS.normalize
 * Language detection, Turkish-aware lowercasing, diacritic folding, light stemming,
 * tokenization (cell refs, numbers, quoted strings, ordinals, function names, Turkish apostrophe suffixes),
 * similarity and number parsing. Plain ES2019, no dependencies; EFS.catalog is resolved lazily. */
(function (root, factory) {
  var EFS = root.EFS || (root.EFS = {});
  var api = factory(EFS, root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (EFS, root) {
  'use strict';
  var normalize = {};

  /* ------------------------------------------------------------------ */
  /* Character classes                                                   */
  /* ------------------------------------------------------------------ */
  var RE_TR_CHARS = /[çğıİöşüÇĞŞÜÖ]/;
  var RE_CYR = /[Ѐ-ӿ]/;
  var RE_CYR_G = /[Ѐ-ӿ]/g;
  var RE_LATIN_G = /[A-Za-zÀ-ɏ]/g;
  var RE_LETTER = /[\p{L}]/u;
  var RE_WORDCHAR = /[\p{L}\p{N}_]/u;

  /** Manual fold table for letters whose NFD decomposition is missing or unwanted. */
  var FOLD_MAP = {
    'ı': 'i', 'İ': 'i', 'I': 'i', 'ß': 'ss', 'ё': 'е', 'Ё': 'е', 'æ': 'ae', 'œ': 'oe', 'ø': 'o', 'đ': 'd', 'ł': 'l', 'þ': 'th',
    '’': "'", '‘': "'", '“': '"', '”': '"', ' ': ' '
  };

  normalize.isCyrillic = function (text) { return RE_CYR.test(String(text == null ? '' : text)); };
  normalize.hasTurkishChars = function (text) { return RE_TR_CHARS.test(String(text == null ? '' : text)); };

  /** Lowercase; Turkish-aware for 'tr' (İ→i, I→ı). */
  normalize.lower = function (text, lang) {
    var s = String(text == null ? '' : text);
    if (lang === 'tr') s = s.replace(/İ/g, 'i').replace(/I/g, 'ı');
    else s = s.replace(/İ/g, 'i');
    return s.toLowerCase();
  };

  /** Lowercase + strip diacritics for fuzzy comparison. Keeps Cyrillic (ё→е). */
  normalize.fold = function (text) {
    var s = String(text == null ? '' : text);
    if (!s) return '';
    s = s.replace(/[ıİIßёЁæœøđłþ‘’“” ]/g, function (ch) { return FOLD_MAP[ch] || ch; });
    s = s.toLowerCase();
    // strip combining marks from Latin letters only; Cyrillic (й, ў ...) must stay intact
    s = s.replace(/[^\u0000-\u007FЀ-ӿ]+/g, function (seg) {
      return seg.normalize('NFD').replace(/[̀-ͯ]/g, '');
    });
    return s;
  };

  /* ------------------------------------------------------------------ */
  /* Stemming (light suffix stripping on folded text)                    */
  /* ------------------------------------------------------------------ */
  var TR_SUFFIXES = [
    'larindan', 'lerinden', 'larinda', 'lerinde', 'larini', 'lerini', 'larina', 'lerine', 'lardan', 'lerden',
    'larda', 'lerde', 'larla', 'lerle', 'larin', 'lerin', 'lari', 'leri', 'lara', 'lere', 'lar', 'ler',
    'sindan', 'sinden', 'sundan', 'sunden', 'sinda', 'sinde', 'sunda', 'sunde', 'sinin', 'sunun', 'sini', 'sunu', 'sina', 'sine', 'suna', 'sune',
    'indan', 'inden', 'undan', 'unden', 'inda', 'inde', 'unda', 'unde', 'inin', 'unun', 'ini', 'unu', 'ina', 'ine', 'una', 'une',
    'daki', 'deki', 'taki', 'teki', 'dan', 'den', 'tan', 'ten', 'yla', 'yle', 'ya', 'ye', 'yi', 'yu',
    'yarak', 'yerek', 'arak', 'erek', 'iyor', 'uyor', 'acak', 'ecek', 'mali', 'meli', 'sin', 'sun', 'miz', 'muz', 'niz', 'nuz',
    'da', 'de', 'ta', 'te', 'la', 'le', 'in', 'un', 'si', 'su', 'ki', 'nin', 'nun', 'ni', 'nu', 'ca', 'ce', 'i', 'u'
  ];
  var RU_SUFFIXES = [
    'иями', 'ями', 'ами', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими', 'ешь', 'ишь', 'ете', 'ите', 'йте', 'ься', 'ться',
    'ых', 'их', 'ые', 'ие', 'ая', 'яя', 'ое', 'ее', 'ой', 'ый', 'ий', 'ою', 'ею', 'ах', 'ях', 'ам', 'ям', 'ов', 'ев', 'ей',
    'ом', 'ем', 'ет', 'ит', 'ут', 'ют', 'ат', 'ят', 'ла', 'ло', 'ли', 'ть', 'ти', 'ся', 'сь', 'ай', 'яй', 'уй', 'ей',
    'у', 'ю', 'а', 'я', 'ы', 'и', 'е', 'о', 'ь', 'й'
  ];
  var EN_SUFFIXES = ['ing', 'ies', 'ed', 'es', 'ly', 's'];

  function stripOnce(w, list, minLen) {
    for (var i = 0; i < list.length; i++) {
      var suf = list[i];
      if (w.length - suf.length >= minLen && w.slice(-suf.length) === suf) return w.slice(0, -suf.length);
    }
    return w;
  }

  /** Light stemming on the folded word. Returns the folded stem (min length 3). */
  normalize.stem = function (word, lang) {
    var w = normalize.fold(String(word == null ? '' : word).trim());
    if (!w || w.length <= 3) return w;
    if (/^[\d.,%$:-]+$/.test(w)) return w;
    var list = lang === 'ru' ? RU_SUFFIXES : lang === 'en' ? EN_SUFFIXES : TR_SUFFIXES;
    var passes = lang === 'en' ? 1 : 3;
    for (var p = 0; p < passes; p++) {
      var next = stripOnce(w, list, p === 0 ? 3 : 4);
      if (next === w) break;
      w = next;
    }
    return w;
  };

  /* ------------------------------------------------------------------ */
  /* Similarity                                                          */
  /* ------------------------------------------------------------------ */
  function levenshtein(a, b) {
    var n = a.length, m = b.length;
    if (!n) return m; if (!m) return n;
    var prev = new Array(m + 1), cur = new Array(m + 1), i, j;
    for (j = 0; j <= m; j++) prev[j] = j;
    for (i = 1; i <= n; i++) {
      cur[0] = i;
      var ca = a.charCodeAt(i - 1);
      for (j = 1; j <= m; j++) {
        var cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
        var v = prev[j] + 1;
        if (cur[j - 1] + 1 < v) v = cur[j - 1] + 1;
        if (prev[j - 1] + cost < v) v = prev[j - 1] + cost;
        cur[j] = v;
      }
      var t = prev; prev = cur; cur = t;
    }
    return prev[m];
  }
  normalize.levenshtein = function (a, b) { return levenshtein(String(a == null ? '' : a), String(b == null ? '' : b)); };

  /** 0..1 Levenshtein ratio on folded strings. */
  normalize.similarity = function (a, b) {
    var fa = normalize.fold(a).trim(), fb = normalize.fold(b).trim();
    if (!fa && !fb) return 1;
    var max = Math.max(fa.length, fb.length);
    if (!max) return 1;
    return 1 - levenshtein(fa, fb) / max;
  };

  /** Folded prefix match. Stems shorter than 3 chars must match exactly. */
  normalize.startsWithStem = function (word, stem) {
    var fw = normalize.fold(word), fs = normalize.fold(stem);
    if (!fs) return false;
    if (fs.length < 3) return fw === fs;
    return fw.indexOf(fs) === 0;
  };

  /* ------------------------------------------------------------------ */
  /* Cell references                                                     */
  /* ------------------------------------------------------------------ */
  // Cyrillic letters that look like Latin column letters (users on RU keyboards often type "А1").
  var CYR_LOOKALIKE = { 'А': 'A', 'В': 'B', 'С': 'C', 'Е': 'E', 'Н': 'H', 'К': 'K', 'М': 'M', 'О': 'O', 'Р': 'P', 'Т': 'T', 'Х': 'X',
                        'а': 'A', 'в': 'B', 'с': 'C', 'е': 'E', 'н': 'H', 'к': 'K', 'м': 'M', 'о': 'O', 'р': 'P', 'т': 'T', 'х': 'X' };
  var COL = '[A-Za-z]{1,3}';
  var ROW = '[1-9]\\d{0,6}';
  var REF_BODY = '(?:\\$?' + COL + '\\$?' + ROW + ':\\$?' + COL + '\\$?' + ROW +    // A1:B10
                 '|\\$?' + COL + ':\\$?' + COL +                                      // A:C
                 '|\\$?' + ROW + ':\\$?' + ROW +                                      // 1:1
                 '|\\$?' + COL + '\\$?' + ROW + ')';                                  // A1
  var SHEET = "(?:'[^'\\n!]+'|[\\p{L}_][\\p{L}\\p{N}_.]*)!";
  var RE_REF_FULL = new RegExp('^(?:' + SHEET + ')?' + REF_BODY + '$', 'u');
  var RE_REF_AT = new RegExp('(?:' + SHEET + ')?' + REF_BODY, 'uy');
  var RE_REF_PARTS = new RegExp("^(?:(?:'([^'\\n!]+)'|([\\p{L}_][\\p{L}\\p{N}_.]*))!)?(.+)$", 'u');

  function mapLookalikes(s) {
    return s.replace(/[АВСЕНКМОРТХавсенкмортх]/g, function (ch) { return CYR_LOOKALIKE[ch]; });
  }

  /** True when text (optionally with a sheet prefix) is a cell / range / column / row reference. */
  normalize.isRefToken = function (text) {
    var s = String(text == null ? '' : text).trim();
    if (!s) return false;
    if (RE_REF_FULL.test(s)) return true;
    // allow Cyrillic look-alike column letters only when the reference body is otherwise purely A1-style
    var m = RE_REF_PARTS.exec(s);
    if (m && /^[\$\d:АВСЕНКМОРТХавсенкмортх]+$/.test(m[3]) && /[АВСЕНКМОРТХавсенкмортх]/.test(m[3])) {
      return RE_REF_FULL.test((m[1] ? "'" + m[1] + "'!" : m[2] ? m[2] + '!' : '') + mapLookalikes(m[3]));
    }
    return false;
  };

  /** Split a reference token: { sheet:'Ürünler'|null, ref:'A2:C50', norm:"Ürünler!A2:C50" }. */
  normalize.splitRef = function (text) {
    var s = String(text == null ? '' : text).trim();
    var m = RE_REF_PARTS.exec(s);
    if (!m) return null;
    var sheet = m[1] || m[2] || null;
    var ref = m[3];
    if (/[АВСЕНКМОРТХавсенкмортх]/.test(ref)) ref = mapLookalikes(ref);
    ref = ref.toUpperCase();
    var kind = /^\$?[A-Z]{1,3}:\$?[A-Z]{1,3}$/.test(ref) ? 'column' : /^\$?\d+:\$?\d+$/.test(ref) ? 'row' : ref.indexOf(':') >= 0 ? 'range' : 'cell';
    var sheetOut = sheet ? (/^[\p{L}_][\p{L}\p{N}_.]*$/u.test(sheet) && !/^\d/.test(sheet) ? sheet : "'" + sheet.replace(/'/g, "''") + "'") : "";
    return { sheet: sheet, ref: ref, kind: kind, norm: (sheetOut ? sheetOut + '!' : '') + ref };
  };

  /* ------------------------------------------------------------------ */
  /* Numbers                                                             */
  /* ------------------------------------------------------------------ */
  function digitsOnly(s) { return s.replace(/\D/g, ''); }

  /** Detailed number parse: { value, isPercent, number, raw } or null. value = number/100 when isPercent. */
  normalize.parseNumberInfo = function (text, lang) {
    var raw = String(text == null ? '' : text).trim();
    if (!raw) return null;
    var s = raw.replace(/ /g, ' ');
    var isPercent = false;
    if (/%/.test(s)) { isPercent = true; s = s.replace(/%/g, ''); }
    s = s.trim();
    var neg = false;
    if (/^[-−]/.test(s)) { neg = true; s = s.slice(1); }
    else if (/^\+/.test(s)) s = s.slice(1);
    s = s.trim().replace(/\s+/g, '');
    if (!/^\d[\d.,]*$/.test(s) && !/^[.,]\d+$/.test(s)) return null;
    var hasDot = s.indexOf('.') >= 0, hasComma = s.indexOf(',') >= 0;
    var num;
    if (hasDot && hasComma) {
      var lastDot = s.lastIndexOf('.'), lastComma = s.lastIndexOf(',');
      if (lastDot > lastComma) num = s.replace(/,/g, '');               // 1,250.75
      else num = s.replace(/\./g, '').replace(',', '.');                // 1.250,75
    } else if (hasComma) {
      var commaParts = s.split(',');
      var allGroups3 = commaParts.slice(1).every(function (g) { return g.length === 3; }) && commaParts[0].length >= 1 && commaParts[0].length <= 3;
      if (commaParts.length > 2) num = allGroups3 ? s.replace(/,/g, '') : null;
      else if (lang === 'en' && allGroups3) num = s.replace(/,/g, '');    // 1,250 (en)
      else num = s.replace(',', '.');                                       // 3,5
    } else if (hasDot) {
      var dotParts = s.split('.');
      var allGroups3d = dotParts.slice(1).every(function (g) { return g.length === 3; }) && dotParts[0].length >= 1 && dotParts[0].length <= 3;
      if (dotParts.length > 2) num = allGroups3d ? s.replace(/\./g, '') : null;
      else if (lang !== 'en' && allGroups3d && dotParts[0] !== '0') num = s.replace(/\./g, ''); // 1.000 (tr/ru)
      else num = s;                                                                              // 3.5
    } else num = s;
    if (num == null) return null;
    var v = Number(num);
    if (!isFinite(v)) return null;
    if (neg) v = -v;
    return { value: isPercent ? v / 100 : v, number: v, isPercent: isPercent, raw: raw };
  };

  /** "3,5" → 3.5, "1.250,75" → 1250.75, "1,250.75" → 1250.75, "10%" → 0.1, "%10" → 0.1; null when not numeric. */
  normalize.parseNumber = function (text, lang) {
    var info = normalize.parseNumberInfo(text, lang);
    return info ? info.value : null;
  };

  /* ------------------------------------------------------------------ */
  /* Language detection                                                  */
  /* ------------------------------------------------------------------ */
  var TR_WORDS = toSet(('ve ile icin ise degilse eger olan olanlar olanlari topla toplam toplami toplamini sutun sutunu sutununu sutununa sutunun hucre hucresine ' +
    'satir bul getir yaz kac en buyuk kucuk ortalama say sayisi deger degeri bos dolu sonra once arasinda arasindaki kadar den dan daki deki mi mu bu su ne nasil ' +
    'yuzde tarih bugun gun ay yil ara hangi tum butun her var yok formul formulu hesapla hesaplasin goster listele sirala filtrele bir iki uc dort bes ilk son ' +
    'karakter harf metin sayi adet fiyat tutar kategori urun isim ad soyad al ver kalan fazla az cok ya da de veya hem ki sart kosul durumunda hata bosluk ' +
    'birlestir yuvarla kdv indirim artis azalis fark farki gecen kalan sira siralama benzersiz tekrar eden eger ki sayfa sayfasindan tablo tablodan karsilik ' +
    'yazdir listesi degerleri degerlerini icinde icindeki iceren esit buyukse kucukse degil disinda haric sadece yalnizca kaldi yasi yasini aylik yillik').split(' '));
  var EN_WORDS = toSet(('the and or if then else of in to from sum count average column cell row find return write how many is are with for max min total ' +
    'greater less than equal equals contains empty blank lookup first last characters character length round percent days between today date value values ' +
    'number text show list sort filter unique each all this that where when not by into which what rows cells highest lowest largest smallest words word ' +
    'month year age calculate formula multiply divide add subtract difference rate loan payment error otherwise only every table sheet concatenate join ' +
    'uppercase lowercase trim replace remove duplicates top bottom whole entire result returns').split(' '));

  function toSet(arr) { var o = {}; for (var i = 0; i < arr.length; i++) o[arr[i]] = true; return o; }

  /** 'tr' | 'ru' | 'en'. Cyrillic → ru; Turkish letters / keywords → tr; otherwise English heuristic; default 'tr'. */
  normalize.detectLanguage = function (text) {
    var s = String(text == null ? '' : text);
    if (!s.trim()) return 'tr';
    // ignore refs and quoted literals when counting scripts/words
    var stripped = s.replace(/'[^'\n]*'![\$A-Za-z0-9:]+/g, ' ').replace(/[\p{L}_][\p{L}\p{N}_.]*![\$A-Za-z0-9:]+/gu, ' ')
      .replace(/\$?[A-Za-z]{1,3}\$?\d*(?::\$?[A-Za-z]{1,3}\$?\d*)?(?![\p{L}])/gu, function (m) { return normalize.isRefToken(m) ? ' ' : m; });
    var cyr = (stripped.match(RE_CYR_G) || []).length;
    var lat = (stripped.match(RE_LATIN_G) || []).length;
    if (cyr > 0 && cyr >= lat * 0.5) return 'ru';
    if (RE_TR_CHARS.test(stripped)) return 'tr';
    var words = normalize.fold(stripped).split(/[^a-z]+/).filter(Boolean);
    var trScore = 0, enScore = 0;
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (TR_WORDS[w]) trScore += 1;
      if (EN_WORDS[w]) enScore += 1;
      // Turkish morphology hints
      if (/(lar|ler|lari|leri|nin|nın|dan|den|daki|deki|sini|sina|sine|mak|mek|yor)$/.test(w) && w.length > 5 && !EN_WORDS[w]) trScore += 0.5;
      if (/(ing|tion|ness|ment)$/.test(w) && w.length > 5 && !TR_WORDS[w]) enScore += 0.5;
    }
    if (enScore > trScore) return 'en';
    if (trScore > enScore) return 'tr';
    if (cyr > 0) return 'ru';
    return 'tr';
  };

  /* ------------------------------------------------------------------ */
  /* Tokenizer                                                           */
  /* ------------------------------------------------------------------ */
  var APOSTROPHES = "'’‘ʼ´`";
  var QUOTE_CLOSER = { '"': '"', '«': '»', '“': '”', '„': '“', '‟': '”', '‘': '’', '‚': '‘', "'": "'", '’': '’' };
  var RE_WS = /\s/;
  var RE_DATE = /(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[./]\d{1,2}[./]\d{4}|\d{1,2}[./]\d{1,2}[./]\d{2})(?![\d\p{L}])/uy;
  var RE_PCT_PRE = /%\s?[-−]?\d+(?:[.,]\d+)?(?![\d\p{L}])/uy;
  var RE_PCT_POST = /[-−]?\d+(?:[.,]\d+)?\s?%/uy;
  var RE_ORD_TR = /(\d+)['’]?(?:inci|ıncı|uncu|üncü|nci|ncı|ncu|ncü|ci|cı|cu|cü)(?![\p{L}])/uy;
  var RE_ORD_RU = /(\d+)-(?:го|му|ой|ый|ий|ых|их|ми|ом|ем|ая|яя|ое|ее|ую|юю|ым|им|й|я|е|х)(?![\p{L}])/uy;
  var RE_ORD_EN = /(\d+)(?:st|nd|rd|th)(?![\p{L}])/uy;
  var RE_ORD_DOT = /(\d+)\.(?!\d)/y;
  var RE_NUM = /[-−]?(?:\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d{1,3}(?: \d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)(?!\d)/y;
  var RE_WORD = /[\p{L}_][\p{L}\p{N}_]*(?:[-.][\p{L}\p{N}_]+)*/uy;
  var RE_LETTERS = /[\p{L}]+/uy;
  var RE_REF_CYR_AT = new RegExp('\\$?[A-Za-zАВСЕНКМОРТХавсенкмортх]{1,3}\\$?' + ROW + '(?::\\$?[A-Za-zАВСЕНКМОРТХавсенкмортх]{1,3}\\$?' + ROW + ')?', 'y');
  var TWO_CHAR_OPS = { '>=': 1, '<=': 1, '<>': 1, '!=': 1, '==': 1, '=>': 1, '=<': 1, '&&': 1, '||': 1 };

  function isWordChar(ch) { return !!ch && RE_WORDCHAR.test(ch); }
  function isLetter(ch) { return !!ch && RE_LETTER.test(ch); }
  function prevIsBoundary(s, i) { return i === 0 || !isWordChar(s[i - 1]); }

  function matchRef(s, i) {
    RE_REF_AT.lastIndex = i;
    var m = RE_REF_AT.exec(s);
    var txt = null;
    if (m && !isWordChar(s[i + m[0].length]) && prevIsBoundary(s, i)) txt = m[0];
    if (!txt) {
      RE_REF_CYR_AT.lastIndex = i;
      var c = RE_REF_CYR_AT.exec(s);
      if (c && /[АВСЕНКМОРТХавсенкмортх]/.test(c[0]) && !isWordChar(s[i + c[0].length]) && prevIsBoundary(s, i)) txt = c[0];
    }
    if (!txt) return null;
    var parts = normalize.splitRef(txt);
    if (!parts) return null;
    return { raw: txt, norm: parts.norm, start: i, end: i + txt.length, type: 'ref', value: parts.norm, sheet: parts.sheet, ref: parts.ref, kind: parts.kind };
  }

  function matchQuoted(s, i, lang) {
    var open = s[i];
    var close = QUOTE_CLOSER[open];
    if (!close) return null;
    if ((open === "'" || open === '’') && !prevIsBoundary(s, i)) return null; // apostrophe suffix, handled elsewhere
    var j = i + 1, n = s.length;
    while (j < n && s[j] !== '\n') {
      if (s[j] === close || (open === "'" && APOSTROPHES.indexOf(s[j]) >= 0 && s[j] !== '`')) {
        // for straight apostrophes require that the closer is not itself a suffix apostrophe of a ref/number ("'A1'den" edge)
        var inner = s.slice(i + 1, j);
        if (open === "'" && j === i + 1) return null;
        return { raw: s.slice(i, j + 1), norm: normalize.lower(inner, lang), start: i, end: j + 1, type: 'string', value: inner };
      }
      j++;
    }
    return null;
  }

  function matchDate(s, i) {
    RE_DATE.lastIndex = i;
    var m = RE_DATE.exec(s);
    if (!m || !prevIsBoundary(s, i)) return null;
    return { raw: m[0], norm: m[0], start: i, end: i + m[0].length, type: 'date', value: m[0] };
  }

  function numberToken(raw, i, lang, type) {
    var info = normalize.parseNumberInfo(raw, lang);
    if (!info) return null;
    var tok = { raw: raw, norm: raw.replace(/\s+/g, ''), start: i, end: i + raw.length, type: type, value: info.number, isPercent: info.isPercent };
    if (info.isPercent) tok.fraction = info.value;
    return tok;
  }

  function matchPercent(s, i, lang) {
    RE_PCT_PRE.lastIndex = i;
    var m = RE_PCT_PRE.exec(s);
    if (!m) {
      if (s[i] === '-' || s[i] === '−') { if (!prevIsBoundary(s, i)) return null; }
      RE_PCT_POST.lastIndex = i;
      m = RE_PCT_POST.exec(s);
    }
    if (!m) return null;
    return numberToken(m[0], i, lang, 'percent');
  }

  function matchOrdinal(s, i, lang) {
    var m;
    RE_ORD_TR.lastIndex = i; m = RE_ORD_TR.exec(s);
    if (!m) { RE_ORD_RU.lastIndex = i; m = RE_ORD_RU.exec(s); }
    if (!m) { RE_ORD_EN.lastIndex = i; m = RE_ORD_EN.exec(s); }
    if (!m) {
      RE_ORD_DOT.lastIndex = i; m = RE_ORD_DOT.exec(s);
      // "2." is an ordinal only when the sentence continues ("en büyük 2. değer"); a final "100." is a number.
      if (m && !/\S/.test(s.slice(i + m[0].length))) m = null;
    }
    if (!m) return null;
    return { raw: m[0], norm: normalize.lower(m[0], lang), start: i, end: i + m[0].length, type: 'ordinal', value: parseInt(m[1], 10) };
  }

  function matchNumber(s, i, lang) {
    if ((s[i] === '-' || s[i] === '−') && !prevIsBoundary(s, i)) return null;
    RE_NUM.lastIndex = i;
    var m = RE_NUM.exec(s);
    if (!m) return null;
    var raw = m[0];
    if (raw === '-' || raw === '−') return null;
    return numberToken(raw, i, lang, 'number');
  }

  function catalogEntry(name) {
    var cat = EFS.catalog;
    if (!cat || typeof cat.byName !== 'function') return null;
    try { return cat.byName(name); } catch (e) { return null; }
  }

  function matchWord(s, i, lang, allCaps) {
    RE_WORD.lastIndex = i;
    var m = RE_WORD.exec(s);
    if (!m) return null;
    var raw = m[0];
    var tok = { raw: raw, norm: normalize.lower(raw, lang), start: i, end: i + raw.length, type: 'word', value: raw };
    tok.stem = normalize.stem(raw, lang);
    var letters = raw.replace(/[^\p{L}]/gu, '');
    var hasDot = raw.indexOf('.') > 0 || raw.indexOf('_') > 0;
    var isUpper = letters.length >= 2 && letters === letters.toUpperCase() && letters !== letters.toLowerCase();
    var nextNonSpace = s.slice(tok.end).replace(/^\s+/, '')[0];
    var looksLikeFunction = hasDot || nextNonSpace === '(' || (isUpper && !allCaps);
    if (letters.length >= 2 && (looksLikeFunction || letters.length >= 3)) {
      var entry = catalogEntry(raw);
      if (entry) {
        tok.fn = entry.name;
        if (looksLikeFunction) { tok.type = 'function'; tok.value = entry.name; }
      } else if ((hasDot && isUpper) || (nextNonSpace === '(' && letters.length >= 2)) {
        // unknown to the catalog (or catalog not loaded yet) but clearly typed as a function name
        tok.type = 'function'; tok.value = raw.toUpperCase();
      }
    }
    return tok;
  }

  function matchPunct(s, i) {
    var two = s.substr(i, 2);
    var raw = TWO_CHAR_OPS[two] ? two : s[i];
    return { raw: raw, norm: raw, start: i, end: i + raw.length, type: 'punct', value: raw };
  }

  /** Turkish apostrophe suffix: A1'den → "den"; also bare letters right after a closing quote ("Gıda"ya). */
  function matchSuffix(s, pos, lang, prevType) {
    var ch = s[pos];
    var start = -1;
    if (ch && APOSTROPHES.indexOf(ch) >= 0 && isLetter(s[pos + 1])) start = pos + 1;
    else if (prevType === 'string' && isLetter(ch) && lang !== 'ru') start = pos;
    if (start < 0) return null;
    RE_LETTERS.lastIndex = start;
    var m = RE_LETTERS.exec(s);
    if (!m) return null;
    if (start === pos && m[0].length > 6) return null; // "Gıda"kelime → not a suffix
    var raw = m[0];
    return { raw: raw, norm: normalize.lower(raw, lang), start: start, end: start + raw.length, type: 'word', value: raw, suffix: true, stem: normalize.lower(raw, lang) };
  }

  /**
   * tokenize(text, lang) → [{ raw, norm, start, end, type, value, ... }]
   * type: 'word' | 'number' | 'percent' | 'ref' | 'string' | 'ordinal' | 'date' | 'function' | 'punct'
   * ref tokens add { sheet, ref, kind }, words add { stem, fn? , suffix? }, percents add { fraction }.
   */
  normalize.tokenize = function (text, lang) {
    var s = String(text == null ? '' : text);
    if (!lang) lang = normalize.detectLanguage(s);
    var tokens = [], i = 0, n = s.length;
    var allCaps = !/\p{Ll}/u.test(s) && /\p{Lu}/u.test(s);
    while (i < n) {
      if (RE_WS.test(s[i])) { i++; continue; }
      var tok = matchRef(s, i) || matchQuoted(s, i, lang) || matchDate(s, i) || matchPercent(s, i, lang) ||
                matchOrdinal(s, i, lang) || matchNumber(s, i, lang) || matchWord(s, i, lang, allCaps) || matchPunct(s, i);
      tokens.push(tok);
      i = tok.end;
      var suf = matchSuffix(s, i, lang, tok.type);
      if (suf) { tokens.push(suf); i = suf.end; }
    }
    return tokens;
  };

  /** Convenience: the norm strings of a token list (or pass-through for string arrays). */
  normalize.norms = function (tokens) {
    var out = [];
    for (var i = 0; i < (tokens || []).length; i++) out.push(typeof tokens[i] === 'string' ? tokens[i] : tokens[i].norm);
    return out;
  };

  EFS.normalize = normalize;
  return normalize;
});
