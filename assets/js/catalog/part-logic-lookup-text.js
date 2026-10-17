/* Formula Studio — catalog part: Logical, Lookup & Reference, Dynamic Array and Text functions.
 * Sets EFS.catalogParts.logicLookupText = [ entry, ... ] using the entry shape from docs/ARCHITECTURE.md §1.
 * Localized names are the exact names shown by Turkish and Russian Excel; entries whose localized name
 * could not be confirmed carry uncertain:['tr'|'ru'] but still give the best-known answer.
 * LET, SEQUENCE and RANDARRAY live in part-math.js. */
(function (root, factory) {
  var EFS = root.EFS || (root.EFS = {});
  var api = factory(EFS, root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (EFS, root) {
  'use strict';
  EFS.catalogParts = EFS.catalogParts || {};

  /** Trilingual value { tr, ru, en } (strings or keyword arrays). */
  function L(tr, ru, en) { return { tr: tr, ru: ru, en: en }; }
  /** Argument descriptor: { name, tr, ru, optional, desc:{tr,ru,en} }. */
  function arg(name, tr, ru, optional, dTr, dRu, dEn) {
    return { name: name, tr: tr, ru: ru, optional: !!optional, desc: { tr: dTr, ru: dRu, en: dEn } };
  }
  /** Example: { formula, tr, ru, en } — formula in EN dialect without a leading '='. */
  function ex(formula, tr, ru, en) { return { formula: formula, tr: tr, ru: ru, en: en }; }

  // Frequently reused argument descriptors.
  var ARG_TEXT = arg('text', 'metin', 'текст', false,
    'Metin veya metin içeren hücre başvurusu', 'Текст или ссылка на ячейку с текстом', 'The text or a reference to a cell containing text');
  var ARG_ARRAY = arg('array', 'dizi', 'массив', false,
    'Dizi veya hücre aralığı', 'Массив или диапазон ячеек', 'An array or range of cells');
  var ARG_LOOKUP_VALUE = arg('lookup_value', 'aranan_değer', 'искомое_значение', false,
    'Aranacak değer (sayı, metin, mantıksal değer veya hücre başvurusu)',
    'Значение, которое нужно найти (число, текст, логическое значение или ссылка)',
    'The value to search for (number, text, logical value or cell reference)');
  var ARG_BYTE_TEXT = arg('text', 'metin', 'текст', false,
    'Çift baytlı karakter kümesi (DBCS) dili için metin; diğer dillerde karakter sürümü gibi davranır',
    'Текст на языке с двухбайтовой кодировкой (DBCS); для остальных языков работает как символьная версия',
    'Text in a double-byte character set (DBCS) language; behaves like the character version for other languages');
  var ARG_LAMBDA = arg('lambda', 'lambda', 'лямбда', false,
    'Her öğeye uygulanacak LAMBDA işlevi', 'Функция LAMBDA, применяемая к каждому элементу', 'The LAMBDA to apply to each item');
  var ARG_PAD_WITH = arg('pad_with', 'doldurma_değeri', 'заполнитель', true,
    'Eksik hücrelere yazılacak değer; verilmezse #YOK döner', 'Значение для недостающих ячеек; по умолчанию #Н/Д', 'The value to fill missing cells with; #N/A by default');

  var logicLookupText = [

  /* ================================================================== LOGICAL */
  {
    name: 'AND', tr: 'VE', ru: 'И', category: 'logical',
    syntax: 'AND(logical1, [logical2], ...)',
    args: [
      arg('logical1', 'mantıksal1', 'логическое_значение1', false,
        'DOĞRU veya YANLIŞ olarak değerlendirilebilen ilk koşul', 'Первое условие, которое даёт ИСТИНА или ЛОЖЬ', 'The first condition that evaluates to TRUE or FALSE'),
      arg('logical2', 'mantıksal2', 'логическое_значение2', true,
        'Ek koşullar, en çok 255 tane', 'Дополнительные условия, до 255', 'Additional conditions, up to 255')
    ],
    desc: L('Tüm bağımsız değişkenler DOĞRU ise DOĞRU, en az biri YANLIŞ ise YANLIŞ verir.',
            'Возвращает ИСТИНА, если все аргументы истинны, и ЛОЖЬ, если хотя бы один из них ложен.',
            'Returns TRUE if all arguments are TRUE and FALSE if any argument is FALSE.'),
    example: ex('AND(E2>100,B2="Gıda")',
      'E2 100’den büyük VE B2 "Gıda" ise DOĞRU verir',
      'Возвращает ИСТИНА, если E2 больше 100 И B2 равно "Gıda"',
      'Returns TRUE when E2 is greater than 100 AND B2 is "Gıda"'),
    keywords: L(['ve', 'hepsi sağlanıyorsa', 'iki koşul birden', 'tüm şartlar', 'hem o hem bu', 'koşulların tamamı', 'aynı anda', 'her iki şart da'],
                ['и', 'оба условия', 'все условия выполнены', 'одновременно', 'несколько условий сразу', 'если и то и другое', 'все условия истинны'],
                ['and', 'all conditions', 'both conditions', 'every condition true'])
  },
  {
    name: 'BYCOL', tr: 'BYCOL', ru: 'BYCOL', category: 'logical', minVersion: '365',
    syntax: 'BYCOL(array, lambda(column))',
    args: [
      arg('array', 'dizi', 'массив', false,
        'Sütunlara ayrılacak dizi veya aralık', 'Массив или диапазон, который разбивается на столбцы', 'The array or range to split into columns'),
      arg('lambda', 'lambda', 'лямбда', false,
        'Her sütunu tek parametre olarak alan ve tek sonuç döndüren LAMBDA', 'LAMBDA с одним параметром (столбец), возвращающая одно значение', 'A LAMBDA that takes a column as its single parameter and returns one result')
    ],
    desc: L('Bir dizinin her sütununa LAMBDA uygulayıp sütun başına tek sonuç içeren bir satır verir.',
            'Применяет функцию LAMBDA к каждому столбцу массива и возвращает строку с одним результатом на столбец.',
            'Applies a LAMBDA to each column of an array and returns a row with one result per column.'),
    example: ex('BYCOL(C2:E200,LAMBDA(col,MAX(col)))',
      'C2:E200 aralığındaki her sütunun en büyük değerini tek satırda verir',
      'Возвращает в одной строке максимум каждого столбца диапазона C2:E200',
      'Returns the maximum of each column in C2:E200 as a single row'),
    keywords: L(['her sütun için', 'sütun bazında hesapla', 'sütunlara uygula', 'sütun sütun', 'lambda sütun', 'sütun başına sonuç'],
                ['для каждого столбца', 'по столбцам', 'применить к столбцам', 'по каждому столбцу', 'лямбда столбец', 'результат на столбец'],
                ['for each column', 'per column', 'apply to columns'])
  },
  {
    name: 'BYROW', tr: 'BYROW', ru: 'BYROW', category: 'logical', minVersion: '365',
    syntax: 'BYROW(array, lambda(row))',
    args: [
      arg('array', 'dizi', 'массив', false,
        'Satırlara ayrılacak dizi veya aralık', 'Массив или диапазон, который разбивается на строки', 'The array or range to split into rows'),
      arg('lambda', 'lambda', 'лямбда', false,
        'Her satırı tek parametre olarak alan ve tek sonuç döndüren LAMBDA', 'LAMBDA с одним параметром (строка), возвращающая одно значение', 'A LAMBDA that takes a row as its single parameter and returns one result')
    ],
    desc: L('Bir dizinin her satırına LAMBDA uygulayıp satır başına tek sonuç içeren bir sütun verir.',
            'Применяет функцию LAMBDA к каждой строке массива и возвращает столбец с одним результатом на строку.',
            'Applies a LAMBDA to each row of an array and returns a column with one result per row.'),
    example: ex('BYROW(C2:E200,LAMBDA(r,SUM(r)))',
      'C2:E200 aralığındaki her satırın toplamını tek sütunda verir',
      'Возвращает в одном столбце сумму каждой строки диапазона C2:E200',
      'Returns the sum of each row in C2:E200 as a single column'),
    keywords: L(['her satır için', 'satır bazında hesapla', 'satırlara uygula', 'satır satır', 'lambda satır', 'satır başına sonuç', 'satır toplamları'],
                ['для каждой строки', 'по строкам', 'применить к строкам', 'построчно', 'лямбда строка', 'результат на строку', 'сумма каждой строки'],
                ['for each row', 'per row', 'apply to rows'])
  },
  {
    name: 'FALSE', tr: 'YANLIŞ', ru: 'ЛОЖЬ', category: 'logical',
    syntax: 'FALSE()',
    args: [],
    desc: L('YANLIŞ mantıksal değerini verir.',
            'Возвращает логическое значение ЛОЖЬ.',
            'Returns the logical value FALSE.'),
    example: ex('IF(E2>100,TRUE(),FALSE())',
      'E2 100’den büyükse DOĞRU, değilse YANLIŞ verir',
      'Возвращает ИСТИНА, если E2 больше 100, иначе ЛОЖЬ',
      'Returns TRUE when E2 is greater than 100, otherwise FALSE'),
    keywords: L(['yanlış', 'mantıksal yanlış', 'yanlış değeri', 'hayır değeri', 'false'],
                ['ложь', 'логическая ложь', 'значение ложь', 'false', 'неверно'],
                ['false', 'logical false', 'boolean false'])
  },
  {
    name: 'IF', tr: 'EĞER', ru: 'ЕСЛИ', category: 'logical',
    syntax: 'IF(logical_test, [value_if_true], [value_if_false])',
    args: [
      arg('logical_test', 'mantıksal_sınama', 'лог_выражение', false,
        'DOĞRU veya YANLIŞ olarak değerlendirilebilen koşul (örn. E2>100)', 'Условие, которое даёт ИСТИНА или ЛОЖЬ (например, E2>100)', 'The condition that evaluates to TRUE or FALSE (e.g. E2>100)'),
      arg('value_if_true', 'eğer_doğruysa_değer', 'значение_если_истина', true,
        'Koşul DOĞRU ise döndürülecek değer; boş bırakılırsa 0', 'Значение, возвращаемое при ИСТИНА; если опущено — 0', 'The value to return when the condition is TRUE; 0 if omitted'),
      arg('value_if_false', 'eğer_yanlışsa_değer', 'значение_если_ложь', true,
        'Koşul YANLIŞ ise döndürülecek değer; boş bırakılırsa YANLIŞ', 'Значение, возвращаемое при ЛОЖЬ; если опущено — ЛОЖЬ', 'The value to return when the condition is FALSE; FALSE if omitted')
    ],
    desc: L('Bir koşul DOĞRU ise bir değer, YANLIŞ ise başka bir değer verir.',
            'Возвращает одно значение, если условие истинно, и другое, если оно ложно.',
            'Returns one value if a condition is TRUE and another value if it is FALSE.'),
    example: ex('IF(E2>100,"Yüksek","Düşük")',
      'E2 100’den büyükse "Yüksek", değilse "Düşük" yazar',
      'Выводит "Yüksek", если E2 больше 100, иначе "Düşük"',
      'Shows "Yüksek" when E2 is greater than 100, otherwise "Düşük"'),
    keywords: L(['eğer', 'koşul', 'şart', 'ise', 'değilse', 'koşula göre', 'şarta bağlı', 'ise yaz', 'aksi halde', 'büyükse', 'küçükse', 'eşitse', 'koşullu değer', 'evet hayır'],
                ['если', 'условие', 'то', 'иначе', 'по условию', 'если то иначе', 'в противном случае', 'если больше', 'если меньше', 'если равно', 'условное значение', 'да нет', 'проверка условия'],
                ['if', 'condition', 'then', 'else', 'otherwise', 'conditional value'])
  },
  {
    name: 'IFERROR', tr: 'EĞERHATA', ru: 'ЕСЛИОШИБКА', category: 'logical',
    syntax: 'IFERROR(value, value_if_error)',
    args: [
      arg('value', 'değer', 'значение', false,
        'Hata verebilecek ifade veya formül', 'Выражение или формула, которые могут дать ошибку', 'The expression or formula that may produce an error'),
      arg('value_if_error', 'eğer_hataysa_değer', 'значение_если_ошибка', false,
        'Hata oluşursa döndürülecek değer (örn. "" veya "Bulunamadı")', 'Значение, возвращаемое при ошибке (например, "" или "Не найдено")', 'The value to return when an error occurs (e.g. "" or "Not found")')
    ],
    desc: L('İfade hata verirse belirtilen değeri, vermezse ifadenin kendi sonucunu verir.',
            'Возвращает указанное значение, если выражение даёт ошибку, иначе — результат самого выражения.',
            'Returns the specified value if the expression produces an error, otherwise the result of the expression.'),
    example: ex('IFERROR(VLOOKUP(A2,Ürünler!$A$2:$C$50,3,FALSE),"Bulunamadı")',
      'Arama hata verirse #YOK yerine "Bulunamadı" yazar',
      'Если поиск даёт ошибку, вместо #Н/Д выводит "Bulunamadı"',
      'Shows "Bulunamadı" instead of #N/A when the lookup fails'),
    keywords: L(['hata olursa', 'hata yerine', 'hatayı gizle', 'hata varsa boş', 'hata kontrolü', 'hatalı ise', 'hata mesajı yerine', 'bölme hatası', 'hata verirse sıfır'],
                ['если ошибка', 'вместо ошибки', 'скрыть ошибку', 'при ошибке пусто', 'обработка ошибок', 'если ошибка то', 'убрать ошибку', 'ошибка деления', 'при ошибке ноль'],
                ['if error', 'hide errors', 'instead of error', 'error handling'])
  },
  {
    name: 'IFNA', tr: 'EĞERYOKSA', ru: 'ЕСНД', category: 'logical', minVersion: '2013',
    syntax: 'IFNA(value, value_if_na)',
    args: [
      arg('value', 'değer', 'значение', false,
        '#YOK hatası verebilecek ifade (genellikle bir arama formülü)', 'Выражение, которое может дать #Н/Д (обычно формула поиска)', 'The expression that may return #N/A (usually a lookup)'),
      arg('value_if_na', 'yoksa_değer', 'значение_если_нд', false,
        '#YOK hatası oluşursa döndürülecek değer', 'Значение, возвращаемое при ошибке #Н/Д', 'The value to return when #N/A occurs')
    ],
    desc: L('İfade #YOK hatası verirse belirtilen değeri, vermezse ifadenin sonucunu verir; diğer hatalara dokunmaz.',
            'Возвращает указанное значение, если выражение даёт ошибку #Н/Д, иначе — результат выражения; другие ошибки не перехватывает.',
            'Returns the specified value if the expression returns #N/A, otherwise the result of the expression; other errors pass through.'),
    example: ex('IFNA(XLOOKUP(A2,Ürünler!$A$2:$A$50,Ürünler!$C$2:$C$50),"Bulunamadı")',
      'Ürün bulunamazsa #YOK yerine "Bulunamadı" yazar, diğer hatalar görünmeye devam eder',
      'Если товар не найден, вместо #Н/Д выводит "Bulunamadı"; другие ошибки остаются видимыми',
      'Shows "Bulunamadı" instead of #N/A when the product is not found; other errors stay visible'),
    keywords: L(['#yok hatası', 'yok hatası yerine', 'bulunamazsa', 'n/a yerine', 'eşleşme yoksa', 'ara bulamazsa', 'yok ise'],
                ['#н/д', 'если не найдено', 'вместо #н/д', 'ошибка нд', 'нет данных', 'если впр не нашёл', 'если нет совпадения'],
                ['if na', 'not found', 'instead of #N/A'])
  },
  {
    name: 'IFS', tr: 'ÇOKEĞER', ru: 'ЕСЛИМН', category: 'logical', minVersion: '2019',
    syntax: 'IFS(logical_test1, value_if_true1, [logical_test2, value_if_true2], ...)',
    args: [
      arg('logical_test1', 'mantıksal_sınama1', 'лог_выражение1', false,
        'Sınanacak ilk koşul', 'Первое проверяемое условие', 'The first condition to test'),
      arg('value_if_true1', 'eğer_doğruysa_değer1', 'значение_если_истина1', false,
        'İlk koşul DOĞRU ise döndürülecek değer', 'Значение, возвращаемое, если первое условие истинно', 'The value to return when the first condition is TRUE'),
      arg('logical_test2', 'mantıksal_sınama2', 'лог_выражение2', true,
        'Sonraki koşul; en sona varsayılan için DOĞRU yazılabilir (127 çifte kadar)', 'Следующее условие; в конце можно поставить ИСТИНА как вариант по умолчанию (до 127 пар)', 'The next condition; put TRUE last as a default (up to 127 pairs)'),
      arg('value_if_true2', 'eğer_doğruysa_değer2', 'значение_если_истина2', true,
        'Sonraki koşul DOĞRU ise döndürülecek değer', 'Значение, возвращаемое, если следующее условие истинно', 'The value to return when the next condition is TRUE')
    ],
    desc: L('Birden çok koşulu sırayla sınar ve ilk DOĞRU olan koşula karşılık gelen değeri verir.',
            'Проверяет несколько условий по порядку и возвращает значение, соответствующее первому истинному условию.',
            'Tests multiple conditions in order and returns the value for the first condition that is TRUE.'),
    example: ex('IFS(E2>=1000,"Yüksek",E2>=500,"Orta",TRUE,"Düşük")',
      'E2 1000 ve üzeriyse "Yüksek", 500 ve üzeriyse "Orta", aksi halde "Düşük" yazar',
      'Выводит "Yüksek" при E2 от 1000, "Orta" при E2 от 500, иначе "Düşük"',
      'Shows "Yüksek" when E2 is at least 1000, "Orta" when at least 500, otherwise "Düşük"'),
    keywords: L(['çoklu koşul', 'birden fazla şart', 'iç içe eğer', 'kademeli koşul', 'eğer eğer', 'birden çok eğer', 'aralığa göre', 'koşullar sırayla', 'puana göre not', 'kategori belirle', 'ise değilse ise', 'çok eğer'],
                ['несколько условий', 'много если', 'вложенные если', 'условия по порядку', 'если то иначе если', 'градация', 'диапазоны значений', 'оценка по баллам', 'категория по значению', 'еслимн', 'многоуровневое условие'],
                ['multiple conditions', 'nested if', 'if else if', 'ifs'])
  },
  {
    name: 'ISOMITTED', tr: 'ISOMITTED', ru: 'ISOMITTED', category: 'logical', minVersion: '365', uncertain: ['tr'],
    syntax: 'ISOMITTED(argument)',
    args: [
      arg('argument', 'bağımsız_değişken', 'аргумент', false,
        'Sınanacak LAMBDA parametresi', 'Проверяемый параметр LAMBDA', 'The LAMBDA parameter to test')
    ],
    desc: L('LAMBDA içinde bir parametrenin verilip verilmediğini sınar; atlanmışsa DOĞRU, verilmişse YANLIŞ verir.',
            'Проверяет, пропущен ли параметр при вызове LAMBDA: возвращает ИСТИНА, если он не задан, и ЛОЖЬ, если задан.',
            'Tests whether a LAMBDA parameter was omitted: returns TRUE if missing and FALSE if supplied.'),
    example: ex('LAMBDA(x,[y],IF(ISOMITTED(y),x,x+y))(5)',
      'İsteğe bağlı y verilmediği için yalnızca x değerini (5) verir',
      'Поскольку необязательный y не задан, возвращает только x (5)',
      'Returns just x (5) because the optional y was not supplied'),
    keywords: L(['atlanmış mı', 'parametre verilmedi', 'isteğe bağlı bağımsız değişken', 'lambda eksik argüman', 'bağımsız değişken boş mu', 'parametre kontrolü'],
                ['пропущен аргумент', 'необязательный аргумент', 'аргумент не задан', 'лямбда без параметра', 'проверить аргумент', 'параметр опущен'],
                ['is omitted', 'optional argument', 'argument missing'])
  },
  {
    name: 'LAMBDA', tr: 'LAMBDA', ru: 'LAMBDA', category: 'logical', minVersion: '365',
    syntax: 'LAMBDA([parameter1, parameter2, ...], calculation)',
    args: [
      arg('parameter1', 'parametre1', 'параметр1', true,
        'İşleve geçirilecek değer için ad (örn. x, fiyat); en çok 253 parametre', 'Имя значения, передаваемого в функцию (например, x, цена); до 253 параметров', 'A name for a value passed to the function (e.g. x, price); up to 253 parameters'),
      arg('calculation', 'hesaplama', 'вычисление', false,
        'Parametreleri kullanan ve sonucu döndüren formül; son bağımsız değişken olmalıdır', 'Формула, использующая параметры и возвращающая результат; должна быть последним аргументом', 'The formula that uses the parameters and returns the result; must be the last argument')
    ],
    desc: L('Parametre alan, yeniden kullanılabilir özel bir işlev tanımlar ve çağrıldığında hesaplamanın sonucunu verir.',
            'Определяет пользовательскую функцию с параметрами, которую можно использовать повторно, и при вызове возвращает результат вычисления.',
            'Defines a reusable custom function with parameters and returns the result of the calculation when called.'),
    example: ex('LAMBDA(x,y,x*y)(C2,D2)',
      'x ve y’yi çarpan bir işlev tanımlayıp C2 ve D2 ile çağırır (adet × birim fiyat)',
      'Определяет функцию, перемножающую x и y, и вызывает её с C2 и D2 (кол-во × цена)',
      'Defines a function that multiplies x and y and calls it with C2 and D2 (quantity × unit price)'),
    keywords: L(['özel işlev', 'kendi fonksiyonum', 'işlev tanımla', 'parametreli formül', 'tekrar kullanılabilir formül', 'lambda', 'kendi formülünü yaz', 'ad yöneticisi işlevi'],
                ['своя функция', 'пользовательская функция', 'создать функцию', 'формула с параметрами', 'повторно использовать формулу', 'лямбда', 'написать свою функцию', 'функция в диспетчере имён'],
                ['custom function', 'define function', 'lambda', 'reusable formula'])
  },
  {
    name: 'MAKEARRAY', tr: 'MAKEARRAY', ru: 'MAKEARRAY', category: 'logical', minVersion: '365',
    syntax: 'MAKEARRAY(rows, columns, lambda(row, column))',
    args: [
      arg('rows', 'satırlar', 'строки', false,
        'Oluşturulacak dizinin satır sayısı (en az 1)', 'Число строк создаваемого массива (не меньше 1)', 'The number of rows in the array (at least 1)'),
      arg('columns', 'sütunlar', 'столбцы', false,
        'Oluşturulacak dizinin sütun sayısı (en az 1)', 'Число столбцов создаваемого массива (не меньше 1)', 'The number of columns in the array (at least 1)'),
      arg('lambda', 'lambda', 'лямбда', false,
        'Satır ve sütun numarasını alıp hücre değerini hesaplayan LAMBDA', 'LAMBDA, получающая номер строки и столбца и вычисляющая значение ячейки', 'A LAMBDA that receives the row and column index and computes the cell value')
    ],
    desc: L('Belirtilen satır ve sütun sayısında bir dizi oluşturur ve her hücresini LAMBDA ile hesaplar.',
            'Создаёт массив заданного размера и вычисляет каждую его ячейку с помощью LAMBDA.',
            'Creates an array of the given size and computes each cell with a LAMBDA.'),
    example: ex('MAKEARRAY(3,3,LAMBDA(r,c,r*c))',
      '3×3 boyutunda bir çarpım tablosu oluşturur',
      'Создаёт таблицу умножения размером 3×3',
      'Builds a 3×3 multiplication table'),
    keywords: L(['dizi oluştur', 'hesaplanmış dizi', 'satır sütun ile dizi', 'çarpım tablosu', 'formülle tablo üret', 'boyutu belli dizi'],
                ['создать массив', 'вычисляемый массив', 'массив по формуле', 'таблица умножения', 'сгенерировать таблицу', 'массив заданного размера'],
                ['make array', 'generate array', 'calculated array'])
  },
  {
    name: 'MAP', tr: 'MAP', ru: 'MAP', category: 'logical', minVersion: '365',
    syntax: 'MAP(array1, [array2, ...], lambda)',
    args: [
      arg('array1', 'dizi1', 'массив1', false,
        'Öğeleri dönüştürülecek dizi veya aralık', 'Массив или диапазон, элементы которого преобразуются', 'The array or range whose items are transformed'),
      arg('array2', 'dizi2', 'массив2', true,
        'Aynı boyutta ek diziler; LAMBDA her biri için bir parametre alır', 'Дополнительные массивы того же размера; LAMBDA получает по параметру на каждый', 'Additional arrays of the same size; the LAMBDA takes one parameter per array'),
      arg('lambda', 'lambda', 'лямбда', false,
        'Her öğeye uygulanacak ve yeni değeri döndürecek LAMBDA; son bağımsız değişkendir', 'LAMBDA, применяемая к каждому элементу и возвращающая новое значение; последний аргумент', 'The LAMBDA applied to each item that returns the new value; must be last')
    ],
    desc: L('Dizinin her öğesine LAMBDA uygulayarak aynı boyutta yeni bir dizi verir.',
            'Применяет LAMBDA к каждому элементу массива и возвращает новый массив того же размера.',
            'Applies a LAMBDA to each item of an array and returns a new array of the same size.'),
    example: ex('MAP(E2:E200,LAMBDA(v,IF(v>100,"Yüksek","Düşük")))',
      'E2:E200’deki her değer için "Yüksek" veya "Düşük" içeren bir dizi verir',
      'Возвращает массив, где для каждого значения E2:E200 стоит "Yüksek" или "Düşük"',
      'Returns an array with "Yüksek" or "Düşük" for each value in E2:E200'),
    keywords: L(['her hücreye uygula', 'dizi dönüştür', 'eleman eleman', 'her değer için', 'toplu dönüştürme', 'lambda ile dönüştür', 'eşle'],
                ['применить к каждому', 'преобразовать массив', 'поэлементно', 'для каждого значения', 'обработать все ячейки', 'лямбда для массива', 'отобразить'],
                ['map', 'apply to each', 'transform array'])
  },
  {
    name: 'NOT', tr: 'DEĞİL', ru: 'НЕ', category: 'logical',
    syntax: 'NOT(logical)',
    args: [
      arg('logical', 'mantıksal', 'логическое_значение', false,
        'Tersine çevrilecek değer veya ifade (DOĞRU/YANLIŞ)', 'Значение или выражение, которое нужно инвертировать (ИСТИНА/ЛОЖЬ)', 'The value or expression to reverse (TRUE/FALSE)')
    ],
    desc: L('Mantıksal değeri tersine çevirir: DOĞRU’yu YANLIŞ, YANLIŞ’ı DOĞRU yapar.',
            'Меняет логическое значение на противоположное: ИСТИНА становится ЛОЖЬ, а ЛОЖЬ — ИСТИНА.',
            'Reverses a logical value: TRUE becomes FALSE and FALSE becomes TRUE.'),
    example: ex('IF(NOT(ISBLANK(I2)),"Dolu","Boş")',
      'I2 boş değilse "Dolu", boşsa "Boş" yazar',
      'Выводит "Dolu", если I2 не пустая, и "Boş", если пустая',
      'Shows "Dolu" when I2 is not blank, otherwise "Boş"'),
    keywords: L(['değil', 'tersi', 'olmayan', 'mantıksal tersleme', 'eğer değilse', 'boş değilse', 'eşit değilse', 'tersine çevir'],
                ['не', 'отрицание', 'наоборот', 'инвертировать', 'если не', 'не пустая', 'не равно', 'обратное условие'],
                ['not', 'negate', 'reverse logical'])
  },
  {
    name: 'OR', tr: 'YADA', ru: 'ИЛИ', category: 'logical',
    syntax: 'OR(logical1, [logical2], ...)',
    args: [
      arg('logical1', 'mantıksal1', 'логическое_значение1', false,
        'DOĞRU veya YANLIŞ olarak değerlendirilebilen ilk koşul', 'Первое условие, которое даёт ИСТИНА или ЛОЖЬ', 'The first condition that evaluates to TRUE or FALSE'),
      arg('logical2', 'mantıksal2', 'логическое_значение2', true,
        'Ek koşullar, en çok 255 tane', 'Дополнительные условия, до 255', 'Additional conditions, up to 255')
    ],
    desc: L('Bağımsız değişkenlerden en az biri DOĞRU ise DOĞRU, tümü YANLIŞ ise YANLIŞ verir.',
            'Возвращает ИСТИНА, если хотя бы один аргумент истинен, и ЛОЖЬ, если все они ложны.',
            'Returns TRUE if any argument is TRUE and FALSE if all arguments are FALSE.'),
    example: ex('OR(H2="İstanbul",H2="Ankara")',
      'H2 "İstanbul" VEYA "Ankara" ise DOĞRU verir',
      'Возвращает ИСТИНА, если H2 равно "İstanbul" ИЛИ "Ankara"',
      'Returns TRUE when H2 is "İstanbul" OR "Ankara"'),
    keywords: L(['veya', 'ya da', 'herhangi biri', 'en az biri sağlanıyorsa', 'biri bile doğruysa', 'yahut', 'şartlardan biri', 'birinden biri'],
                ['или', 'хотя бы одно условие', 'любое из условий', 'либо', 'одно из условий', 'если хотя бы одно', 'одно или другое'],
                ['or', 'any condition', 'either', 'at least one'])
  },
  {
    name: 'REDUCE', tr: 'REDUCE', ru: 'REDUCE', category: 'logical', minVersion: '365',
    syntax: 'REDUCE([initial_value], array, lambda(accumulator, value))',
    args: [
      arg('initial_value', 'başlangıç_değeri', 'начальное_значение', true,
        'Biriktiricinin başlangıç değeri (örn. 0 veya "")', 'Начальное значение накопителя (например, 0 или "")', 'The starting value of the accumulator (e.g. 0 or "")'),
      arg('array', 'dizi', 'массив', false,
        'İndirgenecek dizi veya aralık', 'Массив или диапазон, который нужно свернуть', 'The array or range to reduce'),
      arg('lambda', 'lambda', 'лямбда', false,
        'Biriktirici ve geçerli değeri alıp yeni biriktiriciyi döndüren LAMBDA', 'LAMBDA, получающая накопитель и текущее значение и возвращающая новый накопитель', 'A LAMBDA that takes the accumulator and the current value and returns the new accumulator')
    ],
    desc: L('Diziyi tek bir değere indirger: her öğeyi biriktiriciyle birlikte LAMBDA’ya uygular ve son biriktirici değerini verir.',
            'Сворачивает массив в одно значение, последовательно применяя LAMBDA к накопителю и каждому элементу, и возвращает итоговый накопитель.',
            'Reduces an array to a single value by applying a LAMBDA to an accumulator and each item, returning the final accumulator.'),
    example: ex('REDUCE(0,C2:C200,LAMBDA(acc,v,acc+v^2))',
      'C2:C200’deki değerlerin karelerinin toplamını verir',
      'Возвращает сумму квадратов значений из C2:C200',
      'Returns the sum of the squares of the values in C2:C200'),
    keywords: L(['indirge', 'biriktir', 'tek değere topla', 'döngü ile hesapla', 'kümülatif işlem', 'lambda biriktirici', 'tüm öğeleri işle'],
                ['свернуть массив', 'накопить', 'в одно значение', 'цикл по массиву', 'аккумулятор', 'последовательное вычисление', 'обработать все элементы'],
                ['reduce', 'accumulate', 'fold array'])
  },
  {
    name: 'SCAN', tr: 'SCAN', ru: 'SCAN', category: 'logical', minVersion: '365',
    syntax: 'SCAN([initial_value], array, lambda(accumulator, value))',
    args: [
      arg('initial_value', 'başlangıç_değeri', 'начальное_значение', true,
        'Biriktiricinin başlangıç değeri (örn. 0)', 'Начальное значение накопителя (например, 0)', 'The starting value of the accumulator (e.g. 0)'),
      arg('array', 'dizi', 'массив', false,
        'Taranacak dizi veya aralık', 'Массив или диапазон для сканирования', 'The array or range to scan'),
      arg('lambda', 'lambda', 'лямбда', false,
        'Biriktirici ve geçerli değeri alıp yeni biriktiriciyi döndüren LAMBDA', 'LAMBDA, получающая накопитель и текущее значение и возвращающая новый накопитель', 'A LAMBDA that takes the accumulator and the current value and returns the new accumulator')
    ],
    desc: L('Her öğeyi sırayla işleyerek tüm ara sonuçları (örneğin yürüyen toplamı) aynı boyutta bir dizi olarak verir.',
            'Последовательно обрабатывает элементы и возвращает массив того же размера со всеми промежуточными результатами (например, нарастающим итогом).',
            'Processes each item in turn and returns an array of the same size with every intermediate result (e.g. a running total).'),
    example: ex('SCAN(0,E2:E200,LAMBDA(acc,v,acc+v))',
      'E2:E200 için yürüyen (kümülatif) toplam dizisi verir',
      'Возвращает массив нарастающего итога для E2:E200',
      'Returns the running total of E2:E200 as an array'),
    keywords: L(['kümülatif toplam dizisi', 'ara sonuçlar', 'birikimli', 'tarama', 'adım adım toplam', 'yürüyen toplam', 'koşan toplam'],
                ['нарастающий итог', 'промежуточные результаты', 'накопительно', 'сканировать массив', 'пошаговое накопление', 'бегущая сумма', 'сумма с накоплением'],
                ['scan', 'running total array', 'intermediate results'])
  },
  {
    name: 'SWITCH', tr: 'İLKEŞLEŞEN', ru: 'ПЕРЕКЛЮЧ', category: 'logical', minVersion: '2019',
    syntax: 'SWITCH(expression, value1, result1, [value2, result2], ..., [default])',
    args: [
      arg('expression', 'ifade', 'выражение', false,
        'Değerlerle karşılaştırılacak ifade veya hücre', 'Выражение или ячейка, сравниваемые со значениями', 'The expression or cell compared against the values'),
      arg('value1', 'değer1', 'значение1', false,
        'İfadeyle karşılaştırılacak ilk değer', 'Первое значение для сравнения с выражением', 'The first value to compare with the expression'),
      arg('result1', 'sonuç1', 'результат1', false,
        'İfade değer1’e eşitse döndürülecek sonuç', 'Результат, возвращаемый при совпадении с значение1', 'The result returned when the expression equals value1'),
      arg('value2', 'değer2', 'значение2', true,
        'Sonraki değer/sonuç çiftleri (126 çifte kadar)', 'Следующие пары значение/результат (до 126 пар)', 'Further value/result pairs (up to 126 pairs)'),
      arg('default', 'varsayılan', 'по_умолчанию', true,
        'Hiçbir değer eşleşmezse döndürülecek sonuç; verilmezse #YOK', 'Результат, если ни одно значение не совпало; иначе #Н/Д', 'The result when no value matches; #N/A if omitted')
    ],
    desc: L('Bir ifadeyi değer listesiyle karşılaştırır ve ilk eşleşen değere karşılık gelen sonucu, eşleşme yoksa varsayılanı verir.',
            'Сравнивает выражение со списком значений и возвращает результат первого совпадения, а если совпадений нет — значение по умолчанию.',
            'Compares an expression against a list of values and returns the result of the first match, or the default when nothing matches.'),
    example: ex('SWITCH(WEEKDAY(F2,2),6,"Cumartesi",7,"Pazar","Hafta içi")',
      'F2 tarihinin gününe göre "Cumartesi", "Pazar" veya "Hafta içi" yazar',
      'По дню недели даты F2 выводит "Cumartesi", "Pazar" или "Hafta içi"',
      'Shows "Cumartesi", "Pazar" or "Hafta içi" depending on the weekday of F2'),
    keywords: L(['değere göre seç', 'eşleşen sonucu ver', 'çoklu eşleştirme', 'kod karşılığı', 'eğer eşitse', 'durum seçimi', 'ilk eşleşen', 'kodu açıklamaya çevir'],
                ['выбрать по значению', 'соответствие значений', 'если равно то', 'переключатель', 'код в название', 'несколько вариантов', 'переключ', 'сопоставить код с текстом'],
                ['switch', 'case', 'match value to result'])
  },
  {
    name: 'TRUE', tr: 'DOĞRU', ru: 'ИСТИНА', category: 'logical',
    syntax: 'TRUE()',
    args: [],
    desc: L('DOĞRU mantıksal değerini verir.',
            'Возвращает логическое значение ИСТИНА.',
            'Returns the logical value TRUE.'),
    example: ex('IFS(E2>500,"Yüksek",TRUE(),"Normal")',
      'ÇOKEĞER içinde son koşul olarak DOĞRU kullanılarak varsayılan "Normal" verilir',
      'ИСТИНА в последнем условии ЕСЛИМН задаёт значение по умолчанию "Normal"',
      'Uses TRUE as the last IFS condition to provide the default "Normal"'),
    keywords: L(['doğru', 'mantıksal doğru', 'doğru değeri', 'evet değeri', 'true', 'varsayılan koşul'],
                ['истина', 'логическая истина', 'значение истина', 'true', 'верно', 'условие по умолчанию'],
                ['true', 'logical true', 'boolean true'])
  },
  {
    name: 'XOR', tr: 'ÖZELVEYA', ru: 'ИСКЛИЛИ', category: 'logical', minVersion: '2013',
    syntax: 'XOR(logical1, [logical2], ...)',
    args: [
      arg('logical1', 'mantıksal1', 'логическое_значение1', false,
        'DOĞRU veya YANLIŞ olarak değerlendirilebilen ilk koşul', 'Первое условие, которое даёт ИСТИНА или ЛОЖЬ', 'The first condition that evaluates to TRUE or FALSE'),
      arg('logical2', 'mantıksal2', 'логическое_значение2', true,
        'Ek koşullar, en çok 254 tane', 'Дополнительные условия, до 254', 'Additional conditions, up to 254')
    ],
    desc: L('Tek sayıda bağımsız değişken DOĞRU ise DOĞRU, aksi halde YANLIŞ verir (özel VEYA).',
            'Возвращает ИСТИНА, если нечётное число аргументов истинно, иначе ЛОЖЬ (исключающее ИЛИ).',
            'Returns TRUE when an odd number of arguments are TRUE, otherwise FALSE (exclusive OR).'),
    example: ex('XOR(I2="Ödendi",J2>0)',
      'Yalnızca biri doğruysa (ödendi ya da indirimli, ikisi birden değil) DOĞRU verir',
      'Возвращает ИСТИНА, если верно только одно из условий (оплачено или со скидкой, но не оба)',
      'Returns TRUE when exactly one condition holds (paid or discounted, not both)'),
    keywords: L(['özel veya', 'yalnızca biri', 'sadece biri doğruysa', 'ikisi birden değil', 'dışlayıcı veya', 'tek sayıda doğru'],
                ['исключающее или', 'только одно из', 'либо одно либо другое', 'не оба сразу', 'xor', 'нечётное число истин'],
                ['exclusive or', 'only one true', 'xor'])
  },

  /* ================================================================== LOOKUP & REFERENCE */
  {
    name: 'ADDRESS', tr: 'ADRES', ru: 'АДРЕС', category: 'lookup',
    syntax: 'ADDRESS(row_num, column_num, [abs_num], [a1], [sheet_text])',
    args: [
      arg('row_num', 'satır_sayısı', 'номер_строки', false,
        'Hücrenin satır numarası', 'Номер строки ячейки', 'The row number of the cell'),
      arg('column_num', 'sütun_sayısı', 'номер_столбца', false,
        'Hücrenin sütun numarası (A=1, B=2 …)', 'Номер столбца ячейки (A=1, B=2 …)', 'The column number of the cell (A=1, B=2 …)'),
      arg('abs_num', 'mutlak_sayı', 'тип_ссылки', true,
        'Başvuru türü: 1 mutlak ($A$1), 2 mutlak satır, 3 mutlak sütun, 4 göreli (A1)', 'Тип ссылки: 1 абсолютная ($A$1), 2 абсолютная строка, 3 абсолютный столбец, 4 относительная (A1)', 'Reference type: 1 absolute ($A$1), 2 absolute row, 3 absolute column, 4 relative (A1)'),
      arg('a1', 'a1', 'a1', true,
        'DOĞRU veya boş: A1 stili; YANLIŞ: R1C1 stili', 'ИСТИНА или пусто: стиль A1; ЛОЖЬ: стиль R1C1', 'TRUE or omitted: A1 style; FALSE: R1C1 style'),
      arg('sheet_text', 'sayfa_metni', 'имя_листа', true,
        'Adrese eklenecek sayfa adı', 'Имя листа, добавляемое к адресу', 'The sheet name to include in the address')
    ],
    desc: L('Satır ve sütun numarasından metin olarak bir hücre adresi oluşturur.',
            'Создаёт адрес ячейки в виде текста по номеру строки и столбца.',
            'Builds a cell address as text from a row and column number.'),
    example: ex('ADDRESS(2,5)',
      '2. satır 5. sütunun adresini metin olarak verir: "$E$2"',
      'Возвращает адрес ячейки во 2-й строке и 5-м столбце как текст: "$E$2"',
      'Returns the address of row 2, column 5 as text: "$E$2"'),
    keywords: L(['hücre adresi', 'adres oluştur', 'satır sütundan adres', 'başvuru metni', 'hücre başvurusu yaz', 'adresi metin olarak'],
                ['адрес ячейки', 'создать адрес', 'адрес по строке и столбцу', 'ссылка в виде текста', 'получить адрес', 'текстовый адрес'],
                ['cell address', 'build reference', 'address from row and column'])
  },
  {
    name: 'AREAS', tr: 'ALANSAY', ru: 'ОБЛАСТИ', category: 'lookup',
    syntax: 'AREAS(reference)',
    args: [
      arg('reference', 'başvuru', 'ссылка', false,
        'Bir hücre, aralık veya parantez içinde birden çok aralık: (A1:B5,D1:D9)', 'Ячейка, диапазон или несколько диапазонов в скобках: (A1:B5;D1:D9)', 'A cell, a range, or several ranges in parentheses: (A1:B5,D1:D9)')
    ],
    desc: L('Bir başvurudaki alan (bitişik hücre bloğu) sayısını verir.',
            'Возвращает количество областей (смежных блоков ячеек) в ссылке.',
            'Returns the number of areas (contiguous blocks of cells) in a reference.'),
    example: ex('AREAS((A1:B5,D1:D9))',
      'İki ayrı aralık içeren başvuru için 2 verir',
      'Для ссылки из двух отдельных диапазонов возвращает 2',
      'Returns 2 for a reference made of two separate ranges'),
    keywords: L(['alan sayısı', 'kaç alan', 'başvurudaki bloklar', 'bitişik aralık sayısı', 'alanları say'],
                ['количество областей', 'сколько областей', 'число диапазонов в ссылке', 'области ссылки', 'посчитать области'],
                ['number of areas', 'count areas', 'areas in reference'])
  },
  {
    name: 'CHOOSE', tr: 'ELEMAN', ru: 'ВЫБОР', category: 'lookup',
    syntax: 'CHOOSE(index_num, value1, [value2], ...)',
    args: [
      arg('index_num', 'dizin_sayısı', 'номер_индекса', false,
        'Hangi değerin seçileceğini belirten 1–254 arası sayı', 'Число от 1 до 254, указывающее, какое значение выбрать', 'A number from 1 to 254 that selects which value to return'),
      arg('value1', 'değer1', 'значение1', false,
        'Dizin 1 ise döndürülecek değer', 'Значение, возвращаемое при индексе 1', 'The value returned when the index is 1'),
      arg('value2', 'değer2', 'значение2', true,
        'Sonraki değerler (sayı, metin, başvuru veya formül)', 'Следующие значения (числа, текст, ссылки или формулы)', 'Further values (numbers, text, references or formulas)')
    ],
    desc: L('Dizin numarasına göre değer listesinden karşılık gelen değeri verir.',
            'Возвращает значение из списка по его порядковому номеру.',
            'Returns the value from a list that corresponds to the index number.'),
    example: ex('CHOOSE(C2,"Düşük","Orta","Yüksek")',
      'C2 1, 2 veya 3 ise sırasıyla "Düşük", "Orta" veya "Yüksek" verir',
      'Возвращает "Düşük", "Orta" или "Yüksek", если C2 равно 1, 2 или 3',
      'Returns "Düşük", "Orta" or "Yüksek" when C2 is 1, 2 or 3'),
    keywords: L(['listeden seç', 'numaraya göre seç', 'sıra numarası ile değer', 'eleman seç', 'n. değeri ver', 'indekse göre', 'numaradan metin'],
                ['выбрать из списка', 'выбор по номеру', 'значение по индексу', 'n-й элемент', 'выбрать вариант', 'по порядковому номеру', 'номер в текст'],
                ['choose', 'pick by index', 'nth value'])
  },
  {
    name: 'COLUMN', tr: 'SÜTUN', ru: 'СТОЛБЕЦ', category: 'lookup',
    syntax: 'COLUMN([reference])',
    args: [
      arg('reference', 'başvuru', 'ссылка', true,
        'Sütun numarası istenen hücre; boş bırakılırsa formülün bulunduğu hücre', 'Ячейка, номер столбца которой нужен; если опущено — ячейка с формулой', 'The cell whose column number you want; the formula cell if omitted')
    ],
    desc: L('Başvurunun sütun numarasını verir; başvuru verilmezse formülün bulunduğu hücrenin sütun numarasını verir.',
            'Возвращает номер столбца ссылки, а без аргумента — номер столбца ячейки с формулой.',
            'Returns the column number of a reference, or of the formula cell when no reference is given.'),
    example: ex('COLUMN(E2)',
      'E sütununun numarasını verir: 5',
      'Возвращает номер столбца E: 5',
      'Returns the number of column E: 5'),
    keywords: L(['sütun numarası', 'kaçıncı sütun', 'sütun indeksi', 'sütun no', 'hangi sütunda', 'sütun sayısını bul'],
                ['номер столбца', 'какой столбец', 'индекс столбца', 'столбец ячейки', 'порядковый номер столбца', 'узнать номер столбца'],
                ['column number', 'which column', 'column index'])
  },
  {
    name: 'COLUMNS', tr: 'SÜTUNSAY', ru: 'ЧИСЛСТОЛБ', category: 'lookup',
    syntax: 'COLUMNS(array)',
    args: [
      arg('array', 'dizi', 'массив', false,
        'Sütunları sayılacak dizi, dizi formülü veya aralık', 'Массив, формула массива или диапазон, столбцы которого нужно посчитать', 'The array, array formula or range whose columns you want to count')
    ],
    desc: L('Bir dizi veya başvurudaki sütun sayısını verir.',
            'Возвращает количество столбцов в массиве или ссылке.',
            'Returns the number of columns in an array or reference.'),
    example: ex('COLUMNS(A1:M1)',
      'A1:M1 aralığındaki sütun sayısını verir: 13',
      'Возвращает число столбцов в диапазоне A1:M1: 13',
      'Returns the number of columns in A1:M1: 13'),
    keywords: L(['sütun sayısı', 'kaç sütun', 'aralıktaki sütunlar', 'sütun adedi', 'sütunları say'],
                ['количество столбцов', 'сколько столбцов', 'число столбцов в диапазоне', 'столбцов в массиве', 'посчитать столбцы'],
                ['number of columns', 'count columns', 'columns in range'])
  },
  {
    name: 'FORMULATEXT', tr: 'FORMÜLMETNİ', ru: 'Ф.ТЕКСТ', category: 'lookup', minVersion: '2013',
    syntax: 'FORMULATEXT(reference)',
    args: [
      arg('reference', 'başvuru', 'ссылка', false,
        'Formülü gösterilecek hücre; formül yoksa #YOK verir', 'Ячейка, формулу которой нужно показать; без формулы даёт #Н/Д', 'The cell whose formula you want; returns #N/A if it has no formula')
    ],
    desc: L('Bir hücredeki formülü metin olarak verir.',
            'Возвращает формулу указанной ячейки в виде текста.',
            'Returns the formula in a cell as text.'),
    example: ex('FORMULATEXT(N2)',
      'N2 hücresindeki formülü metin olarak gösterir, örn. "=E2*1.2"',
      'Показывает формулу ячейки N2 как текст, например "=E2*1,2"',
      'Shows the formula in N2 as text, e.g. "=E2*1.2"'),
    keywords: L(['formülü göster', 'formül metni', 'hücredeki formülü yaz', 'formülü metin olarak al', 'formülü görüntüle', 'formül dökümü'],
                ['показать формулу', 'текст формулы', 'формула как текст', 'вывести формулу ячейки', 'отобразить формулу', 'ф.текст'],
                ['show formula', 'formula as text', 'display formula'])
  },
  {
    name: 'GETPIVOTDATA', tr: 'ÖZETVERİAL', ru: 'ПОЛУЧИТЬ.ДАННЫЕ.СВОДНОЙ.ТАБЛИЦЫ', category: 'lookup',
    syntax: 'GETPIVOTDATA(data_field, pivot_table, [field1, item1], ...)',
    args: [
      arg('data_field', 'veri_alanı', 'поле_данных', false,
        'Alınacak veri alanının adı, tırnak içinde (örn. "Tutar")', 'Имя поля данных в кавычках (например, "Сумма")', 'The name of the data field in quotes (e.g. "Amount")'),
      arg('pivot_table', 'özet_tablo', 'сводная_таблица', false,
        'PivotTable içindeki herhangi bir hücre başvurusu', 'Ссылка на любую ячейку сводной таблицы', 'A reference to any cell inside the PivotTable'),
      arg('field1', 'alan1', 'поле1', true,
        'Süzülecek alanın adı (örn. "Kategori")', 'Имя поля для отбора (например, "Категория")', 'The name of a field to filter by (e.g. "Category")'),
      arg('item1', 'öğe1', 'элемент1', true,
        'Alan için seçilecek öğe (örn. "Gıda"); 126 çifte kadar', 'Элемент поля (например, "Еда"); до 126 пар', 'The item of that field (e.g. "Food"); up to 126 pairs')
    ],
    desc: L('Bir PivotTable’dan belirtilen alan ve öğelere karşılık gelen özet değeri alır.',
            'Возвращает итоговое значение из сводной таблицы для указанных полей и элементов.',
            'Returns the summary value from a PivotTable for the specified fields and items.'),
    example: ex('GETPIVOTDATA("Tutar",$A$3,"Kategori","Gıda")',
      'A3’teki özet tablodan "Gıda" kategorisinin Tutar toplamını alır',
      'Берёт из сводной таблицы в A3 итог поля "Tutar" для категории "Gıda"',
      'Gets the "Tutar" total for the "Gıda" category from the PivotTable at A3'),
    keywords: L(['özet tablodan veri al', 'pivot tablodan değer', 'pivot verisi', 'özet tablo toplamı', 'pivottable', 'özet tablodan çek'],
                ['данные из сводной таблицы', 'значение из сводной', 'сводная таблица', 'итог сводной', 'получить из сводной', 'подтянуть из сводной'],
                ['pivot table value', 'get pivot data', 'pivot total'])
  },
  {
    name: 'HLOOKUP', tr: 'YATAYARA', ru: 'ГПР', category: 'lookup',
    syntax: 'HLOOKUP(lookup_value, table_array, row_index_num, [range_lookup])',
    args: [
      ARG_LOOKUP_VALUE,
      arg('table_array', 'tablo_dizisi', 'таблица', false,
        'İlk satırında arama yapılacak tablo', 'Таблица, в первой строке которой ведётся поиск', 'The table whose first row is searched'),
      arg('row_index_num', 'satır_indis_sayısı', 'номер_строки', false,
        'Değerin alınacağı satırın tablo içindeki numarası (1 = ilk satır)', 'Номер строки таблицы, из которой берётся значение (1 = первая строка)', 'The row number in the table to return the value from (1 = first row)'),
      arg('range_lookup', 'aralık_bak', 'интервальный_просмотр', true,
        'YANLIŞ: tam eşleşme; DOĞRU veya boş: yaklaşık eşleşme (ilk satır sıralı olmalı)', 'ЛОЖЬ: точное совпадение; ИСТИНА или пусто: приблизительное (первая строка должна быть отсортирована)', 'FALSE: exact match; TRUE or omitted: approximate match (first row must be sorted)')
    ],
    desc: L('Tablonun ilk satırında bir değeri arar ve aynı sütunda belirtilen satırdaki değeri verir.',
            'Ищет значение в первой строке таблицы и возвращает значение из указанной строки того же столбца.',
            'Searches the first row of a table and returns the value in the specified row of the same column.'),
    example: ex('HLOOKUP("Mart",A1:M5,3,FALSE)',
      'A1:M1 başlık satırında "Mart" sütununu bulur ve o sütunun 3. satırındaki değeri verir',
      'Находит столбец "Mart" в строке заголовков A1:M1 и возвращает значение из 3-й строки этого столбца',
      'Finds the "Mart" column in the header row A1:M1 and returns the value in row 3 of that column'),
    keywords: L(['yatay ara', 'satırda ara', 'ilk satırda bul', 'yatay arama', 'başlık satırında ara', 'satır bazlı getir', 'yatay tablodan getir'],
                ['горизонтальный поиск', 'искать в строке', 'найти в первой строке', 'поиск по строке', 'гпр', 'подтянуть из строки', 'горизонтальная таблица'],
                ['hlookup', 'horizontal lookup', 'search first row'])
  },
  {
    name: 'HYPERLINK', tr: 'KÖPRÜ', ru: 'ГИПЕРССЫЛКА', category: 'lookup',
    syntax: 'HYPERLINK(link_location, [friendly_name])',
    args: [
      arg('link_location', 'bağlantı_konumu', 'адрес', false,
        'Açılacak yol veya URL: web adresi, dosya yolu, "#Sayfa2!A1" gibi hücre konumu veya "mailto:" adresi', 'Открываемый путь или URL: веб-адрес, путь к файлу, место в книге вида "#Лист2!A1" или адрес "mailto:"', 'The path or URL to open: a web address, file path, workbook location like "#Sheet2!A1" or a "mailto:" address'),
      arg('friendly_name', 'kolay_ad', 'имя', true,
        'Hücrede gösterilecek metin veya sayı; boş bırakılırsa bağlantı konumu gösterilir', 'Текст или число, отображаемые в ячейке; если опущено, показывается адрес', 'The text or number shown in the cell; the link location if omitted')
    ],
    desc: L('Tıklandığında belirtilen konumu (web sayfası, dosya, hücre veya e-posta) açan bir köprü oluşturur.',
            'Создаёт гиперссылку, при щелчке открывающую указанное место: веб-страницу, файл, ячейку или письмо.',
            'Creates a hyperlink that opens the specified location (web page, file, cell or e-mail) when clicked.'),
    example: ex('HYPERLINK("mailto:"&L2,"E-posta gönder")',
      'L2’deki adrese e-posta göndermek için "E-posta gönder" yazılı bir bağlantı oluşturur',
      'Создаёт ссылку "E-posta gönder" для отправки письма на адрес из L2',
      'Creates a link labelled "E-posta gönder" that e-mails the address in L2'),
    keywords: L(['köprü', 'bağlantı oluştur', 'tıklanabilir link', 'web sayfasına bağlantı', 'hücreye link', 'e-posta bağlantısı', 'dosyaya bağlantı', 'link ekle'],
                ['гиперссылка', 'создать ссылку', 'кликабельная ссылка', 'ссылка на сайт', 'ссылка на ячейку', 'ссылка на файл', 'ссылка на письмо', 'добавить ссылку'],
                ['hyperlink', 'clickable link', 'link to cell', 'link to file'])
  },
  {
    name: 'INDEX', tr: 'İNDİS', ru: 'ИНДЕКС', category: 'lookup',
    syntax: 'INDEX(array, row_num, [column_num])',
    args: [
      arg('array', 'dizi', 'массив', false,
        'Değerin alınacağı aralık veya dizi', 'Диапазон или массив, из которого берётся значение', 'The range or array to return a value from'),
      arg('row_num', 'satır_sayısı', 'номер_строки', false,
        'Aralık içindeki satır numarası; tek sütunlu aralıkta konum (0 = tüm sütun)', 'Номер строки внутри диапазона; для одного столбца — позиция (0 = весь столбец)', 'The row number within the range; the position for a single column (0 = whole column)'),
      arg('column_num', 'sütun_sayısı', 'номер_столбца', true,
        'Aralık içindeki sütun numarası; tek sütunlu aralıkta gerekmez', 'Номер столбца внутри диапазона; для одного столбца не нужен', 'The column number within the range; not needed for a single column')
    ],
    desc: L('Bir aralıkta belirtilen satır ve sütundaki hücrenin değerini verir.',
            'Возвращает значение ячейки диапазона, расположенной на пересечении указанных строки и столбца.',
            'Returns the value of the cell at the given row and column position within a range.'),
    example: ex('INDEX(Ürünler!$C$2:$C$50,MATCH(A2,Ürünler!$A$2:$A$50,0))',
      'A2’deki kodu Ürünler sayfasında bulur ve aynı satırdaki fiyatı getirir (İNDİS + KAÇINCI)',
      'Находит код из A2 на листе Ürünler и возвращает цену из той же строки (ИНДЕКС + ПОИСКПОЗ)',
      'Finds the code from A2 on the Ürünler sheet and returns the price from the same row (INDEX + MATCH)'),
    keywords: L(['indis', 'satır sütun ile değer', 'konumdan değer al', 'n. satırdaki değer', 'indeks kaçıncı', 'index match', 'sola doğru ara', 'kesişimdeki değer', 'belirli konumdaki hücre', 'tablodan getir', 'satır numarasına göre getir', 'kaçıncı ile getir'],
                ['индекс', 'значение по номеру строки', 'индекс поискпоз', 'взять из позиции', 'ячейка на пересечении', 'найти влево', 'вернуть по строке и столбцу', 'подтянуть по позиции', 'n-я строка диапазона', 'значение из таблицы по координатам', 'поиск по номеру строки'],
                ['index', 'value at position', 'index match', 'row and column lookup'])
  },
  {
    name: 'INDIRECT', tr: 'DOLAYLI', ru: 'ДВССЫЛ', category: 'lookup', volatile: true,
    syntax: 'INDIRECT(ref_text, [a1])',
    args: [
      arg('ref_text', 'başv_metni', 'ссылка_на_текст', false,
        'Başvuruyu metin olarak içeren hücre veya metin: "B2", "Sayfa2!A1", "Tablo1[Tutar]"', 'Текст или ячейка с текстом ссылки: "B2", "Лист2!A1", "Таблица1[Сумма]"', 'Text or a cell holding the reference as text: "B2", "Sheet2!A1", "Table1[Amount]"'),
      arg('a1', 'a1', 'a1', true,
        'DOĞRU veya boş: A1 stili; YANLIŞ: R1C1 stili', 'ИСТИНА или пусто: стиль A1; ЛОЖЬ: стиль R1C1', 'TRUE or omitted: A1 style; FALSE: R1C1 style')
    ],
    desc: L('Metin olarak yazılmış bir başvuruyu gerçek başvuruya çevirir ve o hücrenin değerini verir.',
            'Преобразует ссылку, заданную текстом, в настоящую ссылку и возвращает значение этой ячейки.',
            'Turns a reference written as text into a real reference and returns the value of that cell.'),
    example: ex('INDIRECT("\'"&A2&"\'!B2")',
      'A2’de yazan sayfa adının B2 hücresindeki değeri getirir',
      'Возвращает значение ячейки B2 с листа, имя которого записано в A2',
      'Returns the value of cell B2 on the sheet whose name is written in A2'),
    keywords: L(['dolaylı başvuru', 'metinden başvuru', 'sayfa adına göre hücre', 'dinamik aralık', 'adresi metin olarak kullan', 'değişken sayfa adı', 'hücredeki adrese git'],
                ['двссыл', 'ссылка из текста', 'динамическая ссылка', 'имя листа в ячейке', 'адрес из текста', 'косвенная ссылка', 'переменное имя листа'],
                ['indirect', 'reference from text', 'dynamic reference', 'sheet name in cell'])
  },
  {
    name: 'LOOKUP', tr: 'ARA', ru: 'ПРОСМОТР', category: 'lookup',
    syntax: 'LOOKUP(lookup_value, lookup_vector, [result_vector])',
    args: [
      ARG_LOOKUP_VALUE,
      arg('lookup_vector', 'arama_vektörü', 'просматриваемый_вектор', false,
        'Tek satır veya sütunluk arama aralığı; artan sırada olmalıdır', 'Диапазон из одной строки или столбца, в котором ведётся поиск; должен быть отсортирован по возрастанию', 'A single-row or single-column range to search; must be sorted ascending'),
      arg('result_vector', 'sonuç_vektörü', 'вектор_результатов', true,
        'Aynı boyutta sonuç aralığı; boş bırakılırsa arama vektöründen değer döner', 'Диапазон результатов того же размера; если опущен, значение берётся из просматриваемого вектора', 'A result range of the same size; the lookup vector is used if omitted')
    ],
    desc: L('Tek satır veya sütunda bir değeri yaklaşık eşleşmeyle arar ve başka bir satır ya da sütunda aynı konumdaki değeri verir.',
            'Ищет значение в одной строке или столбце с приблизительным совпадением и возвращает значение из той же позиции другого вектора.',
            'Searches one row or column with approximate matching and returns the value at the same position in another row or column.'),
    example: ex('LOOKUP(2,1/(A2:A200<>""),A2:A200)',
      'A2:A200 sütunundaki son dolu hücrenin değerini verir',
      'Возвращает значение последней непустой ячейки в столбце A2:A200',
      'Returns the value of the last non-empty cell in A2:A200'),
    keywords: L(['ara', 'vektörde ara', 'son dolu hücre', 'yaklaşık eşleşme ile bul', 'sıralı listede ara', 'eski arama işlevi', 'son değeri getir'],
                ['просмотр', 'найти в векторе', 'последнее непустое значение', 'приблизительный поиск', 'поиск в отсортированном списке', 'подтянуть значение', 'последнее значение в столбце'],
                ['lookup', 'last non-empty value', 'approximate lookup'])
  },
  {
    name: 'MATCH', tr: 'KAÇINCI', ru: 'ПОИСКПОЗ', category: 'lookup',
    syntax: 'MATCH(lookup_value, lookup_array, [match_type])',
    args: [
      ARG_LOOKUP_VALUE,
      arg('lookup_array', 'aranan_dizi', 'просматриваемый_массив', false,
        'Tek satır veya sütunluk arama aralığı', 'Диапазон из одной строки или столбца, в котором ведётся поиск', 'A single-row or single-column range to search'),
      arg('match_type', 'eşleştir_tür', 'тип_сопоставления', true,
        '0: tam eşleşme; 1 veya boş: küçük/eşit en büyük (artan sıralı); -1: büyük/eşit en küçük (azalan sıralı)', '0: точное совпадение; 1 или пусто: наибольшее ≤ (по возрастанию); -1: наименьшее ≥ (по убыванию)', '0: exact match; 1 or omitted: largest value ≤ (ascending); -1: smallest value ≥ (descending)')
    ],
    desc: L('Bir değerin aralıkta kaçıncı sırada olduğunu (konumunu) verir.',
            'Возвращает позицию (порядковый номер) значения в диапазоне.',
            'Returns the position of a value within a range.'),
    example: ex('MATCH("Ankara",H2:H200,0)',
      'H2:H200 içinde "Ankara" değerinin kaçıncı sırada olduğunu verir',
      'Возвращает, на какой позиции в H2:H200 находится значение "Ankara"',
      'Returns the position of "Ankara" within H2:H200'),
    keywords: L(['kaçıncı', 'konumunu bul', 'sıra numarası', 'hangi satırda', 'değerin yeri', 'eşleştir', 'pozisyon', 'index match', 'listede kaçıncı', 'satır numarasını bul', 'aranan değerin sırası', 'indis kaçıncı'],
                ['поискпоз', 'позиция значения', 'номер строки по значению', 'в какой строке', 'найти позицию', 'порядковый номер', 'индекс поискпоз', 'где находится значение', 'номер совпадения', 'сопоставить', 'какой по счёту'],
                ['match', 'position of value', 'find row number', 'index match'])
  },
  {
    name: 'OFFSET', tr: 'KAYDIR', ru: 'СМЕЩ', category: 'lookup', volatile: true,
    syntax: 'OFFSET(reference, rows, cols, [height], [width])',
    args: [
      arg('reference', 'başv', 'ссылка', false,
        'Kaydırmanın başlayacağı hücre veya aralık', 'Ячейка или диапазон, от которого отсчитывается смещение', 'The cell or range the offset starts from'),
      arg('rows', 'satırlar', 'смещ_по_строкам', false,
        'Aşağı (pozitif) veya yukarı (negatif) kaydırılacak satır sayısı', 'Число строк смещения вниз (положительное) или вверх (отрицательное)', 'Rows to move down (positive) or up (negative)'),
      arg('cols', 'sütunlar', 'смещ_по_столбцам', false,
        'Sağa (pozitif) veya sola (negatif) kaydırılacak sütun sayısı', 'Число столбцов смещения вправо (положительное) или влево (отрицательное)', 'Columns to move right (positive) or left (negative)'),
      arg('height', 'yükseklik', 'высота', true,
        'Sonuç aralığının satır sayısı; boşsa başvuruyla aynı', 'Число строк результата; по умолчанию как у ссылки', 'The number of rows in the result; same as reference if omitted'),
      arg('width', 'genişlik', 'ширина', true,
        'Sonuç aralığının sütun sayısı; boşsa başvuruyla aynı', 'Число столбцов результата; по умолчанию как у ссылки', 'The number of columns in the result; same as reference if omitted')
    ],
    desc: L('Bir başvurudan belirtilen satır ve sütun kadar kaydırılmış, isteğe bağlı boyutta yeni bir başvuru verir.',
            'Возвращает ссылку, смещённую от исходной на заданное число строк и столбцов, с необязательными размерами.',
            'Returns a reference offset from a starting reference by a given number of rows and columns, with optional size.'),
    example: ex('SUM(OFFSET(E2,0,0,COUNTA(E2:E200),1))',
      'E2’den başlayıp dolu satır sayısı kadar uzanan dinamik aralığı toplar',
      'Суммирует динамический диапазон от E2 высотой в число заполненных строк',
      'Sums a dynamic range starting at E2 whose height is the number of filled rows'),
    keywords: L(['kaydır', 'kaydırılmış aralık', 'dinamik aralık', 'satır sütun kadar ötele', 'göreli başvuru', 'son n satır', 'hareketli aralık', 'kayan toplam'],
                ['смещение', 'сдвинуть диапазон', 'динамический диапазон', 'сместить на строки и столбцы', 'последние n строк', 'скользящий диапазон', 'смещ', 'подвижный диапазон'],
                ['offset', 'dynamic range', 'shifted reference', 'last n rows'])
  },
  {
    name: 'ROW', tr: 'SATIR', ru: 'СТРОКА', category: 'lookup',
    syntax: 'ROW([reference])',
    args: [
      arg('reference', 'başvuru', 'ссылка', true,
        'Satır numarası istenen hücre; boş bırakılırsa formülün bulunduğu hücre', 'Ячейка, номер строки которой нужен; если опущено — ячейка с формулой', 'The cell whose row number you want; the formula cell if omitted')
    ],
    desc: L('Başvurunun satır numarasını verir; başvuru verilmezse formülün bulunduğu satırın numarasını verir.',
            'Возвращает номер строки ссылки, а без аргумента — номер строки ячейки с формулой.',
            'Returns the row number of a reference, or of the formula cell when no reference is given.'),
    example: ex('ROW()-1',
      '2. satırdan başlayan veriler için otomatik sıra numarası (1, 2, 3 …) üretir',
      'Даёт автоматическую нумерацию (1, 2, 3 …) для данных, начинающихся со 2-й строки',
      'Produces an automatic sequence number (1, 2, 3 …) for data starting on row 2'),
    keywords: L(['satır numarası', 'kaçıncı satır', 'sıra numarası ver', 'otomatik numaralandırma', 'satır no', 'hangi satırda', 'numara ver'],
                ['номер строки', 'какая строка', 'порядковый номер', 'автонумерация', 'номер текущей строки', 'нумерация строк', 'пронумеровать'],
                ['row number', 'which row', 'auto numbering'])
  },
  {
    name: 'ROWS', tr: 'SATIRSAY', ru: 'ЧСТРОК', category: 'lookup',
    syntax: 'ROWS(array)',
    args: [
      arg('array', 'dizi', 'массив', false,
        'Satırları sayılacak dizi, dizi formülü veya aralık', 'Массив, формула массива или диапазон, строки которого нужно посчитать', 'The array, array formula or range whose rows you want to count')
    ],
    desc: L('Bir dizi veya başvurudaki satır sayısını verir.',
            'Возвращает количество строк в массиве или ссылке.',
            'Returns the number of rows in an array or reference.'),
    example: ex('ROWS(UNIQUE(B2:B200))',
      'B2:B200 içindeki benzersiz değerlerin sayısını verir',
      'Возвращает количество уникальных значений в B2:B200',
      'Returns the number of unique values in B2:B200'),
    keywords: L(['satır sayısı', 'kaç satır', 'aralıktaki satırlar', 'benzersiz sayısı', 'satır adedi', 'satırları say'],
                ['количество строк', 'сколько строк', 'число строк в диапазоне', 'количество уникальных', 'строк в массиве', 'посчитать строки'],
                ['number of rows', 'count rows', 'count unique'])
  },
  {
    name: 'RTD', tr: 'GZV', ru: 'ДРВ', category: 'lookup', volatile: true,
    syntax: 'RTD(progID, server, topic1, [topic2], ...)',
    args: [
      arg('progID', 'prog_kimliği', 'ProgID', false,
        'Bilgisayarda kayıtlı RTD COM eklentisinin program kimliği, tırnak içinde', 'Идентификатор (ProgID) зарегистрированной надстройки RTD COM в кавычках', 'The ProgID of the registered RTD COM add-in, in quotes'),
      arg('server', 'sunucu', 'сервер', false,
        'Eklentinin çalıştığı sunucu adı; yerel bilgisayar için boş bırakın', 'Имя сервера с надстройкой; для локального компьютера оставьте пустым', 'The server name where the add-in runs; leave empty for the local machine'),
      arg('topic1', 'konu1', 'раздел1', false,
        'İstenen veriyi belirten ilk konu (örn. hisse kodu)', 'Первый раздел, определяющий запрашиваемые данные (например, тикер)', 'The first topic identifying the data (e.g. a ticker)'),
      arg('topic2', 'konu2', 'раздел2', true,
        'Ek konular, 253 taneye kadar', 'Дополнительные разделы, до 253', 'Additional topics, up to 253')
    ],
    desc: L('COM otomasyonunu destekleyen bir programdan gerçek zamanlı veri alır.',
            'Получает данные в реальном времени из программы, поддерживающей автоматизацию COM.',
            'Retrieves real-time data from a program that supports COM automation.'),
    example: ex('RTD("myrtd.server",,"Fiyat","THYAO")',
      '"myrtd.server" eklentisinden THYAO hissesinin anlık fiyatını alır',
      'Получает текущую цену акции THYAO из надстройки "myrtd.server"',
      'Gets the live price of the THYAO stock from the "myrtd.server" add-in'),
    keywords: L(['gerçek zamanlı veri', 'canlı veri', 'com sunucusundan veri', 'borsa verisi', 'rtd sunucusu', 'anlık fiyat'],
                ['данные в реальном времени', 'реальное время', 'сервер rtd', 'биржевые котировки', 'данные из com', 'текущая цена'],
                ['real-time data', 'rtd server', 'live data'])
  },
  {
    name: 'TRANSPOSE', tr: 'DEVRİK_DÖNÜŞÜM', ru: 'ТРАНСП', category: 'lookup',
    syntax: 'TRANSPOSE(array)',
    args: [
      arg('array', 'dizi', 'массив', false,
        'Satır ve sütunları yer değiştirilecek aralık veya dizi', 'Диапазон или массив, строки и столбцы которого нужно поменять местами', 'The range or array whose rows and columns are swapped')
    ],
    desc: L('Bir aralığın satırlarını sütuna, sütunlarını satıra çevirir.',
            'Меняет местами строки и столбцы диапазона.',
            'Converts the rows of a range into columns and the columns into rows.'),
    example: ex('TRANSPOSE(A1:M1)',
      'Yatay başlık satırı A1:M1’i dikey bir liste olarak döker',
      'Выводит горизонтальную строку заголовков A1:M1 в виде вертикального списка',
      'Spills the horizontal header row A1:M1 as a vertical list'),
    keywords: L(['devrik', 'satırı sütuna çevir', 'sütunu satıra çevir', 'yatayı dikeye', 'tabloyu döndür', 'transpoze', 'dikeyi yataya'],
                ['транспонировать', 'строки в столбцы', 'столбцы в строки', 'повернуть таблицу', 'горизонтально в вертикально', 'трансп', 'вертикально в горизонтально'],
                ['transpose', 'rows to columns', 'flip table'])
  },
  {
    name: 'VLOOKUP', tr: 'DÜŞEYARA', ru: 'ВПР', category: 'lookup',
    syntax: 'VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup])',
    args: [
      ARG_LOOKUP_VALUE,
      arg('table_array', 'tablo_dizisi', 'таблица', false,
        'İlk sütununda arama yapılacak tablo; sabit kalması için $ ile yazın', 'Таблица, в первом столбце которой ведётся поиск; закрепите её знаком $', 'The table whose first column is searched; lock it with $ signs'),
      arg('col_index_num', 'sütun_indis_sayısı', 'номер_столбца', false,
        'Değerin alınacağı sütunun tablo içindeki numarası (1 = ilk sütun)', 'Номер столбца таблицы, из которого берётся значение (1 = первый столбец)', 'The column number in the table to return the value from (1 = first column)'),
      arg('range_lookup', 'aralık_bak', 'интервальный_просмотр', true,
        'YANLIŞ: tam eşleşme; DOĞRU veya boş: yaklaşık eşleşme (ilk sütun sıralı olmalı)', 'ЛОЖЬ: точное совпадение; ИСТИНА или пусто: приблизительное (первый столбец должен быть отсортирован)', 'FALSE: exact match; TRUE or omitted: approximate match (first column must be sorted)')
    ],
    desc: L('Tablonun ilk sütununda bir değeri arar ve aynı satırda belirtilen sütundaki değeri verir.',
            'Ищет значение в первом столбце таблицы и возвращает значение из указанного столбца той же строки.',
            'Searches the first column of a table and returns the value in the specified column of the same row.'),
    example: ex('VLOOKUP(A2,Ürünler!$A$2:$C$50,3,FALSE)',
      'A2’deki ürün kodunu Ürünler sayfasında bulur ve 3. sütundaki fiyatı getirir',
      'Находит код товара из A2 на листе Ürünler и возвращает цену из 3-го столбца',
      'Finds the product code from A2 on the Ürünler sheet and returns the price from column 3'),
    keywords: L(['düşeyara', 'ara', 'bul', 'getir', 'başka tablodan getir', 'başka sayfadan çek', 'koda göre fiyat getir', 'listeden karşılığını bul', 'eşleşen değeri getir', 'dikey arama', 'tablodan değer çek', 'ilk sütunda ara', 'ürün adını getir', 'karşılığını getir'],
                ['впр', 'найти', 'подтянуть', 'вернуть значение', 'подтянуть из другой таблицы', 'взять с другого листа', 'цена по коду', 'найти соответствие в списке', 'вертикальный поиск', 'вытащить из таблицы', 'поиск по первому столбцу', 'подставить значение', 'подтянуть название'],
                ['vlookup', 'lookup', 'fetch from table', 'find matching value', 'pull from another sheet'])
  },
  {
    name: 'XLOOKUP', tr: 'ÇAPRAZARA', ru: 'ПРОСМОТРX', category: 'lookup', minVersion: '2021',
    syntax: 'XLOOKUP(lookup_value, lookup_array, return_array, [if_not_found], [match_mode], [search_mode])',
    args: [
      ARG_LOOKUP_VALUE,
      arg('lookup_array', 'aranan_dizi', 'просматриваемый_массив', false,
        'Değerin aranacağı aralık (tek satır veya sütun)', 'Диапазон (строка или столбец), в котором ищется значение', 'The range (single row or column) to search'),
      arg('return_array', 'döndürülen_dizi', 'возвращаемый_массив', false,
        'Sonucun alınacağı aynı boyuttaki aralık; birden çok sütun olabilir', 'Диапазон того же размера, из которого берётся результат; может содержать несколько столбцов', 'The range of the same size to return from; may have several columns'),
      arg('if_not_found', 'bulunamazsa', 'если_ничего_не_найдено', true,
        'Eşleşme yoksa döndürülecek değer; verilmezse #YOK', 'Значение, если совпадений нет; иначе #Н/Д', 'The value to return when no match is found; #N/A if omitted'),
      arg('match_mode', 'eşleştirme_modu', 'режим_сопоставления', true,
        '0 veya boş: tam; -1: tam veya sonraki küçük; 1: tam veya sonraki büyük; 2: joker karakterli', '0 или пусто: точное; -1: точное или ближайшее меньшее; 1: точное или ближайшее большее; 2: с подстановочными знаками', '0 or omitted: exact; -1: exact or next smaller; 1: exact or next larger; 2: wildcard'),
      arg('search_mode', 'arama_modu', 'режим_поиска', true,
        '1 veya boş: baştan; -1: sondan; 2: artan ikili arama; -2: azalan ikili arama', '1 или пусто: с начала; -1: с конца; 2: двоичный поиск по возрастанию; -2: по убыванию', '1 or omitted: from first; -1: from last; 2: binary ascending; -2: binary descending')
    ],
    desc: L('Bir aralıkta değeri arar ve başka bir aralıkta aynı konumdaki değeri verir; bulunamazsa isteğe bağlı değeri döndürür.',
            'Ищет значение в одном диапазоне и возвращает значение из той же позиции другого диапазона, а при отсутствии совпадения — заданное значение.',
            'Searches a range for a value and returns the item at the same position in another range, or an optional value when not found.'),
    example: ex('XLOOKUP(A2,Ürünler!$A$2:$A$50,Ürünler!$C$2:$C$50,"Bulunamadı")',
      'A2’deki kodu Ürünler sayfasında arar, fiyatı getirir; bulamazsa "Bulunamadı" yazar',
      'Ищет код из A2 на листе Ürünler и возвращает цену; если не найдено — "Bulunamadı"',
      'Looks up the code from A2 on the Ürünler sheet and returns the price, or "Bulunamadı" when missing'),
    keywords: L(['çaprazara', 'ara', 'bul', 'getir', 'modern arama', 'her yöne ara', 'sola doğru getir', 'bulunamadı yaz', 'başka sayfadan getir', 'son eşleşmeyi bul', 'koda göre getir', 'düşeyara yerine', 'eşleşen değeri getir', 'karşılığını getir'],
                ['просмотрx', 'найти', 'подтянуть', 'вернуть', 'современный поиск', 'искать в любом направлении', 'поиск влево', 'если не найдено', 'с другого листа', 'последнее совпадение', 'по коду подтянуть', 'вместо впр', 'сопоставить и вернуть', 'подставить значение'],
                ['xlookup', 'lookup', 'modern lookup', 'lookup left', 'fetch value'])
  },
  {
    name: 'XMATCH', tr: 'ÇAPRAZEŞLEŞTİR', ru: 'ПОИСКПОЗX', category: 'lookup', minVersion: '2021',
    syntax: 'XMATCH(lookup_value, lookup_array, [match_mode], [search_mode])',
    args: [
      ARG_LOOKUP_VALUE,
      arg('lookup_array', 'aranan_dizi', 'просматриваемый_массив', false,
        'Değerin aranacağı aralık veya dizi', 'Диапазон или массив, в котором ищется значение', 'The range or array to search'),
      arg('match_mode', 'eşleştirme_modu', 'режим_сопоставления', true,
        '0 veya boş: tam; -1: tam veya sonraki küçük; 1: tam veya sonraki büyük; 2: joker karakterli', '0 или пусто: точное; -1: точное или ближайшее меньшее; 1: точное или ближайшее большее; 2: с подстановочными знаками', '0 or omitted: exact; -1: exact or next smaller; 1: exact or next larger; 2: wildcard'),
      arg('search_mode', 'arama_modu', 'режим_поиска', true,
        '1 veya boş: baştan; -1: sondan; 2: artan ikili arama; -2: azalan ikili arama', '1 или пусто: с начала; -1: с конца; 2: двоичный поиск по возрастанию; -2: по убыванию', '1 or omitted: from first; -1: from last; 2: binary ascending; -2: binary descending')
    ],
    desc: L('Bir değerin dizideki konumunu verir; eşleştirme ve arama yönü seçenekleri KAÇINCI’dan daha esnektir.',
            'Возвращает позицию значения в массиве; режимы сопоставления и направления поиска гибче, чем у ПОИСКПОЗ.',
            'Returns the position of a value in an array, with more flexible match and search-direction options than MATCH.'),
    example: ex('XMATCH("Ankara",H2:H200,0,-1)',
      'H2:H200 içinde "Ankara" değerinin son geçtiği konumu verir',
      'Возвращает позицию последнего вхождения "Ankara" в H2:H200',
      'Returns the position of the last occurrence of "Ankara" in H2:H200'),
    keywords: L(['çapraz eşleştir', 'konum bul', 'kaçıncı modern', 'sondan ara', 'joker ile eşleştir', 'değerin sırası', 'son eşleşmenin konumu'],
                ['поискпозx', 'позиция значения', 'найти позицию', 'поиск с конца', 'современный поискпоз', 'номер совпадения', 'позиция последнего совпадения'],
                ['xmatch', 'position', 'search from last'])
  },
  {
    name: 'IMAGE', tr: 'RESİM', ru: 'ИЗОБРАЖЕНИЕ', category: 'lookup', minVersion: '365',
    syntax: 'IMAGE(source, [alt_text], [sizing], [height], [width])',
    args: [
      arg('source', 'kaynak', 'источник', false,
        'Resmin https URL’si (BMP, JPG, GIF, TIFF, PNG, ICO veya WEBP)', 'URL изображения по https (BMP, JPG, GIF, TIFF, PNG, ICO или WEBP)', 'The https URL of the image (BMP, JPG, GIF, TIFF, PNG, ICO or WEBP)'),
      arg('alt_text', 'alternatif_metin', 'замещающий_текст', true,
        'Erişilebilirlik için açıklayıcı metin', 'Описательный текст для специальных возможностей', 'Descriptive text for accessibility'),
      arg('sizing', 'boyutlandırma', 'размер', true,
        '0 veya boş: hücreye sığdır (oran korunur); 1: hücreyi doldur; 2: özgün boyut; 3: özel yükseklik/genişlik', '0 или пусто: вписать в ячейку с сохранением пропорций; 1: заполнить ячейку; 2: исходный размер; 3: заданные высота и ширина', '0 or omitted: fit cell keeping aspect ratio; 1: fill cell; 2: original size; 3: custom height/width'),
      arg('height', 'yükseklik', 'высота', true,
        'Boyutlandırma 3 ise piksel cinsinden yükseklik', 'Высота в пикселях при размере 3', 'Height in pixels when sizing is 3'),
      arg('width', 'genişlik', 'ширина', true,
        'Boyutlandırma 3 ise piksel cinsinden genişlik', 'Ширина в пикселях при размере 3', 'Width in pixels when sizing is 3')
    ],
    desc: L('Bir URL’deki resmi hücrenin içine ekler ve isteğe bağlı boyutlandırma uygular.',
            'Вставляет изображение по URL внутрь ячейки с необязательной настройкой размера.',
            'Inserts the image at a URL into the cell, with optional sizing.'),
    example: ex('IMAGE("https://www.example.com/logo.png","Logo",1)',
      'Belirtilen adresteki logoyu hücreyi dolduracak şekilde gösterir',
      'Показывает логотип по указанному адресу, заполняя ячейку',
      'Shows the logo at the given address, filling the cell'),
    keywords: L(['hücreye resim', 'url’den görsel', 'resim ekle', 'hücre içinde görüntü', 'logo göster', 'bağlantıdan resim'],
                ['изображение в ячейке', 'картинка по ссылке', 'вставить изображение', 'рисунок в ячейку', 'показать логотип', 'картинка из url'],
                ['image in cell', 'picture from url', 'insert image'])
  },

  /* ================================================================== DYNAMIC ARRAYS (365) */
  {
    name: 'CHOOSECOLS', tr: 'SÜTUNSEÇ', ru: 'ВЫБОРСТОЛБЦ', category: 'dynamic', minVersion: '365',
    syntax: 'CHOOSECOLS(array, col_num1, [col_num2], ...)',
    args: [
      arg('array', 'dizi', 'массив', false,
        'Sütunların alınacağı dizi veya aralık', 'Массив или диапазон, из которого берутся столбцы', 'The array or range to take columns from'),
      arg('col_num1', 'sütun_sayısı1', 'номер_столбца1', false,
        'Döndürülecek ilk sütunun numarası; negatif sayı sondan sayar', 'Номер первого возвращаемого столбца; отрицательное число отсчитывается с конца', 'The number of the first column to return; a negative number counts from the end'),
      arg('col_num2', 'sütun_sayısı2', 'номер_столбца2', true,
        'Döndürülecek ek sütun numaraları, istenen sırada', 'Номера дополнительных столбцов в нужном порядке', 'Further column numbers, in the desired order')
    ],
    desc: L('Bir diziden belirtilen numaralı sütunları, verilen sırada yeni bir dizi olarak verir.',
            'Возвращает новый массив из указанных по номерам столбцов исходного массива в заданном порядке.',
            'Returns a new array made of the specified columns of an array, in the given order.'),
    example: ex('CHOOSECOLS(A2:M200,1,5,8)',
      'A2:M200 tablosundan yalnızca 1., 5. ve 8. sütunları (Ürün, Tutar, Şehir) döker',
      'Выводит из таблицы A2:M200 только 1-й, 5-й и 8-й столбцы (товар, сумма, город)',
      'Spills only columns 1, 5 and 8 (product, amount, city) of the table A2:M200'),
    keywords: L(['sütunları seç', 'belirli sütunları al', 'sütun çıkar', 'sütunları yeniden sırala', 'sadece şu sütunlar', 'sütun numarasına göre al'],
                ['выбрать столбцы', 'взять определённые столбцы', 'только нужные столбцы', 'переставить столбцы', 'столбцы по номерам', 'извлечь столбцы'],
                ['choose columns', 'select columns', 'pick columns by number'])
  },
  {
    name: 'CHOOSEROWS', tr: 'SATIRSEÇ', ru: 'ВЫБОРСТРОК', category: 'dynamic', minVersion: '365',
    syntax: 'CHOOSEROWS(array, row_num1, [row_num2], ...)',
    args: [
      arg('array', 'dizi', 'массив', false,
        'Satırların alınacağı dizi veya aralık', 'Массив или диапазон, из которого берутся строки', 'The array or range to take rows from'),
      arg('row_num1', 'satır_sayısı1', 'номер_строки1', false,
        'Döndürülecek ilk satırın numarası; negatif sayı sondan sayar', 'Номер первой возвращаемой строки; отрицательное число отсчитывается с конца', 'The number of the first row to return; a negative number counts from the end'),
      arg('row_num2', 'satır_sayısı2', 'номер_строки2', true,
        'Döndürülecek ek satır numaraları, istenen sırada', 'Номера дополнительных строк в нужном порядке', 'Further row numbers, in the desired order')
    ],
    desc: L('Bir diziden belirtilen numaralı satırları, verilen sırada yeni bir dizi olarak verir.',
            'Возвращает новый массив из указанных по номерам строк исходного массива в заданном порядке.',
            'Returns a new array made of the specified rows of an array, in the given order.'),
    example: ex('CHOOSEROWS(A2:E200,1,-1)',
      'A2:E200 tablosunun ilk ve son satırını döker',
      'Выводит первую и последнюю строки таблицы A2:E200',
      'Spills the first and the last row of the table A2:E200'),
    keywords: L(['satırları seç', 'belirli satırları al', 'ilk ve son satır', 'satır numarasına göre al', 'sadece şu satırlar', 'satır çıkar'],
                ['выбрать строки', 'взять определённые строки', 'первая и последняя строка', 'строки по номерам', 'только нужные строки', 'извлечь строки'],
                ['choose rows', 'select rows', 'pick rows by number'])
  },
  {
    name: 'DROP', tr: 'BIRAK', ru: 'СБРОСИТЬ', category: 'dynamic', minVersion: '365',
    syntax: 'DROP(array, rows, [columns])',
    args: [
      arg('array', 'dizi', 'массив', false,
        'Satır veya sütunları atılacak dizi', 'Массив, из которого отбрасываются строки или столбцы', 'The array to drop rows or columns from'),
      arg('rows', 'satırlar', 'строки', false,
        'Atılacak satır sayısı; pozitif baştan, negatif sondan atar', 'Число отбрасываемых строк; положительное — с начала, отрицательное — с конца', 'The number of rows to drop; positive from the start, negative from the end'),
      arg('columns', 'sütunlar', 'столбцы', true,
        'Atılacak sütun sayısı; pozitif soldan, negatif sağdan atar', 'Число отбрасываемых столбцов; положительное — слева, отрицательное — справа', 'The number of columns to drop; positive from the left, negative from the right')
    ],
    desc: L('Dizinin başından veya sonundan belirtilen sayıda satır ya da sütunu atar ve kalanını verir.',
            'Отбрасывает заданное число строк или столбцов с начала или с конца массива и возвращает остаток.',
            'Removes the given number of rows or columns from the start or end of an array and returns the rest.'),
    example: ex('DROP(A1:M200,1)',
      'Başlık satırını atarak A2:M200 veri bloğunu döker',
      'Отбрасывает строку заголовков и выводит блок данных A2:M200',
      'Drops the header row and spills the data block A2:M200'),
    keywords: L(['satırları atla', 'başlığı çıkar', 'ilk satırı at', 'son satırları kaldır', 'sütun at', 'ilk n satırı çıkar', 'baştan at'],
                ['отбросить строки', 'убрать заголовок', 'без первой строки', 'удалить последние строки', 'отбросить столбцы', 'пропустить n строк', 'сбросить'],
                ['drop rows', 'skip header', 'remove first rows'])
  },
  {
    name: 'EXPAND', tr: 'GENİŞLET', ru: 'РАЗВЕРНУТЬ', category: 'dynamic', minVersion: '365',
    syntax: 'EXPAND(array, rows, [columns], [pad_with])',
    args: [
      arg('array', 'dizi', 'массив', false,
        'Genişletilecek dizi', 'Расширяемый массив', 'The array to expand'),
      arg('rows', 'satırlar', 'строки', false,
        'Sonucun toplam satır sayısı; boşsa değişmez', 'Итоговое число строк; если опущено, не меняется', 'The total number of rows in the result; unchanged if omitted'),
      arg('columns', 'sütunlar', 'столбцы', true,
        'Sonucun toplam sütun sayısı; boşsa değişmez', 'Итоговое число столбцов; если опущено, не меняется', 'The total number of columns in the result; unchanged if omitted'),
      ARG_PAD_WITH
    ],
    desc: L('Diziyi belirtilen satır ve sütun boyutuna genişletir; yeni hücreleri verilen değerle doldurur.',
            'Расширяет массив до заданного числа строк и столбцов, заполняя новые ячейки указанным значением.',
            'Expands an array to the given number of rows and columns, filling the new cells with a value.'),
    example: ex('EXPAND(A2:B5,10,3,"")',
      'A2:B5 dizisini 10 satır × 3 sütuna büyütür, eklenen hücreleri boş metinle doldurur',
      'Увеличивает массив A2:B5 до 10 строк × 3 столбцов, заполняя новые ячейки пустым текстом',
      'Grows the array A2:B5 to 10 rows × 3 columns, filling added cells with empty text'),
    keywords: L(['diziyi genişlet', 'boyut büyüt', 'boş hücrelerle doldur', 'satır ekle', 'diziyi doldur', 'sabit boyuta getir'],
                ['расширить массив', 'увеличить размер', 'дополнить пустыми', 'добавить строки', 'заполнить массив', 'привести к размеру'],
                ['expand array', 'pad array', 'resize array'])
  },
  {
    name: 'FILTER', tr: 'FİLTRE', ru: 'ФИЛЬТР', category: 'dynamic', minVersion: '365',
    syntax: 'FILTER(array, include, [if_empty])',
    args: [
      arg('array', 'dizi', 'массив', false,
        'Süzülecek aralık veya dizi (tüm veri bloğu olabilir)', 'Фильтруемый диапазон или массив (можно весь блок данных)', 'The range or array to filter (can be the whole data block)'),
      arg('include', 'ekle', 'включить', false,
        'Her satır (veya sütun) için DOĞRU/YANLIŞ üreten koşul, örn. B2:B200="Gıda"; birden çok koşul * (VE) ve + (VEYA) ile birleştirilir', 'Условие, дающее ИСТИНА/ЛОЖЬ для каждой строки (или столбца), например B2:B200="Еда"; несколько условий объединяются через * (И) и + (ИЛИ)', 'A condition producing TRUE/FALSE per row (or column), e.g. B2:B200="Food"; combine conditions with * (AND) and + (OR)'),
      arg('if_empty', 'boşsa', 'если_пусто', true,
        'Hiçbir satır koşulu sağlamazsa döndürülecek değer; verilmezse #HESAPLA!', 'Значение, если ни одна строка не подходит; иначе #ВЫЧИС!', 'The value to return when nothing matches; #CALC! if omitted')
    ],
    desc: L('Bir aralıktan koşulu sağlayan satır veya sütunları süzerek döker.',
            'Возвращает строки или столбцы диапазона, удовлетворяющие условию.',
            'Returns the rows or columns of a range that meet a condition.'),
    example: ex('FILTER(A2:E200,B2:B200="Gıda","")',
      'Kategorisi "Gıda" olan tüm satırları A2:E200 tablosundan döker; yoksa boş bırakır',
      'Выводит из таблицы A2:E200 все строки с категорией "Gıda"; если таких нет — пусто',
      'Spills every row of A2:E200 whose category is "Gıda", or blank when none'),
    keywords: L(['filtrele', 'süz', 'koşula uyan satırlar', 'şarta göre listele', 'sadece şunları göster', 'kriterle süz', 'eşleşen kayıtlar', 'birden fazla sonuç getir', 'tüm eşleşmeleri getir', 'kategoriye göre liste', 'koşula göre ayıkla'],
                ['фильтр', 'отфильтровать', 'строки по условию', 'вывести подходящие', 'показать только', 'отбор по критерию', 'все совпадения', 'список по условию', 'выбрать строки где', 'динамическая фильтрация', 'отобрать записи'],
                ['filter', 'rows matching condition', 'all matches', 'extract records'])
  },
  {
    name: 'GROUPBY', tr: 'GROUPBY', ru: 'GROUPBY', category: 'dynamic', minVersion: '365', uncertain: ['tr', 'ru'],
    syntax: 'GROUPBY(row_fields, values, function, [field_headers], [total_depth], [sort_order], [filter_array], [field_relationship])',
    args: [
      arg('row_fields', 'satır_alanları', 'поля_строк', false,
        'Gruplama yapılacak sütun(lar), örn. Kategori', 'Столбец или столбцы, по которым идёт группировка (например, категория)', 'The column(s) to group by, e.g. category'),
      arg('values', 'değerler', 'значения', false,
        'Özetlenecek değer sütun(lar)ı, örn. Tutar', 'Столбец или столбцы со значениями для агрегации (например, сумма)', 'The value column(s) to aggregate, e.g. amount'),
      arg('function', 'işlev', 'функция', false,
        'Özet işlevi: SUM, AVERAGE, COUNT, MAX, MIN, MEDIAN, PERCENTOF gibi bir eta-lambda veya LAMBDA', 'Функция агрегации: SUM, AVERAGE, COUNT, MAX, MIN, MEDIAN, PERCENTOF (eta-лямбда) или своя LAMBDA', 'The aggregation: an eta-lambda such as SUM, AVERAGE, COUNT, MAX, MIN, MEDIAN, PERCENTOF, or a LAMBDA'),
      arg('field_headers', 'alan_başlıkları', 'заголовки_полей', true,
        '0: başlık yok; 1: var, gösterme; 2: yok, üret; 3: var, göster', '0: без заголовков; 1: есть, не показывать; 2: нет, создать; 3: есть, показать', '0: no headers; 1: present, hide; 2: none, generate; 3: present, show'),
      arg('total_depth', 'toplam_derinliği', 'глубина_итогов', true,
        '0: genel toplam yok; 1: genel toplam; 2: ara ve genel toplamlar; negatif değerler toplamları üste koyar', '0: без итогов; 1: общий итог; 2: промежуточные и общий итоги; отрицательные значения ставят итоги сверху', '0: no totals; 1: grand total; 2: subtotals and grand total; negative values put totals on top'),
      arg('sort_order', 'sıralama_düzeni', 'порядок_сортировки', true,
        'Sıralanacak sütun numarası; negatif sayı azalan sıralar', 'Номер столбца для сортировки; отрицательное число — по убыванию', 'The column number to sort by; negative sorts descending'),
      arg('filter_array', 'filtre_dizisi', 'массив_фильтра', true,
        'Hangi satırların dahil edileceğini belirten DOĞRU/YANLIŞ dizisi', 'Массив ИСТИНА/ЛОЖЬ, задающий включаемые строки', 'A TRUE/FALSE array selecting which rows to include'),
      arg('field_relationship', 'alan_ilişkisi', 'отношение_полей', true,
        '0: hiyerarşi (varsayılan); 1: tablo', '0: иерархия (по умолчанию); 1: таблица', '0: hierarchy (default); 1: table')
    ],
    desc: L('Satırları bir alana göre gruplayıp her grup için toplam veya ortalama gibi bir özet hesaplar; özet tablo benzeri bir sonuç döker.',
            'Группирует строки по полю и вычисляет для каждой группы итог (сумму, среднее и т. п.), возвращая результат, похожий на сводную таблицу.',
            'Groups rows by a field and aggregates each group (sum, average, etc.), spilling a PivotTable-like result.'),
    example: ex('GROUPBY(B2:B200,E2:E200,SUM)',
      'Her kategori için Tutar toplamını iki sütunlu bir özet olarak döker',
      'Выводит сводку из двух столбцов: сумма Tutar по каждой категории',
      'Spills a two-column summary with the Tutar total for each category'),
    keywords: L(['grupla', 'kategoriye göre topla', 'gruplayıp özetle', 'formülle pivot', 'gruba göre toplam', 'özet tablo gibi', 'gruplara ayır'],
                ['группировать', 'сумма по группам', 'сгруппировать и подсчитать', 'сводная формулой', 'итог по категориям', 'группировка строк', 'сводка по группам'],
                ['group by', 'aggregate by group', 'pivot formula'])
  },
  {
    name: 'HSTACK', tr: 'YATAYYIĞ', ru: 'ГСТОЛБИК', category: 'dynamic', minVersion: '365',
    syntax: 'HSTACK(array1, [array2], ...)',
    args: [
      arg('array1', 'dizi1', 'массив1', false,
        'Yan yana eklenecek ilk dizi veya aralık', 'Первый массив или диапазон для соединения', 'The first array or range to append'),
      arg('array2', 'dizi2', 'массив2', true,
        'Sağına eklenecek ek diziler; satır sayısı farklıysa eksikler #YOK olur', 'Дополнительные массивы, добавляемые справа; при разном числе строк недостающие ячейки — #Н/Д', 'Further arrays appended to the right; missing cells become #N/A when row counts differ')
    ],
    desc: L('Dizileri yan yana (yatay olarak) birleştirerek tek bir dizi verir.',
            'Объединяет массивы по горизонтали, располагая их рядом друг с другом, в один массив.',
            'Combines arrays side by side (horizontally) into a single array.'),
    example: ex('HSTACK(A2:A200,E2:E200)',
      'Ürün ve Tutar sütunlarını yan yana iki sütunlu tek bir dizi olarak döker',
      'Выводит столбцы товара и суммы рядом как один массив из двух столбцов',
      'Spills the product and amount columns side by side as one two-column array'),
    keywords: L(['yan yana birleştir', 'yatay yığ', 'sütunları birleştir', 'aralıkları yan yana koy', 'dizileri yatay ekle', 'sağına ekle'],
                ['объединить по горизонтали', 'рядом', 'соединить столбцы', 'склеить диапазоны по столбцам', 'добавить справа', 'горизонтальное объединение'],
                ['hstack', 'stack horizontally', 'combine columns side by side'])
  },
  {
    name: 'PIVOTBY', tr: 'PIVOTBY', ru: 'PIVOTBY', category: 'dynamic', minVersion: '365', uncertain: ['tr', 'ru'],
    syntax: 'PIVOTBY(row_fields, col_fields, values, function, [field_headers], [row_total_depth], [row_sort_order], [col_total_depth], [col_sort_order], [filter_array], [relative_to])',
    args: [
      arg('row_fields', 'satır_alanları', 'поля_строк', false,
        'Satırlarda gruplanacak sütun(lar)', 'Столбцы для группировки по строкам', 'The column(s) to group into rows'),
      arg('col_fields', 'sütun_alanları', 'поля_столбцов', false,
        'Sütunlarda gruplanacak sütun(lar)', 'Столбцы для группировки по столбцам', 'The column(s) to group into columns'),
      arg('values', 'değerler', 'значения', false,
        'Özetlenecek değer sütun(lar)ı', 'Столбцы со значениями для агрегации', 'The value column(s) to aggregate'),
      arg('function', 'işlev', 'функция', false,
        'Özet işlevi: SUM, AVERAGE, COUNT, MAX, MIN gibi bir eta-lambda veya LAMBDA', 'Функция агрегации: SUM, AVERAGE, COUNT, MAX, MIN (eta-лямбда) или своя LAMBDA', 'The aggregation: an eta-lambda such as SUM, AVERAGE, COUNT, MAX, MIN, or a LAMBDA'),
      arg('field_headers', 'alan_başlıkları', 'заголовки_полей', true,
        '0: başlık yok; 1: var, gösterme; 2: yok, üret; 3: var, göster', '0: без заголовков; 1: есть, не показывать; 2: нет, создать; 3: есть, показать', '0: no headers; 1: present, hide; 2: none, generate; 3: present, show'),
      arg('row_total_depth', 'satır_toplam_derinliği', 'глубина_итогов_строк', true,
        'Satır toplamları: 0 yok, 1 genel, 2 ara ve genel; negatif üste koyar', 'Итоги по строкам: 0 нет, 1 общий, 2 промежуточные и общий; отрицательное — сверху', 'Row totals: 0 none, 1 grand, 2 subtotals and grand; negative puts them on top'),
      arg('row_sort_order', 'satır_sıralama_düzeni', 'порядок_сортировки_строк', true,
        'Satırların sıralanacağı sütun numarası; negatif azalan', 'Номер столбца для сортировки строк; отрицательное — по убыванию', 'The column number to sort rows by; negative descending'),
      arg('col_total_depth', 'sütun_toplam_derinliği', 'глубина_итогов_столбцов', true,
        'Sütun toplamları: 0 yok, 1 genel, 2 ara ve genel; negatif sola koyar', 'Итоги по столбцам: 0 нет, 1 общий, 2 промежуточные и общий; отрицательное — слева', 'Column totals: 0 none, 1 grand, 2 subtotals and grand; negative puts them on the left'),
      arg('col_sort_order', 'sütun_sıralama_düzeni', 'порядок_сортировки_столбцов', true,
        'Sütunların sıralanacağı satır numarası; negatif azalan', 'Номер строки для сортировки столбцов; отрицательное — по убыванию', 'The row number to sort columns by; negative descending'),
      arg('filter_array', 'filtre_dizisi', 'массив_фильтра', true,
        'Hangi satırların dahil edileceğini belirten DOĞRU/YANLIŞ dizisi', 'Массив ИСТИНА/ЛОЖЬ, задающий включаемые строки', 'A TRUE/FALSE array selecting which rows to include'),
      arg('relative_to', 'göreli', 'относительно', true,
        'PERCENTOF için yüzde tabanı: 0 sütun toplamları, 1 satır toplamları, 2 genel toplam, 3 üst sütun, 4 üst satır', 'База процента для PERCENTOF: 0 итоги столбцов, 1 итоги строк, 2 общий итог, 3 родительский столбец, 4 родительская строка', 'Percentage base for PERCENTOF: 0 column totals, 1 row totals, 2 grand total, 3 parent column, 4 parent row')
    ],
    desc: L('Verileri satır ve sütun alanlarına göre gruplayıp özetleyen, özet tablo benzeri iki boyutlu bir sonuç döker.',
            'Группирует данные по полям строк и столбцов и возвращает двумерную сводку, похожую на сводную таблицу.',
            'Groups data by row and column fields and spills a two-dimensional, PivotTable-like summary.'),
    example: ex('PIVOTBY(B2:B200,H2:H200,E2:E200,SUM)',
      'Satırlarda kategori, sütunlarda şehir olacak şekilde Tutar toplamlarını çapraz tablo olarak döker',
      'Выводит перекрёстную таблицу сумм Tutar: категории по строкам, города по столбцам',
      'Spills a cross-tab of Tutar totals with categories as rows and cities as columns'),
    keywords: L(['formülle özet tablo', 'satır ve sütuna göre grupla', 'çapraz tablo', 'pivot formülü', 'iki boyutlu özet', 'satır sütun özeti'],
                ['сводная таблица формулой', 'группировка по строкам и столбцам', 'перекрёстная таблица', 'формула pivot', 'двумерная сводка', 'сводка строки столбцы'],
                ['pivot by', 'cross tab', 'two-dimensional summary'])
  },
  {
    name: 'SORT', tr: 'SIRALA', ru: 'СОРТ', category: 'dynamic', minVersion: '365',
    syntax: 'SORT(array, [sort_index], [sort_order], [by_col])',
    args: [
      arg('array', 'dizi', 'массив', false,
        'Sıralanacak aralık veya dizi', 'Сортируемый диапазон или массив', 'The range or array to sort'),
      arg('sort_index', 'sıralama_dizini', 'индекс_сортировки', true,
        'Sıralamada kullanılacak sütun (veya satır) numarası; boşsa 1', 'Номер столбца (или строки), по которому сортировать; по умолчанию 1', 'The column (or row) number to sort by; 1 if omitted'),
      arg('sort_order', 'sıralama_düzeni', 'порядок_сортировки', true,
        '1 veya boş: artan; -1: azalan', '1 или пусто: по возрастанию; -1: по убыванию', '1 or omitted: ascending; -1: descending'),
      arg('by_col', 'sütuna_göre', 'по_столбцу', true,
        'YANLIŞ veya boş: satırları sırala; DOĞRU: sütunları sırala', 'ЛОЖЬ или пусто: сортировать строки; ИСТИНА: сортировать столбцы', 'FALSE or omitted: sort rows; TRUE: sort columns')
    ],
    desc: L('Bir aralığı belirtilen sütuna göre artan veya azalan sırada sıralayarak döker.',
            'Возвращает диапазон, отсортированный по указанному столбцу по возрастанию или убыванию.',
            'Returns a range sorted by the specified column in ascending or descending order.'),
    example: ex('SORT(A2:E200,5,-1)',
      'A2:E200 tablosunu 5. sütuna (Tutar) göre büyükten küçüğe sıralar',
      'Сортирует таблицу A2:E200 по 5-му столбцу (сумма) по убыванию',
      'Sorts the table A2:E200 by column 5 (amount) in descending order'),
    keywords: L(['sırala', 'büyükten küçüğe', 'küçükten büyüğe', 'alfabetik sırala', 'azalan', 'artan', 'sütuna göre sırala', 'sıralı liste', 'sıralama'],
                ['сортировать', 'по убыванию', 'по возрастанию', 'отсортировать список', 'по алфавиту', 'сортировка по столбцу', 'упорядочить', 'отсортированный список', 'сорт'],
                ['sort', 'descending', 'ascending', 'sort by column'])
  },
  {
    name: 'SORTBY', tr: 'SIRALAÖLÇÜT', ru: 'СОРТПО', category: 'dynamic', minVersion: '365',
    syntax: 'SORTBY(array, by_array1, [sort_order1], [by_array2, sort_order2], ...)',
    args: [
      arg('array', 'dizi', 'массив', false,
        'Sıralanacak aralık veya dizi', 'Сортируемый диапазон или массив', 'The range or array to sort'),
      arg('by_array1', 'ölçüt_dizisi1', 'по_массиву1', false,
        'Sıralamaya temel olacak aynı uzunluktaki aralık', 'Диапазон той же длины, по которому ведётся сортировка', 'A range of the same length to sort by'),
      arg('sort_order1', 'sıralama_düzeni1', 'порядок_сортировки1', true,
        '1 veya boş: artan; -1: azalan', '1 или пусто: по возрастанию; -1: по убыванию', '1 or omitted: ascending; -1: descending'),
      arg('by_array2', 'ölçüt_dizisi2', 'по_массиву2', true,
        'İkincil sıralama ölçütü aralığı ve düzeni (çiftler halinde devam eder)', 'Диапазон и порядок вторичной сортировки (далее парами)', 'A secondary sort range and order (continue in pairs)')
    ],
    desc: L('Bir aralığı başka bir aralıktaki değerlere göre, gerekirse birden çok ölçütle sıralayarak döker.',
            'Возвращает диапазон, отсортированный по значениям другого диапазона, при необходимости по нескольким критериям.',
            'Returns a range sorted by the values of another range, optionally with several criteria.'),
    example: ex('SORTBY(A2:A200,E2:E200,-1)',
      'Ürün adlarını Tutar sütununa göre büyükten küçüğe sıralar',
      'Сортирует названия товаров по столбцу суммы по убыванию',
      'Sorts the product names by the amount column in descending order'),
    keywords: L(['başka sütuna göre sırala', 'çoklu sıralama', 'ölçüte göre sırala', 'iki kritere göre sırala', 'tutara göre isimleri sırala', 'özel sıralama'],
                ['сортировать по другому столбцу', 'многоуровневая сортировка', 'сортировка по критерию', 'по двум столбцам', 'упорядочить по сумме', 'сортпо'],
                ['sort by', 'sort by another column', 'multi-level sort'])
  },
  {
    name: 'TAKE', tr: 'AL', ru: 'ВЗЯТЬ', category: 'dynamic', minVersion: '365',
    syntax: 'TAKE(array, rows, [columns])',
    args: [
      arg('array', 'dizi', 'массив', false,
        'Satır veya sütunları alınacak dizi', 'Массив, из которого берутся строки или столбцы', 'The array to take rows or columns from'),
      arg('rows', 'satırlar', 'строки', false,
        'Alınacak satır sayısı; pozitif baştan, negatif sondan alır', 'Число строк; положительное — с начала, отрицательное — с конца', 'The number of rows to take; positive from the start, negative from the end'),
      arg('columns', 'sütunlar', 'столбцы', true,
        'Alınacak sütun sayısı; pozitif soldan, negatif sağdan alır', 'Число столбцов; положительное — слева, отрицательное — справа', 'The number of columns to take; positive from the left, negative from the right')
    ],
    desc: L('Dizinin başından veya sonundan belirtilen sayıda satır ya da sütunu alır.',
            'Возвращает заданное число строк или столбцов с начала или с конца массива.',
            'Returns the given number of rows or columns from the start or end of an array.'),
    example: ex('TAKE(SORT(A2:E200,5,-1),10)',
      'Tutara göre sıralanmış tablonun ilk 10 satırını (en yüksek 10 satış) döker',
      'Выводит первые 10 строк таблицы, отсортированной по сумме (10 крупнейших продаж)',
      'Spills the first 10 rows of the table sorted by amount (top 10 sales)'),
    keywords: L(['ilk n satır', 'son n satır', 'en üstteki satırlar', 'ilk 10', 'ilk satırları al', 'son 5 kayıt', 'top n', 'en büyük 10'],
                ['первые n строк', 'последние n строк', 'верхние строки', 'топ 10', 'взять первые', 'последние 5 записей', 'top n', '10 крупнейших'],
                ['take', 'first n rows', 'last n rows', 'top n'])
  },
  {
    name: 'TOCOL', tr: 'SÜTUNA', ru: 'ПОСТОЛБЦ', category: 'dynamic', minVersion: '365',
    syntax: 'TOCOL(array, [ignore], [scan_by_column])',
    args: [
      arg('array', 'dizi', 'массив', false,
        'Tek sütuna dönüştürülecek dizi veya aralık', 'Массив или диапазон, преобразуемый в один столбец', 'The array or range to turn into a single column'),
      arg('ignore', 'yoksay', 'игнорировать', true,
        '0 veya boş: hepsini al; 1: boşları atla; 2: hataları atla; 3: boş ve hataları atla', '0 или пусто: брать всё; 1: пропускать пустые; 2: пропускать ошибки; 3: пропускать пустые и ошибки', '0 or omitted: keep all; 1: skip blanks; 2: skip errors; 3: skip blanks and errors'),
      arg('scan_by_column', 'sütuna_göre_tara', 'сканировать_по_столбцам', true,
        'YANLIŞ veya boş: satır satır tara; DOĞRU: sütun sütun tara', 'ЛОЖЬ или пусто: обход по строкам; ИСТИНА: обход по столбцам', 'FALSE or omitted: scan by row; TRUE: scan by column')
    ],
    desc: L('Bir diziyi tek bir sütuna dönüştürür; boş ve hatalı değerler isteğe bağlı olarak atlanır.',
            'Преобразует массив в один столбец, при желании пропуская пустые ячейки и ошибки.',
            'Converts an array into a single column, optionally skipping blanks and errors.'),
    example: ex('TOCOL(A2:C10,1)',
      'A2:C10 bloğundaki tüm dolu değerleri tek bir sütun halinde listeler',
      'Выводит все непустые значения блока A2:C10 одним столбцом',
      'Lists every non-empty value of the block A2:C10 in a single column'),
    keywords: L(['tek sütuna çevir', 'sütuna dök', 'tabloyu listeye çevir', 'boşları atlayarak listele', 'çok sütunu tek sütun yap', 'alt alta listele'],
                ['в один столбец', 'преобразовать в столбец', 'таблицу в список', 'без пустых ячеек', 'несколько столбцов в один', 'вывести в столбик'],
                ['to column', 'flatten to column', 'table to list'])
  },
  {
    name: 'TOROW', tr: 'SATIRA', ru: 'ПОСТРОК', category: 'dynamic', minVersion: '365',
    syntax: 'TOROW(array, [ignore], [scan_by_column])',
    args: [
      arg('array', 'dizi', 'массив', false,
        'Tek satıra dönüştürülecek dizi veya aralık', 'Массив или диапазон, преобразуемый в одну строку', 'The array or range to turn into a single row'),
      arg('ignore', 'yoksay', 'игнорировать', true,
        '0 veya boş: hepsini al; 1: boşları atla; 2: hataları atla; 3: boş ve hataları atla', '0 или пусто: брать всё; 1: пропускать пустые; 2: пропускать ошибки; 3: пропускать пустые и ошибки', '0 or omitted: keep all; 1: skip blanks; 2: skip errors; 3: skip blanks and errors'),
      arg('scan_by_column', 'sütuna_göre_tara', 'сканировать_по_столбцам', true,
        'YANLIŞ veya boş: satır satır tara; DOĞRU: sütun sütun tara', 'ЛОЖЬ или пусто: обход по строкам; ИСТИНА: обход по столбцам', 'FALSE or omitted: scan by row; TRUE: scan by column')
    ],
    desc: L('Bir diziyi tek bir satıra dönüştürür; boş ve hatalı değerler isteğe bağlı olarak atlanır.',
            'Преобразует массив в одну строку, при желании пропуская пустые ячейки и ошибки.',
            'Converts an array into a single row, optionally skipping blanks and errors.'),
    example: ex('TOROW(A2:A10)',
      'A2:A10 sütunundaki değerleri yan yana tek satırda döker',
      'Выводит значения столбца A2:A10 в одну строку',
      'Spills the values of A2:A10 into a single row'),
    keywords: L(['tek satıra çevir', 'satıra dök', 'yan yana listele', 'sütunu satıra döşe', 'çok satırı tek satır yap'],
                ['в одну строку', 'преобразовать в строку', 'вывести в строчку', 'столбец в строку', 'несколько строк в одну'],
                ['to row', 'flatten to row', 'column to row'])
  },
  {
    name: 'TRIMRANGE', tr: 'TRIMRANGE', ru: 'TRIMRANGE', category: 'dynamic', minVersion: '365', uncertain: ['tr', 'ru'],
    syntax: 'TRIMRANGE(range, [row_trim_mode], [col_trim_mode])',
    args: [
      arg('range', 'aralık', 'диапазон', false,
        'Kırpılacak aralık (tüm sütun gibi geniş bir aralık olabilir)', 'Обрезаемый диапазон (можно целый столбец)', 'The range to trim (can be a whole column)'),
      arg('row_trim_mode', 'satır_kırpma_modu', 'режим_обрезки_строк', true,
        '0: kırpma; 1: baştaki boş satırlar; 2: sondaki boş satırlar; 3 veya boş: her ikisi', '0: не обрезать; 1: пустые строки сверху; 2: пустые строки снизу; 3 или пусто: и те и другие', '0: none; 1: leading blank rows; 2: trailing blank rows; 3 or omitted: both'),
      arg('col_trim_mode', 'sütun_kırpma_modu', 'режим_обрезки_столбцов', true,
        '0: kırpma; 1: baştaki boş sütunlar; 2: sondaki boş sütunlar; 3 veya boş: her ikisi', '0: не обрезать; 1: пустые столбцы слева; 2: пустые столбцы справа; 3 или пусто: и те и другие', '0: none; 1: leading blank columns; 2: trailing blank columns; 3 or omitted: both')
    ],
    desc: L('Bir aralığın kenarlarındaki boş satır ve sütunları kırparak yalnızca veri içeren kısmı verir.',
            'Обрезает пустые строки и столбцы по краям диапазона и возвращает только часть с данными.',
            'Trims the blank rows and columns at the edges of a range and returns only the part that holds data.'),
    example: ex('SUM(TRIMRANGE(E:E))',
      'E sütununun yalnızca dolu kısmını toplar; tüm sütunu işlemekten daha hızlıdır',
      'Суммирует только заполненную часть столбца E; быстрее, чем обработка всего столбца',
      'Sums only the filled part of column E; faster than processing the whole column'),
    keywords: L(['boş satırları kırp', 'tüm sütunu kısalt', 'dolu alanı al', 'kullanılan aralık', 'aralığı kırp', 'boşlukları kes'],
                ['обрезать пустые строки', 'усечь диапазон', 'только заполненная часть', 'используемый диапазон', 'обрезать диапазон', 'убрать пустые края'],
                ['trim range', 'used range', 'trim blank rows'])
  },
  {
    name: 'UNIQUE', tr: 'BENZERSİZ', ru: 'УНИК', category: 'dynamic', minVersion: '365',
    syntax: 'UNIQUE(array, [by_col], [exactly_once])',
    args: [
      arg('array', 'dizi', 'массив', false,
        'Benzersiz değerleri alınacak aralık veya dizi', 'Диапазон или массив, из которого берутся уникальные значения', 'The range or array to get unique values from'),
      arg('by_col', 'sütuna_göre', 'по_столбцу', true,
        'YANLIŞ veya boş: satırları karşılaştır; DOĞRU: sütunları karşılaştır', 'ЛОЖЬ или пусто: сравнивать строки; ИСТИНА: сравнивать столбцы', 'FALSE or omitted: compare rows; TRUE: compare columns'),
      arg('exactly_once', 'yalnızca_bir_kez', 'только_один_раз', true,
        'DOĞRU: yalnızca bir kez geçen değerler; YANLIŞ veya boş: her farklı değer bir kez', 'ИСТИНА: только значения, встречающиеся один раз; ЛОЖЬ или пусто: каждое различное значение по одному разу', 'TRUE: only values that occur exactly once; FALSE or omitted: each distinct value once')
    ],
    desc: L('Bir aralıktaki benzersiz (yinelenmeyen) değerlerin listesini döker.',
            'Возвращает список уникальных (неповторяющихся) значений диапазона.',
            'Returns the list of unique (non-repeating) values in a range.'),
    example: ex('UNIQUE(B2:B200)',
      'B2:B200 sütunundaki kategorilerin tekrarsız listesini döker',
      'Выводит список категорий из B2:B200 без повторов',
      'Spills the list of categories in B2:B200 without duplicates'),
    keywords: L(['benzersiz', 'tekrarsız liste', 'yinelenenleri kaldır', 'tekrar edenleri at', 'farklı değerler', 'bir kez geçenler', 'tekil liste', 'kategori listesi', 'mükerrer olmayan'],
                ['уникальные', 'без повторов', 'удалить дубликаты', 'список уникальных значений', 'неповторяющиеся', 'встречается один раз', 'уникальный список', 'различные значения', 'уник'],
                ['unique', 'distinct values', 'remove duplicates', 'unique list'])
  },
  {
    name: 'VSTACK', tr: 'DÜŞEYYIĞ', ru: 'ВСТОЛБИК', category: 'dynamic', minVersion: '365',
    syntax: 'VSTACK(array1, [array2], ...)',
    args: [
      arg('array1', 'dizi1', 'массив1', false,
        'Alt alta eklenecek ilk dizi veya aralık', 'Первый массив или диапазон для соединения', 'The first array or range to append'),
      arg('array2', 'dizi2', 'массив2', true,
        'Altına eklenecek ek diziler; sütun sayısı farklıysa eksikler #YOK olur', 'Дополнительные массивы, добавляемые снизу; при разном числе столбцов недостающие ячейки — #Н/Д', 'Further arrays appended below; missing cells become #N/A when column counts differ')
    ],
    desc: L('Dizileri alt alta (dikey olarak) birleştirerek tek bir dizi verir.',
            'Объединяет массивы по вертикали, располагая их друг под другом, в один массив.',
            'Combines arrays one below the other (vertically) into a single array.'),
    example: ex('VSTACK(A2:A200,Ürünler!B2:B50)',
      'Satışlar sayfasındaki ürünlerle Ürünler sayfasındaki ürün adlarını tek listede alt alta birleştirir',
      'Объединяет товары с листа продаж и названия с листа Ürünler в один список друг под другом',
      'Stacks the products from the sales sheet and the names from the Ürünler sheet into one list'),
    keywords: L(['alt alta birleştir', 'dikey yığ', 'listeleri birleştir', 'tabloları alt alta ekle', 'sayfaları birleştir', 'aralıkları üst üste koy', 'altına ekle'],
                ['объединить по вертикали', 'склеить списки', 'таблицы друг под другом', 'объединить листы', 'добавить снизу', 'соединить диапазоны', 'вертикальное объединение'],
                ['vstack', 'stack vertically', 'append ranges', 'combine lists'])
  },
  {
    name: 'WRAPCOLS', tr: 'SÜTUNSAR', ru: 'СВЕРНСТОЛБЦ', category: 'dynamic', minVersion: '365',
    syntax: 'WRAPCOLS(vector, wrap_count, [pad_with])',
    args: [
      arg('vector', 'vektör', 'вектор', false,
        'Tek satır veya sütunluk sarılacak aralık', 'Диапазон из одной строки или одного столбца, который нужно свернуть', 'The single-row or single-column range to wrap'),
      arg('wrap_count', 'sarma_sayısı', 'количество_переносов', false,
        'Her sütundaki en fazla öğe sayısı', 'Максимальное число элементов в каждом столбце', 'The maximum number of items per column'),
      ARG_PAD_WITH
    ],
    desc: L('Tek satır veya sütunluk bir vektörü belirtilen öğe sayısından sonra yeni bir sütuna sararak tabloya çevirir.',
            'Сворачивает одномерный вектор в таблицу, перенося его в новый столбец после заданного числа элементов.',
            'Wraps a single row or column into a table, starting a new column after the given number of items.'),
    example: ex('WRAPCOLS(A2:A13,4)',
      '12 değeri her sütunda 4 öğe olacak şekilde 3 sütuna yerleştirir',
      'Раскладывает 12 значений в 3 столбца по 4 элемента в каждом',
      'Arranges 12 values into 3 columns of 4 items each'),
    keywords: L(['sütunlara sar', 'listeyi tabloya çevir', 'n satırda bir yeni sütun', 'diziyi sütunlara böl', 'listeyi blokla', 'dikey sar'],
                ['разбить на столбцы', 'список в таблицу', 'перенос по столбцам', 'каждые n значений в новый столбец', 'свернуть в столбцы', 'разложить по столбцам'],
                ['wrap columns', 'list to table by columns', 'wrap vector into columns'])
  },
  {
    name: 'WRAPROWS', tr: 'SATIRSAR', ru: 'СВЕРНСТРОК', category: 'dynamic', minVersion: '365',
    syntax: 'WRAPROWS(vector, wrap_count, [pad_with])',
    args: [
      arg('vector', 'vektör', 'вектор', false,
        'Tek satır veya sütunluk sarılacak aralık', 'Диапазон из одной строки или одного столбца, который нужно свернуть', 'The single-row or single-column range to wrap'),
      arg('wrap_count', 'sarma_sayısı', 'количество_переносов', false,
        'Her satırdaki en fazla öğe sayısı', 'Максимальное число элементов в каждой строке', 'The maximum number of items per row'),
      ARG_PAD_WITH
    ],
    desc: L('Tek satır veya sütunluk bir vektörü belirtilen öğe sayısından sonra yeni bir satıra sararak tabloya çevirir.',
            'Сворачивает одномерный вектор в таблицу, перенося его на новую строку после заданного числа элементов.',
            'Wraps a single row or column into a table, starting a new row after the given number of items.'),
    example: ex('WRAPROWS(A2:A13,3)',
      '12 değeri her satırda 3 öğe olacak şekilde 4 satıra yerleştirir',
      'Раскладывает 12 значений в 4 строки по 3 элемента в каждой',
      'Arranges 12 values into 4 rows of 3 items each'),
    keywords: L(['satırlara sar', 'listeyi tabloya çevir', 'n öğede bir yeni satır', 'diziyi satırlara böl', 'yatay sar', 'listeyi satırlara yay'],
                ['разбить на строки', 'список в таблицу', 'перенос по строкам', 'каждые n значений в новую строку', 'свернуть в строки', 'разложить по строкам'],
                ['wrap rows', 'list to table by rows', 'wrap vector into rows'])
  },

  /* ================================================================== TEXT */
  {
    name: 'ARRAYTOTEXT', tr: 'DİZİMETNE', ru: 'МАССИВВТЕКСТ', category: 'text', minVersion: '2021',
    syntax: 'ARRAYTOTEXT(array, [format])',
    args: [
      arg('array', 'dizi', 'массив', false,
        'Metne çevrilecek dizi veya aralık', 'Массив или диапазон, преобразуемый в текст', 'The array or range to convert to text'),
      arg('format', 'biçim', 'формат', true,
        '0 veya boş: kısa biçim (virgülle ayrılmış değerler); 1: katı biçim (küme ayraçları ve tırnaklı metinler)', '0 или пусто: краткий формат (значения через запятую); 1: строгий формат (фигурные скобки и текст в кавычках)', '0 or omitted: concise (comma-separated values); 1: strict (braces and quoted text)')
    ],
    desc: L('Bir dizi veya aralığın içeriğini tek bir metin olarak verir.',
            'Возвращает содержимое массива или диапазона в виде одной текстовой строки.',
            'Returns the contents of an array or range as a single text string.'),
    example: ex('ARRAYTOTEXT(A2:A5)',
      'A2:A5’teki değerleri virgülle ayrılmış tek bir metin olarak verir: "Kalem, Defter, Silgi, Cetvel"',
      'Возвращает значения A2:A5 одной строкой через запятую: "Kalem, Defter, Silgi, Cetvel"',
      'Returns the values of A2:A5 as one comma-separated string: "Kalem, Defter, Silgi, Cetvel"'),
    keywords: L(['diziyi metne çevir', 'aralığı tek metin yap', 'değerleri virgülle listele', 'dizi içeriğini yazdır', 'dizi metni', 'listeyi metin olarak göster'],
                ['массив в текст', 'диапазон одной строкой', 'перечислить через запятую', 'вывести массив текстом', 'текст из массива', 'показать список строкой'],
                ['array to text', 'range as text', 'list values as string'])
  },
  {
    name: 'ASC', tr: 'ASC', ru: 'ASC', category: 'text',
    syntax: 'ASC(text)',
    args: [
      arg('text', 'metin', 'текст', false,
        'Dönüştürülecek metin; çift baytlı karakter içermiyorsa değişmeden döner', 'Преобразуемый текст; без двухбайтовых символов возвращается без изменений', 'The text to convert; returned unchanged if it has no double-byte characters')
    ],
    desc: L('Tam genişlikli (çift baytlı) karakterleri yarım genişlikli (tek baytlı) karakterlere dönüştürür.',
            'Преобразует полноширинные (двухбайтовые) символы в полуширинные (однобайтовые).',
            'Converts full-width (double-byte) characters to half-width (single-byte) characters.'),
    example: ex('ASC("ＥＸＣＥＬ")',
      'Tam genişlikli harfleri normal genişliğe çevirir: "EXCEL"',
      'Преобразует полноширинные буквы в обычные: "EXCEL"',
      'Converts the full-width letters to normal width: "EXCEL"'),
    keywords: L(['tam genişlikten yarım genişliğe', 'çift bayt karakter', 'japonca karakter dönüştür', 'yarım genişlik', 'asc'],
                ['полноширинные в полуширинные', 'двухбайтовые символы', 'японские символы', 'полуширинный текст', 'asc'],
                ['full-width to half-width', 'double-byte characters', 'asc'])
  },
  {
    name: 'BAHTTEXT', tr: 'BAHTMETİN', ru: 'БАТТЕКСТ', category: 'text',
    syntax: 'BAHTTEXT(number)',
    args: [
      arg('number', 'sayı', 'число', false,
        'Metne çevrilecek sayı veya sayı içeren hücre', 'Число или ячейка с числом для преобразования в текст', 'The number or a cell with a number to convert to text')
    ],
    desc: L('Bir sayıyı Tayca yazıyla metne çevirir ve sonuna "Baht" para birimi ekini ekler.',
            'Преобразует число в текст прописью на тайском языке с добавлением суффикса валюты «бат».',
            'Converts a number to Thai text and appends the "Baht" currency suffix.'),
    example: ex('BAHTTEXT(1234)',
      '1234 sayısını Tayca yazıyla, sonunda "baht" olacak şekilde verir',
      'Выводит число 1234 прописью по-тайски с окончанием «бат»',
      'Returns 1234 spelled out in Thai with the "Baht" suffix'),
    keywords: L(['sayıyı tayca yaz', 'baht metni', 'tay para birimi yazıyla', 'sayıdan yazıya tayca', 'baht'],
                ['число прописью по-тайски', 'бат текстом', 'тайская валюта прописью', 'сумма прописью тайский', 'бат'],
                ['thai text', 'baht text', 'number to thai words'])
  },
  {
    name: 'CHAR', tr: 'DAMGA', ru: 'СИМВОЛ', category: 'text',
    syntax: 'CHAR(number)',
    args: [
      arg('number', 'sayı', 'число', false,
        '1 ile 255 arasında karakter kodu (örn. 10 = satır sonu, 65 = A)', 'Код символа от 1 до 255 (например, 10 = перенос строки, 65 = A)', 'A character code from 1 to 255 (e.g. 10 = line break, 65 = A)')
    ],
    desc: L('Kod numarasına karşılık gelen karakteri verir.',
            'Возвращает символ, соответствующий числовому коду.',
            'Returns the character that corresponds to a code number.'),
    example: ex('A2&CHAR(10)&B2',
      'A2 ve B2’yi aralarına satır sonu koyarak birleştirir (hücrede metni kaydırma açık olmalı)',
      'Соединяет A2 и B2 через перенос строки (в ячейке должен быть включён перенос текста)',
      'Joins A2 and B2 with a line break between them (wrap text must be on in the cell)'),
    keywords: L(['koddan karakter', 'satır sonu karakteri', 'yeni satır ekle', 'ascii karakter', 'damga', 'özel karakter ekle', 'alt satıra geç', 'damga 10'],
                ['символ по коду', 'перенос строки', 'новая строка в ячейке', 'ascii символ', 'вставить спецсимвол', 'символ 10', 'код в символ', 'перевод строки в формуле'],
                ['char', 'character from code', 'line break', 'new line'])
  },
  {
    name: 'CLEAN', tr: 'TEMİZ', ru: 'ПЕЧСИМВ', category: 'text',
    syntax: 'CLEAN(text)',
    args: [
      arg('text', 'metin', 'текст', false,
        'Yazdırılamayan karakterlerden arındırılacak metin', 'Текст, из которого удаляются непечатаемые символы', 'The text to remove non-printable characters from')
    ],
    desc: L('Metindeki yazdırılamayan karakterleri (0–31 kodlu) kaldırır.',
            'Удаляет из текста все непечатаемые символы (с кодами 0–31).',
            'Removes all non-printable characters (codes 0–31) from text.'),
    example: ex('TRIM(CLEAN(A2))',
      'A2’den satır sonları gibi görünmeyen karakterleri ve fazla boşlukları temizler',
      'Удаляет из A2 невидимые символы вроде переносов строк и лишние пробелы',
      'Strips invisible characters such as line breaks and extra spaces from A2'),
    keywords: L(['yazdırılamayan karakterleri sil', 'metni temizle', 'görünmeyen karakterler', 'bozuk karakterleri kaldır', 'satır sonlarını temizle', 'temiz', 'dışarıdan gelen veriyi temizle'],
                ['удалить непечатаемые символы', 'очистить текст', 'невидимые символы', 'убрать мусор из текста', 'печсимв', 'убрать переносы строк', 'почистить импортированные данные'],
                ['clean', 'remove non-printable characters', 'strip control characters'])
  },
  {
    name: 'CODE', tr: 'KOD', ru: 'КОДСИМВ', category: 'text',
    syntax: 'CODE(text)',
    args: [
      arg('text', 'metin', 'текст', false,
        'İlk karakterinin kodu istenen metin', 'Текст, код первого символа которого нужен', 'The text whose first character code you want')
    ],
    desc: L('Metnin ilk karakterinin sayısal kodunu verir.',
            'Возвращает числовой код первого символа текста.',
            'Returns the numeric code of the first character in a text string.'),
    example: ex('CODE("A")',
      '"A" harfinin kodunu verir: 65',
      'Возвращает код буквы "A": 65',
      'Returns the code of the letter "A": 65'),
    keywords: L(['karakter kodu', 'ascii kodu', 'ilk karakterin kodu', 'harfin sayısal karşılığı', 'kod', 'karakteri sayıya çevir'],
                ['код символа', 'ascii код', 'код первого символа', 'числовой код буквы', 'кодсимв', 'символ в число'],
                ['code', 'character code', 'ascii code'])
  },
  {
    name: 'CONCAT', tr: 'ARALIKBİRLEŞTİR', ru: 'СЦЕП', category: 'text', minVersion: '2019',
    syntax: 'CONCAT(text1, [text2], ...)',
    args: [
      arg('text1', 'metin1', 'текст1', false,
        'Birleştirilecek ilk metin, hücre veya aralık', 'Первый текст, ячейка или диапазон для объединения', 'The first text, cell or range to join'),
      arg('text2', 'metin2', 'текст2', true,
        'Ek metinler, hücreler veya aralıklar (toplam 253 bağımsız değişkene kadar)', 'Дополнительные тексты, ячейки или диапазоны (всего до 253 аргументов)', 'Further texts, cells or ranges (up to 253 arguments in total)')
    ],
    desc: L('Metinleri, hücreleri ve aralıkları ayırıcı eklemeden tek bir metinde birleştirir.',
            'Объединяет тексты, ячейки и диапазоны в одну строку без разделителя.',
            'Joins texts, cells and ranges into one string without a delimiter.'),
    example: ex('CONCAT(A2," - ",B2)',
      'A2 ve B2’yi aralarına " - " koyarak birleştirir: "Kalem - Kırtasiye"',
      'Соединяет A2 и B2 через " - ": "Kalem - Kırtasiye"',
      'Joins A2 and B2 with " - " in between: "Kalem - Kırtasiye"'),
    keywords: L(['birleştir', 'metinleri birleştir', 'hücreleri birleştir', 'yan yana yaz', 'ad soyad birleştir', 'aralığı birleştir', 'iki hücreyi birleştir', 'metin ekle', 'uç uca ekle', 'birleştirme', 'ad ve soyadı tek hücrede'],
                ['объединить', 'сцепить', 'соединить текст', 'склеить ячейки', 'объединить ячейки', 'имя и фамилия вместе', 'сцепить диапазон', 'соединить две ячейки', 'добавить текст', 'конкатенация', 'сцеп'],
                ['concat', 'join text', 'combine cells', 'concatenate'])
  },
  {
    name: 'CONCATENATE', tr: 'BİRLEŞTİR', ru: 'СЦЕПИТЬ', category: 'text',
    syntax: 'CONCATENATE(text1, [text2], ...)',
    args: [
      arg('text1', 'metin1', 'текст1', false,
        'Birleştirilecek ilk metin veya hücre (aralık kabul etmez)', 'Первый текст или ячейка для объединения (диапазоны не принимаются)', 'The first text or cell to join (ranges are not accepted)'),
      arg('text2', 'metin2', 'текст2', true,
        'Ek metinler veya hücreler, en çok 255 tane', 'Дополнительные тексты или ячейки, до 255', 'Further texts or cells, up to 255')
    ],
    desc: L('Birden çok metin öğesini tek bir metinde birleştirir; eski işlevdir, yerine ARALIKBİRLEŞTİR veya METİNBİRLEŞTİR önerilir.',
            'Объединяет несколько текстовых элементов в одну строку; устаревшая функция, вместо неё рекомендуются СЦЕП и ОБЪЕДИНИТЬ.',
            'Joins several text items into one string; a legacy function, CONCAT or TEXTJOIN are recommended instead.'),
    example: ex('CONCATENATE(A2," ",B2)',
      'A2 ve B2’yi aralarına boşluk koyarak birleştirir',
      'Соединяет A2 и B2 через пробел',
      'Joins A2 and B2 with a space between them'),
    keywords: L(['birleştir', 'eski birleştir', 'metinleri birleştir', 'hücreleri birleştir', 'boşlukla birleştir', 'ad soyad birleştir', 'uyumluluk birleştir'],
                ['сцепить', 'объединить текст', 'склеить ячейки', 'соединить через пробел', 'имя и фамилия', 'старая функция объединения', 'сцепить ячейки'],
                ['concatenate', 'join text', 'legacy concat'])
  },
  {
    name: 'DBCS', tr: 'DBCS', ru: 'DBCS', category: 'text', minVersion: '2013',
    syntax: 'DBCS(text)',
    args: [
      arg('text', 'metin', 'текст', false,
        'Dönüştürülecek metin; yarım genişlikli karakter içermiyorsa değişmeden döner', 'Преобразуемый текст; без полуширинных символов возвращается без изменений', 'The text to convert; returned unchanged if it has no half-width characters')
    ],
    desc: L('Yarım genişlikli (tek baytlı) karakterleri tam genişlikli (çift baytlı) karakterlere dönüştürür.',
            'Преобразует полуширинные (однобайтовые) символы в полноширинные (двухбайтовые).',
            'Converts half-width (single-byte) characters to full-width (double-byte) characters.'),
    example: ex('DBCS("EXCEL")',
      'Normal harfleri tam genişlikli karakterlere çevirir: "ＥＸＣＥＬ"',
      'Преобразует обычные буквы в полноширинные: "ＥＸＣＥＬ"',
      'Converts normal letters to full-width characters: "ＥＸＣＥＬ"'),
    keywords: L(['yarım genişlikten tam genişliğe', 'çift baytlı karaktere çevir', 'tam genişlik', 'dbcs', 'japonca tam genişlik'],
                ['полуширинные в полноширинные', 'в двухбайтовые символы', 'полноширинный текст', 'dbcs', 'японский полноширинный'],
                ['half-width to full-width', 'double-byte conversion', 'dbcs'])
  },
  {
    name: 'DETECTLANGUAGE', tr: 'DETECTLANGUAGE', ru: 'DETECTLANGUAGE', category: 'text', minVersion: '365', uncertain: ['tr', 'ru'],
    syntax: 'DETECTLANGUAGE(text)',
    args: [
      arg('text', 'metin', 'текст', false,
        'Dili belirlenecek metin veya metin içeren hücre', 'Текст или ячейка с текстом, язык которого нужно определить', 'The text, or a cell with text, whose language to detect')
    ],
    desc: L('Metnin dilini algılar ve dil kodunu ("tr", "ru", "en" gibi) verir; çevrimiçi çeviri hizmeti gerektirir.',
            'Определяет язык текста и возвращает его код («tr», «ru», «en» и т. п.); требует подключения к онлайн-службе перевода.',
            'Detects the language of text and returns its code (such as "tr", "ru", "en"); requires the online translation service.'),
    example: ex('DETECTLANGUAGE(A2)',
      'A2’deki metin Türkçe ise "tr" verir',
      'Возвращает "tr", если текст в A2 на турецком языке',
      'Returns "tr" when the text in A2 is Turkish'),
    keywords: L(['dili algıla', 'hangi dilde', 'metnin dili', 'dil kodu bul', 'dil tespiti', 'dil belirle'],
                ['определить язык', 'на каком языке', 'язык текста', 'код языка', 'распознать язык', 'детектор языка'],
                ['detect language', 'language code', 'which language'])
  },
  {
    name: 'DOLLAR', tr: 'LİRA', ru: 'РУБЛЬ', category: 'text',
    syntax: 'DOLLAR(number, [decimals])',
    args: [
      arg('number', 'sayı', 'число', false,
        'Para birimi metnine çevrilecek sayı', 'Число, преобразуемое в денежный текст', 'The number to convert to currency text'),
      arg('decimals', 'ondalıklar', 'число_знаков', true,
        'Ondalık basamak sayısı; boşsa 2; negatifse ondalık ayırıcının soluna yuvarlar', 'Число десятичных знаков; по умолчанию 2; отрицательное округляет слева от запятой', 'The number of decimal places; 2 if omitted; negative rounds to the left of the decimal point')
    ],
    desc: L('Sayıyı sistem para birimi biçiminde (örn. ₺1.234,50) metne çevirir.',
            'Преобразует число в текст в денежном формате системы (например, 1 234,50 ₽).',
            'Converts a number to text in the system currency format (e.g. $1,234.50).'),
    example: ex('DOLLAR(E2,2)',
      'E2 tutarını iki ondalıklı para birimi metni olarak verir',
      'Возвращает сумму из E2 как денежный текст с двумя знаками после запятой',
      'Returns the amount in E2 as currency text with two decimals'),
    keywords: L(['para birimi metni', 'sayıyı para olarak yaz', 'lira biçimi', 'tl formatında metin', 'para biçimli metin', 'lira'],
                ['денежный формат текстом', 'число как валюта', 'рубль', 'формат рублей', 'сумма в денежном формате', 'в рублях текстом'],
                ['dollar', 'currency text', 'format as currency'])
  },
  {
    name: 'EXACT', tr: 'ÖZDEŞ', ru: 'СОВПАД', category: 'text',
    syntax: 'EXACT(text1, text2)',
    args: [
      arg('text1', 'metin1', 'текст1', false,
        'Karşılaştırılacak ilk metin', 'Первый сравниваемый текст', 'The first text to compare'),
      arg('text2', 'metin2', 'текст2', false,
        'Karşılaştırılacak ikinci metin', 'Второй сравниваемый текст', 'The second text to compare')
    ],
    desc: L('İki metnin büyük/küçük harf duyarlı olarak tamamen aynı olup olmadığını sınar; aynıysa DOĞRU verir.',
            'Проверяет, полностью ли совпадают два текста с учётом регистра, и возвращает ИСТИНА при совпадении.',
            'Tests whether two text strings are exactly identical, case-sensitively, returning TRUE when they are.'),
    example: ex('EXACT(A2,B2)',
      'A2 ve B2 harf büyüklüğü dahil birebir aynıysa DOĞRU verir',
      'Возвращает ИСТИНА, если A2 и B2 полностью совпадают, включая регистр букв',
      'Returns TRUE when A2 and B2 are identical, including letter case'),
    keywords: L(['tam eşleşme', 'özdeş mi', 'büyük küçük harf duyarlı karşılaştır', 'metinler aynı mı', 'iki hücre aynı mı', 'birebir aynı', 'karşılaştır'],
                ['точное совпадение', 'совпадают ли тексты', 'с учётом регистра', 'сравнить строки', 'одинаковые ли ячейки', 'идентичность текста', 'совпад'],
                ['exact', 'case-sensitive compare', 'identical text'])
  },
  {
    name: 'FIND', tr: 'BUL', ru: 'НАЙТИ', category: 'text',
    syntax: 'FIND(find_text, within_text, [start_num])',
    args: [
      arg('find_text', 'bul_metin', 'искомый_текст', false,
        'Aranacak metin (joker karakter kullanılamaz)', 'Искомый текст (подстановочные знаки не поддерживаются)', 'The text to find (wildcards are not supported)'),
      arg('within_text', 'metin_içinde', 'просматриваемый_текст', false,
        'İçinde arama yapılacak metin', 'Текст, в котором ведётся поиск', 'The text to search within'),
      arg('start_num', 'başlangıç_sayısı', 'нач_позиция', true,
        'Aramaya başlanacak karakter konumu; boşsa 1', 'Позиция символа, с которой начинается поиск; по умолчанию 1', 'The character position to start searching from; 1 if omitted')
    ],
    desc: L('Bir metnin başka bir metin içinde başladığı karakter konumunu büyük/küçük harfe duyarlı olarak verir.',
            'Возвращает позицию символа, с которого один текст начинается внутри другого, с учётом регистра.',
            'Returns the character position where one text string starts within another, case-sensitively.'),
    example: ex('FIND("@",L2)',
      'L2’deki e-posta adresinde "@" işaretinin kaçıncı karakter olduğunu verir',
      'Возвращает позицию символа "@" в адресе электронной почты из L2',
      'Returns the character position of "@" in the e-mail address in L2'),
    keywords: L(['bul', 'metinde ara', 'karakterin konumu', 'kaçıncı karakter', 'boşluğun yeri', 'harf duyarlı bul', 'konumunu bul', 'metin içinde pozisyon', 'işaretin yeri'],
                ['найти', 'позиция символа', 'найти в тексте', 'какой по счёту символ', 'позиция пробела', 'с учётом регистра', 'найти положение', 'номер символа', 'где находится символ'],
                ['find', 'position of character', 'locate text', 'case-sensitive search'])
  },
  {
    name: 'FINDB', tr: 'BULB', ru: 'НАЙТИБ', category: 'text',
    syntax: 'FINDB(find_text, within_text, [start_num])',
    args: [
      arg('find_text', 'bul_metin', 'искомый_текст', false,
        'Aranacak metin', 'Искомый текст', 'The text to find'),
      arg('within_text', 'metin_içinde', 'просматриваемый_текст', false,
        'İçinde arama yapılacak metin', 'Текст, в котором ведётся поиск', 'The text to search within'),
      arg('start_num', 'başlangıç_sayısı', 'нач_позиция', true,
        'Aramaya başlanacak bayt konumu; boşsa 1', 'Позиция в байтах, с которой начинается поиск; по умолчанию 1', 'The byte position to start searching from; 1 if omitted')
    ],
    desc: L('Bir metnin başka bir metin içinde başladığı bayt konumunu verir; çift baytlı dillerde her karakter 2 sayılır.',
            'Возвращает позицию в байтах, с которой один текст начинается внутри другого; в двухбайтовых языках каждый символ считается за 2.',
            'Returns the byte position where one text starts within another; each character counts as 2 in double-byte languages.'),
    example: ex('FINDB("月",A2)',
      'A2 içinde "月" karakterinin bayt konumunu verir',
      'Возвращает позицию символа "月" в A2 в байтах',
      'Returns the byte position of "月" in A2'),
    keywords: L(['bayt konumu bul', 'çift baytlı bul', 'bayt bazlı arama', 'bulb'],
                ['найти в байтах', 'двухбайтовый поиск', 'позиция в байтах', 'найтиб'],
                ['findb', 'byte position', 'double-byte find'])
  },
  {
    name: 'FIXED', tr: 'SAYIDÜZENLE', ru: 'ФИКСИРОВАННЫЙ', category: 'text',
    syntax: 'FIXED(number, [decimals], [no_commas])',
    args: [
      arg('number', 'sayı', 'число', false,
        'Yuvarlanıp metne çevrilecek sayı', 'Число, которое округляется и преобразуется в текст', 'The number to round and convert to text'),
      arg('decimals', 'ondalıklar', 'число_знаков', true,
        'Ondalık basamak sayısı; boşsa 2', 'Число десятичных знаков; по умолчанию 2', 'The number of decimal places; 2 if omitted'),
      arg('no_commas', 'virgül_yok', 'без_разделителей', true,
        'DOĞRU: binlik ayırıcı kullanma; YANLIŞ veya boş: binlik ayırıcı ekle', 'ИСТИНА: без разделителей тысяч; ЛОЖЬ или пусто: с разделителями', 'TRUE: no thousands separators; FALSE or omitted: include them')
    ],
    desc: L('Sayıyı belirtilen ondalık basamağa yuvarlar ve binlik ayırıcılı ya da ayırıcısız metin olarak verir.',
            'Округляет число до заданного числа знаков и возвращает его как текст с разделителями тысяч или без них.',
            'Rounds a number to the given decimals and returns it as text, with or without thousands separators.'),
    example: ex('FIXED(E2,2)',
      'E2 değerini iki ondalıklı ve binlik ayırıcılı metin olarak verir',
      'Возвращает значение E2 как текст с двумя знаками после запятой и разделителями тысяч',
      'Returns E2 as text with two decimals and thousands separators'),
    keywords: L(['sayıyı metne çevir ondalıklı', 'binlik ayırıcı ile metin', 'sabit ondalık', 'sayı düzenle', 'biçimli metin', 'yuvarlayıp metin yap'],
                ['число в текст с десятичными', 'с разделителем тысяч', 'фиксированный формат', 'округлить и в текст', 'форматированный текст числа', 'фиксированный'],
                ['fixed', 'number to text with decimals', 'thousands separator text'])
  },
  {
    name: 'JIS', tr: 'JIS', ru: 'JIS', category: 'text',
    syntax: 'JIS(text)',
    args: [
      arg('text', 'metin', 'текст', false,
        'Dönüştürülecek metin; yarım genişlikli karakter içermiyorsa değişmeden döner', 'Преобразуемый текст; без полуширинных символов возвращается без изменений', 'The text to convert; returned unchanged if it has no half-width characters')
    ],
    desc: L('Yarım genişlikli (tek baytlı) karakterleri tam genişlikli (çift baytlı) karakterlere dönüştürür (Japonca karakter kümeleri için).',
            'Преобразует полуширинные (однобайтовые) символы в полноширинные (двухбайтовые) для японских наборов символов.',
            'Converts half-width (single-byte) characters to full-width (double-byte) characters for Japanese character sets.'),
    example: ex('JIS("ｶﾀｶﾅ")',
      'Yarım genişlikli katakanayı tam genişlikliye çevirir: "カタカナ"',
      'Преобразует полуширинную катакану в полноширинную: "カタカナ"',
      'Converts half-width katakana to full-width: "カタカナ"'),
    keywords: L(['japonca tam genişlik', 'yarım genişlikten tam genişliğe', 'katakana dönüştür', 'jis'],
                ['японский полноширинный', 'полуширинные в полноширинные', 'преобразовать катакану', 'jis'],
                ['jis', 'half-width to full-width japanese', 'katakana full-width'])
  },
  {
    name: 'LEFT', tr: 'SOLDAN', ru: 'ЛЕВСИМВ', category: 'text',
    syntax: 'LEFT(text, [num_chars])',
    args: [
      arg('text', 'metin', 'текст', false,
        'Karakterleri alınacak metin', 'Текст, из которого берутся символы', 'The text to take characters from'),
      arg('num_chars', 'sayı_karakterler', 'число_знаков', true,
        'Alınacak karakter sayısı; boşsa 1', 'Число извлекаемых символов; по умолчанию 1', 'The number of characters to take; 1 if omitted')
    ],
    desc: L('Metnin başından (solundan) belirtilen sayıda karakteri verir.',
            'Возвращает заданное число символов с начала (слева) текста.',
            'Returns the specified number of characters from the start (left) of a text string.'),
    example: ex('LEFT(A2,3)',
      'A2’deki metnin ilk 3 karakterini verir',
      'Возвращает первые 3 символа текста из A2',
      'Returns the first 3 characters of the text in A2'),
    keywords: L(['soldan', 'ilk karakter', 'ilk 3 karakter', 'baştan al', 'baş harfleri', 'ilk n harf', 'metnin başı', 'ilk kelime', 'soldan kes', 'başından al', 'kodun ilk kısmı', 'ilk harf'],
                ['первые символы', 'слева', 'первые 3 символа', 'взять начало', 'первая буква', 'первые n букв', 'начало текста', 'первое слово', 'обрезать слева', 'левсимв', 'начало кода', 'левые символы'],
                ['left', 'first characters', 'first n chars', 'start of text'])
  },
  {
    name: 'LEFTB', tr: 'SOLB', ru: 'ЛЕВБ', category: 'text',
    syntax: 'LEFTB(text, [num_bytes])',
    args: [
      ARG_BYTE_TEXT,
      arg('num_bytes', 'sayı_bayt', 'число_байтов', true,
        'Alınacak bayt sayısı; boşsa 1', 'Число извлекаемых байтов; по умолчанию 1', 'The number of bytes to take; 1 if omitted')
    ],
    desc: L('Metnin başından belirtilen sayıda baytı verir; çift baytlı dillerde her karakter 2 bayt sayılır.',
            'Возвращает заданное число байтов с начала текста; в двухбайтовых языках каждый символ считается за 2 байта.',
            'Returns the specified number of bytes from the start of a text; each character counts as 2 bytes in double-byte languages.'),
    example: ex('LEFTB(A2,4)',
      'A2’deki metnin ilk 4 baytını verir (çift baytlı dilde ilk 2 karakter)',
      'Возвращает первые 4 байта текста из A2 (в двухбайтовом языке — 2 символа)',
      'Returns the first 4 bytes of the text in A2 (2 characters in a double-byte language)'),
    keywords: L(['soldan bayt', 'ilk baytlar', 'çift baytlı soldan', 'solb'],
                ['первые байты', 'слева байты', 'двухбайтовый левсимв', 'левб'],
                ['leftb', 'first bytes', 'left bytes'])
  },
  {
    name: 'LEN', tr: 'UZUNLUK', ru: 'ДЛСТР', category: 'text',
    syntax: 'LEN(text)',
    args: [
      arg('text', 'metin', 'текст', false,
        'Uzunluğu ölçülecek metin; boşluklar da sayılır', 'Текст, длину которого нужно измерить; пробелы тоже считаются', 'The text whose length you want; spaces count')
    ],
    desc: L('Metindeki karakter sayısını (boşluklar dahil) verir.',
            'Возвращает количество символов в тексте, включая пробелы.',
            'Returns the number of characters in a text string, including spaces.'),
    example: ex('LEN(A2)',
      'A2’deki metnin kaç karakter olduğunu verir',
      'Возвращает число символов в тексте из A2',
      'Returns how many characters the text in A2 has'),
    keywords: L(['uzunluk', 'karakter sayısı', 'kaç karakter', 'kaç harf', 'metin uzunluğu', 'harf say', 'hücredeki karakter adedi', 'uzunluğunu bul', 'boşluk dahil say', 'karakter adedi'],
                ['длина', 'количество символов', 'сколько символов', 'сколько букв', 'длина текста', 'посчитать символы', 'длстр', 'число знаков', 'длина строки', 'количество букв в ячейке'],
                ['len', 'length', 'number of characters', 'count characters'])
  },
  {
    name: 'LENB', tr: 'UZUNLUKB', ru: 'ДЛИНБ', category: 'text',
    syntax: 'LENB(text)',
    args: [ARG_BYTE_TEXT],
    desc: L('Metnin bayt cinsinden uzunluğunu verir; çift baytlı dillerde her karakter 2 bayt sayılır.',
            'Возвращает длину текста в байтах; в двухбайтовых языках каждый символ считается за 2 байта.',
            'Returns the length of a text in bytes; each character counts as 2 bytes in double-byte languages.'),
    example: ex('LENB(A2)',
      'A2’deki metnin bayt sayısını verir',
      'Возвращает число байтов в тексте из A2',
      'Returns the number of bytes in the text in A2'),
    keywords: L(['bayt uzunluğu', 'bayt say', 'çift baytlı uzunluk', 'uzunlukb'],
                ['длина в байтах', 'посчитать байты', 'двухбайтовая длина', 'длинб'],
                ['lenb', 'byte length', 'count bytes'])
  },
  {
    name: 'LOWER', tr: 'KÜÇÜKHARF', ru: 'СТРОЧН', category: 'text',
    syntax: 'LOWER(text)',
    args: [
      arg('text', 'metin', 'текст', false,
        'Küçük harfe çevrilecek metin', 'Текст, преобразуемый в нижний регистр', 'The text to convert to lowercase')
    ],
    desc: L('Metindeki tüm harfleri küçük harfe çevirir.',
            'Преобразует все буквы текста в строчные.',
            'Converts all letters in a text string to lowercase.'),
    example: ex('LOWER(L2)',
      'L2’deki e-posta adresini tamamen küçük harfe çevirir',
      'Переводит адрес электронной почты из L2 полностью в нижний регистр',
      'Converts the e-mail address in L2 entirely to lowercase'),
    keywords: L(['küçük harf', 'küçük harfe çevir', 'hepsini küçült', 'büyük harfleri küçült', 'küçük harf yap', 'harfleri küçült'],
                ['строчные', 'в нижний регистр', 'маленькие буквы', 'сделать строчными', 'убрать заглавные', 'строчн'],
                ['lower', 'lowercase', 'to lower case'])
  },
  {
    name: 'MID', tr: 'PARÇAAL', ru: 'ПСТР', category: 'text',
    syntax: 'MID(text, start_num, num_chars)',
    args: [
      arg('text', 'metin', 'текст', false,
        'Parça alınacak metin', 'Текст, из которого извлекается фрагмент', 'The text to extract from'),
      arg('start_num', 'başlangıç_sayısı', 'начальная_позиция', false,
        'İlk alınacak karakterin konumu (1 = ilk karakter)', 'Позиция первого извлекаемого символа (1 = первый символ)', 'The position of the first character to extract (1 = first character)'),
      arg('num_chars', 'sayı_karakterler', 'число_знаков', false,
        'Alınacak karakter sayısı; metin daha kısaysa sonuna kadar alır', 'Число извлекаемых символов; если текст короче, берётся до конца', 'The number of characters to extract; takes to the end if the text is shorter')
    ],
    desc: L('Metnin belirtilen konumundan başlayarak belirtilen sayıda karakteri verir.',
            'Возвращает заданное число символов текста, начиная с указанной позиции.',
            'Returns a given number of characters from a text string, starting at the position you specify.'),
    example: ex('MID(A2,3,4)',
      'A2’deki metnin 3. karakterinden başlayarak 4 karakter alır',
      'Берёт из текста в A2 4 символа, начиная с 3-го',
      'Takes 4 characters from the text in A2 starting at character 3'),
    keywords: L(['ortadan al', 'parça al', 'belirli konumdan karakter', 'ortadaki karakterler', 'n. karakterden itibaren', 'metnin ortası', 'aradan kes', 'belirli aralıktaki harfler', 'karakterleri çıkar', 'ortadan parça', 'parçaal'],
                ['из середины', 'часть текста', 'символы с позиции', 'вырезать фрагмент', 'с n-го символа', 'середина текста', 'взять подстроку', 'пстр', 'извлечь символы', 'подстрока', 'несколько символов с позиции'],
                ['mid', 'substring', 'characters from position', 'middle of text'])
  },
  {
    name: 'MIDB', tr: 'ORTAB', ru: 'ПСТРБ', category: 'text',
    syntax: 'MIDB(text, start_num, num_bytes)',
    args: [
      ARG_BYTE_TEXT,
      arg('start_num', 'başlangıç_sayısı', 'начальная_позиция', false,
        'İlk alınacak baytın konumu', 'Позиция первого извлекаемого байта', 'The position of the first byte to extract'),
      arg('num_bytes', 'sayı_bayt', 'число_байтов', false,
        'Alınacak bayt sayısı', 'Число извлекаемых байтов', 'The number of bytes to extract')
    ],
    desc: L('Metnin belirtilen bayt konumundan başlayarak belirtilen sayıda baytı verir; çift baytlı dillerde her karakter 2 bayt sayılır.',
            'Возвращает заданное число байтов текста, начиная с указанной позиции; в двухбайтовых языках каждый символ считается за 2 байта.',
            'Returns a given number of bytes from a text starting at a byte position; each character counts as 2 bytes in double-byte languages.'),
    example: ex('MIDB(A2,3,4)',
      'A2’deki metnin 3. baytından başlayarak 4 bayt alır',
      'Берёт из текста в A2 4 байта, начиная с 3-го',
      'Takes 4 bytes from the text in A2 starting at byte 3'),
    keywords: L(['ortadan bayt al', 'bayt parçası', 'çift baytlı parçaal', 'ortab'],
                ['байты из середины', 'фрагмент в байтах', 'двухбайтовый пстр', 'пстрб'],
                ['midb', 'bytes from position', 'byte substring'])
  },
  {
    name: 'NUMBERVALUE', tr: 'SAYIDEĞERİ', ru: 'ЧЗНАЧ', category: 'text', minVersion: '2013',
    syntax: 'NUMBERVALUE(text, [decimal_separator], [group_separator])',
    args: [
      arg('text', 'metin', 'текст', false,
        'Sayıya çevrilecek metin', 'Текст, преобразуемый в число', 'The text to convert to a number'),
      arg('decimal_separator', 'ondalık_ayırıcı', 'десятичный_разделитель', true,
        'Metinde ondalık ayırıcı olarak kullanılan karakter; boşsa sistem ayarı', 'Символ, используемый в тексте как десятичный разделитель; по умолчанию системный', 'The character used as the decimal separator in the text; the system setting if omitted'),
      arg('group_separator', 'grup_ayırıcı', 'разделитель_групп', true,
        'Metinde binlik ayırıcı olarak kullanılan karakter; boşsa sistem ayarı', 'Символ, используемый в тексте как разделитель тысяч; по умолчанию системный', 'The character used as the thousands separator in the text; the system setting if omitted')
    ],
    desc: L('Metni, belirtilen ondalık ve binlik ayırıcıları kullanarak yerel ayardan bağımsız biçimde sayıya çevirir.',
            'Преобразует текст в число независимо от региональных настроек, используя указанные десятичный разделитель и разделитель групп.',
            'Converts text to a number in a locale-independent way, using the decimal and group separators you specify.'),
    example: ex('NUMBERVALUE("1.234,56",",",".")',
      'Virgül ondalık, nokta binlik ayırıcı olan metni 1234,56 sayısına çevirir',
      'Преобразует текст с запятой в качестве десятичного разделителя и точкой для тысяч в число 1234,56',
      'Converts text with a comma decimal and dot thousands separator into the number 1234.56'),
    keywords: L(['metni sayıya çevir', 'ayırıcı belirterek sayı', 'virgüllü metni sayı yap', 'yabancı formatta sayı', 'nokta virgül sayıya çevir', 'sayı değeri', 'ondalık ayırıcı farklı'],
                ['текст в число', 'с указанием разделителя', 'число с запятой из текста', 'иностранный формат числа', 'преобразовать с разделителями', 'чзнач', 'точка вместо запятой'],
                ['numbervalue', 'text to number with separators', 'locale-independent number'])
  },
  {
    name: 'PHONETIC', tr: 'SES', ru: 'PHONETIC', category: 'text',
    syntax: 'PHONETIC(reference)',
    args: [
      arg('reference', 'başvuru', 'ссылка', false,
        'Furigana bilgisi içeren hücre veya aralık', 'Ячейка или диапазон с фуриганой', 'The cell or range that holds furigana information')
    ],
    desc: L('Metinden fonetik (furigana) karakterlerini çıkarır; Japonca metinler için kullanılır.',
            'Извлекает из текста фонетические знаки (фуригану); используется для японского текста.',
            'Extracts the phonetic (furigana) characters from text; used with Japanese text.'),
    example: ex('PHONETIC(A2)',
      'A2’deki Japonca metnin furigana okunuşunu verir',
      'Возвращает чтение фуриганой японского текста из A2',
      'Returns the furigana reading of the Japanese text in A2'),
    keywords: L(['furigana', 'fonetik karakterler', 'japonca okunuş', 'ses', 'okunuş çıkar'],
                ['фуригана', 'фонетические символы', 'японское чтение', 'phonetic', 'извлечь чтение'],
                ['phonetic', 'furigana', 'japanese reading'])
  },
  {
    name: 'PROPER', tr: 'YAZIM.DÜZENİ', ru: 'ПРОПНАЧ', category: 'text',
    syntax: 'PROPER(text)',
    args: [
      arg('text', 'metin', 'текст', false,
        'Sözcük başları büyütülecek metin', 'Текст, в котором каждое слово начинается с заглавной буквы', 'The text whose words should be capitalized')
    ],
    desc: L('Metindeki her sözcüğün ilk harfini büyük, diğer harflerini küçük yapar.',
            'Делает первую букву каждого слова заглавной, а остальные — строчными.',
            'Capitalizes the first letter of each word and makes the other letters lowercase.'),
    example: ex('PROPER(M2)',
      '"ayşe YILMAZ" gibi bir adı "Ayşe Yılmaz" biçimine getirir',
      'Приводит имя вроде "иванова АННА" к виду "Иванова Анна"',
      'Turns a name like "ayşe YILMAZ" into "Ayşe Yılmaz"'),
    keywords: L(['baş harfleri büyük', 'her kelimenin ilk harfi', 'yazım düzeni', 'ad soyad düzelt', 'isim biçimlendir', 'kelime başı büyük', 'ilk harfi büyüt'],
                ['с заглавной буквы', 'первая буква каждого слова', 'имена с большой буквы', 'пропнач', 'исправить регистр имени', 'каждое слово с заглавной', 'привести имя к нормальному виду'],
                ['proper', 'capitalize words', 'title case'])
  },
  {
    name: 'REGEXEXTRACT', tr: 'REGEXEXTRACT', ru: 'REGEXEXTRACT', category: 'text', minVersion: '365', uncertain: ['tr', 'ru'],
    syntax: 'REGEXEXTRACT(text, pattern, [return_mode], [case_sensitivity])',
    args: [
      arg('text', 'metin', 'текст', false,
        'İçinden parça çıkarılacak metin', 'Текст, из которого извлекается фрагмент', 'The text to extract from'),
      arg('pattern', 'desen', 'шаблон', false,
        'Normal ifade (regex) deseni, örn. "[0-9]+"', 'Регулярное выражение, например "[0-9]+"', 'The regular expression pattern, e.g. "[0-9]+"'),
      arg('return_mode', 'döndürme_modu', 'режим_возврата', true,
        '0 veya boş: ilk eşleşme; 1: tüm eşleşmeler (dizi); 2: ilk eşleşmenin yakalama grupları', '0 или пусто: первое совпадение; 1: все совпадения (массив); 2: группы захвата первого совпадения', '0 or omitted: first match; 1: all matches (array); 2: capture groups of the first match'),
      arg('case_sensitivity', 'büyük_küçük_harf_duyarlılığı', 'учёт_регистра', true,
        '0 veya boş: harf duyarlı; 1: harf duyarsız', '0 или пусто: с учётом регистра; 1: без учёта регистра', '0 or omitted: case-sensitive; 1: case-insensitive')
    ],
    desc: L('Metinden normal ifade desenine uyan ilk parçayı, tüm eşleşmeleri veya yakalama gruplarını çıkarır.',
            'Извлекает из текста первый фрагмент, все совпадения или группы захвата, соответствующие регулярному выражению.',
            'Extracts the first match, all matches or the capture groups of a regular expression pattern from text.'),
    example: ex('REGEXEXTRACT(A2,"[0-9]+")',
      'A2’deki metinde geçen ilk rakam dizisini verir (örn. "Sipariş 4512" → "4512")',
      'Возвращает первую последовательность цифр из текста A2 (например, "Заказ 4512" → "4512")',
      'Returns the first run of digits in the text of A2 (e.g. "Order 4512" → "4512")'),
    keywords: L(['regex ile çıkar', 'düzenli ifade', 'desene uyan metni al', 'sayıları ayıkla', 'metinden rakamları çıkar', 'e-posta ayıkla', 'desenle ayıkla'],
                ['извлечь по регулярному выражению', 'регулярное выражение', 'regex', 'вытащить цифры из текста', 'извлечь по шаблону', 'достать email', 'регулярка'],
                ['regex extract', 'regular expression', 'extract pattern'])
  },
  {
    name: 'REGEXREPLACE', tr: 'REGEXREPLACE', ru: 'REGEXREPLACE', category: 'text', minVersion: '365', uncertain: ['tr', 'ru'],
    syntax: 'REGEXREPLACE(text, pattern, replacement, [occurrence], [case_sensitivity])',
    args: [
      arg('text', 'metin', 'текст', false,
        'Değiştirme yapılacak metin', 'Текст, в котором выполняется замена', 'The text to perform the replacement in'),
      arg('pattern', 'desen', 'шаблон', false,
        'Eşleşecek normal ifade deseni', 'Регулярное выражение для поиска', 'The regular expression pattern to match'),
      arg('replacement', 'değiştirme', 'замена', false,
        'Eşleşmelerin yerine yazılacak metin; $1, $2 ile yakalama grupları kullanılabilir', 'Текст, подставляемый вместо совпадений; можно использовать группы $1, $2', 'The text to put in place of the matches; capture groups $1, $2 may be used'),
      arg('occurrence', 'yineleme', 'вхождение', true,
        '0 veya boş: tüm eşleşmeler; n: yalnızca n. eşleşme; negatif: sondan n.', '0 или пусто: все совпадения; n: только n-е совпадение; отрицательное: n-е с конца', '0 or omitted: all matches; n: only the nth match; negative: nth from the end'),
      arg('case_sensitivity', 'büyük_küçük_harf_duyarlılığı', 'учёт_регистра', true,
        '0 veya boş: harf duyarlı; 1: harf duyarsız', '0 или пусто: с учётом регистра; 1: без учёта регистра', '0 or omitted: case-sensitive; 1: case-insensitive')
    ],
    desc: L('Metinde normal ifade desenine uyan kısımları belirtilen metinle değiştirir.',
            'Заменяет в тексте фрагменты, соответствующие регулярному выражению, на указанный текст.',
            'Replaces the parts of a text that match a regular expression pattern with the given text.'),
    example: ex('REGEXREPLACE(A2,"[^0-9]","")',
      'A2’deki rakam olmayan tüm karakterleri siler, yalnızca rakamlar kalır',
      'Удаляет из A2 все символы, кроме цифр',
      'Removes every non-digit character from A2, leaving only the digits'),
    keywords: L(['regex ile değiştir', 'desene göre değiştir', 'harfleri sil sadece rakam kalsın', 'düzenli ifade değiştir', 'metni temizle regex', 'telefon numarasını temizle'],
                ['заменить по регулярному выражению', 'замена по шаблону', 'оставить только цифры', 'regex замена', 'очистить текст по шаблону', 'очистить номер телефона'],
                ['regex replace', 'replace by pattern', 'keep only digits'])
  },
  {
    name: 'REGEXTEST', tr: 'REGEXTEST', ru: 'REGEXTEST', category: 'text', minVersion: '365', uncertain: ['tr', 'ru'],
    syntax: 'REGEXTEST(text, pattern, [case_sensitivity])',
    args: [
      arg('text', 'metin', 'текст', false,
        'Sınanacak metin', 'Проверяемый текст', 'The text to test'),
      arg('pattern', 'desen', 'шаблон', false,
        'Aranacak normal ifade deseni', 'Регулярное выражение для проверки', 'The regular expression pattern to look for'),
      arg('case_sensitivity', 'büyük_küçük_harf_duyarlılığı', 'учёт_регистра', true,
        '0 veya boş: harf duyarlı; 1: harf duyarsız', '0 или пусто: с учётом регистра; 1: без учёта регистра', '0 or omitted: case-sensitive; 1: case-insensitive')
    ],
    desc: L('Metnin herhangi bir bölümünün normal ifade desenine uyup uymadığını sınar; uyuyorsa DOĞRU verir.',
            'Проверяет, соответствует ли какая-либо часть текста регулярному выражению, и возвращает ИСТИНА при совпадении.',
            'Tests whether any part of a text matches a regular expression pattern, returning TRUE when it does.'),
    example: ex('REGEXTEST(L2,"^[^@]+@[^@]+\\.[a-z]{2,}$")',
      'L2’deki değer geçerli bir e-posta biçimindeyse DOĞRU verir',
      'Возвращает ИСТИНА, если значение в L2 имеет вид корректного адреса электронной почты',
      'Returns TRUE when the value in L2 looks like a valid e-mail address'),
    keywords: L(['regex ile kontrol', 'desene uyuyor mu', 'biçim doğrulama', 'e-posta geçerli mi', 'düzenli ifade sınama', 'telefon formatı kontrol', 'formata uygun mu'],
                ['проверить по регулярному выражению', 'соответствует ли шаблону', 'валидация формата', 'правильный ли email', 'regex проверка', 'проверка формата телефона', 'подходит ли под шаблон'],
                ['regex test', 'matches pattern', 'validate format'])
  },
  {
    name: 'REPLACE', tr: 'DEĞİŞTİR', ru: 'ЗАМЕНИТЬ', category: 'text',
    syntax: 'REPLACE(old_text, start_num, num_chars, new_text)',
    args: [
      arg('old_text', 'eski_metin', 'стар_текст', false,
        'Bir kısmı değiştirilecek metin', 'Текст, часть которого заменяется', 'The text in which to replace part'),
      arg('start_num', 'başlangıç_sayısı', 'нач_поз', false,
        'Değiştirilecek ilk karakterin konumu', 'Позиция первого заменяемого символа', 'The position of the first character to replace'),
      arg('num_chars', 'sayı_karakterler', 'число_знаков', false,
        'Değiştirilecek karakter sayısı (0 = araya ekle)', 'Число заменяемых символов (0 = вставить)', 'The number of characters to replace (0 = insert)'),
      arg('new_text', 'yeni_metin', 'нов_текст', false,
        'Yerine yazılacak metin', 'Подставляемый текст', 'The text to put in their place')
    ],
    desc: L('Metnin belirtilen konumundan başlayan belirli sayıda karakteri yeni metinle değiştirir.',
            'Заменяет заданное число символов текста, начиная с указанной позиции, новым текстом.',
            'Replaces a given number of characters in a text, starting at a position, with new text.'),
    example: ex('REPLACE(A2,1,3,"XYZ")',
      'A2’deki metnin ilk 3 karakterini "XYZ" ile değiştirir',
      'Заменяет первые 3 символа текста в A2 на "XYZ"',
      'Replaces the first 3 characters of the text in A2 with "XYZ"'),
    keywords: L(['konuma göre değiştir', 'karakterleri değiştir', 'belirli konumdaki harfleri değiştir', 'ilk 3 karakteri değiştir', 'metnin bir kısmını değiştir', 'karakter ekle', 'araya metin ekle', 'maskele'],
                ['заменить по позиции', 'заменить символы', 'заменить часть текста', 'заменить первые 3 символа', 'вставить символы', 'заменить с позиции', 'вставить текст в середину', 'замаскировать'],
                ['replace', 'replace by position', 'replace characters'])
  },
  {
    name: 'REPLACEB', tr: 'DEĞİŞTİRB', ru: 'ЗАМЕНИТЬБ', category: 'text',
    syntax: 'REPLACEB(old_text, start_num, num_bytes, new_text)',
    args: [
      arg('old_text', 'eski_metin', 'стар_текст', false,
        'Bir kısmı değiştirilecek metin', 'Текст, часть которого заменяется', 'The text in which to replace part'),
      arg('start_num', 'başlangıç_sayısı', 'нач_поз', false,
        'Değiştirilecek ilk baytın konumu', 'Позиция первого заменяемого байта', 'The position of the first byte to replace'),
      arg('num_bytes', 'sayı_bayt', 'число_байтов', false,
        'Değiştirilecek bayt sayısı', 'Число заменяемых байтов', 'The number of bytes to replace'),
      arg('new_text', 'yeni_metin', 'нов_текст', false,
        'Yerine yazılacak metin', 'Подставляемый текст', 'The text to put in their place')
    ],
    desc: L('Metnin belirtilen bayt konumundan başlayan belirli sayıda baytı yeni metinle değiştirir; çift baytlı dillerde her karakter 2 bayt sayılır.',
            'Заменяет заданное число байтов текста, начиная с указанной позиции, новым текстом; в двухбайтовых языках каждый символ считается за 2 байта.',
            'Replaces a number of bytes in a text, starting at a byte position, with new text; each character counts as 2 bytes in double-byte languages.'),
    example: ex('REPLACEB(A2,1,4,"XY")',
      'A2’deki metnin ilk 4 baytını "XY" ile değiştirir',
      'Заменяет первые 4 байта текста в A2 на "XY"',
      'Replaces the first 4 bytes of the text in A2 with "XY"'),
    keywords: L(['bayt konumuna göre değiştir', 'çift baytlı değiştir', 'baytları değiştir', 'değiştirb'],
                ['заменить по байтам', 'двухбайтовая замена', 'заменить байты', 'заменитьб'],
                ['replaceb', 'replace bytes', 'byte replace'])
  },
  {
    name: 'REPT', tr: 'YİNELE', ru: 'ПОВТОР', category: 'text',
    syntax: 'REPT(text, number_times)',
    args: [
      arg('text', 'metin', 'текст', false,
        'Tekrarlanacak metin veya karakter', 'Повторяемый текст или символ', 'The text or character to repeat'),
      arg('number_times', 'yineleme_sayısı', 'число_повторений', false,
        'Tekrar sayısı (pozitif tam sayı; 0 boş metin verir)', 'Число повторений (положительное целое; 0 даёт пустой текст)', 'How many times to repeat (positive integer; 0 returns empty text)')
    ],
    desc: L('Metni belirtilen sayıda tekrarlayarak verir.',
            'Возвращает текст, повторённый заданное число раз.',
            'Returns a text string repeated the specified number of times.'),
    example: ex('REPT("★",C2)',
      'C2’deki adet kadar yıldız yazarak hücre içinde basit bir çubuk grafik oluşturur',
      'Выводит столько звёздочек, сколько указано в C2, создавая простую диаграмму в ячейке',
      'Writes as many stars as the count in C2, making a simple in-cell bar chart'),
    keywords: L(['tekrarla', 'yinele', 'metni n kez yaz', 'yıldız çubuğu', 'karakter tekrarı', 'hücre içi grafik', 'sıfırla doldur', 'çizgi çiz'],
                ['повторить', 'повтор текста', 'n раз', 'гистограмма из символов', 'повторить символ', 'дополнить нулями', 'диаграмма в ячейке', 'нарисовать линию'],
                ['rept', 'repeat text', 'in-cell bar chart'])
  },
  {
    name: 'RIGHT', tr: 'SAĞDAN', ru: 'ПРАВСИМВ', category: 'text',
    syntax: 'RIGHT(text, [num_chars])',
    args: [
      arg('text', 'metin', 'текст', false,
        'Karakterleri alınacak metin', 'Текст, из которого берутся символы', 'The text to take characters from'),
      arg('num_chars', 'sayı_karakterler', 'число_знаков', true,
        'Alınacak karakter sayısı; boşsa 1', 'Число извлекаемых символов; по умолчанию 1', 'The number of characters to take; 1 if omitted')
    ],
    desc: L('Metnin sonundan (sağından) belirtilen sayıda karakteri verir.',
            'Возвращает заданное число символов с конца (справа) текста.',
            'Returns the specified number of characters from the end (right) of a text string.'),
    example: ex('RIGHT(A2,4)',
      'A2’deki metnin son 4 karakterini verir',
      'Возвращает последние 4 символа текста из A2',
      'Returns the last 4 characters of the text in A2'),
    keywords: L(['sağdan', 'son karakter', 'son 4 karakter', 'sondan al', 'son n harf', 'metnin sonu', 'son kelime', 'sağdan kes', 'sonundan al', 'uzantıyı al', 'son harf', 'son rakamlar'],
                ['последние символы', 'справа', 'последние 4 символа', 'взять конец', 'последняя буква', 'последние n букв', 'конец текста', 'последнее слово', 'обрезать справа', 'правсимв', 'последние цифры', 'правые символы'],
                ['right', 'last characters', 'last n chars', 'end of text'])
  },
  {
    name: 'RIGHTB', tr: 'SAĞB', ru: 'ПРАВБ', category: 'text',
    syntax: 'RIGHTB(text, [num_bytes])',
    args: [
      ARG_BYTE_TEXT,
      arg('num_bytes', 'sayı_bayt', 'число_байтов', true,
        'Alınacak bayt sayısı; boşsa 1', 'Число извлекаемых байтов; по умолчанию 1', 'The number of bytes to take; 1 if omitted')
    ],
    desc: L('Metnin sonundan belirtilen sayıda baytı verir; çift baytlı dillerde her karakter 2 bayt sayılır.',
            'Возвращает заданное число байтов с конца текста; в двухбайтовых языках каждый символ считается за 2 байта.',
            'Returns the specified number of bytes from the end of a text; each character counts as 2 bytes in double-byte languages.'),
    example: ex('RIGHTB(A2,4)',
      'A2’deki metnin son 4 baytını verir (çift baytlı dilde son 2 karakter)',
      'Возвращает последние 4 байта текста из A2 (в двухбайтовом языке — 2 символа)',
      'Returns the last 4 bytes of the text in A2 (2 characters in a double-byte language)'),
    keywords: L(['sağdan bayt', 'son baytlar', 'çift baytlı sağdan', 'sağb'],
                ['последние байты', 'справа байты', 'двухбайтовый правсимв', 'правб'],
                ['rightb', 'last bytes', 'right bytes'])
  },
  {
    name: 'SEARCH', tr: 'MBUL', ru: 'ПОИСК', category: 'text',
    syntax: 'SEARCH(find_text, within_text, [start_num])',
    args: [
      arg('find_text', 'bul_metin', 'искомый_текст', false,
        'Aranacak metin; ? ve * joker karakterleri kullanılabilir', 'Искомый текст; можно использовать подстановочные знаки ? и *', 'The text to find; the wildcards ? and * may be used'),
      arg('within_text', 'metin_içinde', 'просматриваемый_текст', false,
        'İçinde arama yapılacak metin', 'Текст, в котором ведётся поиск', 'The text to search within'),
      arg('start_num', 'başlangıç_sayısı', 'нач_позиция', true,
        'Aramaya başlanacak karakter konumu; boşsa 1', 'Позиция символа, с которой начинается поиск; по умолчанию 1', 'The character position to start searching from; 1 if omitted')
    ],
    desc: L('Bir metnin başka bir metin içinde başladığı konumu büyük/küçük harf ayrımı yapmadan verir; bulunamazsa #DEĞER! döner.',
            'Возвращает позицию, с которой один текст начинается внутри другого, без учёта регистра; если не найден — #ЗНАЧ!.',
            'Returns the position where one text starts within another, ignoring case; returns #VALUE! when not found.'),
    example: ex('ISNUMBER(SEARCH("kalem",A2))',
      'A2 metni "kalem" ifadesini (büyük/küçük harf fark etmeksizin) içeriyorsa DOĞRU verir',
      'Возвращает ИСТИНА, если текст A2 содержит "kalem" (без учёта регистра)',
      'Returns TRUE when the text in A2 contains "kalem" (case-insensitive)'),
    keywords: L(['içeriyor mu', 'metinde ara', 'harf duyarsız bul', 'joker ile ara', 'kelime geçiyor mu', 'konumunu bul', 'mbul', 'içinde var mı', 'geçiyorsa'],
                ['содержит', 'искать в тексте', 'без учёта регистра', 'поиск с подстановочными', 'есть ли слово', 'найти позицию', 'поиск', 'входит ли', 'если содержит'],
                ['search', 'contains', 'case-insensitive find', 'wildcard search'])
  },
  {
    name: 'SEARCHB', tr: 'MBULB', ru: 'ПОИСКБ', category: 'text',
    syntax: 'SEARCHB(find_text, within_text, [start_num])',
    args: [
      arg('find_text', 'bul_metin', 'искомый_текст', false,
        'Aranacak metin; joker karakterler kullanılabilir', 'Искомый текст; можно использовать подстановочные знаки', 'The text to find; wildcards may be used'),
      arg('within_text', 'metin_içinde', 'просматриваемый_текст', false,
        'İçinde arama yapılacak metin', 'Текст, в котором ведётся поиск', 'The text to search within'),
      arg('start_num', 'başlangıç_sayısı', 'нач_позиция', true,
        'Aramaya başlanacak bayt konumu; boşsa 1', 'Позиция в байтах, с которой начинается поиск; по умолчанию 1', 'The byte position to start searching from; 1 if omitted')
    ],
    desc: L('Bir metnin başka bir metin içinde başladığı bayt konumunu büyük/küçük harf ayrımı yapmadan verir; çift baytlı dillerde her karakter 2 sayılır.',
            'Возвращает позицию в байтах, с которой один текст начинается внутри другого, без учёта регистра; в двухбайтовых языках каждый символ считается за 2.',
            'Returns the byte position where one text starts within another, ignoring case; each character counts as 2 in double-byte languages.'),
    example: ex('SEARCHB("月",A2)',
      'A2 içinde "月" karakterinin bayt konumunu verir',
      'Возвращает позицию символа "月" в A2 в байтах',
      'Returns the byte position of "月" in A2'),
    keywords: L(['bayt konumu ara', 'çift baytlı mbul', 'harf duyarsız bayt arama', 'mbulb'],
                ['поиск в байтах', 'двухбайтовый поиск', 'позиция в байтах без регистра', 'поискб'],
                ['searchb', 'byte position search', 'byte search'])
  },
  {
    name: 'SUBSTITUTE', tr: 'YERİNEKOY', ru: 'ПОДСТАВИТЬ', category: 'text',
    syntax: 'SUBSTITUTE(text, old_text, new_text, [instance_num])',
    args: [
      arg('text', 'metin', 'текст', false,
        'İçinde değiştirme yapılacak metin', 'Текст, в котором выполняется замена', 'The text in which to make the replacement'),
      arg('old_text', 'eski_metin', 'стар_текст', false,
        'Değiştirilecek metin (büyük/küçük harf duyarlı)', 'Заменяемый текст (с учётом регистра)', 'The text to replace (case-sensitive)'),
      arg('new_text', 'yeni_metin', 'нов_текст', false,
        'Yerine yazılacak metin ("" silmek için)', 'Подставляемый текст ("" для удаления)', 'The replacement text ("" to delete)'),
      arg('instance_num', 'yineleme_sayısı', 'номер_вхождения', true,
        'Yalnızca kaçıncı geçtiği yerin değiştirileceği; boşsa tüm geçtiği yerler', 'Номер заменяемого вхождения; если опущен, заменяются все', 'Which occurrence to replace; all occurrences if omitted')
    ],
    desc: L('Metinde belirli bir metnin tüm geçtiği yerleri veya yalnızca n. geçtiği yeri başka bir metinle değiştirir.',
            'Заменяет в тексте все вхождения указанного фрагмента или только n-е вхождение другим текстом.',
            'Replaces every occurrence, or only the nth occurrence, of a given text within a text string.'),
    example: ex('SUBSTITUTE(A2," ","")',
      'A2’deki tüm boşlukları kaldırır',
      'Удаляет из A2 все пробелы',
      'Removes every space from A2'),
    keywords: L(['değiştir', 'yerine koy', 'metni değiştir', 'boşlukları sil', 'karakteri değiştir', 'kelimeyi değiştir', 'virgülü noktaya çevir', 'tire kaldır', 'x yerine y yaz', 'belirli metni sil', 'n. geçtiği yeri değiştir', 'yerinekoy', 'bul değiştir'],
                ['заменить', 'подставить', 'заменить текст', 'удалить пробелы', 'заменить символ', 'заменить слово', 'запятую на точку', 'убрать дефис', 'вместо x написать y', 'удалить часть текста', 'заменить n-е вхождение', 'заменить все вхождения', 'найти и заменить'],
                ['substitute', 'replace text', 'remove spaces', 'find and replace'])
  },
  {
    name: 'T', tr: 'M', ru: 'Т', category: 'text',
    syntax: 'T(value)',
    args: [
      arg('value', 'değer', 'значение', false,
        'Sınanacak değer veya hücre', 'Проверяемое значение или ячейка', 'The value or cell to test')
    ],
    desc: L('Değer metin ise metnin kendisini, değilse boş metin ("") verir.',
            'Возвращает сам текст, если значение является текстом, иначе — пустую строку ("").',
            'Returns the text itself when the value is text, otherwise an empty string ("").'),
    example: ex('T(A2)',
      'A2 metin ise içeriğini, sayı veya tarih ise boş metin verir',
      'Возвращает содержимое A2, если это текст, и пустую строку, если число или дата',
      'Returns the content of A2 if it is text, or empty text if it is a number or date'),
    keywords: L(['sadece metin ise', 'metin değilse boş', 'metin mi kontrol', 'metni al', 'metin olanları getir'],
                ['только если текст', 'если не текст пусто', 'проверить текст', 'взять текст', 'вернуть только текст'],
                ['t', 'text only', 'return text if text'])
  },
  {
    name: 'TEXT', tr: 'METNEÇEVİR', ru: 'ТЕКСТ', category: 'text',
    syntax: 'TEXT(value, format_text)',
    args: [
      arg('value', 'değer', 'значение', false,
        'Biçimlendirilecek sayı, tarih veya saat', 'Форматируемое число, дата или время', 'The number, date or time to format'),
      arg('format_text', 'biçim_metni', 'формат', false,
        'Tırnak içinde biçim kodu, örn. "0.00", "#,##0", "dd.mm.yyyy", "mmmm", "dddd", "0%"', 'Код формата в кавычках, например "0,00", "# ##0", "ДД.ММ.ГГГГ", "ММММ", "ДДДД", "0%"', 'A format code in quotes, e.g. "0.00", "#,##0", "dd.mm.yyyy", "mmmm", "dddd", "0%"')
    ],
    desc: L('Bir sayı, tarih veya saati belirtilen biçim koduyla metne çevirir.',
            'Преобразует число, дату или время в текст по заданному коду формата.',
            'Converts a number, date or time to text using the format code you specify.'),
    example: ex('TEXT(F2,"dd.mm.yyyy")',
      'F2 tarihini "05.01.2024" biçiminde metne çevirir',
      'Преобразует дату из F2 в текст вида "05.01.2024"',
      'Converts the date in F2 to text like "05.01.2024"'),
    keywords: L(['metne çevir', 'biçimlendir', 'tarihi metne çevir', 'sayı formatı', 'ay adı', 'gün adı', 'para formatı', 'sıfırla doldur', 'tarih biçimi', 'yüzde olarak yaz', 'sayıyı biçimli yaz', 'ondalık biçim', 'metneçevir', 'tarihi yazıyla'],
                ['в текст', 'формат', 'дата в текст', 'формат числа', 'название месяца', 'день недели', 'денежный формат', 'ведущие нули', 'формат даты', 'в процентах', 'число в текст с форматом', 'текст', 'дата прописью', 'отформатировать число'],
                ['text', 'format number', 'format date', 'number to text', 'month name'])
  },
  {
    name: 'TEXTAFTER', tr: 'METİNSONRASI', ru: 'ТЕКСТПОСЛЕ', category: 'text', minVersion: '365',
    syntax: 'TEXTAFTER(text, delimiter, [instance_num], [match_mode], [match_end], [if_not_found])',
    args: [
      arg('text', 'metin', 'текст', false,
        'İçinde arama yapılacak metin', 'Текст, в котором ведётся поиск', 'The text to search within'),
      arg('delimiter', 'sınırlayıcı', 'разделитель', false,
        'Sonrasındaki metnin alınacağı ayırıcı (örn. "@", " ", ",")', 'Разделитель, после которого берётся текст (например, "@", " ", ",")', 'The delimiter after which the text is taken (e.g. "@", " ", ",")'),
      arg('instance_num', 'örnek_numarası', 'номер_вхождения', true,
        'Kaçıncı ayırıcıdan sonra alınacağı; negatif sayı sondan sayar; boşsa 1', 'После какого по счёту разделителя брать текст; отрицательное — с конца; по умолчанию 1', 'Which occurrence of the delimiter to use; negative counts from the end; 1 if omitted'),
      arg('match_mode', 'eşleştirme_modu', 'режим_сопоставления', true,
        '0 veya boş: harf duyarlı; 1: harf duyarsız', '0 или пусто: с учётом регистра; 1: без учёта регистра', '0 or omitted: case-sensitive; 1: case-insensitive'),
      arg('match_end', 'eşleşme_sonu', 'совпадение_в_конце', true,
        '1: metnin sonunu da ayırıcı gibi say; 0 veya boş: sayma', '1: считать конец текста разделителем; 0 или пусто: не считать', '1: treat the end of the text as a delimiter; 0 or omitted: do not'),
      arg('if_not_found', 'bulunamazsa', 'если_не_найдено', true,
        'Ayırıcı bulunamazsa döndürülecek değer; boşsa #YOK', 'Значение, если разделитель не найден; по умолчанию #Н/Д', 'The value to return when the delimiter is not found; #N/A if omitted')
    ],
    desc: L('Metinde belirtilen ayırıcıdan sonra gelen kısmı verir.',
            'Возвращает часть текста, следующую после указанного разделителя.',
            'Returns the part of a text that comes after the specified delimiter.'),
    example: ex('TEXTAFTER(L2,"@")',
      'L2’deki e-posta adresinin "@" işaretinden sonraki alan adını verir',
      'Возвращает домен адреса электронной почты из L2 — часть после "@"',
      'Returns the domain of the e-mail address in L2, the part after "@"'),
    keywords: L(['sonrasını al', 'ayırıcıdan sonra', 'işaretten sonraki metin', 'alan adı', '@ işaretinden sonra', 'soyadı al', 'son kelime', 'sonraki metin', 'boşluktan sonrası'],
                ['текст после', 'после разделителя', 'после символа', 'домен из email', 'после @', 'фамилия после пробела', 'последнее слово', 'остаток после', 'после пробела'],
                ['text after', 'after delimiter', 'domain from email'])
  },
  {
    name: 'TEXTBEFORE', tr: 'METİNÖNCESİ', ru: 'ТЕКСТДО', category: 'text', minVersion: '365',
    syntax: 'TEXTBEFORE(text, delimiter, [instance_num], [match_mode], [match_end], [if_not_found])',
    args: [
      arg('text', 'metin', 'текст', false,
        'İçinde arama yapılacak metin', 'Текст, в котором ведётся поиск', 'The text to search within'),
      arg('delimiter', 'sınırlayıcı', 'разделитель', false,
        'Öncesindeki metnin alınacağı ayırıcı (örn. "@", " ", ",")', 'Разделитель, до которого берётся текст (например, "@", " ", ",")', 'The delimiter before which the text is taken (e.g. "@", " ", ",")'),
      arg('instance_num', 'örnek_numarası', 'номер_вхождения', true,
        'Kaçıncı ayırıcıdan önce alınacağı; negatif sayı sondan sayar; boşsa 1', 'До какого по счёту разделителя брать текст; отрицательное — с конца; по умолчанию 1', 'Which occurrence of the delimiter to use; negative counts from the end; 1 if omitted'),
      arg('match_mode', 'eşleştirme_modu', 'режим_сопоставления', true,
        '0 veya boş: harf duyarlı; 1: harf duyarsız', '0 или пусто: с учётом регистра; 1: без учёта регистра', '0 or omitted: case-sensitive; 1: case-insensitive'),
      arg('match_end', 'eşleşme_sonu', 'совпадение_в_конце', true,
        '1: metnin sonunu da ayırıcı gibi say; 0 veya boş: sayma', '1: считать конец текста разделителем; 0 или пусто: не считать', '1: treat the end of the text as a delimiter; 0 or omitted: do not'),
      arg('if_not_found', 'bulunamazsa', 'если_не_найдено', true,
        'Ayırıcı bulunamazsa döndürülecek değer; boşsa #YOK', 'Значение, если разделитель не найден; по умолчанию #Н/Д', 'The value to return when the delimiter is not found; #N/A if omitted')
    ],
    desc: L('Metinde belirtilen ayırıcıdan önce gelen kısmı verir.',
            'Возвращает часть текста, расположенную до указанного разделителя.',
            'Returns the part of a text that comes before the specified delimiter.'),
    example: ex('TEXTBEFORE(M2," ")',
      'M2’deki ad soyadın ilk boşluktan önceki kısmını, yani adı verir',
      'Возвращает часть ФИО из M2 до первого пробела, то есть первое слово',
      'Returns the part of the full name in M2 before the first space, i.e. the first name'),
    keywords: L(['öncesini al', 'ayırıcıdan önce', 'işaretten önceki metin', 'ilk kelime', '@ işaretinden önce', 'kullanıcı adı', 'virgülden önce', 'önceki metin', 'boşluktan öncesi', 'adı al'],
                ['текст до', 'до разделителя', 'до символа', 'первое слово', 'до @', 'имя пользователя из email', 'до запятой', 'часть до', 'до пробела', 'взять имя'],
                ['text before', 'before delimiter', 'first word'])
  },
  {
    name: 'TEXTJOIN', tr: 'METİNBİRLEŞTİR', ru: 'ОБЪЕДИНИТЬ', category: 'text', minVersion: '2019',
    syntax: 'TEXTJOIN(delimiter, ignore_empty, text1, [text2], ...)',
    args: [
      arg('delimiter', 'sınırlayıcı', 'разделитель', false,
        'Öğeler arasına konacak metin, örn. ", " veya "; "; boş olabilir', 'Текст между элементами, например ", " или "; "; может быть пустым', 'The text placed between items, e.g. ", " or "; "; may be empty'),
      arg('ignore_empty', 'boşları_yoksay', 'пропускать_пустые', false,
        'DOĞRU: boş hücreleri atla; YANLIŞ: boşlar için de ayırıcı ekle', 'ИСТИНА: пропускать пустые ячейки; ЛОЖЬ: ставить разделитель и для пустых', 'TRUE: skip empty cells; FALSE: add a delimiter for empty cells too'),
      arg('text1', 'metin1', 'текст1', false,
        'Birleştirilecek metin, hücre veya aralık', 'Текст, ячейка или диапазон для объединения', 'The text, cell or range to join'),
      arg('text2', 'metin2', 'текст2', true,
        'Ek metinler veya aralıklar, 252 taneye kadar', 'Дополнительные тексты или диапазоны, до 252', 'Further texts or ranges, up to 252')
    ],
    desc: L('Birden çok metni veya bir aralığın hücrelerini aralarına ayırıcı koyarak tek bir metinde birleştirir; boş hücreler isteğe bağlı atlanır.',
            'Объединяет несколько текстов или ячейки диапазона в одну строку через разделитель, при желании пропуская пустые ячейки.',
            'Joins several texts or the cells of a range into one string with a delimiter between them, optionally skipping empty cells.'),
    example: ex('TEXTJOIN(", ",TRUE,A2:A10)',
      'A2:A10’daki ürün adlarını virgülle ayırarak tek hücrede listeler; boşları atlar',
      'Выводит названия товаров из A2:A10 в одной ячейке через запятую, пропуская пустые',
      'Lists the product names in A2:A10 in one cell separated by commas, skipping blanks'),
    keywords: L(['ayırıcıyla birleştir', 'virgülle birleştir', 'aralığı tek hücreye yaz', 'listeyi birleştir', 'boşları atlayarak birleştir', 'metinleri birleştir', 'hücreleri virgülle ayırarak yaz', 'satırları tek metin yap', 'noktalı virgülle birleştir', 'koşula göre birleştir', 'metinbirleştir', 'birleştir'],
                ['объединить с разделителем', 'через запятую', 'диапазон в одну ячейку', 'склеить список', 'без пустых', 'объединить текст', 'соединить через точку с запятой', 'строки в одну строку', 'сцепить с разделителем', 'объединить по условию', 'объединить', 'собрать в одну ячейку'],
                ['textjoin', 'join with delimiter', 'comma separated list', 'combine range into one cell'])
  },
  {
    name: 'TEXTSPLIT', tr: 'METİNBÖL', ru: 'ТЕКСТРАЗД', category: 'text', minVersion: '365',
    syntax: 'TEXTSPLIT(text, col_delimiter, [row_delimiter], [ignore_empty], [match_mode], [pad_with])',
    args: [
      arg('text', 'metin', 'текст', false,
        'Bölünecek metin', 'Разделяемый текст', 'The text to split'),
      arg('col_delimiter', 'sütun_sınırlayıcı', 'разделитель_столбцов', false,
        'Metni sütunlara bölen ayırıcı (örn. "," veya " "); birden çok ayırıcı için dizi verilebilir', 'Разделитель, разбивающий текст на столбцы (например, "," или " "); можно задать массив разделителей', 'The delimiter that splits the text into columns (e.g. "," or " "); an array allows several delimiters'),
      arg('row_delimiter', 'satır_sınırlayıcı', 'разделитель_строк', true,
        'Metni satırlara bölen ayırıcı (örn. ";" veya DAMGA(10))', 'Разделитель, разбивающий текст на строки (например, ";" или СИМВОЛ(10))', 'The delimiter that splits the text into rows (e.g. ";" or CHAR(10))'),
      arg('ignore_empty', 'boşları_yoksay', 'пропускать_пустые', true,
        'DOĞRU: ardışık ayırıcılar arasındaki boş değerleri atla; YANLIŞ veya boş: boş hücre üret', 'ИСТИНА: пропускать пустые значения между подряд идущими разделителями; ЛОЖЬ или пусто: создавать пустые ячейки', 'TRUE: skip empty values between consecutive delimiters; FALSE or omitted: create empty cells'),
      arg('match_mode', 'eşleştirme_modu', 'режим_сопоставления', true,
        '0 veya boş: harf duyarlı; 1: harf duyarsız', '0 или пусто: с учётом регистра; 1: без учёта регистра', '0 or omitted: case-sensitive; 1: case-insensitive'),
      ARG_PAD_WITH
    ],
    desc: L('Metni belirtilen ayırıcılara göre sütunlara ve/veya satırlara bölerek döker.',
            'Разбивает текст по указанным разделителям на столбцы и/или строки и возвращает результат массивом.',
            'Splits text into columns and/or rows by the specified delimiters and spills the result.'),
    example: ex('TEXTSPLIT(M2," ")',
      'M2’deki "Ayşe Yılmaz" metnini boşluktan bölerek ad ve soyadı ayrı sütunlara yazar',
      'Разбивает текст "Иванова Анна Петровна" из M2 по пробелам на отдельные столбцы',
      'Splits the text in M2 at the spaces so each word goes to its own column'),
    keywords: L(['metni böl', 'ayırıcıya göre parçala', 'virgülle ayır', 'sütunlara böl', 'kelimelere ayır', 'metni parçala', 'boşluktan böl', 'ad soyad ayır', 'metni sütunlara dönüştür'],
                ['разделить текст', 'разбить по разделителю', 'разделить по запятой', 'разбить на столбцы', 'разбить на слова', 'текстразд', 'разделить по пробелу', 'разделить фио', 'текст по столбцам'],
                ['textsplit', 'split text', 'split by delimiter', 'text to columns'])
  },
  {
    name: 'TRANSLATE', tr: 'TRANSLATE', ru: 'TRANSLATE', category: 'text', minVersion: '365', uncertain: ['tr', 'ru'],
    syntax: 'TRANSLATE(text, [source_language], [target_language])',
    args: [
      arg('text', 'metin', 'текст', false,
        'Çevrilecek metin veya metin içeren hücre', 'Переводимый текст или ячейка с текстом', 'The text, or a cell with text, to translate'),
      arg('source_language', 'kaynak_dil', 'исходный_язык', true,
        'Kaynak dil kodu (örn. "tr", "ru", "en"); boşsa otomatik algılanır', 'Код исходного языка (например, "tr", "ru", "en"); если опущен, определяется автоматически', 'The source language code (e.g. "tr", "ru", "en"); auto-detected if omitted'),
      arg('target_language', 'hedef_dil', 'целевой_язык', true,
        'Hedef dil kodu; boşsa sistem dili', 'Код целевого языка; по умолчанию язык системы', 'The target language code; the system language if omitted')
    ],
    desc: L('Metni bir dilden başka bir dile çevirir; çevrimiçi çeviri hizmeti gerektirir.',
            'Переводит текст с одного языка на другой; требует подключения к онлайн-службе перевода.',
            'Translates text from one language to another; requires the online translation service.'),
    example: ex('TRANSLATE(A2,"tr","ru")',
      'A2’deki Türkçe metni Rusçaya çevirir',
      'Переводит турецкий текст из A2 на русский язык',
      'Translates the Turkish text in A2 into Russian'),
    keywords: L(['çevir', 'metni çevir', 'başka dile çevir', 'tercüme et', 'ingilizceye çevir', 'rusçaya çevir', 'dil çevirisi'],
                ['перевести', 'перевод текста', 'на другой язык', 'перевести на английский', 'перевести на турецкий', 'translate', 'языковой перевод'],
                ['translate', 'translate text', 'to another language'])
  },
  {
    name: 'TRIM', tr: 'KIRP', ru: 'СЖПРОБЕЛЫ', category: 'text',
    syntax: 'TRIM(text)',
    args: [
      arg('text', 'metin', 'текст', false,
        'Fazla boşlukları kaldırılacak metin', 'Текст, из которого удаляются лишние пробелы', 'The text to remove extra spaces from')
    ],
    desc: L('Metnin başındaki, sonundaki ve sözcükler arasındaki fazla boşlukları kaldırır; sözcükler arasında tek boşluk bırakır.',
            'Удаляет лишние пробелы в начале, в конце и между словами, оставляя между словами по одному пробелу.',
            'Removes extra spaces at the start, at the end and between words, leaving single spaces between words.'),
    example: ex('TRIM(A2)',
      'A2’deki metnin baş ve sonundaki boşlukları ve çift boşlukları temizler',
      'Убирает из A2 пробелы по краям и двойные пробелы внутри текста',
      'Cleans the leading, trailing and double spaces in the text of A2'),
    keywords: L(['kırp', 'boşlukları temizle', 'fazla boşlukları sil', 'baştaki boşluk', 'sondaki boşluk', 'çift boşluk', 'metni düzelt', 'gereksiz boşluk', 'boşlukları kaldır', 'temizle', 'boşluk sorunu'],
                ['сжпробелы', 'удалить лишние пробелы', 'убрать пробелы', 'пробелы в начале', 'пробелы в конце', 'двойные пробелы', 'очистить пробелы', 'лишние пробелы', 'обрезать пробелы', 'почистить текст', 'проблема с пробелами'],
                ['trim', 'remove extra spaces', 'clean spaces', 'leading trailing spaces'])
  },
  {
    name: 'UNICHAR', tr: 'UNICODEKARAKTERİ', ru: 'ЮНИСИМВ', category: 'text', minVersion: '2013',
    syntax: 'UNICHAR(number)',
    args: [
      arg('number', 'sayı', 'число', false,
        'Unicode kod noktası (örn. 10003 = ✓, 8364 = €)', 'Кодовая точка Unicode (например, 10003 = ✓, 8364 = €)', 'The Unicode code point (e.g. 10003 = ✓, 8364 = €)')
    ],
    desc: L('Verilen Unicode kod noktasına karşılık gelen karakteri verir.',
            'Возвращает символ, соответствующий заданной кодовой точке Unicode.',
            'Returns the character that corresponds to the given Unicode code point.'),
    example: ex('IF(I2="Ödendi",UNICHAR(10003),UNICHAR(10007))',
      'Durum "Ödendi" ise onay işareti (✓), değilse çarpı (✗) gösterir',
      'Показывает галочку (✓), если статус "Ödendi", иначе крестик (✗)',
      'Shows a check mark (✓) when the status is "Ödendi", otherwise a cross (✗)'),
    keywords: L(['unicode karakter', 'koddan sembol', 'onay işareti ekle', 'özel sembol', 'emoji ekle', 'unicode kodu', 'tik işareti', 'sembol ekle'],
                ['символ юникод', 'символ по коду unicode', 'галочка', 'специальный символ', 'вставить эмодзи', 'юнисимв', 'знак по коду', 'вставить символ'],
                ['unichar', 'unicode character', 'check mark', 'symbol from code'])
  },
  {
    name: 'UNICODE', tr: 'UNICODE', ru: 'UNICODE', category: 'text', minVersion: '2013',
    syntax: 'UNICODE(text)',
    args: [
      arg('text', 'metin', 'текст', false,
        'İlk karakterinin Unicode değeri istenen metin', 'Текст, кодовая точка первого символа которого нужна', 'The text whose first character code point you want')
    ],
    desc: L('Metnin ilk karakterinin Unicode kod noktasını verir.',
            'Возвращает кодовую точку Unicode первого символа текста.',
            'Returns the Unicode code point of the first character of a text.'),
    example: ex('UNICODE("ş")',
      '"ş" harfinin Unicode kodunu verir: 351',
      'Возвращает код Unicode буквы "ş": 351',
      'Returns the Unicode code of the letter "ş": 351'),
    keywords: L(['unicode kodu', 'karakterin kod noktası', 'harfin unicode değeri', 'ilk karakterin kodu', 'sembolün kodu'],
                ['код unicode', 'кодовая точка символа', 'юникод буквы', 'код первого символа', 'код знака'],
                ['unicode', 'code point', 'character code'])
  },
  {
    name: 'UPPER', tr: 'BÜYÜKHARF', ru: 'ПРОПИСН', category: 'text',
    syntax: 'UPPER(text)',
    args: [
      arg('text', 'metin', 'текст', false,
        'Büyük harfe çevrilecek metin', 'Текст, преобразуемый в верхний регистр', 'The text to convert to uppercase')
    ],
    desc: L('Metindeki tüm harfleri büyük harfe çevirir.',
            'Преобразует все буквы текста в прописные.',
            'Converts all letters in a text string to uppercase.'),
    example: ex('UPPER(A2)',
      'A2’deki metni tamamen büyük harfe çevirir',
      'Переводит текст из A2 полностью в верхний регистр',
      'Converts the text in A2 entirely to uppercase'),
    keywords: L(['büyük harf', 'büyük harfe çevir', 'hepsini büyüt', 'tamamı büyük', 'büyük harf yap', 'kapital', 'harfleri büyüt'],
                ['прописные', 'в верхний регистр', 'большие буквы', 'сделать заглавными', 'капс', 'все буквы большие', 'прописн'],
                ['upper', 'uppercase', 'to upper case', 'capital letters'])
  },
  {
    name: 'VALUE', tr: 'SAYIYAÇEVİR', ru: 'ЗНАЧЕН', category: 'text',
    syntax: 'VALUE(text)',
    args: [
      arg('text', 'metin', 'текст', false,
        'Sayı, tarih veya saat biçiminde yazılmış metin', 'Текст, записанный в виде числа, даты или времени', 'Text written as a number, date or time')
    ],
    desc: L('Sayı gibi görünen metni gerçek bir sayıya çevirir.',
            'Преобразует текст, выглядящий как число, в настоящее число.',
            'Converts text that looks like a number into an actual number.'),
    example: ex('VALUE(A2)',
      'Metin olarak saklanan "1250" değerini 1250 sayısına çevirir',
      'Преобразует значение "1250", сохранённое как текст, в число 1250',
      'Converts the value "1250" stored as text into the number 1250'),
    keywords: L(['sayıya çevir', 'metni sayı yap', 'metin olarak saklanan sayı', 'sayı değeri', 'yazıyı sayıya dönüştür', 'sayıya dönüştür', 'metin sayı hatası', 'toplanmayan sayılar'],
                ['в число', 'текст в число', 'число сохранено как текст', 'преобразовать в число', 'значен', 'сделать числом', 'числа не суммируются', 'текстовые числа'],
                ['value', 'text to number', 'convert to number'])
  },
  {
    name: 'VALUETOTEXT', tr: 'DEĞERMETNE', ru: 'ЗНАЧЕНИЕВТЕКСТ', category: 'text', minVersion: '2021',
    syntax: 'VALUETOTEXT(value, [format])',
    args: [
      arg('value', 'değer', 'значение', false,
        'Metne çevrilecek değer (sayı, metin, mantıksal, hata vb.)', 'Преобразуемое значение (число, текст, логическое, ошибка и т. д.)', 'The value to convert (number, text, logical, error, etc.)'),
      arg('format', 'biçim', 'формат', true,
        '0 veya boş: kısa biçim (olduğu gibi); 1: katı biçim (metinler tırnak içinde)', '0 или пусто: краткий формат (как есть); 1: строгий формат (текст в кавычках)', '0 or omitted: concise (as displayed); 1: strict (text in quotes)')
    ],
    desc: L('Herhangi bir değeri metne çevirir; katı biçimde metinleri tırnak içine alır ve hataları metin olarak verir.',
            'Преобразует любое значение в текст; в строгом формате заключает текст в кавычки и возвращает ошибки как текст.',
            'Converts any value to text; in strict format it wraps text in quotes and returns errors as text.'),
    example: ex('VALUETOTEXT(A2,1)',
      'A2 metin ise tırnak içinde ("Kalem"), sayı ise olduğu gibi metin olarak verir',
      'Возвращает A2 как текст: в кавычках ("Kalem"), если это текст, и как есть, если число',
      'Returns A2 as text: quoted ("Kalem") when it is text, as is when it is a number'),
    keywords: L(['değeri metne çevir', 'her türü metin yap', 'tırnaklı metin', 'değer metni', 'hata değerini metne çevir', 'mantıksal değeri metne çevir'],
                ['значение в текст', 'любое значение текстом', 'текст в кавычках', 'преобразовать значение в текст', 'ошибка в виде текста', 'логическое в текст'],
                ['value to text', 'any value as text', 'strict text format'])
  }
  ];

  EFS.catalogParts.logicLookupText = logicLookupText;
  return logicLookupText;
});
