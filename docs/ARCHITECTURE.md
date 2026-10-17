# Formula Studio — Architecture & Module Contracts

Offline Excel formula assistant. User types a request in **Turkish or Russian** (English also accepted),
the app generates the Excel formula, explains it, and can write it into an uploaded workbook.
No network access at runtime: every library is vendored under `assets/js/vendor/`.

## Hard rules for every module

1. **Plain ES2019 JavaScript, classic `<script>` tags.** No ES modules, no TypeScript, no build step,
   no `import`/`export`, no top-level `await`. The app must work when `index.html` is opened via `file://`.
2. **No network.** No CDN links, no fetch to the internet, no Google Fonts. System font stack only.
3. **Every module uses the UMD-lite wrapper** so it works both in the browser and in Node tests:

```js
(function (root, factory) {
  var EFS = root.EFS || (root.EFS = {});
  var api = factory(EFS, root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (EFS, root) {
  'use strict';
  var normalize = {};          // the module object
  // ... implementation ...
  EFS.normalize = normalize;   // attach to namespace
  return normalize;
});
```

4. **Resolve cross-module dependencies lazily at call time** (`EFS.catalog.byName(...)` inside functions),
   never at file load time, so load order inside a group does not matter.
5. **Never trust file or user content.** The UI must escape every string before putting it in HTML
   (`textContent`, or an `esc()` helper). Header names from uploaded files are attacker-controlled text.
6. **All user-facing strings are trilingual** `{ tr, ru, en }`. Turkish and Russian must be natural and
   correctly spelled (proper Turkish characters ç ğ ı İ ö ş ü, proper Cyrillic incl. ё where usual).
7. Each module owns exactly the files listed below. Do not edit other modules' files.
8. Self-check: `node -e "require('./assets/js/<file>.js')"` must not throw (after loading prerequisites).

## File layout and load order (index.html loads in this order)

```
assets/js/vendor/xlsx.full.min.js          SheetJS 0.18.5  (global XLSX)          — read xls/xlsx/csv/ods
assets/js/vendor/exceljs.min.js            ExcelJS 4.4.0   (global ExcelJS)       — read/write xlsx preserving styles
assets/js/vendor/formula-parser.min.js     hot-formula-parser 4 (global formulaParser.Parser) — evaluate formulas for preview
assets/js/core/namespace.js                EFS namespace, tiny shared helpers
assets/js/i18n/strings.js                  EFS.i18n   UI strings tr/ru/en
assets/js/catalog/part-math.js             EFS.catalogParts.math
assets/js/catalog/part-stat.js             EFS.catalogParts.stat
assets/js/catalog/part-logic-lookup-text.js EFS.catalogParts.logicLookupText
assets/js/catalog/part-date-fin-info-db.js EFS.catalogParts.dateFinInfoDb
assets/js/catalog/part-eng-web-cube-compat.js EFS.catalogParts.engWebCubeCompat
assets/js/catalog/catalog.js               EFS.catalog (merges parts, search, lookup)
assets/js/nlp/normalize.js                 EFS.normalize
assets/js/nlp/lexicon.js                   EFS.lexicon
assets/js/engine/ast.js                    EFS.ast
assets/js/engine/localize.js               EFS.localize
assets/js/engine/formula-reader.js         EFS.formulaReader
assets/js/engine/explain.js                EFS.explain
assets/js/nlp/parser.js                    EFS.parser
assets/js/nlp/intents.js                   EFS.intents (core: registry, helpers, rank)
assets/js/nlp/intents-aggregate.js         registers intents via EFS.intents.register([...])
assets/js/nlp/intents-logic.js             registers intents via EFS.intents.register([...])
assets/js/nlp/intents-lookup.js            registers intents via EFS.intents.register([...])
assets/js/nlp/intents-text.js              registers intents via EFS.intents.register([...])
assets/js/nlp/intents-date.js              registers intents via EFS.intents.register([...])
assets/js/nlp/intents-math.js              registers intents via EFS.intents.register([...])
assets/js/nlp/intents-finance-array.js     registers intents via EFS.intents.register([...])
assets/js/engine/generate.js               EFS.generate
assets/js/workbook/workbook.js             EFS.workbook
assets/js/workbook/evaluator.js            EFS.evaluator
assets/js/ui/app.js                        EFS.ui (boot on DOMContentLoaded)
assets/css/app.css
index.html
tests/run.js, tests/cases.tr.json, tests/cases.ru.json, tests/cases.en.json, tests/dialect-cases.json
tests/fixtures/contexts.js (shared test contexts), tests/fixtures/make-samples.js (creates sample xlsx files)
tests/smoke.js (Playwright smoke test)
```

Node test loading: `require` each file in the order above (skip vendor + ui for engine tests). The wrapper
attaches to `globalThis.EFS`, so all modules see each other.

---

## 1. Catalog (`EFS.catalogParts.*` → merged by `EFS.catalog`)

Each part file sets `EFS.catalogParts.<key> = [ entry, ... ]`. **Entry shape:**

