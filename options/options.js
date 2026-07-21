import { STORAGE_KEY, MSG_LIST_MODELS } from '../shared/constants.js';

const MODEL_HINTS = {
  anthropic: 'Pick a model below, or switch to Custom to type an id yourself.',
  openai: 'Pick a model below, or switch to Custom to type an id yourself.',
  google: 'Pick a model below, or switch to Custom to type an id yourself.',
  openrouter: 'Needs a vendor prefix if typed manually, e.g. anthropic/claude-opus-4-8.',
  ollama: 'Model name as shown by `ollama list`, e.g. llama3.1:8b.',
  lmstudio: 'Model id as shown in LM Studio’s "My Models" / Local Server tab.',
};

// Local, unauthenticated servers: no API key required, and they get a Base URL field
// pre-filled with a real default value the first time each is selected.
const KEY_OPTIONAL_PROVIDERS = new Set(['ollama', 'lmstudio']);
const LOCAL_PROVIDERS = new Set(['ollama', 'lmstudio']);
const DEFAULT_BASE_URLS = {
  ollama: 'http://localhost:11434',
  lmstudio: 'http://localhost:1234',
};

const CUSTOM_VALUE = '__custom__';

const form = document.getElementById('config-form');
const providerEl = document.getElementById('provider');
const baseUrlRowEl = document.getElementById('baseUrl-row');
const baseUrlEl = document.getElementById('baseUrl');
const apiKeyLabelEl = document.getElementById('apiKey-label');
const apiKeyEl = document.getElementById('apiKey');
const toggleKeyEl = document.getElementById('toggle-key');
const modelSelectEl = document.getElementById('model-select');
const modelCustomEl = document.getElementById('model-custom');
const modelHintEl = document.getElementById('model-hint');
const modelsStatusEl = document.getElementById('models-status');
const refreshModelsEl = document.getElementById('refresh-models');
const statusEl = document.getElementById('status');

let fetchDebounce;
// Each provider's own {model, apiKey, baseUrl} — keyed by provider, so switching the
// dropdown shows that provider's own saved settings instead of whatever was last typed
// in for a different provider.
let byProvider = {};
let lastFetchedModels = [];

function updateFieldVisibility() {
  const provider = providerEl.value;
  const isLocal = LOCAL_PROVIDERS.has(provider);
  baseUrlRowEl.classList.toggle('hidden', !isLocal);
  apiKeyLabelEl.textContent = isLocal ? 'API key (optional)' : 'API key';
  modelHintEl.textContent = MODEL_HINTS[provider] || '';
}

function currentModelValue() {
  return modelSelectEl.value === CUSTOM_VALUE ? modelCustomEl.value.trim() : modelSelectEl.value;
}

function appendCustomOption() {
  const customOpt = document.createElement('option');
  customOpt.value = CUSTOM_VALUE;
  customOpt.textContent = 'Custom (type manually)…';
  modelSelectEl.appendChild(customOpt);
}

// Rebuilds the <select> from a fetched model list (always includes a trailing "Custom"
// entry), then re-applies whichever model value was previously in effect: selected in
// the dropdown if it's on the new list, otherwise shown in the custom text field so
// nothing typed/saved is silently lost just because a refresh didn't include it.
function populateModelSelect(models) {
  lastFetchedModels = models;
  const value = currentModelValue();

  modelSelectEl.innerHTML = '';
  for (const m of models) {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.label && m.label !== m.id ? `${m.id} — ${m.label}` : m.id;
    modelSelectEl.appendChild(opt);
  }
  appendCustomOption();

  applyModelValue(value);
}

function applyModelValue(value) {
  const isKnown = value && lastFetchedModels.some((m) => m.id === value);
  if (isKnown) {
    modelSelectEl.value = value;
    modelCustomEl.classList.add('hidden');
  } else {
    modelSelectEl.value = CUSTOM_VALUE;
    modelCustomEl.classList.remove('hidden');
    modelCustomEl.value = value || '';
  }
}

modelSelectEl.addEventListener('change', () => {
  modelCustomEl.classList.toggle('hidden', modelSelectEl.value !== CUSTOM_VALUE);
  if (modelSelectEl.value === CUSTOM_VALUE) modelCustomEl.focus();
});

// Populates the form from this provider's own saved settings (blank if never
// configured), pre-filling a real default Base URL for local providers rather than
// leaving it empty — so the field visibly shows what will actually be used. The model
// starts as "Custom" showing the saved value; fetchModels() (triggered right after, if
// credentials are present) replaces it with the real list and selects it properly if
// it's on there.
function loadProviderFields(provider) {
  const saved = byProvider[provider] || {};
  apiKeyEl.value = saved.apiKey || '';
  baseUrlEl.value = saved.baseUrl || (LOCAL_PROVIDERS.has(provider) ? DEFAULT_BASE_URLS[provider] : '') || '';
  lastFetchedModels = [];
  modelSelectEl.innerHTML = '';
  appendCustomOption();
  applyModelValue(saved.model || '');
  updateFieldVisibility();
}

function hasCredentials() {
  const provider = providerEl.value;
  if (KEY_OPTIONAL_PROVIDERS.has(provider)) return true;
  return apiKeyEl.value.trim().length > 0;
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
    modelsStatusEl.textContent = response?.error || 'Failed to load models.';
    modelsStatusEl.classList.add('error');
    return;
  }

  populateModelSelect(response.models);
  modelsStatusEl.classList.remove('error');
  modelsStatusEl.textContent = `${response.models.length} model${response.models.length === 1 ? '' : 's'} available.`;
}

function scheduleFetch() {
  clearTimeout(fetchDebounce);
  fetchDebounce = setTimeout(() => fetchModels({ silent: true }), 500);
}

async function load() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const root = stored[STORAGE_KEY] || {};
  byProvider = root.byProvider || {};
  providerEl.value = root.provider || 'anthropic';
  loadProviderFields(providerEl.value);
  if (hasCredentials()) fetchModels({ silent: true });
}

providerEl.addEventListener('change', () => {
  loadProviderFields(providerEl.value);
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
  const model = currentModelValue();
  const apiKey = apiKeyEl.value.trim();
  const baseUrl = baseUrlEl.value.trim();
  const keyRequired = !KEY_OPTIONAL_PROVIDERS.has(provider);

  if (!model || (keyRequired && !apiKey)) {
    statusEl.textContent = keyRequired ? 'Model and API key are required.' : 'Model is required.';
    statusEl.classList.add('error');
    return;
  }

  byProvider = { ...byProvider, [provider]: { model, apiKey, baseUrl } };
  await chrome.storage.local.set({ [STORAGE_KEY]: { provider, byProvider } });
  statusEl.classList.remove('error');
  statusEl.textContent = 'Saved.';
  setTimeout(() => { statusEl.textContent = ''; }, 2000);
});

load();
