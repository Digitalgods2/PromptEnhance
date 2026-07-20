import { fetchWithTimeout, errorForResponse } from '../../shared/fetch-timeout.js';

export async function call({ apiKey, model }, userText, systemPrompt) {
  const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // Anthropic's API guards against browser-origin calls unless this opts in —
      // the same header the official JS SDK sends with dangerouslyAllowBrowser: true.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userText }],
    }),
  });

  if (!response.ok) throw await errorForResponse(response);

  const data = await response.json();
  const block = (data.content || []).find((b) => b.type === 'text');
  if (!block || !block.text) throw new Error('Model returned no text.');
  return block.text;
}

export async function listModels({ apiKey }) {
  const response = await fetchWithTimeout('https://api.anthropic.com/v1/models?limit=1000', {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
  }, 15000);

  if (!response.ok) throw await errorForResponse(response);

  const data = await response.json();
  return (data.data || []).map((m) => ({ id: m.id, label: m.display_name || m.id }));
}
