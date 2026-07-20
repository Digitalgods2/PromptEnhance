// Port of _strip_fence from gangof8/service.py: drop a wrapping ``` code fence if the
// model added one, so the field gets the clean prompt.
export function stripCodeFence(text) {
  let s = (text || '').trim();
  if (s.startsWith('```')) {
    const lines = s.split('\n');
    lines.shift(); // opening ``` or ```lang
    if (lines.length && lines[lines.length - 1].trim().startsWith('```')) {
      lines.pop();
    }
    s = lines.join('\n');
  }
  return s.trim();
}
