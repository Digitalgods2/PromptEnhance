# PromptEnhance

Select text in any editable field on any web page — a chat box, a form, anything —
click the ✨ **Enhance** button that appears, and the selection is rewritten in place
into a sharper prompt. Runs entirely as a browser extension; no local server required.
You bring your own API key for whichever provider you want to use (or point it at a
local Ollama or LM Studio install for a fully offline setup).

Supported providers: **Anthropic (Claude), OpenAI, Google (Gemini), OpenRouter, Ollama,
LM Studio**.

📺 **[Watch a demo video](https://youtu.be/BFCDv93I3a4)**

## Requirements

- A Chromium-based browser: Google Chrome, Microsoft Edge, or Brave all work the same
  way. (Firefox is not supported — this extension uses Manifest V3 APIs.)
- An API key for whichever cloud provider you choose, **or** a local
  [Ollama](https://ollama.com) or [LM Studio](https://lmstudio.ai) install if you'd
  rather run models on your own machine.

## Load the extension

These steps are the same on every platform — only *where* the browser's menu lives
differs slightly.

1. Open your browser and go to the extensions page:
   - **Chrome:** `chrome://extensions`
   - **Edge:** `edge://extensions`
   - **Brave:** `brave://extensions`
2. Turn on **Developer mode** (a toggle, usually top-right of the page).
3. Click **Load unpacked**.
4. In the file picker, select this project's folder (the one containing
   `manifest.json` — e.g. `PromptEnhance/`, wherever you placed it on disk).
5. PromptEnhance should now show up in your extensions list and in the toolbar
   (pin it via the puzzle-piece icon if you don't see it).

### Platform notes for step 4 (file picker)

- **Windows (default):** browse to wherever you saved the folder, e.g.
  `C:\Users\<you>\Desktop\PromptEnhance`.
- **macOS:** same dialog, just a macOS-style file picker — e.g.
  `/Users/<you>/Desktop/PromptEnhance` or wherever you cloned/unzipped it.
- **Linux:** same idea — e.g. `/home/<you>/PromptEnhance`. If Chrome was installed via
  Flatpak or Snap, its file picker may only show folders under your home directory by
  default; keep the project there, or grant the sandboxed browser access to wherever
  you placed it.

There is no build step — the folder is loaded as-is.

## Configure a provider

1. Click the PromptEnhance toolbar icon (or right-click it → **Options**).
2. Pick a **Provider**.
3. Enter a **Model** — this is a free-text field backed by a dropdown of suggestions;
   click **Refresh models** (or just enter your API key) to populate it from the
   provider's live model list, or type a model id yourself if you already know it.
4. Enter your **API key** (not needed for Ollama or LM Studio — see below).
5. Click **Save**.

Each provider remembers its own Model/API key/Base URL independently — switching the
Provider dropdown loads that provider's own saved settings (pre-filling a sensible
default Base URL the first time you pick a local provider) rather than showing
whatever was last typed in for a different provider.

Keys are stored locally in the browser's extension storage — they are never sent
anywhere except directly to the provider's own API.

### Using Ollama instead of a cloud API

Ollama runs models locally, so there's no key and nothing leaves your machine.

1. Install Ollama:
   - **Windows / macOS:** download the installer from [ollama.com/download](https://ollama.com/download).
   - **Linux:** `curl -fsSL https://ollama.com/install.sh | sh`
2. Pull a model, e.g. `ollama pull llama3.1:8b`.
3. Make sure the Ollama server is running (the installer starts it automatically on
   Windows/macOS; on Linux it typically runs as a systemd service — `systemctl status
   ollama` to check, or run `ollama serve` manually).
4. In PromptEnhance's Options, set Provider to **Ollama (local)**. The default
   **Base URL** of `http://localhost:11434` works for a standard local install — only
   change it if you've configured Ollama to listen elsewhere.
5. Click **Refresh models** to list what you've pulled, pick one, Save.

### Using LM Studio instead of a cloud API

LM Studio also runs models locally with no key required — its built-in server just
speaks the same API shape as OpenAI, so it plugs in the same way Ollama does.

1. Install LM Studio from [lmstudio.ai](https://lmstudio.ai) (Windows, macOS, and
   Linux builds are all available from the same download page).
2. Download a model inside LM Studio (the "Discover" / search tab).
3. Start the local server: in LM Studio, go to the **Local Server** (or "Developer")
   tab, load the model you downloaded, and click **Start Server**. It listens on
   `http://localhost:1234` by default.
4. In PromptEnhance's Options, set Provider to **LM Studio (local)**. The default
   **Base URL** of `http://localhost:1234` matches LM Studio's default — only change
   it if you've configured LM Studio to listen elsewhere.
5. Click **Refresh models** to list what's loaded, pick one, Save.

### Reasoning models and "thinking" tokens

Reasoning-capable models (DeepSeek-R1, Qwen3, QwQ, etc.) run locally through Ollama or
LM Studio sometimes leak their internal chain-of-thought straight into the response,
wrapped in a `<think>...</think>` block, ahead of the actual answer. PromptEnhance
asks the server not to think in the first place (best-effort, and only honored by
models/templates that support it), and as a guaranteed fallback strips any `<think>`,
`<thinking>`, or `<reasoning>` block from the response before it's inserted into your
page — so you shouldn't see this leak regardless of the model. Cloud providers aren't
affected: their reasoning is returned in a separate field the adapters already skip.

Confirmed working against a reasoning model in LM Studio; the same fallback applies to
Ollama but hasn't been separately verified there yet.

## Using it

1. Select text inside any textarea, input, or chat box (contenteditable) on any page.
2. A small ✨ **Enhance** button appears near your selection.
3. Click it. The button shows a loading spinner, then the selected text is replaced
   in place with the enhanced version.
4. If you don't like the result, **Ctrl+Z** (Cmd+Z on macOS) undoes it back to your
   original text, the same as any other edit in that field.

## After editing the code

There's no build/watch process. After changing any file, go back to the extensions
page and click the reload icon on the PromptEnhance card to pick up the changes. If
you edited `content/content-script.js`, also refresh any tab you're testing in.

## Timeouts

Each request the extension makes gives up after a fixed time and shows an error rather
than hanging forever. These are hardcoded per provider (in `background/providers/`),
not configurable from the UI:

| Provider | Enhance request | Model list |
| --- | --- | --- |
| Anthropic, OpenAI, Google, OpenRouter | 30 seconds | 15 seconds |
| Ollama, LM Studio | 5 minutes | 15 seconds |

Cloud providers get a short timeout because a healthy API should respond in a couple
seconds. Ollama and LM Studio get 5 minutes instead, since local inference has no
comparable SLA — a cold model load (reading multi-GB weights into memory) or
CPU-only generation can legitimately take minutes, especially for larger models. The
model-list fetch stays short everywhere, since that's just metadata the server should
already have on hand.

If you're regularly hitting the 5-minute local ceiling, that generally means the model
itself is too large/slow for your hardware for interactive use — try a smaller or
more quantized model rather than waiting it out.

## Troubleshooting

- **No button appears on selection:** make sure you're selecting inside an actual
  input/textarea/contenteditable element, not plain page text.
- **"No model configured" error:** open Options and make sure Provider, Model, and
  (if required) API key are all filled in and saved.
- **Model dropdown says "Failed to load models":** double check the API key, or for
  Ollama/LM Studio, that the local server is actually running (and its server tab
  started, for LM Studio) and reachable at the Base URL shown.
- **"Request timed out" error:** see [Timeouts](#timeouts) above for how long each
  provider is given before this fires.
- **Something else looks broken:** on the extensions page, click the "service worker"
  link on the PromptEnhance card to open its console, and check the page's own
  DevTools console (F12) for content-script errors.

---

Copyright © 2026 digitalgods.ai. All rights reserved.
