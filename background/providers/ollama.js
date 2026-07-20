import { fetchWithTimeout, errorForResponse } from '../../shared/fetch-timeout.js';

const DEFAULT_BASE_URL = 'http://localhost:11434';

function baseUrlOf(baseUrl) {
  return (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

// No API key: Ollama is an unauthenticated local server.
export async function call({ model, baseUrl }, userText, systemPrompt) {
  const response = await fetchWithTimeout(`${baseUrlOf(baseUrl)}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
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

  if (!response.ok) throw await errorForResponse(response);

  const data = await response.json();
  const text = data.message?.content;
  if (!text) throw new Error('Model returned no text.');
  return text;
}

export async function listModels({ baseUrl }) {
  const response = await fetchWithTimeout(`${baseUrlOf(baseUrl)}/api/tags`, {}, 15000);
  if (!response.ok) throw await errorForResponse(response);
  const data = await response.json();
  return (data.models || []).map((m) => ({ id: m.name, label: m.name }));
}
