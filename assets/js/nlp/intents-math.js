/* Formula Studio — math intents: percentages (percent of, increase, decrease / discount, VAT, share of total,
 * percent change), rounding, ABS / INT / MOD / POWER / SQRT, running total, SUMPRODUCT and the four arithmetic
 * operations between two columns or cells. Registers into EFS.intents. */
(function (root, factory) {
  var EFS = root.EFS || (root.EFS = {});
  var api = factory(EFS, root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (EFS, root) {
  'use strict';
  var I = EFS.intents, H = I.helpers, T = H.T;
  function A() { return EFS.ast; }

  var INC_RE = /art[ıi]r|artt[ıi]r|fazlas[ıi]|fazla(s[ıi]n[ıi])?\b|zam|y[uü]kselt|увелич|повы[сш]|больше на|плюс|прибав|надбав|increase|raise|\bmore\b|\bplus\b|mark ?up|\badd\b/;
  var DEC_RE = /azalt|eksi[gğ]i|eksi(k|ğ)|d[uü][sş][uü]r|indirim|iskonto|уменьш|сниз|скидк|меньше на|минус|убав|decrease|reduce|discount|\bless\b|minus|mark ?down/;
  var VAT_RE = /\bkdv\b|\bндс\b|\bvat\b|value added tax/;
  var SHARE_RE = /pay[ıi]?\b|pay[ıi]n[ıi]|oran[ıi]\b|y[uü]zdesi|дол[яю]|доли|удельн|процент (от )?(общ|итог|всех)|\bshare\b|proportion|percentage of (the )?total|of the total/;
  var CHANGE_RE = /de[gğ]i[sş]im|art[ıi][sş] oran|b[uü]y[uü]me|изменен|прирост|рост|динамик|change|growth|delta/;
  var ROUND_RE = /yuvarla|округл|\bround/;
  var INT_RE = /tam ?say[ıi]|целого|целое|целой|целая часть|whole number|integer|\bint\b/;
  var RUNNING_RE = /k[uü]m[uü]latif|k[uü]m[uü]le|birikimli|y[uü]r[uü]yen|нарастающ|накопит|running total|cumulative/;
  var POWER_RE = /\bkare(si|sini)?\b|\bk[uü]p([uü]n[uü])?\b|[uü]ss[uü]|kuvvet|квадрат|(^|[^а-яё])куб|степен|square|\bcube|power|raised to|\^/;
  var MUL_RE = /[cç]arp|умнож|произведен|multipl|\btimes\b/, DIV_RE = /\bb[oö]l|раздели|делить|делени|divid|\bratio of/, ADD_RE = /\bart[ıi]\b|\bплюс\b|сложи|\bplus\b|\badd\b/, SUB_RE = /[cç][ıi]kar|\beksi\b|fark|минус|вычти|вычесть|отними|разниц|разность|subtract|minus|difference/;

  function numRef(pq, ctx, cand, want) {
    want = want || {};
    var pool = H.byPosition(H.refs(pq, { sheet: null, free: true }));
    if (!pool.length) pool = H.byPosition(H.refs(pq, { sheet: null }));
    // the operation word first ("Скидка 20% на Сумму": Скидка is the operation, Сумма the operand), then aggregate words
    pool = H.withoutOpRefs(pq, pool, ['DISCOUNT', 'VAT', 'PERCENT', 'SHARE', 'INCREASE', 'DECREASE', 'TAX']);
    if (pool.length > 1) { var noOpHdr = pool.filter(function (r) { return !(r.source === 'header' && OP_HEADER_RE.test(H.fold(r.headerName || ''))); }); if (noOpHdr.length) pool = noOpHdr; }
    pool = H.withoutOpRefs(pq, pool, ['SUM', 'TOTAL']);
    return H.mainRef(pq, ctx, cand, { type: want.type || 'number', pool: pool, slot: 'number', cellSlot: 'cell' });
  }
  // "çarpımlarının toplamı", "сумма произведений", "sum of the products"
  var SUMPROD_RE = /[cç]arp[ıi]m(lar)?[ıi]n[ıi]n toplam|сумм\S* произведени|sum of (the )?products/;
  var OP_HEADER_RE = /indirim|iskonto|kdv|vergi|скидк|ндс|налог|discount|vat|tax/;
  function label(m) { return m.ref ? H.label(m.ref) : '…'; }
  function pct(pq) { return H.nums(pq, { free: true, percent: true }); }
  function plain(pq) { return H.nums(pq, { free: true, percent: false, noDate: true }); }
  function operandRefs(pq) {
    var refs = H.byPosition(H.refs(pq, { sheet: null, free: true }));
    if (H.targetIsOperand(pq)) { refs.push(pq.target.ref); refs = H.byPosition(refs); }
    var pair = H.pairFromRange(pq);
    if (pair) refs = refs.filter(function (r) { return !(r.kind === 'range' && r.row === r.row2 && r.col !== r.col2 && r.source === 'explicit'); }).concat(pair).sort(function (a, b) { return a.tokenIndex - b.tokenIndex; });
    // the same column mentioned twice ("İndirim tutarını") is one operand
    var seen = {}, out = [];
    refs.forEach(function (r) { var key = (r.sheet || '') + '!' + r.text; if (seen[key] && r.source === 'header') return; seen[key] = true; out.push(r); });
    return out;
  }
  function operands(pq, ctx) {
    var refs = operandRefs(pq);
    var out = refs.map(function (r) { return { at: r.tokenIndex, node: H.cellNode(r, ctx), ref: r, isRange: H.isRangeLike(r) }; });
    var errIdx = H.wantsIfError(pq) ? H.idx(pq, 'IFERROR') : -1;
    plain(pq).forEach(function (n) { if (errIdx >= 0 && n.tokenIndex > errIdx) return; out.push({ at: n.tokenIndex, node: A().num(n.value), num: n.value }); });
    out.sort(function (a, b) { return a.at - b.at; });
    return out;
  }
  function logicPenalty(pq) { return (H.has(pq, 'IF') && (pq.thenValue || pq.elseValue || H.has(pq, 'ELSE'))) || H.conds(pq).length ? 0.5 : 0; }
  function fill(id, pq, ctx, m, ast, explain, tags) { return H.cand(id, ast, { explain: explain, target: H.target(pq, ctx, 'fill', m.ref), tags: tags || [] }); }
  var defs = [];

  /* ------------------------------------------------------------------ percentages */
  defs.push({ id: 'percent_of', category: 'math', title: T('Değerin yüzdesi', 'Процент от значения', 'Percent of a value'),
    examples: { tr: ['Tutarın %10\'unu hesapla', 'Birim Fiyat\'ın yüzde 5\'i'], ru: ['10% от Суммы', '5 процентов от Цены'], en: ['10% of Amount', '5 percent of Unit Price'] },
    match: function (pq) {
      if (!pct(pq).length) return 0;
      if (H.rawHas(pq, VAT_RE) || H.rawHas(pq, INC_RE) || H.rawHas(pq, DEC_RE) || H.any(pq, ['INCREASE', 'DECREASE', 'DISCOUNT', 'VAT', 'LOAN', 'INTEREST_RATE', 'NPV', 'PAYMENT'])) return 0;
      if (H.rawHas(pq, /faiz|годовых|ставк|interest|rate|кредит|kredi|loan/)) return 0;
      if (H.has(pq, 'SHARE') || H.rawHas(pq, SHARE_RE)) return 0.3;
      return H.clamp(0.9 - logicPenalty(pq));
    },
    build: function (pq, ctx, opts) {
      var cand = H.cand('percent_of', null, {}), m = numRef(pq, ctx, cand), p = pct(pq)[0].value;
      return fill('percent_of', pq, ctx, m, A().op('*', m.cell, A().percent(p)), H.msg(T('%h% değerinin %%%p%\'unu hesaplar.', 'Вычисляет %p%%% от %h%.', 'Calculates %p%%% of %h%.'), { h: label(m), p: p }));
    } });
  defs.push({ id: 'increase_percent', category: 'math', title: T('Yüzde artır', 'Увеличить на процент', 'Increase by a percentage'),
    examples: { tr: ['Tutarı %15 artır', 'Tutarın %10 fazlası'], ru: ['Увеличь Сумму на 15%', 'Сумма плюс 10%'], en: ['Increase Amount by 15%', 'Amount plus 10%'] },
    match: function (pq) {
      if (!pct(pq).length || H.rawHas(pq, VAT_RE)) return 0;
      if (!(H.any(pq, ['INCREASE', 'PLUS']) || H.rawHas(pq, INC_RE))) return 0;
      if (H.rawHas(pq, DEC_RE) && !H.rawHas(pq, INC_RE)) return 0;
      if (H.rawHas(pq, /faiz|годовых|кредит|kredi|loan|interest/)) return 0;
      return H.clamp(0.92 - logicPenalty(pq));
    },
    build: function (pq, ctx, opts) {
      var cand = H.cand('increase_percent', null, {}), m = numRef(pq, ctx, cand), p = pct(pq)[0].value;
      return fill('increase_percent', pq, ctx, m, A().op('*', m.cell, A().op('+', 1, A().percent(p))), H.msg(T('%h% değerini %%%p% artırır.', 'Увеличивает %h% на %p%%%.', 'Increases %h% by %p%%%.'), { h: label(m), p: p }));
    } });
  defs.push({ id: 'decrease_percent', category: 'math', title: T('Yüzde azalt / indirim', 'Уменьшить на процент / скидка', 'Decrease by a percentage / discount'),
    examples: { tr: ['Tutara %20 indirim uygula', 'Birim Fiyat\'ın %5 eksiği', 'Tutar sütununu yüzde 10 azalt'], ru: ['Скидка 20% на Сумму', 'Цена минус 5%', 'Уменьши Сумму на 10%'], en: ['Apply a 20% discount to Amount', 'Unit Price minus 5%', 'Reduce Amount by 10%'] },
    match: function (pq) {
      if (!pct(pq).length || H.rawHas(pq, VAT_RE)) return 0;
      if (!(H.any(pq, ['DECREASE', 'DISCOUNT', 'MINUS']) || H.rawHas(pq, DEC_RE))) return 0;
      if (H.rawHas(pq, INC_RE) && !H.rawHas(pq, DEC_RE)) return 0;
      return H.clamp(0.92 - logicPenalty(pq));
    },
    build: function (pq, ctx, opts) {
      var cand = H.cand('decrease_percent', null, {}), m = numRef(pq, ctx, cand), p = pct(pq)[0].value;
      var isDiscount = H.has(pq, 'DISCOUNT') || H.rawHas(pq, /indirim|iskonto|скидк|discount/);
      return fill(isDiscount ? 'discount' : 'decrease_percent', pq, ctx, m, A().op('*', m.cell, A().op('-', 1, A().percent(p))), H.msg(isDiscount ? T('%h% değerine %%%p% indirim uygular.', 'Применяет скидку %p%%% к %h%.', 'Applies a %p%%% discount to %h%.') : T('%h% değerini %%%p% azaltır.', 'Уменьшает %h% на %p%%%.', 'Decreases %h% by %p%%%.'), { h: label(m), p: p }));
    } });
  defs.push({ id: 'vat', category: 'math', title: T('KDV ekle / KDV tutarı', 'Добавить НДС / сумма НДС', 'Add VAT / VAT amount'),
    examples: { tr: ['Tutara KDV ekle', 'Tutarın KDV\'sini hesapla', 'Tutara %18 KDV ekle'], ru: ['Добавь НДС к Сумме', 'Сумма НДС от Суммы', 'Добавь НДС 10% к Сумме'], en: ['Add 20% VAT to Amount', 'VAT amount of Amount', 'Amount without VAT'] },
    match: function (pq) { return H.has(pq, 'VAT') || H.rawHas(pq, VAT_RE) ? H.clamp(0.93 - logicPenalty(pq)) : 0; },
    build: function (pq, ctx, opts) {
      var cand = H.cand('vat', null, {}), m = numRef(pq, ctx, cand);
      var ps = pct(pq), rate = ps.length ? ps[0].value : 20;
      if (!ps.length) H.assume(cand, T('KDV oranı %20 varsayıldı.', 'Ставка НДС принята 20%.', 'Assumed a VAT rate of 20%.'), {});
      var remove = H.rawHas(pq, /hari[cç]|[cç][ıi]kar|ay[ıi]r|без ндс|вычти|убери|исключ|выдели|without|exclude|remove|net of|strip/);
      var amount = H.rawHas(pq, /kdv[’']?(si|sini|yi|si\b)|kdv tutar|kdv miktar|сумм[аыу] ндс|ндс от|размер ндс|vat amount|the vat|amount of vat/) && !H.rawHas(pq, /ekle|dahil|добав|прибав|включ|\badd\b|includ|with vat/);
      var ast, tpl, factor = Math.round((1 + rate / 100) * 10000) / 10000;
      if (remove && !amount) { ast = A().op('/', m.cell, factor); tpl = T('%h% değerinden %%%p% KDV\'yi ayırır (KDV hariç tutar).', 'Выделяет сумму без НДС %p%%% из %h%.', 'Removes %p%%% VAT from %h% (net amount).'); cand.intent = 'vat_remove'; }
      else if (amount) { ast = A().op('*', m.cell, A().percent(rate)); tpl = T('%h% değerinin %%%p% KDV tutarını hesaplar.', 'Вычисляет сумму НДС %p%%% от %h%.', 'Calculates the %p%%% VAT amount of %h%.'); cand.intent = 'vat_amount'; }
      else { ast = A().op('*', m.cell, factor); tpl = T('%h% değerine %%%p% KDV ekler.', 'Добавляет НДС %p%%% к %h%.', 'Adds %p%%% VAT to %h%.'); }
      cand.ast = ast; cand.explain = H.msg(tpl, { h: label(m), p: rate }); cand.target = H.target(pq, ctx, 'fill', m.ref);
      return cand;
    } });
  defs.push({ id: 'share_of_total', category: 'math', title: T('Toplam içindeki pay', 'Доля от общего итога', 'Share of the total'),
    examples: { tr: ['Tutarın toplam içindeki payı', 'Tutarın tüm tutarlar içindeki yüzdesi'], ru: ['Доля суммы от общего итога', 'Процент суммы от общей суммы всех продаж'], en: ['Share of Amount in the total', 'Percentage of each Amount in the total'] },
    match: function (pq) {
      var share = H.any(pq, ['SHARE', 'RATIO']) || H.rawHas(pq, SHARE_RE);
      if (!share) return 0;
      if (pct(pq).length && !H.rawHas(pq, /toplam|итог|общ|total|all /)) return 0;
      if (H.rawHas(pq, CHANGE_RE)) return 0;
      return H.clamp(0.92 - logicPenalty(pq));
    },
    build: function (pq, ctx, opts) {
      var cand = H.cand('share_of_total', null, {}), m = numRef(pq, ctx, cand);
      var total = m.placeholder ? A().placeholder('range') : H.rangeNode(m.ref, true);
      return fill('share_of_total', pq, ctx, m, A().op('/', m.cell, A().func('SUM', total)), H.msg(T('%h% değerinin sütun toplamı içindeki payını (oran) verir; yüzde olarak biçimlendirin.', 'Возвращает долю %h% в сумме столбца; отформатируйте как процент.', 'Returns the share of %h% in the column total; format it as a percentage.'), { h: label(m) }));
    } });
  defs.push({ id: 'percent_change', category: 'math', title: T('Yüzde değişim', 'Процент изменения', 'Percent change'),
    examples: { tr: ['D2\'den E2\'ye yüzde değişim', 'B2\'nin A2\'ye göre yüzde değişimi'], ru: ['Процент изменения от D2 к E2', 'Процент изменения B2 относительно A2'], en: ['Percent change from D2 to E2', 'Percentage change of B2 compared to A2'] },
    match: function (pq) {
      var sig = H.has(pq, 'PERCENT_CHANGE') || ((H.has(pq, 'PERCENT') || H.rawHas(pq, /y[uü]zde|процент|percent/)) && H.rawHas(pq, CHANGE_RE));
      if (!sig) return 0;
      return operandRefs(pq).length >= 2 ? 0.93 : 0.6;
    },
    build: function (pq, ctx, opts) {
      var cand = H.cand('percent_change', null, {});
      var refs = operandRefs(pq), toks = pq.tokens || [];
      var a = refs[0] || null, b = refs[1] || null;
      if (!a) { var m = numRef(pq, ctx, cand); a = m.ref; }
      if (!b) { H.miss(cand, 'cell', T('Hangi iki değer karşılaştırılacak?', 'Какие два значения сравнить?', 'Which two values should be compared?')); }
      var baseFirst = false;
      if (a && b) {
        var rawA = (toks[a.tokenIndex] || {}).raw || '', prevA = toks[a.tokenIndex - 1], prevB = toks[b.tokenIndex - 1];
        if (/[’'](den|dan|ten|tan)$/i.test(rawA) || (prevA && /^(от|from|из)$/.test(H.fold(prevA.norm)))) baseFirst = true;   // "D2'den E2'ye", "от D2 к E2"
        if (H.rawHas(pq, /g[oö]re|относительно|по сравнению|compared|relative/) || (prevB && /^(к|to)$/.test(H.fold(prevB.norm)) && !baseFirst)) baseFirst = baseFirst && !H.rawHas(pq, /g[oö]re|относительно|по сравнению|compared|relative/);
      }
      var oldN = baseFirst ? H.cellNode(a, ctx) : (b ? H.cellNode(b, ctx) : A().placeholder('cell')), newN = baseFirst ? (b ? H.cellNode(b, ctx) : A().placeholder('cell')) : H.cellNode(a, ctx);
      cand.ast = A().op('/', A().op('-', newN, oldN), oldN);
      cand.explain = H.msg(T('%o% değerinden %n% değerine yüzde değişimi verir: (yeni − eski) / eski.', 'Возвращает процент изменения от %o% к %n%: (новое − старое) / старое.', 'Returns the percent change from %o% to %n%: (new − old) / old.'), { o: H.serializeEN(oldN).slice(1), n: H.serializeEN(newN).slice(1) });
      cand.target = H.target(pq, ctx, 'fill', a);
      return cand;
    } });

  /* ------------------------------------------------------------------ rounding / INT / ABS / MOD / POWER / SQRT */
  defs.push({ id: 'round', category: 'math', title: T('Yuvarla (YUVARLA / YUKARIYUVARLA / AŞAĞIYUVARLA)', 'Округлить (ОКРУГЛ / ОКРУГЛВВЕРХ / ОКРУГЛВНИЗ)', 'Round (ROUND / ROUNDUP / ROUNDDOWN)'),
    examples: { tr: ['Tutarı 2 ondalığa yuvarla', 'Tutarı tam sayıya yukarı yuvarla', 'Tutarı 1 ondalığa aşağı yuvarla'], ru: ['Округли Сумму до 2 знаков', 'Округли Сумму вверх до целого', 'Округли Сумму вниз до 1 знака'], en: ['Round Amount to 2 decimals', 'Round Amount up to a whole number', 'Round Amount down to 1 decimal'] },
    match: function (pq) {
      var roundWord = H.has(pq, 'ROUND') || H.wants(pq, ['ROUND', 'ROUNDUP', 'ROUNDDOWN', 'MROUND']) || H.rawHas(pq, ROUND_RE);
      if (!roundWord && H.any(pq, ['ROUND_UP', 'ROUND_DOWN']) && H.rawHas(pq, /yuvarla|округл|round|ceil|floor/)) roundWord = true;
      return roundWord ? H.clamp(0.93 - logicPenalty(pq)) : 0;
    },
    build: function (pq, ctx, opts) {
      var cand = H.cand('round', null, {}), m = numRef(pq, ctx, cand);
      var up = H.has(pq, 'ROUND_UP') || H.wants(pq, 'ROUNDUP') || H.rawHas(pq, /yukar[ıi]|вверх|\bup\b|ceiling/);
      var down = H.has(pq, 'ROUND_DOWN') || H.wants(pq, 'ROUNDDOWN') || H.rawHas(pq, /a[sş]a[gğ][ıi]|вниз|\bdown\b|floor/);
      var ns = plain(pq), digits;
      var nearest = (H.any(pq, ['NEAREST', 'MULTIPLE']) || H.rawHas(pq, /en yak[ıi]n|kat[ıi]na|ближайш|кратн|nearest|multiple of/)) && ns.length && ns[0].value >= 5;
      if (nearest) {
        cand.ast = A().func(up ? 'CEILING.MATH' : down ? 'FLOOR.MATH' : 'MROUND', m.cell, ns[0].value);
        cand.intent = 'round_to_multiple';
        cand.explain = H.msg(T('%h% değerini en yakın %n% katına yuvarlar.', 'Округляет %h% до ближайшего кратного %n%.', 'Rounds %h% to the nearest multiple of %n%.'), { h: label(m), n: ns[0].value });
        cand.target = H.target(pq, ctx, 'fill', m.ref);
        return cand;
      }
      if (ns.length) digits = ns[0].value;
      else if (H.has(pq, 'INT') || H.rawHas(pq, INT_RE)) digits = 0;
      else if (H.rawHas(pq, /\biki\b|два|двух|двумя|\btwo\b/)) digits = 2;
      else if (H.rawHas(pq, /\bbir\b|один|одного|\bone\b/)) digits = 1;
      else if (H.rawHas(pq, /\b[uü][cç]\b|три|трёх|трех|\bthree\b/)) digits = 3;
      else { digits = 2; H.assume(cand, T('2 ondalık basamak varsayıldı.', 'Принято 2 знака после запятой.', 'Assumed 2 decimal places.'), {}); }
      var fn = up ? 'ROUNDUP' : down ? 'ROUNDDOWN' : 'ROUND';
      cand.intent = up ? 'round_up' : down ? 'round_down' : 'round';
      cand.ast = A().func(fn, m.cell, digits);
      cand.explain = H.msg(up ? T('%h% değerini %d% ondalık basamağa yukarı yuvarlar.', 'Округляет %h% вверх до %d% знаков.', 'Rounds %h% up to %d% decimal places.') : down ? T('%h% değerini %d% ondalık basamağa aşağı yuvarlar.', 'Округляет %h% вниз до %d% знаков.', 'Rounds %h% down to %d% decimal places.') : T('%h% değerini %d% ondalık basamağa yuvarlar.', 'Округляет %h% до %d% знаков после запятой.', 'Rounds %h% to %d% decimal places.'), { h: label(m), d: digits });
      cand.target = H.target(pq, ctx, 'fill', m.ref);
      return cand;
    } });
  function simple(id, fn, title, examples, matchFn, tpl) {
    defs.push({ id: id, category: 'math', title: title, examples: examples, match: matchFn,
      build: function (pq, ctx, opts) { var cand = H.cand(id, null, {}), m = numRef(pq, ctx, cand); return fill(id, pq, ctx, m, A().func(fn, m.cell), H.msg(tpl, { h: label(m) })); } });
  }
  simple('int', 'INT', T('Tam sayı kısmı (TAMSAYI)', 'Целая часть (ЦЕЛОЕ)', 'Integer part (INT)'), { tr: ['Tutarın tam sayı kısmı', 'A2\'nin tam kısmı'], ru: ['Целая часть Суммы', 'Целое от A2'], en: ['Integer part of Amount', 'Whole part of A2'] },
    function (pq) { return (H.has(pq, 'INT') || H.wants(pq, 'INT') || H.rawHas(pq, INT_RE)) && !H.rawHas(pq, ROUND_RE) && !H.any(pq, ['ROUND', 'ROUND_UP', 'ROUND_DOWN']) ? H.clamp(0.9 - logicPenalty(pq)) : 0; },
    T('%h% değerinin ondalık kısmını atar, tam sayı kısmını verir.', 'Отбрасывает дробную часть %h% и возвращает целую.', 'Drops the fractional part of %h% and returns the integer part.'));
  simple('abs', 'ABS', T('Mutlak değer (MUTLAK)', 'Модуль числа (ABS)', 'Absolute value (ABS)'), { tr: ['Tutarın mutlak değeri', 'İndirim\'in mutlak değerini al'], ru: ['Модуль Суммы', 'Абсолютное значение Скидки'], en: ['Absolute value of Discount', 'Absolute value of A2'] },
    function (pq) { return H.has(pq, 'ABS') || H.wants(pq, 'ABS') || H.rawHas(pq, /mutlak|модул|абсолютн|absolute/) ? H.clamp(0.93 - logicPenalty(pq)) : 0; },
    T('%h% değerinin işaretsiz (mutlak) değerini verir.', 'Возвращает модуль (абсолютное значение) %h%.', 'Returns the absolute value of %h%.'));
  simple('sqrt', 'SQRT', T('Karekök (KAREKÖK)', 'Квадратный корень (КОРЕНЬ)', 'Square root (SQRT)'), { tr: ['Tutarın karekökü', 'A2\'nin karekökünü al'], ru: ['Квадратный корень из Суммы', 'Корень из A2'], en: ['Square root of Amount', 'Square root of A2'] },
    function (pq) { return H.has(pq, 'SQRT') || H.wants(pq, 'SQRT') || H.rawHas(pq, /karek[oö]k|корень|square root|sqrt/) ? H.clamp(0.93 - logicPenalty(pq)) : 0; },
    T('%h% değerinin karekökünü verir.', 'Возвращает квадратный корень из %h%.', 'Returns the square root of %h%.'));
  defs.push({ id: 'mod', category: 'math', title: T('Bölümden kalan (MOD)', 'Остаток от деления (ОСТАТ)', 'Remainder (MOD)'),
    examples: { tr: ['Adet\'in 3\'e bölümünden kalan', 'A2\'nin B2\'ye bölümünden kalanı'], ru: ['Остаток от деления Кол-во на 3', 'Остаток от деления A2 на B2'], en: ['Remainder of Quantity divided by 3', 'Remainder of A2 divided by B2'] },
    match: function (pq) { return H.has(pq, 'MOD') || H.wants(pq, 'MOD') || H.rawHas(pq, /b[oö]l[uü]m[uü]nden kalan|kalan[ıi]n?[ıi]?\b.*b[oö]l|остаток от деления|остаток|remainder|modulo|\bmod\b/) ? H.clamp(0.93 - logicPenalty(pq)) : 0; },
    build: function (pq, ctx, opts) {
      var cand = H.cand('mod', null, {}), ops = operands(pq, ctx);
      var a = ops[0] ? ops[0].node : numRef(pq, ctx, cand).cell, b = ops[1] ? ops[1].node : A().placeholder('divisor');
      if (!ops[1]) H.miss(cand, 'divisor', T('Hangi sayıya bölünecek?', 'На что делить?', 'Divide by what?'));
      cand.ast = A().func('MOD', a, b);
      cand.explain = H.msg(T('%a% değerinin %b% ile bölümünden kalanı verir.', 'Возвращает остаток от деления %a% на %b%.', 'Returns the remainder of %a% divided by %b%.'), { a: H.serializeEN(a).slice(1), b: H.serializeEN(b).slice(1) });
      cand.target = H.target(pq, ctx, 'fill', ops[0] && ops[0].ref || null);
      return cand;
    } });
  defs.push({ id: 'power', category: 'math', title: T('Üs alma (kare, küp, KUVVET)', 'Возведение в степень (СТЕПЕНЬ)', 'Power (square, cube, POWER)'),
    examples: { tr: ['Adet\'in karesi', 'KUVVET fonksiyonu ile Adet\'in küpünü al', 'A2\'nin 4. kuvveti'], ru: ['Кол-во в квадрате', 'Через функцию СТЕПЕНЬ возведи Кол-во в куб', 'A2 в 4-й степени'], en: ['Quantity squared', 'Use POWER to cube Quantity', 'A2 to the power of 4'] },
    match: function (pq) { return (H.has(pq, 'POWER') || H.wants(pq, 'POWER') || H.rawHas(pq, POWER_RE)) && !H.rawHas(pq, /karek[oö]k|корень|square root|sqrt/) ? H.clamp(0.93 - logicPenalty(pq)) : 0; },
    build: function (pq, ctx, opts) {
      var cand = H.cand('power', null, {}), m = numRef(pq, ctx, cand), n;
      if (H.rawHas(pq, /\bkare|квадрат|square/)) n = 2; else if (H.rawHas(pq, /\bk[uü]p|(^|[^а-яё])куб|cube/)) n = 3;
      else { var ns = plain(pq), ords = H.ords(pq); n = ords.length ? ords[0].value : (ns.length ? ns[0].value : null); }
      var expo = n == null ? A().placeholder('number') : A().num(n);
      if (n == null) H.miss(cand, 'number', T('Kaçıncı kuvvet alınacak?', 'В какую степень возвести?', 'Which power?'));
      cand.ast = H.wants(pq, 'POWER') ? A().func('POWER', m.cell, expo) : A().op('^', m.cell, expo);
      cand.explain = H.msg(T('%h% değerinin %n%. kuvvetini alır.', 'Возводит %h% в степень %n%.', 'Raises %h% to the power of %n%.'), { h: label(m), n: n == null ? 'n' : n });
      cand.target = H.target(pq, ctx, 'fill', m.ref);
      return cand;
    } });

  /* ------------------------------------------------------------------ running total / SUMPRODUCT */
  defs.push({ id: 'running_total', category: 'math', title: T('Kümülatif toplam', 'Нарастающий итог', 'Running total'),
    examples: { tr: ['Tutar için kümülatif toplam', 'Adet sütununun birikimli toplamı'], ru: ['Нарастающий итог по Сумме', 'Накопительная сумма по Кол-во'], en: ['Running total of Amount', 'Cumulative sum of Quantity'] },
    match: function (pq) { return H.rawHas(pq, RUNNING_RE) ? 0.95 : 0; },
    build: function (pq, ctx, opts) {
      var cand = H.cand('running_total', null, {}), m = numRef(pq, ctx, cand);
      var first = m.placeholder ? A().placeholder('range') : A().ref(H.absText(H.cellText(m.ref, ctx)) + ':' + H.cellText(m.ref, ctx), m.ref.sheet);
      return fill('running_total', pq, ctx, m, A().func('SUM', first), H.msg(T('%h% için satır satır artan (kümülatif) toplamı verir; aşağı kopyalandıkça aralık genişler.', 'Возвращает нарастающий итог по %h%; при копировании вниз диапазон расширяется.', 'Returns the running (cumulative) total of %h%; the range grows as the formula is copied down.'), { h: label(m) }));
    } });
  defs.push({ id: 'sumproduct', category: 'math', title: T('Çarpımların toplamı (TOPLA.ÇARPIM)', 'Сумма произведений (СУММПРОИЗВ)', 'Sum of products (SUMPRODUCT)'),
    examples: { tr: ['Adet ile Birim Fiyat çarpımlarının toplamı', 'TOPLA.ÇARPIM ile Adet ve Birim Fiyat çarpımlarının toplamını al'], ru: ['Сумма произведений Кол-во и Цены', 'Через СУММПРОИЗВ посчитай сумму произведений Кол-во и Цены'], en: ['Sum of Quantity times Unit Price', 'Use SUMPRODUCT for Quantity and Unit Price'] },
    match: function (pq) {
      var refs = H.refs(pq, { free: true, sheet: null }).filter(H.isRangeLike);
      if (H.wants(pq, 'SUMPRODUCT') && refs.length >= 2) return 0.95;
      var sumWord = H.hasFree ? (H.hasFree(pq, 'SUM') || H.hasFree(pq, 'TOTAL')) : H.any(pq, ['SUM', 'TOTAL']);
      if (refs.length >= 2 && sumWord && (H.any(pq, ['MULTIPLY', 'PRODUCT']) || H.rawHas(pq, MUL_RE))) return H.clamp(0.93 - logicPenalty(pq));
      if (refs.length >= 2 && H.rawHas(pq, SUMPROD_RE)) return H.clamp(0.93 - logicPenalty(pq));
      return 0;
    },
    build: function (pq, ctx, opts) {
      var refs = H.byPosition(H.refs(pq, { free: true, sheet: null }).filter(H.isRangeLike));
      var cand = H.cand('sumproduct', A().func('SUMPRODUCT', refs.map(function (r) { return H.rangeNode(r, false); })), { explain: H.msg(T('%a% ve %b% sütunlarını satır satır çarpıp çarpımları toplar.', 'Перемножает %a% и %b% построчно и суммирует произведения.', 'Multiplies %a% and %b% row by row and sums the products.'), { a: H.label(refs[0]), b: H.label(refs[1]) }), target: H.target(pq, ctx, 'cell', refs[0]) });
      return cand;
    } });

  /* ------------------------------------------------------------------ arithmetic between two operands */
  function arith(id, op, re, concepts, title, examples, tpl) {
    defs.push({ id: id, category: 'math', title: title, examples: examples,
      match: function (pq, ctx) {
        // a weak concept (Russian "на" ≈ ×0.2) does not count as the operator word
        var strong = (pq.concepts || []).some(function (c) { return concepts.indexOf(c.concept) >= 0 && !(typeof c.weight === 'number' && c.weight < 0.5); });
        var sig = strong || H.rawHas(pq, re);
        if (!sig) return 0;
        var ops = operands(pq, ctx);
        if (ops.length < 2) return 0;
        if (op === '*' && ops.filter(function (o) { return o.isRange; }).length >= 2 && (H.any(pq, ['SUM', 'TOTAL']) || H.rawHas(pq, SUMPROD_RE))) return 0.3;
        if (op === '-' && ops.length >= 2 && ops[0].ref && ops[1].ref && ops[0].ref.type === 'date' && ops[1].ref.type === 'date') return 0.4;
        if (op === '-' && H.rawHas(pq, /g[uü]n|ay\b|y[ıi]l|дн|месяц|лет|days?|months?|years?/) && H.any(pq, ['DATE', 'DATE_DIFF'])) return 0.3;
        if (op === '+' && pct(pq).length) return 0;
        if (op === '-' && pct(pq).length) return 0;
        if (op === '*' && pct(pq).length && !plain(pq).length) return 0;
        if (op === '/' && (H.has(pq, 'MOD') || H.rawHas(pq, /kalan|остаток|remainder/))) return 0;
        if (op === '/' && (H.any(pq, ['SHARE', 'RATIO']) || H.rawHas(pq, SHARE_RE)) && ops.length < 2) return 0;
        return H.clamp(0.9 - logicPenalty(pq));
      },
      build: function (pq, ctx, opts) {
        var cand = H.cand(id, null, {}), ops = operands(pq, ctx), toks = pq.tokens || [];
        var a = ops[0], b = ops[1];
        if (op === '-') {
          // "A2'yi B2'den çıkar" / "вычти A2 из B2" / "subtract A2 from B2" → B2-A2
          var rawA = (toks[a.at] || {}).raw || '', rawB = (toks[b.at] || {}).raw || '', prevB = toks[b.at - 1];
          var ablB = /[’'](den|dan|ten|tan)$/i.test(rawB) || (prevB && /^(из|from)$/.test(H.fold(prevB.norm)));
          var accA = /[’'](y[ıiuü]|[ıiuü]|n[ıiuü])$/i.test(rawA);
          if (ablB && (accA || H.rawHas(pq, /вычти|subtract/))) { var t = a; a = b; b = t; }
        }
        var ast = A().op(op, a.node, b.node);
        for (var k = 2; k < ops.length; k++) ast = A().op(op, ast, ops[k].node);
        cand.ast = ast;
        cand.explain = H.msg(tpl, { a: H.serializeEN(a.node).slice(1), b: H.serializeEN(b.node).slice(1) });
        cand.target = H.target(pq, ctx, 'fill', a.ref || b.ref || null);
        return cand;
      } });
  }
  arith('multiply_columns', '*', MUL_RE, ['MULTIPLY'], T('İki değeri çarp', 'Умножить два значения', 'Multiply two values'), { tr: ['Adet ile Birim Fiyat\'ı çarp', 'C2 ile D2\'nin çarpımı', 'Tutarı 2 ile çarp'], ru: ['Умножь Кол-во на Цену', 'Произведение C2 и D2', 'Умножь Сумму на 2'], en: ['Multiply Quantity by Unit Price', 'Product of C2 and D2', 'Multiply Amount by 2'] }, T('%a% ile %b% değerini çarpar.', 'Умножает %a% на %b%.', 'Multiplies %a% by %b%.'));
  arith('add_values', '+', ADD_RE, ['PLUS'], T('İki değeri topla', 'Сложить два значения', 'Add two values'), { tr: ['A2 artı B2', 'Tutar ile İndirim\'i topla'], ru: ['A2 плюс B2', 'Сложи Сумму и Скидку'], en: ['A2 plus B2', 'Add Amount and Discount'] }, T('%a% ile %b% değerini toplar.', 'Складывает %a% и %b%.', 'Adds %a% and %b%.'));
  arith('subtract_values', '-', SUB_RE, ['MINUS', 'DIFFERENCE'], T('İki değerin farkı', 'Разность двух значений', 'Difference of two values'), { tr: ['B2 ile A2 arasındaki fark', 'Tutardan İndirim tutarını çıkar'], ru: ['Разница между B2 и A2', 'Из Суммы вычти Скидку'], en: ['Difference between B2 and A2', 'Subtract Discount from Amount'] }, T('%a% değerinden %b% değerini çıkarır.', 'Вычитает %b% из %a%.', 'Subtracts %b% from %a%.'));
  arith('divide_values', '/', DIV_RE, ['DIVIDE'], T('İki değeri böl', 'Разделить два значения', 'Divide two values'), { tr: ['Tutarı Adet\'e böl', 'A2 bölü B2', 'Tutarı Adet\'e böl, hata olursa 0 yaz'], ru: ['Раздели Сумму на Кол-во', 'A2 делить на B2', 'Раздели Сумму на Кол-во, при ошибке 0'], en: ['Divide Amount by Quantity', 'A2 divided by B2', 'Divide Amount by Quantity, if error show "Error"'] }, T('%a% değerini %b% değerine böler.', 'Делит %a% на %b%.', 'Divides %a% by %b%.'));

  I.register(defs);
  return defs;
});
