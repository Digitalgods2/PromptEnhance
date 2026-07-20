import { AMPLIFY_PROMPT, STORAGE_KEY, MSG_AMPLIFY_TEXT, MSG_LIST_MODELS } from '../shared/constants.js';
import { stripCodeFence } from '../shared/strip-fence.js';
import * as anthropic from './providers/anthropic.js';
import * as openai from './providers/openai.js';
import * as google from './providers/google.js';
import * as openrouter from './providers/openrouter.js';
import * as ollama from './providers/ollama.js';

const ADAPTERS = { anthropic, openai, google, openrouter, ollama };
// Ollama is a local, unauthenticated server — every other provider needs a key.
const KEY_OPTIONAL_PROVIDERS = new Set(['ollama']);
const KEEPALIVE_ALARM = 'promptenhance-keepalive';

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

// chrome.alarms firing is enough to keep the service worker alive; no work needed here.
chrome.alarms.onAlarm.addListener(() => {});

let activeRequests = 0;

function startKeepalive() {
  activeRequests += 1;
  if (activeRequests === 1) {
    chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.33 }); // ~20s
  }
}

function stopKeepalive() {
  activeRequests = Math.max(0, activeRequests - 1);
  if (activeRequests === 0) {
    chrome.alarms.clear(KEEPALIVE_ALARM);
  }
}

async function withKeepalive(fn) {
  startKeepalive();
  try {
    return await fn();
  } finally {
    stopKeepalive();
  }
}

async function handleAmplify(text) {
  const raw = (text || '').trim();
  if (!raw) {
    return { ok: false, error: 'Nothing to enhance.' };
  }

  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const config = stored[STORAGE_KEY];
  const keyRequired = !config || !KEY_OPTIONAL_PROVIDERS.has(config.provider);
  if (!config || !config.provider || !config.model?.trim() || (keyRequired && !config.apiKey?.trim())) {
    return { ok: false, error: 'No model configured — open the extension Options.' };
  }

  const adapter = ADAPTERS[config.provider];
  if (!adapter) {
    return { ok: false, error: `Unknown provider "${config.provider}".` };
  }

  return withKeepalive(async () => {
    try {
      const rawResult = await adapter.call(
        {
          apiKey: (config.apiKey || '').trim(),
          model: config.model.trim(),
          baseUrl: (config.baseUrl || '').trim(),
        },
        raw,
        AMPLIFY_PROMPT
      );
      const enhanced = stripCodeFence(rawResult);
      if (!enhanced) {
        return { ok: false, error: 'Model returned nothing.' };
      }
      return { ok: true, result: enhanced };
    } catch (err) {
      console.error('[PromptEnhance] amplify failed', err, err?.cause);
      return { ok: false, error: err?.message || 'Request failed.' };
    }
  });
}

async function handleListModels({ provider, apiKey, baseUrl }) {
  const adapter = ADAPTERS[provider];
  if (!adapter || !adapter.listModels) {
    return { ok: false, error: 'This provider does not support listing models.' };
  }

  return withKeepalive(async () => {
    try {
      const models = await adapter.listModels({ apiKey: (apiKey || '').trim(), baseUrl: (baseUrl || '').trim() });
      if (!models || !models.length) {
        return { ok: false, error: 'No models returned.' };
      }
      return { ok: true, models };
    } catch (err) {
      console.error('[PromptEnhance] listModels failed', err, err?.cause);
      return { ok: false, error: err?.message || 'Failed to list models.' };
    }
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message) return undefined;
  if (message.type === MSG_AMPLIFY_TEXT) {
    handleAmplify(message.text).then(sendResponse);
    return true; // keep the async sendResponse channel open
  }
  if (message.type === MSG_LIST_MODELS) {
    handleListModels(message).then(sendResponse);
    return true;
  }
  return undefined;
});
