import assert from 'node:assert';
import { clusterTabs } from './index.js';
import { ApiKeyMissingError, PuterNotSignedIn } from './errors.js';

// Routes provider='puter' -> puterCluster
{
  globalThis.window = {
    puter: {
      auth: { isSignedIn: async () => true },
      ai: { chat: async () => ({ message: { content: '{"clusters":[{"name":"P","emoji":"🪐","tabIds":[1],"vibe":"v","confidence":1}]}' } }) }
    }
  };
  const out = await clusterTabs(
    [{id:1,title:'A',url:'https://a.com'}],
    { provider: 'puter', puterModel: 'x-ai/grok-3-mini', customPrompt: '' }
  );
  assert.strictEqual(out[0].name, 'P');
}

// Routes provider='puter' when not signed in -> PuterNotSignedIn
{
  globalThis.window = {
    puter: { auth: { isSignedIn: async () => false }, ai: { chat: async () => ({}) } }
  };
  await assert.rejects(
    () => clusterTabs([], { provider: 'puter', puterModel: 'x', customPrompt: '' }),
    err => err instanceof PuterNotSignedIn
  );
}

// Routes provider='byok' with no key -> ApiKeyMissingError
{
  await assert.rejects(
    () => clusterTabs([], {
      provider: 'byok',
      byokProvider: 'openai',
      byokModels: { openai: 'gpt-4o-mini' },
      apiKeys: {},
      customPrompt: ''
    }),
    err => err instanceof ApiKeyMissingError && err.provider === 'openai'
  );
}

console.log('index.test.js passed');
