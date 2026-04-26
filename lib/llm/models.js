// Defaults are cheap-fast tier — clustering is a low-reasoning task; users can
// pick any model from `options` in Settings. Do not "modernize" defaults to
// Sonnet/Opus/Pro tiers without a measured reason.

export const MODELS = {
  puter: {
    // Updated 2026-04-26: grok-3-mini was retired from xAI's API; switched to
    // grok-4-1-fast-non-reasoning (cheapest current Grok). Puter ID assumed
    // by analogy with the BYOK ID — re-verify via `puter.ai.listModels('xai')`
    // per smoke test in docs/maintenance/puter-sdk-updates.md.
    default: 'x-ai/grok-4-1-fast-non-reasoning',
    options: [
      { id: 'x-ai/grok-4-1-fast-non-reasoning', label: 'Grok 4.1 Fast (non-reasoning, cheap — default)' },
      { id: 'x-ai/grok-4-1-fast-reasoning', label: 'Grok 4.1 Fast (reasoning)' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
      { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' }
    ]
  },
  xai: {
    // Updated 2026-04-26: grok-3-mini returns 403 from xAI's API. Verified
    // grok-4-1-fast-non-reasoning works against direct BYOK calls.
    default: 'grok-4-1-fast-non-reasoning',
    options: [
      { id: 'grok-4-1-fast-non-reasoning', label: 'Grok 4.1 Fast (non-reasoning, cheap — default)' },
      { id: 'grok-4-1-fast-reasoning', label: 'Grok 4.1 Fast (reasoning)' }
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
