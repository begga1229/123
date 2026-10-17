#!/usr/bin/env node
/* Formula Studio — creates the sample workbooks used by tests and the Playwright smoke test.
 *
 *   node tests/fixtures/make-samples.js            → writes sample-tr.xlsx, sample-ru.xlsx, sample-title-block.xlsx next to this file
 *
 * ExcelJS is required from process.env.EFS_NODE_MODULES (scratch node_modules used only for tests/fixtures);
 * it is never a runtime dependency of the app. */
'use strict';

var path = require('path');
var fs = require('fs');

var MODULES = process.env.EFS_NODE_MODULES || '/tmp/claude-0/-home-user/3c06d0af-2468-5bff-b340-5bb3f4f5cc1d/scratchpad/vendor/node_modules';
var ExcelJS;
try { ExcelJS = require(MODULES + '/exceljs'); }
catch (e) { try { ExcelJS = require('exceljs'); } catch (e2) { console.error('ExcelJS not found. Set EFS_NODE_MODULES to a node_modules folder that contains exceljs.'); process.exit(1); } }

var OUT_DIR = __dirname;

/* ------------------------------------------------------------------ */
/* Deterministic pseudo-random generator so the files are reproducible */
/* ------------------------------------------------------------------ */
function rng(seed) {
  var s = seed >>> 0;
  return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function pick(rand, arr) { return arr[Math.floor(rand() * arr.length)]; }
function between(rand, a, b) { return a + Math.floor(rand() * (b - a + 1)); }
function utc(y, m, d) { return new Date(Date.UTC(y, m - 1, d)); }
function addDays(date, n) { return new Date(date.getTime() + n * 86400000); }
function round2(v) { return Math.round(v * 100) / 100; }

var FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };
var HEADER_FONT = { bold: true, color: { argb: 'FF1F3A2A' } };
var BORDER = { bottom: { style: 'thin', color: { argb: 'FF8FB89A' } } };

function styleHeader(ws, rowNumber, count) {
  var row = ws.getRow(rowNumber);
  for (var c = 1; c <= count; c++) {
    var cell = row.getCell(c);
    cell.font = HEADER_FONT; cell.fill = FILL; cell.border = BORDER;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  }
  row.height = 22;
}

/* ------------------------------------------------------------------ */
/* Data sets                                                           */
/* ------------------------------------------------------------------ */
var TR = {
  sheet: 'Satışlar', products: 'Ürünler',
  headers: ['Ürün', 'Kategori', 'Adet', 'Birim Fiyat', 'Tutar', 'Tarih', 'Satış Temsilcisi', 'Şehir', 'Durum', 'İndirim', 'Doğum Tarihi', 'E-posta', 'Ad Soyad'],
  productHeaders: ['Ürün Kodu', 'Ürün Adı', 'Fiyat'],
  catalog: [
    ['P001', 'Kalem', 'Kırtasiye', 4.5], ['P002', 'Defter', 'Kırtasiye', 12], ['P003', 'Silgi', 'Kırtasiye', 3.25],
    ['P004', 'Cetvel', 'Kırtasiye', 7.9], ['P005', 'Makas', 'Ofis', 28.5], ['P006', 'Zımba', 'Ofis', 64],
    ['P007', 'Dosya', 'Ofis', 9.75], ['P008', 'Klasör', 'Ofis', 38], ['P009', 'Kalemtıraş', 'Kırtasiye', 5.5],
    ['P010', 'Yapıştırıcı', 'Kırtasiye', 14.25], ['P011', 'Çay', 'Gıda', 85], ['P012', 'Kahve', 'Gıda', 190]
  ],
  cities: ['İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya'],
  status: ['Ödendi', 'Ödendi', 'Bekliyor', 'İptal'],
  people: [
    ['Ayşe', 'Yılmaz'], ['Mehmet', 'Kaya'], ['Zeynep', 'Demir'], ['Can', 'Şahin'], ['Elif', 'Çelik'],
    ['Burak', 'Öztürk'], ['Selin', 'Aydın'], ['Emre', 'Arslan']
  ],
  emailDomain: 'ornek.com',
  fold: function (s) {
    return s.toLowerCase().replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/i̇/g, 'i');
  }
};

