import assert from 'node:assert';
import { openaiCluster } from './openai.js';
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

// Happy path
{
  mockFetch.calls = [];
  globalThis.fetch = mockFetch({
    ok: true, status: 200,
    json: async () => ({ choices: [{ message: { content: CLUSTERS_RESPONSE } }] })
  });
  const out = await openaiCluster([{id:1,title:'A',url:'https://a.com'}], 'sk-test', 'gpt-4o-mini', '');
  assert.strictEqual(out[0].name, 'X');
  const call = mockFetch.calls[0];
  assert.strictEqual(call.url, 'https://api.openai.com/v1/chat/completions');
  assert.strictEqual(call.opts.headers['Authorization'], 'Bearer sk-test');
  const body = JSON.parse(call.opts.body);
  assert.strictEqual(body.model, 'gpt-4o-mini');
  assert.strictEqual(body.response_format.type, 'json_object');
}

// 401 -> auth
{
  globalThis.fetch = mockFetch({ ok: false, status: 401, json: async () => ({}) });
  await assert.rejects(
    () => openaiCluster([], 'bad', 'gpt-4o-mini', ''),
    err => err instanceof LlmError && err.kind === 'auth'
  );
}

// 429 -> rate_limit
{
  globalThis.fetch = mockFetch({ ok: false, status: 429, json: async () => ({}) });
  await assert.rejects(
    () => openaiCluster([], 'k', 'gpt-4o-mini', ''),
    err => err instanceof LlmError && err.kind === 'rate_limit'
  );
}

// fetch throws -> network
{
  globalThis.fetch = async () => { throw new Error('boom'); };
  await assert.rejects(
    () => openaiCluster([], 'k', 'gpt-4o-mini', ''),
    err => err instanceof LlmError && err.kind === 'network'
  );
}

console.log('byok/openai.test.js passed');
