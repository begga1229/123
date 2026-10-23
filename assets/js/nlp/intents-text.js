/* Formula Studio — text intents: LEFT / RIGHT / MID, LEN, TRIM, CLEAN, UPPER / LOWER / PROPER, concatenation (& and
 * TEXTJOIN), SUBSTITUTE / REPLACE, FIND, first / last word, text before / after a delimiter (TEXTBEFORE / TEXTAFTER or
 * LEFT / MID + FIND), VALUE, TEXT, REPT. Registers into EFS.intents. */
(function (root, factory) {
  var EFS = root.EFS || (root.EFS = {});
  var api = factory(EFS, root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (EFS, root) {
  'use strict';
  var I = EFS.intents, H = I.helpers, T = H.T;
  function A() { return EFS.ast; }

  var CHAR_RE = /karakter|harf|simge|символ|знак|character|char\b|letters?\b/;
  var REMOVE_RE = /kald[ıi]r|sil\b|silin|temizle|удали|убери|убрать|удалить|remove|delete|strip/;
  var USERNAME_RE = /kullan[ıi]c[ıi] ad|имя пользователя|логин|username|user name|local part/;
  var DOMAIN_RE = /alan ad|domain|домен/;

  function textRef(pq, ctx, cand, want) {
    want = want || {};
    var free = H.byPosition(H.refs(pq, { free: true, sheet: null }));
    if (want.preferHeader) { var hdr = free.filter(function (r) { return r.source === 'header'; }); if (hdr.length) free = hdr; }
    if (!free.length) free = H.byPosition(H.refs(pq, { sheet: null }));   // a header swallowed by a parser condition ("E-postada "@" …")
    return H.mainRef(pq, ctx, cand, { type: want.type || 'text', pool: free, slot: 'text', cellSlot: 'cell' });
  }
  function nums(pq) { return H.nums(pq, { free: true, percent: false, noDate: true }); }
  function lits(pq) { return H.lits(pq, { free: true }); }
  /** Literals of a replace request: "Замени в названии товара "Ручка" на "Pen"" — the parser may have read
   * 'товара "Ручка"' as an equality test and "Pen" as a then-value; with a replace verb they are the old/new texts. */
  function replLits(pq, repl) {
    var ls = lits(pq);
    if (!repl || ls.length >= 2) return ls;
    var all = H.lits(pq), cs = H.conds(pq);
    if (all.length >= 2 && all.length <= 3 && cs.every(function (c) { return c.op === '='; }) && !H.has(pq, 'IF')) return all;
    return ls;
  }
  function fill(id, pq, ctx, ref, ast, explain, tags) {
    return H.cand(id, ast, { explain: explain, target: H.target(pq, ctx, 'fill', ref), tags: tags || [] });
  }
  function aggPenalty(pq) { return H.hasAggregate(pq) && !H.has(pq, 'LENGTH') ? 0.25 : 0; }
  function base(pq, s) { return H.clamp(s - aggPenalty(pq)); }

  /** Separator requested for joining: literal, or by concept (virgül / запятая / comma → ", ", tire → "-", boşluk → " ", noktalı virgül → "; "). */
  function separator(pq, dflt) {
    var ls = lits(pq);
    if (ls.length) { var cand = ls.filter(function (l) { return l.value.length <= 3 && !/^[\p{L}\p{N}]+$/u.test(l.value) || /^[,;:\-|\/ ]+$/.test(l.value); })[0]; if (cand) return cand.value; }
    var semi = H.rawHas(pq, /noktal[ıi] virg[uü]l|точк[аиу] с запятой|точкой с запятой|semicolon|semi-colon/);
    if (semi) return '; ';
    if (H.has(pq, 'COMMA') || H.rawHas(pq, /virg[uü]l|запят|comma/)) return ', ';
    if (H.has(pq, 'DASH') || H.rawHas(pq, /\btire|çizgi|дефис|тире|dash|hyphen/)) return '-';
    if (H.rawHas(pq, /alt çizgi|подчерк|underscore/)) return '_';
    if (H.rawHas(pq, /e[gğ]ik çizgi|слеш|slash/)) return '/';
    if (H.rawHas(pq, /dikey çizgi|вертикальн|pipe/)) return '|';
    if (H.rawHas(pq, /yeni sat[ıi]r|перенос строки|new line|line break/)) return null; // CHAR(10)
    if (H.has(pq, 'SPACE') || H.rawHas(pq, /bo[sş]luk|пробел|space/)) return ' ';
    return dflt;
  }
  function sepNode(sep) { return sep === null ? A().func('CHAR', 10) : A().str(sep); }
  function sepLabel(sep, lang) { if (sep === null) return H.pick(T('satır sonu', 'перенос строки', 'line break'), lang); if (sep === ' ') return H.pick(T('boşluk', 'пробел', 'space'), lang); return '“' + sep + '”'; }
  function delimiter(pq) {
    var ls = lits(pq);
    if (ls.length) return ls[0].value;
    if (/@/.test(pq.text) || H.has(pq, 'EMAIL') || H.has(pq, 'DOMAIN')) return '@';
    var toks = pq.tokens || [];
    for (var i = 0; i < toks.length; i++) if (toks[i].type === 'punct' && /^[-_\/|,;:.]$/.test(toks[i].raw) && i > 0 && i < toks.length - 1) return toks[i].raw;
    return null;
  }

  var defs = [];
  /* ------------------------------------------------------------------ LEFT / RIGHT / MID */
  function sideMatch(pq, concept, re) {
    var charWord = H.has(pq, 'CHARACTER') || H.rawHas(pq, CHAR_RE);
    if (H.has(pq, 'WORD') && !charWord) return 0;
    var hit = H.has(pq, concept) || H.rawHas(pq, re);
    if (!hit) return 0;
    if (!charWord && !nums(pq).length) return 0;
    if (H.has(pq, 'MID_CHARS') || H.ords(pq).length) return 0.3;
    return base(pq, nums(pq).length ? 0.9 : 0.55);
  }
  function sideBuild(id, fn, pq, ctx, opts) {
    var cand = H.cand(id, null, {});
    var m = textRef(pq, ctx, cand), ns = nums(pq), n = ns.length ? ns[0].value : null;
    if (n == null) H.miss(cand, 'count', T('Kaç karakter alınacak?', 'Сколько символов взять?', 'How many characters?'));
    cand.ast = A().func(fn, m.cell, n == null ? A().placeholder('count') : A().num(n));
    cand.explain = H.msg(fn === 'LEFT' ? T('%h% metninin baştan %n% karakterini alır.', 'Берёт первые %n% символов из %h%.', 'Takes the first %n% characters of %h%.') : T('%h% metninin sondan %n% karakterini alır.', 'Берёт последние %n% символов из %h%.', 'Takes the last %n% characters of %h%.'), { h: m.ref ? H.label(m.ref) : '…', n: n == null ? 'n' : n });
    cand.target = H.target(pq, ctx, 'fill', m.ref);
    return cand;
  }
  defs.push({ id: 'left_chars', category: 'text', title: T('Baştan N karakter (SOLDAN)', 'Первые N символов (ЛЕВСИМВ)', 'First N characters (LEFT)'),
    examples: { tr: ['Ürün adının ilk 3 karakterini al', 'M2\'nin ilk 5 karakterini al'], ru: ['Первые 3 символа названия товара', 'Первые 5 символов из M2'], en: ['First 3 characters of Product', 'First 5 characters of M2'] },
    match: function (pq) { return sideMatch(pq, 'LEFT_CHARS', /\bilk\b|ba[sş]tan|soldan|перв|слева|\bfirst\b|leftmost|beginning/); },
    build: function (pq, ctx, opts) { return sideBuild('left_chars', 'LEFT', pq, ctx, opts); } });
  defs.push({ id: 'right_chars', category: 'text', title: T('Sondan N karakter (SAĞDAN)', 'Последние N символов (ПРАВСИМВ)', 'Last N characters (RIGHT)'),
    examples: { tr: ['E-postanın son 4 karakteri', 'Ürün adının sağdan 2 karakterini al'], ru: ['Последние 4 символа Email', 'Два символа справа из названия товара'], en: ['Last 4 characters of Email', 'Rightmost 2 characters of Product'] },
    match: function (pq) { return sideMatch(pq, 'RIGHT_CHARS', /\bson\b|sondan|sa[gğ]dan|последн|справа|\blast\b|rightmost|\bend\b/); },
    build: function (pq, ctx, opts) { return sideBuild('right_chars', 'RIGHT', pq, ctx, opts); } });
  defs.push({ id: 'mid_chars', category: 'text', title: T('Ortadan karakter al (PARÇAAL)', 'Символы с позиции (ПСТР)', 'Characters from a position (MID)'),
    examples: { tr: ['Ürün adının 2. karakterinden itibaren 3 karakter al', 'A2\'nin 3. karakterinden başlayarak 4 karakter'], ru: ['Возьми 3 символа из названия товара начиная со 2-го', 'С 3-го символа A2 возьми 4 символа'], en: ['Take 3 characters of Product starting at position 2', '4 characters of A2 from the 3rd character'] },
    match: function (pq) {
      var charWord = H.has(pq, 'CHARACTER') || H.rawHas(pq, CHAR_RE);
      if (!charWord) return 0;
      var hasStart = H.ords(pq).length || H.has(pq, 'MID_CHARS') || H.rawHas(pq, /itibaren|ba[sş]layarak|начиная|starting|from position|from the/);
      if (!hasStart) return 0;
      var total = H.ords(pq).length + nums(pq).length;
      return base(pq, total >= 2 ? 0.92 : 0.6);
    },
    build: function (pq, ctx, opts) {
      var cand = H.cand('mid_chars', null, {});
      var m = textRef(pq, ctx, cand), ords = H.ords(pq), ns = nums(pq);
      var start = null, len = null;
      if (ords.length) start = ords[0].value;
      var rest = ns.filter(function (n) { return !ords.some(function (o) { return o.tokenIndex === n.tokenIndex; }); });
      if (start == null && rest.length >= 2) {
        // "3 symbols starting at 2" (RU/EN) vs "from 2 take 3" (TR): the number next to the start word is the start
        var fromIdx = -1, toks = pq.tokens || [];
        for (var i = 0; i < toks.length; i++) if (/itibaren|ba[sş]layarak|начиная|starting|position|позици/.test(H.fold(toks[i].norm))) { fromIdx = i; break; }
        if (fromIdx >= 0) { var near = rest.slice().sort(function (a, b) { return Math.abs(a.tokenIndex - fromIdx) - Math.abs(b.tokenIndex - fromIdx); })[0]; start = near.value; len = rest.filter(function (n) { return n !== near; })[0].value; }
        else { start = rest[0].value; len = rest[1].value; }
      } else if (rest.length) len = rest[0].value;
      if (start == null) H.miss(cand, 'start', T('Hangi karakterden başlanacak?', 'С какого символа начать?', 'Start at which character?'));
      if (len == null) H.miss(cand, 'length', T('Kaç karakter alınacak?', 'Сколько символов взять?', 'How many characters?'));
      cand.ast = A().func('MID', m.cell, start == null ? A().placeholder('start') : A().num(start), len == null ? A().placeholder('length') : A().num(len));
      cand.explain = H.msg(T('%h% metninin %s%. karakterinden başlayarak %n% karakter alır.', 'Берёт %n% символов из %h%, начиная с %s%-го символа.', 'Takes %n% characters of %h% starting at character %s%.'), { h: m.ref ? H.label(m.ref) : '…', s: start == null ? '…' : start, n: len == null ? '…' : len });
      cand.target = H.target(pq, ctx, 'fill', m.ref);
      return cand;
    } });

  /* ------------------------------------------------------------------ LEN / TRIM / CLEAN / case */
  function unary(id, fn, title, examples, matchFn, tpl, want) {
    defs.push({ id: id, category: 'text', title: title, examples: examples, match: matchFn,
      build: function (pq, ctx, opts) {
        var cand = H.cand(id, null, {});
        var m = textRef(pq, ctx, cand, want);
        cand.ast = A().func(fn, m.cell);
        cand.explain = H.msg(tpl, { h: m.ref ? H.label(m.ref) : '…' });
        cand.target = H.target(pq, ctx, 'fill', m.ref);
        return cand;
      } });
  }
  unary('length', 'LEN', T('Karakter sayısı (UZUNLUK)', 'Длина текста (ДЛСТР)', 'Text length (LEN)'),
    { tr: ['Ad Soyad kaç karakter?', 'Ürün adının uzunluğu'], ru: ['Длина ФИО в символах', 'Сколько символов в названии товара?'], en: ['Length of Full Name', 'Number of characters in Product'] },
    function (pq) { if (H.has(pq, 'LENGTH')) return base(pq, 0.9); if ((H.has(pq, 'CHARACTER') || H.rawHas(pq, CHAR_RE)) && (H.any(pq, ['COUNT', 'QUESTION']) || (pq.flags && pq.flags.question) || H.rawHas(pq, /uzunlu|длин|length|how many/)) && !nums(pq).length) return base(pq, 0.86); return 0; },
    T('%h% metnindeki karakter sayısını verir.', 'Возвращает число символов в %h%.', 'Returns the number of characters in %h%.'));
  unary('trim', 'TRIM', T('Fazla boşlukları temizle (KIRP)', 'Убрать лишние пробелы (СЖПРОБЕЛЫ)', 'Trim extra spaces (TRIM)'),
    { tr: ['Ad Soyad\'daki fazla boşlukları temizle', 'Ürün adındaki gereksiz boşlukları kırp'], ru: ['Убери лишние пробелы в ФИО', 'Удали двойные пробелы в названии товара'], en: ['Trim extra spaces in Full Name', 'Remove double spaces from Product'] },
    function (pq) { if (H.has(pq, 'TRIM')) return base(pq, 0.9); if ((H.has(pq, 'SPACE') || H.rawHas(pq, /bo[sş]luk|пробел|space/)) && H.rawHas(pq, /fazla|gereksiz|çift|лишн|двойн|extra|double|leading|trailing/)) return base(pq, 0.88); return 0; },
    T('%h% metnindeki baştaki, sondaki ve çift boşlukları kaldırır.', 'Удаляет начальные, конечные и двойные пробелы в %h%.', 'Removes leading, trailing and double spaces in %h%.'));
  unary('clean', 'CLEAN', T('Yazdırılamayan karakterleri temizle (TEMİZ)', 'Удалить непечатаемые символы (ПЕЧСИМВ)', 'Remove non-printable characters (CLEAN)'),
    { tr: ['Ürün adındaki yazdırılamayan karakterleri temizle', 'A2\'deki görünmez karakterleri kaldır'], ru: ['Удали непечатаемые символы из названия товара', 'Очисти A2 от служебных символов'], en: ['Remove non-printable characters from Product', 'Clean A2 of control characters'] },
    function (pq) { return H.has(pq, 'CLEAN') || H.rawHas(pq, /yazd[ıi]r[ıi]lamayan|g[oö]r[uü]nmez karakter|непечата|служебн|non-?printable|control char/) ? base(pq, 0.9) : 0; },
    T('%h% metnindeki yazdırılamayan (kontrol) karakterleri kaldırır.', 'Удаляет непечатаемые (управляющие) символы из %h%.', 'Removes non-printable (control) characters from %h%.'));
  unary('upper', 'UPPER', T('Büyük harfe çevir (BÜYÜKHARF)', 'В верхний регистр (ПРОПИСН)', 'To upper case (UPPER)'),
    { tr: ['Şehir sütununu büyük harfe çevir', 'Ürün adını tamamen büyük harf yap'], ru: ['Город прописными буквами', 'Переведи название товара в верхний регистр'], en: ['Convert City to upper case', 'Product in capital letters'] },
    function (pq) { return H.has(pq, 'UPPER') && !H.has(pq, 'PROPER') ? base(pq, 0.9) : 0; },
    T('%h% metnini tamamen büyük harfe çevirir.', 'Переводит %h% в верхний регистр.', 'Converts %h% to upper case.'));
  unary('lower', 'LOWER', T('Küçük harfe çevir (KÜÇÜKHARF)', 'В нижний регистр (СТРОЧН)', 'To lower case (LOWER)'),
    { tr: ['E-postayı küçük harfe çevir', 'Şehir sütununu küçük harf yap'], ru: ['Email строчными буквами', 'Переведи Город в нижний регистр'], en: ['Convert Email to lower case', 'City in lowercase'] },
    function (pq) { return H.has(pq, 'LOWER') && !H.has(pq, 'PROPER') ? base(pq, 0.9) : 0; },
    T('%h% metnini tamamen küçük harfe çevirir.', 'Переводит %h% в нижний регистр.', 'Converts %h% to lower case.'));
  unary('proper', 'PROPER', T('Baş harfleri büyüt (YAZIM.DÜZENİ)', 'Каждое слово с заглавной (ПРОПНАЧ)', 'Capitalise each word (PROPER)'),
    { tr: ['Ad Soyad\'ı baş harfleri büyük yap', 'Şehir adlarının ilk harfini büyüt'], ru: ['ФИО с заглавной буквы каждого слова', 'Город с большой буквы'], en: ['Capitalize each word of Full Name', 'Proper case for City'] },
    function (pq) { return H.has(pq, 'PROPER') || H.rawHas(pq, /ba[sş] harf|ilk harf|с заглавной|с большой буквы|каждое слово с|capitali[sz]e|proper case|title case/) ? base(pq, 0.92) : 0; },
    T('%h% metnindeki her kelimenin ilk harfini büyük, diğerlerini küçük yapar.', 'Делает первую букву каждого слова в %h% заглавной, остальные — строчными.', 'Capitalises the first letter of each word in %h%.'));

  /* ------------------------------------------------------------------ concatenation */
  function concatSignals(pq) { return H.has(pq, 'CONCAT') || H.has(pq, 'JOIN_WITH') || H.wants(pq, ['CONCAT', 'CONCATENATE', 'TEXTJOIN']); }
  defs.push({ id: 'concat_cells', category: 'text', title: T('Hücreleri birleştir', 'Объединить ячейки', 'Join cells'),
    examples: { tr: ['Ürün ve Kategori\'yi aralarında boşluk olacak şekilde birleştir', 'A2 ve B2\'yi tire ile birleştir', 'Şehir ve Ürün\'ü virgül ve boşlukla birleştir'], ru: ['Объедини Товар и Категорию через пробел', 'Объедини A2 и B2 через дефис', 'Объедини Город и Товар через запятую и пробел'], en: ['Join Product and Category with a space', 'Join A2 and B2 with a dash', 'Combine City and Product with a comma'] },
    match: function (pq) {
      if (!concatSignals(pq)) return 0;
      var refs = H.refs(pq, { free: true, sheet: null });
      if (refs.length >= 2) return base(pq, H.wants(pq, 'TEXTJOIN') ? 0.6 : 0.92);
      if (refs.length === 1 && refs[0].kind === 'cell') return base(pq, 0.6);
      return 0;
    },
    build: function (pq, ctx, opts) {
      var cand = H.cand('concat_cells', null, {});
      var refs = H.byPosition(H.refs(pq, { free: true, sheet: null }));
      var sep = separator(pq, ' '), lang = H.lang(pq, opts);
      var nodes = refs.map(function (r) { return H.cellNode(r, ctx); });
      if (nodes.length < 2) { nodes.push(A().placeholder('cell')); H.miss(cand, 'cell', T('Hangi ikinci hücre birleştirilecek?', 'Какую вторую ячейку объединить?', 'Which second cell should be joined?')); }
      var ast = nodes[0];
      for (var i = 1; i < nodes.length; i++) ast = A().op('&', A().op('&', ast, sepNode(sep)), nodes[i]);
      if (sep === '') { ast = nodes[0]; for (var k = 1; k < nodes.length; k++) ast = A().op('&', ast, nodes[k]); }
      cand.ast = ast;
      cand.explain = H.msg(T('%a% değerlerini aralarına %s% koyarak birleştirir.', 'Объединяет %a%, вставляя между ними %s%.', 'Joins %a% with %s% between them.'), { a: refs.map(function (r) { return H.label(r); }).join(' + '), s: sepLabel(sep, lang) });
      cand.target = H.target(pq, ctx, 'fill', refs[0]);
      return cand;
    } });
  defs.push({ id: 'textjoin_range', category: 'text', title: T('Aralığı tek hücrede birleştir (METİNBİRLEŞTİR)', 'Собрать диапазон в одну ячейку (ОБЪЕДИНИТЬ)', 'Join a range into one cell (TEXTJOIN)'),
    examples: { tr: ['Şehir sütunundaki değerleri virgülle tek hücrede birleştir', 'METİNBİRLEŞTİR ile Şehirleri noktalı virgülle birleştir'], ru: ['Объедини все города через запятую в одной ячейке', 'Через ОБЪЕДИНИТЬ собери города через точку с запятой'], en: ['Join all cities with a comma in one cell', 'Use TEXTJOIN to combine Product names with a semicolon'] },
    match: function (pq) {
      if (!concatSignals(pq)) return 0;
      var refs = H.refs(pq, { free: true, sheet: null });
      var ranges = refs.filter(function (r) { return H.isRangeLike(r); });
      if (H.wants(pq, 'TEXTJOIN')) return 0.93;
      if (refs.length === 1 && ranges.length === 1) return 0.9;
      if (H.has(pq, 'JOIN_WITH') || H.rawHas(pq, /tek h[uü]cre|одн(ой|у) ячейк|one cell|single cell|\ball\b|t[uü]m|hepsini|все /)) return refs.length <= 1 ? 0.9 : 0.5;
      return refs.length === 0 ? 0.6 : 0;
    },
    build: function (pq, ctx, opts) {
      var cand = H.cand('textjoin_range', null, {});
      var m = textRef(pq, ctx, cand, { preferHeader: true }), sep = separator(pq, ', '), lang = H.lang(pq, opts);
      cand.ast = A().func('TEXTJOIN', sepNode(sep), A().bool(true), m.node);
      cand.tags.push('2019');
      cand.explain = H.msg(T('%h% içindeki dolu değerleri aralarına %s% koyarak tek metinde birleştirir.', 'Собирает непустые значения %h% в один текст через %s%.', 'Joins the non-empty values of %h% into one text separated by %s%.'), { h: m.ref ? H.label(m.ref) : '…', s: sepLabel(sep, lang) });
      cand.target = H.target(pq, ctx, 'cell', m.ref);
      return cand;
    } });

  /* ------------------------------------------------------------------ SUBSTITUTE / REPLACE */
  defs.push({ id: 'substitute', category: 'text', title: T('Metni değiştir (YERİNEKOY)', 'Заменить текст (ПОДСТАВИТЬ)', 'Replace text (SUBSTITUTE)'),
    examples: { tr: ['Ürün adındaki "Kalem" kelimesini "Pen" ile değiştir', 'Ürün adındaki tüm boşlukları kaldır'], ru: ['Замени в названии товара "Ручка" на "Pen"', 'Удали все пробелы из названия товара'], en: ['Replace "Pen" with "Pencil" in Product', 'Remove all spaces from Product'] },
    match: function (pq) {
      var repl = H.any(pq, ['REPLACE', 'SUBSTITUTE']) || H.wants(pq, 'SUBSTITUTE');
      var ls = replLits(pq, repl);
      var removeSpaces = (H.has(pq, 'SPACE') || H.rawHas(pq, /bo[sş]luk|пробел|space/)) && H.rawHas(pq, REMOVE_RE) && !H.has(pq, 'TRIM');
      if (removeSpaces && !H.rawHas(pq, /fazla|gereksiz|лишн|extra|double/)) return base(pq, 0.92);
      if (repl && ls.length >= 1 && !H.nums(pq, { free: true }).length) return base(pq, 0.92);
      if (H.rawHas(pq, REMOVE_RE) && ls.length === 1) return base(pq, 0.85);
      return 0;
    },
    build: function (pq, ctx, opts) {
      var cand = H.cand('substitute', null, {});
      var ls = replLits(pq, H.any(pq, ['REPLACE', 'SUBSTITUTE']) || H.wants(pq, 'SUBSTITUTE')), lang = H.lang(pq, opts);
      var m = textRef(pq, ctx, cand);
      var oldT, newT;
      if (ls.length >= 2) { oldT = ls[0].value; newT = ls[1].value; }
      else if (ls.length === 1) { oldT = ls[0].value; newT = ''; }
      else { oldT = ' '; newT = ''; }
      // "X yerine Y" / "Y вместо X" word order: the literal right before 'yerine' is the old one; after 'вместо' the old one
      var toks = pq.tokens || [];
      for (var i = 0; i < toks.length && ls.length >= 2; i++) {
        if (/^yerine$/.test(toks[i].norm) && toks[i - 1] && toks[i - 1].type === 'string') { oldT = toks[i - 1].value != null ? toks[i - 1].value : oldT; }
        if (/^вместо$/.test(toks[i].norm) && toks[i + 1] && toks[i + 1].type === 'string') { var o = ls.filter(function (l) { return l.tokenIndex === i + 1; })[0]; if (o) { oldT = o.value; newT = ls.filter(function (l) { return l !== o; })[0].value; } }
      }
      cand.ast = A().func('SUBSTITUTE', m.cell, A().str(oldT), A().str(newT));
      cand.explain = newT === '' ? H.msg(T('%h% metnindeki tüm “%o%” geçişlerini kaldırır.', 'Удаляет все вхождения «%o%» из %h%.', 'Removes every occurrence of “%o%” from %h%.'), { h: m.ref ? H.label(m.ref) : '…', o: oldT === ' ' ? H.pick(T('boşluk', 'пробел', 'space'), lang) : oldT })
        : H.msg(T('%h% metnindeki “%o%” ifadelerini “%n%” ile değiştirir.', 'Заменяет «%o%» на «%n%» в %h%.', 'Replaces “%o%” with “%n%” in %h%.'), { h: m.ref ? H.label(m.ref) : '…', o: oldT, n: newT });
      cand.target = H.target(pq, ctx, 'fill', m.ref);
      return cand;
    } });
  defs.push({ id: 'replace_position', category: 'text', title: T('Konuma göre değiştir (DEĞİŞTİR)', 'Заменить по позиции (ЗАМЕНИТЬ)', 'Replace by position (REPLACE)'),
    examples: { tr: ['A2\'nin 1. karakterinden itibaren 3 karakteri "ABC" ile değiştir', 'Telefonun ilk 2 karakterini "90" yap'], ru: ['Замени в A2 3 символа начиная с 1-го на "ABC"', 'Замени первые 2 символа телефона на "90"'], en: ['Replace 3 characters of A2 starting at position 1 with "ABC"', 'Replace the first 2 characters with "90"'] },
    match: function (pq) {
      var repl = H.any(pq, ['REPLACE', 'SUBSTITUTE']) || H.wants(pq, 'REPLACE') || H.rawHas(pq, /de[gği][sş]tir|замен|replace/);
      if (!repl) return 0;
      var charWord = H.has(pq, 'CHARACTER') || H.rawHas(pq, CHAR_RE);
      if (charWord && (nums(pq).length + H.ords(pq).length) >= 1 && lits(pq).length >= 1) return base(pq, 0.9);
      return 0;
    },
    build: function (pq, ctx, opts) {
      var cand = H.cand('replace_position', null, {});
      var m = textRef(pq, ctx, cand), ords = H.ords(pq), ns = nums(pq), ls = lits(pq);
      var start = ords.length ? ords[0].value : null, len = null;
      var rest = ns.filter(function (n) { return !ords.some(function (o) { return o.tokenIndex === n.tokenIndex; }); });
      if (start == null && rest.length >= 2) { start = rest[0].value; len = rest[1].value; } else if (rest.length) len = rest[0].value;
      if (start == null && H.rawHas(pq, /\bilk\b|перв|first/)) start = 1;
      cand.ast = A().func('REPLACE', m.cell, start == null ? A().placeholder('start') : A().num(start), len == null ? A().placeholder('length') : A().num(len), A().str(ls.length ? ls[ls.length - 1].value : ''));
      cand.explain = H.msg(T('%h% metninde %s%. karakterden başlayan %n% karakteri yeni metinle değiştirir.', 'Заменяет %n% символов в %h%, начиная с позиции %s%, новым текстом.', 'Replaces %n% characters of %h% starting at position %s% with the new text.'), { h: m.ref ? H.label(m.ref) : '…', s: start == null ? '…' : start, n: len == null ? '…' : len });
      cand.target = H.target(pq, ctx, 'fill', m.ref);
      return cand;
    } });

  /* ------------------------------------------------------------------ FIND position */
  defs.push({ id: 'find_text', category: 'text', title: T('Karakter konumu (BUL)', 'Позиция символа (НАЙТИ)', 'Character position (FIND)'),
    examples: { tr: ['E-postada "@" karakteri kaçıncı sırada?', 'Ad Soyad\'da boşluğun konumu'], ru: ['Позиция символа "@" в Email', 'На какой позиции пробел в ФИО?'], en: ['Position of "@" in Email', 'Where is the first space in Full Name?'] },
    match: function (pq) {
      var pos = H.any(pq, ['MATCH_POSITION', 'FIND_TEXT']) || H.wants(pq, ['FIND', 'SEARCH']) || H.rawHas(pq, /ka[cç][ıi]nc[ıi] s[ıi]ra|konum|pozisyon|позици|на каком месте|position of|index of/);
      if (!pos) return 0;
      if (H.any(pq, ['EXTRACT_BEFORE', 'EXTRACT_AFTER', 'FIRST', 'LAST', 'WORD'])) return 0;
      var needle = lits(pq).length || /@/.test(pq.text) || H.rawHas(pq, /bo[sş]lu[gğ]|пробел|space/);
      if (!needle) return 0;
      if (H.sheetRefs(pq).length) return 0.3;
      return base(pq, 0.9);
    },
    build: function (pq, ctx, opts) {
      var cand = H.cand('find_text', null, {});
      var m = textRef(pq, ctx, cand), ls = lits(pq);
      var needle = ls.length ? ls[0].value : (/@/.test(pq.text) ? '@' : ' ');
      cand.ast = A().func('FIND', A().str(needle), m.cell);
      cand.explain = H.msg(T('“%t%” karakterinin %h% içindeki konumunu (kaçıncı karakter) verir.', 'Возвращает позицию «%t%» в %h% (номер символа).', 'Returns the position of “%t%” within %h% (character index).'), { t: needle, h: m.ref ? H.label(m.ref) : '…' });
      cand.target = H.target(pq, ctx, 'fill', m.ref);
      return cand;
    } });

  /* ------------------------------------------------------------------ first / last word */
  defs.push({ id: 'first_word', category: 'text', title: T('İlk kelime', 'Первое слово', 'First word'),
    examples: { tr: ['Ad Soyad\'dan ilk kelimeyi al', 'Ürün adının ilk kelimesi'], ru: ['Первое слово из ФИО', 'Первое слово названия товара'], en: ['First word of Full Name', 'First word of Product'] },
    match: function (pq) { return (H.has(pq, 'WORD') || H.rawHas(pq, /kelime|s[oö]zc[uü]k|слов[оа]|\bword\b/)) && (H.has(pq, 'FIRST') || H.rawHas(pq, /\bilk\b|перв|first/)) && !(H.has(pq, 'LAST') && !H.has(pq, 'FIRST')) ? base(pq, 0.92) : 0; },
    build: function (pq, ctx, opts) {
      var cand = H.cand('first_word', null, {});
      var m = textRef(pq, ctx, cand);
      cand.ast = A().func('LEFT', m.cell, A().op('-', A().func('FIND', A().str(' '), A().op('&', m.cell, A().str(' '))), 1));
      cand.explain = H.msg(T('%h% metninin ilk boşluğa kadar olan kısmını (ilk kelime) verir.', 'Возвращает часть %h% до первого пробела (первое слово).', 'Returns the part of %h% before the first space (the first word).'), { h: m.ref ? H.label(m.ref) : '…' });
      cand.target = H.target(pq, ctx, 'fill', m.ref);
      return cand;
    } });
  defs.push({ id: 'last_word', category: 'text', title: T('Son kelime', 'Последнее слово', 'Last word'),
    examples: { tr: ['Ad Soyad\'dan son kelimeyi al', 'Ad Soyad\'dan soyadı al'], ru: ['Последнее слово из ФИО', 'Последнее слово названия товара'], en: ['Last word of Full Name', 'Last word of Product'] },
    match: function (pq) { return (H.has(pq, 'WORD') || H.rawHas(pq, /kelime|s[oö]zc[uü]k|слов[оа]|\bword\b/)) && (H.has(pq, 'LAST') || H.rawHas(pq, /\bson\b|последн|\blast\b/)) ? base(pq, 0.92) : 0; },
    build: function (pq, ctx, opts) {
      var cand = H.cand('last_word', null, {});
      var m = textRef(pq, ctx, cand);
      cand.ast = A().func('TRIM', A().func('RIGHT', A().func('SUBSTITUTE', m.cell, A().str(' '), A().func('REPT', A().str(' '), 100)), 100));
      cand.explain = H.msg(T('%h% metninin son boşluktan sonraki kısmını (son kelime) verir.', 'Возвращает часть %h% после последнего пробела (последнее слово).', 'Returns the part of %h% after the last space (the last word).'), { h: m.ref ? H.label(m.ref) : '…' });
      cand.target = H.target(pq, ctx, 'fill', m.ref);
      return cand;
    } });

  /* ------------------------------------------------------------------ text before / after a delimiter */
  function beforeAfter(id, which) {
    return { id: id, category: 'text', title: which === 'before' ? T('Ayırıcıdan önceki metin', 'Текст до разделителя', 'Text before a delimiter') : T('Ayırıcıdan sonraki metin', 'Текст после разделителя', 'Text after a delimiter'),
      examples: which === 'before' ? { tr: ['E-postadan @ öncesini al', 'A2\'de "-" işaretinden önceki kısmı al'], ru: ['Возьми часть email до @', 'Часть A2 до символа "-"'], en: ['Get the part of Email before @', 'Text of A2 before "-"'] }
        : { tr: ['E-postanın @ sonrasını (alan adını) al', 'A2\'de "-" işaretinden sonraki kısmı al'], ru: ['Домен из email (часть после @)', 'Часть A2 после символа "-"'], en: ['Get the domain after @ from Email', 'Text of A2 after "-"'] },
      match: function (pq) {
        var c = which === 'before' ? (H.has(pq, 'EXTRACT_BEFORE') || H.rawHas(pq, /[oö]nces|[oö]nceki|(^|[^а-яё])до([^а-яё]|$)|\bbefore\b/) || H.rawHas(pq, USERNAME_RE)) : (H.has(pq, 'EXTRACT_AFTER') || H.rawHas(pq, /sonras|sonraki|(^|[^а-яё])после([^а-яё]|$)|\bafter\b/) || H.has(pq, 'DOMAIN') || H.rawHas(pq, DOMAIN_RE));
        if (!c) return 0;
        if (H.any(pq, ['TODAY', 'DATE_DIFF', 'ADD_DAYS', 'ADD_MONTHS', 'DEADLINE', 'ELAPSED']) || H.refs(pq, {}).some(function (r) { return r.type === 'date'; })) return 0;
        if (!delimiter(pq)) return 0;
        if (which === 'before' && (H.has(pq, 'DOMAIN') || H.rawHas(pq, DOMAIN_RE)) && !H.has(pq, 'EXTRACT_BEFORE')) return 0;
        return base(pq, 0.92);
      },
      build: function (pq, ctx, opts) {
        var cand = H.cand(id, null, {});
        var m = textRef(pq, ctx, cand), d = delimiter(pq) || '@', modern = H.modern(opts) && !H.wants(pq, ['LEFT', 'MID', 'FIND']);
        var dn = A().str(d), ast;
        if (modern) { ast = A().func(which === 'before' ? 'TEXTBEFORE' : 'TEXTAFTER', m.cell, dn); cand.tags.push('365'); }
        else if (which === 'before') ast = A().func('LEFT', m.cell, A().op('-', A().func('FIND', dn, m.cell), 1));
        else ast = A().func('MID', m.cell, A().op('+', A().func('FIND', dn, m.cell), 1), 255);
        cand.ast = ast;
        cand.explain = H.msg(which === 'before' ? T('%h% metninin “%d%” işaretinden önceki kısmını verir.', 'Возвращает часть %h% до «%d%».', 'Returns the part of %h% before “%d%”.') : T('%h% metninin “%d%” işaretinden sonraki kısmını verir.', 'Возвращает часть %h% после «%d%».', 'Returns the part of %h% after “%d%”.'), { h: m.ref ? H.label(m.ref) : '…', d: d });
        cand.target = H.target(pq, ctx, 'fill', m.ref);
        var alt = which === 'before' ? A().func('LEFT', m.cell, A().op('-', A().func('FIND', dn, m.cell), 1)) : A().func('MID', m.cell, A().op('+', A().func('FIND', dn, m.cell), 1), 255);
        if (modern) cand.alternatives = [H.cand(id, alt, { confidence: 0.6, explain: cand.explain, target: cand.target })];
        return cand;
      } };
  }
  defs.push(beforeAfter('text_before', 'before'));
  defs.push(beforeAfter('text_after', 'after'));

  /* ------------------------------------------------------------------ VALUE / TEXT / REPT */
  defs.push({ id: 'to_number', category: 'text', title: T('Metni sayıya çevir (SAYIYAÇEVİR)', 'Текст в число (ЗНАЧЕН)', 'Text to number (VALUE)'),
    examples: { tr: ['Adet sütunundaki metni sayıya çevir', 'A2\'yi sayıya dönüştür'], ru: ['Преобразуй текст в столбце Кол-во в число', 'Переведи A2 в число'], en: ['Convert the text in Quantity to a number', 'Turn A2 into a number'] },
    match: function (pq) { return H.has(pq, 'TO_NUMBER') || H.wants(pq, 'VALUE') || H.rawHas(pq, /say[ıi]ya (çevir|d[oö]n[uü][sş]t[uü]r)|в число|to (a )?number|as (a )?number/) ? base(pq, 0.92) : 0; },
    build: function (pq, ctx, opts) {
      var cand = H.cand('to_number', null, {});
      var m = H.mainRef(pq, ctx, cand, { type: ['text', 'number'] });
      cand.ast = A().func('VALUE', m.cell);
      cand.explain = H.msg(T('%h% içindeki metin biçimli sayıyı gerçek sayıya çevirir.', 'Преобразует число, записанное как текст в %h%, в настоящее число.', 'Converts the text-formatted number in %h% to a real number.'), { h: m.ref ? H.label(m.ref) : '…' });
      cand.target = H.target(pq, ctx, 'fill', m.ref);
      return cand;
    } });
  defs.push({ id: 'to_text', category: 'text', title: T('Biçimli metne çevir (METNEÇEVİR)', 'В текст с форматом (ТЕКСТ)', 'Format as text (TEXT)'),
    examples: { tr: ['Tutarı iki ondalıklı metne çevir', 'Tarihi gg.aa.yyyy biçiminde metne çevir'], ru: ['Преобразуй Сумму в текст с двумя знаками после запятой', 'Дата в виде текста дд.мм.гггг'], en: ['Convert Amount to text with two decimals', 'Date as text dd.mm.yyyy'] },
    match: function (pq) { if (H.has(pq, 'TO_TEXT') || H.wants(pq, 'TEXT') || H.rawHas(pq, /metne (çevir|d[oö]n[uü][sş]t[uü]r)|в текст|to text|as text/)) return base(pq, 0.92); if (H.has(pq, 'TEXT_FORMAT') && !H.any(pq, ['ROUND', 'ROUND_UP', 'ROUND_DOWN'])) return base(pq, 0.6); return 0; },
    build: function (pq, ctx, opts) {
      var cand = H.cand('to_text', null, {});
      var m = H.mainRef(pq, ctx, cand, { type: ['number', 'date'] });
      var ls = lits(pq), fmt = null;
      if (ls.length) fmt = ls[0].value;
      if (!fmt && m.ref && m.ref.type === 'date') fmt = 'dd.mm.yyyy';
      if (!fmt) {
        var ns = nums(pq), dec = ns.length ? ns[0].value : (H.rawHas(pq, /iki|два|двумя|two/) ? 2 : H.rawHas(pq, /\b(bir|один|одним|one)\b/) ? 1 : H.rawHas(pq, /[uü]ç|три|тремя|three/) ? 3 : 2);
        fmt = dec > 0 ? '0.' + new Array(dec + 1).join('0') : '0';
      }
      cand.ast = A().func('TEXT', m.cell, A().str(fmt));
      cand.explain = H.msg(T('%h% değerini “%f%” biçiminde metne çevirir.', 'Преобразует %h% в текст в формате «%f%».', 'Converts %h% to text using the “%f%” format.'), { h: m.ref ? H.label(m.ref) : '…', f: fmt });
      cand.target = H.target(pq, ctx, 'fill', m.ref);
      return cand;
    } });
  defs.push({ id: 'repeat', category: 'text', title: T('Metni tekrarla (YİNELE)', 'Повторить текст (ПОВТОР)', 'Repeat text (REPT)'),
    examples: { tr: ['"-" karakterini 10 kez tekrarla', 'Yıldızı Adet kadar tekrarla'], ru: ['Повтори "-" 10 раз', 'Повтори звёздочку столько раз, сколько в Кол-во'], en: ['Repeat "-" 10 times', 'Repeat "*" Quantity times'] },
    match: function (pq) { return (H.has(pq, 'REPEAT') || H.wants(pq, 'REPT') || H.rawHas(pq, /tekrarla|yinele|повтори|repeat/)) && !H.has(pq, 'DUPLICATE') && (lits(pq).length || nums(pq).length) ? base(pq, 0.9) : 0; },
    build: function (pq, ctx, opts) {
      var cand = H.cand('repeat', null, {});
      var ls = lits(pq), ns = nums(pq), refs = H.refs(pq, { free: true, sheet: null });
      var textNode = ls.length ? A().str(ls[0].value) : (refs.length > 1 ? H.cellNode(refs[0], ctx) : A().str('*'));
      var countNode = ns.length ? A().num(ns[0].value) : (refs.length ? H.cellNode(refs[refs.length - 1], ctx) : A().placeholder('count'));
      if (!ns.length && !refs.length) H.miss(cand, 'count', T('Kaç kez tekrarlanacak?', 'Сколько раз повторить?', 'How many times?'));
      cand.ast = A().func('REPT', textNode, countNode);
      cand.explain = H.msg(T('Metni %n% kez yan yana tekrarlar.', 'Повторяет текст %n% раз подряд.', 'Repeats the text %n% times.'), { n: H.serializeEN(countNode).slice(1) });
      cand.target = H.target(pq, ctx, refs.length ? 'fill' : 'cell', refs[0] || null);
      return cand;
    } });

  I.register(defs);
  return defs;
});