```js
{
  name: 'SUMIF',                 // canonical English name, UPPERCASE (as typed in English Excel)
  tr: 'ETOPLA',                  // Turkish Excel function name (exactly as Excel shows it; keep EN name if Excel does not localize it)
  ru: 'СУММЕСЛИ',                // Russian Excel function name (same rule)
  category: 'math',              // 'math'|'stat'|'logical'|'lookup'|'text'|'date'|'financial'|'info'|'database'|'engineering'|'dynamic'|'web'|'cube'|'compat'
  syntax: 'SUMIF(range, criteria, [sum_range])',   // English syntax; optional args in [ ]
  args: [                        // one per parameter, in order
    { name: 'range', tr: 'aralık', ru: 'диапазон', optional: false,
      desc: { tr: 'Koşulun uygulanacağı hücre aralığı', ru: 'Диапазон ячеек, к которому применяется условие', en: 'The range the criteria is applied to' } }
  ],
  desc: { tr: '...', ru: '...', en: '...' },           // one clear sentence: what it returns
  example: { formula: 'SUMIF(A2:A10,">100")',           // English dialect, no leading '='
             tr: 'A2:A10 içinde 100’den büyük değerleri toplar', ru: 'Суммирует значения больше 100 в A2:A10', en: 'Sums values greater than 100 in A2:A10' },
  keywords: { tr: ['koşullu toplam', 'şarta göre topla'], ru: ['сумма по условию', 'суммировать если'], en: ['conditional sum'] },
  minVersion: '2007',            // optional: '2007'|'2010'|'2013'|'2016'|'2019'|'2021'|'365'
  volatile: false,               // optional
  uncertain: ['tr']              // optional: list of locales whose name you are not sure about
}
```

`EFS.catalog` API (catalog.js, already written):
- `catalog.list` → merged array
- `catalog.byName(name)` → entry or null; accepts EN/TR/RU names, case/diacritic-insensitive
- `catalog.search(query, lang, limit)` → ranked entries (name, local name, keywords, desc)
- `catalog.categories` → `[{id, tr, ru, en}]`
- `catalog.localName(entry, dialect)`.

## 2. Normalize (`EFS.normalize`)

```js
normalize.detectLanguage(text) → 'tr'|'ru'|'en'        // Cyrillic → ru; Turkish letters/keywords → tr; else heuristic (default 'tr' if ambiguous and no clear English words)
normalize.lower(text, lang)      // Turkish-aware for 'tr' (İ→i, I→ı); standard otherwise
normalize.fold(text)             // lowercase + strip diacritics for fuzzy compare: ç→c ğ→g ı→i ö→o ş→s ü→u, ё→е, ä→a etc. Keeps Cyrillic.
normalize.stem(word, lang)       // light suffix stripping (TR: -ların/-lerin, -ları/-leri, -lar/-ler, -nın/-nin/-nun/-nün, -ın/-in/-un/-ün, -ı/-i/-u/-ü, -dan/-den/-tan/-ten, -da/-de/-ta/-te, -ya/-ye/-a/-e, -yla/-yle/-la/-le, -daki/-deki, -sı/-si/-su/-sü, -ki ...; RU: -ами/-ями/-ов/-ев/-ей/-ой/-ый/-ий/-ая/-яя/-ое/-ее/-ые/-ие/-ого/-его/-ому/-ему/-ом/-ем/-ах/-ях/-у/-ю/-а/-я/-ы/-и/-е/-о/-ь/-ть/-ите/-йте ...). Keep min stem length 3.
normalize.tokenize(text, lang)   → [{ raw, norm, start, end }]   // norm = lower(raw); splits on whitespace & punctuation but keeps: cell refs (A1, $A$1, A1:B10, A:A, 1:1, Sayfa1!A1, 'Лист 1'!A1:B2), numbers (3,5 / 3.5 / 1.000,50 / 10% / %10 / -4), quoted strings ("..." '...' «...» “...”), ordinals (2. / 2-й / 2nd), function names with dots (STDEV.S, ОКРУГЛ)
normalize.similarity(a, b)       → 0..1 (Levenshtein ratio on folded strings)
normalize.startsWithStem(word, stem)  → boolean (folded prefix match; stem length ≥ 3, word may have suffixes)
normalize.isCyrillic(text), normalize.hasTurkishChars(text)
```

## 3. Lexicon (`EFS.lexicon`)

Maps words/phrases in TR / RU / EN to **concept IDs**. Intent matching works on concepts, never on raw words.

```js
lexicon.CONCEPTS          // array of all concept ids (strings)
lexicon.lookup(tokenNorm, lang) → [{ concept, weight }]    // single token → concepts (stem prefix match + exact)
lexicon.matchPhrases(tokens, lang) → [{ concept, weight, start, end }]   // multi-word phrases (token index span, end exclusive), longest match first, non-overlapping
lexicon.numberWord(tokenNorm, lang) → number|null         // 'üç'→3, 'три'→3, 'ilk'→null, 'yüz'→100, 'bin'→1000
lexicon.ordinal(tokenNorm, lang) → number|null            // 'ikinci'→2, '2.'→2, 'второй'→2, '3-й'→3, 'первый'→1
lexicon.comparator(tokensNorm, lang) ...                  // optional helper used by parser
lexicon.phrases                                            // raw data table, exported for inspection
```

**Concept IDs (fixed list — parser and intents depend on these exact strings):**

