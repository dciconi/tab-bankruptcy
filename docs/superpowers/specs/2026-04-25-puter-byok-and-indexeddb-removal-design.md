# Design: Puter.js Default + BYOK Fallback, Plus Legacy IndexedDB Removal

**Date:** 2026-04-25
**Status:** Draft (awaiting user review)
**Scope:** Two coupled changes — (1) remove the unused legacy IndexedDB reading-list module, (2) replace the `autoqa.teachx.ai` Grok proxy with Puter.js as default and BYOK as power-user fallback across xAI, OpenAI, Anthropic, Google.

## 1. Goals

- **Remove dead code.** The IndexedDB reading-list module in `lib/storage.js` and its test were never wired up after the switch to `chrome.readingList`. Eliminate both, leaving a single, audited reading-list path.
- **Eliminate the proxy dependency.** `autoqa.teachx.ai` is a hackathon-era proxy and is being permanently retired. The extension must function without any backend the maintainer has to operate.
- **Default: zero-friction AI.** New users sign in to Puter once and start clustering. No API key entry required for the default path. Puter handles billing.
- **Power user: BYOK.** Users with their own API keys can route through xAI, OpenAI, Anthropic, or Google directly. Grok is the preferred default within BYOK as well.
- **Keep clustering cheap.** Tab clustering is a low-reasoning task. Defaults across the board should be cheap-fast tier (Haiku / Flash / Mini / Grok-mini equivalents).

## 2. Non-goals

- Surfacing per-call cost in the model dropdown (logged as future enhancement).
- Migrating existing v1 user data — there is no user data to migrate; settings get reset and users go through first-run setup again on update.
- Supporting more than 4 BYOK providers in v2.
- Self-hosted model endpoints (Ollama, LM Studio, etc.) — out of scope.
- A model-routing layer that picks providers automatically — user explicitly chooses.

## 3. Architecture

### 3.1 LLM call relocates from background to popup

The MV3 service worker has no DOM and no `window`. Puter.js is a browser SDK that needs both — for its sign-in popup and for its API client. Therefore the LLM call moves out of `background.js` and into `popup.js` (which is rendered as a full tab via `chrome.action.onClicked`, not a popup, so it has a stable DOM context and is not torn down between actions).

Background remains the owner of Chrome-API responsibilities: tab queries, processed-tab tracking, session caching, tab grouping. Popup gains LLM orchestration.

### 3.2 New action protocol between popup and background

| From → To | Action | Returns | Purpose |
|---|---|---|---|
| popup → bg | `getTabsForCluster` | `{cached:true, payload}` OR `{cached:false, tabs, sig}` | Background does the existing tab filtering, processed-tab exclusion, and signature-cache check. If cached, returns the previous cluster payload directly. If not cached, returns sanitized tabs and the new signature for the popup to send to the LLM. |
| popup runs LLM | — | clusters | In-popup call via `lib/llm/index.js`. |
| popup → bg | `commitClusters` `{clusters, sig}` | `{ok:true}` | Background stores result in `chrome.storage.session`, updates `tb_last_tab_ids`, fires `createTabGroups`. |

The existing `cluster` action in background is retired. `keep`, `nuke`, `save`, `undo`, `resume`, `getReadingLists`, `deleteReadingList`, `resetState` are unchanged.

### 3.3 File layout after both tasks

