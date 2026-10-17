/* Formula Studio — catalog part: Statistical functions (Excel 365, non-compatibility names).
 * Sets EFS.catalogParts.stat. Entry shape: see docs/ARCHITECTURE.md §1. */
(function (root, factory) {
  var EFS = root.EFS || (root.EFS = {});
  var api = factory(EFS, root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (EFS, root) {
  'use strict';
  EFS.catalogParts = EFS.catalogParts || {};

  /* ---- small builders (produce exactly the documented entry shape) ---- */
  function t3(tr, ru, en) { return { tr: tr, ru: ru, en: en }; }
  function arg(name, tr, ru, optional, dTr, dRu, dEn) {
    return { name: name, tr: tr, ru: ru, optional: !!optional, desc: { tr: dTr, ru: dRu, en: dEn } };
  }
  function ex(formula, tr, ru, en) { return { formula: formula, tr: tr, ru: ru, en: en }; }
  function kw(tr, ru, en) { return { tr: tr, ru: ru, en: en }; }

  /* ---- frequently reused argument definitions ---- */
  function numList(whatTr, whatRu, whatEn) {
    return [
      arg('number1', 'sayı1', 'число1', false,
        'Hesaba katılacak ilk sayı, hücre başvurusu veya aralık' + (whatTr ? ' (' + whatTr + ')' : ''),
        'Первое число, ссылка на ячейку или диапазон для расчёта' + (whatRu ? ' (' + whatRu + ')' : ''),
        'The first number, cell reference or range to include' + (whatEn ? ' (' + whatEn + ')' : '')),
      arg('number2', 'sayı2', 'число2', true,
        'İsteğe bağlı ek sayılar veya aralıklar; en fazla 255 bağımsız değişken',
        'Дополнительные числа или диапазоны; до 255 аргументов',
        'Additional numbers or ranges, up to 255 arguments')
    ];
  }
  function valList() {
    return [
      arg('value1', 'değer1', 'значение1', false,
        'Hesaba katılacak ilk değer, hücre başvurusu veya aralık; metin ve mantıksal değerler de sayılır',
        'Первое значение, ссылка или диапазон; текст и логические значения тоже учитываются',
        'The first value, cell reference or range; text and logical values are included'),
      arg('value2', 'değer2', 'значение2', true,
        'İsteğe bağlı ek değerler veya aralıklar; en fazla 255 bağımsız değişken',
        'Дополнительные значения или диапазоны; до 255 аргументов',
        'Additional values or ranges, up to 255 arguments')
    ];
  }
  var ARG_ARRAY = arg('array', 'dizi', 'массив', false,
    'Değerlerin bulunduğu dizi veya hücre aralığı',
    'Массив или диапазон ячеек со значениями',
    'The array or range of cells holding the values');
  var ARG_X = arg('x', 'x', 'x', false,
    'Dağılımın değerlendirileceği değer',
    'Значение, для которого вычисляется распределение',
    'The value at which to evaluate the distribution');
  var ARG_PROB = arg('probability', 'olasılık', 'вероятность', false,
    'Dağılıma karşılık gelen olasılık (0 ile 1 arasında)',
    'Вероятность, соответствующая распределению (от 0 до 1)',
    'A probability associated with the distribution (between 0 and 1)');
  var ARG_CUM = arg('cumulative', 'kümülatif', 'интегральная', false,
    'DOĞRU ise kümülatif dağılım fonksiyonu, YANLIŞ ise olasılık yoğunluk (kütle) fonksiyonu döndürülür',
    'ИСТИНА — интегральная функция распределения, ЛОЖЬ — функция плотности (массы) вероятности',
    'TRUE returns the cumulative distribution function, FALSE the probability density (mass) function');
  var ARG_MEAN = arg('mean', 'ortalama', 'среднее', false,
    'Dağılımın aritmetik ortalaması',
    'Среднее арифметическое распределения',
    'The arithmetic mean of the distribution');
  var ARG_SD = arg('standard_dev', 'standart_sapma', 'стандартное_откл', false,
    'Dağılımın standart sapması (pozitif olmalıdır)',
    'Стандартное отклонение распределения (должно быть положительным)',
    'The standard deviation of the distribution (must be positive)');
  var ARG_DF = arg('deg_freedom', 'serbestlik_derecesi', 'степени_свободы', false,
    'Serbestlik derecesi sayısı (tam sayı, 1 veya daha büyük)',
    'Число степеней свободы (целое, не меньше 1)',
    'The number of degrees of freedom (integer, 1 or greater)');
  var ARG_DF1 = arg('deg_freedom1', 'serbestlik_derecesi1', 'степени_свободы1', false,
    'Pay serbestlik derecesi', 'Числитель степеней свободы', 'The numerator degrees of freedom');
  var ARG_DF2 = arg('deg_freedom2', 'serbestlik_derecesi2', 'степени_свободы2', false,
    'Payda serbestlik derecesi', 'Знаменатель степеней свободы', 'The denominator degrees of freedom');
  var ARG_ALPHA = arg('alpha', 'alfa', 'альфа', false,
    'Dağılımın alfa (şekil) parametresi', 'Параметр альфа (форма) распределения', 'The alpha (shape) parameter of the distribution');
  var ARG_BETA = arg('beta', 'beta', 'бета', false,
    'Dağılımın beta (ölçek) parametresi', 'Параметр бета (масштаб) распределения', 'The beta (scale) parameter of the distribution');
  var ARG_KNOWN_Y = arg("known_y's", 'bilinen_y’ler', 'известные_значения_y', false,
    'Bilinen bağımlı (y) değerlerinin aralığı',
    'Диапазон известных зависимых значений (y)',
    'The range of known dependent (y) values');
  var ARG_KNOWN_X = arg("known_x's", 'bilinen_x’ler', 'известные_значения_x', false,
    'Bilinen bağımsız (x) değerlerinin aralığı',
    'Диапазон известных независимых значений (x)',
    'The range of known independent (x) values');
  var ARG_KNOWN_X_OPT = arg("known_x's", 'bilinen_x’ler', 'известные_значения_x', true,
    'Bilinen bağımsız (x) değerleri; atlanırsa 1, 2, 3… dizisi kullanılır',
    'Известные независимые значения (x); если опущены, используется ряд 1, 2, 3…',
    'Known independent (x) values; defaults to the series 1, 2, 3… when omitted');
  var ARG_NEW_X = arg("new_x's", 'yeni_x’ler', 'новые_значения_x', true,
    'Tahmin üretilecek yeni x değerleri; atlanırsa bilinen x’ler kullanılır',
    'Новые значения x, для которых нужен прогноз; если опущены, берутся известные x',
    'New x values to predict for; defaults to the known x values');
  var ARG_CONST = arg('const', 'sabit', 'конст', true,
    'DOĞRU veya atlanırsa sabit b normal hesaplanır; YANLIŞ ise b sıfıra (üstel modelde 1’e) zorlanır',
    'ИСТИНА или опущено — константа b вычисляется обычно; ЛОЖЬ — b принудительно равна 0 (в экспоненциальной модели 1)',
    'TRUE or omitted computes the constant b normally; FALSE forces b to 0 (1 for the exponential model)');
  var ARG_STATS = arg('stats', 'istatistik', 'статистика', true,
    'DOĞRU ise ek regresyon istatistikleri de döndürülür; YANLIŞ veya atlanırsa yalnızca katsayılar',
    'ИСТИНА — возвращаются дополнительные статистики регрессии; ЛОЖЬ или опущено — только коэффициенты',
    'TRUE also returns additional regression statistics; FALSE or omitted returns only the coefficients');
  var ARG_RANGE = arg('range', 'aralık', 'диапазон', false,
    'Koşulun uygulanacağı hücre aralığı',
    'Диапазон ячеек, к которому применяется условие',
    'The range the criteria is applied to');
  var ARG_CRIT = arg('criteria', 'ölçüt', 'критерий', false,
    'Sayı, ifade, hücre başvurusu veya metin biçimindeki koşul; örn. 32, ">32", B4, "elma", "*ma*"',
    'Условие в виде числа, выражения, ссылки или текста, например 32, ">32", B4, "яблоко", "*ко*"',
    'The condition as a number, expression, cell reference or text, e.g. 32, ">32", B4, "apple", "*le*"');
  var ARG_TAILS = arg('tails', 'kuyruklar', 'хвосты', false,
    '1 ise tek kuyruklu, 2 ise çift kuyruklu dağılım',
    '1 — одностороннее распределение, 2 — двустороннее',
    '1 for a one-tailed distribution, 2 for two-tailed');

  var stat = [];

  /* =================== A — C =================== */
  stat.push({
    name: 'AVEDEV', tr: 'ORTSAP', ru: 'СРОТКЛ', category: 'stat',
    syntax: 'AVEDEV(number1, [number2], ...)',
    args: numList(),
    desc: t3('Veri noktalarının ortalamadan mutlak sapmalarının ortalamasını verir.',
             'Возвращает среднее абсолютных отклонений точек данных от их среднего.',
             'Returns the average of the absolute deviations of data points from their mean.'),
    example: ex('AVEDEV(E2:E200)', 'E2:E200 değerlerinin ortalamadan ortalama mutlak sapmasını verir', 'Среднее абсолютное отклонение значений E2:E200 от среднего', 'Mean absolute deviation of E2:E200 from its average'),
    keywords: kw(['ortalama mutlak sapma', 'ortalamadan sapma', 'mutlak sapma ortalaması', 'dağılım ölçüsü'],
                 ['среднее абсолютное отклонение', 'отклонение от среднего', 'среднее отклонение', 'разброс данных'],
                 ['mean absolute deviation', 'average deviation', 'spread'])
  });
  stat.push({
    name: 'AVERAGE', tr: 'ORTALAMA', ru: 'СРЗНАЧ', category: 'stat',
    syntax: 'AVERAGE(number1, [number2], ...)',
    args: numList(),
    desc: t3('Bağımsız değişkenlerin aritmetik ortalamasını verir; metin ve boş hücreler yok sayılır.',
             'Возвращает среднее арифметическое аргументов; текст и пустые ячейки игнорируются.',
             'Returns the arithmetic mean of its arguments; text and empty cells are ignored.'),
    example: ex('AVERAGE(E2:E200)', 'E2:E200 aralığındaki tutarların ortalamasını alır', 'Среднее значение сумм в диапазоне E2:E200', 'Averages the amounts in E2:E200'),
    keywords: kw(['ortalama', 'ortalamasını al', 'aritmetik ortalama', 'ortalama hesapla', 'ortalama değer', 'sütunun ortalaması', 'ortalama fiyat', 'ortalama tutar'],
                 ['среднее', 'среднее значение', 'среднее арифметическое', 'посчитать среднее', 'средняя сумма', 'средняя цена', 'среднее по столбцу', 'усреднить'],
                 ['average', 'mean', 'arithmetic mean', 'average value', 'average of column'])
  });
  stat.push({
    name: 'AVERAGEA', tr: 'ORTALAMAA', ru: 'СРЗНАЧА', category: 'stat',
    syntax: 'AVERAGEA(value1, [value2], ...)',
    args: valList(),
    desc: t3('Sayılar, metin ve mantıksal değerler dahil bağımsız değişkenlerin ortalamasını verir; metin 0, DOĞRU 1 sayılır.',
             'Возвращает среднее аргументов с учётом текста и логических значений: текст считается 0, ИСТИНА — 1.',
             'Returns the average of its arguments including text and logicals; text counts as 0, TRUE as 1.'),
    example: ex('AVERAGEA(C2:C200)', 'C2:C200 ortalamasını alır, metin hücrelerini 0 kabul eder', 'Среднее C2:C200, текстовые ячейки считаются нулями', 'Averages C2:C200, treating text cells as 0'),
    keywords: kw(['metin dahil ortalama', 'mantıksal dahil ortalama', 'ortalama metin sıfır', 'tüm değerlerin ortalaması'],
                 ['среднее с текстом', 'среднее с логическими', 'среднее текст как ноль', 'среднее всех значений'],
                 ['average including text', 'average with logicals', 'averagea'])
  });
  stat.push({
    name: 'AVERAGEIF', tr: 'EĞERORTALAMA', ru: 'СРЗНАЧЕСЛИ', category: 'stat',
    syntax: 'AVERAGEIF(range, criteria, [average_range])',
    args: [ARG_RANGE, ARG_CRIT,
      arg('average_range', 'ortalama_aralığı', 'диапазон_усреднения', true,
        'Ortalaması alınacak gerçek hücreler; atlanırsa aralık kullanılır',
        'Ячейки, которые фактически усредняются; если опущено, используется диапазон',
        'The cells to actually average; defaults to range when omitted')],
    desc: t3('Belirtilen tek bir koşulu karşılayan hücrelerin aritmetik ortalamasını verir.',
             'Возвращает среднее арифметическое ячеек, удовлетворяющих одному условию.',
             'Returns the arithmetic mean of the cells that meet a single condition.'),
    example: ex('AVERAGEIF(B2:B200,"Gıda",E2:E200)', 'Kategorisi "Gıda" olan satırların tutar ortalamasını alır', 'Среднее по сумме для строк с категорией "Gıda"', 'Averages the amounts of rows whose category is "Gıda"'),
    keywords: kw(['koşullu ortalama', 'şarta göre ortalama', 'eğer ortalama', 'kriterli ortalama', 'belirli kategorinin ortalaması', 'filtreli ortalama'],
                 ['среднее по условию', 'среднее если', 'условное среднее', 'среднее с критерием', 'среднее по категории', 'среднее по фильтру'],
                 ['conditional average', 'average if', 'average by criteria'])
  });
  stat.push({
    name: 'AVERAGEIFS', tr: 'ÇOKEĞERORTALAMA', ru: 'СРЗНАЧЕСЛИМН', category: 'stat',
    syntax: 'AVERAGEIFS(average_range, criteria_range1, criteria1, [criteria_range2, criteria2], ...)',
    args: [
      arg('average_range', 'ortalama_aralığı', 'диапазон_усреднения', false, 'Ortalaması alınacak hücreler', 'Ячейки, которые нужно усреднить', 'The cells to average'),
      arg('criteria_range1', 'ölçüt_aralığı1', 'диапазон_условия1', false, 'İlk koşulun uygulanacağı aralık', 'Диапазон для первого условия', 'The range for the first condition'),
      arg('criteria1', 'ölçüt1', 'условие1', false, 'İlk koşul (sayı, ifade, başvuru veya metin)', 'Первое условие (число, выражение, ссылка или текст)', 'The first condition (number, expression, reference or text)'),
      arg('criteria_range2', 'ölçüt_aralığı2', 'диапазон_условия2', true, 'Sonraki koşul aralıkları; en fazla 127 çift', 'Следующие диапазоны условий; до 127 пар', 'Further criteria ranges, up to 127 pairs'),
      arg('criteria2', 'ölçüt2', 'условие2', true, 'Sonraki koşullar', 'Следующие условия', 'Further conditions')
    ],
    desc: t3('Birden çok koşulun tümünü karşılayan hücrelerin aritmetik ortalamasını verir.',
             'Возвращает среднее арифметическое ячеек, удовлетворяющих всем заданным условиям.',
             'Returns the arithmetic mean of the cells that meet all of several conditions.'),
    example: ex('AVERAGEIFS(E2:E200,B2:B200,"Gıda",H2:H200,"Ankara")', 'Kategori "Gıda" ve şehir "Ankara" olan satırların tutar ortalaması', 'Среднее суммы для строк с категорией "Gıda" и городом "Ankara"', 'Average amount for rows with category "Gıda" in city "Ankara"'),
    keywords: kw(['çok koşullu ortalama', 'birden fazla şarta göre ortalama', 'iki koşullu ortalama', 'çoklu kriter ortalama', 'eğer ve ortalama'],
                 ['среднее по нескольким условиям', 'среднее если несколько', 'среднее по двум условиям', 'среднее с несколькими критериями', 'среднее и условия'],
                 ['average with multiple criteria', 'average ifs', 'multi-condition average'])
  });
  stat.push({
    name: 'BETA.DIST', tr: 'BETA.DAĞ', ru: 'БЕТА.РАСП', category: 'stat',
    syntax: 'BETA.DIST(x, alpha, beta, cumulative, [A], [B])',
    args: [ARG_X, ARG_ALPHA, ARG_BETA, ARG_CUM,
      arg('A', 'A', 'A', true, 'x aralığının alt sınırı; varsayılan 0', 'Нижняя граница интервала x; по умолчанию 0', 'Lower bound of the x interval; default 0'),
      arg('B', 'B', 'B', true, 'x aralığının üst sınırı; varsayılan 1', 'Верхняя граница интервала x; по умолчанию 1', 'Upper bound of the x interval; default 1')],
    desc: t3('Beta dağılımının olasılık yoğunluk veya kümülatif dağılım değerini verir.',
             'Возвращает плотность или интегральную функцию бета-распределения.',
             'Returns the beta probability density or cumulative distribution value.'),
    example: ex('BETA.DIST(0.4,8,10,TRUE)', 'Alfa 8, beta 10 için x=0,4 noktasındaki kümülatif beta olasılığı', 'Интегральная бета-вероятность в точке 0,4 при альфа 8 и бета 10', 'Cumulative beta probability at 0.4 with alpha 8 and beta 10'),
    keywords: kw(['beta dağılımı', 'beta olasılığı', 'kümülatif beta', 'beta yoğunluk'], ['бета-распределение', 'бета вероятность', 'интегральное бета', 'плотность бета'], ['beta distribution', 'beta probability', 'cumulative beta']),
    minVersion: '2010'
  });
  stat.push({
    name: 'BETA.INV', tr: 'BETA.TERS', ru: 'БЕТА.ОБР', category: 'stat',
    syntax: 'BETA.INV(probability, alpha, beta, [A], [B])',
    args: [ARG_PROB, ARG_ALPHA, ARG_BETA,
      arg('A', 'A', 'A', true, 'x aralığının alt sınırı; varsayılan 0', 'Нижняя граница интервала x; по умолчанию 0', 'Lower bound of the x interval; default 0'),
      arg('B', 'B', 'B', true, 'x aralığının üst sınırı; varsayılan 1', 'Верхняя граница интервала x; по умолчанию 1', 'Upper bound of the x interval; default 1')],
    desc: t3('Beta kümülatif dağılım fonksiyonunun tersini verir (verilen olasılığa karşılık gelen x).',
             'Возвращает обратную интегральную функцию бета-распределения (x для заданной вероятности).',
             'Returns the inverse of the beta cumulative distribution (the x for a given probability).'),
    example: ex('BETA.INV(0.685,8,10)', 'Kümülatif olasılığı 0,685 olan beta değeri', 'Значение бета-распределения с интегральной вероятностью 0,685', 'Beta value whose cumulative probability is 0.685'),
    keywords: kw(['ters beta', 'beta tersi', 'beta kantil'], ['обратное бета', 'бета обр', 'квантиль бета'], ['inverse beta', 'beta quantile', 'inverse beta distribution']),
    minVersion: '2010'
  });
  stat.push({
    name: 'BINOM.DIST', tr: 'BİNOM.DAĞ', ru: 'БИНОМ.РАСП', category: 'stat',
    syntax: 'BINOM.DIST(number_s, trials, probability_s, cumulative)',
    args: [
      arg('number_s', 'başarı_sayısı', 'число_успехов', false, 'Denemelerdeki başarı sayısı', 'Количество успешных испытаний', 'The number of successes in the trials'),
      arg('trials', 'denemeler', 'испытания', false, 'Bağımsız deneme sayısı', 'Число независимых испытаний', 'The number of independent trials'),
      arg('probability_s', 'başarı_olasılığı', 'вероятность_успеха', false, 'Her denemede başarı olasılığı', 'Вероятность успеха в каждом испытании', 'The probability of success on each trial'),
      ARG_CUM],
    desc: t3('Binom dağılımında tek terimli olasılığı veya kümülatif olasılığı verir.',
             'Возвращает отдельное значение или интегральную вероятность биномиального распределения.',
             'Returns the individual term or cumulative binomial distribution probability.'),
    example: ex('BINOM.DIST(6,10,0.5,FALSE)', '10 yazı-tura atışında tam 6 tura gelme olasılığı', 'Вероятность ровно 6 орлов при 10 бросках монеты', 'Probability of exactly 6 heads in 10 coin flips'),
    keywords: kw(['binom dağılımı', 'binom olasılığı', 'başarı sayısı olasılığı', 'deneme olasılığı'], ['биномиальное распределение', 'биномиальная вероятность', 'вероятность успехов', 'испытания бернулли'], ['binomial distribution', 'binomial probability', 'probability of successes']),
    minVersion: '2010'
  });
  stat.push({
    name: 'BINOM.DIST.RANGE', tr: 'BİNOM.DAĞ.ARALIK', ru: 'БИНОМ.РАСП.ДИАП', category: 'stat',
    syntax: 'BINOM.DIST.RANGE(trials, probability_s, number_s, [number_s2])',
    args: [
      arg('trials', 'denemeler', 'испытания', false, 'Bağımsız deneme sayısı', 'Число независимых испытаний', 'The number of independent trials'),
      arg('probability_s', 'başarı_olasılığı', 'вероятность_успеха', false, 'Her denemede başarı olasılığı', 'Вероятность успеха в каждом испытании', 'The probability of success on each trial'),
      arg('number_s', 'başarı_sayısı', 'число_успехов', false, 'Başarı sayısı (veya aralığın alt sınırı)', 'Число успехов (или нижняя граница диапазона)', 'The number of successes (or lower bound of the range)'),
      arg('number_s2', 'başarı_sayısı2', 'число_успехов2', true, 'Başarı sayısı aralığının üst sınırı', 'Верхняя граница диапазона числа успехов', 'Upper bound of the range of successes')],
    desc: t3('Binom dağılımına göre başarı sayısının belirli bir aralıkta olma olasılığını verir.',
             'Возвращает вероятность того, что число успехов попадёт в заданный диапазон по биномиальному распределению.',
             'Returns the probability that the number of successes falls within a range under the binomial distribution.'),
    example: ex('BINOM.DIST.RANGE(60,0.75,45,50)', '60 denemede 45 ile 50 arası başarı olasılığı', 'Вероятность от 45 до 50 успехов в 60 испытаниях', 'Probability of 45 to 50 successes in 60 trials'),
    keywords: kw(['binom aralık olasılığı', 'başarı aralığı olasılığı', 'binom arası'], ['биномиальная вероятность диапазона', 'вероятность числа успехов в диапазоне', 'бином диапазон'], ['binomial range probability', 'successes between', 'binomial between']),
    minVersion: '2013'
  });
  stat.push({
    name: 'BINOM.INV', tr: 'BİNOM.TERS', ru: 'БИНОМ.ОБР', category: 'stat',
    syntax: 'BINOM.INV(trials, probability_s, alpha)',
    args: [
      arg('trials', 'denemeler', 'испытания', false, 'Bernoulli deneme sayısı', 'Число испытаний Бернулли', 'The number of Bernoulli trials'),
      arg('probability_s', 'başarı_olasılığı', 'вероятность_успеха', false, 'Her denemede başarı olasılığı', 'Вероятность успеха в каждом испытании', 'The probability of success on each trial'),
      arg('alpha', 'alfa', 'альфа', false, 'Ölçüt değeri (hedef kümülatif olasılık)', 'Критерий (целевая интегральная вероятность)', 'The criterion value (target cumulative probability)')],
    desc: t3('Kümülatif binom dağılımının ölçüt değerine eşit veya ondan büyük olduğu en küçük değeri verir.',
             'Возвращает наименьшее значение, при котором интегральное биномиальное распределение не меньше критерия.',
             'Returns the smallest value for which the cumulative binomial distribution is at least the criterion.'),
    example: ex('BINOM.INV(6,0.5,0.75)', '6 denemede kümülatif olasılığın 0,75’e ulaştığı en küçük başarı sayısı', 'Наименьшее число успехов в 6 испытаниях с интегральной вероятностью не ниже 0,75', 'Smallest number of successes in 6 trials reaching cumulative probability 0.75'),
    keywords: kw(['ters binom', 'binom kritik değer', 'binom tersi'], ['обратное биномиальное', 'критическое значение бином', 'бином обр'], ['inverse binomial', 'binomial critical value', 'smallest successes for probability']),
    minVersion: '2010'
  });
  stat.push({
    name: 'CHISQ.DIST', tr: 'KİKARE.DAĞ', ru: 'ХИ2.РАСП', category: 'stat',
    syntax: 'CHISQ.DIST(x, deg_freedom, cumulative)',
    args: [ARG_X, ARG_DF, ARG_CUM],
    desc: t3('Ki-kare dağılımının sol kuyruk olasılığını (kümülatif) veya yoğunluğunu verir.',
             'Возвращает левостороннюю (интегральную) вероятность или плотность распределения хи-квадрат.',
             'Returns the left-tailed (cumulative) probability or density of the chi-squared distribution.'),
    example: ex('CHISQ.DIST(0.5,1,TRUE)', '1 serbestlik derecesinde x=0,5 için kümülatif ki-kare olasılığı', 'Интегральная вероятность хи-квадрат при x=0,5 и 1 степени свободы', 'Cumulative chi-squared probability at 0.5 with 1 degree of freedom'),
    keywords: kw(['ki kare dağılımı', 'ki-kare olasılığı', 'kikare sol kuyruk'], ['распределение хи-квадрат', 'хи квадрат вероятность', 'хи2 левосторонняя'], ['chi-squared distribution', 'chi square left tail', 'chi-squared probability']),
    minVersion: '2010'
  });
  stat.push({
    name: 'CHISQ.DIST.RT', tr: 'KİKARE.DAĞ.SAĞK', ru: 'ХИ2.РАСП.ПХ', category: 'stat',
    syntax: 'CHISQ.DIST.RT(x, deg_freedom)',
    args: [ARG_X, ARG_DF],
    desc: t3('Ki-kare dağılımının sağ kuyruk olasılığını verir.',
             'Возвращает правостороннюю вероятность распределения хи-квадрат.',
             'Returns the right-tailed probability of the chi-squared distribution.'),
    example: ex('CHISQ.DIST.RT(18.307,10)', '10 serbestlik derecesinde 18,307 için sağ kuyruk olasılığı (≈0,05)', 'Правосторонняя вероятность для 18,307 при 10 степенях свободы (≈0,05)', 'Right-tailed probability of 18.307 with 10 degrees of freedom (≈0.05)'),
    keywords: kw(['ki kare sağ kuyruk', 'ki-kare p değeri', 'kikare sağ'], ['хи-квадрат правосторонняя', 'p-значение хи квадрат', 'хи2 правый хвост'], ['chi-squared right tail', 'chi square p-value', 'chi-squared right-tailed probability']),
    minVersion: '2010'
  });
  stat.push({
    name: 'CHISQ.INV', tr: 'KİKARE.TERS', ru: 'ХИ2.ОБР', category: 'stat',
    syntax: 'CHISQ.INV(probability, deg_freedom)',
    args: [ARG_PROB, ARG_DF],
    desc: t3('Ki-kare dağılımının sol kuyruk olasılığının tersini verir.',
             'Возвращает обратное значение левосторонней вероятности распределения хи-квадрат.',
             'Returns the inverse of the left-tailed probability of the chi-squared distribution.'),
    example: ex('CHISQ.INV(0.93,1)', 'Sol kuyruk olasılığı 0,93 olan ki-kare değeri (1 sd)', 'Значение хи-квадрат с левосторонней вероятностью 0,93 (1 ст. св.)', 'Chi-squared value with left-tailed probability 0.93 (1 df)'),
    keywords: kw(['ters ki kare', 'ki-kare kantil', 'kikare tersi sol'], ['обратное хи-квадрат', 'квантиль хи квадрат', 'хи2 обр'], ['inverse chi-squared', 'chi square quantile', 'chi-squared inverse left tail']),
    minVersion: '2010'
  });
  stat.push({
    name: 'CHISQ.INV.RT', tr: 'KİKARE.TERS.SAĞK', ru: 'ХИ2.ОБР.ПХ', category: 'stat',
    syntax: 'CHISQ.INV.RT(probability, deg_freedom)',
    args: [ARG_PROB, ARG_DF],
    desc: t3('Ki-kare dağılımının sağ kuyruk olasılığının tersini (kritik değeri) verir.',
             'Возвращает обратное значение правосторонней вероятности хи-квадрат (критическое значение).',
             'Returns the inverse of the right-tailed chi-squared probability (the critical value).'),
    example: ex('CHISQ.INV.RT(0.05,10)', '%5 anlamlılık, 10 sd için kritik ki-kare değeri (≈18,307)', 'Критическое значение хи-квадрат при 5% и 10 ст. св. (≈18,307)', 'Critical chi-squared value at 5% with 10 df (≈18.307)'),
    keywords: kw(['ki kare kritik değer', 'ki-kare tablo değeri', 'kikare ters sağ'], ['критическое значение хи-квадрат', 'табличное хи квадрат', 'хи2 обр пх'], ['chi-squared critical value', 'inverse right tail chi square', 'chi-squared critical']),
    minVersion: '2010'
  });
  stat.push({
    name: 'CHISQ.TEST', tr: 'KİKARE.TEST', ru: 'ХИ2.ТЕСТ', category: 'stat',
    syntax: 'CHISQ.TEST(actual_range, expected_range)',
    args: [
      arg('actual_range', 'gerçek_aralık', 'фактический_интервал', false, 'Gözlenen değerleri içeren aralık', 'Диапазон наблюдаемых значений', 'The range of observed values'),
      arg('expected_range', 'beklenen_aralık', 'ожидаемый_интервал', false, 'Beklenen değerleri içeren aralık (satır ve sütun toplamlarının oranı)', 'Диапазон ожидаемых значений (отношение итогов строк и столбцов)', 'The range of expected values (ratio of row and column totals)')],
    desc: t3('Ki-kare bağımsızlık testinin olasılık değerini (p-değeri) verir.',
             'Возвращает вероятность (p-значение) критерия независимости хи-квадрат.',
             'Returns the probability (p-value) of the chi-squared test for independence.'),
    example: ex('CHISQ.TEST(B2:C4,E2:F4)', 'Gözlenen B2:C4 ile beklenen E2:F4 arasındaki ki-kare testi p-değeri', 'p-значение теста хи-квадрат между наблюдаемыми B2:C4 и ожидаемыми E2:F4', 'p-value of the chi-squared test between observed B2:C4 and expected E2:F4'),
    keywords: kw(['ki kare testi', 'bağımsızlık testi', 'ki-kare p değeri', 'çapraz tablo testi'], ['тест хи-квадрат', 'критерий хи-квадрат', 'критерий независимости', 'p-значение хи2'], ['chi-squared test', 'test of independence', 'chi-squared p-value']),
    minVersion: '2010'
  });
  stat.push({
    name: 'CONFIDENCE.NORM', tr: 'GÜVENİLİRLİK.NORM', ru: 'ДОВЕРИТ.НОРМ', category: 'stat',
    syntax: 'CONFIDENCE.NORM(alpha, standard_dev, size)',
    args: [
      arg('alpha', 'alfa', 'альфа', false, 'Anlamlılık düzeyi (güven düzeyi = 1 − alfa); örn. 0,05', 'Уровень значимости (доверительный уровень = 1 − альфа), например 0,05', 'Significance level (confidence level = 1 − alpha), e.g. 0.05'),
      ARG_SD,
      arg('size', 'boyut', 'размер', false, 'Örneklem büyüklüğü', 'Размер выборки', 'The sample size')],
    desc: t3('Normal dağılım kullanarak ortalama için güven aralığının yarı genişliğini verir.',
             'Возвращает половину ширины доверительного интервала для среднего по нормальному распределению.',
             'Returns the half-width of the confidence interval for a mean using the normal distribution.'),
    example: ex('CONFIDENCE.NORM(0.05,2.5,50)', 'Standart sapma 2,5 ve 50 gözlem için %95 güven aralığı payı', 'Полуширина 95% доверительного интервала при σ=2,5 и 50 наблюдениях', 'Margin of the 95% confidence interval with σ 2.5 and 50 observations'),
    keywords: kw(['güven aralığı', 'güven aralığı normal', 'hata payı', 'güven düzeyi'], ['доверительный интервал', 'доверительный интервал нормальное', 'погрешность выборки', 'уровень доверия'], ['confidence interval', 'margin of error normal', 'confidence level normal']),
    minVersion: '2010'
  });
  stat.push({
    name: 'CONFIDENCE.T', tr: 'GÜVENİLİRLİK.T', ru: 'ДОВЕРИТ.СТЬЮДЕНТ', category: 'stat',
    syntax: 'CONFIDENCE.T(alpha, standard_dev, size)',
    args: [
      arg('alpha', 'alfa', 'альфа', false, 'Anlamlılık düzeyi (güven düzeyi = 1 − alfa)', 'Уровень значимости (доверительный уровень = 1 − альфа)', 'Significance level (confidence level = 1 − alpha)'),
      ARG_SD,
      arg('size', 'boyut', 'размер', false, 'Örneklem büyüklüğü', 'Размер выборки', 'The sample size')],
    desc: t3('Student t dağılımını kullanarak ortalama için güven aralığının yarı genişliğini verir.',
             'Возвращает половину ширины доверительного интервала для среднего по t-распределению Стьюдента.',
             'Returns the half-width of the confidence interval for a mean using the Student t distribution.'),
    example: ex('CONFIDENCE.T(0.05,1,50)', 'Küçük örneklemler için t dağılımıyla %95 güven aralığı payı', 'Полуширина 95% доверительного интервала по t-распределению', 'Margin of the 95% confidence interval using the t distribution'),
    keywords: kw(['güven aralığı t', 'student güven aralığı', 'küçük örneklem güven aralığı'], ['доверительный интервал стьюдент', 'доверительный интервал t', 'интервал малой выборки'], ['confidence interval t', 'student confidence interval', 'margin of error t']),
    minVersion: '2010'
  });
  stat.push({
    name: 'CORREL', tr: 'KORELASYON', ru: 'КОРРЕЛ', category: 'stat',
    syntax: 'CORREL(array1, array2)',
    args: [
      arg('array1', 'dizi1', 'массив1', false, 'İlk değer kümesi', 'Первый набор значений', 'The first set of values'),
      arg('array2', 'dizi2', 'массив2', false, 'İkinci değer kümesi (aynı boyutta)', 'Второй набор значений (того же размера)', 'The second set of values (same size)')],
    desc: t3('İki veri kümesi arasındaki Pearson korelasyon katsayısını (−1 ile 1 arası) verir.',
             'Возвращает коэффициент корреляции Пирсона между двумя наборами данных (от −1 до 1).',
             'Returns the Pearson correlation coefficient between two data sets (from −1 to 1).'),
    example: ex('CORREL(C2:C200,E2:E200)', 'Adet ile tutar arasındaki korelasyonu hesaplar', 'Корреляция между количеством и суммой', 'Correlation between quantity and amount'),
    keywords: kw(['korelasyon', 'korelasyon katsayısı', 'ilişki katsayısı', 'iki sütun arasındaki ilişki', 'bağıntı'], ['корреляция', 'коэффициент корреляции', 'связь между столбцами', 'зависимость двух рядов', 'коррелировать'], ['correlation', 'correlation coefficient', 'relationship between columns'])
  });
  stat.push({
    name: 'COUNT', tr: 'BAĞ_DEĞ_SAY', ru: 'СЧЁТ', category: 'stat',
    syntax: 'COUNT(value1, [value2], ...)',
    args: [
      arg('value1', 'değer1', 'значение1', false, 'Sayıların sayılacağı ilk değer veya aralık', 'Первое значение или диапазон, в котором считаются числа', 'The first value or range in which to count numbers'),
      arg('value2', 'değer2', 'значение2', true, 'İsteğe bağlı ek değerler veya aralıklar; en fazla 255', 'Дополнительные значения или диапазоны; до 255', 'Additional values or ranges, up to 255')],
    desc: t3('Aralıktaki sayı içeren hücrelerin adedini verir; metin ve boş hücreler sayılmaz.',
             'Возвращает количество ячеек, содержащих числа; текст и пустые ячейки не учитываются.',
             'Returns how many cells contain numbers; text and empty cells are not counted.'),
    example: ex('COUNT(E2:E200)', 'E2:E200 içinde sayı olan hücreleri sayar', 'Считает ячейки с числами в E2:E200', 'Counts the numeric cells in E2:E200'),
    keywords: kw(['say', 'sayıları say', 'kaç tane sayı var', 'sayı olan hücreleri say', 'adet', 'sayısal hücre sayısı', 'kaç satır', 'hücre sayısı'],
                 ['количество чисел', 'посчитать числа', 'сколько чисел', 'счёт', 'число ячеек с числами', 'количество числовых ячеек', 'сколько строк', 'подсчёт'],
                 ['count numbers', 'count numeric cells', 'how many numbers', 'count'])
  });
  stat.push({
    name: 'COUNTA', tr: 'BAĞ_DEĞ_DOLU_SAY', ru: 'СЧЁТЗ', category: 'stat',
    syntax: 'COUNTA(value1, [value2], ...)',
    args: [
      arg('value1', 'değer1', 'значение1', false, 'Dolu hücrelerin sayılacağı ilk değer veya aralık', 'Первое значение или диапазон для подсчёта непустых ячеек', 'The first value or range in which to count non-empty cells'),
      arg('value2', 'değer2', 'значение2', true, 'İsteğe bağlı ek değerler veya aralıklar; en fazla 255', 'Дополнительные значения или диапазоны; до 255', 'Additional values or ranges, up to 255')],
    desc: t3('Aralıktaki boş olmayan hücrelerin adedini verir (sayı, metin, mantıksal, hata dahil).',
             'Возвращает количество непустых ячеек в диапазоне (числа, текст, логические значения, ошибки).',
             'Returns how many cells in a range are not empty (numbers, text, logicals, errors).'),
    example: ex('COUNTA(A2:A200)', 'A2:A200 içindeki dolu hücreleri sayar', 'Считает непустые ячейки в A2:A200', 'Counts the non-empty cells in A2:A200'),
    keywords: kw(['dolu hücreleri say', 'boş olmayan hücre sayısı', 'kaç kayıt var', 'dolu satır sayısı', 'kaç tane dolu', 'kayıt sayısı', 'metin dahil say', 'doluları say'],
                 ['непустые ячейки', 'количество непустых', 'сколько заполнено', 'посчитать заполненные', 'число записей', 'количество строк с данными', 'счётз', 'сколько записей'],
                 ['count non-empty', 'count filled cells', 'number of records', 'count all values'])
  });
  stat.push({
    name: 'COUNTBLANK', tr: 'BOŞLUKSAY', ru: 'СЧИТАТЬПУСТОТЫ', category: 'stat',
    syntax: 'COUNTBLANK(range)',
    args: [arg('range', 'aralık', 'диапазон', false, 'Boş hücrelerin sayılacağı aralık', 'Диапазон, в котором считаются пустые ячейки', 'The range in which to count empty cells')],
    desc: t3('Aralıktaki boş hücrelerin adedini verir; boş metin ("") döndüren formüller de boş sayılır.',
             'Возвращает количество пустых ячеек в диапазоне; формулы, возвращающие "", тоже считаются пустыми.',
             'Returns how many cells in a range are empty; formulas returning "" count as empty too.'),
    example: ex('COUNTBLANK(I2:I200)', 'I2:I200 içindeki boş hücreleri sayar', 'Считает пустые ячейки в I2:I200', 'Counts the blank cells in I2:I200'),
    keywords: kw(['boş hücreleri say', 'boş hücre sayısı', 'kaç tane boş', 'boşları say', 'eksik veri sayısı', 'doldurulmamış hücreler'],
                 ['пустые ячейки', 'количество пустых', 'сколько пустых', 'посчитать пустые', 'незаполненные ячейки', 'пропуски в данных'],
                 ['count blank', 'count empty cells', 'missing values count'])
  });
  stat.push({
    name: 'COUNTIF', tr: 'EĞERSAY', ru: 'СЧЁТЕСЛИ', category: 'stat',
    syntax: 'COUNTIF(range, criteria)',
    args: [ARG_RANGE, ARG_CRIT],
    desc: t3('Aralıkta belirtilen tek bir koşulu karşılayan hücrelerin adedini verir.',
             'Возвращает количество ячеек диапазона, удовлетворяющих одному условию.',
             'Returns how many cells in a range meet a single condition.'),
    example: ex('COUNTIF(B2:B200,"Gıda")', 'Kategorisi "Gıda" olan satırları sayar', 'Считает строки с категорией "Gıda"', 'Counts rows whose category is "Gıda"'),
    keywords: kw(['koşullu say', 'şarta göre say', 'eğer say', 'kaç tane var', 'belirli değeri say', 'kriterle say', 'tekrar sayısı', 'kaç kez geçiyor'],
                 ['счёт по условию', 'посчитать если', 'сколько раз встречается', 'количество по условию', 'сколько ячеек с значением', 'подсчёт по критерию', 'число совпадений', 'посчитать значения равные'],
                 ['count if', 'conditional count', 'count occurrences', 'count by criteria'])
  });
  stat.push({
    name: 'COUNTIFS', tr: 'ÇOKEĞERSAY', ru: 'СЧЁТЕСЛИМН', category: 'stat',
    syntax: 'COUNTIFS(criteria_range1, criteria1, [criteria_range2, criteria2], ...)',
    args: [
      arg('criteria_range1', 'ölçüt_aralığı1', 'диапазон_условия1', false, 'İlk koşulun uygulanacağı aralık', 'Диапазон для первого условия', 'The range for the first condition'),
      arg('criteria1', 'ölçüt1', 'условие1', false, 'İlk koşul (sayı, ifade, başvuru veya metin)', 'Первое условие (число, выражение, ссылка или текст)', 'The first condition (number, expression, reference or text)'),
      arg('criteria_range2', 'ölçüt_aralığı2', 'диапазон_условия2', true, 'Sonraki koşul aralıkları; en fazla 127 çift', 'Следующие диапазоны условий; до 127 пар', 'Further criteria ranges, up to 127 pairs'),
      arg('criteria2', 'ölçüt2', 'условие2', true, 'Sonraki koşullar', 'Следующие условия', 'Further conditions')],
    desc: t3('Birden çok koşulun tümünü aynı anda karşılayan satırların adedini verir.',
             'Возвращает количество строк, одновременно удовлетворяющих всем заданным условиям.',
             'Returns how many rows meet all of several conditions at once.'),
    example: ex('COUNTIFS(B2:B200,"Gıda",E2:E200,">100")', 'Kategorisi "Gıda" ve tutarı 100’den büyük satırları sayar', 'Считает строки с категорией "Gıda" и суммой больше 100', 'Counts rows with category "Gıda" and amount over 100'),
    keywords: kw(['çok koşullu say', 'birden fazla şarta göre say', 'iki koşullu sayım', 'çoklu kriter say', 'hem hem say', 've koşuluyla say'],
                 ['счёт по нескольким условиям', 'посчитать если несколько условий', 'количество по двум условиям', 'подсчёт с несколькими критериями', 'и условие счёт', 'сколько строк удовлетворяют'],
                 ['count with multiple criteria', 'count ifs', 'multi-condition count'])
  });

  /* =================== C — F =================== */
  stat.push({
    name: 'COVARIANCE.P', tr: 'KOVARYANS.P', ru: 'КОВАРИАЦИЯ.Г', category: 'stat',
    syntax: 'COVARIANCE.P(array1, array2)',
    args: [
      arg('array1', 'dizi1', 'массив1', false, 'İlk değer kümesi', 'Первый набор значений', 'The first set of values'),
      arg('array2', 'dizi2', 'массив2', false, 'İkinci değer kümesi (aynı boyutta)', 'Второй набор значений (того же размера)', 'The second set of values (same size)')],
    desc: t3('Popülasyon kovaryansını, yani iki veri kümesindeki sapma çarpımlarının ortalamasını verir.',
             'Возвращает ковариацию генеральной совокупности — среднее произведений отклонений двух наборов данных.',
             'Returns the population covariance, the average of the products of deviations of two data sets.'),
    example: ex('COVARIANCE.P(C2:C200,E2:E200)', 'Adet ve tutar sütunlarının popülasyon kovaryansı', 'Ковариация генеральной совокупности для количества и суммы', 'Population covariance of quantity and amount'),
    keywords: kw(['kovaryans', 'popülasyon kovaryansı', 'ortak değişim', 'iki değişkenin kovaryansı'], ['ковариация', 'ковариация генеральной совокупности', 'совместная изменчивость', 'ковариация по всей совокупности'], ['population covariance', 'covariance', 'joint variability']),
    minVersion: '2010'
  });
  stat.push({
    name: 'COVARIANCE.S', tr: 'KOVARYANS.S', ru: 'КОВАРИАЦИЯ.В', category: 'stat',
    syntax: 'COVARIANCE.S(array1, array2)',
    args: [
      arg('array1', 'dizi1', 'массив1', false, 'İlk değer kümesi', 'Первый набор значений', 'The first set of values'),
      arg('array2', 'dizi2', 'массив2', false, 'İkinci değer kümesi (aynı boyutta)', 'Второй набор значений (того же размера)', 'The second set of values (same size)')],
    desc: t3('Örneklem kovaryansını (sapma çarpımlarının toplamının n−1’e bölümü) verir.',
             'Возвращает выборочную ковариацию (сумма произведений отклонений, делённая на n−1).',
             'Returns the sample covariance (sum of deviation products divided by n−1).'),
    example: ex('COVARIANCE.S(C2:C200,E2:E200)', 'Adet ve tutar sütunlarının örneklem kovaryansı', 'Выборочная ковариация количества и суммы', 'Sample covariance of quantity and amount'),
    keywords: kw(['örneklem kovaryansı', 'örnek kovaryans', 'kovaryans s'], ['выборочная ковариация', 'ковариация выборки', 'ковариация в'], ['sample covariance', 'covariance s', 'covariance of two columns']),
    minVersion: '2010'
  });
  stat.push({
    name: 'DEVSQ', tr: 'SAPKARE', ru: 'КВАДРОТКЛ', category: 'stat',
    syntax: 'DEVSQ(number1, [number2], ...)',
    args: numList(),
    desc: t3('Veri noktalarının örneklem ortalamasından sapmalarının karelerinin toplamını verir.',
             'Возвращает сумму квадратов отклонений точек данных от их среднего.',
             'Returns the sum of squared deviations of data points from their sample mean.'),
    example: ex('DEVSQ(E2:E200)', 'E2:E200 değerlerinin ortalamadan sapma kareleri toplamı', 'Сумма квадратов отклонений значений E2:E200 от среднего', 'Sum of squared deviations of E2:E200 from the mean'),
    keywords: kw(['sapma kareleri toplamı', 'kareler toplamı', 'sapkare', 'toplam kare sapma'], ['сумма квадратов отклонений', 'квадраты отклонений', 'квадротк', 'сумма квадратов'], ['sum of squared deviations', 'devsq', 'squared deviations'])
  });
  stat.push({
    name: 'EXPON.DIST', tr: 'ÜSTEL.DAĞ', ru: 'ЭКСП.РАСП', category: 'stat',
    syntax: 'EXPON.DIST(x, lambda, cumulative)',
    args: [ARG_X,
      arg('lambda', 'lambda', 'лямбда', false, 'Dağılımın oran parametresi (pozitif)', 'Параметр интенсивности распределения (положительный)', 'The rate parameter of the distribution (positive)'),
      ARG_CUM],
    desc: t3('Üstel dağılımın olasılık yoğunluğunu veya kümülatif olasılığını verir.',
             'Возвращает плотность или интегральную вероятность экспоненциального распределения.',
             'Returns the probability density or cumulative probability of the exponential distribution.'),
    example: ex('EXPON.DIST(0.2,10,TRUE)', 'Lambda 10 için 0,2’ye kadar kümülatif üstel olasılık', 'Интегральная экспоненциальная вероятность до 0,2 при лямбда 10', 'Cumulative exponential probability up to 0.2 with lambda 10'),
    keywords: kw(['üstel dağılım', 'üstel olasılık', 'bekleme süresi dağılımı', 'lambda dağılımı'], ['экспоненциальное распределение', 'показательное распределение', 'экспоненциальная вероятность', 'время ожидания'], ['exponential distribution', 'exponential probability', 'waiting time distribution']),
    minVersion: '2010'
  });
  stat.push({
    name: 'F.DIST', tr: 'F.DAĞ', ru: 'F.РАСП', category: 'stat',
    syntax: 'F.DIST(x, deg_freedom1, deg_freedom2, cumulative)',
    args: [ARG_X, ARG_DF1, ARG_DF2, ARG_CUM],
    desc: t3('F olasılık dağılımının sol kuyruk (kümülatif) olasılığını veya yoğunluğunu verir.',
             'Возвращает левостороннюю (интегральную) вероятность или плотность F-распределения.',
             'Returns the left-tailed (cumulative) probability or density of the F distribution.'),
    example: ex('F.DIST(15.2,6,4,TRUE)', '6 ve 4 serbestlik derecesinde 15,2 için kümülatif F olasılığı', 'Интегральная F-вероятность для 15,2 при 6 и 4 степенях свободы', 'Cumulative F probability at 15.2 with 6 and 4 degrees of freedom'),
    keywords: kw(['f dağılımı', 'f olasılığı', 'fisher dağılımı sol kuyruk', 'varyans oranı dağılımı'], ['f-распределение', 'распределение фишера', 'f вероятность левосторонняя', 'распределение отношения дисперсий'], ['f distribution', 'f probability left tail', 'variance ratio distribution']),
    minVersion: '2010'
  });
  stat.push({
    name: 'F.DIST.RT', tr: 'F.DAĞ.SAĞK', ru: 'F.РАСП.ПХ', category: 'stat',
    syntax: 'F.DIST.RT(x, deg_freedom1, deg_freedom2)',
    args: [ARG_X, ARG_DF1, ARG_DF2],
    desc: t3('F olasılık dağılımının sağ kuyruk olasılığını verir.',
             'Возвращает правостороннюю вероятность F-распределения.',
             'Returns the right-tailed probability of the F distribution.'),
    example: ex('F.DIST.RT(15.2,6,4)', '6 ve 4 serbestlik derecesinde 15,2 için sağ kuyruk F olasılığı', 'Правосторонняя F-вероятность для 15,2 при 6 и 4 ст. св.', 'Right-tailed F probability at 15.2 with 6 and 4 df'),
    keywords: kw(['f sağ kuyruk', 'f testi p değeri', 'f dağılımı sağ'], ['f правосторонняя', 'p-значение f', 'f-распределение правый хвост'], ['f distribution right tail', 'f p-value', 'f distribution right-tailed']),
    minVersion: '2010'
  });
  stat.push({
    name: 'F.INV', tr: 'F.TERS', ru: 'F.ОБР', category: 'stat',
    syntax: 'F.INV(probability, deg_freedom1, deg_freedom2)',
    args: [ARG_PROB, ARG_DF1, ARG_DF2],
    desc: t3('F kümülatif dağılım fonksiyonunun (sol kuyruk) tersini verir.',
             'Возвращает обратное значение левосторонней интегральной F-функции.',
             'Returns the inverse of the left-tailed F cumulative distribution.'),
    example: ex('F.INV(0.01,6,4)', 'Sol kuyruk olasılığı 0,01 olan F değeri (6, 4 sd)', 'Значение F с левосторонней вероятностью 0,01 (6, 4 ст. св.)', 'F value whose left-tailed probability is 0.01 (6, 4 df)'),
    keywords: kw(['ters f', 'f kantil', 'f dağılımı tersi'], ['обратное f', 'квантиль f', 'f обр'], ['inverse f', 'f quantile', 'f distribution inverse']),
    minVersion: '2010'
  });
  stat.push({
    name: 'F.INV.RT', tr: 'F.TERS.SAĞK', ru: 'F.ОБР.ПХ', category: 'stat',
    syntax: 'F.INV.RT(probability, deg_freedom1, deg_freedom2)',
    args: [ARG_PROB, ARG_DF1, ARG_DF2],
    desc: t3('F dağılımının sağ kuyruk olasılığının tersini (kritik F değerini) verir.',
             'Возвращает обратное значение правосторонней F-вероятности (критическое значение F).',
             'Returns the inverse of the right-tailed F probability (the critical F value).'),
    example: ex('F.INV.RT(0.05,6,4)', '%5 anlamlılık için kritik F değeri (6, 4 sd)', 'Критическое значение F при 5% (6, 4 ст. св.)', 'Critical F value at 5% (6, 4 df)'),
    keywords: kw(['f kritik değer', 'f tablo değeri', 'f ters sağ'], ['критическое значение f', 'табличное f', 'f обр пх'], ['f critical value', 'inverse right tail f', 'f table value']),
    minVersion: '2010'
  });
  stat.push({
    name: 'F.TEST', tr: 'F.TEST', ru: 'F.ТЕСТ', category: 'stat',
    syntax: 'F.TEST(array1, array2)',
    args: [
      arg('array1', 'dizi1', 'массив1', false, 'İlk veri kümesi', 'Первый набор данных', 'The first data set'),
      arg('array2', 'dizi2', 'массив2', false, 'İkinci veri kümesi', 'Второй набор данных', 'The second data set')],
    desc: t3('İki dizinin varyanslarının anlamlı biçimde farklı olmadığına ilişkin çift kuyruklu F testi olasılığını verir.',
             'Возвращает двустороннюю вероятность F-теста о том, что дисперсии двух массивов не различаются существенно.',
             'Returns the two-tailed F-test probability that the variances of two arrays are not significantly different.'),
    example: ex('F.TEST(C2:C100,C101:C200)', 'İki yarının varyanslarını karşılaştıran F testi p-değeri', 'p-значение F-теста сравнения дисперсий двух половин', 'F-test p-value comparing the variances of two halves'),
    keywords: kw(['f testi', 'varyans karşılaştırma', 'varyans eşitliği testi', 'iki varyans testi'], ['f-тест', 'сравнение дисперсий', 'тест равенства дисперсий', 'критерий фишера'], ['f test', 'variance comparison test', 'equality of variances']),
    minVersion: '2010'
  });
  stat.push({
    name: 'FISHER', tr: 'FISHER', ru: 'ФИШЕР', category: 'stat',
    syntax: 'FISHER(x)',
    args: [arg('x', 'x', 'x', false, 'Dönüştürülecek sayı (−1 ile 1 arasında, sınırlar hariç)', 'Число для преобразования (между −1 и 1, не включая границы)', 'The number to transform (between −1 and 1, exclusive)')],
    desc: t3('x değerinin Fisher dönüşümünü (korelasyon katsayısı için normalleştirme) verir.',
             'Возвращает преобразование Фишера для x (нормализация коэффициента корреляции).',
             'Returns the Fisher transformation of x (normalizes a correlation coefficient).'),
    example: ex('FISHER(0.75)', '0,75 korelasyonunun Fisher z dönüşümü', 'z-преобразование Фишера для корреляции 0,75', 'Fisher z transformation of a 0.75 correlation'),
    keywords: kw(['fisher dönüşümü', 'fisher z', 'korelasyon dönüşümü'], ['преобразование фишера', 'z фишера', 'преобразование корреляции'], ['fisher transformation', 'fisher z', 'correlation transform'])
  });
  stat.push({
    name: 'FISHERINV', tr: 'FISHERTERS', ru: 'ФИШЕРОБР', category: 'stat',
    syntax: 'FISHERINV(y)',
    args: [arg('y', 'y', 'y', false, 'Ters dönüşümü alınacak değer', 'Значение для обратного преобразования', 'The value to inverse-transform')],
    desc: t3('Fisher dönüşümünün tersini verir; y = FISHER(x) ise FISHERINV(y) = x olur.',
             'Возвращает обратное преобразование Фишера: если y = FISHER(x), то FISHERINV(y) = x.',
             'Returns the inverse Fisher transformation; if y = FISHER(x) then FISHERINV(y) = x.'),
    example: ex('FISHERINV(0.972955)', 'Fisher dönüşümünü geri alarak 0,75’i verir', 'Обращает преобразование Фишера, возвращая 0,75', 'Undoes the Fisher transformation, giving 0.75'),
    keywords: kw(['ters fisher', 'fisher tersi', 'fisher geri dönüşüm'], ['обратное преобразование фишера', 'фишер обр', 'обратный фишер'], ['inverse fisher', 'fisher inverse', 'undo fisher transformation'])
  });
  stat.push({
    name: 'FORECAST.ETS', tr: 'TAHMİN.ETS', ru: 'ПРЕДСКАЗ.ETS', category: 'stat',
    syntax: 'FORECAST.ETS(target_date, values, timeline, [seasonality], [data_completion], [aggregation])',
    args: [
      arg('target_date', 'hedef_tarih', 'целевая_дата', false, 'Tahmin edilecek tarih veya dönem (zaman çizelgesiyle aynı türde)', 'Дата или период, для которого нужен прогноз (того же типа, что временная шкала)', 'The date or period to forecast (same type as the timeline)'),
      arg('values', 'değerler', 'значения', false, 'Geçmiş değerler', 'Исторические значения', 'The historical values'),
      arg('timeline', 'zaman_çizelgesi', 'временная_шкала', false, 'Sabit aralıklı tarih veya sayı dizisi', 'Ряд дат или чисел с постоянным шагом', 'The series of dates or numbers with a constant step'),
      arg('seasonality', 'mevsimsellik', 'сезонность', true, '1 veya atlanırsa otomatik algılama, 0 mevsimsellik yok, n>1 ise dönem uzunluğu', '1 или опущено — автоопределение, 0 — без сезонности, n>1 — длина периода', '1 or omitted auto-detects, 0 means none, n>1 is the season length'),
      arg('data_completion', 'veri_tamamlama', 'заполнение_данных', true, '1 veya atlanırsa eksik noktalar ortalamayla tamamlanır, 0 ise sıfır sayılır', '1 или опущено — пропуски заполняются средним, 0 — нулями', '1 or omitted fills gaps with the average, 0 treats them as zero'),
      arg('aggregation', 'toplama', 'агрегирование', true, 'Aynı zaman damgasındaki değerleri birleştirme yöntemi (1 ORTALAMA varsayılan, 2 BAĞ_DEĞ_SAY, 3 BAĞ_DEĞ_DOLU_SAY, 4 MAK, 5 ORTANCA, 6 MİN, 7 TOPLA)', 'Способ объединения значений с одинаковой меткой времени (1 СРЗНАЧ по умолчанию, 2 СЧЁТ, 3 СЧЁТЗ, 4 МАКС, 5 МЕДИАНА, 6 МИН, 7 СУММ)', 'How to aggregate values with the same timestamp (1 AVERAGE default, 2 COUNT, 3 COUNTA, 4 MAX, 5 MEDIAN, 6 MIN, 7 SUM)')],
    desc: t3('Üstel düzgünleştirme (ETS AAA) algoritmasıyla gelecekteki bir tarih için tahmin değeri verir.',
             'Возвращает прогнозное значение на будущую дату по алгоритму экспоненциального сглаживания (ETS AAA).',
             'Returns a forecast value for a future date using the exponential smoothing (ETS AAA) algorithm.'),
    example: ex('FORECAST.ETS(DATE(2025,1,1),E2:E25,F2:F25)', 'Geçmiş aylık tutarlardan Ocak 2025 tahmini', 'Прогноз на январь 2025 по прошлым месячным суммам', 'Forecast for January 2025 from past monthly amounts'),
    keywords: kw(['tahmin', 'gelecek tahmini', 'üstel düzgünleştirme', 'mevsimsel tahmin', 'satış tahmini', 'zaman serisi tahmini'], ['прогноз', 'прогнозирование', 'экспоненциальное сглаживание', 'сезонный прогноз', 'прогноз продаж', 'прогноз временного ряда'], ['forecast', 'exponential smoothing forecast', 'seasonal forecast', 'time series forecast']),
    minVersion: '2016', uncertain: ['tr', 'ru']
  });
  stat.push({
    name: 'FORECAST.ETS.CONFINT', tr: 'TAHMİN.ETS.GÜVENARALIĞI', ru: 'ПРЕДСКАЗ.ETS.ДОВИНТЕРВАЛ', category: 'stat',
    syntax: 'FORECAST.ETS.CONFINT(target_date, values, timeline, [confidence_level], [seasonality], [data_completion], [aggregation])',
    args: [
      arg('target_date', 'hedef_tarih', 'целевая_дата', false, 'Tahmin edilecek tarih veya dönem', 'Дата или период прогноза', 'The date or period to forecast'),
      arg('values', 'değerler', 'значения', false, 'Geçmiş değerler', 'Исторические значения', 'The historical values'),
      arg('timeline', 'zaman_çizelgesi', 'временная_шкала', false, 'Sabit aralıklı tarih veya sayı dizisi', 'Ряд дат или чисел с постоянным шагом', 'The series of dates or numbers with a constant step'),
      arg('confidence_level', 'güven_düzeyi', 'уровень_доверия', true, '0 ile 1 arasında güven düzeyi; varsayılan 0,95', 'Уровень доверия от 0 до 1; по умолчанию 0,95', 'Confidence level between 0 and 1; default 0.95'),
      arg('seasonality', 'mevsimsellik', 'сезонность', true, '1 otomatik, 0 yok, n>1 dönem uzunluğu', '1 — авто, 0 — нет, n>1 — длина периода', '1 auto, 0 none, n>1 season length'),
      arg('data_completion', 'veri_tamamlama', 'заполнение_данных', true, '1 eksikleri ortalamayla doldurur, 0 sıfır sayar', '1 — заполнять средним, 0 — нулями', '1 fills gaps with the average, 0 treats them as zero'),
      arg('aggregation', 'toplama', 'агрегирование', true, 'Aynı zaman damgasındaki değerleri birleştirme yöntemi (1–7)', 'Способ объединения одинаковых меток времени (1–7)', 'How to aggregate identical timestamps (1–7)')],
    desc: t3('ETS tahmini için belirtilen güven düzeyindeki güven aralığının yarı genişliğini verir.',
             'Возвращает полуширину доверительного интервала прогноза ETS при заданном уровне доверия.',
             'Returns the half-width of the confidence interval of the ETS forecast at the given confidence level.'),
    example: ex('FORECAST.ETS.CONFINT(DATE(2025,1,1),E2:E25,F2:F25,0.95)', 'Ocak 2025 tahmini için %95 güven aralığı payı', 'Полуширина 95% доверительного интервала прогноза на январь 2025', '95% confidence margin for the January 2025 forecast'),
    keywords: kw(['tahmin güven aralığı', 'tahmin hata payı', 'ets güven aralığı'], ['доверительный интервал прогноза', 'погрешность прогноза', 'ets доверительный интервал'], ['forecast confidence interval', 'forecast margin', 'ets confidence interval']),
    minVersion: '2016', uncertain: ['tr', 'ru']
  });
  stat.push({
    name: 'FORECAST.ETS.SEASONALITY', tr: 'TAHMİN.ETS.MEVSİMSELLİK', ru: 'ПРЕДСКАЗ.ETS.СЕЗОННОСТЬ', category: 'stat',
    syntax: 'FORECAST.ETS.SEASONALITY(values, timeline, [data_completion], [aggregation])',
    args: [
      arg('values', 'değerler', 'значения', false, 'Geçmiş değerler', 'Исторические значения', 'The historical values'),
      arg('timeline', 'zaman_çizelgesi', 'временная_шкала', false, 'Sabit aralıklı tarih veya sayı dizisi', 'Ряд дат или чисел с постоянным шагом', 'The series of dates or numbers with a constant step'),
      arg('data_completion', 'veri_tamamlama', 'заполнение_данных', true, '1 eksikleri ortalamayla doldurur, 0 sıfır sayar', '1 — заполнять средним, 0 — нулями', '1 fills gaps with the average, 0 treats them as zero'),
      arg('aggregation', 'toplama', 'агрегирование', true, 'Aynı zaman damgasındaki değerleri birleştirme yöntemi (1–7)', 'Способ объединения одинаковых меток времени (1–7)', 'How to aggregate identical timestamps (1–7)')],
    desc: t3('Excel’in zaman serisinde algıladığı mevsimsel desenin uzunluğunu (dönem sayısını) verir.',
             'Возвращает длину сезонного цикла (число периодов), обнаруженного Excel во временном ряду.',
             'Returns the length of the seasonal pattern (number of periods) Excel detects in the time series.'),
    example: ex('FORECAST.ETS.SEASONALITY(E2:E25,F2:F25)', 'Aylık verideki mevsimsel döngü uzunluğunu bulur (örn. 12)', 'Определяет длину сезонного цикла в месячных данных (например, 12)', 'Finds the seasonal cycle length in monthly data (e.g. 12)'),
    keywords: kw(['mevsimsellik', 'mevsimsel dönem', 'sezon uzunluğu', 'dönemsellik tespiti'], ['сезонность', 'длина сезона', 'сезонный период', 'определить сезонность'], ['seasonality', 'season length', 'detect seasonality']),
    minVersion: '2016', uncertain: ['tr', 'ru']
  });
  stat.push({
    name: 'FORECAST.ETS.STAT', tr: 'TAHMİN.ETS.İSTAT', ru: 'ПРЕДСКАЗ.ETS.СТАТ', category: 'stat',
    syntax: 'FORECAST.ETS.STAT(values, timeline, statistic_type, [seasonality], [data_completion], [aggregation])',
    args: [
      arg('values', 'değerler', 'значения', false, 'Geçmiş değerler', 'Исторические значения', 'The historical values'),
      arg('timeline', 'zaman_çizelgesi', 'временная_шкала', false, 'Sabit aralıklı tarih veya sayı dizisi', 'Ряд дат или чисел с постоянным шагом', 'The series of dates or numbers with a constant step'),
      arg('statistic_type', 'istatistik_türü', 'тип_статистики', false, '1 alfa, 2 beta, 3 gama, 4 MASE, 5 SMAPE, 6 MAE, 7 RMSE, 8 adım boyutu', '1 альфа, 2 бета, 3 гамма, 4 MASE, 5 SMAPE, 6 MAE, 7 RMSE, 8 размер шага', '1 alpha, 2 beta, 3 gamma, 4 MASE, 5 SMAPE, 6 MAE, 7 RMSE, 8 step size'),
      arg('seasonality', 'mevsimsellik', 'сезонность', true, '1 otomatik, 0 yok, n>1 dönem uzunluğu', '1 — авто, 0 — нет, n>1 — длина периода', '1 auto, 0 none, n>1 season length'),
      arg('data_completion', 'veri_tamamlama', 'заполнение_данных', true, '1 eksikleri ortalamayla doldurur, 0 sıfır sayar', '1 — заполнять средним, 0 — нулями', '1 fills gaps with the average, 0 treats them as zero'),
      arg('aggregation', 'toplama', 'агрегирование', true, 'Aynı zaman damgasındaki değerleri birleştirme yöntemi (1–7)', 'Способ объединения одинаковых меток времени (1–7)', 'How to aggregate identical timestamps (1–7)')],
    desc: t3('ETS tahmin modeline ilişkin istenen istatistiği (düzgünleştirme parametreleri veya hata ölçüleri) verir.',
             'Возвращает запрошенную статистику модели прогноза ETS (параметры сглаживания или метрики ошибки).',
             'Returns the requested statistic of the ETS forecast model (smoothing parameters or error metrics).'),
    example: ex('FORECAST.ETS.STAT(E2:E25,F2:F25,7)', 'ETS tahmin modelinin RMSE hatasını verir', 'Возвращает ошибку RMSE модели прогноза ETS', 'Returns the RMSE of the ETS forecast model'),
    keywords: kw(['tahmin istatistiği', 'tahmin hatası', 'ets parametreleri', 'tahmin doğruluğu'], ['статистика прогноза', 'ошибка прогноза', 'параметры ets', 'точность прогноза'], ['forecast statistic', 'forecast error', 'ets parameters']),
    minVersion: '2016', uncertain: ['tr', 'ru']
  });
  stat.push({
    name: 'FORECAST.LINEAR', tr: 'TAHMİN.DOĞRUSAL', ru: 'ПРЕДСКАЗ.ЛИНЕЙН', category: 'stat',
    syntax: "FORECAST.LINEAR(x, known_y's, known_x's)",
    args: [
      arg('x', 'x', 'x', false, 'Değeri tahmin edilecek x noktası', 'Точка x, для которой нужен прогноз', 'The x value to predict for'),
      ARG_KNOWN_Y, ARG_KNOWN_X],
    desc: t3('Bilinen x-y çiftlerinden doğrusal regresyonla yeni bir x için y değerini tahmin eder.',
             'Предсказывает значение y для нового x по линейной регрессии на известных парах x-y.',
             'Predicts the y value for a new x using linear regression on known x-y pairs.'),
    example: ex('FORECAST.LINEAR(13,E2:E13,C2:C13)', 'Doğrusal eğilime göre x=13 için tahmini tutar', 'Прогноз суммы для x=13 по линейному тренду', 'Predicted amount for x=13 from the linear trend'),
    keywords: kw(['doğrusal tahmin', 'regresyonla tahmin', 'eğilime göre tahmin', 'gelecek değer tahmini', 'lineer tahmin'], ['линейный прогноз', 'прогноз по регрессии', 'прогноз по тренду', 'предсказать значение', 'линейная экстраполяция'], ['linear forecast', 'regression forecast', 'predict value', 'trend prediction']),
    minVersion: '2016'
  });

  /* =================== F — L =================== */
  stat.push({
    name: 'FREQUENCY', tr: 'SIKLIK', ru: 'ЧАСТОТА', category: 'stat',
    syntax: 'FREQUENCY(data_array, bins_array)',
    args: [
      arg('data_array', 'veri_dizisi', 'массив_данных', false, 'Sıklıkları sayılacak değerler', 'Значения, для которых подсчитываются частоты', 'The values whose frequencies are counted'),
      arg('bins_array', 'bölme_dizisi', 'массив_интервалов', false, 'Aralık üst sınırları (artan sırada)', 'Верхние границы интервалов (по возрастанию)', 'The upper bounds of the bins (ascending)')],
    desc: t3('Değerlerin belirtilen aralıklara (bölmelere) kaçar tane düştüğünü dikey bir dizi olarak verir; sonuç bölme sayısından bir fazla elemanlıdır.',
             'Возвращает вертикальный массив: сколько значений попадает в каждый интервал; результат на один элемент длиннее массива интервалов.',
             'Returns a vertical array of how many values fall into each bin; the result has one more element than the bins.'),
    example: ex('FREQUENCY(E2:E200,{100,500,1000})', 'Tutarları ≤100, ≤500, ≤1000 ve >1000 gruplarına göre sayar', 'Считает суммы в группах ≤100, ≤500, ≤1000 и >1000', 'Counts amounts in the groups ≤100, ≤500, ≤1000 and >1000'),
    keywords: kw(['sıklık dağılımı', 'frekans', 'histogram', 'aralıklara göre say', 'gruplara dağılım', 'bölme sayımı'], ['частота', 'распределение частот', 'гистограмма', 'посчитать по интервалам', 'распределение по группам', 'частотный анализ'], ['frequency distribution', 'histogram', 'count by bins'])
  });
  stat.push({
    name: 'GAMMA', tr: 'GAMA', ru: 'ГАММА', category: 'stat',
    syntax: 'GAMMA(number)',
    args: [arg('number', 'sayı', 'число', false, 'Gama fonksiyonunun hesaplanacağı değer (0 veya negatif tam sayı olamaz)', 'Значение для вычисления гамма-функции (не 0 и не отрицательное целое)', 'The value to evaluate the gamma function at (not 0 or a negative integer)')],
    desc: t3('Sayının gama fonksiyonu değerini verir (tam sayılar için (n−1)! faktöriyeline eşittir).',
             'Возвращает значение гамма-функции (для целых чисел равно факториалу (n−1)!).',
             'Returns the gamma function value of a number (equal to (n−1)! for integers).'),
    example: ex('GAMMA(5)', 'Γ(5) = 4! = 24', 'Γ(5) = 4! = 24', 'Γ(5) = 4! = 24'),
    keywords: kw(['gama fonksiyonu', 'gamma', 'genelleştirilmiş faktöriyel'], ['гамма-функция', 'гамма', 'обобщённый факториал'], ['gamma function', 'generalized factorial', 'gamma']),
    minVersion: '2013'
  });
  stat.push({
    name: 'GAMMA.DIST', tr: 'GAMA.DAĞ', ru: 'ГАММА.РАСП', category: 'stat',
    syntax: 'GAMMA.DIST(x, alpha, beta, cumulative)',
    args: [ARG_X, ARG_ALPHA, ARG_BETA, ARG_CUM],
    desc: t3('Gama dağılımının olasılık yoğunluğunu veya kümülatif olasılığını verir.',
             'Возвращает плотность или интегральную вероятность гамма-распределения.',
             'Returns the probability density or cumulative probability of the gamma distribution.'),
    example: ex('GAMMA.DIST(10,9,2,TRUE)', 'Alfa 9, beta 2 için x=10 noktasında kümülatif gama olasılığı', 'Интегральная гамма-вероятность в точке 10 при альфа 9 и бета 2', 'Cumulative gamma probability at 10 with alpha 9 and beta 2'),
    keywords: kw(['gama dağılımı', 'gama olasılığı', 'kuyruk süresi dağılımı'], ['гамма-распределение', 'гамма вероятность', 'распределение ожидания'], ['gamma distribution', 'gamma probability', 'gamma cumulative']),
    minVersion: '2010'
  });
  stat.push({
    name: 'GAMMA.INV', tr: 'GAMA.TERS', ru: 'ГАММА.ОБР', category: 'stat',
    syntax: 'GAMMA.INV(probability, alpha, beta)',
    args: [ARG_PROB, ARG_ALPHA, ARG_BETA],
    desc: t3('Gama kümülatif dağılım fonksiyonunun tersini verir.',
             'Возвращает обратную интегральную функцию гамма-распределения.',
             'Returns the inverse of the gamma cumulative distribution.'),
    example: ex('GAMMA.INV(0.068094,9,2)', 'Kümülatif olasılığı 0,068 olan gama değeri (≈10)', 'Значение гамма-распределения с интегральной вероятностью 0,068 (≈10)', 'Gamma value with cumulative probability 0.068 (≈10)'),
    keywords: kw(['ters gama', 'gama kantil', 'gama tersi'], ['обратное гамма', 'квантиль гамма', 'гамма обр'], ['inverse gamma', 'gamma quantile', 'gamma distribution inverse']),
    minVersion: '2010'
  });
  stat.push({
    name: 'GAMMALN', tr: 'GAMALN', ru: 'ГАММАНЛОГ', category: 'stat',
    syntax: 'GAMMALN(x)',
    args: [arg('x', 'x', 'x', false, 'Pozitif değer', 'Положительное значение', 'A positive value')],
    desc: t3('Gama fonksiyonunun doğal logaritmasını, ln(Γ(x)), verir.',
             'Возвращает натуральный логарифм гамма-функции, ln(Γ(x)).',
             'Returns the natural logarithm of the gamma function, ln(Γ(x)).'),
    example: ex('GAMMALN(4)', 'ln(Γ(4)) = ln(6) ≈ 1,79', 'ln(Γ(4)) = ln(6) ≈ 1,79', 'ln(Γ(4)) = ln(6) ≈ 1.79'),
    keywords: kw(['gama logaritması', 'ln gama', 'gamaln'], ['логарифм гамма-функции', 'ln гамма', 'гамманлог'], ['log gamma', 'gammaln', 'natural log of gamma'])
  });
  stat.push({
    name: 'GAMMALN.PRECISE', tr: 'GAMALN.DUYARLI', ru: 'ГАММАНЛОГ.ТОЧН', category: 'stat',
    syntax: 'GAMMALN.PRECISE(x)',
    args: [arg('x', 'x', 'x', false, 'Pozitif değer', 'Положительное значение', 'A positive value')],
    desc: t3('Gama fonksiyonunun doğal logaritmasını daha yüksek hassasiyetle verir.',
             'Возвращает натуральный логарифм гамма-функции с повышенной точностью.',
             'Returns the natural logarithm of the gamma function with higher precision.'),
    example: ex('GAMMALN.PRECISE(4)', 'ln(Γ(4)) hassas hesap ≈ 1,791759', 'ln(Γ(4)) с высокой точностью ≈ 1,791759', 'Precise ln(Γ(4)) ≈ 1.791759'),
    keywords: kw(['hassas gama logaritması', 'gamaln duyarlı', 'ln gama hassas'], ['точный логарифм гамма', 'гамманлог точн', 'ln гамма точно'], ['precise log gamma', 'gammaln precise', 'high precision log gamma']),
    minVersion: '2010'
  });
  stat.push({
    name: 'GAUSS', tr: 'GAUSS', ru: 'ГАУСС', category: 'stat',
    syntax: 'GAUSS(z)',
    args: [arg('z', 'z', 'z', false, 'Standart normal dağılımda z değeri', 'Значение z стандартного нормального распределения', 'The z value of the standard normal distribution')],
    desc: t3('Standart normal bir değişkenin ortalama ile z standart sapma arasına düşme olasılığını verir (NORM.S.DAĞ(z,DOĞRU)−0,5).',
             'Возвращает вероятность того, что стандартная нормальная величина окажется между средним и z (НОРМ.СТ.РАСП(z,ИСТИНА)−0,5).',
             'Returns the probability that a standard normal variable falls between the mean and z (NORM.S.DIST(z,TRUE)−0.5).'),
    example: ex('GAUSS(2)', 'Ortalama ile 2 standart sapma arasındaki olasılık ≈ 0,477', 'Вероятность между средним и 2σ ≈ 0,477', 'Probability between the mean and 2σ ≈ 0.477'),
    keywords: kw(['gauss', 'normal dağılım ortalamadan z’ye', 'standart normal olasılık'], ['гаусс', 'нормальное от среднего до z', 'стандартная нормальная вероятность'], ['gauss', 'normal probability from mean to z', 'standard normal probability']),
    minVersion: '2013'
  });
  stat.push({
    name: 'GEOMEAN', tr: 'GEOORT', ru: 'СРГЕОМ', category: 'stat',
    syntax: 'GEOMEAN(number1, [number2], ...)',
    args: numList('pozitif sayılar', 'положительные числа', 'positive numbers'),
    desc: t3('Pozitif sayıların geometrik ortalamasını (çarpımlarının n’inci kökünü) verir.',
             'Возвращает среднее геометрическое положительных чисел (корень n-й степени из произведения).',
             'Returns the geometric mean of positive numbers (the nth root of their product).'),
    example: ex('GEOMEAN(J2:J13)', 'Aylık büyüme oranlarının geometrik ortalaması', 'Среднее геометрическое месячных темпов роста', 'Geometric mean of monthly growth factors'),
    keywords: kw(['geometrik ortalama', 'büyüme oranı ortalaması', 'bileşik ortalama'], ['среднее геометрическое', 'геометрическое среднее', 'средний темп роста'], ['geometric mean', 'average growth rate', 'compound average'])
  });
  stat.push({
    name: 'GROWTH', tr: 'BÜYÜME', ru: 'РОСТ', category: 'stat',
    syntax: "GROWTH(known_y's, [known_x's], [new_x's], [const])",
    args: [ARG_KNOWN_Y, ARG_KNOWN_X_OPT, ARG_NEW_X, ARG_CONST],
    desc: t3('Bilinen verilere uydurulan üstel eğilime (y = b·m^x) göre tahmini y değerlerini dizi olarak verir.',
             'Возвращает массив прогнозных значений y по экспоненциальному тренду (y = b·m^x), подобранному к данным.',
             'Returns predicted y values along the exponential trend (y = b·m^x) fitted to the known data.'),
    example: ex('GROWTH(E2:E13,C2:C13,C14:C16)', 'Üstel büyümeye göre sonraki 3 dönem için tahmin', 'Прогноз на следующие 3 периода по экспоненциальному росту', 'Forecast for the next 3 periods by exponential growth'),
    keywords: kw(['üstel büyüme tahmini', 'üstel eğilim', 'büyüme eğrisi', 'katlanarak artış tahmini'], ['экспоненциальный рост', 'экспоненциальный тренд', 'прогноз роста', 'кривая роста'], ['exponential growth forecast', 'exponential trend', 'growth curve'])
  });
  stat.push({
    name: 'HARMEAN', tr: 'HARORT', ru: 'СРГАРМ', category: 'stat',
    syntax: 'HARMEAN(number1, [number2], ...)',
    args: numList('pozitif sayılar', 'положительные числа', 'positive numbers'),
    desc: t3('Pozitif sayıların harmonik ortalamasını (terslerinin ortalamasının tersini) verir.',
             'Возвращает среднее гармоническое положительных чисел (обратное среднему обратных величин).',
             'Returns the harmonic mean of positive numbers (the reciprocal of the mean of reciprocals).'),
    example: ex('HARMEAN(D2:D200)', 'Birim fiyatların harmonik ortalaması', 'Среднее гармоническое цен', 'Harmonic mean of unit prices'),
    keywords: kw(['harmonik ortalama', 'ortalama hız', 'terslerin ortalaması'], ['среднее гармоническое', 'гармоническое среднее', 'средняя скорость'], ['harmonic mean', 'average rate', 'reciprocal mean'])
  });
  stat.push({
    name: 'HYPGEOM.DIST', tr: 'HİPERGEOM.DAĞ', ru: 'ГИПЕРГЕОМ.РАСП', category: 'stat',
    syntax: 'HYPGEOM.DIST(sample_s, number_sample, population_s, number_pop, cumulative)',
    args: [
      arg('sample_s', 'örnek_başarı', 'число_успехов_в_выборке', false, 'Örneklemdeki başarı sayısı', 'Число успехов в выборке', 'The number of successes in the sample'),
      arg('number_sample', 'örnek_sayısı', 'размер_выборки', false, 'Örneklem büyüklüğü', 'Размер выборки', 'The sample size'),
      arg('population_s', 'popülasyon_başarı', 'число_успехов_в_совокупности', false, 'Popülasyondaki başarı sayısı', 'Число успехов в совокупности', 'The number of successes in the population'),
      arg('number_pop', 'popülasyon_sayısı', 'размер_совокупности', false, 'Popülasyon büyüklüğü', 'Размер совокупности', 'The population size'),
      ARG_CUM],
    desc: t3('Hipergeometrik dağılımı verir: iadesiz örneklemede belirli sayıda başarı elde etme olasılığı.',
             'Возвращает гипергеометрическое распределение — вероятность заданного числа успехов при выборке без возвращения.',
             'Returns the hypergeometric distribution: the probability of a given number of successes when sampling without replacement.'),
    example: ex('HYPGEOM.DIST(1,4,8,20,FALSE)', '20 üründen 8’i kusurluyken 4 çekilişte tam 1 kusurlu çıkma olasılığı', 'Вероятность ровно 1 бракованного при выборе 4 из 20, где 8 бракованных', 'Probability of exactly 1 defective in 4 draws from 20 items with 8 defective'),
    keywords: kw(['hipergeometrik dağılım', 'iadesiz örnekleme', 'çekiliş olasılığı'], ['гипергеометрическое распределение', 'выборка без возвращения', 'вероятность выборки'], ['hypergeometric distribution', 'sampling without replacement', 'hypergeometric probability']),
    minVersion: '2010'
  });
  stat.push({
    name: 'INTERCEPT', tr: 'KESMENOKTASI', ru: 'ОТРЕЗОК', category: 'stat',
    syntax: "INTERCEPT(known_y's, known_x's)",
    args: [ARG_KNOWN_Y, ARG_KNOWN_X],
    desc: t3('Doğrusal regresyon doğrusunun y eksenini kestiği noktayı (x=0 iken y) verir.',
             'Возвращает точку пересечения линии линейной регрессии с осью y (y при x=0).',
             'Returns the point where the linear regression line crosses the y axis (y when x=0).'),
    example: ex('INTERCEPT(E2:E200,C2:C200)', 'Tutar-adet regresyonunun y kesme noktası', 'Отрезок регрессии суммы по количеству', 'Y-intercept of the amount-vs-quantity regression'),
    keywords: kw(['kesme noktası', 'y ekseni kesişim', 'regresyon sabiti', 'doğrunun kesişimi'], ['отрезок', 'пересечение с осью y', 'свободный член регрессии', 'константа регрессии'], ['intercept', 'y-intercept', 'regression constant'])
  });
  stat.push({
    name: 'KURT', tr: 'BASIKLIK', ru: 'ЭКСЦЕСС', category: 'stat',
    syntax: 'KURT(number1, [number2], ...)',
    args: numList(),
    desc: t3('Veri kümesinin basıklığını (kurtosis) verir; normal dağılıma göre tepe ve kuyrukların sivriliğini ölçer.',
             'Возвращает эксцесс набора данных — меру остроты пика и тяжести хвостов относительно нормального распределения.',
             'Returns the kurtosis of a data set, measuring peakedness and tail weight relative to the normal distribution.'),
    example: ex('KURT(E2:E200)', 'Tutar dağılımının basıklığı', 'Эксцесс распределения сумм', 'Kurtosis of the amount distribution'),
    keywords: kw(['basıklık', 'kurtosis', 'dağılım sivriliği', 'kuyruk kalınlığı'], ['эксцесс', 'куртозис', 'островершинность', 'тяжесть хвостов'], ['kurtosis', 'peakedness', 'tail weight'])
  });
  stat.push({
    name: 'LARGE', tr: 'BÜYÜK', ru: 'НАИБОЛЬШИЙ', category: 'stat',
    syntax: 'LARGE(array, k)',
    args: [ARG_ARRAY,
      arg('k', 'k', 'k', false, 'İstenen sıra: 1 en büyük, 2 ikinci en büyük…', 'Позиция: 1 — наибольшее, 2 — второе по величине…', 'The position: 1 for the largest, 2 for the second largest…')],
    desc: t3('Veri kümesindeki k’ıncı en büyük değeri verir.',
             'Возвращает k-е по величине (наибольшее) значение в наборе данных.',
             'Returns the k-th largest value in a data set.'),
    example: ex('LARGE(E2:E200,2)', 'Tutarlar içindeki ikinci en büyük değer', 'Второе по величине значение среди сумм', 'The second largest amount'),
    keywords: kw(['en büyük', 'ikinci en büyük', 'üçüncü en büyük', 'k’ıncı en büyük', 'en yüksek n değer', 'sıradaki en büyük', 'ilk 3 en büyük', 'en büyük kaçıncı'],
                 ['наибольший', 'второй по величине', 'третий по величине', 'k-й наибольший', 'топ n значений', 'n-е наибольшее', 'самое большое после максимума', 'первые 3 наибольших'],
                 ['largest', 'second largest', 'k-th largest', 'top n values', 'nth highest'])
  });
  stat.push({
    name: 'LINEST', tr: 'DOT', ru: 'ЛИНЕЙН', category: 'stat',
    syntax: "LINEST(known_y's, [known_x's], [const], [stats])",
    args: [ARG_KNOWN_Y, ARG_KNOWN_X_OPT, ARG_CONST, ARG_STATS],
    desc: t3('En küçük kareler yöntemiyle doğrusal regresyon katsayılarını (eğim ve kesme noktası) ve isteğe bağlı istatistikleri dizi olarak verir.',
             'Возвращает массив коэффициентов линейной регрессии (наклон и отрезок) по методу наименьших квадратов и, при необходимости, статистику.',
             'Returns an array of linear regression coefficients (slope and intercept) by least squares, optionally with statistics.'),
    example: ex('LINEST(E2:E200,C2:C200,TRUE,TRUE)', 'Tutar-adet regresyonunun katsayıları ve istatistikleri', 'Коэффициенты и статистика регрессии суммы по количеству', 'Coefficients and statistics of the amount-vs-quantity regression'),
    keywords: kw(['doğrusal regresyon', 'regresyon katsayıları', 'en küçük kareler', 'çoklu regresyon', 'eğim ve kesişim'], ['линейная регрессия', 'коэффициенты регрессии', 'метод наименьших квадратов', 'множественная регрессия', 'наклон и отрезок'], ['linear regression', 'regression coefficients', 'least squares'])
  });
  stat.push({
    name: 'LOGEST', tr: 'LOT', ru: 'ЛГРФПРИБЛ', category: 'stat',
    syntax: "LOGEST(known_y's, [known_x's], [const], [stats])",
    args: [ARG_KNOWN_Y, ARG_KNOWN_X_OPT, ARG_CONST, ARG_STATS],
    desc: t3('Üstel eğri (y = b·m^x) uydurarak m ve b parametrelerini ve isteğe bağlı istatistikleri dizi olarak verir.',
             'Подбирает экспоненциальную кривую (y = b·m^x) и возвращает массив параметров m и b с опциональной статистикой.',
             'Fits an exponential curve (y = b·m^x) and returns an array of the m and b parameters, optionally with statistics.'),
    example: ex('LOGEST(E2:E13,C2:C13)', 'Aylık verilere uyan üstel eğrinin parametreleri', 'Параметры экспоненциальной кривой по месячным данным', 'Parameters of the exponential curve fitted to monthly data'),
    keywords: kw(['üstel regresyon', 'üstel eğri uydurma', 'büyüme katsayısı', 'logaritmik eğilim'], ['экспоненциальная регрессия', 'подбор экспоненты', 'коэффициент роста', 'логарифмическое приближение'], ['exponential regression', 'exponential curve fit', 'exponential trend parameters'])
  });
  stat.push({
    name: 'LOGNORM.DIST', tr: 'LOGNORM.DAĞ', ru: 'ЛОГНОРМ.РАСП', category: 'stat',
    syntax: 'LOGNORM.DIST(x, mean, standard_dev, cumulative)',
    args: [arg('x', 'x', 'x', false, 'Dağılımın değerlendirileceği pozitif değer', 'Положительное значение для вычисления распределения', 'The positive value to evaluate the distribution at'),
      arg('mean', 'ortalama', 'среднее', false, 'ln(x) değerinin ortalaması', 'Среднее ln(x)', 'The mean of ln(x)'),
      arg('standard_dev', 'standart_sapma', 'стандартное_откл', false, 'ln(x) değerinin standart sapması', 'Стандартное отклонение ln(x)', 'The standard deviation of ln(x)'),
      ARG_CUM],
    desc: t3('Lognormal dağılımın olasılık yoğunluğunu veya kümülatif olasılığını verir.',
             'Возвращает плотность или интегральную вероятность логнормального распределения.',
             'Returns the probability density or cumulative probability of the lognormal distribution.'),
    example: ex('LOGNORM.DIST(4,3.5,1.2,TRUE)', 'ln ortalaması 3,5 ve sapması 1,2 için x=4 kümülatif lognormal olasılığı', 'Интегральная логнормальная вероятность при x=4, среднем ln 3,5 и σ 1,2', 'Cumulative lognormal probability at 4 with ln-mean 3.5 and σ 1.2'),
    keywords: kw(['lognormal dağılım', 'log normal olasılık', 'logaritmik normal'], ['логнормальное распределение', 'логарифмически нормальное', 'логнорм вероятность'], ['lognormal distribution', 'log-normal probability', 'lognormal cumulative']),
    minVersion: '2010'
  });
  stat.push({
    name: 'LOGNORM.INV', tr: 'LOGNORM.TERS', ru: 'ЛОГНОРМ.ОБР', category: 'stat',
    syntax: 'LOGNORM.INV(probability, mean, standard_dev)',
    args: [ARG_PROB,
      arg('mean', 'ortalama', 'среднее', false, 'ln(x) değerinin ortalaması', 'Среднее ln(x)', 'The mean of ln(x)'),
      arg('standard_dev', 'standart_sapma', 'стандартное_откл', false, 'ln(x) değerinin standart sapması', 'Стандартное отклонение ln(x)', 'The standard deviation of ln(x)')],
    desc: t3('Lognormal kümülatif dağılım fonksiyonunun tersini verir.',
             'Возвращает обратную интегральную функцию логнормального распределения.',
             'Returns the inverse of the lognormal cumulative distribution.'),
    example: ex('LOGNORM.INV(0.039084,3.5,1.2)', 'Kümülatif olasılığı 0,039 olan lognormal değer (≈4)', 'Логнормальное значение с интегральной вероятностью 0,039 (≈4)', 'Lognormal value with cumulative probability 0.039 (≈4)'),
    keywords: kw(['ters lognormal', 'lognormal kantil', 'lognorm tersi'], ['обратное логнормальное', 'квантиль логнормального', 'логнорм обр'], ['inverse lognormal', 'lognormal quantile', 'lognormal distribution inverse']),
    minVersion: '2010'
  });

  /* =================== M — N =================== */
  stat.push({
    name: 'MAX', tr: 'MAK', ru: 'МАКС', category: 'stat',
    syntax: 'MAX(number1, [number2], ...)',
    args: numList(),
    desc: t3('Bağımsız değişkenlerdeki en büyük sayıyı verir; metin ve mantıksal değerler yok sayılır.',
             'Возвращает наибольшее число среди аргументов; текст и логические значения игнорируются.',
             'Returns the largest number among its arguments; text and logical values are ignored.'),
    example: ex('MAX(E2:E200)', 'E2:E200 içindeki en yüksek tutarı bulur', 'Находит наибольшую сумму в E2:E200', 'Finds the highest amount in E2:E200'),
    keywords: kw(['en büyük', 'maksimum', 'en yüksek', 'en büyük değer', 'en yüksek tutar', 'en fazla', 'en yüksek fiyat', 'maksimumu bul'],
                 ['максимум', 'наибольшее', 'самое большое', 'максимальное значение', 'наибольшая сумма', 'самая высокая цена', 'найти максимум', 'макс'],
                 ['max', 'maximum', 'largest value', 'highest', 'biggest number'])
  });
  stat.push({
    name: 'MAXA', tr: 'MAKA', ru: 'МАКСА', category: 'stat',
    syntax: 'MAXA(value1, [value2], ...)',
    args: valList(),
    desc: t3('Metin ve mantıksal değerleri de hesaba katarak en büyük değeri verir; metin 0, DOĞRU 1 sayılır.',
             'Возвращает наибольшее значение с учётом текста и логических значений: текст считается 0, ИСТИНА — 1.',
             'Returns the largest value including text and logicals; text counts as 0, TRUE as 1.'),
    example: ex('MAXA(C2:C200)', 'C2:C200 en büyüğünü bulur, metinleri 0 sayar', 'Максимум C2:C200, текст считается нулём', 'Largest of C2:C200 treating text as 0'),
    keywords: kw(['metin dahil maksimum', 'mantıksal dahil en büyük', 'maka'], ['максимум с текстом', 'максимум с логическими', 'макса'], ['max including text', 'maxa', 'maximum with logicals'])
  });
  stat.push({
    name: 'MAXIFS', tr: 'ÇOKEĞERMAK', ru: 'МАКСЕСЛИ', category: 'stat',
    syntax: 'MAXIFS(max_range, criteria_range1, criteria1, [criteria_range2, criteria2], ...)',
    args: [
      arg('max_range', 'maks_aralığı', 'макс_диапазон', false, 'En büyüğü bulunacak hücreler', 'Ячейки, в которых ищется максимум', 'The cells to find the maximum in'),
      arg('criteria_range1', 'ölçüt_aralığı1', 'диапазон_условия1', false, 'İlk koşulun uygulanacağı aralık', 'Диапазон для первого условия', 'The range for the first condition'),
      arg('criteria1', 'ölçüt1', 'условие1', false, 'İlk koşul', 'Первое условие', 'The first condition'),
      arg('criteria_range2', 'ölçüt_aralığı2', 'диапазон_условия2', true, 'Sonraki koşul aralıkları; en fazla 126 çift', 'Следующие диапазоны условий; до 126 пар', 'Further criteria ranges, up to 126 pairs'),
      arg('criteria2', 'ölçüt2', 'условие2', true, 'Sonraki koşullar', 'Следующие условия', 'Further conditions')],
    desc: t3('Bir veya daha çok koşulu karşılayan hücreler arasındaki en büyük değeri verir.',
             'Возвращает наибольшее значение среди ячеек, удовлетворяющих одному или нескольким условиям.',
             'Returns the largest value among cells that meet one or more conditions.'),
    example: ex('MAXIFS(E2:E200,B2:B200,"Gıda")', 'Kategorisi "Gıda" olan satırlar içindeki en yüksek tutar', 'Наибольшая сумма среди строк с категорией "Gıda"', 'Highest amount among rows with category "Gıda"'),
    keywords: kw(['koşullu maksimum', 'şarta göre en büyük', 'eğer maksimum', 'kategoriye göre en yüksek', 'kriterli en büyük', 'belirli grubun maksimumu'],
                 ['максимум по условию', 'максимум если', 'наибольшее по условию', 'максимум по категории', 'условный максимум', 'макс с критерием'],
                 ['max if', 'conditional max', 'maximum by criteria']),
    minVersion: '2019'
  });
  stat.push({
    name: 'MEDIAN', tr: 'ORTANCA', ru: 'МЕДИАНА', category: 'stat',
    syntax: 'MEDIAN(number1, [number2], ...)',
    args: numList(),
    desc: t3('Sayıların ortancasını (sıralı listenin ortasındaki değeri; çift adette iki ortadakinin ortalamasını) verir.',
             'Возвращает медиану — значение в середине отсортированного набора (при чётном количестве — среднее двух средних).',
             'Returns the median, the middle value of the sorted numbers (the average of the two middle ones for an even count).'),
    example: ex('MEDIAN(E2:E200)', 'E2:E200 tutarlarının ortanca değeri', 'Медиана сумм в E2:E200', 'Median of the amounts in E2:E200'),
    keywords: kw(['ortanca', 'medyan', 'orta değer', 'ortadaki değer', 'medyan hesapla', 'orta nokta'],
                 ['медиана', 'срединное значение', 'среднее по положению', 'посчитать медиану', 'середина ряда', 'медианное значение'],
                 ['median', 'middle value', 'midpoint'])
  });
  stat.push({
    name: 'MIN', tr: 'MİN', ru: 'МИН', category: 'stat',
    syntax: 'MIN(number1, [number2], ...)',
    args: numList(),
    desc: t3('Bağımsız değişkenlerdeki en küçük sayıyı verir; metin ve mantıksal değerler yok sayılır.',
             'Возвращает наименьшее число среди аргументов; текст и логические значения игнорируются.',
             'Returns the smallest number among its arguments; text and logical values are ignored.'),
    example: ex('MIN(E2:E200)', 'E2:E200 içindeki en düşük tutarı bulur', 'Находит наименьшую сумму в E2:E200', 'Finds the lowest amount in E2:E200'),
    keywords: kw(['en küçük', 'minimum', 'en düşük', 'en küçük değer', 'en düşük tutar', 'en az', 'en ucuz', 'minimumu bul'],
                 ['минимум', 'наименьшее', 'самое маленькое', 'минимальное значение', 'наименьшая сумма', 'самая низкая цена', 'найти минимум', 'мин'],
                 ['min', 'minimum', 'smallest value', 'lowest', 'cheapest'])
  });
  stat.push({
    name: 'MINA', tr: 'MİNA', ru: 'МИНА', category: 'stat',
    syntax: 'MINA(value1, [value2], ...)',
    args: valList(),
    desc: t3('Metin ve mantıksal değerleri de hesaba katarak en küçük değeri verir; metin 0, DOĞRU 1 sayılır.',
             'Возвращает наименьшее значение с учётом текста и логических значений: текст считается 0, ИСТИНА — 1.',
             'Returns the smallest value including text and logicals; text counts as 0, TRUE as 1.'),
    example: ex('MINA(C2:C200)', 'C2:C200 en küçüğünü bulur, metinleri 0 sayar', 'Минимум C2:C200, текст считается нулём', 'Smallest of C2:C200 treating text as 0'),
    keywords: kw(['metin dahil minimum', 'mantıksal dahil en küçük', 'mina'], ['минимум с текстом', 'минимум с логическими', 'мина'], ['min including text', 'mina', 'minimum with logicals'])
  });
  stat.push({
    name: 'MINIFS', tr: 'ÇOKEĞERMİN', ru: 'МИНЕСЛИ', category: 'stat',
    syntax: 'MINIFS(min_range, criteria_range1, criteria1, [criteria_range2, criteria2], ...)',
    args: [
      arg('min_range', 'min_aralığı', 'мин_диапазон', false, 'En küçüğü bulunacak hücreler', 'Ячейки, в которых ищется минимум', 'The cells to find the minimum in'),
      arg('criteria_range1', 'ölçüt_aralığı1', 'диапазон_условия1', false, 'İlk koşulun uygulanacağı aralık', 'Диапазон для первого условия', 'The range for the first condition'),
      arg('criteria1', 'ölçüt1', 'условие1', false, 'İlk koşul', 'Первое условие', 'The first condition'),
      arg('criteria_range2', 'ölçüt_aralığı2', 'диапазон_условия2', true, 'Sonraki koşul aralıkları; en fazla 126 çift', 'Следующие диапазоны условий; до 126 пар', 'Further criteria ranges, up to 126 pairs'),
      arg('criteria2', 'ölçüt2', 'условие2', true, 'Sonraki koşullar', 'Следующие условия', 'Further conditions')],
    desc: t3('Bir veya daha çok koşulu karşılayan hücreler arasındaki en küçük değeri verir.',
             'Возвращает наименьшее значение среди ячеек, удовлетворяющих одному или нескольким условиям.',
             'Returns the smallest value among cells that meet one or more conditions.'),
    example: ex('MINIFS(E2:E200,B2:B200,"Gıda")', 'Kategorisi "Gıda" olan satırlar içindeki en düşük tutar', 'Наименьшая сумма среди строк с категорией "Gıda"', 'Lowest amount among rows with category "Gıda"'),
    keywords: kw(['koşullu minimum', 'şarta göre en küçük', 'eğer minimum', 'kategoriye göre en düşük', 'kriterli en küçük', 'belirli grubun minimumu'],
                 ['минимум по условию', 'минимум если', 'наименьшее по условию', 'минимум по категории', 'условный минимум', 'мин с критерием'],
                 ['min if', 'conditional min', 'minimum by criteria']),
    minVersion: '2019'
  });
  stat.push({
    name: 'MODE.MULT', tr: 'ENÇOK_OLAN.ÇOK', ru: 'МОДА.НСК', category: 'stat',
    syntax: 'MODE.MULT(number1, [number2], ...)',
    args: numList(),
    desc: t3('Veri kümesinde en sık tekrarlanan tüm değerleri dikey bir dizi olarak verir.',
             'Возвращает вертикальный массив всех наиболее часто встречающихся значений набора данных.',
             'Returns a vertical array of all the most frequently occurring values in a data set.'),
    example: ex('MODE.MULT(C2:C200)', 'En sık geçen tüm adet değerlerini listeler', 'Перечисляет все самые частые значения количества', 'Lists all the most common quantity values'),
    keywords: kw(['çoklu mod', 'en sık tekrar eden değerler', 'birden fazla mod', 'en çok tekrarlananlar'], ['несколько мод', 'самые частые значения', 'мода несколько', 'наиболее частые'], ['multiple modes', 'most frequent values', 'all modes']),
    minVersion: '2010'
  });
  stat.push({
    name: 'MODE.SNGL', tr: 'ENÇOK_OLAN.TEK', ru: 'МОДА.ОДН', category: 'stat',
    syntax: 'MODE.SNGL(number1, [number2], ...)',
    args: numList(),
    desc: t3('Veri kümesinde en sık tekrarlanan tek değeri (modu) verir; tekrar yoksa #YOK döner.',
             'Возвращает одно наиболее часто встречающееся значение (моду); если повторов нет — #Н/Д.',
             'Returns the single most frequently occurring value (the mode); #N/A when nothing repeats.'),
    example: ex('MODE.SNGL(C2:C200)', 'En sık geçen adet değerini bulur', 'Находит самое частое значение количества', 'Finds the most common quantity value'),
    keywords: kw(['mod', 'en sık tekrar eden', 'en çok geçen değer', 'en çok tekrarlanan', 'en yaygın değer', 'tepe değer'],
                 ['мода', 'самое частое значение', 'наиболее часто встречается', 'чаще всего', 'самое распространённое', 'модальное значение'],
                 ['mode', 'most frequent value', 'most common']),
    minVersion: '2010'
  });
  stat.push({
    name: 'NEGBINOM.DIST', tr: 'NEGBİNOM.DAĞ', ru: 'ОТРБИНОМ.РАСП', category: 'stat',
    syntax: 'NEGBINOM.DIST(number_f, number_s, probability_s, cumulative)',
    args: [
      arg('number_f', 'başarısızlık_sayısı', 'число_неудач', false, 'Başarısızlık sayısı', 'Количество неудач', 'The number of failures'),
      arg('number_s', 'başarı_sayısı', 'число_успехов', false, 'Hedeflenen başarı sayısı', 'Пороговое число успехов', 'The threshold number of successes'),
      arg('probability_s', 'başarı_olasılığı', 'вероятность_успеха', false, 'Bir denemede başarı olasılığı', 'Вероятность успеха в одном испытании', 'The probability of success on a trial'),
      ARG_CUM],
    desc: t3('Negatif binom dağılımını verir: belirli sayıda başarıdan önce belirli sayıda başarısızlık görülme olasılığı.',
             'Возвращает отрицательное биномиальное распределение — вероятность заданного числа неудач до достижения заданного числа успехов.',
             'Returns the negative binomial distribution: the probability of a given number of failures before a given number of successes.'),
    example: ex('NEGBINOM.DIST(10,5,0.25,FALSE)', '5 başarıdan önce tam 10 başarısızlık görme olasılığı', 'Вероятность ровно 10 неудач до 5 успехов', 'Probability of exactly 10 failures before 5 successes'),
    keywords: kw(['negatif binom dağılımı', 'başarısızlık olasılığı', 'pascal dağılımı'], ['отрицательное биномиальное распределение', 'вероятность неудач', 'распределение паскаля'], ['negative binomial distribution', 'pascal distribution', 'failures before successes']),
    minVersion: '2010'
  });
  stat.push({
    name: 'NORM.DIST', tr: 'NORM.DAĞ', ru: 'НОРМ.РАСП', category: 'stat',
    syntax: 'NORM.DIST(x, mean, standard_dev, cumulative)',
    args: [ARG_X, ARG_MEAN, ARG_SD, ARG_CUM],
    desc: t3('Belirtilen ortalama ve standart sapmaya sahip normal dağılımın yoğunluğunu veya kümülatif olasılığını verir.',
             'Возвращает плотность или интегральную вероятность нормального распределения с заданными средним и стандартным отклонением.',
             'Returns the density or cumulative probability of the normal distribution with the given mean and standard deviation.'),
    example: ex('NORM.DIST(42,40,1.5,TRUE)', 'Ortalama 40, sapma 1,5 iken 42’nin altında kalma olasılığı', 'Вероятность значения ниже 42 при среднем 40 и σ 1,5', 'Probability of being below 42 with mean 40 and σ 1.5'),
    keywords: kw(['normal dağılım', 'çan eğrisi', 'normal olasılık', 'gauss dağılımı', 'kümülatif normal'], ['нормальное распределение', 'колокол гаусса', 'нормальная вероятность', 'распределение гаусса', 'интегральное нормальное'], ['normal distribution', 'bell curve', 'normal probability']),
    minVersion: '2010'
  });
  stat.push({
    name: 'NORM.INV', tr: 'NORM.TERS', ru: 'НОРМ.ОБР', category: 'stat',
    syntax: 'NORM.INV(probability, mean, standard_dev)',
    args: [ARG_PROB, ARG_MEAN, ARG_SD],
    desc: t3('Normal kümülatif dağılımın tersini verir: verilen olasılığa karşılık gelen x değeri.',
             'Возвращает обратную интегральную функцию нормального распределения — x для заданной вероятности.',
             'Returns the inverse of the normal cumulative distribution: the x for a given probability.'),
    example: ex('NORM.INV(0.9,40,1.5)', 'Ortalama 40, sapma 1,5 için %90’lık yüzdelik değeri', '90-й процентиль при среднем 40 и σ 1,5', '90th percentile for mean 40 and σ 1.5'),
    keywords: kw(['ters normal', 'normal kantil', 'normal dağılım tersi', 'yüzdelikten değer'], ['обратное нормальное', 'квантиль нормального', 'норм обр', 'значение по вероятности'], ['inverse normal', 'normal quantile', 'value from probability normal']),
    minVersion: '2010'
  });
  stat.push({
    name: 'NORM.S.DIST', tr: 'NORM.S.DAĞ', ru: 'НОРМ.СТ.РАСП', category: 'stat',
    syntax: 'NORM.S.DIST(z, cumulative)',
    args: [arg('z', 'z', 'z', false, 'Dağılımın değerlendirileceği z değeri', 'Значение z для вычисления распределения', 'The z value to evaluate the distribution at'), ARG_CUM],
    desc: t3('Standart normal dağılımın (ortalama 0, sapma 1) yoğunluğunu veya kümülatif olasılığını verir.',
             'Возвращает плотность или интегральную вероятность стандартного нормального распределения (среднее 0, σ 1).',
             'Returns the density or cumulative probability of the standard normal distribution (mean 0, σ 1).'),
    example: ex('NORM.S.DIST(1.96,TRUE)', 'z=1,96 için kümülatif olasılık ≈ 0,975', 'Интегральная вероятность для z=1,96 ≈ 0,975', 'Cumulative probability for z=1.96 ≈ 0.975'),
    keywords: kw(['standart normal dağılım', 'z olasılığı', 'z tablosu', 'standart normal kümülatif'], ['стандартное нормальное распределение', 'вероятность z', 'таблица z', 'нормированное нормальное'], ['standard normal distribution', 'z probability', 'z table']),
    minVersion: '2010'
  });
  stat.push({
    name: 'NORM.S.INV', tr: 'NORM.S.TERS', ru: 'НОРМ.СТ.ОБР', category: 'stat',
    syntax: 'NORM.S.INV(probability)',
    args: [ARG_PROB],
    desc: t3('Standart normal kümülatif dağılımın tersini (olasılığa karşılık gelen z değerini) verir.',
             'Возвращает обратную интегральную функцию стандартного нормального распределения (z для вероятности).',
             'Returns the inverse of the standard normal cumulative distribution (the z for a probability).'),
    example: ex('NORM.S.INV(0.975)', '0,975 olasılığına karşılık gelen z değeri ≈ 1,96', 'Значение z для вероятности 0,975 ≈ 1,96', 'z value for probability 0.975 ≈ 1.96'),
    keywords: kw(['z değeri', 'ters standart normal', 'z kritik değer', 'olasılıktan z'], ['значение z', 'обратное стандартное нормальное', 'критическое z', 'z по вероятности'], ['z score from probability', 'inverse standard normal', 'z critical value']),
    minVersion: '2010'
  });

  /* =================== P — S =================== */
  stat.push({
    name: 'PEARSON', tr: 'PEARSON', ru: 'ПИРСОН', category: 'stat',
    syntax: 'PEARSON(array1, array2)',
    args: [
      arg('array1', 'dizi1', 'массив1', false, 'Bağımsız değerler kümesi', 'Набор независимых значений', 'The set of independent values'),
      arg('array2', 'dizi2', 'массив2', false, 'Bağımlı değerler kümesi (aynı boyutta)', 'Набор зависимых значений (того же размера)', 'The set of dependent values (same size)')],
    desc: t3('Pearson çarpım-moment korelasyon katsayısını (−1 ile 1 arası) verir; KORELASYON ile aynı sonucu üretir.',
             'Возвращает коэффициент корреляции Пирсона (от −1 до 1); результат совпадает с КОРРЕЛ.',
             'Returns the Pearson product-moment correlation coefficient (−1 to 1); same result as CORREL.'),
    example: ex('PEARSON(C2:C200,E2:E200)', 'Adet ile tutar arasındaki Pearson korelasyonu', 'Корреляция Пирсона между количеством и суммой', 'Pearson correlation between quantity and amount'),
    keywords: kw(['pearson korelasyonu', 'pearson katsayısı', 'doğrusal ilişki katsayısı'], ['корреляция пирсона', 'коэффициент пирсона', 'линейная связь'], ['pearson correlation', 'pearson coefficient', 'linear relationship'])
  });
  stat.push({
    name: 'PERCENTILE.EXC', tr: 'YÜZDEBİRLİK.HRC', ru: 'ПРОЦЕНТИЛЬ.ИСКЛ', category: 'stat',
    syntax: 'PERCENTILE.EXC(array, k)',
    args: [ARG_ARRAY,
      arg('k', 'k', 'k', false, 'Yüzdelik değeri, 0 ile 1 arasında (sınırlar hariç)', 'Значение процентиля от 0 до 1, не включая границы', 'The percentile value between 0 and 1, exclusive')],
    desc: t3('Aralıktaki değerlerin k’ıncı yüzdeliğini verir; k 0 ve 1 hariç (0;1) aralığında olmalıdır.',
             'Возвращает k-й процентиль значений диапазона; k должно быть строго между 0 и 1.',
             'Returns the k-th percentile of the values in a range; k must be strictly between 0 and 1.'),
    example: ex('PERCENTILE.EXC(E2:E200,0.9)', 'Tutarların %90’lık yüzdeliği (dışlayıcı yöntem)', '90-й процентиль сумм (исключающий метод)', '90th percentile of amounts (exclusive method)'),
    keywords: kw(['yüzdelik', 'yüzdelik dilim hariç', 'persantil', '90. yüzdelik'], ['процентиль', 'процентиль исключающий', 'перцентиль', '90-й процентиль'], ['percentile exclusive', 'percentile', 'nth percentile exclusive']),
    minVersion: '2010'
  });
  stat.push({
    name: 'PERCENTILE.INC', tr: 'YÜZDEBİRLİK.DHL', ru: 'ПРОЦЕНТИЛЬ.ВКЛ', category: 'stat',
    syntax: 'PERCENTILE.INC(array, k)',
    args: [ARG_ARRAY,
      arg('k', 'k', 'k', false, 'Yüzdelik değeri, 0 ile 1 arasında (sınırlar dahil)', 'Значение процентиля от 0 до 1 включительно', 'The percentile value between 0 and 1, inclusive')],
    desc: t3('Aralıktaki değerlerin k’ıncı yüzdeliğini verir; k 0 ile 1 arasında (sınırlar dahil) olabilir.',
             'Возвращает k-й процентиль значений диапазона; k может быть от 0 до 1 включительно.',
             'Returns the k-th percentile of the values in a range; k may be from 0 to 1 inclusive.'),
    example: ex('PERCENTILE.INC(E2:E200,0.9)', 'Tutarların %90’lık yüzdeliği', '90-й процентиль сумм', '90th percentile of amounts'),
    keywords: kw(['yüzdelik', 'yüzdelik dilim', 'persantil', '95. yüzdelik', 'yüzde kaçlık dilim'], ['процентиль', 'процентиль включающий', 'перцентиль', '95-й процентиль', 'процентный уровень'], ['percentile', 'percentile inclusive', 'nth percentile']),
    minVersion: '2010'
  });
  stat.push({
    name: 'PERCENTRANK.EXC', tr: 'YÜZDERANK.HRC', ru: 'ПРОЦЕНТРАНГ.ИСКЛ', category: 'stat',
    syntax: 'PERCENTRANK.EXC(array, x, [significance])',
    args: [ARG_ARRAY,
      arg('x', 'x', 'x', false, 'Sırası bulunacak değer', 'Значение, ранг которого нужно найти', 'The value to rank'),
      arg('significance', 'anlam', 'разрядность', true, 'Sonuçtaki anlamlı basamak sayısı; varsayılan 3', 'Число значащих цифр результата; по умолчанию 3', 'Number of significant digits; default 3')],
    desc: t3('Bir değerin veri kümesindeki yüzdelik sırasını (0 ve 1 hariç) verir.',
             'Возвращает процентный ранг значения в наборе данных (от 0 до 1, не включая границы).',
             'Returns the percentage rank of a value in a data set (exclusive of 0 and 1).'),
    example: ex('PERCENTRANK.EXC(E2:E200,E2)', 'E2 tutarının diğerlerine göre yüzdelik sırası', 'Процентный ранг суммы в E2 среди остальных', 'Percentage rank of the amount in E2 among the rest'),
    keywords: kw(['yüzdelik sıra', 'yüzde sıralaması hariç', 'değerin yüzdelik konumu'], ['процентный ранг', 'процентранг исключающий', 'положение в процентах'], ['percent rank exclusive', 'percentile rank', 'relative standing exclusive']),
    minVersion: '2010'
  });
  stat.push({
    name: 'PERCENTRANK.INC', tr: 'YÜZDERANK.DHL', ru: 'ПРОЦЕНТРАНГ.ВКЛ', category: 'stat',
    syntax: 'PERCENTRANK.INC(array, x, [significance])',
    args: [ARG_ARRAY,
      arg('x', 'x', 'x', false, 'Sırası bulunacak değer', 'Значение, ранг которого нужно найти', 'The value to rank'),
      arg('significance', 'anlam', 'разрядность', true, 'Sonuçtaki anlamlı basamak sayısı; varsayılan 3', 'Число значащих цифр результата; по умолчанию 3', 'Number of significant digits; default 3')],
    desc: t3('Bir değerin veri kümesindeki yüzdelik sırasını (0 ile 1 dahil) verir.',
             'Возвращает процентный ранг значения в наборе данных (от 0 до 1 включительно).',
             'Returns the percentage rank of a value in a data set (inclusive of 0 and 1).'),
    example: ex('PERCENTRANK.INC(E2:E200,E2)', 'E2 tutarının yüzdelik sırası; en büyük 1, en küçük 0 olur', 'Процентный ранг суммы E2; максимум даёт 1, минимум — 0', 'Percentage rank of E2; the largest gives 1, the smallest 0'),
    keywords: kw(['yüzdelik sıra', 'yüzde sıralaması', 'değer yüzde kaçta', 'yüzdelik konum'], ['процентный ранг', 'процентранг', 'в каком проценте значение', 'процентная позиция'], ['percent rank', 'percentile rank inclusive', 'relative standing']),
    minVersion: '2010'
  });
  stat.push({
    name: 'PERMUT', tr: 'PERMÜTASYON', ru: 'ПЕРЕСТ', category: 'stat',
    syntax: 'PERMUT(number, number_chosen)',
    args: [
      arg('number', 'sayı', 'число', false, 'Toplam nesne sayısı', 'Общее число объектов', 'The total number of objects'),
      arg('number_chosen', 'seçilen_sayı', 'число_выбранных', false, 'Her permütasyondaki nesne sayısı', 'Число объектов в каждой перестановке', 'The number of objects in each permutation')],
    desc: t3('n nesneden k tanesinin sıralı, tekrarsız seçim (permütasyon) sayısını verir.',
             'Возвращает число упорядоченных выборок (перестановок) k объектов из n без повторений.',
             'Returns the number of ordered selections (permutations) of k objects from n without repetition.'),
    example: ex('PERMUT(10,3)', '10 kişiden sıralı 3 kişilik dizilim sayısı = 720', 'Число упорядоченных троек из 10 человек = 720', 'Ordered arrangements of 3 out of 10 people = 720'),
    keywords: kw(['permütasyon', 'sıralı seçim sayısı', 'dizilim sayısı', 'kaç farklı sıralama'], ['перестановки', 'число размещений', 'упорядоченные выборки', 'сколько вариантов порядка'], ['permutations', 'ordered arrangements', 'number of permutations'])
  });
  stat.push({
    name: 'PERMUTATIONA', tr: 'PERMÜTASYONA', ru: 'ПЕРЕСТА', category: 'stat',
    syntax: 'PERMUTATIONA(number, number_chosen)',
    args: [
      arg('number', 'sayı', 'число', false, 'Toplam nesne sayısı', 'Общее число объектов', 'The total number of objects'),
      arg('number_chosen', 'seçilen_sayı', 'число_выбранных', false, 'Her permütasyondaki nesne sayısı', 'Число объектов в каждой перестановке', 'The number of objects in each permutation')],
    desc: t3('Tekrara izin veren permütasyon sayısını (n^k) verir.',
             'Возвращает число перестановок с повторениями (n^k).',
             'Returns the number of permutations with repetition allowed (n^k).'),
    example: ex('PERMUTATIONA(10,3)', '10 rakamla oluşturulabilecek 3 haneli kod sayısı = 1000', 'Число трёхзначных кодов из 10 цифр = 1000', 'Number of 3-digit codes from 10 digits = 1000'),
    keywords: kw(['tekrarlı permütasyon', 'tekrarlı dizilim', 'kod kombinasyonu sayısı'], ['перестановки с повторениями', 'размещения с повторениями', 'число кодов'], ['permutations with repetition', 'permutationa', 'arrangements with repetition']),
    minVersion: '2013'
  });
  stat.push({
    name: 'PHI', tr: 'PHI', ru: 'ФИ', category: 'stat',
    syntax: 'PHI(x)',
    args: [arg('x', 'x', 'x', false, 'Yoğunluğu hesaplanacak değer', 'Значение, для которого вычисляется плотность', 'The value to compute the density for')],
    desc: t3('Standart normal dağılımın x noktasındaki yoğunluk fonksiyonu değerini verir.',
             'Возвращает значение функции плотности стандартного нормального распределения в точке x.',
             'Returns the value of the standard normal density function at x.'),
    example: ex('PHI(0)', 'Standart normal yoğunluğun tepe değeri ≈ 0,3989', 'Пик плотности стандартного нормального ≈ 0,3989', 'Peak of the standard normal density ≈ 0.3989'),
    keywords: kw(['standart normal yoğunluk', 'phi fonksiyonu', 'çan eğrisi yüksekliği'], ['плотность стандартного нормального', 'функция фи', 'высота колокола'], ['standard normal density', 'phi function', 'bell curve height']),
    minVersion: '2013'
  });
  stat.push({
    name: 'POISSON.DIST', tr: 'POISSON.DAĞ', ru: 'ПУАССОН.РАСП', category: 'stat',
    syntax: 'POISSON.DIST(x, mean, cumulative)',
    args: [arg('x', 'x', 'x', false, 'Olay sayısı', 'Количество событий', 'The number of events'),
      arg('mean', 'ortalama', 'среднее', false, 'Beklenen olay sayısı (lambda)', 'Ожидаемое число событий (лямбда)', 'The expected number of events (lambda)'),
      ARG_CUM],
    desc: t3('Poisson dağılımını verir: belirli bir sürede belirli sayıda olay gerçekleşme olasılığı.',
             'Возвращает распределение Пуассона — вероятность заданного числа событий за период.',
             'Returns the Poisson distribution: the probability of a given number of events in a period.'),
    example: ex('POISSON.DIST(2,5,FALSE)', 'Ortalama 5 iken tam 2 olay gerçekleşme olasılığı', 'Вероятность ровно 2 событий при среднем 5', 'Probability of exactly 2 events when the mean is 5'),
    keywords: kw(['poisson dağılımı', 'olay sayısı olasılığı', 'nadir olay olasılığı', 'çağrı sayısı olasılığı'], ['распределение пуассона', 'вероятность числа событий', 'редкие события', 'поток событий'], ['poisson distribution', 'event count probability', 'rare events probability']),
    minVersion: '2010'
  });
  stat.push({
    name: 'PROB', tr: 'OLASILIK', ru: 'ВЕРОЯТНОСТЬ', category: 'stat',
    syntax: 'PROB(x_range, prob_range, [lower_limit], [upper_limit])',
    args: [
      arg('x_range', 'x_aralığı', 'x_интервал', false, 'Olasılıkları olan x değerleri', 'Значения x, которым сопоставлены вероятности', 'The x values that have probabilities'),
      arg('prob_range', 'olasılık_aralığı', 'интервал_вероятностей', false, 'x değerlerine karşılık gelen olasılıklar (toplamı 1)', 'Вероятности, соответствующие значениям x (в сумме 1)', 'The probabilities for the x values (summing to 1)'),
      arg('lower_limit', 'alt_sınır', 'нижний_предел', true, 'Olasılığı istenen aralığın alt sınırı', 'Нижняя граница интервала', 'The lower bound of the interval'),
      arg('upper_limit', 'üst_sınır', 'верхний_предел', true, 'Üst sınır; atlanırsa yalnızca alt sınıra eşit değerin olasılığı döner', 'Верхняя граница; если опущена, возвращается вероятность значения, равного нижней границе', 'The upper bound; when omitted, the probability of the value equal to the lower bound')],
    desc: t3('Bir aralıktaki değerlerin iki sınır arasında olma olasılığını (kesikli dağılım) verir.',
             'Возвращает вероятность того, что значения диапазона попадут между двумя границами (дискретное распределение).',
             'Returns the probability that values in a range fall between two limits (discrete distribution).'),
    example: ex('PROB(A2:A5,B2:B5,2,3)', 'x değerinin 2 ile 3 arasında olma olasılığı', 'Вероятность того, что x между 2 и 3', 'Probability that x is between 2 and 3'),
    keywords: kw(['olasılık', 'aralık olasılığı', 'kesikli olasılık', 'iki sınır arası olasılık'], ['вероятность', 'вероятность интервала', 'дискретная вероятность', 'вероятность между границами'], ['probability', 'probability between limits', 'discrete probability'])
  });
  stat.push({
    name: 'QUARTILE.EXC', tr: 'DÖRTTEBİRLİK.HRC', ru: 'КВАРТИЛЬ.ИСКЛ', category: 'stat',
    syntax: 'QUARTILE.EXC(array, quart)',
    args: [ARG_ARRAY,
      arg('quart', 'dörttebirlik', 'часть', false, 'İstenen çeyrek: 1 ilk çeyrek, 2 ortanca, 3 üçüncü çeyrek', 'Нужный квартиль: 1 — первый, 2 — медиана, 3 — третий', 'The quartile wanted: 1 first, 2 median, 3 third')],
    desc: t3('Veri kümesinin çeyrekliğini dışlayıcı yöntemle (0 ve 1 yüzdelikleri hariç) verir.',
             'Возвращает квартиль набора данных исключающим методом (процентили 0 и 1 не включаются).',
             'Returns the quartile of a data set using the exclusive method (percentiles 0 and 1 excluded).'),
    example: ex('QUARTILE.EXC(E2:E200,3)', 'Tutarların üçüncü çeyreği (dışlayıcı)', 'Третий квартиль сумм (исключающий)', 'Third quartile of amounts (exclusive)'),
    keywords: kw(['çeyreklik hariç', 'dörttebirlik', 'üçüncü çeyrek', 'çeyrek değer'], ['квартиль исключающий', 'квартиль', 'третий квартиль', 'четверть выборки'], ['quartile exclusive', 'quartile', 'third quartile']),
    minVersion: '2010'
  });
  stat.push({
    name: 'QUARTILE.INC', tr: 'DÖRTTEBİRLİK.DHL', ru: 'КВАРТИЛЬ.ВКЛ', category: 'stat',
    syntax: 'QUARTILE.INC(array, quart)',
    args: [ARG_ARRAY,
      arg('quart', 'dörttebirlik', 'часть', false, 'İstenen çeyrek: 0 minimum, 1 ilk çeyrek, 2 ortanca, 3 üçüncü çeyrek, 4 maksimum', 'Нужный квартиль: 0 — минимум, 1 — первый, 2 — медиана, 3 — третий, 4 — максимум', 'The quartile wanted: 0 minimum, 1 first, 2 median, 3 third, 4 maximum')],
    desc: t3('Veri kümesinin çeyrekliğini kapsayıcı yöntemle (0 ile 1 yüzdelikleri dahil) verir.',
             'Возвращает квартиль набора данных включающим методом (процентили от 0 до 1 включительно).',
             'Returns the quartile of a data set using the inclusive method (percentiles 0 to 1 included).'),
    example: ex('QUARTILE.INC(E2:E200,1)', 'Tutarların ilk çeyreği (%25 yüzdelik)', 'Первый квартиль сумм (25-й процентиль)', 'First quartile of amounts (25th percentile)'),
    keywords: kw(['çeyreklik', 'dörttebirlik', 'ilk çeyrek', 'çeyrek değer', 'çeyrekler arası'], ['квартиль', 'квартиль включающий', 'первый квартиль', 'четверть данных', 'межквартильный'], ['quartile', 'quartile inclusive', 'first quartile']),
    minVersion: '2010'
  });
  stat.push({
    name: 'RANK.AVG', tr: 'RANK.ORT', ru: 'РАНГ.СР', category: 'stat',
    syntax: 'RANK.AVG(number, ref, [order])',
    args: [
      arg('number', 'sayı', 'число', false, 'Sırası bulunacak sayı', 'Число, ранг которого нужно найти', 'The number whose rank you want'),
      arg('ref', 'başv', 'ссылка', false, 'Sıralamanın yapılacağı sayı listesi (aralık)', 'Список чисел (диапазон), по которому определяется ранг', 'The list of numbers (range) to rank within'),
      arg('order', 'sıra', 'порядок', true, '0 veya atlanırsa azalan (en büyük 1), 0 dışı ise artan (en küçük 1)', '0 или опущено — по убыванию (наибольшее = 1), иначе по возрастанию (наименьшее = 1)', '0 or omitted ranks descending (largest = 1), non-zero ascending (smallest = 1)')],
    desc: t3('Bir sayının listedeki sırasını verir; eşit değerler ortalama sırayı alır.',
             'Возвращает ранг числа в списке; одинаковым значениям присваивается средний ранг.',
             'Returns the rank of a number in a list; ties receive the average rank.'),
    example: ex('RANK.AVG(E2,$E$2:$E$200,0)', 'E2 tutarının büyükten küçüğe sırası; eşitler ortalama sıra alır', 'Ранг суммы E2 по убыванию; при равенстве — средний ранг', 'Rank of E2 descending; ties get the average rank'),
    keywords: kw(['sıralama ortalama', 'eşitlerde ortalama sıra', 'kaçıncı sırada ortalama', 'rank ortalama', 'sıra numarası eşit paylaşım'],
                 ['ранг средний', 'средний ранг при равенстве', 'какое место среднее', 'ранжирование средний', 'место в рейтинге'],
                 ['rank average', 'average rank for ties', 'ranking']),
    minVersion: '2010'
  });
  stat.push({
    name: 'RANK.EQ', tr: 'RANK.EŞİT', ru: 'РАНГ.РВ', category: 'stat',
    syntax: 'RANK.EQ(number, ref, [order])',
    args: [
      arg('number', 'sayı', 'число', false, 'Sırası bulunacak sayı', 'Число, ранг которого нужно найти', 'The number whose rank you want'),
      arg('ref', 'başv', 'ссылка', false, 'Sıralamanın yapılacağı sayı listesi (aralık)', 'Список чисел (диапазон), по которому определяется ранг', 'The list of numbers (range) to rank within'),
      arg('order', 'sıra', 'порядок', true, '0 veya atlanırsa azalan (en büyük 1), 0 dışı ise artan (en küçük 1)', '0 или опущено — по убыванию (наибольшее = 1), иначе по возрастанию (наименьшее = 1)', '0 or omitted ranks descending (largest = 1), non-zero ascending (smallest = 1)')],
    desc: t3('Bir sayının listedeki sırasını verir; eşit değerler aynı (en üst) sırayı alır.',
             'Возвращает ранг числа в списке; одинаковым значениям присваивается один и тот же (высший) ранг.',
             'Returns the rank of a number in a list; ties receive the same (top) rank.'),
    example: ex('RANK.EQ(E2,$E$2:$E$200,0)', 'E2 tutarının büyükten küçüğe sırası (1 = en yüksek)', 'Ранг суммы E2 по убыванию (1 = наибольшая)', 'Rank of E2 descending (1 = highest)'),
    keywords: kw(['sıralama', 'sıra numarası', 'kaçıncı sırada', 'rank', 'büyükten küçüğe sıra', 'küçükten büyüğe sıra', 'sıralamada kaçıncı', 'puan sıralaması'],
                 ['ранг', 'ранжирование', 'какое место', 'место в списке', 'ранг по убыванию', 'ранг по возрастанию', 'порядковый номер по величине', 'рейтинг'],
                 ['rank', 'ranking', 'position in list', 'rank descending', 'rank ascending']),
    minVersion: '2010'
  });
  stat.push({
    name: 'RSQ', tr: 'RKARE', ru: 'КВПИРСОН', category: 'stat',
    syntax: "RSQ(known_y's, known_x's)",
    args: [ARG_KNOWN_Y, ARG_KNOWN_X],
    desc: t3('Pearson korelasyon katsayısının karesini (R², belirleme katsayısı) verir.',
             'Возвращает квадрат коэффициента корреляции Пирсона (R², коэффициент детерминации).',
             'Returns the square of the Pearson correlation coefficient (R², coefficient of determination).'),
    example: ex('RSQ(E2:E200,C2:C200)', 'Tutar-adet regresyonunun R² değeri', 'R² регрессии суммы по количеству', 'R² of the amount-vs-quantity regression'),
    keywords: kw(['r kare', 'belirleme katsayısı', 'açıklama gücü', 'regresyon uyumu'], ['r квадрат', 'коэффициент детерминации', 'квадрат корреляции', 'качество регрессии'], ['r squared', 'coefficient of determination', 'regression fit'])
  });
  stat.push({
    name: 'SKEW', tr: 'ÇARPIKLIK', ru: 'СКОС', category: 'stat',
    syntax: 'SKEW(number1, [number2], ...)',
    args: numList(),
    desc: t3('Dağılımın örneklem çarpıklığını verir; ortalama etrafındaki asimetrinin derecesini ölçer.',
             'Возвращает выборочную асимметрию распределения — степень несимметричности относительно среднего.',
             'Returns the sample skewness of a distribution, the degree of asymmetry around the mean.'),
    example: ex('SKEW(E2:E200)', 'Tutar dağılımının çarpıklığı', 'Асимметрия распределения сумм', 'Skewness of the amount distribution'),
    keywords: kw(['çarpıklık', 'asimetri', 'dağılım eğikliği', 'skewness'], ['асимметрия', 'скос', 'коэффициент асимметрии', 'перекос распределения'], ['skewness', 'asymmetry', 'skew of distribution'])
  });
  stat.push({
    name: 'SKEW.P', tr: 'ÇARPIKLIK.P', ru: 'СКОС.Г', category: 'stat',
    syntax: 'SKEW.P(number1, [number2], ...)',
    args: numList(),
    desc: t3('Dağılımın popülasyon çarpıklığını verir.',
             'Возвращает асимметрию распределения по генеральной совокупности.',
             'Returns the population skewness of a distribution.'),
    example: ex('SKEW.P(E2:E200)', 'Tüm popülasyon olarak tutarların çarpıklığı', 'Асимметрия сумм как генеральной совокупности', 'Skewness of amounts as a population'),
    keywords: kw(['popülasyon çarpıklığı', 'çarpıklık p', 'asimetri popülasyon'], ['асимметрия генеральной совокупности', 'скос г', 'асимметрия по совокупности'], ['population skewness', 'skew p', 'population asymmetry']),
    minVersion: '2013'
  });
  stat.push({
    name: 'SLOPE', tr: 'EĞİM', ru: 'НАКЛОН', category: 'stat',
    syntax: "SLOPE(known_y's, known_x's)",
    args: [ARG_KNOWN_Y, ARG_KNOWN_X],
    desc: t3('Bilinen x-y noktalarından geçen doğrusal regresyon doğrusunun eğimini verir.',
             'Возвращает наклон линии линейной регрессии по известным точкам x-y.',
             'Returns the slope of the linear regression line through the known x-y points.'),
    example: ex('SLOPE(E2:E200,C2:C200)', 'Adet başına tutar artışı (regresyon eğimi)', 'Прирост суммы на единицу количества (наклон регрессии)', 'Increase in amount per unit of quantity (regression slope)'),
    keywords: kw(['eğim', 'regresyon eğimi', 'doğrunun eğimi', 'eğilim katsayısı', 'artış hızı'], ['наклон', 'наклон регрессии', 'угловой коэффициент', 'коэффициент тренда', 'скорость роста'], ['slope', 'regression slope', 'trend coefficient'])
  });

  /* =================== S — Z =================== */
  stat.push({
    name: 'SMALL', tr: 'KÜÇÜK', ru: 'НАИМЕНЬШИЙ', category: 'stat',
    syntax: 'SMALL(array, k)',
    args: [ARG_ARRAY,
      arg('k', 'k', 'k', false, 'İstenen sıra: 1 en küçük, 2 ikinci en küçük…', 'Позиция: 1 — наименьшее, 2 — второе по малости…', 'The position: 1 for the smallest, 2 for the second smallest…')],
    desc: t3('Veri kümesindeki k’ıncı en küçük değeri verir.',
             'Возвращает k-е наименьшее значение в наборе данных.',
             'Returns the k-th smallest value in a data set.'),
    example: ex('SMALL(E2:E200,3)', 'Tutarlar içindeki üçüncü en küçük değer', 'Третье наименьшее значение среди сумм', 'The third smallest amount'),
    keywords: kw(['en küçük', 'ikinci en küçük', 'üçüncü en küçük', 'k’ıncı en küçük', 'en düşük n değer', 'sıradaki en küçük', 'en küçük kaçıncı', 'sıfırdan farklı en küçük'],
                 ['наименьший', 'второй по малости', 'третье наименьшее', 'k-й наименьший', 'n наименьших значений', 'n-е наименьшее', 'самое маленькое после минимума', 'нижние n'],
                 ['smallest', 'second smallest', 'k-th smallest', 'bottom n values', 'nth lowest'])
  });
  stat.push({
    name: 'STANDARDIZE', tr: 'STANDARTLAŞTIRMA', ru: 'НОРМАЛИЗАЦИЯ', category: 'stat',
    syntax: 'STANDARDIZE(x, mean, standard_dev)',
    args: [arg('x', 'x', 'x', false, 'Normalleştirilecek değer', 'Нормализуемое значение', 'The value to normalize'), ARG_MEAN, ARG_SD],
    desc: t3('Değerin z puanını, yani ortalamadan kaç standart sapma uzakta olduğunu verir: (x − ortalama) / sapma.',
             'Возвращает z-оценку значения — на сколько стандартных отклонений оно отстоит от среднего: (x − среднее) / σ.',
             'Returns the z-score of a value, how many standard deviations it is from the mean: (x − mean) / σ.'),
    example: ex('STANDARDIZE(E2,AVERAGE($E$2:$E$200),STDEV.S($E$2:$E$200))', 'E2 tutarının z puanı', 'z-оценка суммы в E2', 'z-score of the amount in E2'),
    keywords: kw(['z puanı', 'standartlaştır', 'normalleştir', 'standart skor', 'ortalamadan kaç sapma'], ['z-оценка', 'нормализация', 'стандартизировать', 'z-значение', 'сколько сигм от среднего'], ['z-score', 'standardize', 'normalize value'])
  });
  stat.push({
    name: 'STDEV.P', tr: 'STDSAPMA.P', ru: 'СТАНДОТКЛОН.Г', category: 'stat',
    syntax: 'STDEV.P(number1, [number2], ...)',
    args: numList(),
    desc: t3('Tüm popülasyonun standart sapmasını verir (n’e böler); metin ve mantıksal değerler yok sayılır.',
             'Возвращает стандартное отклонение по генеральной совокупности (деление на n); текст и логические значения игнорируются.',
             'Returns the standard deviation of an entire population (divides by n); text and logicals are ignored.'),
    example: ex('STDEV.P(E2:E200)', 'Tutarların popülasyon standart sapması', 'Стандартное отклонение сумм по генеральной совокупности', 'Population standard deviation of amounts'),
    keywords: kw(['popülasyon standart sapması', 'standart sapma p', 'tüm veri sapması', 'anakütle sapması'], ['стандартное отклонение генеральной совокупности', 'стандотклон г', 'сигма по всей совокупности', 'отклонение популяции'], ['population standard deviation', 'stdev p', 'population sigma']),
    minVersion: '2010'
  });
  stat.push({
    name: 'STDEV.S', tr: 'STDSAPMA.S', ru: 'СТАНДОТКЛОН.В', category: 'stat',
    syntax: 'STDEV.S(number1, [number2], ...)',
    args: numList(),
    desc: t3('Örneklem standart sapmasını verir (n−1’e böler); metin ve mantıksal değerler yok sayılır.',
             'Возвращает выборочное стандартное отклонение (деление на n−1); текст и логические значения игнорируются.',
             'Returns the sample standard deviation (divides by n−1); text and logicals are ignored.'),
    example: ex('STDEV.S(E2:E200)', 'Tutarların örneklem standart sapması', 'Выборочное стандартное отклонение сумм', 'Sample standard deviation of amounts'),
    keywords: kw(['standart sapma', 'örneklem standart sapması', 'sapma hesapla', 'dağılım ölçüsü', 'sigma', 'verilerin yayılımı'], ['стандартное отклонение', 'выборочное отклонение', 'среднеквадратичное отклонение', 'сигма', 'разброс данных', 'посчитать отклонение'], ['standard deviation', 'sample standard deviation', 'sigma', 'spread']),
    minVersion: '2010'
  });
  stat.push({
    name: 'STDEVA', tr: 'STDSAPMAA', ru: 'СТАНДОТКЛОНА', category: 'stat',
    syntax: 'STDEVA(value1, [value2], ...)',
    args: valList(),
    desc: t3('Metin ve mantıksal değerleri de hesaba katarak örneklem standart sapmasını verir; metin 0, DOĞRU 1 sayılır.',
             'Возвращает выборочное стандартное отклонение с учётом текста и логических значений: текст — 0, ИСТИНА — 1.',
             'Returns the sample standard deviation including text and logicals; text counts as 0, TRUE as 1.'),
    example: ex('STDEVA(C2:C200)', 'C2:C200 örneklem sapması, metinler 0 sayılır', 'Выборочное отклонение C2:C200, текст считается нулём', 'Sample deviation of C2:C200 with text as 0'),
    keywords: kw(['metin dahil standart sapma', 'mantıksal dahil sapma', 'stdsapmaa'], ['стандартное отклонение с текстом', 'отклонение с логическими', 'стандотклона'], ['standard deviation including text', 'stdeva', 'stdev with logicals'])
  });
  stat.push({
    name: 'STDEVPA', tr: 'STDSAPMASA', ru: 'СТАНДОТКЛОНПА', category: 'stat',
    syntax: 'STDEVPA(value1, [value2], ...)',
    args: valList(),
    desc: t3('Metin ve mantıksal değerleri de hesaba katarak popülasyon standart sapmasını verir; metin 0, DOĞRU 1 sayılır.',
             'Возвращает стандартное отклонение генеральной совокупности с учётом текста и логических значений: текст — 0, ИСТИНА — 1.',
             'Returns the population standard deviation including text and logicals; text counts as 0, TRUE as 1.'),
    example: ex('STDEVPA(C2:C200)', 'C2:C200 popülasyon sapması, metinler 0 sayılır', 'Отклонение совокупности C2:C200, текст считается нулём', 'Population deviation of C2:C200 with text as 0'),
    keywords: kw(['metin dahil popülasyon sapması', 'stdsapmasa', 'tüm veri sapması metinli'], ['отклонение совокупности с текстом', 'стандотклонпа', 'сигма совокупности с текстом'], ['population standard deviation including text', 'stdevpa', 'population stdev with text'])
  });
  stat.push({
    name: 'STEYX', tr: 'STHYX', ru: 'СТОШYX', category: 'stat',
    syntax: "STEYX(known_y's, known_x's)",
    args: [ARG_KNOWN_Y, ARG_KNOWN_X],
    desc: t3('Regresyonda her x için tahmin edilen y değerinin standart hatasını verir.',
             'Возвращает стандартную ошибку предсказанных значений y для каждого x в регрессии.',
             'Returns the standard error of the predicted y value for each x in the regression.'),
    example: ex('STEYX(E2:E200,C2:C200)', 'Tutar-adet regresyonunun standart hatası', 'Стандартная ошибка регрессии суммы по количеству', 'Standard error of the amount-vs-quantity regression'),
    keywords: kw(['regresyon standart hatası', 'tahmin hatası', 'standart hata y'], ['стандартная ошибка регрессии', 'ошибка предсказания', 'стандартная ошибка y'], ['standard error of regression', 'steyx', 'prediction error']),
    uncertain: ['ru']
  });
  stat.push({
    name: 'T.DIST', tr: 'T.DAĞ', ru: 'СТЬЮДЕНТ.РАСП', category: 'stat',
    syntax: 'T.DIST(x, deg_freedom, cumulative)',
    args: [ARG_X, ARG_DF, ARG_CUM],
    desc: t3('Student t dağılımının sol kuyruk (kümülatif) olasılığını veya yoğunluğunu verir.',
             'Возвращает левостороннюю (интегральную) вероятность или плотность t-распределения Стьюдента.',
             'Returns the left-tailed (cumulative) probability or density of the Student t distribution.'),
    example: ex('T.DIST(1.5,10,TRUE)', '10 sd için t=1,5 sol kuyruk olasılığı', 'Левосторонняя вероятность t=1,5 при 10 ст. св.', 'Left-tailed probability of t=1.5 with 10 df'),
    keywords: kw(['t dağılımı', 'student t', 't olasılığı', 't sol kuyruk'], ['распределение стьюдента', 't-распределение', 'вероятность t', 'стьюдент левосторонняя'], ['t distribution', 'student t', 't probability']),
    minVersion: '2010'
  });
  stat.push({
    name: 'T.DIST.2T', tr: 'T.DAĞ.2K', ru: 'СТЬЮДЕНТ.РАСП.2Х', category: 'stat',
    syntax: 'T.DIST.2T(x, deg_freedom)',
    args: [arg('x', 'x', 'x', false, 'Dağılımın değerlendirileceği değer (negatif olmayan)', 'Значение для вычисления распределения (неотрицательное)', 'The value to evaluate the distribution at (non-negative)'), ARG_DF],
    desc: t3('Student t dağılımının çift kuyruklu olasılığını verir.',
             'Возвращает двустороннюю вероятность t-распределения Стьюдента.',
             'Returns the two-tailed probability of the Student t distribution.'),
    example: ex('T.DIST.2T(2.228,10)', '10 sd için t=2,228 çift kuyruk olasılığı (≈0,05)', 'Двусторонняя вероятность t=2,228 при 10 ст. св. (≈0,05)', 'Two-tailed probability of t=2.228 with 10 df (≈0.05)'),
    keywords: kw(['t çift kuyruk', 'iki yönlü t olasılığı', 't testi p değeri çift'], ['t двусторонняя', 'двухсторонняя вероятность t', 'p-значение t двустороннее'], ['t distribution two-tailed', 'two-tailed t p-value', 'two-tailed t probability']),
    minVersion: '2010'
  });
  stat.push({
    name: 'T.DIST.RT', tr: 'T.DAĞ.SAĞK', ru: 'СТЬЮДЕНТ.РАСП.ПХ', category: 'stat',
    syntax: 'T.DIST.RT(x, deg_freedom)',
    args: [ARG_X, ARG_DF],
    desc: t3('Student t dağılımının sağ kuyruk olasılığını verir.',
             'Возвращает правостороннюю вероятность t-распределения Стьюдента.',
             'Returns the right-tailed probability of the Student t distribution.'),
    example: ex('T.DIST.RT(1.812,10)', '10 sd için t=1,812 sağ kuyruk olasılığı (≈0,05)', 'Правосторонняя вероятность t=1,812 при 10 ст. св. (≈0,05)', 'Right-tailed probability of t=1.812 with 10 df (≈0.05)'),
    keywords: kw(['t sağ kuyruk', 'tek yönlü t olasılığı', 't testi p değeri tek'], ['t правосторонняя', 'односторонняя вероятность t', 'p-значение t одностороннее'], ['t distribution right-tailed', 'one-tailed t p-value', 'right-tailed t probability']),
    minVersion: '2010'
  });
  stat.push({
    name: 'T.INV', tr: 'T.TERS', ru: 'СТЬЮДЕНТ.ОБР', category: 'stat',
    syntax: 'T.INV(probability, deg_freedom)',
    args: [ARG_PROB, ARG_DF],
    desc: t3('Student t dağılımının sol kuyruk tersini (olasılığa karşılık gelen t değerini) verir.',
             'Возвращает левостороннее обратное значение t-распределения Стьюдента (t для вероятности).',
             'Returns the left-tailed inverse of the Student t distribution (the t for a probability).'),
    example: ex('T.INV(0.05,10)', 'Sol kuyruk olasılığı 0,05 olan t değeri (10 sd, ≈−1,812)', 'Значение t с левосторонней вероятностью 0,05 (10 ст. св., ≈−1,812)', 't value with left-tailed probability 0.05 (10 df, ≈−1.812)'),
    keywords: kw(['ters t', 't kantil', 't kritik değer tek yönlü'], ['обратное t', 'квантиль стьюдента', 'критическое t одностороннее'], ['inverse t', 't quantile', 't critical one-tailed']),
    minVersion: '2010'
  });
  stat.push({
    name: 'T.INV.2T', tr: 'T.TERS.2K', ru: 'СТЬЮДЕНТ.ОБР.2Х', category: 'stat',
    syntax: 'T.INV.2T(probability, deg_freedom)',
    args: [ARG_PROB, ARG_DF],
    desc: t3('Student t dağılımının çift kuyruklu tersini (kritik t değerini) verir.',
             'Возвращает двустороннее обратное значение t-распределения Стьюдента (критическое t).',
             'Returns the two-tailed inverse of the Student t distribution (the critical t value).'),
    example: ex('T.INV.2T(0.05,10)', '%5 anlamlılık için çift kuyruklu kritik t (10 sd, ≈2,228)', 'Критическое двустороннее t при 5% (10 ст. св., ≈2,228)', 'Two-tailed critical t at 5% (10 df, ≈2.228)'),
    keywords: kw(['t kritik değer', 't tablo değeri', 'çift kuyruk t tersi'], ['критическое значение t', 'табличное t', 'обратное t двустороннее'], ['t critical value', 'two-tailed inverse t', 't table value']),
    minVersion: '2010'
  });
  stat.push({
    name: 'T.TEST', tr: 'T.TEST', ru: 'СТЬЮДЕНТ.ТЕСТ', category: 'stat',
    syntax: 'T.TEST(array1, array2, tails, type)',
    args: [
      arg('array1', 'dizi1', 'массив1', false, 'İlk veri kümesi', 'Первый набор данных', 'The first data set'),
      arg('array2', 'dizi2', 'массив2', false, 'İkinci veri kümesi', 'Второй набор данных', 'The second data set'),
      ARG_TAILS,
      arg('type', 'tür', 'тип', false, '1 eşleştirilmiş, 2 eşit varyanslı iki örneklem, 3 farklı varyanslı iki örneklem', '1 — парный, 2 — две выборки с равными дисперсиями, 3 — с разными дисперсиями', '1 paired, 2 two-sample equal variance, 3 two-sample unequal variance')],
    desc: t3('Student t testine ilişkin olasılığı (p-değeri) verir; iki örneklemin ortalamalarının farklı olup olmadığını sınar.',
             'Возвращает вероятность (p-значение) t-теста Стьюдента — проверяет, различаются ли средние двух выборок.',
             'Returns the probability (p-value) of the Student t-test, testing whether two sample means differ.'),
    example: ex('T.TEST(C2:C100,C101:C200,2,3)', 'İki grubun ortalamalarını karşılaştıran çift kuyruklu t testi', 'Двусторонний t-тест сравнения средних двух групп', 'Two-tailed t-test comparing the means of two groups'),
    keywords: kw(['t testi', 'ortalama karşılaştırma', 'iki grup farkı', 'anlamlılık testi', 'student testi'], ['t-тест', 'тест стьюдента', 'сравнение средних', 'разница двух групп', 'проверка значимости'], ['t test', 'compare means', 'significance test']),
    minVersion: '2010'
  });
  stat.push({
    name: 'TREND', tr: 'EĞİLİM', ru: 'ТЕНДЕНЦИЯ', category: 'stat',
    syntax: "TREND(known_y's, [known_x's], [new_x's], [const])",
    args: [ARG_KNOWN_Y, ARG_KNOWN_X_OPT, ARG_NEW_X, ARG_CONST],
    desc: t3('Bilinen verilere uydurulan doğrusal eğilime göre tahmini y değerlerini dizi olarak verir.',
             'Возвращает массив значений y по линейному тренду, подобранному к известным данным.',
             'Returns an array of y values along the linear trend fitted to the known data.'),
    example: ex('TREND(E2:E13,C2:C13,C14:C16)', 'Doğrusal eğilime göre sonraki 3 dönem tahmini', 'Прогноз на следующие 3 периода по линейному тренду', 'Forecast for the next 3 periods along the linear trend'),
    keywords: kw(['eğilim', 'doğrusal eğilim', 'trend çizgisi', 'trend tahmini', 'eğilim değerleri'], ['тенденция', 'линейный тренд', 'линия тренда', 'прогноз по тренду', 'значения тренда'], ['trend', 'linear trend', 'trend line values'])
  });
  stat.push({
    name: 'TRIMMEAN', tr: 'KIRPORTALAMA', ru: 'УРЕЗСРЕДНЕЕ', category: 'stat',
    syntax: 'TRIMMEAN(array, percent)',
    args: [ARG_ARRAY,
      arg('percent', 'yüzde', 'доля', false, 'Dışlanacak veri oranı (0 ile 1 arası); örn. 0,2 ise üstten ve alttan %10 atılır', 'Доля исключаемых данных (от 0 до 1); например 0,2 отбрасывает по 10% сверху и снизу', 'Fraction of data to exclude (0 to 1); e.g. 0.2 drops 10% from each end')],
    desc: t3('Uç değerlerin belirli bir yüzdesini alt ve üstten dışlayarak kalan verinin ortalamasını verir.',
             'Возвращает среднее данных после отбрасывания заданной доли крайних значений сверху и снизу.',
             'Returns the mean of the data after excluding a percentage of extreme values from both ends.'),
    example: ex('TRIMMEAN(E2:E200,0.1)', 'En uç %10’luk değerleri atıp tutarların ortalamasını alır', 'Среднее сумм без 10% крайних значений', 'Average of amounts after trimming 10% of extremes'),
    keywords: kw(['kırpılmış ortalama', 'uç değerler hariç ortalama', 'aykırı değersiz ortalama', 'budanmış ortalama'], ['усечённое среднее', 'среднее без выбросов', 'среднее без крайних', 'урезанное среднее'], ['trimmed mean', 'mean without outliers', 'trimmed average'])
  });
  stat.push({
    name: 'VAR.P', tr: 'VAR.P', ru: 'ДИСП.Г', category: 'stat',
    syntax: 'VAR.P(number1, [number2], ...)',
    args: numList(),
    desc: t3('Tüm popülasyonun varyansını verir (n’e böler); metin ve mantıksal değerler yok sayılır.',
             'Возвращает дисперсию по генеральной совокупности (деление на n); текст и логические значения игнорируются.',
             'Returns the variance of an entire population (divides by n); text and logicals are ignored.'),
    example: ex('VAR.P(E2:E200)', 'Tutarların popülasyon varyansı', 'Дисперсия сумм по генеральной совокупности', 'Population variance of amounts'),
    keywords: kw(['popülasyon varyansı', 'varyans p', 'tüm veri varyansı', 'anakütle varyansı'], ['дисперсия генеральной совокупности', 'дисп г', 'дисперсия популяции', 'дисперсия по всей совокупности'], ['population variance', 'var p', 'population variability']),
    minVersion: '2010'
  });
  stat.push({
    name: 'VAR.S', tr: 'VAR.S', ru: 'ДИСП.В', category: 'stat',
    syntax: 'VAR.S(number1, [number2], ...)',
    args: numList(),
    desc: t3('Örneklem varyansını verir (n−1’e böler); metin ve mantıksal değerler yok sayılır.',
             'Возвращает выборочную дисперсию (деление на n−1); текст и логические значения игнорируются.',
             'Returns the sample variance (divides by n−1); text and logicals are ignored.'),
    example: ex('VAR.S(E2:E200)', 'Tutarların örneklem varyansı', 'Выборочная дисперсия сумм', 'Sample variance of amounts'),
    keywords: kw(['varyans', 'örneklem varyansı', 'varyans hesapla', 'değişkenlik', 'standart sapmanın karesi'], ['дисперсия', 'выборочная дисперсия', 'посчитать дисперсию', 'изменчивость', 'квадрат отклонения'], ['variance', 'sample variance', 'variability']),
    minVersion: '2010'
  });
  stat.push({
    name: 'VARA', tr: 'VARA', ru: 'ДИСПА', category: 'stat',
    syntax: 'VARA(value1, [value2], ...)',
    args: valList(),
    desc: t3('Metin ve mantıksal değerleri de hesaba katarak örneklem varyansını verir; metin 0, DOĞRU 1 sayılır.',
             'Возвращает выборочную дисперсию с учётом текста и логических значений: текст — 0, ИСТИНА — 1.',
             'Returns the sample variance including text and logicals; text counts as 0, TRUE as 1.'),
    example: ex('VARA(C2:C200)', 'C2:C200 örneklem varyansı, metinler 0 sayılır', 'Выборочная дисперсия C2:C200, текст считается нулём', 'Sample variance of C2:C200 with text as 0'),
    keywords: kw(['metin dahil varyans', 'mantıksal dahil varyans', 'vara'], ['дисперсия с текстом', 'дисперсия с логическими', 'диспа'], ['variance including text', 'vara', 'variance with logicals'])
  });
  stat.push({
    name: 'VARPA', tr: 'VARSA', ru: 'ДИСПРА', category: 'stat',
    syntax: 'VARPA(value1, [value2], ...)',
    args: valList(),
    desc: t3('Metin ve mantıksal değerleri de hesaba katarak popülasyon varyansını verir; metin 0, DOĞRU 1 sayılır.',
             'Возвращает дисперсию генеральной совокупности с учётом текста и логических значений: текст — 0, ИСТИНА — 1.',
             'Returns the population variance including text and logicals; text counts as 0, TRUE as 1.'),
    example: ex('VARPA(C2:C200)', 'C2:C200 popülasyon varyansı, metinler 0 sayılır', 'Дисперсия совокупности C2:C200, текст считается нулём', 'Population variance of C2:C200 with text as 0'),
    keywords: kw(['metin dahil popülasyon varyansı', 'varsa fonksiyonu', 'tüm veri varyansı metinli'], ['дисперсия совокупности с текстом', 'диспра', 'дисперсия популяции с текстом'], ['population variance including text', 'varpa', 'population variance with text'])
  });
  stat.push({
    name: 'WEIBULL.DIST', tr: 'WEIBULL.DAĞ', ru: 'ВЕЙБУЛЛ.РАСП', category: 'stat',
    syntax: 'WEIBULL.DIST(x, alpha, beta, cumulative)',
    args: [arg('x', 'x', 'x', false, 'Dağılımın değerlendirileceği değer (negatif olmayan)', 'Значение для вычисления распределения (неотрицательное)', 'The value to evaluate the distribution at (non-negative)'),
      arg('alpha', 'alfa', 'альфа', false, 'Şekil parametresi (pozitif)', 'Параметр формы (положительный)', 'The shape parameter (positive)'),
      arg('beta', 'beta', 'бета', false, 'Ölçek parametresi (pozitif)', 'Параметр масштаба (положительный)', 'The scale parameter (positive)'),
      ARG_CUM],
    desc: t3('Weibull dağılımının yoğunluğunu veya kümülatif olasılığını verir; güvenilirlik ve ömür analizinde kullanılır.',
             'Возвращает плотность или интегральную вероятность распределения Вейбулла; используется в анализе надёжности и срока службы.',
             'Returns the density or cumulative probability of the Weibull distribution, used in reliability and lifetime analysis.'),
    example: ex('WEIBULL.DIST(105,20,100,TRUE)', 'Ömrün 105 birimden önce bitme olasılığı (alfa 20, beta 100)', 'Вероятность отказа до 105 единиц (альфа 20, бета 100)', 'Probability of failure before 105 units (alpha 20, beta 100)'),
    keywords: kw(['weibull dağılımı', 'ömür analizi', 'arıza olasılığı', 'güvenilirlik dağılımı'], ['распределение вейбулла', 'анализ срока службы', 'вероятность отказа', 'надёжность'], ['weibull distribution', 'reliability analysis', 'failure probability']),
    minVersion: '2010'
  });
  stat.push({
    name: 'Z.TEST', tr: 'Z.TEST', ru: 'Z.ТЕСТ', category: 'stat',
    syntax: 'Z.TEST(array, x, [sigma])',
    args: [arg('array', 'dizi', 'массив', false, 'x ile sınanacak veri kümesi', 'Набор данных, с которым сравнивается x', 'The data set to test x against'),
      arg('x', 'x', 'x', false, 'Sınanacak (varsayılan) ortalama değer', 'Проверяемое (гипотетическое) среднее', 'The hypothesized mean to test'),
      arg('sigma', 'sigma', 'сигма', true, 'Bilinen popülasyon standart sapması; atlanırsa örneklem sapması kullanılır', 'Известное стандартное отклонение совокупности; если опущено, берётся выборочное', 'Known population standard deviation; sample deviation is used when omitted')],
    desc: t3('Tek kuyruklu z testinin olasılık değerini (p-değeri) verir: örneklem ortalamasının x’ten büyük olma olasılığı.',
             'Возвращает одностороннее p-значение z-теста — вероятность того, что среднее выборки больше x.',
             'Returns the one-tailed p-value of the z-test: the probability that the sample mean exceeds x.'),
    example: ex('Z.TEST(E2:E200,50)', 'Tutar ortalamasının 50’den anlamlı biçimde büyük olup olmadığını sınar', 'Проверяет, значимо ли среднее сумм больше 50', 'Tests whether the mean amount is significantly greater than 50'),
    keywords: kw(['z testi', 'ortalama testi', 'z testi p değeri', 'tek kuyruklu z'], ['z-тест', 'тест среднего', 'p-значение z', 'односторонний z-тест'], ['z test', 'z-test p-value', 'one-tailed z test']),
    minVersion: '2010'
  });

  EFS.catalogParts.stat = stat;
  return stat;
});
