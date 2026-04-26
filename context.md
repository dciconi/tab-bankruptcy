# Tab Bankruptcy — Project Context

This file captures durable context that doesn't fit in `CLAUDE.md` (which is a how-the-code-works reference) or in spec documents (which are point-in-time). Use it for: why we made a decision, what the current state of in-flight work is, and what to know before touching this code.

Keep this file short. If a section grows beyond ~10 lines, it probably belongs in its own doc under `docs/`.

---

## Project history (one-liner per chapter)

- **v1.0 (2026-04-11)** — Hackathon ship. Used a server-side proxy at `https://autoqa.teachx.ai/hackathon/preview/chapter-11/cluster` that wrapped xAI Grok with the maintainer's API key. Reading-list save was implemented twice: once via `chrome.readingList` (live path) and once via IndexedDB in `lib/storage.js` (dead code, never wired).
- **v2.0 (2026-04-25)** — Retire the proxy. Default to **Puter.js** (vendored SDK, user signs in once, Puter handles billing). Add **BYOK** fallback for xAI / OpenAI / Anthropic / Google. Add a first-run welcome / setup gate. Delete the dead IndexedDB code. See `docs/superpowers/specs/2026-04-25-puter-byok-and-indexeddb-removal-design.md`.
- **v2.x iterations (2026-04-26)** — UX polish on top of v2.0:
  - **BYOK as ordered key list with fallback chain** (replaces the original 4-fixed-cards design). Stored as `chrome.storage.local.byokKeys: [{id, label, provider, model, key, status, lastTestedAt, lastError}]`. First key in the list is default; on runtime failure the next is tried automatically. Status pills (✓/✗/?) reflect live verification.
  - **Auto-complete setup.** No more "Finish Setup" button. Setup completes the moment the user reaches a working state (Puter signed-in OR a BYOK Test passes). `setupComplete` is reconciled on each popup/options open, not migrated — existing users with working configs are not re-gated on extension updates.
  - **Models catalog moved to JSON** (`lib/llm/models.json`) so the model list can be edited without touching code. `lib/llm/models.js` is a thin re-export wrapper.
  - **Active-provider display** on the popup idle view: "Using Puter · Grok 3 mini" or "Using BYOK · Personal xAI · grok-4-1-fast-non-reasoning", with a Change link to Settings.
  - **Asymptotic progress bar** during clustering: `95 * (1 - exp(-elapsed/5))`, snaps to 100% only when results render.
  - **Reset button** in Settings: full factory reset — `chrome.storage.{local,sync,session}.clear()` + Puter sign-out + reload.
  - **CSP fix:** `wss://api.puter.com` and `wss://*.puter.com` added so Puter's Socket.IO transport doesn't trip CSP (commit `30c0661`).

## Standing decisions

These are settled — re-open only with a strong reason.

- **No backend.** The maintainer does not operate any server. Anything that requires one (custom proxy, telemetry endpoint, key escrow) is out.
- **No remote scripts at runtime.** MV3 CSP stays at `script-src 'self'`. Third-party SDKs are vendored under `lib/` with a pinned version + SHA-256 + license file. Puter is the first such vendored SDK; the same pattern applies to any future addition.
- **API keys live in `chrome.storage.local`, never `sync`.** Sync roams to every Chrome profile the user signs into; keys must not roam.
- **BYOK is an ordered list, not a per-provider map.** Users add as many keys as they want; the first that succeeds at runtime is used, the rest are fallback. Don't reintroduce the old "single-key-per-provider with active radio" shape — it forced users to choose between providers instead of stacking them.
- **Setup state is reconciled, not migrated.** `setupComplete` is recomputed on each popup/options open (`reconcileSetupComplete()`). Forcing `setupComplete = false` from `chrome.runtime.onInstalled` (the previous v1→v2 approach) re-gates v2.x users on every patch release — don't do that again.
- **Cheap-fast tier defaults across providers.** Tab clustering is a low-reasoning task (read ~20 titles, emit ~5 cluster names). Defaults are Haiku / Flash / mini equivalents. Do not "modernize" defaults to Sonnet/Opus — users can opt up via the dropdown.
- **Popup is a full tab, not a real popup.** `manifest.json` has no `default_popup`; `chrome.action.onClicked` opens `popup.html` as a tab. This is load-bearing for v2 (Puter SDK needs a stable DOM/window for sign-in).

## Where LLM calls happen (and why)

