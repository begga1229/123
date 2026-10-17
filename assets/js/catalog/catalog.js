/* Formula Studio — function catalog: merges the part files and offers lookup/search. */
(function (root, factory) {
  var EFS = root.EFS || (root.EFS = {});
  var api = factory(EFS, root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (EFS, root) {
  'use strict';
  var catalog = {};
  var _list = null, _byName = null, _byLocal = null;

  catalog.categories = [
    { id: 'math',        tr: 'Matematik ve Trigonometri', ru: 'Математические и тригонометрические', en: 'Math & Trig' },
    { id: 'stat',        tr: 'İstatistik',               ru: 'Статистические',                       en: 'Statistical' },
    { id: 'logical',     tr: 'Mantıksal',                ru: 'Логические',                           en: 'Logical' },
    { id: 'lookup',      tr: 'Arama ve Başvuru',         ru: 'Ссылки и массивы',                     en: 'Lookup & Reference' },
    { id: 'text',        tr: 'Metin',                    ru: 'Текстовые',                            en: 'Text' },
    { id: 'date',        tr: 'Tarih ve Saat',            ru: 'Дата и время',                         en: 'Date & Time' },
    { id: 'financial',   tr: 'Finansal',                 ru: 'Финансовые',                           en: 'Financial' },
    { id: 'info',        tr: 'Bilgi',                    ru: 'Информационные',                       en: 'Information' },
    { id: 'database',    tr: 'Veritabanı',               ru: 'Работа с базой данных',                en: 'Database' },
    { id: 'dynamic',     tr: 'Dinamik Diziler',          ru: 'Динамические массивы',                 en: 'Dynamic Arrays' },
    { id: 'engineering', tr: 'Mühendislik',              ru: 'Инженерные',                           en: 'Engineering' },
    { id: 'web',         tr: 'Web',                      ru: 'Веб',                                  en: 'Web' },
    { id: 'cube',        tr: 'Küp',                      ru: 'Куб',                                  en: 'Cube' },
    { id: 'compat',      tr: 'Uyumluluk',                ru: 'Совместимость',                        en: 'Compatibility' }
  ];

  function fold(s) {
    var f = EFS.normalize && EFS.normalize.fold;
    if (f) return f(s);
    return String(s || '').toLowerCase();
  }

  function build() {
    if (_list) return;
    _list = []; _byName = {}; _byLocal = {};
    var parts = EFS.catalogParts || {};
    var keys = Object.keys(parts);
    for (var k = 0; k < keys.length; k++) {
      var arr = parts[keys[k]];
      if (!Array.isArray(arr)) continue;
      for (var i = 0; i < arr.length; i++) {
        var e = arr[i];
        if (!e || !e.name) continue;
        var name = String(e.name).toUpperCase();
        if (_byName[name]) continue; // first definition wins
        e.name = name;
        e.tr = e.tr || name; e.ru = e.ru || name;
        _byName[name] = e;
        _list.push(e);
        var locs = [name, e.tr, e.ru];
        for (var j = 0; j < locs.length; j++) {
          var key = fold(locs[j]);
          if (!_byLocal[key]) _byLocal[key] = e;
        }
      }
    }
    _list.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
  }

  Object.defineProperty(catalog, 'list', { get: function () { build(); return _list; } });

  /** Find by EN/TR/RU name, case- and diacritic-insensitive. */
  catalog.byName = function (name) {
    build();
    if (!name) return null;
    var key = fold(String(name).trim());
    return _byLocal[key] || _byName[String(name).trim().toUpperCase()] || null;
  };
  catalog.has = function (name) { return !!catalog.byName(name); };
  catalog.localName = function (entry, dialect) {
    if (!entry) return '';
    if (dialect === 'tr') return entry.tr || entry.name;
    if (dialect === 'ru') return entry.ru || entry.name;
    return entry.name;
  };
  catalog.byCategory = function (id) { build(); return _list.filter(function (e) { return e.category === id; }); };
  catalog.categoryLabel = function (id, lang) {
    for (var i = 0; i < catalog.categories.length; i++) if (catalog.categories[i].id === id) return catalog.categories[i][lang] || catalog.categories[i].en;
    return id;
  };

  /** Ranked search over names, local names, keywords and descriptions. */
  catalog.search = function (query, lang, limit) {
    build();
    lang = lang || 'tr'; limit = limit || 30;
    var q = fold(String(query || '').trim());
    if (!q) return _list.slice(0, limit);
    var words = q.split(/\s+/).filter(Boolean);
    var scored = [];
    for (var i = 0; i < _list.length; i++) {
      var e = _list[i], score = 0;
      var names = [fold(e.name), fold(e.tr), fold(e.ru)];
      for (var n = 0; n < names.length; n++) {
        if (names[n] === q) score += 100;
        else if (names[n].indexOf(q) === 0) score += 60;
        else if (names[n].indexOf(q) >= 0) score += 35;
      }
      var kws = (e.keywords && (e.keywords[lang] || [])).concat(e.keywords && e.keywords.en || []);
      for (var k = 0; k < kws.length; k++) {
        var kw = fold(kws[k]);
        if (kw === q) score += 50; else if (kw.indexOf(q) >= 0) score += 25;
        else { for (var w = 0; w < words.length; w++) if (words[w].length > 2 && kw.indexOf(words[w]) >= 0) score += 8; }
      }
      var desc = fold(EFS.util.pick(e.desc, lang));
      for (var w2 = 0; w2 < words.length; w2++) if (words[w2].length > 2 && desc.indexOf(words[w2]) >= 0) score += 5;
      if (score > 0) scored.push({ e: e, s: score });
    }
    scored.sort(function (a, b) { return b.s - a.s || (a.e.name < b.e.name ? -1 : 1); });
    return scored.slice(0, limit).map(function (x) { return x.e; });
  };

  catalog.count = function () { build(); return _list.length; };
  catalog.reset = function () { _list = null; _byName = null; _byLocal = null; };

  EFS.catalog = catalog;
  return catalog;
});
