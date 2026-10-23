/* Formula Studio — logic intents: IF (single / multi-branch / AND / OR / between), inline IFERROR wrapping, and the
 * per-row flags (overdue, contains, weekend lives in intents-date.js). Registers into EFS.intents. */
(function (root, factory) {
  var EFS = root.EFS || (root.EFS = {});
  var api = factory(EFS, root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (EFS, root) {
  'use strict';
  var I = EFS.intents, H = I.helpers, T = H.T;
  function A() { return EFS.ast; }
  var OP_CONCEPTS = { PLUS: '+', MINUS: '-', MULTIPLY: '*', DIVIDE: '/' };
  var OP_PUNCT = { '+': '+', '-': '-', '*': '*', '/': '/', '×': '*', '·': '*', ':': '/', '^': '^', '&': '&' };

  /* ------------------------------------------------------------------ expression helpers (shared with math via H) */
  function tokConcept(tok, map) {
    if (!tok || !tok.concepts) return null;
    for (var i = 0; i < tok.concepts.length; i++) if (map[tok.concepts[i].concept]) return tok.concepts[i].concept;
    return null;
  }
  /** Operand/operator expression found inside a token span [from, to): refs, numbers and +,-,*,/ words or symbols.
   *  Returns an AST node (single operand allowed) or null. Refs used by conditions are skipped unless `allowUsed`. */
  H.exprBetween = function (pq, ctx, from, to, allowUsed) {
    var toks = pq.tokens || [], items = [];
    to = to == null ? toks.length : to;
    var refs = (pq.refs || []).filter(function (r) { return r.tokenIndex >= from && r.tokenIndex < to && !r.isTarget && (allowUsed || (r.usedBy !== 'condition' && r.usedBy !== 'conditionValue')); });
    var nums = (pq.numbers || []).filter(function (n) { return n.tokenIndex >= from && n.tokenIndex < to && n.usedBy !== 'condition'; });
    var i;
    for (i = 0; i < refs.length; i++) items.push({ at: refs[i].tokenIndex, node: H.cellNode(refs[i], ctx), kind: 'operand' });
    for (i = 0; i < nums.length; i++) items.push({ at: nums[i].tokenIndex, node: nums[i].isPercent ? A().percent(nums[i].value) : A().num(nums[i].value), kind: 'operand' });
    for (i = from; i < to && i < toks.length; i++) {
      var t = toks[i];
      if (!t) continue;
      var op = null;
      if (t.type === 'punct' && OP_PUNCT[t.raw]) op = OP_PUNCT[t.raw];
      else { var c = tokConcept(t, OP_CONCEPTS); if (c) op = OP_CONCEPTS[c]; }
      if (op) items.push({ at: i, op: op, kind: 'op' });
    }
    items.sort(function (a, b) { return a.at - b.at; });
    var operands = items.filter(function (x) { return x.kind === 'operand'; });
    if (!operands.length) return null;
    if (operands.length === 1) return operands[0].node;
    // operand op operand (op may sit before, between or after the operands in TR word order)
    var ops = items.filter(function (x) { return x.kind === 'op'; });
    if (!ops.length) return null;
    var node = operands[0].node;
    for (var k = 1; k < operands.length; k++) {
      var between = ops.filter(function (o) { return o.at > operands[k - 1].at && o.at < operands[k].at; });
      var op2 = between.length ? between[0].op : ops[Math.min(k - 1, ops.length - 1)].op;
      node = A().op(op2, node, operands[k].node);
    }
    return node;
  };
  /** Inline formula fragment typed by the user, e.g. "E2/C2" or "A2*B2" (consecutive ref-op-ref tokens). */
  H.inlineExpr = function (pq, ctx) {
    var toks = pq.tokens || [];
    for (var i = 0; i + 2 < toks.length; i++) {
      if (toks[i].type === 'ref' && toks[i + 1].type === 'punct' && OP_PUNCT[toks[i + 1].raw] && toks[i + 2].type === 'ref') {
        var node = A().op(OP_PUNCT[toks[i + 1].raw], H.cellNode(H.refOf(toks[i].raw), ctx), H.cellNode(H.refOf(toks[i + 2].raw), ctx));
        var j = i + 3;
        while (j + 1 < toks.length && toks[j].type === 'punct' && OP_PUNCT[toks[j].raw] && toks[j + 1].type === 'ref') { node = A().op(OP_PUNCT[toks[j].raw], node, H.cellNode(H.refOf(toks[j + 1].raw), ctx)); j += 2; }
        return node;
      }
    }
    return null;
  };

  /* ------------------------------------------------------------------ branch analysis */
  function condEnd(c) { return Math.max(c.tokenEnd || 0, (c.valueTokenIndex != null ? c.valueTokenIndex + 1 : 0), (c.tokenIndex || 0) + 1); }
  function condStart(c) { return Math.min(c.tokenIndex || 0, c.valueTokenIndex != null ? c.valueTokenIndex : c.tokenIndex || 0); }
  /** Aggregate concept present on a token outside every condition span (a comparator word is not an aggregate). */
  function aggOutsideConds(pq) {
    var cs = H.conds(pq), list = pq.concepts || [];
    for (var i = 0; i < list.length; i++) {
      if (H.AGG.indexOf(list[i].concept) < 0) continue;
      var ti = list[i].tokenIndex, inside = false;
      for (var k = 0; k < cs.length; k++) if (ti >= condStart(cs[k]) && ti < condEnd(cs[k])) { inside = true; break; }
      if (!inside) return true;
    }
    return false;
  }
  H.aggOutsideConds = aggOutsideConds;
  function hasC(tok, c) { return !!tok && !!tok.concepts && tok.concepts.some(function (x) { return x.concept === c; }); }
  /** Value tokens (quoted literals, free numbers, free refs) usable as branch results, in order. */
  function valueTokens(pq) {
    var out = [];
    (pq.literals || []).forEach(function (l) { if (l.usedBy !== 'condition') out.push({ at: l.tokenIndex, kind: 'str', value: l.value, usedBy: l.usedBy, tok: l }); });
    (pq.numbers || []).forEach(function (n) { if (!n.usedBy && !n.isPercent) out.push({ at: n.tokenIndex, kind: 'num', value: n.value, usedBy: n.usedBy, tok: n }); });
    out.sort(function (a, b) { return a.at - b.at; });
    return out;
  }
  /**
   * Analyse the request into ordered branches: [{ conds:[cond…], conj:'AND'|'OR', then:node|null }], plus elseNode.
   * Handles "X ise A, Y ise B, değilse C", '"a" veya "b" ise', 'Если …, то …, если …, то …, иначе …'.
   */
  H.branches = function (pq, ctx, opts) {
    var conds = H.conds(pq).slice().sort(function (a, b) { return condStart(a) - condStart(b); });
    var toks = pq.tokens || [];
    var elseIdx = H.idx(pq, 'ELSE') >= 0 ? pq.lastIndexOf('ELSE') : -1;
    var elseStart = elseIdx >= 0 ? elseIdx : toks.length;
    // implicit extra conditions from unused literals followed by a conjunction or an IF/THEN marker
    var vals = valueTokens(pq);
    var extra = [];
    for (var v = 0; v < vals.length; v++) {
      var vt = vals[v];
      if (vt.kind !== 'str' || vt.usedBy === 'then' || vt.usedBy === 'else') continue;
      if (vt.at >= elseStart) continue;
      var next = toks[vt.at + 1], next2 = toks[vt.at + 2];
      var prevRefCond = null;
      for (var p = conds.length - 1; p >= 0; p--) if (condStart(conds[p]) <= vt.at && (conds[p].refObj || conds[p].ref)) { prevRefCond = conds[p]; break; }
      if (!prevRefCond) for (var p2 = 0; p2 < conds.length; p2++) if (conds[p2].refObj || conds[p2].ref) { prevRefCond = conds[p2]; break; }
      var alreadyCond = conds.some(function (c) { return c.valueTokenIndex === vt.at; });
      if (alreadyCond) continue;
      var prevTok = toks[vt.at - 1], prevTok2 = toks[vt.at - 2];
      if ((hasC(prevTok, 'OR') || hasC(prevTok, 'AND')) && prevTok2 && conds.some(function (c) { return c.valueTokenIndex === vt.at - 2; })) {
        // '"Москва" или "Казань"' — literal after the conjunction continues the previous condition
        extra.push({ ref: prevRefCond ? prevRefCond.ref : null, refObj: prevRefCond ? prevRefCond.refObj : null, op: '=', value: vt.value, valueKind: 'str', conjunction: hasC(prevTok, 'OR') ? 'OR' : 'AND', position: vt.at, tokenIndex: vt.at, tokenEnd: vt.at + 1, valueTokenIndex: vt.at, synthetic: true, glue: true });
        vt.used = true;
      } else if ((hasC(next, 'OR') || hasC(next, 'AND')) && next2 && (next2.type === 'string' || conds.some(function (c) { return c.valueTokenIndex === vt.at + 2; }))) {
        extra.push({ ref: prevRefCond ? prevRefCond.ref : null, refObj: prevRefCond ? prevRefCond.refObj : null, op: '=', value: vt.value, valueKind: 'str', conjunction: hasC(next, 'OR') ? 'OR' : 'AND', position: vt.at, tokenIndex: vt.at, tokenEnd: vt.at + 1, valueTokenIndex: vt.at, synthetic: true, glue: true });
        vt.used = true;
      } else if (next && (hasC(next, 'IF') || hasC(next, 'THEN')) && !(next.type === 'punct') && prevRefCond && !conds.some(function (c) { return condStart(c) <= vt.at && condEnd(c) > vt.at; })) {
        // '"Kırtasiye" ise "K"' / '"Канцелярия", то "К"'
        var isThenOfCond = conds.some(function (c) { return condEnd(c) <= vt.at && !vals.some(function (o) { return o.at > condEnd(c) && o.at < vt.at; }) && !extraBefore(vt.at); });
        if (isThenOfCond) continue;
        extra.push({ ref: prevRefCond.ref, refObj: prevRefCond.refObj, op: '=', value: vt.value, valueKind: 'str', conjunction: null, position: vt.at, tokenIndex: vt.at, tokenEnd: vt.at + 2, valueTokenIndex: vt.at, synthetic: true });
        vt.used = true;
      } else if (next && next.type === 'punct' && next2 && (hasC(next2, 'IF') || hasC(next2, 'THEN')) && prevRefCond && !conds.some(function (c) { return condStart(c) <= vt.at && condEnd(c) > vt.at; })) {
        var isThen2 = conds.some(function (c) { return condEnd(c) <= vt.at && !vals.some(function (o) { return o.at > condEnd(c) && o.at < vt.at; }) && !extraBefore(vt.at); });
        if (isThen2) continue;
        extra.push({ ref: prevRefCond.ref, refObj: prevRefCond.refObj, op: '=', value: vt.value, valueKind: 'str', conjunction: null, position: vt.at, tokenIndex: vt.at, tokenEnd: vt.at + 3, valueTokenIndex: vt.at, synthetic: true });
        vt.used = true;
      }
    }
    function extraBefore(at) { return extra.some(function (e) { return e.tokenIndex < at; }); }
    var all = conds.concat(extra).sort(function (a, b) { return condStart(a) - condStart(b); });
    // propagate refs to ref-less conditions
    var lastRef = null, lastRefObj = null;
    for (var i = 0; i < all.length; i++) {
      if (all[i].refObj || all[i].ref) { lastRef = all[i].ref; lastRefObj = all[i].refObj; }
      else if (lastRef) { all[i].ref = lastRef; all[i].refObj = lastRefObj; }
    }
    if (lastRef) for (var q = 0; q < all.length; q++) if (!all[q].ref) { all[q].ref = lastRef; all[q].refObj = lastRefObj; }
    // then-value for every condition: first free value token after it and before the next condition / else
    var branches = [], group = [];
    for (var k = 0; k < all.length; k++) {
      var c = all[k];
      var nextStart = k + 1 < all.length ? condStart(all[k + 1]) : elseStart;
      var end = condEnd(c);
      var thenTok = null;
      for (var w = 0; w < vals.length; w++) {
        var vt2 = vals[w];
        if (vt2.used || vt2.usedBy === 'else') continue;
        if (vt2.at >= end && vt2.at < Math.max(nextStart, end) && vt2.at < elseStart) { thenTok = vt2; break; }
      }
      // a ref-valued "then" (…ise Tutarı yaz) or an expression (Tutar çarpı İndirim)
      var thenNode = null;
      if (thenTok) { thenTok.used = true; thenNode = thenTok.kind === 'num' ? A().num(thenTok.value) : A().str(thenTok.value); }
      else {
        var spanEnd = Math.min(Math.max(nextStart, end), elseStart);
        // the next condition's own column ("… and Amount is greater than 100") is not a result value
        var nextRef = k + 1 < all.length ? H.condRef(all[k + 1], ctx) : null;
        if (nextRef && nextRef.tokenIndex != null && nextRef.tokenIndex < spanEnd && nextRef.tokenIndex >= end) spanEnd = nextRef.tokenIndex;
        var expr = H.exprBetween(pq, ctx, end, spanEnd);
        if (!expr && ctx) { var hw = H.headerByWord(pq, ctx, [], end, spanEnd); if (hw) expr = H.cellNode(hw, ctx); }
        if (expr) thenNode = expr;
      }
      group.push(c);
      if (thenNode || k === all.length - 1) {
        var conj = 'AND';
        for (var g = 0; g < group.length; g++) if (group[g].conjunction === 'OR') conj = 'OR';
        if (group.length > 1 && conj === 'AND' && H.has(pq, 'OR') && !H.has(pq, 'AND')) conj = 'OR';
        branches.push({ conds: group, conj: conj, then: thenNode });
        group = [];
      }
    }
    // else value: parser's elseValue, else expression after ELSE, else defaults
    var elseNode = H.valueNode(pq.elseValue, ctx);
    if (!elseNode && elseIdx >= 0) elseNode = H.exprBetween(pq, ctx, elseIdx + 1, toks.length);
    if (!elseNode && elseIdx >= 0 && H.has(pq, 'BLANK')) elseNode = A().str('');
    // the parser's thenValue is the last branch's value when nothing was found for it
    if (branches.length && !branches[branches.length - 1].then) {
      var tv = H.valueNode(pq.thenValue, ctx);
      if (tv && !(pq.thenValue && pq.thenValue.tokenIndex != null && branches.some(function (b) { return b.thenAt === pq.thenValue.tokenIndex; }))) branches[branches.length - 1].then = tv;
    }
    return { branches: branches, elseNode: elseNode, elseIdx: elseIdx };
  };

  /* ------------------------------------------------------------------ IF builders */
  function fallbackRef(pq, ctx, cand, br) {
    var free = H.refs(pq, { free: true, sheet: null });
    if (free.length) return H.refOf(free[0], ctx);
    var m = H.mainRef(pq, ctx, cand, { type: ['number', 'text'], pool: [] });
    return m.ref;
  }
  function branchExpr(b, pq, ctx, fb) { return H.joinExprs(b.conds.map(function (c) { return H.condExpr(c, pq, ctx, fb, true); }), b.conj); }
  function thenElseFor(br, pq, ctx, opts) {
    var lang = H.lang(pq, opts), blank = H.has(pq, 'BLANK');
    var elseNode = br.elseNode;
    var missingThen = br.branches.some(function (b) { return !b.then; });
    if (!elseNode) elseNode = blank && !missingThen ? A().str('') : H.word(H.NO, lang);
    br.branches.forEach(function (b) { if (!b.then) b.then = (blank && br.elseNode && !(pq.elseValue && pq.elseValue.kind === 'blank')) ? A().str('') : H.word(H.YES, lang); });
    return elseNode;
  }
  function describeExpr(node) { return H.serializeEN(node).slice(1); }
  function buildIf(id, pq, ctx, opts, br) {
    var cand = H.cand(id, null, {});
    var fb = fallbackRef(pq, ctx, cand, br);
    var elseNode = thenElseFor(br, pq, ctx, opts);
    var ast, lang = H.lang(pq, opts);
    if (br.branches.length === 1) {
      ast = A().func('IF', branchExpr(br.branches[0], pq, ctx, fb), br.branches[0].then, elseNode);
    } else if (H.modern(opts) || H.wants(pq, 'IFS')) {
      var args = [];
      br.branches.forEach(function (b) { args.push(branchExpr(b, pq, ctx, fb), b.then); });
      args.push(A().bool(true), elseNode);
      ast = A().func('IFS', args);
      cand.tags.push('2019');
    } else {
      ast = elseNode;
      for (var i = br.branches.length - 1; i >= 0; i--) ast = A().func('IF', branchExpr(br.branches[i], pq, ctx, fb), br.branches[i].then, ast);
    }
    var firstRef = H.condRef(br.branches[0].conds[0], ctx) || fb;
    var c0 = branchExpr(br.branches[0], pq, ctx, fb);
    cand.ast = ast;
    cand.explain = br.branches.length === 1
      ? H.msg(T('%c% ise %t%, değilse %e% yazar.', 'Если %c%, пишет %t%, иначе %e%.', 'If %c% writes %t%, otherwise %e%.'), { c: describeExpr(c0), t: describeExpr(br.branches[0].then), e: describeExpr(elseNode) })
      : H.msg(T('Koşulları sırayla kontrol eder (%n% dal); hiçbiri sağlanmazsa %e% yazar.', 'Проверяет условия по порядку (%n% ветвей); если ни одно не выполнено — %e%.', 'Checks the conditions in order (%n% branches); if none is met writes %e%.'), { n: br.branches.length, e: describeExpr(elseNode) });
    cand.target = H.target(pq, ctx, 'fill', firstRef);
    return cand;
  }
  function logicSignals(pq) {
    return H.any(pq, ['IF', 'THEN', 'ELSE', 'OTHERWISE']) || !!pq.thenValue || !!pq.elseValue || !!(pq.flags && pq.flags.question);
  }
  function aggDominates(pq) {
    if (!aggOutsideConds(pq)) return false;
    return !pq.thenValue && !pq.elseValue && !H.has(pq, 'ELSE');
  }
  function ifMatch(pq, ctx, opts, wantKind) {
    if (!logicSignals(pq)) return 0;
    var br = H.branches(pq, ctx, opts);
    if (!br.branches.length) return 0;
    if (aggDominates(pq)) return 0.3;
    var n = br.branches.length, multiCond = br.branches[0].conds.length > 1;
    var kind = n > 1 ? 'multi' : multiCond ? (br.branches[0].conj === 'OR' ? 'or' : 'and') : (br.branches[0].conds[0].op === 'between' ? 'between' : 'simple');
    if (kind !== wantKind) return 0;
    var s = 0.9;
    if (!H.any(pq, ['IF', 'THEN', 'ELSE']) && pq.flags && pq.flags.question) s = 0.8;
    if (H.has(pq, 'DUPLICATE') || H.has(pq, 'IFERROR') && !H.has(pq, 'IF')) s -= 0.3;
    if (H.any(pq, ['REPLACE', 'SUBSTITUTE', 'LOOKUP', 'RETURN', 'VLOOKUP_HINT', 'XLOOKUP_HINT']) && !H.has(pq, 'IF') && !H.has(pq, 'ELSE')) s = 0.3;
    var onlyContains = br.branches.length === 1 && br.branches[0].conds.length === 1 && br.branches[0].conds[0].op === 'contains';
    if (onlyContains && !pq.thenValue && !pq.elseValue && !H.has(pq, 'ELSE')) s = 0.6;
    return s;
  }
  function ifDef(id, kind, title, examples) {
    return { id: id, category: 'logic', title: title, examples: examples,
      match: function (pq, ctx, opts) { return ifMatch(pq, ctx, opts, kind); },
      build: function (pq, ctx, opts) { return buildIf(id, pq, ctx, opts, H.branches(pq, ctx, opts)); } };
  }
  var defs = [];
  defs.push(ifDef('if_simple', 'simple', T('Koşul (EĞER)', 'Условие (ЕСЛИ)', 'Condition (IF)'), {
    tr: ['Tutar 100\'den büyükse "Yüksek" değilse "Düşük" yaz', 'Durum "Ödendi" ise "Tamam" yaz, değilse boş bırak', 'Adet 0\'dan büyük mü?'],
    ru: ['Если Сумма больше 100, то "Высокий", иначе "Низкий"', 'Если Статус равен "Оплачено", напиши "ОК", иначе оставь пустым', 'Кол-во больше 0?'],
    en: ['If Amount is greater than 100 then "High" else "Low"', 'If Status is empty then "Missing" else "OK"', 'Is Quantity greater than 0?'] }));
  defs.push(ifDef('if_multi', 'multi', T('Çok dallı koşul (ÇOKEĞER)', 'Несколько условий (ЕСЛИМН)', 'Multiple conditions (IFS)'), {
    tr: ['Tutar 1000\'den büyükse "Büyük", 500\'den büyükse "Orta", değilse "Küçük"', 'Kategori "Gıda" ise "G", "Kırtasiye" ise "K", değilse "D" yaz'],
    ru: ['Если Сумма больше 1000, то "Крупная", если больше 500, то "Средняя", иначе "Мелкая"', 'Если Категория "Еда", то "Е", если "Канцелярия", то "К", иначе "Д"'],
    en: ['If Amount > 1000 then "Large", if > 500 then "Medium", otherwise "Small"', 'If Category is "Food" then "F", if "Office" then "O", otherwise "X"'] }));
  defs.push(ifDef('if_and', 'and', T('VE ile koşul', 'Условие с И', 'Condition with AND'), {
    tr: ['Kategori "Gıda" ve Tutar 100\'den büyükse "Kontrol" yaz, değilse boş bırak', 'Tutar 1000\'den büyük ve Durum "Ödendi" ise "VIP" değilse boş bırak'],
    ru: ['Если Категория "Еда" и Сумма больше 100, то "Проверить", иначе оставь пустым', 'Если Сумма больше 1000 и Статус "Оплачено", то "VIP", иначе оставь пустым'],
    en: ['If Category is "Food" and Amount is greater than 100 then "Check", otherwise leave blank', 'If Amount > 1000 and Status is "Paid" then "VIP" else blank'] }));
  defs.push(ifDef('if_or', 'or', T('VEYA ile koşul', 'Условие с ИЛИ', 'Condition with OR'), {
    tr: ['Şehir "İstanbul" veya "Ankara" ise "Büyükşehir" değilse "Diğer" yaz', 'Durum "Ödendi" veya "Kapandı" ise "Tamam" yaz, değilse boş bırak'],
    ru: ['Если Город "Москва" или "Казань", то "Крупный", иначе "Другой"', 'Если Статус "Оплачено" или "Закрыто", то "ОК", иначе пусто'],
    en: ['If City is "London" or "Paris" then "Major" else "Other"', 'If Status is "Paid" or "Closed" then "OK" else blank'] }));
  defs.push(ifDef('if_between', 'between', T('Aralık koşulu', 'Условие «между»', 'Between condition'), {
    tr: ['Tutar 100 ile 500 arasındaysa "Orta" yaz, değilse "Diğer"', 'Adet 1 ile 10 arasında mı?'],
    ru: ['Если Сумма между 100 и 500, то "Средняя", иначе "Другая"', 'Кол-во от 1 до 10?'],
    en: ['If Amount is between 100 and 500 then "Mid" else "Other"', 'Is Quantity between 1 and 10?'] }));

  /* ------------------------------------------------------------------ inline IFERROR ("EĞERHATA ile E2/C2, hata olursa boş") */
  defs.push({
    id: 'iferror_wrap', category: 'error', title: T('Hata yakalama (EĞERHATA)', 'Обработка ошибок (ЕСЛИОШИБКА)', 'Error handling (IFERROR)'),
    examples: { tr: ['E2/C2 hata verirse "Hata" yaz', 'E2\'yi C2\'ye böl, hata olursa boş bırak', 'EĞERHATA ile E2/C2, hata olursa boş'], ru: ['E2/C2, при ошибке напиши "Ошибка"', 'Раздели E2 на C2, если ошибка — оставь пустым', 'Через ЕСЛИОШИБКА: E2/C2, при ошибке пусто'], en: ['E2/C2, if error show "Error"', 'Divide E2 by C2, if error leave blank', 'Wrap E2/C2 in IFERROR with blank'] },
    match: function (pq, ctx) { return H.wantsIfError(pq) && H.inlineExpr(pq, ctx) ? 0.9 : 0; },
    build: function (pq, ctx, opts) {
      var cand = H.cand('iferror_wrap', null, {});
      var inner = H.inlineExpr(pq, ctx);
      cand.ast = inner;   // rank() wraps it with IFERROR/IFNA and the fallback value
      cand.explain = H.msg(T('%x% hesaplanır.', 'Вычисляется %x%.', 'Calculates %x%.'), { x: describeExpr(inner) });
      cand.target = H.target(pq, ctx, 'fill', null);
      return cand;
    }
  });

  /* ------------------------------------------------------------------ overdue flag */
  var OVERDUE_RE = /gecik|ge[cç]mi[sş]|[oö]nce(y|s)|vadesi|süresi dol|просроч|прошл|раньше|до сегодня|истек|overdue|past due|before today|in the past|expired/;
  defs.push({
    id: 'overdue_flag', category: 'logic', title: T('Gecikme işareti', 'Отметка о просрочке', 'Overdue flag'),
    examples: { tr: ['Tarih bugünden önceyse "Gecikti" yaz, değilse boş bırak', 'Tarihi geçmiş olanları "Gecikti" olarak işaretle'], ru: ['Если Дата раньше сегодняшней, напиши "Просрочено", иначе оставь пустым', 'Если Дата уже прошла, пометь "Просрочено", иначе пусто'], en: ['If Date is before today write "Overdue", otherwise leave blank', 'Flag overdue dates'] },
    match: function (pq, ctx) {
      var dateRef = H.refs(pq, { sheet: null }).some(function (r) { return r.type === 'date'; }) || H.has(pq, 'DATE') || H.has(pq, 'DEADLINE');
      if (!dateRef) return 0;
      var hasToday = H.has(pq, 'TODAY'), re = H.rawHas(pq, OVERDUE_RE);
      if (!(hasToday && (H.has(pq, 'LT') || re || H.any(pq, ['IF', 'THEN']))) && !re) return 0;
      if (H.any(pq, ['REMAINING', 'ELAPSED', 'DATE_DIFF', 'DAYS_UNIT']) && !H.any(pq, ['IF', 'THEN', 'ELSE']) && !H.lits(pq).length) return 0;
      if (H.hasAggregate(pq)) return 0.4;
      return 0.9;
    },
    build: function (pq, ctx, opts) {
      var cand = H.cand('overdue_flag', null, {});
      var lang = H.lang(pq, opts);
      var m = H.mainRef(pq, ctx, cand, { type: 'date', free: false });
      var lits = H.lits(pq).filter(function (l) { return l.usedBy !== 'condition'; });
      var thenNode = H.valueNode(pq.thenValue, ctx) || (lits.length ? A().str(lits[0].value) : H.word(H.OVERDUE, lang));
      var elseNode = H.valueNode(pq.elseValue, ctx) || (lits.length > 1 ? A().str(lits[1].value) : A().str(''));
      cand.ast = A().func('IF', A().op('<', m.cell, A().func('TODAY')), thenNode, elseNode);
      cand.explain = H.msg(T('%h% bugünden önceyse “%t%” yazar, değilse %e%.', 'Если %h% раньше сегодняшней даты, пишет «%t%», иначе %e%.', 'Writes “%t%” when %h% is before today, otherwise %e%.'), { h: m.ref ? H.label(m.ref) : '…', t: thenNode.v != null ? thenNode.v : describeExpr(thenNode), e: elseNode.t === 'str' && elseNode.v === '' ? H.pick(T('boş bırakır', 'оставляет пусто', 'leaves it blank'), lang) : describeExpr(elseNode) });
      cand.target = H.target(pq, ctx, 'fill', m.ref);
      cand.tags.push('volatile');
      return cand;
    }
  });

  /* ------------------------------------------------------------------ contains flag: ISNUMBER(SEARCH("x",A2)) */
  defs.push({
    id: 'contains_flag', category: 'logic', title: T('Metin içeriyor mu?', 'Содержит ли текст?', 'Contains text?'),
    examples: { tr: ['Ürün adında "kalem" geçiyor mu kontrol et', 'Ad Soyad "Ayşe" içeriyor mu?'], ru: ['Проверь, содержит ли название товара "ручка"', 'Содержит ли ФИО "Анна"?'], en: ['Check whether Product contains "pen"', 'Does Full Name contain "Ann"?'] },
    match: function (pq) {
      var cs = H.conds(pq), hasContains = cs.some(function (c) { return c.op === 'contains'; }) || (H.has(pq, 'CONTAINS') && H.lits(pq).length);
      if (!hasContains) return 0;
      if (H.hasAggregate(pq)) return 0.25;
      if (pq.thenValue || pq.elseValue || H.has(pq, 'ELSE')) return 0.3;
      if (H.any(pq, ['FILTER', 'SORT', 'LIST', 'UNIQUE'])) return 0.2;
      return 0.9;
    },
    build: function (pq, ctx, opts) {
      var cand = H.cand('contains_flag', null, {});
      var cs = H.conds(pq).filter(function (c) { return c.op === 'contains'; });
      var ref = cs.length ? H.condRef(cs[0], ctx) : null, needle = cs.length ? cs[0].value : null;
      if (!needle) { var lits = H.lits(pq); needle = lits.length ? lits[0].value : null; }
      if (!ref) { var m = H.mainRef(pq, ctx, cand, { type: 'text' }); ref = m.ref; }
      var cell = ref ? H.cellNode(ref, ctx) : A().placeholder('cell');
      var needleNode = needle == null ? A().placeholder('text') : A().str(needle);
      if (needle == null) H.miss(cand, 'text', T('Hangi metin aranacak?', 'Какой текст искать?', 'Which text should be searched for?'));
      cand.ast = A().func('ISNUMBER', A().func('SEARCH', needleNode, cell));
      cand.explain = H.msg(T('%h% içinde “%t%” geçiyorsa DOĞRU, geçmiyorsa YANLIŞ verir (büyük/küçük harf duyarsız).', 'Возвращает ИСТИНА, если %h% содержит «%t%», иначе ЛОЖЬ (без учёта регистра).', 'Returns TRUE when %h% contains “%t%”, otherwise FALSE (case-insensitive).'), { h: ref ? H.label(ref) : '…', t: needle == null ? '…' : needle });
      cand.target = H.target(pq, ctx, 'fill', ref);
      return cand;
    }
  });

  I.register(defs);
  return defs;
});