- **Background (`background.js`)** owns Chrome APIs only: tab queries, processed-tab tracking, session cache, tab grouping. Also: `chrome.runtime.onInstalled` opens the welcome page on fresh install. NOTE: it intentionally does NOT touch `setupComplete` on update — reconciliation handles that on next open.
- **Popup (`popup.js`)** owns the LLM call (Puter or BYOK). Required because Puter's auth needs a real DOM. BYOK fallback chain runs here too: it loops through `byokKeys` and persists status updates via the `onKeyStatus` callback wired into `clusterTabs(tabs, settings)`.
- **Options (`options.js`)** owns provider/key configuration. Keys live in `chrome.storage.local.byokKeys`; preferences in `chrome.storage.sync`. Both popup and options call `reconcileSetupComplete()` at startup to keep `setupComplete` aligned with reality.
- Action protocol: popup → bg `getTabsForCluster` → popup runs LLM → popup → bg `commitClusters`.

## Open follow-ups (not blocking v2 ship)

- **Surface Puter per-call cost in the model dropdown.** Out of scope for v2; revisit when Puter exposes a pricing API. Suggested label format: `Grok mini · ~$0.0002 / cluster`.
- **Puter SDK drift check** — schedule a 90-day recurring agent to compare `https://js.puter.com/v2/` SHA-256 against `lib/puter.VERSION` and open a PR on drift.
- **5th BYOK provider (DeepSeek / Mistral / Groq Cloud).** Adapter pattern in `lib/llm/byok/` is built to make this a one-file addition. No commitment yet — add when there's user demand.

## Conventions worth knowing before editing

- **Tests are plain `node *.test.js`** with self-mocked `global.chrome` and `global.fetch`. No Jest, no test runner config. New test files follow the same pattern.
- **Two ESM scopes.** Repo-root `*.test.js` and `lib/audio.js` are CommonJS. `lib/llm/` is ESM via its own `package.json` (`"type": "module"`). Tests under `lib/llm/` use `import` and run with plain `node lib/llm/<file>.test.js`. Don't mix the two — adding ESM imports to `lib/audio.js` would break the dual-export shim.
- **Comment policy is restrictive.** Don't write what-comments. Only why-comments for non-obvious constraints (e.g. the `anthropic-dangerous-direct-browser-access` header in `byok/anthropic.js`, the no-`stream:true` guardrail in `puter-provider.js`).
- **When dispatching parallel implementer subagents, keep their files disjoint.** Even file-disjoint subagents share the git index — if both run `git add` and `git commit`, one can sweep the other's staged changes into a bundled commit. Either dispatch sequentially, or instruct each agent NOT to commit and let the controller commit at the end.
- **Don't reintroduce a `Co-Authored-By` trailer.** `~/.claude/settings.json` has `attribution.commit: ""` and `attribution.pr: ""`. Past commits in branch history still have it; new commits should not.

## Puter SDK quirks worth not rediscovering

The full table is in the active spec §6.8, but the load-bearing ones:

- **Sign-in must come from a direct user click.** `puter.auth.signIn()` opens a popup window; if it's called after any `await` post-click, the popup blocker engages. Sign-in lives only in the options page, never in the popup's cluster path.
- **Default model is `gpt-5-nano`.** If you don't pass `model: ...` to `puter.ai.chat()`, you'll get OpenAI, not Grok. Always pass it explicitly.
- **Out-of-credits returns HTTP 400, not 402.** Detect via `err.delegate === 'usage-limited-chat'`. Top-up URL is `puter.com/dashboard` — kept as a single constant in `puter-provider.js`.
- **Don't enable `stream: true`.** Upstream issue #2410 — streams hang indefinitely on errors instead of rejecting.
- **`puter.ai.chat(prompt, testMode=true, options)`** runs the full path without consuming credits. Used by the "Test connection" button in options.
- **Discover Grok IDs via `puter.ai.listModels('xai')`.** Puter doesn't pin model IDs in public docs; what's hardcoded in `models.js` came from a runtime listing on the date in `lib/puter.VERSION`.
- **Console noise: "WebSocket is closed before the connection is established".** Puter's SDK uses Socket.IO for realtime events (puter.fs, puter.print, etc.) — features we don't use. Socket.IO opens with HTTP long-polling and probes a WS upgrade; the probe may fail and log this message, then long-polling continues working. `puter.ai.chat()` is a plain HTTPS POST to `api.puter.com/drivers/call` and does NOT depend on the WebSocket. CSP must allow `wss://api.puter.com` and `wss://*.puter.com` so the page itself doesn't reject the probe (commit `30c0661`), but the probe-then-fail messages are not actionable on our end. Don't waste time debugging them.

## Pointers

- **Architecture reference:** `CLAUDE.md`
- **Active spec:** `docs/superpowers/specs/2026-04-25-puter-byok-and-indexeddb-removal-design.md`
- **Maintenance docs:** `docs/maintenance/`
- **Upstream Puter SDK:** `https://js.puter.com/v2/` (changelog at `https://docs.puter.com/`)
- **Puter user dashboard (top-up + token):** `https://puter.com/dashboard`