Aggregates: `SUM AVERAGE COUNT COUNT_NONEMPTY COUNT_EMPTY MAX MIN MEDIAN MODE STDEV VARIANCE PRODUCT RANK NTH_LARGEST NTH_SMALLEST COUNT_UNIQUE SUBTOTAL TOTAL`
Logic: `IF THEN ELSE OTHERWISE AND OR NOT CONDITION`
Comparators: `GT GTE LT LTE EQ NEQ BETWEEN CONTAINS STARTS_WITH ENDS_WITH EMPTY NOT_EMPTY IS_NUMBER IS_TEXT IS_ERROR IS_DATE POSITIVE NEGATIVE ZERO EVEN ODD DUPLICATE`
Lookup: `LOOKUP FIND_VALUE RETURN TABLE COLUMN ROW SHEET FIRST_MATCH LAST_MATCH EXACT_MATCH APPROX_MATCH NOT_FOUND MATCH_POSITION INDEX_HINT VLOOKUP_HINT HLOOKUP_HINT XLOOKUP_HINT INDEX_MATCH_HINT`
Text: `CONCAT JOIN_WITH SPLIT LEFT_CHARS RIGHT_CHARS MID_CHARS CHARACTER LENGTH TRIM CLEAN UPPER LOWER PROPER REPLACE SUBSTITUTE FIND_TEXT REPEAT TEXT_FORMAT TO_NUMBER TO_TEXT EXTRACT_BEFORE EXTRACT_AFTER FIRST LAST WORD SPACE COMMA DASH SEPARATOR NAME SURNAME EMAIL DOMAIN PHONE`
Date/time: `TODAY NOW DATE TIME YEAR MONTH DAY WEEKDAY WEEKNUM QUARTER HOUR MINUTE SECOND DATE_DIFF AGE ADD ADD_DAYS ADD_MONTHS ADD_YEARS END_OF_MONTH START_OF_MONTH WORKDAY NETWORKDAYS DAYS_UNIT WEEKS_UNIT MONTHS_UNIT YEARS_UNIT HOURS_UNIT MINUTES_UNIT DATE_FORMAT DEADLINE REMAINING ELAPSED BIRTHDAY HOLIDAYS`
Math: `PLUS MINUS MULTIPLY DIVIDE PERCENT PERCENT_OF PERCENT_CHANGE SHARE RATIO ROUND ROUND_UP ROUND_DOWN DECIMALS ABS MOD POWER SQRT INT CEILING FLOOR RANDOM RANDOM_BETWEEN SIGN LOG EXP DIFFERENCE INCREASE DECREASE VAT DISCOUNT PRICE QUANTITY TAX NET GROSS AMOUNT UNIT MULTIPLE NEAREST`
Finance: `LOAN PAYMENT INTEREST_RATE PERIODS PRESENT_VALUE FUTURE_VALUE NPV IRR DEPRECIATION PRINCIPAL INTEREST ANNUAL MONTHLY YEARLY INSTALLMENT`
Errors/output: `IFERROR BLANK ERROR SHOW HIDE RESULT VALUE INSTEAD`
Arrays: `UNIQUE FILTER SORT ASC DESC SEQUENCE TRANSPOSE REMOVE_DUPLICATES TOP_N BOTTOM_N LIST ALL_MATCHES`
Structure: `RANGE_FROM RANGE_TO WHOLE_COLUMN WHOLE_ROW CELL ALL EACH_ROW IN FROM TO WITH WITHOUT BY FOR HEADER DATA WRITE TARGET NEW_COLUMN`
Meta: `HELP EXPLAIN TRANSLATE HOW_TO EXAMPLE FORMULA FUNCTION_WORD`

Lexicon entries are **stems** (prefix match, folded) or exact **phrases** (array of stems). Example data style:

```js
{ concept: 'SUM', tr: ['topla', 'toplam', 'toplamı', 'toplayarak'], ru: ['сумм', 'сложи', 'суммир', 'итог'], en: ['sum', 'total', 'add up'] }
{ concept: 'GTE', tr: [['büyük', 'eşit'], ['büyük', 'veya', 'eşit'], 've üzeri', 'en az'], ru: [['больше', 'или', 'равно'], 'не менее', 'от'], en: ['at least', '>='] }
```

## 4. AST (`EFS.ast`)

```js
// node types
{ t:'func', name:'SUMIF', args:[node...] }           // name = canonical EN
{ t:'ref', ref:'A2:A10', sheet:'Sayfa2'|undefined }  // ref text as written in EN dialect, may include $; sheet quoted automatically on output when needed
{ t:'num', v:100 }
{ t:'str', v:'Yüksek' }
{ t:'bool', v:true }
{ t:'err', v:'#N/A' }
{ t:'op', op:'+'|'-'|'*'|'/'|'^'|'&'|'='|'<>'|'<'|'>'|'<='|'>=', left:node, right:node }
{ t:'unary', op:'-'|'+', arg:node }
{ t:'percent', arg:node }                             // postfix %
{ t:'paren', arg:node }
{ t:'array', rows:[[node,...], ...] }
{ t:'name', name:'TaxRate' }                          // named range / structured ref kept verbatim
{ t:'placeholder', slot:'range', label:{tr,ru,en} }  // unresolved slot; serialized as «label» in the chosen UI language

ast.func(name, ...args) ast.ref(text, sheet) ast.num(v) ast.str(v) ast.bool(v) ast.op(op,l,r) ast.unary(op,a) ast.paren(a) ast.array(rows) ast.name(n) ast.placeholder(slot,label) ast.err(v)
ast.serialize(node, { dialect:'en'|'tr'|'ru', withEquals:true, uiLang:'tr' }) → string
   // dialect 'en': names EN, arg separator ',', decimal '.', array col ',' row ';'
   // dialect 'tr': names TR (via EFS.localize), separator ';', decimal ',', array col '\' row ';'   (Turkish Excel)
   // dialect 'ru': names RU, separator ';', decimal ',', array col ';' row ':'
   // booleans: TRUE/FALSE → DOĞRU/YANLIŞ (tr) / ИСТИНА/ЛОЖЬ (ru); strings: escape " as ""; sheet names quoted when they contain spaces/non-ASCII or start with a digit: 'Satış Raporu'!A1
   // operator precedence: add parentheses only where needed (ast.paren nodes are kept as written)
ast.walk(node, fn) ast.clone(node) ast.functionsUsed(node) → ['SUMIF',...] ast.refsUsed(node) → [{ref, sheet}]
ast.hasPlaceholders(node)
```

