// Tab Bankruptcy — Popup Controller
// State machine: Idle → Loading → Triage → Completion

import { playNuke, playKeep, playSave, playCompletion, loadMute } from './lib/audio.js';

const STATES = { IDLE: 'idle', LOADING: 'loading', TRIAGE: 'triage', COMPLETION: 'completion', ERROR: 'error' };

let currentState = STATES.IDLE;
let clusters = [];
let loadingInterval = null;
let stats = { kept: 0, saved: 0, nuked: 0 };
let totalClusters = 0;
let resolvedClusters = 0;
let undoTimer = null;
let lastAction = null;
let lastTabIds = [];
let nukedClusters = []; // track names of nuked clusters for completion list
let remainingTabs = 0; // tracks remaining tabs in triage view for live count update

// Loading messages (escalating per task spec)
const LOADING_MESSAGES = [
  "Scanning…",
  "You monster…",
  "This is for your own good.",
  "POOF."
];

const FOCUS_TAX_VARIANTS = [
  "estimated focus tax: high",
  "cognitive load: medium",
  "attention debt: critical",
  "context switch overhead: severe",
  "tab entropy: elevated",
  "focus tax: manageable",
  "distraction density: high",
];

// Tab particle icons for floating background
const PARTICLE_ICONS = ['📑', '🗂️', '📄', '🗒️', '📋', '🧾'];

function spawnParticles() {
  const container = document.getElementById('particles-container');
  if (!container) return;
  container.innerHTML = '';
  const count = 14;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'tab-particle';
    p.textContent = PARTICLE_ICONS[Math.floor(Math.random() * PARTICLE_ICONS.length)];
    // Random starting position
    p.style.left = Math.random() * 100 + '%';
    p.style.top = Math.random() * 100 + '%';
    // Stagger animation
    p.style.animationDelay = (Math.random() * -6) + 's';
    p.style.fontSize = (14 + Math.random() * 10) + 'px';
    p.style.opacity = (0.2 + Math.random() * 0.25).toFixed(2);
    container.appendChild(p);
  }
}

function clearParticles() {
  const container = document.getElementById('particles-container');
  if (!container) return;
  const particles = container.querySelectorAll('.tab-particle');
  particles.forEach((p, i) => {
    // Slight stagger so they don't all vanish at once
    setTimeout(() => {
      p.classList.add('clearing');
      // Remove from DOM after animation
      setTimeout(() => p.remove(), 800);
    }, i * 25);
  });
}

function setState(state) {
  currentState = state;
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById(`view-${state}`);
  if (view) {
    view.classList.remove('hidden');
    view.classList.add('active');
  }
  // Respawn particles when returning to idle (e.g., after error retry flow)
  if (state === STATES.IDLE) {
    spawnParticles();
  }
}

function updateIdleTabCount() {
  console.log('[popup] updateIdleTabCount() called');
  chrome.tabs.query({}, tabs => {
    const filtered = tabs.filter(t => !t.pinned && !t.url.startsWith('chrome://'));
    const count = filtered.length;
    console.log('[popup] tabs total:', tabs.length, 'filtered (non-pinned, non-chrome):', count);
    const el = document.getElementById('idle-tab-count');
    if (el) el.textContent = count;
    // Set focus tax sublabel based on tab count (not random)
    const taxEl = document.getElementById('focus-tax');
    if (taxEl) {
      let idx;
      if (count <= 5) idx = 5; // "focus tax: manageable"
      else if (count <= 15) idx = 1; // "cognitive load: medium"
      else if (count <= 30) idx = 0; // "estimated focus tax: high"
      else idx = count % 3 === 0 ? 2 : (count % 3 === 1 ? 3 : 6); // critical/severe/high for heavy tab loads
      taxEl.textContent = FOCUS_TAX_VARIANTS[idx];
    }
    // 0 tabs filtered → friendly empty state in Idle
    const btn = document.getElementById('btn-declare');
    if (btn && count === 0) {
      btn.disabled = true;
      btn.setAttribute('aria-label', 'Nothing to bankrupt — you are already clean');
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
    }
  });
}

