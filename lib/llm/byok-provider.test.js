import assert from 'node:assert';
import { byokCluster } from './byok-provider.js';
import { ApiKeyMissingError } from './errors.js';

const RESP = '{"clusters":[{"name":"R","emoji":"🧪","tabIds":[1],"vibe":"v","confidence":1}]}';

function shapeFor(url) {
  if (url.includes('openai.com') || url.includes('x.ai')) {
    return { choices: [{ message: { content: RESP } }] };
  }
  if (url.includes('anthropic.com')) {
    return { content: [{ type: 'text', text: RESP }] };
  }
  return { candidates: [{ content: { parts: [{ text: RESP }] } }] };
}

function okFetch() {
  return async (url) => ({ ok: true, status: 200, json: async () => shapeFor(url) });
}

function authFailFetch() {
  return async () => ({ ok: false, status: 401, json: async () => ({}) });
}

const baseTabs = [{ id: 1, title: 'a', url: 'https://a.com' }];

const keyOf = (provider, id = 'k_' + provider) => ({
  id,
  label: provider,
  provider,
  model: { xai: 'grok-x', openai: 'gpt-x', anthropic: 'claude-x', google: 'gemini-x' }[provider],
  key: 'sk-' + provider,
  status: 'untested',
  lastTestedAt: null,
  lastError: null
});

// Empty list -> ApiKeyMissingError
{
  await assert.rejects(
    () => byokCluster(baseTabs, { byokKeys: [] }),
    err => err instanceof ApiKeyMissingError
  );
  await assert.rejects(
    () => byokCluster(baseTabs, {}),
    err => err instanceof ApiKeyMissingError
  );
}

// First key succeeds -> immediate return; status callback fires once with 'verified'
{
  globalThis.fetch = okFetch();
  const statusCalls = [];
  const out = await byokCluster(baseTabs, {
    byokKeys: [keyOf('xai')],
    customPrompt: '',
    onKeyStatus: async (id, status, err) => statusCalls.push({ id, status, err })
  });
  assert.strictEqual(out[0].name, 'R');
  assert.deepStrictEqual(statusCalls, [{ id: 'k_xai', status: 'verified', err: null }]);
}

// First key fails (auth) -> falls back to second key (success); both statuses recorded
{
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls++;
    if (calls === 1) return { ok: false, status: 401, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => shapeFor(url) };
  };
  const statusCalls = [];
  const out = await byokCluster(baseTabs, {
    byokKeys: [keyOf('xai'), keyOf('openai')],
    customPrompt: '',
    onKeyStatus: async (id, status, err) => statusCalls.push({ id, status })
  });
  assert.strictEqual(out[0].name, 'R');
  assert.strictEqual(statusCalls.length, 2);
  assert.deepStrictEqual(statusCalls[0], { id: 'k_xai', status: 'failed' });
  assert.deepStrictEqual(statusCalls[1], { id: 'k_openai', status: 'verified' });
}

// All keys fail -> rethrow last error; every key gets a 'failed' callback
{
  globalThis.fetch = authFailFetch();
  const statusCalls = [];
  await assert.rejects(
    () => byokCluster(baseTabs, {
      byokKeys: [keyOf('xai'), keyOf('openai'), keyOf('anthropic')],
      customPrompt: '',
      onKeyStatus: async (id, status) => statusCalls.push({ id, status })
    })
  );
  assert.strictEqual(statusCalls.length, 3);
  assert.ok(statusCalls.every(c => c.status === 'failed'));
  assert.deepStrictEqual(statusCalls.map(c => c.id), ['k_xai', 'k_openai', 'k_anthropic']);
}

// Unknown provider in the list -> marked failed and skipped, next is tried
{
  globalThis.fetch = okFetch();
  const statusCalls = [];
  const out = await byokCluster(baseTabs, {
    byokKeys: [
      { id: 'k_bogus', label: 'X', provider: 'bogus', model: 'm', key: 'k' },
      keyOf('google')
    ],
    customPrompt: '',
    onKeyStatus: async (id, status) => statusCalls.push({ id, status })
  });
  assert.strictEqual(out[0].name, 'R');
  assert.strictEqual(statusCalls[0].status, 'failed');
  assert.strictEqual(statusCalls[0].id, 'k_bogus');
  assert.strictEqual(statusCalls[1].status, 'verified');
  assert.strictEqual(statusCalls[1].id, 'k_google');
}

// onKeyStatus is optional — works without it
{
  globalThis.fetch = okFetch();
  const out = await byokCluster(baseTabs, {
    byokKeys: [keyOf('xai')],
    customPrompt: ''
  });
  assert.strictEqual(out[0].name, 'R');
}

// Each provider in the list is dispatched to the correct endpoint
{
  const urlsHit = [];
  globalThis.fetch = async (url) => {
    urlsHit.push(url);
    return { ok: true, status: 200, json: async () => shapeFor(url) };
  };
  await byokCluster(baseTabs, { byokKeys: [keyOf('xai')], customPrompt: '' });
  assert.ok(urlsHit[0].includes('api.x.ai'));

  urlsHit.length = 0;
  await byokCluster(baseTabs, { byokKeys: [keyOf('anthropic')], customPrompt: '' });
  assert.ok(urlsHit[0].includes('api.anthropic.com'));
}

console.log('byok-provider.test.js passed');
