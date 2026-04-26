// Model catalog lives in models.json so it can be edited without touching code.
// Defaults are intentionally in the cheap-fast tier — clustering is a low-reasoning
// task; users can pick any model from `options` in Settings. Do not "modernize"
// defaults to Sonnet/Opus/Pro tiers without a measured reason.
//
// To add or remove a model: edit models.json. The dropdown in Settings rebuilds
// from this list on each load. A user's prior selection is preserved if its ID
// still appears in `options`; otherwise it falls back to `default`.

import data from './models.json' with { type: 'json' };

export const MODELS = data.models;
export const PROVIDERS = data.providers;
export const PROVIDER_LABELS = data.providerLabels;