function startLoading() {
  console.log('[popup] startLoading() — user clicked Declare Bankruptcy');
  clearParticles();
  nukedClusters = []; // reset for new session
  stats = { kept: 0, saved: 0, nuked: 0 }; // reset stats for accurate completion view
  remainingTabs = 0;
  console.log('[popup] setState -> LOADING');
  setState(STATES.LOADING);
  let i = 0;
  const msgEl = document.getElementById('loading-message');
  const progEl = document.getElementById('progress-fill');
  if (loadingInterval) clearInterval(loadingInterval);
  loadingInterval = setInterval(() => {
    if (msgEl) msgEl.textContent = LOADING_MESSAGES[i % LOADING_MESSAGES.length];
    if (progEl) progEl.style.width = `${Math.min(100, (i + 1) * 25)}%`;
    i++;
  }, 1200);
  console.log('[popup] sending {action: "cluster"} to background');
  // Send cluster request to background
  chrome.runtime.sendMessage({ action: 'cluster' }, (resp) => {
    console.log('[popup] cluster request response:', resp);
  });
}

function renderClusterCard(cluster) {
  const div = document.createElement('div');
  div.className = 'cluster-card';
  div.tabIndex = 0;
  div.setAttribute('role', 'button');
  div.setAttribute('aria-label', `${cluster.name || 'Untitled'} cluster with ${(cluster.tabIds || []).length} tabs`);
  div.dataset.tabIds = JSON.stringify(cluster.tabIds || []);
  div.dataset.clusterName = cluster.name || 'Untitled';
  div.dataset.vibe = cluster.vibe || '';
  if (cluster.color) {
    div.style.borderLeft = `4px solid ${cluster.color}`;
    div.style.paddingLeft = '14px';
  }
  div.innerHTML = `
    <div class="card-content">
      <div class="cluster-header">
        <span class="emoji" aria-hidden="true" style="${cluster.color ? `color: ${cluster.color}` : ''}">${cluster.emoji || '📦'}</span>
        <span class="name">${cluster.name || 'Untitled'}</span>
        <span class="count">${(cluster.tabIds || []).length} tabs</span>
        <div class="favicons" aria-hidden="true"></div>
        <button class="expand-toggle" aria-label="Toggle tabs list" title="Expand/Collapse">▾</button>
      </div>
      <p class="vibe">${cluster.vibe || ''}</p>
      <div class="mini-list"></div>
    </div>
    <div class="action-bar" role="group" aria-label="Cluster actions">
      <button class="btn btn-nuke" data-action="nuke" title="Nuke" aria-label="Nuke ${cluster.name || 'Untitled'} cluster">💣</button>
      <button class="btn btn-save" data-action="save" title="Save & Close" aria-label="Save & Close ${cluster.name || 'Untitled'} cluster">🗃️</button>
      <button class="btn btn-keep" data-action="keep" title="Keep" aria-label="Keep ${cluster.name || 'Untitled'} cluster">✓</button>
    </div>
  `;
  // Wire real handlers (Phase 2) — skip expand-toggle (no data-action)
  div.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const tabIds = JSON.parse(div.dataset.tabIds || '[]');
      handleAction(action, tabIds, div);
    });
  });
  // Keyboard: Enter toggles expand
  div.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      div.classList.toggle('expanded');
    }
  });

  // Populate favicon stack (up to 5 + optional +X badge)
  const favContainer = div.querySelector('.favicons');
  const miniList = div.querySelector('.mini-list');
  const selectedIds = new Set(cluster.tabIds || []); // all selected by default

  if (favContainer && cluster.tabIds?.length) {
    const total = cluster.tabIds.length;
    const ids = cluster.tabIds.slice(0, 5);
    ids.forEach((id, i) => {
      chrome.tabs.get(id).then(tab => {
        if (tab?.favIconUrl) {
          const img = document.createElement('img');
          img.src = tab.favIconUrl;
          img.className = 'favicon';
          img.style.left = `${i * 14}px`;
          img.style.zIndex = String(10 - i);
          img.style.background = 'transparent';
          // Hide broken favicons to avoid ugly placeholders
          img.onerror = () => { img.style.display = 'none'; };
          favContainer.appendChild(img);
        }
      }).catch(() => {});
    });
    // +X badge if more than 5 tabs
    if (total > 5) {
      const badge = document.createElement('span');
      badge.className = 'favicon-badge';
      badge.textContent = `+${total - 5}`;
      badge.style.left = `${5 * 14}px`;
      badge.style.zIndex = '1';
      favContainer.appendChild(badge);
    }
  }

  // Expand/collapse toggle
  const expandToggle = div.querySelector('.expand-toggle');
  if (expandToggle) {
    expandToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const expanded = div.classList.toggle('expanded');
      expandToggle.textContent = expanded ? '▴' : '▾';
      if (miniList) {
        if (expanded) {
          if (!miniList.hasChildNodes() && cluster.tabIds?.length) {
            // Populate mini-list with checkboxes
            cluster.tabIds.forEach(id => {
              chrome.tabs.get(id).then(tab => {
                const item = document.createElement('label');
                item.className = 'mini-tab';
                item.innerHTML = `
                  <input type="checkbox" data-id="${id}" checked />
                  <img class="mini-fav" src="${tab.favIconUrl || ''}" alt="" onerror="this.style.display='none'"/>
                  <span class="mini-title">${tab.title || tab.url || 'Tab'}</span>
                `;
                const cb = item.querySelector('input');
                cb.addEventListener('change', () => {
                  if (cb.checked) selectedIds.add(id);
                  else selectedIds.delete(id);
                  div.dataset.selectedIds = JSON.stringify([...selectedIds]);
                });
                miniList.appendChild(item);
              }).catch(() => {});
            });
          }
        }
        // Visibility is controlled by CSS .expanded class + max-height
      }
    });
  }

  // Store selectedIds on div for action handlers
  div.dataset.selectedIds = JSON.stringify([...selectedIds]);

  return div;
}

