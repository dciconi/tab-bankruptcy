import { ApiKeyMissingError } from './errors.js';
import { xaiCluster } from './byok/xai.js';
import { openaiCluster } from './byok/openai.js';
import { anthropicCluster } from './byok/anthropic.js';
import { googleCluster } from './byok/google.js';

const PROVIDERS = {
  xai: xaiCluster,
  openai: openaiCluster,
  anthropic: anthropicCluster,
  google: googleCluster
};

// settings.byokKeys is an ordered list. We try each entry in order.
// On per-key success, the request returns immediately. On failure, we mark
// the key (via the optional onKeyStatus callback) and move to the next.
// If every key fails, the last error is rethrown.
//
// settings.onKeyStatus is optional: (keyId, status, errorMessage) => Promise<void>
// — called for every key tried, so the UI can reflect live verification state.
export async function byokCluster(tabs, settings) {
  const keys = Array.isArray(settings.byokKeys) ? settings.byokKeys : [];
  if (keys.length === 0) throw new ApiKeyMissingError('byok');

  let lastError;
  for (const k of keys) {
    const fn = PROVIDERS[k.provider];
    if (!fn) {
      lastError = new Error(`Unknown BYOK provider: ${k.provider}`);
      if (settings.onKeyStatus) await settings.onKeyStatus(k.id, 'failed', lastError.message);
      continue;
    }
    try {
      const result = await fn(tabs, k.key, k.model, settings.customPrompt);
      if (settings.onKeyStatus) await settings.onKeyStatus(k.id, 'verified', null);
      return result;
    } catch (err) {
      lastError = err;
      if (settings.onKeyStatus) await settings.onKeyStatus(k.id, 'failed', err.message || String(err));
    }
  }
  throw lastError;
}
