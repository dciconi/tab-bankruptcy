# Tab Bankruptcy — Chrome Extension

One-click AI clustering and triage for your open tabs. Declare bankruptcy on tab debt.

> **Beta.** The extension is live as an unlisted beta on the Chrome Web Store while it bakes. Direct install link below; expect rough edges and occasional model-quality variance.

---

## Install

**Beta install (Chrome Web Store, unlisted):**
<https://chromewebstore.google.com/detail/lmhmbimkgpjkdkalklfgphffjggkidfk>

After install:

1. The options page opens automatically with a welcome banner.
2. Pick a provider — setup auto-completes the moment you reach a working state:
   - **Puter** (recommended) — click **Sign in to Puter** → complete OAuth → done. No API keys to manage. Puter bills you directly.
   - **BYOK** — click **+ Add API key** → label · provider · model · key → **Save & Test**. Successful 1-token verification auto-completes setup. Add more keys to build a fallback chain.
3. Open the extension, click **Declare Bankruptcy**, triage the resulting clusters with Keep / Save / Nuke.

**Developer install (load unpacked):**

1. Clone the repo
2. Open `chrome://extensions`, enable **Developer mode**
3. Click **Load unpacked**, select this directory

---

## Features

| Feature | Description |
|---|---|
| **Declare Bankruptcy** | One click clusters all tabs via your chosen AI provider |
| **Multi-provider** | Default: Puter.js (sign in & start). BYOK fallback across xAI · OpenAI · Anthropic · Google |
| **BYOK key list** | Add as many keys as you want; ordered fallback — if the top key fails, the next is tried automatically |
| **Auto-setup** | Setup completes the moment you sign in to Puter or save a working API key — no explicit "finish" click |
| **Smart Clusters** | Tabs grouped by topic with witty names + emojis; rendered as native Chrome tab groups |
| **Keep / Save / Nuke** | Per-cluster: leave open · add to Reading List with `[clusterName]` prefix · close immediately |
| **5-second Undo** | Toast on every action with a 5-second window |
| **Confetti + sounds** | Web Audio click/whoosh/cha-ching/fanfare; mutable in Settings |
| **Keyboard nav** | Tab/Arrows, K/S/N, Enter to expand |
| **Accessibility** | ARIA labels, focus states, reduced-motion support |
| **Reset** | One-click factory reset — wipes every preference, key, Puter session, and cached cluster state |

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
- **Setup state is reconciled, not migrated** — `setupComplete` is recomputed on each popup/options open from the actual storage state. Existing users with working configs are not re-gated on extension updates.
- **Permissions** — `tabs`, `storage`, `tabGroups`, `readingList`.
- **CSP `connect-src`** — `'self'` plus the five HTTPS provider hosts (xAI, OpenAI, Anthropic, Google, Puter) plus `wss://api.puter.com` and `wss://*.puter.com` for Puter's Socket.IO transport.

For maintenance details on bumping the vendored Puter SDK, see [`docs/maintenance/puter-sdk-updates.md`](./docs/maintenance/puter-sdk-updates.md).

---

## Providers

### Puter (default)

The user signs in to Puter once via OAuth (popup window). Puter handles billing for subsequent `puter.ai.chat()` calls. The extension never sees a Puter API key — auth is handled entirely by the SDK.