function handleAction(action, tabIds, cardEl) {
  // Use only selected tabIds if granular selection is active
  let ids = tabIds;
  if (cardEl && cardEl.dataset.selectedIds) {
    try {
      const sel = JSON.parse(cardEl.dataset.selectedIds);
      if (Array.isArray(sel) && sel.length) ids = sel;
    } catch {}
  }
  if (!ids.length) return;
  // Pre-fetch URLs so undo can restore tabs (especially for nuke)
  if (cardEl && !cardEl.dataset.urls) {
    Promise.all(ids.map(id => chrome.tabs.get(id).then(t => t?.url).catch(() => null)))
      .then(urls => { cardEl.dataset.urls = JSON.stringify(urls.filter(Boolean)); });
  }
  // Update remaining tab count with animation
  remainingTabs = Math.max(0, remainingTabs - ids.length);
  const badge = document.getElementById('triage-tab-count');
  if (badge) {
    badge.textContent = `${remainingTabs} tabs`;
    badge.classList.remove('pulse');
    void badge.offsetWidth; // force reflow
    badge.classList.add('pulse');
    setTimeout(() => badge.classList.remove('pulse'), 300);
  }
  // Play sound
  if (action === 'nuke') playNuke();
  else if (action === 'keep') playKeep();
  else if (action === 'save') playSave();
  // Save undo state
  lastAction = action;
  lastTabIds = [...ids];
  if (undoTimer) clearTimeout(undoTimer);
  showUndoToast(action, ids, cardEl);
  // Send to background
  chrome.runtime.sendMessage({ action, tabIds: ids, listName: cardEl?.dataset?.clusterName, vibe: cardEl?.dataset?.vibe });
  // Optimistic UI
  updateStats(action, ids.length);
  if (action === 'nuke' && cardEl && cardEl.dataset.clusterName) {
    nukedClusters.push(cardEl.dataset.clusterName);
  }
  if (cardEl) {
    const cls = action === 'nuke' ? 'nuking' : 'removing';
    cardEl.classList.add(cls);
  }
  setTimeout(() => { if (cardEl && cardEl.parentNode) cardEl.parentNode.removeChild(cardEl); }, 420);
  resolvedClusters++;
  checkCompletion();
}

function showUndoToast(action, tabIds, cardEl) {
  let toast = document.getElementById('undo-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'undo-toast';
    toast.className = 'undo-toast';
    document.body.appendChild(toast);
  }
  const label = action === 'keep' ? 'Kept' : action === 'save' ? 'Saved' : 'Nuked';
  toast.innerHTML = `${label} cluster — <a href="#" id="undo-link">Undo?</a>`;
  toast.classList.remove('hidden');
  if (undoTimer) clearTimeout(undoTimer);
  undoTimer = setTimeout(() => { toast.classList.add('hidden'); }, 5000);
  const undoLink = document.getElementById('undo-link');
  if (undoLink) undoLink.onclick = (e) => {
    e.preventDefault();
    doUndo(action, tabIds, cardEl);
    toast.classList.add('hidden');
  };
}