## 5. Localize (`EFS.localize`)

```js
localize.dialects = ['en','tr','ru']
localize.separator(dialect)  → ',' | ';'
localize.decimal(dialect)    → '.' | ','
localize.toDialect(nameEN, dialect) → local name (falls back to EN)
localize.toEN(localName)     → EN name or null (searches TR and RU maps, case/diacritic-insensitive)
localize.boolName(bool, dialect), localize.errName(err, dialect)   // #N/A → #YOK (tr) / #Н/Д (ru), #VALUE! → #DEĞER! / #ЗНАЧ!, #REF! → #BAŞV! / #ССЫЛКА!, #DIV/0! → #SAYI/0! / #ДЕЛ/0!, #NAME? → #AD? / #ИМЯ?, #NUM! → #SAYI! / #ЧИСЛО!, #NULL! → #BOŞ! / #ПУСТО!
localize.translateFormula(formulaText, fromDialect|'auto', toDialect) → string   // via EFS.formulaReader.parse + ast.serialize
localize.detectDialect(formulaText) → 'en'|'tr'|'ru'
```
Maps are built lazily from `EFS.catalog.list` (name/tr/ru). Add an `EXTRA` table for any names missing from the catalog.

## 6. Formula reader (`EFS.formulaReader`)

Parses an Excel formula string (any dialect) into the AST above.

```js
formulaReader.tokenize(text, dialect) → [{ type:'func'|'ref'|'num'|'str'|'bool'|'err'|'op'|'lparen'|'rparen'|'sep'|'lbrace'|'rbrace'|'rowsep'|'colsep'|'name'|'percent'|'ws', value, start, end }]
formulaReader.parse(text, dialect|'auto') → AST   // throws { message, position } on syntax error; leading '=' optional
formulaReader.detectDialect(text) → 'en'|'tr'|'ru'   // from function names / separators / decimal commas
formulaReader.shiftRefs(ast, rowDelta, colDelta) → new AST  // moves relative refs only ($ parts fixed). Used for filling a column.
formulaReader.shiftFormula(text, rowDelta, colDelta, dialect) → string
formulaReader.listRefs(text, dialect) → [{ref, sheet}]
```
Must handle: numbers with dialect decimal (`3,5` in tr/ru), strings with doubled quotes, `'Sheet name'!A1:B2`, `Sheet1!A:A`, `$A$1`, `A1:B2`, named ranges, `TRUE/DOĞRU/ИСТИНА`, errors, `%` postfix, unary minus, `^` right-assoc, `&`, comparison operators, array constants `{1,2;3,4}` (`{1\2;3\4}` tr, `{1;2:3;4}` ru), `@` implicit intersection and `#` spill marks (keep as part of ref text), structured refs `Table1[Col]` / `[@Col]` kept as `name` nodes, whitespace, nested functions, empty args (`IF(A1,,B1)` → empty arg = `{t:'empty'}` node, serialized as nothing).

## 7. Explain (`EFS.explain`)

```js
explain.explainAST(ast, lang, ctx) → {
  summary: 'A2:A10 aralığında 100’den büyük değerlerin toplamını verir.',   // one or two sentences in lang
  steps: [ { formula: 'SUMIF(A2:A10;">100")', text: '…' }, ... ],          // inner-to-outer or outer-to-inner breakdown, formula text in dialect given by ctx.dialect
  functions: [ { name:'SUMIF', local:'ETOPLA', desc:'...', syntax:'...' } ], // every function used, with catalog data in lang
  tips: [ '…' ]                                                             // optional: version requirements, pitfalls (e.g. VLOOKUP needs sorted data when approx)
}
explain.explainFormula(text, lang, dialect|'auto', ctx) → same (parses first; on error returns { error:{tr,ru,en}, position })
explain.describeRef(refNode, lang, ctx) → 'A2:A10 aralığı' / 'диапазон A2:A10' / with header name when ctx.headers knows the column: '“Tutar” sütunu (E2:E200)'
```
High-quality templates for the ~40 most common functions (IF, IFS, AND, OR, NOT, IFERROR, SUM, SUMIF(S), COUNT(A/IF/IFS/BLANK), AVERAGE(IF/IFS), MAX/MIN(IFS), VLOOKUP, HLOOKUP, XLOOKUP, INDEX, MATCH, LEFT/RIGHT/MID, LEN, TRIM, UPPER/LOWER/PROPER, CONCAT/CONCATENATE/TEXTJOIN, TEXT, VALUE, ROUND(UP/DOWN), TODAY, NOW, DATE, DATEDIF, YEAR/MONTH/DAY, EOMONTH, EDATE, NETWORKDAYS, WORKDAY, RANK, LARGE, SMALL, SUMPRODUCT, UNIQUE, FILTER, SORT, SUBSTITUTE, FIND, SEARCH, PMT, operators). Generic fallback for the rest using catalog `desc` + arg names.

