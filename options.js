// Tab Bankruptcy — options.js
// Settings page: model info, custom prompt, reading lists, mute toggle

const DEFAULT_PROMPT = 'You are a witty, slightly roasty productivity coach. Names must make users laugh or wince in recognition. Avoid: "Work", "Shopping", "Misc" unless ironic. Use pop culture, puns, self-deprecation.';

let LLM = null; // populated lazily via dynamic import on first use

async function loadLlm() {
  if (LLM) return LLM;
  LLM = await import(chrome.runtime.getURL('lib/llm/index.js'));
  return LLM;
}

const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', async () => {
  initPromptEditor();
  initMuteToggle();
  initThemeToggle();
  await initProviderConfig();
  await initWelcomeGate();
});

function initPromptEditor() {
  const textarea = $('custom-prompt');
  const btnSave = $('btn-save-prompt');
  const btnReset = $('btn-reset-prompt');
  const charCount = $('char-count');
  const previewBox = $('prompt-preview-box');
  const previewDetails = document.querySelector('.prompt-preview');

  function updateCharCount() {
    const len = textarea.value.length;
    if (charCount) charCount.textContent = `${len} / 1000`;
  }

  function updatePreview() {
    if (!previewBox) return;
    const val = textarea.value.trim();
    previewBox.textContent = val || DEFAULT_PROMPT;
  }

  // Load saved prompt
  chrome.storage.sync.get(['customPrompt'], (result) => {
    textarea.value = result.customPrompt || DEFAULT_PROMPT;
    updateCharCount();
    updatePreview();
  });

  textarea.addEventListener('input', () => {
    updateCharCount();
    updatePreview();
  });

  btnSave.addEventListener('click', () => {
    const prompt = textarea.value.trim();
    chrome.storage.sync.set({ customPrompt: prompt }, () => {
      btnSave.textContent = 'Saved ✓';
      setTimeout(() => (btnSave.textContent = 'Save Prompt'), 1200);
    });
  });

  btnReset.addEventListener('click', () => {
    textarea.value = DEFAULT_PROMPT;
    updateCharCount();
    updatePreview();
    chrome.storage.sync.set({ customPrompt: DEFAULT_PROMPT });
  });

  // Open preview by default for discoverability (optional)
  if (previewDetails) {
    // leave collapsed by default; user can expand
  }
}

function initMuteToggle() {
  const toggle = $('mute-toggle');

  chrome.storage.sync.get(['muted'], (result) => {
    toggle.checked = !!result.muted;
  });

  toggle.addEventListener('change', () => {
    const muted = toggle.checked;
    chrome.storage.sync.set({ muted });
  });
}

