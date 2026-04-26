import assert from 'node:assert';
import { googleCluster } from './google.js';
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

// Happy path: API key in URL, system instruction separate, JSON mime hint set
{
  mockFetch.calls = [];
  globalThis.fetch = mockFetch({
    ok: true, status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text: CLUSTERS_JSON }] } }] })
  });
  const out = await googleCluster(
    [{id:1,title:'A',url:'https://a.com'}],
    'AIzaTEST', 'gemini-2.5-flash', 'be witty'
  );
  assert.strictEqual(out[0].name, 'X');
  const call = mockFetch.calls[0];
  assert.ok(call.url.startsWith('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'));
  assert.ok(call.url.includes('key=AIzaTEST'));
  const body = JSON.parse(call.opts.body);
  assert.ok(body.systemInstruction.parts[0].text.includes('be witty'));
  assert.strictEqual(body.generationConfig.responseMimeType, 'application/json');
  assert.strictEqual(body.contents[0].role, 'user');
}

// 401/403 -> auth
{
  globalThis.fetch = mockFetch({ ok: false, status: 403, json: async () => ({}) });
  await assert.rejects(
    () => googleCluster([], 'bad', 'gemini-2.5-flash', ''),
    err => err instanceof LlmError && err.kind === 'auth'
  );
}

// 429 -> rate_limit
{
  globalThis.fetch = mockFetch({ ok: false, status: 429, json: async () => ({}) });
  await assert.rejects(
    () => googleCluster([], 'k', 'gemini-2.5-flash', ''),
    err => err instanceof LlmError && err.kind === 'rate_limit'
  );
}

// fetch throws -> network
{
  globalThis.fetch = async () => { throw new Error('boom'); };
  await assert.rejects(
    () => googleCluster([], 'k', 'gemini-2.5-flash', ''),
    err => err instanceof LlmError && err.kind === 'network'
  );
}

console.log('byok/google.test.js passed');
