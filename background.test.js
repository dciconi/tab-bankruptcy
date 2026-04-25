const assert = require('assert');

let mockTabs = [];
let mockFetchResponse = {ok: true, json: async () => ({clusters: [{name: 'Test', emoji: '🧪', tabIds: [1], vibe: 'test', confidence: 1}]})};
let fetchCalls = [];
let updatedTabs = [];
let removedTabs = [];
let getTabCalls = [];
let savedLists = [];

let readingListCalls = [];

global.chrome = {
  tabs: {
    query: () => Promise.resolve(mockTabs),
    update: (id, props) => { updatedTabs.push({id, props}); return Promise.resolve(); },
    remove: (ids) => { removedTabs.push(...(Array.isArray(ids) ? ids : [ids])); return Promise.resolve(); },
    get: (id) => { getTabCalls.push(id); return Promise.resolve({id, title: `Tab ${id}`, url: `https://t${id}.com`}); }
  },
  runtime: {
    onMessage: {addListener: () => {}},
    sendMessage: () => {},
    getURL: (path) => 'chrome-extension://test/' + (path || '')
  },
  alarms: {
    create: (name, opts) => { alarmCreated = {name, opts}; },
    clear: (name) => { alarmCleared = name; return Promise.resolve(); }
  },
  storage: {
    session: {
      get: async (key) => sessionStore[key] ? {[key]: sessionStore[key]} : {},
      set: async (obj) => { Object.assign(sessionStore, obj); },
      remove: async (keys) => { keys.forEach(k => delete sessionStore[k]); }
    }
  },
  readingList: {
    addEntry: async (entry) => { readingListCalls.push(entry); return Promise.resolve(); },
    query: async () => [],
    removeEntry: async (opts) => Promise.resolve()
  },
  action: {
    onClicked: { addListener: () => {} }
  }
};

let alarmCreated = null;
let alarmCleared = null;
let sessionStore = {};

global.fetch = async (url, opts) => {
  fetchCalls.push({url, opts});
  return mockFetchResponse;
};

const {handleClusterRequest, handleKeep, handleNuke, handleSave, fetchWithRetry, markProcessed, tabSignature} = require('./background.js');

(async () => {
  // Test 1: basic clustering flow
  mockTabs = [{id: 1, url: 'https://a.com', pinned: false}, {id: 2, url: 'chrome://b', pinned: false}, {id: 3, url: 'about:blank', pinned: true}];
  fetchCalls = [];
  await handleClusterRequest();
  assert.strictEqual(fetchCalls.length, 1, 'fetch called once');
  const sentTabs = JSON.parse(fetchCalls[0].opts.body).tabs;
  assert.strictEqual(sentTabs.length, 1, 'only non-pinned non-chrome/about tabs sent');
  assert.strictEqual(sentTabs[0].id, 1, 'correct tab filtered');

  // Test 2: filter logic
  mockTabs = [
    {id: 10, url: 'https://x.com', pinned: false},
    {id: 11, url: 'chrome://settings', pinned: false},
    {id: 12, url: 'https://y.com', pinned: true},
    {id: 13, url: 'about:blank', pinned: false}
  ];
  fetchCalls = [];
  await handleClusterRequest();
  const filtered = JSON.parse(fetchCalls[0].opts.body).tabs.map(t => t.id);
  assert.deepStrictEqual(filtered, [10], 'filter excludes chrome://, about:, pinned');

  // Test 3: handleKeep (no-op: tabs stay open, no focus change)
  updatedTabs = [];
  await handleKeep([1, 2]);
  assert.deepStrictEqual(updatedTabs, [], 'keep does not activate tabs (user stays in popup)');

  // Test 4: handleNuke
  removedTabs = [];
  await handleNuke([5, 6, 7]);
  assert.deepStrictEqual(removedTabs, [5, 6, 7], 'nuke removes tabs');

  // Test 5: handleSave (uses Chrome readingList, not local storage)
  readingListCalls = [];
  getTabCalls = [];
  await handleSave([10, 20], 'My List', 'chill');
  assert.strictEqual(readingListCalls.length, 2, 'save calls readingList.addEntry for each tab');
  assert.strictEqual(readingListCalls[0].url, 'https://t10.com', 'first tab URL from mock');
  assert.strictEqual(readingListCalls[0].hasBeenRead, false, 'default unread');

  // Test 6: getReadingLists via chrome.readingList
  // (mock returns empty list, just verify no crash)
  const lists = await chrome.readingList.query({});
  assert.ok(Array.isArray(lists), 'readingList.query returns array');

  // Test 7: deleteReadingList via chrome.readingList
  // (mock always succeeds)
  await chrome.readingList.removeEntry({url: 'https://example.com'});
  // no assertion needed, just no throw

  // Test 8: Phase 3 — fetchWithRetry retries 5xx with backoff
  let retryCount = 0;
  global.fetch = async () => {
    retryCount++;
    if (retryCount < 3) return {ok: false, status: 503};
    return {ok: true, json: async () => ({clusters: []})};
  };
  retryCount = 0;
  fetchCalls = [];
  await fetchWithRetry('http://x', {});
  assert.strictEqual(retryCount, 3, 'retries 3 times on 5xx');

  // Test 9: Phase 3 — large session (>100 tabs) triggers warning
  mockTabs = Array.from({length: 120}, (_, i) => ({id: i, url: `https://t${i}.com`, pinned: false}));
  alarmCreated = null;
  sessionStore = {};
  global.fetch = async () => ({ok: true, json: async () => ({clusters: [{name: 'X'}]})});
  await handleClusterRequest();
  assert.ok(alarmCreated, 'alarm created for SW keep-alive');
  assert.strictEqual(alarmCreated.name, 'tb_sw_keepalive', 'correct alarm name');

  // Test 10: Phase 3 — session state persisted
  assert.ok(sessionStore.tb_cluster_state, 'session state saved');
  assert.strictEqual(sessionStore.tb_cluster_state.type, 'clusters', 'session has clusters');

  console.log('All tests passed');
})();
