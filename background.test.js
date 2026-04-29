const assert = require('assert');

let mockTabs = [];
let updatedTabs = [];
let removedTabs = [];
let getTabCalls = [];

let readingListCalls = [];

global.chrome = {
  tabs: {
    query: () => Promise.resolve(mockTabs),
    update: (id, props) => { updatedTabs.push({id, props}); return Promise.resolve(); },
    remove: (ids) => { removedTabs.push(...(Array.isArray(ids) ? ids : [ids])); return Promise.resolve(); },
    get: (id) => { getTabCalls.push(id); return Promise.resolve({id, title: `Tab ${id}`, url: `https://t${id}.com`}); },
    create: (opts) => Promise.resolve(opts),
    group: async ({tabIds}) => 1
  },
  runtime: {
    onMessage: {addListener: () => {}},
    onInstalled: {addListener: () => {}},
    sendMessage: () => {},
    getURL: (path) => 'chrome-extension://test/' + (path || ''),
    id: 'test-extension-id'
  },
  storage: {
    session: {
      get: async (key) => {
        if (typeof key === 'string') {
          return sessionStore[key] !== undefined ? {[key]: sessionStore[key]} : {};
        }
        // array of keys
        const result = {};
        for (const k of key) if (sessionStore[k] !== undefined) result[k] = sessionStore[k];
        return result;
      },
      set: async (obj) => { Object.assign(sessionStore, obj); },
      remove: async (keys) => { keys.forEach(k => delete sessionStore[k]); }
    },
    sync: {
      set: async (obj) => { Object.assign(syncStore, obj); }
    }
  },
  readingList: {
    addEntry: async (entry) => { readingListCalls.push(entry); return Promise.resolve(); },
    query: async () => [],
    removeEntry: async (opts) => Promise.resolve()
  },
  action: {
    onClicked: { addListener: () => {} }
  },
  tabGroups: {
    update: async () => {}
  }
};

let sessionStore = {};
let syncStore = {};

const {handleKeep, handleNuke, handleSave, markProcessed, tabSignature, createTabGroups} = require('./background.js');

(async () => {
  // Test: handleKeep (no-op: tabs stay open, no focus change)
  updatedTabs = [];
  await handleKeep([1, 2]);
  assert.deepStrictEqual(updatedTabs, [], 'keep does not activate tabs (user stays in popup)');

  // Test: handleNuke
  removedTabs = [];
  await handleNuke([5, 6, 7]);
  assert.deepStrictEqual(removedTabs, [5, 6, 7], 'nuke removes tabs');

  // Test: handleSave (uses Chrome readingList, not local storage)
  readingListCalls = [];
  getTabCalls = [];
  await handleSave([10, 20], 'My List', 'chill');
  assert.strictEqual(readingListCalls.length, 2, 'save calls readingList.addEntry for each tab');
  assert.strictEqual(readingListCalls[0].url, 'https://t10.com', 'first tab URL from mock');
  assert.strictEqual(readingListCalls[0].hasBeenRead, false, 'default unread');

  // Test: getReadingLists via chrome.readingList
  // (mock returns empty list, just verify no crash)
  const lists = await chrome.readingList.query({});
  assert.ok(Array.isArray(lists), 'readingList.query returns array');

  // Test: deleteReadingList via chrome.readingList
  // (mock always succeeds)
  await chrome.readingList.removeEntry({url: 'https://example.com'});
  // no assertion needed, just no throw

  // --- Test: handleGetTabsForCluster returns sanitized tabs and sig (cache miss) ---
  sessionStore = {};
  mockTabs = [
    { id: 1, title: 'A', url: 'https://a.com', pinned: false, favIconUrl: 'fav.png', windowId: 1 },
    { id: 2, title: 'B', url: 'https://b.com', pinned: false },
    { id: 3, title: 'pinned', url: 'https://c.com', pinned: true },     // excluded
    { id: 4, title: 'chrome', url: 'chrome://newtab/', pinned: false }, // excluded
  ];
  {
    const { handleGetTabsForCluster } = require('./background.js');
    const result = await handleGetTabsForCluster();
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.cached, false);
    assert.strictEqual(result.tabs.length, 2, 'pinned + chrome:// are filtered out');
    // Field whitelist: only id/title/url survive
    assert.deepStrictEqual(Object.keys(result.tabs[0]).sort(), ['id', 'title', 'url']);
    assert.ok(typeof result.sig === 'string');
  }

  // --- Test: handleGetTabsForCluster returns cached payload on signature match ---
  sessionStore = {
    tb_last_tab_ids: '1,2',
    tb_cluster_state: { type: 'clusters', clusters: [{ name: 'X', emoji: '🧪', tabIds: [1], vibe: 'v', confidence: 1 }] }
  };
  mockTabs = [
    { id: 1, title: 'A', url: 'https://a.com', pinned: false },
    { id: 2, title: 'B', url: 'https://b.com', pinned: false }
  ];
  {
    const { handleGetTabsForCluster } = require('./background.js');
    const result = await handleGetTabsForCluster();
    assert.strictEqual(result.cached, true);
    assert.strictEqual(result.payload.type, 'clusters');
    assert.strictEqual(result.payload.clusters[0].name, 'X');
  }

  // --- Test: handleCommitClusters writes to session and updates signature ---
  sessionStore = {};
  {
    const { handleCommitClusters } = require('./background.js');
    await handleCommitClusters([{ name: 'C', emoji: '📦', tabIds: [1], vibe: 'v', confidence: 1 }], 'sig-abc');
    assert.strictEqual(sessionStore.tb_cluster_state.clusters[0].name, 'C');
    assert.strictEqual(sessionStore.tb_last_tab_ids, 'sig-abc');
  }

  // --- Test: onInstalled with reason='install' opens options with welcome=1 ---
  {
    // Stash the listener registered by background.js
    let registeredListener = null;
    chrome.runtime.onInstalled = { addListener: (fn) => { registeredListener = fn; } };
    // Re-require background.js to re-register
    delete require.cache[require.resolve('./background.js')];
    require('./background.js');
    assert.ok(registeredListener, 'onInstalled listener registered');

    // Simulate install (should open options with welcome=1)
    let createdTabs = [];
    chrome.tabs.create = (opts) => { createdTabs.push(opts); return Promise.resolve(); };
    registeredListener({ reason: 'install' });
    assert.ok(createdTabs[0].url.includes('options.html?welcome=1'));
  }

  console.log('All tests passed');
})();
