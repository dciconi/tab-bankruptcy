# Tab Bankruptcy — Project Context

This file captures durable context that doesn't fit in `CLAUDE.md` (which is a how-the-code-works reference) or in spec documents (which are point-in-time). Use it for: why we made a decision, what the current state of in-flight work is, and what to know before touching this code.

Keep this file short. If a section grows beyond ~10 lines, it probably belongs in its own doc under `docs/`.

---

## Project history (one-liner per chapter)

- **v1.0 (2026-04-11)** — Hackathon ship. Used a server-side proxy at `https://autoqa.teachx.ai/hackathon/preview/chapter-11/cluster` that wrapped xAI Grok with the maintainer's API key. Reading-list save was implemented twice: once via `chrome.readingList` (live path) and once via IndexedDB in `lib/storage.js` (dead code, never wired).
- **v2.0 (in flight, 2026-04)** — Retire the proxy. Default to **Puter.js** (vendored SDK, user signs in once, Puter handles billing). Add **BYOK** fallback for xAI / OpenAI / Anthropic / Google. Add a **first-run setup gate**. Delete the dead IndexedDB code. See `docs/superpowers/specs/2026-04-25-puter-byok-and-indexeddb-removal-design.md`.

## Standing decisions

These are settled — re-open only with a strong reason.

- **No backend.** The maintainer does not operate any server. Anything that requires one (custom proxy, telemetry endpoint, key escrow) is out.
- **No remote scripts at runtime.** MV3 CSP stays at `script-src 'self'`. Third-party SDKs are vendored under `lib/` with a pinned version + SHA-256 + license file. Puter is the first such vendored SDK; the same pattern applies to any future addition.
- **API keys live in `chrome.storage.local`, never `sync`.** Sync roams to every Chrome profile the user signs into; keys must not roam.
- **Cheap-fast tier defaults across providers.** Tab clustering is a low-reasoning task (read ~20 titles, emit ~5 cluster names). Defaults are Haiku / Flash / mini equivalents. Do not "modernize" defaults to Sonnet/Opus — users can opt up via the dropdown.
- **Popup is a full tab, not a real popup.** `manifest.json` has no `default_popup`; `chrome.action.onClicked` opens `popup.html` as a tab. This is load-bearing for v2 (Puter SDK needs a stable DOM/window for sign-in).

## Where LLM calls happen (and why)

- **Background (`background.js`)** owns Chrome APIs only: tab queries, processed-tab tracking, session cache, tab grouping.
- **Popup (`popup.js`)** owns the LLM call (Puter or BYOK). Required because Puter's auth needs a real DOM. BYOK could live in either, but symmetry simplifies the code.
- Action protocol: popup → bg `getTabsForCluster` → popup runs LLM → popup → bg `commitClusters`.

## Open follow-ups (not blocking v2 ship)

- **Surface Puter per-call cost in the model dropdown.** Out of scope for v2; revisit when Puter exposes a pricing API. Suggested label format: `Grok mini · ~$0.0002 / cluster`.
- **Puter SDK drift check** — schedule a 90-day recurring agent to compare `https://js.puter.com/v2/` SHA-256 against `lib/puter.VERSION` and open a PR on drift.
- **5th BYOK provider (DeepSeek / Mistral / Groq Cloud).** Adapter pattern in `lib/llm/byok/` is built to make this a one-file addition. No commitment yet — add when there's user demand.

## Conventions worth knowing before editing

- **Tests are plain `node *.test.js`** with self-mocked `global.chrome` and `global.fetch`. No Jest, no test runner config. New test files follow the same pattern.
- **Dual-export modules.** `lib/audio.js` exports via both CommonJS (`module.exports`) and ESM (`export`) so the same file works for `popup.js` (`import`) and Node tests (`require`). New `lib/llm/*` modules follow the same pattern unless they only run in the browser (e.g. `puter-provider.js`, which depends on `window`).
- **Comment policy is restrictive.** Don't write what-comments. Only why-comments for non-obvious constraints (e.g. the `anthropic-dangerous-direct-browser-access` header in `byok/anthropic.js`).
- **Keep stream files disjoint.** When implementing v2, stream 1 (legacy removal) and stream 2 (LLM module) touch different files and can land in either order. Streams 3–5 share consumer relationships with the LLM module and need to land in order. Don't mix scopes in one PR.

## Puter SDK quirks worth not rediscovering

The full table is in the active spec §6.8, but the load-bearing ones:

- **Sign-in must come from a direct user click.** `puter.auth.signIn()` opens a popup window; if it's called after any `await` post-click, the popup blocker engages. Sign-in lives only in the options page, never in the popup's cluster path.
- **Default model is `gpt-5-nano`.** If you don't pass `model: ...` to `puter.ai.chat()`, you'll get OpenAI, not Grok. Always pass it explicitly.
- **Out-of-credits returns HTTP 400, not 402.** Detect via `err.delegate === 'usage-limited-chat'`. Top-up URL is `puter.com/dashboard` — kept as a single constant in `puter-provider.js`.
- **Don't enable `stream: true`.** Upstream issue #2410 — streams hang indefinitely on errors instead of rejecting.
- **`puter.ai.chat(prompt, testMode=true, options)`** runs the full path without consuming credits. Used by the "Test connection" button in options.
- **Discover Grok IDs via `puter.ai.listModels('xai')`.** Puter doesn't pin model IDs in public docs; what's hardcoded in `models.js` came from a runtime listing on the date in `lib/puter.VERSION`.

## Pointers

- **Architecture reference:** `CLAUDE.md`
- **Active spec:** `docs/superpowers/specs/2026-04-25-puter-byok-and-indexeddb-removal-design.md`
- **Maintenance docs:** `docs/maintenance/`
- **Upstream Puter SDK:** `https://js.puter.com/v2/` (changelog at `https://docs.puter.com/`)
- **Puter user dashboard (top-up + token):** `https://puter.com/dashboard`
