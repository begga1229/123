/* Formula Studio — lookup intents: XLOOKUP / VLOOKUP / INDEX+MATCH (style- and hint-aware), not-found handling,
 * MATCH position, and the explicit-function template fallback. Registers into EFS.intents. */
(function (root, factory) {
  var EFS = root.EFS || (root.EFS = {});
  var api = factory(EFS, root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (EFS, root) {
  'use strict';
  var I = EFS.intents, H = I.helpers, T = H.T;
  function A() { return EFS.ast; }
  function U() { return EFS.util; }
  var LOOKUP_FX = ['VLOOKUP', 'XLOOKUP', 'HLOOKUP', 'LOOKUP', 'INDEX', 'MATCH', 'XMATCH'];
  var NOT_FOUND_RE = /bulunamazsa|bulamazsa|bulunmazsa|bulunamad|yoksa yaz|не найден|нет совпаден|если нет|not found|no match|if missing/;

  function lookupSignals(pq) {
    var fx = H.wants(pq, LOOKUP_FX);
    var hints = H.any(pq, ['VLOOKUP_HINT', 'XLOOKUP_HINT', 'HLOOKUP_HINT', 'INDEX_MATCH_HINT', 'INDEX_HINT']);
    var verbs = H.any(pq, ['LOOKUP', 'FIND_VALUE', 'RETURN']);
    var sheet = H.sheetRefs(pq).length > 0 || H.has(pq, 'SHEET') || H.has(pq, 'TABLE');
    return { fx: fx, hints: hints, verbs: verbs, sheet: sheet };
  }
  function wordSet(s) { return H.fold(s).split(/[^\p{L}\p{N}]+/u).filter(function (w) { return w.length >= 3; }); }
  function overlap(a, b) {
    var wa = wordSet(a), wb = wordSet(b), n = 0;
    for (var i = 0; i < wa.length; i++) for (var k = 0; k < wb.length; k++) if (wa[i] === wb[k] || (wa[i].length >= 4 && wb[k].indexOf(wa[i].slice(0, 4)) === 0) || (wb[k].length >= 4 && wa[i].indexOf(wb[k].slice(0, 4)) === 0)) { n++; break; }
    return n;
  }
  /** Header object of `sheetDesc` by column letter. */
  function sheetHeader(sheetDesc, col) { var hs = (sheetDesc && sheetDesc.headers) || []; for (var i = 0; i < hs.length; i++) if (hs[i].col === col) return hs[i]; return null; }
  function sheetLastCol(sheetDesc) { var hs = (sheetDesc && sheetDesc.headers) || [], max = 0; for (var i = 0; i < hs.length; i++) max = Math.max(max, U().columnIndex(hs[i].col)); return max ? U().columnLetter(max) : null; }
  function colText(col, first, last) { return col + first + ':' + col + last; }

  var SKIP_RE = /^(the|a|an|its|their|this|that|bu|şu|этот|эту|эта)$/;
  var RET_BEFORE_RE = /^(верн|возвра|подтян|подстав|выве|получ|дай|извле|покаж|return|get|fetch|bring|pull|retrieve|show|give|display)/;
  var KEY_BEFORE_RE = /^(найд|найт|ищи|иска|поиск|look|find|search|match|по|by|using)$|^(найд|ищ|look|find|search)/;
  var RET_AFTER_RE = /^(getir|döndür|çek|göster|yazdır)/;
  var KEY_AFTER_RE = /^(göre|ara|arat|bul)/;
  function nearWord(pq, i, dir) {
    var toks = pq.tokens || [];
    for (var j = i; j >= 0 && j < toks.length; j += dir) { var t = toks[j]; if (!t || t.type === 'punct') continue; if (t.type === 'word' && SKIP_RE.test(H.fold(t.norm || ''))) continue; return t; }
    return null;
  }
  /** 'key' | 'ret' | null: the role a lookup-sheet column mention plays, from the verb / preposition next to it. */
  function refRole(pq, r) {
    var end = r.tokenEnd || r.tokenIndex + 1;
    var pv = nearWord(pq, r.tokenIndex - 1, -1), nx = nearWord(pq, end, 1);
    var pw = pv && pv.type === 'word' ? H.fold(pv.norm || '') : '', nw = nx && nx.type === 'word' ? H.fold(nx.norm || '') : '';
    if (pq.lang === 'tr') {
      if (nw && KEY_AFTER_RE.test(nw)) return 'key';
      if (nw && RET_AFTER_RE.test(nw)) return 'ret';
      return null;
    }
    if (pw && RET_BEFORE_RE.test(pw)) return 'ret';
    if (pw && KEY_BEFORE_RE.test(pw)) return 'key';
    return null;
  }

  /** Resolve every slot of a lookup: key cell, lookup range, return range, table + column index, sheet name. */
  function resolveLookup(pq, ctx, cand) {
    var out = { key: null, keyRef: null, lookup: null, retn: null, table: null, colIndex: null, sheet: null, leftOfKey: false, desc: null, explicitTable: false };
    var sheetRefs = H.byPosition(H.sheetRefs(pq));
    var localRefs = H.byPosition(H.refs(pq, { sheet: null, free: true }));
    var byIdx = H.idx(pq, 'BY'), retIdx = H.idx(pq, 'RETURN'), lookIdx = H.idx(pq, 'LOOKUP');
    var sheetName = sheetRefs.length ? sheetRefs[0].sheet : (pq.sheets && pq.sheets.length ? (pq.sheets[0].name || pq.sheets[0]) : null);
    if (sheetName && typeof sheetName === 'object') sheetName = sheetName.name;
    if (!sheetName && H.has(pq, 'SHEET')) {
      // "Liste sayfasında" / "на листе Список" / "in the Products sheet": the capitalised word next to the SHEET word
      var si = H.idx(pq, 'SHEET'), toks = pq.tokens || [], around = [toks[si - 1], toks[si + 1]];
      if (pq.lang === 'ru') around.reverse();
      for (var a = 0; a < around.length; a++) {
        var tk = around[a];
        if (tk && tk.type === 'word' && /^[\p{Lu}]/u.test(tk.raw || '') && !(pq.refs || []).some(function (r) { return r.tokenIndex === tk.index; })) { sheetName = tk.raw.replace(/[’'][\p{L}]+$/u, ''); break; }
      }
      if (sheetName) {
        // a bare table-like range typed next to it (A:B, A2:C100) belongs to that sheet
        var tbl = localRefs.filter(function (r) { return r.source === 'explicit' && r.col !== r.col2 && (r.kind === 'column' || r.kind === 'range'); })[0];
        if (tbl) { tbl = Object.assign({}, tbl, { sheet: sheetName }); sheetRefs = [tbl]; localRefs = localRefs.filter(function (r) { return r.text !== tbl.text; }); }
      }
    }
    var desc = ctx ? H.otherSheet(ctx, sheetName) : null;
    if (desc && sheetName) {
      // a header named on both sheets ("Цену" = Продажи!Цена and Товары!Цена) means the lookup sheet's column here;
      // the lookup value on this sheet is found below by name
      localRefs = localRefs.filter(function (r) {
        var alt = r.source === 'header' && (r.alternatives || []).filter(function (al) { return al.sheet === sheetName && al.text; })[0];
        if (!alt) return true;
        sheetRefs.push(Object.assign({}, r, { sheet: alt.sheet, text: alt.text, col: alt.col, col2: alt.col, headerName: alt.headerName, type: alt.type, alternatives: null }));
        return false;
      });
      sheetRefs = H.byPosition(sheetRefs);
    }
    if (ctx && !desc && !sheetName && ctx.otherSheets) { var keys = Object.keys(ctx.otherSheets); if (keys.length === 1) { sheetName = keys[0]; desc = ctx.otherSheets[keys[0]]; H.assume(cand, T('Arama tablosu olarak “%s%” sayfası varsayıldı.', 'В качестве таблицы поиска взят лист «%s%».', 'Assumed the “%s%” sheet as the lookup table.'), { s: sheetName }); } }
    if (sheetName && ctx) sheetName = H.otherSheetName(ctx, sheetName);
    out.sheet = sheetName; out.desc = desc;
    var first = desc && desc.firstDataRow ? desc.firstDataRow : H.firstRow(ctx), last = desc && desc.lastRow ? desc.lastRow : H.lastRow(ctx);

    // explicit table range on the other sheet (A:B, A2:C100)
    var tableRef = sheetRefs.filter(function (r) { return r.kind === 'column' && r.col !== r.col2 || (r.kind === 'range' && r.col !== r.col2); })[0] || null;
    var headerRefs = sheetRefs.filter(function (r) { return r !== tableRef; });
    var lookupCol = null, retCol = null;
    if (headerRefs.length) {
      // the ref tied to BY ("…koduna göre", "по коду", "by code") is the key column; the one tied to RETURN is the return column
      var keyCand = null, retCand = null;
      headerRefs.forEach(function (r) {
        var role = refRole(pq, r);
        if (role === 'key') keyCand = keyCand || r;
        if (role === 'ret') retCand = retCand || r;
      });
      headerRefs.forEach(function (r) {
        var end = r.tokenEnd || r.tokenIndex + 1;
        if (r === keyCand || r === retCand) return;
        if (!keyCand && byIdx >= 0 && (byIdx === end || byIdx === r.tokenIndex - 1)) keyCand = r;
        else if (!retCand && retIdx >= 0 && (retIdx === end || retIdx === r.tokenIndex - 1)) retCand = r;
      });
      if (!keyCand && !retCand && headerRefs.length >= 2) { keyCand = headerRefs[0]; retCand = headerRefs[headerRefs.length - 1]; }
      if (keyCand && !retCand) retCand = headerRefs.filter(function (r) { return r !== keyCand; })[0] || null;
      if (retCand && !keyCand) keyCand = headerRefs.filter(function (r) { return r !== retCand; })[0] || null;
      if (!keyCand && !retCand && headerRefs.length === 1) {
        var only = headerRefs[0];
        if (desc && only.col === (desc.headers && desc.headers[0] ? desc.headers[0].col : 'A') && !lookupVerbAfter(pq, only)) keyCand = only; else retCand = only;
      }
      lookupCol = keyCand ? keyCand.col : null; retCol = retCand ? retCand.col : null;
    }
    if (tableRef) {
      out.explicitTable = true;
      out.table = { text: tableRef.text, sheet: tableRef.sheet, col: tableRef.col, col2: tableRef.col2, row: tableRef.row, row2: tableRef.row2, kind: tableRef.kind };
      lookupCol = lookupCol || tableRef.col;
      var ords = H.ords(pq), n = ords.length ? ords[0].value : null;
      if (n == null) { var nums = H.nums(pq, { free: true, percent: false }); if (nums.length) n = nums[nums.length - 1].value; }
      if (n != null && !retCol) { out.colIndex = n; retCol = U().columnLetter(U().columnIndex(tableRef.col) + n - 1); }
      if (retCol && out.colIndex == null) out.colIndex = U().columnIndex(retCol) - U().columnIndex(tableRef.col) + 1;
    }
    if (!lookupCol && desc && desc.headers && desc.headers.length) lookupCol = desc.headers[0].col;
    if (!retCol && desc && desc.headers && desc.headers.length > 1 && lookupCol) {
      // choose the first column that is not the key column, preferring one named like the local text ("Fiyat", "Цена")
      retCol = desc.headers.filter(function (h) { return h.col !== lookupCol; })[0].col;
      H.assume(cand, T('Dönüş sütunu olarak “%h%” varsayıldı.', 'В качестве возвращаемого столбца взят «%h%».', 'Assumed “%h%” as the return column.'), { h: sheetHeader(desc, retCol).name });
    }
    out.lookupCol = lookupCol; out.retCol = retCol;
    if (lookupCol && retCol) out.leftOfKey = U().columnIndex(retCol) < U().columnIndex(lookupCol);
    // ranges
    var mkRange = function (col) {
      if (out.table && out.table.kind === 'column') return { text: col + ':' + col, sheet: sheetName, abs: false };
      if (out.table && out.table.kind === 'range') return { text: colText(col, out.table.row, out.table.row2), sheet: sheetName, abs: false };
      return { text: colText(col, first, last || first), sheet: sheetName, abs: true };
    };
    if (lookupCol) out.lookup = mkRange(lookupCol);
    if (retCol) out.retn = mkRange(retCol);
    if (lookupCol && !out.table) {
      var lastCol = desc ? sheetLastCol(desc) : retCol;
      var endCol = U().columnIndex(lastCol || retCol) >= U().columnIndex(retCol || lookupCol) ? (lastCol || retCol) : retCol;
      out.table = { text: lookupCol + first + ':' + endCol + (last || first), sheet: sheetName, abs: true, col: lookupCol, col2: endCol };
      if (retCol) out.colIndex = U().columnIndex(retCol) - U().columnIndex(lookupCol) + 1;
    }
    if (out.table && out.table.sheet === undefined) out.table.sheet = sheetName;
    // key cell on the current sheet
    var keyRef = null;
    var beforeLookup = localRefs.filter(function (r) { return lookIdx < 0 || r.tokenIndex < lookIdx || r.kind === 'cell'; });
    if (localRefs.length) keyRef = beforeLookup.length ? beforeLookup[0] : localRefs[0];
    if (!keyRef && ctx) {
      var keyHeader = lookupCol && desc ? sheetHeader(desc, lookupCol) : null, best = null, bestScore = 0;
      H.headers(ctx).forEach(function (h) { var sc = keyHeader ? overlap(h.name, keyHeader.name) : 0; if (sc > bestScore) { bestScore = sc; best = h; } });
      if (!best) best = H.headersOfType(ctx, 'text')[0] || H.headers(ctx)[0] || null;
      if (best) { keyRef = { text: best.dataRange, col: best.col, kind: 'range', sheet: null, headerName: best.name, type: best.type, source: 'default' }; H.assume(cand, T('Aranan değer olarak bu sayfadaki “%h%” sütunu (%c%) varsayıldı.', 'Искомым значением принят столбец «%h%» (%c%) текущего листа.', 'Assumed the “%h%” column (%c%) of this sheet as the lookup value.'), { h: best.name, c: H.colCell(best.col, ctx) }); }
    }
    if (keyRef) { out.keyRef = H.refOf(keyRef, ctx); out.key = H.cellNode(out.keyRef, ctx); }
    else { out.key = A().placeholder('lookup_value'); H.miss(cand, 'lookup_value', T('Hangi değer aranacak?', 'Какое значение искать?', 'Which value should be looked up?'), H.headerOptions(ctx)); }
    return out;
  }
  function lookupVerbAfter(pq, r) { var li = H.idx(pq, 'LOOKUP'); return li >= 0 && li > r.tokenIndex; }
  function rangeNode(rg) { return rg ? A().ref(rg.abs ? H.absText(rg.text) : rg.text, rg.sheet) : null; }

  /** Not-found text requested by the user (literal / blank / default), or null when not requested. */
  function notFoundNode(pq, ctx, opts) {
    var idx = H.idx(pq, 'NOT_FOUND');
    var re = H.rawHas(pq, NOT_FOUND_RE);
    if (idx < 0 && !re) return null;
    if (idx < 0) { var toks = pq.tokens || []; for (var i = 0; i < toks.length; i++) if (NOT_FOUND_RE.test(H.fold(toks[i].norm))) { idx = i; break; } }
    var lits = H.lits(pq).filter(function (l) { return l.tokenIndex > idx; });
    if (lits.length) return A().str(lits[0].value);
    if (pq.thenValue && pq.thenValue.tokenIndex > idx) return H.valueNode(pq.thenValue, ctx);
    if (pq.elseValue && pq.elseValue.tokenIndex > idx) return H.valueNode(pq.elseValue, ctx);
    if (H.has(pq, 'BLANK')) return A().str('');
    var tail = idx >= 0 && pq.tokens[idx] ? H.fold(String(pq.text || '').slice(pq.tokens[idx].start)) : '';
    if (/(^|[^\p{L}])(boş|bos|пуст\p{L}*|blank|empty|nothing|ничего)([^\p{L}]|$)/u.test(tail)) return A().str('');
    return H.word(H.NOT_FOUND, H.lang(pq, opts));
  }

  /* ------------------------------------------------------------------ formula variants */
  function buildVariant(kind, L, nf, errFn) {
    var key = L.key;
    errFn = errFn || 'IFERROR';
    if (kind === 'XLOOKUP') {
      var args = [key, rangeNode(L.lookup) || A().placeholder('lookup_range'), rangeNode(L.retn) || A().placeholder('return_range')];
      if (nf) args.push(nf);
      return A().func('XLOOKUP', args);
    }
    if (kind === 'INDEX_MATCH') {
      var im = A().func('INDEX', rangeNode(L.retn) || A().placeholder('return_range'), A().func('MATCH', key, rangeNode(L.lookup) || A().placeholder('lookup_range'), 0));
      return nf ? A().func(errFn, im, nf) : im;
    }
    if (kind === 'HLOOKUP') {
      var hl = A().func('HLOOKUP', key, L.table ? A().ref(L.table.abs ? H.absText(L.table.text) : L.table.text, L.table.sheet) : A().placeholder('table_array'), L.colIndex || A().placeholder('row'), A().bool(false));
      return nf ? A().func(errFn, hl, nf) : hl;
    }
    var vl = A().func('VLOOKUP', key, L.table ? A().ref(L.table.abs ? H.absText(L.table.text) : L.table.text, L.table.sheet) : A().placeholder('table_array'), L.colIndex || A().placeholder('col_index'), A().bool(false));
    return nf ? A().func(errFn, vl, nf) : vl;
  }
  function pickKind(pq, opts, L) {
    if (H.wants(pq, 'XLOOKUP') || H.has(pq, 'XLOOKUP_HINT')) return 'XLOOKUP';
    if (H.wants(pq, 'HLOOKUP') || H.has(pq, 'HLOOKUP_HINT')) return 'HLOOKUP';
    if ((H.wants(pq, 'INDEX') && H.wants(pq, 'MATCH')) || H.has(pq, 'INDEX_MATCH_HINT') || (H.wants(pq, 'INDEX') && !H.wants(pq, 'VLOOKUP'))) return 'INDEX_MATCH';
    if (H.wants(pq, 'VLOOKUP') || H.has(pq, 'VLOOKUP_HINT')) return 'VLOOKUP';
    if (H.modern(opts)) return 'XLOOKUP';
    return L.leftOfKey ? 'INDEX_MATCH' : 'VLOOKUP';
  }
  function explainLookup(kind, L, nf, lang) {
    var keyLabel = L.keyRef ? H.label(L.keyRef) : '…', sheet = L.sheet || '…';
    var retLabel = L.retn && L.desc ? (sheetHeader(L.desc, L.retCol) || {}).name || L.retn.text : (L.retn ? L.retn.text : '…');
    var base = H.msg(T('%k% değerini %s% sayfasında arar ve eşleşen satırın “%r%” değerini getirir', 'Ищет %k% на листе %s% и возвращает «%r%» из найденной строки', 'Looks up %k% in sheet %s% and returns “%r%” from the matching row'), { k: keyLabel, s: sheet, r: retLabel });
    if (nf) { var t = nf.t === 'str' && nf.v === '' ? H.pick(T('boş bırakır', 'оставляет пусто', 'leaves it blank'), lang) : '“' + (nf.v != null ? nf.v : '') + '”'; return H.msg(T('%b%; bulunamazsa %t%.', '%b%; если не найдено — %t%.', '%b%; if not found, %t%.'), { b: H.pick(base, lang), t: t }); }
    return H.msg(T('%b%.', '%b%.', '%b%.'), { b: H.pick(base, lang) });
  }
  function buildLookup(pq, ctx, opts) {
    var cand = H.cand('lookup', null, {});
    var L = resolveLookup(pq, ctx, cand);
    var nf = notFoundNode(pq, ctx, opts);
    var kind = pickKind(pq, opts, L);
    var errFn = H.wantsIfNa(pq) ? 'IFNA' : 'IFERROR';
    cand.ast = buildVariant(kind, L, nf, errFn);
    if (nf) { cand.intent = 'lookup_not_found'; cand.handlesError = true; }
    var lang = H.lang(pq, opts);
    var ex = explainLookup(kind, L, nf, lang);
    cand.explain = { tr: ex.tr, ru: ex.ru, en: ex.en };
    cand.target = H.target(pq, ctx, 'fill', L.keyRef);
    if (kind === 'XLOOKUP') cand.tags.push('2021');
    if (!L.retn) H.miss(cand, 'return_range', T('Hangi sütun getirilecek?', 'Какой столбец вернуть?', 'Which column should be returned?'));
    if (!L.lookup) H.miss(cand, 'lookup_range', T('Hangi sütunda aranacak?', 'В каком столбце искать?', 'Which column should be searched?'));
    var alts = ['XLOOKUP', 'VLOOKUP', 'INDEX_MATCH'].filter(function (k) { return k !== kind; });
    cand.alternatives = alts.map(function (k, i) {
      var c = H.cand('lookup', buildVariant(k, L, nf, errFn), { confidence: 0.6 - i * 0.05, explain: explainLookup(k, L, nf, lang), target: cand.target, tags: k === 'XLOOKUP' ? ['2021'] : [] });
      if (nf) c.handlesError = true;
      return c;
    });
    return cand;
  }

  var defs = [];
  defs.push({
    id: 'lookup', category: 'lookup', title: T('Başka tablodan değer getir (ARA)', 'Подтянуть значение из другой таблицы', 'Look up a value in another table'),
    examples: { tr: ['Ürün kodunu Ürünler sayfasında ara ve Fiyat getir', 'Ürün koduna göre Ürünler sayfasından Ürün Adı getir', 'DÜŞEYARA ile Ürün kodunu Ürünler sayfasında bul ve Fiyat getir'], ru: ['Найди код товара на листе Товары и верни Цену', 'Подтяни Наименование с листа Товары по коду товара', 'Через ВПР найди код товара на листе Товары и верни Цену'], en: ['Look up the Product code in the Products sheet and return the Price', 'Get the Product Name from the Products sheet by Product code', 'Use VLOOKUP to get the Price from the Products sheet by Product code'] },
    match: function (pq) {
      var s = lookupSignals(pq);
      if (s.fx && H.wants(pq, ['VLOOKUP', 'XLOOKUP', 'HLOOKUP'])) return 0.92;
      if (s.fx && H.wants(pq, 'INDEX') && (H.wants(pq, 'MATCH') || s.sheet)) return 0.9;
      if (s.hints && (s.sheet || s.verbs)) return 0.9;
      if (s.sheet && s.verbs) return 0.9;
      if (s.sheet && H.sheetRefs(pq).length && H.localRefs(pq).length) return 0.8;
      if (s.sheet && H.sheetRefs(pq).length && !H.hasAggregate(pq)) return 0.6;
      if (H.has(pq, 'LOOKUP') && H.has(pq, 'RETURN') && !H.hasAggregate(pq)) return 0.55;
      return 0;
    },
    build: buildLookup
  });
  defs.push({
    id: 'lookup_not_found', category: 'lookup', title: T('Ara, bulunamazsa metin yaz', 'Поиск с текстом «не найдено»', 'Lookup with not-found text'),
    examples: { tr: ['Ürün kodunu Ürünler sayfasında ara, Fiyatı getir, bulunamazsa "Bulunamadı" yaz', 'Ürün kodunu Ürünler sayfasında bul ve Fiyat getir, bulunamazsa boş bırak'], ru: ['Найди товар на листе Товары, верни Цену, если не найдено — напиши "Не найдено"', 'Найди код товара на листе Товары и верни Цену, если не найдено — оставь пустым'], en: ['Look up Product in Products and return Price, if not found show "Not found"', 'Look up the code in Products and return Price, if not found leave blank'] },
    match: function (pq, ctx, opts) { var base = defs[0].match(pq, ctx, opts); return base && notFoundNode(pq, ctx, opts) ? 0.2 : 0; },
    build: buildLookup
  });

  /* ------------------------------------------------------------------ MATCH position */
  defs.push({
    id: 'match_position', category: 'lookup', title: T('Eşleşme konumu (KAÇINCI)', 'Позиция совпадения (ПОИСКПОЗ)', 'Match position (MATCH)'),
    examples: { tr: ['A2 değeri B2:B100 aralığında kaçıncı sırada?', 'Ürün kodunun Ürünler sayfasındaki satır numarası'], ru: ['На какой позиции A2 в диапазоне B2:B100?', 'Номер строки кода товара на листе Товары'], en: ['Position of A2 in B2:B100', 'Row number of the Product code in the Products sheet'] },
    match: function (pq) {
      var pos = H.has(pq, 'MATCH_POSITION') || H.wants(pq, ['MATCH', 'XMATCH']);
      if (!pos) return 0;
      if (H.lits(pq).length && !H.sheetRefs(pq).length && H.refs(pq, {}).length < 2) return 0;   // FIND("@",L2) → text intent
      if (H.has(pq, 'RETURN') && !H.wants(pq, ['MATCH', 'XMATCH'])) return 0.3;
      return 0.88;
    },
    build: function (pq, ctx, opts) {
      var cand = H.cand('match_position', null, {});
      var L = resolveLookup(pq, ctx, cand);
      var refs = H.byPosition(H.refs(pq, {}));
      var range = L.lookup ? rangeNode(L.lookup) : (refs.length > 1 ? H.rangeNode(refs[1], true) : A().placeholder('lookup_range'));
      cand.ast = A().func('MATCH', L.key, range, 0);
      cand.missing = cand.missing.filter(function (m) { return m.slot !== 'return_range'; });
      cand.explain = H.msg(T('%k% değerinin %r% içinde kaçıncı sırada olduğunu verir (tam eşleşme).', 'Возвращает позицию %k% в %r% (точное совпадение).', 'Returns the position of %k% within %r% (exact match).'), { k: L.keyRef ? H.label(L.keyRef) : '…', r: H.serializeEN(range).slice(1) });
      cand.target = H.target(pq, ctx, 'fill', L.keyRef);
      return cand;
    }
  });

  /* ------------------------------------------------------------------ explicit function template */
  var SLOTS = { range: 'range', criteria: 'criteria', sum_range: 'sum_range', lookup_value: 'lookup_value', lookup_array: 'lookup_range', return_array: 'return_range', table_array: 'table_array', col_index_num: 'col_index', logical_test: 'condition', value_if_true: 'value_if_true', value_if_false: 'value_if_false', text: 'text', num_chars: 'count', start_num: 'start', number: 'number', num_digits: 'decimals', start_date: 'start_date', end_date: 'end_date', rate: 'rate', nper: 'nper', pv: 'pv', array: 'array', delimiter: 'delimiter', old_text: 'old_text', new_text: 'new_text', value: 'value', value_if_error: 'value', unit: 'unit', divisor: 'divisor', date: 'date', serial_number: 'date' };
  H.templateFor = function (entry) {
    if (!entry) return null;
    var args = Array.isArray(entry.args) && entry.args.length ? entry.args : [];
    if (!args.length) { var m = /\(([\s\S]*)\)\s*$/.exec(String(entry.syntax || '')); if (m && m[1].trim()) args = m[1].split(',').map(function (s) { return { name: s.replace(/[\[\]\s]/g, '') }; }); }
    var nodes = args.map(function (a) { var key = String(a.name || '').toLowerCase().replace(/\d+$/, ''); return A().placeholder(SLOTS[key] || SLOTS[String(a.name || '').toLowerCase()] || 'value', { tr: a.tr || a.name, ru: a.ru || a.name, en: a.name }); });
    return { ast: A().func(entry.name, nodes), args: args };
  };
  defs.push({
    id: 'explicit_function_template', category: 'meta', title: T('Fonksiyon şablonu', 'Шаблон функции', 'Function template'),
    examples: { tr: ['DÜŞEYARA', 'ETOPLA şablonu', 'METİNBİRLEŞTİR nasıl yazılır'], ru: ['ВПР', 'Шаблон СУММЕСЛИ', 'Как пишется ОБЪЕДИНИТЬ'], en: ['VLOOKUP', 'SUMIF template', 'How to write TEXTJOIN'] },
    match: function (pq) {
      var fx = H.fx(pq);
      if (!fx.length) return 0;
      var words = (pq.tokens || []).filter(function (t) { return t.type === 'word' || t.type === 'function'; }).length;
      if (words <= 2 && !H.refs(pq, {}).length && !H.conds(pq).length) return 0.75;
      return 0.3;
    },
    build: function (pq, ctx, opts) {
      var fx = H.fx(pq), c = EFS.catalog, entry = c && c.byName ? c.byName(fx[0]) : null;
      if (!entry) return null;
      var tpl = H.templateFor(entry);
      var cand = H.cand('explicit_function_template', tpl.ast, { explain: { tr: H.pick(entry.desc, 'tr'), ru: H.pick(entry.desc, 'ru'), en: H.pick(entry.desc, 'en') }, target: null, tags: entry.minVersion ? [String(entry.minVersion)] : [] });
      tpl.args.forEach(function (a) { var d = a.desc || null; cand.missing.push({ slot: 'value', tr: d ? H.pick(d, 'tr') : a.name, ru: d ? H.pick(d, 'ru') : a.name, en: d ? H.pick(d, 'en') : a.name }); });
      cand.confidence = 0.4;
      return cand;
    }
  });

  I.register(defs);
  return defs;
});
