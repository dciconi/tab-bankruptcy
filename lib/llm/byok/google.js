import { buildMessages } from '../prompt.js';
import { parseClusters } from '../parse.js';
import { LlmError } from '../errors.js';

export async function googleCluster(tabs, apiKey, model, customPrompt) {
  const allMessages = buildMessages(tabs, customPrompt);
  const systemMsg = allMessages.find(m => m.role === 'system')?.content || '';
  const userText = allMessages.filter(m => m.role === 'user').map(m => m.content).join('\n');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemMsg }] },
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });
  } catch (e) {
    throw new LlmError('network', e.message, e);
  }
  if (res.status === 401 || res.status === 403) throw new LlmError('auth', 'Google rejected the API key', null);
  if (res.status === 429) throw new LlmError('rate_limit', 'Google rate limit hit', null);
  if (!res.ok) throw new LlmError('unknown', `Google returned ${res.status}`, null);
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text).join('\n');
  return parseClusters(text);
}
