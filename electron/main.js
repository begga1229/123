// Formula Studio — desktop shell (Electron main process). See docs/ARCHITECTURE.md §17.
// The web app (index.html) is loaded unchanged from disk; this file only adds a native window,
// a menu, remembered window state and a tightly restricted localhost HTTP bridge for local AI models.
'use strict';

const { app, BrowserWindow, Menu, dialog, ipcMain, screen, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');

const APP_DIR = path.resolve(__dirname, '..');
const INDEX = path.join(APP_DIR, 'index.html');
const ICON = path.join(APP_DIR, 'assets', 'icons', 'icon.png');
const PRELOAD = path.join(__dirname, 'preload.js');
const PRODUCT = 'Formula Studio';
const MAX_BODY = 2 * 1024 * 1024;          // request body limit for efs:http (2 MB)
const MAX_RESPONSE = 32 * 1024 * 1024;     // response body limit for efs:http (32 MB)
const HTTP_TIMEOUT = 180 * 1000;           // efs:http timeout (180 s)
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', '::1'];

let mainWindow = null;
let uiLang = null;                          // 'tr' | 'ru' | 'en' reported by the page (<html lang>)

// ---------------------------------------------------------------- single instance

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

// ---------------------------------------------------------------- language & menu strings

function systemLang() {
  const loc = String(app.getLocale() || '').toLowerCase();
  if (loc.indexOf('ru') === 0) return 'ru';
  if (loc.indexOf('en') === 0) return 'en';
  return 'tr';
}

function currentLang() {
  return uiLang || systemLang();
}

const L = {
  file:       { tr: 'Dosya', ru: 'Файл', en: 'File' },
  openExcel:  { tr: 'Excel dosyası aç…', ru: 'Открыть файл Excel…', en: 'Open Excel file…' },
  quit:       { tr: 'Çıkış', ru: 'Выход', en: 'Quit' },
  edit:       { tr: 'Düzen', ru: 'Правка', en: 'Edit' },
  undo:       { tr: 'Geri al', ru: 'Отменить', en: 'Undo' },
  redo:       { tr: 'Yinele', ru: 'Повторить', en: 'Redo' },
  cut:        { tr: 'Kes', ru: 'Вырезать', en: 'Cut' },
  copy:       { tr: 'Kopyala', ru: 'Копировать', en: 'Copy' },
  paste:      { tr: 'Yapıştır', ru: 'Вставить', en: 'Paste' },
  selectAll:  { tr: 'Tümünü seç', ru: 'Выделить всё', en: 'Select all' },
  view:       { tr: 'Görünüm', ru: 'Вид', en: 'View' },
  reload:     { tr: 'Yeniden yükle', ru: 'Перезагрузить', en: 'Reload' },
  resetZoom:  { tr: 'Gerçek boyut', ru: 'Исходный масштаб', en: 'Actual size' },
  zoomIn:     { tr: 'Yakınlaştır', ru: 'Увеличить', en: 'Zoom in' },
  zoomOut:    { tr: 'Uzaklaştır', ru: 'Уменьшить', en: 'Zoom out' },
  fullscreen: { tr: 'Tam ekran', ru: 'Полноэкранный режим', en: 'Toggle full screen' },
  devtools:   { tr: 'Geliştirici araçları', ru: 'Инструменты разработчика', en: 'Developer tools' },
  help:       { tr: 'Yardım', ru: 'Справка', en: 'Help' },
  about:      { tr: 'Formula Studio hakkında', ru: 'О программе Formula Studio', en: 'About Formula Studio' },
  aboutText:  {
    tr: 'Türkçe ve Rusça yazılan isteklerden Excel formülleri üreten masaüstü asistan.',
    ru: 'Настольный помощник, который превращает запросы на русском и турецком в формулы Excel.',
    en: 'Desktop assistant that turns Turkish and Russian requests into Excel formulas.'
  },
  offline:    {
    tr: 'Çevrimdışı çalışır: verileriniz bilgisayarınızdan çıkmaz.',
    ru: 'Работает офлайн: ваши данные не покидают компьютер.',
    en: 'Works offline: your data never leaves your computer.'
  },
  version:    { tr: 'Sürüm', ru: 'Версия', en: 'Version' },
  ok:         { tr: 'Tamam', ru: 'ОК', en: 'OK' }
};

function t(key) {
  const entry = L[key];
  return entry ? (entry[currentLang()] || entry.tr) : key;
}

function openExcelFromMenu() {
  if (!mainWindow) return;
  // Clicks the page's own file input (user gesture = true so the picker is allowed to open).
  mainWindow.webContents
    .executeJavaScript("(function(){var i=document.getElementById('file-input');if(i){i.click();return true;}return false;})()", true)
    .catch(() => {});
}

function showAbout() {
  const detail = [
    t('aboutText'),
    '',
    t('offline'),
    '',
    t('version') + ': ' + app.getVersion(),
    'Electron ' + process.versions.electron + ' · Chromium ' + process.versions.chrome
  ].join('\n');
  const opts = { type: 'info', title: t('about'), message: PRODUCT, detail: detail, buttons: [t('ok')], noLink: true };
  if (mainWindow) dialog.showMessageBox(mainWindow, opts); else dialog.showMessageBox(opts);
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const viewItems = [
    { label: t('reload'), role: 'reload' },
    { type: 'separator' },
    { label: t('resetZoom'), role: 'resetZoom' },
    { label: t('zoomIn'), role: 'zoomIn' },
    { label: t('zoomOut'), role: 'zoomOut' },
    { type: 'separator' },
    { label: t('fullscreen'), role: 'togglefullscreen' }
  ];
  if (!app.isPackaged) {
    viewItems.push({ type: 'separator' }, { label: t('devtools'), role: 'toggleDevTools' });
  }
  const template = [];
  if (isMac) template.push({ label: PRODUCT, submenu: [{ label: t('about'), click: showAbout }, { type: 'separator' }, { label: t('quit'), role: 'quit' }] });
  template.push(
    {
      label: t('file'),
      submenu: [
        { label: t('openExcel'), accelerator: 'CmdOrCtrl+O', click: openExcelFromMenu },
        { type: 'separator' },
        isMac ? { label: t('quit'), role: 'close' } : { label: t('quit'), role: 'quit' }
      ]
    },
    {
      label: t('edit'),
      submenu: [
        { label: t('undo'), role: 'undo' },
        { label: t('redo'), role: 'redo' },
        { type: 'separator' },
        { label: t('cut'), role: 'cut' },
        { label: t('copy'), role: 'copy' },
        { label: t('paste'), role: 'paste' },
        { type: 'separator' },
        { label: t('selectAll'), role: 'selectAll' }
      ]
    },
    { label: t('view'), submenu: viewItems },
    { label: t('help'), role: 'help', submenu: [{ label: t('about'), click: showAbout }] }
  );
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------- window state

const DEFAULT_STATE = { width: 1440, height: 900, maximized: false };

function statePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function isNum(v) { return typeof v === 'number' && isFinite(v); }

function loadWindowState() {
  try {
    const raw = JSON.parse(fs.readFileSync(statePath(), 'utf8'));
    const s = {
      width: isNum(raw.width) ? Math.max(1000, Math.round(raw.width)) : DEFAULT_STATE.width,
      height: isNum(raw.height) ? Math.max(640, Math.round(raw.height)) : DEFAULT_STATE.height,
      maximized: raw.maximized === true
    };
    if (isNum(raw.x) && isNum(raw.y)) {
      // keep the saved position only if the window is still visible on a connected display
      const visible = screen.getAllDisplays().some((d) => {
        const a = d.workArea;
        return raw.x + 100 < a.x + a.width && raw.x + s.width - 100 > a.x &&
               raw.y + 50 < a.y + a.height && raw.y + 40 > a.y - 40;
      });
      if (visible) { s.x = Math.round(raw.x); s.y = Math.round(raw.y); }
    }
    return s;
  } catch (e) {
    return Object.assign({}, DEFAULT_STATE);
  }
}

function saveWindowState(win) {
  if (!win || win.isDestroyed()) return;
  try {
    const b = win.isMaximized() || win.isFullScreen() ? win.getNormalBounds() : win.getBounds();
    const data = { x: b.x, y: b.y, width: b.width, height: b.height, maximized: win.isMaximized() };
    fs.mkdirSync(path.dirname(statePath()), { recursive: true });
    fs.writeFileSync(statePath(), JSON.stringify(data));
  } catch (e) { /* not critical */ }
}

// ---------------------------------------------------------------- navigation guards

/** true when url is a file:// URL inside the application folder */
function isAppFileUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'file:') return false;
    const p = path.resolve(fileURLToPath(u));
    const rel = path.relative(APP_DIR, p);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  } catch (e) {
    return false;
  }
}

