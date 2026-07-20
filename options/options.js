import { STORAGE_KEY, MSG_LIST_MODELS } from '../shared/constants.js';

const MODEL_HINTS = {
  anthropic: 'Free-text model id, e.g. claude-opus-4-8',
  openai: 'Free-text model id, e.g. gpt-5.1',
  google: 'Free-text model id, e.g. gemini-3-pro',
  openrouter: 'Needs a vendor prefix, e.g. anthropic/claude-opus-4-8',
  ollama: 'Model name as shown by `ollama list`, e.g. llama3.1:8b',
};

const KEY_OPTIONAL_PROVIDERS = new Set(['ollama']);

const form = document.getElementById('config-form');
const providerEl = document.getElementById('provider');
const baseUrlRowEl = document.getElementById('baseUrl-row');
const baseUrlEl = document.getElementById('baseUrl');
const apiKeyLabelEl = document.getElementById('apiKey-label');
const apiKeyEl = document.getElementById('apiKey');
const toggleKeyEl = document.getElementById('toggle-key');
const modelEl = document.getElementById('model');
const modelOptionsEl = document.getElementById('model-options');
const modelHintEl = document.getElementById('model-hint');
const modelsStatusEl = document.getElementById('models-status');
const refreshModelsEl = document.getElementById('refresh-models');
const statusEl = document.getElementById('status');

let fetchDebounce;

function updateFieldVisibility() {
  const provider = providerEl.value;
  const isOllama = provider === 'ollama';
  baseUrlRowEl.classList.toggle('hidden', !isOllama);
  // Ollama itself needs no key, but the field stays visible (just not required) since
  // some local setups put Ollama behind a reverse-proxy that expects a bearer token here.
  apiKeyLabelEl.textContent = isOllama ? 'API key (optional)' : 'API key';
  modelHintEl.textContent = MODEL_HINTS[provider] || '';
}

function hasCredentials() {
  const provider = providerEl.value;
  if (KEY_OPTIONAL_PROVIDERS.has(provider)) return true;
  return apiKeyEl.value.trim().length > 0;
}

function populateModelOptions(models) {
  modelOptionsEl.innerHTML = '';
  for (const m of models) {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.label = m.label && m.label !== m.id ? m.label : '';
    modelOptionsEl.appendChild(opt);
  }
}

async function fetchModels({ silent } = {}) {
  if (!hasCredentials()) {
    if (!silent) {
      modelsStatusEl.textContent = 'Enter an API key first.';
      modelsStatusEl.classList.add('error');
    }
    return;
  }

  modelsStatusEl.classList.remove('error');
  modelsStatusEl.textContent = 'Loading models…';

  const response = await chrome.runtime.sendMessage({
    type: MSG_LIST_MODELS,
    provider: providerEl.value,
    apiKey: apiKeyEl.value,
    baseUrl: baseUrlEl.value,
  });

  if (!response || !response.ok) {
    populateModelOptions([]);
    modelsStatusEl.textContent = response?.error || 'Failed to load models.';
    modelsStatusEl.classList.add('error');
    return;
  }

  populateModelOptions(response.models);
  modelsStatusEl.classList.remove('error');
  modelsStatusEl.textContent = `${response.models.length} model${response.models.length === 1 ? '' : 's'} available.`;
}

function scheduleFetch() {
  clearTimeout(fetchDebounce);
  fetchDebounce = setTimeout(() => fetchModels({ silent: true }), 500);
}

async function load() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const config = stored[STORAGE_KEY] || {};
  providerEl.value = config.provider || 'anthropic';
  modelEl.value = config.model || '';
  apiKeyEl.value = config.apiKey || '';
  baseUrlEl.value = config.baseUrl || '';
  updateFieldVisibility();
  if (hasCredentials()) fetchModels({ silent: true });
}

providerEl.addEventListener('change', () => {
  updateFieldVisibility();
  populateModelOptions([]);
  modelsStatusEl.textContent = '';
  if (hasCredentials()) fetchModels({ silent: true });
});

apiKeyEl.addEventListener('input', scheduleFetch);
baseUrlEl.addEventListener('input', scheduleFetch);
refreshModelsEl.addEventListener('click', () => fetchModels());

toggleKeyEl.addEventListener('click', () => {
  const show = apiKeyEl.type === 'password';
  apiKeyEl.type = show ? 'text' : 'password';
  toggleKeyEl.textContent = show ? 'Hide' : 'Show';
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const provider = providerEl.value;
  const model = modelEl.value.trim();
  const apiKey = apiKeyEl.value.trim();
  const baseUrl = baseUrlEl.value.trim();
  const keyRequired = !KEY_OPTIONAL_PROVIDERS.has(provider);

  if (!model || (keyRequired && !apiKey)) {
    statusEl.textContent = keyRequired ? 'Model and API key are required.' : 'Model is required.';
    statusEl.classList.add('error');
    return;
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: { provider, model, apiKey, baseUrl } });
  statusEl.classList.remove('error');
  statusEl.textContent = 'Saved.';
  setTimeout(() => { statusEl.textContent = ''; }, 2000);
});

load();