async function doUndo(action, tabIds, cardEl) {
  let urls = [];
  // For nuke: restore tabs using pre-fetched URLs
  if (action === 'nuke' && cardEl?.dataset?.urls) {
    try { urls = JSON.parse(cardEl.dataset.urls); } catch {}
    for (const url of urls) {
      try { await chrome.tabs.create({ url }); } catch {}
    }
  }
  // For save: fetch URLs so background can remove from readingList
  if (action === 'save' && Array.isArray(tabIds) && tabIds.length) {
    for (const id of tabIds) {
      try {
        const t = await chrome.tabs.get(id);
        if (t?.url) urls.push(t.url);
      } catch {}
    }
  }
  // Tell background to unmark processed (and remove from readingList if save)
  if (Array.isArray(tabIds) && tabIds.length) {
    chrome.runtime.sendMessage({ action: 'undo', tabIds, originalAction: action, urls });
  }
  // Restore card visually (if still in DOM or detached)
  if (cardEl) {
    cardEl.classList.remove('removing', 'nuking');
    const container = document.getElementById('clusters-container');
    if (container && !container.contains(cardEl)) container.appendChild(cardEl);
  }
  // Accurate state: decrement stat by tab count and restore remainingTabs
  const n = Array.isArray(tabIds) ? tabIds.length : 1;
  if (action === 'keep') stats.kept = Math.max(0, stats.kept - n);
  else if (action === 'save') stats.saved = Math.max(0, stats.saved - n);
  else if (action === 'nuke') stats.nuked = Math.max(0, stats.nuked - n);
  remainingTabs += Array.isArray(tabIds) ? tabIds.length : 0;
  const badge = document.getElementById('triage-tab-count');
  if (badge) {
    badge.textContent = `${remainingTabs} tabs`;
    badge.classList.remove('pulse');
    void badge.offsetWidth;
    badge.classList.add('pulse');
    setTimeout(() => badge.classList.remove('pulse'), 300);
  }
  resolvedClusters = Math.max(0, resolvedClusters - 1);
}

function checkCompletion() {
  if (resolvedClusters >= totalClusters && totalClusters > 0) {
    setTimeout(() => showCompletion(), 300);
  }
}

function triggerConfetti() {
  const container = document.getElementById('confetti-container');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < 60; i++) {
    const el = document.createElement('div');
    el.className = 'confetti';
    el.style.left = Math.random() * 100 + '%';
    el.style.animationDelay = Math.random() * 0.6 + 's';
    el.style.background = ['#ff6', '#6f6', '#6ff', '#f6f', '#f66'][i % 5];
    container.appendChild(el);
  }
  setTimeout(() => { container.innerHTML = ''; }, 2000);
}

function animateStats() {
  const els = {
    kept: document.getElementById('stat-kept'),
    saved: document.getElementById('stat-saved'),
    nuked: document.getElementById('stat-nuked')
  };
  ['kept', 'saved', 'nuked'].forEach(key => {
    const el = els[key];
    if (!el) return;
    let start = 0, end = stats[key] || 0;
    const step = () => {
      start += Math.ceil((end - start) / 5);
      if (start >= end) { el.textContent = end; return; }
      el.textContent = start;
      requestAnimationFrame(step);
    };
    step();
  });
}

