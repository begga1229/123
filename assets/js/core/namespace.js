/* Formula Studio — shared namespace and tiny helpers.
 * Loaded first. Every other module attaches itself to EFS (Excel Formula Studio). */
(function (root, factory) {
  var EFS = root.EFS || (root.EFS = {});
  var api = factory(EFS, root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (EFS, root) {
  'use strict';
  EFS.VERSION = '1.0.0';
  EFS.APP_NAME = 'Formula Studio';
  EFS.catalogParts = EFS.catalogParts || {};

  var util = {
    /** Escape text for safe insertion into HTML. */
    esc: function (s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },
    /** Pick a trilingual string {tr,ru,en} for a language, falling back sensibly. */
    pick: function (obj, lang) {
      if (obj == null) return '';
      if (typeof obj === 'string') return obj;
      return obj[lang] || obj.en || obj.tr || obj.ru || '';
    },
    /** 1-based column index → letters (1 → A, 27 → AA). */
    columnLetter: function (n) {
      var s = '';
      n = Number(n);
      while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
      return s;
    },
    /** Letters → 1-based column index (A → 1, AA → 27). */
    columnIndex: function (letters) {
      var n = 0; letters = String(letters).toUpperCase();
      for (var i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
      return n;
    },
    /** 'F12' → {col:'F', row:12}; '$F$12' also accepted. */
    splitAddress: function (addr) {
      var m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(String(addr).trim());
      return m ? { col: m[1].toUpperCase(), row: parseInt(m[2], 10) } : null;
    },
    /** 'A1:B9' → {col:'A',row:1,col2:'B',row2:9}; single cell → row2=row, col2=col; 'A:A' → rows null. */
    parseRange: function (text) {
      var t = String(text).trim().replace(/\$/g, '');
      var m = /^([A-Za-z]{1,3})(\d+)?:([A-Za-z]{1,3})(\d+)?$/.exec(t);
      if (m) return { col: m[1].toUpperCase(), row: m[2] ? +m[2] : null, col2: m[3].toUpperCase(), row2: m[4] ? +m[4] : null };
      m = /^([A-Za-z]{1,3})(\d+)$/.exec(t);
      if (m) return { col: m[1].toUpperCase(), row: +m[2], col2: m[1].toUpperCase(), row2: +m[2] };
      m = /^(\d+):(\d+)$/.exec(t);
      if (m) return { col: null, row: +m[1], col2: null, row2: +m[2] };
      return null;
    },
    clamp: function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); },
    uniq: function (arr) { var seen = {}, out = []; for (var i = 0; i < arr.length; i++) { var k = typeof arr[i] + ':' + arr[i]; if (!seen[k]) { seen[k] = 1; out.push(arr[i]); } } return out; }
  };
  EFS.util = util;
  return util;
});
