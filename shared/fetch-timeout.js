export async function fetchWithTimeout(url, options, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Maps a failed Response to a short, user-facing message. Callers still get the raw
// status/body in the thrown Error's `cause` for console debugging.
export async function errorForResponse(response) {
  let body = '';
  try {
    body = await response.text();
  } catch {
    // ignore — best-effort only
  }
  let message;
  if (response.status === 401 || response.status === 403) {
    message = 'Invalid API key.';
  } else if (response.status === 429) {
    message = 'Rate limited — try again shortly.';
  } else if (response.status >= 500) {
    message = 'Provider error — try again.';
  } else {
    message = `Request failed (${response.status}).`;
  }
  const err = new Error(message);
  err.cause = body;
  return err;
}
