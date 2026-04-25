# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

There is no build step, package.json, or test runner. The extension loads as plain HTML/CSS/JS via Chrome's "Load unpacked" in `chrome://extensions`.

Run any individual test with Node directly:

```bash
node background.test.js
node popup.test.js
node options.test.js
node manifest.test.js
node storage.test.js
node popup.css.test.js
node lib/audio.test.js
```

Each test file mocks `global.chrome` itself, so they are fully self-contained — there is no shared setup file or runner. Some async paths log env limitations; treat that as expected.

Package for distribution (excludes tests):

```bash
zip -r tab-bankruptcy.zip . -x "*.test.js" "test/*"
```

## Architecture

**Manifest V3 extension.** Service worker (`background.js`) ↔ UI (`popup.html`/`popup.js`) communicate exclusively via `chrome.runtime.sendMessage`. There is no `default_popup` in the manifest — `chrome.action.onClicked` opens `popup.html` as a full tab (background.js:258). Treat `popup.js` as a full-page controller, not a popup.

**Clustering flow:** popup sends `{action:'cluster'}` → background queries tabs, filters, POSTs to the proxy at `https://autoqa.teachx.ai/hackathon/preview/chapter-11/cluster` → proxy calls xAI Grok server-side → background returns `{type:'clusters', clusters:[...]}` to popup. The extension never holds the xAI key. CSP `connect-src` only allows `'self'` and `https://autoqa.teachx.ai`; new outbound hosts must be added to both `host_permissions` and CSP in `manifest.json`.

**Popup state machine:** `IDLE → LOADING → TRIAGE → COMPLETION` (plus `ERROR`). View visibility is driven by `setState()` toggling `.hidden`/`.active` on `#view-<state>` elements. Per-cluster actions in TRIAGE: `keep` (leave open), `save` (add to Chrome reading list), `nuke` (close). Each action shows a 5-second undo toast.

**Tab filtering** (background.js:124, popup.js:93): excludes pinned, `chrome://*`, `about:*`, and the extension's own URL. The popup's idle count and the background's request body must stay in sync on this filter.

### Key state in `chrome.storage.session`

- `tb_processed_tab_ids` — IDs already kept/saved/nuked. Excluded from re-clustering so resolved tabs don't reappear. `undo` removes from this list.
- `tb_last_tab_ids` — sorted-joined signature of last clustered tab IDs. If unchanged AND cached clusters exist, skip the proxy call (background.js:142-153). Invalidate by clearing `SESSION_KEY` or changing the tab set.
- `tb_cluster_state` — last cluster payload; serves the `resume` action when the popup reopens mid-load.

### Proxy contract (strict)

The proxy uses Pydantic — extra/wrong-typed fields cause 422s. Before POSTing, `handleClusterRequest` whitelists fields to `id, title, url, lastAccessed, status, active, groupId, windowId, pinned, audible, discarded, index, highlighted` and `Math.floor`s `lastAccessed` (background.js:167-174). Any new tab fields needed downstream must be added to that whitelist.

Request: `POST {tabs:[...], chromeId}` → Response: `{clusters:[{name, emoji, tabIds, vibe, confidence, color?}]}`.

### Save behavior

`save` uses **Chrome's built-in `chrome.readingList`**, not IndexedDB. Titles are prefixed with `[clusterName]` (background.js:229). `lib/storage.js` defines an IndexedDB reading-list store but is not currently wired into the save path — check before assuming reads/writes go there.

### Module duality

`lib/audio.js` exports via both CommonJS (`module.exports`) and ES modules (`export {...}`) so the same file works for `popup.js` (`import`) and Node test files (`require`). Preserve both export forms when editing.

### Service worker keepalive

`handleClusterRequest` creates a `tb_sw_keepalive` alarm (period 0.5 min) before the fetch and clears it in `finally` to keep MV3 from suspending the worker mid-request. Long-running async work in background should follow the same pattern.

### Tab grouping

Native Chrome tab groups are created twice: once in `background.js` (`createTabGroups`, more reliable) and once in `popup.js` after render (best-effort fallback). Both swallow errors because tabs may already be grouped or closed; don't tighten that error handling without a reason.