var RU = {
  sheet: 'Продажи', products: 'Товары',
  headers: ['Товар', 'Категория', 'Кол-во', 'Цена', 'Сумма', 'Дата', 'Менеджер', 'Город', 'Статус', 'Скидка', 'Дата рождения', 'Email', 'ФИО'],
  productHeaders: ['Код товара', 'Наименование', 'Цена'],
  catalog: [
    ['P001', 'Ручка', 'Канцелярия', 4.5], ['P002', 'Тетрадь', 'Канцелярия', 12], ['P003', 'Ластик', 'Канцелярия', 3.25],
    ['P004', 'Линейка', 'Канцелярия', 7.9], ['P005', 'Ножницы', 'Офис', 28.5], ['P006', 'Степлер', 'Офис', 64],
    ['P007', 'Папка', 'Офис', 9.75], ['P008', 'Скоросшиватель', 'Офис', 38], ['P009', 'Точилка', 'Канцелярия', 5.5],
    ['P010', 'Клей', 'Канцелярия', 14.25], ['P011', 'Чай', 'Еда', 85], ['P012', 'Кофе', 'Еда', 190]
  ],
  cities: ['Москва', 'Казань', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург'],
  status: ['Оплачено', 'Оплачено', 'Ожидает', 'Отменено'],
  people: [
    ['Анна', 'Иванова', 'Петровна'], ['Иван', 'Смирнов', 'Сергеевич'], ['Ольга', 'Кузнецова', 'Андреевна'], ['Дмитрий', 'Попов', 'Алексеевич'],
    ['Елена', 'Соколова', 'Викторовна'], ['Сергей', 'Лебедев', 'Николаевич'], ['Мария', 'Козлова', 'Игоревна'], ['Алексей', 'Новиков', 'Дмитриевич']
  ],
  emailDomain: 'primer.ru',
  translit: { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' },
  fold: function (s) {
    var t = RU.translit; return s.toLowerCase().split('').map(function (ch) { return t.hasOwnProperty(ch) ? t[ch] : ch; }).join('');
  }
};

/* ------------------------------------------------------------------ */
/* Sales workbook (TR / RU)                                            */
/* ------------------------------------------------------------------ */
function buildSales(L, seed) {
  var rand = rng(seed);
  var wb = new ExcelJS.Workbook();
  wb.creator = 'Formula Studio';
  wb.created = utc(2024, 1, 1);

  var ws = wb.addWorksheet(L.sheet, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.addRow(L.headers);
  styleHeader(ws, 1, L.headers.length);

  var start = utc(2024, 1, 3);
  for (var i = 0; i < 40; i++) {
    var r = i + 2;
    var item = L.catalog[Math.floor(rand() * L.catalog.length)];
    var qty = between(rand, 1, 25);
    var unit = item[3];
    var date = addDays(start, Math.floor(i * 8.5) + between(rand, 0, 3));
    var person = pick(rand, L.people);
    var city = pick(rand, L.cities);
    var status = pick(rand, L.status);
    var discount = pick(rand, [0, 0, 0.05, 0.1, 0.15]);
    var birth = utc(between(rand, 1975, 1999), between(rand, 1, 12), between(rand, 1, 28));
    var fullName = person.length === 3 ? person[1] + ' ' + person[0] + ' ' + person[2] : person[0] + ' ' + person[1];
    var email = L.fold(person[0]) + '.' + L.fold(person[1]) + '@' + L.emailDomain;
    var row = ws.getRow(r);
    row.getCell(1).value = item[1];
    row.getCell(2).value = item[2];
    row.getCell(3).value = qty;
    row.getCell(4).value = unit;
    row.getCell(5).value = { formula: 'C' + r + '*D' + r, result: round2(qty * unit) };
    row.getCell(6).value = date;
    row.getCell(7).value = person[0];
    row.getCell(8).value = city;
    row.getCell(9).value = status;
    row.getCell(10).value = discount;
    row.getCell(11).value = birth;
    row.getCell(12).value = email;
    row.getCell(13).value = fullName;
    row.commit();
  }
  var widths = [16, 14, 8, 12, 12, 12, 18, 16, 12, 10, 14, 26, 24];
  widths.forEach(function (w, idx) { ws.getColumn(idx + 1).width = w; });
  ws.getColumn(4).numFmt = '#,##0.00';
  ws.getColumn(5).numFmt = '#,##0.00';
  ws.getColumn(6).numFmt = 'dd.mm.yyyy';
  ws.getColumn(10).numFmt = '0%';
  ws.getColumn(11).numFmt = 'dd.mm.yyyy';
  ws.getColumn(3).alignment = { horizontal: 'right' };
  ws.autoFilter = { from: 'A1', to: L.headers[12] ? 'M1' : 'M1' };

  var wp = wb.addWorksheet(L.products, { views: [{ state: 'frozen', ySplit: 1 }] });
  wp.addRow(L.productHeaders);
  styleHeader(wp, 1, 3);
  L.catalog.forEach(function (item, idx) {
    var row = wp.getRow(idx + 2);
    row.getCell(1).value = item[0];
    row.getCell(2).value = item[1];
    row.getCell(3).value = item[3];
    row.commit();
  });
  wp.getColumn(1).width = 12; wp.getColumn(2).width = 20; wp.getColumn(3).width = 10;
  wp.getColumn(3).numFmt = '#,##0.00';
  return wb;
}

/* ------------------------------------------------------------------ */
/* Title-block workbook (header detection test)                        */
/* ------------------------------------------------------------------ */
function buildTitleBlock(seed) {
  var rand = rng(seed);
  var wb = new ExcelJS.Workbook();
  wb.creator = 'Formula Studio';
  var ws = wb.addWorksheet('Ведомость');
  var headers = ['№', 'Наименование работ', 'Ед. изм', 'Кол-во', 'Цена', 'Стоимость', 'Примечание'];

  ws.mergeCells('A1:G1');
  ws.getCell('A1').value = 'Детализированная ведомость объёмов и стоимости работ';
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getCell('A1').alignment = { horizontal: 'center' };
  ws.getCell('A2').value = 'Площадка:'; ws.getCell('B2').value = 'Обогатительная фабрика, корпус 3';
  ws.getCell('A3').value = 'Шифр КВ:'; ws.getCell('B3').value = '26.01.02.105';
  ws.getCell('A4').value = 'Объект:'; ws.getCell('B4').value = 'Монтаж электрооборудования и освещения';
  ws.getCell('A5').value = 'Дата составления:'; ws.getCell('B5').value = utc(2025, 3, 14); ws.getCell('B5').numFmt = 'dd.mm.yyyy';
  ['A2', 'A3', 'A4', 'A5'].forEach(function (a) { ws.getCell(a).font = { bold: true }; });

  ws.getRow(7).values = headers;
  styleHeader(ws, 7, headers.length);

  var works = [
    ['Монтаж щитов электрических', 'шт', 450, 1200],
    ['Прокладка кабеля ВВГнг 3x2,5', 'м', 18.5, 32],
    ['Прокладка кабеля ВВГнг 5x6', 'м', 41, 48.6],
    ['Установка светильников светодиодных', 'шт', 310, 975],
    ['Монтаж кабельного лотка 200 мм', 'м', 265, 540],
    ['Монтаж розеток двойных', 'шт', 95, 140],
    ['Монтаж выключателей', 'шт', 88, 120],
    ['Установка автоматов защиты', 'шт', 210, 350],
    ['Заземление оборудования', 'точка', 180, 460],
    ['Пусконаладочные работы', 'компл.', 12500, 1],
    ['Монтаж трансформатора 10/0,4 кВ', 'шт', 185000, 2],
    ['Устройство кабельных проходок', 'шт', 740, 36],
    ['Прокладка гофротрубы 20 мм', 'м', 9.8, 1200],
    ['Монтаж датчиков движения', 'шт', 1150, 44],
    ['Испытание кабельных линий', 'линия', 2300, 28]
  ];
  var notes = ['', '', 'по РД', 'замена материала', '', 'уточнить объём', '', 'акт скрытых работ', ''];
  for (var i = 0; i < 30; i++) {
    var r = 8 + i;
    var w = works[i % works.length];
    var qty = i < works.length ? w[3] : Math.round(w[3] * (0.6 + rand() * 0.9));
    var price = i < works.length ? w[2] : round2(w[2] * (0.9 + rand() * 0.25));
    var row = ws.getRow(r);
    row.getCell(1).value = i + 1;
    row.getCell(2).value = w[0] + (i >= works.length ? ' (этап 2)' : '');
    row.getCell(3).value = w[1];
    row.getCell(4).value = qty;
    row.getCell(5).value = price;
    row.getCell(6).value = { formula: 'D' + r + '*E' + r, result: round2(qty * price) };
    row.getCell(7).value = pick(rand, notes);
    row.commit();
  }
  ws.getRow(38).getCell(5).value = 'Итого:';
  ws.getRow(38).getCell(5).font = { bold: true };
  ws.getRow(38).getCell(6).value = { formula: 'SUM(F8:F37)' };
  ws.getRow(38).getCell(6).font = { bold: true };
  ws.getColumn(1).width = 6; ws.getColumn(2).width = 42; ws.getColumn(3).width = 10;
  ws.getColumn(4).width = 10; ws.getColumn(5).width = 14; ws.getColumn(6).width = 16; ws.getColumn(7).width = 22;
  ws.getColumn(5).numFmt = '#,##0.00'; ws.getColumn(6).numFmt = '#,##0.00';
  return wb;
}

/* ------------------------------------------------------------------ */
/* Write files                                                         */
/* ------------------------------------------------------------------ */
function writeAll() {
  var jobs = [
    { name: 'sample-tr.xlsx', wb: buildSales(TR, 20240101) },
    { name: 'sample-ru.xlsx', wb: buildSales(RU, 20240202) },
    { name: 'sample-title-block.xlsx', wb: buildTitleBlock(20240303) }
  ];
  return jobs.reduce(function (p, job) {
    return p.then(function () {
      var file = path.join(OUT_DIR, job.name);
      return job.wb.xlsx.writeFile(file).then(function () {
        var size = fs.statSync(file).size;
        console.log('wrote ' + file + ' (' + size + ' bytes)');
      });
    });
  }, Promise.resolve());
}

if (require.main === module) {
  writeAll().catch(function (err) { console.error(err); process.exit(1); });
}

module.exports = { buildSales: buildSales, buildTitleBlock: buildTitleBlock, writeAll: writeAll, TR: TR, RU: RU };
