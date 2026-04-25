const SESSION_KEY = 'tb_cluster_state';
const LAST_TABS_KEY = 'tb_last_tab_ids';
const PROCESSED_KEY = 'tb_processed_tab_ids';

// Helper: compute signature from tab IDs (sorted for stable compare)
function tabSignature(tabIds) {
  return tabIds.slice().sort((a, b) => a - b).join(',');
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[background] onMessage:', message, 'from:', sender?.tab?.id);
  if (message.action === 'getTabsForCluster') {
    handleGetTabsForCluster()
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ok: false, error: err.message}));
    return true;
  }
  if (message.action === 'commitClusters') {
    handleCommitClusters(message.clusters, message.sig)
      .then(() => sendResponse({ok: true}))
      .catch(err => sendResponse({ok: false, error: err.message}));
    return true;
  }
  if (message.action === 'resume') {
    chrome.storage.session.get(SESSION_KEY).then(data => {
      if (data[SESSION_KEY]) {
        const state = data[SESSION_KEY];
        chrome.runtime.sendMessage(state);
      }
    });
    sendResponse({ok: true});
    return true;
  }
  if (message.action === 'keep') {
    handleKeep(message.tabIds)
      .then(() => sendResponse({ok: true}))
      .catch(err => sendResponse({ok: false, error: err.message}));
    return true;
  }
  if (message.action === 'nuke') {
    handleNuke(message.tabIds)
      .then(() => sendResponse({ok: true}))
      .catch(err => sendResponse({ok: false, error: err.message}));
    return true;
  }
  if (message.action === 'save') {
    handleSave(message.tabIds, message.listName, message.vibe)
      .then(() => sendResponse({ok: true}))
      .catch(err => sendResponse({ok: false, error: err.message}));
    return true;
  }
  if (message.action === 'getReadingLists') {
    // Use Chrome's built-in reading list
    if (chrome.readingList?.query) {
      chrome.readingList.query({}).then(entries => {
        // Map to our list format (flat list, no named groups)
        const lists = entries.map((e, i) => ({
          id: e.url, // use URL as ID for deletion
          name: e.title || 'Saved Tab',
          tabs: [{url: e.url, title: e.title}],
          vibe: '',
          createdAt: e.creationTime || Date.now()
        }));
        sendResponse({lists});
      }).catch(() => sendResponse({lists: []}));
    } else {
      sendResponse({lists: []});
    }
    return true;
  }
  if (message.action === 'deleteReadingList') {
    // Remove from Chrome's reading list by URL
    if (chrome.readingList?.removeEntry && message.id) {
      chrome.readingList.removeEntry({url: message.id}).then(() => sendResponse({ok: true})).catch(() => sendResponse({ok: false}));
    } else {
      sendResponse({ok: true});
    }
    return true;
  }
  if (message.action === 'undo') {
    // Remove tabIds from processed list
    const processedPromise = (Array.isArray(message.tabIds) && message.tabIds.length)
      ? chrome.storage.session.get(PROCESSED_KEY).then(data => {
          const existing = data[PROCESSED_KEY] || [];
          const remaining = existing.filter(id => !message.tabIds.includes(id));
          return chrome.storage.session.set({ [PROCESSED_KEY]: remaining });
        })
      : Promise.resolve();

    // If undoing a save, remove those URLs from Chrome reading list
    let readingListPromise = Promise.resolve();
    if (message.originalAction === 'save' && Array.isArray(message.urls) && message.urls.length && chrome.readingList?.removeEntry) {
      readingListPromise = Promise.all(
        message.urls.map(url => chrome.readingList.removeEntry({ url }).catch(() => {}))
      );
    }

    Promise.all([processedPromise, readingListPromise]).then(() => sendResponse({ok: true}));
    return true;
  }
  if (message.action === 'resetState') {
    chrome.storage.session.remove([PROCESSED_KEY, LAST_TABS_KEY, SESSION_KEY]).then(() => sendResponse({ok: true}));
    return true;
  }
});

