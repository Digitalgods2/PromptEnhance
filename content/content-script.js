// Classic (non-module) content script — can't `import` shared/constants.js, so the one
// message type it needs is duplicated here. Keep in sync with shared/constants.js by hand.
(() => {
  const MSG_AMPLIFY_TEXT = 'AMPLIFY_TEXT';
  const MIN_SELECTION_LEN = 2;

  let shadowHost, shadowRoot, buttonEl;
  let capture = null; // the in-flight selection capture, or null
  let lastMouseUp = { x: 0, y: 0 };
  let hideTimer = null;

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function getDeepActiveElement() {
    let el = document.activeElement;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) {
      el = el.shadowRoot.activeElement;
    }
    return el;
  }

  function isFormTextControl(el) {
    if (!el) return false;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName === 'INPUT') {
      const type = (el.type || 'text').toLowerCase();
      return ['text', 'search', 'url', 'email', 'tel'].includes(type);
    }
    return false;
  }

  function captureSelection() {
    const el = getDeepActiveElement();
    if (!el) return null;

    if (isFormTextControl(el)) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      if (start == null || end == null || end - start < MIN_SELECTION_LEN) return null;
      return { kind: 'form', el, start, end, text: el.value.substring(start, end) };
    }

    if (el.isContentEditable) {
      const root = el.getRootNode();
      const selection = root.getSelection ? root.getSelection() : window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
      const text = selection.toString();
      if (text.length < MIN_SELECTION_LEN) return null;
      return { kind: 'editable', el, range: selection.getRangeAt(0).cloneRange(), text };
    }

    return null;
  }

  function ensureUI() {
    if (shadowHost) return;
    shadowHost = document.createElement('div');
    shadowHost.style.position = 'fixed';
    shadowHost.style.top = '0';
    shadowHost.style.left = '0';
    shadowHost.style.zIndex = '2147483647';
    shadowRoot = shadowHost.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = `
      .btn {
        position: fixed;
        display: none;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border-radius: 999px;
        background: #7c3aed;
        color: #fff;
        font: 600 12px/1.2 -apple-system, Segoe UI, sans-serif;
        border: none;
        cursor: pointer;
        box-shadow: 0 2px 10px rgba(0,0,0,.25);
        user-select: none;
      }
      .btn.visible { display: inline-flex; }
      .btn:hover { background: #6d28d9; }
      .btn[data-state="loading"] { cursor: default; opacity: .85; }
      .btn[data-state="error"] { background: #dc2626; }
      .spinner {
        width: 10px; height: 10px;
        border: 2px solid rgba(255,255,255,.4);
        border-top-color: #fff;
        border-radius: 50%;
        animation: spin .6s linear infinite;
        display: none;
      }
      .btn[data-state="loading"] .spinner { display: inline-block; }
      .btn[data-state="loading"] .label { display: none; }
      @keyframes spin { to { transform: rotate(360deg); } }
    `;

    buttonEl = document.createElement('button');
    buttonEl.className = 'btn';
    buttonEl.type = 'button';
    buttonEl.dataset.state = 'idle';
    buttonEl.innerHTML = '<span class="spinner"></span><span class="label">✨ Enhance</span>';

    // Prevent the button from stealing focus, which would blur the source field and
    // collapse the selection before our click handler ever runs.
    buttonEl.addEventListener('mousedown', (e) => e.preventDefault());
    buttonEl.addEventListener('click', onEnhanceClick);

    shadowRoot.appendChild(style);
    shadowRoot.appendChild(buttonEl);
    document.documentElement.appendChild(shadowHost);
  }

  function showButtonAt(x, y) {
    ensureUI();
    clearTimeout(hideTimer);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.min(Math.max(8, x), vw - 120);
    const top = Math.min(Math.max(8, y), vh - 40);
    buttonEl.style.left = `${left}px`;
    buttonEl.style.top = `${top}px`;
    buttonEl.dataset.state = 'idle';
    buttonEl.querySelector('.label').textContent = '✨ Enhance';
    buttonEl.classList.add('visible');
  }

  function hideButton() {
    if (!buttonEl) return;
    buttonEl.classList.remove('visible');
  }

  function setButtonState(state, label) {
    if (!buttonEl) return;
    buttonEl.dataset.state = state;
    if (label) buttonEl.querySelector('.label').textContent = label;
  }

  function onSelectionEvent(e) {
    if (buttonEl && e.composedPath && e.composedPath().includes(shadowHost)) return;
    const found = captureSelection();
    if (!found) {
      hideButton();
      return;
    }
    capture = found;
    if (found.kind === 'editable') {
      const rect = found.range.getBoundingClientRect();
      showButtonAt(rect.right + 6, rect.top - 6);
    } else {
      showButtonAt(lastMouseUp.x + 8, lastMouseUp.y - 34);
    }
  }

  document.addEventListener('mouseup', (e) => {
    lastMouseUp = { x: e.clientX, y: e.clientY };
    onSelectionEvent(e);
  }, true);
  document.addEventListener('keyup', onSelectionEvent, true);
  document.addEventListener('selectionchange', debounce(onSelectionEvent, 250), true);
  document.addEventListener('scroll', hideButton, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideButton();
  }, true);
  document.addEventListener('mousedown', (e) => {
    if (buttonEl && e.composedPath().includes(shadowHost)) return;
    hideButton();
  }, true);

  function replaceWithNativeSetter(el, newText, capturedStart, capturedEnd) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    const before = el.value.slice(0, capturedStart);
    const after = el.value.slice(capturedEnd);
    setter.call(el, before + newText + after);
    el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: newText }));
    el.setSelectionRange(capturedStart + newText.length, capturedStart + newText.length);
  }

  function replaceInForm(cap, newText) {
    const { el, start, end, text } = cap;
    if (!document.contains(el)) throw new Error('Field is gone.');
    if (el.value.substring(start, end) !== text) throw new Error('Selection changed.');
    el.focus();
    el.setSelectionRange(start, end);
    const ok = document.execCommand('insertText', false, newText);
    if (!ok) replaceWithNativeSetter(el, newText, start, end);
  }

  function replaceInEditable(cap, newText) {
    const { el, range, text } = cap;
    if (!document.contains(el)) throw new Error('Field is gone.');
    if (range.toString() !== text) throw new Error('Selection changed.');
    el.focus();
    const root = el.getRootNode();
    const selection = root.getSelection ? root.getSelection() : window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    const ok = document.execCommand('insertText', false, newText);
    if (!ok) {
      // Fallback: manual DOM edit. Loses native undo, so no extra affordance is built for
      // this rare path beyond leaving the original selection text visible in the error.
      range.deleteContents();
      range.insertNode(document.createTextNode(newText));
      el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: newText }));
    }
  }

  async function onEnhanceClick() {
    if (!capture || buttonEl.dataset.state === 'loading') return;
    const cap = capture;
    setButtonState('loading');

    let response;
    try {
      response = await chrome.runtime.sendMessage({ type: MSG_AMPLIFY_TEXT, text: cap.text });
    } catch (err) {
      setButtonState('error', 'Reload page');
      hideTimer = setTimeout(hideButton, 3000);
      return;
    }

    if (!response || !response.ok) {
      setButtonState('error', response?.error || 'Failed');
      hideTimer = setTimeout(hideButton, 3000);
      return;
    }

    try {
      if (cap.kind === 'form') {
        replaceInForm(cap, response.result);
      } else {
        replaceInEditable(cap, response.result);
      }
      setButtonState('idle', '✓ Enhanced');
      hideTimer = setTimeout(hideButton, 1200);
    } catch (err) {
      setButtonState('error', err.message || 'Failed');
      hideTimer = setTimeout(hideButton, 3000);
    }
  }
})();