```
tab-bankruptcy/
├── manifest.json                         [edited]
├── background.js                         [edited]
├── background.test.js                    [edited]
├── popup.html                            [edited: setup-required state]
├── popup.js                              [edited: LLM orchestration]
├── popup.test.js                         [edited]
├── popup.css                             [edited: setup card styling]
├── options.html                          [edited: provider config + welcome]
├── options.js                            [edited]
├── options.css                           [edited]
├── options.test.js                       [edited]
├── lib/
│   ├── audio.js                          [unchanged]
│   ├── audio.test.js                     [unchanged]
│   ├── puter.js                          [NEW — vendored Puter SDK v2]
│   ├── puter.LICENSE                     [NEW — Puter upstream license]
│   ├── puter.VERSION                     [NEW — pinned version + sha256]
│   └── llm/
│       ├── index.js                      [NEW — clusterTabs entry point]
│       ├── prompt.js                     [NEW — message builder]
│       ├── parse.js                      [NEW — robust JSON extraction]
│       ├── models.js                     [NEW — curated model lists]
│       ├── puter-provider.js             [NEW]
│       ├── byok-provider.js              [NEW — BYOK dispatcher]
│       └── byok/
│           ├── xai.js                    [NEW]
│           ├── openai.js                 [NEW]
│           ├── anthropic.js              [NEW]
│           └── google.js                 [NEW]
└── docs/
    ├── maintenance/
    │   ├── puter-sdk-updates.md          [NEW]
    │   └── v2-migration.md               [NEW]
    └── superpowers/specs/
        └── 2026-04-25-puter-byok-and-indexeddb-removal-design.md  [this file]

DELETED: lib/storage.js, storage.test.js
TRIMMED: README.md (File Structure section)
```

## 4. Manifest, CSP, host_permissions

```diff
-  "host_permissions": ["https://autoqa.teachx.ai/*"],
+  "host_permissions": [
+    "https://api.x.ai/*",
+    "https://api.openai.com/*",
+    "https://api.anthropic.com/*",
+    "https://generativelanguage.googleapis.com/*",
+    "https://api.puter.com/*",
+    "https://*.puter.com/*"
+  ],
   "content_security_policy": {
-    "extension_pages": "script-src 'self'; object-src 'none'; connect-src 'self' https://autoqa.teachx.ai;"
+    "extension_pages": "script-src 'self'; object-src 'none'; connect-src 'self' https://api.x.ai https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com https://api.puter.com https://*.puter.com;"
   }
```

`script-src` stays at `'self'` only — Puter is vendored, no remote scripts. Puter's auth popup is a top-level window navigation to `puter.com` and is governed by `host_permissions`, not CSP.

## 5. Storage schema

### 5.1 `chrome.storage.sync` (synced across user's devices, NO secrets)

| Key | Type | Default | Purpose |
|---|---|---|---|
| `provider` | `'puter' \| 'byok'` | `'puter'` | Active provider |
| `puterModel` | `string` | Cheap-fast Grok variant exposed by Puter — exact ID discovered via `puter.ai.listModels('xai')` at implementation time (see §6.4) | Default model when using Puter |
| `byokProvider` | `'xai' \| 'openai' \| 'anthropic' \| 'google'` | `'xai'` (Grok-preferred; welcome flow may overwrite based on which key the user actually enters first — see §7.2) | Active BYOK provider |
| `byokModels` | `{xai, openai, anthropic, google}` | per §6 defaults | Per-provider model selection |
| `setupComplete` | `boolean` | `false` | First-run gate |
| `customPrompt` | `string` | existing default | Untouched |
| `muted` | `boolean` | `false` | Untouched |
| `theme` | `'system' \| 'dark' \| 'light'` | `'system'` | Untouched |

### 5.2 `chrome.storage.local` (per-device, never synced — secrets only)

| Key | Type | Purpose |
|---|---|---|
| `apiKeys` | `{xai?, openai?, anthropic?, google?}` | API keys, plaintext, local-only |

**Rationale for split:** `chrome.storage.sync` propagates to every Chrome profile the user is signed into — including potentially shared devices. API keys are credentials and should not roam. `chrome.storage.local` keeps them pinned to the install. The options page surfaces this with a "Keys never leave this device." note next to each input.

## 6. Provider abstraction (`lib/llm/`)

### 6.1 `index.js` — single entry

```js
// Single function the popup calls.
async function clusterTabs(tabs, settings) {
  if (settings.provider === 'puter') return puterCluster(tabs, settings);
  return byokCluster(tabs, settings);
}
```

`settings` is the merged result of `chrome.storage.sync.get(null)` and `chrome.storage.local.get('apiKeys')`. Caller is responsible for the merge.

### 6.2 Shared helpers

