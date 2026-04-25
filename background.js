const PROXY_URL = 'https://autoqa.teachx.ai/hackathon/preview/chapter-11/cluster';

const SESSION_KEY = 'tb_cluster_state';
const LAST_TABS_KEY = 'tb_last_tab_ids';
const PROCESSED_KEY = 'tb_processed_tab_ids';

// Helper: compute signature from tab IDs (sorted for stable compare)
function tabSignature(tabIds) {
  return tabIds.slice().sort((a, b) => a - b).join(',');
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[background] onMessage:', message, 'from:', sender?.tab?.id);
  if (message.action === 'cluster') {
    console.log('[background] cluster action received — calling handleClusterRequest');
    handleClusterRequest()
      .then(() => sendResponse({ok: true}))
      .catch(err => { console.error('[background] cluster error:', err); sendResponse({ok: false, error: err.message}); });
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

async function fetchWithRetry(url, opts, retries = 3, backoff = 500) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, opts);
      if (res.ok) return res;
      if (res.status >= 500 && i < retries - 1) {
        await new Promise(r => setTimeout(r, backoff * Math.pow(2, i)));
        continue;
      }
      throw new Error(`Proxy returned ${res.status}`);
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, backoff * Math.pow(2, i)));
    }
  }
}

async function handleClusterRequest() {
  console.log('[background] handleClusterRequest() start');
  const allTabs = await chrome.tabs.query({});
  const selfUrl = chrome.runtime.getURL(''); // e.g. chrome-extension://<id>/
  let filtered = allTabs.filter(t =>
    t.id && typeof t.id === 'number' &&
    !t.pinned &&
    !t.url.startsWith('chrome://') &&
    !t.url.startsWith('about:') &&
    !(t.url && t.url.startsWith(selfUrl)) // exclude this extension's own tab
  );
  console.log('[background] tabs: all=', allTabs.length, 'filtered=', filtered.length);

  // Load processed tab IDs and exclude them (already nuked/saved/kept)
  const { [PROCESSED_KEY]: processed = [] } = await chrome.storage.session.get(PROCESSED_KEY);
  const processedSet = new Set(processed);
  filtered = filtered.filter(t => !processedSet.has(t.id));
  console.log('[background] after excluding processed:', filtered.length);

  // Compute current signature
  const currentIds = filtered.map(t => t.id);
  const currentSig = tabSignature(currentIds);

  // Load last signature
  const { [LAST_TABS_KEY]: lastSig } = await chrome.storage.session.get(LAST_TABS_KEY);
  const cached = await chrome.storage.session.get(SESSION_KEY);
  const hasCachedClusters = cached[SESSION_KEY]?.type === 'clusters' && (cached[SESSION_KEY]?.clusters?.length ?? 0) > 0;

  // If same tabs as last run AND we have cached clusters → skip API
  if (currentSig === lastSig && hasCachedClusters) {
    console.log('[background] tabs unchanged, returning cached clusters');
    chrome.runtime.sendMessage(cached[SESSION_KEY]);
    return;
  }

  const isLarge = filtered.length > 100;
  console.log('[background] isLarge session:', isLarge);

  chrome.alarms.create('tb_sw_keepalive', {periodInMinutes: 0.5});
  console.log('[background] keepalive alarm created');

  try {
    await chrome.storage.session.set({[SESSION_KEY]: {type: 'clusters', clusters: [], pending: true}});
    console.log('[background] session state set (pending), fetching proxy:', PROXY_URL);

    // Sanitize tabs to only include fields TabItem model accepts (prevents 422)
    const allowed = ['id','title','url','lastAccessed','status','active','groupId','windowId','pinned','audible','discarded','index','highlighted'];
    const sanitized = filtered.map(t => {
      const o = {};
      for (const k of allowed) if (k in t) o[k] = t[k];
      // Coerce float timestamps to int (Pydantic rejects int_from_float)
      if (typeof o.lastAccessed === 'number') o.lastAccessed = Math.floor(o.lastAccessed);
      return o;
    });
    console.log('[background] sending', sanitized.length, 'tabs to proxy, sample:', JSON.stringify(sanitized[0]));

    const res = await fetchWithRetry(PROXY_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({tabs: sanitized, chromeId: chrome.runtime.id})
    });
    console.log('[background] proxy response status:', res.status);
    const {clusters} = await res.json();
    console.log('[background] clusters from proxy:', clusters?.length || 0);

    const payload = {type: 'clusters', clusters, ...(isLarge && {warning: 'Large session — processing may take a moment'})};
    await chrome.storage.session.set({[SESSION_KEY]: payload, [LAST_TABS_KEY]: currentSig});
    chrome.runtime.sendMessage(payload);

    // Create native Chrome tab groups (background context is more reliable)
    createTabGroups(clusters).catch(err => console.warn('[background] tab grouping failed:', err));
  } catch (err) {
    console.error('Tab Bankruptcy clustering failed:', err);
    const payload = {type: 'error', message: err.message};
    await chrome.storage.session.set({[SESSION_KEY]: payload});
    chrome.runtime.sendMessage(payload);
  } finally {
    chrome.alarms.clear('tb_sw_keepalive');
  }
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

if (typeof module !== 'undefined') module.exports = {handleClusterRequest, handleKeep, handleNuke, handleSave, fetchWithRetry, markProcessed, tabSignature, createTabGroups};