function initThemeToggle() {
  const select = $('theme-select');
  const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');

  function applyTheme(theme) {
    let isLight;
    if (theme === 'light') {
      isLight = true;
    } else if (theme === 'dark') {
      isLight = false;
    } else {
      // system
      isLight = mediaQuery.matches;
    }
    if (isLight) {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
  }

  // Load saved theme (default to 'system')
  chrome.storage.sync.get(['theme'], (result) => {
    const theme = result.theme || 'system';
    select.value = theme;
    applyTheme(theme);
  });

  // Listen for changes
  select.addEventListener('change', () => {
    const theme = select.value;
    chrome.storage.sync.set({ theme }, () => {
      applyTheme(theme);
    });
  });

  // React to system preference changes when in 'system' mode
  mediaQuery.addEventListener('change', () => {
    chrome.storage.sync.get(['theme'], (result) => {
      if ((result.theme || 'system') === 'system') {
        applyTheme('system');
      }
    });
  });
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function initProviderConfig() {
  const { MODELS, PROVIDERS, PROVIDER_LABELS } = await loadLlm();

  const radios = document.querySelectorAll('input[name="provider"]');
  const puterConfig = $('puter-config');
  const byokConfig = $('byok-config');

  // Load saved provider
  const sync = await new Promise(r => chrome.storage.sync.get(null, r));
  const provider = sync.provider || 'puter';
  document.querySelector(`input[name="provider"][value="${provider}"]`).checked = true;
  toggleProviderSubsections(provider);

  radios.forEach(r => r.addEventListener('change', async () => {
    const v = document.querySelector('input[name="provider"]:checked').value;
    await new Promise(res => chrome.storage.sync.set({ provider: v }, res));
    toggleProviderSubsections(v);
    refreshFinishSetupGate();
  }));

  // Puter model dropdown
  const puterModelSelect = $('puter-model');
  puterModelSelect.innerHTML = '';
  for (const opt of MODELS.puter.options) {
    const o = document.createElement('option');
    o.value = opt.id; o.textContent = opt.label;
    puterModelSelect.appendChild(o);
  }
  puterModelSelect.value = sync.puterModel || MODELS.puter.default;
  puterModelSelect.addEventListener('change', () => {
    chrome.storage.sync.set({ puterModel: puterModelSelect.value });
  });

  // Puter sign-in/out
  await refreshPuterStatus();
  $('btn-puter-signin').addEventListener('click', async () => {
    if (!window.puter) { alert('Puter SDK not loaded'); return; }
    try {
      await window.puter.auth.signIn();
      await refreshPuterStatus();
      refreshFinishSetupGate();
    } catch (e) {
      alert('Sign-in failed: ' + (e?.message || e));
    }
  });
  $('btn-puter-signout').addEventListener('click', async () => {
    if (!window.puter) return;
    try {
      await window.puter.auth.signOut();
      await refreshPuterStatus();
      // If Puter was active, signing out invalidates setup
      if (provider === 'puter') {
        await new Promise(r => chrome.storage.sync.set({ setupComplete: false }, r));
      }
      refreshFinishSetupGate();
    } catch (e) {
      alert('Sign-out failed: ' + (e?.message || e));
    }
  });

  // Puter Test (uses testMode=true so no credit consumption)
  $('btn-puter-test').addEventListener('click', async () => {
    const resultEl = $('puter-test-result');
    resultEl.textContent = '…';
    try {
      if (!window.puter) throw new Error('Puter SDK not loaded');
      await window.puter.ai.chat([{role:'user', content:'ping'}], true, { model: puterModelSelect.value });
      resultEl.textContent = '✓ OK';
    } catch (e) {
      resultEl.textContent = '✗ ' + (e?.message || e);
    }
  });

  // BYOK cards
  await renderByokCards(MODELS, PROVIDERS, PROVIDER_LABELS, sync);
}

function toggleProviderSubsections(provider) {
  const puterConfig = $('puter-config');
  const byokConfig = $('byok-config');
  puterConfig.classList.toggle('hidden', provider !== 'puter');
  byokConfig.classList.toggle('hidden', provider !== 'byok');
}

async function refreshPuterStatus() {
  const text = $('puter-status-text');
  const signinBtn = $('btn-puter-signin');
  const signoutBtn = $('btn-puter-signout');
  if (!window.puter) {
    text.textContent = 'Puter SDK not loaded';
    return;
  }
  try {
    const isIn = await window.puter.auth.isSignedIn();
    if (isIn) {
      let username = '';
      try { username = (await window.puter.auth.getUser())?.username || ''; } catch {}
      text.textContent = username ? `Signed in as ${username}` : 'Signed in';
      signinBtn.classList.add('hidden');
      signoutBtn.classList.remove('hidden');
    } else {
      text.textContent = 'Not signed in';
      signinBtn.classList.remove('hidden');
      signoutBtn.classList.add('hidden');
    }
  } catch {
    text.textContent = 'Not signed in';
    signinBtn.classList.remove('hidden');
    signoutBtn.classList.add('hidden');
  }
}

async function renderByokCards(MODELS, PROVIDERS, PROVIDER_LABELS, sync) {
  const container = $('byok-cards');
  container.innerHTML = '';
  const local = await new Promise(r => chrome.storage.local.get(['apiKeys'], r));
  const apiKeys = local.apiKeys || {};
  const byokModels = sync.byokModels || {};
  const activeByokProvider = sync.byokProvider || 'xai';

  for (const provider of PROVIDERS) {
    const card = document.createElement('div');
    card.className = 'byok-card';
    const modelDefault = byokModels[provider] || MODELS[provider].default;
    card.innerHTML = `
      <div class="byok-card-header">
        <label class="byok-active">
          <input type="radio" name="byokProvider" value="${provider}" ${activeByokProvider === provider ? 'checked' : ''}>
          <strong>${PROVIDER_LABELS[provider]}</strong>
          <span class="byok-active-tag">active</span>
        </label>
      </div>
      <label class="byok-key-row">
        <span>API key</span>
        <span class="byok-key-input">
          <input type="password" data-provider="${provider}" class="byok-key" placeholder="(no key set)" value="${apiKeys[provider] || ''}">
          <button type="button" class="btn btn-text byok-show" data-provider="${provider}">show</button>
        </span>
      </label>
      <label class="byok-model-row">
        <span>Model</span>
        <select class="byok-model" data-provider="${provider}"></select>
      </label>
      <div class="byok-actions">
        <button type="button" class="btn btn-secondary byok-test" data-provider="${provider}">Test</button>
        <button type="button" class="btn btn-text byok-clear" data-provider="${provider}">Clear</button>
        <span class="test-result" data-provider="${provider}"></span>
      </div>
      <p class="hint">Keys never leave this device.</p>
    `;
    const sel = card.querySelector('.byok-model');
    for (const opt of MODELS[provider].options) {
      const o = document.createElement('option');
      o.value = opt.id; o.textContent = opt.label;
      sel.appendChild(o);
    }
    sel.value = modelDefault;
    container.appendChild(card);
  }

  // Wire all interactions
  container.querySelectorAll('.byok-key').forEach(input => {
    input.addEventListener('input', async () => {
      const p = input.dataset.provider;
      const local = await new Promise(r => chrome.storage.local.get(['apiKeys'], r));
      const keys = local.apiKeys || {};
      const v = input.value.trim();
      if (v) keys[p] = v; else delete keys[p];
      await new Promise(r => chrome.storage.local.set({ apiKeys: keys }, r));
      refreshFinishSetupGate();
      maybeFlipSetupCompleteFalse(p);
    });
  });
  container.querySelectorAll('.byok-show').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = container.querySelector(`.byok-key[data-provider="${btn.dataset.provider}"]`);
      input.type = input.type === 'password' ? 'text' : 'password';
      btn.textContent = input.type === 'password' ? 'show' : 'hide';
    });
  });
  container.querySelectorAll('.byok-model').forEach(sel => {
    sel.addEventListener('change', async () => {
      const p = sel.dataset.provider;
      const sync = await new Promise(r => chrome.storage.sync.get(['byokModels'], r));
      const m = sync.byokModels || {};
      m[p] = sel.value;
      await new Promise(r => chrome.storage.sync.set({ byokModels: m }, r));
    });
  });
  container.querySelectorAll('input[name="byokProvider"]').forEach(r => {
    r.addEventListener('change', async () => {
      const v = container.querySelector('input[name="byokProvider"]:checked').value;
      await new Promise(res => chrome.storage.sync.set({ byokProvider: v }, res));
      refreshFinishSetupGate();
    });
  });
  container.querySelectorAll('.byok-test').forEach(btn => {
    btn.addEventListener('click', async () => {
      const p = btn.dataset.provider;
      const result = container.querySelector(`.test-result[data-provider="${p}"]`);
      result.textContent = '…';
      try {
        const local = await new Promise(r => chrome.storage.local.get(['apiKeys'], r));
        const key = (local.apiKeys || {})[p];
        if (!key) throw new Error('No key set');
        const sync = await new Promise(r => chrome.storage.sync.get(['byokModels'], r));
        const model = (sync.byokModels || {})[p] || MODELS[p].default;
        await testByokConnection(p, key, model);
        result.textContent = '✓ OK';
      } catch (e) {
        result.textContent = '✗ ' + (e?.message || e);
      }
    });
  });
  container.querySelectorAll('.byok-clear').forEach(btn => {
    btn.addEventListener('click', async () => {
      const p = btn.dataset.provider;
      const local = await new Promise(r => chrome.storage.local.get(['apiKeys'], r));
      const keys = local.apiKeys || {};
      delete keys[p];
      await new Promise(r => chrome.storage.local.set({ apiKeys: keys }, r));
      const input = container.querySelector(`.byok-key[data-provider="${p}"]`);
      if (input) input.value = '';
      refreshFinishSetupGate();
      maybeFlipSetupCompleteFalse(p);
    });
  });
}