- **`prompt.js`** — builds the message sequence. System message = `settings.customPrompt` + a stable JSON-shape directive. User message = `JSON.stringify(tabs)` with whitelisted fields only (`id`, `title`, `url`). The old Pydantic-driven whitelist that lived in `background.js` moves here, since the constraint shifts from "what the proxy accepts" to "what the LLM should see".
- **`parse.js`** — robust JSON extraction. Strips ```json fences, locates first `{` to last `}`, validates against schema `{clusters: [{name, emoji, tabIds, vibe, confidence}]}`. Throws `ClusterParseError` on failure.
- **`models.js`** — exports `MODELS = { puter: {default, options}, xai: {...}, openai: {...}, anthropic: {...}, google: {...} }`. Each entry has `default` (string) and `options` (array of `{id, label}`).

### 6.3 Default models (cheap-fast tier)

Tab clustering reads ~20 tab titles and emits ~5 cluster names. This is a low-reasoning task — cheap-fast tier is plenty. The implementer pins exact model IDs against each provider's live docs at coding time.

| Provider | Default | Other options |
|---|---|---|
| Puter (managed) | Cheapest Grok variant Puter exposes (e.g. `x-ai/grok-mini`) | Standard Grok, GPT mini, Claude Haiku, Gemini Flash |
| BYOK xAI | `grok-3-mini` (or `grok-2-mini` if mini tier not GA) | `grok-3` |
| BYOK OpenAI | `gpt-4o-mini` | `gpt-5-mini`, `gpt-4o` |
| BYOK Anthropic | `claude-haiku-4-5-20251001` | `claude-sonnet-4-6` |
| BYOK Google | `gemini-2.5-flash` | `gemini-2.5-pro` |

**Comment requirement in `models.js`:** each `default` entry has an inline note stating *"Cheap-fast tier — clustering is low-reasoning; users can pick any model from `options` in Settings."* This prevents future maintainers from "modernizing" defaults to Sonnet/Pro tiers.

### 6.4 Puter provider (`puter-provider.js`)

```js
async function puterCluster(tabs, settings) {
  if (!window.puter) throw new Error('Puter SDK not loaded');
  if (!await window.puter.auth.isSignedIn()) {
    // Do NOT call puter.auth.signIn() here. By the time this runs we're
    // mid-async after the click, so the user-gesture context is gone and
    // the popup will be blocked. Sign-in only happens in the options page
    // (welcome / provider config), where it's bound to a direct click.
    throw new PuterNotSignedIn();
  }
  const messages = buildMessages(tabs, settings.customPrompt);
  try {
    const res = await window.puter.ai.chat(messages, false, {
      model: settings.puterModel,   // MUST be explicit; Puter's default is gpt-5-nano, not Grok
      response_format: { type: 'json_object' }
      // Do NOT set stream: true — Puter issue #2410 makes streaming hang on errors
    });
    return parseClusters(res.message.content);
  } catch (err) {
    // Puter wraps delegate errors. Out-of-credits is the most important to surface.
    if (err?.delegate === 'usage-limited-chat' || err?.code === 'error_400_from_delegate') {
      throw new PuterOutOfCredits(err);
    }
    throw err;
  }
}
```

`lib/puter.js` (vendored) is loaded via `<script src="lib/puter.js">` in **both** `popup.html` and `options.html` (options needs it for sign-in/sign-out and Test). Loaded synchronously before the page's own script.

**`puter.ai.chat()` signature note:** the SDK has multiple overloads. The form used above is `puter.ai.chat(messages, testMode, options)` — `testMode=false` for real calls. The "Test connection" button in options uses `testMode=true`, which exercises the full path without consuming credits.

**Discovering Grok model IDs at impl time:** Puter's exact xAI model IDs aren't pinned in their public docs. The implementer of `lib/llm/models.js` should call `await puter.ai.listModels('xai')` once during development, pick the cheapest Grok model from the returned list, and hardcode that ID as the Puter default. Re-check on each Puter SDK bump (it's part of the smoke test in §9.1).

### 6.8 Puter quirks and gotchas (sourced from docs + GitHub issues)

These are real behaviors confirmed via Puter docs and issues. Encode them as guardrails in code or comments — don't let a future maintainer rediscover them the painful way.

| Quirk | Source | Guardrail in our code |
|---|---|---|
| `puter.ai.chat()` defaults to `gpt-5-nano` if no `model` is set | docs.puter.com/AI/chat | `puter-provider.js` always passes `model: settings.puterModel` explicitly. Test asserts the field is present in the call args. |
| `puter.auth.signIn()` "must be called from a user action" — popup blocked otherwise | docs.puter.com/Auth | Sign-in only triggers from direct click handlers in `options.js` welcome / provider config. `puter-provider.js` never calls `signIn()`; it throws `PuterNotSignedIn` instead, which routes the user back to options. |
| `stream: true` hangs indefinitely on errors | github.com/HeyPuter/puter#2410 | Comment in `puter-provider.js` explicitly says do not enable streaming until upstream is fixed. Test asserts `stream` is not `true` in call args. |
| Out-of-credits error wraps with `delegate: 'usage-limited-chat'` and HTTP status 400 (not 402) | github.com/HeyPuter/puter#1968 | `puter-provider.js` catches and rethrows as `PuterOutOfCredits`. Test asserts the wrap. |
| There is no public "credit balance" endpoint — only `puter.auth.getMonthlyUsage()` (per-app, opaque shape) | docs.puter.com/Auth/getMonthlyUsage | We do not show a balance; we only react to the out-of-credits error after the fact and direct the user to `puter.com/dashboard`. Logged in §12 as future enhancement. |
| Top-up is at `puter.com/dashboard` (no dedicated billing URL) | confirmed via search; Puter docs reference dashboard for token/account management | `PUTER_DASHBOARD_URL` constant in `puter-provider.js` is the single source of truth; "Open Puter Dashboard" buttons read from there. |

### 6.5 BYOK dispatcher (`byok-provider.js`)

```js
async function byokCluster(tabs, settings) {
  const { byokProvider, byokModels, apiKeys } = settings;
  const key = apiKeys?.[byokProvider];
  if (!key) throw new ApiKeyMissingError(byokProvider);
  const fn = {
    xai: xaiCluster,
    openai: openaiCluster,
    anthropic: anthropicCluster,
    google: googleCluster
  }[byokProvider];
  return fn(tabs, key, byokModels[byokProvider], settings.customPrompt);
}
```

### 6.6 Per-provider adapters

| File | Endpoint | Auth | JSON-mode | Notable quirk |
|---|---|---|---|---|
| `byok/xai.js` | `POST https://api.x.ai/v1/chat/completions` | `Authorization: Bearer <key>` | `response_format:{type:'json_object'}` | OpenAI-compatible |
| `byok/openai.js` | `POST https://api.openai.com/v1/chat/completions` | `Authorization: Bearer <key>` | `response_format:{type:'json_object'}` | — |
| `byok/anthropic.js` | `POST https://api.anthropic.com/v1/messages` | `x-api-key: <key>` + `anthropic-version: 2023-06-01` | System prompt forces JSON, parser handles | Requires `anthropic-dangerous-direct-browser-access: true` header for direct-from-browser calls |
| `byok/google.js` | `POST https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent` | `?key=<key>` query param | `generationConfig.responseMimeType:'application/json'` | Different message shape (`contents`/`parts`) |

