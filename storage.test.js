const assert = require('assert');

let storeData = {};
let nextId = 1;

global.indexedDB = {
  open: (name, version) => {
    const req = {
      result: {
        objectStoreNames: {contains: () => false},
        createObjectStore: () => ({})
      },
      onupgradeneeded: null,
      onsuccess: null,
      onerror: null
    };
    setTimeout(() => {
      if (req.onsuccess) req.onsuccess({target: req});
    }, 0);
    return req;
  }
};

const fakeDB = {
  transaction: (storeName, mode) => ({
    objectStore: (name) => ({
      add: (record) => {
        const id = nextId++;
        storeData[id] = {...record, id};
        const req = {result: id, onsuccess: null, onerror: null};
        setTimeout(() => req.onsuccess && req.onsuccess({target: req}), 0);
        return req;
      },
      getAll: () => {
        const req = {result: Object.values(storeData), onsuccess: null, onerror: null};
        setTimeout(() => req.onsuccess && req.onsuccess({target: req}), 0);
        return req;
      },
      delete: (id) => {
        delete storeData[id];
        const req = {onsuccess: null, onerror: null};
        setTimeout(() => req.onsuccess && req.onsuccess({target: req}), 0);
        return req;
      }
    })
  })
};

global.indexedDB.open = () => {
  const req = {
    result: fakeDB,
    onupgradeneeded: null,
    onsuccess: null,
    onerror: null
  };
  setTimeout(() => {
    if (req.onsuccess) req.onsuccess({target: req});
  }, 0);
  return req;
};

const {saveReadingList, getReadingLists, deleteReadingList} = require('./lib/storage.js');

(async () => {
  storeData = {};
  nextId = 1;

  // Test 1: saveReadingList
  const id1 = await saveReadingList({name: 'Test List', tabs: [{id: 1, title: 'A', url: 'https://a.com'}], vibe: 'chill'});
  assert.strictEqual(typeof id1, 'number', 'save returns id');

  // Test 2: getReadingLists
  const lists = await getReadingLists();
  assert.strictEqual(lists.length, 1, 'get returns saved list');
  assert.strictEqual(lists[0].name, 'Test List', 'list has correct name');
  assert.strictEqual(lists[0].tabs.length, 1, 'list has tabs');
  assert.strictEqual(lists[0].vibe, 'chill', 'list has vibe');
  assert.ok(lists[0].createdAt, 'list has createdAt');

  // Test 3: deleteReadingList
  await deleteReadingList(id1);
  const after = await getReadingLists();
  assert.strictEqual(after.length, 0, 'delete removes list');

  // Test 4: save with defaults
  const id2 = await saveReadingList({name: 'Defaults'});
  const all = await getReadingLists();
  assert.strictEqual(all[0].tabs.length, 0, 'default empty tabs');
  assert.strictEqual(all[0].vibe, '', 'default empty vibe');

  console.log('All storage tests passed');
})();
