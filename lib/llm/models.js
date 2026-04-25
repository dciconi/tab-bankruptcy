// Defaults are cheap-fast tier — clustering is a low-reasoning task; users can
// pick any model from `options` in Settings. Do not "modernize" defaults to
// Sonnet/Opus/Pro tiers without a measured reason.

export const MODELS = {
  puter: {
    // Discovered via `puter.ai.listModels('xai')` on 2026-04-25.
    // Re-verify per smoke test in docs/maintenance/puter-sdk-updates.md.
    default: 'x-ai/grok-3-mini',
    options: [
      { id: 'x-ai/grok-3-mini', label: 'Grok 3 mini (cheap-fast — default)' },
      { id: 'x-ai/grok-3', label: 'Grok 3' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
      { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' }
    ]
  },
  xai: {
    default: 'grok-3-mini',
    options: [
      { id: 'grok-3-mini', label: 'Grok 3 mini (cheap-fast — default)' },
      { id: 'grok-3', label: 'Grok 3' }
    ]
  },
  openai: {
    default: 'gpt-4o-mini',
    options: [
      { id: 'gpt-4o-mini', label: 'GPT-4o mini (cheap-fast — default)' },
      { id: 'gpt-5-mini', label: 'GPT-5 mini' },
      { id: 'gpt-4o', label: 'GPT-4o' }
    ]
  },
  anthropic: {
    default: 'claude-haiku-4-5-20251001',
    options: [
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (cheap-fast — default)' },
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' }
    ]
  },
  google: {
    default: 'gemini-2.5-flash',
    options: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (cheap-fast — default)' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' }
    ]
  }
};

export const PROVIDERS = ['xai', 'openai', 'anthropic', 'google'];

export const PROVIDER_LABELS = {
  xai: 'xAI (Grok)',
  openai: 'OpenAI',
  anthropic: 'Anthropic (Claude)',
  google: 'Google (Gemini)'
};
