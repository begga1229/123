/* Formula Studio — catalog part: Date & Time, Financial, Information and Database functions.
 * Sets EFS.catalogParts.dateFinInfoDb = [ entry, ... ] (entry shape: docs/ARCHITECTURE.md §1).
 * Names: EN canonical (UPPERCASE), tr = Turkish Excel name, ru = Russian Excel name. */
(function (root, factory) {
  var EFS = root.EFS || (root.EFS = {});
  var api = factory(EFS, root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (EFS, root) {
  'use strict';
  EFS.catalogParts = EFS.catalogParts || {};

  /* Argument factory: A(name, tr, ru, optional, descTr, descRu, descEn) → arg object. */
  function A(name, tr, ru, opt, dTr, dRu, dEn) {
    return { name: name, tr: tr, ru: ru, optional: !!opt, desc: { tr: dTr, ru: dRu, en: dEn } };
  }
  /* Frequently repeated arguments (each call returns a fresh object). */
  var C = {
    serial: function (opt) { return A('serial_number', 'seri_no', 'дата_в_числовом_формате', !!opt, 'Tarih veya saat değeri (hücre, tarih fonksiyonu ya da metin)', 'Дата или время (ячейка, функция даты или текст)', 'A date or time value (cell, date function or text)'); },
    startDate: function () { return A('start_date', 'başlangıç_tarihi', 'нач_дата', false, 'Başlangıç tarihi', 'Начальная дата', 'The start date'); },
    endDate: function () { return A('end_date', 'bitiş_tarihi', 'кон_дата', false, 'Bitiş tarihi', 'Конечная дата', 'The end date'); },
    holidays: function () { return A('holidays', 'tatiller', 'праздники', true, 'Tatil günlerinin bulunduğu isteğe bağlı aralık', 'Необязательный диапазон с датами праздников', 'Optional range of holiday dates to exclude'); },
    weekend: function () { return A('weekend', 'hafta_sonu', 'выходной', true, 'Hafta sonu günlerini belirten sayı (1 = Cmt-Paz) veya 7 karakterlik "0000011" gibi dize', 'Число (1 = сб-вс) или строка из 7 символов вида "0000011", задающая выходные', 'Number (1 = Sat-Sun) or a 7-character string like "0000011" that defines the weekend days'); },
    settlement: function () { return A('settlement', 'ödeme', 'дата_согл', false, 'Menkul kıymetin alıcıya teslim edildiği işlem (valör) tarihi', 'Дата расчёта за ценную бумагу (дата покупки)', 'The security’s settlement (purchase) date'); },
    maturity: function () { return A('maturity', 'vade', 'дата_вступл_в_силу', false, 'Menkul kıymetin vade (itfa) tarihi', 'Дата погашения ценной бумаги', 'The security’s maturity date'); },
    issue: function () { return A('issue', 'ihraç', 'дата_выпуска', false, 'Menkul kıymetin ihraç tarihi', 'Дата выпуска ценной бумаги', 'The security’s issue date'); },
    rate: function () { return A('rate', 'oran', 'ставка', false, 'Yıllık kupon (faiz) oranı', 'Годовая купонная ставка', 'The security’s annual coupon rate'); },
    yld: function () { return A('yld', 'getiri', 'доход', false, 'Menkul kıymetin yıllık getirisi', 'Годовая доходность ценной бумаги', 'The security’s annual yield'); },
    pr: function () { return A('pr', 'fiyat', 'цена', false, 'Menkul kıymetin 100 TL nominal değer başına fiyatı', 'Цена ценной бумаги за 100 единиц номинала', 'The security’s price per 100 face value'); },
    redemption: function () { return A('redemption', 'itfa_değeri', 'погашение', false, '100 TL nominal değer başına itfa (geri ödeme) değeri', 'Выкупная стоимость за 100 единиц номинала', 'The security’s redemption value per 100 face value'); },
    frequency: function () { return A('frequency', 'sıklık', 'частота', false, 'Yıllık kupon ödeme sayısı: 1 yıllık, 2 altı aylık, 4 üç aylık', 'Число купонных выплат в году: 1 — ежегодно, 2 — раз в полгода, 4 — ежеквартально', 'Number of coupon payments per year: 1 annual, 2 semiannual, 4 quarterly'); },
    basis: function () { return A('basis', 'temel', 'базис', true, 'Gün sayma temeli: 0 US 30/360 (varsayılan), 1 gerçek/gerçek, 2 gerçek/360, 3 gerçek/365, 4 Avrupa 30/360', 'Базис расчёта дней: 0 — US 30/360 (по умолчанию), 1 — факт/факт, 2 — факт/360, 3 — факт/365, 4 — европ. 30/360', 'Day-count basis: 0 US 30/360 (default), 1 actual/actual, 2 actual/360, 3 actual/365, 4 European 30/360'); },
    par: function (opt) { return A('par', 'nominal', 'номинал', !!opt, 'Nominal değer (varsayılan 1.000)', 'Номинальная стоимость (по умолчанию 1000)', 'The security’s par value (default 1,000)'); },
    investment: function () { return A('investment', 'yatırım', 'инвестиция', false, 'Menkul kıymete yatırılan tutar', 'Сумма инвестиции в ценную бумагу', 'The amount invested in the security'); },
    discount: function () { return A('discount', 'indirim', 'скидка', false, 'Menkul kıymetin iskonto oranı', 'Ставка дисконтирования ценной бумаги', 'The security’s discount rate'); },
    annRate: function () { return A('rate', 'oran', 'ставка', false, 'Dönem başına faiz oranı (yıllık faizi aylık dönem için 12’ye bölün)', 'Процентная ставка за период (годовую ставку для месячных периодов делят на 12)', 'The interest rate per period (divide an annual rate by 12 for monthly periods)'); },
    nper: function () { return A('nper', 'dönem_sayısı', 'кпер', false, 'Toplam ödeme dönemi sayısı', 'Общее число периодов выплат', 'The total number of payment periods'); },
    pmt: function (opt) { return A('pmt', 'devresel_ödeme', 'плт', !!opt, 'Her dönem yapılan sabit ödeme (ödediğiniz tutarı negatif girin)', 'Постоянная выплата за период (расход вводится со знаком минус)', 'The constant payment made each period (enter what you pay as a negative number)'); },
    pv: function (opt) { return A('pv', 'bd', 'пс', !!opt, 'Bugünkü değer: kredi tutarı veya başlangıç yatırımı', 'Приведённая стоимость: сумма кредита или начальный вклад', 'The present value: loan amount or initial investment'); },
    fv: function () { return A('fv', 'gd', 'бс', true, 'Son ödemeden sonra ulaşılmak istenen gelecek değer (varsayılan 0)', 'Будущая стоимость после последней выплаты (по умолчанию 0)', 'The future value after the last payment (default 0)'); },
    type: function () { return A('type', 'tür', 'тип', true, 'Ödeme zamanı: 0 dönem sonu (varsayılan), 1 dönem başı', 'Срок выплаты: 0 — в конце периода (по умолчанию), 1 — в начале', 'When payments are due: 0 end of period (default), 1 beginning'); },
    per: function () { return A('per', 'dönem', 'период', false, 'Hesaplanacak dönem (1 ile dönem_sayısı arasında)', 'Период, для которого ведётся расчёт (от 1 до кпер)', 'The period to calculate (between 1 and nper)'); },
    cost: function () { return A('cost', 'maliyet', 'нач_стоимость', false, 'Varlığın başlangıç maliyeti', 'Начальная стоимость актива', 'The initial cost of the asset'); },
    salvage: function () { return A('salvage', 'hurda', 'ост_стоимость', false, 'Amortisman süresi sonundaki hurda (kalıntı) değeri', 'Остаточная стоимость в конце срока амортизации', 'The salvage value at the end of the depreciation'); },
    life: function () { return A('life', 'ömür', 'время_эксплуатации', false, 'Varlığın amortismana tabi tutulduğu dönem sayısı (faydalı ömür)', 'Число периодов амортизации актива (срок полезного использования)', 'The number of periods over which the asset is depreciated (useful life)'); },
    values: function () { return A('values', 'değerler', 'значения', false, 'Nakit akışlarını içeren aralık veya dizi (ödemeler negatif, gelirler pozitif)', 'Диапазон или массив денежных потоков (выплаты отрицательные, поступления положительные)', 'Range or array of cash flows (payments negative, income positive)'); },
    dates: function () { return A('dates', 'tarihler', 'даты', false, 'Nakit akışlarına karşılık gelen tarihler (ilk tarih başlangıçtır)', 'Даты, соответствующие денежным потокам (первая дата — начало)', 'The dates matching the cash flows (the first date is the start)'); },
    guess: function () { return A('guess', 'tahmin', 'предположение', true, 'Sonuca yakın olduğunu düşündüğünüz tahmin (varsayılan %10)', 'Предполагаемое значение результата (по умолчанию 10%)', 'Your estimate of the result (default 10%)'); },
    database: function () { return A('database', 'veritabanı', 'база_данных', false, 'Başlık satırı dahil, liste ya da veritabanını oluşturan hücre aralığı', 'Диапазон ячеек, образующих список или базу данных, включая строку заголовков', 'The range of cells that makes up the list or database, including the header row'); },
    field: function () { return A('field', 'alan', 'поле', false, 'Kullanılacak sütun: tırnak içinde başlık ("Tutar"), sütun numarası veya başlık hücresi', 'Используемый столбец: заголовок в кавычках ("Сумма"), номер столбца или ячейка заголовка', 'The column to use: a quoted header ("Amount"), a column number or the header cell'); },
    criteria: function () { return A('criteria', 'ölçüt', 'критерий', false, 'Koşulları içeren aralık: en az bir sütun başlığı ve altında bir koşul hücresi', 'Диапазон с условиями: хотя бы один заголовок столбца и ячейка с условием под ним', 'The range holding the conditions: at least one column header with a condition cell beneath it'); },
    value: function () { return A('value', 'değer', 'значение', false, 'Sınanacak değer veya hücre başvurusu', 'Проверяемое значение или ссылка на ячейку', 'The value or cell reference to test'); }
  };

  var list = [
    /* ───────────────────────── DATE & TIME ───────────────────────── */
    { name: 'DATE', tr: 'TARİH', ru: 'ДАТА', category: 'date', syntax: 'DATE(year, month, day)',
      args: [
        A('year', 'yıl', 'год', false, 'Yıl (dört basamaklı yazın, ör. 2024)', 'Год (вводите четыре цифры, например 2024)', 'The year (use four digits, e.g. 2024)'),
        A('month', 'ay', 'месяц', false, 'Ay numarası 1-12; 12’den büyük veya 0’dan küçük değerler yılı ileri/geri taşır', 'Номер месяца 1-12; значения больше 12 или меньше 1 переносят год вперёд или назад', 'Month number 1-12; values above 12 or below 1 roll the year forward or back'),
        A('day', 'gün', 'день', false, 'Gün numarası; ay uzunluğunu aşan değerler sonraki aya taşar', 'Номер дня; значения больше длины месяца переходят в следующий месяц', 'Day number; values past the month length spill into the next month')
      ],
      desc: { tr: 'Yıl, ay ve gün sayılarından geçerli bir Excel tarihi (seri numarası) oluşturur.', ru: 'Возвращает дату Excel (порядковый номер), собранную из года, месяца и дня.', en: 'Returns a valid Excel date (serial number) built from year, month and day numbers.' },
      example: { formula: 'DATE(2024,3,15)', tr: '15 Mart 2024 tarihini oluşturur', ru: 'Создаёт дату 15 марта 2024 г.', en: 'Builds the date 15 March 2024' },
      keywords: { tr: ['tarih oluştur', 'yıl ay günden tarih', 'tarih birleştir', 'tarih yap'], ru: ['создать дату', 'дата из года месяца дня', 'собрать дату', 'сформировать дату'], en: ['make date', 'build date from parts', 'date from year month day'] } },

    { name: 'DATEDIF', tr: 'ETARİHLİ', ru: 'РАЗНДАТ', category: 'date', syntax: 'DATEDIF(start_date, end_date, unit)',
      args: [
        C.startDate(), C.endDate(),
        A('unit', 'birim', 'единица', false, 'Sonuç birimi: "Y" tam yıl, "M" tam ay, "D" gün, "YM" yılı yok sayarak ay, "MD" ayı ve yılı yok sayarak gün, "YD" yılı yok sayarak gün', 'Единица результата: "Y" — полные годы, "M" — полные месяцы, "D" — дни, "YM" — месяцы без учёта лет, "MD" — дни без учёта месяцев и лет, "YD" — дни без учёта лет', 'Result unit: "Y" whole years, "M" whole months, "D" days, "YM" months ignoring years, "MD" days ignoring months and years, "YD" days ignoring years')
      ],
      desc: { tr: 'İki tarih arasındaki farkı "Y" (yıl), "M" (ay), "D" (gün), "YM", "MD" veya "YD" birimiyle verir; yaş hesabının klasik yoludur (fonksiyon listesinde görünmez ama tüm sürümlerde çalışır; başlangıç bitişten büyükse #SAYI! verir).', ru: 'Возвращает разницу между двумя датами в единицах "Y" (годы), "M" (месяцы), "D" (дни), "YM", "MD" или "YD"; классический способ расчёта возраста (функция скрыта из списка, но работает во всех версиях; если начало позже конца — #ЧИСЛО!).', en: 'Returns the difference between two dates in units "Y" (years), "M" (months), "D" (days), "YM", "MD" or "YD"; the classic way to compute age (hidden from the function list but works in every version; #NUM! if start is after end).' },
      example: { formula: 'DATEDIF(K2,TODAY(),"Y")', tr: 'K2’deki doğum tarihinden bugünkü yaşı tam yıl olarak hesaplar', ru: 'Вычисляет текущий возраст в полных годах по дате рождения в K2', en: 'Calculates the current age in whole years from the birth date in K2' },
      keywords: { tr: ['yaş hesapla', 'iki tarih arası fark', 'kaç yıl geçti', 'tarih farkı', 'kaç ay', 'yıl ay gün farkı', 'kıdem hesapla'], ru: ['возраст', 'разница дат', 'сколько лет прошло', 'разница между датами', 'сколько месяцев', 'стаж', 'количество лет'], en: ['age', 'difference between dates', 'years between', 'months between', 'date diff'] } },

    { name: 'DATEVALUE', tr: 'TARİHSAYISI', ru: 'ДАТАЗНАЧ', category: 'date', syntax: 'DATEVALUE(date_text)',
      args: [ A('date_text', 'tarih_metni', 'дата_как_текст', false, 'Tarihi Excel’in tanıdığı biçimde içeren metin, ör. "15.03.2024" veya "2024-03-15"', 'Текст с датой в формате, который понимает Excel, например "15.03.2024" или "2024-03-15"', 'Text holding a date in a format Excel recognises, e.g. "3/15/2024" or "2024-03-15"') ],
      desc: { tr: 'Metin olarak yazılmış bir tarihi Excel’in tarih seri numarasına çevirir (metnin biçimi Windows bölge ayarına göre yorumlanır).', ru: 'Преобразует дату, записанную текстом, в порядковый номер даты Excel (формат текста трактуется по региональным настройкам Windows).', en: 'Converts a date written as text into an Excel date serial number (the text format is interpreted using the Windows regional settings).' },
      example: { formula: 'DATEVALUE("2024-03-15")', tr: '"2024-03-15" metnini gerçek bir tarihe dönüştürür', ru: 'Преобразует текст "2024-03-15" в настоящую дату', en: 'Turns the text "2024-03-15" into a real date' },
      keywords: { tr: ['metni tarihe çevir', 'tarih metnini sayıya çevir', 'metin tarih dönüştür', 'tarih olarak tanı'], ru: ['текст в дату', 'преобразовать текст в дату', 'дата из текста', 'распознать дату'], en: ['text to date', 'convert text date', 'parse date'] } },

    { name: 'DAY', tr: 'GÜN', ru: 'ДЕНЬ', category: 'date', syntax: 'DAY(serial_number)',
      args: [ C.serial() ],
      desc: { tr: 'Bir tarihin ayın kaçıncı günü olduğunu 1-31 arasında bir sayı olarak verir.', ru: 'Возвращает день месяца даты в виде числа от 1 до 31.', en: 'Returns the day of the month of a date as a number from 1 to 31.' },
      example: { formula: 'DAY(F2)', tr: 'F2’deki tarihin gününü verir (ör. 05.01.2024 için 5)', ru: 'Возвращает день даты в F2 (например, 5 для 05.01.2024)', en: 'Returns the day of the date in F2 (e.g. 5 for 2024-01-05)' },
      keywords: { tr: ['gün', 'ayın günü', 'tarihten gün al', 'gün numarası'], ru: ['день', 'день месяца', 'номер дня', 'извлечь день из даты'], en: ['day of month', 'extract day'] } },

    { name: 'DAYS', tr: 'GÜNSAY', ru: 'ДНИ', category: 'date', syntax: 'DAYS(end_date, start_date)', minVersion: '2013',
      args: [ C.endDate(), C.startDate() ],
      desc: { tr: 'İki tarih arasındaki gün sayısını verir (bitiş eksi başlangıç; A2-B2 çıkarma işlemiyle aynı sonuç).', ru: 'Возвращает количество дней между двумя датами (конечная минус начальная; то же, что вычитание A2-B2).', en: 'Returns the number of days between two dates (end minus start; same as the subtraction A2-B2).' },
      example: { formula: 'DAYS(TODAY(),F2)', tr: 'F2’deki tarihten bugüne kaç gün geçtiğini hesaplar', ru: 'Считает, сколько дней прошло с даты в F2 до сегодня', en: 'Counts how many days have passed since the date in F2' },
      keywords: { tr: ['gün sayısı', 'iki tarih arası gün', 'kaç gün', 'gün farkı', 'geçen gün'], ru: ['количество дней', 'дней между датами', 'сколько дней', 'разница в днях', 'прошло дней'], en: ['days between', 'number of days', 'day difference'] } },

    { name: 'DAYS360', tr: 'GÜN360', ru: 'ДНЕЙ360', category: 'date', syntax: 'DAYS360(start_date, end_date, [method])',
      args: [ C.startDate(), C.endDate(), A('method', 'yöntem', 'метод', true, 'YANLIŞ veya boş: ABD (NASD) yöntemi; DOĞRU: Avrupa yöntemi', 'ЛОЖЬ или пусто — американский метод (NASD); ИСТИНА — европейский', 'FALSE or omitted: US (NASD) method; TRUE: European method') ],
      desc: { tr: 'Her ayı 30 gün sayan 360 günlük yıl esasına göre iki tarih arasındaki gün sayısını verir (muhasebe ve faiz hesapları).', ru: 'Возвращает число дней между датами по 360-дневному году (каждый месяц — 30 дней), как принято в бухгалтерских и процентных расчётах.', en: 'Returns the number of days between two dates on a 360-day year (each month 30 days), as used in accounting and interest calculations.' },
      example: { formula: 'DAYS360(A2,B2)', tr: 'A2 ile B2 arasındaki günleri 30/360 esasına göre sayar', ru: 'Считает дни между A2 и B2 по базису 30/360', en: 'Counts the days between A2 and B2 on a 30/360 basis' },
      keywords: { tr: ['360 günlük yıl', '30/360 gün sayısı', 'muhasebe gün hesabı', 'faiz günü'], ru: ['360-дневный год', 'дни 30/360', 'бухгалтерский расчёт дней', 'дни для процентов'], en: ['360-day year', '30/360 days'] } },

    { name: 'EDATE', tr: 'SERİTARİH', ru: 'ДАТАМЕС', category: 'date', syntax: 'EDATE(start_date, months)',
      args: [ C.startDate(), A('months', 'ay_sayısı', 'число_месяцев', false, 'Eklenecek ay sayısı (geçmiş için negatif)', 'Число месяцев для прибавления (отрицательное — назад)', 'Number of months to add (negative to go back)') ],
      desc: { tr: 'Bir tarihten belirtilen ay sayısı kadar önceki veya sonraki aynı günü verir; vade, abonelik ve sözleşme tarihleri için kullanılır.', ru: 'Возвращает дату, отстоящую на заданное число месяцев вперёд или назад от начальной (тот же день месяца); удобно для сроков, подписок и договоров.', en: 'Returns the date the given number of months before or after a start date (same day of month); used for due dates, subscriptions and contracts.' },
      example: { formula: 'EDATE(F2,3)', tr: 'F2’deki tarihe 3 ay ekler', ru: 'Прибавляет 3 месяца к дате в F2', en: 'Adds 3 months to the date in F2' },
      keywords: { tr: ['ay ekle', 'tarihe ay ekle', 'x ay sonra', 'ay çıkar', 'vade tarihi', 'yıl ekle'], ru: ['добавить месяцы', 'прибавить месяц к дате', 'через n месяцев', 'отнять месяцы', 'дата через месяц', 'добавить год'], en: ['add months', 'months after date', 'subtract months'] } },

    { name: 'EOMONTH', tr: 'SERİAY', ru: 'КОНМЕСЯЦА', category: 'date', syntax: 'EOMONTH(start_date, months)',
      args: [ C.startDate(), A('months', 'ay_sayısı', 'число_месяцев', false, 'Kaç ay sonrasının (negatifse öncesinin) ay sonu alınacağı; 0 aynı ay', 'На сколько месяцев вперёд (или назад при отрицательном) брать конец месяца; 0 — текущий месяц', 'How many months ahead (or back if negative) to take the month end; 0 = same month') ],
      desc: { tr: 'Bir tarihten belirtilen ay sayısı kadar sonraki (veya önceki) ayın son gününü verir; ay başı için EOMONTH(tarih,-1)+1 kullanılır.', ru: 'Возвращает последний день месяца, отстоящего на заданное число месяцев от даты; первый день месяца получают как КОНМЕСЯЦА(дата;-1)+1.', en: 'Returns the last day of the month a given number of months from a date; the first day of a month is EOMONTH(date,-1)+1.' },
      example: { formula: 'EOMONTH(F2,0)', tr: 'F2’deki tarihin bulunduğu ayın son gününü verir', ru: 'Возвращает последний день месяца даты в F2', en: 'Returns the last day of the month of the date in F2' },
      keywords: { tr: ['ay sonu', 'ayın son günü', 'ay başı', 'ayın ilk günü', 'ay sonu tarihi', 'dönem sonu'], ru: ['конец месяца', 'последний день месяца', 'начало месяца', 'первый день месяца', 'дата конца месяца'], en: ['end of month', 'last day of month', 'first day of month'] } },

    { name: 'HOUR', tr: 'SAAT', ru: 'ЧАС', category: 'date', syntax: 'HOUR(serial_number)',
      args: [ C.serial() ],
      desc: { tr: 'Bir saat değerinin saat bileşenini 0-23 arasında bir sayı olarak verir.', ru: 'Возвращает час из значения времени в виде числа от 0 до 23.', en: 'Returns the hour component of a time as a number from 0 to 23.' },
      example: { formula: 'HOUR(A2)', tr: 'A2’deki saatin saat kısmını verir (14:30 için 14)', ru: 'Возвращает часы из времени в A2 (14 для 14:30)', en: 'Returns the hour of the time in A2 (14 for 14:30)' },
      keywords: { tr: ['saat', 'saati al', 'saat bileşeni', 'zamandan saat'], ru: ['час', 'извлечь час', 'часы из времени', 'номер часа'], en: ['hour', 'extract hour'] } },

    { name: 'ISOWEEKNUM', tr: 'ISOHAFTASAY', ru: 'НОМНЕДЕЛИ.ISO', category: 'date', syntax: 'ISOWEEKNUM(date)', minVersion: '2013',
      args: [ A('date', 'tarih', 'дата', false, 'Hafta numarası alınacak tarih', 'Дата, для которой нужен номер недели', 'The date whose week number you want') ],
      desc: { tr: 'Tarihin ISO 8601 standardına göre (hafta pazartesi başlar, 1. hafta yılın ilk perşembesini içerir) yıl içindeki hafta numarasını verir; Avrupa ve Türkiye’de kullanılan hafta sayımıdır.', ru: 'Возвращает номер недели года по стандарту ISO 8601 (неделя начинается с понедельника, первая неделя содержит первый четверг года); принятая в Европе и России нумерация.', en: 'Returns the ISO 8601 week number of the year (weeks start on Monday, week 1 contains the first Thursday), the week numbering used in Europe.' },
      example: { formula: 'ISOWEEKNUM(F2)', tr: 'F2’deki tarihin ISO hafta numarasını verir', ru: 'Возвращает номер недели по ISO для даты в F2', en: 'Returns the ISO week number of the date in F2' },
      keywords: { tr: ['iso hafta numarası', 'hafta numarası', 'kaçıncı hafta', 'avrupa hafta'], ru: ['номер недели iso', 'номер недели', 'какая неделя', 'неделя по iso'], en: ['iso week', 'week number iso'] } },

    { name: 'MINUTE', tr: 'DAKİKA', ru: 'МИНУТЫ', category: 'date', syntax: 'MINUTE(serial_number)',
      args: [ C.serial() ],
      desc: { tr: 'Bir saat değerinin dakika bileşenini 0-59 arasında bir sayı olarak verir.', ru: 'Возвращает минуты из значения времени в виде числа от 0 до 59.', en: 'Returns the minute component of a time as a number from 0 to 59.' },
      example: { formula: 'MINUTE(A2)', tr: 'A2’deki saatin dakika kısmını verir (14:30 için 30)', ru: 'Возвращает минуты из времени в A2 (30 для 14:30)', en: 'Returns the minutes of the time in A2 (30 for 14:30)' },
      keywords: { tr: ['dakika', 'dakikayı al', 'zamandan dakika'], ru: ['минуты', 'извлечь минуты', 'минуты из времени'], en: ['minute', 'extract minute'] } },

    { name: 'MONTH', tr: 'AY', ru: 'МЕСЯЦ', category: 'date', syntax: 'MONTH(serial_number)',
      args: [ C.serial() ],
      desc: { tr: 'Bir tarihin ay numarasını 1 (Ocak) ile 12 (Aralık) arasında verir; ay adı için Türkçe Excel’de METNEÇEVİR(tarih;"aaaa"), İngilizce’de TEXT(tarih,"mmmm") kullanın.', ru: 'Возвращает номер месяца даты от 1 (январь) до 12 (декабрь); для названия месяца используйте ТЕКСТ(дата;"ММММ").', en: 'Returns the month number of a date from 1 (January) to 12 (December); for the month name use TEXT(date,"mmmm").' },
      example: { formula: 'MONTH(F2)', tr: 'F2’deki tarihin ay numarasını verir', ru: 'Возвращает номер месяца даты в F2', en: 'Returns the month number of the date in F2' },
      keywords: { tr: ['ay', 'ay numarası', 'tarihten ay al', 'hangi ay'], ru: ['месяц', 'номер месяца', 'извлечь месяц', 'какой месяц'], en: ['month', 'extract month', 'month number'] } },

    { name: 'NETWORKDAYS', tr: 'TAMİŞGÜNÜ', ru: 'ЧИСТРАБДНИ', category: 'date', syntax: 'NETWORKDAYS(start_date, end_date, [holidays])',
      args: [ C.startDate(), C.endDate(), C.holidays() ],
      desc: { tr: 'İki tarih arasındaki (her iki tarih dahil) iş günü sayısını verir; cumartesi, pazar ve verilen tatiller sayılmaz.', ru: 'Возвращает количество рабочих дней между двумя датами (включительно), исключая субботы, воскресенья и указанные праздники.', en: 'Returns the number of working days between two dates (inclusive), excluding Saturdays, Sundays and the listed holidays.' },
      example: { formula: 'NETWORKDAYS(A2,B2,$H$2:$H$20)', tr: 'A2 ile B2 arasındaki iş günlerini H2:H20’deki tatilleri düşerek sayar', ru: 'Считает рабочие дни между A2 и B2 без праздников из H2:H20', en: 'Counts working days between A2 and B2, skipping the holidays in H2:H20' },
      keywords: { tr: ['iş günü', 'iş günü sayısı', 'çalışma günü', 'iki tarih arası iş günü', 'hafta sonu hariç gün', 'tatil hariç'], ru: ['рабочие дни', 'количество рабочих дней', 'рабочих дней между датами', 'без выходных', 'без праздников', 'будние дни'], en: ['working days', 'business days between', 'workdays count'] } },

    { name: 'NETWORKDAYS.INTL', tr: 'TAMİŞGÜNÜ.ULUSL', ru: 'ЧИСТРАБДНИ.МЕЖД', category: 'date', syntax: 'NETWORKDAYS.INTL(start_date, end_date, [weekend], [holidays])', minVersion: '2010',
      args: [ C.startDate(), C.endDate(), C.weekend(), C.holidays() ],
      desc: { tr: 'Hafta sonunun hangi günler olduğunu kendiniz belirleyerek (ör. 11 = yalnızca pazar, "0000011" = Cmt-Paz) iki tarih arasındaki iş günü sayısını verir.', ru: 'Возвращает число рабочих дней между датами с настраиваемыми выходными (например, 11 — только воскресенье, "0000011" — сб и вс).', en: 'Returns the number of working days between two dates with custom weekend days (e.g. 11 = Sunday only, "0000011" = Sat-Sun).' },
      example: { formula: 'NETWORKDAYS.INTL(A2,B2,11)', tr: 'Yalnızca pazarı tatil sayarak A2-B2 arası çalışma günlerini sayar', ru: 'Считает рабочие дни между A2 и B2, считая выходным только воскресенье', en: 'Counts working days between A2 and B2 treating only Sunday as the weekend' },
      keywords: { tr: ['özel hafta sonu iş günü', 'cumartesi çalışılan iş günü', 'iş günü sayısı farklı tatil', '6 günlük hafta'], ru: ['рабочие дни с другими выходными', 'шестидневная неделя', 'рабочие дни суббота рабочая', 'настраиваемые выходные'], en: ['working days custom weekend', 'six-day week'] } },

    { name: 'NOW', tr: 'ŞİMDİ', ru: 'ТДАТА', category: 'date', syntax: 'NOW()', volatile: true,
      args: [],
      desc: { tr: 'Geçerli tarih ve saati verir; her yeniden hesaplamada güncellenir (sabit zaman damgası için Ctrl+Shift+; kullanın).', ru: 'Возвращает текущие дату и время; обновляется при каждом пересчёте (для фиксированной отметки используйте Ctrl+Shift+;).', en: 'Returns the current date and time; it updates on every recalculation (use Ctrl+Shift+; for a fixed timestamp).' },
      example: { formula: 'NOW()', tr: 'Şu anki tarih ve saati gösterir', ru: 'Показывает текущие дату и время', en: 'Shows the current date and time' },
      keywords: { tr: ['şimdi', 'şu anki saat', 'şu an', 'geçerli tarih ve saat', 'saat kaç'], ru: ['сейчас', 'текущее время', 'текущая дата и время', 'который час', 'сегодняшняя дата и время'], en: ['now', 'current time', 'current date and time'] } },

    { name: 'SECOND', tr: 'SANİYE', ru: 'СЕКУНДЫ', category: 'date', syntax: 'SECOND(serial_number)',
      args: [ C.serial() ],
      desc: { tr: 'Bir saat değerinin saniye bileşenini 0-59 arasında bir sayı olarak verir.', ru: 'Возвращает секунды из значения времени в виде числа от 0 до 59.', en: 'Returns the second component of a time as a number from 0 to 59.' },
      example: { formula: 'SECOND(A2)', tr: 'A2’deki saatin saniye kısmını verir', ru: 'Возвращает секунды из времени в A2', en: 'Returns the seconds of the time in A2' },
      keywords: { tr: ['saniye', 'saniyeyi al', 'zamandan saniye'], ru: ['секунды', 'извлечь секунды', 'секунды из времени'], en: ['second', 'extract seconds'] } },

    { name: 'TIME', tr: 'ZAMAN', ru: 'ВРЕМЯ', category: 'date', syntax: 'TIME(hour, minute, second)',
      args: [
        A('hour', 'saat', 'часы', false, 'Saat 0-23 (23’ten büyük değerler 24’e göre mod alınır)', 'Часы 0-23 (значения больше 23 берутся по модулю 24)', 'Hour 0-23 (values above 23 wrap around 24)'),
        A('minute', 'dakika', 'минуты', false, 'Dakika 0-59 (59’dan büyük değerler saate taşar)', 'Минуты 0-59 (значения больше 59 переносятся в часы)', 'Minute 0-59 (values above 59 carry into hours)'),
        A('second', 'saniye', 'секунды', false, 'Saniye 0-59 (59’dan büyük değerler dakikaya taşar)', 'Секунды 0-59 (значения больше 59 переносятся в минуты)', 'Second 0-59 (values above 59 carry into minutes)')
      ],
      desc: { tr: 'Saat, dakika ve saniye sayılarından bir Excel saat değeri (0 ile 1 arasında ondalık) oluşturur.', ru: 'Возвращает значение времени Excel (десятичная дробь от 0 до 1), собранное из часов, минут и секунд.', en: 'Returns an Excel time value (a decimal between 0 and 1) built from hour, minute and second numbers.' },
      example: { formula: 'TIME(9,30,0)', tr: '09:30 saat değerini oluşturur', ru: 'Создаёт значение времени 09:30', en: 'Builds the time value 09:30' },
      keywords: { tr: ['saat oluştur', 'saat dakika saniyeden zaman', 'zaman yap', 'saat değeri'], ru: ['создать время', 'время из часов минут секунд', 'собрать время', 'значение времени'], en: ['make time', 'time from hour minute second'] } },

    { name: 'TIMEVALUE', tr: 'ZAMANSAYISI', ru: 'ВРЕМЗНАЧ', category: 'date', syntax: 'TIMEVALUE(time_text)',
      args: [ A('time_text', 'zaman_metni', 'время_как_текст', false, 'Saati içeren metin, ör. "14:30" veya "2:30 PM"', 'Текст со временем, например "14:30" или "2:30 PM"', 'Text holding a time, e.g. "14:30" or "2:30 PM"') ],
      desc: { tr: 'Metin olarak yazılmış bir saati Excel saat değerine (0-1 arası ondalık) çevirir.', ru: 'Преобразует время, записанное текстом, в значение времени Excel (десятичная дробь от 0 до 1).', en: 'Converts a time written as text into an Excel time value (a decimal between 0 and 1).' },
      example: { formula: 'TIMEVALUE("14:30")', tr: '"14:30" metnini gerçek bir saat değerine dönüştürür', ru: 'Преобразует текст "14:30" в настоящее значение времени', en: 'Turns the text "14:30" into a real time value' },
      keywords: { tr: ['metni saate çevir', 'saat metnini sayıya çevir', 'metin saat dönüştür'], ru: ['текст во время', 'преобразовать текст во время', 'время из текста'], en: ['text to time', 'parse time'] } },

    { name: 'TODAY', tr: 'BUGÜN', ru: 'СЕГОДНЯ', category: 'date', syntax: 'TODAY()', volatile: true,
      args: [],
      desc: { tr: 'Saat bilgisi olmadan bugünün tarihini verir; dosya her açıldığında güncellenir (sabit tarih için Ctrl+; kullanın).', ru: 'Возвращает сегодняшнюю дату без времени; обновляется при каждом открытии файла (для фиксированной даты используйте Ctrl+;).', en: 'Returns today’s date without a time; it updates whenever the file recalculates (use Ctrl+; for a fixed date).' },
      example: { formula: 'TODAY()', tr: 'Bugünün tarihini gösterir', ru: 'Показывает сегодняшнюю дату', en: 'Shows today’s date' },
      keywords: { tr: ['bugün', 'bugünün tarihi', 'güncel tarih', 'şimdiki tarih', 'tarih bugün'], ru: ['сегодня', 'сегодняшняя дата', 'текущая дата', 'дата сегодня', 'нынешняя дата'], en: ['today', 'current date', 'today’s date'] } },

    { name: 'WEEKDAY', tr: 'HAFTANINGÜNÜ', ru: 'ДЕНЬНЕД', category: 'date', syntax: 'WEEKDAY(serial_number, [return_type])',
      args: [ C.serial(), A('return_type', 'döndür_türü', 'тип', true, 'Numaralandırma: 1 veya boş = Pazar 1…Cumartesi 7; 2 = Pazartesi 1…Pazar 7 (Türkiye için önerilen); 3 = Pazartesi 0…Pazar 6', 'Нумерация: 1 или пусто — воскресенье 1…суббота 7; 2 — понедельник 1…воскресенье 7 (удобно для России); 3 — понедельник 0…воскресенье 6', 'Numbering: 1 or omitted = Sunday 1…Saturday 7; 2 = Monday 1…Sunday 7; 3 = Monday 0…Sunday 6') ],
      desc: { tr: 'Tarihin haftanın kaçıncı günü olduğunu sayı olarak verir; WEEKDAY(tarih,2)>5 hafta sonunu bulur, gün adı için TEXT(tarih,"gggg") (TR Excel) / TEXT(tarih,"dddd") (EN) kullanılır.', ru: 'Возвращает номер дня недели для даты; ДЕНЬНЕД(дата;2)>5 выявляет выходные, а название дня даёт ТЕКСТ(дата;"ДДДД").', en: 'Returns the day of the week of a date as a number; WEEKDAY(date,2)>5 flags weekends, and TEXT(date,"dddd") gives the day name.' },
      example: { formula: 'WEEKDAY(F2,2)', tr: 'F2’deki tarih için Pazartesi=1 … Pazar=7 değerini verir', ru: 'Для даты в F2 возвращает понедельник=1 … воскресенье=7', en: 'Returns Monday=1 … Sunday=7 for the date in F2' },
      keywords: { tr: ['haftanın günü', 'hangi gün', 'gün adı', 'hafta sonu mu', 'pazartesi mi', 'günün numarası'], ru: ['день недели', 'какой день недели', 'номер дня недели', 'выходной или нет', 'название дня'], en: ['weekday', 'day of week', 'is weekend'] } },

    { name: 'WEEKNUM', tr: 'HAFTASAY', ru: 'НОМНЕДЕЛИ', category: 'date', syntax: 'WEEKNUM(serial_number, [return_type])',
      args: [ C.serial(), A('return_type', 'döndür_türü', 'тип', true, 'Hafta başlangıcı: 1 veya boş = Pazar, 2 = Pazartesi (1 Ocak her zaman 1. haftadır); 21 = ISO sistemi', 'Начало недели: 1 или пусто — воскресенье, 2 — понедельник (1 января всегда в неделе 1); 21 — система ISO', 'Week start: 1 or omitted = Sunday, 2 = Monday (1 January is always week 1); 21 = ISO system') ],
      desc: { tr: 'Tarihin yıl içindeki hafta numarasını verir; 1 Ocak’ı içeren hafta 1. haftadır (ISO sayımı için tür 21 veya ISOWEEKNUM).', ru: 'Возвращает номер недели в году для даты; неделя с 1 января считается первой (для нумерации ISO используйте тип 21 или НОМНЕДЕЛИ.ISO).', en: 'Returns the week number of the year for a date; the week containing 1 January is week 1 (use type 21 or ISOWEEKNUM for ISO numbering).' },
      example: { formula: 'WEEKNUM(F2,2)', tr: 'Pazartesi başlangıçlı haftalara göre F2’nin hafta numarasını verir', ru: 'Возвращает номер недели для F2 при неделе, начинающейся с понедельника', en: 'Returns the week number of F2 with weeks starting on Monday' },
      keywords: { tr: ['hafta numarası', 'kaçıncı hafta', 'yılın haftası', 'hafta sayısı'], ru: ['номер недели', 'какая неделя', 'неделя года', 'номер недели в году'], en: ['week number', 'week of year'] } },

    { name: 'WORKDAY', tr: 'İŞGÜNÜ', ru: 'РАБДЕНЬ', category: 'date', syntax: 'WORKDAY(start_date, days, [holidays])',
      args: [ C.startDate(), A('days', 'gün_sayısı', 'число_дней', false, 'Eklenecek iş günü sayısı (geçmişe gitmek için negatif)', 'Число рабочих дней для прибавления (отрицательное — назад)', 'Number of working days to add (negative to go back)'), C.holidays() ],
      desc: { tr: 'Bir tarihten belirtilen iş günü kadar sonraki (hafta sonu ve tatilleri atlayarak) tarihi verir; teslim tarihi ve termin hesaplarında kullanılır.', ru: 'Возвращает дату через заданное число рабочих дней от начальной, пропуская выходные и праздники; используется для сроков сдачи и дедлайнов.', en: 'Returns the date a given number of working days after a start date, skipping weekends and holidays; used for delivery dates and deadlines.' },
      example: { formula: 'WORKDAY(F2,10,$H$2:$H$20)', tr: 'F2’den 10 iş günü sonrasını, H2:H20’deki tatilleri atlayarak bulur', ru: 'Находит дату через 10 рабочих дней после F2, пропуская праздники из H2:H20', en: 'Finds the date 10 working days after F2, skipping the holidays in H2:H20' },
      keywords: { tr: ['iş günü ekle', 'x iş günü sonra', 'teslim tarihi', 'termin tarihi', 'iş günü sonrası tarih', 'hafta sonu atla'], ru: ['добавить рабочие дни', 'через n рабочих дней', 'дата сдачи', 'срок в рабочих днях', 'дедлайн рабочие дни', 'без выходных'], en: ['add working days', 'workdays after', 'due date business days'] } },

    { name: 'WORKDAY.INTL', tr: 'İŞGÜNÜ.ULUSL', ru: 'РАБДЕНЬ.МЕЖД', category: 'date', syntax: 'WORKDAY.INTL(start_date, days, [weekend], [holidays])', minVersion: '2010',
      args: [ C.startDate(), A('days', 'gün_sayısı', 'число_дней', false, 'Eklenecek iş günü sayısı (geçmişe gitmek için negatif)', 'Число рабочих дней для прибавления (отрицательное — назад)', 'Number of working days to add (negative to go back)'), C.weekend(), C.holidays() ],
      desc: { tr: 'Hafta sonu günlerini kendiniz belirleyerek (ör. 11 = yalnızca pazar) belirtilen iş günü kadar sonraki tarihi verir.', ru: 'Возвращает дату через заданное число рабочих дней с настраиваемыми выходными (например, 11 — только воскресенье).', en: 'Returns the date a given number of working days ahead using custom weekend days (e.g. 11 = Sunday only).' },
      example: { formula: 'WORKDAY.INTL(F2,5,11)', tr: 'Yalnızca pazarı tatil sayarak F2’den 5 iş günü sonrasını bulur', ru: 'Находит дату через 5 рабочих дней после F2, считая выходным только воскресенье', en: 'Finds the date 5 working days after F2 with only Sunday as the weekend' },
      keywords: { tr: ['özel hafta sonu iş günü ekle', 'cumartesi çalışılan termin', '6 günlük hafta teslim tarihi'], ru: ['рабочие дни с другими выходными', 'срок при шестидневке', 'добавить рабочие дни суббота рабочая'], en: ['add workdays custom weekend', 'six-day week due date'] } },

    { name: 'YEAR', tr: 'YIL', ru: 'ГОД', category: 'date', syntax: 'YEAR(serial_number)',
      args: [ C.serial() ],
      desc: { tr: 'Bir tarihin yılını 1900-9999 arasında dört basamaklı sayı olarak verir.', ru: 'Возвращает год даты в виде четырёхзначного числа от 1900 до 9999.', en: 'Returns the year of a date as a four-digit number from 1900 to 9999.' },
      example: { formula: 'YEAR(F2)', tr: 'F2’deki tarihin yılını verir', ru: 'Возвращает год даты в F2', en: 'Returns the year of the date in F2' },
      keywords: { tr: ['yıl', 'tarihten yıl al', 'hangi yıl', 'yıl numarası'], ru: ['год', 'извлечь год', 'какой год', 'год из даты'], en: ['year', 'extract year'] } },

    { name: 'YEARFRAC', tr: 'YILORAN', ru: 'ДОЛЯГОДА', category: 'date', syntax: 'YEARFRAC(start_date, end_date, [basis])',
      args: [ C.startDate(), C.endDate(), C.basis() ],
      desc: { tr: 'İki tarih arasındaki süreyi yılın kesri olarak verir (ör. 0,5 = altı ay); ondalıklı yaş veya kıdem hesabı için INT(YEARFRAC(...)) kullanılır.', ru: 'Возвращает долю года между двумя датами (например, 0,5 — полгода); для возраста или стажа в целых годах используйте ЦЕЛОЕ(ДОЛЯГОДА(...)).', en: 'Returns the fraction of a year between two dates (e.g. 0.5 = six months); INT(YEARFRAC(...)) gives whole years of age or tenure.' },
      example: { formula: 'YEARFRAC(K2,TODAY())', tr: 'K2’deki doğum tarihinden bugüne geçen süreyi ondalıklı yıl olarak verir', ru: 'Возвращает возраст по дате рождения в K2 в годах с дробной частью', en: 'Returns the elapsed time since the birth date in K2 in fractional years' },
      keywords: { tr: ['yıl kesri', 'ondalıklı yaş', 'kaç yıl ondalık', 'yıl oranı', 'kıdem yıl'], ru: ['доля года', 'возраст с дробной частью', 'сколько лет дробное', 'часть года', 'стаж в годах'], en: ['fraction of year', 'decimal years', 'year fraction'] } },

    /* ───────────────────────── FINANCIAL ───────────────────────── */
    { name: 'ACCRINT', tr: 'GERÇEKFAİZ', ru: 'НАКОПДОХОД', category: 'financial', syntax: 'ACCRINT(issue, first_interest, settlement, rate, par, frequency, [basis], [calc_method])',
      args: [ C.issue(), A('first_interest', 'ilk_faiz', 'первый_доход', false, 'İlk faiz (kupon) ödeme tarihi', 'Дата первой выплаты процентов', 'The security’s first interest date'), C.settlement(), C.rate(), C.par(), C.frequency(), C.basis(),
        A('calc_method', 'hesap_yöntemi', 'способ_расчёта', true, 'DOĞRU veya boş: ihraçtan ödemeye kadar toplam; YANLIŞ: ilk faiz tarihinden ödemeye kadar', 'ИСТИНА или пусто — от выпуска до расчёта; ЛОЖЬ — от первой выплаты до расчёта', 'TRUE or omitted: from issue to settlement; FALSE: from first interest date to settlement') ],
      desc: { tr: 'Dönemsel faiz ödeyen bir menkul kıymetin ihraç tarihinden itibaren tahakkuk etmiş (birikmiş) faizini verir.', ru: 'Возвращает накопленный процент по ценной бумаге с периодической выплатой процентов.', en: 'Returns the accrued interest for a security that pays periodic interest.' },
      example: { formula: 'ACCRINT(DATE(2024,1,1),DATE(2024,7,1),DATE(2024,5,1),0.1,1000,2)', tr: '%10 kuponlu 1.000 TL nominalli tahvilin 1 Mayıs’a kadar biriken faizini verir', ru: 'Возвращает накопленный к 1 мая процент по облигации номиналом 1000 с купоном 10%', en: 'Returns the interest accrued to 1 May on a 1,000 par bond paying 10%' },
      keywords: { tr: ['tahakkuk eden faiz', 'birikmiş faiz', 'tahvil faizi', 'kupon faizi birikimi'], ru: ['накопленный процент', 'накопленный купонный доход', 'нкд', 'процент по облигации'], en: ['accrued interest', 'bond accrued interest'] } },

    { name: 'ACCRINTM', tr: 'GERÇEKFAİZV', ru: 'НАКОПДОХОДПОГАШ', category: 'financial', syntax: 'ACCRINTM(issue, settlement, rate, par, [basis])',
      args: [ C.issue(), C.settlement(), C.rate(), C.par(), C.basis() ],
      desc: { tr: 'Faizini vadede tek seferde ödeyen bir menkul kıymetin tahakkuk etmiş faizini verir.', ru: 'Возвращает накопленный процент по ценной бумаге, проценты по которой выплачиваются при погашении.', en: 'Returns the accrued interest for a security that pays interest at maturity.' },
      example: { formula: 'ACCRINTM(DATE(2024,1,1),DATE(2024,12,31),0.08,1000)', tr: 'Yıl sonunda %8 ödeyen 1.000 TL’lik kâğıdın biriken faizini verir', ru: 'Возвращает накопленный процент по бумаге номиналом 1000 со ставкой 8% к концу года', en: 'Returns the interest accrued on a 1,000 note at 8% by year end' },
      keywords: { tr: ['vadede faiz', 'vade sonu birikmiş faiz', 'tek ödemeli faiz'], ru: ['процент при погашении', 'накопленный процент к погашению', 'разовая выплата процентов'], en: ['accrued interest at maturity'] } },

    { name: 'AMORDEGRC', tr: 'AMORDEGRC', ru: 'АМОРУМ', category: 'financial', syntax: 'AMORDEGRC(cost, date_purchased, first_period, salvage, period, rate, [basis])',
      args: [ C.cost(), A('date_purchased', 'satın_alma_tarihi', 'дата_приобр', false, 'Varlığın satın alındığı tarih', 'Дата приобретения актива', 'The date the asset was purchased'), A('first_period', 'ilk_dönem', 'первый_период', false, 'İlk dönemin bitiş tarihi', 'Дата окончания первого периода', 'The end date of the first period'), C.salvage(), A('period', 'dönem', 'период', false, 'Amortismanı hesaplanacak dönem', 'Период, для которого рассчитывается амортизация', 'The period for which to calculate depreciation'), A('rate', 'oran', 'ставка', false, 'Amortisman oranı', 'Ставка амортизации', 'The rate of depreciation'), C.basis() ],
      desc: { tr: 'Fransız muhasebe sistemine göre, varlığın ömrüne bağlı bir katsayı uygulayarak her dönemin amortismanını verir (dönem ortasında alınan varlıklar oransal hesaplanır).', ru: 'Возвращает амортизацию за период по французской системе учёта с коэффициентом, зависящим от срока службы (для купленных в середине периода — пропорционально).', en: 'Returns the depreciation for each period under the French accounting system, applying a coefficient based on asset life (prorated for mid-period purchases).' },
      example: { formula: 'AMORDEGRC(2400,DATE(2024,8,19),DATE(2024,12,31),300,1,0.15)', tr: '2.400 TL’lik varlığın 1. dönem amortismanını %15 oranla verir', ru: 'Возвращает амортизацию актива стоимостью 2400 за 1-й период при ставке 15%', en: 'Returns the first-period depreciation of a 2,400 asset at 15%' },
      keywords: { tr: ['fransız amortisman', 'katsayılı amortisman', 'dönemsel amortisman'], ru: ['французская амортизация', 'амортизация с коэффициентом', 'амортизация за период'], en: ['french depreciation', 'degressive amortization'] } },

    { name: 'AMORLINC', tr: 'AMORLINC', ru: 'АМОРУВ', category: 'financial', syntax: 'AMORLINC(cost, date_purchased, first_period, salvage, period, rate, [basis])',
      args: [ C.cost(), A('date_purchased', 'satın_alma_tarihi', 'дата_приобр', false, 'Varlığın satın alındığı tarih', 'Дата приобретения актива', 'The date the asset was purchased'), A('first_period', 'ilk_dönem', 'первый_период', false, 'İlk dönemin bitiş tarihi', 'Дата окончания первого периода', 'The end date of the first period'), C.salvage(), A('period', 'dönem', 'период', false, 'Amortismanı hesaplanacak dönem', 'Период, для которого рассчитывается амортизация', 'The period for which to calculate depreciation'), A('rate', 'oran', 'ставка', false, 'Amortisman oranı', 'Ставка амортизации', 'The rate of depreciation'), C.basis() ],
      desc: { tr: 'Fransız muhasebe sistemine göre doğrusal (eşit tutarlı) amortismanı dönem bazında verir; ilk dönem satın alma tarihine göre oranlanır.', ru: 'Возвращает линейную амортизацию за период по французской системе учёта; первый период рассчитывается пропорционально дате покупки.', en: 'Returns the straight-line depreciation for each period under the French accounting system, prorating the first period by purchase date.' },
      example: { formula: 'AMORLINC(2400,DATE(2024,8,19),DATE(2024,12,31),300,1,0.15)', tr: '2.400 TL’lik varlığın 1. dönem doğrusal amortismanını verir', ru: 'Возвращает линейную амортизацию актива стоимостью 2400 за 1-й период', en: 'Returns the first-period straight-line depreciation of a 2,400 asset' },
      keywords: { tr: ['fransız doğrusal amortisman', 'oransal ilk dönem amortisman'], ru: ['французская линейная амортизация', 'пропорциональная амортизация первого периода'], en: ['french straight-line depreciation'] } },

    { name: 'COUPDAYBS', tr: 'KUPONGÜNBD', ru: 'ДНЕЙКУПОНДО', category: 'financial', syntax: 'COUPDAYBS(settlement, maturity, frequency, [basis])',
      args: [ C.settlement(), C.maturity(), C.frequency(), C.basis() ],
      desc: { tr: 'Kupon döneminin başlangıcından ödeme (valör) tarihine kadar geçen gün sayısını verir.', ru: 'Возвращает количество дней от начала купонного периода до даты расчёта.', en: 'Returns the number of days from the beginning of the coupon period to the settlement date.' },
      example: { formula: 'COUPDAYBS(DATE(2024,5,15),DATE(2030,1,1),2)', tr: 'Altı aylık kuponlu tahvilde dönem başından 15 Mayıs’a kadar geçen günleri verir', ru: 'Возвращает дни от начала купонного периода до 15 мая для облигации с полугодовым купоном', en: 'Returns the days from the coupon period start to 15 May for a semiannual bond' },
      keywords: { tr: ['kupon dönemi başından gün', 'kupon günü', 'tahvil kupon gün sayısı'], ru: ['дней с начала купонного периода', 'дни купона до расчёта', 'купонный период'], en: ['coupon days before settlement'] } },

    { name: 'COUPDAYS', tr: 'KUPONGÜN', ru: 'ДНЕЙКУПОН', category: 'financial', syntax: 'COUPDAYS(settlement, maturity, frequency, [basis])',
      args: [ C.settlement(), C.maturity(), C.frequency(), C.basis() ],
      desc: { tr: 'Ödeme tarihini içeren kupon dönemindeki toplam gün sayısını verir.', ru: 'Возвращает количество дней в купонном периоде, содержащем дату расчёта.', en: 'Returns the number of days in the coupon period that contains the settlement date.' },
      example: { formula: 'COUPDAYS(DATE(2024,5,15),DATE(2030,1,1),2)', tr: '15 Mayıs’ı içeren kupon döneminin gün sayısını verir', ru: 'Возвращает число дней в купонном периоде, включающем 15 мая', en: 'Returns the number of days in the coupon period containing 15 May' },
      keywords: { tr: ['kupon dönemi gün sayısı', 'kupon süresi gün', 'tahvil dönem uzunluğu'], ru: ['дней в купонном периоде', 'длина купонного периода', 'купонный период дни'], en: ['days in coupon period'] } },

    { name: 'COUPDAYSNC', tr: 'KUPONGÜNDSK', ru: 'ДНЕЙКУПОНПОСЛЕ', category: 'financial', syntax: 'COUPDAYSNC(settlement, maturity, frequency, [basis])',
      args: [ C.settlement(), C.maturity(), C.frequency(), C.basis() ],
      desc: { tr: 'Ödeme tarihinden bir sonraki kupon tarihine kadar olan gün sayısını verir.', ru: 'Возвращает количество дней от даты расчёта до следующей купонной даты.', en: 'Returns the number of days from the settlement date to the next coupon date.' },
      example: { formula: 'COUPDAYSNC(DATE(2024,5,15),DATE(2030,1,1),2)', tr: '15 Mayıs’tan sonraki kupon ödemesine kaç gün kaldığını verir', ru: 'Возвращает, сколько дней осталось от 15 мая до следующего купона', en: 'Returns how many days remain from 15 May to the next coupon' },
      keywords: { tr: ['sonraki kupona kalan gün', 'kupon tarihine kaç gün', 'bir sonraki kupon günü'], ru: ['дней до следующего купона', 'дни до купонной выплаты', 'следующий купон дни'], en: ['days to next coupon'] } },

    { name: 'COUPNCD', tr: 'KUPONGÜNSKT', ru: 'ДАТАКУПОНПОСЛЕ', category: 'financial', syntax: 'COUPNCD(settlement, maturity, frequency, [basis])',
      args: [ C.settlement(), C.maturity(), C.frequency(), C.basis() ],
      desc: { tr: 'Ödeme tarihinden sonraki ilk kupon ödeme tarihini verir.', ru: 'Возвращает первую купонную дату после даты расчёта.', en: 'Returns the next coupon date after the settlement date.' },
      example: { formula: 'COUPNCD(DATE(2024,5,15),DATE(2030,1,1),2)', tr: '15 Mayıs 2024’ten sonraki ilk kupon tarihini (1 Temmuz 2024) verir', ru: 'Возвращает первую купонную дату после 15 мая 2024 (1 июля 2024)', en: 'Returns the first coupon date after 15 May 2024 (1 July 2024)' },
      keywords: { tr: ['sonraki kupon tarihi', 'bir sonraki kupon ödemesi', 'kupon ödeme günü'], ru: ['следующая купонная дата', 'дата следующего купона', 'дата выплаты купона'], en: ['next coupon date'] } },

    { name: 'COUPNUM', tr: 'KUPONSAYI', ru: 'ЧИСЛКУПОН', category: 'financial', syntax: 'COUPNUM(settlement, maturity, frequency, [basis])',
      args: [ C.settlement(), C.maturity(), C.frequency(), C.basis() ],
      desc: { tr: 'Ödeme tarihi ile vade arasında ödenecek kupon sayısını (yukarı yuvarlanmış) verir.', ru: 'Возвращает количество купонных выплат между датой расчёта и датой погашения (с округлением вверх).', en: 'Returns the number of coupons payable between the settlement date and maturity (rounded up).' },
      example: { formula: 'COUPNUM(DATE(2024,5,15),DATE(2030,1,1),2)', tr: '2030 vadeli altı aylık kuponlu tahvilde kalan kupon sayısını verir', ru: 'Возвращает число оставшихся купонов облигации с погашением в 2030 г. и полугодовым купоном', en: 'Returns the remaining coupons on a semiannual bond maturing in 2030' },
      keywords: { tr: ['kupon sayısı', 'kalan kupon adedi', 'kaç kupon ödemesi'], ru: ['число купонов', 'количество купонных выплат', 'сколько купонов осталось'], en: ['number of coupons'] } },

    { name: 'COUPPCD', tr: 'KUPONGÜNÖKT', ru: 'ДАТАКУПОНДО', category: 'financial', syntax: 'COUPPCD(settlement, maturity, frequency, [basis])',
      args: [ C.settlement(), C.maturity(), C.frequency(), C.basis() ],
      desc: { tr: 'Ödeme tarihinden önceki son kupon tarihini verir.', ru: 'Возвращает предыдущую купонную дату перед датой расчёта.', en: 'Returns the previous coupon date before the settlement date.' },
      example: { formula: 'COUPPCD(DATE(2024,5,15),DATE(2030,1,1),2)', tr: '15 Mayıs 2024’ten önceki kupon tarihini (1 Ocak 2024) verir', ru: 'Возвращает купонную дату перед 15 мая 2024 (1 января 2024)', en: 'Returns the coupon date before 15 May 2024 (1 January 2024)' },
      keywords: { tr: ['önceki kupon tarihi', 'son kupon ödemesi', 'bir önceki kupon günü'], ru: ['предыдущая купонная дата', 'дата последнего купона', 'прошлый купон'], en: ['previous coupon date'] } },

    { name: 'CUMIPMT', tr: 'TOPÖDENENFAİZ', ru: 'ОБЩПЛАТ', category: 'financial', syntax: 'CUMIPMT(rate, nper, pv, start_period, end_period, type)',
      args: [ C.annRate(), C.nper(), C.pv(), A('start_period', 'başlangıç_dönemi', 'нач_период', false, 'Hesaplamanın başladığı dönem (1’den başlar)', 'Первый период расчёта (нумерация с 1)', 'The first period in the calculation (starting at 1)'), A('end_period', 'bitiş_dönemi', 'кон_период', false, 'Hesaplamanın bittiği dönem', 'Последний период расчёта', 'The last period in the calculation'), A('type', 'tür', 'тип', false, 'Ödeme zamanı: 0 dönem sonu, 1 dönem başı (zorunlu)', 'Срок выплаты: 0 — конец периода, 1 — начало (обязательный)', 'When payments are due: 0 end of period, 1 beginning (required)') ],
      desc: { tr: 'Bir kredinin belirtilen dönem aralığında ödenen toplam faizini verir (sonuç negatiftir; pozitif için başına eksi koyun).', ru: 'Возвращает общую сумму процентов по кредиту, выплаченных между двумя периодами (результат отрицательный; для положительного поставьте минус).', en: 'Returns the cumulative interest paid on a loan between two periods (the result is negative; negate it for a positive number).' },
      example: { formula: '-CUMIPMT(8%/12,120,200000,1,12,0)', tr: '200.000 TL, %8 yıllık faizli 10 yıllık kredinin ilk yıl ödenen toplam faizini verir', ru: 'Возвращает проценты за первый год по кредиту 200 000 на 10 лет под 8% годовых', en: 'Returns the total interest paid in year one on a 200,000 ten-year loan at 8%' },
      keywords: { tr: ['toplam ödenen faiz', 'dönemler arası faiz toplamı', 'kredi faiz toplamı', 'ilk yıl faizi'], ru: ['сумма процентов за период', 'общая сумма процентов по кредиту', 'проценты между периодами', 'проценты за год'], en: ['cumulative interest', 'total interest paid between periods'] } },

    { name: 'CUMPRINC', tr: 'TOPANAPARA', ru: 'ОБЩДОХОД', category: 'financial', syntax: 'CUMPRINC(rate, nper, pv, start_period, end_period, type)',
      args: [ C.annRate(), C.nper(), C.pv(), A('start_period', 'başlangıç_dönemi', 'нач_период', false, 'Hesaplamanın başladığı dönem (1’den başlar)', 'Первый период расчёта (нумерация с 1)', 'The first period in the calculation (starting at 1)'), A('end_period', 'bitiş_dönemi', 'кон_период', false, 'Hesaplamanın bittiği dönem', 'Последний период расчёта', 'The last period in the calculation'), A('type', 'tür', 'тип', false, 'Ödeme zamanı: 0 dönem sonu, 1 dönem başı (zorunlu)', 'Срок выплаты: 0 — конец периода, 1 — начало (обязательный)', 'When payments are due: 0 end of period, 1 beginning (required)') ],
      desc: { tr: 'Bir kredinin belirtilen dönem aralığında ödenen toplam anaparasını verir (sonuç negatiftir).', ru: 'Возвращает общую сумму основного долга по кредиту, выплаченную между двумя периодами (результат отрицательный).', en: 'Returns the cumulative principal paid on a loan between two periods (the result is negative).' },
      example: { formula: '-CUMPRINC(8%/12,120,200000,1,12,0)', tr: '200.000 TL’lik kredinin ilk 12 ayında ödenen anaparayı verir', ru: 'Возвращает основной долг, погашенный за первые 12 месяцев кредита 200 000', en: 'Returns the principal repaid in the first 12 months of a 200,000 loan' },
      keywords: { tr: ['toplam ödenen anapara', 'dönemler arası anapara', 'kredi anapara toplamı', 'kalan borç hesabı'], ru: ['сумма основного долга за период', 'погашено основного долга', 'тело кредита за период', 'остаток долга'], en: ['cumulative principal', 'principal paid between periods'] } },

    { name: 'DB', tr: 'AZALANBAKİYE', ru: 'ФУО', category: 'financial', syntax: 'DB(cost, salvage, life, period, [month])',
      args: [ C.cost(), C.salvage(), C.life(), A('period', 'dönem', 'период', false, 'Amortismanı hesaplanacak dönem (ömürle aynı birimde)', 'Период, для которого рассчитывается амортизация (в тех же единицах, что срок)', 'The period to calculate depreciation for (same units as life)'), A('month', 'ay', 'месяцы', true, 'İlk yıldaki ay sayısı (varsayılan 12)', 'Число месяцев в первом году (по умолчанию 12)', 'Number of months in the first year (default 12)') ],
      desc: { tr: 'Sabit azalan bakiye yöntemiyle bir varlığın belirtilen dönemdeki amortismanını verir.', ru: 'Возвращает амортизацию актива за заданный период методом фиксированного уменьшения остатка.', en: 'Returns the depreciation of an asset for a given period using the fixed-declining balance method.' },
      example: { formula: 'DB(100000,10000,5,1)', tr: '100.000 TL maliyetli, 5 yıl ömürlü varlığın 1. yıl amortismanını verir', ru: 'Возвращает амортизацию за 1-й год актива стоимостью 100 000 со сроком 5 лет', en: 'Returns year-one depreciation of a 100,000 asset with a 5-year life' },
      keywords: { tr: ['azalan bakiye amortisman', 'sabit azalan bakiye', 'amortisman hesapla', 'yıpranma payı'], ru: ['амортизация уменьшаемый остаток', 'фиксированное уменьшение остатка', 'рассчитать амортизацию', 'износ'], en: ['declining balance depreciation', 'fixed declining balance'] } },

    { name: 'DDB', tr: 'ÇİFTAZALAN', ru: 'ДДОБ', category: 'financial', syntax: 'DDB(cost, salvage, life, period, [factor])',
      args: [ C.cost(), C.salvage(), C.life(), A('period', 'dönem', 'период', false, 'Amortismanı hesaplanacak dönem (ömürle aynı birimde)', 'Период, для которого рассчитывается амортизация (в тех же единицах, что срок)', 'The period to calculate depreciation for (same units as life)'), A('factor', 'faktör', 'коэффициент', true, 'Bakiyenin azalma hızı (varsayılan 2 = çift azalan)', 'Скорость уменьшения остатка (по умолчанию 2 — двойное)', 'Rate at which the balance declines (default 2 = double)') ],
      desc: { tr: 'Çift azalan bakiye (veya belirtilen katsayılı) yöntemiyle varlığın belirtilen dönemdeki amortismanını verir; ilk yıllarda daha yüksek amortisman ayırır.', ru: 'Возвращает амортизацию актива за период методом двойного (или с заданным коэффициентом) уменьшения остатка — больше в первые годы.', en: 'Returns the depreciation of an asset for a period using the double-declining balance (or a specified factor), front-loading depreciation.' },
      example: { formula: 'DDB(100000,10000,5,1)', tr: '100.000 TL’lik varlığın 1. yıl çift azalan amortismanını (40.000) verir', ru: 'Возвращает амортизацию за 1-й год методом ДДОБ для актива 100 000 (40 000)', en: 'Returns year-one double-declining depreciation of a 100,000 asset (40,000)' },
      keywords: { tr: ['çift azalan bakiye', 'hızlandırılmış amortisman', 'amortisman ilk yıl yüksek'], ru: ['двойное уменьшение остатка', 'ускоренная амортизация', 'амортизация ддоб'], en: ['double declining balance', 'accelerated depreciation'] } },

    { name: 'DISC', tr: 'İNDİRİM', ru: 'СКИДКА', category: 'financial', syntax: 'DISC(settlement, maturity, pr, redemption, [basis])',
      args: [ C.settlement(), C.maturity(), C.pr(), C.redemption(), C.basis() ],
      desc: { tr: 'Bir menkul kıymetin yıllık iskonto oranını verir.', ru: 'Возвращает годовую ставку дисконтирования по ценной бумаге.', en: 'Returns the annual discount rate for a security.' },
      example: { formula: 'DISC(DATE(2024,1,15),DATE(2024,7,15),97.5,100)', tr: '97,5’ten alınıp 100’den itfa edilen kâğıdın iskonto oranını verir', ru: 'Возвращает ставку дисконта бумаги, купленной за 97,5 и погашаемой по 100', en: 'Returns the discount rate of a note bought at 97.5 and redeemed at 100' },
      keywords: { tr: ['iskonto oranı', 'indirim oranı menkul kıymet', 'iskontolu kâğıt oranı'], ru: ['ставка дисконта', 'ставка дисконтирования бумаги', 'дисконтная ставка'], en: ['discount rate security'] } },

    { name: 'DOLLARDE', tr: 'LİRAON', ru: 'РУБЛЬ.ДЕС', category: 'financial', syntax: 'DOLLARDE(fractional_dollar, fraction)',
      args: [ A('fractional_dollar', 'kesirli_lira', 'дроб_руб', false, 'Tam kısım ve kesir payı ondalık noktayla ayrılmış sayı (ör. 1,02 = 1 ve 2/16)', 'Число, в котором целая часть и числитель дроби разделены запятой (например, 1,02 = 1 и 2/16)', 'A number with the integer part and the fraction numerator separated by a decimal point (e.g. 1.02 = 1 and 2/16)'), A('fraction', 'kesir', 'дроб', false, 'Kesrin paydası (tam sayı, ör. 16 veya 32)', 'Знаменатель дроби (целое число, например 16 или 32)', 'The denominator of the fraction (integer, e.g. 16 or 32)') ],
      desc: { tr: 'Kesir olarak ifade edilen bir fiyatı (ör. 1,02 = 1 ve 2/16) ondalık sayıya çevirir.', ru: 'Преобразует цену, выраженную дробью (например, 1,02 = 1 и 2/16), в десятичное число.', en: 'Converts a price expressed as a fraction (e.g. 1.02 = 1 and 2/16) into a decimal number.' },
      example: { formula: 'DOLLARDE(1.02,16)', tr: '1 ve 2/16 değerini ondalık 1,125 olarak verir', ru: 'Возвращает 1 и 2/16 как десятичное 1,125', en: 'Returns 1 and 2/16 as the decimal 1.125' },
      keywords: { tr: ['kesirli fiyatı ondalığa çevir', 'kesir ondalık dönüştür', 'tahvil fiyatı kesir'], ru: ['дробную цену в десятичную', 'дробь в десятичное', 'цена облигации дробь'], en: ['fractional to decimal price'] } },

    { name: 'DOLLARFR', tr: 'LİRAKES', ru: 'РУБЛЬ.ДРОБЬ', category: 'financial', syntax: 'DOLLARFR(decimal_dollar, fraction)',
      args: [ A('decimal_dollar', 'ondalık_lira', 'дес_руб', false, 'Ondalık sayı', 'Десятичное число', 'A decimal number'), A('fraction', 'kesir', 'дроб', false, 'Kesrin paydası (tam sayı, ör. 16 veya 32)', 'Знаменатель дроби (целое число, например 16 или 32)', 'The denominator of the fraction (integer, e.g. 16 or 32)') ],
      desc: { tr: 'Ondalık bir fiyatı kesirli gösterime (ör. 1,125 → 1,02 = 1 ve 2/16) çevirir.', ru: 'Преобразует десятичную цену в дробное представление (например, 1,125 → 1,02 = 1 и 2/16).', en: 'Converts a decimal price into fractional notation (e.g. 1.125 → 1.02 = 1 and 2/16).' },
      example: { formula: 'DOLLARFR(1.125,16)', tr: '1,125 değerini 16’lık kesir gösterimiyle 1,02 olarak verir', ru: 'Возвращает 1,125 в шестнадцатых долях как 1,02', en: 'Returns 1.125 in sixteenths as 1.02' },
      keywords: { tr: ['ondalığı kesirli fiyata çevir', 'ondalık kesir dönüştür'], ru: ['десятичную цену в дробную', 'десятичное в дробь'], en: ['decimal to fractional price'] } },

    { name: 'DURATION', tr: 'SÜRE', ru: 'ДЛИТ', category: 'financial', syntax: 'DURATION(settlement, maturity, coupon, yld, frequency, [basis])',
      args: [ C.settlement(), C.maturity(), A('coupon', 'kupon', 'купон', false, 'Yıllık kupon oranı', 'Годовая купонная ставка', 'The security’s annual coupon rate'), C.yld(), C.frequency(), C.basis() ],
      desc: { tr: 'Nominal değeri 100 kabul edilen, dönemsel faiz ödeyen bir menkul kıymetin Macaulay durasyonunu (yıl) verir; faiz duyarlılığı ölçüsüdür.', ru: 'Возвращает дюрацию Маколея (в годах) ценной бумаги с номиналом 100 и периодическими выплатами — меру чувствительности к ставке.', en: 'Returns the Macaulay duration (in years) of a security with 100 par value and periodic interest, a measure of interest-rate sensitivity.' },
      example: { formula: 'DURATION(DATE(2024,1,1),DATE(2032,1,1),0.08,0.09,2)', tr: '%8 kuponlu, %9 getirili 8 yıllık tahvilin durasyonunu verir', ru: 'Возвращает дюрацию 8-летней облигации с купоном 8% и доходностью 9%', en: 'Returns the duration of an 8-year bond with an 8% coupon and 9% yield' },
      keywords: { tr: ['durasyon', 'macaulay durasyonu', 'tahvil süresi', 'faiz duyarlılığı'], ru: ['дюрация', 'дюрация маколея', 'длительность облигации', 'чувствительность к ставке'], en: ['macaulay duration', 'bond duration'] } },

    { name: 'EFFECT', tr: 'ETKİN', ru: 'ЭФФЕКТ', category: 'financial', syntax: 'EFFECT(nominal_rate, npery)',
      args: [ A('nominal_rate', 'nominal_oran', 'номинальная_ставка', false, 'Yıllık nominal faiz oranı', 'Номинальная годовая процентная ставка', 'The nominal annual interest rate'), A('npery', 'dönem_sayısı', 'кол_пер', false, 'Yıl içindeki bileşik dönem sayısı (aylık için 12)', 'Число периодов начисления в году (12 для ежемесячного)', 'Number of compounding periods per year (12 for monthly)') ],
      desc: { tr: 'Nominal faiz oranı ve yıllık bileşik dönem sayısından yıllık efektif (gerçek) faiz oranını verir.', ru: 'Возвращает эффективную (фактическую) годовую ставку по номинальной ставке и числу периодов начисления в году.', en: 'Returns the effective annual interest rate given a nominal rate and the number of compounding periods per year.' },
      example: { formula: 'EFFECT(0.12,12)', tr: 'Aylık bileşik %12 nominal faizin yıllık efektif oranını (%12,68) verir', ru: 'Возвращает эффективную ставку (12,68%) для 12% номинальных при ежемесячном начислении', en: 'Returns the effective rate (12.68%) for 12% nominal compounded monthly' },
      keywords: { tr: ['efektif faiz', 'etkin faiz oranı', 'yıllık bileşik faiz', 'gerçek faiz oranı'], ru: ['эффективная ставка', 'реальная годовая ставка', 'эффективная процентная ставка', 'сложный процент годовых'], en: ['effective interest rate', 'effective annual rate'] } },

    { name: 'FV', tr: 'GD', ru: 'БС', category: 'financial', syntax: 'FV(rate, nper, pmt, [pv], [type])',
      args: [ C.annRate(), C.nper(), C.pmt(), C.pv(true), C.type() ],
      desc: { tr: 'Sabit faiz ve düzenli ödemelerle bir yatırımın gelecekteki değerini verir (birikim hesabı).', ru: 'Возвращает будущую стоимость инвестиции при постоянной ставке и регулярных платежах (расчёт накоплений).', en: 'Returns the future value of an investment with a constant interest rate and regular payments (savings calculation).' },
      example: { formula: 'FV(6%/12,120,-500)', tr: 'Ayda 500 TL yatırarak %6 yıllık faizle 10 yılda biriken tutarı verir', ru: 'Возвращает сумму, накопленную за 10 лет при взносе 500 в месяц под 6% годовых', en: 'Returns the amount saved in 10 years paying 500 a month at 6% a year' },
      keywords: { tr: ['gelecek değer', 'birikim hesabı', 'ne kadar birikir', 'yatırım gelecek değeri', 'vadeli hesap sonu'], ru: ['будущая стоимость', 'сколько накопится', 'расчёт накоплений', 'будущая сумма вклада', 'сумма через n лет'], en: ['future value', 'savings growth', 'how much will I have'] } },

    { name: 'FVSCHEDULE', tr: 'GDPROGRAM', ru: 'БЗРАСПИС', category: 'financial', syntax: 'FVSCHEDULE(principal, schedule)',
      args: [ A('principal', 'anapara', 'первичное', false, 'Başlangıç anaparası (bugünkü değer)', 'Начальная сумма (приведённая стоимость)', 'The present value (initial principal)'), A('schedule', 'program', 'план', false, 'Dönem dönem uygulanacak faiz oranlarını içeren aralık veya dizi', 'Диапазон или массив ставок, применяемых по периодам', 'Range or array of interest rates applied period by period') ],
      desc: { tr: 'Her dönem farklı (değişken) faiz oranı uygulanan bir anaparanın gelecekteki değerini verir.', ru: 'Возвращает будущую стоимость суммы при переменных процентных ставках по периодам.', en: 'Returns the future value of a principal after applying a series of (variable) compound interest rates.' },
      example: { formula: 'FVSCHEDULE(10000,{0.05,0.06,0.07})', tr: '10.000 TL’nin sırayla %5, %6 ve %7 faizle üç yıl sonraki değerini verir', ru: 'Возвращает стоимость 10 000 через три года при ставках 5%, 6% и 7%', en: 'Returns the value of 10,000 after three years at 5%, 6% and 7%' },
      keywords: { tr: ['değişken faizle gelecek değer', 'farklı faiz oranları birikim', 'faiz programı'], ru: ['будущая стоимость переменная ставка', 'разные ставки по годам', 'план процентных ставок'], en: ['future value variable rates', 'rate schedule'] } },

    { name: 'INTRATE', tr: 'FAİZORANI', ru: 'ИНОРМА', category: 'financial', syntax: 'INTRATE(settlement, maturity, investment, redemption, [basis])',
      args: [ C.settlement(), C.maturity(), C.investment(), C.redemption(), C.basis() ],
      desc: { tr: 'Tamamen yatırılmış (iskontolu) bir menkul kıymetin yıllık basit faiz oranını verir.', ru: 'Возвращает годовую ставку доходности для полностью инвестированной ценной бумаги.', en: 'Returns the annual simple interest rate for a fully invested security.' },
      example: { formula: 'INTRATE(DATE(2024,1,1),DATE(2024,7,1),95000,100000)', tr: '95.000 TL yatırılıp 6 ay sonra 100.000 TL alınan kâğıdın faiz oranını verir', ru: 'Возвращает ставку бумаги, купленной за 95 000 с выплатой 100 000 через 6 месяцев', en: 'Returns the rate on a note bought for 95,000 that pays 100,000 after 6 months' },
      keywords: { tr: ['yatırım faiz oranı', 'basit faiz oranı menkul kıymet', 'getiri oranı tam yatırım'], ru: ['ставка по инвестиции', 'простая ставка доходности', 'норма доходности бумаги'], en: ['interest rate fully invested security'] } },

    { name: 'IPMT', tr: 'FAİZTUTARI', ru: 'ПРПЛТ', category: 'financial', syntax: 'IPMT(rate, per, nper, pv, [fv], [type])',
      args: [ C.annRate(), C.per(), C.nper(), C.pv(), C.fv(), C.type() ],
      desc: { tr: 'Sabit ödemeli bir kredinin belirli bir taksitindeki faiz kısmını verir (anapara kısmı için PPMT).', ru: 'Возвращает процентную часть конкретного платежа по кредиту с постоянными выплатами (основную часть даёт ОСПЛТ).', en: 'Returns the interest portion of a specific payment on a loan with constant payments (PPMT gives the principal portion).' },
      example: { formula: 'IPMT(8%/12,1,120,-200000)', tr: '200.000 TL, %8 faizli 120 aylık kredinin 1. taksitindeki faizi verir', ru: 'Возвращает проценты в 1-м платеже по кредиту 200 000 на 120 месяцев под 8%', en: 'Returns the interest in payment 1 of a 200,000 loan over 120 months at 8%' },
      keywords: { tr: ['taksitin faiz kısmı', 'dönem faizi', 'kredi faiz tutarı', 'ödeme planı faiz'], ru: ['процентная часть платежа', 'проценты за период', 'проценты в аннуитетном платеже', 'график платежей проценты'], en: ['interest portion of payment', 'interest payment period'] } },

    { name: 'IRR', tr: 'İÇ_VERİM_ORANI', ru: 'ВСД', category: 'financial', syntax: 'IRR(values, [guess])',
      args: [ C.values(), C.guess() ],
      desc: { tr: 'Düzenli aralıklarla gerçekleşen nakit akışlarının (ilk değer genelde negatif yatırım) iç verim oranını verir.', ru: 'Возвращает внутреннюю ставку доходности для потока регулярных денежных поступлений (первое значение обычно — отрицательная инвестиция).', en: 'Returns the internal rate of return for a series of regularly spaced cash flows (the first usually a negative investment).' },
      example: { formula: 'IRR(B2:B7)', tr: 'B2:B7’deki yatırım ve yıllık gelirlerin iç verim oranını verir', ru: 'Возвращает внутреннюю норму доходности для инвестиции и годовых поступлений в B2:B7', en: 'Returns the internal rate of return of the investment and yearly inflows in B2:B7' },
      keywords: { tr: ['iç verim oranı', 'iç getiri oranı', 'yatırım getirisi oranı', 'proje kârlılığı', 'irr hesapla'], ru: ['внутренняя норма доходности', 'внутренняя ставка доходности', 'irr', 'доходность проекта', 'окупаемость инвестиции'], en: ['internal rate of return', 'irr', 'project return'] } },

    { name: 'ISPMT', tr: 'ISPMT', ru: 'ПРОЦПЛАТ', category: 'financial', syntax: 'ISPMT(rate, per, nper, pv)',
      args: [ C.annRate(), A('per', 'dönem', 'период', false, 'Faizi hesaplanacak dönem (0’dan başlar)', 'Период, для которого вычисляются проценты (нумерация с 0)', 'The period to find the interest for (starting at 0)'), C.nper(), C.pv() ],
      desc: { tr: 'Anaparası eşit taksitlerle ödenen (Lotus 1-2-3 uyumlu) bir kredinin belirli dönemindeki faizi verir.', ru: 'Возвращает проценты за период для кредита с равными платежами по основному долгу (совместимость с Lotus 1-2-3).', en: 'Returns the interest paid in a given period of a loan with equal principal payments (Lotus 1-2-3 compatible).' },
      example: { formula: 'ISPMT(8%/12,1,120,200000)', tr: 'Eşit anaparalı 200.000 TL’lik kredinin 2. dönem faizini verir', ru: 'Возвращает проценты за 2-й период кредита 200 000 с равными долями основного долга', en: 'Returns period-2 interest on a 200,000 equal-principal loan' },
      keywords: { tr: ['eşit anapara faiz', 'dönem faizi eşit anapara', 'lotus faiz hesabı'], ru: ['проценты при равных долях долга', 'проценты за период дифференцированный платёж', 'дифференцированный кредит проценты'], en: ['interest equal principal loan'] } },

    { name: 'MDURATION', tr: 'MSÜRE', ru: 'МДЛИТ', category: 'financial', syntax: 'MDURATION(settlement, maturity, coupon, yld, frequency, [basis])',
      args: [ C.settlement(), C.maturity(), A('coupon', 'kupon', 'купон', false, 'Yıllık kupon oranı', 'Годовая купонная ставка', 'The security’s annual coupon rate'), C.yld(), C.frequency(), C.basis() ],
      desc: { tr: 'Nominal değeri 100 kabul edilen bir menkul kıymetin değiştirilmiş (modified) Macaulay durasyonunu verir.', ru: 'Возвращает модифицированную дюрацию Маколея для ценной бумаги с номиналом 100.', en: 'Returns the modified Macaulay duration for a security with an assumed par value of 100.' },
      example: { formula: 'MDURATION(DATE(2024,1,1),DATE(2032,1,1),0.08,0.09,2)', tr: '%8 kuponlu 8 yıllık tahvilin değiştirilmiş durasyonunu verir', ru: 'Возвращает модифицированную дюрацию 8-летней облигации с купоном 8%', en: 'Returns the modified duration of an 8-year 8% bond' },
      keywords: { tr: ['değiştirilmiş durasyon', 'modified duration', 'tahvil fiyat duyarlılığı'], ru: ['модифицированная дюрация', 'чувствительность цены облигации'], en: ['modified duration'] } },

    { name: 'MIRR', tr: 'D_İÇ_VERİM_ORANI', ru: 'МВСД', category: 'financial', syntax: 'MIRR(values, finance_rate, reinvest_rate)',
      args: [ C.values(), A('finance_rate', 'finans_oranı', 'ставка_финанс', false, 'Kullanılan paraya ödenen faiz oranı (finansman maliyeti)', 'Ставка процента, выплачиваемого за используемые деньги (стоимость финансирования)', 'The interest rate paid on the money used (cost of financing)'), A('reinvest_rate', 'yeniden_yatırım_oranı', 'ставка_реинвест', false, 'Nakit girişlerinin yeniden yatırıldığı faiz oranı', 'Ставка, по которой реинвестируются поступления', 'The rate at which cash inflows are reinvested') ],
      desc: { tr: 'Finansman maliyeti ve yeniden yatırım getirisini ayrı ayrı dikkate alarak nakit akışlarının değiştirilmiş iç verim oranını verir.', ru: 'Возвращает модифицированную внутреннюю ставку доходности с учётом стоимости финансирования и ставки реинвестирования.', en: 'Returns the modified internal rate of return, accounting separately for the cost of financing and the reinvestment rate.' },
      example: { formula: 'MIRR(B2:B7,10%,12%)', tr: '%10 finansman ve %12 yeniden yatırım oranıyla B2:B7 akışlarının MIRR değerini verir', ru: 'Возвращает МВСД потоков B2:B7 при ставке финансирования 10% и реинвестирования 12%', en: 'Returns the MIRR of the flows in B2:B7 with 10% financing and 12% reinvestment' },
      keywords: { tr: ['değiştirilmiş iç verim oranı', 'mirr', 'yeniden yatırım oranlı getiri'], ru: ['модифицированная внутренняя норма доходности', 'мвсд', 'mirr'], en: ['modified internal rate of return', 'mirr'] } },

    { name: 'NOMINAL', tr: 'NOMİNAL', ru: 'НОМИНАЛ', category: 'financial', syntax: 'NOMINAL(effect_rate, npery)',
      args: [ A('effect_rate', 'etkin_oran', 'эффект_ставка', false, 'Yıllık efektif faiz oranı', 'Эффективная годовая ставка', 'The effective annual interest rate'), A('npery', 'dönem_sayısı', 'кол_пер', false, 'Yıl içindeki bileşik dönem sayısı', 'Число периодов начисления в году', 'Number of compounding periods per year') ],
      desc: { tr: 'Efektif yıllık faiz oranı ve bileşik dönem sayısından yıllık nominal faiz oranını verir (EFFECT’in tersi).', ru: 'Возвращает номинальную годовую ставку по эффективной ставке и числу периодов начисления (обратная к ЭФФЕКТ).', en: 'Returns the nominal annual interest rate from an effective rate and the number of compounding periods (inverse of EFFECT).' },
      example: { formula: 'NOMINAL(0.1268,12)', tr: 'Aylık bileşik %12,68 efektif faizin nominal karşılığını (%12) verir', ru: 'Возвращает номинальную ставку (12%) для эффективных 12,68% при ежемесячном начислении', en: 'Returns the nominal rate (12%) for 12.68% effective compounded monthly' },
      keywords: { tr: ['nominal faiz', 'nominal faiz oranı', 'efektiften nominale'], ru: ['номинальная ставка', 'номинальная процентная ставка', 'из эффективной в номинальную'], en: ['nominal interest rate'] } },

    { name: 'NPER', tr: 'TAKSİT_SAYISI', ru: 'КПЕР', category: 'financial', syntax: 'NPER(rate, pmt, pv, [fv], [type])',
      args: [ C.annRate(), C.pmt(), C.pv(), C.fv(), C.type() ],
      desc: { tr: 'Sabit faiz ve sabit ödemeyle bir kredinin kaç dönemde (taksitte) biteceğini veya hedefe kaç dönemde ulaşılacağını verir.', ru: 'Возвращает число периодов (платежей), за которое погашается кредит или достигается цель при постоянной ставке и платеже.', en: 'Returns the number of periods (payments) needed to pay off a loan or reach a goal at a constant rate and payment.' },
      example: { formula: 'NPER(8%/12,-2500,200000)', tr: 'Ayda 2.500 TL ödeyerek %8 faizli 200.000 TL kredinin kaç ayda biteceğini verir', ru: 'Возвращает, за сколько месяцев погасится кредит 200 000 под 8% при платеже 2500 в месяц', en: 'Returns how many months a 200,000 loan at 8% takes to repay at 2,500 a month' },
      keywords: { tr: ['kaç taksit', 'dönem sayısı', 'kredi kaç ayda biter', 'ödeme sayısı', 'kaç ay sürer'], ru: ['количество периодов', 'сколько платежей', 'за сколько месяцев погасится кредит', 'число периодов', 'срок кредита'], en: ['number of periods', 'how many payments', 'loan term'] } },

    { name: 'NPV', tr: 'NBD', ru: 'ЧПС', category: 'financial', syntax: 'NPV(rate, value1, [value2], ...)',
      args: [ A('rate', 'oran', 'ставка', false, 'Bir dönem için iskonto oranı', 'Ставка дисконтирования за один период', 'The discount rate over one period'), A('value1', 'değer1', 'значение1', false, 'Dönem sonlarında gerçekleşen nakit akışları (aralık veya değerler); ilk yatırım dönem başındaysa dışarıda bırakıp sonuca ekleyin', 'Денежные потоки на конец каждого периода (диапазон или значения); начальную инвестицию в начале периода прибавляют к результату отдельно', 'Cash flows at the end of each period (range or values); add an up-front investment to the result separately'), A('value2', 'değer2', 'значение2', true, 'Ek nakit akışları (en fazla 254)', 'Дополнительные денежные потоки (до 254)', 'Additional cash flows (up to 254)') ],
      desc: { tr: 'İskonto oranı ve gelecekteki dönemsel nakit akışlarından bir yatırımın net bugünkü değerini verir.', ru: 'Возвращает чистую приведённую стоимость инвестиции по ставке дисконтирования и будущим периодическим потокам.', en: 'Returns the net present value of an investment from a discount rate and a series of future periodic cash flows.' },
      example: { formula: 'NPV(10%,B3:B7)+B2', tr: '%10 iskontoyla B3:B7 gelirlerinin bugünkü değerine B2’deki başlangıç yatırımını ekler', ru: 'Приводит поступления B3:B7 по ставке 10% и прибавляет начальную инвестицию из B2', en: 'Discounts the inflows in B3:B7 at 10% and adds the initial investment in B2' },
      keywords: { tr: ['net bugünkü değer', 'nbd hesapla', 'npv', 'yatırım değerlemesi', 'bugünkü değer nakit akışı'], ru: ['чистая приведённая стоимость', 'чистый дисконтированный доход', 'npv', 'чпс', 'оценка инвестиции'], en: ['net present value', 'npv', 'discounted cash flow'] } },

    { name: 'ODDFPRICE', tr: 'TEKYDEĞER', ru: 'ЦЕНАПЕРВНЕРЕГ', category: 'financial', syntax: 'ODDFPRICE(settlement, maturity, issue, first_coupon, rate, yld, redemption, frequency, [basis])',
      args: [ C.settlement(), C.maturity(), C.issue(), A('first_coupon', 'ilk_kupon', 'первый_купон', false, 'İlk kupon tarihi', 'Дата первого купона', 'The security’s first coupon date'), C.rate(), C.yld(), C.redemption(), C.frequency(), C.basis() ],
      desc: { tr: 'İlk kupon dönemi düzensiz (kısa veya uzun) olan bir menkul kıymetin 100 nominal başına fiyatını verir.', ru: 'Возвращает цену за 100 номинала ценной бумаги с нерегулярным (коротким или длинным) первым купонным периодом.', en: 'Returns the price per 100 face value of a security with an odd (short or long) first coupon period.' },
      example: { formula: 'ODDFPRICE(DATE(2024,2,1),DATE(2030,3,15),DATE(2023,12,1),DATE(2024,9,15),0.07,0.06,100,2)', tr: 'İlk kuponu düzensiz tahvilin fiyatını verir', ru: 'Возвращает цену облигации с нерегулярным первым купоном', en: 'Returns the price of a bond with an odd first coupon' },
      keywords: { tr: ['düzensiz ilk kupon fiyat', 'kısa ilk dönem tahvil fiyatı'], ru: ['цена нерегулярный первый купон', 'цена облигации короткий первый период'], en: ['odd first period price'] } },

    { name: 'ODDFYIELD', tr: 'TEKYÖDEME', ru: 'ДОХОДПЕРВНЕРЕГ', category: 'financial', syntax: 'ODDFYIELD(settlement, maturity, issue, first_coupon, rate, pr, redemption, frequency, [basis])',
      args: [ C.settlement(), C.maturity(), C.issue(), A('first_coupon', 'ilk_kupon', 'первый_купон', false, 'İlk kupon tarihi', 'Дата первого купона', 'The security’s first coupon date'), C.rate(), C.pr(), C.redemption(), C.frequency(), C.basis() ],
      desc: { tr: 'İlk kupon dönemi düzensiz olan bir menkul kıymetin getirisini verir.', ru: 'Возвращает доходность ценной бумаги с нерегулярным первым купонным периодом.', en: 'Returns the yield of a security with an odd (short or long) first coupon period.' },
      example: { formula: 'ODDFYIELD(DATE(2024,2,1),DATE(2030,3,15),DATE(2023,12,1),DATE(2024,9,15),0.07,98.5,100,2)', tr: '98,5’ten alınan, ilk kuponu düzensiz tahvilin getirisini verir', ru: 'Возвращает доходность облигации с нерегулярным первым купоном, купленной за 98,5', en: 'Returns the yield of an odd-first-coupon bond bought at 98.5' },
      keywords: { tr: ['düzensiz ilk kupon getiri', 'kısa ilk dönem tahvil getirisi'], ru: ['доходность нерегулярный первый купон', 'доходность короткий первый период'], en: ['odd first period yield'] } },

    { name: 'ODDLPRICE', tr: 'TEKSDEĞER', ru: 'ЦЕНАПОСЛНЕРЕГ', category: 'financial', syntax: 'ODDLPRICE(settlement, maturity, last_interest, rate, yld, redemption, frequency, [basis])',
      args: [ C.settlement(), C.maturity(), A('last_interest', 'son_faiz', 'последний_доход', false, 'Son kupon tarihi', 'Дата последнего купона', 'The security’s last coupon date'), C.rate(), C.yld(), C.redemption(), C.frequency(), C.basis() ],
      desc: { tr: 'Son kupon dönemi düzensiz (kısa veya uzun) olan bir menkul kıymetin 100 nominal başına fiyatını verir.', ru: 'Возвращает цену за 100 номинала ценной бумаги с нерегулярным последним купонным периодом.', en: 'Returns the price per 100 face value of a security with an odd (short or long) last coupon period.' },
      example: { formula: 'ODDLPRICE(DATE(2024,2,7),DATE(2024,6,15),DATE(2023,10,15),0.0375,0.0405,100,2)', tr: 'Son kuponu düzensiz tahvilin fiyatını verir', ru: 'Возвращает цену облигации с нерегулярным последним купоном', en: 'Returns the price of a bond with an odd last coupon' },
      keywords: { tr: ['düzensiz son kupon fiyat', 'kısa son dönem tahvil fiyatı'], ru: ['цена нерегулярный последний купон', 'цена облигации короткий последний период'], en: ['odd last period price'] } },

    { name: 'ODDLYIELD', tr: 'TEKSÖDEME', ru: 'ДОХОДПОСЛНЕРЕГ', category: 'financial', syntax: 'ODDLYIELD(settlement, maturity, last_interest, rate, pr, redemption, frequency, [basis])',
      args: [ C.settlement(), C.maturity(), A('last_interest', 'son_faiz', 'последний_доход', false, 'Son kupon tarihi', 'Дата последнего купона', 'The security’s last coupon date'), C.rate(), C.pr(), C.redemption(), C.frequency(), C.basis() ],
      desc: { tr: 'Son kupon dönemi düzensiz olan bir menkul kıymetin getirisini verir.', ru: 'Возвращает доходность ценной бумаги с нерегулярным последним купонным периодом.', en: 'Returns the yield of a security with an odd (short or long) last coupon period.' },
      example: { formula: 'ODDLYIELD(DATE(2024,2,7),DATE(2024,6,15),DATE(2023,10,15),0.0375,99.875,100,2)', tr: '99,875’ten alınan, son kuponu düzensiz tahvilin getirisini verir', ru: 'Возвращает доходность облигации с нерегулярным последним купоном, купленной за 99,875', en: 'Returns the yield of an odd-last-coupon bond bought at 99.875' },
      keywords: { tr: ['düzensiz son kupon getiri', 'kısa son dönem tahvil getirisi'], ru: ['доходность нерегулярный последний купон', 'доходность короткий последний период'], en: ['odd last period yield'] } },

    { name: 'PDURATION', tr: 'PSÜRE', ru: 'ПДЛИТ', category: 'financial', syntax: 'PDURATION(rate, pv, fv)', minVersion: '2013',
      args: [ A('rate', 'oran', 'ставка', false, 'Dönem başına faiz oranı', 'Ставка за период', 'The interest rate per period'), A('pv', 'bd', 'пс', false, 'Yatırımın bugünkü değeri', 'Текущая стоимость инвестиции', 'The present value of the investment'), A('fv', 'gd', 'бс', false, 'Ulaşılmak istenen gelecek değer', 'Желаемая будущая стоимость', 'The desired future value') ],
      desc: { tr: 'Bir yatırımın belirli faiz oranıyla hedef değere ulaşması için gereken dönem sayısını verir.', ru: 'Возвращает число периодов, необходимое инвестиции для достижения заданной стоимости при указанной ставке.', en: 'Returns the number of periods required for an investment to reach a target value at a given rate.' },
      example: { formula: 'PDURATION(5%,10000,20000)', tr: '%5 faizle 10.000 TL’nin 20.000 TL olması için gereken yıl sayısını verir', ru: 'Возвращает, за сколько лет 10 000 вырастут до 20 000 при 5%', en: 'Returns the years needed for 10,000 to grow to 20,000 at 5%' },
      keywords: { tr: ['hedefe kaç dönem', 'para ikiye katlanma süresi', 'yatırım kaç yılda büyür'], ru: ['сколько периодов до цели', 'срок удвоения', 'за сколько лет вырастет вклад'], en: ['periods to reach target', 'doubling time'] } },

    { name: 'PMT', tr: 'DEVRESEL_ÖDEME', ru: 'ПЛТ', category: 'financial', syntax: 'PMT(rate, nper, pv, [fv], [type])',
      args: [ C.annRate(), C.nper(), C.pv(), C.fv(), C.type() ],
      desc: { tr: 'Sabit faiz ve sabit ödemelerle bir kredinin dönemsel (ör. aylık) taksit tutarını verir; anaparayı negatif girerseniz sonuç pozitif çıkar.', ru: 'Возвращает размер периодического (например, ежемесячного) платежа по кредиту при постоянной ставке; при отрицательной сумме кредита результат положительный.', en: 'Returns the periodic (e.g. monthly) payment on a loan with a constant rate and payments; enter the principal as negative to get a positive result.' },
      example: { formula: 'PMT(8%/12,120,-200000)', tr: '200.000 TL, yıllık %8 faizli 10 yıllık kredinin aylık taksitini verir', ru: 'Возвращает ежемесячный платёж по кредиту 200 000 на 10 лет под 8% годовых', en: 'Returns the monthly payment on a 200,000 loan over 10 years at 8% a year' },
      keywords: { tr: ['kredi taksiti', 'aylık taksit', 'kredi ödemesi hesapla', 'taksit tutarı', 'konut kredisi taksit', 'aylık ödeme'], ru: ['платёж по кредиту', 'ежемесячный платёж', 'аннуитетный платёж', 'расчёт кредита', 'ипотека платёж', 'размер платежа'], en: ['loan payment', 'monthly payment', 'mortgage payment'] } },

    { name: 'PPMT', tr: 'ANA_PARA_ÖDEMESİ', ru: 'ОСПЛТ', category: 'financial', syntax: 'PPMT(rate, per, nper, pv, [fv], [type])',
      args: [ C.annRate(), C.per(), C.nper(), C.pv(), C.fv(), C.type() ],
      desc: { tr: 'Sabit ödemeli bir kredinin belirli bir taksitindeki anapara kısmını verir (faiz kısmı için IPMT).', ru: 'Возвращает часть основного долга в конкретном платеже по кредиту с постоянными выплатами (проценты даёт ПРПЛТ).', en: 'Returns the principal portion of a specific payment on a loan with constant payments (IPMT gives the interest portion).' },
      example: { formula: 'PPMT(8%/12,1,120,-200000)', tr: '200.000 TL’lik kredinin 1. taksitindeki anapara tutarını verir', ru: 'Возвращает основной долг в 1-м платеже по кредиту 200 000', en: 'Returns the principal in payment 1 of a 200,000 loan' },
      keywords: { tr: ['taksitin anapara kısmı', 'anapara ödemesi', 'ödeme planı anapara', 'dönem anaparası'], ru: ['основная часть платежа', 'погашение основного долга', 'тело кредита в платеже', 'график платежей основной долг'], en: ['principal portion of payment', 'principal payment period'] } },

    { name: 'PRICE', tr: 'DEĞER', ru: 'ЦЕНА', category: 'financial', syntax: 'PRICE(settlement, maturity, rate, yld, redemption, frequency, [basis])',
      args: [ C.settlement(), C.maturity(), C.rate(), C.yld(), C.redemption(), C.frequency(), C.basis() ],
      desc: { tr: 'Dönemsel faiz ödeyen bir menkul kıymetin 100 nominal değer başına fiyatını verir.', ru: 'Возвращает цену за 100 номинала ценной бумаги с периодической выплатой процентов.', en: 'Returns the price per 100 face value of a security that pays periodic interest.' },
      example: { formula: 'PRICE(DATE(2024,2,15),DATE(2030,11,15),0.0575,0.065,100,2)', tr: '%5,75 kuponlu, %6,5 getirili tahvilin fiyatını verir', ru: 'Возвращает цену облигации с купоном 5,75% и доходностью 6,5%', en: 'Returns the price of a 5.75% coupon bond yielding 6.5%' },
      keywords: { tr: ['tahvil fiyatı', 'menkul kıymet fiyatı', 'kupon tahvil değeri', 'bono fiyatı'], ru: ['цена облигации', 'цена ценной бумаги', 'стоимость купонной облигации', 'цена бонда'], en: ['bond price', 'security price'] } },

    { name: 'PRICEDISC', tr: 'DEĞERİND', ru: 'ЦЕНАСКИДКА', category: 'financial', syntax: 'PRICEDISC(settlement, maturity, discount, redemption, [basis])',
      args: [ C.settlement(), C.maturity(), C.discount(), C.redemption(), C.basis() ],
      desc: { tr: 'İskontolu (kuponsuz) bir menkul kıymetin 100 nominal değer başına fiyatını verir.', ru: 'Возвращает цену за 100 номинала дисконтной (бескупонной) ценной бумаги.', en: 'Returns the price per 100 face value of a discounted (zero-coupon) security.' },
      example: { formula: 'PRICEDISC(DATE(2024,2,16),DATE(2024,3,1),0.0525,100)', tr: '%5,25 iskontolu kısa vadeli kâğıdın fiyatını verir', ru: 'Возвращает цену краткосрочной бумаги с дисконтом 5,25%', en: 'Returns the price of a short-term note at a 5.25% discount' },
      keywords: { tr: ['iskontolu fiyat', 'kuponsuz tahvil fiyatı', 'iskontolu bono fiyatı'], ru: ['цена дисконтной бумаги', 'цена бескупонной облигации', 'цена со скидкой'], en: ['discounted security price', 'zero coupon price'] } },

    { name: 'PRICEMAT', tr: 'DEĞERVADE', ru: 'ЦЕНАПОГАШ', category: 'financial', syntax: 'PRICEMAT(settlement, maturity, issue, rate, yld, [basis])',
      args: [ C.settlement(), C.maturity(), C.issue(), C.rate(), C.yld(), C.basis() ],
      desc: { tr: 'Faizini vadede ödeyen bir menkul kıymetin 100 nominal değer başına fiyatını verir.', ru: 'Возвращает цену за 100 номинала ценной бумаги, проценты по которой выплачиваются при погашении.', en: 'Returns the price per 100 face value of a security that pays interest at maturity.' },
      example: { formula: 'PRICEMAT(DATE(2024,2,15),DATE(2024,4,13),DATE(2023,11,11),0.061,0.061)', tr: 'Faizi vadede ödenen kâğıdın fiyatını verir', ru: 'Возвращает цену бумаги с выплатой процентов при погашении', en: 'Returns the price of a note paying interest at maturity' },
      keywords: { tr: ['vadede faizli fiyat', 'vade sonu faiz tahvil fiyatı'], ru: ['цена бумаги с процентами при погашении', 'цена при погашении'], en: ['price interest at maturity'] } },

    { name: 'PV', tr: 'BD', ru: 'ПС', category: 'financial', syntax: 'PV(rate, nper, pmt, [fv], [type])',
      args: [ C.annRate(), C.nper(), C.pmt(), C.fv(), C.type() ],
      desc: { tr: 'Gelecekteki düzenli ödemelerin bugünkü değerini verir; belirli bir taksitle ne kadar kredi alınabileceğini bulmak için kullanılır.', ru: 'Возвращает приведённую (текущую) стоимость серии будущих платежей; показывает, какой кредит доступен при заданном платеже.', en: 'Returns the present value of a series of future payments; used to find how much loan a given payment affords.' },
      example: { formula: 'PV(8%/12,120,-2500)', tr: 'Ayda 2.500 TL taksitle 10 yılda %8 faizle alınabilecek kredi tutarını verir', ru: 'Возвращает сумму кредита, доступную при платеже 2500 в месяц на 10 лет под 8%', en: 'Returns the loan amount affordable at 2,500 a month for 10 years at 8%' },
      keywords: { tr: ['bugünkü değer', 'ne kadar kredi alabilirim', 'şimdiki değer', 'taksitten kredi tutarı', 'peşin değer'], ru: ['приведённая стоимость', 'текущая стоимость', 'какой кредит можно взять', 'сумма кредита по платежу', 'настоящая стоимость'], en: ['present value', 'how much can I borrow'] } },

    { name: 'RATE', tr: 'FAİZ_ORANI', ru: 'СТАВКА', category: 'financial', syntax: 'RATE(nper, pmt, pv, [fv], [type], [guess])',
      args: [ C.nper(), C.pmt(), C.pv(), C.fv(), C.type(), C.guess() ],
      desc: { tr: 'Dönem sayısı, taksit ve kredi tutarından dönem başına faiz oranını verir (yıllık oran için 12 ile çarpın).', ru: 'Возвращает процентную ставку за период по числу периодов, платежу и сумме кредита (для годовой ставки умножьте на 12).', en: 'Returns the interest rate per period from the number of periods, payment and loan amount (multiply by 12 for the annual rate).' },
      example: { formula: 'RATE(120,-2500,200000)*12', tr: 'Ayda 2.500 TL ile 120 ayda ödenen 200.000 TL kredinin yıllık faiz oranını verir', ru: 'Возвращает годовую ставку кредита 200 000, выплачиваемого по 2500 в месяц 120 месяцев', en: 'Returns the annual rate of a 200,000 loan repaid at 2,500 a month over 120 months' },
      keywords: { tr: ['faiz oranı hesapla', 'kredi faizi bul', 'taksitten faiz oranı', 'dönem faiz oranı'], ru: ['рассчитать ставку', 'найти процентную ставку', 'ставка по платежу', 'ставка за период'], en: ['interest rate', 'find loan rate'] } },

    { name: 'RECEIVED', tr: 'GETİRİ', ru: 'ПОЛУЧЕНО', category: 'financial', syntax: 'RECEIVED(settlement, maturity, investment, discount, [basis])',
      args: [ C.settlement(), C.maturity(), C.investment(), C.discount(), C.basis() ],
      desc: { tr: 'Tamamen yatırılmış bir menkul kıymetin vadede alınacak tutarını verir.', ru: 'Возвращает сумму, получаемую при погашении полностью инвестированной ценной бумаги.', en: 'Returns the amount received at maturity for a fully invested security.' },
      example: { formula: 'RECEIVED(DATE(2024,2,15),DATE(2024,5,15),1000000,0.0575)', tr: '%5,75 iskontoyla 1.000.000 TL yatırılan kâğıdın vadede ödeyeceği tutarı verir', ru: 'Возвращает сумму к получению при погашении для инвестиции 1 000 000 с дисконтом 5,75%', en: 'Returns the amount received at maturity on a 1,000,000 investment at a 5.75% discount' },
      keywords: { tr: ['vadede alınacak tutar', 'vade sonu getirisi', 'yatırımın vade değeri'], ru: ['сумма к получению при погашении', 'получено при погашении', 'стоимость при погашении'], en: ['amount received at maturity'] } },

    { name: 'RRI', tr: 'GERÇEKLEŞENYATIRIMGETİRİSİ', ru: 'ЭКВ.СТАВКА', category: 'financial', syntax: 'RRI(nper, pv, fv)', minVersion: '2013',
      args: [ A('nper', 'dönem_sayısı', 'кпер', false, 'Yatırımın dönem sayısı', 'Число периодов инвестиции', 'The number of periods of the investment'), A('pv', 'bd', 'пс', false, 'Yatırımın bugünkü değeri', 'Текущая стоимость инвестиции', 'The present value of the investment'), A('fv', 'gd', 'бс', false, 'Yatırımın gelecekteki değeri', 'Будущая стоимость инвестиции', 'The future value of the investment') ],
      desc: { tr: 'Bir yatırımın başlangıç ve bitiş değerinden dönem başına eşdeğer (bileşik yıllık büyüme, CAGR) faiz oranını verir.', ru: 'Возвращает эквивалентную ставку за период (среднегодовой темп роста, CAGR) по начальной и конечной стоимости инвестиции.', en: 'Returns the equivalent interest rate per period (compound annual growth rate, CAGR) from the start and end values of an investment.' },
      example: { formula: 'RRI(5,10000,16105)', tr: '10.000 TL’nin 5 yılda 16.105 TL olması için gereken yıllık büyüme oranını (%10) verir', ru: 'Возвращает годовой темп роста (10%), при котором 10 000 за 5 лет стали 16 105', en: 'Returns the annual growth rate (10%) that turns 10,000 into 16,105 over 5 years' },
      keywords: { tr: ['bileşik yıllık büyüme', 'cagr hesapla', 'yıllık ortalama getiri', 'eşdeğer faiz oranı'], ru: ['среднегодовой темп роста', 'cagr', 'эквивалентная ставка', 'средняя годовая доходность'], en: ['cagr', 'compound annual growth rate', 'equivalent rate'] } },

    { name: 'SLN', tr: 'DA', ru: 'АПЛ', category: 'financial', syntax: 'SLN(cost, salvage, life)',
      args: [ C.cost(), C.salvage(), C.life() ],
      desc: { tr: 'Bir varlığın doğrusal (eşit tutarlı) yöntemle bir dönemlik amortismanını verir: (maliyet - hurda) / ömür.', ru: 'Возвращает амортизацию актива за один период линейным методом: (стоимость - остаток) / срок.', en: 'Returns the straight-line depreciation of an asset for one period: (cost - salvage) / life.' },
      example: { formula: 'SLN(100000,10000,5)', tr: '100.000 TL’lik, 10.000 TL hurda değerli, 5 yıllık varlığın yıllık amortismanını (18.000) verir', ru: 'Возвращает годовую амортизацию (18 000) актива 100 000 с остатком 10 000 и сроком 5 лет', en: 'Returns the yearly depreciation (18,000) of a 100,000 asset with 10,000 salvage over 5 years' },
      keywords: { tr: ['doğrusal amortisman', 'eşit amortisman', 'yıllık amortisman', 'amortisman hesapla', 'normal amortisman'], ru: ['линейная амортизация', 'равномерная амортизация', 'годовая амортизация', 'рассчитать амортизацию', 'амортизация прямолинейно'], en: ['straight-line depreciation', 'linear depreciation'] } },

    { name: 'STOCKHISTORY', tr: 'HİSSESENEDİGEÇMİŞİ', ru: 'ИСТОРИЯАКЦИЙ', category: 'financial', syntax: 'STOCKHISTORY(stock, start_date, [end_date], [interval], [headers], [property0], ...)', minVersion: '365', uncertain: ['tr'],
      args: [ A('stock', 'hisse', 'акция', false, 'Hisse sembolü veya Hisse Senedi veri türü hücresi (ör. "MSFT" veya "XNAS:MSFT")', 'Тикер или ячейка с типом данных «Акции» (например, "MSFT" или "XNAS:MSFT")', 'Ticker symbol or Stocks data-type cell (e.g. "MSFT" or "XNAS:MSFT")'), C.startDate(), A('end_date', 'bitiş_tarihi', 'кон_дата', true, 'Bitiş tarihi (varsayılan başlangıç tarihi)', 'Конечная дата (по умолчанию равна начальной)', 'End date (defaults to the start date)'), A('interval', 'aralık', 'интервал', true, '0 günlük (varsayılan), 1 haftalık, 2 aylık', '0 — ежедневно (по умолчанию), 1 — еженедельно, 2 — ежемесячно', '0 daily (default), 1 weekly, 2 monthly'), A('headers', 'başlıklar', 'заголовки', true, '0 başlık yok, 1 başlık var (varsayılan), 2 araç adı ve başlıklar', '0 — без заголовков, 1 — с заголовками (по умолчанию), 2 — название инструмента и заголовки', '0 no headers, 1 headers (default), 2 instrument name and headers'), A('property0', 'özellik0', 'свойство0', true, 'Sütunlar: 0 tarih, 1 kapanış, 2 açılış, 3 en yüksek, 4 en düşük, 5 hacim (varsayılan 0 ve 1)', 'Столбцы: 0 — дата, 1 — закрытие, 2 — открытие, 3 — максимум, 4 — минимум, 5 — объём (по умолчанию 0 и 1)', 'Columns: 0 date, 1 close, 2 open, 3 high, 4 low, 5 volume (default 0 and 1)') ],
      desc: { tr: 'Bir hisse senedinin geçmiş fiyat verilerini (tarih, kapanış, açılış, en yüksek, en düşük, hacim) dizi olarak getirir; yalnızca Microsoft 365’te ve internet bağlantısıyla çalışır.', ru: 'Возвращает массив исторических данных по акции (дата, закрытие, открытие, максимум, минимум, объём); работает только в Microsoft 365 при подключении к интернету.', en: 'Returns an array of historical stock data (date, close, open, high, low, volume); works only in Microsoft 365 with an internet connection.' },
      example: { formula: 'STOCKHISTORY("MSFT",DATE(2024,1,1),DATE(2024,3,31),2)', tr: 'MSFT hissesinin 2024 ilk çeyrek aylık kapanış fiyatlarını getirir', ru: 'Возвращает месячные цены закрытия MSFT за 1-й квартал 2024 г.', en: 'Returns monthly closing prices of MSFT for Q1 2024' },
      keywords: { tr: ['hisse geçmişi', 'hisse fiyatı geçmiş', 'borsa verisi', 'kapanış fiyatları', 'hisse senedi tarihçesi'], ru: ['история акций', 'котировки акций', 'исторические цены', 'биржевые данные', 'цена закрытия'], en: ['stock history', 'historical stock prices', 'stock quotes'] } },

    { name: 'SYD', tr: 'YAT', ru: 'АСЧ', category: 'financial', syntax: 'SYD(cost, salvage, life, per)',
      args: [ C.cost(), C.salvage(), C.life(), A('per', 'dönem', 'период', false, 'Amortismanı hesaplanacak dönem (ömürle aynı birimde)', 'Период, для которого рассчитывается амортизация (в тех же единицах, что срок)', 'The period to calculate depreciation for (same units as life)') ],
      desc: { tr: 'Yıl rakamları toplamı (yıl sayıları toplamı) yöntemiyle varlığın belirtilen dönemdeki amortismanını verir.', ru: 'Возвращает амортизацию актива за период методом суммы годовых чисел.', en: 'Returns the sum-of-years’ digits depreciation of an asset for a specified period.' },
      example: { formula: 'SYD(100000,10000,5,1)', tr: '5 yıllık varlığın 1. yıl amortismanını yıl rakamları toplamı yöntemiyle (30.000) verir', ru: 'Возвращает амортизацию за 1-й год методом суммы чисел (30 000) для актива со сроком 5 лет', en: 'Returns year-one sum-of-years’ digits depreciation (30,000) of a 5-year asset' },
      keywords: { tr: ['yıl rakamları toplamı amortisman', 'yıl sayıları toplamı', 'azalan amortisman yöntemi'], ru: ['амортизация сумма чисел лет', 'метод суммы годовых чисел', 'кумулятивная амортизация'], en: ['sum of years digits depreciation'] } },

    { name: 'TBILLEQ', tr: 'HTAHEŞ', ru: 'РАВНОКЧЕК', category: 'financial', syntax: 'TBILLEQ(settlement, maturity, discount)',
      args: [ C.settlement(), C.maturity(), C.discount() ],
      desc: { tr: 'Bir hazine bonosunun tahvile eşdeğer getirisini verir.', ru: 'Возвращает эквивалентный облигационный доход по казначейскому векселю.', en: 'Returns the bond-equivalent yield for a Treasury bill.' },
      example: { formula: 'TBILLEQ(DATE(2024,3,31),DATE(2024,6,1),0.0914)', tr: '%9,14 iskontolu hazine bonosunun tahvil eşdeğer getirisini verir', ru: 'Возвращает эквивалентный облигационный доход векселя с дисконтом 9,14%', en: 'Returns the bond-equivalent yield of a T-bill at a 9.14% discount' },
      keywords: { tr: ['hazine bonosu eşdeğer getiri', 'bono tahvil eşdeğeri'], ru: ['эквивалентный доход казначейского векселя', 'доходность векселя эквивалент'], en: ['treasury bill bond equivalent yield'] } },

    { name: 'TBILLPRICE', tr: 'HTAHDEĞER', ru: 'ЦЕНАКЧЕК', category: 'financial', syntax: 'TBILLPRICE(settlement, maturity, discount)',
      args: [ C.settlement(), C.maturity(), C.discount() ],
      desc: { tr: 'Bir hazine bonosunun 100 nominal değer başına fiyatını verir.', ru: 'Возвращает цену за 100 номинала казначейского векселя.', en: 'Returns the price per 100 face value for a Treasury bill.' },
      example: { formula: 'TBILLPRICE(DATE(2024,3,31),DATE(2024,6,1),0.09)', tr: '%9 iskontolu hazine bonosunun fiyatını verir', ru: 'Возвращает цену казначейского векселя с дисконтом 9%', en: 'Returns the price of a T-bill at a 9% discount' },
      keywords: { tr: ['hazine bonosu fiyatı', 'bono fiyatı iskonto'], ru: ['цена казначейского векселя', 'цена векселя по дисконту'], en: ['treasury bill price'] } },

    { name: 'TBILLYIELD', tr: 'HTAHÖDEME', ru: 'ДОХОДКЧЕК', category: 'financial', syntax: 'TBILLYIELD(settlement, maturity, pr)',
      args: [ C.settlement(), C.maturity(), C.pr() ],
      desc: { tr: 'Fiyatı verilen bir hazine bonosunun getirisini verir.', ru: 'Возвращает доходность казначейского векселя по его цене.', en: 'Returns the yield for a Treasury bill given its price.' },
      example: { formula: 'TBILLYIELD(DATE(2024,3,31),DATE(2024,6,1),98.45)', tr: '98,45’ten alınan hazine bonosunun getirisini verir', ru: 'Возвращает доходность казначейского векселя, купленного за 98,45', en: 'Returns the yield of a T-bill bought at 98.45' },
      keywords: { tr: ['hazine bonosu getirisi', 'bono getirisi fiyattan'], ru: ['доходность казначейского векселя', 'доход векселя по цене'], en: ['treasury bill yield'] } },

    { name: 'VDB', tr: 'DAB', ru: 'ПУО', category: 'financial', syntax: 'VDB(cost, salvage, life, start_period, end_period, [factor], [no_switch])',
      args: [ C.cost(), C.salvage(), C.life(), A('start_period', 'başlangıç_dönemi', 'нач_период', false, 'Amortisman hesabının başladığı dönem (ömürle aynı birimde)', 'Начальный период расчёта (в тех же единицах, что срок)', 'The starting period of the calculation (same units as life)'), A('end_period', 'bitiş_dönemi', 'кон_период', false, 'Amortisman hesabının bittiği dönem', 'Конечный период расчёта', 'The ending period of the calculation'), A('factor', 'faktör', 'коэффициент', true, 'Bakiyenin azalma hızı (varsayılan 2)', 'Скорость уменьшения остатка (по умолчанию 2)', 'Rate at which the balance declines (default 2)'), A('no_switch', 'değiştirme', 'без_переключения', true, 'DOĞRU: azalan bakiye doğrusaldan küçük olsa bile doğrusala geçme; YANLIŞ veya boş: geç', 'ИСТИНА — не переходить на линейный метод; ЛОЖЬ или пусто — переходить', 'TRUE: never switch to straight-line; FALSE or omitted: switch when it is larger') ],
      desc: { tr: 'Çift azalan bakiye (veya belirtilen katsayı) yöntemiyle, kısmi dönemler dahil, belirtilen dönem aralığındaki amortismanı verir.', ru: 'Возвращает амортизацию за указанный интервал периодов (включая неполные) методом двойного уменьшения остатка или с заданным коэффициентом.', en: 'Returns the depreciation for any period range (including partial periods) using double-declining balance or a specified factor.' },
      example: { formula: 'VDB(100000,10000,5,0,1)', tr: '100.000 TL’lik varlığın ilk yıl (0-1 arası) değişken azalan amortismanını verir', ru: 'Возвращает амортизацию актива 100 000 за первый год (периоды 0-1)', en: 'Returns the first-year (period 0 to 1) depreciation of a 100,000 asset' },
      keywords: { tr: ['değişken azalan bakiye', 'kısmi dönem amortisman', 'dönem aralığı amortisman'], ru: ['переменное уменьшение остатка', 'амортизация неполный период', 'амортизация за интервал периодов'], en: ['variable declining balance', 'partial period depreciation'] } },

    { name: 'XIRR', tr: 'AİÇVERİMORANI', ru: 'ЧИСТВНДОХ', category: 'financial', syntax: 'XIRR(values, dates, [guess])',
      args: [ C.values(), C.dates(), C.guess() ],
      desc: { tr: 'Düzensiz tarihlerde gerçekleşen nakit akışlarının yıllık iç verim oranını verir (düzenli aralık gerekmez; ilk akış genelde negatif yatırımdır).', ru: 'Возвращает годовую внутреннюю ставку доходности для потоков с произвольными датами (первый поток обычно — отрицательная инвестиция).', en: 'Returns the annual internal rate of return for cash flows on irregular dates (the first flow is usually a negative investment).' },
      example: { formula: 'XIRR(B2:B10,A2:A10)', tr: 'A2:A10 tarihlerindeki B2:B10 nakit akışlarının yıllık iç verim oranını verir', ru: 'Возвращает годовую доходность потоков B2:B10 с датами в A2:A10', en: 'Returns the annual IRR of the cash flows in B2:B10 dated in A2:A10' },
      keywords: { tr: ['tarihli iç verim oranı', 'düzensiz nakit akışı getiri', 'xirr', 'yatırım getirisi tarihlerle', 'yıllık getiri hesapla'], ru: ['внутренняя доходность по датам', 'нерегулярные потоки доходность', 'xirr', 'доходность инвестиций с датами', 'годовая доходность портфеля'], en: ['xirr', 'irregular cash flow return', 'annualized return with dates'] } },

    { name: 'XNPV', tr: 'ANBD', ru: 'ЧИСТНЗ', category: 'financial', syntax: 'XNPV(rate, values, dates)',
      args: [ A('rate', 'oran', 'ставка', false, 'Nakit akışlarına uygulanacak yıllık iskonto oranı', 'Годовая ставка дисконтирования потоков', 'The annual discount rate applied to the cash flows'), C.values(), C.dates() ],
      desc: { tr: 'Düzensiz tarihlerdeki nakit akışlarının net bugünkü değerini verir (ilk akış iskonto edilmez).', ru: 'Возвращает чистую приведённую стоимость потоков с произвольными датами (первый поток не дисконтируется).', en: 'Returns the net present value of cash flows on irregular dates (the first flow is not discounted).' },
      example: { formula: 'XNPV(9%,B2:B10,A2:A10)', tr: '%9 iskontoyla A2:A10 tarihli B2:B10 akışlarının net bugünkü değerini verir', ru: 'Возвращает чистую приведённую стоимость потоков B2:B10 с датами A2:A10 при ставке 9%', en: 'Returns the NPV at 9% of the flows in B2:B10 dated in A2:A10' },
      keywords: { tr: ['tarihli net bugünkü değer', 'düzensiz nakit akışı bugünkü değer', 'xnpv'], ru: ['чистая приведённая стоимость по датам', 'нерегулярные потоки npv', 'xnpv'], en: ['xnpv', 'npv with dates'] } },

    { name: 'YIELD', tr: 'ÖDEME', ru: 'ДОХОД', category: 'financial', syntax: 'YIELD(settlement, maturity, rate, pr, redemption, frequency, [basis])',
      args: [ C.settlement(), C.maturity(), C.rate(), C.pr(), C.redemption(), C.frequency(), C.basis() ],
      desc: { tr: 'Dönemsel faiz ödeyen bir menkul kıymetin vadeye kadar getirisini verir.', ru: 'Возвращает доходность к погашению ценной бумаги с периодической выплатой процентов.', en: 'Returns the yield to maturity of a security that pays periodic interest.' },
      example: { formula: 'YIELD(DATE(2024,2,15),DATE(2030,11,15),0.0575,95.04,100,2)', tr: '95,04’ten alınan %5,75 kuponlu tahvilin getirisini verir', ru: 'Возвращает доходность облигации с купоном 5,75%, купленной за 95,04', en: 'Returns the yield of a 5.75% bond bought at 95.04' },
      keywords: { tr: ['tahvil getirisi', 'vadeye kadar getiri', 'menkul kıymet getirisi', 'bono getirisi'], ru: ['доходность облигации', 'доходность к погашению', 'доходность ценной бумаги', 'ytm'], en: ['bond yield', 'yield to maturity'] } },

    { name: 'YIELDDISC', tr: 'ÖDEMEİND', ru: 'ДОХОДСКИДКА', category: 'financial', syntax: 'YIELDDISC(settlement, maturity, pr, redemption, [basis])',
      args: [ C.settlement(), C.maturity(), C.pr(), C.redemption(), C.basis() ],
      desc: { tr: 'İskontolu (kuponsuz) bir menkul kıymetin yıllık getirisini verir.', ru: 'Возвращает годовую доходность дисконтной (бескупонной) ценной бумаги.', en: 'Returns the annual yield of a discounted (zero-coupon) security.' },
      example: { formula: 'YIELDDISC(DATE(2024,2,16),DATE(2024,3,1),99.795,100)', tr: '99,795’ten alınıp 100’den itfa edilen iskontolu kâğıdın getirisini verir', ru: 'Возвращает доходность дисконтной бумаги, купленной за 99,795 и погашаемой по 100', en: 'Returns the yield of a discounted note bought at 99.795 and redeemed at 100' },
      keywords: { tr: ['iskontolu getiri', 'kuponsuz tahvil getirisi', 'iskontolu bono getirisi'], ru: ['доходность дисконтной бумаги', 'доходность бескупонной облигации', 'доход по скидке'], en: ['discounted security yield', 'zero coupon yield'] } },

    { name: 'YIELDMAT', tr: 'ÖDEMEVADE', ru: 'ДОХОДПОГАШ', category: 'financial', syntax: 'YIELDMAT(settlement, maturity, issue, rate, pr, [basis])',
      args: [ C.settlement(), C.maturity(), C.issue(), C.rate(), C.pr(), C.basis() ],
      desc: { tr: 'Faizini vadede ödeyen bir menkul kıymetin yıllık getirisini verir.', ru: 'Возвращает годовую доходность ценной бумаги, проценты по которой выплачиваются при погашении.', en: 'Returns the annual yield of a security that pays interest at maturity.' },
      example: { formula: 'YIELDMAT(DATE(2024,3,15),DATE(2024,11,3),DATE(2023,11,8),0.0625,100.0123)', tr: 'Faizi vadede ödenen kâğıdın getirisini verir', ru: 'Возвращает доходность бумаги с выплатой процентов при погашении', en: 'Returns the yield of a note paying interest at maturity' },
      keywords: { tr: ['vadede faizli getiri', 'vade sonu faiz tahvil getirisi'], ru: ['доходность с процентами при погашении', 'доход при погашении'], en: ['yield interest at maturity'] } },

    /* ───────────────────────── INFORMATION ───────────────────────── */
    { name: 'CELL', tr: 'HÜCRE', ru: 'ЯЧЕЙКА', category: 'info', syntax: 'CELL(info_type, [reference])', volatile: true,
      args: [ A('info_type', 'bilgi_türü', 'тип_сведений', false, 'İstenen bilgi: "address", "col", "row", "contents", "filename", "format", "type", "width", "protect", "prefix", "color", "parentheses" (İngilizce yazılır)', 'Тип сведений: "address", "col", "row", "contents", "filename", "format", "type", "width", "protect", "prefix", "color", "parentheses" (пишется по-английски)', 'The information wanted: "address", "col", "row", "contents", "filename", "format", "type", "width", "protect", "prefix", "color", "parentheses"'), A('reference', 'başvuru', 'ссылка', true, 'Bilgisi alınacak hücre (boşsa son değiştirilen hücre)', 'Ячейка, о которой нужны сведения (если пусто — последняя изменённая ячейка)', 'The cell to get information about (omitted = the last changed cell)') ],
      desc: { tr: 'Bir hücrenin biçimi, konumu, içeriği veya dosya yolu gibi bilgilerini verir; CELL("filename") dosya adını ve sayfa adını almak için yaygın kullanılır.', ru: 'Возвращает сведения о формате, расположении или содержимом ячейки, а также путь к файлу; ЯЧЕЙКА("filename") часто используют для получения имени файла и листа.', en: 'Returns information about a cell’s format, location or contents, or the file path; CELL("filename") is commonly used to get the file and sheet name.' },
      example: { formula: 'CELL("filename",A1)', tr: 'Dosyanın tam yolunu, adını ve geçerli sayfa adını verir', ru: 'Возвращает полный путь к файлу, его имя и имя текущего листа', en: 'Returns the full path, file name and current sheet name' },
      keywords: { tr: ['hücre bilgisi', 'dosya adı formülle', 'sayfa adını al', 'hücre adresi', 'hücre biçimi'], ru: ['сведения о ячейке', 'имя файла формулой', 'имя листа', 'адрес ячейки', 'формат ячейки'], en: ['cell info', 'file name formula', 'sheet name'] } },

    { name: 'ERROR.TYPE', tr: 'HATA.TİPİ', ru: 'ТИП.ОШИБКИ', category: 'info', syntax: 'ERROR.TYPE(error_val)',
      args: [ A('error_val', 'hata_değeri', 'значение_ошибки', false, 'Hata değeri veya hata içeren hücre', 'Значение ошибки или ячейка с ошибкой', 'The error value or a cell containing an error') ],
      desc: { tr: 'Hata türünü sayı olarak verir: 1 #BOŞ!, 2 #SAYI/0!, 3 #DEĞER!, 4 #BAŞV!, 5 #AD?, 6 #SAYI!, 7 #YOK, 8 #VERİ_ALINIYOR, 14 #DÖKÜLME!; hata yoksa #YOK.', ru: 'Возвращает номер типа ошибки: 1 #ПУСТО!, 2 #ДЕЛ/0!, 3 #ЗНАЧ!, 4 #ССЫЛКА!, 5 #ИМЯ?, 6 #ЧИСЛО!, 7 #Н/Д, 8 #ПОЛУЧЕНИЕ_ДАННЫХ, 14 #ПЕРЕНОС!; если ошибки нет — #Н/Д.', en: 'Returns a number for the error type: 1 #NULL!, 2 #DIV/0!, 3 #VALUE!, 4 #REF!, 5 #NAME?, 6 #NUM!, 7 #N/A, 8 #GETTING_DATA, 14 #SPILL!; #N/A when there is no error.' },
      example: { formula: 'IF(ISERROR(A2),ERROR.TYPE(A2),"OK")', tr: 'A2 hatalıysa hata numarasını, değilse "OK" yazar', ru: 'Если в A2 ошибка — выводит её номер, иначе "OK"', en: 'Shows the error number if A2 is an error, otherwise "OK"' },
      keywords: { tr: ['hata türü', 'hata numarası', 'hangi hata', 'hata kodu'], ru: ['тип ошибки', 'номер ошибки', 'какая ошибка', 'код ошибки'], en: ['error type', 'error number'] } },

    { name: 'INFO', tr: 'BİLGİ', ru: 'ИНФОРМ', category: 'info', syntax: 'INFO(type_text)', volatile: true,
      args: [ A('type_text', 'tür_metni', 'тип_информации', false, 'İstenen bilgi: "directory", "numfile", "origin", "osversion", "recalc", "release", "system" (İngilizce yazılır)', 'Тип сведений: "directory", "numfile", "origin", "osversion", "recalc", "release", "system" (пишется по-английски)', 'The information wanted: "directory", "numfile", "origin", "osversion", "recalc", "release", "system"') ],
      desc: { tr: 'Çalışma ortamı hakkında bilgi verir: geçerli klasör, Excel sürümü, işletim sistemi, hesaplama modu vb.', ru: 'Возвращает сведения о рабочей среде: текущая папка, версия Excel, операционная система, режим пересчёта и т. д.', en: 'Returns information about the operating environment: current directory, Excel version, operating system, calculation mode, etc.' },
      example: { formula: 'INFO("release")', tr: 'Kullanılan Excel sürüm numarasını verir', ru: 'Возвращает номер версии Excel', en: 'Returns the Excel version number' },
      keywords: { tr: ['excel sürümü', 'sistem bilgisi', 'işletim sistemi', 'geçerli klasör'], ru: ['версия excel', 'сведения о системе', 'операционная система', 'текущая папка'], en: ['excel version', 'system info'] } },

    { name: 'ISBLANK', tr: 'EBOŞSA', ru: 'ЕПУСТО', category: 'info', syntax: 'ISBLANK(value)',
      args: [ C.value() ],
      desc: { tr: 'Hücre tamamen boşsa DOĞRU, aksi halde YANLIŞ verir (boş metin "" döndüren formüller boş sayılmaz; onlar için A2="" kullanın).', ru: 'Возвращает ИСТИНА, если ячейка совершенно пуста, иначе ЛОЖЬ (формула, возвращающая "", пустой не считается; для неё используйте A2="").', en: 'Returns TRUE if the cell is completely empty, otherwise FALSE (a formula returning "" does not count as blank; use A2="" for that).' },
      example: { formula: 'IF(ISBLANK(A2),"Eksik","Tamam")', tr: 'A2 boşsa "Eksik", doluysa "Tamam" yazar', ru: 'Если A2 пусто — "Eksik", иначе "Tamam"', en: 'Shows "Eksik" if A2 is empty, otherwise "Tamam"' },
      keywords: { tr: ['boş mu', 'hücre boşsa', 'boş hücre kontrolü', 'boş olanlar', 'dolu mu'], ru: ['пустая ли ячейка', 'если пусто', 'проверка на пустоту', 'пустые ячейки', 'заполнена ли'], en: ['is blank', 'is empty', 'check empty cell'] } },

    { name: 'ISERR', tr: 'EHATA', ru: 'ЕОШ', category: 'info', syntax: 'ISERR(value)',
      args: [ C.value() ],
      desc: { tr: 'Değer #YOK dışında bir hataysa DOĞRU verir (#YOK dahil tüm hatalar için ISERROR).', ru: 'Возвращает ИСТИНА, если значение — любая ошибка, кроме #Н/Д (для всех ошибок, включая #Н/Д, — ЕОШИБКА).', en: 'Returns TRUE if the value is any error except #N/A (use ISERROR to include #N/A).' },
      example: { formula: 'ISERR(A2/B2)', tr: 'Bölme #SAYI/0! verirse DOĞRU, #YOK verirse YANLIŞ döner', ru: 'ИСТИНА при #ДЕЛ/0!, но ЛОЖЬ при #Н/Д', en: 'TRUE when the division gives #DIV/0!, but FALSE for #N/A' },
      keywords: { tr: ['hata mı yok hariç', 'hata kontrolü', 'yok hatası hariç hata'], ru: ['ошибка кроме нд', 'проверка на ошибку', 'ошибка без н/д'], en: ['is error except n/a'] } },

    { name: 'ISERROR', tr: 'EHATALIYSA', ru: 'ЕОШИБКА', category: 'info', syntax: 'ISERROR(value)',
      args: [ C.value() ],
      desc: { tr: 'Değer herhangi bir hataysa (#YOK, #DEĞER!, #BAŞV!, #SAYI/0!, #SAYI!, #AD?, #BOŞ!) DOĞRU verir; hatayı başka değerle değiştirmek için IFERROR daha kısadır.', ru: 'Возвращает ИСТИНА, если значение — любая ошибка (#Н/Д, #ЗНАЧ!, #ССЫЛКА!, #ДЕЛ/0!, #ЧИСЛО!, #ИМЯ?, #ПУСТО!); чтобы заменить ошибку, короче использовать ЕСЛИОШИБКА.', en: 'Returns TRUE if the value is any error (#N/A, #VALUE!, #REF!, #DIV/0!, #NUM!, #NAME?, #NULL!); to replace an error, IFERROR is shorter.' },
      example: { formula: 'IF(ISERROR(VLOOKUP(A2,Ürünler!$A$2:$C$50,3,FALSE)),"Bulunamadı",VLOOKUP(A2,Ürünler!$A$2:$C$50,3,FALSE))', tr: 'Arama hata verirse "Bulunamadı", vermezse bulunan değeri gösterir', ru: 'Если поиск выдаёт ошибку — "Bulunamadı", иначе найденное значение', en: 'Shows "Bulunamadı" if the lookup fails, otherwise the found value' },
      keywords: { tr: ['hata mı', 'hata kontrolü', 'hatalı hücre', 'hata varsa', 'hata sayısı'], ru: ['ошибка ли', 'проверка на ошибку', 'если ошибка', 'ячейка с ошибкой', 'количество ошибок'], en: ['is error', 'check for error', 'count errors'] } },

    { name: 'ISEVEN', tr: 'ÇİFTMİ', ru: 'ЕЧЁТН', category: 'info', syntax: 'ISEVEN(number)',
      args: [ A('number', 'sayı', 'число', false, 'Sınanacak sayı (ondalık kısmı atılır)', 'Проверяемое число (дробная часть отбрасывается)', 'The number to test (the fraction is truncated)') ],
      desc: { tr: 'Sayı çiftse DOĞRU, tekse YANLIŞ verir; sayı olmayan değerde #DEĞER! döner.', ru: 'Возвращает ИСТИНА для чётного числа и ЛОЖЬ для нечётного; для нечислового значения — #ЗНАЧ!.', en: 'Returns TRUE if the number is even and FALSE if odd; a non-number gives #VALUE!.' },
      example: { formula: 'ISEVEN(ROW())', tr: 'Satır numarası çiftse DOĞRU verir (satır şeritleme için kullanışlı)', ru: 'ИСТИНА, если номер строки чётный (удобно для чередования строк)', en: 'TRUE when the row number is even (handy for banded rows)' },
      keywords: { tr: ['çift mi', 'çift sayı kontrolü', 'çift satırlar', 'tek çift'], ru: ['чётное ли', 'проверка чётности', 'чётные строки', 'чёт нечет'], en: ['is even', 'even number check'] } },

    { name: 'ISFORMULA', tr: 'EFORMÜLSE', ru: 'ЕФОРМУЛА', category: 'info', syntax: 'ISFORMULA(reference)', minVersion: '2013',
      args: [ A('reference', 'başvuru', 'ссылка', false, 'Sınanacak hücre başvurusu', 'Ссылка на проверяемую ячейку', 'The cell reference to test') ],
      desc: { tr: 'Hücrede formül varsa DOĞRU, sabit değer varsa YANLIŞ verir; formül içeren hücreleri koşullu biçimlendirmeyle işaretlemek için kullanılır.', ru: 'Возвращает ИСТИНА, если в ячейке формула, и ЛОЖЬ, если константа; используется для выделения ячеек с формулами условным форматированием.', en: 'Returns TRUE if the cell contains a formula and FALSE if it holds a constant; used to highlight formula cells with conditional formatting.' },
      example: { formula: 'ISFORMULA(E2)', tr: 'E2 bir formül içeriyorsa DOĞRU verir', ru: 'ИСТИНА, если в E2 записана формула', en: 'TRUE if E2 contains a formula' },
      keywords: { tr: ['formül mü', 'formül var mı', 'formül içeren hücreler', 'formül kontrolü'], ru: ['формула ли', 'есть ли формула', 'ячейки с формулами', 'проверка на формулу'], en: ['is formula', 'contains formula'] } },

    { name: 'ISLOGICAL', tr: 'EMANTIKSALSA', ru: 'ЕЛОГИЧ', category: 'info', syntax: 'ISLOGICAL(value)',
      args: [ C.value() ],
      desc: { tr: 'Değer mantıksal (DOĞRU veya YANLIŞ) ise DOĞRU verir.', ru: 'Возвращает ИСТИНА, если значение логическое (ИСТИНА или ЛОЖЬ).', en: 'Returns TRUE if the value is a logical value (TRUE or FALSE).' },
      example: { formula: 'ISLOGICAL(A2)', tr: 'A2 DOĞRU/YANLIŞ içeriyorsa DOĞRU verir', ru: 'ИСТИНА, если в A2 стоит ИСТИНА или ЛОЖЬ', en: 'TRUE if A2 holds TRUE or FALSE' },
      keywords: { tr: ['mantıksal mı', 'doğru yanlış mı', 'boolean kontrolü'], ru: ['логическое ли значение', 'истина или ложь', 'проверка булева'], en: ['is logical', 'is boolean'] } },

    { name: 'ISNA', tr: 'EYOKSA', ru: 'ЕНД', category: 'info', syntax: 'ISNA(value)',
      args: [ C.value() ],
      desc: { tr: 'Değer #YOK hatasıysa DOĞRU verir; arama sonuç bulamadığında kullanılır (kısa yol: IFNA).', ru: 'Возвращает ИСТИНА, если значение — ошибка #Н/Д; применяется, когда поиск ничего не нашёл (короче — ЕСНД).', en: 'Returns TRUE if the value is the #N/A error; used when a lookup finds nothing (shortcut: IFNA).' },
      example: { formula: 'IF(ISNA(MATCH(A2,Ürünler!$A$2:$A$50,0)),"Yok","Var")', tr: 'A2 ürün listesinde yoksa "Yok", varsa "Var" yazar', ru: 'Если A2 нет в списке товаров — "Yok", иначе "Var"', en: 'Shows "Yok" if A2 is not in the product list, otherwise "Var"' },
      keywords: { tr: ['yok hatası mı', 'bulunamadı kontrolü', 'listede var mı', 'n/a kontrolü'], ru: ['ошибка нд', 'проверка не найдено', 'есть ли в списке', 'н/д проверка'], en: ['is n/a', 'not found check'] } },

    { name: 'ISNONTEXT', tr: 'EMETİNDEĞİLSE', ru: 'ЕНЕТЕКСТ', category: 'info', syntax: 'ISNONTEXT(value)',
      args: [ C.value() ],
      desc: { tr: 'Değer metin değilse (sayı, tarih, mantıksal, hata veya boş hücre) DOĞRU verir.', ru: 'Возвращает ИСТИНА, если значение не текст (число, дата, логическое, ошибка или пустая ячейка).', en: 'Returns TRUE if the value is not text (a number, date, logical, error or empty cell).' },
      example: { formula: 'ISNONTEXT(A2)', tr: 'A2 metin içermiyorsa DOĞRU verir', ru: 'ИСТИНА, если в A2 не текст', en: 'TRUE if A2 does not contain text' },
      keywords: { tr: ['metin değil mi', 'metin olmayan', 'metin dışı kontrol'], ru: ['не текст ли', 'не текстовое значение', 'проверка не текст'], en: ['is not text', 'non-text'] } },

    { name: 'ISNUMBER', tr: 'ESAYIYSA', ru: 'ЕЧИСЛО', category: 'info', syntax: 'ISNUMBER(value)',
      args: [ C.value() ],
      desc: { tr: 'Değer sayı (tarih ve saat dahil) ise DOĞRU verir; ISNUMBER(SEARCH(...)) ile "metin içeriyor mu" kontrolü yapılır.', ru: 'Возвращает ИСТИНА, если значение — число (включая даты и время); ЕЧИСЛО(ПОИСК(...)) проверяет, содержит ли ячейка текст.', en: 'Returns TRUE if the value is a number (dates and times included); ISNUMBER(SEARCH(...)) tests whether a cell contains some text.' },
      example: { formula: 'ISNUMBER(SEARCH("gıda",B2))', tr: 'B2 "gıda" kelimesini içeriyorsa DOĞRU verir (büyük/küçük harf duyarsız)', ru: 'ИСТИНА, если B2 содержит "gıda" (без учёта регистра)', en: 'TRUE if B2 contains "gıda" (case-insensitive)' },
      keywords: { tr: ['sayı mı', 'sayı kontrolü', 'içeriyor mu', 'metin içeriyorsa', 'sayısal mı'], ru: ['число ли', 'проверка на число', 'содержит ли текст', 'если содержит', 'числовое ли значение'], en: ['is number', 'contains text check', 'numeric check'] } },

    { name: 'ISODD', tr: 'TEKMİ', ru: 'ЕНЕЧЁТ', category: 'info', syntax: 'ISODD(number)',
      args: [ A('number', 'sayı', 'число', false, 'Sınanacak sayı (ondalık kısmı atılır)', 'Проверяемое число (дробная часть отбрасывается)', 'The number to test (the fraction is truncated)') ],
      desc: { tr: 'Sayı tekse DOĞRU, çiftse YANLIŞ verir; sayı olmayan değerde #DEĞER! döner.', ru: 'Возвращает ИСТИНА для нечётного числа и ЛОЖЬ для чётного; для нечислового значения — #ЗНАЧ!.', en: 'Returns TRUE if the number is odd and FALSE if even; a non-number gives #VALUE!.' },
      example: { formula: 'ISODD(C2)', tr: 'C2’deki adet tekse DOĞRU verir', ru: 'ИСТИНА, если количество в C2 нечётное', en: 'TRUE if the quantity in C2 is odd' },
      keywords: { tr: ['tek mi', 'tek sayı kontrolü', 'tek satırlar', 'tek çift'], ru: ['нечётное ли', 'проверка нечётности', 'нечётные строки', 'нечет'], en: ['is odd', 'odd number check'] } },

    { name: 'ISREF', tr: 'EREFSE', ru: 'ЕССЫЛКА', category: 'info', syntax: 'ISREF(value)',
      args: [ C.value() ],
      desc: { tr: 'Değer geçerli bir hücre başvurusuysa DOĞRU verir; genellikle INDIRECT ile sayfa veya aralık adının var olup olmadığını sınamak için kullanılır.', ru: 'Возвращает ИСТИНА, если значение — допустимая ссылка; обычно применяется с ДВССЫЛ для проверки существования листа или имени диапазона.', en: 'Returns TRUE if the value is a valid reference; typically used with INDIRECT to test whether a sheet or range name exists.' },
      example: { formula: 'ISREF(INDIRECT("\'" & A2 & "\'!A1"))', tr: 'A2’de yazan adda bir sayfa varsa DOĞRU verir', ru: 'ИСТИНА, если лист с именем из A2 существует', en: 'TRUE if a sheet named as in A2 exists' },
      keywords: { tr: ['başvuru mu', 'sayfa var mı', 'geçerli referans kontrolü', 'aralık var mı'], ru: ['ссылка ли', 'существует ли лист', 'проверка ссылки', 'есть ли диапазон'], en: ['is reference', 'sheet exists check'] } },

    { name: 'ISTEXT', tr: 'EMETİNSE', ru: 'ЕТЕКСТ', category: 'info', syntax: 'ISTEXT(value)',
      args: [ C.value() ],
      desc: { tr: 'Değer metin ise DOĞRU verir; metin olarak saklanan sayıları bulmak için kullanışlıdır.', ru: 'Возвращает ИСТИНА, если значение — текст; удобно для поиска чисел, сохранённых как текст.', en: 'Returns TRUE if the value is text; useful for finding numbers stored as text.' },
      example: { formula: 'ISTEXT(E2)', tr: 'E2 metin olarak saklanmışsa DOĞRU verir (sayı yerine metin)', ru: 'ИСТИНА, если E2 хранится как текст (а не число)', en: 'TRUE if E2 is stored as text instead of a number' },
      keywords: { tr: ['metin mi', 'metin kontrolü', 'metin olarak saklanan sayı', 'yazı mı'], ru: ['текст ли', 'проверка на текст', 'число сохранено как текст', 'текстовое значение'], en: ['is text', 'text check', 'number stored as text'] } },

    { name: 'N', tr: 'N', ru: 'Ч', category: 'info', syntax: 'N(value)',
      args: [ C.value() ],
      desc: { tr: 'Değeri sayıya çevirir: sayı ve tarih olduğu gibi, DOĞRU 1, YANLIŞ 0, metin 0 olur; formül içine not düşmek için N("açıklama") kullanılır.', ru: 'Преобразует значение в число: число и дата остаются, ИСТИНА → 1, ЛОЖЬ → 0, текст → 0; Ч("комментарий") используют для заметок внутри формулы.', en: 'Converts a value to a number: numbers and dates unchanged, TRUE → 1, FALSE → 0, text → 0; N("note") is used to add comments inside a formula.' },
      example: { formula: 'SUM(E2:E200)+N("KDV hariç toplam")', tr: 'Toplamı hesaplar; N(...) kısmı sadece açıklama olup 0 ekler', ru: 'Считает сумму; часть Ч(...) — лишь комментарий, добавляющий 0', en: 'Computes the total; the N(...) part is only a note that adds 0' },
      keywords: { tr: ['sayıya çevir', 'formüle not ekle', 'metni sıfır yap', 'mantıksalı sayıya çevir'], ru: ['преобразовать в число', 'комментарий в формуле', 'текст в ноль', 'логическое в число'], en: ['to number', 'formula comment'] } },

    { name: 'NA', tr: 'YOKSAY', ru: 'НД', category: 'info', syntax: 'NA()',
      args: [],
      desc: { tr: '#YOK hata değerini verir; grafiklerde boş noktaları atlatmak veya eksik veriyi işaretlemek için kullanılır.', ru: 'Возвращает значение ошибки #Н/Д; используется, чтобы пропускать точки на диаграммах или помечать отсутствующие данные.', en: 'Returns the #N/A error value; used to skip points in charts or mark missing data.' },
      example: { formula: 'IF(E2="",NA(),E2)', tr: 'E2 boşsa grafikte boşluk oluşturan #YOK, doluysa değeri verir', ru: 'Если E2 пусто — #Н/Д (пропуск на графике), иначе значение', en: 'Gives #N/A (a gap in charts) when E2 is empty, otherwise the value' },
      keywords: { tr: ['yok hatası üret', 'eksik veri işareti', 'grafikte boşluk', '#yok döndür'], ru: ['вернуть нд', 'ошибка н/д', 'пропуск в графике', 'отсутствующие данные'], en: ['return n/a', 'missing data marker'] } },

    { name: 'SHEET', tr: 'SAYFA', ru: 'ЛИСТ', category: 'info', syntax: 'SHEET([value])', minVersion: '2013',
      args: [ A('value', 'değer', 'значение', true, 'Sayfa adı veya o sayfadaki bir başvuru (boşsa formülün bulunduğu sayfa)', 'Имя листа или ссылка на нём (если пусто — лист с формулой)', 'A sheet name or a reference on that sheet (omitted = the sheet holding the formula)') ],
      desc: { tr: 'Başvurulan sayfanın (varsayılan: formülün bulunduğu sayfanın) çalışma kitabındaki sıra numarasını verir.', ru: 'Возвращает порядковый номер листа (по умолчанию — листа с формулой) в книге.', en: 'Returns the index number of the referenced sheet (by default the sheet holding the formula) within the workbook.' },
      example: { formula: 'SHEET()', tr: 'Geçerli sayfanın sıra numarasını verir', ru: 'Возвращает номер текущего листа', en: 'Returns the number of the current sheet' },
      keywords: { tr: ['sayfa numarası', 'kaçıncı sayfa', 'sayfa sırası', 'sayfa indeksi'], ru: ['номер листа', 'какой по счёту лист', 'индекс листа', 'порядковый номер листа'], en: ['sheet number', 'sheet index'] } },

    { name: 'SHEETS', tr: 'SAYFALAR', ru: 'ЛИСТЫ', category: 'info', syntax: 'SHEETS([reference])', minVersion: '2013',
      args: [ A('reference', 'başvuru', 'ссылка', true, 'Sayfa sayısı alınacak başvuru (boşsa çalışma kitabındaki tüm sayfalar)', 'Ссылка, для которой нужно число листов (если пусто — все листы книги)', 'A reference to count sheets in (omitted = all sheets in the workbook)') ],
      desc: { tr: 'Çalışma kitabındaki (veya 3B başvurudaki) sayfa sayısını verir; gizli sayfalar da sayılır.', ru: 'Возвращает количество листов в книге (или в трёхмерной ссылке), включая скрытые.', en: 'Returns the number of sheets in the workbook (or in a 3-D reference), hidden sheets included.' },
      example: { formula: 'SHEETS()', tr: 'Çalışma kitabındaki toplam sayfa sayısını verir', ru: 'Возвращает общее число листов в книге', en: 'Returns the total number of sheets in the workbook' },
      keywords: { tr: ['sayfa sayısı', 'kaç sayfa var', 'toplam sayfa', 'çalışma sayfası sayısı'], ru: ['количество листов', 'сколько листов', 'число листов в книге', 'всего листов'], en: ['number of sheets', 'sheet count'] } },

    { name: 'TYPE', tr: 'TÜR', ru: 'ТИП', category: 'info', syntax: 'TYPE(value)',
      args: [ C.value() ],
      desc: { tr: 'Değerin türünü sayı olarak verir: 1 sayı, 2 metin, 4 mantıksal, 16 hata, 64 dizi, 128 bileşik veri.', ru: 'Возвращает тип значения числом: 1 — число, 2 — текст, 4 — логическое, 16 — ошибка, 64 — массив, 128 — составные данные.', en: 'Returns the type of a value as a number: 1 number, 2 text, 4 logical, 16 error, 64 array, 128 compound data.' },
      example: { formula: 'TYPE(A2)', tr: 'A2 metin içeriyorsa 2, sayı içeriyorsa 1 verir', ru: 'Возвращает 2 для текста в A2 и 1 для числа', en: 'Returns 2 if A2 holds text and 1 if it holds a number' },
      keywords: { tr: ['veri türü', 'hücre türü', 'değer tipi', 'tür numarası'], ru: ['тип данных', 'тип значения', 'тип ячейки', 'номер типа'], en: ['data type', 'value type'] } },

    /* ───────────────────────── DATABASE ─────────────────────────
     * All D-functions share: database (range incl. headers), field (header text / number / cell), criteria (header + condition rows). */
    { name: 'DAVERAGE', tr: 'VSEÇORT', ru: 'ДСРЗНАЧ', category: 'database', syntax: 'DAVERAGE(database, field, criteria)',
      args: [ C.database(), C.field(), C.criteria() ],
      desc: { tr: 'Veritabanında ölçüt aralığındaki koşullara uyan kayıtların belirtilen sütunundaki değerlerin ortalamasını verir (AVERAGEIFS’in ölçüt tablolu karşılığı).', ru: 'Возвращает среднее значений в указанном столбце базы данных для записей, удовлетворяющих условиям из диапазона критериев (аналог СРЗНАЧЕСЛИМН с таблицей условий).', en: 'Returns the average of the values in a database column for the records that match the criteria range (the criteria-table counterpart of AVERAGEIFS).' },
      example: { formula: 'DAVERAGE(A1:E200,"Tutar",G1:G2)', tr: 'G1:G2 ölçütüne (ör. Kategori = Gıda) uyan satırların Tutar ortalamasını verir', ru: 'Возвращает средний Tutar по строкам, удовлетворяющим условию в G1:G2 (например, Kategori = Gıda)', en: 'Averages Tutar for rows matching the criteria in G1:G2 (e.g. Kategori = Gıda)' },
      keywords: { tr: ['veritabanı ortalama', 'ölçüt tablosuyla ortalama', 'koşullu ortalama veritabanı', 'kayıt ortalaması'], ru: ['среднее по базе данных', 'среднее по критериям таблицы', 'условное среднее бд', 'среднее записей'], en: ['database average', 'average with criteria table'] } },

    { name: 'DCOUNT', tr: 'VSEÇSAY', ru: 'БСЧЁТ', category: 'database', syntax: 'DCOUNT(database, [field], criteria)',
      args: [ C.database(), A('field', 'alan', 'поле', true, 'Sayılacak sütun (boşsa koşula uyan tüm kayıtlar sayılır)', 'Столбец для подсчёта (если пусто — считаются все записи, подходящие под условие)', 'The column to count (omitted = count all matching records)'), C.criteria() ],
      desc: { tr: 'Veritabanında ölçütlere uyan kayıtların belirtilen sütunundaki sayı içeren hücreleri sayar.', ru: 'Подсчитывает ячейки с числами в указанном столбце базы данных среди записей, удовлетворяющих условиям.', en: 'Counts the cells containing numbers in a database column for the records that match the criteria.' },
      example: { formula: 'DCOUNT(A1:E200,"Tutar",G1:G2)', tr: 'Ölçüte uyan satırlarda sayısal Tutar bulunan kayıtları sayar', ru: 'Считает записи с числовым Tutar среди строк, подходящих под условие', en: 'Counts matching rows that have a numeric Tutar' },
      keywords: { tr: ['veritabanı say', 'ölçüt tablosuyla say', 'koşullu sayım veritabanı', 'kayıt sayısı'], ru: ['счёт по базе данных', 'подсчёт по критериям таблицы', 'условный подсчёт бд', 'число записей'], en: ['database count', 'count with criteria table'] } },

    { name: 'DCOUNTA', tr: 'VSEÇSAYDOLU', ru: 'БСЧЁТА', category: 'database', syntax: 'DCOUNTA(database, [field], criteria)',
      args: [ C.database(), A('field', 'alan', 'поле', true, 'Sayılacak sütun (boşsa koşula uyan tüm kayıtlar sayılır)', 'Столбец для подсчёта (если пусто — считаются все записи, подходящие под условие)', 'The column to count (omitted = count all matching records)'), C.criteria() ],
      desc: { tr: 'Veritabanında ölçütlere uyan kayıtların belirtilen sütunundaki boş olmayan hücreleri (metin dahil) sayar.', ru: 'Подсчитывает непустые ячейки (включая текст) в указанном столбце базы данных среди записей, удовлетворяющих условиям.', en: 'Counts the non-empty cells (text included) in a database column for the records that match the criteria.' },
      example: { formula: 'DCOUNTA(A1:E200,"Ürün",G1:G2)', tr: 'Ölçüte uyan ve Ürün hücresi dolu olan kayıtları sayar', ru: 'Считает подходящие записи с заполненной ячейкой Ürün', en: 'Counts matching records whose Ürün cell is filled' },
      keywords: { tr: ['veritabanı dolu say', 'ölçütle dolu hücre say', 'boş olmayan kayıt sayısı'], ru: ['счёт непустых по базе', 'подсчёт непустых по критериям', 'число заполненных записей'], en: ['database counta', 'count non-empty with criteria'] } },

    { name: 'DGET', tr: 'VAL', ru: 'БИЗВЛЕЧЬ', category: 'database', syntax: 'DGET(database, field, criteria)',
      args: [ C.database(), C.field(), C.criteria() ],
      desc: { tr: 'Veritabanında ölçütlere uyan tek kaydın belirtilen sütunundaki değeri getirir; eşleşme yoksa #DEĞER!, birden fazlaysa #SAYI! verir.', ru: 'Извлекает значение из столбца единственной записи базы данных, удовлетворяющей условиям; если совпадений нет — #ЗНАЧ!, если больше одного — #ЧИСЛО!.', en: 'Extracts the value from a column of the single database record matching the criteria; #VALUE! when none match, #NUM! when more than one does.' },
      example: { formula: 'DGET(A1:E200,"Tutar",G1:G2)', tr: 'Ölçüte uyan tek satırın Tutar değerini getirir', ru: 'Возвращает Tutar единственной строки, подходящей под условие', en: 'Returns Tutar of the single row matching the criteria' },
      keywords: { tr: ['veritabanından değer al', 'ölçütle tek kayıt getir', 'tek eşleşen değer', 'kayıt bul'], ru: ['извлечь из базы данных', 'получить единственную запись', 'найти запись по критериям', 'значение одной записи'], en: ['database get', 'extract single record'] } },

    { name: 'DMAX', tr: 'VSEÇMAK', ru: 'ДМАКС', category: 'database', syntax: 'DMAX(database, field, criteria)',
      args: [ C.database(), C.field(), C.criteria() ],
      desc: { tr: 'Veritabanında ölçütlere uyan kayıtların belirtilen sütunundaki en büyük değeri verir (MAXIFS’in ölçüt tablolu karşılığı).', ru: 'Возвращает наибольшее значение в столбце базы данных среди записей, удовлетворяющих условиям (аналог МАКСЕСЛИ с таблицей условий).', en: 'Returns the largest value in a database column for the records that match the criteria (the criteria-table counterpart of MAXIFS).' },
      example: { formula: 'DMAX(A1:E200,"Tutar",G1:G2)', tr: 'Ölçüte uyan satırlar içindeki en yüksek Tutar değerini verir', ru: 'Возвращает наибольший Tutar среди подходящих строк', en: 'Returns the highest Tutar among matching rows' },
      keywords: { tr: ['veritabanı en büyük', 'ölçütle maksimum', 'koşullu en büyük veritabanı', 'en yüksek kayıt'], ru: ['максимум по базе данных', 'максимум по критериям таблицы', 'условный максимум бд', 'наибольшая запись'], en: ['database max', 'max with criteria table'] } },

    { name: 'DMIN', tr: 'VSEÇMİN', ru: 'ДМИН', category: 'database', syntax: 'DMIN(database, field, criteria)',
      args: [ C.database(), C.field(), C.criteria() ],
      desc: { tr: 'Veritabanında ölçütlere uyan kayıtların belirtilen sütunundaki en küçük değeri verir (MINIFS’in ölçüt tablolu karşılığı).', ru: 'Возвращает наименьшее значение в столбце базы данных среди записей, удовлетворяющих условиям (аналог МИНЕСЛИ с таблицей условий).', en: 'Returns the smallest value in a database column for the records that match the criteria (the criteria-table counterpart of MINIFS).' },
      example: { formula: 'DMIN(A1:E200,"Tutar",G1:G2)', tr: 'Ölçüte uyan satırlar içindeki en düşük Tutar değerini verir', ru: 'Возвращает наименьший Tutar среди подходящих строк', en: 'Returns the lowest Tutar among matching rows' },
      keywords: { tr: ['veritabanı en küçük', 'ölçütle minimum', 'koşullu en küçük veritabanı', 'en düşük kayıt'], ru: ['минимум по базе данных', 'минимум по критериям таблицы', 'условный минимум бд', 'наименьшая запись'], en: ['database min', 'min with criteria table'] } },

    { name: 'DPRODUCT', tr: 'VSEÇÇARP', ru: 'БДПРОИЗВЕД', category: 'database', syntax: 'DPRODUCT(database, field, criteria)',
      args: [ C.database(), C.field(), C.criteria() ],
      desc: { tr: 'Veritabanında ölçütlere uyan kayıtların belirtilen sütunundaki değerleri birbiriyle çarpar.', ru: 'Перемножает значения в столбце базы данных для записей, удовлетворяющих условиям.', en: 'Multiplies the values in a database column for the records that match the criteria.' },
      example: { formula: 'DPRODUCT(A1:E200,"Katsayı",G1:G2)', tr: 'Ölçüte uyan satırların Katsayı değerlerinin çarpımını verir', ru: 'Возвращает произведение значений Katsayı по подходящим строкам', en: 'Returns the product of Katsayı values for matching rows' },
      keywords: { tr: ['veritabanı çarpım', 'ölçütle çarp', 'koşullu çarpım'], ru: ['произведение по базе данных', 'произведение по критериям', 'условное произведение'], en: ['database product', 'product with criteria'] } },

    { name: 'DSTDEV', tr: 'VSEÇSTDSAPMA', ru: 'ДСТАНДОТКЛ', category: 'database', syntax: 'DSTDEV(database, field, criteria)',
      args: [ C.database(), C.field(), C.criteria() ],
      desc: { tr: 'Veritabanında ölçütlere uyan kayıtların belirtilen sütunundaki değerleri örneklem kabul ederek standart sapmayı verir.', ru: 'Оценивает стандартное отклонение по выборке из значений столбца базы данных для записей, удовлетворяющих условиям.', en: 'Estimates the standard deviation based on a sample from the values in a database column for the matching records.' },
      example: { formula: 'DSTDEV(A1:E200,"Tutar",G1:G2)', tr: 'Ölçüte uyan satırların Tutar değerlerinin örneklem standart sapmasını verir', ru: 'Возвращает выборочное стандартное отклонение Tutar по подходящим строкам', en: 'Returns the sample standard deviation of Tutar for matching rows' },
      keywords: { tr: ['veritabanı standart sapma', 'ölçütle standart sapma', 'örneklem sapması koşullu'], ru: ['стандартное отклонение по базе', 'отклонение по критериям', 'выборочное отклонение условие'], en: ['database stdev', 'standard deviation with criteria'] } },

    { name: 'DSTDEVP', tr: 'VSEÇSTDSAPMAS', ru: 'ДСТАНДОТКЛП', category: 'database', syntax: 'DSTDEVP(database, field, criteria)',
      args: [ C.database(), C.field(), C.criteria() ],
      desc: { tr: 'Veritabanında ölçütlere uyan kayıtların belirtilen sütunundaki değerleri tüm popülasyon kabul ederek standart sapmayı verir.', ru: 'Вычисляет стандартное отклонение по генеральной совокупности из значений столбца базы данных для записей, удовлетворяющих условиям.', en: 'Calculates the standard deviation based on the entire population from the values in a database column for the matching records.' },
      example: { formula: 'DSTDEVP(A1:E200,"Tutar",G1:G2)', tr: 'Ölçüte uyan satırların Tutar değerlerinin popülasyon standart sapmasını verir', ru: 'Возвращает стандартное отклонение по совокупности для Tutar подходящих строк', en: 'Returns the population standard deviation of Tutar for matching rows' },
      keywords: { tr: ['veritabanı popülasyon sapması', 'ölçütle popülasyon standart sapma'], ru: ['отклонение по совокупности база', 'стандартное отклонение генеральной совокупности критерии'], en: ['database stdevp', 'population standard deviation with criteria'] } },

    { name: 'DSUM', tr: 'VSEÇTOPLA', ru: 'БДСУММ', category: 'database', syntax: 'DSUM(database, field, criteria)',
      args: [ C.database(), C.field(), C.criteria() ],
      desc: { tr: 'Veritabanında ölçüt aralığındaki koşullara uyan kayıtların belirtilen sütunundaki değerleri toplar (SUMIFS’in ölçüt tablolu karşılığı; VEYA koşulları için ölçüt satırları alt alta yazılır).', ru: 'Суммирует значения в столбце базы данных для записей, удовлетворяющих условиям диапазона критериев (аналог СУММЕСЛИМН с таблицей условий; условия «ИЛИ» записываются в разных строках).', en: 'Sums the values in a database column for the records that match the criteria range (the criteria-table counterpart of SUMIFS; OR conditions go on separate criteria rows).' },
      example: { formula: 'DSUM(A1:E200,"Tutar",G1:H2)', tr: 'G1:H2’deki koşullara (ör. Kategori = Gıda ve Şehir = Ankara) uyan satırların Tutar toplamını verir', ru: 'Суммирует Tutar по строкам, удовлетворяющим условиям G1:H2 (например, Kategori = Gıda и Şehir = Ankara)', en: 'Sums Tutar for rows matching the conditions in G1:H2 (e.g. Kategori = Gıda and Şehir = Ankara)' },
      keywords: { tr: ['veritabanı toplam', 'ölçüt tablosuyla topla', 'koşullu toplam veritabanı', 'kayıt toplamı', 'çok koşullu toplam tablo'], ru: ['сумма по базе данных', 'сумма по критериям таблицы', 'условная сумма бд', 'сумма записей', 'сумма с таблицей условий'], en: ['database sum', 'sum with criteria table'] } },

    { name: 'DVAR', tr: 'VSEÇVAR', ru: 'БДДИСП', category: 'database', syntax: 'DVAR(database, field, criteria)',
      args: [ C.database(), C.field(), C.criteria() ],
      desc: { tr: 'Veritabanında ölçütlere uyan kayıtların belirtilen sütunundaki değerleri örneklem kabul ederek varyansı verir.', ru: 'Оценивает дисперсию по выборке из значений столбца базы данных для записей, удовлетворяющих условиям.', en: 'Estimates the variance based on a sample from the values in a database column for the matching records.' },
      example: { formula: 'DVAR(A1:E200,"Tutar",G1:G2)', tr: 'Ölçüte uyan satırların Tutar değerlerinin örneklem varyansını verir', ru: 'Возвращает выборочную дисперсию Tutar по подходящим строкам', en: 'Returns the sample variance of Tutar for matching rows' },
      keywords: { tr: ['veritabanı varyans', 'ölçütle varyans', 'örneklem varyansı koşullu'], ru: ['дисперсия по базе данных', 'дисперсия по критериям', 'выборочная дисперсия условие'], en: ['database variance', 'variance with criteria'] } },

    { name: 'DVARP', tr: 'VSEÇVARS', ru: 'БДДИСПП', category: 'database', syntax: 'DVARP(database, field, criteria)',
      args: [ C.database(), C.field(), C.criteria() ],
      desc: { tr: 'Veritabanında ölçütlere uyan kayıtların belirtilen sütunundaki değerleri tüm popülasyon kabul ederek varyansı verir.', ru: 'Вычисляет дисперсию по генеральной совокупности из значений столбца базы данных для записей, удовлетворяющих условиям.', en: 'Calculates the variance based on the entire population from the values in a database column for the matching records.' },
      example: { formula: 'DVARP(A1:E200,"Tutar",G1:G2)', tr: 'Ölçüte uyan satırların Tutar değerlerinin popülasyon varyansını verir', ru: 'Возвращает дисперсию по совокупности для Tutar подходящих строк', en: 'Returns the population variance of Tutar for matching rows' },
      keywords: { tr: ['veritabanı popülasyon varyansı', 'ölçütle popülasyon varyans'], ru: ['дисперсия по совокупности база', 'дисперсия генеральной совокупности критерии'], en: ['database varp', 'population variance with criteria'] } }
  ];

  EFS.catalogParts.dateFinInfoDb = list;
  return list;
});
