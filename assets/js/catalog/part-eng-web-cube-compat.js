/* Formula Studio — catalog part: Engineering, Web, Cube and Compatibility functions.
 * Sets EFS.catalogParts.engWebCubeCompat = [ entry, ... ] (entry shape: docs/ARCHITECTURE.md §1).
 * Covers every Excel 365 (Windows) function of the categories 'engineering', 'web', 'cube' and the
 * legacy statistical names Excel still accepts ('compat'); each compat entry names its modern replacement
 * in `desc` and in the extra `replacedBy` field. */
(function (root, factory) {
  var EFS = root.EFS || (root.EFS = {});
  var api = factory(EFS, root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (EFS, root) {
  'use strict';

  /* ---------- small builders (fresh objects every call, nothing shared between entries) ---------- */
  function arg(name, tr, ru, optional, dTr, dRu, dEn) {
    return { name: name, tr: tr, ru: ru, optional: !!optional, desc: { tr: dTr, ru: dRu, en: dEn } };
  }
  function t3(tr, ru, en) { return { tr: tr, ru: ru, en: en }; }

  /* complex-number argument (IM* functions); n = '' | '1' | '2' */
  function argInum(n, dTr, dRu, dEn) {
    n = n || '';
    return arg('inumber' + n, 'ksayı' + n, 'компл_число' + n, false,
      dTr || 'x+yi veya x+yj metin biçiminde karmaşık sayı',
      dRu || 'Комплексное число в текстовом виде x+yi или x+yj',
      dEn || 'A complex number in x+yi or x+yj text form');
  }
  /* number to be converted between bases */
  function argBaseNumber(baseTr, baseRu, baseEn, limitTr, limitRu, limitEn) {
    return arg('number', 'sayı', 'число', false,
      'Dönüştürülecek ' + baseTr + ' sayı' + (limitTr ? ' (' + limitTr + ')' : ''),
      'Преобразуемое ' + baseRu + ' число' + (limitRu ? ' (' + limitRu + ')' : ''),
      'The ' + baseEn + ' number to convert' + (limitEn ? ' (' + limitEn + ')' : ''));
  }
  function argPlaces() {
    return arg('places', 'basamaklar', 'разрядность', true,
      'Sonuçta kullanılacak karakter sayısı; eksik basamaklar başa sıfır eklenerek tamamlanır, negatif sayılar için yok sayılır',
      'Число знаков в результате; недостающие разряды дополняются нулями слева, для отрицательных чисел игнорируется',
      'Number of characters in the result; missing digits are padded with leading zeros, ignored for negative numbers');
  }
  function argX(dTr, dRu, dEn) { return arg('x', 'x', 'x', false, dTr, dRu, dEn); }
  function argBesselN() {
    return arg('n', 'n', 'n', false,
      'Bessel işlevinin derecesi; tamsayı değilse kesirli kısmı atılır, negatifse #SAYI! hatası verir',
      'Порядок функции Бесселя; дробная часть отбрасывается, при отрицательном значении возвращается ошибка #ЧИСЛО!',
      'Order of the Bessel function; truncated to an integer, negative values return #NUM!');
  }
  function argCumulative() {
    return arg('cumulative', 'kümülatif', 'интегральная', false,
      'DOĞRU ise kümülatif dağılım işlevini, YANLIŞ ise olasılık yoğunluk (kütle) işlevini verir',
      'ИСТИНА — интегральная функция распределения, ЛОЖЬ — функция плотности (массы) вероятности',
      'TRUE returns the cumulative distribution function, FALSE the probability density (mass) function');
  }
  function argNumbers(dTr, dRu, dEn) {
    return [
      arg('number1', 'sayı1', 'число1', false, dTr, dRu, dEn),
      arg('number2', 'sayı2', 'число2', true,
        'İsteğe bağlı ek sayılar veya aralıklar (en çok 255)',
        'Дополнительные числа или диапазоны (до 255)',
        'Additional numbers or ranges (up to 255)')
    ];
  }

  var list = [];

  /* =====================================================================================
   *  ENGINEERING
   * ===================================================================================== */

  /* ---- Bessel functions ---- */
  list.push({
    name: 'BESSELI', tr: 'BESSELI', ru: 'БЕССЕЛЬ.I', category: 'engineering',
    syntax: 'BESSELI(x, n)',
    args: [argX('İşlevin hesaplanacağı değer', 'Значение, для которого вычисляется функция', 'The value at which to evaluate the function'), argBesselN()],
    desc: t3('x için n. dereceden değiştirilmiş Bessel işlevi In(x) değerini verir.',
             'Возвращает модифицированную функцию Бесселя In(x) порядка n.',
             'Returns the modified Bessel function In(x) of order n.'),
    example: { formula: 'BESSELI(1.5,1)',
      tr: 'x = 1,5 için birinci dereceden değiştirilmiş Bessel işlevi I₁(1,5) değerini verir (≈ 0,9817)',
      ru: 'Вычисляет модифицированную функцию Бесселя первого порядка I₁(1,5) (≈ 0,9817)',
      en: 'Computes the first-order modified Bessel function I₁(1.5) (≈ 0.9817)' },
    keywords: { tr: ['bessel', 'değiştirilmiş bessel işlevi', 'bessel i', 'silindirik işlev', 'mühendislik işlevi'],
                ru: ['бессель', 'модифицированная функция бесселя', 'бессель i', 'цилиндрическая функция', 'инженерная функция'],
                en: ['bessel i', 'modified bessel function', 'cylindrical function'] },
    minVersion: '2007'
  });

  list.push({
    name: 'BESSELJ', tr: 'BESSELJ', ru: 'БЕССЕЛЬ.J', category: 'engineering',
    syntax: 'BESSELJ(x, n)',
    args: [argX('İşlevin hesaplanacağı değer', 'Значение, для которого вычисляется функция', 'The value at which to evaluate the function'), argBesselN()],
    desc: t3('x için n. dereceden birinci tür Bessel işlevi Jn(x) değerini verir.',
             'Возвращает функцию Бесселя первого рода Jn(x) порядка n.',
             'Returns the Bessel function of the first kind Jn(x) of order n.'),
    example: { formula: 'BESSELJ(2.5,1)',
      tr: 'x = 2,5 için birinci dereceden Bessel işlevi J₁(2,5) değerini verir (≈ 0,4971)',
      ru: 'Вычисляет функцию Бесселя первого рода первого порядка J₁(2,5) (≈ 0,4971)',
      en: 'Computes the first-order Bessel function J₁(2.5) (≈ 0.4971)' },
    keywords: { tr: ['bessel', 'bessel j', 'birinci tür bessel', 'titreşim analizi', 'mühendislik işlevi'],
                ru: ['бессель', 'бессель j', 'функция бесселя первого рода', 'анализ колебаний', 'инженерная функция'],
                en: ['bessel j', 'bessel function first kind', 'vibration analysis'] },
    minVersion: '2007'
  });

  list.push({
    name: 'BESSELK', tr: 'BESSELK', ru: 'БЕССЕЛЬ.K', category: 'engineering',
    syntax: 'BESSELK(x, n)',
    args: [argX('İşlevin hesaplanacağı pozitif değer', 'Положительное значение, для которого вычисляется функция', 'The positive value at which to evaluate the function'), argBesselN()],
    desc: t3('x için n. dereceden ikinci tür değiştirilmiş Bessel işlevi Kn(x) değerini verir.',
             'Возвращает модифицированную функцию Бесселя второго рода Kn(x) порядка n.',
             'Returns the modified Bessel function of the second kind Kn(x) of order n.'),
    example: { formula: 'BESSELK(1.5,1)',
      tr: 'x = 1,5 için birinci dereceden değiştirilmiş Bessel işlevi K₁(1,5) değerini verir (≈ 0,2774)',
      ru: 'Вычисляет модифицированную функцию Бесселя второго рода K₁(1,5) (≈ 0,2774)',
      en: 'Computes the first-order modified Bessel function K₁(1.5) (≈ 0.2774)' },
    keywords: { tr: ['bessel', 'bessel k', 'ikinci tür değiştirilmiş bessel', 'macdonald işlevi', 'mühendislik işlevi'],
                ru: ['бессель', 'бессель k', 'модифицированная функция бесселя второго рода', 'функция макдональда', 'инженерная функция'],
                en: ['bessel k', 'modified bessel second kind', 'macdonald function'] },
    minVersion: '2007'
  });

  list.push({
    name: 'BESSELY', tr: 'BESSELY', ru: 'БЕССЕЛЬ.Y', category: 'engineering',
    syntax: 'BESSELY(x, n)',
    args: [argX('İşlevin hesaplanacağı pozitif değer', 'Положительное значение, для которого вычисляется функция', 'The positive value at which to evaluate the function'), argBesselN()],
    desc: t3('x için n. dereceden ikinci tür Bessel işlevi Yn(x) (Weber işlevi) değerini verir.',
             'Возвращает функцию Бесселя второго рода Yn(x) порядка n (функцию Вебера).',
             'Returns the Bessel function of the second kind Yn(x) of order n (Weber function).'),
    example: { formula: 'BESSELY(2.5,1)',
      tr: 'x = 2,5 için birinci dereceden ikinci tür Bessel işlevi Y₁(2,5) değerini verir (≈ 0,1459)',
      ru: 'Вычисляет функцию Бесселя второго рода первого порядка Y₁(2,5) (≈ 0,1459)',
      en: 'Computes the first-order Bessel function of the second kind Y₁(2.5) (≈ 0.1459)' },
    keywords: { tr: ['bessel', 'bessel y', 'ikinci tür bessel', 'weber işlevi', 'neumann işlevi', 'mühendislik işlevi'],
                ru: ['бессель', 'бессель y', 'функция бесселя второго рода', 'функция вебера', 'функция неймана', 'инженерная функция'],
                en: ['bessel y', 'bessel function second kind', 'weber function', 'neumann function'] },
    minVersion: '2007'
  });

  /* ---- Base conversion ---- */
  list.push({
    name: 'BIN2DEC', tr: 'BIN2DEC', ru: 'ДВ.В.ДЕС', category: 'engineering',
    syntax: 'BIN2DEC(number)',
    args: [argBaseNumber('ikili (binary)', 'двоичное', 'binary', 'en çok 10 karakter, en soldaki bit işaret bitidir', 'не более 10 знаков, старший бит — знаковый', 'up to 10 characters, the most significant bit is the sign bit')],
    desc: t3('İkili (binary) sayıyı ondalık sayıya dönüştürür.',
             'Преобразует двоичное число в десятичное.',
             'Converts a binary number to decimal.'),
    example: { formula: 'BIN2DEC("1100100")',
      tr: 'İkili 1100100 sayısını ondalık 100 değerine çevirir',
      ru: 'Преобразует двоичное число 1100100 в десятичное 100',
      en: 'Converts binary 1100100 to decimal 100' },
    keywords: { tr: ['ikiliden ondalığa', 'binary ondalık çevir', 'ikili sayı dönüştür', 'taban dönüştürme', '2 tabanından 10 tabanına'],
                ru: ['из двоичной в десятичную', 'двоичное число в десятичное', 'перевод систем счисления', 'бинарное в десятичное', 'из 2 в 10'],
                en: ['binary to decimal', 'convert binary', 'base conversion'] },
    minVersion: '2007'
  });

  list.push({
    name: 'BIN2HEX', tr: 'BIN2HEX', ru: 'ДВ.В.ШЕСТН', category: 'engineering',
    syntax: 'BIN2HEX(number, [places])',
    args: [argBaseNumber('ikili (binary)', 'двоичное', 'binary', 'en çok 10 karakter', 'не более 10 знаков', 'up to 10 characters'), argPlaces()],
    desc: t3('İkili (binary) sayıyı onaltılık (hexadecimal) sayıya dönüştürür.',
             'Преобразует двоичное число в шестнадцатеричное.',
             'Converts a binary number to hexadecimal.'),
    example: { formula: 'BIN2HEX("11111011",4)',
      tr: 'İkili 11111011 sayısını 4 karakterli onaltılık "00FB" metnine çevirir',
      ru: 'Преобразует двоичное 11111011 в шестнадцатеричное «00FB» длиной 4 знака',
      en: 'Converts binary 11111011 to the 4-character hexadecimal "00FB"' },
    keywords: { tr: ['ikiliden onaltılığa', 'binary hex çevir', 'ikili sayı onaltılık', 'taban dönüştürme', '2 tabanından 16 tabanına'],
                ru: ['из двоичной в шестнадцатеричную', 'двоичное в hex', 'перевод систем счисления', 'бинарное в шестнадцатеричное', 'из 2 в 16'],
                en: ['binary to hex', 'binary to hexadecimal', 'base conversion'] },
    minVersion: '2007'
  });

  list.push({
    name: 'BIN2OCT', tr: 'BIN2OCT', ru: 'ДВ.В.ВОСЬМ', category: 'engineering',
    syntax: 'BIN2OCT(number, [places])',
    args: [argBaseNumber('ikili (binary)', 'двоичное', 'binary', 'en çok 10 karakter', 'не более 10 знаков', 'up to 10 characters'), argPlaces()],
    desc: t3('İkili (binary) sayıyı sekizli (octal) sayıya dönüştürür.',
             'Преобразует двоичное число в восьмеричное.',
             'Converts a binary number to octal.'),
    example: { formula: 'BIN2OCT("1001",3)',
      tr: 'İkili 1001 sayısını 3 karakterli sekizli "011" metnine çevirir',
      ru: 'Преобразует двоичное 1001 в восьмеричное «011» длиной 3 знака',
      en: 'Converts binary 1001 to the 3-character octal "011"' },
    keywords: { tr: ['ikiliden sekizliye', 'binary octal çevir', 'ikili sayı sekizlik', 'taban dönüştürme', '2 tabanından 8 tabanına'],
                ru: ['из двоичной в восьмеричную', 'двоичное в восьмеричное', 'перевод систем счисления', 'бинарное в октальное', 'из 2 в 8'],
                en: ['binary to octal', 'convert binary', 'base conversion'] },
    minVersion: '2007'
  });

  /* ---- Bitwise ---- */
  list.push({
    name: 'BITAND', tr: 'BİTVE', ru: 'БИТ.И', category: 'engineering',
    syntax: 'BITAND(number1, number2)',
    args: [
      arg('number1', 'sayı1', 'число1', false, 'Negatif olmayan tamsayı (en çok 2^48−1)', 'Неотрицательное целое число (не более 2^48−1)', 'A non-negative integer (at most 2^48−1)'),
      arg('number2', 'sayı2', 'число2', false, 'Negatif olmayan tamsayı (en çok 2^48−1)', 'Неотрицательное целое число (не более 2^48−1)', 'A non-negative integer (at most 2^48−1)')
    ],
    desc: t3('İki sayının bit düzeyinde VE (AND) işleminin sonucunu verir.',
             'Возвращает результат поразрядной операции И над двумя числами.',
             'Returns the bitwise AND of two numbers.'),
    example: { formula: 'BITAND(13,25)',
      tr: '1101 ve 11001 bitlerinin VE işlemi: ortak 1 bitleri 01001, yani 9',
      ru: 'Поразрядное И для 1101 и 11001: общие единичные биты 01001, то есть 9',
      en: 'Bitwise AND of 1101 and 11001: the shared 1 bits are 01001, i.e. 9' },
    keywords: { tr: ['bit ve', 'bit düzeyinde ve', 'bitwise and', 'bit maskesi', 'bayrak kontrolü'],
                ru: ['побитовое и', 'поразрядное и', 'битовая маска', 'проверка флага', 'bitwise and'],
                en: ['bitwise and', 'bit mask', 'flag check'] },
    minVersion: '2013'
  });

  list.push({
    name: 'BITLSHIFT', tr: 'BİTSOLAKAYDIR', ru: 'БИТ.СДВИГЛ', category: 'engineering',
    syntax: 'BITLSHIFT(number, shift_amount)',
    args: [
      arg('number', 'sayı', 'число', false, 'Kaydırılacak negatif olmayan tamsayı', 'Сдвигаемое неотрицательное целое число', 'The non-negative integer to shift'),
      arg('shift_amount', 'kaydırma_miktarı', 'число_бит', false, 'Sola kaydırılacak bit sayısı; negatif değer sağa kaydırır', 'Число бит сдвига влево; отрицательное значение сдвигает вправо', 'Number of bits to shift left; a negative value shifts right')
    ],
    desc: t3('Sayının bitlerini belirtilen sayıda sola kaydırır (her adım 2 ile çarpmaya eşdeğerdir).',
             'Сдвигает биты числа влево на указанное число разрядов (каждый шаг равен умножению на 2).',
             'Shifts the bits of a number left by the given amount (each step equals multiplying by 2).'),
    example: { formula: 'BITLSHIFT(4,2)',
      tr: '100 bitlerini iki basamak sola kaydırır: 10000, yani 16',
      ru: 'Сдвигает биты 100 на два разряда влево: 10000, то есть 16',
      en: 'Shifts the bits 100 two places left: 10000, i.e. 16' },
    keywords: { tr: ['bit sola kaydır', 'sola kaydırma', 'bit kaydırma', 'shift left', 'ikiyle çarp bit'],
                ru: ['сдвиг влево', 'побитовый сдвиг', 'сдвинуть биты', 'shift left', 'умножение на степень двойки'],
                en: ['shift left', 'bit shift', 'left shift'] },
    minVersion: '2013'
  });

  list.push({
    name: 'BITOR', tr: 'BİTVEYA', ru: 'БИТ.ИЛИ', category: 'engineering',
    syntax: 'BITOR(number1, number2)',
    args: [
      arg('number1', 'sayı1', 'число1', false, 'Negatif olmayan tamsayı (en çok 2^48−1)', 'Неотрицательное целое число (не более 2^48−1)', 'A non-negative integer (at most 2^48−1)'),
      arg('number2', 'sayı2', 'число2', false, 'Negatif olmayan tamsayı (en çok 2^48−1)', 'Неотрицательное целое число (не более 2^48−1)', 'A non-negative integer (at most 2^48−1)')
    ],
    desc: t3('İki sayının bit düzeyinde VEYA (OR) işleminin sonucunu verir.',
             'Возвращает результат поразрядной операции ИЛИ над двумя числами.',
             'Returns the bitwise OR of two numbers.'),
    example: { formula: 'BITOR(23,10)',
      tr: '10111 ve 01010 bitlerinin VEYA işlemi: 11111, yani 31',
      ru: 'Поразрядное ИЛИ для 10111 и 01010: 11111, то есть 31',
      en: 'Bitwise OR of 10111 and 01010: 11111, i.e. 31' },
    keywords: { tr: ['bit veya', 'bit düzeyinde veya', 'bitwise or', 'bayrak ekle', 'bit birleştir'],
                ru: ['побитовое или', 'поразрядное или', 'установить флаг', 'объединить биты', 'bitwise or'],
                en: ['bitwise or', 'set flag', 'combine bits'] },
    minVersion: '2013'
  });

  list.push({
    name: 'BITRSHIFT', tr: 'BİTSAĞAKAYDIR', ru: 'БИТ.СДВИГП', category: 'engineering',
    syntax: 'BITRSHIFT(number, shift_amount)',
    args: [
      arg('number', 'sayı', 'число', false, 'Kaydırılacak negatif olmayan tamsayı', 'Сдвигаемое неотрицательное целое число', 'The non-negative integer to shift'),
      arg('shift_amount', 'kaydırma_miktarı', 'число_бит', false, 'Sağa kaydırılacak bit sayısı; negatif değer sola kaydırır', 'Число бит сдвига вправо; отрицательное значение сдвигает влево', 'Number of bits to shift right; a negative value shifts left')
    ],
    desc: t3('Sayının bitlerini belirtilen sayıda sağa kaydırır (her adım 2’ye tam bölmeye eşdeğerdir).',
             'Сдвигает биты числа вправо на указанное число разрядов (каждый шаг равен целочисленному делению на 2).',
             'Shifts the bits of a number right by the given amount (each step equals integer division by 2).'),
    example: { formula: 'BITRSHIFT(13,2)',
      tr: '1101 bitlerini iki basamak sağa kaydırır: 11, yani 3',
      ru: 'Сдвигает биты 1101 на два разряда вправо: 11, то есть 3',
      en: 'Shifts the bits 1101 two places right: 11, i.e. 3' },
    keywords: { tr: ['bit sağa kaydır', 'sağa kaydırma', 'bit kaydırma', 'shift right', 'ikiye böl bit'],
                ru: ['сдвиг вправо', 'побитовый сдвиг', 'сдвинуть биты', 'shift right', 'деление на степень двойки'],
                en: ['shift right', 'bit shift', 'right shift'] },
    minVersion: '2013'
  });

  list.push({
    name: 'BITXOR', tr: 'BİTÖZELVEYA', ru: 'БИТ.ИСКЛИЛИ', category: 'engineering',
    syntax: 'BITXOR(number1, number2)',
    args: [
      arg('number1', 'sayı1', 'число1', false, 'Negatif olmayan tamsayı (en çok 2^48−1)', 'Неотрицательное целое число (не более 2^48−1)', 'A non-negative integer (at most 2^48−1)'),
      arg('number2', 'sayı2', 'число2', false, 'Negatif olmayan tamsayı (en çok 2^48−1)', 'Неотрицательное целое число (не более 2^48−1)', 'A non-negative integer (at most 2^48−1)')
    ],
    desc: t3('İki sayının bit düzeyinde özel VEYA (XOR) işleminin sonucunu verir.',
             'Возвращает результат поразрядной операции исключающее ИЛИ над двумя числами.',
             'Returns the bitwise exclusive OR (XOR) of two numbers.'),
    example: { formula: 'BITXOR(5,3)',
      tr: '101 ve 011 bitlerinin özel VEYA işlemi: farklı bitler 110, yani 6',
      ru: 'Исключающее ИЛИ для 101 и 011: различающиеся биты 110, то есть 6',
      en: 'Bitwise XOR of 101 and 011: the differing bits are 110, i.e. 6' },
    keywords: { tr: ['bit özel veya', 'xor', 'bit düzeyinde xor', 'dışlayan veya', 'bit farkı'],
                ru: ['исключающее или', 'xor', 'побитовое исключающее или', 'поразрядный xor', 'разница битов'],
                en: ['bitwise xor', 'exclusive or', 'xor'] },
    minVersion: '2013'
  });

  /* ---- Complex numbers: construction and unit conversion ---- */
  list.push({
    name: 'COMPLEX', tr: 'KARMAŞIK', ru: 'КОМПЛЕКСН', category: 'engineering',
    syntax: 'COMPLEX(real_num, i_num, [suffix])',
    args: [
      arg('real_num', 'gerçek_sayı', 'действительная_часть', false, 'Karmaşık sayının gerçek katsayısı', 'Действительная часть комплексного числа', 'The real coefficient of the complex number'),
      arg('i_num', 'sanal_sayı', 'мнимая_часть', false, 'Karmaşık sayının sanal katsayısı', 'Мнимая часть комплексного числа', 'The imaginary coefficient of the complex number'),
      arg('suffix', 'sonek', 'мнимая_единица', true, 'Sanal birim için "i" (varsayılan) veya "j"; küçük harf olmalıdır', 'Обозначение мнимой единицы: "i" (по умолчанию) или "j", только строчными', 'Suffix for the imaginary unit: "i" (default) or "j"; must be lowercase')
    ],
    desc: t3('Gerçek ve sanal katsayılardan x+yi veya x+yj biçiminde bir karmaşık sayı metni oluşturur.',
             'Составляет из действительной и мнимой частей комплексное число в виде x+yi или x+yj.',
             'Builds a complex number in x+yi or x+yj text form from real and imaginary coefficients.'),
    example: { formula: 'COMPLEX(3,4)',
      tr: 'Gerçek kısmı 3, sanal kısmı 4 olan "3+4i" karmaşık sayısını oluşturur',
      ru: 'Создаёт комплексное число «3+4i» с действительной частью 3 и мнимой 4',
      en: 'Creates the complex number "3+4i" with real part 3 and imaginary part 4' },
    keywords: { tr: ['karmaşık sayı', 'karmaşık sayı oluştur', 'sanal sayı', 'gerçek ve sanal kısım', 'kompleks sayı'],
                ru: ['комплексное число', 'создать комплексное число', 'мнимое число', 'действительная и мнимая часть', 'комплексная форма'],
                en: ['complex number', 'create complex', 'imaginary number'] },
    minVersion: '2007'
  });

  list.push({
    name: 'CONVERT', tr: 'ÇEVİR', ru: 'ПРЕОБР', category: 'engineering',
    syntax: 'CONVERT(number, from_unit, to_unit)',
    args: [
      arg('number', 'sayı', 'число', false, 'Dönüştürülecek değer', 'Преобразуемое значение', 'The value to convert'),
      arg('from_unit', 'başlangıç_birimi', 'исх_ед_изм', false, 'Kaynak birimin kodu (metin, büyük/küçük harfe duyarlı): "km", "kg", "C" gibi', 'Код исходной единицы (текст, регистр важен): «km», «kg», «C» и т. п.', 'Code of the source unit (text, case-sensitive) such as "km", "kg", "C"'),
      arg('to_unit', 'sonuç_birimi', 'кон_ед_изм', false, 'Hedef birimin kodu; kaynak birimle aynı ölçü türünde olmalıdır', 'Код целевой единицы; должен относиться к той же категории измерения', 'Code of the target unit; must belong to the same measurement category')
    ],
    desc: t3('Bir sayıyı bir ölçü biriminden aynı türdeki başka bir ölçü birimine dönüştürür.',
             'Преобразует число из одной единицы измерения в другую единицу той же величины.',
             'Converts a number from one measurement unit to another unit of the same kind.'),
    example: { formula: 'CONVERT(A2,"km","mi")',
      tr: 'A2’deki kilometre değerini mile çevirir. Sık kullanılan birim kodları: uzunluk "m", "km", "cm", "mm", "mi", "ft", "in", "yd", "Nmi"; ağırlık "g", "kg", "lbm", "ozm", "ton"; sıcaklık "C", "F", "K"; hacim "l", "ml", "m3", "gal", "uk_gal", "tsp", "tbsp", "cup", "oz"; alan "m2", "ha", "ft2", "mi2"; zaman "sec", "min", "hr", "day", "yr"; hız "m/s", "km/h", "mph", "kn"; enerji "J", "kJ", "cal", "Wh", "BTU"; güç "W", "HP"; basınç "Pa", "atm", "mmHg", "psi"; bilgi "bit", "byte"; ondalık önekler eklenebilir: "k" (kilo), "M" (mega), "m" (mili) → "kg", "MW", "ms"',
      ru: 'Переводит километры из A2 в мили. Частые коды единиц: длина "m", "km", "cm", "mm", "mi", "ft", "in", "yd", "Nmi"; масса "g", "kg", "lbm", "ozm", "ton"; температура "C", "F", "K"; объём "l", "ml", "m3", "gal", "uk_gal", "tsp", "tbsp", "cup", "oz"; площадь "m2", "ha", "ft2", "mi2"; время "sec", "min", "hr", "day", "yr"; скорость "m/s", "km/h", "mph", "kn"; энергия "J", "kJ", "cal", "Wh", "BTU"; мощность "W", "HP"; давление "Pa", "atm", "mmHg", "psi"; информация "bit", "byte"; допускаются десятичные приставки "k" (кило), "M" (мега), "m" (милли) → "kg", "MW", "ms"',
      en: 'Converts the kilometres in A2 to miles. Common unit codes: length "m", "km", "cm", "mm", "mi", "ft", "in", "yd", "Nmi"; mass "g", "kg", "lbm", "ozm", "ton"; temperature "C", "F", "K"; volume "l", "ml", "m3", "gal", "uk_gal", "tsp", "tbsp", "cup", "oz"; area "m2", "ha", "ft2", "mi2"; time "sec", "min", "hr", "day", "yr"; speed "m/s", "km/h", "mph", "kn"; energy "J", "kJ", "cal", "Wh", "BTU"; power "W", "HP"; pressure "Pa", "atm", "mmHg", "psi"; information "bit", "byte"; decimal prefixes are allowed: "k" (kilo), "M" (mega), "m" (milli) → "kg", "MW", "ms"' },
    keywords: { tr: ['birim çevir', 'birim dönüştürme', 'ölçü birimi çevir', 'km mil çevir', 'kg libre çevir', 'santigrat fahrenheit', 'metreyi fite çevir', 'litre galon'],
                ru: ['перевести единицы измерения', 'конвертация единиц', 'преобразовать единицы', 'километры в мили', 'килограммы в фунты', 'цельсий в фаренгейт', 'метры в футы', 'литры в галлоны'],
                en: ['convert units', 'unit conversion', 'km to miles', 'kg to pounds', 'celsius to fahrenheit', 'meters to feet'] },
    minVersion: '2007'
  });

  list.push({
    name: 'DEC2BIN', tr: 'DEC2BIN', ru: 'ДЕС.В.ДВ', category: 'engineering',
    syntax: 'DEC2BIN(number, [places])',
    args: [argBaseNumber('ondalık tam', 'десятичное целое', 'decimal integer', '−512 ile 511 arasında', 'от −512 до 511', 'between −512 and 511'), argPlaces()],
    desc: t3('Ondalık sayıyı ikili (binary) sayıya dönüştürür.',
             'Преобразует десятичное число в двоичное.',
             'Converts a decimal number to binary.'),
    example: { formula: 'DEC2BIN(9,4)',
      tr: 'Ondalık 9 sayısını 4 basamaklı ikili "1001" metnine çevirir',
      ru: 'Преобразует десятичное 9 в двоичное «1001» длиной 4 знака',
      en: 'Converts decimal 9 to the 4-digit binary "1001"' },
    keywords: { tr: ['ondalıktan ikiliye', 'binary çevir', 'ikili sayıya dönüştür', 'taban dönüştürme', '10 tabanından 2 tabanına', 'sayıyı bitlere çevir'],
                ru: ['из десятичной в двоичную', 'перевести в двоичную систему', 'десятичное в бинарное', 'перевод систем счисления', 'из 10 в 2', 'число в биты'],
                en: ['decimal to binary', 'convert to binary', 'base conversion'] },
    minVersion: '2007'
  });

  list.push({
    name: 'DEC2HEX', tr: 'DEC2HEX', ru: 'ДЕС.В.ШЕСТН', category: 'engineering',
    syntax: 'DEC2HEX(number, [places])',
    args: [argBaseNumber('ondalık tam', 'десятичное целое', 'decimal integer', '−549 755 813 888 ile 549 755 813 887 arasında', 'от −549 755 813 888 до 549 755 813 887', 'between −549,755,813,888 and 549,755,813,887'), argPlaces()],
    desc: t3('Ondalık sayıyı onaltılık (hexadecimal) sayıya dönüştürür.',
             'Преобразует десятичное число в шестнадцатеричное.',
             'Converts a decimal number to hexadecimal.'),
    example: { formula: 'DEC2HEX(255)',
      tr: 'Ondalık 255 sayısını onaltılık "FF" metnine çevirir',
      ru: 'Преобразует десятичное 255 в шестнадцатеричное «FF»',
      en: 'Converts decimal 255 to hexadecimal "FF"' },
    keywords: { tr: ['ondalıktan onaltılığa', 'hex çevir', 'onaltılık sayıya dönüştür', 'taban dönüştürme', '10 tabanından 16 tabanına', 'renk kodu hex'],
                ru: ['из десятичной в шестнадцатеричную', 'перевести в hex', 'десятичное в шестнадцатеричное', 'перевод систем счисления', 'из 10 в 16', 'hex код цвета'],
                en: ['decimal to hex', 'convert to hexadecimal', 'base conversion'] },
    minVersion: '2007'
  });

  list.push({
    name: 'DEC2OCT', tr: 'DEC2OCT', ru: 'ДЕС.В.ВОСЬМ', category: 'engineering',
    syntax: 'DEC2OCT(number, [places])',
    args: [argBaseNumber('ondalık tam', 'десятичное целое', 'decimal integer', '−536 870 912 ile 536 870 911 arasında', 'от −536 870 912 до 536 870 911', 'between −536,870,912 and 536,870,911'), argPlaces()],
    desc: t3('Ondalık sayıyı sekizli (octal) sayıya dönüştürür.',
             'Преобразует десятичное число в восьмеричное.',
             'Converts a decimal number to octal.'),
    example: { formula: 'DEC2OCT(58,3)',
      tr: 'Ondalık 58 sayısını 3 basamaklı sekizli "072" metnine çevirir',
      ru: 'Преобразует десятичное 58 в восьмеричное «072» длиной 3 знака',
      en: 'Converts decimal 58 to the 3-digit octal "072"' },
    keywords: { tr: ['ondalıktan sekizliye', 'octal çevir', 'sekizli sayıya dönüştür', 'taban dönüştürme', '10 tabanından 8 tabanına'],
                ru: ['из десятичной в восьмеричную', 'перевести в восьмеричную', 'десятичное в октальное', 'перевод систем счисления', 'из 10 в 8'],
                en: ['decimal to octal', 'convert to octal', 'base conversion'] },
    minVersion: '2007'
  });

  /* ---- Comparison / error functions ---- */
  list.push({
    name: 'DELTA', tr: 'DELTA', ru: 'ДЕЛЬТА', category: 'engineering',
    syntax: 'DELTA(number1, [number2])',
    args: [
      arg('number1', 'sayı1', 'число1', false, 'Karşılaştırılacak ilk sayı', 'Первое сравниваемое число', 'The first number to compare'),
      arg('number2', 'sayı2', 'число2', true, 'Karşılaştırılacak ikinci sayı; boş bırakılırsa 0 kabul edilir', 'Второе сравниваемое число; если опущено, считается равным 0', 'The second number to compare; 0 when omitted')
    ],
    desc: t3('İki sayı eşitse 1, değilse 0 verir (Kronecker deltası).',
             'Возвращает 1, если два числа равны, и 0 в противном случае (дельта Кронекера).',
             'Returns 1 when two numbers are equal and 0 otherwise (Kronecker delta).'),
    example: { formula: 'DELTA(A2,B2)',
      tr: 'A2 ile B2 sayısal olarak eşitse 1, değilse 0 verir; eşleşen satırları saymak için SUM ile birleştirilebilir',
      ru: 'Возвращает 1, если A2 и B2 равны, иначе 0; вместе с SUM удобно считать совпадающие строки',
      en: 'Returns 1 when A2 equals B2 and 0 otherwise; combine with SUM to count matching rows' },
    keywords: { tr: ['iki sayı eşit mi', 'eşitlik testi', 'kronecker delta', 'eşitse 1 değilse 0', 'sayı karşılaştır'],
                ru: ['равны ли два числа', 'проверка равенства', 'дельта кронекера', '1 если равно иначе 0', 'сравнить числа'],
                en: ['test equality', 'kronecker delta', '1 if equal else 0'] },
    minVersion: '2007'
  });

  list.push({
    name: 'ERF', tr: 'HATAİŞLEV', ru: 'ФОШ', category: 'engineering',
    syntax: 'ERF(lower_limit, [upper_limit])',
    args: [
      arg('lower_limit', 'alt_sınır', 'нижний_предел', false, 'Tümlevin alt sınırı', 'Нижний предел интегрирования', 'The lower bound of the integral'),
      arg('upper_limit', 'üst_sınır', 'верхний_предел', true, 'Tümlevin üst sınırı; boş bırakılırsa 0 ile alt_sınır arasında hesaplanır', 'Верхний предел интегрирования; если опущен, интеграл берётся от 0 до нижнего предела', 'The upper bound; when omitted the integral runs from 0 to lower_limit')
    ],
    desc: t3('Alt ve üst sınır arasında tümlenen hata işlevi (erf) değerini verir.',
             'Возвращает значение функции ошибок (erf), проинтегрированной между нижним и верхним пределами.',
             'Returns the error function (erf) integrated between the lower and upper limits.'),
    example: { formula: 'ERF(0.745)',
      tr: '0 ile 0,745 arasında tümlenen hata işlevi değerini verir (≈ 0,7079)',
      ru: 'Вычисляет функцию ошибок на отрезке от 0 до 0,745 (≈ 0,7079)',
      en: 'Computes the error function integrated from 0 to 0.745 (≈ 0.7079)' },
    keywords: { tr: ['hata işlevi', 'erf', 'gauss hata fonksiyonu', 'normal dağılım tümlevi', 'mühendislik istatistik'],
                ru: ['функция ошибок', 'erf', 'интеграл ошибок', 'функция лапласа', 'гауссова функция ошибок'],
                en: ['error function', 'erf', 'gauss error function'] },
    minVersion: '2007'
  });

  list.push({
    name: 'ERF.PRECISE', tr: 'HATAİŞLEV.DUYARLI', ru: 'ФОШ.ТОЧН', category: 'engineering',
    syntax: 'ERF.PRECISE(x)',
    args: [argX('Hata işlevinin tümleneceği üst sınır (alt sınır 0)', 'Верхний предел интегрирования функции ошибок (нижний предел 0)', 'The upper bound for integrating the error function (lower bound 0)')],
    desc: t3('0 ile x arasında tümlenen hata işlevi değerini verir; negatif x değerlerini de destekler.',
             'Возвращает функцию ошибок, проинтегрированную от 0 до x; поддерживает отрицательные значения x.',
             'Returns the error function integrated from 0 to x; negative x values are supported.'),
    example: { formula: 'ERF.PRECISE(1)',
      tr: '0 ile 1 arasında tümlenen hata işlevi değerini verir (≈ 0,8427)',
      ru: 'Вычисляет функцию ошибок на отрезке от 0 до 1 (≈ 0,8427)',
      en: 'Computes the error function integrated from 0 to 1 (≈ 0.8427)' },
    keywords: { tr: ['hata işlevi duyarlı', 'erf precise', 'hassas hata fonksiyonu', 'gauss hata işlevi'],
                ru: ['функция ошибок точная', 'erf precise', 'точная функция ошибок', 'интеграл ошибок'],
                en: ['error function precise', 'erf precise', 'precise error function integral'] },
    minVersion: '2010'
  });

  list.push({
    name: 'ERFC', tr: 'TÜMHATAİŞLEV', ru: 'ДФОШ', category: 'engineering',
    syntax: 'ERFC(x)',
    args: [argX('Tümleyen hata işlevinin tümleneceği alt sınır', 'Нижний предел интегрирования дополнительной функции ошибок', 'The lower bound for integrating the complementary error function')],
    desc: t3('x ile sonsuz arasında tümlenen tümleyen hata işlevi (erfc = 1 − erf) değerini verir.',
             'Возвращает дополнительную функцию ошибок (erfc = 1 − erf), проинтегрированную от x до бесконечности.',
             'Returns the complementary error function (erfc = 1 − erf) integrated from x to infinity.'),
    example: { formula: 'ERFC(1)',
      tr: '1 ile sonsuz arasında tümlenen tümleyen hata işlevi değerini verir (≈ 0,1573)',
      ru: 'Вычисляет дополнительную функцию ошибок от 1 до бесконечности (≈ 0,1573)',
      en: 'Computes the complementary error function from 1 to infinity (≈ 0.1573)' },
    keywords: { tr: ['tümleyen hata işlevi', 'erfc', 'tamamlayıcı hata fonksiyonu', 'bir eksi erf', 'kuyruk olasılığı'],
                ru: ['дополнительная функция ошибок', 'erfc', 'единица минус erf', 'хвост нормального распределения', 'дополнительный интеграл ошибок'],
                en: ['complementary error function', 'erfc', 'one minus erf'] },
    minVersion: '2007'
  });

  list.push({
    name: 'ERFC.PRECISE', tr: 'TÜMHATAİŞLEV.DUYARLI', ru: 'ДФОШ.ТОЧН', category: 'engineering',
    syntax: 'ERFC.PRECISE(x)',
    args: [argX('Tümleyen hata işlevinin tümleneceği alt sınır (negatif olabilir)', 'Нижний предел интегрирования дополнительной функции ошибок (может быть отрицательным)', 'The lower bound for integrating the complementary error function (may be negative)')],
    desc: t3('x ile sonsuz arasında tümlenen tümleyen hata işlevi değerini verir; negatif x değerlerini de destekler.',
             'Возвращает дополнительную функцию ошибок от x до бесконечности; поддерживает отрицательные значения x.',
             'Returns the complementary error function integrated from x to infinity; negative x values are supported.'),
    example: { formula: 'ERFC.PRECISE(1)',
      tr: '1 ile sonsuz arasında tümlenen tümleyen hata işlevi değerini verir (≈ 0,1573)',
      ru: 'Вычисляет дополнительную функцию ошибок от 1 до бесконечности (≈ 0,1573)',
      en: 'Computes the complementary error function from 1 to infinity (≈ 0.1573)' },
    keywords: { tr: ['tümleyen hata işlevi duyarlı', 'erfc precise', 'hassas tamamlayıcı hata fonksiyonu'],
                ru: ['дополнительная функция ошибок точная', 'erfc precise', 'точная дополнительная функция ошибок'],
                en: ['complementary error function precise', 'erfc precise', 'precise complementary erf'] },
    minVersion: '2010'
  });

  list.push({
    name: 'GESTEP', tr: 'BESINIR', ru: 'ПОРОГ', category: 'engineering',
    syntax: 'GESTEP(number, [step])',
    args: [
      arg('number', 'sayı', 'число', false, 'Eşikle karşılaştırılacak değer', 'Значение, сравниваемое с порогом', 'The value tested against the threshold'),
      arg('step', 'adım', 'порог', true, 'Eşik değeri; boş bırakılırsa 0 kabul edilir', 'Пороговое значение; если опущено, считается равным 0', 'The threshold value; 0 when omitted')
    ],
    desc: t3('Sayı eşik değerine eşit veya büyükse 1, değilse 0 verir (birim basamak işlevi).',
             'Возвращает 1, если число больше или равно порогу, иначе 0 (единичная ступенчатая функция).',
             'Returns 1 when the number is greater than or equal to the step value and 0 otherwise (unit step function).'),
    example: { formula: 'GESTEP(A2,100)',
      tr: 'A2 değeri 100 veya daha büyükse 1, küçükse 0 verir; eşiği aşan satırları saymak için SUM ile kullanılabilir',
      ru: 'Возвращает 1, если значение в A2 не меньше 100, иначе 0; вместе с SUM удобно считать значения выше порога',
      en: 'Returns 1 when A2 is 100 or more and 0 otherwise; combine with SUM to count values above a threshold' },
    keywords: { tr: ['eşik değeri', 'eşikten büyük mü', 'basamak işlevi', 'eşiği aşan 1 ver', 'sınır karşılaştırma'],
                ru: ['порог', 'больше или равно порогу', 'ступенчатая функция', 'превышение порога', '1 если выше порога'],
                en: ['threshold', 'step function', 'greater than or equal step'] },
    minVersion: '2007'
  });

  list.push({
    name: 'HEX2BIN', tr: 'HEX2BIN', ru: 'ШЕСТН.В.ДВ', category: 'engineering',
    syntax: 'HEX2BIN(number, [places])',
    args: [argBaseNumber('onaltılık (hex)', 'шестнадцатеричное', 'hexadecimal', 'en çok 10 karakter; sonuç −512 ile 511 arasında olmalıdır', 'не более 10 знаков; результат должен лежать в диапазоне от −512 до 511', 'up to 10 characters; the result must fit between −512 and 511'), argPlaces()],
    desc: t3('Onaltılık (hexadecimal) sayıyı ikili (binary) sayıya dönüştürür.',
             'Преобразует шестнадцатеричное число в двоичное.',
             'Converts a hexadecimal number to binary.'),
    example: { formula: 'HEX2BIN("F",8)',
      tr: 'Onaltılık F sayısını 8 basamaklı ikili "00001111" metnine çevirir',
      ru: 'Преобразует шестнадцатеричное F в двоичное «00001111» длиной 8 знаков',
      en: 'Converts hexadecimal F to the 8-digit binary "00001111"' },
    keywords: { tr: ['onaltılıktan ikiliye', 'hex binary çevir', 'onaltılık sayı ikili', 'taban dönüştürme', '16 tabanından 2 tabanına'],
                ru: ['из шестнадцатеричной в двоичную', 'hex в двоичное', 'шестнадцатеричное в бинарное', 'перевод систем счисления', 'из 16 в 2'],
                en: ['hex to binary', 'hexadecimal to binary', 'base conversion'] },
    minVersion: '2007'
  });

  list.push({
    name: 'HEX2DEC', tr: 'HEX2DEC', ru: 'ШЕСТН.В.ДЕС', category: 'engineering',
    syntax: 'HEX2DEC(number)',
    args: [argBaseNumber('onaltılık (hex)', 'шестнадцатеричное', 'hexadecimal', 'en çok 10 karakter, en soldaki bit işaret bitidir', 'не более 10 знаков, старший бит — знаковый', 'up to 10 characters, the most significant bit is the sign bit')],
    desc: t3('Onaltılık (hexadecimal) sayıyı ondalık sayıya dönüştürür.',
             'Преобразует шестнадцатеричное число в десятичное.',
             'Converts a hexadecimal number to decimal.'),
    example: { formula: 'HEX2DEC("FF")',
      tr: 'Onaltılık FF sayısını ondalık 255 değerine çevirir',
      ru: 'Преобразует шестнадцатеричное FF в десятичное 255',
      en: 'Converts hexadecimal FF to decimal 255' },
    keywords: { tr: ['onaltılıktan ondalığa', 'hex ondalık çevir', 'onaltılık sayı dönüştür', 'taban dönüştürme', '16 tabanından 10 tabanına', 'hex renk kodu sayıya'],
                ru: ['из шестнадцатеричной в десятичную', 'hex в десятичное', 'шестнадцатеричное число в десятичное', 'перевод систем счисления', 'из 16 в 10', 'hex код в число'],
                en: ['hex to decimal', 'hexadecimal to decimal', 'base conversion'] },
    minVersion: '2007'
  });

  list.push({
    name: 'HEX2OCT', tr: 'HEX2OCT', ru: 'ШЕСТН.В.ВОСЬМ', category: 'engineering',
    syntax: 'HEX2OCT(number, [places])',
    args: [argBaseNumber('onaltılık (hex)', 'шестнадцатеричное', 'hexadecimal', 'en çok 10 karakter', 'не более 10 знаков', 'up to 10 characters'), argPlaces()],
    desc: t3('Onaltılık (hexadecimal) sayıyı sekizli (octal) sayıya dönüştürür.',
             'Преобразует шестнадцатеричное число в восьмеричное.',
             'Converts a hexadecimal number to octal.'),
    example: { formula: 'HEX2OCT("F",3)',
      tr: 'Onaltılık F sayısını 3 basamaklı sekizli "017" metnine çevirir',
      ru: 'Преобразует шестнадцатеричное F в восьмеричное «017» длиной 3 знака',
      en: 'Converts hexadecimal F to the 3-digit octal "017"' },
    keywords: { tr: ['onaltılıktan sekizliye', 'hex octal çevir', 'onaltılık sayı sekizli', 'taban dönüştürme', '16 tabanından 8 tabanına'],
                ru: ['из шестнадцатеричной в восьмеричную', 'hex в восьмеричное', 'шестнадцатеричное в октальное', 'перевод систем счисления', 'из 16 в 8'],
                en: ['hex to octal', 'hexadecimal to octal', 'base conversion'] },
    minVersion: '2007'
  });

  /* ---- Complex numbers: IM* ---- */
  list.push({
    name: 'IMABS', tr: 'SANMUTLAK', ru: 'МНИМ.ABS', category: 'engineering',
    syntax: 'IMABS(inumber)',
    args: [argInum('', 'Mutlak değeri alınacak karmaşık sayı', 'Комплексное число, модуль которого нужно найти', 'The complex number whose absolute value you want')],
    desc: t3('Karmaşık sayının mutlak değerini (modülünü, √(x²+y²)) verir.',
             'Возвращает модуль (абсолютную величину, √(x²+y²)) комплексного числа.',
             'Returns the absolute value (modulus, √(x²+y²)) of a complex number.'),
    example: { formula: 'IMABS("3+4i")',
      tr: '3+4i karmaşık sayısının modülünü verir: √(9+16) = 5',
      ru: 'Возвращает модуль комплексного числа 3+4i: √(9+16) = 5',
      en: 'Returns the modulus of 3+4i: √(9+16) = 5' },
    keywords: { tr: ['karmaşık sayı mutlak değer', 'karmaşık sayının modülü', 'sanal sayı büyüklüğü', 'kompleks mutlak'],
                ru: ['модуль комплексного числа', 'абсолютная величина комплексного числа', 'длина комплексного числа', 'модуль мнимого числа'],
                en: ['complex absolute value', 'modulus of complex number', 'magnitude'] },
    minVersion: '2007'
  });

  list.push({
    name: 'IMAGINARY', tr: 'SANAL', ru: 'МНИМ.ЧАСТЬ', category: 'engineering',
    syntax: 'IMAGINARY(inumber)',
    args: [argInum('', 'Sanal katsayısı alınacak karmaşık sayı', 'Комплексное число, мнимую часть которого нужно получить', 'The complex number whose imaginary coefficient you want')],
    desc: t3('Karmaşık sayının sanal katsayısını (y) verir.',
             'Возвращает мнимую часть (коэффициент y) комплексного числа.',
             'Returns the imaginary coefficient (y) of a complex number.'),
    example: { formula: 'IMAGINARY("3+4i")',
      tr: '3+4i karmaşık sayısının sanal kısmını verir: 4',
      ru: 'Возвращает мнимую часть комплексного числа 3+4i: 4',
      en: 'Returns the imaginary part of 3+4i: 4' },
    keywords: { tr: ['sanal kısım', 'karmaşık sayının sanal kısmı', 'sanal katsayı', 'imajiner kısım'],
                ru: ['мнимая часть', 'мнимая часть комплексного числа', 'коэффициент при i', 'мнимый коэффициент'],
                en: ['imaginary part', 'imaginary coefficient', 'imaginary part of complex number'] },
    minVersion: '2007'
  });

  list.push({
    name: 'IMARGUMENT', tr: 'SANBAĞ_DEĞİŞKEN', ru: 'МНИМ.АРГУМЕНТ', category: 'engineering',
    syntax: 'IMARGUMENT(inumber)',
    args: [argInum('', 'Argümanı (açısı) alınacak karmaşık sayı', 'Комплексное число, аргумент (угол) которого нужно найти', 'The complex number whose argument (angle) you want')],
    desc: t3('Karmaşık sayının argümanını, yani radyan cinsinden θ açısını verir.',
             'Возвращает аргумент комплексного числа — угол θ в радианах.',
             'Returns the argument of a complex number, the angle θ in radians.'),
    example: { formula: 'IMARGUMENT("3+4i")',
      tr: '3+4i sayısının gerçek eksenle yaptığı açıyı radyan olarak verir (≈ 0,9273 rad ≈ 53,13°)',
      ru: 'Возвращает угол числа 3+4i относительно действительной оси в радианах (≈ 0,9273 рад ≈ 53,13°)',
      en: 'Returns the angle of 3+4i from the real axis in radians (≈ 0.9273 rad ≈ 53.13°)' },
    keywords: { tr: ['karmaşık sayı argümanı', 'karmaşık sayının açısı', 'faz açısı', 'theta radyan', 'kutupsal açı'],
                ru: ['аргумент комплексного числа', 'угол комплексного числа', 'фазовый угол', 'тета в радианах', 'полярный угол'],
                en: ['complex argument', 'phase angle', 'theta radians'] },
    minVersion: '2007'
  });

  list.push({
    name: 'IMCONJUGATE', tr: 'SANEŞLENEK', ru: 'МНИМ.СОПРЯЖ', category: 'engineering',
    syntax: 'IMCONJUGATE(inumber)',
    args: [argInum('', 'Eşleniği alınacak karmaşık sayı', 'Комплексное число, сопряжённое к которому нужно найти', 'The complex number whose conjugate you want')],
    desc: t3('Karmaşık sayının eşleniğini (sanal kısmın işareti ters çevrilmiş halini) verir.',
             'Возвращает комплексно-сопряжённое число (с противоположным знаком мнимой части).',
             'Returns the complex conjugate (the imaginary part with its sign reversed).'),
    example: { formula: 'IMCONJUGATE("3+4i")',
      tr: '3+4i sayısının eşleniğini verir: "3-4i"',
      ru: 'Возвращает сопряжённое к 3+4i число: «3-4i»',
      en: 'Returns the conjugate of 3+4i: "3-4i"' },
    keywords: { tr: ['karmaşık eşlenik', 'eşlenik sayı', 'sanal kısmın işaretini değiştir', 'kompleks konjuge'],
                ru: ['комплексно сопряжённое', 'сопряжённое число', 'сменить знак мнимой части', 'сопряжение'],
                en: ['complex conjugate', 'conjugate', 'flip sign of imaginary part'] },
    minVersion: '2007'
  });

  list.push({
    name: 'IMCOS', tr: 'SANCOS', ru: 'МНИМ.COS', category: 'engineering',
    syntax: 'IMCOS(inumber)',
    args: [argInum('', 'Kosinüsü alınacak karmaşık sayı', 'Комплексное число, косинус которого нужно найти', 'The complex number whose cosine you want')],
    desc: t3('Karmaşık sayının kosinüsünü verir.',
             'Возвращает косинус комплексного числа.',
             'Returns the cosine of a complex number.'),
    example: { formula: 'IMCOS("1+i")',
      tr: '1+i karmaşık sayısının kosinüsünü verir (≈ 0,8337-0,9889i)',
      ru: 'Возвращает косинус комплексного числа 1+i (≈ 0,8337-0,9889i)',
      en: 'Returns the cosine of 1+i (≈ 0.8337-0.9889i)' },
    keywords: { tr: ['karmaşık kosinüs', 'karmaşık sayının kosinüsü', 'kompleks cos', 'sanal kosinüs'],
                ru: ['косинус комплексного числа', 'комплексный косинус', 'cos комплексного', 'мнимый косинус'],
                en: ['complex cosine', 'cosine of complex number', 'complex cos'] },
    minVersion: '2007'
  });

  list.push({
    name: 'IMCOSH', tr: 'SANCOSH', ru: 'МНИМ.COSH', category: 'engineering',
    syntax: 'IMCOSH(inumber)',
    args: [argInum('', 'Hiperbolik kosinüsü alınacak karmaşık sayı', 'Комплексное число, гиперболический косинус которого нужно найти', 'The complex number whose hyperbolic cosine you want')],
    desc: t3('Karmaşık sayının hiperbolik kosinüsünü verir.',
             'Возвращает гиперболический косинус комплексного числа.',
             'Returns the hyperbolic cosine of a complex number.'),
    example: { formula: 'IMCOSH("4+3i")',
      tr: '4+3i karmaşık sayısının hiperbolik kosinüsünü verir (≈ -27,0349+3,8512i)',
      ru: 'Возвращает гиперболический косинус числа 4+3i (≈ -27,0349+3,8512i)',
      en: 'Returns the hyperbolic cosine of 4+3i (≈ -27.0349+3.8512i)' },
    keywords: { tr: ['karmaşık hiperbolik kosinüs', 'kompleks cosh', 'sanal cosh'],
                ru: ['гиперболический косинус комплексного числа', 'комплексный cosh', 'мнимый cosh'],
                en: ['complex hyperbolic cosine', 'complex cosh', 'hyperbolic cosine of complex number'] },
    minVersion: '2013'
  });

  list.push({
    name: 'IMCOT', tr: 'SANCOT', ru: 'МНИМ.COT', category: 'engineering',
    syntax: 'IMCOT(inumber)',
    args: [argInum('', 'Kotanjantı alınacak karmaşık sayı', 'Комплексное число, котангенс которого нужно найти', 'The complex number whose cotangent you want')],
    desc: t3('Karmaşık sayının kotanjantını verir.',
             'Возвращает котангенс комплексного числа.',
             'Returns the cotangent of a complex number.'),
    example: { formula: 'IMCOT("4+3i")',
      tr: '4+3i karmaşık sayısının kotanjantını verir (≈ 0,0049-1,0006i)',
      ru: 'Возвращает котангенс числа 4+3i (≈ 0,0049-1,0006i)',
      en: 'Returns the cotangent of 4+3i (≈ 0.0049-1.0006i)' },
    keywords: { tr: ['karmaşık kotanjant', 'kompleks cot', 'sanal kotanjant'],
                ru: ['котангенс комплексного числа', 'комплексный котангенс', 'мнимый cot'],
                en: ['complex cotangent', 'complex cot', 'cotangent of complex number'] },
    minVersion: '2013'
  });

  list.push({
    name: 'IMCSC', tr: 'SANCSC', ru: 'МНИМ.CSC', category: 'engineering',
    syntax: 'IMCSC(inumber)',
    args: [argInum('', 'Kosekantı alınacak karmaşık sayı', 'Комплексное число, косеканс которого нужно найти', 'The complex number whose cosecant you want')],
    desc: t3('Karmaşık sayının kosekantını (1/sin) verir.',
             'Возвращает косеканс (1/sin) комплексного числа.',
             'Returns the cosecant (1/sin) of a complex number.'),
    example: { formula: 'IMCSC("4+3i")',
      tr: '4+3i karmaşık sayısının kosekantını verir (≈ -0,0755+0,0649i)',
      ru: 'Возвращает косеканс числа 4+3i (≈ -0,0755+0,0649i)',
      en: 'Returns the cosecant of 4+3i (≈ -0.0755+0.0649i)' },
    keywords: { tr: ['karmaşık kosekant', 'kompleks csc', 'sanal kosekant'],
                ru: ['косеканс комплексного числа', 'комплексный косеканс', 'мнимый csc'],
                en: ['complex cosecant', 'complex csc', 'cosecant of complex number'] },
    minVersion: '2013'
  });

  list.push({
    name: 'IMCSCH', tr: 'SANCSCH', ru: 'МНИМ.CSCH', category: 'engineering',
    syntax: 'IMCSCH(inumber)',
    args: [argInum('', 'Hiperbolik kosekantı alınacak karmaşık sayı', 'Комплексное число, гиперболический косеканс которого нужно найти', 'The complex number whose hyperbolic cosecant you want')],
    desc: t3('Karmaşık sayının hiperbolik kosekantını verir.',
             'Возвращает гиперболический косеканс комплексного числа.',
             'Returns the hyperbolic cosecant of a complex number.'),
    example: { formula: 'IMCSCH("4+3i")',
      tr: '4+3i karmaşık sayısının hiperbolik kosekantını verir (≈ -0,0363-0,0052i)',
      ru: 'Возвращает гиперболический косеканс числа 4+3i (≈ -0,0363-0,0052i)',
      en: 'Returns the hyperbolic cosecant of 4+3i (≈ -0.0363-0.0052i)' },
    keywords: { tr: ['karmaşık hiperbolik kosekant', 'kompleks csch', 'sanal csch'],
                ru: ['гиперболический косеканс комплексного числа', 'комплексный csch', 'мнимый csch'],
                en: ['complex hyperbolic cosecant', 'complex csch', 'hyperbolic cosecant of complex number'] },
    minVersion: '2013'
  });

  list.push({
    name: 'IMDIV', tr: 'SANBÖL', ru: 'МНИМ.ДЕЛ', category: 'engineering',
    syntax: 'IMDIV(inumber1, inumber2)',
    args: [
      argInum('1', 'Bölünen karmaşık sayı (pay)', 'Комплексное делимое (числитель)', 'The complex numerator (dividend)'),
      argInum('2', 'Bölen karmaşık sayı (payda)', 'Комплексный делитель (знаменатель)', 'The complex denominator (divisor)')
    ],
    desc: t3('İki karmaşık sayının bölümünü verir.',
             'Возвращает частное двух комплексных чисел.',
             'Returns the quotient of two complex numbers.'),
    example: { formula: 'IMDIV("-238+240i","10+24i")',
      tr: '-238+240i sayısını 10+24i sayısına böler: "5+12i"',
      ru: 'Делит -238+240i на 10+24i: «5+12i»',
      en: 'Divides -238+240i by 10+24i: "5+12i"' },
    keywords: { tr: ['karmaşık sayı bölme', 'iki karmaşık sayıyı böl', 'kompleks bölüm', 'sanal sayı bölme'],
                ru: ['деление комплексных чисел', 'разделить комплексные числа', 'частное комплексных чисел', 'деление мнимых чисел'],
                en: ['divide complex numbers', 'complex quotient', 'divide imaginary numbers'] },
    minVersion: '2007'
  });

  list.push({
    name: 'IMEXP', tr: 'SANÜS', ru: 'МНИМ.EXP', category: 'engineering',
    syntax: 'IMEXP(inumber)',
    args: [argInum('', 'Üstel değeri alınacak karmaşık sayı', 'Комплексное число, экспоненту которого нужно найти', 'The complex number whose exponential you want')],
    desc: t3('Karmaşık sayının üstel değerini (e üzeri sayı) verir.',
             'Возвращает экспоненту (e в степени число) комплексного числа.',
             'Returns the exponential (e raised to the number) of a complex number.'),
    example: { formula: 'IMEXP("1+i")',
      tr: 'e^(1+i) değerini verir (≈ 1,4687+2,2874i)',
      ru: 'Вычисляет e^(1+i) (≈ 1,4687+2,2874i)',
      en: 'Computes e^(1+i) (≈ 1.4687+2.2874i)' },
    keywords: { tr: ['karmaşık üstel', 'e üzeri karmaşık sayı', 'kompleks exp', 'euler formülü'],
                ru: ['экспонента комплексного числа', 'e в комплексной степени', 'комплексная exp', 'формула эйлера'],
                en: ['complex exponential', 'e to complex power', 'complex exp'] },
    minVersion: '2007'
  });

  list.push({
    name: 'IMLN', tr: 'SANLN', ru: 'МНИМ.LN', category: 'engineering',
    syntax: 'IMLN(inumber)',
    args: [argInum('', 'Doğal logaritması alınacak karmaşık sayı', 'Комплексное число, натуральный логарифм которого нужно найти', 'The complex number whose natural logarithm you want')],
    desc: t3('Karmaşık sayının doğal logaritmasını verir.',
             'Возвращает натуральный логарифм комплексного числа.',
             'Returns the natural logarithm of a complex number.'),
    example: { formula: 'IMLN("3+4i")',
      tr: '3+4i sayısının doğal logaritmasını verir (≈ 1,6094+0,9273i)',
      ru: 'Возвращает натуральный логарифм числа 3+4i (≈ 1,6094+0,9273i)',
      en: 'Returns the natural logarithm of 3+4i (≈ 1.6094+0.9273i)' },
    keywords: { tr: ['karmaşık doğal logaritma', 'kompleks ln', 'sanal sayı logaritması'],
                ru: ['натуральный логарифм комплексного числа', 'комплексный ln', 'логарифм мнимого числа'],
                en: ['complex natural logarithm', 'complex ln', 'natural log of complex number'] },
    minVersion: '2007'
  });

  list.push({
    name: 'IMLOG10', tr: 'SANLOG10', ru: 'МНИМ.LOG10', category: 'engineering',
    syntax: 'IMLOG10(inumber)',
    args: [argInum('', '10 tabanında logaritması alınacak karmaşık sayı', 'Комплексное число, десятичный логарифм которого нужно найти', 'The complex number whose base-10 logarithm you want')],
    desc: t3('Karmaşık sayının 10 tabanındaki logaritmasını verir.',
             'Возвращает десятичный логарифм комплексного числа.',
             'Returns the base-10 logarithm of a complex number.'),
    example: { formula: 'IMLOG10("3+4i")',
      tr: '3+4i sayısının 10 tabanındaki logaritmasını verir (≈ 0,6990+0,4027i)',
      ru: 'Возвращает десятичный логарифм числа 3+4i (≈ 0,6990+0,4027i)',
      en: 'Returns the base-10 logarithm of 3+4i (≈ 0.6990+0.4027i)' },
    keywords: { tr: ['karmaşık logaritma 10', 'kompleks log10', 'sanal sayı ondalık logaritma'],
                ru: ['десятичный логарифм комплексного числа', 'комплексный log10', 'логарифм по основанию 10'],
                en: ['complex log base 10', 'complex log10', 'log10 of complex number'] },
    minVersion: '2007'
  });

  list.push({
    name: 'IMLOG2', tr: 'SANLOG2', ru: 'МНИМ.LOG2', category: 'engineering',
    syntax: 'IMLOG2(inumber)',
    args: [argInum('', '2 tabanında logaritması alınacak karmaşık sayı', 'Комплексное число, двоичный логарифм которого нужно найти', 'The complex number whose base-2 logarithm you want')],
    desc: t3('Karmaşık sayının 2 tabanındaki logaritmasını verir.',
             'Возвращает двоичный логарифм комплексного числа.',
             'Returns the base-2 logarithm of a complex number.'),
    example: { formula: 'IMLOG2("3+4i")',
      tr: '3+4i sayısının 2 tabanındaki logaritmasını verir (≈ 2,3219+1,3378i)',
      ru: 'Возвращает двоичный логарифм числа 3+4i (≈ 2,3219+1,3378i)',
      en: 'Returns the base-2 logarithm of 3+4i (≈ 2.3219+1.3378i)' },
    keywords: { tr: ['karmaşık logaritma 2', 'kompleks log2', 'sanal sayı ikili logaritma'],
                ru: ['двоичный логарифм комплексного числа', 'комплексный log2', 'логарифм по основанию 2'],
                en: ['complex log base 2', 'complex log2', 'log2 of complex number'] },
    minVersion: '2007'
  });

  list.push({
    name: 'IMPOWER', tr: 'SANKUVVET', ru: 'МНИМ.СТЕПЕНЬ', category: 'engineering',
    syntax: 'IMPOWER(inumber, number)',
    args: [
      argInum('', 'Üssü alınacak karmaşık sayı', 'Комплексное число, возводимое в степень', 'The complex number to raise to a power'),
      arg('number', 'sayı', 'число', false, 'Üs; tamsayı, kesirli veya negatif olabilir', 'Показатель степени; может быть целым, дробным или отрицательным', 'The exponent; may be an integer, fractional or negative')
    ],
    desc: t3('Karmaşık sayının belirtilen üssünü verir.',
             'Возвращает комплексное число, возведённое в заданную степень.',
             'Returns a complex number raised to the given power.'),
    example: { formula: 'IMPOWER("2+3i",3)',
      tr: '2+3i sayısının küpünü verir: "-46+9i"',
      ru: 'Возводит 2+3i в куб: «-46+9i»',
      en: 'Raises 2+3i to the third power: "-46+9i"' },
    keywords: { tr: ['karmaşık sayı üs', 'karmaşık sayının kuvveti', 'kompleks üs alma', 'sanal sayı kare küp'],
                ru: ['степень комплексного числа', 'возвести комплексное число в степень', 'комплексная степень', 'квадрат куб комплексного'],
                en: ['complex power', 'raise complex number', 'complex exponent'] },
    minVersion: '2007'
  });

  list.push({
    name: 'IMPRODUCT', tr: 'SANÇARP', ru: 'МНИМ.ПРОИЗВЕД', category: 'engineering',
    syntax: 'IMPRODUCT(inumber1, [inumber2], ...)',
    args: [
      argInum('1', 'Çarpılacak ilk karmaşık sayı', 'Первое перемножаемое комплексное число', 'The first complex number to multiply'),
      arg('inumber2', 'ksayı2', 'компл_число2', true, 'Çarpılacak ek karmaşık sayılar (en çok 255)', 'Дополнительные комплексные множители (до 255)', 'Additional complex numbers to multiply (up to 255)')
    ],
    desc: t3('1 ile 255 arasındaki karmaşık sayının çarpımını verir.',
             'Возвращает произведение от 1 до 255 комплексных чисел.',
             'Returns the product of 1 to 255 complex numbers.'),
    example: { formula: 'IMPRODUCT("3+4i","5-3i")',
      tr: '3+4i ile 5-3i sayılarını çarpar: "27+11i"',
      ru: 'Перемножает 3+4i и 5-3i: «27+11i»',
      en: 'Multiplies 3+4i by 5-3i: "27+11i"' },
    keywords: { tr: ['karmaşık sayı çarpma', 'karmaşık sayıları çarp', 'kompleks çarpım', 'sanal sayı çarpma'],
                ru: ['умножение комплексных чисел', 'перемножить комплексные числа', 'произведение комплексных чисел', 'умножить мнимые числа'],
                en: ['multiply complex numbers', 'complex product', 'multiply imaginary numbers'] },
    minVersion: '2007'
  });

  list.push({
    name: 'IMREAL', tr: 'SANGERÇEK', ru: 'МНИМ.ВЕЩ', category: 'engineering',
    syntax: 'IMREAL(inumber)',
    args: [argInum('', 'Gerçek katsayısı alınacak karmaşık sayı', 'Комплексное число, действительную часть которого нужно получить', 'The complex number whose real coefficient you want')],
    desc: t3('Karmaşık sayının gerçek katsayısını (x) verir.',
             'Возвращает действительную (вещественную) часть комплексного числа.',
             'Returns the real coefficient (x) of a complex number.'),
    example: { formula: 'IMREAL("3+4i")',
      tr: '3+4i karmaşık sayısının gerçek kısmını verir: 3',
      ru: 'Возвращает действительную часть комплексного числа 3+4i: 3',
      en: 'Returns the real part of 3+4i: 3' },
    keywords: { tr: ['gerçek kısım', 'karmaşık sayının gerçek kısmı', 'reel kısım', 'gerçek katsayı'],
                ru: ['действительная часть', 'вещественная часть комплексного числа', 'реальная часть', 'действительный коэффициент'],
                en: ['real part', 'real coefficient', 'real part of complex number'] },
    minVersion: '2007'
  });

  list.push({
    name: 'IMSEC', tr: 'SANSEC', ru: 'МНИМ.SEC', category: 'engineering',
    syntax: 'IMSEC(inumber)',
    args: [argInum('', 'Sekantı alınacak karmaşık sayı', 'Комплексное число, секанс которого нужно найти', 'The complex number whose secant you want')],
    desc: t3('Karmaşık sayının sekantını (1/cos) verir.',
             'Возвращает секанс (1/cos) комплексного числа.',
             'Returns the secant (1/cos) of a complex number.'),
    example: { formula: 'IMSEC("4+3i")',
      tr: '4+3i karmaşık sayısının sekantını verir (≈ -0,0653+0,0752i)',
      ru: 'Возвращает секанс числа 4+3i (≈ -0,0653+0,0752i)',
      en: 'Returns the secant of 4+3i (≈ -0.0653+0.0752i)' },
    keywords: { tr: ['karmaşık sekant', 'kompleks sec', 'sanal sekant'],
                ru: ['секанс комплексного числа', 'комплексный секанс', 'мнимый sec'],
                en: ['complex secant', 'complex sec', 'secant of complex number'] },
    minVersion: '2013'
  });

  list.push({
    name: 'IMSECH', tr: 'SANSECH', ru: 'МНИМ.SECH', category: 'engineering',
    syntax: 'IMSECH(inumber)',
    args: [argInum('', 'Hiperbolik sekantı alınacak karmaşık sayı', 'Комплексное число, гиперболический секанс которого нужно найти', 'The complex number whose hyperbolic secant you want')],
    desc: t3('Karmaşık sayının hiperbolik sekantını verir.',
             'Возвращает гиперболический секанс комплексного числа.',
             'Returns the hyperbolic secant of a complex number.'),
    example: { formula: 'IMSECH("4+3i")',
      tr: '4+3i karmaşık sayısının hiperbolik sekantını verir (≈ -0,0363-0,0052i)',
      ru: 'Возвращает гиперболический секанс числа 4+3i (≈ -0,0363-0,0052i)',
      en: 'Returns the hyperbolic secant of 4+3i (≈ -0.0363-0.0052i)' },
    keywords: { tr: ['karmaşık hiperbolik sekant', 'kompleks sech', 'sanal sech'],
                ru: ['гиперболический секанс комплексного числа', 'комплексный sech', 'мнимый sech'],
                en: ['complex hyperbolic secant', 'complex sech', 'hyperbolic secant of complex number'] },
    minVersion: '2013'
  });

  list.push({
    name: 'IMSIN', tr: 'SANSIN', ru: 'МНИМ.SIN', category: 'engineering',
    syntax: 'IMSIN(inumber)',
    args: [argInum('', 'Sinüsü alınacak karmaşık sayı', 'Комплексное число, синус которого нужно найти', 'The complex number whose sine you want')],
    desc: t3('Karmaşık sayının sinüsünü verir.',
             'Возвращает синус комплексного числа.',
             'Returns the sine of a complex number.'),
    example: { formula: 'IMSIN("1+i")',
      tr: '1+i karmaşık sayısının sinüsünü verir (≈ 1,2985+0,6350i)',
      ru: 'Возвращает синус комплексного числа 1+i (≈ 1,2985+0,6350i)',
      en: 'Returns the sine of 1+i (≈ 1.2985+0.6350i)' },
    keywords: { tr: ['karmaşık sinüs', 'karmaşık sayının sinüsü', 'kompleks sin', 'sanal sinüs'],
                ru: ['синус комплексного числа', 'комплексный синус', 'sin комплексного', 'мнимый синус'],
                en: ['complex sine', 'sine of complex number', 'complex sin'] },
    minVersion: '2007'
  });

  list.push({
    name: 'IMSINH', tr: 'SANSINH', ru: 'МНИМ.SINH', category: 'engineering',
    syntax: 'IMSINH(inumber)',
    args: [argInum('', 'Hiperbolik sinüsü alınacak karmaşık sayı', 'Комплексное число, гиперболический синус которого нужно найти', 'The complex number whose hyperbolic sine you want')],
    desc: t3('Karmaşık sayının hiperbolik sinüsünü verir.',
             'Возвращает гиперболический синус комплексного числа.',
             'Returns the hyperbolic sine of a complex number.'),
    example: { formula: 'IMSINH("4+3i")',
      tr: '4+3i karmaşık sayısının hiperbolik sinüsünü verir (≈ -27,0168+3,8537i)',
      ru: 'Возвращает гиперболический синус числа 4+3i (≈ -27,0168+3,8537i)',
      en: 'Returns the hyperbolic sine of 4+3i (≈ -27.0168+3.8537i)' },
    keywords: { tr: ['karmaşık hiperbolik sinüs', 'kompleks sinh', 'sanal sinh'],
                ru: ['гиперболический синус комплексного числа', 'комплексный sinh', 'мнимый sinh'],
                en: ['complex hyperbolic sine', 'complex sinh', 'hyperbolic sine of complex number'] },
    minVersion: '2013'
  });

  list.push({
    name: 'IMSQRT', tr: 'SANKAREKÖK', ru: 'МНИМ.КОРЕНЬ', category: 'engineering',
    syntax: 'IMSQRT(inumber)',
    args: [argInum('', 'Karekökü alınacak karmaşık sayı', 'Комплексное число, квадратный корень которого нужно найти', 'The complex number whose square root you want')],
    desc: t3('Karmaşık sayının karekökünü verir.',
             'Возвращает квадратный корень из комплексного числа.',
             'Returns the square root of a complex number.'),
    example: { formula: 'IMSQRT("1+2i")',
      tr: '1+2i karmaşık sayısının karekökünü verir (≈ 1,2720+0,7862i)',
      ru: 'Возвращает квадратный корень из 1+2i (≈ 1,2720+0,7862i)',
      en: 'Returns the square root of 1+2i (≈ 1.2720+0.7862i)' },
    keywords: { tr: ['karmaşık karekök', 'karmaşık sayının karekökü', 'kompleks kök', 'negatif sayının karekökü', 'sanal karekök'],
                ru: ['корень из комплексного числа', 'квадратный корень комплексного', 'комплексный корень', 'корень из отрицательного числа', 'мнимый корень'],
                en: ['complex square root', 'square root of negative number', 'complex sqrt'] },
    minVersion: '2007'
  });

  list.push({
    name: 'IMSUB', tr: 'SANÇIKAR', ru: 'МНИМ.РАЗН', category: 'engineering',
    syntax: 'IMSUB(inumber1, inumber2)',
    args: [
      argInum('1', 'Çıkarma işleminin yapılacağı karmaşık sayı (eksilen)', 'Комплексное уменьшаемое', 'The complex number to subtract from (minuend)'),
      argInum('2', 'Çıkarılacak karmaşık sayı (çıkan)', 'Комплексное вычитаемое', 'The complex number to subtract (subtrahend)')
    ],
    desc: t3('İki karmaşık sayının farkını verir.',
             'Возвращает разность двух комплексных чисел.',
             'Returns the difference of two complex numbers.'),
    example: { formula: 'IMSUB("13+4i","5+3i")',
      tr: '13+4i sayısından 5+3i sayısını çıkarır: "8+i"',
      ru: 'Вычитает 5+3i из 13+4i: «8+i»',
      en: 'Subtracts 5+3i from 13+4i: "8+i"' },
    keywords: { tr: ['karmaşık sayı çıkarma', 'iki karmaşık sayının farkı', 'kompleks fark', 'sanal sayı çıkarma'],
                ru: ['вычитание комплексных чисел', 'разность комплексных чисел', 'вычесть комплексное число', 'разность мнимых чисел'],
                en: ['subtract complex numbers', 'complex difference', 'subtract imaginary numbers'] },
    minVersion: '2007'
  });

  list.push({
    name: 'IMSUM', tr: 'SANTOPLA', ru: 'МНИМ.СУММ', category: 'engineering',
    syntax: 'IMSUM(inumber1, [inumber2], ...)',
    args: [
      argInum('1', 'Toplanacak ilk karmaşık sayı', 'Первое складываемое комплексное число', 'The first complex number to add'),
      arg('inumber2', 'ksayı2', 'компл_число2', true, 'Toplanacak ek karmaşık sayılar (en çok 255)', 'Дополнительные комплексные слагаемые (до 255)', 'Additional complex numbers to add (up to 255)')
    ],
    desc: t3('1 ile 255 arasındaki karmaşık sayının toplamını verir.',
             'Возвращает сумму от 1 до 255 комплексных чисел.',
             'Returns the sum of 1 to 255 complex numbers.'),
    example: { formula: 'IMSUM("3+4i","5-3i")',
      tr: '3+4i ile 5-3i sayılarını toplar: "8+i"',
      ru: 'Складывает 3+4i и 5-3i: «8+i»',
      en: 'Adds 3+4i and 5-3i: "8+i"' },
    keywords: { tr: ['karmaşık sayı toplama', 'karmaşık sayıları topla', 'kompleks toplam', 'sanal sayı toplama'],
                ru: ['сложение комплексных чисел', 'сложить комплексные числа', 'сумма комплексных чисел', 'сумма мнимых чисел'],
                en: ['add complex numbers', 'complex sum', 'add imaginary numbers'] },
    minVersion: '2007'
  });

  list.push({
    name: 'IMTAN', tr: 'SANTAN', ru: 'МНИМ.TAN', category: 'engineering',
    syntax: 'IMTAN(inumber)',
    args: [argInum('', 'Tanjantı alınacak karmaşık sayı', 'Комплексное число, тангенс которого нужно найти', 'The complex number whose tangent you want')],
    desc: t3('Karmaşık sayının tanjantını verir.',
             'Возвращает тангенс комплексного числа.',
             'Returns the tangent of a complex number.'),
    example: { formula: 'IMTAN("4+3i")',
      tr: '4+3i karmaşık sayısının tanjantını verir (≈ 0,0049+1,0007i)',
      ru: 'Возвращает тангенс числа 4+3i (≈ 0,0049+1,0007i)',
      en: 'Returns the tangent of 4+3i (≈ 0.0049+1.0007i)' },
    keywords: { tr: ['karmaşık tanjant', 'kompleks tan', 'sanal tanjant'],
                ru: ['тангенс комплексного числа', 'комплексный тангенс', 'мнимый tan'],
                en: ['complex tangent', 'complex tan', 'tangent of complex number'] },
    minVersion: '2013'
  });

  /* ---- Octal conversions ---- */
  list.push({
    name: 'OCT2BIN', tr: 'OCT2BIN', ru: 'ВОСЬМ.В.ДВ', category: 'engineering',
    syntax: 'OCT2BIN(number, [places])',
    args: [argBaseNumber('sekizli (octal)', 'восьмеричное', 'octal', 'en çok 10 karakter; sonuç −512 ile 511 arasında olmalıdır', 'не более 10 знаков; результат должен лежать в диапазоне от −512 до 511', 'up to 10 characters; the result must fit between −512 and 511'), argPlaces()],
    desc: t3('Sekizli (octal) sayıyı ikili (binary) sayıya dönüştürür.',
             'Преобразует восьмеричное число в двоичное.',
             'Converts an octal number to binary.'),
    example: { formula: 'OCT2BIN(3,3)',
      tr: 'Sekizli 3 sayısını 3 basamaklı ikili "011" metnine çevirir',
      ru: 'Преобразует восьмеричное 3 в двоичное «011» длиной 3 знака',
      en: 'Converts octal 3 to the 3-digit binary "011"' },
    keywords: { tr: ['sekizliden ikiliye', 'octal binary çevir', 'sekizli sayı ikili', 'taban dönüştürme', '8 tabanından 2 tabanına'],
                ru: ['из восьмеричной в двоичную', 'восьмеричное в двоичное', 'октальное в бинарное', 'перевод систем счисления', 'из 8 в 2'],
                en: ['octal to binary', 'convert octal', 'base conversion'] },
    minVersion: '2007'
  });

  list.push({
    name: 'OCT2DEC', tr: 'OCT2DEC', ru: 'ВОСЬМ.В.ДЕС', category: 'engineering',
    syntax: 'OCT2DEC(number)',
    args: [argBaseNumber('sekizli (octal)', 'восьмеричное', 'octal', 'en çok 10 karakter, en soldaki bit işaret bitidir', 'не более 10 знаков, старший бит — знаковый', 'up to 10 characters, the most significant bit is the sign bit')],
    desc: t3('Sekizli (octal) sayıyı ondalık sayıya dönüştürür.',
             'Преобразует восьмеричное число в десятичное.',
             'Converts an octal number to decimal.'),
    example: { formula: 'OCT2DEC(54)',
      tr: 'Sekizli 54 sayısını ondalık 44 değerine çevirir',
      ru: 'Преобразует восьмеричное 54 в десятичное 44',
      en: 'Converts octal 54 to decimal 44' },
    keywords: { tr: ['sekizliden ondalığa', 'octal ondalık çevir', 'sekizli sayı dönüştür', 'taban dönüştürme', '8 tabanından 10 tabanına'],
                ru: ['из восьмеричной в десятичную', 'восьмеричное в десятичное', 'октальное число в десятичное', 'перевод систем счисления', 'из 8 в 10'],
                en: ['octal to decimal', 'convert octal', 'base conversion'] },
    minVersion: '2007'
  });

  list.push({
    name: 'OCT2HEX', tr: 'OCT2HEX', ru: 'ВОСЬМ.В.ШЕСТН', category: 'engineering',
    syntax: 'OCT2HEX(number, [places])',
    args: [argBaseNumber('sekizli (octal)', 'восьмеричное', 'octal', 'en çok 10 karakter', 'не более 10 знаков', 'up to 10 characters'), argPlaces()],
    desc: t3('Sekizli (octal) sayıyı onaltılık (hexadecimal) sayıya dönüştürür.',
             'Преобразует восьмеричное число в шестнадцатеричное.',
             'Converts an octal number to hexadecimal.'),
    example: { formula: 'OCT2HEX(100,4)',
      tr: 'Sekizli 100 sayısını 4 karakterli onaltılık "0040" metnine çevirir',
      ru: 'Преобразует восьмеричное 100 в шестнадцатеричное «0040» длиной 4 знака',
      en: 'Converts octal 100 to the 4-character hexadecimal "0040"' },
    keywords: { tr: ['sekizliden onaltılığa', 'octal hex çevir', 'sekizli sayı onaltılık', 'taban dönüştürme', '8 tabanından 16 tabanına'],
                ru: ['из восьмеричной в шестнадцатеричную', 'восьмеричное в hex', 'октальное в шестнадцатеричное', 'перевод систем счисления', 'из 8 в 16'],
                en: ['octal to hex', 'octal to hexadecimal', 'base conversion'] },
    minVersion: '2007'
  });

  /* =====================================================================================
   *  WEB  (Excel 2013+, Windows only; they need an internet connection at calculation time)
   * ===================================================================================== */
  list.push({
    name: 'ENCODEURL', tr: 'URLKODLA', ru: 'КОДИР.URL', category: 'web',
    syntax: 'ENCODEURL(text)',
    args: [arg('text', 'metin', 'текст', false, 'URL olarak kodlanacak metin', 'Текст, который нужно закодировать для URL', 'The text to URL-encode')],
    desc: t3('Metni URL’de güvenle kullanılabilecek biçimde kodlar (boşluk → %20, Türkçe harfler → %C3%BC gibi).',
             'Возвращает текст, закодированный для безопасного использования в URL (пробел → %20, кириллица → %D0%B0 и т. д.).',
             'Returns a URL-encoded string (space → %20, non-ASCII characters → percent-escaped bytes).'),
    example: { formula: 'ENCODEURL(A2)',
      tr: 'A2’deki "Satış raporu 2024" metnini "Sat%C4%B1%C5%9F%20raporu%202024" biçimine çevirir; WEBSERVICE adreslerinde sorgu parametresi oluştururken kullanılır',
      ru: 'Преобразует текст «Отчёт 2024» из A2 в «%D0%9E%D1%82%D1%87%D1%91%D1%82%202024»; удобно для параметров запроса в WEBSERVICE',
      en: 'Turns the text "Sales report 2024" in A2 into "Sales%20report%202024"; useful for building query parameters for WEBSERVICE' },
    keywords: { tr: ['url kodla', 'url encode', 'adres kodlama', 'boşluğu %20 yap', 'web adresi için metin kodla', 'yüzde kodlama'],
                ru: ['кодировать url', 'url encode', 'закодировать адрес', 'пробел в %20', 'кодирование для веб адреса', 'процентное кодирование'],
                en: ['url encode', 'percent encoding', 'encode query string'] },
    minVersion: '2013'
  });

  list.push({
    name: 'FILTERXML', tr: 'XMLFİLTRELE', ru: 'ФИЛЬТР.XML', category: 'web',
    syntax: 'FILTERXML(xml, xpath)',
    args: [
      arg('xml', 'xml', 'xml', false, 'Geçerli XML içeren metin (ör. WEBSERVICE sonucu veya bir hücre)', 'Текст с корректным XML (например, результат WEBSERVICE или ячейка)', 'Text containing valid XML (for example a WEBSERVICE result or a cell)'),
      arg('xpath', 'xpath', 'xpath', false, 'Alınacak düğümleri seçen XPath ifadesi, ör. "//product/price"', 'Выражение XPath, выбирающее нужные узлы, например "//product/price"', 'XPath expression selecting the nodes to return, e.g. "//product/price"')
    ],
    desc: t3('XML metninden XPath ifadesiyle eşleşen düğümlerin değerlerini verir (birden fazla eşleşme dizi olarak döner).',
             'Возвращает значения узлов XML-текста, соответствующих выражению XPath (несколько совпадений возвращаются массивом).',
             'Returns the values of the nodes in an XML string that match an XPath expression (multiple matches spill as an array).'),
    example: { formula: 'FILTERXML(A2,"//product/price")',
      tr: 'A2’deki XML metninden tüm <product> öğelerinin <price> değerlerini çıkarır; "//item/@id" gibi ifadelerle öznitelikler de alınabilir',
      ru: 'Извлекает из XML-текста в A2 значения <price> всех элементов <product>; выражениями вроде "//item/@id" можно получить и атрибуты',
      en: 'Extracts the <price> values of every <product> element from the XML text in A2; expressions like "//item/@id" return attributes' },
    keywords: { tr: ['xml ayrıştır', 'xml içinden değer al', 'xpath', 'xml filtrele', 'xml veri çek', 'metni parçala xml'],
                ru: ['разобрать xml', 'извлечь значение из xml', 'xpath', 'фильтр xml', 'получить данные из xml', 'парсинг xml'],
                en: ['parse xml', 'xpath', 'extract from xml'] },
    minVersion: '2013'
  });

  list.push({
    name: 'WEBSERVICE', tr: 'WEBHİZMETİ', ru: 'ВЕБСЛУЖБА', category: 'web',
    syntax: 'WEBSERVICE(url)',
    args: [arg('url', 'url', 'url', false, 'Çağrılacak web hizmetinin tam adresi (en çok 2048 karakter, http veya https)', 'Полный адрес веб-службы (до 2048 символов, http или https)', 'The full address of the web service to call (up to 2048 characters, http or https)')],
    desc: t3('Belirtilen URL’den web hizmetinin döndürdüğü metni (XML, JSON vb.) verir; internet bağlantısı gerektirir ve Excel Online ile Mac’te çalışmaz.',
             'Возвращает текст (XML, JSON и т. п.), полученный от веб-службы по указанному URL; требует подключения к интернету и не работает в Excel Online и на Mac.',
             'Returns the text (XML, JSON, etc.) returned by a web service at the given URL; requires an internet connection and is unavailable in Excel Online and on Mac.'),
    example: { formula: 'WEBSERVICE("https://api.example.com/rates?base=USD")',
      tr: 'Belirtilen adresten kur verisini metin olarak çeker; sonuç XML ise FILTERXML ile ayrıştırılır',
      ru: 'Загружает данные о курсах с указанного адреса в виде текста; если ответ в формате XML, его разбирают функцией FILTERXML',
      en: 'Downloads exchange-rate data from the given address as text; parse an XML response with FILTERXML' },
    keywords: { tr: ['web hizmeti', 'internetten veri çek', 'api çağır', 'url içeriğini al', 'web servisi', 'döviz kuru çek'],
                ru: ['веб служба', 'получить данные из интернета', 'вызвать api', 'загрузить содержимое url', 'веб сервис', 'курс валют из интернета'],
                en: ['web service', 'call api', 'fetch url', 'get data from internet'] },
    minVersion: '2013',
    volatile: false
  });

  /* =====================================================================================
   *  CUBE  (OLAP / Power Pivot data model; connection "ThisWorkbookDataModel" for Power Pivot)
   * ===================================================================================== */
  function argConnection() {
    return arg('connection', 'bağlantı', 'подключение', false,
      'Küp bağlantısının adı (metin), Power Pivot veri modeli için "ThisWorkbookDataModel"',
      'Имя подключения к кубу (текст); для модели данных Power Pivot — "ThisWorkbookDataModel"',
      'Name of the cube connection (text); "ThisWorkbookDataModel" for the Power Pivot data model');
  }
  function argCaption() {
    return arg('caption', 'başlık', 'заголовок', true,
      'Küpten gelen başlık yerine hücrede gösterilecek metin',
      'Текст, отображаемый в ячейке вместо заголовка из куба',
      'Text shown in the cell instead of the caption from the cube');
  }
  function argMemberExpr(optional, n) {
    n = n || '';
    return arg('member_expression' + n, 'üye_ifadesi' + n, 'выражение_элемента' + n, !!optional,
      'Küpteki üyeyi veya demeti belirten MDX ifadesi, ör. "[Date].[Year].&[2024]"; CUBEMEMBER içeren bir hücreye başvuru da olabilir',
      'Многомерное выражение (MDX), задающее элемент или кортеж куба, например "[Date].[Year].&[2024]"; можно сослаться на ячейку с CUBEMEMBER',
      'MDX expression naming a member or tuple, e.g. "[Date].[Year].&[2024]"; may also be a reference to a cell holding CUBEMEMBER');
  }

  list.push({
    name: 'CUBEKPIMEMBER', tr: 'KÜPKPIÜYESİ', ru: 'КУБЭЛЕМЕНТКИП', category: 'cube',
    syntax: 'CUBEKPIMEMBER(connection, kpi_name, kpi_property, [caption])',
    args: [
      argConnection(),
      arg('kpi_name', 'kpi_adı', 'имя_кпэ', false, 'Küpte tanımlı KPI’nın adı (metin)', 'Имя ключевого показателя эффективности (КПЭ) в кубе', 'Name of the KPI defined in the cube'),
      arg('kpi_property', 'kpi_özelliği', 'свойство_кпэ', false, 'Döndürülecek KPI bileşeni: 1 değer, 2 hedef, 3 durum, 4 eğilim, 5 ağırlık, 6 geçerli zaman üyesi', 'Компонент КПЭ: 1 — значение, 2 — цель, 3 — состояние, 4 — тенденция, 5 — вес, 6 — текущий элемент времени', 'KPI component to return: 1 value, 2 goal, 3 status, 4 trend, 5 weight, 6 current time member'),
      argCaption()
    ],
    desc: t3('Küpteki bir temel performans göstergesinin (KPI) seçilen özelliğini (değer, hedef, durum, eğilim) verir ve hücrede KPI adını gösterir.',
             'Возвращает выбранное свойство ключевого показателя эффективности (значение, цель, состояние, тенденцию) из куба и показывает в ячейке его имя.',
             'Returns the selected property of a key performance indicator (value, goal, status, trend) from the cube and shows the KPI name in the cell.'),
    example: { formula: 'CUBEKPIMEMBER("ThisWorkbookDataModel","Revenue Target",1)',
      tr: 'Veri modelindeki "Revenue Target" KPI’sının değer bileşenini getirir; sonucu CUBEVALUE içinde kullanarak sayıyı alabilirsiniz',
      ru: 'Возвращает компонент «значение» КПЭ «Revenue Target» из модели данных; число затем получают через CUBEVALUE',
      en: 'Returns the value component of the "Revenue Target" KPI from the data model; pass the result to CUBEVALUE to get the number' },
    keywords: { tr: ['kpi üyesi', 'küp kpi', 'olap kpi', 'temel performans göstergesi', 'power pivot kpi'],
                ru: ['кпэ куба', 'ключевой показатель эффективности', 'olap kpi', 'power pivot kpi', 'элемент кпэ'],
                en: ['cube kpi', 'key performance indicator', 'olap kpi'] },
    minVersion: '2007'
  });

  list.push({
    name: 'CUBEMEMBER', tr: 'KÜPÜYESİ', ru: 'КУБЭЛЕМЕНТ', category: 'cube',
    syntax: 'CUBEMEMBER(connection, member_expression, [caption])',
    args: [argConnection(), argMemberExpr(false), argCaption()],
    desc: t3('Küpteki bir üyeyi veya demeti döndürür ve böylece üyenin küpte var olduğunu doğrular.',
             'Возвращает элемент или кортеж куба, тем самым подтверждая, что он существует в кубе.',
             'Returns a member or tuple from the cube, confirming that it exists.'),
    example: { formula: 'CUBEMEMBER("ThisWorkbookDataModel","[Date].[Year].&[2024]")',
      tr: 'Veri modelinden 2024 yılı üyesini getirir; bu hücre daha sonra CUBEVALUE formüllerinde filtre olarak kullanılabilir',
      ru: 'Возвращает элемент «2024 год» из модели данных; эту ячейку затем используют как фильтр в формулах CUBEVALUE',
      en: 'Returns the member for the year 2024 from the data model; the cell can then be used as a filter in CUBEVALUE formulas' },
    keywords: { tr: ['küp üyesi', 'olap üye', 'veri modeli üyesi', 'mdx üye', 'power pivot üye', 'boyut üyesi'],
                ru: ['элемент куба', 'olap элемент', 'элемент модели данных', 'mdx элемент', 'power pivot элемент', 'элемент измерения'],
                en: ['cube member', 'olap member', 'mdx member'] },
    minVersion: '2007'
  });

  list.push({
    name: 'CUBEMEMBERPROPERTY', tr: 'KÜPÜYEÖZELLİĞİ', ru: 'КУБСВОЙСТВОЭЛЕМЕНТА', category: 'cube',
    syntax: 'CUBEMEMBERPROPERTY(connection, member_expression, property)',
    args: [
      argConnection(), argMemberExpr(false),
      arg('property', 'özellik', 'свойство', false, 'Döndürülecek üye özelliğinin adı (metin) veya özelliği içeren hücreye başvuru', 'Имя возвращаемого свойства элемента (текст) или ссылка на ячейку со свойством', 'Name of the member property to return (text) or a reference to a cell holding it')
    ],
    desc: t3('Küpteki bir üyenin belirtilen özelliğinin değerini verir.',
             'Возвращает значение указанного свойства элемента куба.',
             'Returns the value of the given property of a cube member.'),
    example: { formula: 'CUBEMEMBERPROPERTY("ThisWorkbookDataModel","[Product].[Product].&[P001]","[Product].[Product].[Category]")',
      tr: 'P001 ürününün Category özelliğini (kategorisini) küpten getirir',
      ru: 'Возвращает свойство Category (категорию) товара P001 из куба',
      en: 'Returns the Category property of product P001 from the cube' },
    keywords: { tr: ['küp üye özelliği', 'olap özellik', 'üyenin özelliği', 'boyut özelliği', 'mdx özellik'],
                ru: ['свойство элемента куба', 'olap свойство', 'свойство элемента', 'атрибут измерения', 'mdx свойство'],
                en: ['cube member property', 'olap property', 'member attribute'] },
    minVersion: '2007'
  });

  list.push({
    name: 'CUBERANKEDMEMBER', tr: 'KÜPÜYESIRASI', ru: 'КУБПОРЭЛЕМЕНТ', category: 'cube',
    syntax: 'CUBERANKEDMEMBER(connection, set_expression, rank, [caption])',
    args: [
      argConnection(),
      arg('set_expression', 'küme_ifadesi', 'выражение_набора', false, 'Küme MDX ifadesi veya CUBESET içeren hücreye başvuru', 'Выражение MDX для набора или ссылка на ячейку с CUBESET', 'MDX set expression or a reference to a cell containing CUBESET'),
      arg('rank', 'sıra', 'ранг', false, 'Döndürülecek üyenin sırası (1 = ilk)', 'Порядковый номер возвращаемого элемента (1 — первый)', 'Position of the member to return (1 = first)'),
      argCaption()
    ],
    desc: t3('Bir kümedeki n. sıradaki üyeyi verir; en iyi 10 satış temsilcisi gibi sıralı listeler için kullanılır.',
             'Возвращает n-й элемент набора; применяется для рейтингов вроде «10 лучших менеджеров».',
             'Returns the nth member of a set; used for ranked lists such as the top 10 sales reps.'),
    example: { formula: 'CUBERANKEDMEMBER("ThisWorkbookDataModel",B2,1)',
      tr: 'B2’deki (CUBESET ile tanımlanmış) sıralı kümenin birinci üyesini getirir; 2, 3 … ile liste aşağı doğru doldurulur',
      ru: 'Возвращает первый элемент отсортированного набора из B2 (заданного CUBESET); значения 2, 3 … заполняют список дальше',
      en: 'Returns the first member of the sorted set in B2 (defined with CUBESET); use 2, 3 … to fill the list downwards' },
    keywords: { tr: ['küp sıralı üye', 'kümedeki n. üye', 'en iyi 10 küp', 'olap sıralama', 'kümenin ilk üyesi'],
                ru: ['n-й элемент набора', 'ранжированный элемент куба', 'топ 10 куб', 'olap рейтинг', 'первый элемент набора'],
                en: ['cube ranked member', 'nth member of set', 'top n cube'] },
    minVersion: '2007'
  });

  list.push({
    name: 'CUBESET', tr: 'KÜPKÜMESİ', ru: 'КУБМНОЖ', category: 'cube',
    syntax: 'CUBESET(connection, set_expression, [caption], [sort_order], [sort_by])',
    args: [
      argConnection(),
      arg('set_expression', 'küme_ifadesi', 'выражение_набора', false, 'Kümeyi tanımlayan MDX ifadesi, ör. "[Product].[Category].Children"', 'Выражение MDX, задающее набор, например "[Product].[Category].Children"', 'MDX expression defining the set, e.g. "[Product].[Category].Children"'),
      argCaption(),
      arg('sort_order', 'sıralama_düzeni', 'порядок_сортировки', true, 'Sıralama: 0 yok, 1 artan, 2 azalan, 3 alfabetik artan, 4 alfabetik azalan, 5 doğal artan, 6 doğal azalan', 'Сортировка: 0 — нет, 1 — по возрастанию, 2 — по убыванию, 3 — по алфавиту, 4 — по алфавиту в обратном порядке, 5 — естественный порядок, 6 — обратный естественный', 'Sort: 0 none, 1 ascending, 2 descending, 3 alphabetical ascending, 4 alphabetical descending, 5 natural ascending, 6 natural descending'),
      arg('sort_by', 'sıralama_ölçütü', 'сортировать_по', true, 'Sıralamada kullanılacak ölçü, ör. "[Measures].[Sales Amount]" (düzen 1 veya 2 için gerekli)', 'Мера, по которой сортировать, например "[Measures].[Sales Amount]" (нужна при порядке 1 или 2)', 'Measure used for sorting, e.g. "[Measures].[Sales Amount]" (required for orders 1 and 2)')
    ],
    desc: t3('Küpe gönderilen küme ifadesiyle hesaplanan, isteğe bağlı olarak sıralanmış üye kümesini tanımlar ve hücreye döndürür.',
             'Определяет вычисляемый кубом набор элементов (при необходимости отсортированный) и возвращает его в ячейку.',
             'Defines a set of members computed by the cube (optionally sorted) and returns it to the cell.'),
    example: { formula: 'CUBESET("ThisWorkbookDataModel","[Product].[Category].Children","Categories",2,"[Measures].[Sales Amount]")',
      tr: 'Tüm ürün kategorilerini satış tutarına göre azalan sırada bir küme olarak tanımlar; hücrede "Categories" yazısı görünür',
      ru: 'Определяет набор всех категорий товаров, отсортированный по убыванию суммы продаж; в ячейке отображается «Categories»',
      en: 'Defines the set of all product categories sorted by sales amount descending; the cell shows "Categories"' },
    keywords: { tr: ['küp kümesi', 'olap küme', 'mdx küme', 'üye kümesi tanımla', 'power pivot küme', 'sıralı küme'],
                ru: ['набор куба', 'olap набор', 'mdx набор', 'множество элементов', 'power pivot набор', 'отсортированный набор'],
                en: ['cube set', 'olap set', 'mdx set'] },
    minVersion: '2007'
  });

  list.push({
    name: 'CUBESETCOUNT', tr: 'KÜPKÜMESAYISI', ru: 'КУБЧИСЛОЭЛМНОЖ', category: 'cube',
    syntax: 'CUBESETCOUNT(set)',
    args: [arg('set', 'küme', 'набор', false, 'CUBESET işlevi veya CUBESET içeren hücreye başvuru', 'Функция CUBESET или ссылка на ячейку с CUBESET', 'A CUBESET function or a reference to a cell containing CUBESET')],
    desc: t3('Bir kümedeki öğe sayısını verir.',
             'Возвращает число элементов в наборе.',
             'Returns the number of items in a set.'),
    example: { formula: 'CUBESETCOUNT(B2)',
      tr: 'B2’deki CUBESET kümesinin kaç üye içerdiğini sayar',
      ru: 'Считает, сколько элементов содержит набор CUBESET в ячейке B2',
      en: 'Counts how many members the CUBESET in B2 contains' },
    keywords: { tr: ['küme öğe sayısı', 'kümedeki üye sayısı', 'küp kümesi say', 'olap sayım'],
                ru: ['число элементов набора', 'сколько элементов в наборе', 'количество элементов куба', 'olap подсчёт'],
                en: ['cube set count', 'count members in set', 'number of items in cube set'] },
    minVersion: '2007'
  });

  list.push({
    name: 'CUBEVALUE', tr: 'KÜPDEĞERİ', ru: 'КУБЗНАЧЕНИЕ', category: 'cube',
    syntax: 'CUBEVALUE(connection, [member_expression1], [member_expression2], ...)',
    args: [
      argConnection(),
      argMemberExpr(true, '1'),
      arg('member_expression2', 'üye_ifadesi2', 'выражение_элемента2', true, 'Ek üye ifadeleri veya CUBEMEMBER hücreleri; her biri sonucu daha da filtreler (en çok 254)', 'Дополнительные выражения элементов или ячейки с CUBEMEMBER; каждое сужает результат (до 254)', 'Additional member expressions or CUBEMEMBER cells; each one narrows the result further (up to 254)')
    ],
    desc: t3('Küpten, verilen üyelerin (filtrelerin) kesişimindeki toplu değeri verir; PivotTable’sız rapor hücreleri için kullanılır.',
             'Возвращает агрегированное значение из куба на пересечении указанных элементов (фильтров); используется для отчётов без сводной таблицы.',
             'Returns the aggregated value from the cube at the intersection of the given members (filters); used for report cells without a PivotTable.'),
    example: { formula: 'CUBEVALUE("ThisWorkbookDataModel","[Measures].[Sales Amount]","[Date].[Year].&[2024]")',
      tr: 'Veri modelinden 2024 yılına ait toplam satış tutarını getirir; üyeler yerine CUBEMEMBER içeren hücrelere ($B$1 gibi) başvurulabilir',
      ru: 'Возвращает из модели данных сумму продаж за 2024 год; вместо выражений можно ссылаться на ячейки с CUBEMEMBER (например $B$1)',
      en: 'Returns the total sales amount for 2024 from the data model; you may reference CUBEMEMBER cells (such as $B$1) instead of expressions' },
    keywords: { tr: ['küp değeri', 'olap değer', 'veri modelinden değer al', 'power pivot değer', 'pivot olmadan toplam', 'mdx değer', 'küp ölçüsü'],
                ru: ['значение куба', 'olap значение', 'получить значение из модели данных', 'power pivot значение', 'итог без сводной таблицы', 'mdx значение', 'мера куба'],
                en: ['cube value', 'olap value', 'data model value', 'power pivot value'] },
    minVersion: '2007'
  });

  /* =====================================================================================
   *  COMPATIBILITY  (legacy statistical names; Excel still accepts them, modern names since 2010)
   * ===================================================================================== */
  function argProb(dTr, dRu, dEn) {
    return arg('probability', 'olasılık', 'вероятность', false,
      dTr || 'Dağılıma ait olasılık (0 ile 1 arasında)',
      dRu || 'Вероятность, соответствующая распределению (от 0 до 1)',
      dEn || 'A probability associated with the distribution (between 0 and 1)');
  }
  function argAlpha(dTr, dRu, dEn) { return arg('alpha', 'alfa', 'альфа', false, dTr || 'Dağılımın alfa parametresi (şekil)', dRu || 'Параметр альфа распределения (форма)', dEn || 'The alpha parameter of the distribution (shape)'); }
  function argBeta(dTr, dRu, dEn) { return arg('beta', 'beta', 'бета', false, dTr || 'Dağılımın beta parametresi (ölçek)', dRu || 'Параметр бета распределения (масштаб)', dEn || 'The beta parameter of the distribution (scale)'); }
  function argMean() { return arg('mean', 'ortalama', 'среднее', false, 'Dağılımın aritmetik ortalaması', 'Среднее арифметическое распределения', 'The arithmetic mean of the distribution'); }
  function argStdev() { return arg('standard_dev', 'standart_sapma', 'стандартное_откл', false, 'Dağılımın standart sapması (pozitif)', 'Стандартное отклонение распределения (положительное)', 'The standard deviation of the distribution (positive)'); }
  function argDegFreedom(n) {
    n = n || '';
    return arg('deg_freedom' + n, 'serbestlik_derecesi' + n, 'степени_свободы' + n, false,
      'Serbestlik derecesi' + (n ? ' (' + (n === '1' ? 'pay' : 'payda') + ')' : ''),
      'Число степеней свободы' + (n ? ' (' + (n === '1' ? 'числитель' : 'знаменатель') + ')' : ''),
      'Degrees of freedom' + (n ? ' (' + (n === '1' ? 'numerator' : 'denominator') + ')' : ''));
  }
  function argArray(n, dTr, dRu, dEn) {
    n = n || '';
    return arg('array' + n, 'dizi' + n, 'массив' + n, false,
      dTr || (n ? n + '. veri aralığı veya dizisi' : 'Veri aralığı veya dizisi'),
      dRu || (n ? 'Диапазон или массив данных ' + n : 'Диапазон или массив данных'),
      dEn || (n ? 'Data range or array ' + n : 'The data range or array'));
  }
  var ABtr = 'Dağılım aralığının isteğe bağlı alt sınırı (varsayılan 0)', ABru = 'Необязательная нижняя граница интервала (по умолчанию 0)', ABen = 'Optional lower bound of the interval (default 0)';
  var BBtr = 'Dağılım aralığının isteğe bağlı üst sınırı (varsayılan 1)', BBru = 'Необязательная верхняя граница интервала (по умолчанию 1)', BBen = 'Optional upper bound of the interval (default 1)';

  /* desc builder: what it returns + which modern function replaces it (EN name + localized name) */
  function compatDesc(whatTr, whatRu, whatEn, modernEN, modernTR, modernRU) {
    return t3(
      whatTr + '; uyumluluk için korunan eski addır, yeni sürümlerde yerini ' + modernEN + ' (' + modernTR + ') aldı.',
      whatRu + '; устаревшее имя, сохранённое для совместимости — в новых версиях его заменяет ' + modernEN + ' (' + modernRU + ').',
      whatEn + '; legacy name kept for compatibility — replaced by ' + modernEN + ' in current Excel.'
    );
  }

  list.push({
    name: 'BETADIST', tr: 'BETADAĞ', ru: 'БЕТАРАСП', category: 'compat', replacedBy: 'BETA.DIST',
    syntax: 'BETADIST(x, alpha, beta, [A], [B])',
    args: [
      argX('İşlevin hesaplanacağı, A ile B arasındaki değer', 'Значение между A и B, для которого вычисляется функция', 'The value between A and B at which to evaluate the function'),
      argAlpha(), argBeta(),
      arg('A', 'A', 'A', true, ABtr, ABru, ABen), arg('B', 'B', 'B', true, BBtr, BBru, BBen)
    ],
    desc: compatDesc('Kümülatif beta olasılık yoğunluk işlevinin değerini verir', 'Возвращает интегральную функцию бета-распределения', 'Returns the cumulative beta probability density function', 'BETA.DIST', 'BETA.DAĞ', 'БЕТА.РАСП'),
    example: { formula: 'BETADIST(2,8,10,1,3)',
      tr: 'Alfa 8, beta 10, aralık 1–3 olan beta dağılımında x = 2 için kümülatif olasılığı verir (≈ 0,6855)',
      ru: 'Возвращает интегральную вероятность бета-распределения с альфа 8, бета 10 на отрезке 1–3 при x = 2 (≈ 0,6855)',
      en: 'Cumulative probability of the beta distribution with alpha 8, beta 10 on the interval 1–3 at x = 2 (≈ 0.6855)' },
    keywords: { tr: ['beta dağılımı', 'kümülatif beta', 'betadağ', 'beta olasılık', 'eski beta dağılımı'],
                ru: ['бета распределение', 'интегральное бета распределение', 'бетарасп', 'бета вероятность', 'старое бета распределение'],
                en: ['beta distribution', 'cumulative beta', 'legacy betadist'] },
    minVersion: '2007'
  });

  list.push({
    name: 'BETAINV', tr: 'BETATERS', ru: 'БЕТАОБР', category: 'compat', replacedBy: 'BETA.INV',
    syntax: 'BETAINV(probability, alpha, beta, [A], [B])',
    args: [argProb('Beta dağılımına ait olasılık', 'Вероятность, связанная с бета-распределением', 'A probability associated with the beta distribution'), argAlpha(), argBeta(),
      arg('A', 'A', 'A', true, ABtr, ABru, ABen), arg('B', 'B', 'B', true, BBtr, BBru, BBen)],
    desc: compatDesc('Kümülatif beta dağılımının tersini, yani verilen olasılığa karşılık gelen x değerini verir', 'Возвращает обратную интегральную функцию бета-распределения, то есть x для заданной вероятности', 'Returns the inverse of the cumulative beta distribution, the x value for a given probability', 'BETA.INV', 'BETA.TERS', 'БЕТА.ОБР'),
    example: { formula: 'BETAINV(0.685470581,8,10,1,3)',
      tr: 'Alfa 8, beta 10, aralık 1–3 olan beta dağılımında 0,6855 olasılığına karşılık gelen x değerini verir (2)',
      ru: 'Возвращает x, при котором интегральная вероятность бета-распределения (альфа 8, бета 10, отрезок 1–3) равна 0,6855 (2)',
      en: 'Returns the x at which the cumulative beta distribution (alpha 8, beta 10, interval 1–3) equals 0.6855 (2)' },
    keywords: { tr: ['ters beta dağılımı', 'beta dağılımı tersi', 'betaters', 'beta kantil', 'olasılıktan x bul beta'],
                ru: ['обратное бета распределение', 'квантиль бета распределения', 'бетаобр', 'x по вероятности бета'],
                en: ['inverse beta distribution', 'beta quantile', 'legacy betainv'] },
    minVersion: '2007'
  });

  list.push({
    name: 'BINOMDIST', tr: 'BİNOMDAĞ', ru: 'БИНОМРАСП', category: 'compat', replacedBy: 'BINOM.DIST',
    syntax: 'BINOMDIST(number_s, trials, probability_s, cumulative)',
    args: [
      arg('number_s', 'başarı_sayısı', 'число_успехов', false, 'Denemelerdeki başarı sayısı', 'Число успешных испытаний', 'The number of successes in trials'),
      arg('trials', 'denemeler', 'число_испытаний', false, 'Bağımsız deneme sayısı', 'Число независимых испытаний', 'The number of independent trials'),
      arg('probability_s', 'başarı_olasılığı', 'вероятность_успеха', false, 'Her denemede başarı olasılığı', 'Вероятность успеха в каждом испытании', 'The probability of success on each trial'),
      argCumulative()
    ],
    desc: compatDesc('Tek terimli binom dağılımı olasılığını (tam olarak veya en çok n başarı) verir', 'Возвращает вероятность биномиального распределения (ровно или не более n успехов)', 'Returns the individual term binomial distribution probability (exactly or at most n successes)', 'BINOM.DIST', 'BİNOM.DAĞ', 'БИНОМ.РАСП'),
    example: { formula: 'BINOMDIST(6,10,0.5,FALSE)',
      tr: '10 yazı-tura atışında tam olarak 6 tura gelme olasılığını verir (≈ 0,2051)',
      ru: 'Вероятность выпадения ровно 6 орлов при 10 бросках монеты (≈ 0,2051)',
      en: 'Probability of exactly 6 heads in 10 coin tosses (≈ 0.2051)' },
    keywords: { tr: ['binom dağılımı', 'binom olasılığı', 'başarı olasılığı deneme', 'binomdağ', 'n denemede k başarı'],
                ru: ['биномиальное распределение', 'биномиальная вероятность', 'вероятность успехов в испытаниях', 'биномрасп', 'k успехов из n'],
                en: ['binomial distribution', 'binomial probability', 'legacy binomdist'] },
    minVersion: '2007'
  });

  list.push({
    name: 'CHIDIST', tr: 'KİKAREDAĞ', ru: 'ХИ2РАСП', category: 'compat', replacedBy: 'CHISQ.DIST.RT',
    syntax: 'CHIDIST(x, deg_freedom)',
    args: [argX('Dağılımın hesaplanacağı negatif olmayan değer', 'Неотрицательное значение, для которого вычисляется распределение', 'The non-negative value at which to evaluate the distribution'), argDegFreedom()],
    desc: compatDesc('Ki-kare dağılımının sağ kuyruk olasılığını verir', 'Возвращает правостороннюю вероятность распределения хи-квадрат', 'Returns the right-tailed probability of the chi-squared distribution', 'CHISQ.DIST.RT', 'KİKARE.DAĞ.SAĞK', 'ХИ2.РАСП.ПХ'),
    example: { formula: 'CHIDIST(18.307,10)',
      tr: '10 serbestlik dereceli ki-kare dağılımında 18,307 değerinin sağ kuyruk olasılığını verir (≈ 0,05)',
      ru: 'Правосторонняя вероятность для значения 18,307 при 10 степенях свободы распределения хи-квадрат (≈ 0,05)',
      en: 'Right-tailed probability of 18.307 for the chi-squared distribution with 10 degrees of freedom (≈ 0.05)' },
    keywords: { tr: ['ki kare dağılımı', 'ki kare olasılığı', 'kikaredağ', 'sağ kuyruk ki kare', 'chi square'],
                ru: ['распределение хи квадрат', 'вероятность хи квадрат', 'хи2расп', 'правосторонний хи квадрат', 'chi square'],
                en: ['chi squared distribution', 'chi square right tail', 'legacy chidist'] },
    minVersion: '2007'
  });

  list.push({
    name: 'CHIINV', tr: 'KİKARETERS', ru: 'ХИ2ОБР', category: 'compat', replacedBy: 'CHISQ.INV.RT',
    syntax: 'CHIINV(probability, deg_freedom)',
    args: [argProb('Ki-kare dağılımının sağ kuyruk olasılığı', 'Правосторонняя вероятность распределения хи-квадрат', 'A right-tailed probability of the chi-squared distribution'), argDegFreedom()],
    desc: compatDesc('Ki-kare dağılımının sağ kuyruk olasılığının tersini, yani kritik ki-kare değerini verir', 'Возвращает обратное значение правосторонней вероятности хи-квадрат, то есть критическое значение', 'Returns the inverse of the right-tailed chi-squared probability, i.e. the critical value', 'CHISQ.INV.RT', 'KİKARE.TERS.SAĞK', 'ХИ2.ОБР.ПХ'),
    example: { formula: 'CHIINV(0.05,10)',
      tr: '10 serbestlik derecesi ve %5 anlamlılık için kritik ki-kare değerini verir (≈ 18,307)',
      ru: 'Критическое значение хи-квадрат при 10 степенях свободы и уровне значимости 5 % (≈ 18,307)',
      en: 'Critical chi-squared value for 10 degrees of freedom at the 5 % level (≈ 18.307)' },
    keywords: { tr: ['ters ki kare', 'kritik ki kare değeri', 'kikareters', 'ki kare tablo değeri', 'ki kare kantil'],
                ru: ['обратное хи квадрат', 'критическое значение хи квадрат', 'хи2обр', 'табличное значение хи квадрат', 'квантиль хи квадрат'],
                en: ['inverse chi squared', 'critical chi square value', 'legacy chiinv'] },
    minVersion: '2007'
  });

  list.push({
    name: 'CHITEST', tr: 'KİKARETEST', ru: 'ХИ2ТЕСТ', category: 'compat', replacedBy: 'CHISQ.TEST',
    syntax: 'CHITEST(actual_range, expected_range)',
    args: [
      arg('actual_range', 'gerçek_aralık', 'фактический_интервал', false, 'Gözlenen değerleri içeren aralık', 'Диапазон наблюдаемых (фактических) значений', 'The range of observed values'),
      arg('expected_range', 'beklenen_aralık', 'ожидаемый_интервал', false, 'Beklenen değerleri içeren, aynı boyutta aralık', 'Диапазон ожидаемых значений того же размера', 'The range of expected values, same size')
    ],
    desc: compatDesc('Ki-kare bağımsızlık testinin p-değerini verir', 'Возвращает p-значение критерия независимости хи-квадрат', 'Returns the p-value of the chi-squared test for independence', 'CHISQ.TEST', 'KİKARE.TEST', 'ХИ2.ТЕСТ'),
    example: { formula: 'CHITEST(B2:C4,B6:C8)',
      tr: 'B2:C4’teki gözlenen sayımları B6:C8’deki beklenen sayımlarla karşılaştırıp ki-kare testinin p-değerini verir',
      ru: 'Сравнивает наблюдаемые частоты в B2:C4 с ожидаемыми в B6:C8 и возвращает p-значение критерия хи-квадрат',
      en: 'Compares the observed counts in B2:C4 with the expected counts in B6:C8 and returns the chi-squared p-value' },
    keywords: { tr: ['ki kare testi', 'bağımsızlık testi', 'kikaretest', 'gözlenen beklenen karşılaştır', 'p değeri ki kare'],
                ru: ['критерий хи квадрат', 'тест на независимость', 'хи2тест', 'сравнить наблюдаемые и ожидаемые', 'p значение хи квадрат'],
                en: ['chi squared test', 'test for independence', 'legacy chitest'] },
    minVersion: '2007'
  });

  list.push({
    name: 'CONFIDENCE', tr: 'GÜVENİRLİK', ru: 'ДОВЕРИТ', category: 'compat', replacedBy: 'CONFIDENCE.NORM',
    syntax: 'CONFIDENCE(alpha, standard_dev, size)',
    args: [
      argAlpha('Anlamlılık düzeyi (güven düzeyi = 1 − alfa), ör. %95 güven için 0,05', 'Уровень значимости (доверительный уровень = 1 − альфа), например 0,05 для 95 %', 'Significance level (confidence level = 1 − alpha), e.g. 0.05 for 95 %'),
      arg('standard_dev', 'standart_sapma', 'стандартное_откл', false, 'Popülasyonun bilinen standart sapması', 'Известное стандартное отклонение генеральной совокупности', 'The known population standard deviation'),
      arg('size', 'boyut', 'размер', false, 'Örneklem büyüklüğü', 'Размер выборки', 'The sample size')
    ],
    desc: compatDesc('Normal dağılım kullanarak popülasyon ortalaması için güven aralığının yarı genişliğini verir', 'Возвращает половину ширины доверительного интервала для среднего по нормальному распределению', 'Returns the half-width of the confidence interval for a population mean using the normal distribution', 'CONFIDENCE.NORM', 'GÜVENİLİRLİK.NORM', 'ДОВЕРИТ.НОРМ'),
    example: { formula: 'CONFIDENCE(0.05,2.5,50)',
      tr: 'Standart sapması 2,5 olan 50 kişilik örneklemde %95 güven aralığının yarı genişliğini verir (≈ 0,6929); ortalama ± bu değer',
      ru: 'Половина ширины 95 % доверительного интервала при стандартном отклонении 2,5 и выборке из 50 (≈ 0,6929); среднее ± это значение',
      en: 'Half-width of the 95 % confidence interval for a sample of 50 with standard deviation 2.5 (≈ 0.6929); mean ± this value' },
    keywords: { tr: ['güven aralığı', 'güvenirlik', 'güven aralığı hesapla', 'hata payı', 'ortalama güven aralığı'],
                ru: ['доверительный интервал', 'доверит', 'рассчитать доверительный интервал', 'предел погрешности', 'доверительный интервал среднего'],
                en: ['confidence interval', 'margin of error', 'legacy confidence'] },
    minVersion: '2007'
  });

  list.push({
    name: 'COVAR', tr: 'KOVARYANS', ru: 'КОВАР', category: 'compat', replacedBy: 'COVARIANCE.P',
    syntax: 'COVAR(array1, array2)',
    args: [argArray('1', 'İlk değer aralığı', 'Первый диапазон значений', 'The first range of values'), argArray('2', 'İkinci değer aralığı (aynı boyutta)', 'Второй диапазон значений (того же размера)', 'The second range of values (same size)')],
    desc: compatDesc('İki veri kümesinin popülasyon kovaryansını (sapma çarpımlarının ortalamasını) verir', 'Возвращает ковариацию генеральной совокупности (среднее произведений отклонений) двух наборов данных', 'Returns the population covariance (average of the products of deviations) of two data sets', 'COVARIANCE.P', 'KOVARYANS.P', 'КОВАРИАЦИЯ.Г'),
    example: { formula: 'COVAR(A2:A10,B2:B10)',
      tr: 'A2:A10 ile B2:B10 değerlerinin birlikte nasıl değiştiğini gösteren kovaryansı verir',
      ru: 'Возвращает ковариацию, показывающую, как согласованно меняются значения A2:A10 и B2:B10',
      en: 'Returns the covariance showing how the values in A2:A10 and B2:B10 vary together' },
    keywords: { tr: ['kovaryans', 'iki değişken kovaryansı', 'birlikte değişim', 'popülasyon kovaryansı', 'kovaryans hesapla'],
                ru: ['ковариация', 'ковариация двух переменных', 'совместная изменчивость', 'ковариация генеральной совокупности', 'рассчитать ковариацию'],
                en: ['covariance', 'population covariance', 'legacy covar'] },
    minVersion: '2007'
  });

  list.push({
    name: 'CRITBINOM', tr: 'KRİTİKBİNOM', ru: 'КРИТБИНОМ', category: 'compat', replacedBy: 'BINOM.INV',
    syntax: 'CRITBINOM(trials, probability_s, alpha)',
    args: [
      arg('trials', 'denemeler', 'число_испытаний', false, 'Bernoulli denemelerinin sayısı', 'Число испытаний Бернулли', 'The number of Bernoulli trials'),
      arg('probability_s', 'başarı_olasılığı', 'вероятность_успеха', false, 'Her denemede başarı olasılığı', 'Вероятность успеха в каждом испытании', 'The probability of success on each trial'),
      argAlpha('Ölçüt değeri (0 ile 1 arasında kümülatif olasılık eşiği)', 'Критерий — порог интегральной вероятности от 0 до 1', 'The criterion value, a cumulative probability threshold between 0 and 1')
    ],
    desc: compatDesc('Kümülatif binom dağılımının ölçüt değerine eşit veya onu aştığı en küçük başarı sayısını verir', 'Возвращает наименьшее число успехов, при котором интегральное биномиальное распределение не меньше критерия', 'Returns the smallest number of successes for which the cumulative binomial distribution is at least the criterion', 'BINOM.INV', 'BİNOM.TERS', 'БИНОМ.ОБР'),
    example: { formula: 'CRITBINOM(6,0.5,0.75)',
      tr: '6 denemede, başarı olasılığı 0,5 iken kümülatif olasılığın 0,75’e ulaştığı en küçük başarı sayısını verir (4)',
      ru: 'Наименьшее число успехов из 6 испытаний с вероятностью 0,5, при котором интегральная вероятность достигает 0,75 (4)',
      en: 'Smallest number of successes in 6 trials with probability 0.5 whose cumulative probability reaches 0.75 (4)' },
    keywords: { tr: ['kritik binom', 'binom tersi', 'kabul edilebilir hata sayısı', 'kalite kontrol binom', 'kritikbinom'],
                ru: ['критическое биномиальное', 'обратное биномиальное', 'допустимое число брака', 'контроль качества биномиальное', 'критбином'],
                en: ['critical binomial', 'inverse binomial', 'legacy critbinom'] },
    minVersion: '2007'
  });

  list.push({
    name: 'EXPONDIST', tr: 'ÜSTELDAĞ', ru: 'ЭКСПРАСП', category: 'compat', replacedBy: 'EXPON.DIST',
    syntax: 'EXPONDIST(x, lambda, cumulative)',
    args: [
      argX('İşlevin hesaplanacağı negatif olmayan değer', 'Неотрицательное значение, для которого вычисляется функция', 'The non-negative value at which to evaluate the function'),
      arg('lambda', 'lambda', 'лямбда', false, 'Parametre (olay hızı), pozitif', 'Параметр (интенсивность событий), положительный', 'The parameter (event rate), positive'),
      argCumulative()
    ],
    desc: compatDesc('Üstel dağılımın değerini verir (olaylar arasındaki süreyi modellemek için)', 'Возвращает экспоненциальное распределение (для моделирования времени между событиями)', 'Returns the exponential distribution (for modelling time between events)', 'EXPON.DIST', 'ÜSTEL.DAĞ', 'ЭКСП.РАСП'),
    example: { formula: 'EXPONDIST(0.2,10,TRUE)',
      tr: 'Lambda 10 iken x = 0,2 için kümülatif üstel olasılığı verir (≈ 0,8647)',
      ru: 'Интегральная экспоненциальная вероятность при лямбда 10 и x = 0,2 (≈ 0,8647)',
      en: 'Cumulative exponential probability for lambda 10 at x = 0.2 (≈ 0.8647)' },
    keywords: { tr: ['üstel dağılım', 'üsteldağ', 'olaylar arası süre', 'bekleme süresi olasılığı', 'exponential dağılım'],
                ru: ['экспоненциальное распределение', 'экспрасп', 'время между событиями', 'вероятность времени ожидания', 'показательное распределение'],
                en: ['exponential distribution', 'legacy expondist', 'time between events'] },
    minVersion: '2007'
  });

  list.push({
    name: 'FDIST', tr: 'FDAĞ', ru: 'FРАСП', category: 'compat', replacedBy: 'F.DIST.RT',
    syntax: 'FDIST(x, deg_freedom1, deg_freedom2)',
    args: [argX('İşlevin hesaplanacağı negatif olmayan değer', 'Неотрицательное значение, для которого вычисляется функция', 'The non-negative value at which to evaluate the function'), argDegFreedom('1'), argDegFreedom('2')],
    desc: compatDesc('F olasılık dağılımının sağ kuyruk olasılığını verir (iki veri kümesinin değişkenliklerini karşılaştırmak için)', 'Возвращает правостороннюю вероятность F-распределения (для сравнения разброса двух наборов данных)', 'Returns the right-tailed F probability distribution (to compare the variability of two data sets)', 'F.DIST.RT', 'F.DAĞ.SAĞK', 'F.РАСП.ПХ'),
    example: { formula: 'FDIST(15.2069,6,4)',
      tr: 'Serbestlik dereceleri 6 ve 4 olan F dağılımında 15,2069 değerinin sağ kuyruk olasılığını verir (≈ 0,01)',
      ru: 'Правосторонняя вероятность значения 15,2069 для F-распределения со степенями свободы 6 и 4 (≈ 0,01)',
      en: 'Right-tailed probability of 15.2069 for the F distribution with 6 and 4 degrees of freedom (≈ 0.01)' },
    keywords: { tr: ['f dağılımı', 'fdağ', 'f olasılığı', 'varyans oranı dağılımı', 'fisher dağılımı'],
                ru: ['f распределение', 'fрасп', 'f вероятность', 'распределение фишера', 'отношение дисперсий'],
                en: ['f distribution', 'f probability right tail', 'legacy fdist'] },
    minVersion: '2007'
  });

  list.push({
    name: 'FINV', tr: 'FTERS', ru: 'FРАСПОБР', category: 'compat', replacedBy: 'F.INV.RT',
    syntax: 'FINV(probability, deg_freedom1, deg_freedom2)',
    args: [argProb('F dağılımının sağ kuyruk olasılığı', 'Правосторонняя вероятность F-распределения', 'A right-tailed probability of the F distribution'), argDegFreedom('1'), argDegFreedom('2')],
    desc: compatDesc('F olasılık dağılımının sağ kuyruk tersini, yani kritik F değerini verir', 'Возвращает обратное правостороннее F-распределение, то есть критическое значение F', 'Returns the inverse of the right-tailed F distribution, i.e. the critical F value', 'F.INV.RT', 'F.TERS.SAĞK', 'F.ОБР.ПХ'),
    example: { formula: 'FINV(0.01,6,4)',
      tr: 'Serbestlik dereceleri 6 ve 4 için %1 anlamlılıkta kritik F değerini verir (≈ 15,2069)',
      ru: 'Критическое значение F при степенях свободы 6 и 4 и уровне значимости 1 % (≈ 15,2069)',
      en: 'Critical F value for 6 and 4 degrees of freedom at the 1 % level (≈ 15.2069)' },
    keywords: { tr: ['ters f dağılımı', 'kritik f değeri', 'fters', 'f tablo değeri', 'f kantil'],
                ru: ['обратное f распределение', 'критическое значение f', 'fраспобр', 'табличное значение f', 'квантиль f'],
                en: ['inverse f distribution', 'critical f value', 'legacy finv'] },
    minVersion: '2007'
  });

  list.push({
    name: 'FORECAST', tr: 'TAHMİN', ru: 'ПРЕДСКАЗ', category: 'compat', replacedBy: 'FORECAST.LINEAR',
    syntax: 'FORECAST(x, known_y\'s, known_x\'s)',
    args: [
      argX('Tahmin yapılacak x değeri (ör. gelecek dönem numarası)', 'Значение x, для которого нужен прогноз (например, номер будущего периода)', 'The x value to forecast for (e.g. the next period number)'),
      arg('known_y\'s', 'bilinen_y\'ler', 'известные_значения_y', false, 'Bilinen bağımlı değerler (ör. geçmiş satışlar)', 'Известные зависимые значения (например, прошлые продажи)', 'The known dependent values (e.g. past sales)'),
      arg('known_x\'s', 'bilinen_x\'ler', 'известные_значения_x', false, 'Bilinen bağımsız değerler (ör. dönem numaraları)', 'Известные независимые значения (например, номера периодов)', 'The known independent values (e.g. period numbers)')
    ],
    desc: compatDesc('Mevcut x-y çiftlerinden doğrusal regresyonla, verilen x için y değerini tahmin eder', 'Прогнозирует значение y для заданного x по линейной регрессии на известных парах x-y', 'Predicts a y value for the given x by linear regression over the known x-y pairs', 'FORECAST.LINEAR', 'TAHMİN.DOĞRUSAL', 'ПРЕДСКАЗ.ЛИНЕЙН'),
    example: { formula: 'FORECAST(13,B2:B13,A2:A13)',
      tr: 'A2:A13’teki ay numaraları ve B2:B13’teki satışlardan 13. ayın satışını doğrusal eğilimle tahmin eder',
      ru: 'Прогнозирует продажи 13-го месяца по линейному тренду на основе номеров месяцев в A2:A13 и продаж в B2:B13',
      en: 'Forecasts month 13 sales by linear trend from the month numbers in A2:A13 and sales in B2:B13' },
    keywords: { tr: ['tahmin', 'doğrusal tahmin', 'gelecek değeri tahmin et', 'trend tahmini', 'satış tahmini', 'regresyon tahmini', 'eğilim'],
                ru: ['прогноз', 'линейный прогноз', 'предсказать значение', 'прогноз по тренду', 'прогноз продаж', 'регрессия прогноз', 'предсказ'],
                en: ['forecast', 'linear forecast', 'predict value', 'trend prediction'] },
    minVersion: '2007'
  });

  list.push({
    name: 'FTEST', tr: 'FTEST', ru: 'ФТЕСТ', category: 'compat', replacedBy: 'F.TEST',
    syntax: 'FTEST(array1, array2)',
    args: [argArray('1', 'İlk veri aralığı', 'Первый диапазон данных', 'The first data range'), argArray('2', 'İkinci veri aralığı', 'Второй диапазон данных', 'The second data range')],
    desc: compatDesc('İki veri kümesinin varyanslarının anlamlı biçimde farklı olmadığına ilişkin F testinin iki kuyruklu olasılığını verir', 'Возвращает двустороннюю вероятность F-теста о том, что дисперсии двух выборок существенно не различаются', 'Returns the two-tailed probability from an F-test that the variances of two data sets are not significantly different', 'F.TEST', 'F.TEST', 'F.ТЕСТ'),
    example: { formula: 'FTEST(A2:A10,B2:B10)',
      tr: 'A2:A10 ile B2:B10’un varyanslarının farklı olup olmadığını sınayan F testinin p-değerini verir',
      ru: 'Возвращает p-значение F-теста, проверяющего, различаются ли дисперсии A2:A10 и B2:B10',
      en: 'Returns the p-value of the F-test checking whether the variances of A2:A10 and B2:B10 differ' },
    keywords: { tr: ['f testi', 'varyans karşılaştırma testi', 'ftest', 'iki örneklem varyans', 'varyans eşitliği testi'],
                ru: ['f тест', 'сравнение дисперсий', 'фтест', 'две выборки дисперсия', 'тест равенства дисперсий'],
                en: ['f test', 'compare variances', 'legacy ftest'] },
    minVersion: '2007'
  });

  list.push({
    name: 'GAMMADIST', tr: 'GAMADAĞ', ru: 'ГАММАРАСП', category: 'compat', replacedBy: 'GAMMA.DIST',
    syntax: 'GAMMADIST(x, alpha, beta, cumulative)',
    args: [argX('İşlevin hesaplanacağı negatif olmayan değer', 'Неотрицательное значение, для которого вычисляется функция', 'The non-negative value at which to evaluate the function'), argAlpha(), argBeta('Dağılımın beta parametresi (ölçek); 1 ise standart gama dağılımı', 'Параметр бета (масштаб); при 1 — стандартное гамма-распределение', 'The beta parameter (scale); 1 gives the standard gamma distribution'), argCumulative()],
    desc: compatDesc('Gama dağılımının değerini verir (kuyruk analizi ve bekleme süresi modelleri için)', 'Возвращает гамма-распределение (для анализа очередей и времени ожидания)', 'Returns the gamma distribution (for queuing and waiting-time models)', 'GAMMA.DIST', 'GAMA.DAĞ', 'ГАММА.РАСП'),
    example: { formula: 'GAMMADIST(10,9,2,TRUE)',
      tr: 'Alfa 9, beta 2 olan gama dağılımında x = 10 için kümülatif olasılığı verir (≈ 0,0681)',
      ru: 'Интегральная вероятность гамма-распределения с альфа 9, бета 2 при x = 10 (≈ 0,0681)',
      en: 'Cumulative probability of the gamma distribution with alpha 9, beta 2 at x = 10 (≈ 0.0681)' },
    keywords: { tr: ['gama dağılımı', 'gamadağ', 'gama olasılığı', 'kuyruk analizi dağılım', 'gamma'],
                ru: ['гамма распределение', 'гаммарасп', 'гамма вероятность', 'анализ очередей', 'gamma'],
                en: ['gamma distribution', 'legacy gammadist', 'gamma probability'] },
    minVersion: '2007'
  });

  list.push({
    name: 'GAMMAINV', tr: 'GAMATERS', ru: 'ГАММАОБР', category: 'compat', replacedBy: 'GAMMA.INV',
    syntax: 'GAMMAINV(probability, alpha, beta)',
    args: [argProb('Gama dağılımına ait olasılık', 'Вероятность, связанная с гамма-распределением', 'A probability associated with the gamma distribution'), argAlpha(), argBeta()],
    desc: compatDesc('Kümülatif gama dağılımının tersini, yani verilen olasılığa karşılık gelen x değerini verir', 'Возвращает обратное интегральное гамма-распределение, то есть x для заданной вероятности', 'Returns the inverse of the cumulative gamma distribution, the x value for a given probability', 'GAMMA.INV', 'GAMA.TERS', 'ГАММА.ОБР'),
    example: { formula: 'GAMMAINV(0.068094,9,2)',
      tr: 'Alfa 9, beta 2 olan gama dağılımında 0,0681 olasılığına karşılık gelen x değerini verir (10)',
      ru: 'Значение x, при котором интегральная вероятность гамма-распределения (альфа 9, бета 2) равна 0,0681 (10)',
      en: 'The x at which the cumulative gamma distribution (alpha 9, beta 2) equals 0.0681 (10)' },
    keywords: { tr: ['ters gama dağılımı', 'gamaters', 'gama kantil', 'olasılıktan x bul gama'],
                ru: ['обратное гамма распределение', 'гаммаобр', 'квантиль гамма', 'x по вероятности гамма'],
                en: ['inverse gamma distribution', 'gamma quantile', 'legacy gammainv'] },
    minVersion: '2007'
  });

  list.push({
    name: 'HYPGEOMDIST', tr: 'HİPERGEOMDAĞ', ru: 'ГИПЕРГЕОМЕТ', category: 'compat', replacedBy: 'HYPGEOM.DIST',
    syntax: 'HYPGEOMDIST(sample_s, number_sample, population_s, number_pop)',
    args: [
      arg('sample_s', 'örnek_başarı', 'число_успехов_в_выборке', false, 'Örneklemdeki başarı sayısı', 'Число успехов в выборке', 'The number of successes in the sample'),
      arg('number_sample', 'örnek_sayısı', 'размер_выборки', false, 'Örneklem büyüklüğü', 'Размер выборки', 'The size of the sample'),
      arg('population_s', 'popülasyon_başarı', 'число_успехов_в_совокупности', false, 'Popülasyondaki başarı sayısı', 'Число успехов в генеральной совокупности', 'The number of successes in the population'),
      arg('number_pop', 'popülasyon_sayısı', 'размер_совокупности', false, 'Popülasyon büyüklüğü', 'Размер генеральной совокупности', 'The population size')
    ],
    desc: compatDesc('Hipergeometrik dağılım olasılığını (iadesiz çekilişte tam olarak k başarı) verir', 'Возвращает гипергеометрическое распределение (ровно k успехов при выборке без возвращения)', 'Returns the hypergeometric distribution (exactly k successes when sampling without replacement)', 'HYPGEOM.DIST', 'HİPERGEOM.DAĞ', 'ГИПЕРГЕОМ.РАСП'),
    example: { formula: 'HYPGEOMDIST(1,4,8,20)',
      tr: '8’i kusurlu 20 parçadan 4 tanesi çekildiğinde tam olarak 1 kusurlu çıkma olasılığını verir (≈ 0,3633)',
      ru: 'Вероятность ровно 1 бракованной детали при выборе 4 из 20, где 8 бракованных (≈ 0,3633)',
      en: 'Probability of exactly 1 defective item when drawing 4 from 20 of which 8 are defective (≈ 0.3633)' },
    keywords: { tr: ['hipergeometrik dağılım', 'hipergeomdağ', 'iadesiz çekiliş olasılığı', 'örneklem başarı olasılığı', 'çekiliş olasılığı'],
                ru: ['гипергеометрическое распределение', 'гипергеомет', 'выборка без возвращения', 'вероятность успехов в выборке', 'вероятность лотереи'],
                en: ['hypergeometric distribution', 'sampling without replacement', 'legacy hypgeomdist'] },
    minVersion: '2007'
  });

  list.push({
    name: 'LOGINV', tr: 'LOGTERS', ru: 'ЛОГНОРМОБР', category: 'compat', replacedBy: 'LOGNORM.INV',
    syntax: 'LOGINV(probability, mean, standard_dev)',
    args: [argProb('Lognormal dağılıma ait olasılık', 'Вероятность, связанная с логнормальным распределением', 'A probability associated with the lognormal distribution'),
      arg('mean', 'ortalama', 'среднее', false, 'ln(x) değerlerinin ortalaması', 'Среднее значение ln(x)', 'The mean of ln(x)'),
      arg('standard_dev', 'standart_sapma', 'стандартное_откл', false, 'ln(x) değerlerinin standart sapması', 'Стандартное отклонение ln(x)', 'The standard deviation of ln(x)')],
    desc: compatDesc('Kümülatif lognormal dağılımın tersini, yani verilen olasılığa karşılık gelen x değerini verir', 'Возвращает обратное интегральное логнормальное распределение, то есть x для заданной вероятности', 'Returns the inverse of the cumulative lognormal distribution, the x value for a given probability', 'LOGNORM.INV', 'LOGNORM.TERS', 'ЛОГНОРМ.ОБР'),
    example: { formula: 'LOGINV(0.039084,3.5,1.2)',
      tr: 'ln ortalaması 3,5 ve ln standart sapması 1,2 olan lognormal dağılımda 0,0391 olasılığına karşılık gelen x değerini verir (4)',
      ru: 'Значение x, при котором логнормальная вероятность (среднее ln 3,5, отклонение 1,2) равна 0,0391 (4)',
      en: 'The x at which the lognormal distribution with ln-mean 3.5 and ln-stdev 1.2 reaches 0.0391 (4)' },
    keywords: { tr: ['ters lognormal', 'logters', 'lognormal kantil', 'logaritmik normal tersi'],
                ru: ['обратное логнормальное', 'логнормобр', 'квантиль логнормального', 'логарифмически нормальное обратное'],
                en: ['inverse lognormal', 'lognormal quantile', 'legacy loginv'] },
    minVersion: '2007'
  });

  list.push({
    name: 'LOGNORMDIST', tr: 'LOGNORMDAĞ', ru: 'ЛОГНОРМРАСП', category: 'compat', replacedBy: 'LOGNORM.DIST',
    syntax: 'LOGNORMDIST(x, mean, standard_dev)',
    args: [argX('İşlevin hesaplanacağı pozitif değer', 'Положительное значение, для которого вычисляется функция', 'The positive value at which to evaluate the function'),
      arg('mean', 'ortalama', 'среднее', false, 'ln(x) değerlerinin ortalaması', 'Среднее значение ln(x)', 'The mean of ln(x)'),
      arg('standard_dev', 'standart_sapma', 'стандартное_откл', false, 'ln(x) değerlerinin standart sapması', 'Стандартное отклонение ln(x)', 'The standard deviation of ln(x)')],
    desc: compatDesc('Kümülatif lognormal dağılımın değerini verir (hisse fiyatları gibi sağa çarpık veriler için)', 'Возвращает интегральное логнормальное распределение (для данных с правосторонней асимметрией, например цен акций)', 'Returns the cumulative lognormal distribution (for right-skewed data such as stock prices)', 'LOGNORM.DIST', 'LOGNORM.DAĞ', 'ЛОГНОРМ.РАСП'),
    example: { formula: 'LOGNORMDIST(4,3.5,1.2)',
      tr: 'ln ortalaması 3,5 ve ln standart sapması 1,2 olan lognormal dağılımda x = 4 için kümülatif olasılığı verir (≈ 0,0391)',
      ru: 'Интегральная логнормальная вероятность при среднем ln 3,5 и отклонении 1,2 для x = 4 (≈ 0,0391)',
      en: 'Cumulative lognormal probability with ln-mean 3.5 and ln-stdev 1.2 at x = 4 (≈ 0.0391)' },
    keywords: { tr: ['lognormal dağılım', 'lognormdağ', 'logaritmik normal dağılım', 'sağa çarpık dağılım', 'hisse fiyatı dağılımı'],
                ru: ['логнормальное распределение', 'логнормрасп', 'логарифмически нормальное распределение', 'асимметричное распределение', 'распределение цен акций'],
                en: ['lognormal distribution', 'legacy lognormdist', 'log normal distribution'] },
    minVersion: '2007'
  });

  list.push({
    name: 'MODE', tr: 'ENÇOK_OLAN', ru: 'МОДА', category: 'compat', replacedBy: 'MODE.SNGL',
    syntax: 'MODE(number1, [number2], ...)',
    args: argNumbers('Sayı, hücre başvurusu veya aralık', 'Число, ссылка на ячейку или диапазон', 'A number, cell reference or range'),
    desc: compatDesc('Bir veri kümesinde en sık tekrar eden değeri (modu) verir', 'Возвращает наиболее часто встречающееся значение (моду) набора данных', 'Returns the most frequently occurring value (mode) in a data set', 'MODE.SNGL', 'ENÇOK_OLAN.TEK', 'МОДА.ОДН'),
    example: { formula: 'MODE(E2:E200)',
      tr: 'E2:E200 aralığında en sık görülen tutarı verir; tekrar eden değer yoksa #YOK hatası döner',
      ru: 'Возвращает самое частое значение в E2:E200; если повторов нет, возвращает ошибку #Н/Д',
      en: 'Returns the most common amount in E2:E200; returns #N/A when no value repeats' },
    keywords: { tr: ['en çok tekrar eden', 'en sık görülen değer', 'mod', 'tepe değer', 'en çok olan', 'en çok satılan değer', 'en yaygın değer'],
                ru: ['мода', 'самое частое значение', 'наиболее часто встречающееся', 'чаще всего встречается', 'самое популярное значение', 'модальное значение'],
                en: ['mode', 'most frequent value', 'most common value'] },
    minVersion: '2007'
  });

  list.push({
    name: 'NEGBINOMDIST', tr: 'NEGBİNOMDAĞ', ru: 'ОТРБИНОМРАСП', category: 'compat', replacedBy: 'NEGBINOM.DIST',
    syntax: 'NEGBINOMDIST(number_f, number_s, probability_s)',
    args: [
      arg('number_f', 'başarısızlık_sayısı', 'число_неудач', false, 'Başarısızlık sayısı', 'Число неудач', 'The number of failures'),
      arg('number_s', 'başarı_sayısı', 'число_успехов', false, 'Eşik başarı sayısı', 'Пороговое число успехов', 'The threshold number of successes'),
      arg('probability_s', 'başarı_olasılığı', 'вероятность_успеха', false, 'Bir başarının olasılığı', 'Вероятность успеха', 'The probability of a success')
    ],
    desc: compatDesc('Negatif binom dağılımını, yani n. başarıdan önce tam olarak k başarısızlık görülme olasılığını verir', 'Возвращает отрицательное биномиальное распределение — вероятность ровно k неудач до n-го успеха', 'Returns the negative binomial distribution, the probability of exactly k failures before the nth success', 'NEGBINOM.DIST', 'NEGBİNOM.DAĞ', 'ОТРБИНОМ.РАСП'),
    example: { formula: 'NEGBINOMDIST(10,5,0.25)',
      tr: 'Başarı olasılığı 0,25 iken 5. başarıdan önce tam olarak 10 başarısızlık görülme olasılığını verir (≈ 0,0550)',
      ru: 'Вероятность ровно 10 неудач до 5-го успеха при вероятности успеха 0,25 (≈ 0,0550)',
      en: 'Probability of exactly 10 failures before the 5th success with success probability 0.25 (≈ 0.0550)' },
    keywords: { tr: ['negatif binom dağılımı', 'negbinomdağ', 'başarısızlık sayısı olasılığı', 'pascal dağılımı'],
                ru: ['отрицательное биномиальное распределение', 'отрбиномрасп', 'вероятность числа неудач', 'распределение паскаля'],
                en: ['negative binomial distribution', 'legacy negbinomdist', 'pascal distribution'] },
    minVersion: '2007'
  });

  list.push({
    name: 'NORMDIST', tr: 'NORMDAĞ', ru: 'НОРМРАСП', category: 'compat', replacedBy: 'NORM.DIST',
    syntax: 'NORMDIST(x, mean, standard_dev, cumulative)',
    args: [argX('Dağılımın hesaplanacağı değer', 'Значение, для которого вычисляется распределение', 'The value at which to evaluate the distribution'), argMean(), argStdev(), argCumulative()],
    desc: compatDesc('Belirtilen ortalama ve standart sapmaya sahip normal dağılımın değerini verir', 'Возвращает нормальное распределение с заданными средним и стандартным отклонением', 'Returns the normal distribution for the given mean and standard deviation', 'NORM.DIST', 'NORM.DAĞ', 'НОРМ.РАСП'),
    example: { formula: 'NORMDIST(42,40,1.5,TRUE)',
      tr: 'Ortalaması 40, standart sapması 1,5 olan normal dağılımda 42’den küçük değer olasılığını verir (≈ 0,9088)',
      ru: 'Вероятность значения меньше 42 при нормальном распределении со средним 40 и отклонением 1,5 (≈ 0,9088)',
      en: 'Probability of a value below 42 in a normal distribution with mean 40 and standard deviation 1.5 (≈ 0.9088)' },
    keywords: { tr: ['normal dağılım', 'normdağ', 'gauss dağılımı', 'çan eğrisi', 'normal olasılık', 'kümülatif normal'],
                ru: ['нормальное распределение', 'нормрасп', 'распределение гаусса', 'колоколообразная кривая', 'нормальная вероятность', 'интегральное нормальное'],
                en: ['normal distribution', 'gaussian', 'bell curve', 'legacy normdist'] },
    minVersion: '2007'
  });

  list.push({
    name: 'NORMINV', tr: 'NORMTERS', ru: 'НОРМОБР', category: 'compat', replacedBy: 'NORM.INV',
    syntax: 'NORMINV(probability, mean, standard_dev)',
    args: [argProb('Normal dağılıma ait olasılık', 'Вероятность, связанная с нормальным распределением', 'A probability associated with the normal distribution'), argMean(), argStdev()],
    desc: compatDesc('Kümülatif normal dağılımın tersini, yani verilen olasılığa karşılık gelen x değerini verir', 'Возвращает обратное нормальное распределение, то есть x для заданной вероятности', 'Returns the inverse of the cumulative normal distribution, the x value for a given probability', 'NORM.INV', 'NORM.TERS', 'НОРМ.ОБР'),
    example: { formula: 'NORMINV(0.908789,40,1.5)',
      tr: 'Ortalaması 40, standart sapması 1,5 olan normal dağılımda 0,9088 olasılığına karşılık gelen değeri verir (42)',
      ru: 'Значение, при котором нормальная вероятность (среднее 40, отклонение 1,5) равна 0,9088 (42)',
      en: 'The value at which the normal distribution with mean 40 and standard deviation 1.5 reaches 0.9088 (42)' },
    keywords: { tr: ['ters normal dağılım', 'normters', 'normal kantil', 'olasılıktan değer bul', 'yüzdelik normal'],
                ru: ['обратное нормальное распределение', 'нормобр', 'квантиль нормального распределения', 'значение по вероятности', 'процентиль нормального'],
                en: ['inverse normal', 'normal quantile', 'legacy norminv'] },
    minVersion: '2007'
  });

  list.push({
    name: 'NORMSDIST', tr: 'NORMSDAĞ', ru: 'НОРМСТРАСП', category: 'compat', replacedBy: 'NORM.S.DIST',
    syntax: 'NORMSDIST(z)',
    args: [arg('z', 'z', 'z', false, 'Dağılımın hesaplanacağı z değeri (standart skor)', 'Значение z (стандартизованная оценка), для которого вычисляется распределение', 'The z value (standard score) at which to evaluate the distribution')],
    desc: compatDesc('Standart normal kümülatif dağılımın (ortalama 0, standart sapma 1) değerini verir', 'Возвращает стандартное нормальное интегральное распределение (среднее 0, отклонение 1)', 'Returns the standard normal cumulative distribution (mean 0, standard deviation 1)', 'NORM.S.DIST', 'NORM.S.DAĞ', 'НОРМ.СТ.РАСП'),
    example: { formula: 'NORMSDIST(1.333333)',
      tr: 'z = 1,3333 için standart normal kümülatif olasılığı verir (≈ 0,9088)',
      ru: 'Стандартная нормальная интегральная вероятность для z = 1,3333 (≈ 0,9088)',
      en: 'Standard normal cumulative probability for z = 1.3333 (≈ 0.9088)' },
    keywords: { tr: ['standart normal dağılım', 'normsdağ', 'z skoru olasılığı', 'z tablosu', 'standart normal kümülatif'],
                ru: ['стандартное нормальное распределение', 'нормстрасп', 'вероятность z', 'таблица z', 'стандартное нормальное интегральное'],
                en: ['standard normal distribution', 'z score probability', 'legacy normsdist'] },
    minVersion: '2007'
  });

  list.push({
    name: 'NORMSINV', tr: 'NORMSTERS', ru: 'НОРМСТОБР', category: 'compat', replacedBy: 'NORM.S.INV',
    syntax: 'NORMSINV(probability)',
    args: [argProb('Standart normal dağılıma ait olasılık', 'Вероятность, связанная со стандартным нормальным распределением', 'A probability associated with the standard normal distribution')],
    desc: compatDesc('Standart normal kümülatif dağılımın tersini, yani verilen olasılığa karşılık gelen z değerini verir', 'Возвращает обратное стандартное нормальное распределение, то есть z для заданной вероятности', 'Returns the inverse of the standard normal cumulative distribution, the z value for a given probability', 'NORM.S.INV', 'NORM.S.TERS', 'НОРМ.СТ.ОБР'),
    example: { formula: 'NORMSINV(0.975)',
      tr: '%97,5 kümülatif olasılığa karşılık gelen z değerini verir (≈ 1,96, %95 güven aralığı katsayısı)',
      ru: 'Значение z, соответствующее интегральной вероятности 97,5 % (≈ 1,96 — коэффициент 95 % доверительного интервала)',
      en: 'The z value for a cumulative probability of 97.5 % (≈ 1.96, the 95 % confidence multiplier)' },
    keywords: { tr: ['ters standart normal', 'normsters', 'z değeri bul', 'olasılıktan z', 'z kantil'],
                ru: ['обратное стандартное нормальное', 'нормстобр', 'найти z', 'z по вероятности', 'квантиль z'],
                en: ['inverse standard normal', 'z value from probability', 'legacy normsinv'] },
    minVersion: '2007'
  });

  list.push({
    name: 'PERCENTILE', tr: 'YÜZDEBİRLİK', ru: 'ПЕРСЕНТИЛЬ', category: 'compat', replacedBy: 'PERCENTILE.INC',
    syntax: 'PERCENTILE(array, k)',
    args: [argArray('', 'Yüzdebirliği alınacak veri aralığı', 'Диапазон данных, для которого вычисляется процентиль', 'The data range to evaluate'),
      arg('k', 'k', 'k', false, '0 ile 1 arasında yüzdebirlik değeri (ör. 0,9 = %90)', 'Процентиль от 0 до 1 (например, 0,9 = 90 %)', 'The percentile value between 0 and 1 (e.g. 0.9 = 90 %)')],
    desc: compatDesc('Bir aralıktaki değerlerin k. yüzdebirliğini (0 ve 1 dahil) verir', 'Возвращает k-й процентиль значений диапазона (включая 0 и 1)', 'Returns the k-th percentile of the values in a range (inclusive of 0 and 1)', 'PERCENTILE.INC', 'YÜZDEBİRLİK.DHL', 'ПРОЦЕНТИЛЬ.ВКЛ'),
    example: { formula: 'PERCENTILE(E2:E200,0.9)',
      tr: 'E2:E200’deki tutarların %90’ının altında kaldığı değeri (90. yüzdebirlik) verir',
      ru: 'Возвращает значение, ниже которого лежат 90 % сумм из E2:E200 (90-й процентиль)',
      en: 'Returns the value below which 90 % of the amounts in E2:E200 fall (90th percentile)' },
    keywords: { tr: ['yüzdebirlik', 'yüzdelik dilim', 'percentile', 'yüzde 90 değeri', 'yüzdelik hesapla', 'üst yüzde 10 sınırı'],
                ru: ['процентиль', 'персентиль', 'percentile', 'значение 90 процентиля', 'рассчитать процентиль', 'граница верхних 10 процентов'],
                en: ['percentile', '90th percentile', 'legacy percentile'] },
    minVersion: '2007'
  });

  list.push({
    name: 'PERCENTRANK', tr: 'YÜZDERANK', ru: 'ПРОЦЕНТРАНГ', category: 'compat', replacedBy: 'PERCENTRANK.INC',
    syntax: 'PERCENTRANK(array, x, [significance])',
    args: [argArray('', 'Sıralamanın yapılacağı veri aralığı', 'Диапазон данных, в котором определяется ранг', 'The data range in which to rank'),
      argX('Yüzdelik sırası bulunacak değer', 'Значение, для которого нужен процентный ранг', 'The value whose percentage rank you want'),
      arg('significance', 'anlam', 'разрядность', true, 'Sonuçtaki anlamlı basamak sayısı (varsayılan 3)', 'Число значащих цифр результата (по умолчанию 3)', 'Number of significant digits in the result (default 3)')],
    desc: compatDesc('Bir değerin veri kümesi içindeki yüzdelik sırasını (0 ile 1 arasında) verir', 'Возвращает процентный ранг значения в наборе данных (от 0 до 1)', 'Returns the percentage rank of a value within a data set (between 0 and 1)', 'PERCENTRANK.INC', 'YÜZDERANK.DHL', 'ПРОЦЕНТРАНГ.ВКЛ'),
    example: { formula: 'PERCENTRANK($E$2:$E$200,E2)',
      tr: 'E2’deki tutarın E2:E200 içinde hangi yüzdelik dilimde olduğunu verir (0,85 → değerlerin %85’inden büyük)',
      ru: 'Показывает, в каком процентиле находится сумма из E2 среди E2:E200 (0,85 → больше 85 % значений)',
      en: 'Shows the percentile position of E2 within E2:E200 (0.85 → above 85 % of the values)' },
    keywords: { tr: ['yüzdelik sıra', 'yüzderank', 'değerin yüzdelik dilimi', 'yüzde kaçıncı sırada', 'göreli sıra yüzde'],
                ru: ['процентный ранг', 'процентранг', 'процентиль значения', 'в каком процентиле', 'относительный ранг в процентах'],
                en: ['percent rank', 'percentile rank', 'legacy percentrank'] },
    minVersion: '2007'
  });

  list.push({
    name: 'POISSON', tr: 'POISSON', ru: 'ПУАССОН', category: 'compat', replacedBy: 'POISSON.DIST',
    syntax: 'POISSON(x, mean, cumulative)',
    args: [argX('Olay sayısı (negatif olmayan tamsayı)', 'Число событий (неотрицательное целое)', 'The number of events (non-negative integer)'),
      arg('mean', 'ortalama', 'среднее', false, 'Beklenen olay sayısı (λ)', 'Ожидаемое число событий (λ)', 'The expected number of events (λ)'), argCumulative()],
    desc: compatDesc('Poisson dağılımını, yani belirli bir sürede tam olarak (veya en çok) x olay gerçekleşme olasılığını verir', 'Возвращает распределение Пуассона — вероятность ровно (или не более) x событий за период', 'Returns the Poisson distribution, the probability of exactly (or at most) x events in a period', 'POISSON.DIST', 'POISSON.DAĞ', 'ПУАССОН.РАСП'),
    example: { formula: 'POISSON(2,5,TRUE)',
      tr: 'Ortalama 5 olay beklenirken en çok 2 olay gerçekleşme olasılığını verir (≈ 0,1247)',
      ru: 'Вероятность не более 2 событий при ожидаемых 5 (≈ 0,1247)',
      en: 'Probability of at most 2 events when 5 are expected (≈ 0.1247)' },
    keywords: { tr: ['poisson dağılımı', 'poisson olasılığı', 'olay sayısı olasılığı', 'belirli sürede olay', 'nadir olay dağılımı'],
                ru: ['распределение пуассона', 'вероятность пуассона', 'вероятность числа событий', 'события за период', 'распределение редких событий'],
                en: ['poisson distribution', 'event count probability', 'legacy poisson'] },
    minVersion: '2007'
  });

  list.push({
    name: 'QUARTILE', tr: 'DÖRTTEBİRLİK', ru: 'КВАРТИЛЬ', category: 'compat', replacedBy: 'QUARTILE.INC',
    syntax: 'QUARTILE(array, quart)',
    args: [argArray('', 'Çeyrek değeri alınacak veri aralığı', 'Диапазон данных, для которого вычисляется квартиль', 'The data range to evaluate'),
      arg('quart', 'dörtte_bir', 'часть', false, 'Hangi çeyrek: 0 en küçük, 1 birinci çeyrek (%25), 2 medyan, 3 üçüncü çeyrek (%75), 4 en büyük', 'Какой квартиль: 0 — минимум, 1 — первый квартиль (25 %), 2 — медиана, 3 — третий квартиль (75 %), 4 — максимум', 'Which quartile: 0 minimum, 1 first quartile (25 %), 2 median, 3 third quartile (75 %), 4 maximum')],
    desc: compatDesc('Bir veri kümesinin çeyrek değerini (0 ve 1 dahil yüzdebirliklere göre) verir', 'Возвращает квартиль набора данных (по процентилям, включая 0 и 1)', 'Returns the quartile of a data set (percentiles inclusive of 0 and 1)', 'QUARTILE.INC', 'DÖRTTEBİRLİK.DHL', 'КВАРТИЛЬ.ВКЛ'),
    example: { formula: 'QUARTILE(E2:E200,3)',
      tr: 'E2:E200’deki tutarların üçüncü çeyreğini (75. yüzdebirlik) verir',
      ru: 'Возвращает третий квартиль (75-й процентиль) сумм в E2:E200',
      en: 'Returns the third quartile (75th percentile) of the amounts in E2:E200' },
    keywords: { tr: ['çeyrek değer', 'dörttebirlik', 'kartil', 'birinci çeyrek', 'üçüncü çeyrek', 'çeyrekler açıklığı', 'medyan çeyrek'],
                ru: ['квартиль', 'первый квартиль', 'третий квартиль', 'межквартильный размах', 'четверть данных', 'квартиль медиана'],
                en: ['quartile', 'first quartile', 'third quartile', 'legacy quartile'] },
    minVersion: '2007'
  });

  list.push({
    name: 'RANK', tr: 'RANK', ru: 'РАНГ', category: 'compat', replacedBy: 'RANK.EQ',
    syntax: 'RANK(number, ref, [order])',
    args: [
      arg('number', 'sayı', 'число', false, 'Sırası bulunacak sayı', 'Число, ранг которого нужно определить', 'The number whose rank you want'),
      arg('ref', 'başv', 'ссылка', false, 'Sayı listesinin aralığı; satır satır doldururken $ ile sabitleyin ($E$2:$E$200)', 'Диапазон списка чисел; при копировании вниз закрепите знаками $ ($E$2:$E$200)', 'The range of the list of numbers; lock it with $ when filling down ($E$2:$E$200)'),
      arg('order', 'sıra', 'порядок', true, '0 veya boş: büyükten küçüğe (en büyük 1. olur); 0 dışı: küçükten büyüğe', '0 или пусто — по убыванию (наибольшее получает 1); любое другое число — по возрастанию', '0 or omitted: descending (largest is 1); any other value: ascending')
    ],
    desc: compatDesc('Bir sayının listedeki sırasını verir (eşit değerler aynı sırayı alır)', 'Возвращает ранг числа в списке (равные значения получают одинаковый ранг)', 'Returns the rank of a number in a list (ties share the same rank)', 'RANK.EQ', 'RANK.EŞİT', 'РАНГ.РВ'),
    example: { formula: 'RANK(E2,$E$2:$E$200,0)',
      tr: 'E2’deki tutarın E2:E200 içinde büyükten küçüğe kaçıncı sırada olduğunu verir; formülü aşağı kopyalayınca her satır kendi sırasını alır',
      ru: 'Показывает, какое место по убыванию занимает сумма из E2 среди E2:E200; при копировании вниз каждая строка получает свой ранг',
      en: 'Returns the descending rank of E2 within E2:E200; copy the formula down to rank every row' },
    keywords: { tr: ['sıralama', 'sıra numarası', 'kaçıncı sırada', 'büyükten küçüğe sırala', 'küçükten büyüğe sıra', 'rank', 'en yüksekten sıra ver', 'sıra bul'],
                ru: ['ранг', 'ранжирование', 'место в рейтинге', 'какое место', 'порядковый номер', 'ранжировать по убыванию', 'присвоить ранг', 'определить место'],
                en: ['rank', 'ranking', 'position in list', 'rank descending', 'legacy rank'] },
    minVersion: '2007'
  });

  list.push({
    name: 'STDEV', tr: 'STDSAPMA', ru: 'СТАНДОТКЛОН', category: 'compat', replacedBy: 'STDEV.S',
    syntax: 'STDEV(number1, [number2], ...)',
    args: argNumbers('Örneklemi oluşturan sayı veya aralık (metin ve mantıksal değerler yok sayılır)', 'Число или диапазон выборки (текст и логические значения пропускаются)', 'A number or range making up the sample (text and logical values are ignored)'),
    desc: compatDesc('Bir örneklemin standart sapmasını (n−1 ile) verir', 'Возвращает стандартное отклонение по выборке (с делением на n−1)', 'Returns the sample standard deviation (using n−1)', 'STDEV.S', 'STDSAPMA.S', 'СТАНДОТКЛОН.В'),
    example: { formula: 'STDEV(E2:E200)',
      tr: 'E2:E200’deki tutarların ortalamadan ne kadar saçıldığını gösteren örneklem standart sapmasını verir',
      ru: 'Возвращает выборочное стандартное отклонение сумм в E2:E200 — насколько они разбросаны вокруг среднего',
      en: 'Returns the sample standard deviation of the amounts in E2:E200, how far they spread around the mean' },
    keywords: { tr: ['standart sapma', 'örneklem standart sapması', 'std sapma', 'sapma hesapla', 'dağılım ölçüsü', 'stdsapma', 'standart sapma bul', 'veri saçılımı'],
                ru: ['стандартное отклонение', 'среднеквадратичное отклонение', 'выборочное стандартное отклонение', 'стандотклон', 'ско', 'разброс данных', 'посчитать отклонение', 'сигма'],
                en: ['standard deviation', 'sample standard deviation', 'stdev', 'spread'] },
    minVersion: '2007'
  });

  list.push({
    name: 'STDEVP', tr: 'STDSAPMAS', ru: 'СТАНДОТКЛОНП', category: 'compat', replacedBy: 'STDEV.P',
    syntax: 'STDEVP(number1, [number2], ...)',
    args: argNumbers('Popülasyonun tamamını oluşturan sayı veya aralık', 'Число или диапазон, образующие всю генеральную совокупность', 'A number or range making up the whole population'),
    desc: compatDesc('Tüm popülasyonun standart sapmasını (n ile) verir', 'Возвращает стандартное отклонение по генеральной совокупности (с делением на n)', 'Returns the population standard deviation (using n)', 'STDEV.P', 'STDSAPMA.P', 'СТАНДОТКЛОН.Г'),
    example: { formula: 'STDEVP(E2:E200)',
      tr: 'E2:E200 tüm veriyi temsil ediyorsa popülasyon standart sapmasını verir',
      ru: 'Возвращает стандартное отклонение генеральной совокупности, если E2:E200 — все данные',
      en: 'Returns the population standard deviation when E2:E200 is the entire data set' },
    keywords: { tr: ['popülasyon standart sapması', 'tüm veri standart sapma', 'stdsapmas', 'ana kütle standart sapması', 'standart sapma n'],
                ru: ['стандартное отклонение генеральной совокупности', 'стандотклонп', 'отклонение по всей совокупности', 'стандартное отклонение по n', 'ско генеральной'],
                en: ['population standard deviation', 'stdevp', 'legacy stdevp'] },
    minVersion: '2007'
  });

  list.push({
    name: 'TDIST', tr: 'TDAĞ', ru: 'СТЬЮДРАСП', category: 'compat', replacedBy: 'T.DIST.2T',
    syntax: 'TDIST(x, deg_freedom, tails)',
    args: [argX('Dağılımın hesaplanacağı negatif olmayan t değeri', 'Неотрицательное значение t, для которого вычисляется распределение', 'The non-negative t value at which to evaluate the distribution'), argDegFreedom(),
      arg('tails', 'kuyruklar', 'хвосты', false, '1: tek kuyruklu, 2: çift kuyruklu olasılık', '1 — односторонняя, 2 — двусторонняя вероятность', '1 for one-tailed, 2 for two-tailed probability')],
    desc: compatDesc('Student t dağılımının tek veya çift kuyruklu olasılığını verir', 'Возвращает одностороннюю или двустороннюю вероятность t-распределения Стьюдента', 'Returns the one- or two-tailed probability of the Student t distribution', 'T.DIST.2T / T.DIST.RT', 'T.DAĞ.2K / T.DAĞ.SAĞK', 'СТЬЮДЕНТ.РАСП.2Х / СТЬЮДЕНТ.РАСП.ПХ'),
    example: { formula: 'TDIST(1.96,60,2)',
      tr: '60 serbestlik dereceli t dağılımında t = 1,96 için çift kuyruklu olasılığı verir (≈ 0,0546)',
      ru: 'Двусторонняя вероятность для t = 1,96 при 60 степенях свободы (≈ 0,0546)',
      en: 'Two-tailed probability for t = 1.96 with 60 degrees of freedom (≈ 0.0546)' },
    keywords: { tr: ['t dağılımı', 'student t dağılımı', 'tdağ', 't olasılığı', 'çift kuyruklu t', 'p değeri t'],
                ru: ['t распределение', 'распределение стьюдента', 'стьюдрасп', 'вероятность t', 'двусторонняя t', 'p значение t'],
                en: ['t distribution', 'student t', 'legacy tdist'] },
    minVersion: '2007'
  });

  list.push({
    name: 'TINV', tr: 'TTERS', ru: 'СТЬЮДРАСПОБР', category: 'compat', replacedBy: 'T.INV.2T',
    syntax: 'TINV(probability, deg_freedom)',
    args: [argProb('Çift kuyruklu t dağılımına ait olasılık', 'Двусторонняя вероятность t-распределения', 'A two-tailed probability of the t distribution'), argDegFreedom()],
    desc: compatDesc('Student t dağılımının çift kuyruklu tersini, yani kritik t değerini verir', 'Возвращает обратное двустороннее t-распределение Стьюдента, то есть критическое значение t', 'Returns the two-tailed inverse of the Student t distribution, i.e. the critical t value', 'T.INV.2T', 'T.TERS.2K', 'СТЬЮДЕНТ.ОБР.2Х'),
    example: { formula: 'TINV(0.05,60)',
      tr: '60 serbestlik derecesi ve %5 anlamlılık (çift kuyruklu) için kritik t değerini verir (≈ 2,0003)',
      ru: 'Критическое значение t при 60 степенях свободы и двустороннем уровне значимости 5 % (≈ 2,0003)',
      en: 'Critical t value for 60 degrees of freedom at the two-tailed 5 % level (≈ 2.0003)' },
    keywords: { tr: ['ters t dağılımı', 'kritik t değeri', 'tters', 't tablo değeri', 't kantil'],
                ru: ['обратное t распределение', 'критическое значение t', 'стьюдраспобр', 'табличное значение t', 'квантиль стьюдента'],
                en: ['inverse t distribution', 'critical t value', 'legacy tinv'] },
    minVersion: '2007'
  });

  list.push({
    name: 'TTEST', tr: 'TTEST', ru: 'ТТЕСТ', category: 'compat', replacedBy: 'T.TEST',
    syntax: 'TTEST(array1, array2, tails, type)',
    args: [argArray('1', 'İlk veri aralığı', 'Первый диапазон данных', 'The first data range'), argArray('2', 'İkinci veri aralığı', 'Второй диапазон данных', 'The second data range'),
      arg('tails', 'kuyruklar', 'хвосты', false, '1: tek kuyruklu, 2: çift kuyruklu', '1 — односторонний, 2 — двусторонний', '1 for one-tailed, 2 for two-tailed'),
      arg('type', 'tür', 'тип', false, '1: eşleştirilmiş, 2: eşit varyanslı iki örneklem, 3: farklı varyanslı iki örneklem', '1 — парный, 2 — две выборки с равными дисперсиями, 3 — две выборки с разными дисперсиями', '1 paired, 2 two-sample equal variance, 3 two-sample unequal variance')],
    desc: compatDesc('İki örneklemin ortalamalarının farklı olup olmadığını sınayan Student t testinin p-değerini verir', 'Возвращает p-значение t-теста Стьюдента, проверяющего различие средних двух выборок', 'Returns the p-value of the Student t-test for whether two sample means differ', 'T.TEST', 'T.TEST', 'СТЬЮДЕНТ.ТЕСТ'),
    example: { formula: 'TTEST(A2:A10,B2:B10,2,1)',
      tr: 'A2:A10 ile B2:B10 (eşleştirilmiş ölçümler) arasındaki farkın anlamlılığını çift kuyruklu t testiyle sınar; 0,05’ten küçük p-değeri anlamlı fark demektir',
      ru: 'Проверяет парным двусторонним t-тестом, значимо ли различаются A2:A10 и B2:B10; p-значение меньше 0,05 означает значимое различие',
      en: 'Runs a paired two-tailed t-test on A2:A10 versus B2:B10; a p-value below 0.05 indicates a significant difference' },
    keywords: { tr: ['t testi', 'ttest', 'iki ortalama karşılaştır', 'anlamlılık testi', 'eşleştirilmiş t testi', 'p değeri hesapla'],
                ru: ['t тест', 'ттест', 'сравнить два средних', 'тест значимости', 'парный t тест', 'рассчитать p значение'],
                en: ['t test', 'compare means', 'significance test', 'legacy ttest'] },
    minVersion: '2007'
  });

  list.push({
    name: 'VAR', tr: 'VAR', ru: 'ДИСП', category: 'compat', replacedBy: 'VAR.S',
    syntax: 'VAR(number1, [number2], ...)',
    args: argNumbers('Örneklemi oluşturan sayı veya aralık (metin ve mantıksal değerler yok sayılır)', 'Число или диапазон выборки (текст и логические значения пропускаются)', 'A number or range making up the sample (text and logical values are ignored)'),
    desc: compatDesc('Bir örneklemin varyansını (n−1 ile) verir', 'Возвращает дисперсию по выборке (с делением на n−1)', 'Returns the sample variance (using n−1)', 'VAR.S', 'VAR.S', 'ДИСП.В'),
    example: { formula: 'VAR(E2:E200)',
      tr: 'E2:E200’deki tutarların örneklem varyansını (standart sapmanın karesini) verir',
      ru: 'Возвращает выборочную дисперсию сумм в E2:E200 (квадрат стандартного отклонения)',
      en: 'Returns the sample variance of the amounts in E2:E200 (the square of the standard deviation)' },
    keywords: { tr: ['varyans', 'örneklem varyansı', 'varyans hesapla', 'değişkenlik', 'sapmaların karesi', 'var', 'veri değişkenliği'],
                ru: ['дисперсия', 'выборочная дисперсия', 'рассчитать дисперсию', 'разброс', 'квадрат отклонения', 'дисп', 'изменчивость данных'],
                en: ['variance', 'sample variance', 'var'] },
    minVersion: '2007'
  });

  list.push({
    name: 'VARP', tr: 'VARS', ru: 'ДИСПР', category: 'compat', replacedBy: 'VAR.P',
    syntax: 'VARP(number1, [number2], ...)',
    args: argNumbers('Popülasyonun tamamını oluşturan sayı veya aralık', 'Число или диапазон, образующие всю генеральную совокупность', 'A number or range making up the whole population'),
    desc: compatDesc('Tüm popülasyonun varyansını (n ile) verir', 'Возвращает дисперсию по генеральной совокупности (с делением на n)', 'Returns the population variance (using n)', 'VAR.P', 'VAR.P', 'ДИСП.Г'),
    example: { formula: 'VARP(E2:E200)',
      tr: 'E2:E200 tüm veriyi temsil ediyorsa popülasyon varyansını verir',
      ru: 'Возвращает дисперсию генеральной совокупности, если E2:E200 — все данные',
      en: 'Returns the population variance when E2:E200 is the entire data set' },
    keywords: { tr: ['popülasyon varyansı', 'tüm veri varyansı', 'vars', 'ana kütle varyansı', 'varyans n'],
                ru: ['дисперсия генеральной совокупности', 'диспр', 'дисперсия по всей совокупности', 'дисперсия по n', 'генеральная дисперсия'],
                en: ['population variance', 'varp', 'legacy varp'] },
    minVersion: '2007'
  });

  list.push({
    name: 'WEIBULL', tr: 'WEIBULL', ru: 'ВЕЙБУЛЛ', category: 'compat', replacedBy: 'WEIBULL.DIST',
    syntax: 'WEIBULL(x, alpha, beta, cumulative)',
    args: [argX('İşlevin hesaplanacağı negatif olmayan değer (ör. ömür süresi)', 'Неотрицательное значение, для которого вычисляется функция (например, срок службы)', 'The non-negative value at which to evaluate the function (e.g. a lifetime)'), argAlpha(), argBeta(), argCumulative()],
    desc: compatDesc('Weibull dağılımının değerini verir (güvenilirlik ve arızaya kadar geçen süre analizleri için)', 'Возвращает распределение Вейбулла (для анализа надёжности и времени до отказа)', 'Returns the Weibull distribution (for reliability and time-to-failure analysis)', 'WEIBULL.DIST', 'WEIBULL.DAĞ', 'ВЕЙБУЛЛ.РАСП'),
    example: { formula: 'WEIBULL(105,20,100,TRUE)',
      tr: 'Alfa 20, beta 100 olan Weibull dağılımında 105 saatten önce arıza olasılığını verir (≈ 0,9296)',
      ru: 'Вероятность отказа до 105 часов при распределении Вейбулла с альфа 20 и бета 100 (≈ 0,9296)',
      en: 'Probability of failure before 105 hours for a Weibull distribution with alpha 20 and beta 100 (≈ 0.9296)' },
    keywords: { tr: ['weibull dağılımı', 'güvenilirlik analizi', 'arıza süresi dağılımı', 'ömür analizi', 'weibull olasılığı'],
                ru: ['распределение вейбулла', 'анализ надёжности', 'время до отказа', 'анализ срока службы', 'вероятность вейбулла'],
                en: ['weibull distribution', 'reliability analysis', 'legacy weibull'] },
    minVersion: '2007'
  });

  list.push({
    name: 'ZTEST', tr: 'ZTEST', ru: 'ZТЕСТ', category: 'compat', replacedBy: 'Z.TEST',
    syntax: 'ZTEST(array, x, [sigma])',
    args: [argArray('', 'x ile karşılaştırılacak veri aralığı', 'Диапазон данных, сравниваемый с x', 'The data range to test against x'),
      argX('Sınanacak hipotez ortalaması', 'Проверяемое гипотетическое среднее', 'The hypothesized population mean to test'),
      arg('sigma', 'sigma', 'сигма', true, 'Bilinen popülasyon standart sapması; boşsa örneklem standart sapması kullanılır', 'Известное стандартное отклонение совокупности; если опущено, берётся выборочное', 'The known population standard deviation; the sample standard deviation is used when omitted')],
    desc: compatDesc('Tek kuyruklu z testinin p-değerini (örneklem ortalamasının x’ten büyük olma olasılığını) verir', 'Возвращает p-значение одностороннего z-теста (вероятность того, что среднее выборки больше x)', 'Returns the one-tailed p-value of a z-test (probability that the sample mean exceeds x)', 'Z.TEST', 'Z.TEST', 'Z.ТЕСТ'),
    example: { formula: 'ZTEST(E2:E200,50)',
      tr: 'E2:E200’deki tutarların ortalamasının 50’den anlamlı biçimde büyük olup olmadığını sınayan z testinin p-değerini verir',
      ru: 'Возвращает p-значение z-теста о том, что среднее сумм в E2:E200 значимо больше 50',
      en: 'Returns the z-test p-value for whether the mean of E2:E200 is significantly greater than 50' },
    keywords: { tr: ['z testi', 'ztest', 'ortalama hipotez testi', 'tek kuyruklu z', 'p değeri z'],
                ru: ['z тест', 'zтест', 'проверка гипотезы о среднем', 'односторонний z', 'p значение z'],
                en: ['z test', 'hypothesis test mean', 'legacy ztest'] },
    minVersion: '2007'
  });

  /* =====================================================================================
   *  attach
   * ===================================================================================== */
  EFS.catalogParts.engWebCubeCompat = list;
  return list;
});