## 8. Parser (`EFS.parser`)

```js
parser.parse(text, ctx) → ParsedQuery
ctx = {   // from EFS.workbook (may be null when no file loaded)
  sheetName: 'Satışlar', sheets: ['Satışlar','Ürünler'], headerRow: 1, firstDataRow: 2, lastRow: 200,
  headers: [ { name:'Tutar', col:'E', index:5, type:'number'|'text'|'date'|'bool'|'mixed'|'empty', dataRange:'E2:E200', range:'E1:E200', sample:[12.5, 30] } ],
  otherSheets: { 'Ürünler': { headers:[...], firstDataRow, lastRow } },
  activeCell: 'F2' | null
}
ParsedQuery = {
  lang, text,
  tokens: [ { raw, norm, stem, start, end, type:'word'|'number'|'ref'|'string'|'percent'|'ordinal'|'function'|'punct', value, concepts:[{concept,weight}], consumed:false } ],
  literals: [ { value:'Yüksek', tokenIndex } ],                      // quoted strings in order
  numbers:  [ { value:100, raw:'100', isPercent:false, tokenIndex } ],
  refs: [ { text:'E2:E200', kind:'cell'|'range'|'column'|'row', sheet:null|'Ürünler', col:'E', col2:'E', row:2, row2:200,
            source:'explicit'|'header'|'default'|'active', headerName:'Tutar', tokenIndex, span:[start,end] } ],
  concepts: [ { concept:'SUM', weight:1, tokenIndex, start, end } ],   // ordered by position; phrases included
  conditions: [ { ref, op:'>'|'<'|'>='|'<='|'='|'<>'|'contains'|'startsWith'|'endsWith'|'empty'|'notEmpty'|'between', value, value2, valueRef, conjunction:'AND'|'OR'|null, position } ],
  explicitFunctions: [ 'VLOOKUP' ],                                   // function names the user typed (EN canonical), any dialect
  thenValue: { kind:'str'|'num'|'ref'|'blank', value } | null,        // "… ise X" / "… то X"
  elseValue: { ... } | null,                                           // "değilse Y" / "иначе Y"
  target: { col:'F', cell:'F2', range:'F2:F200' } | null,              // "F sütununa yaz" / "в столбец F" / "F2'ye"
  flags: { wholeColumn:false, eachRow:false, ignoreErrors:false, caseSensitive:false, question:false },
  has(concept) → boolean, firstRef(kind?) , numericRefs(), textRefs(), conceptOrder()   // convenience methods
}
```
Header resolution: match 1–4 token windows against `ctx.headers[].name` (folded, stem-aware, similarity ≥ 0.8 or stem prefix of every word) → `refs` with `source:'header'` and `text = dataRange`. Prefer the longest match. Explicit refs always win over header matches on the same span.
Column letters alone ("A sütunu", "столбец B", "колонка C", "B kolonu") → `kind:'column'`, text `B:B`, but when ctx is present convert to `B{firstDataRow}:B{lastRow}` (keep `wholeColumn` flag true so intents can choose).
Ranges in words: "A1'den A10'a kadar", "от A1 до A10", "A1 ile A10 arası" → `A1:A10`.
Conditions: look for `ref/number/literal` + comparator concept + `number/literal/ref` in either order (TR puts comparator after: "100'den büyük", RU before: "больше 100"). Also "boş olan"/"пустые" → `empty`; "içeren"/"содержит" → contains.

## 9. Intents (`EFS.intents`)

```js
intents.list → [ IntentDef ]
IntentDef = {
  id: 'sum_if',
  category: 'aggregate'|'logic'|'lookup'|'text'|'date'|'math'|'finance'|'array'|'error'|'meta',
  title: { tr, ru, en },
  examples: { tr: ['Tutar sütununu Kategori "Gıda" olanlar için topla'], ru: ['Сумма по столбцу Сумма где Категория = "Еда"'], en: [...] },
  match(pq, ctx, opts) → number 0..1,          // 0 = no match
  build(pq, ctx, opts) → Candidate | Candidate[] | null
}
Candidate = {
  intent: 'sum_if', confidence: 0.86,
  ast: AST,
  explain: { tr, ru, en },                      // one sentence describing the result (explain.js adds the breakdown)
  assumptions: [ { tr, ru, en } ],              // what was guessed (default range, sheet, etc.)
  missing:     [ { slot:'range', tr:'Hangi aralık toplanacak?', ru:'Какой диапазон суммировать?', en:'Which range to sum?', options:[{label, value}] } ],
  target: { kind:'cell'|'fill', cell:'F2', fillRange:'F2:F200' } | null,   // where to put it; 'fill' = per-row formula
  tags: ['365'],                                 // '365' when requires dynamic arrays; 'volatile'; 'array' (CSE in old Excel)
  alternatives: [ Candidate ]                    // optional lower-ranked variants (e.g., VLOOKUP vs XLOOKUP)
}
intents.rank(pq, ctx, opts) → Candidate[] sorted by confidence desc (top 5)
opts = { style:'modern'|'classic', dialect, uiLang }
```
Rules: when `opts.style==='classic'` (or excelVersion < 2021) use VLOOKUP / INDEX+MATCH / SUMPRODUCT instead of XLOOKUP / UNIQUE / FILTER; when 'modern' prefer XLOOKUP, FILTER, UNIQUE, TEXTJOIN, IFS, MAXIFS. Always produce a formula; use `placeholder` nodes for genuinely missing slots and fill `missing[]`. Per-row formulas (IF on each row, text transforms, dates) use the first data row (`ctx.firstDataRow`) and `target.kind='fill'`.

