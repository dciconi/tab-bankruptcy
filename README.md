# Tab Bankruptcy — Chrome Extension

One-click AI clustering and triage for your open tabs. Declare bankruptcy on tab debt.

![Tab Bankruptcy](../assets/mascot_reaper.png)

---

## Features

| Feature | Description |
|---------|-------------|
| 🪦 **Declare Bankruptcy** | One click clusters all tabs via your chosen AI provider |
| 🤖 **Multi-provider** | Default: Puter.js (sign in & start). BYOK fallback across xAI · OpenAI · Anthropic · Google |
| 🔑 **BYOK key list** | Add as many keys as you want; ordered fallback chain — if the top key fails, the next is tried automatically |
| ✨ **Auto-setup** | Setup completes the moment you sign in to Puter or save a working API key — no explicit "finish" click |
| 🗂️ **Smart Clusters** | Tabs grouped by topic with witty names + emojis |
| ✅ **Keep** | Leave tabs open (green checkmark) |
| 📥 **Save & Close** | Add cluster URLs to Chrome's Reading List with `[clusterName]` prefix |
| 💥 **Nuke** | Close immediately with particle explosion |
| 🔁 **Undo Toast** | 5-second undo window after any action |
| 🎉 **Confetti** | Celebration on completing all clusters |
| 🔊 **Sound Effects** | Web Audio: click, whoosh, cha-ching, fanfare |
| ⌨️ **Keyboard Nav** | Tab/Arrows, K/S/N, Enter to expand |
| ♿ **Accessibility** | ARIA labels, focus states, reduced motion |
| 🧹 **Reset** | One-click factory reset — wipes every preference, key, Puter session, and cached cluster state |

---

## Installation

### Load Unpacked (Developer Mode)

1. Open **chrome://extensions**
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `tab-bankruptcy/` folder (this directory)
5. Pin the extension to your toolbar

### First Run

On install, the options page opens automatically with a welcome banner. Pick a provider — setup auto-completes the moment you reach a working state:

- **Puter** (recommended): click **Sign in to Puter** → complete OAuth → done. No API keys to manage. Puter bills you directly for usage.
- **BYOK**: click **+ Add API key** → enter a label, pick a provider, pick a model, paste your key → **Save & Test**. On a successful 1-token verification, setup auto-completes. Add more keys to build a fallback chain — keys are tried top-to-bottom and the first that works is used.

After setup:

1. Open 8–12 mixed tabs (work, shopping, fun)
2. Click the extension icon → opens the full-tab popup
3. See tab count + **"Declare Bankruptcy"** button
4. Click → Loading → Triage view with ClusterCards
5. Try Keep / Save / Nuke on clusters
6. Resolve all → Confetti + Bankruptcy Receipt

---

## Architecture

```
popup.html / popup.js / popup.css     ← UI + LLM call (full tab, not a popup)
        ↕ chrome.runtime.sendMessage
background.js                         ← service worker: tabs query, session cache,
                                        processed-tab tracking, native tab groups

  popup.js  →  lib/llm/index.js  ──┬──→  lib/llm/puter-provider.js
                                   │            ↓
                                   │       window.puter (lib/puter.js, vendored)
                                   │            ↓
                                   │       api.puter.com  →  Grok / GPT / Claude / Gemini
                                   │
                                   └──→  lib/llm/byok-provider.js
                                              ↓
                                        lib/llm/byok/{xai,openai,anthropic,google}.js
                                              ↓
                                        api.x.ai · api.openai.com ·
                                        api.anthropic.com · generativelanguage.googleapis.com
```

**Key points:**

