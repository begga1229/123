/* Formula Studio — EFS.ai.providers.anthropic: Claude through the OFFICIAL Anthropic SDK (docs/ARCHITECTURE.md §16).
 * Browser: assets/js/vendor/anthropic-sdk.min.js (global AnthropicSDK, an esbuild IIFE bundle of @anthropic-ai/sdk).
 * Node tests: the npm package, resolved from process.env.EFS_ANTHROPIC_SDK.
 * Request: client.beta.messages.create with structured outputs (output_config.format json_schema), a cached system block and
 * server-side refusal fallback (fallbacks:'default'). No thinking / temperature / top_p / top_k (Claude Opus 5.5 thinks
 * adaptively; output_config.effort controls the depth). SDK errors are mapped with instanceof to trilingual messages.
 * Plain ES2019, UMD-lite wrapper. */
(function (root, factory) {
  var EFS = root.EFS || (root.EFS = {});
  var api = factory(EFS, root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (EFS, root) {
  'use strict';
  var ai = EFS.ai || (EFS.ai = {});
  ai.providers = ai.providers || {};

  var FALLBACK_BETA = 'server-side-fallback-2026-07-01';
  var DEFAULT_MODEL = 'claude-opus-5-5';
  var clientCache = { key: null, client: null };

  function err(code, vars, cause) { return EFS.ai.error(code, vars, cause); }
  function short(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  /** The SDK module: window.AnthropicSDK in the browser, require(EFS_ANTHROPIC_SDK) in Node tests. */
  function sdk() {
    var m = root.AnthropicSDK || null;
    if (!m && typeof require !== 'undefined' && typeof process !== 'undefined' && process.env && process.env.EFS_ANTHROPIC_SDK) {
      try { m = require(process.env.EFS_ANTHROPIC_SDK); } catch (e) { m = null; }
    }
    if (!m) return null;
    var Ctor = m.default || m.Anthropic || m;
    return typeof Ctor === 'function' ? { Ctor: Ctor, mod: m } : null;
  }
  function errClass(S, name) { return (S.Ctor && S.Ctor[name]) || (S.mod && S.mod[name]) || null; }
  function isA(e, S, name) { var C = errClass(S, name); return !!(C && e instanceof C); }

  function getClient(s) {
    var S = sdk();
    if (!S) throw err('no_sdk');
    var a = s.anthropic || {};
    if (!a.apiKey) throw err('no_key');
    var key = a.apiKey + '|' + (a.baseURL || '');
    if (clientCache.key === key && clientCache.client) return { S: S, client: clientCache.client };
    var client = new S.Ctor({ apiKey: a.apiKey, dangerouslyAllowBrowser: true, baseURL: a.baseURL || undefined, maxRetries: 2, timeout: 120000 });
    clientCache = { key: key, client: client };
    return { S: S, client: client };
  }
  /** Claude Haiku 5.5 has no server-side fallback: do not send the parameter to it. */
  function supportsFallback(model) { return !/haiku/i.test(String(model)); }

  /** Human-readable message carried by an SDK APIError. */
  function apiMessage(e) {
    var body = e && e.error;
    var m = body && body.error && body.error.message || body && body.message || e && e.message || '';
    return short(m, 300);
  }
  /** SDK exception → EFSAIError (most specific class first; APIConnectionError is a subclass of APIError). */
  function mapError(e, S, model) {
    if (!e) return err('unknown', { detail: 'empty error' });
    if (e.name === 'EFSAIError') return e;
    if (isA(e, S, 'APIUserAbortError')) return err('cancelled', null, e);
    if (isA(e, S, 'APIConnectionTimeoutError')) return err('timeout', null, e);
    if (isA(e, S, 'APIConnectionError')) return err('offline', null, e);
    if (isA(e, S, 'AuthenticationError')) return err('auth', null, e);
    if (isA(e, S, 'PermissionDeniedError')) return err('permission', null, e);
    if (isA(e, S, 'NotFoundError')) return err('not_found', { detail: model + ' — ' + apiMessage(e) }, e);
    if (isA(e, S, 'RateLimitError')) return err('rate', null, e);
    if (isA(e, S, 'BadRequestError')) return err('bad_request', { detail: apiMessage(e) }, e);
    if (isA(e, S, 'InternalServerError')) return err(e.status === 529 || e.type === 'overloaded_error' ? 'overloaded' : 'server', null, e);
    if (isA(e, S, 'APIError')) {
      if (e.status === 402 || e.type === 'billing_error') return err('billing', { detail: apiMessage(e) }, e);
      return err('api_error', { status: e.status || '?', detail: apiMessage(e) }, e);
    }
    if (e.name === 'AbortError') return err('cancelled', null, e);
    return err('unknown', { detail: short(e.message || e, 200) }, e);
  }

  /** Content blocks to echo back as the assistant turn (append-only repair). After a mid-output fallback, blocks before
   *  the last `fallback` block other than text are omitted, per the server-side fallback rules. */
  function echoContent(content) {
    var lastFb = -1;
    content.forEach(function (b, i) { if (b && b.type === 'fallback') lastFb = i; });
    var out = [];
    content.forEach(function (b, i) {
      if (!b || b.type === 'fallback') return;
      if (b.type === 'text') { if (b.text) out.push({ type: 'text', text: b.text }); return; }
      if (i < lastFb) return;
      out.push(b);
    });
    return out;
  }
  function firstText(content) {
    var lastFb = -1;
    content.forEach(function (b, i) { if (b && b.type === 'fallback') lastFb = i; });
    for (var i = lastFb + 1; i < content.length; i++) if (content[i] && content[i].type === 'text') return content[i].text || '';
    for (var j = 0; j < content.length; j++) if (content[j] && content[j].type === 'text') return content[j].text || '';
    return '';
  }

  function baseParams(model) {
    var p = { model: model };
    if (supportsFallback(model)) { p.betas = [FALLBACK_BETA]; p.fallbacks = 'default'; }
    return p;
  }

  var provider = {
    id: 'anthropic',
    needsKey: true,
    online: true,
    /** req = { system, messages:[{role, content}], schema, settings, signal } → { text, stopReason, refusalCategory, assistantContent, model, usage } */
    call: function (req) {
      var s = req.settings, a = s.anthropic || {}, model = a.model || DEFAULT_MODEL, c, S;
      try { var got = getClient(s); c = got.client; S = got.S; } catch (e) { return Promise.reject(e.name === 'EFSAIError' ? e : err('unknown', { detail: short(e.message, 200) }, e)); }
      var params = baseParams(model);
      params.max_tokens = 16000;
      params.output_config = { effort: a.effort || 'medium', format: { type: 'json_schema', schema: req.schema } };
      params.system = [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }];
      params.messages = req.messages.map(function (m) { return { role: m.role, content: m.content }; });
      var p;
      try { p = c.beta.messages.create(params, req.signal ? { signal: req.signal } : undefined); } catch (e) { return Promise.reject(mapError(e, S, model)); }
      return Promise.resolve(p).then(function (resp) {
        resp = resp || {};
        var out = { model: resp.model || model, usage: resp.usage || null, stopReason: 'end', text: '', assistantContent: null, raw: resp };
        if (resp.stop_reason === 'refusal') {   // check before reading content
          out.stopReason = 'refusal';
          out.refusalCategory = resp.stop_details && resp.stop_details.category || null;
          return out;
        }
        var content = Array.isArray(resp.content) ? resp.content : [];
        out.text = firstText(content);
        out.assistantContent = echoContent(content);
        if (resp.stop_reason === 'max_tokens' || resp.stop_reason === 'model_context_window_exceeded') out.stopReason = 'max_tokens';
        return out;
      }, function (e) { throw mapError(e, S, model); });
    },
    /** Tiny plain-text request (max_tokens 16, same betas/fallbacks) to check key, model and connectivity. */
    test: function (s, signal) {
      var a = s.anthropic || {}, model = a.model || DEFAULT_MODEL, c, S;
      try { var got = getClient(s); c = got.client; S = got.S; } catch (e) { return Promise.reject(e); }
      var params = baseParams(model);
      params.max_tokens = 16;
      params.messages = [{ role: 'user', content: 'Reply with the single word OK.' }];
      return Promise.resolve().then(function () { return c.beta.messages.create(params, signal ? { signal: signal } : undefined); })
        .then(function (resp) { return { model: resp && resp.model || model }; }, function (e) { throw mapError(e, S, model); });
    },
    listModels: function () { return Promise.resolve((EFS.ai.ANTHROPIC_MODELS || [DEFAULT_MODEL]).slice()); },
    _mapError: mapError,
    _sdk: sdk
  };

  ai.providers.anthropic = provider;
  return provider;
});