## 10. Generate (`EFS.generate`)

```js
generate.run(text, ctx, opts) → Result
opts = { dialect:'en'|'tr'|'ru', uiLang:'tr'|'ru'|'en', style:'modern'|'classic' }
Result = {
  kind: 'formula'|'explain'|'translate'|'help'|'empty',
  lang, text,
  candidates: [ { ...Candidate, formula:'=ETOPLA(E2:E200;">100")', formulaEN:'=SUMIF(E2:E200,">100")', explanation: <explain.explainAST result in uiLang> } ],
  best: candidates[0] | null,
  message: { tr, ru, en } | null,     // e.g. for 'empty' or when nothing matched (then kind='help' with catalog suggestions)
  suggestions: [ catalogEntry ... ],  // for 'help' kind: matching functions
  pq: ParsedQuery                     // for debugging / UI chips
}
```
Modes: text starting with `=` → `explain` (also offers translations to the other two dialects). "X nasıl kullanılır / как использовать X / X formülü" with a function name → `help` (catalog card + template candidate from syntax). Otherwise intents.

## 11. Workbook (`EFS.workbook`)

```js
workbook.load(fileOrBuffer, fileName) → Promise<WorkbookModel>     // xlsx/xlsm via ExcelJS (styles preserved); xls/csv/ods via SheetJS → converted to an ExcelJS workbook (values only)
WorkbookModel = { name, engine:'exceljs'|'sheetjs', sheets:[SheetModel], activeIndex:0, exceljs: <ExcelJS.Workbook>, warnings:[{tr,ru,en}] }
SheetModel = { name, index, rowCount, colCount, usedRange:'A1:BF1000', headerRow, firstDataRow, lastRow,
               headers:[{ name, col, index, type, dataRange, range, sample:[] }],
               getCell(addr) → { v, f, t:'n'|'s'|'d'|'b'|'e'|'z' , display:'…' } , 
               rows(start, count) → [[display,...]],            // for preview grid, 1-based start
               toContext() → ctx (see §8) }
workbook.detectHeaderRow(sheetModel) // heuristic: scan first 30 rows; pick the first row with ≥3 non-empty cells where ≥60% are text, that is followed by a row with ≥1 numeric/date or different-typed value; fallback 1. Handles title blocks and merged cells (like a 'Детализированная ведомость' with headers on row 10).
workbook.applyFormula(wb, sheetIndex, target, formulaEN, options) → { written:[addresses], count }
   // target: { cell:'F2' } writes one formula; { fillRange:'F2:F200', anchorRow:2 } writes the formula to every row shifting relative refs via EFS.formulaReader.shiftRefs (anchorRow = row the formula was authored for)
   // options.header: optional header text to write into row headerRow if the target column is empty there
   // formulas stored in EN dialect (Excel file format is always EN names + ',' separators)
workbook.exportBlob(wb) → Promise<Blob>      // sets fullCalcOnLoad so Excel recalculates; keeps styles when engine is exceljs
workbook.download(blob, fileName)
workbook.columnLetter(n), workbook.columnIndex('AB'), workbook.splitAddress('F12') → {col:'F', row:12}, workbook.parseRange('A1:B9')
```

## 12. Evaluator (`EFS.evaluator`)

```js
evaluator.evaluate(formulaEN, sheetModel, workbookModel) → { value, error:null|'#NAME?'|'unsupported'|..., supported:true|false }
evaluator.preview(formulaEN, sheetModel, workbookModel, { fillRange, anchorRow, rows: 5 }) → [{ address, formula, value, error }]
```
Uses `formulaParser.Parser` with `callCellValue`/`callRangeValue` reading from the sheet model (cross-sheet refs via workbookModel). Unsupported functions report `supported:false` instead of throwing.

## 13. UI (`EFS.ui`) — index.html, assets/css/app.css, assets/js/ui/app.js, assets/js/i18n/strings.js

Layout (desktop ≥ 1100px: three columns; tablet: two; phone: stacked, 16px gutters, no horizontal scroll):
- **Top bar**: app name, "Çevrimdışı / Офлайн" badge, UI language (TR / RU / EN), Excel dialect for output (EN / TR / RU function names), style (Modern 365 / Klasik), theme toggle (dark default, light), help.
- **Left: Çalışma kitabı** panel — drag & drop / browse (`.xlsx .xlsm .xls .csv .ods`), sheet tabs, header-row selector (auto-detected, editable), grid preview (first 30 rows, column letters, detected header highlighted, type icons), click a column header to insert its reference into the prompt, "download modified file" button, warnings.
- **Center: Formül Stüdyosu** — big prompt box (Enter = generate, Shift+Enter newline), auto-detected language chip, example chips (from `EFS.intents.list[].examples`), result card: formula with syntax highlighting (functions, refs, strings, numbers), copy button, dialect switch per card, confidence + assumptions + missing-slot chips (clicking a header chip re-runs with that range), explanation (summary, steps, functions used), preview of computed values for the first rows (evaluator), target selector (cell / fill column) + "Apply to workbook" button, alternatives list, history (localStorage, try/catch).
- **Right: Kütüphane** tabs — (a) Function library: search + category filter over `EFS.catalog`, card = name in 3 dialects, syntax, desc, args, example, "insert template" button; (b) Explain/Translate: paste any formula → explanation + translations between EN/TR/RU; (c) Recipes: the intents list with examples.
- Toasts for copy/apply/download; keyboard-accessible; `prefers-reduced-motion` respected; focus styles visible.
Design: CSS custom properties on `:root`, dark theme default (`[data-theme]`), light theme; accent `#2e7d5b`-ish green (Excel-like) with neutral surfaces; system fonts; inline SVG icons only; no images.

