import { buildMessages } from '../prompt.js';
import { parseClusters } from '../parse.js';
import { LlmError } from '../errors.js';

export async function anthropicCluster(tabs, apiKey, model, customPrompt) {
  const allMessages = buildMessages(tabs, customPrompt);
  // Anthropic separates `system` from `messages`
  const systemMsg = allMessages.find(m => m.role === 'system')?.content || '';
  const userMessages = allMessages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role, content: m.content }));

  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        // Required for direct-from-browser calls (per Anthropic docs).
        'anthropic-dangerous-direct-browser-access': 'true',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemMsg,
        messages: userMessages
      })
    });
  } catch (e) {
    throw new LlmError('network', e.message, e);
  }
  if (res.status === 401 || res.status === 403) throw new LlmError('auth', 'Anthropic rejected the API key', null);
  if (res.status === 429) throw new LlmError('rate_limit', 'Anthropic rate limit hit', null);
  if (!res.ok) throw new LlmError('unknown', `Anthropic returned ${res.status}`, null);
  const data = await res.json();
  // Anthropic returns content as an array of typed blocks
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  return parseClusters(text);
}