function showCompletion() {
  playCompletion();
  // Compute real session totals
  const total = stats.kept + stats.saved + stats.nuked;
  // Update stat-total in summary text
  const totalEl = document.getElementById('stat-total');
  if (totalEl) totalEl.textContent = total;
  // Update seal if ≥70% nuked
  const seal = document.querySelector('#view-completion .seal');
  if (seal && total > 0 && stats.nuked / total >= 0.7) {
    seal.textContent = '💥';
    seal.title = 'ABSOLUTE CHAOS ACHIEVED';
  }
  // Render nuked clusters list with per-item undo
  const nukedList = document.getElementById('nuked-list');
  if (nukedList) {
    nukedList.innerHTML = '';
    if (nukedClusters.length > 0) {
      const title = document.createElement('div');
      title.className = 'nuked-list-title';
      title.textContent = '💥 Nuked clusters';
      nukedList.appendChild(title);
      nukedClusters.forEach((name, idx) => {
        const row = document.createElement('div');
        row.className = 'nuked-item';
        row.innerHTML = `<span class="nuked-name">• ${name}</span> <a href="#" class="nuked-undo">Undo</a>`;
        row.querySelector('.nuked-undo').onclick = (e) => {
          e.preventDefault();
          nukedClusters.splice(idx, 1);
          row.remove();
          if (nukedClusters.length === 0) nukedList.hidden = true;
        };
        nukedList.appendChild(row);
      });
      nukedList.hidden = false;
    } else {
      nukedList.hidden = true;
    }
  }
  triggerConfetti();
  animateStats();
  setState(STATES.COMPLETION);
}

function updateStats(action, tabCount) {
  const n = Number.isFinite(tabCount) ? tabCount : 1;
  if (action === 'keep') stats.kept += n;
  else if (action === 'save') stats.saved += n;
  else if (action === 'nuke') stats.nuked += n;
}

function renderClusters(data) {
  if (loadingInterval) {
    clearInterval(loadingInterval);
    loadingInterval = null;
  }
  let clusterList = data.clusters || [];
  // 0 clusters → fallback to single "Uncategorized" cluster
  if (clusterList.length === 0) {
    clusterList = [{
      name: 'Uncategorized',
      emoji: '📂',
      tabIds: [],
      vibe: 'No patterns detected — all tabs are unique.',
      confidence: 1.0
    }];
  }
  clusters = clusterList;
  totalClusters = clusters.length;
  resolvedClusters = 0;
  // Create native Chrome tab groups from cluster data
  createTabGroups(clusterList).catch(err => console.warn('[popup] tab grouping failed:', err));
  const container = document.getElementById('clusters-container');
  if (!container) return;
  container.innerHTML = '';
  if (clusters.length === 1 && (clusters[0].tabIds || []).length === 0) {
    // 0 tabs filtered case
    container.innerHTML = '<p class="empty" role="status" aria-live="polite">Nothing to bankrupt — you\'re already clean!</p>';
    setState(STATES.COMPLETION);
    return;
  }
  clusters.forEach(c => container.appendChild(renderClusterCard(c)));
  const total = clusters.reduce((sum, c) => sum + (c.tabIds || []).length, 0);
  remainingTabs = total;
  const badge = document.getElementById('triage-tab-count');
  if (badge) badge.textContent = `${total} tabs`;
  // Setup keyboard navigation for cluster cards
  setupKeyboardNav(container);
  setState(STATES.TRIAGE);
}

// Create native Chrome tab groups for each cluster
async function createTabGroups(clusters) {
  if (!Array.isArray(clusters) || !chrome.tabGroups?.create) return;
  const colors = ['blue', 'green', 'red', 'yellow', 'purple', 'cyan', 'pink'];
  for (let i = 0; i < clusters.length; i++) {
    const c = clusters[i];
    const tabIds = c.tabIds || [];
    if (tabIds.length === 0) continue;
    try {
      const title = c.emoji ? `${c.emoji} ${c.name || 'Cluster'}` : (c.name || 'Cluster');
      const color = c.color ? undefined : colors[i % colors.length];
      await chrome.tabGroups.create({ tabIds, title, ...(color && { color }) });
    } catch (e) {
      // Tabs might already be grouped or closed; ignore
    }
  }
}

function setupKeyboardNav(container) {
  const cards = container.querySelectorAll('.cluster-card');
  let focusIdx = 0;
  if (cards.length > 0) cards[0].focus();
  container.addEventListener('keydown', (e) => {
    if (!cards.length) return;
    if (e.key === 'ArrowDown' || e.key === 'Tab') {
      e.preventDefault();
      focusIdx = (focusIdx + 1) % cards.length;
      cards[focusIdx].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusIdx = (focusIdx - 1 + cards.length) % cards.length;
      cards[focusIdx].focus();
    } else if (e.key.toLowerCase() === 'k') {
      triggerActionOnCard(cards[focusIdx], 'keep');
    } else if (e.key.toLowerCase() === 's') {
      triggerActionOnCard(cards[focusIdx], 'save');
    } else if (e.key.toLowerCase() === 'n') {
      triggerActionOnCard(cards[focusIdx], 'nuke');
    }
  });
}