Each adapter is ~50–80 lines: build request → fetch → map response → call `parseClusters`. Errors normalized into a shared `LlmError` taxonomy: `auth`, `rate_limit`, `network`, `parse`, `unknown`.

### 6.7 Error taxonomy → popup UI

| Error | Detection | UI message | Action button(s) |
|---|---|---|---|
| `PuterNotSignedIn` | `puter.auth.isSignedIn()` returns false | "You need to sign in to Puter to cluster tabs. Set it up in Settings, or switch to your own API key." | Open Settings |
| `PuterOutOfCredits` | Caught Puter error has `delegate === 'usage-limited-chat'` or `code === 'error_400_from_delegate'` | "You're out of Puter credits. Top up at puter.com/dashboard, or switch to BYOK in Settings." | Open Puter Dashboard · Open Settings |
| `ApiKeyMissingError` | BYOK active provider has no key in `apiKeys` | "No API key for {provider}. Add one in Settings." | Open Settings |
| `LlmError{kind:'auth'}` | 401/403 from BYOK provider | "API key rejected by {provider}. Update it in Settings." | Open Settings |
| `LlmError{kind:'rate_limit'}` | 429 from BYOK provider | "{provider} rate limit hit. Try again in a moment." | Retry |
| `LlmError{kind:'network'}` | fetch threw / CORS / DNS | "Couldn't reach {provider}. Retry?" | Retry |
| `ClusterParseError` | `parse.js` couldn't extract valid JSON | "Model returned an unexpected response. Try again?" | Retry |

