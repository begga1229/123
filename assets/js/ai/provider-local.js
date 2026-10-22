/* Formula Studio — local model providers (docs/ARCHITECTURE.md §16): EFS.ai.providers.ollama and EFS.ai.providers.openaiCompat.
 * Ollama:            POST {url}/api/chat {model, stream:false, format:<schema>, options:{temperature:0.1}} ; GET {url}/api/tags
 * OpenAI-compatible: POST {url}/chat/completions with response_format json_schema → (400) json_object → (400) none ; GET {url}/models
 * Transport: window.efsDesktop.http (Electron main process, no CORS) when present, else fetch with AbortController (180 s).
 * Plain ES2019, UMD-lite wrapper. */
(function (root, factory) {
  var EFS = root.EFS || (root.EFS = {});
  var api = factory(EFS, root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (EFS, root) {
  'use strict';
  var ai = EFS.ai || (EFS.ai = {});
  ai.providers = ai.providers || {};

  var TIMEOUT_MS = 180000;
  var local = { timeoutMs: TIMEOUT_MS };

  function err(code, vars, cause) { return EFS.ai.error(code, vars, cause); }
  function short(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function trimUrl(u) { return String(u || '').trim().replace(/\/+$/, ''); }
  function desktopHttp() { var d = root.efsDesktop; return d && typeof d.http === 'function' ? d : null; }
  function offlineCode(kind) { return kind === 'ollama' ? 'local_offline_ollama' : 'local_offline_openai'; }

  /**
   * One HTTP request → Promise<{ status, body:string }>. Network failures reject with an EFSAIError
   * (connection refused / CORS → trilingual hint for the provider kind, timeout, cancelled).
   */
  local.http = function (req, signal, kind) {
    var d = desktopHttp();
    if (signal && signal.aborted) return Promise.reject(err('cancelled'));
    if (d) {
      return new Promise(function (resolve, reject) {
        var settled = false;
        var timer = setTimeout(function () { finish(err('timeout')); }, local.timeoutMs);
        var onAbort = function () { finish(err('cancelled')); };
        if (signal) signal.addEventListener('abort', onAbort);
        function finish(e, value) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (signal) signal.removeEventListener('abort', onAbort);
          if (e) reject(e); else resolve(value);
        }
        Promise.resolve().then(function () { return d.http({ method: req.method, url: req.url, headers: req.headers || {}, body: req.body == null ? null : req.body }); })
          .then(function (r) { finish(null, { status: Number(r && r.status) || 0, body: r && r.body != null ? String(r.body) : '' }); },
            function (e) { finish(err(offlineCode(kind), { detail: req.url + (e && e.message ? ' — ' + short(e.message, 120) : '') }, e)); });
      });
    }
    if (typeof fetch !== 'function') return Promise.reject(err(offlineCode(kind), { detail: req.url }));
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timedOut = false, cancelled = false;
    var timer = setTimeout(function () { timedOut = true; if (ctl) ctl.abort(); }, local.timeoutMs);
    var onAbort = function () { cancelled = true; if (ctl) ctl.abort(); };
    if (signal) signal.addEventListener('abort', onAbort);
    function done() { clearTimeout(timer); if (signal) signal.removeEventListener('abort', onAbort); }
    return fetch(req.url, { method: req.method, headers: req.headers || {}, body: req.body == null ? undefined : req.body, signal: ctl ? ctl.signal : undefined })
      .then(function (res) { return res.text().then(function (body) { done(); return { status: res.status, body: body }; }); })
      .catch(function (e) {
        done();
        if (cancelled) throw err('cancelled', null, e);
        if (timedOut) throw err('timeout', null, e);
        if (e && e.name === 'EFSAIError') throw e;
        // fetch rejects with a TypeError both for "connection refused" and for a CORS block
        throw err(offlineCode(kind), { detail: req.url }, e);
      });
  };

  function parseJson(body) { try { return JSON.parse(body); } catch (e) { return null; } }
  function errorText(body) {
    var j = parseJson(body);
    var m = j && (typeof j.error === 'string' ? j.error : j.error && j.error.message) || j && j.message || body;
    return short(m, 240);
  }
  function httpError(res) {
    if (res.status === 401 || res.status === 403) return err('auth', null);
    if (res.status === 404) return err('not_found', { detail: errorText(res.body) });
    return err('local_http', { status: res.status, detail: errorText(res.body) });
  }
  function toText(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) return content.map(function (b) { return b && b.type === 'text' ? b.text : ''; }).join('\n');
    return String(content == null ? '' : content);
  }
  function chatMessages(req) {
    return [{ role: 'system', content: req.system }].concat(req.messages.map(function (m) { return { role: m.role, content: toText(m.content) }; }));
  }

  /* ------------------------------------------------------------------ Ollama */
  var ollama = {
    id: 'ollama', needsKey: false, online: false,
    listModels: function (s, signal) {
      var url = trimUrl(s.ollama && s.ollama.url) || 'http://localhost:11434';
      return local.http({ method: 'GET', url: url + '/api/tags', headers: { Accept: 'application/json' } }, signal, 'ollama').then(function (res) {
        if (res.status >= 400) throw httpError(res);
        var j = parseJson(res.body);
        if (!j || !Array.isArray(j.models)) throw err('local_http', { status: res.status, detail: 'unexpected /api/tags answer' });
        return j.models.map(function (m) { return m && (m.name || m.model); }).filter(Boolean);
      });
    },
    test: function (s, signal) { return ollama.listModels(s, signal).then(function (models) { return { models: models }; }); },
    call: function (req) {
      var s = req.settings, url = trimUrl(s.ollama && s.ollama.url) || 'http://localhost:11434';
      var modelP = s.ollama && s.ollama.model ? Promise.resolve(s.ollama.model) : ollama.listModels(s, req.signal).then(function (list) { if (!list.length) throw err('no_model'); return list[0]; });
      return modelP.then(function (model) {
        var body = { model: model, stream: false, format: req.schema, messages: chatMessages(req), options: { temperature: 0.1 } };
        return local.http({ method: 'POST', url: url + '/api/chat', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) }, req.signal, 'ollama').then(function (res) {
          if (res.status >= 400) throw httpError(res);
          var j = parseJson(res.body);
          if (!j || !j.message) throw err('bad_response');
          var text = toText(j.message.content);
          return { text: text, assistantContent: text, model: j.model || model, stopReason: j.done_reason === 'length' ? 'max_tokens' : 'end', usage: { input_tokens: j.prompt_eval_count || null, output_tokens: j.eval_count || null } };
        });
      });
    }
  };

  /* ------------------------------------------------------------------ OpenAI-compatible (LM Studio, llama.cpp server, Jan …) */
  function oaHeaders(s) {
    var h = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (s.openaiCompat && s.openaiCompat.apiKey) h.Authorization = 'Bearer ' + s.openaiCompat.apiKey;
    return h;
  }
  var openaiCompat = {
    id: 'openaiCompat', needsKey: false, online: false,
    listModels: function (s, signal) {
      var url = trimUrl(s.openaiCompat && s.openaiCompat.url) || 'http://localhost:1234/v1';
      return local.http({ method: 'GET', url: url + '/models', headers: oaHeaders(s) }, signal, 'openaiCompat').then(function (res) {
        if (res.status >= 400) throw httpError(res);
        var j = parseJson(res.body);
        var list = j && (Array.isArray(j.data) ? j.data : Array.isArray(j.models) ? j.models : null);
        if (!list) throw err('local_http', { status: res.status, detail: 'unexpected /models answer' });
        return list.map(function (m) { return typeof m === 'string' ? m : m && (m.id || m.name || m.model); }).filter(Boolean);
      });
    },
    test: function (s, signal) { return openaiCompat.listModels(s, signal).then(function (models) { return { models: models }; }); },
    call: function (req) {
      var s = req.settings, url = trimUrl(s.openaiCompat && s.openaiCompat.url) || 'http://localhost:1234/v1';
      var modelP = s.openaiCompat && s.openaiCompat.model ? Promise.resolve(s.openaiCompat.model) : openaiCompat.listModels(s, req.signal).then(function (list) { if (!list.length) throw err('no_model'); return list[0]; });
      var formats = [
        { type: 'json_schema', json_schema: { name: 'formula', strict: true, schema: req.schema } },
        { type: 'json_object' },
        null
      ];
      return modelP.then(function (model) {
        function attempt(i) {
          var body = { model: model, messages: chatMessages(req), temperature: 0.1, stream: false };
          if (formats[i]) body.response_format = formats[i];
          return local.http({ method: 'POST', url: url + '/chat/completions', headers: oaHeaders(s), body: JSON.stringify(body) }, req.signal, 'openaiCompat').then(function (res) {
            // servers that do not support a response_format answer 400 (some 422): retry with a weaker format, then none
            if ((res.status === 400 || res.status === 422) && i < formats.length - 1) return attempt(i + 1);
            if (res.status >= 400) throw httpError(res);
            var j = parseJson(res.body);
            var choice = j && Array.isArray(j.choices) && j.choices[0];
            if (!choice || !choice.message) throw err('bad_response');
            var text = toText(choice.message.content);
            return { text: text, assistantContent: text, model: j.model || model, stopReason: choice.finish_reason === 'length' ? 'max_tokens' : 'end', usage: j.usage || null, responseFormat: formats[i] ? formats[i].type : 'none' };
          });
        }
        return attempt(0);
      });
    }
  };

  ai.providers.ollama = ollama;
  ai.providers.openaiCompat = openaiCompat;
  ai.local = local;
  return { ollama: ollama, openaiCompat: openaiCompat, http: local.http };
});
