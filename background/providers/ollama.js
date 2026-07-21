import { fetchWithTimeout, errorForResponse } from '../../shared/fetch-timeout.js';

const DEFAULT_BASE_URL = 'http://localhost:11434';

// Ollama checks the request's Origin header against an allowlist and returns 403 for
// anything not on it — a browser extension's chrome-extension://<id> origin isn't
// there by default, so this (not an actual auth problem) is the most likely cause of
// a 403 from a stock local install. The generic "Invalid API key" message would be
// misleading here, so it's overridden below.
const ORIGIN_BLOCKED_MESSAGE =
  'Ollama rejected this request (403 Forbidden) — its server checks the request’s ' +
  'Origin header, and this extension isn’t on the default allowlist. Set the ' +
  'OLLAMA_ORIGINS environment variable (e.g. to "*") and restart Ollama. See the ' +
  'README for per-OS instructions.';

function baseUrlOf(baseUrl) {
  return (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function authHeaders(apiKey) {
  // Ollama itself needs no key by default; this only matters if it's sitting behind a
  // reverse proxy that expects one.
  return apiKey ? { authorization: `Bearer ${apiKey}` } : {};
}

export async function call({ model, baseUrl, apiKey }, userText, systemPrompt) {
  const response = await fetchWithTimeout(`${baseUrlOf(baseUrl)}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders(apiKey) },
    body: JSON.stringify({
      model,
      stream: false,
      // Best-effort: Ollama's native reasoning-model support honors this and skips
      // thinking entirely. Ignored harmlessly by models/templates that don't support
      // it — shared/strip-thinking.js is the guaranteed fallback for those.
      think: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText },
      ],
    }),
  }, 300000); // local inference has no SLA — allow up to 5 minutes for cold-start/slow hardware

  if (!response.ok) throw await errorForResponse(response, { 403: ORIGIN_BLOCKED_MESSAGE });

  const data = await response.json();
  const text = data.message?.content;
  if (!text) throw new Error('Model returned no text.');
  return text;
}

export async function listModels({ baseUrl, apiKey }) {
  const response = await fetchWithTimeout(`${baseUrlOf(baseUrl)}/api/tags`, {
    headers: { ...authHeaders(apiKey) },
  }, 15000);
  if (!response.ok) throw await errorForResponse(response, { 403: ORIGIN_BLOCKED_MESSAGE });
  const data = await response.json();
  return (data.models || []).map((m) => ({ id: m.name, label: m.name }));
}