The "Open Puter Dashboard" button does `chrome.tabs.create({url: 'https://puter.com/dashboard'})`. This URL is treated as a constant in `lib/llm/puter-provider.js` (exported `PUTER_DASHBOARD_URL`) so it has one canonical home.

## 7. First-run flow

### 7.1 Trigger and gating

**On install** (`background.js`):

```js
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html?welcome=1') });
  }
  if (details.reason === 'update') {
    // v1→v2 forced re-setup. See docs/maintenance/v2-migration.md.
    // REMOVE-IN-V3: delete this branch entirely.
    chrome.storage.sync.set({ setupComplete: false });
  }
});
```

**On every popup open** (`popup.js`):
- Read `setupComplete` from `chrome.storage.sync`.
- If `false`: idle view shows a single CTA card replacing "Declare Bankruptcy":
  > **Set up Tab Bankruptcy first**
  > Choose how to talk to your AI before declaring bankruptcy on your tabs.
  > **[ Open Settings ]**
- The "Declare Bankruptcy" button is hidden, not disabled (disabled buttons invite confused clicks).

### 7.2 Welcome section in options

Shown when `?welcome=1` query param is present OR `setupComplete=false`. Renders above existing settings sections:

```
┌─ Welcome to Tab Bankruptcy ───────────────────┐
│  Pick how you want to call the AI:            │
│                                               │
│  ◉ Puter.js (recommended — sign in & start)   │
│      Pay-as-you-go through Puter. No keys.    │
│      Default model: Grok mini                 │
│      [ Sign in to Puter ]   ← shows ✓ when in │
│                                               │
│  ◯ Bring your own key (BYOK)                  │
│      Use your own xAI/OpenAI/Anthropic/Google │
│      account. Keys stay on this device.       │
│                                               │
│  [ Finish Setup ]  (disabled until valid)     │
└───────────────────────────────────────────────┘
```

**Validity rules for "Finish Setup" to enable:**
- Puter chosen: `puter.auth.isSignedIn()` returns true.
- BYOK chosen: at least one provider has a non-empty key AND a model selected. Active `byokProvider` defaults to whichever provider got a key, in Grok-preferred order: xai → openai → anthropic → google.

Clicking **Finish Setup** sets `setupComplete=true`, removes the welcome wrapper, scrolls to the standard provider config (same UI, no longer in welcome wrapper).

### 7.3 Standard provider config (always visible post-setup)

A new "AI Provider" section in options, above "Custom Prompt":

