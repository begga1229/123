# Formula Studio — Çevrimdışı Excel Formül Asistanı · Офлайн-ассистент формул Excel · Offline Excel Formula Assistant

**TR** · İsteğinizi Türkçe (veya Rusça) yazın, Excel formülünü hazır alın, adım adım açıklamasını okuyun ve isterseniz yüklediğiniz Excel dosyasına doğrudan uygulayıp indirin. İnternet gerekmez.
**RU** · Опишите задачу по-русски (или по-турецки), получите готовую формулу Excel с пошаговым объяснением и при желании вставьте её прямо в загруженный файл. Интернет не нужен.
**EN** · Describe what you need in Turkish or Russian, get the Excel formula with a step-by-step explanation, and apply it to your uploaded workbook. Works fully offline.

---

## Hızlı başlangıç · Быстрый старт · Quick start

1. Bu klasörü indirin (ZIP) veya `git clone` yapın. · Скачайте папку (ZIP) или сделайте `git clone`. · Download the folder (ZIP) or `git clone` it.
2. `index.html` dosyasına çift tıklayın (Windows'ta `start.bat`, macOS/Linux'ta `start.sh` de kullanılabilir). · Дважды щёлкните `index.html` (или `start.bat` / `start.sh`). · Double-click `index.html` (or run `start.bat` / `start.sh`).
3. Hepsi bu. Sunucu, kurulum ve internet gerekmez; tüm kütüphaneler `assets/js/vendor/` içinde yerel olarak gelir. · Всё. Сервер, установка и интернет не нужны — все библиотеки лежат локально в `assets/js/vendor/`. · That's it. No server, no install, no internet — every library is vendored locally.

İsteğe bağlı masaüstü penceresi (Electron): `npm i -D electron && npm start`. · Необязательное окно Electron: `npm i -D electron && npm start`. · Optional Electron window: `npm i -D electron && npm start`.

## Neler yapar · Что умеет · What it does

| | TR | RU | EN |
|---|---|---|---|
| Doğal dil → formül | "Kategori Gıda olanların Tutarını topla" → `=ETOPLA(B2:B200;"Gıda";E2:E200)` | «Сумма по столбцу Сумма, где Категория равна Еда» → `=СУММЕСЛИ(B2:B200;"Еда";E2:E200)` | Natural language in TR/RU/EN → formula |
| Üç Excel lehçesi | Türkçe Excel adları ve `;` ayırıcı | Русские имена функций и `;` | English names and `,` |
| Excel yükleme | .xlsx .xlsm .xls .csv .ods — başlık satırı otomatik bulunur, sütun adlarıyla konuşabilirsiniz | заголовки находятся автоматически, можно ссылаться на столбцы по названию | header row auto-detected; refer to columns by name |
| Dosyaya uygulama | Formülü tek hücreye veya tüm sütuna yazar, biçimlendirmeyi koruyarak indirir | вставляет формулу в ячейку или на весь столбец, сохраняя форматирование | writes to a cell or fills a column, keeps styles |
| Açıklama | Her formülün adım adım açıklaması, kullanılan fonksiyonlar ve ipuçları | пошаговое объяснение, функции и подсказки | step-by-step explanation, functions used, tips |
| Formül açıkla / çevir | Mevcut bir formülü yapıştırın: açıklama + EN/TR/RU çevirisi | вставьте любую формулу: объяснение + перевод EN/TR/RU | paste any formula: explanation + translation |
| Fonksiyon kütüphanesi | 480+ Excel fonksiyonu, üç dilde ad, söz dizimi, açıklama, örnek | 480+ функций Excel на трёх языках | 480+ functions, three languages |
| Önizleme | Yüklenen veriyle formülün sonucunu dosyaya yazmadan görün | результат формулы на ваших данных до записи | preview results on your data before applying |
| Çevrimdışı | Hiçbir veri bilgisayarınızdan çıkmaz | данные не покидают компьютер | nothing leaves your computer |

## Örnek istekler · Примеры запросов · Example prompts

- `Tutar sütununu topla` · `Посчитай сумму по столбцу Сумма`
- `Kategori "Gıda" ve Şehir "Ankara" olanların tutarını topla` · `Сумма где Категория "Еда" и Город "Казань"`
- `E2 100'den büyükse "Yüksek" yaz değilse "Düşük"` · `Если E2 больше 100 то "Высокий" иначе "Низкий"`
- `Ürün kodunu Ürünler sayfasında ara ve Fiyat getir` · `Найди код товара на листе Товары и верни Цену`
- `Doğum tarihinden yaş hesapla` · `Посчитай возраст по дате рождения`
- `E-postadan @ öncesini al` · `Возьми часть email до @`
- `Tutarın toplam içindeki payı` · `Доля суммы от общего итога`
- `=ÇOKETOPLA(E2:E200;B2:B200;"Gıda") bu formülü açıkla` · `=СУММЕСЛИМН(E2:E200;B2:B200;"Еда") объясни`

## Proje yapısı · Структура · Structure

```
index.html                 uygulama / приложение / the app (open directly)
assets/css/app.css         tasarım / стили
assets/js/vendor/          SheetJS, ExcelJS, hot-formula-parser (yerel kopyalar / локальные копии)
assets/js/catalog/         fonksiyon kataloğu / каталог функций (EN·TR·RU)
assets/js/nlp/             dil işleme: normalize, lexicon, parser, intents
assets/js/engine/          AST, lehçe çevirisi, formül okuyucu, açıklama, üretim
assets/js/workbook/        Excel okuma/yazma, önizleme hesaplayıcı
assets/js/ui/              arayüz
tests/                     node tests/run.js  ·  node tests/smoke.js (Playwright)
docs/ARCHITECTURE.md       modül sözleşmeleri ve formül kuralları
```

## Geliştirme · Разработка · Development

```bash
node tests/run.js            # formül üretim testleri (TR/RU/EN) + lehçe çevirisi
node tests/run.js --verbose
node tests/fixtures/make-samples.js   # örnek Excel dosyaları (EFS_NODE_MODULES=<path with exceljs>)
node tests/smoke.js          # tarayıcı duman testi (Playwright + Chromium)
```

Tarayıcı desteği: güncel Chrome, Edge, Firefox, Safari. Excel desteği: formüller Excel 2010+ ile uyumlu olacak şekilde üretilir; XLOOKUP / FILTER / UNIQUE gibi fonksiyonlar "Excel 2021/365 gerektirir" etiketiyle işaretlenir, "Klasik" stil seçildiğinde eski sürümlerle uyumlu karşılıkları kullanılır.

Lisanslar: SheetJS (Apache-2.0), ExcelJS (MIT), hot-formula-parser (MIT) — bkz. `assets/js/vendor/LICENSE-*.txt`.