function openExternalSafe(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:') {
      shell.openExternal(u.toString()).catch(() => {});
    }
  } catch (e) { /* ignore malformed */ }
}

function guardWebContents(contents) {
  contents.setWindowOpenHandler(({ url }) => {
    openExternalSafe(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (event, url) => {
    if (isAppFileUrl(url)) return;
    event.preventDefault();
    openExternalSafe(url);
  });
  contents.on('will-redirect', (event, url) => {
    if (!isAppFileUrl(url)) event.preventDefault();
  });
  contents.on('will-attach-webview', (event) => event.preventDefault());
}

// ---------------------------------------------------------------- efs:http (localhost-only bridge)

function httpError(message) {
  return new Error('efs:http — ' + message);
}

/** Validates a renderer request; returns a normalized request or throws. */
function checkHttpRequest(req) {
  if (!req || typeof req !== 'object') throw httpError('request must be an object');
  if (typeof req.url !== 'string' || req.url.length > 4096) throw httpError('url must be a string');
  let u;
  try { u = new URL(req.url); } catch (e) { throw httpError('invalid url'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw httpError('only http(s) URLs are allowed');
  if (u.username || u.password) throw httpError('credentials in URL are not allowed');
  if (LOCAL_HOSTS.indexOf(u.hostname.toLowerCase()) === -1) throw httpError('only localhost / 127.0.0.1 / [::1] are allowed');
  const method = String(req.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'POST') throw httpError('only GET and POST are allowed');
  let body;
  if (req.body !== undefined && req.body !== null && req.body !== '') {
    if (typeof req.body !== 'string') throw httpError('body must be a string');
    if (Buffer.byteLength(req.body, 'utf8') > MAX_BODY) throw httpError('body is larger than 2 MB');
    if (method === 'GET') throw httpError('GET requests cannot have a body');
    body = req.body;
  }
  const headers = {};
  if (req.headers && typeof req.headers === 'object') {
    Object.keys(req.headers).slice(0, 50).forEach((k) => {
      const v = req.headers[k];
      if (typeof v === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(k) && v.length <= 8192 && !/[\r\n]/.test(v)) {
        const lk = k.toLowerCase();
        if (lk !== 'host' && lk !== 'content-length' && lk !== 'connection' && lk !== 'transfer-encoding') headers[k] = v;
      }
    });
  }
  let timeout = HTTP_TIMEOUT;
  if (isNum(req.timeoutMs) && req.timeoutMs > 0) timeout = Math.min(HTTP_TIMEOUT, req.timeoutMs);
  return { url: u.toString(), method: method, headers: headers, body: body, timeout: timeout };
}

async function readLimited(res) {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const r = await reader.read();
    if (r.done) break;
    size += r.value.byteLength;
    if (size > MAX_RESPONSE) {
      try { await reader.cancel(); } catch (e) { /* ignore */ }
      throw httpError('response is larger than 32 MB');
    }
    chunks.push(Buffer.from(r.value));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function handleHttp(event, req) {
  const frameUrl = event.senderFrame ? event.senderFrame.url : '';
  if (!isAppFileUrl(frameUrl)) throw httpError('caller is not the application page');
  const r = checkHttpRequest(req);
  let res;
  try {
    res = await fetch(r.url, {
      method: r.method,
      headers: r.headers,
      body: r.body,
      redirect: 'manual',                       // never follow a redirect away from localhost
      signal: AbortSignal.timeout(r.timeout)
    });
  } catch (e) {
    const name = e && (e.name || '');
    if (name === 'TimeoutError' || name === 'AbortError') throw httpError('timeout after ' + Math.round(r.timeout / 1000) + ' s');
    const cause = e && e.cause && (e.cause.code || e.cause.message);
    throw httpError('connection failed' + (cause ? ' (' + cause + ')' : ''));
  }
  const body = await readLimited(res);
  return {
    status: res.status,
    ok: res.ok,
    statusText: res.statusText || '',
    contentType: res.headers.get('content-type') || '',
    body: body
  };
}

// ---------------------------------------------------------------- main window

function createWindow() {
  const state = loadWindowState();
  const opts = {
    width: state.width,
    height: state.height,
    minWidth: 1000,
    minHeight: 640,
    show: false,
    title: PRODUCT,
    icon: ICON,
    backgroundColor: '#0f1216',
    autoHideMenuBar: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      spellcheck: false,
      preload: PRELOAD,
      additionalArguments: ['--efs-version=' + app.getVersion()]
    }
  };
  if (isNum(state.x) && isNum(state.y)) { opts.x = state.x; opts.y = state.y; }
  const win = new BrowserWindow(opts);
  mainWindow = win;
  if (state.maximized) win.maximize();

  // navigation guards are attached to every WebContents in 'web-contents-created' below
  win.on('page-title-updated', (e) => { e.preventDefault(); win.setTitle(PRODUCT); });
  win.once('ready-to-show', () => win.show());
  // safety net: show the window even if ready-to-show never fires (e.g. a renderer hiccup)
  setTimeout(() => { if (!win.isDestroyed() && !win.isVisible()) win.show(); }, 4000);

  let saveTimer = null;
  const scheduleSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveWindowState(win), 400);
  };
  ['resize', 'move', 'maximize', 'unmaximize'].forEach((ev) => win.on(ev, scheduleSave));
  win.on('close', () => { clearTimeout(saveTimer); saveWindowState(win); });
  win.on('closed', () => { if (mainWindow === win) mainWindow = null; });

  win.loadFile(INDEX);
  return win;
}

// ---------------------------------------------------------------- app lifecycle

app.on('web-contents-created', (event, contents) => guardWebContents(contents));

app.whenReady().then(() => {
  if (!gotLock) return;
  // the page asks for nothing beyond the clipboard (copy formula) and full screen
  const allowed = ['clipboard-sanitized-write', 'fullscreen'];
  const ses = require('electron').session.defaultSession;
  ses.setPermissionRequestHandler((wc, permission, cb) => cb(allowed.indexOf(permission) !== -1));
  ses.setPermissionCheckHandler((wc, permission) => allowed.indexOf(permission) !== -1);

  ipcMain.handle('efs:http', handleHttp);
  ipcMain.on('efs:ui-lang', (event, lang) => {
    if (!event.senderFrame || !isAppFileUrl(event.senderFrame.url)) return;
    const l = String(lang || '').slice(0, 2).toLowerCase();
    if ((l === 'tr' || l === 'ru' || l === 'en') && l !== uiLang) {
      uiLang = l;
      buildMenu();
    }
  });

  buildMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

