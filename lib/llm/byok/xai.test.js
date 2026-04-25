import assert from 'node:assert';
import { xaiCluster } from './xai.js';
import { LlmError } from '../errors.js';

const CLUSTERS_RESPONSE = JSON.stringify({
  clusters: [{ name: 'X', emoji: '🧪', tabIds: [1], vibe: 'v', confidence: 0.9 }]
});

function mockFetch(responseInit) {
  return async (url, opts) => {
    mockFetch.calls.push({ url, opts });
    return responseInit;
  };
}
mockFetch.calls = [];

// Happy path: builds correct request and parses response
{
  mockFetch.calls = [];
  globalThis.fetch = mockFetch({
    ok: true, status: 200,
    json: async () => ({ choices: [{ message: { content: CLUSTERS_RESPONSE } }] })
  });
  const tabs = [{ id: 1, title: 'A', url: 'https://a.com' }];
  const out = await xaiCluster(tabs, 'sk-test-key', 'grok-3-mini', 'be funny');
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].name, 'X');

  const call = mockFetch.calls[0];
  assert.strictEqual(call.url, 'https://api.x.ai/v1/chat/completions');
  assert.strictEqual(call.opts.method, 'POST');
  assert.strictEqual(call.opts.headers['Authorization'], 'Bearer sk-test-key');
  const body = JSON.parse(call.opts.body);
  assert.strictEqual(body.model, 'grok-3-mini');
  assert.strictEqual(body.response_format.type, 'json_object');
}

// 401 -> LlmError{kind:'auth'}
{
  globalThis.fetch = mockFetch({ ok: false, status: 401, json: async () => ({}) });
  await assert.rejects(
    () => xaiCluster([], 'bad', 'grok-3-mini', ''),
    err => err instanceof LlmError && err.kind === 'auth'
  );
}

// 429 -> LlmError{kind:'rate_limit'}
{
  globalThis.fetch = mockFetch({ ok: false, status: 429, json: async () => ({}) });
  await assert.rejects(
    () => xaiCluster([], 'k', 'grok-3-mini', ''),
    err => err instanceof LlmError && err.kind === 'rate_limit'
  );
}

// fetch throws -> LlmError{kind:'network'}
{
  globalThis.fetch = async () => { throw new Error('ENETDOWN'); };
  await assert.rejects(
    () => xaiCluster([], 'k', 'grok-3-mini', ''),
    err => err instanceof LlmError && err.kind === 'network'
  );
}

console.log('byok/xai.test.js passed');
