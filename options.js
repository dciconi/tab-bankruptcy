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

// Preserve a previously-saved <select> value if its <option> still exists;
// otherwise fall back to `fallback`. Lets us edit models.json freely without
// silently overwriting a user's still-valid selection.
function pickPreservedValue(selectEl, savedValue, fallback) {
  const exists = Array.from(selectEl.options).some(o => o.value === savedValue);
  return exists ? savedValue : fallback;
}

async function reconcileSetupComplete() {
  const sync = await new Promise(r => chrome.storage.sync.get(['provider', 'setupComplete'], r));
  if (sync.setupComplete === true) return; // already done

  // BYOK with at least one key -> considered set up.
  if (sync.provider === 'byok') {
    const local = await new Promise(r => chrome.storage.local.get(['byokKeys'], r));
    if (Array.isArray(local.byokKeys) && local.byokKeys.length > 0) {
      await new Promise(r => chrome.storage.sync.set({ setupComplete: true }, r));
      return;
    }
  }

  // Puter mode (default if unset) and signed in -> considered set up.
  if (sync.provider === 'puter' || !sync.provider) {
    if (typeof window !== 'undefined' && window.puter) {
      try {
        const isIn = await window.puter.auth.isSignedIn();
        if (isIn) {
          await new Promise(r => chrome.storage.sync.set({ setupComplete: true }, r));
          return;
        }
      } catch {}
    }
  }
  // Otherwise leave setupComplete falsy — popup gate will fire as expected.
}

document.addEventListener('DOMContentLoaded', async () => {
  initPromptEditor();
  initMuteToggle();
  initThemeToggle();
  await initProviderConfig();
  await reconcileSetupComplete();
  await initWelcomeGate();
  wireResetButton();
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
  }));

  // Puter model dropdown
  const puterModelSelect = $('puter-model');
  puterModelSelect.innerHTML = '';
  for (const opt of MODELS.puter.options) {
    const o = document.createElement('option');
    o.value = opt.id; o.textContent = opt.label;
    puterModelSelect.appendChild(o);
  }
  puterModelSelect.value = pickPreservedValue(puterModelSelect, sync.puterModel, MODELS.puter.default);
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
      if (await window.puter.auth.isSignedIn()) {
        await markSetupComplete();
      }
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

  // BYOK list
  await migrateByokSchema(MODELS, PROVIDER_LABELS);
  await renderByokList(MODELS, PROVIDERS, PROVIDER_LABELS);
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

// One-time migration from the v2 schema (apiKeys map + byokProvider + byokModels)
// to the new ordered byokKeys list. Safe to call repeatedly: returns immediately
// if byokKeys already exists or if there's nothing to migrate.
async function migrateByokSchema(MODELS, PROVIDER_LABELS) {
  const local = await new Promise(r => chrome.storage.local.get(null, r));
  if (Array.isArray(local.byokKeys)) return;

  const oldKeys = local.apiKeys || {};
  const present = Object.keys(oldKeys).filter(p => oldKeys[p]);
  if (present.length === 0) {
    // Nothing to migrate; initialize empty list and clear stale fields if any.
    await new Promise(r => chrome.storage.local.set({ byokKeys: [] }, r));
    await new Promise(r => chrome.storage.local.remove(['apiKeys', 'apiKeysVerified'], r));
    await new Promise(r => chrome.storage.sync.remove(['byokProvider', 'byokModels'], r));
    return;
  }

  const sync = await new Promise(r => chrome.storage.sync.get(['byokProvider', 'byokModels'], r));
  const oldActive = sync.byokProvider || present[0];
  const oldModels = sync.byokModels || {};
  const verified = local.apiKeysVerified || {};

  // Order: previously active provider first, others after in canonical order.
  const order = [oldActive, ...['xai', 'openai', 'anthropic', 'google'].filter(p => p !== oldActive)];
  const newKeys = order
    .filter(p => oldKeys[p])
    .map(p => ({
      id: newKeyId(),
      label: (PROVIDER_LABELS[p] || p) + ' key',
      provider: p,
      model: oldModels[p] || MODELS[p].default,
      key: oldKeys[p],
      status: verified[p] ? 'verified' : 'untested',
      lastTestedAt: verified[p] ? Date.now() : null,
      lastError: null
    }));

  await new Promise(r => chrome.storage.local.set({ byokKeys: newKeys }, r));
  await new Promise(r => chrome.storage.local.remove(['apiKeys', 'apiKeysVerified'], r));
  await new Promise(r => chrome.storage.sync.remove(['byokProvider', 'byokModels'], r));
}

