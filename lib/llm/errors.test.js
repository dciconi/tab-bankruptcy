import assert from 'node:assert';
import {
  ApiKeyMissingError,
  PuterNotSignedIn,
  PuterOutOfCredits,
  ClusterParseError,
  LlmError
} from './errors.js';

// ApiKeyMissingError carries the provider name
{
  const e = new ApiKeyMissingError('openai');
  assert.strictEqual(e.name, 'ApiKeyMissingError');
  assert.strictEqual(e.provider, 'openai');
  assert.ok(e.message.includes('openai'));
}

// PuterNotSignedIn has a stable name
{
  const e = new PuterNotSignedIn();
  assert.strictEqual(e.name, 'PuterNotSignedIn');
}

// PuterOutOfCredits wraps the original error
{
  const orig = { delegate: 'usage-limited-chat', status: 400 };
  const e = new PuterOutOfCredits(orig);
  assert.strictEqual(e.name, 'PuterOutOfCredits');
  assert.strictEqual(e.original, orig);
}

// ClusterParseError carries the raw text
{
  const e = new ClusterParseError('bad json', 'not even close');
  assert.strictEqual(e.name, 'ClusterParseError');
  assert.strictEqual(e.raw, 'not even close');
}

// LlmError has a kind discriminator
{
  const e = new LlmError('auth', 'bad key', null);
  assert.strictEqual(e.name, 'LlmError');
  assert.strictEqual(e.kind, 'auth');
}

console.log('errors.test.js passed');
