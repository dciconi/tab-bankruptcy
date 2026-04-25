import assert from 'node:assert';
import { buildMessages } from './prompt.js';

// Whitelists fields — strips everything except id, title, url
{
  const tabs = [
    { id: 1, title: 'A', url: 'https://a.com', favIconUrl: 'x.png', windowId: 99, lastAccessed: 1234 }
  ];
  const msgs = buildMessages(tabs, 'be funny');
  const userPayload = msgs.find(m => m.role === 'user').content;
  const inner = JSON.parse(userPayload.split('\n').slice(1).join('\n'));
  assert.deepStrictEqual(inner, [{ id: 1, title: 'A', url: 'https://a.com' }],
    'only id, title, url should pass through');
}

// Threads customPrompt into the system message
{
  const msgs = buildMessages([], 'BE WITTY');
  const sys = msgs.find(m => m.role === 'system');
  assert.ok(sys, 'has a system message');
  assert.ok(sys.content.includes('BE WITTY'), 'customPrompt is in system message');
  assert.ok(sys.content.includes('clusters'), 'JSON schema instruction is in system message');
}

// Empty/missing customPrompt still produces valid system message
{
  const msgs = buildMessages([{id: 1, title: 'T', url: 'https://t.com'}], '');
  const sys = msgs.find(m => m.role === 'system');
  assert.ok(sys.content.includes('clusters'));
}

// Returns array with system + user roles, in that order
{
  const msgs = buildMessages([], 'p');
  assert.strictEqual(msgs.length, 2);
  assert.strictEqual(msgs[0].role, 'system');
  assert.strictEqual(msgs[1].role, 'user');
}

console.log('prompt.test.js passed');