function newKeyId() {
  return 'k_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

async function getByokKeys() {
  const local = await new Promise(r => chrome.storage.local.get(['byokKeys'], r));
  return Array.isArray(local.byokKeys) ? local.byokKeys : [];
}

async function setByokKeys(keys) {
  await new Promise(r => chrome.storage.local.set({ byokKeys: keys }, r));
}

const STATUS_BADGE = {
  verified:   { glyph: '✓', label: 'Working',  cls: 'status-verified' },
  failed:     { glyph: '✗', label: 'Failing',  cls: 'status-failed' },
  untested:   { glyph: '?', label: 'Untested', cls: 'status-untested' }
};

async function renderByokList(MODELS, PROVIDERS, PROVIDER_LABELS) {
  const list = $('byok-list');
  const empty = $('byok-empty');
  list.innerHTML = '';
  const keys = await getByokKeys();
  empty.classList.toggle('hidden', keys.length > 0);

  keys.forEach((k, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === keys.length - 1;
    const badge = STATUS_BADGE[k.status] || STATUS_BADGE.untested;
    const row = document.createElement('div');
    row.className = 'byok-row';
    row.dataset.id = k.id;
    row.innerHTML = `
      <div class="byok-row-reorder">
        <button type="button" class="btn-icon byok-up" title="Move up" ${isFirst ? 'disabled' : ''} aria-label="Move up">↑</button>
        <button type="button" class="btn-icon byok-down" title="Move down" ${isLast ? 'disabled' : ''} aria-label="Move down">↓</button>
      </div>
      <div class="byok-row-status">
        <span class="status-pill ${badge.cls}" title="${badge.label}">${badge.glyph}</span>
        ${isFirst ? '<span class="default-tag">default</span>' : ''}
      </div>
      <div class="byok-row-body">
        <div class="byok-row-label">${escapeText(k.label)}</div>
        <div class="byok-row-meta">${escapeText(PROVIDER_LABELS[k.provider] || k.provider)} · ${escapeText(k.model)}</div>
        ${k.status === 'failed' && k.lastError ? `<div class="byok-row-error">Last error: ${escapeText(k.lastError)}</div>` : ''}
      </div>
      <div class="byok-row-actions">
        <button type="button" class="btn btn-secondary byok-test-row">Test</button>
        <button type="button" class="btn btn-text byok-edit-row">Edit</button>
        <button type="button" class="btn btn-text byok-delete-row">Delete</button>
        <span class="test-result byok-row-result"></span>
      </div>
    `;
    row.querySelector('.byok-up').addEventListener('click', () => moveKey(k.id, -1, MODELS, PROVIDERS, PROVIDER_LABELS));
    row.querySelector('.byok-down').addEventListener('click', () => moveKey(k.id, +1, MODELS, PROVIDERS, PROVIDER_LABELS));
    row.querySelector('.byok-test-row').addEventListener('click', () => testRow(k.id, row, MODELS, PROVIDERS, PROVIDER_LABELS));
    row.querySelector('.byok-edit-row').addEventListener('click', () => openEditForm(k.id, MODELS, PROVIDERS, PROVIDER_LABELS));
    row.querySelector('.byok-delete-row').addEventListener('click', () => deleteKey(k.id, MODELS, PROVIDERS, PROVIDER_LABELS));
    list.appendChild(row);
  });

  // Wire the Add form once (idempotent — re-render keeps the form in DOM).
  if (!$('btn-byok-add').dataset.wired) {
    wireByokAddForm(MODELS, PROVIDERS, PROVIDER_LABELS);
    $('btn-byok-add').dataset.wired = '1';
  }
}

function escapeText(s) {
  const div = document.createElement('div');
  div.textContent = s == null ? '' : String(s);
  return div.innerHTML;
}

function wireByokAddForm(MODELS, PROVIDERS, PROVIDER_LABELS) {
  const form = $('byok-add-form');
  const btnAdd = $('btn-byok-add');
  const btnSave = $('btn-byok-save');
  const btnCancel = $('btn-byok-cancel');
  const providerSel = $('byok-form-provider');
  const modelSel = $('byok-form-model');
  const labelInput = $('byok-form-label');
  const keyInput = $('byok-form-key');
  const result = $('byok-form-result');

  // Populate provider options once.
  providerSel.innerHTML = '';
  for (const p of PROVIDERS) {
    const o = document.createElement('option');
    o.value = p; o.textContent = PROVIDER_LABELS[p];
    providerSel.appendChild(o);
  }

  function refillModelOptions() {
    const p = providerSel.value;
    modelSel.innerHTML = '';
    for (const opt of MODELS[p].options) {
      const o = document.createElement('option');
      o.value = opt.id; o.textContent = opt.label;
      modelSel.appendChild(o);
    }
    modelSel.value = MODELS[p].default;
  }
  providerSel.addEventListener('change', refillModelOptions);

  btnAdd.addEventListener('click', () => {
    form.dataset.editingId = '';
    form.querySelector('h4').textContent = 'Add API key';
    btnSave.textContent = 'Save & Test';
    labelInput.value = '';
    providerSel.value = PROVIDERS[0];
    refillModelOptions();
    keyInput.value = '';
    result.textContent = '';
    form.classList.remove('hidden');
    btnAdd.classList.add('hidden');
    labelInput.focus();
  });

  btnCancel.addEventListener('click', () => {
    form.classList.add('hidden');
    btnAdd.classList.remove('hidden');
    result.textContent = '';
  });

  btnSave.addEventListener('click', async () => {
    const editingId = form.dataset.editingId || '';
    const provider = providerSel.value;
    const model = modelSel.value;
    const keyVal = keyInput.value.trim();
    const labelVal = labelInput.value.trim() || `${PROVIDER_LABELS[provider]} key`;
    if (!keyVal) {
      result.textContent = '✗ API key is required';
      return;
    }
    btnSave.disabled = true;
    result.textContent = '… testing';
    let status = 'untested';
    let lastError = null;
    try {
      await testByokConnection(provider, keyVal, model);
      status = 'verified';
      result.textContent = '✓ OK — saving';
      await markSetupComplete();
    } catch (e) {
      status = 'failed';
      lastError = e?.message || String(e);
      result.textContent = '✗ ' + lastError + ' — saved anyway; you can fix and re-test';
    }
    const keys = await getByokKeys();
    if (editingId) {
      const idx = keys.findIndex(k => k.id === editingId);
      if (idx >= 0) {
        keys[idx] = {
          ...keys[idx],
          label: labelVal,
          provider,
          model,
          key: keyVal,
          status,
          lastTestedAt: Date.now(),
          lastError
        };
      }
    } else {
      keys.push({
        id: newKeyId(),
        label: labelVal,
        provider,
        model,
        key: keyVal,
        status,
        lastTestedAt: Date.now(),
        lastError
      });
    }
    await setByokKeys(keys);
    btnSave.disabled = false;
    setTimeout(() => {
      form.classList.add('hidden');
      btnAdd.classList.remove('hidden');
      renderByokList(MODELS, PROVIDERS, PROVIDER_LABELS);
    }, status === 'verified' ? 600 : 1500);
  });
}

async function openEditForm(id, MODELS, PROVIDERS, PROVIDER_LABELS) {
  const keys = await getByokKeys();
  const k = keys.find(x => x.id === id);
  if (!k) return;
  const form = $('byok-add-form');
  const btnAdd = $('btn-byok-add');
  const providerSel = $('byok-form-provider');
  const modelSel = $('byok-form-model');
  const labelInput = $('byok-form-label');
  const keyInput = $('byok-form-key');
  const result = $('byok-form-result');

  form.dataset.editingId = id;
  form.querySelector('h4').textContent = 'Edit API key';
  $('btn-byok-save').textContent = 'Save & Re-test';
  providerSel.value = k.provider;
  // Refill model options for this provider, then preserve current selection if still valid.
  modelSel.innerHTML = '';
  for (const opt of MODELS[k.provider].options) {
    const o = document.createElement('option');
    o.value = opt.id; o.textContent = opt.label;
    modelSel.appendChild(o);
  }
  modelSel.value = pickPreservedValue(modelSel, k.model, MODELS[k.provider].default);
  labelInput.value = k.label;
  keyInput.value = k.key;
  result.textContent = '';
  form.classList.remove('hidden');
  btnAdd.classList.add('hidden');
  labelInput.focus();
}

async function deleteKey(id, MODELS, PROVIDERS, PROVIDER_LABELS) {
  if (!confirm('Delete this API key? This cannot be undone.')) return;
  const keys = (await getByokKeys()).filter(k => k.id !== id);
  await setByokKeys(keys);
  await renderByokList(MODELS, PROVIDERS, PROVIDER_LABELS);
  await maybeFlipSetupCompleteFalse();
}

async function moveKey(id, delta, MODELS, PROVIDERS, PROVIDER_LABELS) {
  const keys = await getByokKeys();
  const idx = keys.findIndex(k => k.id === id);
  if (idx < 0) return;
  const next = idx + delta;
  if (next < 0 || next >= keys.length) return;
  [keys[idx], keys[next]] = [keys[next], keys[idx]];
  await setByokKeys(keys);
  await renderByokList(MODELS, PROVIDERS, PROVIDER_LABELS);
}

async function testRow(id, rowEl, MODELS, PROVIDERS, PROVIDER_LABELS) {
  const result = rowEl.querySelector('.byok-row-result');
  result.textContent = '…';
  const keys = await getByokKeys();
  const k = keys.find(x => x.id === id);
  if (!k) return;
  try {
    await testByokConnection(k.provider, k.key, k.model);
    result.textContent = '✓ OK';
    k.status = 'verified';
    k.lastTestedAt = Date.now();
    k.lastError = null;
    await markSetupComplete();
  } catch (e) {
    const msg = e?.message || String(e);
    result.textContent = '✗ ' + msg;
    k.status = 'failed';
    k.lastTestedAt = Date.now();
    k.lastError = msg;
  }
  await setByokKeys(keys);
  // Defer the re-render slightly so the user sees the inline result before
  // the row re-renders and replaces it with the persisted status pill.
  setTimeout(() => renderByokList(MODELS, PROVIDERS, PROVIDER_LABELS), 600);
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

// If BYOK is the active provider AND the user just emptied the key list,
// flip setupComplete=false so the popup goes back to the setup gate on next open.
async function maybeFlipSetupCompleteFalse() {
  const sync = await new Promise(r => chrome.storage.sync.get(['provider'], r));
  if (sync.provider !== 'byok') return;
  const keys = await getByokKeys();
  if (keys.length === 0) {
    await new Promise(r => chrome.storage.sync.set({ setupComplete: false }, r));
  }
}

async function markSetupComplete() {
  await new Promise(r => chrome.storage.sync.set({ setupComplete: true }, r));
  const w = $('welcome-section'); if (w) w.classList.add('hidden');
}

async function initWelcomeGate() {
  const params = new URLSearchParams(window.location.search);
  const sync = await new Promise(r => chrome.storage.sync.get(['setupComplete'], r));
  const showWelcome = params.get('welcome') === '1' || !sync.setupComplete;
  $('welcome-section').classList.toggle('hidden', !showWelcome);
}

function wireResetButton() {
  const btn = $('btn-reset');
  if (!btn) return;
  const result = $('reset-result');
  btn.addEventListener('click', async () => {
    const ok = confirm(
      "Reset AI settings?\n\n" +
      "This will delete every saved BYOK API key, sign you out of Puter, " +
      "and clear your provider and model selections. Your custom prompt, " +
      "sound, and theme preferences will be kept."
    );
    if (!ok) return;
    btn.disabled = true;
    result.textContent = '… resetting';
    try {
      // Sign out of Puter if signed in. Tolerate failures.
      if (window.puter && window.puter.auth) {
        try {
          if (await window.puter.auth.isSignedIn()) {
            await window.puter.auth.signOut();
          }
        } catch {}
      }
      // Clear AI-related storage. Leave customPrompt, muted, theme alone.
      const localKeysToClear = ['byokKeys', 'apiKeys', 'apiKeysVerified'];
      const syncKeysToClear = ['provider', 'puterModel', 'byokProvider', 'byokModels', 'setupComplete'];
      await new Promise(r => chrome.storage.local.remove(localKeysToClear, r));
      await new Promise(r => chrome.storage.sync.remove(syncKeysToClear, r));
      result.textContent = '✓ Done — reloading';
      setTimeout(() => location.reload(), 700);
    } catch (e) {
      result.textContent = '✗ ' + (e?.message || e);
      btn.disabled = false;
    }
  });
}

