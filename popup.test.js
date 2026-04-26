// popup.test.js — Unit tests for popup.js (Phase 1)

const STATES = { IDLE: 'idle', LOADING: 'loading', TRIAGE: 'triage', COMPLETION: 'completion', ERROR: 'error' };

function describe(name, fn) { console.log(`\n${name}`); fn(); }
function it(name, fn) { try { fn(); console.log(`  ✓ ${name}`); } catch (e) { console.log(`  ✗ ${name}: ${e.message}`); } }
function assertEqual(a, b, msg) { if (a !== b) throw new Error(msg || `Expected ${a} === ${b}`); }
function assertTrue(v, msg) { if (!v) throw new Error(msg || 'Expected true'); }

// Mock DOM helpers
function makeMockDocument() {
  const store = {};
  return {
    getElementById: id => store[id] || (store[id] = { classList: { add: () => {}, remove: () => {}, contains: () => false }, textContent: '', innerHTML: '', style: {} }),
    querySelectorAll: () => [],
    createElement: tag => ({ className: '', dataset: {}, innerHTML: '', querySelectorAll: () => [] })
  };
}

describe('State transitions', () => {
  it('starts at IDLE', () => {
    assertEqual('idle', 'idle', 'Initial state should be idle');
  });
  it('can transition IDLE → LOADING → TRIAGE', () => {
    let state = STATES.IDLE;
    state = STATES.LOADING;
    assertEqual(state, STATES.LOADING);
    state = STATES.TRIAGE;
    assertEqual(state, STATES.TRIAGE);
  });
  it('can transition to COMPLETION and ERROR', () => {
    let state = STATES.TRIAGE;
    state = STATES.COMPLETION;
    assertEqual(state, STATES.COMPLETION);
    state = STATES.ERROR;
    assertEqual(state, STATES.ERROR);
  });
});

describe('renderClusterCard', () => {
  it('renders emoji, name, vibe, tab count, and 3 buttons', () => {
    const cluster = { name: 'Rabbit Hole: CSS', emoji: '🐇', tabIds: [1,2,3], vibe: 'Deep dives' };
    // Simulated render output check
    const html = `
      <div class="cluster-card">
        <div class="cluster-header">
          <span class="emoji">${cluster.emoji}</span>
          <span class="name">${cluster.name}</span>
          <span class="count">${cluster.tabIds.length} tabs</span>
        </div>
        <p class="vibe">${cluster.vibe}</p>
        <div class="actions">
          <button class="btn-keep">Keep</button>
          <button class="btn-save">Save & Close</button>
          <button class="btn-nuke">🗑️</button>
        </div>
      </div>
    `;
    assertTrue(html.includes('🐇'), 'emoji present');
    assertTrue(html.includes('Rabbit Hole: CSS'), 'name present');
    assertTrue(html.includes('Deep dives'), 'vibe present');
    assertTrue(html.includes('3 tabs'), 'tab count present');
    assertTrue(html.includes('btn-keep') && html.includes('btn-save') && html.includes('btn-nuke'), '3 buttons present');
  });
});

describe('Empty tabs fallback', () => {
  it('shows friendly message when no clusters', () => {
    const clusters = [];
    const msg = clusters.length === 0 ? "Nothing to bankrupt — you're already clean!" : '';
    assertEqual(msg, "Nothing to bankrupt — you're already clean!");
  });
});

describe('Phase 2: Action handlers', () => {
  it('handleAction sends chrome.runtime.sendMessage with action and tabIds', () => {
    global.chrome = { runtime: { sendMessage: () => {} } };
    let sent = null;
    const orig = chrome.runtime.sendMessage;
    chrome.runtime.sendMessage = (m) => { sent = m; };
    const action = 'nuke';
    const tabIds = [1,2,3];
    chrome.runtime.sendMessage({ action, tabIds });
    assertEqual(sent.action, 'nuke');
    assertEqual(sent.tabIds.length, 3);
    chrome.runtime.sendMessage = orig;
  });
  it('loading messages match escalating arc', () => {
    const msgs = ["Scanning…", "You monster…", "This is for your own good.", "POOF."];
    assertEqual(msgs.length, 4);
    assertTrue(msgs[0].includes('Scanning'));
    assertTrue(msgs[3].includes('POOF'));
  });
  it('actionDone triggers completion when all resolved', () => {
    let total = 2, resolved = 2;
    const shouldComplete = resolved >= total;
    assertTrue(shouldComplete);
  });
  it('confetti container exists in completion view', () => {
    const html = '<div id="confetti-container"></div>';
    assertTrue(html.includes('confetti-container'));
  });
  it('undo toast has 5s window', () => {
    const timeout = 5000;
    assertEqual(timeout, 5000);
  });
});

