import { fetchWithTimeout, errorForResponse } from '../../shared/fetch-timeout.js';

const DEFAULT_BASE_URL = 'http://localhost:1234';

function baseUrlOf(baseUrl) {
  return (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

// LM Studio's local server is OpenAI-compatible (same /v1/chat/completions and
// /v1/models shapes) and doesn't validate the API key, so any placeholder works.
export async function call({ model, baseUrl }, userText, systemPrompt) {
  const response = await fetchWithTimeout(`${baseUrlOf(baseUrl)}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer lm-studio',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText },
      ],
      // Best-effort: LM Studio forwards this into the Jinja chat template for models
      // (e.g. Qwen3) whose template checks it. Ignored harmlessly otherwise —
      // shared/strip-thinking.js is the guaranteed fallback.
      chat_template_kwargs: { enable_thinking: false },
    }),
  }, 300000); // local inference has no SLA — allow up to 5 minutes for cold-start/slow hardware

  if (!response.ok) throw await errorForResponse(response);

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Model returned no text.');
  return text;
}

export async function listModels({ baseUrl }) {
  const response = await fetchWithTimeout(`${baseUrlOf(baseUrl)}/v1/models`, {
    headers: { authorization: 'Bearer lm-studio' },
  }, 15000);

  if (!response.ok) throw await errorForResponse(response);

  const data = await response.json();
  return (data.data || []).map((m) => ({ id: m.id, label: m.id }));
}
