/* Formula Studio — aggregate intents: SUM / COUNT / AVERAGE / MAX / MIN / MEDIAN / MODE / STDEV / PRODUCT with their
 * conditional variants (SUMIF(S), COUNTIF(S), AVERAGEIF(S), MAXIFS / MINIFS or MAX(IF())), plus COUNTA / COUNTBLANK,
 * count_unique, duplicate_flag, rank, nth_largest / nth_smallest. Registers into EFS.intents (loaded first). */
(function (root, factory) {
  var EFS = root.EFS || (root.EFS = {});
  var api = factory(EFS, root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (EFS, root) {
  'use strict';
  var I = EFS.intents, H = I.helpers, T = H.T;
  function A() { return EFS.ast; }

  /* ------------------------------------------------------------------ shared helpers */
  /** Token-index spans of header refs (an aggregate word inside a header name, e.g. RU "Сумма", is not an operation). */
  function refSpans(pq) {
    return (pq.refs || []).filter(function (r) { return r.source === 'header'; }).map(function (r) { return [r.tokenIndex, r.tokenEnd || r.tokenIndex + 1]; });
  }
  function inSpans(idx, spans) { for (var i = 0; i < spans.length; i++) if (idx >= spans[i][0] && idx < spans[i][1]) return true; return false; }
  /** Concept present on a token that is NOT part of a header reference. */
  function hasFree(pq, c) {
    var spans = refSpans(pq), list = pq.concepts || [];
    for (var i = 0; i < list.length; i++) if (list[i].concept === c && !inSpans(list[i].tokenIndex, spans)) return true;
    return false;
  }
  /** Primary aggregate operation of the request: free concepts first, header-embedded ones as a fallback. */
  function aggOf(pq, list) {
    if (H.aggOutsideConds && !H.aggOutsideConds(pq) && H.hasAggregate(pq) && pq.flags && pq.flags.question) return null;
    for (var i = 0; i < list.length; i++) if (hasFree(pq, list[i])) return list[i];
    var anyFree = H.AGG.some(function (c) { return hasFree(pq, c); });
    if (anyFree) return null;
    if (H.any(pq, OTHER_OPS)) return null;                         // "Product contains …": the header word is not an operation
    for (var k = 0; k < list.length; k++) if (H.has(pq, list[k])) return list[k];
    return null;
  }
  H.hasFree = hasFree; H.aggOf = aggOf;
  function conds(pq) { return H.conds(pq); }
  var RUNNING = /k[uü]m[uü]latif|birikimli|нарастающ|накопит|running|cumulative/;
  var OTHER_OPS = ['CONTAINS', 'LOOKUP', 'RETURN', 'CONCAT', 'JOIN_WITH', 'IF', 'FILTER', 'SORT', 'UNIQUE', 'UPPER', 'LOWER', 'PROPER', 'TRIM', 'LENGTH', 'LEFT_CHARS', 'RIGHT_CHARS', 'MID_CHARS', 'SUBSTITUTE', 'REPLACE', 'ROUND', 'ABS', 'SQRT', 'POWER', 'MOD', 'VAT', 'DISCOUNT', 'PERCENT', 'AGE', 'DATE_DIFF', 'ADD_DAYS', 'ADD_MONTHS', 'ADD_YEARS', 'EXTRACT_BEFORE', 'EXTRACT_AFTER', 'TO_NUMBER', 'TO_TEXT', 'MULTIPLY', 'DIVIDE', 'MINUS', 'PLUS', 'DUPLICATE', 'FIND_TEXT', 'MATCH_POSITION'];
  var TRANSFORMS = ['UPPER', 'LOWER', 'PROPER', 'TRIM', 'CLEAN', 'LENGTH', 'TO_NUMBER', 'TO_TEXT', 'CONCAT', 'SUBSTITUTE', 'LEFT_CHARS', 'RIGHT_CHARS', 'MID_CHARS', 'ROUND', 'ROUND_UP', 'ROUND_DOWN', 'ABS', 'SQRT', 'POWER', 'MOD', 'VAT', 'DISCOUNT', 'PERCENT_CHANGE', 'AGE', 'END_OF_MONTH', 'START_OF_MONTH', 'WEEKNUM', 'QUARTER', 'ADD_DAYS', 'ADD_MONTHS', 'ADD_YEARS', 'WORKDAY', 'NETWORKDAYS', 'EXTRACT_BEFORE', 'EXTRACT_AFTER', 'REPEAT', 'REPLACE', 'FIND_TEXT'];
  var PLURAL_LIST = /listele|списк|список|list\b|show all|göster/;

  /** Operand nodes for a plain aggregate: every free local range/cell ref, or the default header of `type`. */
  function aggArgs(pq, ctx, cand, type) {
    var free = H.byPosition(H.refs(pq, { free: true, sheet: null }));
    var seenText = {};
    free = free.filter(function (r) { var k = (r.sheet || '') + '!' + r.text; if (seenText[k]) return false; seenText[k] = true; return true; });
    var ranges = free.filter(function (r) { return H.isRangeLike(r); });
    var cells = free.filter(function (r) { return r.kind === 'cell'; });
    if (ranges.length) {
      var pick = ranges;
      if (type && ranges.length > 1) { var typed = ranges.filter(function (r) { return r.type === type; }); if (typed.length) pick = typed; }
      return { nodes: pick.map(function (r) { return H.rangeNode(r, false); }), ref: H.refOf(pick[0], ctx), multi: pick.length > 1 };
    }
    if (cells.length >= 2) return { nodes: cells.map(function (r) { return H.rangeNode(r, false); }), ref: H.refOf(cells[0], ctx), multi: true };
    if (cells.length === 1 && !ctx) return { nodes: [H.rangeNode(cells[0], false)], ref: H.refOf(cells[0], ctx), multi: false };
    var m = H.mainRef(pq, ctx, cand, { type: type, pool: [] });
    return { nodes: [m.node], ref: m.ref, multi: false, placeholder: m.placeholder };
  }
  function explainAgg(tpl, ref, nodes) {
    var label = ref ? H.label(ref) : (nodes && nodes.length ? H.serializeEN(nodes[0]).slice(1) : '…');
    return H.msg(tpl, { h: label });
  }
  function hasCellWord(pq) { return H.has(pq, 'CELL') || H.rawHas(pq, /h[uü]cre|ячеек|ячейк|ячейки|\bcells?\b/); }

  /** Generic simple aggregate builder. */
  function simpleAgg(id, fn, type, tpl) {
    return function (pq, ctx, opts) {
      var cand = H.cand(id, null, {});
      var a = aggArgs(pq, ctx, cand, type);
      cand.ast = A().func(fn, a.nodes);
      cand.explain = explainAgg(tpl, a.ref, a.nodes);
      cand.target = H.target(pq, ctx, 'cell', a.ref);
      return cand;
    };
  }

  /** Conditional aggregate (SUMIF/SUMIFS/AVERAGEIF/AVERAGEIFS/COUNTIF/COUNTIFS/MAXIFS/MINIFS/MAX(IF())). */
  function conditionalAgg(id, kind, pq, ctx, opts) {
    var cand = H.cand(id, null, {});
    var cs = conds(pq);
    var free = H.byPosition(H.refs(pq, { free: true, sheet: null })).filter(function (r) { return H.isRangeLike(r) || r.kind === 'cell'; });
    var firstCondRef = cs.length ? H.condRef(cs[0], ctx) : null;
    var valueRef = null;
    if (kind !== 'count') {
      var numeric = free.filter(function (r) { return r.type === 'number'; });
      valueRef = numeric.length ? H.refOf(numeric[0], ctx) : (free.length ? H.refOf(free[0], ctx) : null);
      if (!valueRef) {
        if (firstCondRef && (firstCondRef.type === 'number' || !ctx || !firstCondRef.type)) valueRef = firstCondRef;
        else { var m = H.mainRef(pq, ctx, cand, { type: 'number', pool: [] }); valueRef = m.ref; if (m.placeholder) valueRef = null; }
      }
    }
    var fallbackRef = valueRef || firstCondRef || null;
    cs = cs.map(function (c) {
      if (c.refObj || c.ref) return c;
      var guess = null;
      if (typeof c.value === 'string' && c.op !== 'empty' && c.op !== 'notEmpty') { guess = H.headerByWord(pq, ctx, ['text'], Math.max(0, c.tokenIndex - 4), c.tokenIndex + 1) || H.defaultHeader(ctx, ['text']); }
      else if (c.op === 'empty' || c.op === 'notEmpty') guess = H.headerByWord(pq, ctx, [], Math.max(0, c.tokenIndex - 4), c.tokenIndex + 1);
      if (!guess) return c;
      H.assume(cand, T('Koşul sütunu olarak “%h%” varsayıldı.', 'Для условия взят столбец «%h%».', 'Assumed the “%h%” column for the condition.'), { h: guess.headerName });
      return Object.assign({}, c, { ref: guess.text, refObj: guess });
    });
    var pairs = H.criteriaPairs(cs, pq, ctx, fallbackRef, false);
    var conj = H.conjunction(cs, pq);
    var valueNode = valueRef ? H.rangeNode(valueRef, false) : A().placeholder(kind === 'average' ? 'range' : 'sum_range');
    var critRef = firstCondRef || (pairs.length === 1 ? pairs[0].ref : null);   // a condition without its own column compares the value range
    var sameRange = valueRef && critRef && pairs.length === 1 && valueRef.text === critRef.text && valueRef.sheet === critRef.sheet;
    var fnBase = { sum: 'SUM', average: 'AVERAGE', count: 'COUNT', max: 'MAX', min: 'MIN' }[kind];
    var wantsPlural = H.wants(pq, [fnBase + 'IFS']);
    var ast;
    if (conj === 'OR' && pairs.length > 1) {
      // OR between conditions: SUMPRODUCT over the boolean sum of the conditions
      var sumExpr = null;
      for (var i = 0; i < cs.length; i++) { var e = A().paren(H.condExpr(cs[i], pq, ctx, fallbackRef, false)); sumExpr = sumExpr ? A().op('+', sumExpr, e) : e; }
      var test = A().paren(A().op('>', sumExpr, 0));
      if (kind === 'count') ast = A().func('SUMPRODUCT', A().op('*', test, 1));
      else if (kind === 'sum') ast = A().func('SUMPRODUCT', A().op('*', test, valueNode));
      else if (kind === 'average') ast = A().op('/', A().func('SUMPRODUCT', A().op('*', test, valueNode)), A().func('SUMPRODUCT', A().op('*', test, 1)));
      else ast = A().func(fnBase, A().func('IF', A().op('>', sumExpr, 0), valueNode));
      cand.tags.push('array');
    } else if (kind === 'max' || kind === 'min') {
      if (H.modern(opts) && !H.wants(pq, [fnBase])) {
        var args = [valueNode];
        pairs.forEach(function (p) { args.push(p.range, p.crit); });
        ast = A().func(fnBase + 'IFS', args);
        cand.tags.push('2019');
      } else {
        ast = A().func(fnBase, A().func('IF', H.condProduct(cs, pq, ctx, fallbackRef), valueNode));
        cand.tags.push('array');
      }
    } else if (pairs.length > 1 || wantsPlural) {
      var args2 = kind === 'count' ? [] : [valueNode];
      pairs.forEach(function (p) { args2.push(p.range, p.crit); });
      ast = A().func(fnBase + 'IFS', args2);
    } else {
      var p0 = pairs[0];
      if (kind === 'count') ast = A().func('COUNTIF', p0.range, p0.crit);
      else if (sameRange || !valueRef) ast = A().func(fnBase + 'IF', p0.range, p0.crit);
      else ast = A().func(fnBase + 'IF', p0.range, p0.crit, valueNode);
    }
    if (!valueRef && kind !== 'count') H.miss(cand, 'sum_range', T('Hangi aralık hesaplanacak?', 'Какой диапазон считать?', 'Which range should be calculated?'), H.headerOptions(ctx, 'number'));
    cand.ast = ast;
    var tpl = {
      sum: T('%c% koşulunu sağlayan satırların %h% toplamı.', 'Сумма %h% по строкам, где %c%.', 'Sum of %h% for rows where %c%.'),
      average: T('%c% koşulunu sağlayan satırların %h% ortalaması.', 'Среднее %h% по строкам, где %c%.', 'Average of %h% for rows where %c%.'),
      count: T('%c% koşulunu sağlayan satır sayısı.', 'Количество строк, где %c%.', 'Number of rows where %c%.'),
      max: T('%c% koşulunu sağlayan satırların en yüksek %h% değeri.', 'Максимум %h% среди строк, где %c%.', 'Highest %h% among rows where %c%.'),
      min: T('%c% koşulunu sağlayan satırların en düşük %h% değeri.', 'Минимум %h% среди строк, где %c%.', 'Lowest %h% among rows where %c%.')
    }[kind];
    cand.explain = H.msg(tpl, { h: valueRef ? H.label(valueRef) : '…', c: describeConds(cs, pq, ctx, fallbackRef) });
    cand.target = H.target(pq, ctx, 'cell', valueRef || firstCondRef);
    return cand;
  }
  function describeConds(cs, pq, ctx, fallbackRef) {
    return cs.map(function (c) {
      var ref = H.condRef(c, ctx) || fallbackRef;
      var label = ref ? H.label(ref) : '…';
      var v = c.op === 'empty' ? '""' : c.op === 'notEmpty' ? '<>""' : c.op === 'between' ? (c.value + '…' + c.value2) : (c.valueRef || (typeof c.value === 'string' ? '"' + c.value + '"' : c.value));
      var op = { contains: '∋', startsWith: '^', endsWith: '$', between: '∈', empty: '', notEmpty: '' }[c.op] || c.op;
      return label + ' ' + op + ' ' + v;
    }).join(', ');
  }
  H.describeConds = describeConds;

  /* ------------------------------------------------------------------ match helpers */
  function baseMatch(pq, concepts, type) {
    var op = aggOf(pq, concepts);
    if (!op) return 0;
    var cs = conds(pq);
    var s = 0.86;
    if (cs.length) s = 0.35;                                   // conditional variant should win
    if (H.rawHas(pq, RUNNING)) s = Math.min(s, 0.3);
    if (H.any(pq, TRANSFORMS)) s = Math.min(s, 0.4);                // per-row text/date/math transform words dominate
    var free = H.refs(pq, { free: true, sheet: null });
    if (type && free.length && free[0].type && free[0].type !== type) s -= 0.1;
    if (free.some(function (r) { return r.kind === 'cell'; }) && free.length === 1 && ctxLess(pq)) s -= 0.1;
    return H.clamp(s);
  }
  function ctxLess(pq) { return !(pq.refs || []).some(function (r) { return r.source === 'header' || r.source === 'default'; }); }
  function condMatch(pq, concepts) {
    var op = aggOf(pq, concepts);
    if (!op) return 0;
    var cs = conds(pq);
    if (!cs.length) return 0;
    var s = 0.88;
    if (H.has(pq, 'IF') && (pq.thenValue || pq.elseValue)) s = 0.45;   // IF with then/else → logic intents
    return s;
  }
  function nthSignals(pq) {
    var ords = H.ords(pq);
    if (ords.length) return true;
    return H.any(pq, ['NTH_LARGEST', 'NTH_SMALLEST']);
  }
  function listSignals(pq) { return H.any(pq, ['TOP_N', 'BOTTOM_N', 'LIST', 'FILTER', 'SORT']) || H.rawHas(pq, PLURAL_LIST); }

  var defs = [];

  /* ------------------------------------------------------------------ SUM */
  defs.push({
    id: 'sum', category: 'aggregate',
    title: T('Toplam', 'Сумма', 'Sum'),
    examples: { tr: ['Tutar sütununu topla', 'A2:A100 toplamı', 'Adet sütununun toplamını hesapla'], ru: ['Посчитай сумму по столбцу Сумма', 'Сумма A2:A100', 'Итог по столбцу Кол-во'], en: ['Sum the Amount column', 'Total of A2:A100', 'Add up column E'] },
    match: function (pq) {
      var s = baseMatch(pq, ['SUM', 'TOTAL'], 'number');
      if (!s) return 0;
      if (H.any(pq, ['PRODUCT', 'MULTIPLY']) && H.refs(pq, { free: true }).length >= 2) s = Math.min(s, 0.4);
      if (H.any(pq, ['SHARE', 'RATIO', 'PERCENT_OF', 'PERCENT', 'VAT']) && !H.has(pq, 'TOTAL')) s = Math.min(s, 0.3);
      if (H.any(pq, ['SHARE', 'RATIO']) ) s = Math.min(s, 0.3);
      if (H.has(pq, 'PLUS') && H.refs(pq, { free: true, kinds: ['cell'] }).length >= 2) s = Math.min(s, 0.5);
      return s;
    },
    build: simpleAgg('sum', 'SUM', 'number', T('%h% değerlerinin toplamını verir.', 'Возвращает сумму значений %h%.', 'Returns the sum of %h%.'))
  });
  defs.push({
    id: 'sum_if', category: 'aggregate',
    title: T('Koşullu toplam', 'Сумма по условию', 'Conditional sum'),
    examples: { tr: ['Kategori "Gıda" olanların Tutarını topla', 'Tutarı 100\'den büyük olanları topla', 'Kategori "Gıda" ve Şehir "Ankara" olanların tutarını topla'], ru: ['Сумма по столбцу Сумма, где Категория равна "Еда"', 'Сложи значения в столбце Сумма, которые больше 100', 'Сумма, где Категория "Еда" и Город "Казань"'], en: ['Sum Amount where Category is "Food"', 'Sum the Amounts greater than 100', 'Sum Amount where Category is "Food" and City is "London"'] },
    match: function (pq) { return condMatch(pq, ['SUM', 'TOTAL']); },
    build: function (pq, ctx, opts) { var c = conditionalAgg('sum_if', 'sum', pq, ctx, opts); if (H.usesFunction(c.ast, 'SUMIFS')) c.intent = 'sum_ifs'; return c; }
  });
  defs.push({ id: 'sum_ifs', category: 'aggregate', title: T('Çok koşullu toplam', 'Сумма по нескольким условиям', 'Multi-condition sum'),
    examples: { tr: ['Satış Temsilcisi "Mehmet", Kategori "Gıda" ve Şehir "Ankara" olanların adetini topla', 'Tutarı 100 ile 500 arasında olanları topla'], ru: ['Сумма Кол-во, где Менеджер "Иван", Категория "Еда" и Город "Казань"', 'Сумма продаж от 100 до 500'], en: ['Sum Amount between 100 and 500', 'Sum Quantity where Rep is "Ann" and City is "Paris"'] },
    match: function (pq) { return conds(pq).length >= 2 && condMatch(pq, ['SUM', 'TOTAL']) ? 0.3 : 0; },
    build: function (pq, ctx, opts) { return conditionalAgg('sum_ifs', 'sum', pq, ctx, opts); }
  });

  /* ------------------------------------------------------------------ COUNT family */
  function countKind(pq, ctx, ref) {
    var cellWord = hasCellWord(pq);
    if (H.has(pq, 'COUNT_EMPTY') || (H.has(pq, 'EMPTY') && !H.has(pq, 'NOT_EMPTY'))) return 'COUNTBLANK';
    if (H.has(pq, 'COUNT_NONEMPTY') || H.has(pq, 'NOT_EMPTY')) return 'COUNTA';
    if (H.rawHas(pq, /sayılar|sayıları|sayisal|чисел|числа|numbers|numeric/)) return 'COUNT';
    var type = ref ? ref.type : null;
    if (type === 'number') return 'COUNT';
    if (type === 'text' || type === 'date' || type === 'mixed' || type === 'bool') return 'COUNTA';
    return cellWord ? 'COUNTA' : 'COUNT';
  }
  defs.push({
    id: 'count', category: 'aggregate',
    title: T('Say', 'Количество', 'Count'),
    examples: { tr: ['Ürün sütunundaki dolu hücreleri say', 'Adet sütunundaki sayıları say', 'Şehir sütununda boş hücre sayısı'], ru: ['Сколько непустых ячеек в столбце Товар?', 'Посчитай количество чисел в столбце Кол-во', 'Сколько пустых ячеек в столбце Город?'], en: ['Count the non-empty cells in the Product column', 'Count numbers in column C', 'Count empty cells in column H'] },
    match: function (pq) {
      var s = baseMatch(pq, ['COUNT', 'COUNT_NONEMPTY', 'COUNT_EMPTY'], null);
      var cs = conds(pq);
      if (!s && !cs.length && pq.flags && pq.flags.question && !H.hasAggregate(pq) && H.any(pq, ['ROW', 'CELL', 'EMPTY', 'NOT_EMPTY'])) s = 0.55;
      if (!s) return 0;
      if (H.has(pq, 'COUNT_UNIQUE')) return 0.2;
      if (cs.length === 1 && (cs[0].op === 'empty' || cs[0].op === 'notEmpty')) s = hasCellWord(pq) && !H.has(pq, 'ROW') && !cs[0].attribute ? 0.87 : 0.5;
      if (H.has(pq, 'CHARACTER') || H.has(pq, 'LENGTH')) s = Math.min(s, 0.3);
      return s;
    },
    build: function (pq, ctx, opts) {
      var cand = H.cand('count', null, {});
      var cs = conds(pq), ref = null, nodes;
      if (cs.length === 1 && (cs[0].op === 'empty' || cs[0].op === 'notEmpty')) { ref = H.condRef(cs[0], ctx); nodes = ref ? [H.rangeNode(ref, false)] : null; }
      if (!nodes) { var a = aggArgs(pq, ctx, cand, null); nodes = a.nodes; ref = a.ref; }
      var fn = countKind(pq, ctx, ref);
      if (cs.length === 1 && cs[0].op === 'empty') fn = 'COUNTBLANK';
      if (cs.length === 1 && cs[0].op === 'notEmpty') fn = 'COUNTA';
      cand.ast = A().func(fn, nodes);
      var tpl = fn === 'COUNTBLANK' ? T('%h% içindeki boş hücre sayısını verir.', 'Возвращает число пустых ячеек в %h%.', 'Returns the number of blank cells in %h%.')
        : fn === 'COUNTA' ? T('%h% içindeki dolu hücre sayısını verir.', 'Возвращает число непустых ячеек в %h%.', 'Returns the number of non-empty cells in %h%.')
        : T('%h% içindeki sayı adedini verir.', 'Возвращает количество чисел в %h%.', 'Returns how many numbers are in %h%.');
      cand.explain = explainAgg(tpl, ref, nodes);
      cand.target = H.target(pq, ctx, 'cell', ref);
      return cand;
    }
  });
  defs.push({
    id: 'count_if', category: 'aggregate',
    title: T('Koşullu sayım', 'Количество по условию', 'Conditional count'),
    examples: { tr: ['Şehir "Ankara" olan satışları say', 'Tutarı 500\'den büyük olan satış sayısı', 'Şehir "İstanbul" ve Durum "Ödendi" olan satışları say'], ru: ['Сколько продаж в городе Москва?', 'Количество продаж с суммой больше 500', 'Количество продаж, где Город равен "Москва" и Статус равен "Оплачено"'], en: ['Count sales where City is "London"', 'Count rows where Amount is greater than 1000', 'Count Products that contain "pen"'] },
    match: function (pq) {
      var s = condMatch(pq, ['COUNT', 'COUNT_NONEMPTY', 'COUNT_EMPTY']);
      var cs = conds(pq);
      if (!s && cs.length && pq.flags && pq.flags.question && !H.hasAggregate(pq) && !H.has(pq, 'IF')) s = 0.72;
      if (!s && cs.length && H.has(pq, 'ROW') && !H.hasAggregate(pq) && !H.has(pq, 'IF') && !H.any(pq, ['FILTER', 'SORT', 'LIST'])) s = 0.6;
      if (!s) return 0;
      if (cs.length === 1 && (cs[0].op === 'empty' || cs[0].op === 'notEmpty') && hasCellWord(pq) && !H.has(pq, 'ROW') && !H.wants(pq, ['COUNTIF', 'COUNTIFS']) && !cs[0].attribute) s = 0.5;
      if (cs.length === 1 && cs[0].refObj && cs[0].refObj.kind === 'cell' && !H.has(pq, 'COUNT')) s = 0.2;
      if (H.has(pq, 'DUPLICATE')) s = Math.min(s, 0.4);
      return s;
    },
    build: function (pq, ctx, opts) { var c = conditionalAgg('count_if', 'count', pq, ctx, opts); if (H.usesFunction(c.ast, 'COUNTIFS')) c.intent = 'count_ifs'; return c; }
  });
  defs.push({ id: 'count_ifs', category: 'aggregate', title: T('Çok koşullu sayım', 'Количество по нескольким условиям', 'Multi-condition count'),
    examples: { tr: ['Durumu "Bekliyor" ve Tutarı 1000\'den büyük olan satış sayısı', 'Kategori "Gıda" ve Durumu boş olanları say'], ru: ['Количество продаж со статусом "Ожидает" и суммой больше 1000', 'Сколько строк, где Категория "Еда" и Статус пустой?'], en: ['Count rows where Status is "Paid" and Amount is greater than 1000', 'Count rows where Category is "Food" and Status is empty'] },
    match: function (pq) { return conds(pq).length >= 2 && condMatch(pq, ['COUNT']) ? 0.3 : 0; },
    build: function (pq, ctx, opts) { return conditionalAgg('count_ifs', 'count', pq, ctx, opts); }
  });

  /* ------------------------------------------------------------------ AVERAGE */
  defs.push({
    id: 'average', category: 'aggregate',
    title: T('Ortalama', 'Среднее', 'Average'),
    examples: { tr: ['Tutar sütununun ortalamasını al', 'B2:B50 aralığının ortalaması', 'A2 ve B2\'nin ortalaması'], ru: ['Среднее значение по столбцу Сумма', 'Среднее по диапазону B2:B50', 'Среднее A2 и B2'], en: ['Average of the Amount column', 'Average of B2:B50', 'Average of A2 and B2'] },
    match: function (pq) { return baseMatch(pq, ['AVERAGE'], 'number'); },
    build: simpleAgg('average', 'AVERAGE', 'number', T('%h% değerlerinin ortalamasını verir.', 'Возвращает среднее значений %h%.', 'Returns the average of %h%.'))
  });
  defs.push({
    id: 'average_if', category: 'aggregate',
    title: T('Koşullu ortalama', 'Среднее по условию', 'Conditional average'),
    examples: { tr: ['Kategori "Gıda" olanların ortalama tutarı', 'Şehir "Ankara" ve Kategori "Kırtasiye" olanların Adet ortalaması'], ru: ['Средняя сумма для категории "Еда"', 'Среднее Кол-во, где Город "Казань" и Категория "Канцелярия"'], en: ['Average Amount where Category is "Food"', 'Average Quantity where City is "Paris" and Category is "Office"'] },
    match: function (pq) { return condMatch(pq, ['AVERAGE']); },
    build: function (pq, ctx, opts) { var c = conditionalAgg('average_if', 'average', pq, ctx, opts); if (H.usesFunction(c.ast, 'AVERAGEIFS')) c.intent = 'average_ifs'; return c; }
  });

  /* ------------------------------------------------------------------ MAX / MIN */
  function extremeMatch(pq, concept) {
    var s = baseMatch(pq, [concept], 'number');
    if (!s) return 0;
    if (nthSignals(pq)) return 0.25;
    if (listSignals(pq) && H.nums(pq, { free: true }).length) return 0.3;
    if (H.has(pq, 'IF') && (pq.thenValue || pq.elseValue)) return 0.3;
    return s;
  }
  defs.push({
    id: 'max', category: 'aggregate', title: T('En büyük değer', 'Максимум', 'Maximum'),
    examples: { tr: ['En yüksek tutarı bul', 'C3:C40 içindeki en büyük değer'], ru: ['Максимальная сумма', 'Максимум в C3:C40'], en: ['What is the highest Amount?', 'Maximum of C3:C40'] },
    match: function (pq) { return extremeMatch(pq, 'MAX'); },
    build: simpleAgg('max', 'MAX', 'number', T('%h% içindeki en büyük değeri verir.', 'Возвращает наибольшее значение в %h%.', 'Returns the largest value in %h%.'))
  });
  defs.push({
    id: 'min', category: 'aggregate', title: T('En küçük değer', 'Минимум', 'Minimum'),
    examples: { tr: ['En düşük Birim Fiyat nedir?', 'D2:D20 arasındaki en küçük sayı'], ru: ['Какая минимальная цена?', 'Минимальное число в диапазоне D2:D20'], en: ['Lowest Unit Price', 'Minimum of D2:D20'] },
    match: function (pq) { return extremeMatch(pq, 'MIN'); },
    build: simpleAgg('min', 'MIN', 'number', T('%h% içindeki en küçük değeri verir.', 'Возвращает наименьшее значение в %h%.', 'Returns the smallest value in %h%.'))
  });
  defs.push({
    id: 'max_ifs', category: 'aggregate', title: T('Koşullu en büyük', 'Максимум по условию', 'Conditional maximum'),
    examples: { tr: ['Kategori "Gıda" olanların en yüksek tutarı', 'Kategori "Gıda" ve Şehir "Ankara" olanların en yüksek tutarı'], ru: ['Максимальная сумма для категории "Еда"', 'Максимальная сумма, где Категория "Еда" и Город "Казань"'], en: ['Max Amount where Category is "Food"', 'Highest Amount where City is "Paris" and Status is "Paid"'] },
    match: function (pq) { var s = condMatch(pq, ['MAX']); return s && !nthSignals(pq) ? s : 0; },
    build: function (pq, ctx, opts) { return conditionalAgg('max_ifs', 'max', pq, ctx, opts); }
  });
  defs.push({
    id: 'min_ifs', category: 'aggregate', title: T('Koşullu en küçük', 'Минимум по условию', 'Conditional minimum'),
    examples: { tr: ['Şehir "İstanbul" olan satışların en düşük tutarı', 'Durum "Ödendi" olanların en düşük adedi'], ru: ['Минимальная сумма, где Город равен "Казань"', 'Минимальное Кол-во, где Статус "Оплачено"'], en: ['Min Amount where City is "London"', 'Lowest Quantity where Status is "Paid"'] },
    match: function (pq) { var s = condMatch(pq, ['MIN']); return s && !nthSignals(pq) ? s : 0; },
    build: function (pq, ctx, opts) { return conditionalAgg('min_ifs', 'min', pq, ctx, opts); }
  });

  /* ------------------------------------------------------------------ MEDIAN / MODE / STDEV / VAR / PRODUCT */
  defs.push({ id: 'median', category: 'aggregate', title: T('Medyan', 'Медиана', 'Median'),
    examples: { tr: ['Tutar sütununun medyanı', 'A2:A100 ortancası'], ru: ['Медиана по столбцу Сумма', 'Медиана A2:A100'], en: ['Median of Amount', 'Median of A2:A100'] },
    match: function (pq) { return baseMatch(pq, ['MEDIAN'], 'number'); },
    build: simpleAgg('median', 'MEDIAN', 'number', T('%h% değerlerinin medyanını (ortanca) verir.', 'Возвращает медиану значений %h%.', 'Returns the median of %h%.')) });
  defs.push({ id: 'mode', category: 'aggregate', title: T('En sık tekrar eden değer', 'Мода', 'Mode'),
    examples: { tr: ['Adet sütununda en çok tekrar eden değer', 'A2:A100 içinde en sık geçen sayı'], ru: ['Мода по столбцу Кол-во', 'Самое частое число в A2:A100'], en: ['Mode of Quantity', 'Most frequent value in A2:A100'] },
    match: function (pq) { return baseMatch(pq, ['MODE'], 'number'); },
    build: simpleAgg('mode', 'MODE.SNGL', 'number', T('%h% içinde en sık tekrar eden değeri verir.', 'Возвращает наиболее часто встречающееся значение в %h%.', 'Returns the most frequent value in %h%.')) });
  defs.push({ id: 'stdev', category: 'aggregate', title: T('Standart sapma', 'Стандартное отклонение', 'Standard deviation'),
    examples: { tr: ['Tutar sütununun standart sapması', 'A2:A100 standart sapması'], ru: ['Стандартное отклонение по столбцу Сумма', 'Стандартное отклонение A2:A100'], en: ['Standard deviation of Amount', 'Standard deviation of A2:A100'] },
    match: function (pq) { return baseMatch(pq, ['STDEV'], 'number'); },
    build: simpleAgg('stdev', 'STDEV.S', 'number', T('%h% değerlerinin örneklem standart sapmasını verir.', 'Возвращает выборочное стандартное отклонение %h%.', 'Returns the sample standard deviation of %h%.')) });
  defs.push({ id: 'variance', category: 'aggregate', title: T('Varyans', 'Дисперсия', 'Variance'),
    examples: { tr: ['Tutar sütununun varyansı', 'A2:A100 varyansı'], ru: ['Дисперсия по столбцу Сумма', 'Дисперсия A2:A100'], en: ['Variance of Amount', 'Variance of A2:A100'] },
    match: function (pq) { return baseMatch(pq, ['VARIANCE'], 'number'); },
    build: simpleAgg('variance', 'VAR.S', 'number', T('%h% değerlerinin örneklem varyansını verir.', 'Возвращает выборочную дисперсию %h%.', 'Returns the sample variance of %h%.')) });
  defs.push({ id: 'product', category: 'aggregate', title: T('Çarpım', 'Произведение', 'Product'),
    examples: { tr: ['A2:A10 aralığındaki sayıların çarpımı', 'Adet sütununun çarpımı'], ru: ['Произведение чисел в A2:A10', 'Произведение по столбцу Кол-во'], en: ['Product of A2:A10', 'Multiply all numbers in column C'] },
    match: function (pq) {
      var s = baseMatch(pq, ['PRODUCT'], 'number');
      if (!s) return 0;
      var free = H.refs(pq, { free: true });
      if (free.length >= 2 || H.has(pq, 'SUM')) return 0.2;       // multiply_columns / sumproduct handle these
      if (free.length === 1 && free[0].kind === 'cell') return 0.2;
      return s;
    },
    build: simpleAgg('product', 'PRODUCT', 'number', T('%h% değerlerinin çarpımını verir.', 'Возвращает произведение значений %h%.', 'Returns the product of %h%.')) });

  /* ------------------------------------------------------------------ count unique / duplicates */
  defs.push({
    id: 'count_unique', category: 'aggregate', title: T('Benzersiz değer sayısı', 'Число уникальных значений', 'Count unique values'),
    examples: { tr: ['Kaç farklı Ürün var?', 'Şehir sütununda kaç benzersiz değer var?'], ru: ['Сколько уникальных товаров?', 'Сколько разных городов в столбце Город?'], en: ['Count unique Products', 'How many distinct cities are there?'] },
    match: function (pq) {
      var listed = H.any(pq, ['LIST', 'FILTER', 'SORT']) || H.rawHas(pq, PLURAL_LIST);
      if (H.has(pq, 'COUNT_UNIQUE')) return listed && !H.has(pq, 'COUNT') && !(pq.flags && pq.flags.question) ? 0.3 : 0.9;
      if (H.any(pq, ['UNIQUE', 'REMOVE_DUPLICATES']) && (H.any(pq, ['COUNT', 'QUESTION']) || (pq.flags && pq.flags.question)) && !listed) return 0.85;
      return 0;
    },
    build: function (pq, ctx, opts) {
      var cand = H.cand('count_unique', null, {});
      var m = H.mainRef(pq, ctx, cand, { type: 'text' });
      var modern = H.modern(opts);
      var ast = modern ? A().func('ROWS', A().func('UNIQUE', m.node)) : A().func('SUMPRODUCT', A().op('/', 1, A().func('COUNTIF', m.node, m.node)));
      var alt = modern ? A().func('SUMPRODUCT', A().op('/', 1, A().func('COUNTIF', m.node, m.node))) : A().func('ROWS', A().func('UNIQUE', m.node));
      cand.ast = ast;
      cand.tags = modern ? ['365'] : ['array'];
      cand.explain = H.msg(T('%h% içindeki farklı (benzersiz) değerlerin sayısını verir.', 'Возвращает число различных (уникальных) значений в %h%.', 'Returns the number of distinct values in %h%.'), { h: m.ref ? H.label(m.ref) : '…' });
      cand.target = H.target(pq, ctx, 'cell', m.ref);
      cand.alternatives = [H.cand('count_unique', alt, { confidence: 0.6, explain: cand.explain, tags: modern ? ['array'] : ['365'], target: cand.target })];
      return cand;
    }
  });
  defs.push({
    id: 'duplicate_flag', category: 'aggregate', title: T('Tekrar edenleri işaretle', 'Пометить дубликаты', 'Flag duplicates'),
    examples: { tr: ['Ürün tekrar ediyorsa "Tekrar" yaz, değilse boş bırak', 'Tekrar eden ürünleri işaretle'], ru: ['Если Товар повторяется, напиши "Дубликат", иначе оставь пустым', 'Отметь повторяющиеся товары словом "Повтор", иначе пусто'], en: ['Flag duplicates in Product with "Duplicate", otherwise blank', 'Mark repeated products'] },
    match: function (pq) {
      if (!H.has(pq, 'DUPLICATE')) return 0;
      if (H.any(pq, ['UNIQUE', 'REMOVE_DUPLICATES']) && !H.has(pq, 'IF')) return 0.2;
      if (H.has(pq, 'MODE') && !H.has(pq, 'IF')) return 0.25;
      if (H.has(pq, 'COUNT') && !H.has(pq, 'IF') && !pq.thenValue && !H.lits(pq).length) return 0.4;
      return 0.9;
    },
    build: function (pq, ctx, opts) {
      var cand = H.cand('duplicate_flag', null, {});
      var lang = H.lang(pq, opts);
      var m = H.mainRef(pq, ctx, cand, { type: 'text' });
      var thenNode = H.valueNode(pq.thenValue, ctx);
      if (!thenNode) { var lits = H.lits(pq, { free: true }); if (lits.length) thenNode = A().str(lits[0].value); }
      if (!thenNode) thenNode = H.word(H.DUPLICATE, lang);
      var elseNode = H.valueNode(pq.elseValue, ctx) || A().str('');
      var absRange = m.placeholder ? m.node : H.rangeNode(m.ref, true);
      cand.ast = A().func('IF', A().op('>', A().func('COUNTIF', absRange, m.cell), 1), thenNode, elseNode);
      cand.explain = H.msg(T('%h% değeri sütunda birden fazla geçiyorsa “%t%” yazar, aksi halde %e%.', 'Если значение %h% встречается в столбце более одного раза, пишет «%t%», иначе %e%.', 'Writes “%t%” when the %h% value occurs more than once in the column, otherwise %e%.'), { h: m.ref ? H.label(m.ref) : '…', t: thenNode.v, e: elseNode.t === 'str' && elseNode.v === '' ? H.pick(T('boş bırakır', 'оставляет пусто', 'leaves it blank'), lang) : H.serializeEN(elseNode).slice(1) });
      cand.target = H.target(pq, ctx, 'fill', m.ref);
      return cand;
    }
  });

  /* ------------------------------------------------------------------ rank / nth largest / nth smallest */
  defs.push({
    id: 'rank', category: 'aggregate', title: T('Sıralama numarası', 'Ранг', 'Rank'),
    examples: { tr: ['Tutara göre sıralama numarası ver (en büyük 1 olsun)', 'Tutara göre artan sıra numarası ver'], ru: ['Ранг по Сумме (наибольшая — первая)', 'Ранг по Сумме по возрастанию'], en: ['Rank by Amount, largest first', 'Ascending rank by Amount'] },
    match: function (pq) {
      // "sıralama numarası" / "sıra numarası" / "rank" / "ранг": an explicit rank phrase beats SORT / SEQUENCE words around it
      if (H.rawHas(pq, /s[ıi]ra(lama)? numaras|s[ıi]ralama (no|numara)|\brank(ing)?\b|ранг/)) return 0.95;
      if (!H.has(pq, 'RANK')) return 0; if (H.any(pq, ['SORT'])) return 0.3; return 0.9;
    },
    build: function (pq, ctx, opts) {
      var cand = H.cand('rank', null, {});
      var m = H.mainRef(pq, ctx, cand, { type: 'number' });
      var asc = H.has(pq, 'ASC') || H.rawHas(pq, /artan|k[uü][cç][uü]kten|возраст|ascending|smallest first|lowest first/);
      if (H.has(pq, 'DESC') || H.rawHas(pq, /azalan|b[uü]y[uü]kten|убыва|descending|largest first|наибольш/)) asc = false;
      var absRange = m.placeholder ? A().placeholder('range') : H.rangeNode(m.ref, true);
      cand.ast = A().func('RANK.EQ', m.cell, absRange, asc ? 1 : 0);
      cand.explain = H.msg(asc ? T('%h% değerinin küçükten büyüğe sıra numarasını verir (en küçük = 1).', 'Возвращает ранг %h% по возрастанию (наименьшее = 1).', 'Returns the ascending rank of %h% (smallest = 1).') : T('%h% değerinin büyükten küçüğe sıra numarasını verir (en büyük = 1).', 'Возвращает ранг %h% по убыванию (наибольшее = 1).', 'Returns the descending rank of %h% (largest = 1).'), { h: m.ref ? H.label(m.ref) : '…' });
      cand.target = H.target(pq, ctx, 'fill', m.ref);
      return cand;
    }
  });
  function nth(id, concept, extreme, fn, tpl) {
    return {
      id: id, category: 'aggregate', title: extreme === 'MAX' ? T('N. en büyük değer', 'N-е наибольшее значение', 'Nth largest value') : T('N. en küçük değer', 'N-е наименьшее значение', 'Nth smallest value'),
      examples: extreme === 'MAX' ? { tr: ['En yüksek 3. tutar', 'Tutara göre en büyük 5. değer'], ru: ['Третья по величине сумма', 'Пятая по величине сумма'], en: ['Third largest Amount', '5th highest value in E2:E200'] }
        : { tr: ['En düşük 2. tutar', 'İkinci en küçük adet'], ru: ['Вторая наименьшая сумма', 'Третья по возрастанию цена'], en: ['Second smallest Amount', '3rd lowest value in E2:E200'] },
      match: function (pq) {
        var direct = H.has(pq, concept);
        var wordRe = extreme === 'MAX' ? /по величине|наибольш|крупнейш|largest|biggest|highest|en b[uü]y[uü]k|en y[uü]ksek|en fazla/ : /наименьш|самая маленькая|smallest|lowest|en k[uü][cç][uü]k|en d[uü][sş][uü]k|en az/;
        var viaExtreme = (aggOf(pq, [extreme]) === extreme || H.rawHas(pq, wordRe)) && nthSignals(pq);
        if (!direct && !viaExtreme) return 0;
        if (listSignals(pq) && !H.ords(pq).length) return 0.35;
        if (!H.ords(pq).length && !H.nums(pq, { free: true, percent: false }).length) return 0.4;
        return direct ? 0.9 : 0.86;
      },
      build: function (pq, ctx, opts) {
        var cand = H.cand(id, null, {});
        var m = H.mainRef(pq, ctx, cand, { type: 'number' });
        var ords = H.ords(pq), n = ords.length ? ords[0].value : null;
        if (n == null) { var nums = H.nums(pq, { free: true, percent: false }); if (nums.length) n = nums[0].value; }
        var nNode = n == null ? A().placeholder('n') : A().num(n);
        if (n == null) H.miss(cand, 'n', T('Kaçıncı değer isteniyor?', 'Какое по счёту значение нужно?', 'Which position (n) is wanted?'));
        cand.ast = A().func(fn, m.node, nNode);
        cand.explain = H.msg(tpl, { h: m.ref ? H.label(m.ref) : '…', n: n == null ? 'n' : n });
        cand.target = H.target(pq, ctx, 'cell', m.ref);
        return cand;
      }
    };
  }
  defs.push(nth('nth_largest', 'NTH_LARGEST', 'MAX', 'LARGE', T('%h% içindeki %n%. en büyük değeri verir.', 'Возвращает %n%-е по величине значение в %h%.', 'Returns the %n%th largest value in %h%.')));
  defs.push(nth('nth_smallest', 'NTH_SMALLEST', 'MIN', 'SMALL', T('%h% içindeki %n%. en küçük değeri verir.', 'Возвращает %n%-е наименьшее значение в %h%.', 'Returns the %n%th smallest value in %h%.')));

  I.register(defs);
  return defs;
});
