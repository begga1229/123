/* Formula Studio — EFS.explain
 * Turns a formula AST into a human explanation (summary, step-by-step breakdown, functions used, tips)
 * in Turkish, Russian or English. Hand-written templates for ~120 common functions and all operators,
 * a catalog-driven fallback for everything else. Pure ES2019, no dependencies at load time; other
 * EFS modules (catalog, ast, localize, formulaReader) are resolved lazily inside functions. */
(function (root, factory) {
  var EFS = root.EFS || (root.EFS = {});
  var api = factory(EFS, root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (EFS, root) {
  'use strict';
  var explain = {};
  var LANGS = ['tr', 'ru', 'en'];
  var MAX_STEPS = 8;

  /* ------------------------------------------------------------------ */
  /* Small generic helpers                                               */
  /* ------------------------------------------------------------------ */
  function pick(obj, lang) {
    if (EFS.util && EFS.util.pick) return EFS.util.pick(obj, lang);
    if (obj == null) return '';
    if (typeof obj === 'string') return obj;
    return obj[lang] || obj.en || obj.tr || obj.ru || '';
  }
  function normLang(lang) { return LANGS.indexOf(lang) >= 0 ? lang : 'tr'; }
  function normDialect(d) { return d === 'tr' || d === 'ru' || d === 'en' ? d : 'en'; }
  function isNode(x) { return !!x && typeof x === 'object' && typeof x.t === 'string'; }
  function fmt(template, map) {
    return String(template).replace(/\{(\w+)\}/g, function (m, k) { return map[k] != null ? String(map[k]) : m; });
  }
  function joinList(items, lang) {
    items = items.filter(function (x) { return x != null && x !== ''; });
    if (items.length === 0) return '';
    if (items.length === 1) return items[0];
    var conj = lang === 'tr' ? ' ve ' : lang === 'ru' ? ' и ' : ' and ';
    return items.slice(0, -1).join(', ') + conj + items[items.length - 1];
  }
  function capFirst(s, lang) {
    s = String(s || '');
    if (!s) return s;
    var ch = s.charAt(0);
    if (lang === 'tr') { if (ch === 'i') return 'İ' + s.slice(1); if (ch === 'ı') return 'I' + s.slice(1); }
    return ch.toLocaleUpperCase(lang === 'tr' ? 'tr' : lang === 'ru' ? 'ru' : 'en') + s.slice(1);
  }
  function lowerFirst(s, lang) {
    s = String(s || '');
    if (!s) return s;
    var ch = s.charAt(0), nx = s.charAt(1);
    // only a real word gets lower-cased: refs (B2:B200), ALLCAPS tokens (DOĞRU), single letters (A sütunu) stay as they are
    if (!/[a-zçğıöşüа-яё]/i.test(ch)) return s;
    if (!/[a-zçğıöşüа-яё]/.test(nx)) return s;
    if (lang === 'tr') { if (ch === 'İ') return 'i' + s.slice(1); if (ch === 'I') return 'ı' + s.slice(1); }
    return ch.toLocaleLowerCase(lang === 'tr' ? 'tr' : lang === 'ru' ? 'ru' : 'en') + s.slice(1);
  }
  function endSentence(s) {
    s = String(s || '').trim();
    if (!s) return s;
    var last = s.charAt(s.length - 1);
    if (last === '.' || last === '!' || last === '?' || last === '…') return s;
    return s + '.';
  }
  function uniq(arr) { var seen = {}, out = []; for (var i = 0; i < arr.length; i++) { if (!seen[arr[i]]) { seen[arr[i]] = 1; out.push(arr[i]); } } return out; }

  /* Quotes per language */
  function q(text, lang) {
    text = String(text == null ? '' : text);
    if (lang === 'ru') return '«' + text + '»';
    return '“' + text + '”';
  }

  /* Number formatting for prose: tr/ru use the decimal comma, en the point. */
  function fmtNum(v, lang) {
    if (typeof v !== 'number' || !isFinite(v)) return String(v);
    var s = String(v);
    if (/e/i.test(s)) s = v.toLocaleString('en-US', { maximumFractionDigits: 10, useGrouping: false });
    if (lang === 'tr' || lang === 'ru') s = s.replace('.', ',');
    return s;
  }
  function parseNumText(s) {
    s = String(s).trim();
    if (!/^[-+]?\d+(?:[.,]\d+)?%?$/.test(s)) return null;
    var pct = /%$/.test(s);
    var n = parseFloat(s.replace('%', '').replace(',', '.'));
    if (isNaN(n)) return null;
    return pct ? n / 100 : n;
  }

  /* ------------------------------------------------------------------ */
  /* Turkish morphology: vowel harmony + case suffixes                    */
  /* ------------------------------------------------------------------ */
  var TR_VOWELS = 'aeıioöuü';
  function trLowerChar(ch) { if (ch === 'I') return 'ı'; if (ch === 'İ') return 'i'; return ch.toLowerCase(); }
  function trLastVowel(word) {
    for (var i = word.length - 1; i >= 0; i--) { var c = trLowerChar(word.charAt(i)); if (TR_VOWELS.indexOf(c) >= 0) return c; }
    return null;
  }
  function h4(v) { return (v === 'a' || v === 'ı') ? 'ı' : (v === 'e' || v === 'i') ? 'i' : (v === 'o' || v === 'u') ? 'u' : 'ü'; }
  function h2(v) { return (v === 'a' || v === 'ı' || v === 'o' || v === 'u') ? 'a' : 'e'; }
  var TR_UNITS = [['sıfır', 'ı', 'r'], ['bir', 'i', 'r'], ['iki', 'i', ''], ['üç', 'ü', 'ç'], ['dört', 'ö', 't'], ['beş', 'e', 'ş'], ['altı', 'ı', ''], ['yedi', 'i', ''], ['sekiz', 'i', 'z'], ['dokuz', 'u', 'z']];
  var TR_TENS = [null, ['on', 'o', 'n'], ['yirmi', 'i', ''], ['otuz', 'u', 'z'], ['kırk', 'ı', 'k'], ['elli', 'i', ''], ['altmış', 'ı', 'ş'], ['yetmiş', 'i', 'ş'], ['seksen', 'e', 'n'], ['doksan', 'a', 'n']];
  function trNumberBase(token) {
    var s = String(token).replace(/[%\s+\-−]/g, '');
    var fr = /[.,](\d+)$/.exec(s);
    var digits;
    if (fr && !/^\d{1,3}([.,]\d{3})+$/.test(s)) {
      digits = fr[1];
      var d = TR_UNITS[parseInt(digits.charAt(digits.length - 1), 10)];
      return { lastVowel: d[1], endsVowel: d[2] === '', voiceless: 'fstkçşhp'.indexOf(d[2]) >= 0 };
    }
    digits = s.replace(/[.,]/g, '');
    if (!digits) return { lastVowel: 'i', endsVowel: false, voiceless: false };
    var n = digits.replace(/^0+(?=\d)/, '');
    var w;
    if (n.length >= 7 && /000000$/.test(n)) w = ['milyon', 'o', 'n'];
    else if (n.length >= 4 && /000$/.test(n)) w = ['bin', 'i', 'n'];
    else if (n.length >= 3 && /00$/.test(n)) w = ['yüz', 'ü', 'z'];
    else if (n.length >= 2 && /0$/.test(n)) w = TR_TENS[parseInt(n.charAt(n.length - 2), 10)] || ['on', 'o', 'n'];
    else w = TR_UNITS[parseInt(n.charAt(n.length - 1), 10)];
    return { lastVowel: w[1], endsVowel: w[2] === '', voiceless: 'fstkçşhp'.indexOf(w[2]) >= 0 };
  }
  var TR_LETTER_VOWEL = { A: 'a', E: 'e', I: 'ı', İ: 'i', O: 'o', U: 'u', Ö: 'ö', Ü: 'ü' };
  function trWordBase(word) {
    var last = trLowerChar(word.charAt(word.length - 1));
    return { lastVowel: trLastVowel(word) || 'e', endsVowel: TR_VOWELS.indexOf(last) >= 0, voiceless: 'fstkçşhp'.indexOf(last) >= 0 };
  }
  /* Analyse the end of a phrase to decide which suffix allomorph to use and whether an apostrophe is needed. */
  function trBase(core) {
    var s = core.trim();
    var lastCh = s.charAt(s.length - 1);
    if (lastCh === '”' || lastCh === '»' || lastCh === '"' || lastCh === '’') {
      var inner = s.slice(0, -1).replace(/^.*[“«"‘]/, '');
      var b = /\d$/.test(inner) ? trNumberBase(inner) : trWordBase(inner || 'e');
      b.apos = false; return b;
    }
    var tok = s.split(/\s+/).pop();
    if (/\d%?$/.test(tok)) { var nb = trNumberBase(tok); nb.apos = true; return nb; }
    if (/^[A-ZÇĞİÖŞÜ#$'][A-Z0-9ÇĞİÖŞÜ$:.!?\/'’]*$/.test(tok)) {
      var lc = tok.charAt(tok.length - 1);
      var base = TR_LETTER_VOWEL[lc] ? { lastVowel: TR_LETTER_VOWEL[lc], endsVowel: true, voiceless: false }
        : (tok.length > 2 && /[AEIİOUÖÜ]/.test(tok) && /^[A-ZÇĞİÖŞÜ]+[!?]?$/.test(tok)) ? trWordBase(tok.replace(/[!?]$/, ''))
        : { lastVowel: 'e', endsVowel: true, voiceless: false }; // single consonant letter is read "be", "ce", ...
      base.apos = true; return base;
    }
    var wb = trWordBase(tok); wb.apos = false; return wb;
  }
  var TR_SOFTEN = { 'aralık': 'aralığ', 'sonuç': 'sonuc', 'boşluk': 'boşluğ' };
  /** Attach a Turkish case suffix to a noun phrase. kase: nom|gen|dat|acc|loc|abl ; poss: phrase ends in a 3rd-person possessive. */
  function trCase(text, kase, poss) {
    text = String(text || '');
    if (!kase || kase === 'nom' || !text) return text;
    var m = /^(.*?)(\s*\([^()]*\))$/.exec(text);
    var core = m ? m[1] : text, tail = m ? m[2] : '';
    if (!core.trim()) return text;
    var b = trBase(core);
    var v = b.lastVowel || 'e', H4 = h4(v), H2 = h2(v);
    var suf = '';
    var ev = b.endsVowel;
    if (kase === 'gen') suf = ev ? 'n' + H4 + 'n' : H4 + 'n';
    else if (kase === 'dat') suf = ev ? (poss ? 'n' : 'y') + H2 : H2;
    else if (kase === 'acc') suf = ev ? (poss ? 'n' : 'y') + H4 : H4;
    else if (kase === 'loc') suf = (ev && poss) ? 'nd' + H2 : (b.voiceless ? 't' : 'd') + H2;
    else if (kase === 'abl') suf = (ev && poss) ? 'nd' + H2 + 'n' : (b.voiceless ? 't' : 'd') + H2 + 'n';
    else if (kase === 'ins') return core + ' ile' + tail;
    if (!b.apos && !ev) {
      var lastWord = core.split(/\s+/).pop();
      if (TR_SOFTEN[lastWord] && /^[aeıioöuü]/.test(suf)) core = core.slice(0, core.length - lastWord.length) + TR_SOFTEN[lastWord];
    }
    return core + (b.apos ? '’' : '') + suf + tail;
  }
  /** Turkish plural of a word (olan → olanlar, geçen → geçenler). */
  function trPlural(word) { var v = trLastVowel(word) || 'e'; return word + (h2(v) === 'a' ? 'lar' : 'ler'); }
  /** Turkish ordinal written with a dot: 3 → "3." */
  function trOrd(n) { return n + '.'; }

  /* ------------------------------------------------------------------ */
  /* Russian morphology: declension table, gender guess, plural forms    */
  /* ------------------------------------------------------------------ */
  var RU_CASES = ['nom', 'gen', 'dat', 'acc', 'ins', 'pre'];
  function D(nom, gen, dat, acc, ins, pre) { return { nom: nom, gen: gen, dat: dat, acc: acc, ins: ins, pre: pre }; }
  var RU_DECL = {
    'столбец': D('столбец', 'столбца', 'столбцу', 'столбец', 'столбцом', 'столбце'),
    'столбцы': D('столбцы', 'столбцов', 'столбцам', 'столбцы', 'столбцами', 'столбцах'),
    'диапазон': D('диапазон', 'диапазона', 'диапазону', 'диапазон', 'диапазоном', 'диапазоне'),
    'ячейка': D('ячейка', 'ячейки', 'ячейке', 'ячейку', 'ячейкой', 'ячейке'),
    'значение': D('значение', 'значения', 'значению', 'значение', 'значением', 'значении'),
    'значения': D('значения', 'значений', 'значениям', 'значения', 'значениями', 'значениях'),
    'строка': D('строка', 'строки', 'строке', 'строку', 'строкой', 'строке'),
    'таблица': D('таблица', 'таблицы', 'таблице', 'таблицу', 'таблицей', 'таблице'),
    'заголовок': D('заголовок', 'заголовка', 'заголовку', 'заголовок', 'заголовком', 'заголовке'),
    'именованный диапазон': D('именованный диапазон', 'именованного диапазона', 'именованному диапазону', 'именованный диапазон', 'именованным диапазоном', 'именованном диапазоне'),
    'поле': D('поле', 'поля', 'полю', 'поле', 'полем', 'поле'),
    'сумма': D('сумма', 'суммы', 'сумме', 'сумму', 'суммой', 'сумме'),
    'среднее': D('среднее', 'среднего', 'среднему', 'среднее', 'средним', 'среднем'),
    'количество': D('количество', 'количества', 'количеству', 'количество', 'количеством', 'количестве'),
    'число': D('число', 'числа', 'числу', 'число', 'числом', 'числе'),
    'наибольшее значение': D('наибольшее значение', 'наибольшего значения', 'наибольшему значению', 'наибольшее значение', 'наибольшим значением', 'наибольшем значении'),
    'наименьшее значение': D('наименьшее значение', 'наименьшего значения', 'наименьшему значению', 'наименьшее значение', 'наименьшим значением', 'наименьшем значении'),
    'медиана': D('медиана', 'медианы', 'медиане', 'медиану', 'медианой', 'медиане'),
    'наиболее частое значение': D('наиболее частое значение', 'наиболее частого значения', 'наиболее частому значению', 'наиболее частое значение', 'наиболее частым значением', 'наиболее частом значении'),
    'стандартное отклонение': D('стандартное отклонение', 'стандартного отклонения', 'стандартному отклонению', 'стандартное отклонение', 'стандартным отклонением', 'стандартном отклонении'),
    'результат': D('результат', 'результата', 'результату', 'результат', 'результатом', 'результате'),
    'текст': D('текст', 'текста', 'тексту', 'текст', 'текстом', 'тексте'),
    'длина': D('длина', 'длины', 'длине', 'длину', 'длиной', 'длине'),
    'позиция': D('позиция', 'позиции', 'позиции', 'позицию', 'позицией', 'позиции'),
    'номер': D('номер', 'номера', 'номеру', 'номер', 'номером', 'номере'),
    'остаток': D('остаток', 'остатка', 'остатку', 'остаток', 'остатком', 'остатке'),
    'модуль': D('модуль', 'модуля', 'модулю', 'модуль', 'модулем', 'модуле'),
    'корень': D('корень', 'корня', 'корню', 'корень', 'корнем', 'корне'),
    'степень': D('степень', 'степени', 'степени', 'степень', 'степенью', 'степени'),
    'год': D('год', 'года', 'году', 'год', 'годом', 'годе'),
    'месяц': D('месяц', 'месяца', 'месяцу', 'месяц', 'месяцем', 'месяце'),
    'день': D('день', 'дня', 'дню', 'день', 'днём', 'дне'),
    'дата': D('дата', 'даты', 'дате', 'дату', 'датой', 'дате'),
    'список': D('список', 'списка', 'списку', 'список', 'списком', 'списке'),
    'ранг': D('ранг', 'ранга', 'рангу', 'ранг', 'рангом', 'ранге'),
    'платёж': D('платёж', 'платежа', 'платежу', 'платёж', 'платежом', 'платеже'),
    'стоимость': D('стоимость', 'стоимости', 'стоимости', 'стоимость', 'стоимостью', 'стоимости'),
    'часть': D('часть', 'части', 'части', 'часть', 'частью', 'части'),
    'разность': D('разность', 'разности', 'разности', 'разность', 'разностью', 'разности'),
    'разница': D('разница', 'разницы', 'разнице', 'разницу', 'разницей', 'разнице'),
    'произведение': D('произведение', 'произведения', 'произведению', 'произведение', 'произведением', 'произведении'),
    'частное': D('частное', 'частного', 'частному', 'частное', 'частным', 'частном'),
    'объединение': D('объединение', 'объединения', 'объединению', 'объединение', 'объединением', 'объединении'),
    'доля': D('доля', 'доли', 'доле', 'долю', 'долей', 'доле'),
    'округлённое значение': D('округлённое значение', 'округлённого значения', 'округлённому значению', 'округлённое значение', 'округлённым значением', 'округлённом значении'),
    'целая часть': D('целая часть', 'целой части', 'целой части', 'целую часть', 'целой частью', 'целой части'),
    'сегодняшняя дата': D('сегодняшняя дата', 'сегодняшней даты', 'сегодняшней дате', 'сегодняшнюю дату', 'сегодняшней датой', 'сегодняшней дате'),
    'текущие дата и время': D('текущие дата и время', 'текущих даты и времени', 'текущим дате и времени', 'текущие дата и время', 'текущими датой и временем', 'текущих дате и времени'),
    'день недели': D('день недели', 'дня недели', 'дню недели', 'день недели', 'днём недели', 'дне недели'),
    'последний день': D('последний день', 'последнего дня', 'последнему дню', 'последний день', 'последним днём', 'последнем дне'),
    'первый день': D('первый день', 'первого дня', 'первому дню', 'первый день', 'первым днём', 'первом дне'),
    'уникальные значения': D('уникальные значения', 'уникальных значений', 'уникальным значениям', 'уникальные значения', 'уникальными значениями', 'уникальных значениях'),
    'отфильтрованные строки': D('отфильтрованные строки', 'отфильтрованных строк', 'отфильтрованным строкам', 'отфильтрованные строки', 'отфильтрованными строками', 'отфильтрованных строках'),
    'отсортированный диапазон': D('отсортированный диапазон', 'отсортированного диапазона', 'отсортированному диапазону', 'отсортированный диапазон', 'отсортированным диапазоном', 'отсортированном диапазоне'),
    'последовательность': D('последовательность', 'последовательности', 'последовательности', 'последовательность', 'последовательностью', 'последовательности'),
    'проверка': D('проверка', 'проверки', 'проверке', 'проверку', 'проверкой', 'проверке'),
    'будущая стоимость': D('будущая стоимость', 'будущей стоимости', 'будущей стоимости', 'будущую стоимость', 'будущей стоимостью', 'будущей стоимости'),
    'приведённая стоимость': D('приведённая стоимость', 'приведённой стоимости', 'приведённой стоимости', 'приведённую стоимость', 'приведённой стоимостью', 'приведённой стоимости'),
    'чистая приведённая стоимость': D('чистая приведённая стоимость', 'чистой приведённой стоимости', 'чистой приведённой стоимости', 'чистую приведённую стоимость', 'чистой приведённой стоимостью', 'чистой приведённой стоимости'),
    'внутренняя норма доходности': D('внутренняя норма доходности', 'внутренней нормы доходности', 'внутренней норме доходности', 'внутреннюю норму доходности', 'внутренней нормой доходности', 'внутренней норме доходности'),
    'амортизация': D('амортизация', 'амортизации', 'амортизации', 'амортизацию', 'амортизацией', 'амортизации'),
    'выбранное значение': D('выбранное значение', 'выбранного значения', 'выбранному значению', 'выбранное значение', 'выбранным значением', 'выбранном значении'),
    'смещённый диапазон': D('смещённый диапазон', 'смещённого диапазона', 'смещённому диапазону', 'смещённый диапазон', 'смещённым диапазоном', 'смещённом диапазоне'),
    'ссылка': D('ссылка', 'ссылки', 'ссылке', 'ссылку', 'ссылкой', 'ссылке'),
    'ошибка': D('ошибка', 'ошибки', 'ошибке', 'ошибку', 'ошибкой', 'ошибке'),
    'пустая строка': D('пустая строка', 'пустой строки', 'пустой строке', 'пустую строку', 'пустой строкой', 'пустой строке'),
    'логическое значение': D('логическое значение', 'логического значения', 'логическому значению', 'логическое значение', 'логическим значением', 'логическом значении'),
    'условие': D('условие', 'условия', 'условию', 'условие', 'условием', 'условии'),
    'массив': D('массив', 'массива', 'массиву', 'массив', 'массивом', 'массиве'),
    'квартал': D('квартал', 'квартала', 'кварталу', 'квартал', 'кварталом', 'квартале'),
    'первое слово': D('первое слово', 'первого слова', 'первому слову', 'первое слово', 'первым словом', 'первом слове'),
    'последнее слово': D('последнее слово', 'последнего слова', 'последнему слову', 'последнее слово', 'последним словом', 'последнем слове'),
    'нарастающий итог': D('нарастающий итог', 'нарастающего итога', 'нарастающему итогу', 'нарастающий итог', 'нарастающим итогом', 'нарастающем итоге'),
    'изменение': D('изменение', 'изменения', 'изменению', 'изменение', 'изменением', 'изменении'),
    'возраст': D('возраст', 'возраста', 'возрасту', 'возраст', 'возрастом', 'возрасте'),
    'признак': D('признак', 'признака', 'признаку', 'признак', 'признаком', 'признаке'),
    'процент': D('процент', 'процента', 'проценту', 'процент', 'процентом', 'проценте'),
    'квадратный корень': D('квадратный корень', 'квадратного корня', 'квадратному корню', 'квадратный корень', 'квадратным корнем', 'квадратном корне'),
    'абсолютное значение': D('абсолютное значение', 'абсолютного значения', 'абсолютному значению', 'абсолютное значение', 'абсолютным значением', 'абсолютном значении'),
    'число символов': D('число символов', 'числа символов', 'числу символов', 'число символов', 'числом символов', 'числе символов'),
    'номер строки': D('номер строки', 'номера строки', 'номеру строки', 'номер строки', 'номером строки', 'номере строки'),
    'номер столбца': D('номер столбца', 'номера столбца', 'номеру столбца', 'номер столбца', 'номером столбца', 'номере столбца'),
    'число строк': D('число строк', 'числа строк', 'числу строк', 'число строк', 'числом строк', 'числе строк'),
    'число столбцов': D('число столбцов', 'числа столбцов', 'числу столбцов', 'число столбцов', 'числом столбцов', 'числе столбцов'),
    'дата и время': D('дата и время', 'даты и времени', 'дате и времени', 'дату и время', 'датой и временем', 'дате и времени'),
    'номер недели': D('номер недели', 'номера недели', 'номеру недели', 'номер недели', 'номером недели', 'номере недели'),
    'число дней': D('число дней', 'числа дней', 'числу дней', 'число дней', 'числом дней', 'числе дней'),
    'число рабочих дней': D('число рабочих дней', 'числа рабочих дней', 'числу рабочих дней', 'число рабочих дней', 'числом рабочих дней', 'числе рабочих дней'),
    'повторённый текст': D('повторённый текст', 'повторённого текста', 'повторённому тексту', 'повторённый текст', 'повторённым текстом', 'повторённом тексте'),
    'части текста': D('части текста', 'частей текста', 'частям текста', 'части текста', 'частями текста', 'частях текста'),
    'очищенный текст': D('очищенный текст', 'очищенного текста', 'очищенному тексту', 'очищенный текст', 'очищенным текстом', 'очищенном тексте'),
    'отформатированный текст': D('отформатированный текст', 'отформатированного текста', 'отформатированному тексту', 'отформатированный текст', 'отформатированным текстом', 'отформатированном тексте'),
    'собранная дата': D('собранная дата', 'собранной даты', 'собранной дате', 'собранную дату', 'собранной датой', 'собранной дате'),
    'результат сравнения': D('результат сравнения', 'результата сравнения', 'результату сравнения', 'результат сравнения', 'результатом сравнения', 'результате сравнения')
  };
  /** Russian noun phrase = declinable head + fixed rest. */
  function RN(head, rest) { return { head: head, rest: rest || '' }; }
  function ruCase(phrase, kase) {
    if (phrase == null) return '';
    if (typeof phrase === 'string') return phrase;
    var d = RU_DECL[phrase.head];
    var headText = d ? (d[kase] || d.nom) : phrase.head;
    return headText + (phrase.rest || '');
  }
  /** Guess the grammatical gender of a Russian word (header names): 'm'|'f'|'n'|null (non-Cyrillic). */
  function ruGender(word) {
    var w = String(word || '').trim().split(/\s+/)[0] || '';
    if (!/[а-яё]/i.test(w)) return null;
    w = w.toLowerCase();
    if (/(а|я)$/.test(w)) return 'f';
    if (/(о|е|ё|мя)$/.test(w)) return 'n';
    if (/ь$/.test(w)) return /(ость|есть|знь|сть|чь|шь|щь|жь|ль|дь|ть|пь|сь|вь)$/.test(w) && !/(ль|дь|сь|вь|ть|пь)$/.test(w) ? 'f' : (/(ость|есть|знь|чь|шь|щь|жь)$/.test(w) ? 'f' : 'm');
    return 'm';
  }
  /** Russian preposition "с" becomes "со" before awkward consonant clusters (со значения, со столбцом). */
  function ruS(x) { return (/^(с[^аеёиоуыэюя]|з[^аеёиоуыэюя]|ш[^аеёиоуыэюя]|ж[^аеёиоуыэюя]|щ|мн|вс|льд|лб|рт|ль)/i.test(String(x)) ? 'со ' : 'с ') + x; }
  function ruAgree(g, forms) { // forms: {m,f,n,p}
    if (g === 'f') return forms.f; if (g === 'n') return forms.n; if (g === 'p') return forms.p || forms.m; return forms.m;
  }
  function ruPlural(n, forms) { // forms: [one, few, many]
    n = Math.abs(Math.round(Number(n)));
    if (isNaN(n)) return forms[2];
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return forms[0];
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
    return forms[2];
  }
  var RU_SYMBOL = { one: D('символ', 'символа', 'символу', 'символ', 'символом', 'символе'), few: D('символа', 'символов', 'символам', 'символа', 'символами', 'символах'), many: D('символов', 'символов', 'символам', 'символов', 'символами', 'символах') };
  var RU_ROW = { one: D('строка', 'строки', 'строке', 'строку', 'строкой', 'строке'), few: D('строки', 'строк', 'строкам', 'строки', 'строками', 'строках'), many: D('строк', 'строк', 'строкам', 'строк', 'строками', 'строках') };
  var RU_FIRST = D('первые', 'первых', 'первым', 'первые', 'первыми', 'первых');
  var RU_LAST = D('последние', 'последних', 'последним', 'последние', 'последними', 'последних');
  /** "первые N символов" with full declension (N may be a number or a text phrase → treated as "many"). */
  function ruCountPhrase(adj, n, nounForms, rest) {
    var cat = typeof n === 'number' ? ruPlural(n, ['one', 'few', 'many']) : 'many';
    var out = {};
    for (var i = 0; i < RU_CASES.length; i++) {
      var k = RU_CASES[i];
      out[k] = adj[k] + ' ' + (typeof n === 'number' ? fmtNum(n, 'ru') : n) + ' ' + nounForms[cat][k] + (rest || '');
    }
    return { head: '__custom__', rest: '', cases: out };
  }
  function ruWordCount(n, forms) { return (typeof n === 'number' ? fmtNum(n, 'ru') : n) + ' ' + (typeof n === 'number' ? ruPlural(n, forms) : forms[2]); }

  /* ------------------------------------------------------------------ */
  /* Phrase objects: a noun phrase with case forms (tr/ru) and metadata  */
  /* ------------------------------------------------------------------ */
  function Phrase(lang, text, opts) {
    opts = opts || {};
    this.lang = lang;
    this.text = text == null ? '' : (typeof text === 'string' ? text : ruCase(text, 'nom'));
    this.ru = (lang === 'ru' && typeof text === 'object') ? text : null;
    this.cases = opts.cases || (text && text.cases) || null;
    this.poss = opts.poss !== undefined ? !!opts.poss : true;
    this.gender = opts.gender || null;   // ru
    this.short = opts.short || null;     // short label: “Tutar” or E2:E200
    this.plural = !!opts.plural;
    this.kind = opts.kind || 'phrase';
  }
  Phrase.prototype.c = function (kase) {
    if (!kase || kase === 'nom') return this.text;
    if (this.cases && this.cases[kase]) return this.cases[kase];
    if (this.lang === 'tr') return trCase(this.text, kase, this.poss);
    if (this.lang === 'ru') return this.ru ? ruCase(this.ru, kase) : this.text;
    return this.text;
  };
  Phrase.prototype.toString = function () { return this.text; };
  function P(lang, text, opts) { return new Phrase(lang, text, opts); }

  /* ------------------------------------------------------------------ */
  /* Lazy access to other modules                                        */
  /* ------------------------------------------------------------------ */
  function catalogEntry(name) {
    var c = EFS.catalog;
    if (!c || !c.byName) return null;
    try { return c.byName(name); } catch (e) { return null; }
  }
  function localName(nameEN, dialect) {
    dialect = normDialect(dialect);
    if (dialect === 'en') return nameEN;
    if (EFS.localize && EFS.localize.toDialect) { try { var n = EFS.localize.toDialect(nameEN, dialect); if (n) return n; } catch (e) { /* ignore */ } }
    var e = catalogEntry(nameEN);
    if (e) return (dialect === 'tr' ? e.tr : e.ru) || nameEN;
    return nameEN;
  }
  var BOOL_NAMES = { tr: ['YANLIŞ', 'DOĞRU'], ru: ['ЛОЖЬ', 'ИСТИНА'], en: ['FALSE', 'TRUE'] };
  var ERR_NAMES = {
    tr: { '#N/A': '#YOK', '#VALUE!': '#DEĞER!', '#REF!': '#BAŞV!', '#DIV/0!': '#SAYI/0!', '#NAME?': '#AD?', '#NUM!': '#SAYI!', '#NULL!': '#BOŞ!', '#SPILL!': '#TAŞMA!', '#CALC!': '#HESAP!' },
    ru: { '#N/A': '#Н/Д', '#VALUE!': '#ЗНАЧ!', '#REF!': '#ССЫЛКА!', '#DIV/0!': '#ДЕЛ/0!', '#NAME?': '#ИМЯ?', '#NUM!': '#ЧИСЛО!', '#NULL!': '#ПУСТО!', '#SPILL!': '#ПЕРЕНОС!', '#CALC!': '#ВЫЧИСЛ!' },
    en: {}
  };
  function boolName(v, dialect) {
    dialect = normDialect(dialect);
    if (EFS.localize && EFS.localize.boolName) { try { return EFS.localize.boolName(!!v, dialect); } catch (e) { /* ignore */ } }
    return BOOL_NAMES[dialect][v ? 1 : 0];
  }
  function errName(v, dialect) {
    dialect = normDialect(dialect);
    if (EFS.localize && EFS.localize.errName) { try { return EFS.localize.errName(v, dialect); } catch (e) { /* ignore */ } }
    return (ERR_NAMES[dialect] && ERR_NAMES[dialect][v]) || v;
  }
  /** Boolean literal as it should appear in prose for the reader's language (plus the dialect spelling when different). */
  function boolProse(v, lang, dialect) {
    var a = boolName(v, lang), b = boolName(v, dialect);
    return a === b ? a : a + ' (' + b + ')';
  }
  var ERR_MEANING = {
    '#N/A': { tr: 'değer bulunamadı', ru: 'значение не найдено', en: 'value not available' },
    '#VALUE!': { tr: 'yanlış türde değer', ru: 'неверный тип значения', en: 'wrong type of value' },
    '#REF!': { tr: 'geçersiz başvuru', ru: 'недопустимая ссылка', en: 'invalid reference' },
    '#DIV/0!': { tr: 'sıfıra bölme', ru: 'деление на ноль', en: 'division by zero' },
    '#NAME?': { tr: 'tanınmayan ad', ru: 'нераспознанное имя', en: 'unrecognised name' },
    '#NUM!': { tr: 'geçersiz sayı', ru: 'недопустимое число', en: 'invalid number' },
    '#NULL!': { tr: 'kesişmeyen aralıklar', ru: 'непересекающиеся диапазоны', en: 'ranges do not intersect' },
    '#SPILL!': { tr: 'taşma alanı dolu', ru: 'область переноса занята', en: 'spill range is blocked' }
  };

  /* Minimal serializer used only when EFS.ast.serialize is not loaded. */
  var PREC = { '=': 1, '<>': 1, '<': 1, '>': 1, '<=': 1, '>=': 1, '&': 2, '+': 3, '-': 3, '*': 4, '/': 4, '^': 5 };
  function needsSheetQuote(name) { return /[^A-Za-z0-9_]/.test(name) || /^\d/.test(name); }
  function serializeFallback(node, dialect, lang) {
    dialect = normDialect(dialect);
    var sep = dialect === 'en' ? ',' : ';';
    var dec = dialect === 'en' ? '.' : ',';
    function s(n, parentPrec, side) {
      if (!isNode(n)) return '';
      switch (n.t) {
        case 'func': return localName(n.name, dialect) + '(' + (n.args || []).map(function (a) { return s(a, 0); }).join(sep) + ')';
        case 'ref': return (n.sheet ? (needsSheetQuote(n.sheet) ? "'" + String(n.sheet).replace(/'/g, "''") + "'" : n.sheet) + '!' : '') + n.ref;
        case 'num': return String(n.v).replace('.', dec);
        case 'str': return '"' + String(n.v).replace(/"/g, '""') + '"';
        case 'bool': return boolName(n.v, dialect);
        case 'err': return errName(n.v, dialect);
        case 'name': return n.name;
        case 'empty': return '';
        case 'placeholder': return '«' + pick(n.label, lang) + '»';
        case 'paren': return '(' + s(n.arg, 0) + ')';
        case 'percent': return s(n.arg, 6) + '%';
        case 'unary': return n.op + s(n.arg, 6);
        case 'array': return '{' + (n.rows || []).map(function (r) { return r.map(function (c) { return s(c, 0); }).join(dialect === 'tr' ? '\\' : dialect === 'ru' ? ';' : ','); }).join(dialect === 'ru' ? ':' : ';') + '}';
        case 'op': {
          var p = PREC[n.op] || 1;
          var l = s(n.left, p, 'l'), r = s(n.right, p, 'r');
          var out = l + n.op + r;
          var wrap = parentPrec > p || (parentPrec === p && side === 'r' && n.op !== '^') || (parentPrec === p && side === 'l' && n.op === '^');
          return wrap ? '(' + out + ')' : out;
        }
        default: return '';
      }
    }
    return s(node, 0);
  }
  function serialize(node, dialect, lang) {
    var a = EFS.ast;
    if (a && typeof a.serialize === 'function') {
      try { return a.serialize(node, { dialect: normDialect(dialect), withEquals: false, uiLang: lang }); } catch (e) { /* fall through */ }
    }
    return serializeFallback(node, dialect, lang);
  }

  /* ------------------------------------------------------------------ */
  /* References                                                          */
  /* ------------------------------------------------------------------ */
  function colIndex(letters) {
    var n = 0; letters = String(letters).toUpperCase();
    for (var i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
    return n;
  }
  /** Parse a reference text into parts. */
  function parseRef(text) {
    var raw = String(text || '').trim();
    var spill = /#$/.test(raw);
    var t = raw.replace(/^@/, '').replace(/#$/, '').replace(/\$/g, '');
    var m = /^([A-Za-z]{1,3})(\d+):([A-Za-z]{1,3})(\d+)$/.exec(t);
    if (m) {
      var c1 = m[1].toUpperCase(), c2 = m[3].toUpperCase();
      var r1 = +m[2], r2 = +m[4];
      if (colIndex(c1) > colIndex(c2)) { var tc = c1; c1 = c2; c2 = tc; }
      if (r1 > r2) { var tr = r1; r1 = r2; r2 = tr; }
      return { raw: raw, kind: (c1 === c2 && r1 === r2) ? 'cell' : c1 === c2 ? 'colrange' : 'block', col: c1, col2: c2, row: r1, row2: r2, spill: spill };
    }
    m = /^([A-Za-z]{1,3})(\d+)$/.exec(t);
    if (m) return { raw: raw, kind: 'cell', col: m[1].toUpperCase(), col2: m[1].toUpperCase(), row: +m[2], row2: +m[2], spill: spill };
    m = /^([A-Za-z]{1,3}):([A-Za-z]{1,3})$/.exec(t);
    if (m) return { raw: raw, kind: 'cols', col: m[1].toUpperCase(), col2: m[2].toUpperCase(), row: null, row2: null, spill: spill };
    m = /^(\d+):(\d+)$/.exec(t);
    if (m) return { raw: raw, kind: 'rows', col: null, col2: null, row: +m[1], row2: +m[2], spill: spill };
    return { raw: raw, kind: 'other', spill: spill };
  }
  function sheetHeaders(ctx, sheet) {
    if (!ctx) return null;
    if (!sheet || sheet === ctx.sheetName) return { headers: ctx.headers || [], headerRow: ctx.headerRow || 1, firstDataRow: ctx.firstDataRow || 2, lastRow: ctx.lastRow };
    var o = ctx.otherSheets && ctx.otherSheets[sheet];
    if (o) return { headers: o.headers || [], headerRow: o.headerRow || 1, firstDataRow: o.firstDataRow || 2, lastRow: o.lastRow };
    return null;
  }
  function findHeader(info, col) {
    if (!info || !col) return null;
    for (var i = 0; i < info.headers.length; i++) { var hd = info.headers[i]; if (hd && String(hd.col).toUpperCase() === col && hd.name) return hd; }
    return null;
  }
  var TR_HEADS = {
    'sütunu': { gen: 'sütununun', dat: 'sütununa', acc: 'sütununu', loc: 'sütununda', abl: 'sütunundan' },
    'sütunları': { gen: 'sütunlarının', dat: 'sütunlarına', acc: 'sütunlarını', loc: 'sütunlarında', abl: 'sütunlarından' },
    'aralığı': { gen: 'aralığının', dat: 'aralığına', acc: 'aralığını', loc: 'aralığında', abl: 'aralığından' },
    'hücresi': { gen: 'hücresinin', dat: 'hücresine', acc: 'hücresini', loc: 'hücresinde', abl: 'hücresinden' },
    'değeri': { gen: 'değerinin', dat: 'değerine', acc: 'değerini', loc: 'değerinde', abl: 'değerinden' },
    'satır': { gen: 'satırın', dat: 'satıra', acc: 'satırı', loc: 'satırda', abl: 'satırdan' },
    'satırlar': { gen: 'satırların', dat: 'satırlara', acc: 'satırları', loc: 'satırlarda', abl: 'satırlardan' },
    'tablosu': { gen: 'tablosunun', dat: 'tablosuna', acc: 'tablosunu', loc: 'tablosunda', abl: 'tablosundan' },
    'başlığı': { gen: 'başlığının', dat: 'başlığına', acc: 'başlığını', loc: 'başlığında', abl: 'başlığından' },
    'aralık': { gen: 'aralığın', dat: 'aralığa', acc: 'aralığı', loc: 'aralıkta', abl: 'aralıktan' },
    'alanı': { gen: 'alanının', dat: 'alanına', acc: 'alanını', loc: 'alanında', abl: 'alanından' },
    'dizi': { gen: 'dizinin', dat: 'diziye', acc: 'diziyi', loc: 'dizide', abl: 'diziden' },
    'dizisi': { gen: 'dizisinin', dat: 'dizisine', acc: 'dizisini', loc: 'dizisinde', abl: 'dizisinden' },
    'hatası': { gen: 'hatasının', dat: 'hatasına', acc: 'hatasını', loc: 'hatasında', abl: 'hatasından' },
    'sonucu': { gen: 'sonucunun', dat: 'sonucuna', acc: 'sonucunu', loc: 'sonucunda', abl: 'sonucundan' },
    'değişken': { gen: 'değişkenin', dat: 'değişkene', acc: 'değişkeni', loc: 'değişkende', abl: 'değişkenden' },
    'karakteri': { gen: 'karakterinin', dat: 'karakterine', acc: 'karakterini', loc: 'karakterinde', abl: 'karakterinden' }
  };
  function trHead(pre, head, tail) {
    var t = TR_HEADS[head] || {};
    var cases = {};
    var ks = ['gen', 'dat', 'acc', 'loc', 'abl'];
    for (var i = 0; i < ks.length; i++) cases[ks[i]] = pre + (t[ks[i]] || trCase(head, ks[i], true)) + (tail || '');
    cases.nom = pre + head + (tail || '');
    return cases;
  }
  RU_DECL['строки'] = D('строки', 'строк', 'строкам', 'строки', 'строками', 'строках');
  RU_DECL['символ'] = D('символ', 'символа', 'символу', 'символ', 'символом', 'символе');
  RU_DECL['разлитый массив'] = D('разлитый массив', 'разлитого массива', 'разлитому массиву', 'разлитый массив', 'разлитым массивом', 'разлитом массиве');

  function dash(a, b) { return a + '–' + b; }
  function trSheetPre(sheet) { return sheet ? q(sheet, 'tr') + ' sayfasındaki ' : ''; }
  function ruSheetPost(sheet) { return sheet ? ' на листе ' + q(sheet, 'ru') : ''; }
  function enSheetPost(sheet) { return sheet ? ' on sheet ' + q(sheet, 'en') : ''; }

  /** Build a Phrase for a reference. opts.subj: also compute the "subject" form used in conditions. */
  function refPhrase(node, lang, ctx) {
    var text = node.ref || '', sheet = node.sheet || null;
    var r = parseRef(text);
    var disp = text.replace(/^@/, '');
    var sheetLabel = (ctx && sheet === ctx.sheetName) ? null : sheet;
    var info = sheetHeaders(ctx, sheet);
    var ph, cases, subj, gender = null, short, kind = r.kind;
    var h1 = (r.col) ? findHeader(info, r.col) : null;
    var h2 = (r.col2 && r.col2 !== r.col) ? findHeader(info, r.col2) : null;
    var inData = !info || r.row == null || r.row >= (info.headerRow || 1);
    var isHeaderCell = info && r.kind === 'cell' && r.row === (info.headerRow || 1) && h1;
    if (!inData) { h1 = null; h2 = null; }
    var cellDisp = r.kind === 'cell' ? disp.replace(/\$/g, '') : disp;

    if (r.spill) {
      if (lang === 'tr') { cases = trHead(trSheetPre(sheetLabel) + cellDisp + ' hücresinden yayılan ', 'dizi', ''); ph = cases.nom; }
      else if (lang === 'ru') { ph = RN('разлитый массив', ' из ' + cellDisp + ruSheetPost(sheetLabel)); }
      else ph = 'the spilled array from ' + cellDisp + enSheetPost(sheetLabel);
      short = disp;
      subj = lang === 'ru' ? { text: 'массив из ' + cellDisp, gender: 'm' } : { text: lang === 'tr' ? cellDisp + ' hücresinden yayılan dizi' : 'the spilled array from ' + cellDisp };
      return finish();
    }
    if (r.kind === 'cell') {
      if (isHeaderCell) {
        short = q(h1.name, lang);
        if (lang === 'tr') { cases = trHead(trSheetPre(sheetLabel) + short + ' ', 'başlığı', ' (' + cellDisp + ')'); ph = cases.nom; }
        else if (lang === 'ru') ph = RN('заголовок', ' ' + short + ' (' + cellDisp + ')' + ruSheetPost(sheetLabel));
        else ph = 'the ' + short + ' header (' + cellDisp + ')' + enSheetPost(sheetLabel);
        subj = { text: lang === 'ru' ? 'заголовок ' + short : lang === 'tr' ? short + ' başlığı (' + cellDisp + ')' : 'the ' + short + ' header (' + cellDisp + ')', gender: 'm' };
      } else if (h1) {
        short = q(h1.name, lang);
        gender = ruGender(h1.name);
        if (lang === 'tr') { cases = trHead(trSheetPre(sheetLabel) + short + ' ', 'değeri', ' (' + cellDisp + ')'); ph = cases.nom; }
        else if (lang === 'ru') ph = RN('значение', ' ' + short + ' (' + cellDisp + ')' + ruSheetPost(sheetLabel));
        else ph = 'the ' + short + ' value (' + cellDisp + ')' + enSheetPost(sheetLabel);
        if (lang === 'ru') subj = gender ? { text: short + ' (' + cellDisp + ')' + ruSheetPost(sheetLabel), gender: gender } : { text: 'значение ' + short + ' (' + cellDisp + ')' + ruSheetPost(sheetLabel), gender: 'n' };
        else subj = { text: lang === 'tr' ? trSheetPre(sheetLabel) + short + ' değeri (' + cellDisp + ')' : 'the ' + short + ' value (' + cellDisp + ')' + enSheetPost(sheetLabel) };
      } else {
        short = cellDisp;
        if (lang === 'tr') { cases = trHead(trSheetPre(sheetLabel) + cellDisp + ' ', 'hücresi', ''); ph = cases.nom; }
        else if (lang === 'ru') ph = RN('ячейка', ' ' + cellDisp + ruSheetPost(sheetLabel));
        else ph = 'cell ' + cellDisp + enSheetPost(sheetLabel);
        subj = { text: lang === 'tr' ? trSheetPre(sheetLabel) + cellDisp : cellDisp + (lang === 'ru' ? ruSheetPost(sheetLabel) : enSheetPost(sheetLabel)), gender: 'n' };
      }
      return finish();
    }
    if (r.kind === 'colrange' || (r.kind === 'cols' && r.col === r.col2)) {
      var rangeText = disp.replace(/\$/g, '');
      if (h1) {
        short = q(h1.name, lang);
        gender = ruGender(h1.name);
        if (lang === 'tr') { cases = trHead(trSheetPre(sheetLabel) + short + ' ', 'sütunu', ' (' + rangeText + ')'); ph = cases.nom; }
        else if (lang === 'ru') ph = RN('столбец', ' ' + short + ' (' + rangeText + ')' + ruSheetPost(sheetLabel));
        else ph = 'the ' + short + ' column (' + rangeText + ')' + enSheetPost(sheetLabel);
        if (lang === 'ru') subj = gender ? { text: short + ruSheetPost(sheetLabel), gender: gender } : { text: 'значение ' + short + ruSheetPost(sheetLabel), gender: 'n' };
        else subj = { text: lang === 'tr' ? trSheetPre(sheetLabel) + short + ' sütunu' : short + enSheetPost(sheetLabel) };
      } else if (r.kind === 'cols') {
        short = rangeText;
        if (lang === 'tr') { cases = trHead(trSheetPre(sheetLabel) + r.col + ' ', 'sütunu', ''); ph = cases.nom; }
        else if (lang === 'ru') ph = RN('столбец', ' ' + r.col + ruSheetPost(sheetLabel));
        else ph = 'column ' + r.col + enSheetPost(sheetLabel);
        subj = { text: lang === 'tr' ? trSheetPre(sheetLabel) + r.col + ' sütunu' : lang === 'ru' ? 'значение в столбце ' + r.col + ruSheetPost(sheetLabel) : 'the value in column ' + r.col + enSheetPost(sheetLabel), gender: 'n' };
      } else {
        short = rangeText;
        if (lang === 'tr') { cases = trHead(trSheetPre(sheetLabel) + rangeText + ' ', 'aralığı', ''); ph = cases.nom; }
        else if (lang === 'ru') ph = RN('диапазон', ' ' + rangeText + ruSheetPost(sheetLabel));
        else ph = 'the range ' + rangeText + enSheetPost(sheetLabel);
        subj = { text: lang === 'tr' ? trSheetPre(sheetLabel) + rangeText + ' aralığı' : lang === 'ru' ? 'значение в ' + rangeText + ruSheetPost(sheetLabel) : 'the value in ' + rangeText + enSheetPost(sheetLabel), gender: 'n' };
      }
      return finish();
    }
    if (r.kind === 'cols') {
      var colsText = disp.replace(/\$/g, '');
      short = colsText;
      var names = (h1 && h2) ? dash(q(h1.name, lang), q(h2.name, lang)) : null;
      if (lang === 'tr') { cases = trHead(trSheetPre(sheetLabel) + (names ? names + ' ' : dash(r.col, r.col2) + ' '), 'sütunları', names ? ' (' + colsText + ')' : ''); ph = cases.nom; }
      else if (lang === 'ru') ph = RN('столбцы', ' ' + (names ? names + ' (' + colsText + ')' : dash(r.col, r.col2)) + ruSheetPost(sheetLabel));
      else ph = 'columns ' + (names ? names + ' (' + colsText + ')' : dash(r.col, r.col2)) + enSheetPost(sheetLabel);
      subj = { text: lang === 'tr' ? trSheetPre(sheetLabel) + dash(r.col, r.col2) + ' sütunları' : lang === 'ru' ? 'значение в столбцах ' + dash(r.col, r.col2) : 'the value in columns ' + dash(r.col, r.col2), gender: 'n' };
      return finish();
    }
    if (r.kind === 'block') {
      var blockText = disp.replace(/\$/g, '');
      short = blockText;
      var bnames = (h1 && h2) ? dash(q(h1.name, lang), q(h2.name, lang)) : null;
      if (lang === 'tr') { cases = trHead(trSheetPre(sheetLabel) + blockText + ' ', bnames ? 'tablosu' : 'aralığı', bnames ? ' (' + bnames + ' sütunları)' : ''); ph = cases.nom; }
      else if (lang === 'ru') ph = bnames ? RN('таблица', ' ' + blockText + ' (столбцы ' + bnames + ')' + ruSheetPost(sheetLabel)) : RN('диапазон', ' ' + blockText + ruSheetPost(sheetLabel));
      else ph = bnames ? 'the table ' + blockText + ' (columns ' + bnames + ')' + enSheetPost(sheetLabel) : 'the range ' + blockText + enSheetPost(sheetLabel);
      subj = { text: lang === 'tr' ? trSheetPre(sheetLabel) + blockText + ' aralığı' : lang === 'ru' ? 'значение в ' + blockText : 'the value in ' + blockText, gender: 'n' };
      return finish();
    }
    if (r.kind === 'rows') {
      short = disp;
      var one = r.row === r.row2;
      if (lang === 'tr') { cases = trHead(trSheetPre(sheetLabel) + (one ? r.row + '. ' : dash(r.row, r.row2) + '. '), one ? 'satır' : 'satırlar', ''); ph = cases.nom; }
      else if (lang === 'ru') ph = RN(one ? 'строка' : 'строки', ' ' + (one ? r.row : dash(r.row, r.row2)) + ruSheetPost(sheetLabel));
      else ph = (one ? 'row ' + r.row : 'rows ' + dash(r.row, r.row2)) + enSheetPost(sheetLabel);
      subj = { text: lang === 'ru' ? 'значение в ' + ruCase(ph, 'pre') : lang === 'tr' ? cases.nom : 'the value in ' + ph, gender: 'n' };
      return finish();
    }
    // unknown shape: show verbatim
    short = disp;
    if (lang === 'tr') { cases = trHead(trSheetPre(sheetLabel) + disp + ' ', 'aralığı', ''); ph = cases.nom; }
    else if (lang === 'ru') ph = RN('диапазон', ' ' + disp + ruSheetPost(sheetLabel));
    else ph = 'the range ' + disp + enSheetPost(sheetLabel);
    subj = { text: lang === 'tr' ? disp : lang === 'ru' ? 'значение в ' + disp : 'the value in ' + disp, gender: 'n' };
    return finish();

    function finish() {
      var p = P(lang, ph, { cases: cases, poss: true, gender: gender, short: short, kind: 'ref' });
      p.subj = subj || { text: p.text, gender: 'n' };
      if (!p.subj.gender) p.subj.gender = 'n';
      p.header = h1 ? h1.name : null;
      p.refKind = kind;
      p.refInfo = r;
      p.sheet = sheetLabel;
      p.ctxInfo = info;
      return p;
    }
  }

  /** Public: describe a ref node in words. */
  explain.describeRef = function (refNode, lang, ctx) {
    lang = normLang(lang);
    if (typeof refNode === 'string') refNode = { t: 'ref', ref: refNode };
    if (!isNode(refNode) || refNode.t !== 'ref') return '';
    return refPhrase(refNode, lang, ctx || null).text;
  };

  /* ------------------------------------------------------------------ */
  /* Literal / simple node phrases                                       */
  /* ------------------------------------------------------------------ */
  function strPhrase(v, lang, ctxd) {
    if (v === '') {
      if (lang === 'tr') return P(lang, 'boş metin ("")', { poss: false, kind: 'str', cases: { gen: 'boş metnin ("")', dat: 'boş metne ("")', acc: 'boş metni ("")', loc: 'boş metinde ("")', abl: 'boş metinden ("")' }, gender: 'n' });
      if (lang === 'ru') return P(lang, RN('пустая строка', ' ("")'), { kind: 'str', gender: 'f' });
      return P(lang, 'an empty text ("")', { kind: 'str' });
    }
    if (v === ' ') return P(lang, lang === 'tr' ? 'bir boşluk (" ")' : lang === 'ru' ? 'пробел (" ")' : 'a space (" ")', { poss: false, kind: 'str', gender: 'm' });
    if (/^[^\p{L}\p{N}\s]{1,3}$/u.test(v)) {
      if (lang === 'tr') return P(lang, q(v, lang) + ' karakteri', { cases: trHead(q(v, lang) + ' ', 'karakteri', ''), kind: 'str', gender: 'm', short: q(v, lang) });
      if (lang === 'ru') return P(lang, RN('символ', ' ' + q(v, lang)), { kind: 'str', gender: 'm', short: q(v, lang) });
      return P(lang, 'the ' + q(v, lang) + ' character', { kind: 'str', short: q(v, lang) });
    }
    return P(lang, q(v, lang), { poss: false, kind: 'str', gender: 'n', short: q(v, lang) });
  }
  function numPhrase(v, lang) { return P(lang, fmtNum(v, lang), { poss: false, kind: 'num', gender: 'n', short: fmtNum(v, lang) }); }
  function boolPhrase(v, lang, dialect) { return P(lang, boolProse(v, lang, dialect), { poss: false, kind: 'bool', gender: 'n' }); }
  function errPhrase(v, lang, dialect) {
    var name = errName(v, lang), meaning = pick(ERR_MEANING[v], lang);
    var local = errName(v, dialect) !== name ? ' / ' + errName(v, dialect) : '';
    if (lang === 'tr') return P(lang, name + local + ' hatası' + (meaning ? ' (' + meaning + ')' : ''), { cases: trHead(name + local + ' ', 'hatası', meaning ? ' (' + meaning + ')' : ''), kind: 'err', gender: 'f' });
    if (lang === 'ru') return P(lang, RN('ошибка', ' ' + name + local + (meaning ? ' (' + meaning + ')' : '')), { kind: 'err', gender: 'f' });
    return P(lang, 'the ' + name + ' error' + (meaning ? ' (' + meaning + ')' : ''), { kind: 'err' });
  }
  function namePhrase(node, lang) {
    var n = String(node.name || '');
    var m = /^([^\[\]]+)\[\[?@?([^\[\]]*)\]?\]$/.exec(n);
    var at = /^\[@([^\]]+)\]$/.exec(n);
    if (at) {
      var col = at[1];
      if (lang === 'tr') return P(lang, 'bu satırdaki ' + q(col, lang) + ' değeri', { cases: trHead('bu satırdaki ' + q(col, lang) + ' ', 'değeri', ''), kind: 'name', short: q(col, lang) });
      if (lang === 'ru') return P(lang, RN('значение', ' ' + q(col, lang) + ' в текущей строке'), { kind: 'name', short: q(col, lang), gender: ruGender(col) || 'n' });
      return P(lang, 'the ' + q(col, lang) + ' value in this row', { kind: 'name', short: q(col, lang) });
    }
    if (m && m[2]) {
      var tbl = m[1], c = m[2].replace(/^@/, '');
      if (lang === 'tr') return P(lang, q(tbl, lang) + ' tablosunun ' + q(c, lang) + ' sütunu', { cases: trHead(q(tbl, lang) + ' tablosunun ' + q(c, lang) + ' ', 'sütunu', ''), kind: 'name', short: q(c, lang) });
      if (lang === 'ru') return P(lang, RN('столбец', ' ' + q(c, lang) + ' таблицы ' + q(tbl, lang)), { kind: 'name', short: q(c, lang), gender: ruGender(c) || 'm' });
      return P(lang, 'the ' + q(c, lang) + ' column of table ' + q(tbl, lang), { kind: 'name', short: q(c, lang) });
    }
    if (lang === 'tr') return P(lang, q(n, lang) + ' adlı aralık', { cases: trHead(q(n, lang) + ' adlı ', 'aralık', ''), kind: 'name', short: q(n, lang) });
    if (lang === 'ru') return P(lang, RN('именованный диапазон', ' ' + q(n, lang)), { kind: 'name', short: q(n, lang), gender: 'm' });
    return P(lang, 'the named range ' + q(n, lang), { kind: 'name', short: q(n, lang) });
  }
  function placeholderPhrase(node, lang) {
    var label = pick(node.label, lang) || node.slot || '…';
    var lbl = '«' + label + '»';
    if (lang === 'tr') return P(lang, lbl + ' alanı', { cases: trHead(lbl + ' ', 'alanı', ''), kind: 'placeholder', short: lbl });
    if (lang === 'ru') return P(lang, RN('поле', ' ' + lbl), { kind: 'placeholder', short: lbl, gender: 'n' });
    return P(lang, 'the ' + lbl + ' placeholder', { kind: 'placeholder', short: lbl });
  }
  function arrayPhrase(node, lang, dialect) {
    var txt = serialize(node, dialect, lang);
    if (lang === 'tr') return P(lang, txt + ' dizisi', { cases: trHead(txt + ' ', 'dizisi', ''), kind: 'array', short: txt });
    if (lang === 'ru') return P(lang, RN('массив', ' ' + txt), { kind: 'array', short: txt, gender: 'm' });
    return P(lang, 'the array constant ' + txt, { kind: 'array', short: txt });
  }
  function emptyPhrase(lang) {
    if (lang === 'tr') return P(lang, 'atlanmış bağımsız değişken', { cases: trHead('atlanmış bağımsız ', 'değişken', ''), kind: 'empty' });
    if (lang === 'ru') return P(lang, 'пропущенный аргумент', { kind: 'empty', gender: 'm' });
    return P(lang, 'an omitted argument', { kind: 'empty' });
  }

  /* ------------------------------------------------------------------ */
  /* Criteria strings (">100", "<>", "*gıda*", "Gıda", ">"&B2 ...)       */
  /* ------------------------------------------------------------------ */
  function unwrapParen(n) { while (isNode(n) && n.t === 'paren') n = n.arg; return n; }
  function flattenConcat(n) {
    n = unwrapParen(n);
    if (isNode(n) && n.t === 'op' && n.op === '&') return flattenConcat(n.left).concat(flattenConcat(n.right));
    return [n];
  }
  function unescapeWild(s) { return String(s).replace(/~([*?~])/g, '$1'); }
  function parseCriteriaString(s) {
    var m = /^(<>|>=|<=|=|>|<)?([\s\S]*)$/.exec(String(s));
    var op = m[1] || '=', rest = m[2];
    if (!m[1] && rest === '') return { kind: 'empty', op: '=' };
    if (op === '<>' && rest === '') return { kind: 'notEmpty', op: '<>' };
    if (op === '=' && rest === '') return { kind: 'empty', op: '=' };
    var num = parseNumText(rest);
    if (num !== null) return { kind: 'number', op: op, value: num };
    if (/^(TRUE|FALSE|DOĞRU|YANLIŞ|ИСТИНА|ЛОЖЬ)$/i.test(rest)) return { kind: 'bool', op: op, value: /^(TRUE|DOĞRU|ИСТИНА)$/i.test(rest) };
    var neg = op === '<>';
    if (op === '=' || op === '<>') {
      if (rest === '*') return { kind: 'any', op: op, neg: neg };
      var hasWild = /(^|[^~])[*?]/.test(rest);
      if (hasWild) {
        var c = /^\*([^*?]+)\*$/.exec(rest);
        if (c) return { kind: 'contains', op: op, value: unescapeWild(c[1]), neg: neg };
        var st = /^([^*?]+)\*$/.exec(rest);
        if (st) return { kind: 'startsWith', op: op, value: unescapeWild(st[1]), neg: neg };
        var en = /^\*([^*?]+)$/.exec(rest);
        if (en) return { kind: 'endsWith', op: op, value: unescapeWild(en[1]), neg: neg };
        return { kind: 'pattern', op: op, value: rest, neg: neg };
      }
      return { kind: 'text', op: op, value: unescapeWild(rest), neg: neg };
    }
    return { kind: 'number', op: op, value: unescapeWild(rest), textual: true };
  }
  function parseCriteria(node, env) {
    node = unwrapParen(node);
    if (!isNode(node) || node.t === 'empty') return { kind: 'any', op: '=' };
    if (node.t === 'str') return parseCriteriaString(node.v);
    if (node.t === 'num') return { kind: 'number', op: '=', value: node.v };
    if (node.t === 'bool') return { kind: 'bool', op: '=', value: !!node.v };
    if (node.t === 'unary' && node.op === '-' && isNode(node.arg) && node.arg.t === 'num') return { kind: 'number', op: '=', value: -node.arg.v };
    if (node.t === 'op' && node.op === '&') {
      var parts = flattenConcat(node);
      var first = parts[0];
      if (first.t === 'str') {
        var pm = /^(<>|>=|<=|=|>|<)?(\*?)$/.exec(first.v);
        if (pm && parts.length >= 2) {
          var op = pm[1] || '=';
          var leadStar = pm[2] === '*';
          var last = parts[parts.length - 1];
          var trailStar = last.t === 'str' && last.v === '*' && parts.length >= 3;
          var mid = parts.slice(1, trailStar ? parts.length - 1 : parts.length);
          var valueNode = mid.length === 1 ? mid[0] : mid.reduce(function (acc, n) { return { t: 'op', op: '&', left: acc, right: n }; });
          var vp = describe(valueNode, env).p;
          if (leadStar && trailStar) return { kind: 'contains', op: op, vp: vp, neg: op === '<>' };
          if (leadStar) return { kind: 'endsWith', op: op, vp: vp, neg: op === '<>' };
          if (trailStar) return { kind: 'startsWith', op: op, vp: vp, neg: op === '<>' };
          return { kind: 'dynamic', op: op, vp: vp };
        }
      } else if (parts.length >= 2 && parts[parts.length - 1].t === 'str' && parts[parts.length - 1].v === '*') {
        var vnode = parts.length === 2 ? parts[0] : parts.slice(0, -1).reduce(function (acc, n) { return { t: 'op', op: '&', left: acc, right: n }; });
        return { kind: 'startsWith', op: '=', vp: describe(vnode, env).p };
      }
      return { kind: 'dynamic', op: '=', vp: describe(node, env).p };
    }
    return { kind: 'ref', op: '=', vp: describe(node, env).p };
  }
  function critValueText(cr, lang) {
    if (cr.vp) return null;
    if (cr.kind === 'bool') return boolName(cr.value, lang);
    if (typeof cr.value === 'number') return fmtNum(cr.value, lang);
    return q(cr.value, lang);
  }
  /* Turkish */
  function trCritPart(cr, S) {
    var vt = critValueText(cr, 'tr'), vp = cr.vp;
    var nomV = vp ? vp.text : vt;
    function abl() { return vp ? vp.c('abl') : trCase(vt, 'abl', false); }
    function dat() { return vp ? vp.c('dat') : trCase(vt, 'dat', false); }
    var neg = !!cr.neg, loc = false, part;
    switch (cr.kind) {
      case 'number': case 'dynamic':
        if (cr.op === '>') part = abl() + ' büyük olan';
        else if (cr.op === '<') part = abl() + ' küçük olan';
        else if (cr.op === '>=') part = nomV + ' ve üzeri olan';
        else if (cr.op === '<=') part = nomV + ' ve altı olan';
        else if (cr.op === '<>') part = abl() + ' farklı olan';
        else part = dat() + ' eşit olan';
        break;
      case 'text': part = nomV + (neg ? ' olmayan' : ' olan'); break;
      case 'bool': part = nomV + (cr.op === '<>' ? ' olmayan' : ' olan'); break;
      case 'empty': part = 'boş olan'; break;
      case 'notEmpty': part = 'boş olmayan'; break;
      case 'contains': loc = true; part = (S ? '' : 'içinde ') + nomV + (neg ? ' geçmeyen' : ' geçen'); break;
      case 'startsWith': part = nomV + (neg ? ' ile başlamayan' : ' ile başlayan'); break;
      case 'endsWith': part = nomV + (neg ? ' ile bitmeyen' : ' ile biten'); break;
      case 'any': part = neg ? 'metin içermeyen' : 'metin içeren'; break;
      case 'pattern': part = nomV + (neg ? ' desenine uymayan' : ' desenine uyan'); break;
      case 'ref': part = dat() + ' eşit olan'; break;
      default: part = 'koşulu sağlayan';
    }
    return { part: part, loc: loc };
  }
  function trCritRel(cr, S) { var r = trCritPart(cr, S); return (r.loc ? trCase(S, 'loc', true) : S) + ' ' + r.part; }
  function trCritList(cr) { var r = trCritPart(cr, null); var words = r.part.split(' '); words[words.length - 1] = trPlural(words[words.length - 1]); return words.join(' '); }
  /* Russian */
  var RU_EQ = { m: 'равен', f: 'равна', n: 'равно', p: 'равны' };
  var RU_EMPTY = { m: 'пуст', f: 'пуста', n: 'пусто', p: 'пусты' };
  function ruCritPred(cr, g) { // predicate agreeing with gender g ('p' = plural)
    var vt = critValueText(cr, 'ru'), vp = cr.vp;
    var nom = vp ? vp.text : vt;
    var gen = vp ? vp.c('gen') : vt, dat = vp ? vp.c('dat') : vt, ins = vp ? vp.c('ins') : vt, acc = vp ? vp.c('acc') : vt;
    var pl = g === 'p', neg = !!cr.neg;
    switch (cr.kind) {
      case 'number': case 'dynamic':
        if (cr.op === '>') return 'больше ' + gen;
        if (cr.op === '<') return 'меньше ' + gen;
        if (cr.op === '>=') return 'не меньше ' + gen;
        if (cr.op === '<=') return 'не больше ' + gen;
        if (cr.op === '<>') return 'не ' + ruAgree(g, RU_EQ) + ' ' + dat;
        return ruAgree(g, RU_EQ) + ' ' + dat;
      case 'text': return (neg ? 'не ' : '') + ruAgree(g, RU_EQ) + ' ' + nom;
      case 'bool': return (cr.op === '<>' ? 'не ' : '') + ruAgree(g, RU_EQ) + ' ' + nom;
      case 'empty': return ruAgree(g, RU_EMPTY);
      case 'notEmpty': return 'не ' + ruAgree(g, RU_EMPTY);
      case 'contains': return (neg ? 'не ' : '') + (pl ? 'содержат ' : 'содержит ') + acc;
      case 'startsWith': return (neg ? 'не ' : '') + (pl ? 'начинаются ' : 'начинается ') + ruS(gen);
      case 'endsWith': return (neg ? 'не ' : '') + (pl ? 'заканчиваются на ' : 'заканчивается на ') + acc;
      case 'any': return (neg ? 'не ' : '') + (pl ? 'содержат ' : 'содержит ') + 'какой-либо текст';
      case 'pattern': return (neg ? 'не ' : '') + (pl ? 'соответствуют шаблону ' : 'соответствует шаблону ') + nom;
      case 'ref': return (neg ? 'не ' : '') + (pl ? 'совпадают ' : 'совпадает ') + ruS(ins);
      default: return pl ? 'удовлетворяют условию' : 'удовлетворяет условию';
    }
  }
  function ruCritRel(cr, S, g) { return S + ' ' + ruCritPred(cr, g || 'n'); }
  function ruCritWhich(cr) { return 'которые ' + ruCritPred(cr, 'p'); }
  function ruCritList(cr) {
    var vt = critValueText(cr, 'ru'), vp = cr.vp;
    var nom = vp ? vp.text : vt, gen = vp ? vp.c('gen') : vt, dat = vp ? vp.c('dat') : vt, ins = vp ? vp.c('ins') : vt, acc = vp ? vp.c('acc') : vt;
    var neg = !!cr.neg;
    switch (cr.kind) {
      case 'number': case 'dynamic':
        if (cr.op === '>') return 'больше ' + gen;
        if (cr.op === '<') return 'меньше ' + gen;
        if (cr.op === '>=') return 'не меньше ' + gen;
        if (cr.op === '<=') return 'не больше ' + gen;
        if (cr.op === '<>') return 'не равные ' + dat;
        return 'равные ' + dat;
      case 'text': return (neg ? 'не равные ' : 'равные ') + nom;
      case 'bool': return (cr.op === '<>' ? 'не равные ' : 'равные ') + nom;
      case 'empty': return 'пустые';
      case 'notEmpty': return 'непустые';
      case 'contains': return (neg ? 'не содержащие ' : 'содержащие ') + acc;
      case 'startsWith': return (neg ? 'не начинающиеся ' : 'начинающиеся ') + ruS(gen);
      case 'endsWith': return (neg ? 'не заканчивающиеся на ' : 'заканчивающиеся на ') + acc;
      case 'any': return neg ? 'без текста' : 'содержащие любой текст';
      case 'pattern': return (neg ? 'не соответствующие шаблону ' : 'соответствующие шаблону ') + nom;
      case 'ref': return (neg ? 'не совпадающие ' : 'совпадающие ') + ruS(ins);
      default: return 'удовлетворяющие условию';
    }
  }
  /* English */
  function enCritForms(cr) {
    var vt = critValueText(cr, 'en'), vp = cr.vp;
    var v = vp ? vp.text : vt, neg = !!cr.neg;
    switch (cr.kind) {
      case 'number': case 'dynamic':
        if (cr.op === '>') return { rel: 'is greater than ' + v, which: 'that are greater than ' + v, list: 'greater than ' + v };
        if (cr.op === '<') return { rel: 'is less than ' + v, which: 'that are less than ' + v, list: 'less than ' + v };
        if (cr.op === '>=') return { rel: 'is at least ' + v, which: 'that are at least ' + v, list: 'at least ' + v };
        if (cr.op === '<=') return { rel: 'is at most ' + v, which: 'that are at most ' + v, list: 'at most ' + v };
        if (cr.op === '<>') return { rel: 'is not ' + v, which: 'that are not ' + v, list: 'not equal to ' + v };
        return { rel: 'equals ' + v, which: 'that equal ' + v, list: 'equal to ' + v };
      case 'text': return neg ? { rel: 'is not ' + v, which: 'that are not ' + v, list: 'not equal to ' + v } : { rel: 'is ' + v, which: 'that are ' + v, list: 'equal to ' + v };
      case 'bool': return cr.op === '<>' ? { rel: 'is not ' + v, which: 'that are not ' + v, list: 'not equal to ' + v } : { rel: 'is ' + v, which: 'that are ' + v, list: 'equal to ' + v };
      case 'empty': return { rel: 'is empty', which: 'that are empty', list: 'empty' };
      case 'notEmpty': return { rel: 'is not empty', which: 'that are not empty', list: 'non-empty' };
      case 'contains': return neg ? { rel: 'does not contain ' + v, which: 'that do not contain ' + v, list: 'not containing ' + v } : { rel: 'contains ' + v, which: 'that contain ' + v, list: 'containing ' + v };
      case 'startsWith': return neg ? { rel: 'does not start with ' + v, which: 'that do not start with ' + v, list: 'not starting with ' + v } : { rel: 'starts with ' + v, which: 'that start with ' + v, list: 'starting with ' + v };
      case 'endsWith': return neg ? { rel: 'does not end with ' + v, which: 'that do not end with ' + v, list: 'not ending with ' + v } : { rel: 'ends with ' + v, which: 'that end with ' + v, list: 'ending with ' + v };
      case 'any': return neg ? { rel: 'contains no text', which: 'that contain no text', list: 'without text' } : { rel: 'contains any text', which: 'that contain any text', list: 'containing any text' };
      case 'pattern': return neg ? { rel: 'does not match the pattern ' + v, which: 'that do not match the pattern ' + v, list: 'not matching the pattern ' + v } : { rel: 'matches the pattern ' + v, which: 'that match the pattern ' + v, list: 'matching the pattern ' + v };
      case 'ref': return neg ? { rel: 'does not match ' + v, which: 'that do not match ' + v, list: 'not matching ' + v } : { rel: 'matches ' + v, which: 'that match ' + v, list: 'matching ' + v };
      default: return { rel: 'meets the condition', which: 'that meet the condition', list: 'meeting the condition' };
    }
  }
  /** Criteria helper object used by templates. */
  function Crit(cr, lang) {
    this.cr = cr; this.lang = lang;
  }
  /** Relative clause with a subject phrase (range Phrase or text): TR '“Kategori” sütunu “Gıda” olan' / RU '«Категория» равна «Еда»' / EN '“Category” is “Food”'. */
  Crit.prototype.rel = function (subject) {
    var S = subject && subject.subj ? subject.subj.text : (subject && subject.text) || String(subject || '');
    var g = subject && subject.subj ? subject.subj.gender : (subject && subject.gender) || 'n';
    if (this.lang === 'tr') return trCritRel(this.cr, S);
    if (this.lang === 'ru') return ruCritRel(this.cr, S, g);
    return S + ' ' + enCritForms(this.cr).rel;
  };
  /** Plural participle form: TR '100’den büyük olanlar' / RU 'которые больше 100' / EN 'that are greater than 100'. */
  Crit.prototype.which = function (kase) {
    if (this.lang === 'tr') return trCase(trCritList(this.cr), kase || 'nom', false);
    if (this.lang === 'ru') return ruCritWhich(this.cr);
    return enCritForms(this.cr).which;
  };
  /** Short standalone form: TR '100’den büyük olanlar' / RU 'больше 100' / EN 'greater than 100'. */
  Crit.prototype.list = function (kase) {
    if (this.lang === 'tr') return trCase(trCritList(this.cr), kase || 'nom', false);
    if (this.lang === 'ru') return ruCritList(this.cr);
    return enCritForms(this.cr).list;
  };
  Crit.prototype.isEmptyCheck = function () { return this.cr.kind === 'empty' || this.cr.kind === 'notEmpty'; };
  Crit.prototype.toString = function () { return this.list(); };

  /** Public: describe a criteria node in words (standalone form). */
  explain.describeCriteria = function (node, lang, ctx) {
    lang = normLang(lang);
    var env = makeEnv(lang, ctx);
    return new Crit(parseCriteria(node, env), lang).list();
  };

  /* ------------------------------------------------------------------ */
  /* Conditions (boolean contexts)                                       */
  /* ------------------------------------------------------------------ */
  function subjOf(d) { return d.p.subj ? d.p.subj : { text: d.p.text, gender: d.p.gender || 'n' }; }
  function comparisonClause(node, env) {
    var lang = env.lang;
    var L = describe(node.left, env), R = describe(node.right, env);
    var subj = subjOf(L), S = subj.text, g = subj.gender || 'n';
    var rn = unwrapParen(node.right);
    var rIsStr = rn.t === 'str', rIsEmptyStr = rIsStr && rn.v === '';
    var rLit = rn.t === 'num' || rn.t === 'str' || rn.t === 'bool' || (rn.t === 'unary' && rn.arg && rn.arg.t === 'num');
    var op = node.op;
    if (lang === 'tr') {
      if (rIsEmptyStr && (op === '=' || op === '<>')) return S + (op === '=' ? ' boş' : ' boş değil');
      if (op === '>') return S + ' ' + R.p.c('abl') + ' büyük';
      if (op === '<') return S + ' ' + R.p.c('abl') + ' küçük';
      if (op === '>=') return S + ' ' + R.p.text + ' veya daha büyük';
      if (op === '<=') return S + ' ' + R.p.text + ' veya daha küçük';
      if (op === '<>') return S + ' ' + R.p.c('abl') + ' farklı';
      if (rIsStr) return S + ' ' + R.p.text;
      return S + ' ' + R.p.c('dat') + ' eşit';
    }
    if (lang === 'ru') {
      if (rIsEmptyStr && (op === '=' || op === '<>')) return S + ' ' + (op === '=' ? ruAgree(g, RU_EMPTY) : 'не ' + ruAgree(g, RU_EMPTY));
      if (op === '>') return S + ' больше ' + R.p.c('gen');
      if (op === '<') return S + ' меньше ' + R.p.c('gen');
      if (op === '>=') return S + ' не меньше ' + R.p.c('gen');
      if (op === '<=') return S + ' не больше ' + R.p.c('gen');
      if (op === '<>') return S + ' не ' + ruAgree(g, RU_EQ) + ' ' + (rLit ? R.p.text : R.p.c('dat'));
      return S + ' ' + ruAgree(g, RU_EQ) + ' ' + (rLit ? R.p.text : R.p.c('dat'));
    }
    if (rIsEmptyStr && (op === '=' || op === '<>')) return S + (op === '=' ? ' is empty' : ' is not empty');
    if (op === '>') return S + ' is greater than ' + R.p.text;
    if (op === '<') return S + ' is less than ' + R.p.text;
    if (op === '>=') return S + ' is at least ' + R.p.text;
    if (op === '<=') return S + ' is at most ' + R.p.text;
    if (op === '<>') return S + ' is not ' + R.p.text;
    return S + (rIsStr ? ' is ' : ' equals ') + R.p.text;
  }
  function isComparison(n) { return isNode(n) && n.t === 'op' && /^(=|<>|<|>|<=|>=)$/.test(n.op); }
  /** Condition clause for any node (no trailing "ise"/"if"; the caller frames it). */
  function condClause(node, env) {
    var lang = env.lang;
    node = unwrapParen(node);
    if (!isNode(node)) return '';
    var d = describe(node, env);
    if (d.cond) return d.cond;
    if (isComparison(node)) return comparisonClause(node, env);
    if (node.t === 'bool') return lang === 'tr' ? 'koşul ' + d.p.text : lang === 'ru' ? 'условие — ' + d.p.text : 'the condition is ' + d.p.text;
    if (node.t === 'num') return lang === 'tr' ? d.p.text + ' sıfırdan farklı' : lang === 'ru' ? d.p.text + ' не равно нулю' : d.p.text + ' is non-zero';
    var S = subjOf(d).text;
    if (lang === 'tr') return S + ' DOĞRU';
    if (lang === 'ru') return S + ' — ИСТИНА';
    return S + ' is TRUE';
  }

  /* ------------------------------------------------------------------ */
  /* Operators                                                           */
  /* ------------------------------------------------------------------ */
  function opDesc(node, env) {
    var lang = env.lang, op = node.op;
    var res = { p: null, s: null, cond: null };
    if (isComparison(node)) {
      var cl = comparisonClause(node, env);
      res.cond = cl;
      if (lang === 'tr') { res.p = P(lang, cl + ' olup olmadığı (1/0)', { gender: 'n' }); res.s = cl + ' olup olmadığını kontrol eder; sonuç DOĞRU ya da YANLIŞ olur.'; }
      else if (lang === 'ru') { res.p = P(lang, RN('логическое значение', ' (' + cl + ' → 1/0)'), { gender: 'n' }); res.s = 'проверяет условие: ' + cl + '; результат — ИСТИНА или ЛОЖЬ.'; }
      else { res.p = P(lang, '(' + cl + ' → 1/0)'); res.s = 'checks whether ' + cl + '; the result is TRUE or FALSE.'; }
      return res;
    }
    if (op === '&') {
      var parts = flattenConcat(node).map(function (n) { return describe(n, env); });
      if (lang === 'tr') {
        var items = parts.map(function (d) { return d.p.text; });
        var last = parts[parts.length - 1].p.c('gen');
        var nounList = items.length === 1 ? last : items.slice(0, -1).join(', ') + ' ve ' + last;
        res.p = P(lang, nounList + ' birleşimi', { gender: 'n' });
        res.s = joinList(parts.map(function (d) { return d.p.c('acc'); }), lang) + ' art arda ekleyerek tek bir metin oluşturur.';
      } else if (lang === 'ru') {
        var gens = parts.map(function (d) { return d.p.c('gen'); });
        res.p = P(lang, RN('объединение', ' ' + joinList(gens, lang)), { gender: 'n' });
        res.s = 'соединяет ' + joinList(parts.map(function (d) { return d.p.c('acc'); }), lang) + ' в одну строку.';
      } else {
        var list = joinList(parts.map(function (d) { return d.p.text; }), lang);
        res.p = P(lang, list + ' joined together');
        res.s = 'joins ' + list + ' into one text.';
      }
      return res;
    }
    var L = describe(node.left, env), R = describe(node.right, env);
    var l = L.p, r = R.p;
    if (lang === 'tr') {
      if (op === '+') { res.p = P(lang, l.text + ' ile ' + r.c('gen') + ' toplamı'); res.s = l.c('acc') + ' ve ' + r.c('acc') + ' toplar.'; }
      else if (op === '-') { res.p = P(lang, l.text + ' ile ' + r.text + ' arasındaki fark', { poss: false }); res.s = l.c('abl') + ' ' + r.c('acc') + ' çıkarır.'; }
      else if (op === '*') { res.p = P(lang, l.text + ' ile ' + r.c('gen') + ' çarpımı'); res.s = l.c('acc') + ' ' + r.text + ' ile çarpar.'; }
      else if (op === '/') { res.p = P(lang, l.c('gen') + ' ' + r.c('dat') + ' bölümü'); res.s = l.c('acc') + ' ' + r.c('dat') + ' böler.'; }
      else if (op === '^') { res.p = P(lang, l.text + ' üzeri ' + r.text, { poss: false }); res.s = l.c('acc') + ' ' + r.text + '. kuvvetine yükseltir (' + l.text + ' üzeri ' + r.text + ').'; }
    } else if (lang === 'ru') {
      if (op === '+') { res.p = P(lang, RN('сумма', ' ' + l.c('gen') + ' и ' + r.c('gen')), { gender: 'f' }); res.s = 'складывает ' + l.c('acc') + ' и ' + r.c('acc') + '.'; }
      else if (op === '-') { res.p = P(lang, RN('разность', ' ' + l.c('gen') + ' и ' + r.c('gen')), { gender: 'f' }); res.s = 'вычитает ' + r.c('acc') + ' из ' + l.c('gen') + '.'; }
      else if (op === '*') { res.p = P(lang, RN('произведение', ' ' + l.c('gen') + ' и ' + r.c('gen')), { gender: 'n' }); res.s = 'умножает ' + l.c('acc') + ' на ' + r.c('acc') + '.'; }
      else if (op === '/') { res.p = P(lang, RN('частное', ' от деления ' + l.c('gen') + ' на ' + r.c('acc')), { gender: 'n' }); res.s = 'делит ' + l.c('acc') + ' на ' + r.c('acc') + '.'; }
      else if (op === '^') { res.p = P(lang, RN('результат', ' возведения ' + l.c('gen') + ' в степень ' + r.text), { gender: 'm' }); res.s = 'возводит ' + l.c('acc') + ' в степень ' + r.text + '.'; }
    } else {
      if (op === '+') { res.p = P(lang, 'the sum of ' + l.text + ' and ' + r.text); res.s = 'adds ' + l.text + ' and ' + r.text + '.'; }
      else if (op === '-') { res.p = P(lang, l.text + ' minus ' + r.text); res.s = 'subtracts ' + r.text + ' from ' + l.text + '.'; }
      else if (op === '*') { res.p = P(lang, l.text + ' multiplied by ' + r.text); res.s = 'multiplies ' + l.text + ' by ' + r.text + '.'; }
      else if (op === '/') { res.p = P(lang, l.text + ' divided by ' + r.text); res.s = 'divides ' + l.text + ' by ' + r.text + '.'; }
      else if (op === '^') { res.p = P(lang, l.text + ' to the power of ' + r.text); res.s = 'raises ' + l.text + ' to the power of ' + r.text + '.'; }
    }
    if (!res.p) { res.p = P(lang, serialize(node, env.dialect, lang), { poss: false }); res.s = res.p.text; }
    return res;
  }
  function unaryDesc(node, env) {
    var lang = env.lang, A = describe(node.arg, env);
    if (node.op === '+') return { p: A.p, s: A.s, cond: A.cond };
    if (lang === 'tr') return { p: P(lang, A.p.c('gen') + ' negatifi'), s: A.p.c('gen') + ' işaretini ters çevirir (negatifini alır).' };
    if (lang === 'ru') return { p: P(lang, RN('число', ', противоположное ' + A.p.c('dat')), { gender: 'n' }), s: 'меняет знак ' + A.p.c('gen') + ' на противоположный.' };
    return { p: P(lang, 'the negative of ' + A.p.text), s: 'reverses the sign of ' + A.p.text + '.' };
  }
  function percentDesc(node, env) {
    var lang = env.lang, A = describe(node.arg, env);
    var raw = serialize(node.arg, env.dialect, lang);
    if (lang === 'tr') return { p: P(lang, 'yüzde ' + raw, { poss: false }), s: A.p.c('acc') + ' yüzde olarak alır (' + raw + '/100).' };
    if (lang === 'ru') return { p: P(lang, raw + ' %', { poss: false, gender: 'm' }), s: 'берёт ' + A.p.c('acc') + ' как проценты (' + raw + '/100).' };
    return { p: P(lang, raw + '%'), s: 'treats ' + A.p.text + ' as a percentage (' + raw + '/100).' };
  }

  /* ------------------------------------------------------------------ */
  /* Describe dispatcher                                                 */
  /* ------------------------------------------------------------------ */
  function makeEnv(lang, ctx, dialect) {
    lang = normLang(lang);
    return { lang: lang, ctx: ctx || null, dialect: normDialect(dialect || (ctx && ctx.dialect)), cache: (typeof WeakMap !== 'undefined') ? new WeakMap() : null };
  }
  function enOrdinal(n) {
    var s = ['th', 'st', 'nd', 'rd'], v = Math.abs(n) % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  function ordinal(n, lang) {
    if (typeof n !== 'number') return String(n);
    if (lang === 'tr') return n + '.';
    if (lang === 'ru') return n + '-й';
    return enOrdinal(n);
  }
  function helpers(env) {
    var lang = env.lang, dialect = env.dialect;
    return {
      lang: lang, dialect: dialect, ctx: env.ctx, env: env,
      q: function (s) { return q(s, lang); },
      n: function (v) { return fmtNum(v, lang); },
      list: function (arr) { return joinList(arr, lang); },
      RN: RN,
      bool: function (v) { return boolProse(v, lang, dialect); },
      err: function (v) { return errName(v, lang); },
      local: function (name) { return localName(name, dialect); },
      ord: function (n) { return ordinal(n, lang); },
      trCase: trCase, trPlural: trPlural,
      ruPlural: ruPlural, ruWordCount: ruWordCount, ruCount: ruCountPhrase, ruAgree: ruAgree,
      RU_SYMBOL: RU_SYMBOL, RU_ROW: RU_ROW, RU_FIRST: RU_FIRST, RU_LAST: RU_LAST, RU_EQ: RU_EQ, RU_EMPTY: RU_EMPTY,
      serialize: function (node) { return serialize(node, dialect, lang); },
      cond: function (node) { return condClause(node, env); },
      crit: function (node) { return new Crit(parseCriteria(node, env), lang); },
      describe: function (node) { return describe(node, env); },
      cap: function (s) { return capFirst(s, lang); },
      /** Column header name inside a table ref for a 1-based column index (VLOOKUP/INDEX helpers). */
      colHeader: function (tableArg, index) {
        if (!tableArg || !tableArg.present || !tableArg.p || !tableArg.p.refInfo) return null;
        var r = tableArg.p.refInfo, info = tableArg.p.ctxInfo;
        if (!info || !r.col || typeof index !== 'number') return null;
        var ci = colIndex(r.col) + index - 1;
        if (r.col2 && ci > colIndex(r.col2)) return null;
        var letters = '';
        var n = ci;
        while (n > 0) { var m = (n - 1) % 26; letters = String.fromCharCode(65 + m) + letters; n = Math.floor((n - 1) / 26); }
        var hd = findHeader(info, letters);
        return hd ? hd.name : null;
      }
    };
  }
  var ABSENT = {};
  function absentArg(env) {
    var lang = env.lang;
    var p = emptyPhrase(lang);
    return { node: null, present: false, t: 'empty', p: p, text: p.text, short: p.text, c: function (k) { return p.c(k); }, s: null,
      cond: function () { return ''; }, crit: function () { return new Crit({ kind: 'any', op: '=' }, lang); }, isNum: false, num: null, isStr: false, str: null, isBool: false, bool: null, isEmptyStr: false, raw: '', isRef: false, isLiteral: false, absent: ABSENT };
  }
  function argOf(node, env) {
    if (!isNode(node) || node.t === 'empty') return absentArg(env);
    var d = describe(node, env);
    var un = unwrapParen(node);
    var isNum = un.t === 'num' || (un.t === 'unary' && un.op === '-' && isNode(un.arg) && un.arg.t === 'num') || (un.t === 'percent' && isNode(un.arg) && un.arg.t === 'num');
    var num = un.t === 'num' ? un.v : (un.t === 'unary' && isNum) ? -un.arg.v : (un.t === 'percent' && isNum) ? un.arg.v / 100 : null;
    var p = d.p;
    return {
      node: node, present: true, t: un.t, p: p, text: p.text, short: p.short || p.text,
      c: function (k) { return p.c(k); },
      s: d.s, d: d,
      cond: function () { return condClause(node, env); },
      crit: function () { return new Crit(parseCriteria(node, env), env.lang); },
      isNum: isNum, num: num,
      isStr: un.t === 'str', str: un.t === 'str' ? un.v : null,
      isBool: un.t === 'bool', bool: un.t === 'bool' ? !!un.v : null,
      isEmptyStr: un.t === 'str' && un.v === '',
      isRef: un.t === 'ref', isFunc: un.t === 'func', fn: un.t === 'func' ? String(un.name).toUpperCase() : null,
      isLiteral: un.t === 'num' || un.t === 'str' || un.t === 'bool',
      raw: serialize(node, env.dialect, env.lang)
    };
  }
  function argsOf(node, env) {
    var list = (node.args || []).map(function (n) { return argOf(n, env); });
    var padded = list.slice();
    while (padded.length < 12) padded.push(absentArg(env));
    padded.n = list.length; padded.all = list;
    padded.last = list.length ? list[list.length - 1] : absentArg(env);
    return padded;
  }

  var TEMPLATES = {};
  var TIPS = {};
  /** Register a template: fns[lang](a, h) → { s: sentence (predicate, no subject), n: noun phrase, c: condition clause, tips: [] } */
  function T(names, fns) {
    names.split(/\s+/).forEach(function (nm) { if (nm) TEMPLATES[nm] = fns; });
  }
  function tipFor(names, fn) { names.split(/\s+/).forEach(function (nm) { if (nm) TIPS[nm] = fn; }); }

  function phraseFromTemplate(n, lang) {
    if (n instanceof Phrase) return n;
    if (n == null) return P(lang, '');
    if (typeof n === 'string') return P(lang, n);
    if (n.head !== undefined) { var ph = P(lang, n); if (n.gender) ph.gender = n.gender; if (n.short) ph.short = n.short; return ph; }
    return P(lang, n.text, { poss: n.poss, cases: n.cases, gender: n.gender, short: n.short });
  }
  function ruGenderOfPhrase(p) {
    if (p.gender) return p.gender;
    var first = String(p.text || '').trim().split(/\s+/)[0];
    return ruGender(first) || 'n';
  }

  function genericDesc(node, env) {
    var lang = env.lang, name = String(node.name || '').toUpperCase();
    var entry = catalogEntry(name), local = localName(name, env.dialect);
    var desc = entry ? pick(entry.desc, lang) : '';
    var missing = { tr: 'katalogda bulunmayan bir işlev', ru: 'функция отсутствует в каталоге', en: 'function not found in the catalog' };
    var head = local + '(…) — ' + (desc || missing[lang]);
    var lines = [];
    var args = node.args || [];
    var cargs = (entry && entry.args) || [];
    for (var i = 0; i < args.length; i++) {
      var ca = cargs[i] || (cargs.length ? cargs[cargs.length - 1] : null);
      var an = ca ? (lang === 'tr' ? (ca.tr || ca.name) : lang === 'ru' ? (ca.ru || ca.name) : ca.name) : (lang === 'tr' ? 'bağımsız değişken' : lang === 'ru' ? 'аргумент' : 'argument');
      if (!cargs[i]) an += ' ' + (i + 1);
      var ad = (isNode(args[i]) && args[i].t !== 'empty') ? describe(args[i], env).p.text : (lang === 'tr' ? 'atlandı' : lang === 'ru' ? 'пропущен' : 'omitted');
      lines.push('• ' + an + ': ' + ad);
    }
    var s = head + (lines.length ? '\n' + lines.join('\n') : '');
    var p;
    if (lang === 'tr') p = P(lang, local + '(…) sonucu', { cases: trHead(local + '(…) ', 'sonucu', ''), gender: 'm' });
    else if (lang === 'ru') p = P(lang, RN('результат', ' ' + local + '(…)'), { gender: 'm' });
    else p = P(lang, 'the result of ' + local + '(…)');
    return { p: p, s: s, cond: null, generic: true, fn: name };
  }

  function describe(node, env) {
    if (!isNode(node)) return { node: node, t: 'empty', p: emptyPhrase(env.lang), s: null, cond: null };
    if (env.cache && env.cache.has(node)) return env.cache.get(node);
    var d = describeUncached(node, env);
    d.node = node; d.t = node.t;
    if (env.lang === 'ru' && d.p && !d.p.gender) d.p.gender = ruGenderOfPhrase(d.p);
    if (env.cache) env.cache.set(node, d);
    return d;
  }
  function describeUncached(node, env) {
    var lang = env.lang;
    switch (node.t) {
      case 'paren': return describe(node.arg, env);
      case 'ref': return { p: refPhrase(node, lang, env.ctx), s: null, cond: null };
      case 'num': return { p: numPhrase(node.v, lang), s: null, cond: null };
      case 'str': return { p: strPhrase(node.v, lang, env.dialect), s: null, cond: null };
      case 'bool': return { p: boolPhrase(node.v, lang, env.dialect), s: null, cond: null };
      case 'err': return { p: errPhrase(node.v, lang, env.dialect), s: null, cond: null };
      case 'name': return { p: namePhrase(node, lang), s: null, cond: null };
      case 'placeholder': return { p: placeholderPhrase(node, lang), s: null, cond: null };
      case 'array': return { p: arrayPhrase(node, lang, env.dialect), s: null, cond: null };
      case 'empty': return { p: emptyPhrase(lang), s: null, cond: null };
      case 'unary': return unaryDesc(node, env);
      case 'percent': return percentDesc(node, env);
      case 'op': { var idm = matchIdiom(node, env); if (idm) return idm; return opDesc(node, env); }
      case 'func': {
        var idf = matchIdiom(node, env); if (idf) return idf;
        var name = String(node.name || '').toUpperCase();
        var tpl = TEMPLATES[name];
        if (tpl && tpl[lang]) {
          var a = argsOf(node, env), h = helpers(env);
          var res;
          try { res = tpl[lang](a, h); } catch (e) { res = null; }
          if (res) {
            var out = { p: phraseFromTemplate(res.n, lang), s: res.s ? endSentence(res.s) : null, cond: res.c || null, fn: name, tips: res.tips || null };
            if (!out.p.short) out.p.short = out.p.text;
            return out;
          }
        }
        return genericDesc(node, env);
      }
      default: return { p: P(lang, serialize(node, env.dialect, lang), { poss: false }), s: null, cond: null };
    }
  }

  /** Public: describe any node as a noun phrase (nominative). */
  explain.describeNode = function (node, lang, ctx) {
    lang = normLang(lang);
    return describe(node, makeEnv(lang, ctx)).p.text;
  };

  /* ------------------------------------------------------------------ */
  /* Template helpers                                                    */
  /* ------------------------------------------------------------------ */
  function wrapCases(p, pre, post, lang) {
    var cases = {};
    var ks = lang === 'ru' ? RU_CASES : ['nom', 'gen', 'dat', 'acc', 'loc', 'abl'];
    for (var i = 0; i < ks.length; i++) cases[ks[i]] = pre + p.c(ks[i]) + post;
    return { text: pre + p.text + post, cases: cases, poss: p.poss, gender: p.gender, short: p.short };
  }
  /** TR: "X ile Y’nin" / "X, Y ve Z’nin" (genitive on the last item). */
  function trListGen(args) {
    var ps = args.map(function (x) { return x.p || x; });
    if (ps.length === 0) return '';
    if (ps.length === 1) return ps[0].c('gen');
    var last = ps[ps.length - 1].c('gen');
    if (ps.length === 2) return ps[0].text + ' ile ' + last;
    return ps.slice(0, -1).map(function (p) { return p.text; }).join(', ') + ' ve ' + last;
  }
  function listCase(args, kase, lang) { return joinList(args.map(function (x) { return (x.p || x).c(kase); }), lang); }
  function listText(args, lang) { return joinList(args.map(function (x) { return (x.p || x).text; }), lang); }
  function rangeText(arg) { return arg.p && arg.p.refInfo ? arg.raw.replace(/\$/g, '') : arg.raw; }
  /* "the “Amount” values (E2:E200)" in three languages, for sum/avg ranges */
  /** TR: "“Tutar” sütununda (E2:E200)" + "ki" → "“Tutar” sütunundaki (E2:E200)". */
  function trKi(locText, rest) {
    var m = /^(.*?)(\s*\([^()]*\))$/.exec(locText);
    return m ? m[1] + 'ki' + m[2] + rest : locText + 'ki' + rest;
  }
  function trVals(arg, kase) { // kase: 'acc' default
    kase = kase || 'acc';
    var suf = kase === 'acc' ? 'değerlerini' : kase === 'gen' ? 'değerlerinin' : 'değerleri';
    if (arg.p && arg.p.header) return arg.short + ' ' + suf + ' (' + rangeText(arg) + ')';
    return trKi(arg.c('loc'), ' ' + suf);
  }
  function ruVals(arg) { return (arg.p && arg.p.header) ? 'значения ' + arg.short + ' (' + rangeText(arg) + ')' : 'значения ' + arg.c('gen'); }
  function ruValsGen(arg) { return (arg.p && arg.p.header) ? 'значений ' + arg.short + ' (' + rangeText(arg) + ')' : 'значений ' + arg.c('gen'); }
  function enVals(arg) { return (arg.p && arg.p.header) ? 'the ' + arg.short + ' values (' + rangeText(arg) + ')' : 'the values in ' + arg.text; }
  function pairs(a, start) {
    var out = [];
    for (var i = start; i < a.n; i += 2) out.push([a[i], a[i + 1]]);
    return out;
  }
  function relList(prs, lang) { return prs.map(function (pr) { return pr[1].crit().rel(pr[0].p); }).join(lang === 'tr' ? ' ve ' : lang === 'ru' ? ' и ' : ' and '); }
  function countOf(arg, lang) { return arg.isNum ? fmtNum(arg.num, lang) : arg.text; }

  /** Simple aggregate factory. spec[lang] = { noun, verb } ; TR noun ends with possessive; RU noun is a RU_DECL head. */
  function simpleAgg(spec) {
    return {
      tr: function (a) { var g = trListGen(a.all); return { s: g + ' ' + spec.tr.verb, n: g + ' ' + spec.tr.noun }; },
      ru: function (a) { var g = listCase(a.all, 'gen', 'ru'); return { s: spec.ru.verb + ' ' + g + (spec.ru.post || ''), n: RN(spec.ru.noun, ' ' + g + (spec.ru.post || '')) }; },
      en: function (a) { var l = listText(a.all, 'en'); return { s: spec.en.verb + ' ' + l + (spec.en.post || ''), n: spec.en.noun + ' ' + l + (spec.en.post || '') }; }
    };
  }

  /* ------------------------------------------------------------------ */
  /* Templates: logic                                                    */
  /* ------------------------------------------------------------------ */
  function ifValue(arg, kase, fallback) {
    if (!arg.present) return fallback;
    if (arg.fn === 'IF' && arg.s) return '(' + arg.s.replace(/\.$/, '').replace(/^(возвращает|returns)\s+/, '') + ')';
    return arg.isLiteral ? arg.text : arg.c(kase);
  }
  /** IF(c1,v1,IF(c2,v2,IF(c3,v3,v4))) → [{c,v},...] + final else; null when not an else-if chain. */
  function elseIfChain(a, env) {
    if (!a[2].present || a[2].fn !== 'IF' || a[1].fn === 'IF') return null;
    var parts = [{ c: a[0].cond(), v: a[1] }];
    var n = unwrapParen(a[2].node);
    while (isFunc(n, 'IF')) {
      var args = argsOf(n, env);
      parts.push({ c: args[0].cond(), v: args[1] });
      if (!args[2].present) return { parts: parts, last: null };
      if (args[2].fn === 'IF' && args[1].fn !== 'IF') { n = unwrapParen(args[2].node); continue; }
      return { parts: parts, last: args[2] };
    }
    return null;
  }
  function ifNoun(a, h, lang) {
    var simple = (!a[1].present || a[1].isLiteral) && (!a[2].present || a[2].isLiteral);
    if (lang === 'tr') { if (!simple) return { text: 'koşula göre seçilen değer', poss: false, gender: 'n' }; var nText = 'koşula göre ' + (a[1].present ? a[1].text : h.bool(true)) + (a[2].present ? ' ya da ' + a[2].text : '') + ' '; return { text: nText + 'değeri', cases: trHead(nText, 'değeri', ''), gender: 'n' }; }
    if (lang === 'ru') return simple ? h.RN('значение', ' по условию (' + (a[1].present ? a[1].text : h.bool(true)) + (a[2].present ? ' или ' + a[2].text : '') + ')') : h.RN('значение', ' по условию');
    return simple ? 'either ' + (a[1].present ? a[1].text : h.bool(true)) + (a[2].present ? ' or ' + a[2].text : '') + ', depending on the condition' : 'the value chosen by the condition';
  }
  T('IF', {
    tr: function (a, h) {
      var chain = elseIfChain(a, h.env);
      if (chain) return { s: 'koşulları sırayla kontrol eder: ' + chain.parts.map(function (p) { return p.c + ' ise ' + (p.v.isEmptyStr ? 'hücreyi boş bırakır' : ifValue(p.v, 'acc', '') + ' verir'); }).join('; ') + '; hiçbiri sağlanmazsa ' + (chain.last ? (chain.last.isEmptyStr ? 'hücreyi boş bırakır' : ifValue(chain.last, 'acc', '') + ' verir') : h.bool(false) + ' verir') + '.', n: { text: 'koşullara göre seçilen değer', poss: false, gender: 'n' } };
      var c = a[0].cond();
      var thenV = ifValue(a[1], 'acc', h.bool(true)), elseV = a[2].present ? ifValue(a[2], 'acc', '') : h.bool(false);
      var s;
      if (!a[1].isEmptyStr && !a[2].isEmptyStr) s = c + ' ise ' + thenV + ', değilse ' + elseV + ' verir.';
      else if (a[1].isEmptyStr && a[2].isEmptyStr) s = c + ' ise de değilse de hücreyi boş bırakır.';
      else if (a[1].isEmptyStr) s = c + ' ise hücreyi boş bırakır, değilse ' + elseV + ' verir.';
      else s = c + ' ise ' + thenV + ' verir, değilse hücreyi boş bırakır.';
      return { s: s, n: ifNoun(a, h, 'tr') };
    },
    ru: function (a, h) {
      var chain = elseIfChain(a, h.env);
      if (chain) return { s: 'проверяет условия по порядку: ' + chain.parts.map(function (p) { return 'если ' + p.c + ' — ' + (p.v.isEmptyStr ? 'пусто' : ifValue(p.v, 'nom', '')); }).join('; ') + '; иначе — ' + (chain.last ? (chain.last.isEmptyStr ? 'пусто' : ifValue(chain.last, 'nom', '')) : h.bool(false)) + '.', n: h.RN('выбранное значение', ' по условиям') };
      var c = a[0].cond();
      var thenV = ifValue(a[1], 'acc', h.bool(true)), elseV = a[2].present ? ifValue(a[2], 'acc', '') : h.bool(false);
      var s;
      if (!a[1].isEmptyStr && !a[2].isEmptyStr) s = 'возвращает ' + thenV + ', если ' + c + '; иначе — ' + elseV + '.';
      else if (a[1].isEmptyStr && a[2].isEmptyStr) s = 'оставляет ячейку пустой независимо от того, ' + c + ' или нет.';
      else if (a[1].isEmptyStr) s = 'оставляет ячейку пустой, если ' + c + '; иначе возвращает ' + elseV + '.';
      else s = 'возвращает ' + thenV + ', если ' + c + '; иначе оставляет ячейку пустой.';
      return { s: s, n: ifNoun(a, h, 'ru') };
    },
    en: function (a, h) {
      var chain = elseIfChain(a, h.env);
      if (chain) return { s: 'checks the conditions in order: ' + chain.parts.map(function (p) { return 'if ' + p.c + ', ' + (p.v.isEmptyStr ? 'blank' : ifValue(p.v, 'nom', '')); }).join('; ') + '; otherwise ' + (chain.last ? (chain.last.isEmptyStr ? 'blank' : ifValue(chain.last, 'nom', '')) : h.bool(false)) + '.', n: 'the value chosen by the conditions' };
      var c = a[0].cond();
      var thenV = ifValue(a[1], 'nom', h.bool(true)), elseV = a[2].present ? ifValue(a[2], 'nom', '') : h.bool(false);
      var s;
      if (!a[1].isEmptyStr && !a[2].isEmptyStr) s = 'returns ' + thenV + ' if ' + c + '; otherwise ' + elseV + '.';
      else if (a[1].isEmptyStr && a[2].isEmptyStr) s = 'leaves the cell blank whether or not ' + c + '.';
      else if (a[1].isEmptyStr) s = 'leaves the cell blank if ' + c + '; otherwise it returns ' + elseV + '.';
      else s = 'returns ' + thenV + ' if ' + c + '; otherwise it leaves the cell blank.';
      return { s: s, n: ifNoun(a, h, 'en') };
    }
  });
  T('IFS', {
    tr: function (a, h) {
      var prs = pairs(a, 0), parts = [], def = null;
      prs.forEach(function (pr) { if (pr[0].isBool && pr[0].bool) def = pr[1]; else parts.push(pr[0].cond() + ' ise sonuç ' + (pr[1].isEmptyStr ? 'boş' : pr[1].text) + ' olur'); });
      return { s: 'koşulları sırayla kontrol eder: ' + parts.join('; ') + (def ? '; diğer tüm durumlarda sonuç ' + (def.isEmptyStr ? 'boş' : def.text) + ' olur' : '; hiçbir koşul sağlanmazsa #YOK hatası verir') + '.', n: { text: 'koşullara göre seçilen değer', poss: false, gender: 'n' } };
    },
    ru: function (a, h) {
      var prs = pairs(a, 0), parts = [], def = null;
      prs.forEach(function (pr) { if (pr[0].isBool && pr[0].bool) def = pr[1]; else parts.push('если ' + pr[0].cond() + ', результат — ' + (pr[1].isEmptyStr ? 'пусто' : pr[1].text)); });
      return { s: 'проверяет условия по порядку: ' + parts.join('; ') + (def ? '; во всех остальных случаях — ' + (def.isEmptyStr ? 'пусто' : def.text) : '; если ни одно условие не выполнено, возвращается ошибка #Н/Д') + '.', n: h.RN('выбранное значение', ' по условиям') };
    },
    en: function (a, h) {
      var prs = pairs(a, 0), parts = [], def = null;
      prs.forEach(function (pr) { if (pr[0].isBool && pr[0].bool) def = pr[1]; else parts.push('if ' + pr[0].cond() + ', the result is ' + (pr[1].isEmptyStr ? 'blank' : pr[1].text)); });
      return { s: 'checks the conditions in order: ' + parts.join('; ') + (def ? '; in all other cases the result is ' + (def.isEmptyStr ? 'blank' : def.text) : '; if no condition is met it returns #N/A') + '.', n: 'the value chosen by the conditions' };
    }
  });
  function logicJoin(word) {
    return {
      tr: function (a, h) { var cs = a.all.map(function (x) { return x.cond(); }); var c = cs.join(word.tr); return { s: (word.all ? 'yalnızca tüm koşullar sağlandığında ' : 'koşullardan en az biri sağlandığında ') + h.bool(true) + ', aksi hâlde ' + h.bool(false) + ' verir: ' + cs.join('; ') + '.', n: { text: c + ' olup olmadığı', gender: 'n' }, c: c }; },
      ru: function (a, h) { var cs = a.all.map(function (x) { return x.cond(); }); var c = cs.join(word.ru); return { s: 'возвращает ' + h.bool(true) + (word.all ? ', только если выполнены все условия: ' : ', если выполнено хотя бы одно из условий: ') + cs.join('; ') + '.', n: h.RN('логическое значение', ' (' + c + ')'), c: c }; },
      en: function (a, h) { var cs = a.all.map(function (x) { return x.cond(); }); var c = cs.join(word.en); return { s: 'returns ' + h.bool(true) + (word.all ? ' only when all of these hold: ' : ' when at least one of these holds: ') + cs.join('; ') + '.', n: 'whether ' + c, c: c }; }
    };
  }
  T('AND', logicJoin({ tr: ' ve ', ru: ' и ', en: ' and ', all: true }));
  T('OR', logicJoin({ tr: ' veya ', ru: ' или ', en: ' or ', all: false }));
  T('XOR', {
    tr: function (a, h) { var cs = a.all.map(function (x) { return x.cond(); }); return { s: 'koşullardan tek sayıda olanı sağlanıyorsa ' + h.bool(true) + ' verir: ' + cs.join('; ') + '.', n: { text: 'dışlayıcı VEYA sonucu', cases: trHead('dışlayıcı VEYA ', 'sonucu', '') }, c: cs.join(' ya da (yalnızca biri) ') }; },
    ru: function (a, h) { var cs = a.all.map(function (x) { return x.cond(); }); return { s: 'возвращает ' + h.bool(true) + ', если выполнено нечётное число условий: ' + cs.join('; ') + '.', n: h.RN('логическое значение', ' исключающего ИЛИ'), c: 'выполнено ровно одно из условий: ' + cs.join(', ') }; },
    en: function (a, h) { var cs = a.all.map(function (x) { return x.cond(); }); return { s: 'returns ' + h.bool(true) + ' when an odd number of these hold: ' + cs.join('; ') + '.', n: 'the exclusive-or result', c: 'exactly one of these holds: ' + cs.join(', ') }; }
  });
  T('NOT', {
    tr: function (a, h) { var c = a[0].cond(); return { s: 'koşulun tersini verir: ' + c + ' ise ' + h.bool(false) + ', değilse ' + h.bool(true) + '.', n: { text: c + ' koşulunun tersi', poss: true }, c: c + ' değil' }; },
    ru: function (a, h) { var c = a[0].cond(); return { s: 'меняет логическое значение на противоположное: если ' + c + ', получится ' + h.bool(false) + ', иначе — ' + h.bool(true) + '.', n: h.RN('логическое значение', ', противоположное условию (' + c + ')'), c: 'неверно, что ' + c }; },
    en: function (a, h) { var c = a[0].cond(); return { s: 'reverses the condition: if ' + c + ', the result is ' + h.bool(false) + ', otherwise ' + h.bool(true) + '.', n: 'the opposite of “' + c + '”', c: 'it is not true that ' + c }; }
  });
  function ifErrorTpl(onlyNA) {
    return {
      tr: function (a, h) {
        var x = a[0], y = a[1];
        var fallback = y.isEmptyStr ? 'hücreyi boş bırakır' : 'bunun yerine ' + y.text + ' gösterir';
        var errs = onlyNA ? '#YOK (değer bulunamadı) hatası' : 'bir hata (#YOK, #SAYI/0!, #DEĞER! vb.)';
        var first = (x.s && x.d && !x.d.generic) ? lowerFirst(x.s.replace(/\.$/, ''), 'tr') : x.c('acc') + ' hesaplar';
        return { s: 'önce ' + first + '; sonuç ' + errs + ' olursa ' + fallback + '.', n: wrapCases(x.p, '', ' (hata olursa ' + (y.isEmptyStr ? 'boş' : y.text) + ')', 'tr') };
      },
      ru: function (a, h) {
        var x = a[0], y = a[1];
        var fallback = y.isEmptyStr ? 'оставляет ячейку пустой' : 'вместо неё показывает ' + y.c('acc');
        var errs = onlyNA ? 'ошибка #Н/Д (значение не найдено)' : 'ошибка (например, #Н/Д, #ДЕЛ/0! или #ЗНАЧ!)';
        var first = (x.s && x.d && !x.d.generic) ? 'сначала ' + lowerFirst(x.s.replace(/\.$/, ''), 'ru') : 'вычисляет ' + x.c('acc');
        return { s: first + '; если получается ' + errs + ', ' + fallback + '.', n: wrapCases(x.p, '', ' (или ' + (y.isEmptyStr ? 'пусто' : y.text) + ' при ошибке)', 'ru') };
      },
      en: function (a, h) {
        var x = a[0], y = a[1];
        var fallback = y.isEmptyStr ? 'it leaves the cell blank' : 'it shows ' + y.text + ' instead';
        var errs = onlyNA ? '#N/A (not found)' : 'an error (such as #N/A, #DIV/0! or #VALUE!)';
        var first = (x.s && x.d && !x.d.generic) ? 'first ' + lowerFirst(x.s.replace(/\.$/, ''), 'en') : 'calculates ' + x.text;
        return { s: first + '; if that gives ' + errs + ', ' + fallback + '.', n: x.text + ' (or ' + (y.isEmptyStr ? 'blank' : y.text) + ' on error)' };
      }
    };
  }
  T('IFERROR', ifErrorTpl(false));
  T('IFNA', ifErrorTpl(true));

  /* ------------------------------------------------------------------ */
  /* Templates: aggregates                                               */
  /* ------------------------------------------------------------------ */
  T('SUM', {
    tr: function (a) { var g = trListGen(a.all); return { s: g + ' toplamını verir.', n: g + ' toplamı' }; },
    ru: function (a, h) { var g = listCase(a.all, 'gen', 'ru'); return { s: 'суммирует значения ' + g + '.', n: h.RN('сумма', ' ' + g) }; },
    en: function (a) { var l = listText(a.all, 'en'); return { s: 'adds up the values in ' + l + '.', n: 'the total of ' + l }; }
  });
  T('AVERAGE', simpleAgg({ tr: { noun: 'ortalaması', verb: 'ortalamasını verir.' }, ru: { noun: 'среднее', verb: 'вычисляет среднее значение' }, en: { noun: 'the average of', verb: 'calculates the average of' } }));
  T('MAX', simpleAgg({ tr: { noun: 'en büyük değeri', verb: 'en büyük değerini verir.' }, ru: { noun: 'наибольшее значение', verb: 'находит наибольшее значение' }, en: { noun: 'the largest value in', verb: 'finds the largest value in' } }));
  T('MIN', simpleAgg({ tr: { noun: 'en küçük değeri', verb: 'en küçük değerini verir.' }, ru: { noun: 'наименьшее значение', verb: 'находит наименьшее значение' }, en: { noun: 'the smallest value in', verb: 'finds the smallest value in' } }));
  T('MEDIAN', simpleAgg({ tr: { noun: 'medyanı (ortanca değeri)', verb: 'medyanını (sıralandığında ortada kalan değeri) verir.' }, ru: { noun: 'медиана', verb: 'вычисляет медиану (середину отсортированного ряда)' }, en: { noun: 'the median of', verb: 'calculates the median (the middle value when sorted) of' } }));
  T('MODE.SNGL MODE', simpleAgg({ tr: { noun: 'en sık tekrar eden değeri', verb: 'en sık tekrar eden değerini verir.' }, ru: { noun: 'наиболее частое значение', verb: 'находит наиболее часто встречающееся значение' }, en: { noun: 'the most frequent value in', verb: 'finds the most frequently occurring value in' } }));
  T('STDEV.S STDEV', simpleAgg({ tr: { noun: 'standart sapması', verb: 'standart sapmasını (örneklem) hesaplar.' }, ru: { noun: 'стандартное отклонение', verb: 'вычисляет стандартное отклонение', post: ' (по выборке)' }, en: { noun: 'the standard deviation of', verb: 'calculates the sample standard deviation of' } }));
  T('STDEV.P STDEVP', simpleAgg({ tr: { noun: 'standart sapması', verb: 'standart sapmasını (anakütle) hesaplar.' }, ru: { noun: 'стандартное отклонение', verb: 'вычисляет стандартное отклонение', post: ' (по генеральной совокупности)' }, en: { noun: 'the standard deviation of', verb: 'calculates the population standard deviation of' } }));
  T('PRODUCT', simpleAgg({ tr: { noun: 'çarpımı', verb: 'çarpımını verir.' }, ru: { noun: 'произведение', verb: 'перемножает значения' }, en: { noun: 'the product of', verb: 'multiplies together the values in' } }));
  function countTpl(spec) {
    return {
      tr: function (a) { var l = listCase(a.all, 'loc', 'tr'); return { s: l + ' ' + spec.tr + ' hücrelerin sayısını verir.', n: l + ' ' + spec.tr + ' hücrelerin sayısı' }; },
      ru: function (a, h) { var l = listCase(a.all, 'pre', 'ru'); return { s: 'считает количество ' + spec.ru + ' в ' + l + '.', n: h.RN('количество', ' ' + spec.ru + ' в ' + l) }; },
      en: function (a) { var l = listText(a.all, 'en'); return { s: 'counts the cells in ' + l + ' ' + spec.en + '.', n: 'the number of cells in ' + l + ' ' + spec.en }; }
    };
  }
  T('COUNT', countTpl({ tr: 'sayı içeren', ru: 'ячеек с числами', en: 'that contain numbers' }));
  T('COUNTA', countTpl({ tr: 'boş olmayan (dolu)', ru: 'непустых ячеек', en: 'that are not empty' }));
  T('COUNTBLANK', countTpl({ tr: 'boş', ru: 'пустых ячеек', en: 'that are empty' }));
  T('COUNTIF', {
    tr: function (a) {
      var r = a[0], cr = a[1].crit();
      if (cr.cr.kind === 'ref') return { s: cr.cr.vp.c('gen') + ' ' + r.c('loc') + ' kaç kez geçtiğini sayar.', n: cr.cr.vp.c('gen') + ' ' + trKi(r.c('loc'), ' tekrar sayısı') };
      return { s: r.c('loc') + ' ' + cr.which('gen') + ' sayısını verir.', n: r.c('loc') + ' ' + cr.which('gen') + ' sayısı' };
    },
    ru: function (a, h) {
      var r = a[0], cr = a[1].crit();
      if (cr.cr.kind === 'ref') return { s: 'считает, сколько раз ' + cr.cr.vp.text + ' встречается в ' + r.c('pre') + '.', n: h.RN('количество', ' повторений ' + cr.cr.vp.c('gen') + ' в ' + r.c('pre')) };
      return { s: 'считает количество ячеек в ' + r.c('pre') + ', ' + cr.which() + '.', n: h.RN('количество', ' ячеек в ' + r.c('pre') + ', ' + cr.which()) };
    },
    en: function (a) {
      var r = a[0], cr = a[1].crit();
      if (cr.cr.kind === 'ref') return { s: 'counts how many times ' + cr.cr.vp.text + ' appears in ' + r.text + '.', n: 'the number of times ' + cr.cr.vp.text + ' appears in ' + r.text };
      return { s: 'counts the cells in ' + r.text + ' ' + cr.which() + '.', n: 'the number of cells in ' + r.text + ' ' + cr.which() };
    }
  });
  T('COUNTIFS', {
    tr: function (a) { var rl = relList(pairs(a, 0), 'tr'); return { s: rl + ' satırların sayısını verir.', n: rl + ' satırların sayısı' }; },
    ru: function (a, h) { var rl = relList(pairs(a, 0), 'ru'); return { s: 'считает количество строк, где ' + rl + '.', n: h.RN('количество', ' строк, где ' + rl) }; },
    en: function (a) { var rl = relList(pairs(a, 0), 'en'); return { s: 'counts the rows where ' + rl + '.', n: 'the number of rows where ' + rl }; }
  });
  function condAggTpl(spec) { // SUMIF / AVERAGEIF
    return {
      tr: function (a) {
        var r = a[0], cr = a[1].crit(), v = a[2];
        if (v.present) return { s: cr.rel(r.p) + ' satırların ' + trVals(v, 'acc') + ' ' + spec.tr.verb + '.', n: cr.rel(r.p) + ' satırların ' + v.short + ' ' + spec.tr.noun };
        return { s: r.c('loc') + ' ' + cr.which('acc') + ' ' + spec.tr.verb + '.', n: r.c('loc') + ' ' + cr.which('gen') + ' ' + spec.tr.noun };
      },
      ru: function (a, h) {
        var r = a[0], cr = a[1].crit(), v = a[2];
        if (v.present) return { s: spec.ru.verb + ' ' + ruVals(v) + ' для строк, где ' + cr.rel(r.p) + '.', n: h.RN(spec.ru.noun, ' ' + ruValsGen(v) + ' для строк, где ' + cr.rel(r.p)) };
        return { s: spec.ru.verb + ' те значения в ' + r.c('pre') + ', ' + cr.which() + '.', n: h.RN(spec.ru.noun, ' значений в ' + r.c('pre') + ', ' + cr.which()) };
      },
      en: function (a) {
        var r = a[0], cr = a[1].crit(), v = a[2];
        if (v.present) return { s: spec.en.verb + ' ' + enVals(v) + ' for the rows where ' + cr.rel(r.p) + '.', n: spec.en.noun + ' ' + enVals(v) + ' for the rows where ' + cr.rel(r.p) };
        return { s: spec.en.verb + ' the values in ' + r.text + ' ' + cr.which() + '.', n: spec.en.noun + ' the values in ' + r.text + ' ' + cr.which() };
      }
    };
  }
  T('SUMIF', condAggTpl({ tr: { verb: 'toplar', noun: 'toplamı' }, ru: { verb: 'суммирует', noun: 'сумма' }, en: { verb: 'adds up', noun: 'the total of' } }));
  T('AVERAGEIF', condAggTpl({ tr: { verb: 'ortalamasını alır', noun: 'ortalaması' }, ru: { verb: 'усредняет', noun: 'среднее' }, en: { verb: 'averages', noun: 'the average of' } }));
  function condAggsTpl(spec) { // SUMIFS / AVERAGEIFS / MAXIFS / MINIFS
    return {
      tr: function (a) { var v = a[0], rl = relList(pairs(a, 1), 'tr'); return { s: rl + ' satırların ' + (spec.tr.pick ? spec.tr.pick + ' ' + v.short + ' değerini (' + rangeText(v) + ')' : trVals(v, 'acc')) + ' ' + spec.tr.verb + '.', n: rl + ' satırların ' + (spec.tr.pick ? spec.tr.pick + ' ' + v.short + ' değeri' : v.short + ' ' + spec.tr.noun) }; },
      ru: function (a, h) { var v = a[0], rl = relList(pairs(a, 1), 'ru'); return { s: spec.ru.verb + ' ' + (spec.ru.gen ? ruValsGen(v) : ruVals(v)) + ' для строк, где ' + rl + '.', n: h.RN(spec.ru.noun, ' ' + ruValsGen(v) + ' для строк, где ' + rl) }; },
      en: function (a) { var v = a[0], rl = relList(pairs(a, 1), 'en'); return { s: spec.en.verb + ' ' + enVals(v) + ' for the rows where ' + rl + '.', n: spec.en.noun + ' ' + enVals(v) + ' for the rows where ' + rl }; }
    };
  }
  T('SUMIFS', condAggsTpl({ tr: { verb: 'toplar', noun: 'toplamı' }, ru: { verb: 'суммирует', noun: 'сумма' }, en: { verb: 'adds up', noun: 'the total of' } }));
  T('AVERAGEIFS', condAggsTpl({ tr: { verb: 'ortalamasını alır', noun: 'ortalaması' }, ru: { verb: 'усредняет', noun: 'среднее' }, en: { verb: 'averages', noun: 'the average of' } }));
  T('MAXIFS', condAggsTpl({ tr: { verb: 'verir', pick: 'en büyük' }, ru: { verb: 'находит наибольшее из', noun: 'наибольшее значение', gen: true }, en: { verb: 'finds the largest of', noun: 'the largest of' } }));
  T('MINIFS', condAggsTpl({ tr: { verb: 'verir', pick: 'en küçük' }, ru: { verb: 'находит наименьшее из', noun: 'наименьшее значение', gen: true }, en: { verb: 'finds the smallest of', noun: 'the smallest of' } }));
  T('SUMPRODUCT', {
    tr: function (a) {
      if (a.n === 1) return { s: a[0].c('acc') + ' her satır için hesaplar ve çıkan değerleri toplar (dizi hesaplaması).', n: a[0].c('gen') + ' toplamı' };
      return { s: listText(a.all, 'tr') + ' değerlerini satır satır çarpar ve çarpımları toplar.', n: listText(a.all, 'tr') + ' çarpımlarının toplamı' };
    },
    ru: function (a, h) {
      if (a.n === 1) return { s: 'вычисляет ' + a[0].c('acc') + ' для каждой строки и суммирует результаты (вычисление по массиву).', n: h.RN('сумма', ' ' + a[0].c('gen')) };
      return { s: 'перемножает ' + listCase(a.all, 'acc', 'ru') + ' построчно и суммирует произведения.', n: h.RN('сумма', ' произведений ' + listCase(a.all, 'gen', 'ru')) };
    },
    en: function (a) {
      if (a.n === 1) return { s: 'evaluates ' + a[0].text + ' for every row and adds up the results (array calculation).', n: 'the total of ' + a[0].text };
      return { s: 'multiplies ' + listText(a.all, 'en') + ' row by row and adds up the products.', n: 'the sum of the products of ' + listText(a.all, 'en') };
    }
  });

  /* ------------------------------------------------------------------ */
  /* Templates: lookup & reference                                       */
  /* ------------------------------------------------------------------ */
  function lookupIsExact(arg) { return arg.present && ((arg.isBool && !arg.bool) || (arg.isNum && arg.num === 0)); }
  function vhLookup(horizontal) {
    return {
      tr: function (a, h) {
        var key = a[0], tbl = a[1], idx = a[2], exact = lookupIsExact(a[3]);
        var hdr = !horizontal && idx.isNum ? h.colHeader(tbl, idx.num) : null;
        var where = idx.isNum ? idx.num + '. ' + (horizontal ? 'satırındaki' : 'sütunundaki') + (hdr ? ' (' + h.q(hdr) + ')' : '') : idx.text + ' ile belirtilen ' + (horizontal ? 'satırdaki' : 'sütundaki');
        return { s: key.c('acc') + ' ' + tbl.c('gen') + ' ilk ' + (horizontal ? 'satırında' : 'sütununda') + ' arar ve bulduğu ' + (horizontal ? 'sütunun' : 'satırın') + ' ' + where + ' değeri verir' + (exact ? ' (tam eşleşme).' : ' (yaklaşık eşleşme: ilk ' + (horizontal ? 'satır' : 'sütun') + ' artan sıralı olmalı; tam eşleşme yoksa bir küçük değer alınır).'),
          n: { text: key.c('gen') + ' ' + tbl.text + ' içindeki karşılığı' + (hdr ? ' (' + h.q(hdr) + ')' : ''), gender: 'm' } };
      },
      ru: function (a, h) {
        var key = a[0], tbl = a[1], idx = a[2], exact = lookupIsExact(a[3]);
        var hdr = !horizontal && idx.isNum ? h.colHeader(tbl, idx.num) : null;
        var where = idx.isNum ? 'из ' + idx.num + '-' + (horizontal ? 'й строки' : 'го столбца') + (hdr ? ' (' + h.q(hdr) + ')' : '') : 'из ' + (horizontal ? 'строки' : 'столбца') + ' с номером ' + idx.text;
        return { s: 'ищет ' + key.c('acc') + ' в ' + (horizontal ? 'первой строке ' : 'первом столбце ') + tbl.c('gen') + ' и возвращает значение ' + where + ' найденн' + (horizontal ? 'ого столбца' : 'ой строки') + (exact ? ' (точное совпадение).' : ' (приближённый поиск: ' + (horizontal ? 'первая строка должна быть отсортирована' : 'первый столбец должен быть отсортирован') + ' по возрастанию).'),
          n: h.RN('значение', ', найденное по ' + key.c('dat') + ' в ' + tbl.c('pre') + (hdr ? ' (' + h.q(hdr) + ')' : '')) };
      },
      en: function (a, h) {
        var key = a[0], tbl = a[1], idx = a[2], exact = lookupIsExact(a[3]);
        var hdr = !horizontal && idx.isNum ? h.colHeader(tbl, idx.num) : null;
        var where = idx.isNum ? (horizontal ? 'row ' : 'column ') + idx.num + (hdr ? ' (' + h.q(hdr) + ')' : '') : 'the ' + (horizontal ? 'row' : 'column') + ' given by ' + idx.text;
        return { s: 'looks up ' + key.text + ' in the first ' + (horizontal ? 'row' : 'column') + ' of ' + tbl.text + ' and returns the value from ' + where + ' of the matching ' + (horizontal ? 'column' : 'row') + (exact ? ' (exact match).' : ' (approximate match: the first ' + (horizontal ? 'row' : 'column') + ' must be sorted in ascending order).'),
          n: 'the value found for ' + key.text + ' in ' + tbl.text + (hdr ? ' (' + h.q(hdr) + ')' : '') };
      }
    };
  }
  T('VLOOKUP', vhLookup(false));
  T('HLOOKUP', vhLookup(true));
  T('XLOOKUP', {
    tr: function (a, h) {
      var key = a[0], lk = a[1], ret = a[2], nf = a[3], mode = a[4], srch = a[5];
      var notes = '';
      if (mode.isNum && mode.num === -1) notes += '; tam eşleşme yoksa bir küçük değeri alır';
      if (mode.isNum && mode.num === 1) notes += '; tam eşleşme yoksa bir büyük değeri alır';
      if (mode.isNum && mode.num === 2) notes += '; joker karakterlerle (* ?) eşleştirir';
      if (srch.isNum && srch.num === -1) notes += '; aramaya sondan başlar';
      var nfText = nf.present ? (nf.isEmptyStr ? '; bulunamazsa hücreyi boş bırakır' : '; bulunamazsa ' + nf.text + ' gösterir') : '; bulunamazsa #YOK hatası verir';
      var retVals = ret.p.header ? ret.short + ' değerini (' + rangeText(ret) + ')' : trKi(ret.c('loc'), ' değeri');
      var pre = key.c('dat') + ' karşılık gelen ' + ret.short + ' ';
      return { s: key.c('acc') + ' ' + lk.c('loc') + ' arar ve aynı sıradaki ' + retVals + ' verir' + nfText + notes + '.', n: { text: pre + 'değeri', cases: trHead(pre, 'değeri', ''), gender: 'n' } };
    },
    ru: function (a, h) {
      var key = a[0], lk = a[1], ret = a[2], nf = a[3], mode = a[4], srch = a[5];
      var notes = '';
      if (mode.isNum && mode.num === -1) notes += '; если точного совпадения нет, берётся ближайшее меньшее';
      if (mode.isNum && mode.num === 1) notes += '; если точного совпадения нет, берётся ближайшее большее';
      if (mode.isNum && mode.num === 2) notes += '; используются подстановочные знаки (* ?)';
      if (srch.isNum && srch.num === -1) notes += '; поиск идёт с конца';
      var nfText = nf.present ? (nf.isEmptyStr ? '; если ничего не найдено, оставляет ячейку пустой' : '; если ничего не найдено, показывает ' + nf.c('acc')) : '; если ничего не найдено, возвращает ошибку #Н/Д';
      return { s: 'ищет ' + key.c('acc') + ' в ' + lk.c('pre') + ' и возвращает соответствующее значение из ' + ret.c('gen') + nfText + notes + '.', n: h.RN('значение', ' ' + ret.short + ', соответствующее ' + key.c('dat')) };
    },
    en: function (a, h) {
      var key = a[0], lk = a[1], ret = a[2], nf = a[3], mode = a[4], srch = a[5];
      var notes = '';
      if (mode.isNum && mode.num === -1) notes += '; if there is no exact match it takes the next smaller value';
      if (mode.isNum && mode.num === 1) notes += '; if there is no exact match it takes the next larger value';
      if (mode.isNum && mode.num === 2) notes += '; wildcards (* ?) are allowed';
      if (srch.isNum && srch.num === -1) notes += '; the search runs from the end';
      var nfText = nf.present ? (nf.isEmptyStr ? '; if nothing is found, the cell is left blank' : '; if nothing is found, it shows ' + nf.text) : '; if nothing is found, it returns #N/A';
      return { s: 'looks up ' + key.text + ' in ' + lk.text + ' and returns the matching value from ' + ret.text + nfText + notes + '.', n: 'the ' + ret.short + ' value matching ' + key.text };
    }
  });
  function indexRowIsColumn(rangeArg) { var r = rangeArg.p && rangeArg.p.refInfo; return !!(r && r.row != null && r.row === r.row2 && r.col !== r.col2); }
  T('INDEX', {
    tr: function (a, h) {
      var rg = a[0], row = a[1], col = a[2];
      var asCol = !col.present && indexRowIsColumn(rg);
      var rowD = row.isNum ? row.num + '. ' : (row.fn === 'MATCH' || row.fn === 'XMATCH') ? row.text + ' ile bulunan ' : row.text + ' numaralı ';
      var colD = col.isNum ? col.num + '. ' : (col.fn === 'MATCH' || col.fn === 'XMATCH') ? col.text + ' ile bulunan ' : col.text + ' numaralı ';
      var hdr = (col.isNum ? h.colHeader(rg, col.num) : null) || (asCol && row.isNum ? h.colHeader(rg, row.num) : null);
      var where = rowD + (asCol ? 'sütunundaki' : 'satırındaki') + (col.present ? ' ve ' + colD + 'sütunundaki' : '') + (hdr ? ' (' + h.q(hdr) + ')' : '');
      return { s: rg.c('gen') + ' ' + where + ' değeri verir.', n: { text: rg.c('gen') + ' ' + where + ' değer', poss: false, gender: 'n' } };
    },
    ru: function (a, h) {
      var rg = a[0], row = a[1], col = a[2];
      var asCol = !col.present && indexRowIsColumn(rg);
      var rowD = row.isNum ? '№ ' + row.num : (row.fn === 'MATCH' || row.fn === 'XMATCH') ? 'с номером, равным ' + row.c('dat') : 'с номером ' + row.text;
      var colD = col.isNum ? '№ ' + col.num : (col.fn === 'MATCH' || col.fn === 'XMATCH') ? 'с номером, равным ' + col.c('dat') : 'с номером ' + col.text;
      var hdr = (col.isNum ? h.colHeader(rg, col.num) : null) || (asCol && row.isNum ? h.colHeader(rg, row.num) : null);
      var where = (asCol ? 'в столбце ' : 'в строке ') + rowD + (col.present ? ' и столбце ' + colD : '') + (hdr ? ' (' + h.q(hdr) + ')' : '');
      return { s: 'возвращает значение из ' + rg.c('gen') + ', стоящее ' + where + '.', n: h.RN('значение', ' из ' + rg.c('gen') + ' ' + where) };
    },
    en: function (a, h) {
      var rg = a[0], row = a[1], col = a[2];
      var asCol = !col.present && indexRowIsColumn(rg);
      var rowD = row.isNum ? String(row.num) : 'number given by ' + row.text;
      var colD = col.isNum ? String(col.num) : 'number given by ' + col.text;
      var hdr = (col.isNum ? h.colHeader(rg, col.num) : null) || (asCol && row.isNum ? h.colHeader(rg, row.num) : null);
      var where = (asCol ? 'at column ' : 'at row ') + rowD + (col.present ? ' and column ' + colD : '') + (hdr ? ' (' + h.q(hdr) + ')' : '');
      return { s: 'returns the value from ' + rg.text + ' ' + where + '.', n: 'the value from ' + rg.text + ' ' + where };
    }
  });
  function matchTpl(isX) {
    return {
      tr: function (a) {
        var key = a[0], rg = a[1], m = a[2];
        var mode = m.isNum ? m.num : (isX ? 0 : 1);
        var note = mode === 0 ? ' (tam eşleşme)' : mode === 1 ? (isX ? ' (tam eşleşme yoksa bir büyük değer)' : ' (yaklaşık eşleşme: aralık artan sıralı olmalı; küçük-eşit en büyük değer alınır)') : mode === -1 ? (isX ? ' (tam eşleşme yoksa bir küçük değer)' : ' (aralık azalan sıralı olmalı; büyük-eşit en küçük değer alınır)') : mode === 2 ? ' (joker karakterlerle)' : '';
        return { s: key.c('gen') + ' ' + rg.c('loc') + ' kaçıncı sırada olduğunu (konumunu) bulur' + note + '.', n: key.c('gen') + ' ' + rg.short + ' içindeki konumu' };
      },
      ru: function (a, h) {
        var key = a[0], rg = a[1], m = a[2];
        var mode = m.isNum ? m.num : (isX ? 0 : 1);
        var note = mode === 0 ? ' (точное совпадение)' : mode === 1 ? (isX ? ' (или ближайшее большее)' : ' (приближённый поиск: диапазон должен быть отсортирован по возрастанию)') : mode === -1 ? (isX ? ' (или ближайшее меньшее)' : ' (диапазон должен быть отсортирован по убыванию)') : mode === 2 ? ' (с подстановочными знаками)' : '';
        return { s: 'находит позицию ' + key.c('gen') + ' в ' + rg.c('pre') + note + '.', n: h.RN('позиция', ' ' + key.c('gen') + ' в ' + rg.c('pre')) };
      },
      en: function (a) {
        var key = a[0], rg = a[1], m = a[2];
        var mode = m.isNum ? m.num : (isX ? 0 : 1);
        var note = mode === 0 ? ' (exact match)' : mode === 1 ? (isX ? ' (or the next larger value)' : ' (approximate match: the range must be sorted in ascending order)') : mode === -1 ? (isX ? ' (or the next smaller value)' : ' (the range must be sorted in descending order)') : mode === 2 ? ' (with wildcards)' : '';
        return { s: 'finds the position of ' + key.text + ' in ' + rg.text + note + '.', n: 'the position of ' + key.text + ' in ' + rg.text };
      }
    };
  }
  T('MATCH', matchTpl(false));
  T('XMATCH', matchTpl(true));
  T('CHOOSE', {
    tr: function (a) { var opts = a.all.slice(1).map(function (x, i) { return (i + 1) + ' → ' + x.text; }); return { s: a[0].c('dat') + ' göre listeden seçer: ' + opts.join(', ') + '.', n: { text: a[0].c('dat') + ' göre seçilen değer', poss: false, gender: 'n' } }; },
    ru: function (a, h) { var opts = a.all.slice(1).map(function (x, i) { return (i + 1) + ' → ' + x.text; }); return { s: 'выбирает из списка элемент ' + (a[0].isNum ? 'с номером ' + a[0].text : 'с номером, равным ' + a[0].c('dat')) + ': ' + opts.join(', ') + '.', n: h.RN('выбранное значение', ' по номеру из ' + a[0].c('gen')) }; },
    en: function (a) { var opts = a.all.slice(1).map(function (x, i) { return (i + 1) + ' → ' + x.text; }); return { s: 'picks an item from the list by ' + a[0].text + ': ' + opts.join(', ') + '.', n: 'the item chosen by ' + a[0].text }; }
  });
  T('OFFSET', {
    tr: function (a, h) { var size = (a[3].present || a[4].present) ? ' ve ' + countOf(a[3], 'tr') + ' satır × ' + (a[4].present ? countOf(a[4], 'tr') : '1') + ' sütun boyutunda' : ''; return { s: a[0].c('abl') + ' ' + countOf(a[1], 'tr') + ' satır ve ' + (a[2].present ? countOf(a[2], 'tr') : '0') + ' sütun kaydırılmış' + size + ' bir aralık verir.', n: { text: a[0].c('abl') + ' kaydırılmış aralık', poss: false } }; },
    ru: function (a, h) { var size = (a[3].present || a[4].present) ? ' размером ' + countOf(a[3], 'ru') + ' × ' + (a[4].present ? countOf(a[4], 'ru') : '1') : ''; return { s: 'возвращает диапазон, смещённый от ' + a[0].c('gen') + ' на ' + (a[1].isNum ? h.ruWordCount(a[1].num, ['строку', 'строки', 'строк']) : a[1].text + ' строк') + ' и ' + (a[2].present ? (a[2].isNum ? h.ruWordCount(a[2].num, ['столбец', 'столбца', 'столбцов']) : a[2].text + ' столбцов') : '0 столбцов') + size + '.', n: h.RN('смещённый диапазон', ' от ' + a[0].c('gen')) }; },
    en: function (a) { var size = (a[3].present || a[4].present) ? ' with a size of ' + countOf(a[3], 'en') + ' × ' + (a[4].present ? countOf(a[4], 'en') : '1') : ''; return { s: 'returns a range offset from ' + a[0].text + ' by ' + countOf(a[1], 'en') + (a[1].isNum && a[1].num === 1 ? ' row' : ' rows') + ' and ' + (a[2].present ? countOf(a[2], 'en') : '0') + (a[2].isNum && a[2].num === 1 ? ' column' : ' columns') + size + '.', n: 'the range offset from ' + a[0].text }; }
  });
  T('INDIRECT', {
    tr: function (a) { if (a[0].isStr) return { s: a[0].text + ' adresindeki değeri verir (metin hücre başvurusu olarak yorumlanır).', n: { text: a[0].text + ' adresindeki değer', poss: false } }; return { s: a[0].c('loc') + ' yazan metni hücre adresi olarak yorumlar ve o adresteki değeri verir.', n: { text: a[0].text + ' ile belirtilen adresteki değer', poss: false } }; },
    ru: function (a, h) { if (a[0].isStr) return { s: 'возвращает значение по адресу ' + a[0].text + ' (текст воспринимается как ссылка).', n: h.RN('значение', ' по адресу ' + a[0].text) }; return { s: 'воспринимает текст из ' + a[0].c('gen') + ' как адрес ячейки и возвращает значение по этому адресу.', n: h.RN('значение', ' по адресу из ' + a[0].c('gen')) }; },
    en: function (a) { if (a[0].isStr) return { s: 'returns the value at the address ' + a[0].text + ' (the text is treated as a reference).', n: 'the value at ' + a[0].text }; return { s: 'treats the text in ' + a[0].text + ' as a cell address and returns the value found there.', n: 'the value at the address given by ' + a[0].text }; }
  });

  /* ------------------------------------------------------------------ */
  /* Templates: text                                                     */
  /* ------------------------------------------------------------------ */
  var FORMAT_MEANING = [
    [/^d{4}$/i, { tr: 'gün adı, ör. Pazartesi', ru: 'название дня недели', en: 'the weekday name' }],
    [/^d{3}$/i, { tr: 'kısa gün adı, ör. Pzt', ru: 'краткое название дня недели', en: 'the short weekday name' }],
    [/^m{4}$/i, { tr: 'ay adı, ör. Ocak', ru: 'название месяца', en: 'the month name' }],
    [/^m{3}$/i, { tr: 'kısa ay adı, ör. Oca', ru: 'краткое название месяца', en: 'the short month name' }],
    [/^y{4}$/i, { tr: 'dört haneli yıl', ru: 'год из четырёх цифр', en: 'the four-digit year' }],
    [/^y{2}$/i, { tr: 'iki haneli yıl', ru: 'год из двух цифр', en: 'the two-digit year' }],
    [/^mm$/i, { tr: 'iki haneli ay numarası', ru: 'номер месяца из двух цифр', en: 'the two-digit month number' }],
    [/^dd$/i, { tr: 'iki haneli gün', ru: 'день из двух цифр', en: 'the two-digit day' }],
    [/^[dgт]{1,2}[.\/\-][ma]{1,2}[.\/\-][yг]{2,4}$/i, { tr: 'gün.ay.yıl tarih biçimi', ru: 'дата в формате день.месяц.год', en: 'a day.month.year date' }],
    [/^[ma]{1,2}[.\/\-][dgт]{1,2}[.\/\-][yг]{2,4}$/i, { tr: 'ay/gün/yıl tarih biçimi, ABD', ru: 'дата в формате месяц/день/год, США', en: 'a month/day/year date, US style' }],
    [/^[yг]{4}[.\/\-][ma]{2}[.\/\-][dgт]{2}$/i, { tr: 'yıl-ay-gün tarih biçimi', ru: 'дата в формате год-месяц-день', en: 'a year-month-day date' }],
    [/^[hs]{1,2}:mm(:ss)?$/i, { tr: 'saat:dakika biçimi', ru: 'время в формате часы:минуты', en: 'hours:minutes time' }],
    [/^0$/, { tr: 'ondalıksız tam sayı', ru: 'целое число без дробной части', en: 'a whole number without decimals' }],
    [/^0[.,]0$/, { tr: 'bir ondalık basamak', ru: 'один знак после запятой', en: 'one decimal place' }],
    [/^0[.,]00$/, { tr: 'iki ondalık basamak', ru: 'два знака после запятой', en: 'two decimal places' }],
    [/^0[.,]000$/, { tr: 'üç ondalık basamak', ru: 'три знака после запятой', en: 'three decimal places' }],
    [/^#[,. ]##0$/, { tr: 'binlik ayraçlı tam sayı', ru: 'число с разделителем тысяч', en: 'a whole number with thousands separators' }],
    [/^#[,. ]##0[.,]00$/, { tr: 'binlik ayraçlı, iki ondalıklı sayı', ru: 'число с разделителем тысяч и двумя знаками после запятой', en: 'a number with thousands separators and two decimals' }],
    [/^0%$/, { tr: 'yüzde (ondalıksız)', ru: 'процент без дробной части', en: 'a percentage without decimals' }],
    [/^0[.,]0+%$/, { tr: 'ondalıklı yüzde', ru: 'процент с дробной частью', en: 'a percentage with decimals' }],
    [/^0{2,}$/, { tr: 'başına sıfır eklenmiş sabit haneli sayı', ru: 'число с ведущими нулями', en: 'a number padded with leading zeros' }],
    [/^@$/, { tr: 'metin olarak', ru: 'как текст', en: 'as plain text' }]
  ];
  function formatMeaning(fmtText, lang) {
    if (typeof fmtText !== 'string') return '';
    for (var i = 0; i < FORMAT_MEANING.length; i++) if (FORMAT_MEANING[i][0].test(fmtText.trim())) return FORMAT_MEANING[i][1][lang];
    return '';
  }
  function trDelim(arg) { return arg.isStr && arg.str === ' ' ? 'boşluk' : (arg.short || arg.text); }
  function delimOf(arg, lang) { if (arg.isStr && arg.str === ' ') return { tr: 'boşluk', ru: 'пробел', en: 'a space' }[lang]; return arg.short || arg.text; }

  function sideCharsTpl(left) {
    return {
      tr: function (a) {
        var n = a[1].present ? countOf(a[1], 'tr') : 1, one = a[1].present ? (a[1].isNum && a[1].num === 1) : true;
        var w = left ? 'ilk' : 'son';
        return { s: a[0].c('gen') + ' ' + w + ' ' + (one ? 'karakterini alır.' : n + ' karakterini alır.'), n: a[0].c('gen') + ' ' + w + ' ' + (one ? 'karakteri' : n + ' karakteri') };
      },
      ru: function (a, h) {
        var num = a[1].present ? (a[1].isNum ? a[1].num : a[1].text) : 1;
        var adj = left ? h.RU_FIRST : h.RU_LAST;
        var one = num === 1;
        var ph = one ? { head: '__custom__', cases: left ? D('первый символ', 'первого символа', 'первому символу', 'первый символ', 'первым символом', 'первом символе') : D('последний символ', 'последнего символа', 'последнему символу', 'последний символ', 'последним символом', 'последнем символе') } : h.ruCount(adj, num, h.RU_SYMBOL, '');
        var nounCases = {};
        RU_CASES.forEach(function (k) { nounCases[k] = ph.cases[k] + ' ' + a[0].c('gen'); });
        return { s: 'берёт ' + ph.cases.acc + ' ' + a[0].c('gen') + '.', n: { text: nounCases.nom, cases: nounCases, gender: 'm' } };
      },
      en: function (a) {
        var one = a[1].present ? (a[1].isNum && a[1].num === 1) : true;
        var n = a[1].present ? countOf(a[1], 'en') : 1;
        var w = left ? 'first' : 'last';
        return { s: 'takes the ' + w + ' ' + (one ? 'character' : n + ' characters') + ' of ' + a[0].text + '.', n: 'the ' + w + ' ' + (one ? 'character' : n + ' characters') + ' of ' + a[0].text };
      }
    };
  }
  T('LEFT', sideCharsTpl(true));
  T('RIGHT', sideCharsTpl(false));
  T('MID', {
    tr: function (a) { return { s: a[0].c('gen') + ' ' + countOf(a[1], 'tr') + '. karakterinden başlayarak ' + countOf(a[2], 'tr') + ' karakter alır.', n: a[0].c('gen') + ' ' + countOf(a[1], 'tr') + '. karakterden itibaren ' + countOf(a[2], 'tr') + ' karakterlik parçası' }; },
    ru: function (a, h) { var n = a[2].isNum ? a[2].num : a[2].text; return { s: 'берёт ' + h.ruWordCount(n, ['символ', 'символа', 'символов']) + ' ' + a[0].c('gen') + ', начиная с позиции ' + countOf(a[1], 'ru') + '.', n: h.RN('часть', ' ' + a[0].c('gen') + ' с позиции ' + countOf(a[1], 'ru') + ' длиной ' + h.ruWordCount(n, ['символ', 'символа', 'символов'])) }; },
    en: function (a) { return { s: 'takes ' + countOf(a[2], 'en') + ' characters from ' + a[0].text + ', starting at position ' + countOf(a[1], 'en') + '.', n: 'the ' + countOf(a[2], 'en') + '-character part of ' + a[0].text + ' starting at position ' + countOf(a[1], 'en') }; }
  });
  T('LEN', {
    tr: function (a) { return { s: a[0].c('gen') + ' karakter sayısını (uzunluğunu) verir.', n: a[0].c('gen') + ' uzunluğu' }; },
    ru: function (a, h) { return { s: 'возвращает длину ' + a[0].c('gen') + ' (число символов).', n: h.RN('длина', ' ' + a[0].c('gen')) }; },
    en: function (a) { return { s: 'returns the length of ' + a[0].text + ' (number of characters).', n: 'the length of ' + a[0].text }; }
  });
  T('TRIM', {
    tr: function (a) { return { s: a[0].c('gen') + ' baştaki, sondaki ve kelimeler arasındaki fazla boşluklarını temizler.', n: a[0].c('gen') + ' fazla boşlukları temizlenmiş hâli' }; },
    ru: function (a, h) { return { s: 'удаляет из ' + a[0].c('gen') + ' лишние пробелы (в начале, в конце и двойные между словами).', n: h.RN('очищенный текст', ' из ' + a[0].c('gen')) }; },
    en: function (a) { return { s: 'removes extra spaces from ' + a[0].text + ' (leading, trailing and doubled spaces between words).', n: a[0].text + ' with extra spaces removed' }; }
  });
  T('CLEAN', {
    tr: function (a) { return { s: a[0].c('abl') + ' yazdırılamayan karakterleri (satır sonu vb.) kaldırır.', n: a[0].c('gen') + ' temizlenmiş hâli' }; },
    ru: function (a, h) { return { s: 'удаляет из ' + a[0].c('gen') + ' непечатаемые символы (переносы строк и т. п.).', n: h.RN('очищенный текст', ' из ' + a[0].c('gen')) }; },
    en: function (a) { return { s: 'removes non-printable characters (line breaks etc.) from ' + a[0].text + '.', n: a[0].text + ' with non-printable characters removed' }; }
  });
  function caseTpl(spec) {
    return {
      tr: function (a) { return { s: a[0].c('acc') + ' ' + spec.tr.verb + '.', n: a[0].c('gen') + ' ' + spec.tr.noun }; },
      ru: function (a, h) { return { s: spec.ru.verb + ' ' + a[0].c('acc') + ' ' + spec.ru.post + '.', n: h.RN('текст', ' ' + a[0].c('gen') + ' ' + (spec.ru.nounPost || spec.ru.post)) }; },
      en: function (a) { return { s: spec.en.verb + ' ' + a[0].text + ' ' + spec.en.post + '.', n: a[0].text + ' ' + (spec.en.nounPost || spec.en.post) }; }
    };
  }
  T('UPPER', caseTpl({ tr: { verb: 'tamamen büyük harfe çevirir', noun: 'büyük harfli hâli' }, ru: { verb: 'переводит', post: 'в верхний регистр (ПРОПИСНЫЕ буквы)', nounPost: 'в верхнем регистре' }, en: { verb: 'converts', post: 'to UPPER CASE', nounPost: 'in upper case' } }));
  T('LOWER', caseTpl({ tr: { verb: 'tamamen küçük harfe çevirir', noun: 'küçük harfli hâli' }, ru: { verb: 'переводит', post: 'в нижний регистр (строчные буквы)', nounPost: 'в нижнем регистре' }, en: { verb: 'converts', post: 'to lower case', nounPost: 'in lower case' } }));
  T('PROPER', caseTpl({ tr: { verb: 'her kelimenin ilk harfi büyük, kalanı küçük olacak şekilde düzenler', noun: 'baş harfleri büyütülmüş hâli' }, ru: { verb: 'записывает', post: 'с заглавной первой буквой каждого слова' }, en: { verb: 'writes', post: 'with the first letter of each word capitalised' } }));
  T('CONCAT CONCATENATE', {
    tr: function (a) { return { s: listCase(a.all, 'acc', 'tr') + ' art arda ekleyerek tek bir metin oluşturur.', n: trListGen(a.all) + ' birleşimi' }; },
    ru: function (a, h) { return { s: 'соединяет ' + listCase(a.all, 'acc', 'ru') + ' в одну строку.', n: h.RN('объединение', ' ' + listCase(a.all, 'gen', 'ru')) }; },
    en: function (a) { return { s: 'joins ' + listText(a.all, 'en') + ' into one text.', n: listText(a.all, 'en') + ' joined together' }; }
  });
  T('TEXTJOIN', {
    tr: function (a) { var rs = a.all.slice(2), ign = a[1].isBool ? a[1].bool : true; return { s: listCase(rs, 'gen', 'tr') + ' değerlerini aralarına ' + trDelim(a[0]) + ' koyarak birleştirir' + (ign ? ' (boş hücreler atlanır).' : ' (boş hücreler de ayraçla birlikte eklenir).'), n: trListGen(rs) + ' ' + trDelim(a[0]) + ' ile birleştirilmiş hâli' }; },
    ru: function (a, h) { var rs = a.all.slice(2), ign = a[1].isBool ? a[1].bool : true; return { s: 'объединяет значения ' + listCase(rs, 'gen', 'ru') + ' через разделитель ' + delimOf(a[0], 'ru') + (ign ? ' (пустые ячейки пропускаются).' : ' (пустые ячейки тоже учитываются).'), n: h.RN('объединение', ' ' + listCase(rs, 'gen', 'ru') + ' через ' + a[0].text) }; },
    en: function (a) { var rs = a.all.slice(2), ign = a[1].isBool ? a[1].bool : true; return { s: 'joins the values of ' + listText(rs, 'en') + ' with ' + delimOf(a[0], 'en') + ' between them' + (ign ? ' (empty cells are skipped).' : ' (empty cells are included).'), n: listText(rs, 'en') + ' joined with ' + a[0].text }; }
  });
  T('TEXT', {
    tr: function (a) { var m = formatMeaning(a[1].str, 'tr'); return { s: a[0].c('acc') + ' ' + a[1].text + ' biçiminde metne çevirir' + (m ? ' (' + m + ').' : '.'), n: a[0].c('gen') + ' ' + a[1].text + ' biçimli metin hâli' }; },
    ru: function (a, h) { var m = formatMeaning(a[1].str, 'ru'); return { s: 'преобразует ' + a[0].c('acc') + ' в текст в формате ' + a[1].text + (m ? ' (' + m + ').' : '.'), n: h.RN('отформатированный текст', ' из ' + a[0].c('gen') + ' в формате ' + a[1].text) }; },
    en: function (a) { var m = formatMeaning(a[1].str, 'en'); return { s: 'formats ' + a[0].text + ' as text using the format ' + a[1].text + (m ? ' (' + m + ').' : '.'), n: a[0].text + ' formatted as ' + a[1].text }; }
  });
  T('VALUE NUMBERVALUE', {
    tr: function (a) { return { s: 'metin olarak yazılmış ' + a[0].c('acc') + ' gerçek bir sayıya çevirir.', n: a[0].c('gen') + ' sayıya çevrilmiş hâli' }; },
    ru: function (a, h) { return { s: 'преобразует ' + a[0].c('acc') + ' из текста в настоящее число.', n: h.RN('число', ' из ' + a[0].c('gen')) }; },
    en: function (a) { return { s: 'converts ' + a[0].text + ' (a number stored as text) into a real number.', n: 'the numeric value of ' + a[0].text }; }
  });
  T('SUBSTITUTE', {
    tr: function (a) {
      var t = a[0], o = a[1], nw = a[2], inst = a[3];
      var where = inst.present ? ' (yalnızca ' + countOf(inst, 'tr') + '. geçtiği yerde)' : ' (her geçtiği yerde)';
      if (nw.isEmptyStr) return { s: t.c('abl') + ' ' + (o.isStr && o.str === ' ' ? 'tüm boşlukları' : o.text + ' metnini') + ' siler' + where + '.', n: t.c('gen') + ' ' + (o.isStr && o.str === ' ' ? 'boşlukları' : o.text) + ' silinmiş hâli' };
      return { s: t.c('loc') + ' geçen ' + (o.short || o.text) + ' metnini ' + (nw.short || nw.text) + ' ile değiştirir' + where + '.', n: t.c('gen') + ' ' + (o.short || o.text) + ' yerine ' + (nw.short || nw.text) + ' konmuş hâli' };
    },
    ru: function (a, h) {
      var t = a[0], o = a[1], nw = a[2], inst = a[3];
      var where = inst.present ? ' (только ' + countOf(inst, 'ru') + '-е вхождение)' : ' (все вхождения)';
      if (nw.isEmptyStr) return { s: 'удаляет из ' + t.c('gen') + ' ' + (o.isStr && o.str === ' ' ? 'все пробелы' : o.text) + where + '.', n: h.RN('текст', ' ' + t.c('gen') + ' без ' + (o.isStr && o.str === ' ' ? 'пробелов' : o.text)) };
      return { s: 'заменяет в ' + t.c('pre') + ' ' + o.text + ' на ' + nw.text + where + '.', n: h.RN('текст', ' ' + t.c('gen') + ' с заменой ' + o.text + ' на ' + nw.text) };
    },
    en: function (a, h) {
      var t = a[0], o = a[1], nw = a[2], inst = a[3];
      var where = inst.present ? ' (only the ' + (inst.isNum ? h.ord(inst.num) : inst.text) + ' occurrence)' : ' (every occurrence)';
      if (nw.isEmptyStr) return { s: 'removes ' + (o.isStr && o.str === ' ' ? 'all spaces' : 'every ' + o.text) + ' from ' + t.text + where + '.', n: t.text + ' without ' + (o.isStr && o.str === ' ' ? 'spaces' : o.text) };
      return { s: 'replaces ' + o.text + ' with ' + nw.text + ' in ' + t.text + where + '.', n: t.text + ' with ' + o.text + ' replaced by ' + nw.text };
    }
  });
  T('REPLACE', {
    tr: function (a) { return { s: a[0].c('loc') + ' ' + countOf(a[1], 'tr') + '. karakterden başlayan ' + countOf(a[2], 'tr') + ' karakteri ' + a[3].text + ' ile değiştirir.', n: a[0].c('gen') + ' bir bölümü ' + a[3].text + ' ile değiştirilmiş hâli' }; },
    ru: function (a, h) { return { s: 'заменяет в ' + a[0].c('pre') + ' ' + h.ruWordCount(a[2].isNum ? a[2].num : a[2].text, ['символ', 'символа', 'символов']) + ', начиная с позиции ' + countOf(a[1], 'ru') + ', на ' + a[3].text + '.', n: h.RN('текст', ' ' + a[0].c('gen') + ' с заменённым фрагментом') }; },
    en: function (a) { return { s: 'replaces ' + countOf(a[2], 'en') + ' characters of ' + a[0].text + ', starting at position ' + countOf(a[1], 'en') + ', with ' + a[3].text + '.', n: a[0].text + ' with part of it replaced by ' + a[3].text }; }
  });
  function findTpl(caseSensitive) {
    return {
      tr: function (a) { var st = a[2].present ? '; aramaya ' + countOf(a[2], 'tr') + '. karakterden başlar' : ''; return { s: a[0].c('gen') + ' ' + a[1].c('loc') + ' kaçıncı karakterde başladığını (konumunu) bulur (' + (caseSensitive ? 'büyük/küçük harfe duyarlı' : 'büyük/küçük harf ayrımı yapmaz; * ve ? joker karakterleri kullanılabilir') + st + ').', n: a[0].c('gen') + ' ' + a[1].short + ' içindeki konumu' }; },
      ru: function (a, h) { var st = a[2].present ? ', начиная с позиции ' + countOf(a[2], 'ru') : ''; return { s: 'находит позицию ' + a[0].c('gen') + ' в ' + a[1].c('pre') + ' (' + (caseSensitive ? 'с учётом регистра' : 'без учёта регистра; можно использовать подстановочные знаки * и ?') + st + ').', n: h.RN('позиция', ' ' + a[0].c('gen') + ' в ' + a[1].c('pre')) }; },
      en: function (a) { var st = a[2].present ? ', starting at position ' + countOf(a[2], 'en') : ''; return { s: 'finds the position of ' + a[0].text + ' within ' + a[1].text + ' (' + (caseSensitive ? 'case-sensitive' : 'case-insensitive; the wildcards * and ? are allowed') + st + ').', n: 'the position of ' + a[0].text + ' in ' + a[1].text }; }
    };
  }
  T('FIND', findTpl(true));
  T('SEARCH', findTpl(false));
  T('REPT', {
    tr: function (a) { var k = a[1].isNum ? countOf(a[1], 'tr') + ' kez' : a[1].c('loc') + ' yazan sayı kadar'; return { s: a[0].c('acc') + ' ' + k + ' tekrarlar.', n: a[0].c('gen') + ' ' + k + ' tekrarı' }; },
    ru: function (a, h) { var k = a[1].isNum ? h.ruWordCount(a[1].num, ['раз', 'раза', 'раз']) : 'столько раз, сколько указано в ' + a[1].c('pre'); return { s: 'повторяет ' + a[0].c('acc') + ' ' + k + '.', n: h.RN('повторённый текст', ' (' + a[0].text + ' × ' + countOf(a[1], 'ru') + ')') }; },
    en: function (a) { var k = a[1].isNum ? countOf(a[1], 'en') + ' times' : 'as many times as given by ' + a[1].text; return { s: 'repeats ' + a[0].text + ' ' + k + '.', n: a[0].text + ' repeated ' + k }; }
  });
  function textSideTpl(before) {
    return {
      tr: function (a) { var inst = a[2].isNum ? (a[2].num === -1 ? ' (son geçtiği yer esas alınır)' : ' (' + a[2].num + '. geçtiği yer esas alınır)') : ''; return { s: a[0].c('gen') + ' ' + trDelim(a[1]) + ' ayracından ' + (before ? 'önceki' : 'sonraki') + ' kısmını alır' + inst + '.', n: a[0].c('gen') + ' ' + trDelim(a[1]) + ' ' + (before ? 'öncesindeki' : 'sonrasındaki') + ' kısmı' }; },
      ru: function (a, h) { var inst = a[2].isNum ? (a[2].num === -1 ? ' (считая от последнего вхождения)' : ' (считая от ' + a[2].num + '-го вхождения)') : ''; return { s: 'возвращает часть ' + a[0].c('gen') + ' ' + (before ? 'до' : 'после') + ' разделителя ' + delimOf(a[1], 'ru') + inst + '.', n: h.RN('часть', ' ' + a[0].c('gen') + ' ' + (before ? 'до ' : 'после ') + delimOf(a[1], 'ru')) }; },
      en: function (a) { var inst = a[2].isNum ? (a[2].num === -1 ? ' (counting from the last occurrence)' : ' (counting from the ' + enOrdinal(a[2].num) + ' occurrence)') : ''; return { s: 'returns the part of ' + a[0].text + ' ' + (before ? 'before' : 'after') + ' ' + delimOf(a[1], 'en') + inst + '.', n: 'the part of ' + a[0].text + ' ' + (before ? 'before ' : 'after ') + delimOf(a[1], 'en') }; }
    };
  }
  T('TEXTBEFORE', textSideTpl(true));
  T('TEXTAFTER', textSideTpl(false));
  T('TEXTSPLIT', {
    tr: function (a) { return { s: a[0].c('acc') + ' ' + trDelim(a[1]) + ' ayracına göre parçalara böler ve parçaları yan yana hücrelere yayar' + (a[2].present ? '; ' + trDelim(a[2]) + ' ayracı yeni satıra geçirir' : '') + '.', n: a[0].c('gen') + ' ' + trDelim(a[1]) + ' ile ayrılmış parçaları' }; },
    ru: function (a, h) { return { s: 'разбивает ' + a[0].c('acc') + ' по разделителю ' + delimOf(a[1], 'ru') + ' на отдельные ячейки по горизонтали' + (a[2].present ? '; разделитель ' + delimOf(a[2], 'ru') + ' переносит на новую строку' : '') + '.', n: h.RN('части текста', ' ' + a[0].c('gen') + ', разделённого по ' + delimOf(a[1], 'ru')) }; },
    en: function (a) { return { s: 'splits ' + a[0].text + ' at ' + delimOf(a[1], 'en') + ' into separate cells across the row' + (a[2].present ? '; ' + delimOf(a[2], 'en') + ' starts a new row' : '') + '.', n: 'the parts of ' + a[0].text + ' split at ' + delimOf(a[1], 'en') }; }
  });
  T('EXACT', {
    tr: function (a) { var c = a[0].text + ' ile ' + a[1].text + ' birebir aynı'; return { s: a[0].text + ' ile ' + a[1].text + ' metinlerinin birebir aynı olup olmadığını kontrol eder (büyük/küçük harf farkı dikkate alınır).', n: { text: c + ' olup olmadığı', gender: 'n' }, c: c }; },
    ru: function (a, h) { return { s: 'проверяет, полностью ли совпадают ' + a[0].text + ' и ' + a[1].text + ' (с учётом регистра).', n: h.RN('результат', ' точного сравнения ' + a[0].c('gen') + ' и ' + a[1].c('gen')), c: a[0].text + ' и ' + a[1].text + ' полностью совпадают' }; },
    en: function (a) { return { s: 'checks whether ' + a[0].text + ' and ' + a[1].text + ' are exactly the same (case-sensitive).', n: 'whether ' + a[0].text + ' exactly equals ' + a[1].text, c: a[0].text + ' and ' + a[1].text + ' are exactly the same' }; }
  });
  T('CHAR UNICHAR', {
    tr: function (a) { return { s: 'kodu ' + a[0].text + ' olan karakteri verir.', n: { text: a[0].text + ' kodlu karakter', poss: false } }; },
    ru: function (a, h) { return { s: 'возвращает символ с кодом ' + a[0].text + '.', n: h.RN('текст', ' (символ с кодом ' + a[0].text + ')') }; },
    en: function (a) { return { s: 'returns the character with code ' + a[0].text + '.', n: 'the character with code ' + a[0].text }; }
  });

  /* ------------------------------------------------------------------ */
  /* Templates: math                                                     */
  /* ------------------------------------------------------------------ */
  function digitsPhrase(dArg, lang) {
    if (!dArg.present || (dArg.isNum && dArg.num === 0)) return { tr: 'en yakın tam sayıya', ru: 'до целого', en: 'to the nearest whole number' }[lang];
    if (dArg.isNum && dArg.num > 0) {
      var d = dArg.num;
      if (lang === 'tr') return d + ' ondalık basamağa';
      if (lang === 'ru') return 'до ' + ruWordCount(d, ['знака', 'знаков', 'знаков']) + ' после запятой';
      return 'to ' + d + (d === 1 ? ' decimal place' : ' decimal places');
    }
    if (dArg.isNum && dArg.num < 0) {
      var mult = Math.pow(10, -dArg.num);
      if (lang === 'tr') return 'en yakın ' + fmtNum(mult, 'tr') + ' katına';
      if (lang === 'ru') return 'до ближайшего кратного ' + fmtNum(mult, 'ru');
      return 'to the nearest ' + fmtNum(mult, 'en');
    }
    if (lang === 'tr') return dArg.text + ' ile belirtilen basamak sayısına';
    if (lang === 'ru') return 'до числа знаков, заданного ' + dArg.c('ins');
    return 'to the number of decimal places given by ' + dArg.text;
  }
  function roundTpl(spec) {
    return {
      tr: function (a) { var dp = digitsPhrase(a[1], 'tr'); return { s: a[0].c('acc') + ' ' + dp + ' ' + spec.tr + '.', n: a[0].c('gen') + ' ' + dp + ' yuvarlanmış değeri' }; },
      ru: function (a, h) { var dp = digitsPhrase(a[1], 'ru'); return { s: 'округляет ' + a[0].c('acc') + spec.ru + ' ' + dp + '.', n: h.RN('округлённое значение', ' ' + a[0].c('gen')) }; },
      en: function (a) { var dp = digitsPhrase(a[1], 'en'); return { s: 'rounds ' + a[0].text + spec.en + ' ' + dp + '.', n: a[0].text + ' rounded' + spec.en + ' ' + dp }; }
    };
  }
  T('ROUND', roundTpl({ tr: 'yuvarlar', ru: '', en: '' }));
  T('ROUNDUP', roundTpl({ tr: 'yukarı (sıfırdan uzağa) yuvarlar', ru: ' в большую сторону (от нуля)', en: ' up (away from zero)' }));
  T('ROUNDDOWN', roundTpl({ tr: 'aşağı (sıfıra doğru) yuvarlar', ru: ' в меньшую сторону (к нулю)', en: ' down (towards zero)' }));
  T('INT', {
    tr: function (a) { return { s: a[0].c('acc') + ' aşağı doğru en yakın tam sayıya yuvarlar (ondalık kısmı atar).', n: a[0].c('gen') + ' tam sayı kısmı' }; },
    ru: function (a, h) { return { s: 'округляет ' + a[0].c('acc') + ' вниз до ближайшего целого.', n: h.RN('целая часть', ' ' + a[0].c('gen')) }; },
    en: function (a) { return { s: 'rounds ' + a[0].text + ' down to the nearest whole number.', n: 'the integer part of ' + a[0].text }; }
  });
  T('TRUNC', {
    tr: function (a) { var d = a[1].present && !(a[1].isNum && a[1].num === 0) ? ' (' + countOf(a[1], 'tr') + ' ondalık basamak kalır)' : ''; return { s: a[0].c('gen') + ' ondalık kısmını yuvarlamadan atar' + d + '.', n: a[0].c('gen') + ' kesilmiş hâli' }; },
    ru: function (a, h) { var d = a[1].present && !(a[1].isNum && a[1].num === 0) ? ', оставляя ' + h.ruWordCount(a[1].isNum ? a[1].num : a[1].text, ['знак', 'знака', 'знаков']) : ''; return { s: 'отбрасывает дробную часть ' + a[0].c('gen') + ' без округления' + d + '.', n: h.RN('целая часть', ' ' + a[0].c('gen')) }; },
    en: function (a) { var d = a[1].present && !(a[1].isNum && a[1].num === 0) ? ', keeping ' + countOf(a[1], 'en') + (a[1].isNum && a[1].num === 1 ? ' decimal place' : ' decimal places') : ''; return { s: 'cuts off the decimal part of ' + a[0].text + ' without rounding' + d + '.', n: a[0].text + ' truncated' }; }
  });
  T('MOD', {
    tr: function (a) { return { s: a[0].c('gen') + ' ' + a[1].c('dat') + ' bölümünden kalanı verir.', n: { text: a[0].c('gen') + ' ' + a[1].c('dat') + ' bölümünden kalan', poss: false, gender: 'm' } }; },
    ru: function (a, h) { return { s: 'возвращает остаток от деления ' + a[0].c('gen') + ' на ' + a[1].c('acc') + '.', n: h.RN('остаток', ' от деления ' + a[0].c('gen') + ' на ' + a[1].c('acc')) }; },
    en: function (a) { return { s: 'returns the remainder of ' + a[0].text + ' divided by ' + a[1].text + '.', n: 'the remainder of ' + a[0].text + ' divided by ' + a[1].text }; }
  });
  T('ABS', {
    tr: function (a) { return { s: a[0].c('gen') + ' mutlak değerini (işaretsiz hâlini) verir.', n: a[0].c('gen') + ' mutlak değeri' }; },
    ru: function (a, h) { return { s: 'возвращает модуль (абсолютное значение) ' + a[0].c('gen') + ', то есть число без знака.', n: h.RN('модуль', ' ' + a[0].c('gen')) }; },
    en: function (a) { return { s: 'returns the absolute value of ' + a[0].text + ' (the number without its sign).', n: 'the absolute value of ' + a[0].text }; }
  });
  T('POWER', {
    tr: function (a) { return { s: a[0].text + ' üzeri ' + a[1].text + ' değerini hesaplar (' + a[0].c('acc') + ' ' + a[1].text + '. kuvvetine yükseltir).', n: { text: a[0].text + ' üzeri ' + a[1].text, poss: false, gender: 'n' } }; },
    ru: function (a, h) { return { s: 'возводит ' + a[0].c('acc') + ' в степень ' + a[1].text + '.', n: h.RN('результат', ' возведения ' + a[0].c('gen') + ' в степень ' + a[1].text) }; },
    en: function (a) { return { s: 'raises ' + a[0].text + ' to the power of ' + a[1].text + '.', n: a[0].text + ' to the power of ' + a[1].text }; }
  });
  T('SQRT', {
    tr: function (a) { return { s: a[0].c('gen') + ' karekökünü alır.', n: a[0].c('gen') + ' karekökü' }; },
    ru: function (a, h) { return { s: 'извлекает квадратный корень из ' + a[0].c('gen') + '.', n: h.RN('квадратный корень', ' из ' + a[0].c('gen')) }; },
    en: function (a) { return { s: 'takes the square root of ' + a[0].text + '.', n: 'the square root of ' + a[0].text }; }
  });
  function multipleTpl(spec) {
    return {
      tr: function (a) { var sig = a[1].present && !(a[1].isNum && a[1].num === 1) ? countOf(a[1], 'tr') + ' katına' : 'tam sayıya'; return { s: a[0].c('acc') + ' ' + spec.tr + ' en yakın ' + sig + ' yuvarlar.', n: a[0].c('gen') + ' ' + spec.tr + ' en yakın ' + sig + ' yuvarlanmış değeri' }; },
      ru: function (a, h) { var sig = a[1].present && !(a[1].isNum && a[1].num === 1) ? 'до ближайшего кратного ' + countOf(a[1], 'ru') : 'до целого'; return { s: 'округляет ' + a[0].c('acc') + ' ' + spec.ru + ' ' + sig + '.', n: h.RN('округлённое значение', ' ' + a[0].c('gen')) }; },
      en: function (a) { var sig = a[1].present && !(a[1].isNum && a[1].num === 1) ? 'to the nearest multiple of ' + countOf(a[1], 'en') : 'to the nearest whole number'; return { s: 'rounds ' + a[0].text + ' ' + spec.en + ' ' + sig + '.', n: a[0].text + ' rounded ' + spec.en + ' ' + sig }; }
    };
  }
  T('CEILING.MATH CEILING CEILING.PRECISE', multipleTpl({ tr: 'yukarı doğru', ru: 'вверх', en: 'up' }));
  T('FLOOR.MATH FLOOR FLOOR.PRECISE', multipleTpl({ tr: 'aşağı doğru', ru: 'вниз', en: 'down' }));
  T('MROUND', {
    tr: function (a) { return { s: a[0].c('acc') + ' en yakın ' + countOf(a[1], 'tr') + ' katına yuvarlar.', n: a[0].c('gen') + ' en yakın ' + countOf(a[1], 'tr') + ' katına yuvarlanmış değeri' }; },
    ru: function (a, h) { return { s: 'округляет ' + a[0].c('acc') + ' до ближайшего кратного ' + countOf(a[1], 'ru') + '.', n: h.RN('округлённое значение', ' ' + a[0].c('gen')) }; },
    en: function (a) { return { s: 'rounds ' + a[0].text + ' to the nearest multiple of ' + countOf(a[1], 'en') + '.', n: a[0].text + ' rounded to the nearest multiple of ' + countOf(a[1], 'en') }; }
  });
  T('SIGN', {
    tr: function (a) { return { s: a[0].c('gen') + ' işaretini verir: pozitifse 1, negatifse -1, sıfırsa 0.', n: a[0].c('gen') + ' işareti' }; },
    ru: function (a, h) { return { s: 'возвращает знак ' + a[0].c('gen') + ': 1 для положительного, -1 для отрицательного, 0 для нуля.', n: h.RN('число', ' (знак ' + a[0].c('gen') + ')') }; },
    en: function (a) { return { s: 'returns the sign of ' + a[0].text + ': 1 for positive, -1 for negative, 0 for zero.', n: 'the sign of ' + a[0].text }; }
  });
  T('RAND', {
    tr: function () { return { s: 'her yeniden hesaplamada 0 ile 1 arasında yeni bir rastgele sayı üretir.', n: { text: '0–1 arası rastgele sayı', poss: false } }; },
    ru: function (a, h) { return { s: 'возвращает случайное число от 0 до 1 (меняется при каждом пересчёте).', n: h.RN('число', ' (случайное от 0 до 1)') }; },
    en: function () { return { s: 'returns a random number between 0 and 1 (it changes on every recalculation).', n: 'a random number between 0 and 1' }; }
  });
  T('RANDBETWEEN', {
    tr: function (a) { return { s: a[0].text + ' ile ' + a[1].text + ' arasında rastgele bir tam sayı üretir.', n: { text: a[0].text + '–' + a[1].text + ' arası rastgele tam sayı', poss: false } }; },
    ru: function (a, h) { return { s: 'возвращает случайное целое число от ' + a[0].text + ' до ' + a[1].text + '.', n: h.RN('число', ' (случайное целое от ' + a[0].text + ' до ' + a[1].text + ')') }; },
    en: function (a) { return { s: 'returns a random whole number between ' + a[0].text + ' and ' + a[1].text + '.', n: 'a random whole number between ' + a[0].text + ' and ' + a[1].text }; }
  });
  T('PI', {
    tr: function () { return { s: 'π sayısını (3,14159…) verir.', n: { text: 'π sayısı', poss: true } }; },
    ru: function (a, h) { return { s: 'возвращает число π (3,14159…).', n: h.RN('число', ' π') }; },
    en: function () { return { s: 'returns the number π (3.14159…).', n: 'the number π' }; }
  });
  T('EXP', {
    tr: function (a) { return { s: 'e sayısının ' + a[0].text + '. kuvvetini (e üzeri ' + a[0].text + ') verir.', n: { text: 'e üzeri ' + a[0].text, poss: false } }; },
    ru: function (a, h) { return { s: 'возвращает число e в степени ' + a[0].text + '.', n: h.RN('результат', ' возведения e в степень ' + a[0].text) }; },
    en: function (a) { return { s: 'returns e raised to the power of ' + a[0].text + '.', n: 'e to the power of ' + a[0].text }; }
  });
  T('LN', {
    tr: function (a) { return { s: a[0].c('gen') + ' doğal logaritmasını verir.', n: a[0].c('gen') + ' doğal logaritması' }; },
    ru: function (a, h) { return { s: 'возвращает натуральный логарифм ' + a[0].c('gen') + '.', n: h.RN('число', ' (натуральный логарифм ' + a[0].c('gen') + ')') }; },
    en: function (a) { return { s: 'returns the natural logarithm of ' + a[0].text + '.', n: 'the natural logarithm of ' + a[0].text }; }
  });
  T('LOG LOG10', {
    tr: function (a) { var b = a[1].present ? a[1].text : '10'; return { s: a[0].c('gen') + ' ' + b + ' tabanındaki logaritmasını verir.', n: a[0].c('gen') + ' ' + b + ' tabanlı logaritması' }; },
    ru: function (a, h) { var b = a[1].present ? a[1].text : '10'; return { s: 'возвращает логарифм ' + a[0].c('gen') + ' по основанию ' + b + '.', n: h.RN('число', ' (логарифм ' + a[0].c('gen') + ' по основанию ' + b + ')') }; },
    en: function (a) { var b = a[1].present ? a[1].text : '10'; return { s: 'returns the base-' + b + ' logarithm of ' + a[0].text + '.', n: 'the base-' + b + ' logarithm of ' + a[0].text }; }
  });

  /* ------------------------------------------------------------------ */
  /* Templates: date & time                                              */
  /* ------------------------------------------------------------------ */
  T('TODAY', {
    tr: function () { return { s: 'bugünün tarihini verir (her gün kendiliğinden güncellenir).', n: 'bugünün tarihi' }; },
    ru: function (a, h) { return { s: 'возвращает сегодняшнюю дату (обновляется автоматически при пересчёте).', n: h.RN('сегодняшняя дата') }; },
    en: function () { return { s: 'returns today’s date (it updates automatically).', n: 'today’s date' }; }
  });
  T('NOW', {
    tr: function () { return { s: 'şu anki tarih ve saati verir (her hesaplamada güncellenir).', n: { text: 'şu anki tarih ve saat', poss: false } }; },
    ru: function (a, h) { return { s: 'возвращает текущие дату и время (обновляются при каждом пересчёте).', n: h.RN('текущие дата и время') }; },
    en: function () { return { s: 'returns the current date and time (it updates on every recalculation).', n: 'the current date and time' }; }
  });
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  T('DATE', {
    tr: function (a) {
      if (a[0].isNum && a[1].isNum && a[2].isNum) { var d = pad2(a[2].num) + '.' + pad2(a[1].num) + '.' + a[0].num; return { s: d + ' tarihini oluşturur.', n: d + ' tarihi' }; }
      return { s: 'şu parçalardan bir tarih oluşturur: yıl = ' + a[0].text + ', ay = ' + a[1].text + ', gün = ' + a[2].text + ' (ay 12’yi aşarsa sonraki yıla taşar).', n: { text: 'yıl = ' + a[0].text + ', ay = ' + a[1].text + ', gün = ' + a[2].text + ' ile oluşturulan tarih', poss: false } };
    },
    ru: function (a, h) {
      if (a[0].isNum && a[1].isNum && a[2].isNum) { var d = pad2(a[2].num) + '.' + pad2(a[1].num) + '.' + a[0].num; return { s: 'формирует дату ' + d + '.', n: h.RN('дата', ' ' + d) }; }
      return { s: 'собирает дату из частей: год — ' + a[0].text + ', месяц — ' + a[1].text + ', день — ' + a[2].text + ' (месяц больше 12 переносится на следующий год).', n: h.RN('собранная дата', ' (год — ' + a[0].text + ', месяц — ' + a[1].text + ', день — ' + a[2].text + ')') };
    },
    en: function (a) {
      if (a[0].isNum && a[1].isNum && a[2].isNum) { var d = a[0].num + '-' + pad2(a[1].num) + '-' + pad2(a[2].num); return { s: 'builds the date ' + d + '.', n: 'the date ' + d }; }
      return { s: 'builds a date from these parts: year = ' + a[0].text + ', month = ' + a[1].text + ', day = ' + a[2].text + ' (a month above 12 rolls over into the next year).', n: 'the date built from year = ' + a[0].text + ', month = ' + a[1].text + ', day = ' + a[2].text };
    }
  });
  T('TIME', {
    tr: function (a) { return { s: 'saat ' + a[0].text + ', dakika ' + a[1].text + ' ve saniye ' + a[2].text + ' değerlerinden bir saat oluşturur.', n: { text: a[0].text + ':' + a[1].text + ':' + a[2].text + ' saati', poss: true } }; },
    ru: function (a, h) { return { s: 'собирает время из ' + a[0].text + ' ч, ' + a[1].text + ' мин и ' + a[2].text + ' с.', n: h.RN('дата и время', ' (' + a[0].text + ':' + a[1].text + ':' + a[2].text + ')') }; },
    en: function (a) { return { s: 'builds a time from ' + a[0].text + ' h, ' + a[1].text + ' min and ' + a[2].text + ' s.', n: 'the time ' + a[0].text + ':' + a[1].text + ':' + a[2].text }; }
  });
  var DATEDIF_UNITS = {
    Y: { tr: 'tam yıl sayısı', ru: 'полных годах', en: 'whole years' },
    M: { tr: 'tam ay sayısı', ru: 'полных месяцах', en: 'whole months' },
    D: { tr: 'gün sayısı', ru: 'днях', en: 'days' },
    MD: { tr: 'ay ve yıllar yok sayıldığında kalan gün sayısı', ru: 'днях без учёта месяцев и лет', en: 'days, ignoring months and years' },
    YM: { tr: 'yıllar yok sayıldığında kalan ay sayısı', ru: 'месяцах без учёта лет', en: 'months, ignoring years' },
    YD: { tr: 'yıllar yok sayıldığında kalan gün sayısı', ru: 'днях без учёта лет', en: 'days, ignoring years' }
  };
  T('DATEDIF', {
    tr: function (a) { var u = a[2].isStr ? a[2].str.toUpperCase() : null, un = u && DATEDIF_UNITS[u]; var noun = un ? un.tr : (u ? '"' + u + '" birimindeki fark' : a[2].text + ' birimindeki fark'); return { s: a[0].text + ' ile ' + a[1].text + ' arasındaki ' + trCase(noun, 'acc', true) + ' verir' + (un ? ' ("' + u + '" birim kodu: ' + un.tr + ')' : '') + '.', n: a[0].text + ' ile ' + a[1].text + ' arasındaki ' + noun }; },
    ru: function (a, h) { var u = a[2].isStr ? a[2].str.toUpperCase() : null, un = u && DATEDIF_UNITS[u]; var unit = un ? un.ru : 'единицах «' + (u || a[2].text) + '»'; return { s: 'вычисляет разницу между ' + a[0].c('ins') + ' и ' + a[1].c('ins') + ' в ' + unit + (un ? ' (код единицы «' + u + '»)' : '') + '.', n: h.RN('разница', ' между ' + a[0].c('ins') + ' и ' + a[1].c('ins') + ' в ' + unit) }; },
    en: function (a) { var u = a[2].isStr ? a[2].str.toUpperCase() : null, un = u && DATEDIF_UNITS[u]; var unit = un ? un.en : 'units of “' + (u || a[2].text) + '”'; return { s: 'calculates the difference between ' + a[0].text + ' and ' + a[1].text + ' in ' + unit + (un ? ' (unit code “' + u + '”)' : '') + '.', n: 'the difference between ' + a[0].text + ' and ' + a[1].text + ' in ' + unit }; }
  });
  function datePartTpl(spec) {
    return {
      tr: function (a) { return { s: a[0].c('gen') + ' ' + spec.tr.acc + ' verir' + (spec.tr.note || '') + '.', n: a[0].c('gen') + ' ' + spec.tr.nom }; },
      ru: function (a, h) { return { s: 'возвращает ' + spec.ru.acc + ' ' + a[0].c('gen') + (spec.ru.note || '') + '.', n: h.RN(spec.ru.head, ' ' + a[0].c('gen')) }; },
      en: function (a) { return { s: 'returns ' + spec.en + ' of ' + a[0].text + '.', n: spec.en + ' of ' + a[0].text }; }
    };
  }
  T('YEAR', datePartTpl({ tr: { nom: 'yılı', acc: 'yılını' }, ru: { head: 'год', acc: 'год' }, en: 'the year' }));
  T('MONTH', datePartTpl({ tr: { nom: 'ay numarası', acc: 'ay numarasını', note: ' (1–12)' }, ru: { head: 'месяц', acc: 'номер месяца', note: ' (1–12)' }, en: 'the month number (1–12)' }));
  T('DAY', datePartTpl({ tr: { nom: 'ayın günü', acc: 'ayın kaçıncı günü olduğunu', note: ' (1–31)' }, ru: { head: 'день', acc: 'день месяца', note: ' (1–31)' }, en: 'the day of the month (1–31)' }));
  T('HOUR', datePartTpl({ tr: { nom: 'saati', acc: 'saatini', note: ' (0–23)' }, ru: { head: 'число', acc: 'час', note: ' (0–23)' }, en: 'the hour (0–23)' }));
  T('MINUTE', datePartTpl({ tr: { nom: 'dakikası', acc: 'dakikasını', note: ' (0–59)' }, ru: { head: 'число', acc: 'минуты', note: ' (0–59)' }, en: 'the minutes (0–59)' }));
  T('SECOND', datePartTpl({ tr: { nom: 'saniyesi', acc: 'saniyesini', note: ' (0–59)' }, ru: { head: 'число', acc: 'секунды', note: ' (0–59)' }, en: 'the seconds (0–59)' }));
  var WEEKDAY_TYPES = {
    1: { tr: '1 = Pazar … 7 = Cumartesi', ru: '1 = воскресенье … 7 = суббота', en: '1 = Sunday … 7 = Saturday' },
    2: { tr: '1 = Pazartesi … 7 = Pazar', ru: '1 = понедельник … 7 = воскресенье', en: '1 = Monday … 7 = Sunday' },
    3: { tr: '0 = Pazartesi … 6 = Pazar', ru: '0 = понедельник … 6 = воскресенье', en: '0 = Monday … 6 = Sunday' },
    11: { tr: '1 = Pazartesi … 7 = Pazar', ru: '1 = понедельник … 7 = воскресенье', en: '1 = Monday … 7 = Sunday' }
  };
  function weekdayType(arg, lang) {
    var t = arg.present ? (arg.isNum ? arg.num : null) : 1;
    if (t !== null && WEEKDAY_TYPES[t]) return WEEKDAY_TYPES[t][lang];
    return { tr: arg.text + ' ile seçilen numaralandırma', ru: 'нумерация задаётся аргументом ' + arg.text, en: 'numbering chosen by ' + arg.text }[lang];
  }
  T('WEEKDAY', {
    tr: function (a) { return { s: a[0].c('gen') + ' haftanın hangi günü olduğunu sayı olarak verir (' + weekdayType(a[1], 'tr') + ').', n: a[0].c('gen') + ' haftanın günü numarası' }; },
    ru: function (a, h) { return { s: 'возвращает номер дня недели для ' + a[0].c('gen') + ' (' + weekdayType(a[1], 'ru') + ').', n: h.RN('день недели', ' ' + a[0].c('gen') + ' (номер)') }; },
    en: function (a) { return { s: 'returns the day of the week of ' + a[0].text + ' as a number (' + weekdayType(a[1], 'en') + ').', n: 'the weekday number of ' + a[0].text }; }
  });
  T('WEEKNUM ISOWEEKNUM', {
    tr: function (a) { return { s: a[0].c('gen') + ' yılın kaçıncı haftasına denk geldiğini verir.', n: a[0].c('gen') + ' hafta numarası' }; },
    ru: function (a, h) { return { s: 'возвращает номер недели в году для ' + a[0].c('gen') + '.', n: h.RN('номер недели', ' ' + a[0].c('gen')) }; },
    en: function (a) { return { s: 'returns the week number of the year for ' + a[0].text + '.', n: 'the week number of ' + a[0].text }; }
  });
  function monthShift(arg, lang) { // returns { n: number|null, text }
    if (!arg.present) return { n: 0 };
    if (arg.isNum) return { n: arg.num };
    return { n: null, text: arg.text };
  }
  T('EOMONTH', {
    tr: function (a) {
      var m = monthShift(a[1], 'tr'), g = a[0].c('gen');
      var which = m.n === 0 ? g + ' bulunduğu ayın' : m.n === -1 ? g + ' bir önceki ayının' : m.n === 1 ? g + ' bir sonraki ayının' : m.n !== null && m.n > 0 ? g + ' ' + fmtNum(m.n, 'tr') + ' ay sonrasındaki ayın' : m.n !== null ? g + ' ' + fmtNum(-m.n, 'tr') + ' ay öncesindeki ayın' : g + ' ' + m.text + ' ay sonrasındaki (negatifse öncesindeki) ayın';
      return { s: which + ' son gününü verir.', n: which + ' son günü' };
    },
    ru: function (a, h) {
      var m = monthShift(a[1], 'ru'), g = a[0].c('gen');
      var rest = m.n === 0 ? ' месяца, в котором находится ' + a[0].text : m.n === -1 ? ' предыдущего месяца относительно ' + g : m.n === 1 ? ' следующего месяца после ' + g : m.n !== null && m.n > 0 ? ' месяца через ' + h.ruWordCount(m.n, ['месяц', 'месяца', 'месяцев']) + ' после ' + g : m.n !== null ? ' месяца за ' + h.ruWordCount(-m.n, ['месяц', 'месяца', 'месяцев']) + ' до ' + g : ' месяца, отстоящего на ' + m.text + ' месяцев от ' + g;
      return { s: 'возвращает последний день' + rest + '.', n: h.RN('последний день', rest) };
    },
    en: function (a) {
      var m = monthShift(a[1], 'en'), t = a[0].text;
      var rest = m.n === 0 ? 'the month of ' + t : m.n === -1 ? 'the month before ' + t : m.n === 1 ? 'the month after ' + t : m.n !== null && m.n > 0 ? 'the month ' + m.n + ' months after ' + t : m.n !== null ? 'the month ' + (-m.n) + ' months before ' + t : 'the month ' + m.text + ' months from ' + t;
      return { s: 'returns the last day of ' + rest + '.', n: 'the last day of ' + rest };
    }
  });
  function yearsFromMonths(arg) { // EDATE(d, 12*N) → N years
    var n = arg.present ? unwrapParen(arg.node) : null;
    if (n && n.t === 'op' && n.op === '*') {
      var l = unwrapParen(n.left), r = unwrapParen(n.right);
      if (l.t === 'num' && l.v === 12 && r.t === 'num') return r.v;
      if (r.t === 'num' && r.v === 12 && l.t === 'num') return l.v;
    }
    return null;
  }
  T('EDATE', {
    tr: function (a) {
      var y = yearsFromMonths(a[1]), m = monthShift(a[1], 'tr'), g = a[0].c('gen');
      var tail = y !== null ? fmtNum(Math.abs(y), 'tr') + ' yıl ' + (y >= 0 ? 'sonrası' : 'öncesi') : m.n !== null ? fmtNum(Math.abs(m.n), 'tr') + ' ay ' + (m.n >= 0 ? 'sonrası' : 'öncesi') : m.text + ' ay sonrası (negatifse öncesi)';
      return { s: g + ' ' + trCase(tail, 'acc', true) + ' verir (gün aynı kalır).', n: g + ' ' + tail };
    },
    ru: function (a, h) {
      var y = yearsFromMonths(a[1]), m = monthShift(a[1], 'ru'), g = a[0].c('gen');
      var tail = y !== null ? (y >= 0 ? 'через ' : 'за ') + h.ruWordCount(Math.abs(y), ['год', 'года', 'лет']) + (y >= 0 ? ' после ' : ' до ') + g : m.n !== null ? (m.n >= 0 ? 'через ' : 'за ') + h.ruWordCount(Math.abs(m.n), ['месяц', 'месяца', 'месяцев']) + (m.n >= 0 ? ' после ' : ' до ') + g : 'через ' + m.text + ' месяцев после ' + g;
      return { s: 'возвращает дату ' + tail + ' (число месяца сохраняется).', n: h.RN('дата', ' ' + tail) };
    },
    en: function (a) {
      var y = yearsFromMonths(a[1]), m = monthShift(a[1], 'en'), t = a[0].text;
      var tail = y !== null ? Math.abs(y) + (Math.abs(y) === 1 ? ' year ' : ' years ') + (y >= 0 ? 'after ' : 'before ') + t : m.n !== null ? Math.abs(m.n) + (Math.abs(m.n) === 1 ? ' month ' : ' months ') + (m.n >= 0 ? 'after ' : 'before ') + t : m.text + ' months after ' + t;
      return { s: 'returns the date ' + tail + ' (the day of the month stays the same).', n: 'the date ' + tail };
    }
  });
  T('DAYS', {
    tr: function (a) { return { s: a[1].text + ' ile ' + a[0].text + ' arasındaki gün sayısını verir (' + a[0].short + ' − ' + a[1].short + ').', n: a[1].text + ' ile ' + a[0].text + ' arasındaki gün sayısı' }; },
    ru: function (a, h) { return { s: 'возвращает число дней между ' + a[1].c('ins') + ' и ' + a[0].c('ins') + '.', n: h.RN('число дней', ' между ' + a[1].c('ins') + ' и ' + a[0].c('ins')) }; },
    en: function (a) { return { s: 'returns the number of days between ' + a[1].text + ' and ' + a[0].text + '.', n: 'the number of days between ' + a[1].text + ' and ' + a[0].text }; }
  });
  T('NETWORKDAYS NETWORKDAYS.INTL', {
    tr: function (a) { var hol = a[2].present && !a[2].isNum && !a[2].isStr ? ' ve ' + a[2].c('loc') + ' listelenen tatiller' : ''; return { s: a[0].text + ' ile ' + a[1].text + ' arasındaki iş günü sayısını verir (hafta sonları' + hol + ' sayılmaz).', n: a[0].text + ' ile ' + a[1].text + ' arasındaki iş günü sayısı' }; },
    ru: function (a, h) { var hol = a[2].present && !a[2].isNum && !a[2].isStr ? ' и праздников из ' + a[2].c('gen') : ''; return { s: 'считает число рабочих дней между ' + a[0].c('ins') + ' и ' + a[1].c('ins') + ' (без выходных' + hol + ').', n: h.RN('число рабочих дней', ' между ' + a[0].c('ins') + ' и ' + a[1].c('ins')) }; },
    en: function (a) { var hol = a[2].present && !a[2].isNum && !a[2].isStr ? ' and the holidays listed in ' + a[2].text : ''; return { s: 'counts the working days between ' + a[0].text + ' and ' + a[1].text + ' (excluding weekends' + hol + ').', n: 'the number of working days between ' + a[0].text + ' and ' + a[1].text }; }
  });
  T('WORKDAY WORKDAY.INTL', {
    tr: function (a) { var neg = a[1].isNum && a[1].num < 0; var n = a[1].isNum ? fmtNum(Math.abs(a[1].num), 'tr') : a[1].text; var hol = a[2].present && !a[2].isNum && !a[2].isStr ? ' ve ' + a[2].c('loc') + ' listelenen tatiller' : ''; return { s: a[0].c('abl') + ' ' + n + ' iş günü ' + (neg ? 'önceki' : 'sonraki') + ' tarihi verir (hafta sonları' + hol + ' atlanır).', n: { text: a[0].c('abl') + ' ' + n + ' iş günü ' + (neg ? 'önceki' : 'sonraki') + ' tarih', poss: false } }; },
    ru: function (a, h) { var neg = a[1].isNum && a[1].num < 0; var n = a[1].isNum ? h.ruWordCount(Math.abs(a[1].num), ['рабочий день', 'рабочих дня', 'рабочих дней']) : a[1].text + ' рабочих дней'; var hol = a[2].present && !a[2].isNum && !a[2].isStr ? ' и праздники из ' + a[2].c('gen') : ''; return { s: 'возвращает дату ' + (neg ? 'за ' : 'через ') + n + (neg ? ' до ' : ' после ') + a[0].c('gen') + ' (выходные' + hol + ' пропускаются).', n: h.RN('дата', (neg ? ' за ' : ' через ') + n + (neg ? ' до ' : ' после ') + a[0].c('gen')) }; },
    en: function (a) { var neg = a[1].isNum && a[1].num < 0; var n = a[1].isNum ? fmtNum(Math.abs(a[1].num), 'en') : a[1].text; var hol = a[2].present && !a[2].isNum && !a[2].isStr ? ' and the holidays in ' + a[2].text : ''; return { s: 'returns the date ' + n + ' working days ' + (neg ? 'before ' : 'after ') + a[0].text + ' (skipping weekends' + hol + ').', n: 'the date ' + n + ' working days ' + (neg ? 'before ' : 'after ') + a[0].text }; }
  });
  T('DATEVALUE', {
    tr: function (a) { return { s: a[0].c('acc') + ' (metin olarak yazılmış tarihi) gerçek bir tarihe çevirir.', n: a[0].c('gen') + ' tarihe çevrilmiş hâli' }; },
    ru: function (a, h) { return { s: 'преобразует ' + a[0].c('acc') + ' (дату, записанную текстом) в настоящую дату.', n: h.RN('дата', ' из ' + a[0].c('gen')) }; },
    en: function (a) { return { s: 'converts ' + a[0].text + ' (a date written as text) into a real date.', n: 'the date value of ' + a[0].text }; }
  });

  /* ------------------------------------------------------------------ */
  /* Templates: statistics, dynamic arrays, reference info               */
  /* ------------------------------------------------------------------ */
  function rankTpl(avg) {
    return {
      tr: function (a) { var asc = a[2].present && !(a[2].isNum && a[2].num === 0); var ord = a[2].present && !a[2].isNum ? a[2].text + ' ile belirlenen sırada' : asc ? 'küçükten büyüğe: 1 = en küçük' : 'büyükten küçüğe: 1 = en büyük'; return { s: a[0].c('gen') + ' ' + a[1].c('loc') + ' kaçıncı sırada olduğunu verir (' + ord + (avg ? '; eşit değerler ortalama sıra alır' : '; eşit değerler aynı sırayı alır') + ').', n: a[0].c('gen') + ' ' + a[1].short + ' içindeki sırası' }; },
      ru: function (a, h) { var asc = a[2].present && !(a[2].isNum && a[2].num === 0); var ord = a[2].present && !a[2].isNum ? 'порядок задаётся ' + a[2].c('ins') : asc ? 'по возрастанию: 1 — наименьшее' : 'по убыванию: 1 — наибольшее'; return { s: 'определяет ранг ' + a[0].c('gen') + ' в ' + a[1].c('pre') + ' (' + ord + (avg ? '; при равенстве берётся средний ранг' : '; равные значения получают одинаковый ранг') + ').', n: h.RN('ранг', ' ' + a[0].c('gen') + ' в ' + a[1].c('pre')) }; },
      en: function (a) { var asc = a[2].present && !(a[2].isNum && a[2].num === 0); var ord = a[2].present && !a[2].isNum ? 'order given by ' + a[2].text : asc ? 'ascending: 1 = smallest' : 'descending: 1 = largest'; return { s: 'returns the rank of ' + a[0].text + ' within ' + a[1].text + ' (' + ord + (avg ? '; ties get the average rank' : '; ties get the same rank') + ').', n: 'the rank of ' + a[0].text + ' in ' + a[1].text }; }
    };
  }
  T('RANK.EQ RANK', rankTpl(false));
  T('RANK.AVG', rankTpl(true));
  function nthTpl(largest) {
    return {
      tr: function (a) { var k = a[1].isNum ? a[1].num : null; var w = largest ? 'en büyük' : 'en küçük'; var kk = k === 1 ? w : k !== null ? fmtNum(k, 'tr') + '. ' + w : a[1].text + '. ' + w; return { s: a[0].c('gen') + ' ' + kk + ' değerini verir.', n: a[0].c('gen') + ' ' + kk + ' değeri' }; },
      ru: function (a, h) { var k = a[1].isNum ? a[1].num : null; if (k === 1) return { s: 'находит ' + (largest ? 'наибольшее' : 'наименьшее') + ' значение ' + a[0].c('gen') + '.', n: h.RN(largest ? 'наибольшее значение' : 'наименьшее значение', ' ' + a[0].c('gen')) }; var kk = (k !== null ? fmtNum(k, 'ru') : a[1].text) + '-е ' + (largest ? 'наибольшее' : 'наименьшее'); return { s: 'находит ' + kk + ' значение в ' + a[0].c('pre') + '.', n: h.RN('значение', ', ' + kk + ' в ' + a[0].c('pre')) }; },
      en: function (a) { var k = a[1].isNum ? a[1].num : null; var w = largest ? 'largest' : 'smallest'; var kk = k === 1 ? w : k !== null ? enOrdinal(k) + ' ' + w : w + ' value number ' + a[1].text; return { s: 'finds the ' + kk + ' value in ' + a[0].text + '.', n: 'the ' + kk + ' value in ' + a[0].text }; }
    };
  }
  T('LARGE', nthTpl(true));
  T('SMALL', nthTpl(false));
  T('UNIQUE', {
    tr: function (a) { var once = a[2].isBool && a[2].bool ? ' (yalnızca bir kez geçen değerler alınır)' : ''; return { s: a[0].c('gen') + ' benzersiz (tekrarsız) değerlerinin listesini verir; sonuç alttaki hücrelere kendiliğinden yayılır' + once + '.', n: a[0].c('gen') + ' benzersiz değerleri' }; },
    ru: function (a, h) { var once = a[2].isBool && a[2].bool ? ' (берутся только значения, встречающиеся один раз)' : ''; return { s: 'возвращает список уникальных значений ' + a[0].c('gen') + '; результат автоматически заполняет ячейки ниже' + once + '.', n: h.RN('уникальные значения', ' ' + a[0].c('gen')) }; },
    en: function (a) { var once = a[2].isBool && a[2].bool ? ' (only values that occur exactly once)' : ''; return { s: 'returns the list of unique values in ' + a[0].text + '; the result spills into the cells below' + once + '.', n: 'the unique values in ' + a[0].text }; }
  });
  T('FILTER', {
    tr: function (a) { var c = a[1].cond(); var ie = a[2].present ? (a[2].isEmptyStr ? '; eşleşen satır yoksa hücreyi boş bırakır' : '; eşleşen satır yoksa ' + a[2].text + ' gösterir') : '; eşleşen satır yoksa #HESAP! hatası verir'; return { s: a[0].c('abl') + ' ' + c + ' olan satırları süzüp alt alta listeler' + ie + '.', n: { text: a[0].c('abl') + ' süzülen satırlar', poss: false, gender: 'p' } }; },
    ru: function (a, h) { var c = a[1].cond(); var ie = a[2].present ? (a[2].isEmptyStr ? '; если подходящих строк нет, оставляет ячейку пустой' : '; если подходящих строк нет, показывает ' + a[2].c('acc')) : '; если подходящих строк нет, возвращает ошибку #ВЫЧИСЛ!'; return { s: 'отбирает из ' + a[0].c('gen') + ' строки, где ' + c + ', и выводит их списком' + ie + '.', n: h.RN('отфильтрованные строки', ' из ' + a[0].c('gen')) }; },
    en: function (a) { var c = a[1].cond(); var ie = a[2].present ? (a[2].isEmptyStr ? '; if no row matches, the cell is left blank' : '; if no row matches, it shows ' + a[2].text) : '; if no row matches, it returns #CALC!'; return { s: 'returns the rows of ' + a[0].text + ' where ' + c + ', listed one below another' + ie + '.', n: 'the rows of ' + a[0].text + ' where ' + c }; }
  });
  T('SORT', {
    tr: function (a, h) { var desc = a[2].isNum && a[2].num === -1; var hdr = a[1].isNum ? h.colHeader(a[0], a[1].num) : null; var by = a[1].present ? (a[1].isNum ? a[1].num + '. sütuna' + (hdr ? ' (' + h.q(hdr) + ')' : '') : a[1].text + ' numaralı sütuna') + ' göre ' : ''; return { s: a[0].c('acc') + ' ' + by + (desc ? 'azalan' : 'artan') + ' sırada sıralar.', n: a[0].c('gen') + ' sıralanmış hâli' }; },
    ru: function (a, h) { var desc = a[2].isNum && a[2].num === -1; var hdr = a[1].isNum ? h.colHeader(a[0], a[1].num) : null; var by = a[1].present ? ' по ' + (a[1].isNum ? a[1].num + '-му столбцу' + (hdr ? ' (' + h.q(hdr) + ')' : '') : 'столбцу с номером ' + a[1].text) : ''; return { s: 'сортирует ' + a[0].c('acc') + by + (desc ? ' по убыванию' : ' по возрастанию') + '.', n: h.RN('отсортированный диапазон', ' ' + a[0].c('gen')) }; },
    en: function (a, h) { var desc = a[2].isNum && a[2].num === -1; var hdr = a[1].isNum ? h.colHeader(a[0], a[1].num) : null; var by = a[1].present ? ' by column ' + (a[1].isNum ? a[1].num + (hdr ? ' (' + h.q(hdr) + ')' : '') : a[1].text) : ''; return { s: 'sorts ' + a[0].text + by + (desc ? ' in descending order' : ' in ascending order') + '.', n: a[0].text + ' sorted' + by }; }
  });
  T('SORTBY', {
    tr: function (a) { var desc = a[2].isNum && a[2].num === -1; return { s: a[0].c('acc') + ' ' + a[1].c('dat') + ' göre ' + (desc ? 'azalan' : 'artan') + ' sırada sıralar.', n: a[0].c('gen') + ' ' + a[1].c('dat') + ' göre sıralanmış hâli' }; },
    ru: function (a, h) { var desc = a[2].isNum && a[2].num === -1; return { s: 'сортирует ' + a[0].c('acc') + ' по ' + a[1].c('dat') + (desc ? ' по убыванию' : ' по возрастанию') + '.', n: h.RN('отсортированный диапазон', ' ' + a[0].c('gen') + ' (по ' + a[1].c('dat') + ')') }; },
    en: function (a) { var desc = a[2].isNum && a[2].num === -1; return { s: 'sorts ' + a[0].text + ' by ' + a[1].text + (desc ? ' in descending order' : ' in ascending order') + '.', n: a[0].text + ' sorted by ' + a[1].text }; }
  });
  T('SEQUENCE', {
    tr: function (a) { var st = a[2].present ? countOf(a[2], 'tr') : '1', sp = a[3].present ? countOf(a[3], 'tr') : '1'; return { s: countOf(a[0], 'tr') + (a[1].present ? ' satır ve ' + countOf(a[1], 'tr') + ' sütundan' : ' satırdan') + ' oluşan ardışık sayı dizisi üretir (başlangıç ' + st + ', artış ' + sp + ').', n: 'ardışık sayı dizisi' }; },
    ru: function (a, h) { var st = a[2].present ? countOf(a[2], 'ru') : '1', sp = a[3].present ? countOf(a[3], 'ru') : '1'; return { s: 'создаёт последовательность чисел: ' + countOf(a[0], 'ru') + ' строк' + (a[1].present ? ' × ' + countOf(a[1], 'ru') + ' столбцов' : '') + ' (начало ' + st + ', шаг ' + sp + ').', n: h.RN('последовательность', ' чисел') }; },
    en: function (a) { var st = a[2].present ? countOf(a[2], 'en') : '1', sp = a[3].present ? countOf(a[3], 'en') : '1'; return { s: 'generates a sequence of numbers with ' + countOf(a[0], 'en') + ' rows' + (a[1].present ? ' and ' + countOf(a[1], 'en') + ' columns' : '') + ' (starting at ' + st + ', step ' + sp + ').', n: 'the number sequence' }; }
  });
  function takeDropTpl(take) {
    return {
      tr: function (a) { var neg = a[1].isNum && a[1].num < 0; var n = a[1].isNum ? fmtNum(Math.abs(a[1].num), 'tr') : a[1].text; var cols = a[2].present ? ' ve ' + (a[2].isNum && a[2].num < 0 ? 'son ' : 'ilk ') + (a[2].isNum ? fmtNum(Math.abs(a[2].num), 'tr') : a[2].text) + ' sütununu' : ''; var w = (neg ? 'son ' : 'ilk ') + n + ' satırını'; return { s: a[0].c('gen') + ' ' + w + cols + (take ? ' alır.' : ' atar, kalanını verir.'), n: a[0].c('gen') + (take ? ' ' + w.replace(/ını$/, 'ı') : ' kalan satırları') }; },
      ru: function (a, h) { var neg = a[1].isNum && a[1].num < 0; var n = a[1].isNum ? Math.abs(a[1].num) : a[1].text; var ph = h.ruCount(neg ? h.RU_LAST : h.RU_FIRST, n, h.RU_ROW, ''); var cols = a[2].present ? ' и ' + h.ruCount(a[2].isNum && a[2].num < 0 ? h.RU_LAST : h.RU_FIRST, a[2].isNum ? Math.abs(a[2].num) : a[2].text, { one: D('столбец', 'столбца', 'столбцу', 'столбец', 'столбцом', 'столбце'), few: D('столбца', 'столбцов', 'столбцам', 'столбца', 'столбцами', 'столбцах'), many: D('столбцов', 'столбцов', 'столбцам', 'столбцов', 'столбцами', 'столбцах') }, '').cases.acc : ''; var cases = {}; RU_CASES.forEach(function (k) { cases[k] = ph.cases[k] + ' ' + a[0].c('gen'); }); return { s: (take ? 'берёт ' : 'отбрасывает ') + ph.cases.acc + cols + ' ' + a[0].c('gen') + (take ? '.' : ' и возвращает остальное.'), n: take ? { text: cases.nom, cases: cases, gender: 'p' } : h.RN('диапазон', ' без ' + ph.cases.gen + ' ' + a[0].c('gen')) }; },
      en: function (a) { var neg = a[1].isNum && a[1].num < 0; var n = a[1].isNum ? fmtNum(Math.abs(a[1].num), 'en') : a[1].text; var cols = a[2].present ? ' and the ' + (a[2].isNum && a[2].num < 0 ? 'last ' : 'first ') + (a[2].isNum ? fmtNum(Math.abs(a[2].num), 'en') : a[2].text) + ' columns' : ''; var w = 'the ' + (neg ? 'last ' : 'first ') + n + ' rows'; return { s: (take ? 'takes ' : 'drops ') + w + cols + ' of ' + a[0].text + (take ? '.' : ' and returns the rest.'), n: take ? w + cols + ' of ' + a[0].text : a[0].text + ' without ' + w }; }
    };
  }
  T('TAKE', takeDropTpl(true));
  T('DROP', takeDropTpl(false));
  T('ROWS', {
    tr: function (a) { return { s: a[0].c('gen') + ' satır sayısını verir.', n: a[0].c('gen') + ' satır sayısı' }; },
    ru: function (a, h) { return { s: 'возвращает число строк в ' + a[0].c('pre') + '.', n: h.RN('число строк', ' в ' + a[0].c('pre')) }; },
    en: function (a) { return { s: 'returns the number of rows in ' + a[0].text + '.', n: 'the number of rows in ' + a[0].text }; }
  });
  T('COLUMNS', {
    tr: function (a) { return { s: a[0].c('gen') + ' sütun sayısını verir.', n: a[0].c('gen') + ' sütun sayısı' }; },
    ru: function (a, h) { return { s: 'возвращает число столбцов в ' + a[0].c('pre') + '.', n: h.RN('число столбцов', ' в ' + a[0].c('pre')) }; },
    en: function (a) { return { s: 'returns the number of columns in ' + a[0].text + '.', n: 'the number of columns in ' + a[0].text }; }
  });
  function rowColTpl(isRow) {
    return {
      tr: function (a) { var w = isRow ? 'satır' : 'sütun'; if (!a[0].present) return { s: 'formülün yazıldığı hücrenin ' + w + ' numarasını verir.', n: 'geçerli ' + w + ' numarası' }; return { s: a[0].c('gen') + ' ' + w + ' numarasını verir.', n: a[0].c('gen') + ' ' + w + ' numarası' }; },
      ru: function (a, h) { var head = isRow ? 'номер строки' : 'номер столбца'; if (!a[0].present) return { s: 'возвращает ' + head + ' ячейки, в которой стоит формула.', n: h.RN(head, ' текущей ячейки') }; return { s: 'возвращает ' + head + ' ' + a[0].c('gen') + '.', n: h.RN(head, ' ' + a[0].c('gen')) }; },
      en: function (a) { var w = isRow ? 'row' : 'column'; if (!a[0].present) return { s: 'returns the ' + w + ' number of the cell that holds the formula.', n: 'the current ' + w + ' number' }; return { s: 'returns the ' + w + ' number of ' + a[0].text + '.', n: 'the ' + w + ' number of ' + a[0].text }; }
    };
  }
  T('ROW', rowColTpl(true));
  T('COLUMN', rowColTpl(false));
  T('TRANSPOSE', {
    tr: function (a) { return { s: a[0].c('gen') + ' satırlarıyla sütunlarının yerini değiştirir.', n: a[0].c('gen') + ' devriği (satır/sütun yer değiştirmiş hâli)' }; },
    ru: function (a, h) { return { s: 'меняет местами строки и столбцы ' + a[0].c('gen') + '.', n: h.RN('диапазон', ' ' + a[0].text + ' с переставленными строками и столбцами') }; },
    en: function (a) { return { s: 'swaps the rows and columns of ' + a[0].text + '.', n: a[0].text + ' transposed' }; }
  });

  /* ------------------------------------------------------------------ */
  /* Templates: information                                              */
  /* ------------------------------------------------------------------ */
  function isTpl(spec) {
    return {
      tr: function (a) { var S = subjOf(a[0].d || { p: a[0].p }).text; var c = S + ' ' + spec.tr.pred; return { s: a[0].c('gen') + ' ' + spec.tr.q + ' kontrol eder; öyleyse DOĞRU, değilse YANLIŞ verir.', n: { text: c + ' olup olmadığı', gender: 'n' }, c: c }; },
      ru: function (a, h) { var sj = subjOf(a[0].d || { p: a[0].p }); var c = sj.text + ' ' + (typeof spec.ru.pred === 'function' ? spec.ru.pred(sj.gender) : spec.ru.pred); return { s: 'проверяет, ' + spec.ru.q(a[0]) + '; если да, возвращает ИСТИНА, иначе — ЛОЖЬ.', n: h.RN('результат', ' проверки (' + c + ')'), c: c }; },
      en: function (a) { var S = subjOf(a[0].d || { p: a[0].p }).text; var c = S + ' ' + spec.en.pred; return { s: 'checks whether ' + a[0].text + ' ' + spec.en.pred + '; if so it returns TRUE, otherwise FALSE.', n: 'whether ' + c, c: c }; }
    };
  }
  T('ISBLANK', isTpl({ tr: { pred: 'boş', q: 'boş olup olmadığını' }, ru: { pred: function (g) { return ruAgree(g, RU_EMPTY); }, q: function (x) { var sj = subjOf(x.d || { p: x.p }); return ruAgree(sj.gender, RU_EMPTY) + ' ли ' + sj.text; } }, en: { pred: 'is empty' } }));
  T('ISNUMBER', isTpl({ tr: { pred: 'bir sayı', q: 'sayı olup olmadığını' }, ru: { pred: 'является числом', q: function (x) { return 'является ли ' + x.text + ' числом'; } }, en: { pred: 'is a number' } }));
  T('ISTEXT', isTpl({ tr: { pred: 'metin', q: 'metin olup olmadığını' }, ru: { pred: 'является текстом', q: function (x) { return 'является ли ' + x.text + ' текстом'; } }, en: { pred: 'is text' } }));
  T('ISNONTEXT', isTpl({ tr: { pred: 'metin değil', q: 'metin dışında bir şey olup olmadığını' }, ru: { pred: 'не является текстом', q: function (x) { return 'не является ли ' + x.text + ' текстом'; } }, en: { pred: 'is not text' } }));
  T('ISLOGICAL', isTpl({ tr: { pred: 'mantıksal bir değer (DOĞRU/YANLIŞ)', q: 'mantıksal değer olup olmadığını' }, ru: { pred: 'является логическим значением', q: function (x) { return 'является ли ' + x.text + ' логическим значением'; } }, en: { pred: 'is a logical value' } }));
  T('ISERROR', isTpl({ tr: { pred: 'hata veriyor', q: 'hata verip vermediğini' }, ru: { pred: 'возвращает ошибку', q: function (x) { return 'не является ли ' + x.text + ' ошибкой (любого вида)'; } }, en: { pred: 'is an error' } }));
  T('ISERR', isTpl({ tr: { pred: '#YOK dışında bir hata veriyor', q: '#YOK dışında bir hata olup olmadığını' }, ru: { pred: 'возвращает ошибку (кроме #Н/Д)', q: function (x) { return 'не является ли ' + x.text + ' ошибкой, отличной от #Н/Д'; } }, en: { pred: 'is an error other than #N/A' } }));
  T('ISNA', isTpl({ tr: { pred: '#YOK hatası veriyor', q: '#YOK (bulunamadı) hatası olup olmadığını' }, ru: { pred: 'возвращает ошибку #Н/Д', q: function (x) { return 'не является ли ' + x.text + ' ошибкой #Н/Д (не найдено)'; } }, en: { pred: 'is the #N/A error' } }));
  T('ISEVEN', isTpl({ tr: { pred: 'çift sayı', q: 'çift sayı olup olmadığını' }, ru: { pred: 'является чётным числом', q: function (x) { return 'является ли ' + x.text + ' чётным числом'; } }, en: { pred: 'is an even number' } }));
  T('ISODD', isTpl({ tr: { pred: 'tek sayı', q: 'tek sayı olup olmadığını' }, ru: { pred: 'является нечётным числом', q: function (x) { return 'является ли ' + x.text + ' нечётным числом'; } }, en: { pred: 'is an odd number' } }));
  T('ISFORMULA', isTpl({ tr: { pred: 'formül içeriyor', q: 'formül içerip içermediğini' }, ru: { pred: 'содержит формулу', q: function (x) { return 'содержит ли ' + x.text + ' формулу'; } }, en: { pred: 'contains a formula' } }));

  /* ------------------------------------------------------------------ */
  /* Templates: financial                                                */
  /* ------------------------------------------------------------------ */
  function finList(items, lang) {
    var sep = lang === 'ru' ? ' — ' : lang === 'tr' ? ': ' : ' = ';
    return items.filter(function (it) { return it[1]; }).map(function (it) { return it[0] + sep + it[1]; }).join(', ');
  }
  function perNum(arg, lang, forms) { // "5 periods" with correct number agreement
    if (!arg.present) return '';
    if (lang === 'ru') return arg.isNum ? ruWordCount(arg.num, forms.ru) : arg.text + ' ' + forms.ru[2];
    if (lang === 'tr') return arg.text + ' ' + forms.tr;
    return arg.isNum ? fmtNum(arg.num, 'en') + ' ' + (arg.num === 1 ? forms.en[0] : forms.en[1]) : arg.text + ' ' + forms.en[1];
  }
  T('PMT', {
    tr: function (a) { var t = a[4].isNum && a[4].num === 1 ? ' Ödemeler dönem başında yapılır.' : ''; return { s: 'kredi taksitini hesaplar (' + finList([['dönemlik faiz', a[0].text], ['dönem sayısı', a[1].text], ['anapara', a[2].text], ['gelecek değer', a[3].present ? a[3].text : '']], 'tr') + '). Anapara negatif girilirse sonuç pozitif çıkar.' + t, n: 'dönemlik taksit tutarı' }; },
    ru: function (a, h) { var t = a[4].isNum && a[4].num === 1 ? ' Платежи вносятся в начале периода.' : ''; return { s: 'рассчитывает регулярный платёж по кредиту (' + finList([['ставка за период', a[0].text], ['число периодов', a[1].text], ['сумма кредита', a[2].text], ['будущая стоимость', a[3].present ? a[3].text : '']], 'ru') + '). Если сумма указана со знаком минус, результат получится положительным.' + t, n: h.RN('платёж', ' за период') }; },
    en: function (a) { var t = a[4].isNum && a[4].num === 1 ? ' Payments are made at the start of each period.' : ''; return { s: 'calculates the fixed loan payment per period (' + finList([['rate per period', a[0].text], ['number of periods', a[1].text], ['principal', a[2].text], ['future value', a[3].present ? a[3].text : '']], 'en') + '). Enter the principal as a negative number to get a positive result.' + t, n: 'the periodic payment' }; }
  });
  T('IPMT PPMT', {
    tr: function (a) { return { s: 'kredi taksitinin ' + a[1].text + '. dönemdeki faiz (IPMT) ya da anapara (PPMT) payını hesaplar (' + finList([['dönemlik faiz', a[0].text], ['dönem sayısı', a[2].text], ['anapara', a[3].text]], 'tr') + ').', n: { text: a[1].text + '. dönemin taksit payı', poss: true } }; },
    ru: function (a, h) { return { s: 'рассчитывает часть платежа за период ' + a[1].text + ' — проценты (IPMT) или основной долг (PPMT) (' + finList([['ставка', a[0].text], ['число периодов', a[2].text], ['сумма кредита', a[3].text]], 'ru') + ').', n: h.RN('часть', ' платежа за период ' + a[1].text) }; },
    en: function (a) { return { s: 'calculates the part of the payment for period ' + a[1].text + ' — interest (IPMT) or principal (PPMT) (' + finList([['rate', a[0].text], ['number of periods', a[2].text], ['principal', a[3].text]], 'en') + ').', n: 'the payment part for period ' + a[1].text }; }
  });
  T('FV', {
    tr: function (a) { return { s: 'gelecekteki değeri hesaplar (' + finList([['dönemlik faiz', a[0].text], ['dönem sayısı', a[1].text], ['dönemlik ödeme', a[2].text], ['başlangıç tutarı', a[3].present ? a[3].text : '']], 'tr') + ').', n: { text: 'gelecekteki değer', poss: false } }; },
    ru: function (a, h) { return { s: 'рассчитывает будущую стоимость (' + finList([['ставка за период', a[0].text], ['число периодов', a[1].text], ['платёж', a[2].text], ['начальная сумма', a[3].present ? a[3].text : '']], 'ru') + ').', n: h.RN('будущая стоимость') }; },
    en: function (a) { return { s: 'calculates the future value (' + finList([['rate per period', a[0].text], ['number of periods', a[1].text], ['payment', a[2].text], ['starting amount', a[3].present ? a[3].text : '']], 'en') + ').', n: 'the future value' }; }
  });
  T('PV', {
    tr: function (a) { return { s: 'bugünkü değeri hesaplar (' + finList([['dönemlik faiz', a[0].text], ['dönem sayısı', a[1].text], ['dönemlik ödeme', a[2].text], ['gelecekteki değer', a[3].present ? a[3].text : '']], 'tr') + ').', n: { text: 'bugünkü değer', poss: false } }; },
    ru: function (a, h) { return { s: 'рассчитывает приведённую (текущую) стоимость (' + finList([['ставка за период', a[0].text], ['число периодов', a[1].text], ['платёж', a[2].text], ['будущая стоимость', a[3].present ? a[3].text : '']], 'ru') + ').', n: h.RN('приведённая стоимость') }; },
    en: function (a) { return { s: 'calculates the present value (' + finList([['rate per period', a[0].text], ['number of periods', a[1].text], ['payment', a[2].text], ['future value', a[3].present ? a[3].text : '']], 'en') + ').', n: 'the present value' }; }
  });
  T('NPV', {
    tr: function (a) { return { s: a[0].text + ' iskonto oranıyla ' + a.all.slice(1).map(function (x) { return trKi(x.c('loc'), ''); }).join(' ve ') + ' nakit akışlarının net bugünkü değerini hesaplar (ilk akış bir dönem sonra kabul edilir).', n: { text: 'net bugünkü değer', poss: false } }; },
    ru: function (a, h) { return { s: 'рассчитывает чистую приведённую стоимость денежных потоков ' + listCase(a.all.slice(1), 'gen', 'ru') + ' при ставке дисконтирования ' + a[0].text + ' (первый поток считается через один период).', n: h.RN('чистая приведённая стоимость') }; },
    en: function (a) { return { s: 'calculates the net present value of the cash flows in ' + listText(a.all.slice(1), 'en') + ' at a discount rate of ' + a[0].text + ' (the first cash flow is one period from now).', n: 'the net present value' }; }
  });
  T('IRR', {
    tr: function (a) { return { s: trKi(a[0].c('loc'), '') + ' nakit akışlarının iç verim oranını hesaplar (ilk değer genellikle negatif yatırım tutarıdır).', n: 'iç verim oranı' }; },
    ru: function (a, h) { return { s: 'рассчитывает внутреннюю норму доходности для денежных потоков ' + a[0].c('gen') + ' (первое значение обычно — вложение со знаком минус).', n: h.RN('внутренняя норма доходности') }; },
    en: function (a) { return { s: 'calculates the internal rate of return of the cash flows in ' + a[0].text + ' (the first value is usually the negative investment).', n: 'the internal rate of return' }; }
  });
  T('SLN', {
    tr: function (a) { return { s: 'maliyeti ' + a[0].text + ', hurda değeri ' + a[1].text + ' ve ömrü ' + perNum(a[2], 'tr', { tr: 'dönem' }) + ' olan bir varlığın dönem başına doğrusal amortismanını hesaplar.', n: { text: 'dönemlik doğrusal amortisman', poss: false } }; },
    ru: function (a, h) { return { s: 'рассчитывает линейную амортизацию за период для актива стоимостью ' + a[0].text + ', остаточной стоимостью ' + a[1].text + ' и сроком службы ' + perNum(a[2], 'ru', { ru: ['период', 'периода', 'периодов'] }) + '.', n: h.RN('амортизация', ' за период') }; },
    en: function (a) { return { s: 'calculates the straight-line depreciation per period for an asset costing ' + a[0].text + ' with a salvage value of ' + a[1].text + ' over ' + perNum(a[2], 'en', { en: ['period', 'periods'] }) + '.', n: 'the depreciation per period' }; }
  });
  T('NPER', {
    tr: function (a) { return { s: 'gereken dönem sayısını hesaplar (' + finList([['dönemlik faiz', a[0].text], ['dönemlik ödeme', a[1].text], ['anapara', a[2].text]], 'tr') + ').', n: 'gereken dönem sayısı' }; },
    ru: function (a, h) { return { s: 'рассчитывает число периодов (' + finList([['ставка за период', a[0].text], ['платёж', a[1].text], ['сумма', a[2].text]], 'ru') + ').', n: h.RN('количество', ' периодов') }; },
    en: function (a) { return { s: 'calculates the number of periods (' + finList([['rate per period', a[0].text], ['payment', a[1].text], ['principal', a[2].text]], 'en') + ').', n: 'the number of periods' }; }
  });
  T('RATE', {
    tr: function (a) { return { s: 'dönemlik faiz oranını hesaplar (' + finList([['dönem sayısı', a[0].text], ['dönemlik ödeme', a[1].text], ['anapara', a[2].text]], 'tr') + ').', n: 'dönemlik faiz oranı' }; },
    ru: function (a, h) { return { s: 'рассчитывает ставку за период (' + finList([['число периодов', a[0].text], ['платёж', a[1].text], ['сумма', a[2].text]], 'ru') + ').', n: h.RN('процент', ' (ставка за период)') }; },
    en: function (a) { return { s: 'calculates the interest rate per period (' + finList([['number of periods', a[0].text], ['payment', a[1].text], ['principal', a[2].text]], 'en') + ').', n: 'the interest rate per period' }; }
  });

  /* ------------------------------------------------------------------ */
  /* Idioms: well-known formula patterns explained as a whole            */
  /* ------------------------------------------------------------------ */
  function isFunc(n, name) { n = unwrapParen(n); return isNode(n) && n.t === 'func' && String(n.name).toUpperCase() === name; }
  function isNum(n, v) { n = unwrapParen(n); return isNode(n) && n.t === 'num' && (v === undefined || n.v === v); }
  function isStr(n, v) { n = unwrapParen(n); return isNode(n) && n.t === 'str' && (v === undefined || n.v === v); }
  function isOp(n, op) { n = unwrapParen(n); return isNode(n) && n.t === 'op' && (op === undefined || n.op === op); }
  function argN(n, i) { n = unwrapParen(n); return n && n.args ? n.args[i] : undefined; }
  function sameRef(a, b) {
    a = unwrapParen(a); b = unwrapParen(b);
    if (!isNode(a) || !isNode(b)) return false;
    if (a.t === 'ref' && b.t === 'ref') return String(a.ref).replace(/\$/g, '').toUpperCase() === String(b.ref).replace(/\$/g, '').toUpperCase() && (a.sheet || null) === (b.sheet || null);
    if (a.t === 'name' && b.t === 'name') return a.name === b.name;
    return false;
  }
  function numVal(n) { n = unwrapParen(n); if (!isNode(n)) return null; if (n.t === 'num') return n.v; if (n.t === 'percent' && isNum(n.arg)) return unwrapParen(n.arg).v / 100; if (n.t === 'unary' && n.op === '-' && isNum(n.arg)) return -unwrapParen(n.arg).v; return null; }
  function pctText(n, lang) { // 10%, 0.1, 10 → "10"
    var v = numVal(n); if (v === null) return null;
    var pct = Math.round(v * 10000) / 100;
    return fmtNum(pct, lang);
  }
  function trPercentOf(pctStr) { // "%20’sini" form (accusative of possessive)
    var b = trNumberBase(pctStr);
    var H4 = h4(b.lastVowel);
    return '%' + pctStr + '’' + (b.endsVowel ? 's' + H4 + 'n' + H4 : H4 + 'n' + H4);
  }
  function headerType(arg) {
    var p = arg && arg.p; if (!p || !p.refInfo || !p.ctxInfo) return null;
    var hd = findHeader(p.ctxInfo, p.refInfo.col); return hd ? hd.type : null;
  }
  function condOut(lang, phraseText, s, c, gender) {
    var p = lang === 'tr' ? P(lang, c + ' olup olmadığı', { gender: 'n' })
      : lang === 'ru' ? P(lang, RN('результат', ' проверки (' + c + ')'), { gender: 'm' }) : P(lang, 'whether ' + c);
    return { p: p, s: endSentence(s), cond: c };
  }
  var IDIOMS = [
    { id: 'between', match: function (n) {
        if (!isFunc(n, 'AND') || (n.args || []).length !== 2) return null;
        var a = unwrapParen(n.args[0]), b = unwrapParen(n.args[1]);
        if (!isComparison(a) || !isComparison(b) || !sameRef(a.left, b.left)) return null;
        var lo = null, hi = null, incl = true;
        [a, b].forEach(function (c) { if (c.op === '>=') lo = c.right; else if (c.op === '>') { lo = c.right; incl = false; } else if (c.op === '<=') hi = c.right; else if (c.op === '<') { hi = c.right; incl = false; } });
        return (lo && hi) ? { x: a.left, lo: lo, hi: hi, incl: incl } : null; },
      tr: function (m, h) { var x = h.describe(m.x), lo = h.describe(m.lo).p, hi = h.describe(m.hi).p; var c = subjOf(x).text + ' ' + lo.text + ' ile ' + hi.text + ' arasında' + (m.incl ? ' (sınırlar dahil)' : ' (sınırlar hariç)'); return condOut('tr', null, x.p.c('gen') + ' ' + lo.text + ' ile ' + hi.text + ' arasında olup olmadığını kontrol eder' + (m.incl ? ' (sınır değerler dahil)' : ' (sınır değerler hariç)') + '; öyleyse ' + h.bool(true) + ' verir.', c); },
      ru: function (m, h) { var x = h.describe(m.x), lo = h.describe(m.lo).p, hi = h.describe(m.hi).p; var c = subjOf(x).text + ' от ' + lo.c('gen') + ' до ' + hi.c('gen') + (m.incl ? ' (включительно)' : ' (не включая границы)'); return condOut('ru', null, 'проверяет, лежит ли ' + x.p.text + ' в пределах от ' + lo.c('gen') + ' до ' + hi.c('gen') + (m.incl ? ' (включительно)' : ' (не включая границы)') + '; если да — ' + h.bool(true) + '.', c); },
      en: function (m, h) { var x = h.describe(m.x), lo = h.describe(m.lo).p, hi = h.describe(m.hi).p; var c = subjOf(x).text + ' is between ' + lo.text + ' and ' + hi.text + (m.incl ? ' (inclusive)' : ' (exclusive)'); return condOut('en', null, 'checks whether ' + x.p.text + ' is between ' + lo.text + ' and ' + hi.text + (m.incl ? ' (inclusive)' : ' (exclusive)') + '; if so, ' + h.bool(true) + '.', c); } },
    { id: 'firstOfMonth', match: function (n) {
        if (!isFunc(n, 'DATE') || !isFunc(argN(n, 0), 'YEAR') || !isNum(argN(n, 2), 1)) return null;
        var d = argN(unwrapParen(argN(n, 0)), 0), mArg = unwrapParen(argN(n, 1)), k = 0, mon = null;
        if (isFunc(mArg, 'MONTH')) mon = mArg; else if (isOp(mArg, '+') && isFunc(mArg.left, 'MONTH') && numVal(mArg.right) !== null) { mon = unwrapParen(mArg.left); k = numVal(mArg.right); } else if (isOp(mArg, '-') && isFunc(mArg.left, 'MONTH') && numVal(mArg.right) !== null) { mon = unwrapParen(mArg.left); k = -numVal(mArg.right); }
        if (!mon || !sameRef(argN(mon, 0), d)) return null;
        return { d: d, k: k }; },
      tr: function (m, h) { var d = h.describe(m.d).p; var which = m.k === 0 ? d.c('gen') + ' bulunduğu ayın' : m.k === 1 ? d.c('gen') + ' bir sonraki ayının' : m.k === -1 ? d.c('gen') + ' bir önceki ayının' : m.k > 0 ? d.c('gen') + ' ' + fmtNum(m.k, 'tr') + ' ay sonrasındaki ayın' : d.c('gen') + ' ' + fmtNum(-m.k, 'tr') + ' ay öncesindeki ayın'; return { s: which + ' ilk gününü verir (yıl ve ay alınıp gün 1 yapılır).', n: which + ' ilk günü' }; },
      ru: function (m, h) { var d = h.describe(m.d).p; var rest = m.k === 0 ? ' месяца, в котором находится ' + d.text : m.k === 1 ? ' следующего месяца после ' + d.c('gen') : m.k === -1 ? ' предыдущего месяца относительно ' + d.c('gen') : m.k > 0 ? ' месяца через ' + h.ruWordCount(m.k, ['месяц', 'месяца', 'месяцев']) + ' после ' + d.c('gen') : ' месяца за ' + h.ruWordCount(-m.k, ['месяц', 'месяца', 'месяцев']) + ' до ' + d.c('gen'); return { s: 'возвращает первый день' + rest + ' (берутся год и месяц, день ставится равным 1).', n: h.RN('первый день', rest) }; },
      en: function (m, h) { var d = h.describe(m.d).p; var rest = m.k === 0 ? 'the month of ' + d.text : m.k === 1 ? 'the month after ' + d.text : m.k === -1 ? 'the month before ' + d.text : m.k > 0 ? 'the month ' + m.k + ' months after ' + d.text : 'the month ' + (-m.k) + ' months before ' + d.text; return { s: 'returns the first day of ' + rest + ' (year and month are kept, the day is set to 1).', n: 'the first day of ' + rest }; } },
    { id: 'startOfMonth', match: function (n) { return isOp(n, '+') && isFunc(n.left, 'EOMONTH') && numVal(argN(n.left, 1)) === -1 && isNum(n.right, 1) ? { d: argN(n.left, 0) } : null; },
      tr: function (m, h) { var d = h.describe(m.d).p; return { s: d.c('gen') + ' bulunduğu ayın ilk gününü verir (önceki ayın son günü + 1).', n: d.c('gen') + ' bulunduğu ayın ilk günü' }; },
      ru: function (m, h) { var d = h.describe(m.d).p; return { s: 'возвращает первый день месяца, в котором находится ' + d.text + ' (последний день предыдущего месяца + 1).', n: h.RN('первый день', ' месяца ' + d.c('gen')) }; },
      en: function (m, h) { var d = h.describe(m.d).p; return { s: 'returns the first day of the month of ' + d.text + ' (the last day of the previous month + 1).', n: 'the first day of the month of ' + d.text }; } },
    { id: 'quarter', match: function (n) { return isFunc(n, 'ROUNDUP') && isOp(argN(n, 0), '/') && isFunc(unwrapParen(argN(n, 0)).left, 'MONTH') && isNum(unwrapParen(argN(n, 0)).right, 3) ? { d: argN(unwrapParen(argN(n, 0)).left, 0) } : null; },
      tr: function (m, h) { var d = h.describe(m.d).p; return { s: d.c('gen') + ' hangi çeyrekte (1–4) olduğunu verir: ay numarası 3’e bölünüp yukarı yuvarlanır.', n: d.c('gen') + ' çeyreği' }; },
      ru: function (m, h) { var d = h.describe(m.d).p; return { s: 'определяет квартал (1–4) для ' + d.c('gen') + ': номер месяца делится на 3 и округляется вверх.', n: h.RN('квартал', ' ' + d.c('gen')) }; },
      en: function (m, h) { var d = h.describe(m.d).p; return { s: 'returns the quarter (1–4) of ' + d.text + ': the month number divided by 3 and rounded up.', n: 'the quarter of ' + d.text }; } },
    { id: 'weekend', match: function (n) { if (!isOp(n)) return null; var l = unwrapParen(n.left); if (!isFunc(l, 'WEEKDAY') || numVal(argN(l, 1)) !== 2) return null; var r = numVal(n.right); if ((n.op === '>' && r === 5) || (n.op === '>=' && r === 6)) return { d: argN(l, 0) }; return null; },
      tr: function (m, h) { var d = h.describe(m.d).p; var c = d.text + ' hafta sonuna denk geliyor'; return condOut('tr', null, d.c('gen') + ' hafta sonuna (Cumartesi/Pazar) denk gelip gelmediğini kontrol eder; öyleyse ' + h.bool(true) + ' verir.', c); },
      ru: function (m, h) { var d = h.describe(m.d).p; var c = d.text + ' приходится на выходной'; return condOut('ru', null, 'проверяет, приходится ли ' + d.text + ' на выходной (субботу или воскресенье); если да — ' + h.bool(true) + '.', c); },
      en: function (m, h) { var d = h.describe(m.d).p; var c = d.text + ' falls on a weekend'; return condOut('en', null, 'checks whether ' + d.text + ' falls on a weekend (Saturday or Sunday); if so, ' + h.bool(true) + '.', c); } },
    { id: 'firstWord', match: function (n) { if (!isFunc(n, 'LEFT')) return null; var x = argN(n, 0), m = unwrapParen(argN(n, 1)); if (!isOp(m, '-') || !isNum(m.right, 1) || !isFunc(m.left, 'FIND')) return null; if (!isStr(argN(m.left, 0), ' ')) return null; var t = unwrapParen(argN(m.left, 1)); if (sameRef(t, x) || (isOp(t, '&') && sameRef(t.left, x) && isStr(t.right, ' '))) return { x: x }; return null; },
      tr: function (m, h) { var x = h.describe(m.x).p; return { s: x.c('gen') + ' ilk kelimesini (ilk boşluğa kadar olan kısmı) alır.', n: x.c('gen') + ' ilk kelimesi' }; },
      ru: function (m, h) { var x = h.describe(m.x).p; return { s: 'берёт первое слово ' + x.c('gen') + ' (текст до первого пробела).', n: h.RN('первое слово', ' ' + x.c('gen')) }; },
      en: function (m, h) { var x = h.describe(m.x).p; return { s: 'takes the first word of ' + x.text + ' (the text before the first space).', n: 'the first word of ' + x.text }; } },
    { id: 'lastWord', match: function (n) { if (!isFunc(n, 'TRIM')) return null; var r = unwrapParen(argN(n, 0)); if (!isFunc(r, 'RIGHT')) return null; var s = unwrapParen(argN(r, 0)); if (!isFunc(s, 'SUBSTITUTE') || !isStr(argN(s, 1), ' ')) return null; var rp = unwrapParen(argN(s, 2)); if (!isFunc(rp, 'REPT') || !isStr(argN(rp, 0), ' ')) return null; return { x: argN(s, 0), N: numVal(argN(rp, 1)) }; },
      tr: function (m, h) { var x = h.describe(m.x).p; return { s: x.c('gen') + ' son kelimesini alır (boşluklar genişletilir, sondan ' + (m.N != null ? fmtNum(m.N, 'tr') : 'N') + ' karakter kesilir ve fazla boşluklar temizlenir).', n: x.c('gen') + ' son kelimesi' }; },
      ru: function (m, h) { var x = h.describe(m.x).p; return { s: 'берёт последнее слово ' + x.c('gen') + ' (пробелы расширяются, отрезаются последние ' + (m.N != null ? fmtNum(m.N, 'ru') : 'N') + ' символов, лишние пробелы убираются).', n: h.RN('последнее слово', ' ' + x.c('gen')) }; },
      en: function (m, h) { var x = h.describe(m.x).p; return { s: 'takes the last word of ' + x.text + ' (spaces are widened, the last ' + (m.N != null ? fmtNum(m.N, 'en') : 'N') + ' characters are cut off and extra spaces removed).', n: 'the last word of ' + x.text }; } },
    { id: 'contains', match: function (n) { if (!isFunc(n, 'ISNUMBER')) return null; var f = unwrapParen(argN(n, 0)); if (!isFunc(f, 'SEARCH') && !isFunc(f, 'FIND')) return null; return { s: argN(f, 0), x: argN(f, 1), cs: isFunc(f, 'FIND') }; },
      tr: function (m, h) { var s = h.describe(m.s).p, x = h.describe(m.x); var S = subjOf(x).text; var c = trCase(S, 'loc', true) + ' ' + s.text + ' geçiyor'; return condOut('tr', null, x.p.c('loc') + ' ' + s.text + ' metninin geçip geçmediğini kontrol eder (' + (m.cs ? 'büyük/küçük harfe duyarlı' : 'büyük/küçük harf ayrımı yapılmaz') + '); geçiyorsa ' + h.bool(true) + ' verir.', c); },
      ru: function (m, h) { var s = h.describe(m.s).p, x = h.describe(m.x); var c = subjOf(x).text + ' содержит ' + s.text; return condOut('ru', null, 'проверяет, содержит ли ' + x.p.text + ' ' + s.text + ' (' + (m.cs ? 'с учётом регистра' : 'без учёта регистра') + '); если да — ' + h.bool(true) + '.', c); },
      en: function (m, h) { var s = h.describe(m.s).p, x = h.describe(m.x); var c = subjOf(x).text + ' contains ' + s.text; return condOut('en', null, 'checks whether ' + x.p.text + ' contains ' + s.text + ' (' + (m.cs ? 'case-sensitive' : 'case-insensitive') + '); if so, ' + h.bool(true) + '.', c); } },
    { id: 'countUnique', match: function (n) { if (isFunc(n, 'ROWS') && isFunc(argN(n, 0), 'UNIQUE')) return { r: argN(unwrapParen(argN(n, 0)), 0), classic: false }; if (isFunc(n, 'SUMPRODUCT')) { var d = unwrapParen(argN(n, 0)); if (isOp(d, '/') && isNum(d.left, 1) && isFunc(d.right, 'COUNTIF') && sameRef(argN(d.right, 0), argN(d.right, 1))) return { r: argN(d.right, 0), classic: true }; } return null; },
      tr: function (m, h) { var r = h.describe(m.r).p; return { s: r.c('loc') + ' kaç farklı (benzersiz) değer olduğunu sayar' + (m.classic ? ' (klasik yöntem: her değer, tekrar sayısının tersi kadar sayılır)' : '') + '.', n: r.c('gen') + ' benzersiz değer sayısı' }; },
      ru: function (m, h) { var r = h.describe(m.r).p; return { s: 'считает, сколько разных (уникальных) значений в ' + r.c('pre') + (m.classic ? ' (классический приём: каждое значение считается как 1, делённая на число его повторов)' : '') + '.', n: h.RN('количество', ' уникальных значений в ' + r.c('pre')) }; },
      en: function (m, h) { var r = h.describe(m.r).p; return { s: 'counts how many distinct (unique) values there are in ' + r.text + (m.classic ? ' (classic trick: each value counts as 1 divided by its number of occurrences)' : '') + '.', n: 'the number of unique values in ' + r.text }; } },
    { id: 'duplicate', match: function (n) { if (!isOp(n, '>') || !isNum(n.right, 1) || !isFunc(n.left, 'COUNTIF')) return null; var cell = unwrapParen(argN(n.left, 1)); if (!isNode(cell) || cell.t !== 'ref') return null; return { r: argN(n.left, 0), cell: cell }; },
      tr: function (m, h) { var r = h.describe(m.r).p, c = h.describe(m.cell).p; var cl = c.text + ' ' + r.c('loc') + ' birden fazla kez geçiyor (tekrar eden)'; return condOut('tr', null, c.c('gen') + ' ' + r.c('loc') + ' birden fazla geçip geçmediğini, yani tekrar olup olmadığını kontrol eder.', cl); },
      ru: function (m, h) { var r = h.describe(m.r).p, c = h.describe(m.cell).p; var cl = c.text + ' встречается в ' + r.c('pre') + ' более одного раза (дубликат)'; return condOut('ru', null, 'проверяет, встречается ли ' + c.text + ' в ' + r.c('pre') + ' более одного раза, то есть является ли дубликатом.', cl); },
      en: function (m, h) { var r = h.describe(m.r).p, c = h.describe(m.cell).p; var cl = c.text + ' appears more than once in ' + r.text + ' (a duplicate)'; return condOut('en', null, 'checks whether ' + c.text + ' appears more than once in ' + r.text + ', i.e. whether it is a duplicate.', cl); } },
    { id: 'shareOfTotal', match: function (n) { if (!isOp(n, '/') || !isFunc(n.right, 'SUM')) return null; var l = unwrapParen(n.left), rg = unwrapParen(argN(n.right, 0)); if (!isNode(l) || l.t !== 'ref' || !isNode(rg) || rg.t !== 'ref') return null; var pl = parseRef(l.ref), pr = parseRef(rg.ref); if (pl.kind !== 'cell' || pr.col !== pl.col) return null; return { l: l, r: rg }; },
      tr: function (m, h) { var l = h.describe(m.l).p, r = h.describe(m.r).p; return { s: l.c('gen') + ' ' + r.c('gen') + ' toplamı içindeki payını (oranını) hesaplar; yüzde biçimi uygularsanız yüzde olarak görünür.', n: l.c('gen') + ' toplam içindeki payı' }; },
      ru: function (m, h) { var l = h.describe(m.l).p, r = h.describe(m.r).p; return { s: 'вычисляет долю ' + l.c('gen') + ' в общей сумме ' + r.c('gen') + '; примените процентный формат, чтобы увидеть проценты.', n: h.RN('доля', ' ' + l.c('gen') + ' в общей сумме') }; },
      en: function (m, h) { var l = h.describe(m.l).p, r = h.describe(m.r).p; return { s: 'calculates the share of ' + l.text + ' in the total of ' + r.text + '; apply a percentage format to see it as a percent.', n: 'the share of ' + l.text + ' in the total' }; } },
    { id: 'percentChange', match: function (n) { if (!isOp(n, '/')) return null; var l = unwrapParen(n.left); if (!isOp(l, '-')) return null; if (!sameRef(l.right, n.right)) return null; return { a: l.left, b: l.right }; },
      tr: function (m, h) { var a = h.describe(m.a).p, b = h.describe(m.b).p; return { s: b.c('abl') + ' ' + a.c('dat') + ' yüzde değişimi hesaplar: (yeni − eski) ÷ eski. Yüzde biçimi uygulayın.', n: { text: b.c('abl') + ' ' + a.c('dat') + ' değişim oranı', poss: true } }; },
      ru: function (m, h) { var a = h.describe(m.a).p, b = h.describe(m.b).p; return { s: 'вычисляет относительное изменение от ' + b.c('gen') + ' к ' + a.c('dat') + ': (новое − старое) ÷ старое; примените процентный формат.', n: h.RN('изменение', ' от ' + b.c('gen') + ' к ' + a.c('dat') + ' (в долях)') }; },
      en: function (m, h) { var a = h.describe(m.a).p, b = h.describe(m.b).p; return { s: 'calculates the percentage change from ' + b.text + ' to ' + a.text + ': (new − old) ÷ old; apply a percentage format.', n: 'the percentage change from ' + b.text + ' to ' + a.text }; } },
    { id: 'runningTotal', match: function (n) { if (!isFunc(n, 'SUM') || (n.args || []).length !== 1) return null; var r = unwrapParen(argN(n, 0)); if (!isNode(r) || r.t !== 'ref') return null; var mm = /^\$([A-Za-z]{1,3})\$(\d+):([A-Za-z]{1,3})(\d+)$/.exec(r.ref); if (!mm || mm[1].toUpperCase() !== mm[3].toUpperCase()) return null; return { r: r, start: mm[1].toUpperCase() + mm[2], end: mm[3].toUpperCase() + mm[4] }; },
      tr: function (m, h) { var r = h.describe(m.r).p; return { s: (r.header ? r.short + ' için' : m.start + ' hücresinden başlayarak') + ' kümülatif (birikimli) toplamı hesaplar: ' + m.start + ' hücresinden bu satıra (' + m.end + ') kadar olan değerleri toplar; formül aşağı kopyalandıkça aralık genişler.', n: { text: (r.header ? r.short + ' ' : '') + 'kümülatif toplam', poss: false } }; },
      ru: function (m, h) { var r = h.describe(m.r).p; return { s: 'считает нарастающий итог' + (r.header ? ' ' + r.short : '') + ': суммирует значения от ' + m.start + ' до текущей строки (' + m.end + '); при копировании вниз диапазон расширяется.', n: h.RN('нарастающий итог', r.header ? ' ' + r.short : '') }; },
      en: function (m, h) { var r = h.describe(m.r).p; return { s: 'calculates the running total' + (r.header ? ' of ' + r.short : '') + ': it adds the values from ' + m.start + ' down to the current row (' + m.end + '); the range grows as you copy the formula down.', n: 'the running total' + (r.header ? ' of ' + r.short : '') }; } },
    { id: 'daysSince', match: function (n) { if (!isOp(n, '-')) return null; if (isFunc(n.left, 'TODAY') && !isFunc(n.right, 'TODAY')) return { d: n.right, since: true }; if (isFunc(n.right, 'TODAY') && !isFunc(n.left, 'TODAY')) return { d: n.left, since: false }; return null; },
      tr: function (m, h) { var d = h.describe(m.d).p; return m.since ? { s: d.c('abl') + ' bugüne kadar geçen gün sayısını hesaplar.', n: d.c('abl') + ' bugüne kadar geçen gün sayısı' } : { s: d.c('dat') + ' kaç gün kaldığını hesaplar (sonuç negatifse tarih geçmiştir).', n: d.c('dat') + ' kalan gün sayısı' }; },
      ru: function (m, h) { var d = h.describe(m.d).p; return m.since ? { s: 'считает, сколько дней прошло ' + ruS(d.c('gen')) + ' до сегодняшнего дня.', n: h.RN('число дней', ' ' + ruS(d.c('gen')) + ' до сегодня') } : { s: 'считает, сколько дней осталось до ' + d.c('gen') + ' (отрицательное число означает, что дата уже прошла).', n: h.RN('число дней', ' до ' + d.c('gen')) }; },
      en: function (m, h) { var d = h.describe(m.d).p; return m.since ? { s: 'calculates how many days have passed since ' + d.text + '.', n: 'the number of days since ' + d.text } : { s: 'calculates how many days are left until ' + d.text + ' (a negative result means the date has passed).', n: 'the number of days until ' + d.text }; } },
    { id: 'dateDiffDays', match: function (n, env) { if (!isOp(n, '-')) return null; var l = unwrapParen(n.left), r = unwrapParen(n.right); if (!isNode(l) || !isNode(r) || l.t !== 'ref' || r.t !== 'ref') return null; var L = describe(l, env), R = describe(r, env); var lt = headerType({ p: L.p }), rt = headerType({ p: R.p }); if (lt === 'date' && rt === 'date') return { a: l, b: r }; return null; },
      tr: function (m, h) { var a = h.describe(m.a).p, b = h.describe(m.b).p; return { s: b.text + ' ile ' + a.text + ' arasındaki gün sayısını hesaplar (' + a.short + ' − ' + b.short + ').', n: b.text + ' ile ' + a.text + ' arasındaki gün sayısı' }; },
      ru: function (m, h) { var a = h.describe(m.a).p, b = h.describe(m.b).p; return { s: 'считает число дней между ' + b.c('ins') + ' и ' + a.c('ins') + ' (' + a.short + ' − ' + b.short + ').', n: h.RN('число дней', ' между ' + b.c('ins') + ' и ' + a.c('ins')) }; },
      en: function (m, h) { var a = h.describe(m.a).p, b = h.describe(m.b).p; return { s: 'calculates the number of days between ' + b.text + ' and ' + a.text + ' (' + a.short + ' − ' + b.short + ').', n: 'the number of days between ' + b.text + ' and ' + a.text }; } },
    { id: 'age', match: function (n) { return isFunc(n, 'DATEDIF') && isFunc(argN(n, 1), 'TODAY') && isStr(argN(n, 2)) && /^y$/i.test(unwrapParen(argN(n, 2)).v) ? { d: argN(n, 0) } : null; },
      tr: function (m, h) { var d = h.describe(m.d).p; return { s: d.c('abl') + ' bugüne kadar geçen tam yıl sayısını, yani yaşı hesaplar ("Y" birimi = tam yıl).', n: { text: d.c('dat') + ' göre yaş', poss: false } }; },
      ru: function (m, h) { var d = h.describe(m.d).p; return { s: 'вычисляет полное число лет от ' + d.c('gen') + ' до сегодняшнего дня, то есть возраст (единица «Y» — полные годы).', n: h.RN('возраст', ' по ' + d.c('dat')) }; },
      en: function (m, h) { var d = h.describe(m.d).p; return { s: 'calculates the whole years from ' + d.text + ' until today, i.e. the age (unit “Y” = whole years).', n: 'the age based on ' + d.text }; } },
    { id: 'percentMath', match: function (n) {
        if (!isOp(n, '*')) return null;
        var l = n.left, r = unwrapParen(n.right);
        if (isOp(r, '+') && isNum(r.left, 1) && numVal(r.right) !== null) return { x: l, kind: 'inc', pct: pctText(r.right) };
        if (isOp(r, '-') && isNum(r.left, 1) && numVal(r.right) !== null) return { x: l, kind: 'dec', pct: pctText(r.right) };
        if (isOp(r, '+') && isNum(r.left, 1) && isNode(unwrapParen(r.right)) && unwrapParen(r.right).t === 'ref') return { x: l, kind: 'incRef', ref: r.right };
        if (isOp(r, '-') && isNum(r.left, 1) && isNode(unwrapParen(r.right)) && unwrapParen(r.right).t === 'ref') return { x: l, kind: 'decRef', ref: r.right };
        var v = numVal(r);
        if (v !== null && v > 1 && v < 2 && Math.round((v - 1) * 10000) % 100 === 0) return { x: l, kind: 'inc', pct: fmtNum(Math.round((v - 1) * 10000) / 100) };
        if (v !== null && v > 0 && v < 1 && (r.t === 'percent' || Math.round(v * 10000) % 100 === 0)) return { x: l, kind: 'of', pct: fmtNum(Math.round(v * 10000) / 100) };
        return null; },
      tr: function (m, h) { var x = h.describe(m.x).p; var pct = m.pct ? String(m.pct).replace('.', ',') : null;
        if (m.kind === 'inc') return { s: x.c('acc') + ' %' + pct + ' artırır (' + x.short + ' × ' + (1 + parseFloat(String(m.pct).replace(',', '.')) / 100).toString().replace('.', ',') + '); örneğin KDV dahil tutar.', n: x.c('gen') + ' %' + pct + ' artırılmış hâli' };
        if (m.kind === 'dec') return { s: x.c('acc') + ' %' + pct + ' azaltır (indirimli tutar).', n: x.c('gen') + ' %' + pct + ' indirimli hâli' };
        if (m.kind === 'incRef' || m.kind === 'decRef') { var r = h.describe(m.ref).p; return { s: x.c('acc') + ' ' + r.c('loc') + ' yazan oran kadar ' + (m.kind === 'incRef' ? 'artırır' : 'azaltır (indirim uygular)') + '.', n: x.c('gen') + ' ' + r.c('dat') + ' göre ' + (m.kind === 'incRef' ? 'artırılmış' : 'indirimli') + ' hâli' }; }
        return { s: x.c('gen') + ' ' + trPercentOf(pct) + ' hesaplar.', n: x.c('gen') + ' %' + pct + '’' + (function () { var b = trNumberBase(pct); var H4 = h4(b.lastVowel); return b.endsVowel ? 's' + H4 : H4; })() }; },
      ru: function (m, h) { var x = h.describe(m.x).p; var pct = m.pct;
        if (m.kind === 'inc') return { s: 'увеличивает ' + x.c('acc') + ' на ' + pct + ' % (например, сумма с НДС).', n: h.RN('сумма', ' ' + x.c('gen') + ' с надбавкой ' + pct + ' %') };
        if (m.kind === 'dec') return { s: 'уменьшает ' + x.c('acc') + ' на ' + pct + ' % (сумма со скидкой).', n: h.RN('сумма', ' ' + x.c('gen') + ' со скидкой ' + pct + ' %') };
        if (m.kind === 'incRef' || m.kind === 'decRef') { var r = h.describe(m.ref).p; return { s: (m.kind === 'incRef' ? 'увеличивает ' : 'уменьшает ') + x.c('acc') + ' на долю, указанную в ' + r.c('pre') + (m.kind === 'decRef' ? ', то есть применяет скидку' : '') + '.', n: h.RN('сумма', ' ' + x.c('gen') + (m.kind === 'incRef' ? ' с надбавкой из ' : ' со скидкой из ') + r.c('gen')) }; }
        return { s: 'вычисляет ' + pct + ' % от ' + x.c('gen') + '.', n: h.RN('доля', ' ' + pct + ' % от ' + x.c('gen')) }; },
      en: function (m, h) { var x = h.describe(m.x).p; var pct = m.pct;
        if (m.kind === 'inc') return { s: 'increases ' + x.text + ' by ' + pct + '% (for example the amount including VAT).', n: x.text + ' increased by ' + pct + '%' };
        if (m.kind === 'dec') return { s: 'reduces ' + x.text + ' by ' + pct + '% (the discounted amount).', n: x.text + ' reduced by ' + pct + '%' };
        if (m.kind === 'incRef' || m.kind === 'decRef') { var r = h.describe(m.ref).p; return { s: (m.kind === 'incRef' ? 'increases ' : 'reduces ') + x.text + ' by the rate in ' + r.text + (m.kind === 'decRef' ? ' (a discount)' : '') + '.', n: x.text + (m.kind === 'incRef' ? ' increased by ' : ' reduced by ') + r.text }; }
        return { s: 'calculates ' + pct + '% of ' + x.text + '.', n: pct + '% of ' + x.text }; } },
    { id: 'topN', match: function (n) { if (!isFunc(n, 'TAKE') || !isFunc(argN(n, 0), 'SORT')) return null; var s = unwrapParen(argN(n, 0)); var order = numVal(argN(s, 2)); return { r: argN(s, 0), col: argN(s, 1), N: argN(n, 1), desc: order === -1 || order === null && false, order: order }; },
      tr: function (m, h) { var r = h.describe(m.r).p, N = h.describe(m.N).p, col = m.col ? h.describe(m.col) : null; var hdr = col && col.p.kind === 'num' ? h.colHeader({ present: true, p: r }, unwrapParen(m.col).v) : null; var by = col ? ' ' + col.p.text + '. sütuna' + (hdr ? ' (' + h.q(hdr) + ')' : '') + ' göre' : ''; return { s: r.c('gen') + by + ' en ' + (m.order === -1 ? 'yüksek' : 'düşük') + ' ' + N.text + ' satırını listeler (' + (m.order === -1 ? 'azalan' : 'artan') + ' sıralayıp ilk ' + N.text + ' satırı alır).', n: { text: 'en ' + (m.order === -1 ? 'yüksek' : 'düşük') + ' ' + N.text + ' satır', poss: false } }; },
      ru: function (m, h) { var r = h.describe(m.r).p, N = h.describe(m.N).p, col = m.col ? h.describe(m.col) : null; var hdr = col && col.p.kind === 'num' ? h.colHeader({ present: true, p: r }, unwrapParen(m.col).v) : null; var by = col ? ' по столбцу ' + col.p.text + (hdr ? ' (' + h.q(hdr) + ')' : '') : ''; return { s: 'выводит ' + N.text + ' строк ' + r.c('gen') + ' с ' + (m.order === -1 ? 'наибольшими' : 'наименьшими') + ' значениями' + by + ' (сортировка ' + (m.order === -1 ? 'по убыванию' : 'по возрастанию') + ', затем берутся первые ' + N.text + ').', n: h.RN('строки', ' с ' + (m.order === -1 ? 'наибольшими' : 'наименьшими') + ' значениями (' + N.text + ')') }; },
      en: function (m, h) { var r = h.describe(m.r).p, N = h.describe(m.N).p, col = m.col ? h.describe(m.col) : null; var hdr = col && col.p.kind === 'num' ? h.colHeader({ present: true, p: r }, unwrapParen(m.col).v) : null; var by = col ? ' by column ' + col.p.text + (hdr ? ' (' + h.q(hdr) + ')' : '') : ''; return { s: 'lists the ' + (m.order === -1 ? 'top' : 'bottom') + ' ' + N.text + ' rows of ' + r.text + by + ' (sorted ' + (m.order === -1 ? 'descending' : 'ascending') + ', then the first ' + N.text + ' rows are taken).', n: 'the ' + (m.order === -1 ? 'top' : 'bottom') + ' ' + N.text + ' rows of ' + r.text }; } },
    { id: 'maxMinIf', match: function (n) { if (!isFunc(n, 'MAX') && !isFunc(n, 'MIN')) return null; var f = unwrapParen(argN(n, 0)); if (!isFunc(f, 'IF') || (f.args || []).length !== 2) return null; return { cond: argN(f, 0), r: argN(f, 1), max: isFunc(n, 'MAX') }; },
      tr: function (m, h) { var r = h.describe(m.r).p, c = h.cond(m.cond); return { s: c + ' olan satırlar arasında ' + (r.header ? r.short + ' için' : r.c('loc')) + ' en ' + (m.max ? 'büyük' : 'küçük') + ' değeri bulur (dizi formülü: eski Excel sürümlerinde Ctrl+Shift+Enter ile girilir).', n: c + ' olan satırların en ' + (m.max ? 'büyük' : 'küçük') + ' ' + r.short + ' değeri' }; },
      ru: function (m, h) { var r = h.describe(m.r).p, c = h.cond(m.cond); return { s: 'находит ' + (m.max ? 'наибольшее' : 'наименьшее') + ' значение ' + r.c('gen') + ' среди строк, где ' + c + ' (формула массива: в старых версиях Excel вводится через Ctrl+Shift+Enter).', n: h.RN(m.max ? 'наибольшее значение' : 'наименьшее значение', ' ' + r.c('gen') + ' среди строк, где ' + c) }; },
      en: function (m, h) { var r = h.describe(m.r).p, c = h.cond(m.cond); return { s: 'finds the ' + (m.max ? 'largest' : 'smallest') + ' value in ' + r.text + ' among the rows where ' + c + ' (array formula: older Excel versions need Ctrl+Shift+Enter).', n: 'the ' + (m.max ? 'largest' : 'smallest') + ' value in ' + r.text + ' where ' + c }; } },
    { id: 'indexMatch', match: function (n) { if (!isFunc(n, 'INDEX') || (n.args || []).length !== 2) return null; var mt = unwrapParen(argN(n, 1)); if (!isFunc(mt, 'MATCH') && !isFunc(mt, 'XMATCH')) return null; var mode = numVal(argN(mt, 2)); return { ret: argN(n, 0), key: argN(mt, 0), lk: argN(mt, 1), exact: mode === 0 || (isFunc(mt, 'XMATCH') && mode === null) }; },
      tr: function (m, h) { var ret = h.describe(m.ret).p, key = h.describe(m.key).p, lk = h.describe(m.lk).p; var pre = key.c('dat') + ' karşılık gelen ' + ret.short + ' '; return { s: key.c('acc') + ' ' + lk.c('loc') + ' arar ve aynı sıradaki ' + (ret.header ? ret.short + ' değerini (' + ret.refInfo.raw.replace(/\$/g, '') + ')' : trKi(ret.c('loc'), ' değeri')) + ' verir (İNDİS+KAÇINCI' + (m.exact ? ', tam eşleşme' : ', yaklaşık eşleşme') + ').', n: { text: pre + 'değeri', cases: trHead(pre, 'değeri', ''), gender: 'n' } }; },
      ru: function (m, h) { var ret = h.describe(m.ret).p, key = h.describe(m.key).p, lk = h.describe(m.lk).p; return { s: 'ищет ' + key.c('acc') + ' в ' + lk.c('pre') + ' и возвращает значение из той же строки ' + ret.c('gen') + ' (ИНДЕКС+ПОИСКПОЗ' + (m.exact ? ', точное совпадение' : ', приближённый поиск') + ').', n: h.RN('значение', ' ' + ret.short + ', соответствующее ' + key.c('dat')) }; },
      en: function (m, h) { var ret = h.describe(m.ret).p, key = h.describe(m.key).p, lk = h.describe(m.lk).p; return { s: 'looks up ' + key.text + ' in ' + lk.text + ' and returns the value from the same position in ' + ret.text + ' (INDEX+MATCH' + (m.exact ? ', exact match' : ', approximate match') + ').', n: 'the ' + ret.short + ' value matching ' + key.text }; } },
    { id: 'textBeforeAfter', match: function (n) {
        if (isFunc(n, 'LEFT')) { var m1 = unwrapParen(argN(n, 1)); if (isOp(m1, '-') && isNum(m1.right, 1) && isFunc(m1.left, 'FIND') && isStr(argN(m1.left, 0)) && !isStr(argN(m1.left, 0), ' ') && sameRef(argN(m1.left, 1), argN(n, 0))) return { x: argN(n, 0), s: argN(m1.left, 0), before: true }; }
        if (isFunc(n, 'MID')) { var m2 = unwrapParen(argN(n, 1)); var len = numVal(argN(n, 2)); if (isOp(m2, '+') && isNum(m2.right, 1) && isFunc(m2.left, 'FIND') && isStr(argN(m2.left, 0)) && sameRef(argN(m2.left, 1), argN(n, 0)) && len !== null && len >= 50) return { x: argN(n, 0), s: argN(m2.left, 0), before: false }; }
        return null; },
      tr: function (m, h) { var x = h.describe(m.x).p, s = h.describe(m.s).p; var at = unwrapParen(m.s).v === '@'; var sym = s.short || s.text; return { s: x.c('gen') + ' ' + sym + ' işaretinden ' + (m.before ? 'önceki' : 'sonraki') + ' kısmını alır' + (at ? (m.before ? ' (e-posta kullanıcı adı)' : ' (e-posta alan adı)') : '') + '.', n: x.c('gen') + ' ' + sym + ' ' + (m.before ? 'öncesindeki' : 'sonrasındaki') + ' kısmı' }; },
      ru: function (m, h) { var x = h.describe(m.x).p, s = h.describe(m.s).p; var at = unwrapParen(m.s).v === '@'; var sym = s.short || s.text; return { s: 'берёт часть ' + x.c('gen') + ' ' + (m.before ? 'до' : 'после') + ' знака ' + sym + (at ? (m.before ? ' (имя пользователя из e-mail)' : ' (домен из e-mail)') : '') + '.', n: h.RN('часть', ' ' + x.c('gen') + ' ' + (m.before ? 'до ' : 'после ') + sym) }; },
      en: function (m, h) { var x = h.describe(m.x).p, s = h.describe(m.s).p; var at = unwrapParen(m.s).v === '@'; var sym = s.short || s.text; return { s: 'takes the part of ' + x.text + ' ' + (m.before ? 'before' : 'after') + ' the ' + sym + ' sign' + (at ? (m.before ? ' (the e-mail user name)' : ' (the e-mail domain)') : '') + '.', n: 'the part of ' + x.text + ' ' + (m.before ? 'before ' : 'after ') + sym }; } }
  ];
  function matchIdiom(node, env) {
    for (var i = 0; i < IDIOMS.length; i++) {
      var idm = IDIOMS[i], m;
      try { m = idm.match(node, env); } catch (e) { m = null; }
      if (!m) continue;
      var fn = idm[env.lang]; if (!fn) continue;
      var res;
      try { res = fn(m, helpers(env)); } catch (e2) { res = null; }
      if (!res) continue;
      if (res.p) { res.idiom = idm.id; res.fn = node.t === 'func' ? String(node.name).toUpperCase() : null; return res; }
      var out = { p: phraseFromTemplate(res.n, env.lang), s: res.s ? endSentence(res.s) : null, cond: res.c || null, idiom: idm.id, fn: node.t === 'func' ? String(node.name).toUpperCase() : null };
      if (!out.p.short) out.p.short = out.p.text;
      return out;
    }
    return null;
  }

  /* ------------------------------------------------------------------ */
  /* Steps                                                               */
  /* ------------------------------------------------------------------ */
  function childNodes(n) {
    switch (n.t) {
      case 'func': return (n.args || []).filter(isNode);
      case 'op': return [n.left, n.right].filter(isNode);
      case 'unary': case 'percent': case 'paren': return [n.arg].filter(isNode);
      case 'array': return [].concat.apply([], n.rows || []).filter(isNode);
      default: return [];
    }
  }
  function stepText(d, env) {
    if (d.s) return d.s;
    if (env.lang === 'tr') return d.p.c('acc') + ' verir.';
    if (env.lang === 'ru') return 'возвращает ' + d.p.c('acc') + '.';
    return 'returns ' + d.p.text + '.';
  }
  function collectSteps(root, env) {
    var queue = [{ node: root, depth: 0 }], all = [], seen = {};
    while (queue.length) {
      var it = queue.shift(), n = unwrapParen(it.node);
      if (!isNode(n)) continue;
      var worthy = n.t === 'func' || n.t === 'op' || ((n.t === 'unary' || n.t === 'percent') && it.depth === 0);
      if (worthy) {
        var formula = serialize(n, env.dialect, env.lang);
        if (!seen[formula]) {
          seen[formula] = 1;
          var d = describe(n, env);
          var trivial = n.t === 'op' && it.depth > 0 && childNodes(n).every(function (c) { var u = unwrapParen(c); return u.t !== 'func' && u.t !== 'op'; });
          all.push({ formula: formula, text: capFirst(stepText(d, env), env.lang), fn: d.fn || null, depth: it.depth, trivial: trivial, idiom: d.idiom || null });
        }
      }
      childNodes(n).forEach(function (c) { queue.push({ node: c, depth: it.depth + 1 }); });
    }
    if (!all.length) {
      var rd = describe(root, env);
      all.push({ formula: serialize(root, env.dialect, env.lang), text: capFirst(stepText(rd, env), env.lang), fn: null, depth: 0, trivial: false, idiom: null });
    }
    var steps = all;
    if (steps.length > MAX_STEPS) steps = steps.filter(function (s) { return !s.trivial || s.depth === 0; });
    if (steps.length > MAX_STEPS) steps = steps.slice(0, MAX_STEPS);
    return steps.map(function (s) { var o = { formula: s.formula, text: s.text }; if (s.fn) o.fn = s.fn; if (s.idiom) o.idiom = s.idiom; return o; });
  }

  /* ------------------------------------------------------------------ */
  /* Functions used                                                      */
  /* ------------------------------------------------------------------ */
  var FALLBACK_MIN = { XLOOKUP: '2021', XMATCH: '2021', FILTER: '2021', UNIQUE: '2021', SORT: '2021', SORTBY: '2021', SEQUENCE: '2021', RANDARRAY: '2021', LET: '2021', IFS: '2019', SWITCH: '2019', MAXIFS: '2019', MINIFS: '2019', TEXTJOIN: '2019', CONCAT: '2019', TEXTBEFORE: '365', TEXTAFTER: '365', TEXTSPLIT: '365', TAKE: '365', DROP: '365', VSTACK: '365', HSTACK: '365', TOCOL: '365', TOROW: '365', WRAPROWS: '365', WRAPCOLS: '365', CHOOSECOLS: '365', CHOOSEROWS: '365', LAMBDA: '365', MAP: '365', SCAN: '365', REDUCE: '365', BYROW: '365', BYCOL: '365', MAKEARRAY: '365', EXPAND: '365', IFNA: '2013', DAYS: '2013', ISOWEEKNUM: '2013', 'CEILING.MATH': '2013', 'FLOOR.MATH': '2013', 'STDEV.S': '2010', 'STDEV.P': '2010', 'MODE.SNGL': '2010', 'RANK.EQ': '2010', 'RANK.AVG': '2010', 'NETWORKDAYS.INTL': '2010', 'WORKDAY.INTL': '2010', AGGREGATE: '2010' };
  var VOLATILE = ['NOW', 'TODAY', 'RAND', 'RANDBETWEEN', 'RANDARRAY', 'OFFSET', 'INDIRECT', 'CELL', 'INFO'];
  function walk(node, fn) {
    if (!isNode(node)) return;
    fn(node);
    childNodes(node).forEach(function (c) { walk(c, fn); });
  }
  function functionsUsed(root) {
    var out = [];
    walk(root, function (n) { if (n.t === 'func') { var nm = String(n.name || '').toUpperCase(); if (out.indexOf(nm) < 0) out.push(nm); } });
    return out;
  }
  function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function localizeSyntax(entry, name, dialect) {
    var syn = entry && entry.syntax ? String(entry.syntax) : name + '(…)';
    syn = syn.replace(/^[A-Za-z0-9_.]+/, localName(name, dialect));
    if (dialect !== 'en') {
      syn = syn.replace(/,\s*/g, '; ');
      var args = ((entry && entry.args) || []).slice().sort(function (a, b) { return String(b.name).length - String(a.name).length; });
      args.forEach(function (ar) {
        var loc = dialect === 'tr' ? ar.tr : ar.ru;
        if (ar.name && loc && loc !== ar.name) syn = syn.replace(new RegExp('(^|[^A-Za-z0-9_])' + escapeRe(ar.name) + '(?=[^A-Za-z0-9_]|$)', 'g'), '$1' + loc);
      });
    }
    return syn;
  }
  function functionInfo(name, env) {
    var e = catalogEntry(name), lang = env.lang;
    return {
      name: name, local: localName(name, env.dialect), tr: e ? (e.tr || name) : localName(name, 'tr'), ru: e ? (e.ru || name) : localName(name, 'ru'),
      desc: e ? pick(e.desc, lang) : '', syntax: localizeSyntax(e, name, env.dialect), syntaxEN: e ? (e.syntax || '') : '',
      category: e ? (e.category || null) : null, minVersion: (e && e.minVersion) || FALLBACK_MIN[name] || null,
      volatile: e && e.volatile !== undefined ? !!e.volatile : VOLATILE.indexOf(name) >= 0,
      args: ((e && e.args) || []).map(function (ar) { return { name: lang === 'tr' ? (ar.tr || ar.name) : lang === 'ru' ? (ar.ru || ar.name) : ar.name, desc: pick(ar.desc, lang), optional: !!ar.optional }; }),
      example: e && e.example ? { formula: e.example.formula, text: pick(e.example, lang) } : null,
      known: !!e
    };
  }

  /* ------------------------------------------------------------------ */
  /* Tips                                                                */
  /* ------------------------------------------------------------------ */
  var VERSION_LABEL = {
    '2010': { tr: 'Excel 2010 veya üstü', ru: 'Excel 2010 или новее', en: 'Excel 2010 or later' },
    '2013': { tr: 'Excel 2013 veya üstü', ru: 'Excel 2013 или новее', en: 'Excel 2013 or later' },
    '2016': { tr: 'Excel 2016 veya üstü', ru: 'Excel 2016 или новее', en: 'Excel 2016 or later' },
    '2019': { tr: 'Excel 2019 veya üstü (ya da Microsoft 365)', ru: 'Excel 2019 или новее (либо Microsoft 365)', en: 'Excel 2019 or later (or Microsoft 365)' },
    '2021': { tr: 'Excel 2021 veya Microsoft 365', ru: 'Excel 2021 или Microsoft 365', en: 'Excel 2021 or Microsoft 365' },
    '365': { tr: 'Microsoft 365 (Excel 2021’de bulunmaz)', ru: 'Microsoft 365 (в Excel 2021 отсутствует)', en: 'Microsoft 365 (not available in Excel 2021)' }
  };
  function fnLabel(name, env) { var l = localName(name, env.dialect); return l === name ? name : l + ' (' + name + ')'; }
  function versionTips(infos, env) {
    var groups = {}, lang = env.lang;
    infos.forEach(function (f) { if (f.minVersion && VERSION_LABEL[f.minVersion]) (groups[f.minVersion] = groups[f.minVersion] || []).push(fnLabel(f.name, env)); });
    var out = [];
    Object.keys(groups).sort().reverse().forEach(function (v) {
      var names = joinList(groups[v], lang), many = groups[v].length > 1, label = VERSION_LABEL[v][lang];
      if (lang === 'tr') out.push(names + (many ? ' işlevleri ' : ' işlevi ') + label + ' gerektirir; daha eski Excel sürümlerinde #AD? hatası görürsünüz.');
      else if (lang === 'ru') out.push(names + (many ? ' — функции, доступные' : ' — функция, доступная') + ' начиная с ' + label + '; в более старых версиях Excel будет ошибка #ИМЯ?.');
      else out.push(names + (many ? ' require ' : ' requires ') + label + '; older Excel versions show #NAME?.');
    });
    return out;
  }
  function hasPlaceholder(root) { var f = false; walk(root, function (n) { if (n.t === 'placeholder') f = true; }); return f; }
  function containsFunc(root, names) { var f = false; walk(root, function (n) { if (n.t === 'func' && names.indexOf(String(n.name).toUpperCase()) >= 0) f = true; }); return f; }
  function refHasDollar(ref) { return /\$/.test(String(ref)); }
  function absRef(ref) { return String(ref).replace(/\$/g, '').replace(/([A-Za-z]{1,3})(\d+)/g, '$$$1$$$2').replace(/^([A-Za-z]{1,3}):([A-Za-z]{1,3})$/, '$$$1:$$$2'); }

  tipFor('VLOOKUP HLOOKUP', function (node, env, h) {
    var a = argsOf(node, env), exact = lookupIsExact(a[3]), name = h.local(String(node.name).toUpperCase()), v = String(node.name).toUpperCase() === 'VLOOKUP';
    if (env.lang === 'tr') return exact ? name + ' her zaman tablonun ilk ' + (v ? 'sütununda' : 'satırında') + ' arar ve ' + (v ? 'sağa' : 'aşağı') + ' doğru sayılan numarayı kullanır; araya ' + (v ? 'sütun' : 'satır') + ' eklenirse numara kayar. Daha esnek çözüm: ' + h.local('XLOOKUP') + ' (XLOOKUP) veya ' + h.local('INDEX') + '+' + h.local('MATCH') + '.' : 'Son bağımsız değişken atlanmış ya da DOĞRU/1: bu “yaklaşık eşleşme” demektir. İlk ' + (v ? 'sütun' : 'satır') + ' artan sıralı değilse yanlış sonuç alırsınız; tam eşleşme için YANLIŞ (0) yazın.';
    if (env.lang === 'ru') return exact ? name + ' всегда ищет в перв' + (v ? 'ом столбце' : 'ой строке') + ' таблицы и считает номер ' + (v ? 'столбца слева направо' : 'строки сверху вниз') + '; если вставить ' + (v ? 'столбец' : 'строку') + ', номер собьётся. Более гибкие варианты: ' + h.local('XLOOKUP') + ' (XLOOKUP) или ' + h.local('INDEX') + '+' + h.local('MATCH') + '.' : 'Последний аргумент пропущен или равен ИСТИНА/1 — это «приближённый поиск». Если перв' + (v ? 'ый столбец' : 'ая строка') + ' не отсортирован' + (v ? '' : 'а') + ' по возрастанию, результат будет неверным; для точного совпадения укажите ЛОЖЬ (0).';
    return exact ? name + ' always searches the first ' + (v ? 'column' : 'row') + ' of the table and counts the ' + (v ? 'column' : 'row') + ' number from the ' + (v ? 'left' : 'top') + '; inserting a ' + (v ? 'column' : 'row') + ' shifts the number. More flexible options: XLOOKUP or INDEX+MATCH.' : 'The last argument is omitted or TRUE/1, which means “approximate match”. If the first ' + (v ? 'column' : 'row') + ' is not sorted in ascending order you get wrong results; use FALSE (0) for an exact match.';
  });
  tipFor('XLOOKUP', function (node, env, h) {
    var a = argsOf(node, env); if (a[3].present) return null;
    return { tr: h.local('XLOOKUP') + ' varsayılan olarak tam eşleşme arar; bulunamayınca #YOK yerine bir metin göstermek için 4. bağımsız değişkeni kullanın (ör. "Bulunamadı").', ru: h.local('XLOOKUP') + ' по умолчанию ищет точное совпадение; чтобы вместо #Н/Д показать текст, задайте 4-й аргумент (например, "Не найдено").', en: 'XLOOKUP uses exact match by default; to show a text instead of #N/A when nothing is found, set the 4th argument (e.g. "Not found").' }[env.lang];
  });
  tipFor('MATCH', function (node, env, h) {
    var a = argsOf(node, env); if (a[2].present && !(a[2].isNum && a[2].num === 1)) return null;
    return { tr: h.local('MATCH') + ' işlevinde üçüncü bağımsız değişken atlanırsa yaklaşık eşleşme uygulanır ve aralık artan sıralı olmalıdır; tam eşleşme için 0 yazın.', ru: 'Если третий аргумент ' + h.local('MATCH') + ' пропущен, используется приближённый поиск и диапазон должен быть отсортирован по возрастанию; для точного совпадения укажите 0.', en: 'If MATCH’s third argument is omitted it uses approximate match and the range must be sorted in ascending order; use 0 for an exact match.' }[env.lang];
  });
  tipFor('DATEDIF', function (node, env, h) {
    return { tr: h.local('DATEDIF') + ' (DATEDIF) gizli bir işlevdir: formül yazarken otomatik tamamlamada görünmez ama çalışır; elle yazmanız gerekir. Başlangıç tarihi bitiş tarihinden sonraysa #SAYI! hatası verir.', ru: h.local('DATEDIF') + ' (DATEDIF) — скрытая функция: она не появляется в подсказках при вводе, но работает; её нужно набирать вручную. Если начальная дата позже конечной, будет ошибка #ЧИСЛО!.', en: 'DATEDIF is a hidden function: it does not appear in autocomplete but works when typed by hand. If the start date is later than the end date it returns #NUM!.' }[env.lang];
  });
  tipFor('IFERROR', function (node, env, h) {
    return { tr: h.local('IFERROR') + ' tüm hataları gizler; yazım hatası veya bozuk başvuru gibi gerçek sorunları da görünmez yapabilir. Yalnızca “bulunamadı” (#YOK) durumunu yakalamak için ' + h.local('IFNA') + ' (IFNA) tercih edin.', ru: h.local('IFERROR') + ' скрывает любые ошибки, в том числе настоящие проблемы (опечатки, повреждённые ссылки). Чтобы перехватывать только «не найдено» (#Н/Д), используйте ' + h.local('IFNA') + ' (IFNA).', en: 'IFERROR hides every error, including real problems such as typos or broken references. To catch only “not found” (#N/A), prefer IFNA.' }[env.lang];
  });
  tipFor('SUMIF SUMIFS COUNTIF COUNTIFS AVERAGEIF AVERAGEIFS MAXIFS MINIFS', function (node, env, h) {
    var name = String(node.name).toUpperCase();
    var base = { tr: 'Ölçütler metin olarak yazılır: ">100", "<>", "Gıda". Bir hücreyle karşılaştırmak için ">"&B2 biçimini kullanın; metin ölçütleri büyük/küçük harfe duyarlı değildir ve * ile ? joker karakter olarak çalışır.', ru: 'Условия записываются как текст: ">100", "<>", "Еда". Для сравнения с ячейкой используйте ">"&B2; текстовые условия не зависят от регистра, а * и ? работают как подстановочные знаки.', en: 'Criteria are written as text: ">100", "<>", "Food". To compare with a cell use ">"&B2; text criteria are case-insensitive and * and ? act as wildcards.' }[env.lang];
    var order = (name === 'SUMIF' || name === 'SUMIFS') ? { tr: ' Dikkat: ' + h.local('SUMIF') + ' işlevinde toplanacak aralık en sonda, ' + h.local('SUMIFS') + ' işlevinde en baştadır.', ru: ' Обратите внимание: в ' + h.local('SUMIF') + ' диапазон суммирования идёт последним, а в ' + h.local('SUMIFS') + ' — первым.', en: ' Note: in SUMIF the sum range comes last; in SUMIFS it comes first.' }[env.lang] : '';
    return base + order;
  });
  tipFor('INDIRECT', function (node, env, h) {
    return { tr: h.local('INDIRECT') + ' “değişken” (volatile) bir işlevdir: her hesaplamada yeniden çalışır ve kapalı çalışma kitaplarına başvuramaz.', ru: h.local('INDIRECT') + ' — «летучая» функция: пересчитывается при каждом изменении и не работает с закрытыми книгами.', en: 'INDIRECT is volatile: it recalculates on every change and cannot reference closed workbooks.' }[env.lang];
  });
  tipFor('TEXT', function (node, env, h) {
    return { tr: 'Biçim kodları Excel’in diline göre değişir: Türkçe Excel’de gg.aa.yyyy, İngilizce’de dd.mm.yyyy yazılır; kod tanınmazsa sonuç olduğu gibi görünür.', ru: 'Коды формата зависят от языка Excel: в русской версии ДД.ММ.ГГГГ, в английской dd.mm.yyyy; нераспознанный код выводится как есть.', en: 'Format codes depend on the Excel language: English uses dd.mm.yyyy, Turkish gg.aa.yyyy and Russian ДД.ММ.ГГГГ; an unknown code is shown literally.' }[env.lang];
  });
  tipFor('SUMPRODUCT', function (node, env, h) {
    var hasCmp = false; walk(node, function (n) { if (isComparison(n)) hasCmp = true; }); if (!hasCmp) return null;
    return { tr: h.local('SUMPRODUCT') + ' koşullu toplamları dizi formülü girmeden yapar: (koşul)*(aralık) yapısında DOĞRU/YANLIŞ 1/0’a dönüşür.', ru: h.local('SUMPRODUCT') + ' считает по условиям без формулы массива: в конструкции (условие)*(диапазон) ИСТИНА/ЛОЖЬ превращаются в 1/0.', en: 'SUMPRODUCT handles conditional sums without an array formula: in (condition)*(range) TRUE/FALSE become 1/0.' }[env.lang];
  });
  tipFor('PMT FV PV NPER RATE IPMT PPMT', function (node, env, h) {
    return { tr: 'Faiz oranı ile dönem sayısı aynı birimde olmalı: aylık hesap için yıllık faizi 12’ye bölün ve yıl sayısını 12 ile çarpın. Ödemeler ve anapara ters işaretli girilir.', ru: 'Ставка и число периодов должны быть в одних единицах: для ежемесячного расчёта годовую ставку делят на 12, а число лет умножают на 12. Платежи и сумма кредита вводятся с противоположными знаками.', en: 'The rate and the number of periods must use the same unit: for monthly figures divide the annual rate by 12 and multiply the years by 12. Payments and the principal have opposite signs.' }[env.lang];
  });
  tipFor('ROUND ROUNDUP ROUNDDOWN', function (node, env, h) {
    return { tr: 'Hücre biçimi ondalıkları yalnızca gizler; ' + h.local(String(node.name).toUpperCase()) + ' ise değeri gerçekten değiştirir, sonraki hesaplar yuvarlanmış değerle yapılır.', ru: 'Формат ячейки лишь скрывает знаки после запятой, а ' + h.local(String(node.name).toUpperCase()) + ' действительно меняет значение — дальнейшие расчёты идут с округлённым числом.', en: 'Cell formatting only hides decimals; ' + String(node.name).toUpperCase() + ' actually changes the value, so later calculations use the rounded number.' }[env.lang];
  });
  tipFor('AND OR', function (node, env, h) {
    return { tr: h.local('AND') + '/' + h.local('OR') + ' koşulları ayrı bağımsız değişkenler olarak alır: ' + h.local('AND') + '(A2>5;A2<10) — "A2>5 ve A2<10" gibi yazılmaz.', ru: h.local('AND') + '/' + h.local('OR') + ' принимают условия как отдельные аргументы: ' + h.local('AND') + '(A2>5;A2<10), а не «A2>5 и A2<10».', en: 'AND/OR take each condition as a separate argument: AND(A2>5,A2<10), not “A2>5 and A2<10”.' }[env.lang];
  });
  tipFor('IF', function (node, env, h) {
    var depth = 0; (function dive(n, d) { n = unwrapParen(n); if (!isFunc(n, 'IF')) return; depth = Math.max(depth, d); (n.args || []).slice(1).forEach(function (c) { dive(c, d + 1); }); })(node, 1);
    if (depth < 3) return null;
    return { tr: 'Üç ve daha fazla iç içe ' + h.local('IF') + ' okumayı zorlaştırır; Excel 2019+ sürümlerinde ' + h.local('IFS') + ' (IFS) daha anlaşılırdır.', ru: 'Три и более вложенных ' + h.local('IF') + ' трудно читать; в Excel 2019+ удобнее ' + h.local('IFS') + ' (IFS).', en: 'Three or more nested IFs are hard to read; in Excel 2019+ IFS is clearer.' }[env.lang];
  });
  function genericTips(root, env, infos) {
    var out = [], lang = env.lang, h = helpers(env);
    // volatile
    var vol = infos.filter(function (f) { return f.volatile && f.name !== 'INDIRECT'; }).map(function (f) { return fnLabel(f.name, env); });
    if (vol.length) out.push({ tr: joinList(vol, lang) + ' “değişken” (volatile) işlevdir: her yeniden hesaplamada çalışır; çok büyük dosyalarda yavaşlatabilir.', ru: joinList(vol, lang) + ' — «летучие» функции: пересчитываются при каждом изменении листа и могут замедлять очень большие файлы.', en: joinList(vol, lang) + (vol.length > 1 ? ' are volatile functions' : ' is a volatile function') + ': it recalculates on every change, which can slow down very large workbooks.' }[lang]);
    // spill
    if (containsFunc(root, ['UNIQUE', 'FILTER', 'SORT', 'SORTBY', 'SEQUENCE', 'TAKE', 'DROP', 'TEXTSPLIT', 'RANDARRAY', 'TRANSPOSE'])) out.push({ tr: 'Sonuç birden çok hücreye “taşar” (dinamik dizi); altındaki veya sağındaki hücreler doluysa #TAŞMA! hatası alırsınız.', ru: 'Результат «разливается» на несколько ячеек (динамический массив); если соседние ячейки заняты, появится ошибка #ПЕРЕНОС!.', en: 'The result spills into neighbouring cells (dynamic array); if those cells are not empty you get a #SPILL! error.' }[lang]);
    // division by a cell
    var divByRef = false, inIferror = containsFunc(root, ['IFERROR', 'IFNA']);
    walk(root, function (n) { if (isOp(n, '/')) { var r = unwrapParen(n.right); if (isNode(r) && (r.t === 'ref' || r.t === 'func')) divByRef = true; } });
    if (divByRef && !inIferror) out.push({ tr: 'Bölen sıfır veya boşsa #SAYI/0! hatası alırsınız; gerekirse formülü ' + h.local('IFERROR') + '(…;"") ile sarabilirsiniz.', ru: 'Если делитель равен нулю или пуст, будет ошибка #ДЕЛ/0!; при необходимости оберните формулу в ' + h.local('IFERROR') + '(…;"").', en: 'If the divisor is zero or empty you get #DIV/0!; if needed, wrap the formula in IFERROR(…,"").' }[lang]);
    // date joined with &
    var dateConcat = false;
    walk(root, function (n) { if (isOp(n, '&')) flattenConcat(n).forEach(function (p) { var u = unwrapParen(p); if (isNode(u) && u.t === 'func' && ['TODAY', 'NOW', 'DATE', 'EOMONTH', 'EDATE', 'WORKDAY'].indexOf(String(u.name).toUpperCase()) >= 0) dateConcat = true; if (isNode(u) && u.t === 'ref' && headerType({ p: refPhrase(u, lang, env.ctx) }) === 'date') dateConcat = true; }); });
    if (dateConcat && !containsFunc(root, ['TEXT'])) out.push({ tr: 'Bir tarih & ile birleştirilince seri numarası (ör. 45292) olarak görünür; önce ' + h.local('TEXT') + '(tarih;"gg.aa.yyyy") ile metne çevirin.', ru: 'Дата, соединённая через &, превращается в серийный номер (например, 45292); сначала преобразуйте её функцией ' + h.local('TEXT') + '(дата;"ДД.ММ.ГГГГ").', en: 'A date joined with & shows as its serial number (e.g. 45292); convert it first with TEXT(date,"dd.mm.yyyy").' }[lang]);
    // $-locking advice for lookup/rank/countif ranges
    var lockNames = ['VLOOKUP', 'HLOOKUP', 'XLOOKUP', 'MATCH', 'XMATCH', 'INDEX', 'RANK', 'RANK.EQ', 'RANK.AVG', 'COUNTIF', 'SUMIF', 'COUNTIFS', 'SUMIFS'];
    var lockRange = null, hasRelCell = false;
    walk(root, function (n) {
      if (n.t !== 'func' || lockNames.indexOf(String(n.name).toUpperCase()) < 0) return;
      (n.args || []).forEach(function (a) { var u = unwrapParen(a); if (!isNode(u) || u.t !== 'ref') return; var pr = parseRef(u.ref); if (pr.kind === 'cell' && !refHasDollar(u.ref)) hasRelCell = true; else if ((pr.kind === 'colrange' || pr.kind === 'block') && !refHasDollar(u.ref) && !lockRange) lockRange = u.ref; });
    });
    if (lockRange && hasRelCell) out.push({ tr: 'Formülü aşağı kopyalayacaksanız ' + lockRange + ' aralığını $ ile sabitleyin (' + absRef(lockRange) + '); yoksa her satırda aralık kayar.', ru: 'Если формулу будут копировать вниз, закрепите диапазон ' + lockRange + ' знаками $ (' + absRef(lockRange) + '), иначе он будет смещаться в каждой строке.', en: 'If you copy the formula down, lock the range ' + lockRange + ' with $ (' + absRef(lockRange) + ') so it does not shift in every row.' }[lang]);
    return out;
  }
  function placeholderTip(lang) {
    return { tr: '«…» içindeki alanlar henüz belirlenmedi; formülü kullanmadan önce bunları gerçek hücre veya aralıklarla değiştirin.', ru: 'Поля в «…» ещё не заполнены; перед использованием замените их реальными ячейками или диапазонами.', en: 'The «…» placeholders are not filled in yet; replace them with real cells or ranges before using the formula.' }[lang];
  }
  function separatorTip(lang, dialect) {
    var t = {
      tr: { tr: 'Türkçe Excel söz dizimi: bağımsız değişkenler noktalı virgülle (;) ayrılır, ondalık ayracı virgüldür (3,5). İngilizce Excel’de virgül (,) ve nokta (3.5) kullanılır.', en: 'Bu formül İngilizce Excel söz dizimiyle yazıldı: işlev adları İngilizce, ayraç virgül (,), ondalık nokta (3.5). Türkçe Excel’de Türkçe işlev adları ve noktalı virgül (;) gerekir; dil seçeneğiyle çevirebilirsiniz.', ru: 'Bu formül Rusça Excel söz dizimiyle yazıldı: Rusça işlev adları, ayraç noktalı virgül (;), ondalık virgül (3,5).' },
      ru: { ru: 'Синтаксис русского Excel: аргументы разделяются точкой с запятой (;), десятичный разделитель — запятая (3,5). В английском Excel используются запятая (,) и точка (3.5).', en: 'Формула записана в синтаксисе английского Excel: английские имена функций, разделитель — запятая (,), десятичная точка (3.5). В русском Excel нужны русские имена и точка с запятой (;); переключите язык формулы, чтобы перевести её.', tr: 'Формула записана в синтаксисе турецкого Excel: турецкие имена функций, разделитель — точка с запятой (;), десятичная запятая (3,5).' },
      en: { en: 'English Excel syntax: arguments are separated by commas (,) and the decimal separator is a point (3.5). Turkish and Russian Excel use semicolons (;) and a decimal comma (3,5).', tr: 'This formula uses Turkish Excel syntax: Turkish function names, semicolons (;) between arguments and a decimal comma (3,5). English Excel needs English names and commas (,).', ru: 'This formula uses Russian Excel syntax: Russian function names, semicolons (;) between arguments and a decimal comma (3,5). English Excel needs English names and commas (,).' }
    };
    return t[lang][dialect] || t[lang].en;
  }
  function buildTips(root, env, infos) {
    var tips = [], h = helpers(env), seen = {};
    function add(t) { if (!t) return; if (Array.isArray(t)) { t.forEach(add); return; } t = String(t); if (!seen[t]) { seen[t] = 1; tips.push(t); } }
    var doneFn = {};
    walk(root, function (n) {
      if (n.t !== 'func') return;
      var nm = String(n.name).toUpperCase();
      if (doneFn[nm] || !TIPS[nm]) return;
      doneFn[nm] = 1;
      try { add(TIPS[nm](n, env, h)); } catch (e) { /* ignore */ }
    });
    add(genericTips(root, env, infos));
    add(versionTips(infos, env));
    if (hasPlaceholder(root)) add(placeholderTip(env.lang));
    add(separatorTip(env.lang, env.dialect));
    return tips.slice(0, 8);
  }

  /* ------------------------------------------------------------------ */
  /* Public API                                                          */
  /* ------------------------------------------------------------------ */
  function buildSummary(d, env) {
    var lang = env.lang;
    if (d.generic) return d.s;
    if (d.s) {
      var body = d.s;
      if (lang === 'tr') return 'Bu formül, ' + lowerFirst(body, lang);
      if (lang === 'ru') return 'Эта формула ' + lowerFirst(body, lang);
      return 'This formula ' + lowerFirst(body, lang);
    }
    if (lang === 'tr') return 'Bu formül yalnızca ' + d.p.c('acc') + ' verir.';
    if (lang === 'ru') return 'Эта формула просто возвращает ' + d.p.c('acc') + '.';
    return 'This formula simply returns ' + d.p.text + '.';
  }
  explain.explainAST = function (ast, lang, ctx) {
    lang = normLang(lang);
    var env = makeEnv(lang, ctx);
    if (!isNode(ast)) return { summary: '', steps: [], functions: [], tips: [] };
    var root = unwrapParen(ast);
    var d = describe(root, env);
    var names = functionsUsed(root);
    var infos = names.map(function (n) { return functionInfo(n, env); });
    var out = {
      summary: buildSummary(d, env),
      steps: collectSteps(root, env),
      functions: infos,
      tips: buildTips(root, env, infos),
      lang: lang,
      dialect: env.dialect
    };
    if (d.idiom) out.idiom = d.idiom;
    if (d.cond) out.condition = d.cond;
    return out;
  };
  explain.explainFormula = function (text, lang, dialect, ctx) {
    lang = normLang(lang);
    dialect = dialect || 'auto';
    var fr = EFS.formulaReader;
    if (!fr || typeof fr.parse !== 'function') {
      return { error: { tr: 'Formül çözümleyici (EFS.formulaReader) yüklü değil.', ru: 'Модуль разбора формул (EFS.formulaReader) не загружен.', en: 'The formula parser (EFS.formulaReader) is not loaded.' }, position: 0 };
    }
    var src = String(text == null ? '' : text).trim();
    if (!src || src === '=') {
      return { error: { tr: 'Açıklanacak bir formül girilmedi.', ru: 'Формула для объяснения не введена.', en: 'No formula was entered.' }, position: 0 };
    }
    var ast;
    try { ast = fr.parse(src, dialect); }
    catch (e) {
      var msg = e && e.message !== undefined ? e.message : e;
      var m = function (l) { return typeof msg === 'object' && msg ? pick(msg, l) : String(msg || ''); };
      return { error: { tr: 'Formül çözümlenemedi: ' + m('tr'), ru: 'Не удалось разобрать формулу: ' + m('ru'), en: 'Could not parse the formula: ' + m('en') }, position: e && typeof e.position === 'number' ? e.position : null };
    }
    var effective = dialect;
    if (effective === 'auto') {
      effective = 'en';
      try { if (typeof fr.detectDialect === 'function') effective = normDialect(fr.detectDialect(src)); } catch (e2) { effective = 'en'; }
    }
    var ctx2 = {};
    if (ctx) for (var k in ctx) if (Object.prototype.hasOwnProperty.call(ctx, k)) ctx2[k] = ctx[k];
    if (!ctx2.dialect) ctx2.dialect = effective;
    var res = explain.explainAST(ast, lang, ctx2);
    res.ast = ast;
    res.inputDialect = effective;
    return res;
  };
  explain.supported = function () { return Object.keys(TEMPLATES).sort(); };
  explain.idioms = function () { return IDIOMS.map(function (i) { return i.id; }); };
  explain.hasTemplate = function (name) { return !!TEMPLATES[String(name || '').toUpperCase()]; };
  explain.functionInfo = function (name, lang, dialect) { return functionInfo(String(name || '').toUpperCase(), makeEnv(normLang(lang), null, dialect)); };
  explain.MAX_STEPS = MAX_STEPS;
  explain._internal = { trCase: trCase, trPlural: trPlural, ruCase: ruCase, ruGender: ruGender, ruPlural: ruPlural, parseCriteria: parseCriteria, parseRef: parseRef, formatMeaning: formatMeaning, serializeFallback: serializeFallback, makeEnv: makeEnv, describe: describe, Phrase: Phrase };

  EFS.explain = explain;
  return explain;
});
