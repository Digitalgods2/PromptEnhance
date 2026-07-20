import { fetchWithTimeout, errorForResponse } from '../../shared/fetch-timeout.js';

export async function call({ apiKey, model }, userText, systemPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
    }),
  });

  if (!response.ok) throw await errorForResponse(response);

  const data = await response.json();
  const candidate = data.candidates?.[0];
  if (!candidate || candidate.finishReason === 'SAFETY') {
    throw new Error('Model declined to respond.');
  }
  const text = candidate.content?.parts?.[0]?.text;
  if (!text) throw new Error('Model returned no text.');
  return text;
}

export async function listModels({ apiKey }) {
  const response = await fetchWithTimeout('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', {
    headers: { 'x-goog-api-key': apiKey },
  }, 15000);

  if (!response.ok) throw await errorForResponse(response);

  const data = await response.json();
  return (data.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => ({ id: (m.name || '').replace(/^models\//, ''), label: m.displayName || m.name }));
}
