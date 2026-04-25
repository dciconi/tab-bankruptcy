// Tab Bankruptcy — options.js
// Settings page: model info, custom prompt, reading lists, mute toggle

const DEFAULT_PROMPT = 'You are a witty, slightly roasty productivity coach. Names must make users laugh or wince in recognition. Avoid: "Work", "Shopping", "Misc" unless ironic. Use pop culture, puns, self-deprecation.';

const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
  initPromptEditor();
  initMuteToggle();
  initThemeToggle();
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