async function handleGetTabsForCluster() {
  const allTabs = await chrome.tabs.query({});
  const selfUrl = chrome.runtime.getURL('');
  let filtered = allTabs.filter(t =>
    t.id && typeof t.id === 'number' &&
    !t.pinned &&
    !t.url.startsWith('chrome://') &&
    !t.url.startsWith('about:') &&
    !(t.url && t.url.startsWith(selfUrl))
  );

  const { [PROCESSED_KEY]: processed = [] } = await chrome.storage.session.get(PROCESSED_KEY);
  const processedSet = new Set(processed);
  filtered = filtered.filter(t => !processedSet.has(t.id));

  const currentIds = filtered.map(t => t.id);
  const currentSig = tabSignature(currentIds);

  const { [LAST_TABS_KEY]: lastSig } = await chrome.storage.session.get(LAST_TABS_KEY);
  const cached = await chrome.storage.session.get(SESSION_KEY);
  const hasCachedClusters = cached[SESSION_KEY]?.type === 'clusters' && (cached[SESSION_KEY]?.clusters?.length ?? 0) > 0;

  if (currentSig === lastSig && hasCachedClusters) {
    return { ok: true, cached: true, payload: cached[SESSION_KEY] };
  }

  // Whitelist tab fields the LLM should see (used to be Pydantic-driven; now LLM-driven).
  const allowed = ['id', 'title', 'url'];
  const sanitized = filtered.map(t => {
    const o = {};
    for (const k of allowed) if (k in t) o[k] = t[k];
    return o;
  });

  return { ok: true, cached: false, tabs: sanitized, sig: currentSig };
}

async function handleCommitClusters(clusters, sig) {
  if (!Array.isArray(clusters)) throw new Error('clusters must be an array');
  const payload = { type: 'clusters', clusters };
  await chrome.storage.session.set({ [SESSION_KEY]: payload, [LAST_TABS_KEY]: sig });
  // Tab grouping is best-effort; never fail the commit on a grouping error.
  createTabGroups(clusters).catch(err => console.warn('[background] tab grouping failed:', err));
}

async function markProcessed(tabIds) {
  if (!Array.isArray(tabIds) || tabIds.length === 0) return;
  const { [PROCESSED_KEY]: existing = [] } = await chrome.storage.session.get(PROCESSED_KEY);
  const updated = Array.from(new Set([...existing, ...tabIds]));
  await chrome.storage.session.set({ [PROCESSED_KEY]: updated });
}

async function handleKeep(tabIds) {
  // Keep means leave tabs open but do NOT switch focus to them (user stays in popup)
  if (!Array.isArray(tabIds) || tabIds.length === 0) return;
  await markProcessed(tabIds);
}

async function handleNuke(tabIds) {
  if (!Array.isArray(tabIds) || tabIds.length === 0) return;
  await chrome.tabs.remove(tabIds);
  await markProcessed(tabIds);
}

async function handleSave(tabIds, listName, vibe) {
  if (!Array.isArray(tabIds) || tabIds.length === 0) return;
  // Use Chrome's built-in reading list (no local storage)
  for (const id of tabIds) {
    try {
      const t = await chrome.tabs.get(id);
      if (t.url) {
        const baseTitle = t.title || t.url;
        const prefixedTitle = listName ? `[${listName}] ${baseTitle}` : baseTitle;
        await chrome.readingList.addEntry({ url: t.url, title: prefixedTitle, hasBeenRead: false });
      }
    } catch (e) {
      console.warn('[background] readingList addEntry failed for tab', id, e);
    }
  }
  await markProcessed(tabIds);
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

// Open full tab view when clicking extension icon (no popup)
chrome.action.onClicked.addListener(() => {
  const url = chrome.runtime.getURL('popup.html');
  chrome.tabs.create({ url });
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html?welcome=1') });
  }
  // REMOVE-IN-V3: v1->v2 forced re-setup. v1 had no provider/key/Puter config,
  // so existing setupComplete (if any) is meaningless. Treating users as fresh
  // install is correct. See docs/maintenance/v2-migration.md for removal criteria.
  if (details.reason === 'update') {
    chrome.storage.sync.set({ setupComplete: false });
  }
});

if (typeof module !== 'undefined') module.exports = {handleGetTabsForCluster, handleCommitClusters, handleKeep, handleNuke, handleSave, markProcessed, tabSignature, createTabGroups};