// Tiny 1-token call to verify a BYOK provider key works.
async function testByokConnection(provider, key, model) {
  const messages = [{ role: 'user', content: 'ping' }];
  if (provider === 'xai' || provider === 'openai') {
    const url = provider === 'xai'
      ? 'https://api.x.ai/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, max_tokens: 1 })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return;
  }
  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model, max_tokens: 1, messages })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return;
  }
  if (provider === 'google') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        generationConfig: { maxOutputTokens: 1 }
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return;
  }
  throw new Error(`Unknown provider: ${provider}`);
}

// If the user clears the key for the active BYOK provider, flip setupComplete=false.
async function maybeFlipSetupCompleteFalse(clearedProvider) {
  const sync = await new Promise(r => chrome.storage.sync.get(['provider', 'byokProvider'], r));
  if (sync.provider === 'byok' && sync.byokProvider === clearedProvider) {
    const local = await new Promise(r => chrome.storage.local.get(['apiKeys'], r));
    const k = (local.apiKeys || {})[clearedProvider];
    if (!k) {
      await new Promise(r => chrome.storage.sync.set({ setupComplete: false }, r));
    }
  }
}

async function initWelcomeGate() {
  const params = new URLSearchParams(window.location.search);
  const sync = await new Promise(r => chrome.storage.sync.get(['setupComplete'], r));
  const showWelcome = params.get('welcome') === '1' || !sync.setupComplete;
  $('welcome-section').classList.toggle('hidden', !showWelcome);
  refreshFinishSetupGate();

  $('btn-finish-setup').addEventListener('click', async () => {
    await new Promise(r => chrome.storage.sync.set({ setupComplete: true }, r));
    $('welcome-section').classList.add('hidden');
  });
}

