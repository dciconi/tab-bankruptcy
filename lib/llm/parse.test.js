import assert from 'node:assert';
import { parseClusters } from './parse.js';
import { ClusterParseError } from './errors.js';

// Bare JSON with clusters array
{
  const out = parseClusters('{"clusters":[{"name":"X","emoji":"📦","tabIds":[1],"vibe":"v","confidence":0.9}]}');
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].name, 'X');
}

// Strips ```json fences
{
  const wrapped = '```json\n{"clusters":[{"name":"Y","emoji":"🧪","tabIds":[2],"vibe":"v","confidence":0.5}]}\n```';
  const out = parseClusters(wrapped);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].name, 'Y');
}

// Strips bare ``` fences
{
  const wrapped = '```\n{"clusters":[{"name":"Z","emoji":"🧪","tabIds":[3],"vibe":"v","confidence":0.5}]}\n```';
  const out = parseClusters(wrapped);
  assert.strictEqual(out[0].name, 'Z');
}

// Tolerates leading/trailing chatter — extracts first { to last }
{
  const noisy = 'Sure! Here you go:\n{"clusters":[{"name":"N","emoji":"🪐","tabIds":[4],"vibe":"v","confidence":1}]}\nLet me know if you need anything else.';
  const out = parseClusters(noisy);
  assert.strictEqual(out[0].name, 'N');
}

// Throws on empty
assert.throws(() => parseClusters(''), ClusterParseError);
assert.throws(() => parseClusters(null), ClusterParseError);

// Throws on non-JSON
assert.throws(() => parseClusters('no braces here'), ClusterParseError);

// Throws when JSON has no clusters key
assert.throws(() => parseClusters('{"foo":"bar"}'), ClusterParseError);

// Throws when clusters is not an array
assert.throws(() => parseClusters('{"clusters": "not an array"}'), ClusterParseError);

// Throws on malformed JSON
assert.throws(() => parseClusters('{"clusters":[{,]}'), ClusterParseError);

console.log('parse.test.js passed');
