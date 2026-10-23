// Formula Studio — preload (sandboxed, contextIsolation). See docs/ARCHITECTURE.md §17.
// Exposes a tiny, frozen API as window.efsDesktop; the page never gets Node or ipcRenderer itself.
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

function argValue(name) {
  const prefix = '--' + name + '=';
  const argv = (typeof process !== 'undefined' && process.argv) || [];
  for (let i = 0; i < argv.length; i++) {
    if (typeof argv[i] === 'string' && argv[i].indexOf(prefix) === 0) return argv[i].slice(prefix.length);
  }
  return '';
}

const version = argValue('efs-version') || '1.0.0';

contextBridge.exposeInMainWorld('efsDesktop', {
  isDesktop: true,
  platform: process.platform,
  version: version,
  /**
   * HTTP to a local server only (Ollama, LM Studio, llama.cpp …), done by the main process so CORS does not apply.
   * req = { url, method: 'GET'|'POST', headers?: {}, body?: string (≤ 2 MB), timeoutMs?: number (≤ 180000) }
   * → Promise<{ status, ok, statusText, contentType, body }>; rejects for non-local URLs, timeouts and connection errors.
   */
  http: (req) => {
    let clean;
    try {
      // copy to a plain object so only data crosses the bridge
      clean = JSON.parse(JSON.stringify(req || {}));
    } catch (e) {
      return Promise.reject(new Error('efs:http — request must be JSON-serializable'));
    }
    return ipcRenderer.invoke('efs:http', clean);
  }
});

// Keep the native menu in the page's UI language: watch <html lang> (set by EFS.i18n.setLang).
function watchLang() {
  const html = document.documentElement;
  if (!html) return;
  let last = '';
  const report = () => {
    const lang = String(html.getAttribute('lang') || '').slice(0, 2).toLowerCase();
    if (lang && lang !== last) {
      last = lang;
      ipcRenderer.send('efs:ui-lang', lang);
    }
  };
  report();
  try {
    new MutationObserver(report).observe(html, { attributes: true, attributeFilter: ['lang'] });
  } catch (e) { /* ignore */ }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', watchLang, { once: true });
} else {
  watchLang();
}