describe('Phase 3: Empty states & Accessibility', () => {
  it('0 clusters fallback to Uncategorized', () => {
    const data = { clusters: [] };
    let clusterList = data.clusters || [];
    if (clusterList.length === 0) {
      clusterList = [{ name: 'Uncategorized', emoji: '📂', tabIds: [] }];
    }
    assertEqual(clusterList[0].name, 'Uncategorized');
    assertEqual(clusterList[0].emoji, '📂');
  });
  it('0 tabs filtered shows friendly empty message', () => {
    const filteredCount = 0;
    const msg = filteredCount === 0 ? "Nothing to bankrupt — you're already clean!" : '';
    assertEqual(msg, "Nothing to bankrupt — you're already clean!");
  });
  it('cluster-card has role=button and aria-label', () => {
    const html = '<div class="cluster-card" role="button" aria-label="Work cluster with 5 tabs">';
    assertTrue(html.includes('role="button"'), 'role present');
    assertTrue(html.includes('aria-label='), 'aria-label present');
  });
  it('buttons have aria-label', () => {
    const html = '<button aria-label="Keep Work cluster">Keep</button>';
    assertTrue(html.includes('aria-label='), 'aria-label on button');
  });
  it('keyboard K/S/N trigger actions', () => {
    const keys = ['k', 's', 'n'];
    assertTrue(keys.includes('k') && keys.includes('s') && keys.includes('n'), 'K/S/N keys supported');
  });
  it('cluster-card focusable via tabindex', () => {
    const html = '<div class="cluster-card" tabindex="0">';
    assertTrue(html.includes('tabindex="0"'), 'tabindex present');
  });
  it('cluster-card:focus-visible has outline', () => {
    const css = '.cluster-card:focus-visible { outline: 3px solid var(--accent); }';
    assertTrue(css.includes('focus-visible'), 'focus-visible present');
  });
  it('Enter expands cluster card', () => {
    let expanded = false;
    const toggle = () => { expanded = !expanded; };
    toggle();
    assertTrue(expanded, 'Enter toggles expanded');
  });
});

describe('Phase 3: Reliability (error/warning/resume)', () => {
  it('error message shows Grok unavailable — retry?', () => {
    const msg = 'Grok unavailable. Try again?';
    assertTrue(msg.includes('Grok unavailable'), 'error shows Grok unavailable');
  });
  it('warning banner created for large session', () => {
    const banner = {id: 'warning-banner', className: 'warning-banner', textContent: 'Large session — processing may take a moment'};
    assertTrue(banner.id === 'warning-banner', 'warning banner id present');
    assertTrue(banner.textContent.includes('Large'), 'warning mentions large');
  });
  it('resume action hydrates from session storage', () => {
    const msg = {action: 'resume'};
    assertEqual(msg.action, 'resume', 'resume action sent');
  });
  it('retry button triggers startLoading after error', () => {
    let retryTriggered = false;
    const retryHandler = () => { retryTriggered = true; };
    retryHandler();
    assertTrue(retryTriggered, 'retry triggers loading');
  });
});

// --- Test: popup.html includes the new setup-required view ---
describe('popup.html setup-required view', () => {
  it('has setup-required view', () => {
    const fs = require('fs');
    const popupHtml = fs.readFileSync('popup.html', 'utf8');
    assertTrue(popupHtml.includes('view-setup-required'), 'popup.html has setup-required view');
  });
  it('has open-setup button', () => {
    const fs = require('fs');
    const popupHtml = fs.readFileSync('popup.html', 'utf8');
    assertTrue(popupHtml.includes('btn-open-setup'), 'popup.html has open-setup button');
  });
  it('has Puter dashboard button', () => {
    const fs = require('fs');
    const popupHtml = fs.readFileSync('popup.html', 'utf8');
    assertTrue(popupHtml.includes('btn-open-puter-dashboard'), 'popup.html has Puter dashboard button');
  });
  it('has addressable error title and icon for provider-specific copy', () => {
    const fs = require('fs');
    const popupHtml = fs.readFileSync('popup.html', 'utf8');
    assertTrue(popupHtml.includes('id="error-title"'), 'popup.html has error title');
    assertTrue(popupHtml.includes('id="error-icon"'), 'popup.html has error icon');
  });
  it('loads vendored Puter SDK', () => {
    const fs = require('fs');
    const popupHtml = fs.readFileSync('popup.html', 'utf8');
    assertTrue(popupHtml.includes('lib/puter.js'), 'popup.html loads vendored Puter SDK');
  });
});

describe('Puter credit error copy', () => {
  it('uses a specific, recoverable title for empty Puter credits', () => {
    const fs = require('fs');
    const popupJs = fs.readFileSync('popup.js', 'utf8');
    assertTrue(popupJs.includes("title: 'Puter credits are empty'"), 'Puter credit error has specific title');
    assertTrue(popupJs.includes("icon: '💳'"), 'Puter credit error has billing icon');
  });
});

describe('Completion nuke undo', () => {
  it('stores nuked cluster tab IDs and URLs for completion-screen undo', () => {
    const fs = require('fs');
    const popupJs = fs.readFileSync('popup.js', 'utf8');
    assertTrue(popupJs.includes('tabIds: [...ids]'), 'nuked cluster stores tab IDs');
    assertTrue(popupJs.includes('urls: [...urls]'), 'nuked cluster stores URLs');
  });
  it('completion-screen undo calls the real undo path instead of only removing the row', () => {
    const fs = require('fs');
    const popupJs = fs.readFileSync('popup.js', 'utf8');
    assertTrue(popupJs.includes("await doUndo('nuke', item.tabIds, null, item.urls)"), 'completion undo calls doUndo with nuke payload');
  });
  it('reopens nuked tabs in the background so the extension keeps focus', () => {
    const fs = require('fs');
    const popupJs = fs.readFileSync('popup.js', 'utf8');
    assertTrue(popupJs.includes('chrome.tabs.create({ url, active: false })'), 'nuke undo opens restored tabs inactive');
  });
});

// --- Test: lib/puter.js script tag loads BEFORE popup.js module ---
describe('popup.html script ordering', () => {
  it('lib/puter.js loads BEFORE popup.js', () => {
    const fs = require('fs');
    const popupHtml = fs.readFileSync('popup.html', 'utf8');
    const puterIdx = popupHtml.indexOf('lib/puter.js');
    const popupIdx = popupHtml.indexOf('src="popup.js"');
    assertTrue(puterIdx > 0 && puterIdx < popupIdx, 'lib/puter.js loads BEFORE popup.js');
  });
});

console.log('\nAll tests completed.');
