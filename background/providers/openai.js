import { fetchWithTimeout, errorForResponse } from '../../shared/fetch-timeout.js';

export async function call({ apiKey, model }, userText, systemPrompt) {
  const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
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

// OpenAI's /v1/models list includes embeddings/audio/image/moderation models alongside
// chat models — filter those out so the dropdown only shows models this feature can use.
const NON_CHAT = /embedding|whisper|tts|dall-e|moderation|davinci-002|babbage-002/i;

export async function listModels({ apiKey }) {
  const response = await fetchWithTimeout('https://api.openai.com/v1/models', {
    headers: { authorization: `Bearer ${apiKey}` },
  }, 15000);

  if (!response.ok) throw await errorForResponse(response);

  const data = await response.json();
  return (data.data || [])
    .filter((m) => !NON_CHAT.test(m.id))
    .map((m) => ({ id: m.id, label: m.id }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
