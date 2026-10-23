/* Formula Studio — date intents: TODAY / NOW, age, differences (days / months / years / working days), days until /
 * since, adding or subtracting days / months / years / workdays, end / start of month, YEAR / MONTH / DAY, quarter,
 * weekday and month names, week number, weekend test, DATE from parts. Registers into EFS.intents. */
(function (root, factory) {
  var EFS = root.EFS || (root.EFS = {});
  var api = factory(EFS, root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (EFS, root) {
  'use strict';
  var I = EFS.intents, H = I.helpers, T = H.T;
  function A() { return EFS.ast; }

  var UNIT_RE = { day: /^(g[uü]n|дн|день|дня|дней|day)/, month: /^(ay|месяц|мес|month)/, year: /^(y[ıi]l|sene|год|лет|year)/, week: /^(hafta|недел|week)/, workday: /^(i[sş] ?g[uü]n|рабоч|work|business)/ };
  var WORKDAY_RE = /i[sş] g[uü]n|isgun|рабоч(их|ие|ий) дн|рабочий день|working day|business day|workday/;
  var NAME_RE = /ad[ıi]n[ıi]|ad[ıi]\b|ismi|название|имя|названи|\bname\b/;
  var SUB_RE = /[cç][ıi]kar|eksi|[oö]nces|[oö]nceki|geri|минус|отними|вычти|назад|раньше|subtract|minus|before|ago|earlier/;
  var ADD_RE = /ekle|sonras|ileri|прибав|добав|плюс|спустя|через|\badd\b|plus|later|after/;

  function dateRefs(pq) { return H.byPosition(H.refs(pq, { sheet: null, free: true })); }
  function dateRef(pq, ctx, cand, opts) {
    opts = opts || {};
    var pool = dateRefs(pq);
    if (!pool.length) pool = H.byPosition(H.refs(pq, { sheet: null }));
    if (opts.prefer) { var pref = pool.filter(function (r) { return opts.prefer.test(H.fold(r.headerName || '')); }); if (pref.length) pool = pref; }
    var dated = pool.filter(function (r) { return r.type === 'date'; });
    if (dated.length) pool = dated;
    var m = H.mainRef(pq, ctx, cand, { type: 'date', pool: pool, slot: 'date', cellSlot: 'date' });
    if (!m.placeholder && ctx && m.ref && m.ref.source !== 'default' && opts.prefer && !opts.prefer.test(H.fold(m.ref.headerName || ''))) {
      var hs = H.headers(ctx).filter(function (h) { return h.type === 'date' && opts.prefer.test(H.fold(h.name)); });
      if (hs.length && !pool.some(function (r) { return r.source === 'header' || r.source === 'explicit'; })) m = H.mainRef(pq, ctx, cand, { type: 'date', pool: [{ text: hs[0].dataRange, col: hs[0].col, kind: 'range', sheet: null, headerName: hs[0].name, type: 'date', source: 'default' }] });
    }
    return m;
  }
  function label(m) { return m.ref ? H.label(m.ref) : '…'; }
  function fill(id, pq, ctx, m, ast, explain, tags) { return H.cand(id, ast, { explain: explain, target: H.target(pq, ctx, 'fill', m.ref), tags: tags || [] }); }
  /** Unit of the first free number, read from the word(s) right after (TR/RU/EN all put the unit after the number). */
  function numberWithUnit(pq) {
    var ns = H.nums(pq, { free: true, percent: false, noDate: true }), toks = pq.tokens || [];
    for (var i = 0; i < ns.length; i++) {
      var n = ns[i], unit = null;
      for (var k = 1; k <= 3 && !unit; k++) {
        var t = toks[n.tokenIndex + k];
        if (!t || t.type !== 'word') { if (t && t.type === 'punct') continue; break; }
        var f = H.fold(t.norm);
        if (UNIT_RE.workday.test(f) || (f.indexOf('is') === 0 && toks[n.tokenIndex + k + 1] && UNIT_RE.day.test(H.fold(toks[n.tokenIndex + k + 1].norm)))) unit = 'workday';
        else if (UNIT_RE.day.test(f)) unit = 'day';
        else if (UNIT_RE.month.test(f)) unit = 'month';
        else if (UNIT_RE.year.test(f)) unit = 'year';
        else if (UNIT_RE.week.test(f)) unit = 'week';
        else if (/^(tane|adet|штук|раз)/.test(f)) continue;
        else break;
      }
      if (unit) return { value: n.value, unit: unit, tokenIndex: n.tokenIndex };
    }
    if (ns.length) {
      var u = H.has(pq, 'DAYS_UNIT') || H.has(pq, 'ADD_DAYS') ? 'day' : H.has(pq, 'MONTHS_UNIT') || H.has(pq, 'ADD_MONTHS') ? 'month' : H.has(pq, 'YEARS_UNIT') || H.has(pq, 'ADD_YEARS') ? 'year' : null;
      if (H.rawHas(pq, WORKDAY_RE)) u = 'workday';
      if (u) return { value: ns[0].value, unit: u, tokenIndex: ns[0].tokenIndex };
    }
    return null;
  }
  function unitWanted(pq) {
    if (H.rawHas(pq, WORKDAY_RE) || H.any(pq, ['WORKDAY', 'NETWORKDAYS'])) return 'workday';
    if (H.has(pq, 'YEARS_UNIT') || H.rawHas(pq, /ka[cç] y[ıi]l|y[ıi]l say|y[ıi]l var|y[ıi]l olarak|(^|[^а-яё])лет(?![а-яё])|(^|[^а-яё])год[а-яё]*|years?\b/)) return 'year';
    if (H.has(pq, 'MONTHS_UNIT') || H.rawHas(pq, /ka[cç] ay|ay say|\bay var|месяц|months?\b/)) return 'month';
    if (H.has(pq, 'DAYS_UNIT') || H.rawHas(pq, /g[uü]n|дн(ей|я|и)(?![а-яё])|день|days?\b/)) return 'day';
    return null;
  }
  function dateSignals(pq) { return H.any(pq, ['DATE', 'TODAY', 'NOW', 'DATE_DIFF', 'AGE', 'ADD_DAYS', 'ADD_MONTHS', 'ADD_YEARS', 'END_OF_MONTH', 'START_OF_MONTH', 'WORKDAY', 'NETWORKDAYS', 'WEEKDAY', 'WEEKNUM', 'QUARTER', 'YEAR', 'MONTH', 'DAY', 'BIRTHDAY']) || H.rawHas(pq, /tarih|дат[аыеу]\b|\bdate|deadline|vade|срок/) || H.refs(pq, {}).some(function (r) { return r.type === 'date'; }); }
  function hasDateRef(pq) { return H.refs(pq, {}).some(function (r) { return r.type === 'date'; }); }
  function twoRefs(pq) {
    var r = dateRefs(pq);
    if (r.length >= 2) return r;
    // "A2 ile B2 arasındaki" is merged by the parser into A2:B2 — two cells on one row are two dates, not a range
    var pair = r.filter(function (x) { return x.source === 'explicit' && x.kind === 'range' && x.row && x.row === x.row2 && x.col !== x.col2; })[0];
    if (pair) {
      var mk = function (col) { return { text: col + pair.row, kind: 'cell', sheet: pair.sheet || null, col: col, col2: col, row: pair.row, row2: pair.row, type: pair.type || null, headerName: null, source: 'explicit', tokenIndex: pair.tokenIndex }; };
      return [mk(pair.col), mk(pair.col2)];
    }
    return null;
  }
  /** Order two refs as [start, end]: the one marked "başlangıç/начало/start" first, else text order. */
  function startEnd(pq, refs) {
    var toks = pq.tokens || [];
    function near(r, re) { for (var k = -3; k <= 3; k++) { var t = toks[r.tokenIndex + k]; if (t && re.test(H.fold(t.norm))) return true; } return false; }
    var a = refs[0], b = refs[1];
    if (near(b, /ba[sş]lang|начал|start|from/) && !near(a, /ba[sş]lang|начал|start/)) return [b, a];
    if (near(a, /biti[sş]|конец|конц|end|until|to\b/) && !near(b, /biti[sş]|конец|end/)) return [b, a];
    if (a.headerName && b.headerName && /biti[sş]|teslim|son|конец|оконч|end|due/.test(H.fold(a.headerName)) && /ba[sş]la|start|начал/.test(H.fold(b.headerName))) return [b, a];
    return [a, b];
  }
  var defs = [];

  /* ------------------------------------------------------------------ TODAY / NOW */
  defs.push({ id: 'today', category: 'date', title: T('Bugünün tarihi (BUGÜN)', 'Сегодняшняя дата (СЕГОДНЯ)', "Today's date (TODAY)"),
    examples: { tr: ['Bugünün tarihi', 'Bugünün tarihini yaz'], ru: ['Сегодняшняя дата', 'Вставь сегодняшнюю дату'], en: ["Today's date", 'Insert the current date'] },
    match: function (pq) {
      if (!(H.has(pq, 'TODAY') || H.wants(pq, 'TODAY'))) return 0;
      if (H.has(pq, 'NOW') || H.rawHas(pq, /saat|врем|time/)) return 0.3;
      if (H.refs(pq, {}).length || H.conds(pq).length || H.any(pq, ['DATE_DIFF', 'AGE', 'DEADLINE', 'REMAINING', 'ELAPSED', 'IF', 'ADD', 'PLUS', 'MINUS', 'ADD_DAYS'])) return 0.2;
      if (H.nums(pq, { free: true }).length) return 0.3;
      return 0.9;
    },
    build: function (pq, ctx) { return H.cand('today', A().func('TODAY'), { explain: T('Bugünün tarihini verir; her yeniden hesaplamada güncellenir.', 'Возвращает сегодняшнюю дату; обновляется при каждом пересчёте.', "Returns today's date; it updates on every recalculation."), target: H.target(pq, ctx, 'cell', null), tags: ['volatile'] }); } });
  defs.push({ id: 'now', category: 'date', title: T('Şu anki tarih ve saat (ŞİMDİ)', 'Текущие дата и время (ТДАТА)', 'Current date and time (NOW)'),
    examples: { tr: ['Şu anki tarih ve saat', 'Şimdiki zamanı yaz'], ru: ['Текущие дата и время', 'Вставь текущее время'], en: ['Current date and time', 'Insert the current time'] },
    match: function (pq) { if (H.has(pq, 'NOW') || H.wants(pq, 'NOW') || ((H.has(pq, 'TODAY') || H.has(pq, 'DATE')) && H.rawHas(pq, /\bsaat|врем|\btime\b/))) return H.refs(pq, {}).length || H.conds(pq).length ? 0.3 : 0.92; return 0; },
    build: function (pq, ctx) { return H.cand('now', A().func('NOW'), { explain: T('Şu anki tarih ve saati verir; her yeniden hesaplamada güncellenir.', 'Возвращает текущие дату и время; обновляется при пересчёте.', 'Returns the current date and time; it updates on recalculation.'), target: H.target(pq, ctx, 'cell', null), tags: ['volatile'] }); } });

  /* ------------------------------------------------------------------ age */
  defs.push({ id: 'age', category: 'date', title: T('Doğum tarihinden yaş', 'Возраст по дате рождения', 'Age from birth date'),
    examples: { tr: ['Doğum tarihinden yaş hesapla', 'Doğum tarihinden yaşı yıl olarak hesapla ve N sütununa yaz'], ru: ['Посчитай возраст по дате рождения', 'Возраст в полных годах по Дате рождения'], en: ['Calculate age from Birth Date', 'Age in full years from K2'] },
    match: function (pq) { if (!(H.has(pq, 'AGE') || H.rawHas(pq, /\bya[sş]([ıi]n?[ıi]?)?\b|возраст(?!ан)|\bage\b/))) return 0; if (H.has(pq, 'ELAPSED') && H.rawHas(pq, /g[uü]n|дн|day/)) return 0.3; if (twoRefs(pq) && !H.rawHas(pq, /do[gğ]um|рожд|birth|born/)) return 0.3; return 0.92; },
    build: function (pq, ctx, opts) {
      var cand = H.cand('age', null, {});
      var m = dateRef(pq, ctx, cand, { prefer: /dogum|рожд|birth|born/ });
      cand.ast = A().func('DATEDIF', m.cell, A().func('TODAY'), A().str('Y'));
      cand.explain = H.msg(T('%h% ile bugün arasındaki tam yıl sayısını (yaş) verir.', 'Возвращает число полных лет между %h% и сегодняшней датой (возраст).', 'Returns the number of full years between %h% and today (the age).'), { h: label(m) });
      cand.target = H.target(pq, ctx, 'fill', m.ref);
      cand.tags.push('volatile');
      return cand;
    } });

  /* ------------------------------------------------------------------ difference between two dates */
  defs.push({ id: 'date_diff', category: 'date', title: T('İki tarih arasındaki fark', 'Разница между датами', 'Difference between two dates'),
    examples: { tr: ['A2 (başlangıç) ile B2 (bitiş) arasındaki gün sayısı', 'A2 ile B2 arasındaki ay sayısı', 'A2 ile B2 arasında kaç yıl var?'], ru: ['Сколько дней между A2 (начало) и B2 (конец)?', 'Сколько месяцев между A2 и B2?', 'Сколько полных лет между A2 и B2?'], en: ['Days between A2 (start) and B2 (end)', 'Months between A2 and B2', 'Years between A2 and B2'] },
    match: function (pq) {
      var refs = twoRefs(pq);
      if (!refs) return 0;
      var unit = unitWanted(pq);
      var diff = H.any(pq, ['DATE_DIFF', 'BETWEEN', 'DIFFERENCE', 'MINUS']) || H.wants(pq, 'DATEDIF') || H.rawHas(pq, /aras[ıi]nda|между|between|from .* to/);
      if (!diff && !unit) return 0;
      if (!unit && !refs.some(function (r) { return r.type === 'date'; }) && !H.wants(pq, 'DATEDIF')) return 0;
      if (unit === 'workday') return 0;
      if (H.conds(pq).length) return 0.4;
      return 0.9;
    },
    build: function (pq, ctx, opts) {
      var cand = H.cand('date_diff', null, {});
      var se = startEnd(pq, twoRefs(pq)), a = H.cellNode(se[0], ctx), b = H.cellNode(se[1], ctx);
      var unit = unitWanted(pq) || 'day', ast, tpl;
      if (unit === 'day') {
        ast = H.wants(pq, 'DATEDIF') ? A().func('DATEDIF', a, b, A().str('D')) : A().op('-', b, a);
        tpl = T('%b% ile %a% arasındaki gün sayısını verir (bitiş eksi başlangıç).', 'Возвращает число дней между %a% и %b% (конец минус начало).', 'Returns the number of days between %a% and %b% (end minus start).');
      } else if (unit === 'month') { ast = A().func('DATEDIF', a, b, A().str('M')); tpl = T('%a% ile %b% arasındaki tam ay sayısını verir.', 'Возвращает число полных месяцев между %a% и %b%.', 'Returns the number of full months between %a% and %b%.'); }
      else { ast = A().func('DATEDIF', a, b, A().str('Y')); tpl = T('%a% ile %b% arasındaki tam yıl sayısını verir.', 'Возвращает число полных лет между %a% и %b%.', 'Returns the number of full years between %a% and %b%.'); }
      cand.ast = ast;
      cand.explain = H.msg(tpl, { a: H.label(se[0]), b: H.label(se[1]) });
      cand.target = H.target(pq, ctx, 'fill', se[0]);
      return cand;
    } });
  defs.push({ id: 'networkdays', category: 'date', title: T('İki tarih arasındaki iş günü (TAMİŞGÜNÜ)', 'Рабочие дни между датами (ЧИСТРАБДНИ)', 'Working days between dates (NETWORKDAYS)'),
    examples: { tr: ['A2 ile B2 arasındaki iş günü sayısı', 'Başlangıç ve bitiş tarihleri arasındaki iş günleri'], ru: ['Количество рабочих дней между A2 и B2', 'Рабочие дни между датами A2 и B2'], en: ['Working days between A2 and B2', 'Number of business days from A2 to B2'] },
    match: function (pq) { var refs = twoRefs(pq); if (!refs) return 0; return (H.has(pq, 'NETWORKDAYS') || H.wants(pq, ['NETWORKDAYS', 'NETWORKDAYS.INTL']) || H.rawHas(pq, WORKDAY_RE)) ? 0.93 : 0; },
    build: function (pq, ctx, opts) {
      var cand = H.cand('networkdays', null, {});
      var se = startEnd(pq, twoRefs(pq));
      cand.ast = A().func('NETWORKDAYS', H.cellNode(se[0], ctx), H.cellNode(se[1], ctx));
      cand.explain = H.msg(T('%a% ile %b% arasındaki iş günü sayısını verir (hafta sonları hariç).', 'Возвращает число рабочих дней между %a% и %b% (без выходных).', 'Returns the number of working days between %a% and %b% (weekends excluded).'), { a: H.label(se[0]), b: H.label(se[1]) });
      cand.target = H.target(pq, ctx, 'fill', se[0]);
      return cand;
    } });

  /* ------------------------------------------------------------------ days until / since */
  defs.push({ id: 'days_until', category: 'date', title: T('Tarihe kaç gün kaldı', 'Сколько дней осталось до даты', 'Days until a date'),
    examples: { tr: ['Tarihe kaç gün kaldı?', 'Teslim tarihine kalan gün sayısı'], ru: ['Сколько дней осталось до Даты?', 'Дней до дедлайна'], en: ['Days until Date', 'How many days are left until the deadline?'] },
    match: function (pq) {
      var sig = H.any(pq, ['REMAINING', 'DEADLINE']) || H.rawHas(pq, /kald[ıi]\b|kalan|осталось|остаётся|остается|\buntil\b|\bleft\b|remaining|till\b/);
      if (!sig || twoRefs(pq)) return 0;
      if (H.any(pq, ['ELAPSED']) && !H.rawHas(pq, /kald[ıi]|kalan|осталось|until|left/)) return 0;
      if (!dateSignals(pq)) return 0;
      if (H.has(pq, 'IF') && (pq.thenValue || pq.elseValue)) return 0.3;
      return 0.9;
    },
    build: function (pq, ctx, opts) {
      var cand = H.cand('days_until', null, {});
      var m = dateRef(pq, ctx, cand);
      cand.ast = A().op('-', m.cell, A().func('TODAY'));
      cand.explain = H.msg(T('Bugünden %h% tarihine kalan gün sayısını verir (geçmişse negatif).', 'Возвращает число дней от сегодня до %h% (отрицательное, если дата прошла).', 'Returns the number of days from today until %h% (negative when it has passed).'), { h: label(m) });
      cand.target = H.target(pq, ctx, 'fill', m.ref); cand.tags.push('volatile');
      return cand;
    } });
  defs.push({ id: 'days_since', category: 'date', title: T('Tarihten bu yana geçen gün', 'Сколько дней прошло с даты', 'Days since a date'),
    examples: { tr: ['Tarihten bu yana kaç gün geçti?', 'Doğum tarihinden bugüne kaç gün geçti?'], ru: ['Сколько дней прошло с Даты?', 'Сколько дней прошло с даты рождения?'], en: ['Days since Date', 'How many days have passed since K2?'] },
    match: function (pq) {
      var sig = H.has(pq, 'ELAPSED') || H.rawHas(pq, /ge[cç]ti|ge[cç]en g[uü]n|bu yana|beri|прошло|прошли|с момента|\bsince\b|elapsed|passed|\bago\b/);
      if (!sig || twoRefs(pq)) return 0;
      if (!dateSignals(pq)) return 0;
      if (H.has(pq, 'AGE') || H.rawHas(pq, /\bya[sş]\b|возраст|\bage\b/)) return 0.4;
      if (H.has(pq, 'IF') && (pq.thenValue || pq.elseValue)) return 0.3;
      if (unitWanted(pq) === 'month' || unitWanted(pq) === 'year') return 0.5;
      return 0.9;
    },
    build: function (pq, ctx, opts) {
      var cand = H.cand('days_since', null, {});
      var m = dateRef(pq, ctx, cand);
      var unit = unitWanted(pq), ast;
      if (unit === 'month') ast = A().func('DATEDIF', m.cell, A().func('TODAY'), A().str('M'));
      else if (unit === 'year') ast = A().func('DATEDIF', m.cell, A().func('TODAY'), A().str('Y'));
      else ast = A().op('-', A().func('TODAY'), m.cell);
      cand.ast = ast;
      cand.explain = H.msg(T('%h% tarihinden bugüne geçen süreyi verir.', 'Возвращает, сколько прошло с %h% до сегодняшнего дня.', 'Returns how much time has passed from %h% until today.'), { h: label(m) });
      cand.target = H.target(pq, ctx, 'fill', m.ref); cand.tags.push('volatile');
      return cand;
    } });

  /* ------------------------------------------------------------------ add / subtract a period */
  defs.push({ id: 'add_period', category: 'date', title: T('Tarihe gün / ay / yıl ekle', 'Прибавить дни / месяцы / годы к дате', 'Add days / months / years to a date'),
    examples: { tr: ['Tarihe 30 gün ekle', 'Tarihe 3 ay ekle', 'Tarihten 7 gün çıkar'], ru: ['Прибавь к Дате 30 дней', 'Прибавь к Дате 3 месяца', 'Отними от Даты 7 дней'], en: ['Add 30 days to Date', 'Add 3 months to Date', 'Subtract 7 days from Date'] },
    match: function (pq) {
      var nu = numberWithUnit(pq);
      if (!nu) return 0;
      if (!dateSignals(pq) && !H.rawHas(pq, ADD_RE) && !H.rawHas(pq, SUB_RE)) return 0;
      if (twoRefs(pq) && !H.rawHas(pq, ADD_RE) && !H.rawHas(pq, SUB_RE)) return 0;
      if (H.has(pq, 'DATE') && (H.nums(pq, { free: true, percent: false }).length + H.ords(pq).length) >= 3 && !H.refs(pq, {}).length) return 0;   // DATE(y,m,d)
      if (H.any(pq, ['LOAN', 'PAYMENT', 'INTEREST_RATE']) || H.nums(pq, { percent: true }).length) return 0;
      if (H.conds(pq).length) return 0.4;
      return 0.92;
    },
    build: function (pq, ctx, opts) {
      var cand = H.cand('add_period', null, {});
      var nu = numberWithUnit(pq), m = dateRef(pq, ctx, cand);
      var toks = pq.tokens || [], neg = false;
      // sign: a subtraction word anywhere ("çıkar", "öncesi", "минус", "отними", "subtract", "ago", "before")
      if (H.rawHas(pq, SUB_RE) && !(H.has(pq, 'ADD') && !H.rawHas(pq, /[cç][ıi]kar|отними|вычти|subtract|минус|eksi/))) neg = true;
      if (H.has(pq, 'MINUS') && !H.has(pq, 'PLUS') && !H.has(pq, 'ADD')) neg = true;
      var n = nu.value, ast, tpl;
      if (nu.unit === 'day') { ast = A().op(neg ? '-' : '+', m.cell, n); tpl = neg ? T('%h% tarihinden %n% gün öncesini verir.', 'Возвращает дату на %n% дней раньше %h%.', 'Returns the date %n% days before %h%.') : T('%h% tarihine %n% gün ekler.', 'Прибавляет %n% дней к %h%.', 'Adds %n% days to %h%.'); }
      else if (nu.unit === 'week') { ast = A().op(neg ? '-' : '+', m.cell, A().op('*', 7, n)); tpl = neg ? T('%h% tarihinden %n% hafta öncesini verir.', 'Возвращает дату на %n% недель раньше %h%.', 'Returns the date %n% weeks before %h%.') : T('%h% tarihine %n% hafta ekler.', 'Прибавляет %n% недель к %h%.', 'Adds %n% weeks to %h%.'); }
      else if (nu.unit === 'month') { ast = A().func('EDATE', m.cell, neg ? A().unary('-', n) : n); tpl = neg ? T('%h% tarihinden %n% ay öncesini verir.', 'Возвращает дату на %n% месяцев раньше %h%.', 'Returns the date %n% months before %h%.') : T('%h% tarihine %n% ay ekler (gün korunur).', 'Прибавляет %n% месяцев к %h% (день сохраняется).', 'Adds %n% months to %h% (keeping the day).'); }
      else if (nu.unit === 'year') { ast = A().func('EDATE', m.cell, neg ? A().unary('-', A().op('*', 12, n)) : A().op('*', 12, n)); tpl = neg ? T('%h% tarihinden %n% yıl öncesini verir.', 'Возвращает дату на %n% лет раньше %h%.', 'Returns the date %n% years before %h%.') : T('%h% tarihine %n% yıl ekler.', 'Прибавляет %n% лет к %h%.', 'Adds %n% years to %h%.'); }
      else { ast = A().func('WORKDAY', m.cell, neg ? A().unary('-', n) : n); tpl = T('%h% tarihine %n% iş günü ekler (hafta sonları atlanır).', 'Прибавляет %n% рабочих дней к %h% (выходные пропускаются).', 'Adds %n% working days to %h% (skipping weekends).'); }
      if (nu.unit === 'workday') cand.intent = 'workday';
      else cand.intent = nu.unit === 'day' || nu.unit === 'week' ? 'add_days' : nu.unit === 'month' ? 'add_months' : 'add_years';
      cand.ast = ast;
      cand.explain = H.msg(tpl, { h: label(m), n: n });
      cand.target = H.target(pq, ctx, 'fill', m.ref);
      return cand;
    } });

  /* ------------------------------------------------------------------ end / start of month */
  function monthEdge(id, which) {
    return { id: id, category: 'date', title: which === 'end' ? T('Ayın son günü (SERİAY)', 'Конец месяца (КОНМЕСЯЦА)', 'End of month (EOMONTH)') : T('Ayın ilk günü', 'Начало месяца', 'Start of month'),
      examples: which === 'end' ? { tr: ['Tarihin ay sonunu bul', 'Tarihin bulunduğu ayın son günü'], ru: ['Конец месяца для Даты', 'Последний день месяца по Дате'], en: ['End of month of Date', 'Last day of the month for F2'] } : { tr: ['Tarihin ay başını bul', 'Tarihin bulunduğu ayın ilk günü'], ru: ['Начало месяца для Даты', 'Первый день месяца по Дате'], en: ['Start of month of Date', 'First day of the month for F2'] },
      match: function (pq) {
        var c = which === 'end' ? (H.has(pq, 'END_OF_MONTH') || H.rawHas(pq, /ay[ıi]?n? sonu|ay sonunu|ay[ıi]n son g[uü]n|конец месяца|последний день месяца|конца месяца|end of (the )?month|last day of (the )?month/)) : (H.has(pq, 'START_OF_MONTH') || H.rawHas(pq, /ay[ıi]?n? ba[sş][ıi]|ay ba[sş][ıi]n[ıi]|ay[ıi]n ilk g[uü]n|начало месяца|первый день месяца|начала месяца|start of (the )?month|first day of (the )?month|beginning of (the )?month/));
        return c ? 0.93 : 0;
      },
      build: function (pq, ctx, opts) {
        var cand = H.cand(id, null, {});
        var m = dateRef(pq, ctx, cand);
        cand.ast = which === 'end' ? A().func('EOMONTH', m.cell, 0) : A().op('+', A().func('EOMONTH', m.cell, -1), 1);
        cand.explain = H.msg(which === 'end' ? T('%h% tarihinin bulunduğu ayın son gününü verir.', 'Возвращает последний день месяца даты %h%.', 'Returns the last day of the month of %h%.') : T('%h% tarihinin bulunduğu ayın ilk gününü verir.', 'Возвращает первый день месяца даты %h%.', 'Returns the first day of the month of %h%.'), { h: label(m) });
        cand.target = H.target(pq, ctx, 'fill', m.ref);
        return cand;
      } };
  }
  defs.push(monthEdge('end_of_month', 'end'));
  defs.push(monthEdge('start_of_month', 'start'));

  /* ------------------------------------------------------------------ parts: YEAR / MONTH / DAY / quarter / names / week number / weekend */
  function partIntent(id, concept, fn, re, tpl, title, examples) {
    return { id: id, category: 'date', title: title, examples: examples,
      match: function (pq) {
        if (!(H.has(pq, concept) || H.rawHas(pq, re))) return 0;
        if (numberWithUnit(pq)) return 0;
        if (H.rawHas(pq, NAME_RE) && (concept === 'MONTH' || concept === 'WEEKDAY')) return 0;
        if (H.any(pq, ['END_OF_MONTH', 'START_OF_MONTH', 'AGE', 'DATE_DIFF', 'QUARTER', 'WEEKNUM']) || H.rawHas(pq, /sonu|ba[sş][ıi]|конец|начал|end of|start of|hafta sonu|выходн|weekend|çeyre|квартал|quarter|hafta numa|номер недели|week number/)) return 0;
        if (twoRefs(pq)) return 0;
        if (!dateSignals(pq) && !hasDateRef(pq)) return 0;
        if (H.nums(pq, { free: true }).length >= 2) return 0;
        if (H.conds(pq).length || H.has(pq, 'IF')) return 0.3;
        return 0.88;
      },
      build: function (pq, ctx, opts) {
        var cand = H.cand(id, null, {});
        var m = dateRef(pq, ctx, cand);
        cand.ast = A().func(fn, m.cell);
        cand.explain = H.msg(tpl, { h: label(m) });
        cand.target = H.target(pq, ctx, 'fill', m.ref);
        return cand;
      } };
  }
  defs.push(partIntent('year', 'YEAR', 'YEAR', /y[ıi]l[ıi]n?[ıi]? al|y[ıi]l[ıi]\b|\bгод\b|год из|\byear\b/, T('%h% tarihinin yılını verir.', 'Возвращает год даты %h%.', 'Returns the year of %h%.'), T('Tarihten yıl (YIL)', 'Год из даты (ГОД)', 'Year of a date (YEAR)'), { tr: ['Tarihten yılı al', 'Tarihin yılı'], ru: ['Год из Даты', 'Какой год у Даты?'], en: ['Year of Date', 'Extract the year from F2'] }));
  defs.push(partIntent('month', 'MONTH', 'MONTH', /ay[ıi]n?[ıi]? al|\bay[ıi]\b|месяц из|\bмесяц\b|\bmonth\b/, T('%h% tarihinin ay numarasını (1–12) verir.', 'Возвращает номер месяца (1–12) даты %h%.', 'Returns the month number (1–12) of %h%.'), T('Tarihten ay (AY)', 'Месяц из даты (МЕСЯЦ)', 'Month of a date (MONTH)'), { tr: ['Tarihten ayı al', 'Tarihin ayı'], ru: ['Месяц из Даты', 'Номер месяца Даты'], en: ['Month of Date', 'Extract the month from F2'] }));
  defs.push(partIntent('day', 'DAY', 'DAY', /g[uü]n[uü]n?[uü]? al|g[uü]n[uü]\b|день из|\bдень\b|\bday\b/, T('%h% tarihinin ay içindeki gününü (1–31) verir.', 'Возвращает день месяца (1–31) даты %h%.', 'Returns the day of the month (1–31) of %h%.'), T('Tarihten gün (GÜN)', 'День из даты (ДЕНЬ)', 'Day of a date (DAY)'), { tr: ['Tarihten günü al', 'Tarihin günü'], ru: ['День из Даты', 'Число месяца Даты'], en: ['Day of Date', 'Extract the day from F2'] }));
  defs.push({ id: 'quarter', category: 'date', title: T('Tarihin çeyreği', 'Квартал по дате', 'Quarter of a date'),
    examples: { tr: ['Tarihin çeyreğini hesapla', 'Tarih hangi çeyrekte?'], ru: ['Квартал по Дате', 'В каком квартале Дата?'], en: ['Quarter of Date', 'Which quarter is F2 in?'] },
    match: function (pq) { return H.has(pq, 'QUARTER') || H.rawHas(pq, /çeyre|ceyre|квартал|quarter/) ? 0.93 : 0; },
    build: function (pq, ctx, opts) {
      var cand = H.cand('quarter', null, {}); var m = dateRef(pq, ctx, cand);
      cand.ast = A().func('ROUNDUP', A().op('/', A().func('MONTH', m.cell), 3), 0);
      cand.explain = H.msg(T('%h% tarihinin yıl içindeki çeyreğini (1–4) verir.', 'Возвращает номер квартала (1–4) даты %h%.', 'Returns the quarter (1–4) of %h%.'), { h: label(m) });
      cand.target = H.target(pq, ctx, 'fill', m.ref); return cand;
    } });
  function nameIntent(id, concept, re, fmt, tpl, title, examples) {
    return { id: id, category: 'date', title: title, examples: examples,
      match: function (pq) { if (!((H.has(pq, concept) || H.rawHas(pq, re)) && H.rawHas(pq, NAME_RE))) return 0; if (H.rawHas(pq, /hafta sonu|выходн|weekend/)) return 0; return 0.93; },
      build: function (pq, ctx, opts) {
        var cand = H.cand(id, null, {}); var m = dateRef(pq, ctx, cand);
        cand.ast = A().func('TEXT', m.cell, A().str(fmt));
        cand.explain = H.msg(tpl, { h: label(m) });
        cand.target = H.target(pq, ctx, 'fill', m.ref); return cand;
      } };
  }
  defs.push(nameIntent('weekday_name', 'WEEKDAY', /haftan[ıi]n g[uü]n|hafta g[uü]n|день недели|дня недели|weekday|day of (the )?week/, 'dddd', T('%h% tarihinin haftanın hangi günü olduğunu adıyla verir.', 'Возвращает название дня недели для даты %h%.', 'Returns the weekday name of %h%.'), T('Haftanın günü adı', 'Название дня недели', 'Weekday name'), { tr: ['Tarihin haftanın günü adını yaz', 'Tarih hangi gün?'], ru: ['Название дня недели для Даты', 'День недели Даты словом'], en: ['Weekday name of Date', 'Day of the week for F2'] }));
  defs.push(nameIntent('month_name', 'MONTH', /\bay ad|ay[ıi]n ad|название месяца|месяц словом|month name|name of (the )?month/, 'mmmm', T('%h% tarihinin ay adını verir.', 'Возвращает название месяца даты %h%.', 'Returns the month name of %h%.'), T('Ay adı', 'Название месяца', 'Month name'), { tr: ['Tarihin ay adını yaz', 'Tarihin ayı yazıyla'], ru: ['Название месяца для Даты', 'Месяц Даты словом'], en: ['Month name of Date', 'Month of F2 as a word'] }));
  defs.push({ id: 'week_number', category: 'date', title: T('Hafta numarası (HAFTASAY)', 'Номер недели (НОМНЕДЕЛИ)', 'Week number (WEEKNUM)'),
    examples: { tr: ['Tarihin hafta numarası', 'Tarih yılın kaçıncı haftası?'], ru: ['Номер недели для Даты', 'Какая неделя года у Даты?'], en: ['Week number of Date', 'Which week of the year is F2?'] },
    match: function (pq) { return H.has(pq, 'WEEKNUM') || H.rawHas(pq, /hafta numar|hafta no|ka[cç][ıi]nc[ıi] hafta|номер недели|какая неделя|week number|week of the year|weeknum/) ? 0.93 : 0; },
    build: function (pq, ctx, opts) {
      var cand = H.cand('week_number', null, {}); var m = dateRef(pq, ctx, cand);
      cand.ast = A().func('WEEKNUM', m.cell);
      cand.explain = H.msg(T('%h% tarihinin yıl içindeki hafta numarasını verir.', 'Возвращает номер недели в году для даты %h%.', 'Returns the week number of the year for %h%.'), { h: label(m) });
      cand.target = H.target(pq, ctx, 'fill', m.ref); return cand;
    } });
  defs.push({ id: 'is_weekend', category: 'date', title: T('Hafta sonu mu?', 'Выходной ли день?', 'Is it a weekend?'),
    examples: { tr: ['Tarih hafta sonuna denk geliyor mu?', 'Tarih hafta sonu mu?'], ru: ['Дата выпадает на выходной?', 'Дата — выходной день?'], en: ['Is Date on a weekend?', 'Does F2 fall on a weekend?'] },
    match: function (pq) { return H.rawHas(pq, /hafta sonu|haftasonu|выходн|weekend/) ? 0.93 : 0; },
    build: function (pq, ctx, opts) {
      var cand = H.cand('is_weekend', null, {}); var m = dateRef(pq, ctx, cand);
      var test = A().op('>', A().func('WEEKDAY', m.cell, 2), 5);
      var te = (pq.thenValue || pq.elseValue) ? H.thenElse(pq, ctx, opts) : null;
      cand.ast = te ? A().func('IF', test, te.then, te.else) : test;
      cand.explain = H.msg(T('%h% cumartesi veya pazara denk geliyorsa DOĞRU verir.', 'Возвращает ИСТИНА, если %h% приходится на субботу или воскресенье.', 'Returns TRUE when %h% falls on a Saturday or Sunday.'), { h: label(m) });
      cand.target = H.target(pq, ctx, 'fill', m.ref); return cand;
    } });

  /* ------------------------------------------------------------------ DATE from parts */
  defs.push({ id: 'date_from_parts', category: 'date', title: T('Yıl, ay ve günden tarih (TARİH)', 'Дата из года, месяца и дня (ДАТА)', 'Date from year, month and day (DATE)'),
    examples: { tr: ['2024 yılı 5. ay 15. günden tarih oluştur', 'A2 yıl, B2 ay, C2 günden tarih yap'], ru: ['Составь дату из 2024 года, 5 месяца и 15 дня', 'Дата из года A2, месяца B2 и дня C2'], en: ['Make a date from year 2024, month 5 and day 15', 'Date from year A2, month B2, day C2'] },
    match: function (pq) {
      var ns = H.nums(pq, { percent: false }).concat(H.ords(pq)), refs = H.refs(pq, { free: true });
      var parts = ns.length + refs.length;
      if (parts < 3) return 0;
      if (!(H.has(pq, 'DATE') || H.wants(pq, 'DATE') || H.rawHas(pq, /tarih|дат[ауы]|\bdate\b/))) return 0;
      if (!(H.rawHas(pq, /olu[sş]tur|yap|birle[sş]tir|составь|собери|сделай|из|make|create|build|from/) || H.any(pq, ['YEAR', 'MONTH', 'DAY']))) return 0;
      return 0.9;
    },
    build: function (pq, ctx, opts) {
      var cand = H.cand('date_from_parts', null, {});
      var toks = pq.tokens || [], items = [];
      H.nums(pq, { percent: false }).forEach(function (n) { items.push({ at: n.tokenIndex, node: A().num(n.value), value: n.value }); });
      H.ords(pq).forEach(function (o) { if (!items.some(function (x) { return x.at === o.tokenIndex; })) items.push({ at: o.tokenIndex, node: A().num(o.value), value: o.value }); });
      H.refs(pq, { free: true }).forEach(function (r) { items.push({ at: r.tokenIndex, node: H.cellNode(r, ctx), value: null }); });
      items.sort(function (a, b) { return a.at - b.at; });
      var y = null, m = null, d = null, rest = [], claimed = {};
      function unitAt(idx) { var t = toks[idx]; if (!t || t.type !== 'word' || claimed[idx]) return null; var f = H.fold(t.norm); return UNIT_RE.year.test(f) ? 'y' : UNIT_RE.month.test(f) ? 'm' : UNIT_RE.day.test(f) ? 'd' : null; }
      items.forEach(function (it) {
        var unit = null, k;
        for (k = 1; k <= 2 && !unit; k++) { unit = unitAt(it.at + k); if (unit) claimed[it.at + k] = true; else if (toks[it.at + k] && toks[it.at + k].type === 'word') break; }
        if (!unit) { unit = unitAt(it.at - 1); if (unit) claimed[it.at - 1] = true; }
        if (unit === 'y' && y == null) y = it.node; else if (unit === 'm' && m == null) m = it.node; else if (unit === 'd' && d == null) d = it.node; else rest.push(it);
      });
      if (y == null) { var big = rest.filter(function (x) { return x.value != null && x.value >= 1900; })[0]; if (big) { y = big.node; rest.splice(rest.indexOf(big), 1); } }
      if (y == null && rest.length) y = rest.shift().node;
      if (m == null && rest.length) m = rest.shift().node;
      if (d == null && rest.length) d = rest.shift().node;
      cand.ast = A().func('DATE', y || A().placeholder('number', T('yıl', 'год', 'year')), m || A().placeholder('number', T('ay', 'месяц', 'month')), d || A().placeholder('number', T('gün', 'день', 'day')));
      cand.explain = T('Verilen yıl, ay ve günden geçerli bir tarih oluşturur.', 'Собирает корректную дату из заданных года, месяца и дня.', 'Builds a valid date from the given year, month and day.');
      cand.target = H.target(pq, ctx, H.refs(pq, { free: true }).length ? 'fill' : 'cell', null);
      return cand;
    } });

  I.register(defs);
  return defs;
});
