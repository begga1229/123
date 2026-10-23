/* Formula Studio — localize (EFS.localize): EN ↔ TR ↔ RU function names, separators, decimals,
 * boolean and error literals, formula translation and dialect detection. See docs/ARCHITECTURE.md §5.
 * Maps are built lazily from EFS.catalog.list plus the EXTRA table below (catalog wins on conflicts). */
(function (root, factory) {
  var EFS = root.EFS || (root.EFS = {});
  var api = factory(EFS, root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (EFS, root) {
  'use strict';
  var localize = {};

  localize.dialects = ['en', 'tr', 'ru'];
  localize.separator = function (dialect) { return dialect === 'tr' || dialect === 'ru' ? ';' : ','; };
  localize.decimal = function (dialect) { return dialect === 'tr' || dialect === 'ru' ? ',' : '.'; };
  localize.arraySeparators = function (dialect) {
    if (dialect === 'tr') return { col: '\\', row: ';' };
    if (dialect === 'ru') return { col: ';', row: ':' };
    return { col: ',', row: ';' };
  };
  localize.dialectName = function (dialect, lang) {
    var names = {
      en: { tr: 'İngilizce', ru: 'Английский', en: 'English' },
      tr: { tr: 'Türkçe', ru: 'Турецкий', en: 'Turkish' },
      ru: { tr: 'Rusça', ru: 'Русский', en: 'Russian' }
    };
    var n = names[dialect] || names.en;
    return n[lang] || n.en;
  };

  /* ------------------------------------------------------------------ folding */
  /** Lowercase + strip diacritics (Turkish-aware: İ/I/ı → i; ё → е). Keeps Cyrillic letters. */
  function fold(s) {
    s = String(s == null ? '' : s);
    s = s.replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i');
    s = s.toLowerCase();
    if (typeof s.normalize === 'function') s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    s = s.replace(/ё/g, 'е').replace(/ø/g, 'o').replace(/ß/g, 'ss').replace(/æ/g, 'ae').replace(/œ/g, 'oe').replace(/đ/g, 'd').replace(/ł/g, 'l');
    return s;
  }
  localize.fold = fold;

  /** Turkish-aware uppercase (i → İ, ı → I). */
  function upperTR(s) { return String(s == null ? '' : s).replace(/i/g, 'İ').replace(/ı/g, 'I').toUpperCase(); }
  localize.upper = function (s, dialect) {
    s = String(s == null ? '' : s);
    if (dialect === 'tr' || /[çğıİöşüÇĞÖŞÜ]/.test(s)) return upperTR(s);
    return s.toUpperCase();
  };

  /* ------------------------------------------------------------------ EXTRA table: EN|TR|RU */
  // Safety net so localization works even when a catalog part is missing. Catalog entries override these.
  var EXTRA_RAW = [
    // --- math & trig
    'SUM|TOPLA|СУММ', 'SUMIF|ETOPLA|СУММЕСЛИ', 'SUMIFS|ÇOKETOPLA|СУММЕСЛИМН', 'SUMPRODUCT|TOPLA.ÇARPIM|СУММПРОИЗВ',
    'SUMSQ|TOPKARE|СУММКВ', 'PRODUCT|ÇARPIM|ПРОИЗВЕД', 'ABS|MUTLAK|ABS', 'MOD|MOD|ОСТАТ', 'INT|TAMSAYI|ЦЕЛОЕ',
    'TRUNC|NSAT|ОТБР', 'ROUND|YUVARLA|ОКРУГЛ', 'ROUNDUP|YUKARIYUVARLA|ОКРУГЛВВЕРХ', 'ROUNDDOWN|AŞAĞIYUVARLA|ОКРУГЛВНИЗ',
    'MROUND|KYUVARLA|ОКРУГЛТ', 'CEILING|TAVANAYUVARLA|ОКРВВЕРХ', 'CEILING.MATH|TAVANAYUVARLA.MATEMATİK|ОКРВВЕРХ.МАТ',
    'FLOOR|TABANAYUVARLA|ОКРВНИЗ', 'FLOOR.MATH|TABANAYUVARLA.MATEMATİK|ОКРВНИЗ.МАТ', 'EVEN|ÇİFT|ЧЁТН', 'ODD|TEK|НЕЧЁТ',
    'SQRT|KAREKÖK|КОРЕНЬ', 'POWER|KUVVET|СТЕПЕНЬ', 'EXP|ÜS|EXP', 'LN|LN|LN', 'LOG|LOG|LOG', 'LOG10|LOG10|LOG10',
    'PI|Pİ|ПИ', 'RAND|S_SAYI_ÜRET|СЛЧИС', 'RANDBETWEEN|RASTGELEARADA|СЛУЧМЕЖДУ', 'RANDARRAY|RASGDİZİ|СЛУЧМАССИВ',
    'SIGN|İŞARET|ЗНАК', 'GCD|OBEB|НОД', 'LCM|OKEK|НОК', 'FACT|ÇARPINIM|ФАКТР', 'QUOTIENT|BÖLÜM|ЧАСТНОЕ',
    'SUBTOTAL|ALTTOPLAM|ПРОМЕЖУТОЧНЫЕ.ИТОГИ', 'AGGREGATE|TOPLAMA|АГРЕГАТ', 'SEQUENCE|SIRALI|ПОСЛЕД',
    'COMBIN|KOMBİNASYON|ЧИСЛКОМБ', 'DEGREES|DERECE|ГРАДУСЫ', 'RADIANS|RADYAN|РАДИАНЫ', 'ROMAN|ROMEN|РИМСКОЕ',
    'ARABIC|ARAP|АРАБСКОЕ', 'SIN|SİN|SIN', 'COS|COS|COS', 'TAN|TAN|TAN', 'ASIN|ASİN|ASIN', 'ACOS|ACOS|ACOS',
    'ATAN|ATAN|ATAN', 'ATAN2|ATAN2|ATAN2', 'MDETERM|DETERMİNANT|МОПРЕД', 'MMULT|DÇARP|МУМНОЖ', 'MINVERSE|DİZEY_TERS|МОБР',
    // --- statistical
    'AVERAGE|ORTALAMA|СРЗНАЧ', 'AVERAGEA|ORTALAMAA|СРЗНАЧА', 'AVERAGEIF|EĞERORTALAMA|СРЗНАЧЕСЛИ',
    'AVERAGEIFS|ÇOKEĞERORTALAMA|СРЗНАЧЕСЛИМН', 'COUNT|BAĞ_DEĞ_SAY|СЧЁТ', 'COUNTA|BAĞ_DEĞ_DOLU_SAY|СЧЁТЗ',
    'COUNTBLANK|BOŞLUKSAY|СЧИТАТЬПУСТОТЫ', 'COUNTIF|EĞERSAY|СЧЁТЕСЛИ', 'COUNTIFS|ÇOKEĞERSAY|СЧЁТЕСЛИМН',
    'MAX|MAK|МАКС', 'MAXA|MAKA|МАКСА', 'MIN|MİN|МИН', 'MINA|MİNA|МИНА', 'MAXIFS|ÇOKEĞERMAK|МАКСЕСЛИ',
    'MINIFS|ÇOKEĞERMİN|МИНЕСЛИ', 'MEDIAN|ORTANCA|МЕДИАНА', 'MODE|ENÇOK_OLAN|МОДА', 'MODE.SNGL|ENÇOK_OLAN.TEK|МОДА.ОДН',
    'MODE.MULT|ENÇOK_OLAN.ÇOK|МОДА.НСК', 'LARGE|BÜYÜK|НАИБОЛЬШИЙ', 'SMALL|KÜÇÜK|НАИМЕНЬШИЙ', 'RANK|RANK|РАНГ',
    'RANK.EQ|RANK.EŞİT|РАНГ.РВ', 'RANK.AVG|RANK.ORT|РАНГ.СР', 'STDEV|STDSAPMA|СТАНДОТКЛОН', 'STDEV.S|STDSAPMA.S|СТАНДОТКЛОН.В',
    'STDEV.P|STDSAPMA.P|СТАНДОТКЛОН.Г', 'STDEVP|STDSAPMAS|СТАНДОТКЛОНП', 'STDEVA|STDSAPMAA|СТАНДОТКЛОНА',
    'VAR|VAR|ДИСП', 'VAR.S|VAR.S|ДИСП.В', 'VAR.P|VAR.P|ДИСП.Г', 'VARP|VARS|ДИСПР', 'VARA|VARA|ДИСПА',
    'PERCENTILE|YÜZDEBİRLİK|ПЕРСЕНТИЛЬ', 'PERCENTILE.INC|YÜZDEBİRLİK.DHL|ПРОЦЕНТИЛЬ.ВКЛ',
    'PERCENTILE.EXC|YÜZDEBİRLİK.HRC|ПРОЦЕНТИЛЬ.ИСКЛ', 'QUARTILE|DÖRTTEBİRLİK|КВАРТИЛЬ',
    'QUARTILE.INC|DÖRTTEBİRLİK.DHL|КВАРТИЛЬ.ВКЛ', 'QUARTILE.EXC|DÖRTTEBİRLİK.HRC|КВАРТИЛЬ.ИСКЛ',
    'PERCENTRANK|YÜZDERANK|ПРОЦЕНТРАНГ', 'PERCENTRANK.INC|YÜZDERANK.DHL|ПРОЦЕНТРАНГ.ВКЛ',
    'CORREL|KORELASYON|КОРРЕЛ', 'PEARSON|PEARSON|ПИРСОН', 'RSQ|RKARE|КВПИРСОН', 'FORECAST|TAHMİN|ПРЕДСКАЗ',
    'FORECAST.LINEAR|TAHMİN.DOĞRUSAL|ПРЕДСКАЗ.ЛИНЕЙН', 'TREND|EĞİLİM|ТЕНДЕНЦИЯ', 'GROWTH|BÜYÜME|РОСТ',
    'SLOPE|EĞİM|НАКЛОН', 'INTERCEPT|KESMENOKTASI|ОТРЕЗОК', 'LINEST|DOT|ЛИНЕЙН', 'LOGEST|LOT|ЛГРФПРИБЛ',
    'GEOMEAN|GEOORT|СРГЕОМ', 'HARMEAN|HARORT|СРГАРМ', 'FREQUENCY|SIKLIK|ЧАСТОТА', 'NORM.DIST|NORM.DAĞ|НОРМ.РАСП',
    'NORM.S.DIST|NORM.S.DAĞ|НОРМ.СТ.РАСП', 'NORM.INV|NORM.TERS|НОРМ.ОБР', 'NORMDIST|NORMDAĞ|НОРМРАСП',
    'NORMSDIST|NORMSDAĞ|НОРМСТРАСП', 'NORMINV|NORMTERS|НОРМОБР', 'COVARIANCE.P|KOVARYANS.P|КОВАРИАЦИЯ.Г',
    'COVARIANCE.S|KOVARYANS.S|КОВАРИАЦИЯ.В', 'COVAR|KOVARYANS|КОВАР', 'AVEDEV|ORTSAP|СРОТКЛ', 'DEVSQ|SAPKARE|КВАДРОТКЛ',
    'KURT|BASIKLIK|ЭКСЦЕСС', 'SKEW|ÇARPIKLIK|СКОС', 'PERMUT|PERMÜTASYON|ПЕРЕСТ', 'TRIMMEAN|KIRPORTALAMA|УРЕЗСРЕДНЕЕ',
    'STANDARDIZE|STANDARTLAŞTIRMA|НОРМАЛИЗАЦИЯ', 'CONFIDENCE|GÜVENİRLİK|ДОВЕРИТ', 'CONFIDENCE.NORM|GÜVENİLİRLİK.NORM|ДОВЕРИТ.НОРМ',
    'BINOM.DIST|BİNOM.DAĞ|БИНОМ.РАСП', 'BINOMDIST|BİNOMDAĞ|БИНОМРАСП', 'POISSON.DIST|POISSON.DAĞ|ПУАССОН.РАСП',
    'POISSON|POISSON|ПУАССОН', 'EXPON.DIST|ÜSTEL.DAĞ|ЭКСП.РАСП', 'EXPONDIST|ÜSTELDAĞ|ЭКСПРАСП',
    'T.TEST|T.TEST|СТЬЮДЕНТ.ТЕСТ', 'TTEST|TTEST|ТТЕСТ', 'CHISQ.TEST|KİKARE.TEST|ХИ2.ТЕСТ', 'CHITEST|KİKARETEST|ХИ2ТЕСТ',
    'CRITBINOM|KRİTİKBİNOM|КРИТБИНОМ',
    // --- logical
    'IF|EĞER|ЕСЛИ', 'IFS|ÇOKEĞER|ЕСЛИМН', 'IFERROR|EĞERHATA|ЕСЛИОШИБКА', 'IFNA|EĞERYOKSA|ЕСНД', 'AND|VE|И',
    'OR|YADA|ИЛИ', 'NOT|DEĞİL|НЕ', 'XOR|ÖZELVEYA|ИСКЛИЛИ', 'TRUE|DOĞRU|ИСТИНА', 'FALSE|YANLIŞ|ЛОЖЬ',
    'SWITCH|İLKEŞLEŞEN|ПЕРЕКЛЮЧ', 'LET|LET|LET', 'LAMBDA|LAMBDA|LAMBDA',
    // --- lookup & reference / dynamic arrays
    'VLOOKUP|DÜŞEYARA|ВПР', 'HLOOKUP|YATAYARA|ГПР', 'XLOOKUP|ÇAPRAZARA|ПРОСМОТРX', 'LOOKUP|ARA|ПРОСМОТР',
    'INDEX|İNDİS|ИНДЕКС', 'MATCH|KAÇINCI|ПОИСКПОЗ', 'XMATCH|ÇAPRAZEŞLEŞTİR|ПОИСКПОЗX', 'CHOOSE|ELEMAN|ВЫБОР',
    'OFFSET|KAYDIR|СМЕЩ', 'INDIRECT|DOLAYLI|ДВССЫЛ', 'ROW|SATIR|СТРОКА', 'COLUMN|SÜTUN|СТОЛБЕЦ', 'ROWS|SATIRSAY|ЧСТРОК',
    'COLUMNS|SÜTUNSAY|ЧИСЛСТОЛБ', 'ADDRESS|ADRES|АДРЕС', 'AREAS|ALANSAY|ОБЛАСТИ', 'TRANSPOSE|DEVRİK_DÖNÜŞÜM|ТРАНСП',
    'HYPERLINK|KÖPRÜ|ГИПЕРССЫЛКА', 'UNIQUE|BENZERSİZ|УНИК', 'FILTER|FİLTRE|ФИЛЬТР', 'SORT|SIRALA|СОРТ',
    'SORTBY|SIRALAKRİTER|СОРТПО', 'TAKE|AL|ВЗЯТЬ', 'DROP|BIRAK|СБРОСИТЬ', 'CHOOSECOLS|SÜTUNSEÇ|ВЫБОРСТОЛБЦ',
    'CHOOSEROWS|SATIRSEÇ|ВЫБОРСТРОК', 'VSTACK|DÜŞEYYIĞ|ВСТОЛБИК', 'HSTACK|YATAYYIĞ|ГСТОЛБИК', 'TOCOL|SÜTUNA|ПОСТОЛБЦ',
    'TOROW|SATIRA|ПОСТРОК', 'WRAPROWS|SATIRSAR|СВЕРНСТРОК', 'WRAPCOLS|SÜTUNSAR|СВЕРНСТОЛБЦ', 'EXPAND|GENİŞLET|РАЗВЕРНУТЬ',
    'GETPIVOTDATA|ÖZETVERİAL|ПОЛУЧИТЬ.ДАННЫЕ.СВОДНОЙ.ТАБЛИЦЫ', 'FORMULATEXT|FORMÜLMETNİ|Ф.ТЕКСТ', 'RTD|RTD|ДРВ',
    // --- text
    'LEFT|SOLDAN|ЛЕВСИМВ', 'RIGHT|SAĞDAN|ПРАВСИМВ', 'MID|PARÇAAL|ПСТР', 'LEN|UZUNLUK|ДЛСТР', 'TRIM|KIRP|СЖПРОБЕЛЫ',
    'CLEAN|TEMİZ|ПЕЧСИМВ', 'UPPER|BÜYÜKHARF|ПРОПИСН', 'LOWER|KÜÇÜKHARF|СТРОЧН', 'PROPER|YAZIM.DÜZENİ|ПРОПНАЧ',
    'CONCATENATE|BİRLEŞTİR|СЦЕПИТЬ', 'CONCAT|ARALIKBİRLEŞTİR|СЦЕП', 'TEXTJOIN|METİNBİRLEŞTİR|ОБЪЕДИНИТЬ',
    'TEXT|METNEÇEVİR|ТЕКСТ', 'VALUE|SAYIYAÇEVİR|ЗНАЧЕН', 'NUMBERVALUE|SAYIDEĞERİ|ЧЗНАЧ', 'SUBSTITUTE|YERİNEKOY|ПОДСТАВИТЬ',
    'REPLACE|DEĞİŞTİR|ЗАМЕНИТЬ', 'FIND|BUL|НАЙТИ', 'SEARCH|MBUL|ПОИСК', 'REPT|YİNELE|ПОВТОР', 'EXACT|ÖZDEŞ|СОВПАД',
    'CHAR|DAMGA|СИМВОЛ', 'CODE|KOD|КОДСИМВ', 'UNICHAR|UNICODEKARAKTERİ|ЮНИСИМВ', 'UNICODE|UNICODE|ЮНИКОД',
    'FIXED|SAYIDÜZENLE|ФИКСИРОВАННЫЙ', 'DOLLAR|LİRA|РУБЛЬ', 'T|M|Т', 'N|S|Ч', 'TEXTBEFORE|METİNÖNCESİ|ТЕКСТДО',
    'TEXTAFTER|METİNSONRASI|ТЕКСТПОСЛЕ', 'TEXTSPLIT|METİNBÖL|ТЕКСТРАЗД', 'ARRAYTOTEXT|DİZİMETNİ|МАССИВВТЕКСТ',
    'VALUETOTEXT|DEĞERMETNİ|ЗНАЧЕНИЕВТЕКСТ',
    // --- date & time
    'TODAY|BUGÜN|СЕГОДНЯ', 'NOW|ŞİMDİ|ТДАТА', 'DATE|TARİH|ДАТА', 'TIME|ZAMAN|ВРЕМЯ', 'YEAR|YIL|ГОД', 'MONTH|AY|МЕСЯЦ',
    'DAY|GÜN|ДЕНЬ', 'HOUR|SAAT|ЧАС', 'MINUTE|DAKİKA|МИНУТЫ', 'SECOND|SANİYE|СЕКУНДЫ', 'DATEDIF|ETARİHLİ|РАЗНДАТ',
    'EDATE|SERİTARİH|ДАТАМЕС', 'EOMONTH|SERİAY|КОНМЕСЯЦА', 'NETWORKDAYS|TAMİŞGÜNÜ|ЧИСТРАБДНИ',
    'NETWORKDAYS.INTL|TAMİŞGÜNÜ.ULUSL|ЧИСТРАБДНИ.МЕЖД', 'WORKDAY|İŞGÜNÜ|РАБДЕНЬ', 'WORKDAY.INTL|İŞGÜNÜ.ULUSL|РАБДЕНЬ.МЕЖД',
    'WEEKDAY|HAFTANINGÜNÜ|ДЕНЬНЕД', 'WEEKNUM|HAFTASAY|НОМНЕДЕЛИ', 'ISOWEEKNUM|ISOHAFTASAY|НОМНЕДЕЛИ.ISO', 'DAYS|GÜNSAY|ДНИ',
    'DAYS360|GÜN360|ДНЕЙ360', 'DATEVALUE|TARİHSAYISI|ДАТАЗНАЧ', 'TIMEVALUE|ZAMANSAYISI|ВРЕМЗНАЧ', 'YEARFRAC|YILORAN|ДОЛЯГОДА',
    // --- information
    'ISBLANK|EBOŞSA|ЕПУСТО', 'ISNUMBER|ESAYIYSA|ЕЧИСЛО', 'ISTEXT|EMETİNSE|ЕТЕКСТ', 'ISNONTEXT|EMETİNDEĞİLSE|ЕНЕТЕКСТ',
    'ISERROR|EHATALIYSA|ЕОШИБКА', 'ISERR|EHATA|ЕОШ', 'ISNA|EYOKSA|ЕНД', 'ISLOGICAL|EMANTIKSALSA|ЕЛОГИЧ', 'ISREF|EREFSE|ЕССЫЛКА',
    'ISEVEN|ÇİFTMİ|ЕЧЁТН', 'ISODD|TEKMİ|ЕНЕЧЁТ', 'ISFORMULA|EFORMÜLSE|ЕФОРМУЛА', 'NA|YOKSAY|НД', 'ERROR.TYPE|HATA.TİPİ|ТИП.ОШИБКИ',
    'TYPE|TÜR|ТИП', 'CELL|HÜCRE|ЯЧЕЙКА', 'INFO|BİLGİ|ИНФОРМ', 'SHEET|SAYFA|ЛИСТ', 'SHEETS|SAYFALAR|ЛИСТЫ',
    // --- financial
    'PMT|DEVRESEL_ÖDEME|ПЛТ', 'IPMT|FAİZTUTARI|ПРПЛТ', 'PPMT|ANA_PARA_ÖDEMESİ|ОСПЛТ', 'FV|GD|БС', 'PV|BD|ПС', 'NPV|NBD|ЧПС',
    'XNPV|ANBD|ЧИСТНЗ', 'IRR|İÇ_VERİM_ORANI|ВСД', 'XIRR|AİÇVERİMORANI|ЧИСТВНДОХ', 'MIRR|D_İÇ_VERİM_ORANI|МВСД',
    'RATE|FAİZ_ORANI|СТАВКА', 'NPER|TAKSİT_SAYISI|КПЕР', 'SLN|DA|АПЛ', 'DB|AZALANBAKİYE|ФУО', 'DDB|ÇİFTAZALANBAKİYE|ДДОБ',
    'SYD|YAT|АСЧ', 'EFFECT|ETKİN|ЭФФЕКТ', 'NOMINAL|NOMİNAL|НОМИНАЛ', 'CUMIPMT|TOPÖDENENFAİZ|ОБЩПЛАТ', 'CUMPRINC|TOPANAPARA|ОБЩДОХОД',
    // --- database
    'DSUM|VSEÇTOPLA|БДСУММ', 'DCOUNT|VSEÇSAY|БСЧЁТ', 'DCOUNTA|VSEÇSAYDOLU|БСЧЁТА', 'DAVERAGE|VSEÇORT|ДСРЗНАЧ',
    'DMAX|VSEÇMAK|ДМАКС', 'DMIN|VSEÇMİN|ДМИН', 'DGET|VAL|БИЗВЛЕЧЬ', 'DPRODUCT|VSEÇÇARP|БДПРОИЗВЕД',
    // --- engineering / web
    'CONVERT|ÇEVİR|ПРЕОБР', 'DEC2BIN|DEC2BIN|ДЕС.В.ДВ', 'BIN2DEC|BIN2DEC|ДВ.В.ДЕС', 'DEC2HEX|DEC2HEX|ДЕС.В.ШЕСТН',
    'HEX2DEC|HEX2DEC|ШЕСТН.В.ДЕС', 'ENCODEURL|URLKODLA|КОДИР.URL', 'WEBSERVICE|WEBHİZMETİ|ВЕБСЛУЖБА', 'FILTERXML|FİLTREXML|ФИЛЬТР.XML'
  ];

  var EXTRA = null;
  function extraTable() {
    if (EXTRA) return EXTRA;
    EXTRA = [];
    for (var i = 0; i < EXTRA_RAW.length; i++) {
      var p = EXTRA_RAW[i].split('|');
      EXTRA.push({ name: p[0], tr: p[1] || p[0], ru: p[2] || p[0] });
    }
    return EXTRA;
  }
  Object.defineProperty(localize, 'EXTRA', { get: extraTable });

  /* ------------------------------------------------------------------ lazy maps */
  var _maps = null, _builtWithCount = -1;
  function catalogCount() {
    var cat = EFS.catalog;
    if (!cat) return 0;
    try { return typeof cat.count === 'function' ? cat.count() : (cat.list ? cat.list.length : 0); } catch (e) { return 0; }
  }
  function maps() {
    var cnt = catalogCount();
    if (_maps && _builtWithCount === cnt) return _maps;
    var m = { en: {}, trFold: {}, ruFold: {}, enFold: {} };
    function add(name, tr, ru) {
      name = String(name).toUpperCase();
      tr = tr ? String(tr) : name; ru = ru ? String(ru) : name;
      m.en[name] = { en: name, tr: tr, ru: ru };
      m.enFold[fold(name)] = name;
      m.trFold[fold(tr)] = name;
      m.ruFold[fold(ru)] = name;
    }
    var extra = extraTable();
    for (var i = 0; i < extra.length; i++) add(extra[i].name, extra[i].tr, extra[i].ru);
    var cat = EFS.catalog;
    if (cat && cat.list) {
      var list = cat.list;
      for (var j = 0; j < list.length; j++) {
        var e = list[j];
        if (e && e.name) add(e.name, e.tr, e.ru);   // catalog overrides EXTRA
      }
    }
    _maps = m; _builtWithCount = cnt;
    return m;
  }
  localize.reset = function () { _maps = null; _builtWithCount = -1; };

  function stripPrefix(name) {
    name = String(name == null ? '' : name).trim();
    return name.replace(/^_xl(?:fn|ws|pm|udf)\./i, '');
  }

  /** EN name → local name for the dialect (falls back to EN). */
  localize.toDialect = function (nameEN, dialect) {
    var name = stripPrefix(nameEN).toUpperCase();
    if (!name) return '';
    if (dialect !== 'tr' && dialect !== 'ru') return name;
    var entry = maps().en[name];
    if (entry) return entry[dialect] || name;
    var cat = EFS.catalog;
    if (cat && typeof cat.byName === 'function') {
      var ce = cat.byName(name);
      if (ce) return (dialect === 'tr' ? ce.tr : ce.ru) || ce.name;
    }
    return name;
  };

  /** Any-dialect name → EN canonical name, or null when unknown (case/diacritic-insensitive). */
  localize.toEN = function (localName) {
    var raw = stripPrefix(localName);
    if (!raw) return null;
    var m = maps();
    var up = raw.toUpperCase();
    if (m.en[up]) return up;
    var f = fold(raw);
    if (m.enFold[f]) return m.enFold[f];
    if (m.trFold[f]) return m.trFold[f];
    if (m.ruFold[f]) return m.ruFold[f];
    var cat = EFS.catalog;
    if (cat && typeof cat.byName === 'function') {
      var ce = cat.byName(raw);
      if (ce) return ce.name;
    }
    return null;
  };

  localize.isKnown = function (name) { return localize.toEN(name) !== null; };
  /** EN name → { en, tr, ru } (falls back to EN for unknown names). */
  localize.names = function (nameEN) {
    var name = stripPrefix(nameEN).toUpperCase();
    var entry = maps().en[name];
    if (entry) return { en: entry.en, tr: entry.tr, ru: entry.ru };
    return { en: name, tr: localize.toDialect(name, 'tr'), ru: localize.toDialect(name, 'ru') };
  };
  /** Which dialect a given function name belongs to: 'en' | 'tr' | 'ru' | null (unknown). Shared names return 'en'. */
  localize.nameDialect = function (localName) {
    var raw = stripPrefix(localName);
    if (!raw) return null;
    var m = maps();
    var f = fold(raw);
    if (m.enFold[f]) return 'en';
    if (m.trFold[f]) return 'tr';
    if (m.ruFold[f]) return 'ru';
    return null;
  };

  /* ------------------------------------------------------------------ booleans and errors */
  var BOOLS = { en: ['TRUE', 'FALSE'], tr: ['DOĞRU', 'YANLIŞ'], ru: ['ИСТИНА', 'ЛОЖЬ'] };
  localize.BOOLS = BOOLS;
  localize.boolName = function (b, dialect) {
    if (typeof b === 'string') b = localize.boolToEN(b) === 'TRUE';
    var pair = BOOLS[dialect] || BOOLS.en;
    return b ? pair[0] : pair[1];
  };
  /** 'DOĞRU' / 'истина' / 'true' → 'TRUE' | 'FALSE' | null. */
  localize.boolToEN = function (text) {
    var f = fold(text);
    if (f === 'true' || f === 'dogru' || f === 'истина') return 'TRUE';
    if (f === 'false' || f === 'yanlis' || f === 'ложь') return 'FALSE';
    return null;
  };

  var ERRORS = [
    { en: '#N/A',          tr: '#YOK',            ru: '#Н/Д' },
    { en: '#VALUE!',       tr: '#DEĞER!',         ru: '#ЗНАЧ!' },
    { en: '#REF!',         tr: '#BAŞV!',          ru: '#ССЫЛКА!' },
    { en: '#DIV/0!',       tr: '#SAYI/0!',        ru: '#ДЕЛ/0!' },
    { en: '#NAME?',        tr: '#AD?',            ru: '#ИМЯ?' },
    { en: '#NUM!',         tr: '#SAYI!',          ru: '#ЧИСЛО!' },
    { en: '#NULL!',        tr: '#BOŞ!',           ru: '#ПУСТО!' },
    { en: '#SPILL!',       tr: '#TAŞMA!',         ru: '#ПЕРЕНОС!' },
    { en: '#CALC!',        tr: '#HESAP!',         ru: '#ВЫЧИСЛ!' },
    { en: '#GETTING_DATA', tr: '#VERİ_ALINIYOR',  ru: '#ПОЛУЧЕНИЕ_ДАННЫХ' }
  ];
  localize.ERRORS = ERRORS;
  var _errFold = null;
  function errFoldMap() {
    if (_errFold) return _errFold;
    _errFold = {};
    for (var i = 0; i < ERRORS.length; i++) {
      _errFold[fold(ERRORS[i].en)] = ERRORS[i];
      _errFold[fold(ERRORS[i].tr)] = ERRORS[i];
      _errFold[fold(ERRORS[i].ru)] = ERRORS[i];
    }
    return _errFold;
  }
  /** Any-dialect error literal → EN literal, or null. */
  localize.errToEN = function (text) {
    var e = errFoldMap()[fold(String(text == null ? '' : text).trim())];
    return e ? e.en : null;
  };
  localize.errName = function (err, dialect) {
    var e = errFoldMap()[fold(String(err == null ? '' : err).trim())];
    if (!e) return String(err == null ? '' : err);
    return e[dialect] || e.en;
  };
  /** All error literals of every dialect, longest first (used by the tokenizer). */
  localize.allErrorLiterals = function () {
    var out = [];
    for (var i = 0; i < ERRORS.length; i++) out.push(ERRORS[i].en, ERRORS[i].tr, ERRORS[i].ru);
    out.sort(function (a, b) { return b.length - a.length; });
    return out;
  };

  /* ------------------------------------------------------------------ formula-level helpers */
  /** Translate a formula between dialects (via EFS.formulaReader.parse + EFS.ast.serialize). */
  localize.translateFormula = function (formulaText, fromDialect, toDialect) {
    var fr = EFS.formulaReader, A = EFS.ast;
    if (!fr || !A) throw new Error('EFS.formulaReader / EFS.ast are not loaded');
    var text = String(formulaText == null ? '' : formulaText);
    var tree = fr.parse(text, fromDialect || 'auto');
    var withEquals = /^\s*=/.test(text);
    return A.serialize(tree, { dialect: toDialect || 'en', withEquals: withEquals });
  };

  var RE_STRING = /"(?:[^"]|"")*"/g;
  var RE_QSHEET = /'(?:[^']|'')*'!/g;
  var ID_START = 'A-Za-z_\\\\À-ÖØ-öø-ɏͰ-ϿЀ-ӿ';
  var RE_FUNC_NAMES = new RegExp('([' + ID_START + '][' + ID_START + '0-9.]*)\\s*\\(', 'g');
  var RE_IDENTS = new RegExp('(^|[^' + ID_START + '0-9.!])([' + ID_START + '][' + ID_START + '0-9.]*)(?![' + ID_START + '0-9.]|\\s*[(!\\[])', 'g');

  /** Heuristic dialect detection from function names, literals and separators (no parsing required). */
  localize.detectDialect = function (formulaText) {
    var text = String(formulaText == null ? '' : formulaText).replace(RE_STRING, '""').replace(RE_QSHEET, "'S'!");
    var tr = 0, ru = 0, en = 0, mm;
    RE_FUNC_NAMES.lastIndex = 0;
    while ((mm = RE_FUNC_NAMES.exec(text))) scoreName(mm[1], 3, 2, 1);
    RE_IDENTS.lastIndex = 0;
    while ((mm = RE_IDENTS.exec(text))) {
      var b = localize.boolToEN(mm[2]);
      if (!b) continue;
      var f = fold(mm[2]);
      if (f === 'dogru' || f === 'yanlis') tr += 2;
      else if (f === 'истина' || f === 'ложь') ru += 2;
      else en += 1;
    }
    var errs = localize.allErrorLiterals();
    for (var i = 0; i < errs.length; i++) {
      if (text.toUpperCase().indexOf(errs[i].toUpperCase()) < 0) continue;
      var e = errFoldMap()[fold(errs[i])];
      if (errs[i] === e.en) en += 1; else if (errs[i] === e.tr) tr += 2; else ru += 2;
    }
    if (/\{[^}]*\\[^}]*\}/.test(text)) tr += 2;                 // {1\2;3\4}
    if (/\{[^}]*;[^}]*:[^}]*\}/.test(text) && !/\\/.test(text)) ru += 1; // {1;2:3;4}
    var outside = text.replace(/\{[^}]*\}/g, '{}');          // array constants have their own separators
    var semi = /;/.test(outside);
    var decimalComma = /\d,\d/.test(outside);
    if (ru > 0 && ru >= tr) return 'ru';
    if (tr > 0) return 'tr';
    if (semi && decimalComma) return 'tr';   // EN names but ';' + decimal comma → a TR/RU-locale sheet; TR is the primary audience
    return 'en';

    function scoreName(name, strong, medium, weak) {
      name = stripPrefix(name);
      if (/[Ѐ-ӿ]/.test(name)) { ru += strong; return; }
      if (/[çğıİöşüÇĞÖŞÜ]/.test(name)) { tr += strong; return; }
      var m = maps(), f = fold(name);
      var enName = m.enFold[f], trName = m.trFold[f], ruName = m.ruFold[f];
      if (enName) {
        var entry = m.en[enName];
        if (entry && (fold(entry.tr) !== f || fold(entry.ru) !== f)) en += weak;
        return;
      }
      if (trName) { tr += medium; return; }
      if (ruName) { ru += medium; }
    }
  };

  EFS.localize = localize;
  return localize;
});
