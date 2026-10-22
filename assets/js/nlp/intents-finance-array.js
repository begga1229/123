/* Formula Studio — finance and dynamic-array intents: PMT / FV / PV / NPV / IRR / SLN and UNIQUE / FILTER / SORT /
 * TAKE+SORT (top N) / SEQUENCE. Registers into EFS.intents. */
(function (root, factory) {
  var EFS = root.EFS || (root.EFS = {});
  var api = factory(EFS, root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (EFS, root) {
  'use strict';
  var I = EFS.intents, H = I.helpers, T = H.T;
  function A() { return EFS.ast; }
  function U() { return EFS.util; }

  var LOAN_RE = /kredi|taksit|ipotek|konut kredisi|кредит|ипотек|платёж|платеж|рассрочк|\bloan\b|mortgage|instal?lment|monthly payment|repayment/;
  var FV_RE = /birik|getiri|ne olur|gelecek(teki)? de[gğer]|накоп|будущ(ая|ей) стоимост|через \d+ (лет|год)|future value|accumulat|how much will|grow to|end up with/;
  var PV_RE = /bug[uü]nk[uü] de[gğ]er|[sş]imdiki de[gğ]er|приведённ|приведенн|текущ(ая|ей) стоимост|present value/;
  var NPV_RE = /net bug[uü]nk[uü]|nbd|чист(ая|ой) приведённ|чист(ая|ой) приведенн|чпс|\bnpv\b|net present/;
  var IRR_RE = /i[cç] verim|i[cç] kârl|iç karl|внутренн(яя|ей) норм|всд|\birr\b|internal rate/;
  var SLN_RE = /amortisman|y[ıi]pranma|амортизац|\bsln\b|depreciat|straight.line/;
  var MONTH_RE = /^(ay|ayl[ıi]k|месяц|мес|ежемесяч|month)/, YEAR_RE = /^(y[ıi]l|sene|y[ıi]ll[ıi]k|год|лет|годов|ежегод|year|annual)/;
  var CURRENCY_RE = /^(tl|₺|try|usd|\$|eur|€|руб|рублей|р\.|rub|dollar|euro|lira|pound|£)$/;

  function nums(pq) { return H.nums(pq, { percent: false, noDate: true }); }
  function pct(pq) { return H.nums(pq, { percent: true }); }
  function wordAfter(pq, n, k) { var t = (pq.tokens || [])[n.tokenIndex + (k || 1)]; return t ? H.fold(t.norm) : ''; }
  function wordBefore(pq, n, k) { var t = (pq.tokens || [])[n.tokenIndex - (k || 1)]; return t ? H.fold(t.norm) : ''; }
  function near(pq, n, re, span) {
    span = span || 2;
    for (var k = 1; k <= span; k++) { if (re.test(wordAfter(pq, n, k)) || re.test(wordBefore(pq, n, k))) return true; }
    return false;
  }
  /** Classify the plain numbers of a finance request: { principal, months, years, pmt, rest[] }. */
  function financeNumbers(pq) {
    var ns = nums(pq), out = { principal: null, months: null, years: null, pmt: null, rest: [] };
    ns.forEach(function (n) {
      var a1 = wordAfter(pq, n, 1), a2 = wordAfter(pq, n, 2), b1 = wordBefore(pq, n, 1);
      if (MONTH_RE.test(a1) || (CURRENCY_RE.test(a1) && MONTH_RE.test(a2) && false)) { if (out.months == null) { out.months = n.value; return; } }
      if (YEAR_RE.test(a1) && !/faiz|годовых|interest|rate/.test(a2)) { if (out.years == null) { out.years = n.value; return; } }
      if (/^(ayl[ıi]k|в месяц|ежемесячно|per month|monthly|a month)$/.test(b1) || /^(ayl[ıi]k|в месяц|ежемесячно|per month|monthly|a month)/.test(a1 + ' ' + a2) && CURRENCY_RE.test(a1)) { if (out.pmt == null) { out.pmt = n.value; return; } }
      out.rest.push(n);
    });
    // "Aylık 1000 TL yatırarak": number right after a monthly word is the payment
    if (out.pmt == null) { var m = out.rest.filter(function (n) { return /^(ayl[ıi]k|ежемесячно|monthly)$/.test(wordBefore(pq, n, 1)) || /^(в|per|a)$/.test(wordAfter(pq, n, 1)) && MONTH_RE.test(wordAfter(pq, n, 2)) || /^(по)$/.test(wordBefore(pq, n, 1)) && /^(в)$/.test(wordAfter(pq, n, 1)); })[0]; if (m) { out.pmt = m.value; out.rest.splice(out.rest.indexOf(m), 1); } }
    if (out.rest.length) { var big = out.rest.slice().sort(function (a, b) { return b.value - a.value; })[0]; out.principal = big.value; out.rest.splice(out.rest.indexOf(big), 1); }
    return out;
  }
  function rateNode(pq, monthly) {
    var ps = pct(pq);
    if (!ps.length) return null;
    var r = A().percent(ps[0].value);
    return monthly ? A().op('/', r, 12) : r;
  }
  function nperNode(f, monthly) {
    if (monthly) { if (f.months != null) return A().num(f.months); if (f.years != null) return A().op('*', f.years, 12); return null; }
    if (f.years != null) return A().num(f.years); if (f.months != null) return A().op('/', f.months, 12); return null;
  }
  function isMonthly(pq) { return !H.rawHas(pq, /y[ıi]ll[ıi]k taksit|y[ıi]ll[ıi]k [oö]deme|годов(ой|ых) платёж|годовой платеж|annual payment|yearly payment|per year payment/); }
  function cellTarget(pq, ctx) { return H.target(pq, ctx, 'cell', null); }
  var defs = [];

  /* ------------------------------------------------------------------ PMT */
  defs.push({ id: 'loan_payment', category: 'finance', title: T('Kredi taksiti (DEVRESEL_ÖDEME)', 'Платёж по кредиту (ПЛТ)', 'Loan payment (PMT)'),
    examples: { tr: ['yıllık %24 faizle 100000 TL krediyi 36 ay taksitle öde', '200000 TL kredi, yıllık %18 faiz, 5 yıl vade, aylık taksit ne kadar?', 'Yıllık %12 faizle 50000 TL krediyi 24 ay taksitle ödersem aylık taksit?'], ru: ['Кредит 100000 под 24% годовых на 36 месяцев, ежемесячный платёж', 'Кредит 200000 под 18% годовых на 5 лет, какой ежемесячный платёж?', 'Ежемесячный платёж по кредиту 50000 под 12% годовых на 24 месяца'], en: ['Monthly payment for a 100000 loan at 24% annual interest over 36 months', 'Loan of 200000 at 18% for 5 years, monthly payment?', 'Payment on a 50000 loan at 12% over 24 months'] },
    match: function (pq) { if (!(H.any(pq, ['LOAN', 'PAYMENT', 'INSTALLMENT']) || H.wants(pq, 'PMT') || H.rawHas(pq, LOAN_RE))) return 0; if (H.rawHas(pq, FV_RE) && !H.rawHas(pq, LOAN_RE)) return 0; return pct(pq).length ? 0.93 : 0.6; },
    build: function (pq, ctx, opts) {
      var cand = H.cand('loan_payment', null, {}), f = financeNumbers(pq), monthly = isMonthly(pq);
      var rate = rateNode(pq, monthly) || A().placeholder('rate'), nper = nperNode(f, monthly) || A().placeholder('nper');
      var pv = f.principal != null ? A().unary('-', f.principal) : A().unary('-', A().placeholder('pv'));
      if (!pct(pq).length) H.miss(cand, 'rate', T('Yıllık faiz oranı nedir?', 'Какая годовая ставка?', 'What is the annual interest rate?'));
      if (nper.t === 'placeholder') H.miss(cand, 'nper', T('Vade kaç ay?', 'Срок в месяцах?', 'How many months?'));
      if (f.principal == null) H.miss(cand, 'pv', T('Kredi tutarı nedir?', 'Какая сумма кредита?', 'What is the loan amount?'));
      cand.ast = A().func('PMT', rate, nper, pv);
      cand.explain = monthly ? T('Yıllık faizi 12\'ye bölerek aylık taksiti hesaplar; anapara negatif girildiği için sonuç pozitif çıkar.', 'Делит годовую ставку на 12 и считает ежемесячный платёж; сумма кредита со знаком минус, чтобы результат был положительным.', 'Divides the annual rate by 12 and returns the monthly payment; the principal is negative so the result is positive.') : T('Yıllık taksiti hesaplar; anapara negatif girildiği için sonuç pozitif çıkar.', 'Считает годовой платёж; сумма кредита со знаком минус, чтобы результат был положительным.', 'Returns the yearly payment; the principal is negative so the result is positive.');
      cand.target = cellTarget(pq, ctx);
      return cand;
    } });

  /* ------------------------------------------------------------------ FV / PV */
  defs.push({ id: 'fv', category: 'finance', title: T('Gelecek değer (GD)', 'Будущая стоимость (БС)', 'Future value (FV)'),
    examples: { tr: ['Aylık 1000 TL yatırarak yıllık %12 faizle 10 yıl sonra ne birikir?', 'Yıllık %8 faizle 5 yıl boyunca aylık 500 TL biriktirirsem ne olur?'], ru: ['Сколько накопится через 10 лет, если вносить по 1000 в месяц под 12% годовых?', 'Будущая стоимость вкладов по 500 в месяц под 8% за 5 лет'], en: ['How much will I have after 10 years saving 1000 per month at 12%?', 'Future value of 500 monthly at 8% for 5 years'] },
    match: function (pq) { if (!(H.has(pq, 'FUTURE_VALUE') || H.wants(pq, 'FV') || H.rawHas(pq, FV_RE))) return 0; if (H.rawHas(pq, LOAN_RE) && !H.rawHas(pq, FV_RE)) return 0; return pct(pq).length ? 0.93 : 0.6; },
    build: function (pq, ctx, opts) {
      var cand = H.cand('fv', null, {}), f = financeNumbers(pq), monthly = isMonthly(pq);
      var rate = rateNode(pq, monthly) || A().placeholder('rate'), nper = nperNode(f, monthly) || A().placeholder('nper');
      var pmt = f.pmt != null ? f.pmt : (f.principal != null && f.principal <= 100000 && H.rawHas(pq, /ayl[ıi]k|в месяц|monthly|per month/) ? f.principal : null);
      var args = [rate, nper, pmt != null ? A().unary('-', pmt) : A().num(0)];
      if (pmt == null && f.principal != null) args.push(A().unary('-', f.principal));
      if (pmt == null && f.principal == null) { args[2] = A().unary('-', A().placeholder('value', T('dönemsel ödeme', 'периодический взнос', 'periodic payment'))); H.miss(cand, 'value', T('Dönem başına ne kadar yatırılacak?', 'Сколько вносить за период?', 'How much is paid per period?')); }
      if (!pct(pq).length) H.miss(cand, 'rate', T('Yıllık faiz oranı nedir?', 'Какая годовая ставка?', 'What is the annual interest rate?'));
      cand.ast = A().func('FV', args);
      cand.explain = T('Düzenli ödemelerin faizle birlikte dönem sonunda ulaşacağı toplamı verir.', 'Возвращает сумму, которую регулярные взносы с процентами составят к концу срока.', 'Returns what the regular payments will grow to, with interest, by the end of the term.');
      cand.target = cellTarget(pq, ctx);
      return cand;
    } });
  defs.push({ id: 'pv', category: 'finance', title: T('Bugünkü değer (BD)', 'Приведённая стоимость (ПС)', 'Present value (PV)'),
    examples: { tr: ['Yıllık %10 faizle 5 yıl boyunca aylık 1000 TL ödemenin bugünkü değeri', '36 ay boyunca aylık 500 TL\'nin %12 ile bugünkü değeri'], ru: ['Приведённая стоимость платежей по 1000 в месяц 5 лет под 10% годовых', 'Текущая стоимость 500 в месяц на 36 месяцев под 12%'], en: ['Present value of 1000 per month for 5 years at 10%', 'PV of 500 monthly for 36 months at 12%'] },
    match: function (pq) { if (!(H.has(pq, 'PRESENT_VALUE') || H.wants(pq, 'PV') || H.rawHas(pq, PV_RE))) return 0; if (H.rawHas(pq, NPV_RE) || H.has(pq, 'NPV')) return 0; return pct(pq).length ? 0.92 : 0.6; },
    build: function (pq, ctx, opts) {
      var cand = H.cand('pv', null, {}), f = financeNumbers(pq), monthly = isMonthly(pq);
      var rate = rateNode(pq, monthly) || A().placeholder('rate'), nper = nperNode(f, monthly) || A().placeholder('nper');
      var pmt = f.pmt != null ? f.pmt : f.principal;
      cand.ast = A().func('PV', rate, nper, pmt != null ? A().unary('-', pmt) : A().unary('-', A().placeholder('value')));
      if (pmt == null) H.miss(cand, 'value', T('Dönemsel ödeme tutarı nedir?', 'Какой периодический платёж?', 'What is the periodic payment?'));
      cand.explain = T('Gelecekteki düzenli ödemelerin bugünkü toplam değerini verir.', 'Возвращает сегодняшнюю стоимость будущих регулярных платежей.', 'Returns the present value of the future regular payments.');
      cand.target = cellTarget(pq, ctx);
      return cand;
    } });

  /* ------------------------------------------------------------------ NPV / IRR / SLN */
  function rangeArg(pq, ctx, cand) {
    var refs = H.byPosition(H.refs(pq, { free: true }).filter(H.isRangeLike));
    if (refs.length) return { node: H.rangeNode(refs[0], false), ref: refs[0] };
    var m = H.mainRef(pq, ctx, cand, { type: 'number', pool: [] });
    return { node: m.node, ref: m.ref };
  }
  defs.push({ id: 'npv', category: 'finance', title: T('Net bugünkü değer (NBD)', 'Чистая приведённая стоимость (ЧПС)', 'Net present value (NPV)'),
    examples: { tr: ['%10 iskonto oranıyla B2:B10 nakit akışlarının net bugünkü değeri', 'B2:B10 akışlarının %8 ile NBD\'si'], ru: ['Чистая приведённая стоимость потоков B2:B10 при ставке 10%', 'ЧПС потоков B2:B10 под 8%'], en: ['Net present value of cash flows B2:B10 at a 10% rate', 'NPV of B2:B10 at 8%'] },
    match: function (pq) { return H.has(pq, 'NPV') || H.wants(pq, 'NPV') || H.rawHas(pq, NPV_RE) ? 0.95 : 0; },
    build: function (pq, ctx, opts) {
      var cand = H.cand('npv', null, {}), r = rangeArg(pq, ctx, cand), ps = pct(pq);
      cand.ast = A().func('NPV', ps.length ? A().percent(ps[0].value) : A().placeholder('rate'), r.node);
      if (!ps.length) H.miss(cand, 'rate', T('İskonto oranı nedir?', 'Какая ставка дисконтирования?', 'What is the discount rate?'));
      cand.explain = H.msg(T('%r% aralığındaki nakit akışlarını verilen oranla bugüne indirger ve toplar.', 'Дисконтирует денежные потоки %r% по заданной ставке и суммирует их.', 'Discounts the cash flows in %r% at the given rate and sums them.'), { r: H.serializeEN(r.node).slice(1) });
      cand.target = cellTarget(pq, ctx);
      return cand;
    } });
  defs.push({ id: 'irr', category: 'finance', title: T('İç verim oranı (İÇ_VERİM_ORANI)', 'Внутренняя норма доходности (ВСД)', 'Internal rate of return (IRR)'),
    examples: { tr: ['B2:B10 nakit akışlarının iç verim oranı', 'Nakit akışları B2:B10 için İVO'], ru: ['Внутренняя норма доходности для потоков B2:B10', 'ВСД по потокам B2:B10'], en: ['Internal rate of return of cash flows B2:B10', 'IRR for B2:B10'] },
    match: function (pq) { return H.has(pq, 'IRR') || H.wants(pq, 'IRR') || H.rawHas(pq, IRR_RE) ? 0.95 : 0; },
    build: function (pq, ctx, opts) {
      var cand = H.cand('irr', null, {}), r = rangeArg(pq, ctx, cand);
      cand.ast = A().func('IRR', r.node);
      cand.explain = H.msg(T('%r% nakit akışlarının net bugünkü değerini sıfır yapan iç verim oranını verir.', 'Возвращает ставку, при которой чистая приведённая стоимость потоков %r% равна нулю.', 'Returns the rate at which the net present value of the cash flows in %r% is zero.'), { r: H.serializeEN(r.node).slice(1) });
      cand.target = cellTarget(pq, ctx);
      return cand;
    } });
  defs.push({ id: 'sln', category: 'finance', title: T('Doğrusal amortisman (DA)', 'Линейная амортизация (АПЛ)', 'Straight-line depreciation (SLN)'),
    examples: { tr: ['Maliyeti 100000, hurda değeri 10000, ömrü 5 yıl olan varlığın doğrusal amortismanı', '50000 TL maliyet, 5000 hurda, 10 yıl ömür için yıllık amortisman'], ru: ['Линейная амортизация: стоимость 100000, остаточная стоимость 10000, срок 5 лет', 'Годовая амортизация при стоимости 50000, остатке 5000 и сроке 10 лет'], en: ['Straight-line depreciation: cost 100000, salvage 10000, life 5 years', 'Annual depreciation for cost 50000, salvage 5000, life 10 years'] },
    match: function (pq) { return H.has(pq, 'DEPRECIATION') || H.wants(pq, 'SLN') || H.rawHas(pq, SLN_RE) ? 0.95 : 0; },
    build: function (pq, ctx, opts) {
      var cand = H.cand('sln', null, {}), ns = nums(pq);
      var cost = null, salvage = null, life = null, rest = [];
      var toks = pq.tokens || [];
      function before(n, k) { var out = [], i = n.tokenIndex - 1; while (i >= 0 && out.length < k) { if (toks[i].type !== 'punct') out.unshift(H.fold(toks[i].norm)); i--; } return out.join(' '); }
      ns.forEach(function (n) {
        var b = before(n, 3), a1 = wordAfter(pq, n, 1);
        if (life == null && (YEAR_RE.test(a1) || /[oö]m[uü]r|[oö]mr|срок|\blife\b|useful/.test(b))) { life = n.value; return; }
        if (salvage == null && /hurda|kal[ıi]nt[ıi]|остаточн|ликвидац|salvage|residual/.test(b)) { salvage = n.value; return; }
        if (cost == null && /maliyet|стоимост|\bcost\b|price|purchase/.test(b)) { cost = n.value; return; }
        rest.push(n);
      });
      if (cost == null && rest.length) cost = rest.shift().value;
      if (salvage == null && rest.length) salvage = rest.shift().value;
      if (life == null && rest.length) life = rest.shift().value;
      cand.ast = A().func('SLN', cost != null ? A().num(cost) : A().placeholder('value', T('maliyet', 'стоимость', 'cost')), salvage != null ? A().num(salvage) : A().placeholder('value', T('hurda değeri', 'остаточная стоимость', 'salvage')), life != null ? A().num(life) : A().placeholder('number', T('ömür', 'срок', 'life')));
      if (cost == null) H.miss(cand, 'value', T('Varlığın maliyeti nedir?', 'Какова стоимость актива?', 'What is the asset cost?'));
      if (life == null) H.miss(cand, 'number', T('Faydalı ömür kaç yıl?', 'Срок службы в годах?', 'Useful life in years?'));
      cand.explain = T('Maliyet ile hurda değeri arasındaki farkı ömre bölerek dönem başına eşit amortismanı verir.', 'Делит разницу между стоимостью и остаточной стоимостью на срок службы — равная амортизация за период.', 'Divides the difference between cost and salvage by the useful life — equal depreciation per period.');
      cand.target = cellTarget(pq, ctx);
      return cand;
    } });

  /* ------------------------------------------------------------------ dynamic arrays */
  var LIST_RE = /listele|liste|списк|список|выведи|перечисл|\blist\b|show all/;
  var TABLE_RE = /tablo|таблиц|\btable\b|\brows\b|sat[ıi]r|строк/;
  function block(ctx, cand) {
    var b = H.dataBlock(ctx);
    if (b) return A().ref(b.text);
    if (cand) H.miss(cand, 'range', T('Hangi tablo aralığı kullanılacak?', 'Какой диапазон таблицы использовать?', 'Which table range should be used?'));
    return A().placeholder('range');
  }
  function arrayPenalty(opts) { return H.classic(opts) ? 0.35 : 0; }
  defs.push({ id: 'unique_list', category: 'array', title: T('Benzersiz liste (BENZERSİZ)', 'Список уникальных (УНИК)', 'Unique list (UNIQUE)'),
    examples: { tr: ['Şehir sütunundaki benzersiz değerleri listele', 'Kategori sütunundaki tekrarları kaldırıp listele'], ru: ['Список уникальных городов', 'Убери дубликаты из столбца Категория'], en: ['Unique list of cities', 'Remove duplicates from Category'] },
    match: function (pq, ctx, opts) {
      var sig = H.any(pq, ['UNIQUE', 'REMOVE_DUPLICATES']) || H.wants(pq, 'UNIQUE') || H.rawHas(pq, /benzersiz|tekrarlar[ıi] kald|yinelenenleri kald|уникальн|убери дубликат|удали дубликат|без дубликат|unique|distinct|remove duplicates/);
      if (!sig) return 0;
      var listed = H.has(pq, 'LIST') || H.rawHas(pq, LIST_RE);
      if ((H.has(pq, 'COUNT_UNIQUE') && !listed) || ((H.has(pq, 'COUNT') || (pq.flags && pq.flags.question)) && !listed)) return 0.3;
      if (H.conds(pq).length) return 0.4;
      return H.clamp(0.93 - arrayPenalty(opts));
    },
    build: function (pq, ctx, opts) {
      var cand = H.cand('unique_list', null, {}), m = H.mainRef(pq, ctx, cand, { type: 'text' });
      cand.ast = A().func('UNIQUE', m.node); cand.tags.push('365');
      cand.explain = H.msg(T('%h% içindeki benzersiz değerleri (tekrarsız) dinamik dizi olarak listeler.', 'Выводит уникальные значения %h% (без повторов) как динамический массив.', 'Lists the distinct values of %h% (no repeats) as a dynamic array.'), { h: m.ref ? H.label(m.ref) : '…' });
      cand.target = H.target(pq, ctx, 'cell', null);
      return cand;
    } });
  defs.push({ id: 'filter_rows', category: 'array', title: T('Satırları filtrele (FİLTRE)', 'Отфильтровать строки (ФИЛЬТР)', 'Filter rows (FILTER)'),
    examples: { tr: ['Kategori "Gıda" olan satırları filtrele', 'Kategori "Gıda" olan Ürünleri listele', 'Tutarı 1000\'den büyük olan satırları filtrele'], ru: ['Отфильтруй строки, где Категория "Еда"', 'Список товаров, где Категория "Еда"', 'Отфильтруй строки, где Сумма больше 1000'], en: ['Filter rows where Category is "Food"', 'List Products where Category is "Food"', 'Filter rows where Amount > 1000'] },
    match: function (pq, ctx, opts) {
      var cs = H.conds(pq);
      if (!cs.length) return 0;
      var sig = H.has(pq, 'FILTER') || H.wants(pq, 'FILTER') || H.rawHas(pq, /filtre|отфильтр|фильтр|\bfilter/);
      var list = H.has(pq, 'LIST') || H.rawHas(pq, LIST_RE);
      if (!sig && !list) return 0;
      if (H.hasAggregate(pq) && !sig) return 0.3;
      if (H.any(pq, ['IF']) && (pq.thenValue || pq.elseValue)) return 0.3;
      return H.clamp((sig ? 0.94 : 0.9) - arrayPenalty(opts));
    },
    build: function (pq, ctx, opts) {
      var cand = H.cand('filter_rows', null, {}), cs = H.conds(pq);
      var free = H.byPosition(H.refs(pq, { free: true, sheet: null }).filter(H.isRangeLike));
      var wholeRows = H.has(pq, 'ROW') || H.rawHas(pq, /sat[ıi]r|строк|\brows?\b|tablo|таблиц|table/);
      var arr = (free.length && !wholeRows) ? H.rangeNode(free[0], false) : block(ctx, cand);
      var fb = cs.length ? H.condRef(cs[0], ctx) : null;
      var exprs = cs.map(function (c) { return H.condExpr(c, pq, ctx, fb, false); });
      var test = exprs[0];
      if (exprs.length > 1) { var conj = H.conjunction(cs, pq); test = A().paren(exprs[0]); for (var i = 1; i < exprs.length; i++) test = A().op(conj === 'OR' ? '+' : '*', test, A().paren(exprs[i])); }
      cand.ast = A().func('FILTER', arr, test, A().str('')); cand.tags.push('365');
      cand.explain = H.msg(T('%c% koşulunu sağlayan satırları dinamik dizi olarak döndürür; eşleşme yoksa boş.', 'Возвращает строки, где %c%, как динамический массив; если совпадений нет — пусто.', 'Returns the rows where %c% as a dynamic array; blank when nothing matches.'), { c: H.describeConds(cs, pq, ctx, fb) });
      cand.target = H.target(pq, ctx, 'cell', null);
      return cand;
    } });
  defs.push({ id: 'sort_range', category: 'array', title: T('Sırala (SIRALA)', 'Сортировать (СОРТ)', 'Sort (SORT)'),
    examples: { tr: ['Tutarı büyükten küçüğe sırala', 'Tabloyu Tutar\'a göre azalan sırala', 'Şehirleri alfabetik sırala'], ru: ['Отсортируй Сумму по убыванию', 'Отсортируй таблицу по Сумме по убыванию', 'Отсортируй города по алфавиту'], en: ['Sort Amount descending', 'Sort the table by Amount descending', 'Sort cities alphabetically'] },
    match: function (pq, ctx, opts) {
      var sig = H.has(pq, 'SORT') || H.wants(pq, ['SORT', 'SORTBY']) || H.rawHas(pq, /s[ıi]rala|отсортир|сортир|по алфавиту|alfabetik|\bsort\b|alphabetic/);
      if (!sig) return 0;
      if (H.has(pq, 'RANK') || H.rawHas(pq, /s[ıi]ra numar|s[ıi]ralama numar|ранг|\brank/)) return 0.3;
      if (H.any(pq, ['TOP_N', 'BOTTOM_N']) && H.nums(pq, { free: true }).length) return 0.4;
      return H.clamp(0.93 - arrayPenalty(opts));
    },
    build: function (pq, ctx, opts) {
      var cand = H.cand('sort_range', null, {});
      var free = H.byPosition(H.refs(pq, { free: true, sheet: null }).filter(H.isRangeLike));
      var desc = H.has(pq, 'DESC') || H.rawHas(pq, /azalan|b[uü]y[uü]kten|убыва|descending|largest first|highest first|z-a|z to a/);
      var table = H.rawHas(pq, /tablo|таблиц|\btable\b|t[uü]m sat[ıi]r|все строки|whole|entire/);
      var arr, col = 1;
      if (table || !free.length) { arr = block(ctx, cand); if (free.length) col = H.colPos(ctx, free[0].col) || 1; else if (!free.length && !table) { var m = H.mainRef(pq, ctx, cand, { type: 'number', pool: [] }); arr = m.node; } }
      else arr = H.rangeNode(free[0], false);
      cand.ast = A().func('SORT', arr, col, desc ? -1 : 1); cand.tags.push('365');
      cand.explain = H.msg(desc ? T('%r% aralığını %c%. sütuna göre azalan sırada döndürür.', 'Возвращает %r%, отсортированный по столбцу %c% по убыванию.', 'Returns %r% sorted by column %c% in descending order.') : T('%r% aralığını %c%. sütuna göre artan sırada döndürür.', 'Возвращает %r%, отсортированный по столбцу %c% по возрастанию.', 'Returns %r% sorted by column %c% in ascending order.'), { r: H.serializeEN(arr).slice(1), c: col });
      cand.target = H.target(pq, ctx, 'cell', null);
      return cand;
    } });
  defs.push({ id: 'top_n', category: 'array', title: T('En yüksek N değer', 'Топ-N значений', 'Top N values'),
    examples: { tr: ['En yüksek 5 tutarı listele', 'Tutara göre en yüksek 10 satırı listele'], ru: ['Топ-5 сумм', 'Топ-10 строк по Сумме'], en: ['Top 5 Amounts', 'Top 10 rows by Amount'] },
    match: function (pq, ctx, opts) {
      var n = H.nums(pq, { free: true, percent: false });
      if (!n.length || H.ords(pq).length) return 0;
      var sig = H.any(pq, ['TOP_N', 'BOTTOM_N']) || H.rawHas(pq, /\btop\b|топ|en y[uü]ksek \d|en b[uü]y[uü]k \d|en d[uü][sş][uü]k \d|en k[uü][cç][uü]k \d|ilk \d|\d+ наибольш|\d+ наименьш|\d+ крупнейш|largest \d|highest \d|lowest \d|smallest \d|first \d/);
      if (!sig) return 0;
      if (H.has(pq, 'CHARACTER') || H.has(pq, 'WORD')) return 0;
      if (H.conds(pq).length && !H.rawHas(pq, LIST_RE)) return 0.4;
      return H.clamp(0.92 - arrayPenalty(opts));
    },
    build: function (pq, ctx, opts) {
      var cand = H.cand('top_n', null, {}), n = H.nums(pq, { free: true, percent: false })[0].value;
      var bottom = H.has(pq, 'BOTTOM_N') || H.rawHas(pq, /en d[uü][sş][uü]k|en k[uü][cç][uü]k|наименьш|lowest|smallest|bottom/);
      var free = H.byPosition(H.refs(pq, { free: true, sheet: null }).filter(H.isRangeLike));
      var rows = H.has(pq, 'ROW') || H.rawHas(pq, TABLE_RE);
      var arr, col = 1;
      if (rows) { arr = block(ctx, cand); if (free.length) col = H.colPos(ctx, free[0].col) || 1; else { var d = H.defaultHeader(ctx, ['number']); if (d) col = H.colPos(ctx, d.col) || 1; } }
      else { var m = H.mainRef(pq, ctx, cand, { type: 'number', pool: free }); arr = m.node; }
      cand.ast = A().func('TAKE', A().func('SORT', arr, col, bottom ? 1 : -1), n); cand.tags.push('365');
      cand.explain = H.msg(bottom ? T('%r% aralığını artan sıralayıp ilk %n% satırı döndürür.', 'Сортирует %r% по возрастанию и возвращает первые %n% строк.', 'Sorts %r% ascending and returns the first %n% rows.') : T('%r% aralığını azalan sıralayıp ilk %n% satırı döndürür.', 'Сортирует %r% по убыванию и возвращает первые %n% строк.', 'Sorts %r% descending and returns the first %n% rows.'), { r: H.serializeEN(arr).slice(1), n: n });
      cand.target = H.target(pq, ctx, 'cell', null);
      return cand;
    } });
  defs.push({ id: 'sequence', category: 'array', title: T('Sayı dizisi (SIRALI)', 'Последовательность (ПОСЛЕД)', 'Number sequence (SEQUENCE)'),
    examples: { tr: ['1\'den 10\'a kadar sayı dizisi oluştur', '1\'den 100\'e kadar sayılar'], ru: ['Последовательность чисел от 1 до 10', 'Числа от 1 до 100 в столбец'], en: ['Sequence of numbers from 1 to 10', 'Numbers 1 to 100 in a column'] },
    match: function (pq, ctx, opts) { return (H.has(pq, 'SEQUENCE') || H.wants(pq, 'SEQUENCE') || H.rawHas(pq, /say[ıi] dizisi|dizi olu[sş]tur|ard[ıi][sş][ıi]k say|последовательност|числа от \d+ до|sequence|numbers from \d+ to/)) && H.nums(pq, { percent: false }).length ? H.clamp(0.93 - arrayPenalty(opts)) : 0; },
    build: function (pq, ctx, opts) {
      var cand = H.cand('sequence', null, {}), ns = H.nums(pq, { percent: false }).map(function (n) { return n.value; });
      var start = ns.length > 1 ? ns[0] : 1, end = ns[ns.length - 1];
      var ast = (start === 1) ? A().func('SEQUENCE', end) : A().func('SEQUENCE', end - start + 1, 1, start);
      cand.ast = ast; cand.tags.push('365');
      cand.explain = H.msg(T('%s%\'den %e%\'e kadar sayıları alt alta dinamik dizi olarak üretir.', 'Создаёт числа от %s% до %e% в столбец как динамический массив.', 'Generates the numbers from %s% to %e% downwards as a dynamic array.'), { s: start, e: end });
      cand.target = H.target(pq, ctx, 'cell', null);
      return cand;
    } });

  I.register(defs);
  return defs;
});