## 14. Tests

- `tests/fixtures/contexts.js` exports `{ tr: ctx, ru: ctx, en: ctx, none: null }` (already written — do not change).
- `tests/cases.tr.json` / `cases.ru.json` / `cases.en.json`: `[ { "id": "tr-001", "text": "...", "ctx": "tr"|"none", "expect": "=SUMIF(E2:E200,\">100\")" | ["=A","=B"], "style": "modern"|"classic", "note": "..." } ]`. Expected formulas are EN dialect. Comparison: strip all whitespace, compare case-insensitively; pass if the **best** candidate equals any `expect`; "soft" when another top-5 candidate matches.
- `tests/dialect-cases.json`: `[ { "en": "=SUMIF(A1:A5,\">3,5\")", "tr": "...", "ru": "..." } ]` for translateFormula round-trips.
- `tests/run.js`: `node tests/run.js [--only tr] [--verbose]`, loads modules in the documented order, prints pass/soft/fail counts and a failure table; exit code 1 on any hard failure below the threshold given by `--min 0.9`.
- `tests/smoke.js`: Playwright (chromium at `/opt/pw-browsers`, `executablePath` fallback) opens `index.html` via `file://`, uploads `tests/fixtures/sample-tr.xlsx`, types a prompt, asserts a formula card appears, applies the formula, triggers download, screenshots to `tests/screenshots/`.

---

## 15. Formula conventions (shared truth for intents, explain, UI and tests)

All generated formulas are first produced in the **EN dialect** (`formulaEN`), then rendered to the chosen dialect.

1. **Ranges from headers.** With a workbook context, a column named by its header or by its letter becomes its data range (`E2:E200`), never the whole column, unless the user explicitly says the whole column ("tüm sütun", "bütün E sütunu", "весь столбец", "столбец целиком") → `E:E`.
   Without a context, "E sütunu / столбец E" → `E:E`; explicit refs are used verbatim.
