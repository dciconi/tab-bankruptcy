import { buildMessages } from '../prompt.js';
import { parseClusters } from '../parse.js';
import { LlmError } from '../errors.js';

export async function openaiCluster(tabs, apiKey, model, customPrompt) {
  const messages = buildMessages(tabs, customPrompt);
  let res;
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: 'json_object' }
      })
    });
  } catch (e) {
    throw new LlmError('network', e.message, e);
  }
  if (res.status === 401 || res.status === 403) throw new LlmError('auth', 'OpenAI rejected the API key', null);
  if (res.status === 429) throw new LlmError('rate_limit', 'OpenAI rate limit hit', null);
  if (!res.ok) throw new LlmError('unknown', `OpenAI returned ${res.status}`, null);
  const data = await res.json();
  return parseClusters(data.choices?.[0]?.message?.content ?? '');
}
