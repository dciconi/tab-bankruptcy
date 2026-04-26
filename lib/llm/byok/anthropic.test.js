import assert from 'node:assert';
import { anthropicCluster } from './anthropic.js';
import { LlmError } from '../errors.js';

const CLUSTERS_JSON = JSON.stringify({
  clusters: [{ name: 'X', emoji: '🧪', tabIds: [1], vibe: 'v', confidence: 0.9 }]
});

function mockFetch(responseInit) {
  return async (url, opts) => {
    mockFetch.calls.push({ url, opts });
    return responseInit;
  };
}
mockFetch.calls = [];

// Happy path: separates system from messages, sets required headers
{
  mockFetch.calls = [];
  globalThis.fetch = mockFetch({
    ok: true, status: 200,
    json: async () => ({ content: [{ type: 'text', text: CLUSTERS_JSON }] })
  });
  const out = await anthropicCluster(
    [{id:1,title:'A',url:'https://a.com'}],
    'sk-ant-test', 'claude-haiku-4-5-20251001', 'be witty'
  );
  assert.strictEqual(out[0].name, 'X');
  const call = mockFetch.calls[0];
  assert.strictEqual(call.url, 'https://api.anthropic.com/v1/messages');
  assert.strictEqual(call.opts.headers['x-api-key'], 'sk-ant-test');
  assert.strictEqual(call.opts.headers['anthropic-version'], '2023-06-01');
  assert.strictEqual(call.opts.headers['anthropic-dangerous-direct-browser-access'], 'true');
  const body = JSON.parse(call.opts.body);
  assert.strictEqual(body.model, 'claude-haiku-4-5-20251001');
  assert.ok(body.system.includes('be witty'), 'system goes in dedicated field');
  assert.ok(Array.isArray(body.messages));
  assert.strictEqual(body.messages.find(m => m.role === 'system'), undefined,
    'no system role in messages array');
  assert.ok(typeof body.max_tokens === 'number');
}

// 401 -> auth
{
  globalThis.fetch = mockFetch({ ok: false, status: 401, json: async () => ({}) });
  await assert.rejects(
    () => anthropicCluster([], 'bad', 'claude-haiku-4-5-20251001', ''),
    err => err instanceof LlmError && err.kind === 'auth'
  );
}

// 429 -> rate_limit
{
  globalThis.fetch = mockFetch({ ok: false, status: 429, json: async () => ({}) });
  await assert.rejects(
    () => anthropicCluster([], 'k', 'claude-haiku-4-5-20251001', ''),
    err => err instanceof LlmError && err.kind === 'rate_limit'
  );
}

// fetch throws -> network
{
  globalThis.fetch = async () => { throw new Error('boom'); };
  await assert.rejects(
    () => anthropicCluster([], 'k', 'claude-haiku-4-5-20251001', ''),
    err => err instanceof LlmError && err.kind === 'network'
  );
}

console.log('byok/anthropic.test.js passed');