- **Manifest V3** — service worker, no background page; popup is a full tab opened via `chrome.action.onClicked`.
- **No backend** — the maintainer operates no server. LLM calls go directly from the browser to the provider.
- **No remote scripts at runtime** — CSP `script-src 'self'`. The Puter SDK is vendored at `lib/puter.js` (pinned via `lib/puter.VERSION`).
- **Storage split** — provider/model preferences in `chrome.storage.sync` (roams across the user's Chrome profiles); BYOK API keys live in `chrome.storage.local` as an ordered `byokKeys` list (per-device, never synced).
- **Setup state is reconciled, not migrated** — `setupComplete` is recomputed on each popup/options open from the actual storage state (`reconcileSetupComplete()` in `popup.js` and `options.js`). Existing users with working configs are not re-gated on extension updates.
- **Permissions** — `tabs`, `storage`, `tabGroups`, `alarms`, `readingList`.
- **CSP `connect-src`** — `'self'` plus the five HTTPS provider hosts (xAI, OpenAI, Anthropic, Google, Puter) plus `wss://api.puter.com` and `wss://*.puter.com` for Puter's Socket.IO transport.

See [`context.md`](./context.md) for project history, standing decisions, and Puter SDK quirks worth not rediscovering. See [`docs/superpowers/specs/`](./docs/superpowers/specs/) for the v2 design spec.

---

## File Structure

```
tab-bankruptcy/
├── manifest.json                   # MV3 manifest (permissions, CSP, icons)
├── background.js                   # Tab queries, session cache, processed-tab tracking, tab groups
├── background.test.js
├── popup.html                      # 6 views: setup-required, idle, loading, triage, completion, error
├── popup.js                        # State machine + LLM orchestration; active-provider display; asymptotic progress bar
├── popup.css                       # Dark theme, animations, confetti, reduced-motion
├── popup.test.js
├── popup.css.test.js
├── options.html                    # Welcome banner, provider config, BYOK key list, prompt editor, theme, reset
├── options.js                      # Provider radios, Puter sign-in/test, BYOK list (add/edit/delete/reorder/test), reset
├── options.css
├── options.test.js
├── manifest.test.js
├── lib/
│   ├── audio.js                    # playClick, playNuke, playKeep, playSave, playCompletion (Web Audio API)
│   ├── audio.test.js
│   ├── puter.js                    # Vendored Puter SDK v2 (do not edit; use docs/maintenance/puter-sdk-updates.md)
│   ├── puter.VERSION               # SHA-256 + fetch date for the pinned SDK
│   ├── puter.LICENSE               # Upstream AGPL-3.0 notice
│   └── llm/
│       ├── package.json            # ESM scope marker ({ "type": "module" })
│       ├── index.js                # clusterTabs(tabs, settings) entry + re-exports
│       ├── errors.js               # ApiKeyMissingError, PuterNotSignedIn, PuterOutOfCredits, etc.
│       ├── prompt.js               # buildMessages: tab whitelist + JSON schema instruction
│       ├── parse.js                # parseClusters: robust JSON extraction (strips fences, locates braces)
│       ├── models.js               # Thin wrapper exporting MODELS / PROVIDERS / PROVIDER_LABELS
│       ├── models.json             # Editable model catalog (see "Models Catalog" below)
│       ├── puter-provider.js       # Puter dispatcher (sign-in check, credit-error wrap, no-stream guardrail)
│       ├── byok-provider.js        # BYOK dispatcher (routes to one of four providers)
│       ├── byok/
│       │   ├── xai.js              # POST api.x.ai/v1/chat/completions
│       │   ├── openai.js           # POST api.openai.com/v1/chat/completions
│       │   ├── anthropic.js        # POST api.anthropic.com/v1/messages (with browser-access header)
│       │   └── google.js           # POST generativelanguage.googleapis.com/v1beta/...
│       └── *.test.js               # 10 unit tests (one per source file, plus integration)
├── assets/icons/
│   ├── icon48.png
│   └── icon128.png
└── docs/
    ├── maintenance/
    │   └── puter-sdk-updates.md    # How to bump the vendored Puter SDK + smoke test checklist
    └── superpowers/{specs,plans}/  # Design spec + implementation plan for v2
```

---

## Development

### Run Tests

Tests use Node + self-mocked `chrome.*` and `fetch`. No runner config; each file is invoked directly.

```bash
# Root tests (CommonJS)
node background.test.js
node popup.test.js
node manifest.test.js
node popup.css.test.js

# lib tests
node lib/audio.test.js

# LLM module tests (ESM, scoped via lib/llm/package.json)
node lib/llm/errors.test.js
node lib/llm/prompt.test.js
node lib/llm/parse.test.js
node lib/llm/index.test.js
node lib/llm/puter-provider.test.js
node lib/llm/byok-provider.test.js
node lib/llm/byok/xai.test.js
node lib/llm/byok/openai.test.js
node lib/llm/byok/anthropic.test.js
node lib/llm/byok/google.test.js
```

A few pre-existing tests have known env limitations (`options.test.js` uses Jest globals without Jest installed; `popup.css.test.js` Rule 8 checks `#declare-btn` but the CSS uses `#btn-declare`). The runtime code is correct.

### Key Constants

| Constant | Value | Where |
|----------|-------|-------|
| `PUTER_DASHBOARD_URL` | `https://puter.com/dashboard` | `lib/llm/puter-provider.js` |
| Puter user-action signal | `delegate === 'usage-limited-chat'` | Out-of-credits detection |
| Anthropic browser-access header | `anthropic-dangerous-direct-browser-access: true` | Required for direct-from-browser calls |
| Loading messages | "Scanning…", "You monster…", "This is for your own good.", "POOF." | `popup.js` |
| Undo window | 5 seconds | `popup.js` |

### Build

No compilation step — the extension is plain HTML / CSS / ESM JS.

**To package:**

```bash
zip -r tab-bankruptcy.zip . \
  -x "*.test.js" "test/*" "docs/*" "node_modules/*" ".git/*"
```

**Or pack in Chrome:**

1. `chrome://extensions` → **Pack extension**
2. Select this folder → produces `.crx`

Upload the zip or crx to the Chrome Web Store via Developer Dashboard.

---

## Providers

### Puter (default)

The user signs in to Puter once via OAuth (popup window). Puter then handles billing for subsequent `puter.ai.chat()` calls. The extension never sees a Puter API key — auth is handled entirely by the SDK.

- **Sign-in only happens in the options page** (bound to a direct click). The popup never auto-signs-in mid-flow because Chrome's popup blocker would engage after `await`.
- **Default model is set explicitly** (currently `x-ai/grok-4-1-fast-non-reasoning`); Puter's silent default is `gpt-5-nano`, which is wrong for our use case.
- **Out of credits → top up** at `https://puter.com/dashboard`. The popup detects the `usage-limited-chat` delegate error and shows an "Open Puter Dashboard" button.
- **Streaming is disabled** — Puter issue [#2410](https://github.com/HeyPuter/puter/issues/2410) makes `stream: true` hang on errors. We use non-streaming responses only.
- **Test connection** uses `testMode: true` so verification doesn't burn credits.
- **Updating the SDK**: see [`docs/maintenance/puter-sdk-updates.md`](./docs/maintenance/puter-sdk-updates.md) for the quarterly drift check + smoke test.

### BYOK

For users with their own API keys. Stored as an **ordered list** of `{ id, label, provider, model, key, status, lastTestedAt, lastError }` objects in `chrome.storage.local.byokKeys`. The list is the fallback chain — position 0 is the default.

**Adapter files** (one per provider, in `lib/llm/byok/`):

| Provider | Endpoint | Auth | Notes |
|----------|----------|------|-------|
| xAI | `POST https://api.x.ai/v1/chat/completions` | `Authorization: Bearer <key>` | OpenAI-compatible schema |
| OpenAI | `POST https://api.openai.com/v1/chat/completions` | `Authorization: Bearer <key>` | — |
| Anthropic | `POST https://api.anthropic.com/v1/messages` | `x-api-key: <key>` + `anthropic-version: 2023-06-01` + `anthropic-dangerous-direct-browser-access: true` | System prompt is a separate field |
| Google | `POST https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent` | `?key=<key>` query param | Different message shape (`contents` / `parts`) |

**Runtime fallback** (`lib/llm/byok-provider.js`):
1. Try `byokKeys[0]`. On success → done; mark `status: 'verified'`.
2. On failure → mark `status: 'failed'` with `lastError`, try the next key.
3. If every key fails → rethrow the last error.
4. The popup provides an `onKeyStatus(id, status, error)` callback so live verification state is persisted as fallback runs.

Errors are normalized into a shared taxonomy: `auth` (401/403), `rate_limit` (429), `network` (fetch threw), `unknown` (other non-OK). The popup error UI shows a tailored message + action buttons per kind.

**Options-page UX:**
- Each key gets one row showing label, provider · model, status pill (✓ verified / ✗ failed / ? untested), and last-error line on failures.
- ↑/↓ buttons reorder the chain. Test, Edit, Delete buttons per row.
- The Add/Edit form runs a 1-token verification on Save & Test before persisting; the resulting status is stored on the key.

**Keys never leave the user's device.** `byokKeys` lives in `chrome.storage.local` only — never `chrome.storage.sync`, which would roam to other profiles.

---

## Models Catalog

The list of selectable models is **data, not code**. Edit [`lib/llm/models.json`](./lib/llm/models.json) — no JS changes required.

### Shape

```json
{
  "providers": ["xai", "openai", "anthropic", "google"],
  "providerLabels": {
    "xai": "xAI (Grok)",
    "openai": "OpenAI",
    "anthropic": "Anthropic (Claude)",
    "google": "Google (Gemini)"
  },
  "models": {
    "puter": {
      "default": "x-ai/grok-3-mini",
      "options": [
        { "id": "x-ai/grok-3-mini", "label": "Grok 3 mini (default)" },
        { "id": "gpt-4o-mini",      "label": "GPT-4o mini" }
      ]
    },
    "xai":       { "default": "...", "options": [...] },
    "openai":    { "default": "...", "options": [...] },
    "anthropic": { "default": "...", "options": [...] },
    "google":    { "default": "...", "options": [...] }
  }
}
```

### How to add a model

1. Open `lib/llm/models.json`.
2. In the relevant provider's `options` array, add `{ "id": "<api-model-id>", "label": "<human-readable>" }`.
3. Optionally update the provider's `default` to the new ID.
4. Reload the unpacked extension at `chrome://extensions`.
5. Open Settings → the new model appears in the dropdown.

### How to remove a model

1. Delete the entry from `options`.
2. If it was the `default`, update `default` to a remaining ID.
3. Reload.

### Selection preservation

The dropdown is rebuilt from the JSON on each Settings load. A user's previously-saved selection is preserved **only if its ID still appears** in `options`; otherwise the dropdown silently falls back to `default`. This means you can edit `models.json` freely without overwriting still-valid user choices.

The mechanism is in `options.js` → `pickPreservedValue()`.

### Why JSON instead of JS?

So that maintainers (and future automation) can edit the catalog without touching code. `lib/llm/models.js` is a 12-line wrapper that imports the JSON via standard import attributes (`with { type: 'json' }`), supported in Node 22 and Chrome 123+.

### Defaults are intentionally cheap-fast tier

Tab clustering reads ~20 tab titles and emits ~5 cluster names. It's a low-reasoning task; Haiku / Flash / mini-tier defaults are plenty. Don't "modernize" defaults to Sonnet / Opus / Pro tiers without a measured reason — users can always opt up via the dropdown if they want.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Extension doesn't load | Check `chrome://extensions` for errors; reload manifest |
| Setup-required gate appears | Open the extension icon → click "Open Settings" → sign in to Puter or add a BYOK key. Setup auto-completes on a successful sign-in or Save & Test. |
| "You're out of Puter credits" | Top up at [puter.com/dashboard](https://puter.com/dashboard), or switch to BYOK in Settings |
| BYOK key rejected (401/403) | Verify the key in the provider's console; for xAI specifically, check that the model ID is current and your team has credits. The fallback chain will move to the next key automatically. |
| BYOK rate limit (429) | Wait a moment and retry; the chain falls through to the next key automatically. Add additional keys in Settings to keep working under load. |
| "Couldn't reach the model" | Check internet; verify CSP `connect-src` and `host_permissions` in `manifest.json` cover the provider host |
| "Model returned an unexpected response" | Provider returned non-JSON. Try Retry; if persistent, switch models or providers |
| `Refused to connect to wss://api.puter.com/...` (CSP) | Reload the extension. CSP must include `wss://api.puter.com` and `wss://*.puter.com` (added in v2.x). |
| `WebSocket is closed before the connection is established` | Benign. Puter's SDK uses Socket.IO for realtime features the extension doesn't use; long-polling fallback continues working and `puter.ai.chat()` is unaffected. |
| Sound doesn't play | Check mute toggle in Settings; browser may block autoplay |
| Reading list save not working | Ensure the `readingList` permission is in `manifest.json`; verify `chrome.readingList` is available in your Chrome version |
| Keyboard nav not working | Focus must be on the popup tab (click into it first) |
| Want to start over | Click **Reset everything** at the bottom of Settings. Confirms before wiping every preference, key, Puter session, and cached cluster state. |

---

## License

Hackathon project — internal use.

---

**Version:** 2.0.0
**Manifest:** MV3
**Last updated:** 2026-04-26