function triggerActionOnCard(card, action) {
  if (!card) return;
  const btn = card.querySelector(`[data-action="${action}"]`);
  if (btn) btn.click();
}

function showError(msg) {
  if (loadingInterval) {
    clearInterval(loadingInterval);
    loadingInterval = null;
  }
  const errEl = document.getElementById('error-message');
  if (errEl) errEl.textContent = msg || 'Grok unavailable. Try again?';
  setState(STATES.ERROR);
}

function handleMessage(msg) {
  console.log('[popup] handleMessage received:', msg);
  if (msg.type === 'clusters') {
    console.log('[popup] clusters received:', msg.clusters?.length || 0, 'clusters');
    if (msg.warning) showWarning(msg.warning);
    renderClusters(msg);
  } else if (msg.type === 'error') {
    console.error('[popup] error from background:', msg.message);
    showError(msg.message);
  } else if (msg.type === 'warning') {
    console.warn('[popup] warning:', msg.message);
    showWarning(msg.message);
  } else if (msg.type === 'actionDone') {
    console.log('[popup] actionDone, resolvedClusters:', resolvedClusters, 'total:', totalClusters);
    if (resolvedClusters >= totalClusters) {
      triggerConfetti();
      showCompletion();
    }
  }
}

function showWarning(message) {
  let banner = document.getElementById('warning-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'warning-banner';
    banner.className = 'warning-banner';
    document.body.insertBefore(banner, document.body.firstChild);
  }
  banner.textContent = message;
  banner.classList.remove('hidden');
}

function applyTheme() {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
  chrome.storage.sync.get(['theme'], (result) => {
    const theme = result.theme || 'system';
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
  });
  // Also listen for system changes (only relevant if theme is 'system')
  mediaQuery.addEventListener('change', () => {
    chrome.storage.sync.get(['theme'], (result) => {
      if ((result.theme || 'system') === 'system') {
        const isLight = mediaQuery.matches;
        if (isLight) {
          document.body.classList.add('light-mode');
        } else {
          document.body.classList.remove('light-mode');
        }
      }
    });
  });
}

async function init() {
  console.log('[popup] init() called, DOM ready');
  console.log('[popup] currentState init:', currentState);

  // Load mute state to sync with options
  await loadMute();

  // Apply saved theme (dark/light)
  applyTheme();

  // Resume from session storage (popup closed mid-load)
  chrome.runtime.sendMessage({action: 'resume'}, (resp) => {
    console.log('[popup] resume response:', resp);
  });

  // Idle
  updateIdleTabCount();
  console.log('[popup] setState -> IDLE');
  setState(STATES.IDLE);

  // Declare Bankruptcy (with ARIA)
  const btnDeclare = document.getElementById('btn-declare');
  console.log('[popup] btn-declare element:', btnDeclare);
  if (btnDeclare) {
    btnDeclare.setAttribute('aria-label', 'Declare bankruptcy on your open tabs');
    btnDeclare.addEventListener('click', () => {
      console.log('[popup] btn-declare clicked!');
      startLoading();
    });
  } else {
    console.error('[popup] btn-declare NOT FOUND in DOM!');
  }

  // Done button — shows completion with current stats
  const btnDone = document.getElementById('btn-done');
  if (btnDone) {
    btnDone.setAttribute('aria-label', 'Finish triage and view completion');
    btnDone.addEventListener('click', () => {
      showCompletion();
    });
  }

  // Close button
  const btnClose = document.getElementById('btn-close');
  if (btnClose) {
    btnClose.setAttribute('aria-label', 'Close popup');
    btnClose.addEventListener('click', () => window.close());
  }

  // Retry button
  const btnRetry = document.getElementById('btn-retry');
  if (btnRetry) {
    btnRetry.setAttribute('aria-label', 'Retry clustering after error');
    btnRetry.addEventListener('click', () => {
      setState(STATES.IDLE);
      startLoading();
    });
  }

  // Listen for background messages
  chrome.runtime.onMessage.addListener(handleMessage);
}

document.addEventListener('DOMContentLoaded', init);
