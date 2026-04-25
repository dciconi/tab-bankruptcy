import assert from 'node:assert';
import { byokCluster } from './byok-provider.js';
import { ApiKeyMissingError } from './errors.js';

// Stub the underlying fetches; we only assert routing here.
let lastUrl = null;
globalThis.fetch = async (url, opts) => {
  lastUrl = url;
  return {
    ok: true, status: 200,
    json: async () => {
      if (url.includes('openai.com') || url.includes('x.ai')) {
        return { choices: [{ message: { content: '{"clusters":[{"name":"R","emoji":"🧪","tabIds":[1],"vibe":"v","confidence":1}]}' } }] };
      }
      if (url.includes('anthropic.com')) {
        return { content: [{ type: 'text', text: '{"clusters":[{"name":"R","emoji":"🧪","tabIds":[1],"vibe":"v","confidence":1}]}' }] };
      }
      return { candidates: [{ content: { parts: [{ text: '{"clusters":[{"name":"R","emoji":"🧪","tabIds":[1],"vibe":"v","confidence":1}]}' }] } }] };
    }
  };
};

const baseTabs = [{id:1, title:'a', url:'https://a.com'}];
const settings = (provider) => ({
  byokProvider: provider,
  byokModels: { xai:'grok-3-mini', openai:'gpt-4o-mini', anthropic:'claude-haiku-4-5-20251001', google:'gemini-2.5-flash' },
  apiKeys: { xai:'x', openai:'o', anthropic:'a', google:'g' },
  customPrompt: ''
});

// Routes to xAI
{
  await byokCluster(baseTabs, settings('xai'));
  assert.ok(lastUrl.includes('api.x.ai'));
}
// Routes to OpenAI
{
  await byokCluster(baseTabs, settings('openai'));
  assert.ok(lastUrl.includes('api.openai.com'));
}
// Routes to Anthropic
{
  await byokCluster(baseTabs, settings('anthropic'));
  assert.ok(lastUrl.includes('api.anthropic.com'));
}
// Routes to Google
{
  await byokCluster(baseTabs, settings('google'));
  assert.ok(lastUrl.includes('generativelanguage.googleapis.com'));
}

// Missing key -> ApiKeyMissingError
{
  const s = settings('xai');
  s.apiKeys = {};
  await assert.rejects(
    () => byokCluster(baseTabs, s),
    err => err instanceof ApiKeyMissingError && err.provider === 'xai'
  );
}

// Unknown provider -> generic Error
{
  const s = settings('xai');
  s.byokProvider = 'unknown_thing';
  s.apiKeys = { unknown_thing: 'k' };
  await assert.rejects(() => byokCluster(baseTabs, s), /Unknown BYOK provider/);
}

console.log('byok-provider.test.js passed');