2. **Per-row ("fill") formulas** are authored for the first data row (`ctx.firstDataRow`, default 2): `=IF(E2>100,"Yüksek","Düşük")`, `target.kind='fill'`, `fillRange` = target column rows firstDataRow..lastRow. In fill formulas, whole data ranges referenced as lookup tables / totals are **fully absolute**: `$E$2:$E$200`, `Ürünler!$A$2:$C$50`. Single per-row cells stay relative (`E2`). Aggregate (single-cell) formulas use relative ranges: `=SUM(E2:E200)`.
3. **Target column** when the user does not say: the first empty column after the last header (`ctx.headers.length + 1`), e.g. `N2:N200` in the test contexts; without ctx → `target = null`.
4. **Conditional aggregates.** One condition → `SUMIF/COUNTIF/AVERAGEIF`; two or more → `SUMIFS/COUNTIFS/AVERAGEIFS`. Max/min with conditions → `MAXIFS/MINIFS` (classic style: `MAX(IF(...))`). Criteria rendering: number comparisons `">100"`, `"<=5"`, `"<>0"`; text equality → the text itself `"Gıda"`; not equal text → `"<>Gıda"`; contains → `"*gıda*"`; starts with → `"gıda*"`; ends with → `"*gıda"`; empty → `""`; not empty → `"<>"`; comparison with a cell → `">"&B2`; dates → `">"&DATE(2024,1,1)` when a date literal is given, or `">"&F2` for a cell. SUMIF argument order: `SUMIF(criteria_range, criteria, sum_range)`; SUMIFS: `SUMIFS(sum_range, crit_range1, crit1, ...)` in the order conditions appear in the text.
5. **IF.** `=IF(cond,then,else)`. Missing then/else → TR `"Evet"/"Hayır"`, RU `"Да"/"Нет"`, EN `"Yes"/"No"`; "boş bırak / оставь пустым / leave blank" → `""`. Multiple ordered conditions ("…ise A, …ise B, değilse C") → `IFS(c1,A,c2,B,TRUE,C)` in modern style, nested `IF` in classic. "ve / и / and" → `AND(...)`, "veya / или / or" → `OR(...)`. Between (`arasında` / `между` / `от X до Y`) → `AND(E2>=X,E2<=Y)`.
6. **Lookups.** Modern: `=XLOOKUP(A2,Ürünler!$A$2:$A$50,Ürünler!$C$2:$C$50,"Bulunamadı")` (not-found text only when the user asks; default RU `"Не найдено"`, TR `"Bulunamadı"`, EN `"Not found"`). Classic: `=VLOOKUP(A2,Ürünler!$A$2:$C$50,3,FALSE)` or `INDEX/MATCH` when the return column is left of the key or the user says INDEX/MATCH. Lookup table from the other sheet in ctx: headers of `ctx.otherSheets[name]`; return column index = position of the return header in that sheet. Sheet names are quoted only when they contain spaces or punctuation or start with a digit (`'Satış Raporu'!A1`, but `Ürünler!A1`, `Продажи!A1`).
7. **Text.** first N chars → `LEFT(A2,N)`; last N → `RIGHT(A2,N)`; from position p take n → `MID(A2,p,n)`; length → `LEN(A2)`; trim → `TRIM(A2)`; upper/lower/proper → `UPPER/LOWER/PROPER`; join two cells with space → `A2&" "&B2`; join a range with separator → `TEXTJOIN(", ",TRUE,range)`; replace text X with Y → `SUBSTITUTE(A2,"X","Y")`; first word → `LEFT(A2,FIND(" ",A2&" ")-1)`; last word → `TRIM(RIGHT(SUBSTITUTE(A2," ",REPT(" ",100)),100))`; text before "@" → `LEFT(L2,FIND("@",L2)-1)`; domain after "@" → `MID(L2,FIND("@",L2)+1,255)` (modern: `TEXTAFTER(L2,"@")` / `TEXTBEFORE`); contains check → `ISNUMBER(SEARCH("x",A2))`; number from text → `VALUE(A2)`; number to text with format → `TEXT(A2,"0.00")`; remove spaces entirely → `SUBSTITUTE(A2," ","")`.
8. **Dates.** today → `TODAY()`; now → `NOW()`; age from birth date → `DATEDIF(K2,TODAY(),"Y")`; days between two dates → `B2-A2` (later minus earlier; with headers, the later/“end” column minus the earlier/“start”); months → `DATEDIF(A2,B2,"M")`; years → `DATEDIF(A2,B2,"Y")`; days until a date/deadline → `F2-TODAY()`; days since → `TODAY()-F2`; add N days → `F2+N`; add N months → `EDATE(F2,N)`; add N years → `EDATE(F2,12*N)`; end of month → `EOMONTH(F2,0)`; start of month → `EOMONTH(F2,-1)+1`; year/month/day → `YEAR(F2)/MONTH(F2)/DAY(F2)`; quarter → `ROUNDUP(MONTH(F2)/3,0)`; weekday name → `TEXT(F2,"dddd")`; month name → `TEXT(F2,"mmmm")`; working days between → `NETWORKDAYS(A2,B2)`; add N workdays → `WORKDAY(F2,N)`; week number → `WEEKNUM(F2)`; is weekend → `WEEKDAY(F2,2)>5`; date from parts → `DATE(y,m,d)`; overdue flag → `IF(F2<TODAY(),"Gecikti","")`.
9. **Math.** percent of value → `E2*10%`; X percent increase → `E2*(1+10%)`; decrease / discount → `E2*(1-10%)`; share of total → `E2/SUM($E$2:$E$200)`; percent change → `(E2-D2)/D2`; VAT add (TR KDV %20 default, RU НДС 20%) → `E2*1.2`, VAT amount → `E2*20%`; round → `ROUND(E2,2)` (default 2 decimals; "tam sayıya" / "до целого" → 0); round up/down → `ROUNDUP/ROUNDDOWN`; absolute → `ABS`; remainder → `MOD(a,b)`; power → `a^b` (or `POWER` when asked); sqrt → `SQRT`; average of two cells → `AVERAGE(A2,B2)`; difference → `B2-A2`; multiply columns → `C2*D2`; running total → `SUM($E$2:E2)`; rank → `RANK.EQ(E2,$E$2:$E$200,0)` (ascending when asked: `,1`); nth largest → `LARGE(E2:E200,n)`; nth smallest → `SMALL(E2:E200,n)`; count unique → modern `ROWS(UNIQUE(A2:A200))`, classic `SUMPRODUCT(1/COUNTIF(A2:A200,A2:A200))`; duplicate flag → `IF(COUNTIF($A$2:$A$200,A2)>1,"Tekrar","")`; median/mode/stdev → `MEDIAN/MODE.SNGL/STDEV.S`.
10. **Arrays (modern only; tag '365').** unique list → `UNIQUE(A2:A200)`; filter rows by condition → `FILTER(A2:E200,B2:B200="Gıda","")` (whole data block then condition); sort → `SORT(range,colIndex,1|-1)`; top N → `TAKE(SORT(range,col,-1),N)`; sequence → `SEQUENCE(n)`.
11. **Errors.** "hata olursa boş / если ошибка пусто" → `IFERROR(x,"")`; with text → `IFERROR(x,"text")`; `IFNA` only when the user says #N/A / #YOK / #Н/Д.
12. **Finance.** loan payment → `PMT(rate/12,years*12,-principal)` with monthly periods when the user says monthly (default), negative principal so the result is positive; `FV`, `PV`, `NPV(rate,range)`, `IRR(range)`, `SLN(cost,salvage,life)`.
13. **Formatting.** EN dialect: `,` separators, `.` decimals, no spaces: `=SUMIFS(E2:E200,B2:B200,"Gıda",H2:H200,"Ankara")`. Strings keep original case from the user's text. Booleans `TRUE/FALSE`.
14. **Confidence.** ≥0.8 clear single intent, 0.5–0.8 guessed slots (list them in `assumptions`), <0.5 fallback; `missing[]` whenever a placeholder is used.
