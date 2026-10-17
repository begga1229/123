/* Shared test contexts (same shape as EFS.workbook SheetModel.toContext()). Do not edit: tests and intents rely on it. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EFS_TEST_CONTEXTS = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  function col(name, letter, index, type, firstRow, lastRow, sample) {
    return { name: name, col: letter, index: index, type: type, dataRange: letter + firstRow + ':' + letter + lastRow, range: letter + (firstRow - 1) + ':' + letter + lastRow, sample: sample || [] };
  }
  var tr = {
    sheetName: 'Satışlar', sheets: ['Satışlar', 'Ürünler'], headerRow: 1, firstDataRow: 2, lastRow: 200, activeCell: null,
    headers: [
      col('Ürün', 'A', 1, 'text', 2, 200, ['Kalem', 'Defter']),
      col('Kategori', 'B', 2, 'text', 2, 200, ['Kırtasiye', 'Gıda']),
      col('Adet', 'C', 3, 'number', 2, 200, [12, 5]),
      col('Birim Fiyat', 'D', 4, 'number', 2, 200, [4.5, 12]),
      col('Tutar', 'E', 5, 'number', 2, 200, [54, 60]),
      col('Tarih', 'F', 6, 'date', 2, 200, ['2024-01-05', '2024-02-11']),
      col('Satış Temsilcisi', 'G', 7, 'text', 2, 200, ['Ayşe', 'Mehmet']),
      col('Şehir', 'H', 8, 'text', 2, 200, ['İstanbul', 'Ankara']),
      col('Durum', 'I', 9, 'text', 2, 200, ['Ödendi', 'Bekliyor']),
      col('İndirim', 'J', 10, 'number', 2, 200, [0.1, 0]),
      col('Doğum Tarihi', 'K', 11, 'date', 2, 200, ['1990-05-01']),
      col('E-posta', 'L', 12, 'text', 2, 200, ['ayse@ornek.com']),
      col('Ad Soyad', 'M', 13, 'text', 2, 200, ['Ayşe Yılmaz'])
    ],
    otherSheets: {
      'Ürünler': { headerRow: 1, firstDataRow: 2, lastRow: 50, headers: [
        col('Ürün Kodu', 'A', 1, 'text', 2, 50, ['P001']),
        col('Ürün Adı', 'B', 2, 'text', 2, 50, ['Kalem']),
        col('Fiyat', 'C', 3, 'number', 2, 50, [4.5])
      ] }
    }
  };
  var ru = {
    sheetName: 'Продажи', sheets: ['Продажи', 'Товары'], headerRow: 1, firstDataRow: 2, lastRow: 200, activeCell: null,
    headers: [
      col('Товар', 'A', 1, 'text', 2, 200, ['Ручка', 'Тетрадь']),
      col('Категория', 'B', 2, 'text', 2, 200, ['Канцелярия', 'Еда']),
      col('Кол-во', 'C', 3, 'number', 2, 200, [12, 5]),
      col('Цена', 'D', 4, 'number', 2, 200, [4.5, 12]),
      col('Сумма', 'E', 5, 'number', 2, 200, [54, 60]),
      col('Дата', 'F', 6, 'date', 2, 200, ['2024-01-05']),
      col('Менеджер', 'G', 7, 'text', 2, 200, ['Анна', 'Иван']),
      col('Город', 'H', 8, 'text', 2, 200, ['Москва', 'Казань']),
      col('Статус', 'I', 9, 'text', 2, 200, ['Оплачено', 'Ожидает']),
      col('Скидка', 'J', 10, 'number', 2, 200, [0.1, 0]),
      col('Дата рождения', 'K', 11, 'date', 2, 200, ['1990-05-01']),
      col('Email', 'L', 12, 'text', 2, 200, ['anna@primer.ru']),
      col('ФИО', 'M', 13, 'text', 2, 200, ['Иванова Анна Петровна'])
    ],
    otherSheets: {
      'Товары': { headerRow: 1, firstDataRow: 2, lastRow: 50, headers: [
        col('Код товара', 'A', 1, 'text', 2, 50, ['P001']),
        col('Наименование', 'B', 2, 'text', 2, 50, ['Ручка']),
        col('Цена', 'C', 3, 'number', 2, 50, [4.5])
      ] }
    }
  };
  var en = {
    sheetName: 'Sales', sheets: ['Sales', 'Products'], headerRow: 1, firstDataRow: 2, lastRow: 200, activeCell: null,
    headers: [
      col('Product', 'A', 1, 'text', 2, 200), col('Category', 'B', 2, 'text', 2, 200), col('Quantity', 'C', 3, 'number', 2, 200),
      col('Unit Price', 'D', 4, 'number', 2, 200), col('Amount', 'E', 5, 'number', 2, 200), col('Date', 'F', 6, 'date', 2, 200),
      col('Sales Rep', 'G', 7, 'text', 2, 200), col('City', 'H', 8, 'text', 2, 200), col('Status', 'I', 9, 'text', 2, 200),
      col('Discount', 'J', 10, 'number', 2, 200), col('Birth Date', 'K', 11, 'date', 2, 200), col('Email', 'L', 12, 'text', 2, 200), col('Full Name', 'M', 13, 'text', 2, 200)
    ],
    otherSheets: { 'Products': { headerRow: 1, firstDataRow: 2, lastRow: 50, headers: [ col('Product Code', 'A', 1, 'text', 2, 50), col('Product Name', 'B', 2, 'text', 2, 50), col('Price', 'C', 3, 'number', 2, 50) ] } }
  };
  return { tr: tr, ru: ru, en: en, none: null };
});