async function refreshFinishSetupGate() {
  const btn = $('btn-finish-setup');
  const hint = $('finish-setup-hint');
  if (!btn) return;
  const sync = await new Promise(r => chrome.storage.sync.get(['provider', 'byokProvider'], r));
  const local = await new Promise(r => chrome.storage.local.get(['apiKeys'], r));
  const provider = sync.provider || 'puter';
  let valid = false;
  let why = '';
  if (provider === 'puter') {
    if (window.puter) {
      try { valid = await window.puter.auth.isSignedIn(); } catch {}
    }
    why = valid ? '' : 'Sign in to Puter to enable.';
  } else {
    const keys = local.apiKeys || {};
    const candidates = ['xai','openai','anthropic','google'].filter(p => !!keys[p]);
    if (candidates.length > 0) {
      // If active byokProvider has no key, auto-pick the first one with a key (Grok-preferred).
      const active = sync.byokProvider || 'xai';
      if (!keys[active]) {
        await new Promise(r => chrome.storage.sync.set({ byokProvider: candidates[0] }, r));
      }
      valid = true;
    }
    why = valid ? '' : 'Add at least one BYOK key to enable.';
  }
  btn.disabled = !valid;
  hint.textContent = why;
  hint.style.display = why ? '' : 'none';
}
