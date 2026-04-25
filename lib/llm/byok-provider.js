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

export async function byokCluster(tabs, settings) {
  const { byokProvider, byokModels, apiKeys } = settings;
  const key = apiKeys?.[byokProvider];
  if (!key) throw new ApiKeyMissingError(byokProvider);
  const fn = PROVIDERS[byokProvider];
  if (!fn) throw new Error(`Unknown BYOK provider: ${byokProvider}`);
  return fn(tabs, key, byokModels[byokProvider], settings.customPrompt);
}
