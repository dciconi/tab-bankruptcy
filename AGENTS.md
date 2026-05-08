# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

There is no build step, package.json, or test runner. The extension loads as plain HTML/CSS/JS via Chrome's "Load unpacked" in `chrome://extensions`.

Run any individual test with Node directly:

```bash
node manifest.test.js
node privacy-sync.test.js
node background.test.js
node popup.test.js
node popup.css.test.js
for f in lib/llm/*.test.js lib/llm/byok/*.test.js; do node "$f"; done
```

Each test file mocks `global.chrome` itself — fully self-contained, no shared setup. Pre-existing harness issues (`options.test.js` uses Jest globals; `lib/audio.test.js` has an async-escape bug) are not blockers; see README "Caveats".

Package for the Chrome Web Store:

```bash
bash scripts/package.sh
```

Outputs `dist/tab-bankruptcy-<version>.zip` and verifies no test/doc files leaked in.

## Changelog and versioning

For user-visible changes, add an entry to README `## Change Log` in newest-first order. Use the current date in `YYYY-MM-DD` format, and keep bullets concise and user-facing. Do not add internal-only refactors, test-only changes, or build housekeeping unless the user asks for a release note.

Do **not** bump versions for ordinary fixes unless the user explicitly asks for a release/version bump or packaging for distribution. When a version bump is requested, keep these in sync:

- `manifest.json` `version` — Chrome's numeric extension version.
- `manifest.json` `version_name` — human-facing release label.
- README footer `Version`, `version_name`, and `Last updated`.
- README `## Change Log` — add the dated summary for that release.

After a requested version bump/package, run `node manifest.test.js` and `bash scripts/package.sh` when the environment supports it.

## Architecture

**Manifest V3 extension.** Service worker (`background.js`) ↔ UI (`popup.html`/`popup.js`) communicate exclusively via `chrome.runtime.sendMessage`. There is no `default_popup` in the manifest — `chrome.action.onClicked` opens `popup.html` as a full tab (`background.js:216`). Treat `popup.js` as a full-page controller, not a popup.

**Clustering flow:** popup queries tabs via background, then runs the LLM call itself. `popup.js` → `lib/llm/index.js` dispatches to `puter-provider.js` (calls vendored `window.puter.ai.chat()` from `lib/puter.js`) or `byok-provider.js` (direct fetch to xAI / OpenAI / Anthropic / Google with the user's BYOK key). The LLM call lives in popup, not background, because (a) the Puter SDK requires DOM/window globals and (b) full-tab popups don't get suspended like service workers do. CSP `connect-src` allows `'self'` plus the five provider hosts plus `wss://api.puter.com` and `wss://*.puter.com` for Puter's Socket.IO. New outbound hosts must be added to both `host_permissions` and CSP in `manifest.json`.

**Popup state machine:** `IDLE → LOADING → TRIAGE → COMPLETION` (plus `ERROR`). View visibility is driven by `setState()` toggling `.hidden`/`.active` on `#view-<state>` elements. Per-cluster actions in TRIAGE: `keep` (leave open), `save` (add to Chrome reading list), `nuke` (close). Each action shows a 5-second undo toast.

**Tab filtering** (`background.js:113`, `popup.js:103`): excludes pinned and `chrome://*` URLs. The popup's idle count and the LLM request body must stay in sync on this filter.

### Key state in `chrome.storage.session`

- `tb_processed_tab_ids` — IDs already kept/saved/nuked. Excluded from re-clustering so resolved tabs don't reappear. `undo` removes from this list.
- `tb_last_tab_ids` — sorted-joined signature of last clustered tab IDs. If unchanged AND cached clusters exist, the popup uses the cached result instead of re-running the LLM. Invalidate by clearing the session key or changing the tab set.
- `tb_cluster_state` — last cluster payload; serves the `resume` action when the popup reopens mid-load.

### LLM module (`lib/llm/`)

ESM scope is set via `lib/llm/package.json` (`{"type":"module"}`). Entry point is `lib/llm/index.js` → `clusterTabs(tabs, settings)`, which dispatches to either `puter-provider.js` or `byok-provider.js` based on the user's chosen provider.

The model catalog is **data, not code** — see `lib/llm/models.json`. Adding a model requires no JS changes.

Errors throw a normalized `LlmError` with `kind ∈ {auth, rate_limit, network, unknown}` plus the original response info. The popup error UI keys off `kind` to render tailored copy + actions. Custom error classes (`ApiKeyMissingError`, `PuterNotSignedIn`, `PuterOutOfCredits`, `ClusterParseError`) are used for the few states that need bespoke handling beyond the four-kind taxonomy.

### Save behavior

`save` uses **Chrome's built-in `chrome.readingList`** (`background.js:180`). Titles are prefixed with `[clusterName]`. The legacy `lib/storage.js` IndexedDB store was deleted in v2.

### Module duality

`lib/audio.js` exports via both CommonJS (`module.exports`) and ES modules (`export {...}`) so the same file works for `popup.js` (`import`) and Node test files (`require`). Preserve both export forms when editing.

### Tab grouping

Native Chrome tab groups are created twice: once in `background.js` (`createTabGroups`) and once in `popup.js` after render (best-effort fallback). Both use the real Chrome API — `chrome.tabs.group({tabIds})` to create the group, then `chrome.tabGroups.update(groupId, {title, color})` to style it. **`chrome.tabGroups.create` does not exist**; calls to it silently no-op. Both call sites swallow errors because tabs may already be grouped or closed; don't tighten that error handling without a reason.