- **Provider**: radio (Puter / BYOK) — switching shows the relevant subsection.
- **Puter subsection**: model dropdown + sign-in/out button + "Signed in as: {username}" status.
- **BYOK subsection**: 4 sub-cards (xAI / OpenAI / Anthropic / Google), each with:
  - Active radio (only one is the active provider at a time).
  - `<input type="password">` for key + show/hide toggle.
  - Per-provider model dropdown (defaults from `models.js`).
  - **[ Test ]** button — fires a 1-token completion; shows ✓ or ✗ with normalized error. For Puter this uses `puter.ai.chat(..., testMode=true, ...)` so it doesn't consume the user's credits. For BYOK adapters, this is a tiny `max_tokens=1` call (each provider's cheapest possible request) — the user's account will be billed for the trivial cost (cents at most).
  - **[ Clear ]** button — wipes the key for that provider only.
  - "Keys never leave this device." note line.

### 7.4 Edge cases

| Scenario | Behavior |
|---|---|
| User clears the key for the **active** BYOK provider post-setup | `setupComplete` flips to `false` → next popup open shows setup gate. (Clearing a key for an inactive provider does NOT flip the gate — only the active one matters.) |
| User signs out of Puter while Puter is the active provider | `setupComplete` flips to `false`. (If BYOK is active when user signs out of Puter, no effect.) |
| Setup gate triggered + user clicks "Open Settings" multiple times | Existing options tab is reused via `chrome.tabs.query` for our options URL — no new tab per click |
| Extension updated from v1 (proxy era) | `onInstalled` with `reason==='update'` forces `setupComplete=false`. See §10 and `docs/maintenance/v2-migration.md` |

## 8. Legacy IndexedDB removal (Task 1)

Pure deletion + small README trim. No behavior change — `chrome.readingList` is already the live save path.

**Files removed:**
- `lib/storage.js` — defines `openDB`, `saveReadingList`, `getReadingLists`, `deleteReadingList`. No call sites in `popup.js`, `background.js`, or `options.js`.
- `storage.test.js` (root) — tests only the deleted module.

**Files edited:**
- `README.md` — File Structure section: remove the `lib/storage.js` line.

**Audit checklist for the chrome.readingList path** (must pass before removal is approved):
- `background.js:49–66` (`getReadingLists` action) — uses `chrome.readingList.query`, returns flat list, handles missing API gracefully ✓
- `background.js:68–76` (`deleteReadingList` action) — uses `chrome.readingList.removeEntry`, keys by URL ✓
- `background.js:88–94` (undo for `save`) — removes URLs from reading list when undoing a save ✓
- `background.js:221–237` (`handleSave`) — calls `chrome.readingList.addEntry` per tab, prefixes title with `[clusterName]`, marks processed ✓
- `manifest.json` — has `readingList` permission ✓

Confirm during implementation that no other call sites import from `lib/storage.js`.

## 9. Maintenance docs

### 9.1 `docs/maintenance/puter-sdk-updates.md`

Cadence: quarterly check, or when Puter publishes a v2 patch in their changelog.

Contents:
1. **Pinned version** mirrored from `lib/puter.VERSION`:
   ```
   url: https://js.puter.com/v2/
   fetched_at: 2026-04-25
   sha256: <hash>
   bytes: <n>
   ```
2. **Update steps:**
   - `curl https://js.puter.com/v2/ -o lib/puter.js`
   - Compute new SHA-256, update `lib/puter.VERSION`
   - `git diff lib/puter.js | head -200` — scan for new permissions or hostnames Puter started calling
   - Update `host_permissions` / `connect-src` in `manifest.json` if Puter added new endpoints
   - Run smoke test checklist below
3. **Smoke test checklist:**
   - Cold install → setup gate appears
   - Sign in to Puter → confirm `puter.auth.isSignedIn()` true
   - Cluster ~10 tabs with default model
   - Verify clusters render with names + emojis
   - "Test connection" in options for Puter → succeeds without consuming credits (verify via `getMonthlyUsage()` delta = 0)
   - **Out-of-credits path:** simulate a `usage-limited-chat` error (mock or borrow a depleted account) → confirm the popup shows `PuterOutOfCredits` UI with both action buttons working
   - Re-run `puter.ai.listModels('xai')` → confirm the default Grok model ID in `lib/llm/models.js` still exists in the returned list; bump if Puter renamed it
   - Sign out → confirm setup gate re-appears
4. **Automation hook:** `/schedule` a recurring agent every 90 days that fetches `https://js.puter.com/v2/`, compares SHA-256 against `lib/puter.VERSION`, and opens a PR with the bumped file if drifted.

### 9.2 `docs/maintenance/v2-migration.md`

Documents the v1→v2 forced re-setup:

- **What it does:** `chrome.runtime.onInstalled` with `reason==='update'` writes `setupComplete=false`, which makes the popup show the setup gate and the options page show the welcome section.
- **Why:** v1 had no provider/key/Puter config — there is no valid v2 config to inherit. Treating users as fresh-install is correct.
- **When to remove:** in v3 (or any release at least 2 release cycles after v2 ships and most users have rolled over).
- **What to delete:** the `if (details.reason === 'update')` branch in `background.js` (search for `REMOVE-IN-V3:` marker).
- **Verification before removal:** confirm field telemetry or anecdotal evidence shows existing users have completed v2 setup. If unsure, leave for one more cycle — the cost of the branch is one storage write on update.

## 10. Testing strategy

| Layer | Test file | What's covered |
|---|---|---|
| LLM dispatcher | `lib/llm/index.test.js` (NEW) | Routes to puter vs byok; throws on missing key |
| Prompt builder | `lib/llm/prompt.test.js` (NEW) | Whitelisted fields only; `customPrompt` threaded through |
| JSON parser | `lib/llm/parse.test.js` (NEW) | Strips fences, handles model JSON quirks, throws on malformed |
| BYOK adapters | `lib/llm/byok/*.test.js` (NEW × 4) | Each: correct endpoint, headers, body shape; mocks `fetch`; normalizes errors into `LlmError` taxonomy |
| Puter adapter | `lib/llm/puter-provider.test.js` (NEW) | Mocks `window.puter`; signed-in vs needs-sign-in branches; out-of-credits error wrap (`delegate==='usage-limited-chat'` → `PuterOutOfCredits`); `model` arg always present in chat call; `stream` never `true` |
| Background | `background.test.js` (EDIT) | New `getTabsForCluster` and `commitClusters` actions; PROXY_URL gone; v1→v2 migration on `onInstalled` |
| Popup | `popup.test.js` (EDIT) | Setup gate; LLM-call path replaces direct background `cluster` call |
| Options | `options.test.js` (EDIT) | Welcome section, Finish Setup gating, key Test/Clear, sub-provider radios |
| Manifest | `manifest.test.js` (EDIT) | New `host_permissions` entries; CSP no longer mentions `autoqa`; new connect-src hosts |
| Removed | `storage.test.js` | Deleted |

All tests continue to use the existing pattern: `node <file>.test.js` with self-mocked `chrome.*` and `global.fetch`.

## 11. Dispatching plan

Five streams. Streams 1 and 2 are file-disjoint and run in parallel. Streams 3, 4, 5 share consumer relationships with the LLM module and run sequentially after.

| # | Stream | Files touched | Depends on | Parallel with |
|---|---|---|---|---|
| 1 | Legacy IndexedDB removal | `lib/storage.js`, `storage.test.js`, `README.md` | — | 2 |
| 2 | LLM module + vendored Puter SDK + maintenance docs | `lib/puter.js`, `lib/puter.VERSION`, `lib/puter.LICENSE`, `lib/llm/**`, `docs/maintenance/puter-sdk-updates.md` | — | 1 |
| 3 | Manifest + background refactor + v2 migration doc | `manifest.json`, `background.js`, `background.test.js`, `manifest.test.js`, `docs/maintenance/v2-migration.md` | 2 | — |
| 4 | Popup wiring (LLM call + setup gate) | `popup.html`, `popup.js`, `popup.css`, `popup.test.js` | 2, 3 | — |
| 5 | Options page (welcome + provider config + key entry) | `options.html`, `options.js`, `options.css`, `options.test.js` | 2 | — |

Each stream gets a focused agent brief that includes (a) this spec file, (b) the exact files in scope, (c) the verification commands, (d) the commit message format. After each stream lands, leader runs the full test suite and commits.

## 12. Forward-looking notes

- **Cost surfacing on Puter dropdown** — out of scope for v2; revisit when Puter exposes a pricing API. The data is available now via `puter.ai.listModels()` (returns `cost` field per model) — implementation just isn't prioritized.
- **Pre-flight credit check** — call `puter.auth.getMonthlyUsage()` on popup open and warn before clustering if the user appears low. Out of scope for v2 because the response shape is per-app and opaque; we'd need to define "low" against a baseline we don't have.
- **Schedule a Puter SDK drift check** — at end of v2 implementation, offer to `/schedule` a 90-day recurring agent.
- **Schedule v2-migration removal PR** — at end of v2 implementation, offer to `/schedule` a one-shot agent in ~2 release cycles to delete the `REMOVE-IN-V3:` block.
- **5th BYOK provider (DeepSeek / Mistral / Groq)** — adapter pattern in `lib/llm/byok/` is designed to make this a one-file addition + `models.js` entry + manifest hostname. Easy to add later.