- **Sign-in only happens in the options page** (bound to a direct click). The popup never auto-signs-in mid-flow because Chrome's popup blocker would engage after `await`.
- **Default model is set explicitly** (currently `x-ai/grok-4-1-fast-non-reasoning`). Puter's silent default is `gpt-5-nano`, which is wrong for our use case.
- **Out of credits → top up** at <https://puter.com/dashboard>. The popup detects the `usage-limited-chat` delegate error and shows an "Open Puter Dashboard" button.
- **Streaming is disabled** — Puter issue [#2410](https://github.com/HeyPuter/puter/issues/2410) makes `stream: true` hang on errors. Non-streaming only.
- **Test connection** uses `testMode: true` so verification doesn't burn credits.
- **Updating the SDK** — see [`docs/maintenance/puter-sdk-updates.md`](./docs/maintenance/puter-sdk-updates.md).

### BYOK

For users with their own API keys. Stored as an **ordered list** of `{ id, label, provider, model, key, status, lastTestedAt, lastError }` in `chrome.storage.local.byokKeys`. The list is the fallback chain — position 0 is the default.

| Provider | Endpoint | Auth | Notes |
|---|---|---|---|
| xAI | `POST api.x.ai/v1/chat/completions` | `Authorization: Bearer <key>` | OpenAI-compatible schema |
| OpenAI | `POST api.openai.com/v1/chat/completions` | `Authorization: Bearer <key>` | — |
| Anthropic | `POST api.anthropic.com/v1/messages` | `x-api-key` + `anthropic-version: 2023-06-01` + `anthropic-dangerous-direct-browser-access: true` | System prompt is a separate field |
| Google | `POST generativelanguage.googleapis.com/v1beta/models/<model>:generateContent` | `?key=<key>` | Different message shape (`contents` / `parts`) |

**Runtime fallback** (`lib/llm/byok-provider.js`):
1. Try `byokKeys[0]`. On success → mark `status: 'verified'`, done.
2. On failure → mark `status: 'failed'` with `lastError`, try the next key.
3. If every key fails → rethrow the last error.

Errors normalize to a shared taxonomy: `auth` (401/403), `rate_limit` (429), `network` (fetch threw), `unknown` (other non-OK). The popup error UI shows tailored copy + actions per kind.

**Keys never leave the device.** `byokKeys` lives in `chrome.storage.local` only.

---

## Models Catalog

The list of selectable models is **data, not code**. Edit [`lib/llm/models.json`](./lib/llm/models.json) — no JS changes required.

```json
{
  "models": {
    "puter": {
      "default": "x-ai/grok-4-1-fast-non-reasoning",
      "options": [
        { "id": "x-ai/grok-4-1-fast-non-reasoning", "label": "Grok 4.1 Fast (non-reasoning) - default" },
        { "id": "claude-sonnet-4-6",                "label": "Claude Sonnet 4.6" }
      ]
    }
  }
}
```

To add a model: drop a `{ id, label }` entry into the right provider's `options` array. To set it as the default, update `default`. Reload the unpacked extension; the new model appears in Settings.

The dropdown rebuilds on each Settings load. A user's previously-saved selection is preserved **only if its ID still appears** in `options`; otherwise it falls back to `default`. So you can edit the catalog freely without overwriting valid user choices.

---

## Change Log

### 2026-05-09

- Each tab in the cluster dropdown now shows its favicon and a relative
  "last active" label.
- Added a search/filter input above the cluster list so you can narrow
  to specific tabs by title or URL.
- New keyboard shortcuts inside the triage view: `K` keep, `S` save,
  `N` nuke (per focused cluster); `U` triggers the most recent undo;
  `/` focuses the search box; `Esc` clears the filter.
- Added a global Chrome shortcut (default `Alt+Shift+B`) that opens the
  Tab Bankruptcy tab from anywhere. Customize it at
  `chrome://extensions/shortcuts`.

### 2026-05-08

- Improved light theme contrast across the popup and settings pages.
- Fixed the mute-sounds toggle alignment in Settings.
- Fixed the Clusters Found screen layout so expanded tab lists render correctly across operating systems, including light mode.

---

## Development

### Run tests

Tests are plain Node — each file mocks `global.chrome` itself, no runner config.

```bash
# Reliable (passes on plain `node`):
node manifest.test.js
node privacy-sync.test.js
node background.test.js
node popup.test.js
node popup.css.test.js
for f in lib/llm/*.test.js lib/llm/byok/*.test.js; do node "$f"; done
```

Caveats — known pre-existing test issues, **not blockers** for shipping:

- `options.test.js` uses Jest globals without Jest installed (`describe is not defined`).
- `lib/audio.test.js` has an async-escape bug — `it()` is sync `try/catch` but bodies are async, so storage-mock rejections crash the process after ✓.

### Build

No compilation step — plain HTML / CSS / ESM JS. To package for the Chrome Web Store:

```bash
bash scripts/package.sh
```

Outputs `dist/tab-bankruptcy-<version>.zip`. The script stages exactly the runtime files Chrome needs (no tests, no docs, no `.git`), zips via `zip` if available or PowerShell `Compress-Archive` on Windows, and verifies no forbidden files leaked in.

### Publishing

- Privacy policy: [`PRIVACY.md`](./PRIVACY.md) (canonical: <https://dciconi.github.io/tab-bankruptcy/privacy/>)
- Pages site: <https://dciconi.github.io/tab-bankruptcy/>

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Setup-required gate appears | Open extension icon → **Open Settings** → sign in to Puter or add a BYOK key. Setup auto-completes on success. |
| "You're out of Puter credits" | Top up at [puter.com/dashboard](https://puter.com/dashboard), or switch to BYOK in Settings. |
| BYOK key rejected (401/403) | Verify the key in the provider's console. Fallback chain moves to the next key automatically. |
| BYOK rate limit (429) | Add additional keys in Settings; chain falls through under load. |
| "Couldn't reach the model" | Check internet + that `connect-src` and `host_permissions` cover the provider host. |
| `WebSocket is closed before connection established` | Benign. Puter's Socket.IO retries and `puter.ai.chat()` is unaffected. |
| Reading list save not working | Ensure your Chrome version exposes `chrome.readingList`. |
| Want to start over | **Reset everything** at the bottom of Settings — wipes all preferences, keys, Puter sessions, and cached state. |

---

## License

Apache License 2.0 — see [`LICENSE`](./LICENSE) and [`NOTICE`](./NOTICE).

The vendored Puter.js SDK at `lib/puter.js` is **AGPL-3.0** (see [`lib/puter.LICENSE`](./lib/puter.LICENSE)). The AGPL terms apply to that file specifically; the rest of the project is Apache-2.0 and may be reproduced, modified, and redistributed under those terms.

---

**Version:** 1.99.3 (`version_name`: 2.0.0 beta) · **Manifest:** MV3 · **Last updated:** 2026-05-09
