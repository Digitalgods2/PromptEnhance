import { fetchWithTimeout, errorForResponse } from '../../shared/fetch-timeout.js';

export async function call({ apiKey, model }, userText, systemPrompt) {
  const response = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
      // Optional attribution header OpenRouter's docs mention for their leaderboard; harmless if ignored.
      'X-Title': 'PromptEnhance',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText },
      ],
    }),
  });

  if (!response.ok) throw await errorForResponse(response);

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Model returned no text.');
  return text;
}

// OpenRouter's model catalogue is public — no auth needed to list it.
export async function listModels() {
  const response = await fetchWithTimeout('https://openrouter.ai/api/v1/models', {}, 15000);

  if (!response.ok) throw await errorForResponse(response);

  const data = await response.json();
  return (data.data || []).map((m) => ({ id: m.id, label: m.name || m.id }));
}
