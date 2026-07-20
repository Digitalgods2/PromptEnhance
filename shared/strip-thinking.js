// Reasoning-capable models (esp. local ones via Ollama/LM Studio — DeepSeek-R1, Qwen3,
// QwQ, etc.) often leak their internal chain-of-thought straight into the response
// text, wrapped in a tag like <think>...</think>. Cloud providers return thinking in a
// separate field/content-block that the provider adapters already skip past, so this is
// mainly a local-model problem, but it's a harmless no-op if no such tag is present.
const THINK_TAGS = ['think', 'thinking', 'reasoning'];

export function stripThinking(text) {
  let s = text || '';

  // Well-formed <tag>...</tag> blocks.
  for (const tag of THINK_TAGS) {
    s = s.replace(new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`, 'gi'), '');
  }

  // Some servers apply the opening tag as part of the chat template's forced prefix
  // rather than generated text, so the model only emits the closing tag — leaving
  // everything up to it as an orphaned, unpaired reasoning block. Treat the text up to
  // the last such closing tag as thinking too.
  for (const tag of THINK_TAGS) {
    const closeTag = `</${tag}>`;
    const idx = s.toLowerCase().lastIndexOf(closeTag);
    if (idx !== -1) {
      s = s.slice(idx + closeTag.length);
    }
  }

  return s.trim();
}
