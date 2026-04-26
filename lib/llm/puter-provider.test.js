import assert from 'node:assert';
import { puterCluster, PUTER_DASHBOARD_URL } from './puter-provider.js';
import { PuterNotSignedIn, PuterOutOfCredits } from './errors.js';

// Build a fake window.puter for each scenario.
function setupPuter({ signedIn, chatImpl }) {
  globalThis.window = {
    puter: {
      auth: { isSignedIn: async () => signedIn },
      ai: { chat: chatImpl }
    }
  };
}

// Dashboard URL is exported and stable
assert.strictEqual(PUTER_DASHBOARD_URL, 'https://puter.com/dashboard');

// Not signed in -> PuterNotSignedIn
{
  setupPuter({ signedIn: false, chatImpl: async () => { throw new Error('should not be called'); } });
  await assert.rejects(
    () => puterCluster([], { puterModel: 'x-ai/grok-3-mini', customPrompt: '' }),
    err => err instanceof PuterNotSignedIn
  );
}

// usage-limited-chat delegate -> PuterOutOfCredits
{
  setupPuter({
    signedIn: true,
    chatImpl: async () => {
      const e = new Error('Permission denied');
      e.delegate = 'usage-limited-chat';
      e.code = 'error_400_from_delegate';
      throw e;
    }
  });
  await assert.rejects(
    () => puterCluster([], { puterModel: 'x-ai/grok-3-mini', customPrompt: '' }),
    err => err instanceof PuterOutOfCredits
  );
}

// error_400_from_delegate alone (no delegate field) also wrapped
{
  setupPuter({
    signedIn: true,
    chatImpl: async () => {
      const e = new Error('something');
      e.code = 'error_400_from_delegate';
      throw e;
    }
  });
  await assert.rejects(
    () => puterCluster([], { puterModel: 'x', customPrompt: '' }),
    err => err instanceof PuterOutOfCredits
  );
}

// Other errors pass through unchanged
{
  setupPuter({
    signedIn: true,
    chatImpl: async () => { throw new Error('weird crash'); }
  });
  await assert.rejects(
    () => puterCluster([], { puterModel: 'x', customPrompt: '' }),
    err => err.message === 'weird crash' && !(err instanceof PuterOutOfCredits)
  );
}

// Happy path: model arg is always passed; stream is never true; result parses
{
  let receivedOptions = null;
  let receivedTestMode = null;
  setupPuter({
    signedIn: true,
    chatImpl: async (messages, testMode, options) => {
      receivedOptions = options;
      receivedTestMode = testMode;
      return { message: { content: '{"clusters":[{"name":"X","emoji":"🧪","tabIds":[1],"vibe":"v","confidence":0.9}]}' } };
    }
  });
  const out = await puterCluster(
    [{id:1,title:'A',url:'https://a.com'}],
    { puterModel: 'x-ai/grok-3-mini', customPrompt: 'p' }
  );
  assert.strictEqual(out[0].name, 'X');
  assert.strictEqual(receivedTestMode, false, 'real call uses testMode=false');
  assert.strictEqual(receivedOptions.model, 'x-ai/grok-3-mini',
    'model must always be explicit (Puter default is gpt-5-nano)');
  assert.notStrictEqual(receivedOptions.stream, true,
    'stream must not be true — Puter issue #2410 hangs on errors');
}

// SDK missing -> generic Error
{
  globalThis.window = {};
  await assert.rejects(
    () => puterCluster([], { puterModel: 'x', customPrompt: '' }),
    /Puter SDK not loaded/
  );
}

console.log('puter-provider.test.js passed');
