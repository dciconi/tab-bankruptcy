# Puter.js + BYOK + Legacy IndexedDB Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `autoqa.teachx.ai` Grok proxy with Puter.js as default and BYOK as power-user fallback (xAI / OpenAI / Anthropic / Google), gate first-run on provider setup, and delete the unused IndexedDB reading-list module.

**Architecture:** LLM calls move from the MV3 service worker into `popup.js` (which is rendered as a full tab and has the DOM that Puter's auth needs). Background remains the owner of Chrome APIs (tabs, processed-tab tracking, session cache, tab grouping). A new `lib/llm/` module provides a uniform `clusterTabs(tabs, settings)` entry that dispatches to a vendored Puter SDK or to one of four direct browser-to-provider fetch adapters.

**Tech Stack:** Manifest V3, vanilla JS (ESM), `chrome.storage.sync` for prefs, `chrome.storage.local` for keys, `chrome.readingList` for saves, vendored `puter.js` v2.

**Spec:** `docs/superpowers/specs/2026-04-25-puter-byok-and-indexeddb-removal-design.md`

---

## Stream Topology

| # | Stream | Files touched | Depends on | Parallel with |
|---|---|---|---|---|
| 1 | Legacy IndexedDB removal | `lib/storage.js`, `storage.test.js`, `README.md` | — | 2 |
| 2 | LLM module + vendored Puter SDK + maintenance docs | `lib/puter.js`, `lib/puter.VERSION`, `lib/puter.LICENSE`, `lib/llm/**`, `docs/maintenance/puter-sdk-updates.md` | — | 1 |
| 3 | Manifest + background refactor + v2 migration doc | `manifest.json`, `background.js`, `background.test.js`, `manifest.test.js`, `docs/maintenance/v2-migration.md` | 2 | — |
| 4 | Popup wiring (LLM call + setup gate) | `popup.html`, `popup.js`, `popup.css`, `popup.test.js` | 2, 3 | — |
| 5 | Options page (welcome + provider config + key entry) | `options.html`, `options.js`, `options.css`, `options.test.js` | 2 | — |

Streams 1 and 2 are file-disjoint and can run in parallel. Streams 3, 4, 5 each depend on 2 and on each other transitively (3 changes the popup↔bg protocol that 4 consumes; 4 and 5 share no files but both consume `lib/llm/` and `lib/puter.js`). After all five land, run the cross-stream verification at the end of this document.

---

## File Layout (Final State)

```
tab-bankruptcy/
├── manifest.json                         [edited]
├── background.js                         [edited]
├── background.test.js                    [edited]
├── popup.html                            [edited]
├── popup.js                              [edited]
├── popup.test.js                         [edited]
├── popup.css                             [edited]
├── options.html                          [edited]
├── options.js                            [edited]
├── options.css                           [edited]
├── options.test.js                       [edited]
├── manifest.test.js                      [edited]
├── lib/
│   ├── audio.js                          [unchanged]
│   ├── audio.test.js                     [unchanged]
│   ├── puter.js                          [NEW — vendored]
│   ├── puter.LICENSE                     [NEW]
│   ├── puter.VERSION                     [NEW]
│   └── llm/
│       ├── package.json                  [NEW — { "type": "module" }]
│       ├── errors.js                     [NEW]
│       ├── prompt.js                     [NEW]
│       ├── parse.js                      [NEW]
│       ├── models.js                     [NEW]
│       ├── puter-provider.js             [NEW]
│       ├── byok-provider.js              [NEW]
│       ├── index.js                      [NEW]
│       ├── errors.test.js                [NEW]
│       ├── prompt.test.js                [NEW]
│       ├── parse.test.js                 [NEW]
│       ├── puter-provider.test.js        [NEW]
│       ├── byok-provider.test.js         [NEW]
│       ├── index.test.js                 [NEW]
│       └── byok/
│           ├── xai.js                    [NEW]
│           ├── openai.js                 [NEW]
│           ├── anthropic.js              [NEW]
│           ├── google.js                 [NEW]
│           ├── xai.test.js               [NEW]
│           ├── openai.test.js            [NEW]
│           ├── anthropic.test.js         [NEW]
│           └── google.test.js            [NEW]
├── docs/
│   ├── maintenance/
│   │   ├── puter-sdk-updates.md          [NEW]
│   │   └── v2-migration.md               [NEW]
│   └── superpowers/{specs,plans}/...     [pre-existing]

DELETED: lib/storage.js, storage.test.js
```

---

## Stream 1 — Legacy IndexedDB Removal

**Owner brief:** This stream is mechanical deletion + a README trim. The IndexedDB module in `lib/storage.js` was never wired up after the v1 switch to `chrome.readingList`. No callers exist. Verify before deleting.

### Task 1.1: Verify no callers of `lib/storage.js`

**Files:**
- Read-only: all `.js` and `.html` files under `tab-bankruptcy/`

- [ ] **Step 1: Grep for any import or require of `lib/storage.js` or `./lib/storage`**

Run: `grep -rn "lib/storage" --include="*.js" --include="*.html" .`

Expected output: only matches inside `lib/storage.js` itself, `storage.test.js`, and `README.md` File Structure table. NO matches in `popup.js`, `background.js`, `options.js`, `popup.html`, `options.html`.

If any other call site appears, STOP and notify — the assumption is wrong.

- [ ] **Step 2: Grep for the function names exported from `lib/storage.js`**

Run: `grep -rn "saveReadingList\|getReadingLists\|deleteReadingList\|openDB" --include="*.js" .`

Expected: matches only in `lib/storage.js`, `storage.test.js`, `background.js` (which uses `chrome.readingList.query`/`removeEntry`/`addEntry` directly — these are method names on `chrome.readingList`, not imports of the deleted module), and `background.test.js` (mock).

The `getReadingLists` and `deleteReadingList` strings appear in `background.js` as message-action names (e.g. `if (message.action === 'getReadingLists')`). These are unrelated to the deleted module — those handlers call `chrome.readingList.*` directly. Leave them alone.

### Task 1.2: Delete `lib/storage.js` and `storage.test.js`

**Files:**
- Delete: `lib/storage.js`
- Delete: `storage.test.js` (in repo root)

- [ ] **Step 1: Delete the two files**

Run: `rm lib/storage.js storage.test.js`

- [ ] **Step 2: Verify deletion**

Run: `ls lib/storage.js storage.test.js 2>&1`

Expected: both should report "No such file or directory".

- [ ] **Step 3: Run remaining test files to verify nothing else broke**

Run: `node background.test.js && node popup.test.js && node options.test.js && node manifest.test.js && node popup.css.test.js && node lib/audio.test.js`

Expected: all pass (or show their existing pre-known env limitations — we're checking for new breakage, not pre-existing flakiness).

### Task 1.3: Trim `README.md` File Structure section

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Read current File Structure block (lines 76–100)**

Open `README.md`. Locate the File Structure code block.

- [ ] **Step 2: Remove the three lines referencing the deleted module**

Delete these lines from the File Structure block:

```
│   ├── storage.js         # saveReadingList, getReadingLists, deleteReadingList
│   └── storage.test.js
```

And in the root file list, delete:

```
├── popup.css.test.js
```

Wait — `popup.css.test.js` is NOT being deleted. Only delete:

- The line `│   ├── storage.js         # saveReadingList, getReadingLists, deleteReadingList`
- The line `│   └── storage.test.js`

Adjust the tree characters so the remaining lines render correctly (the last item in `lib/` is now `audio.test.js`; its prefix becomes `└──` instead of `├──`).

The resulting `lib/` block in the File Structure should look like:

```
├── lib/
│   ├── audio.js           # playClick, playNuke, playKeep, playSave, playCompletion
│   └── audio.test.js
```

Also remove the standalone bottom line:

```
├── popup.css.test.js
```

Actually leave `popup.css.test.js` alone — that file still exists. ONLY delete the two `storage*` lines.

- [ ] **Step 3: Visual diff**

Run: `git diff README.md`

Expected: only the two storage-related lines removed, plus the tree-character adjustment on the line above (from `├──` to `└──`).

### Task 1.4: Commit Stream 1

- [ ] **Step 1: Stage and commit**

Run:

```bash
git add lib/storage.js storage.test.js README.md
git commit -m "$(cat <<'EOF'
refactor: remove unused IndexedDB reading-list module

The IndexedDB-backed reading list in lib/storage.js was superseded by
chrome.readingList in v1 and never re-wired. Delete the module, its
test, and the README references. The chrome.readingList path in
background.js is unchanged and remains the live save/restore path.
EOF
)"
```

- [ ] **Step 2: Verify commit landed**

Run: `git log --oneline -1`

Expected: shows the new commit.

---

## Stream 2 — LLM Module + Vendored Puter SDK + Maintenance Docs

**Owner brief:** This stream creates everything under `lib/llm/`, vendors `lib/puter.js`, and writes the Puter update doc. It does NOT touch any consumer (`popup.js`, `background.js`, `options.js`). Streams 3/4/5 wire it in.

The `lib/llm/` subtree is ESM-only — it has its own `package.json` with `"type": "module"` so existing CommonJS tests in the repo root remain unaffected. New tests under `lib/llm/` are also ESM and run via `node lib/llm/<file>.test.js`.

### Task 2.1: Vendor the Puter SDK v2

**Files:**
- Create: `lib/puter.js`
- Create: `lib/puter.VERSION`
- Create: `lib/puter.LICENSE`

- [ ] **Step 1: Download the SDK**

Run:

```bash
curl -fsSL https://js.puter.com/v2/ -o lib/puter.js
```

Expected: file written, exit 0.

- [ ] **Step 2: Verify it's non-empty and looks like Puter**

Run:

```bash
wc -c lib/puter.js && head -5 lib/puter.js
```

Expected: byte count >100KB and the first few lines reference Puter (e.g., `// Puter` comment header or minified bundle starting with `(function`).

- [ ] **Step 3: Compute and record the SHA-256**

Run:

```bash
sha256sum lib/puter.js
```

Take the resulting hex digest. Example: `8f3c...` (64 hex chars).

- [ ] **Step 4: Write `lib/puter.VERSION`**

Create `lib/puter.VERSION` with this content (substitute `<sha256>` with the hex digest from step 3 and `<bytes>` with the byte count from step 2):

```
url: https://js.puter.com/v2/
fetched_at: 2026-04-25
sha256: <sha256>
bytes: <bytes>
```

- [ ] **Step 5: Write `lib/puter.LICENSE`**

Puter is AGPL-3.0. Create `lib/puter.LICENSE` containing:

```
This file vendors the Puter.js v2 SDK from https://js.puter.com/v2/.

Puter is distributed under the GNU Affero General Public License v3.0.
Full license text: https://github.com/HeyPuter/puter/blob/main/LICENSE.txt

Source repository: https://github.com/HeyPuter/puter
```

- [ ] **Step 6: Commit the vendored SDK**

Run:

```bash
git add lib/puter.js lib/puter.VERSION lib/puter.LICENSE
git commit -m "$(cat <<'EOF'
chore: vendor Puter.js v2 SDK

MV3 CSP forbids loading remote scripts. Ship Puter.js as a vendored file
under lib/. SHA-256 and fetch date pinned in lib/puter.VERSION; AGPL-3.0
license noted in lib/puter.LICENSE. Update process documented in
docs/maintenance/puter-sdk-updates.md (added in a follow-up task).
EOF
)"
```

### Task 2.2: Bootstrap `lib/llm/` ESM scope

**Files:**
- Create: `lib/llm/package.json`

- [ ] **Step 1: Create the package.json**

Write `lib/llm/package.json`:

```json
{
  "type": "module"
}
```

This scopes ESM-handling to `lib/llm/` and below. Files outside (e.g. `lib/audio.js`, repo-root `*.test.js`) keep their CommonJS behavior.

- [ ] **Step 2: Verify Node honors it**

Run:

```bash
node --input-type=module -e "console.log('esm ok')"
```

Expected: prints `esm ok`. (This is just a Node sanity check — the real test is the next task.)

### Task 2.3: Create `lib/llm/errors.js` and its test

**Files:**
- Create: `lib/llm/errors.js`
- Create: `lib/llm/errors.test.js`

- [ ] **Step 1: Write the test first**

Create `lib/llm/errors.test.js`:

```js
import assert from 'node:assert';
import {
  ApiKeyMissingError,
  PuterNotSignedIn,
  PuterOutOfCredits,
  ClusterParseError,
  LlmError
} from './errors.js';

// ApiKeyMissingError carries the provider name
{
  const e = new ApiKeyMissingError('openai');
  assert.strictEqual(e.name, 'ApiKeyMissingError');
  assert.strictEqual(e.provider, 'openai');
  assert.ok(e.message.includes('openai'));
}

// PuterNotSignedIn has a stable name
{
  const e = new PuterNotSignedIn();
  assert.strictEqual(e.name, 'PuterNotSignedIn');
}

// PuterOutOfCredits wraps the original error
{
  const orig = { delegate: 'usage-limited-chat', status: 400 };
  const e = new PuterOutOfCredits(orig);
  assert.strictEqual(e.name, 'PuterOutOfCredits');
  assert.strictEqual(e.original, orig);
}

// ClusterParseError carries the raw text
{
  const e = new ClusterParseError('bad json', 'not even close');
  assert.strictEqual(e.name, 'ClusterParseError');
  assert.strictEqual(e.raw, 'not even close');
}

// LlmError has a kind discriminator
{
  const e = new LlmError('auth', 'bad key', null);
  assert.strictEqual(e.name, 'LlmError');
  assert.strictEqual(e.kind, 'auth');
}

console.log('errors.test.js passed');
```

- [ ] **Step 2: Run it (expect FAIL — module doesn't exist yet)**

Run: `node lib/llm/errors.test.js`

Expected: error like `Cannot find module './errors.js'` or `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Write the implementation**

Create `lib/llm/errors.js`:

```js
export class ApiKeyMissingError extends Error {
  constructor(provider) {
    super(`No API key for ${provider}`);
    this.name = 'ApiKeyMissingError';
    this.provider = provider;
  }
}

export class PuterNotSignedIn extends Error {
  constructor() {
    super('Not signed in to Puter');
    this.name = 'PuterNotSignedIn';
  }
}

export class PuterOutOfCredits extends Error {
  constructor(originalError) {
    super('Puter account is out of credits');
    this.name = 'PuterOutOfCredits';
    this.original = originalError;
  }
}

export class ClusterParseError extends Error {
  constructor(message, raw) {
    super(message);
    this.name = 'ClusterParseError';
    this.raw = raw;
  }
}

export class LlmError extends Error {
  constructor(kind, message, original) {
    super(message);
    this.name = 'LlmError';
    this.kind = kind; // 'auth' | 'rate_limit' | 'network' | 'unknown'
    this.original = original;
  }
}
```

- [ ] **Step 4: Run again (expect PASS)**

Run: `node lib/llm/errors.test.js`

Expected: `errors.test.js passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/llm/package.json lib/llm/errors.js lib/llm/errors.test.js
git commit -m "feat: add LLM error taxonomy"
```

### Task 2.4: Create `lib/llm/prompt.js` + test

**Files:**
- Create: `lib/llm/prompt.js`
- Create: `lib/llm/prompt.test.js`

- [ ] **Step 1: Write the test**

Create `lib/llm/prompt.test.js`:

```js
import assert from 'node:assert';
import { buildMessages } from './prompt.js';

// Whitelists fields — strips everything except id, title, url
{
  const tabs = [
    { id: 1, title: 'A', url: 'https://a.com', favIconUrl: 'x.png', windowId: 99, lastAccessed: 1234 }
  ];
  const msgs = buildMessages(tabs, 'be funny');
  const userPayload = msgs.find(m => m.role === 'user').content;
  const inner = JSON.parse(userPayload.split('\n').slice(1).join('\n'));
  assert.deepStrictEqual(inner, [{ id: 1, title: 'A', url: 'https://a.com' }],
    'only id, title, url should pass through');
}

// Threads customPrompt into the system message
{
  const msgs = buildMessages([], 'BE WITTY');
  const sys = msgs.find(m => m.role === 'system');
  assert.ok(sys, 'has a system message');
  assert.ok(sys.content.includes('BE WITTY'), 'customPrompt is in system message');
  assert.ok(sys.content.includes('clusters'), 'JSON schema instruction is in system message');
}

// Empty/missing customPrompt still produces valid system message
{
  const msgs = buildMessages([{id: 1, title: 'T', url: 'https://t.com'}], '');
  const sys = msgs.find(m => m.role === 'system');
  assert.ok(sys.content.includes('clusters'));
}

// Returns array with system + user roles, in that order
{
  const msgs = buildMessages([], 'p');
  assert.strictEqual(msgs.length, 2);
  assert.strictEqual(msgs[0].role, 'system');
  assert.strictEqual(msgs[1].role, 'user');
}

console.log('prompt.test.js passed');
```

- [ ] **Step 2: Run it (expect FAIL)**

Run: `node lib/llm/prompt.test.js`

Expected: `Cannot find module './prompt.js'`.

- [ ] **Step 3: Write the implementation**

Create `lib/llm/prompt.js`:

```js
const ALLOWED_TAB_FIELDS = ['id', 'title', 'url'];

const SYSTEM_SUFFIX = `

Output strict JSON with this exact shape and nothing else:
{
  "clusters": [
    {
      "name": "string (witty cluster name, max 4 words)",
      "emoji": "string (single emoji)",
      "tabIds": [number],
      "vibe": "string (one short sentence)",
      "confidence": "number between 0 and 1"
    }
  ]
}

Every tabId in the input MUST appear in exactly one cluster.`;

export function buildMessages(tabs, customPrompt) {
  const sanitized = (tabs || []).map(t => {
    const o = {};
    for (const k of ALLOWED_TAB_FIELDS) if (k in t) o[k] = t[k];
    return o;
  });
  return [
    { role: 'system', content: (customPrompt || '') + SYSTEM_SUFFIX },
    { role: 'user', content: `Cluster these tabs:\n${JSON.stringify(sanitized)}` }
  ];
}
```

- [ ] **Step 4: Run (expect PASS)**

Run: `node lib/llm/prompt.test.js`

Expected: `prompt.test.js passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/llm/prompt.js lib/llm/prompt.test.js
git commit -m "feat: add LLM message builder with field whitelist"
```

### Task 2.5: Create `lib/llm/parse.js` + test

**Files:**
- Create: `lib/llm/parse.js`
- Create: `lib/llm/parse.test.js`

- [ ] **Step 1: Write the test**

Create `lib/llm/parse.test.js`:

```js
import assert from 'node:assert';
import { parseClusters } from './parse.js';
import { ClusterParseError } from './errors.js';

// Bare JSON with clusters array
{
  const out = parseClusters('{"clusters":[{"name":"X","emoji":"📦","tabIds":[1],"vibe":"v","confidence":0.9}]}');
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].name, 'X');
}

// Strips ```json fences
{
  const wrapped = '```json\n{"clusters":[{"name":"Y","emoji":"🧪","tabIds":[2],"vibe":"v","confidence":0.5}]}\n```';
  const out = parseClusters(wrapped);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].name, 'Y');
}

// Strips bare ``` fences
{
  const wrapped = '```\n{"clusters":[{"name":"Z","emoji":"🧪","tabIds":[3],"vibe":"v","confidence":0.5}]}\n```';
  const out = parseClusters(wrapped);
  assert.strictEqual(out[0].name, 'Z');
}

// Tolerates leading/trailing chatter — extracts first { to last }
{
  const noisy = 'Sure! Here you go:\n{"clusters":[{"name":"N","emoji":"🪐","tabIds":[4],"vibe":"v","confidence":1}]}\nLet me know if you need anything else.';
  const out = parseClusters(noisy);
  assert.strictEqual(out[0].name, 'N');
}

// Throws on empty
assert.throws(() => parseClusters(''), ClusterParseError);
assert.throws(() => parseClusters(null), ClusterParseError);

// Throws on non-JSON
assert.throws(() => parseClusters('no braces here'), ClusterParseError);

// Throws when JSON has no clusters key
assert.throws(() => parseClusters('{"foo":"bar"}'), ClusterParseError);

// Throws when clusters is not an array
assert.throws(() => parseClusters('{"clusters": "not an array"}'), ClusterParseError);

// Throws on malformed JSON
assert.throws(() => parseClusters('{"clusters":[{,]}'), ClusterParseError);

console.log('parse.test.js passed');
```

- [ ] **Step 2: Run (expect FAIL — module missing)**

Run: `node lib/llm/parse.test.js`

Expected: `Cannot find module './parse.js'`.

- [ ] **Step 3: Write the implementation**

Create `lib/llm/parse.js`:

```js
import { ClusterParseError } from './errors.js';

export function parseClusters(text) {
  if (!text || typeof text !== 'string') {
    throw new ClusterParseError('Empty or non-string response', text);
  }
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new ClusterParseError('No JSON object found', text);
  }
  const jsonStr = cleaned.slice(firstBrace, lastBrace + 1);
  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new ClusterParseError(`JSON parse failed: ${e.message}`, text);
  }
  if (!parsed.clusters || !Array.isArray(parsed.clusters)) {
    throw new ClusterParseError('Response missing clusters array', text);
  }
  return parsed.clusters;
}
```

- [ ] **Step 4: Run (expect PASS)**

Run: `node lib/llm/parse.test.js`

Expected: `parse.test.js passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/llm/parse.js lib/llm/parse.test.js
git commit -m "feat: add robust JSON cluster parser"
```

### Task 2.6: Create `lib/llm/models.js`

**Files:**
- Create: `lib/llm/models.js`

No test for this file — it's a static data export. Validation happens at the consumer layer (options page renders the dropdowns from this).

- [ ] **Step 1: Discover Puter's xAI model IDs**

Run a quick interactive check to discover the current cheapest Grok ID Puter exposes. The implementer opens an empty HTML page in a browser tab with `<script src="https://js.puter.com/v2/"></script>` (or uses an existing app), signs in to Puter, and runs in the console:

```js
const models = await puter.ai.listModels('xai');
console.log(JSON.stringify(models, null, 2));
```

From the output, pick the cheapest Grok model (lowest `cost.input + cost.output`, typically the `*-mini` variant). Record its `id`.

If you cannot do this interactive check now, use `x-ai/grok-3-mini` as the placeholder default and add a comment marking it as needs-verification. The smoke test in `docs/maintenance/puter-sdk-updates.md` will catch a wrong ID.

- [ ] **Step 2: Write the file**

Create `lib/llm/models.js`. Replace the placeholder Puter default ID with the value discovered in Step 1 (or keep `x-ai/grok-3-mini` if you couldn't verify):

```js
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
```

- [ ] **Step 3: Sanity-load it**

Run:

```bash
node --input-type=module -e "import('./lib/llm/models.js').then(m => console.log(Object.keys(m.MODELS)))"
```

Expected output: `[ 'puter', 'xai', 'openai', 'anthropic', 'google' ]`.

- [ ] **Step 4: Commit**

```bash
git add lib/llm/models.js
git commit -m "feat: add curated model lists with cheap-fast defaults"
```

### Task 2.7: Create `lib/llm/byok/xai.js` + test

**Files:**
- Create: `lib/llm/byok/xai.js`
- Create: `lib/llm/byok/xai.test.js`

- [ ] **Step 1: Write the test**

Create `lib/llm/byok/xai.test.js`:

```js
import assert from 'node:assert';
import { xaiCluster } from './xai.js';
import { LlmError } from '../errors.js';

const CLUSTERS_RESPONSE = JSON.stringify({
  clusters: [{ name: 'X', emoji: '🧪', tabIds: [1], vibe: 'v', confidence: 0.9 }]
});

function mockFetch(responseInit) {
  return async (url, opts) => {
    mockFetch.calls.push({ url, opts });
    return responseInit;
  };
}
mockFetch.calls = [];

// Happy path: builds correct request and parses response
{
  mockFetch.calls = [];
  globalThis.fetch = mockFetch({
    ok: true, status: 200,
    json: async () => ({ choices: [{ message: { content: CLUSTERS_RESPONSE } }] })
  });
  const tabs = [{ id: 1, title: 'A', url: 'https://a.com' }];
  const out = await xaiCluster(tabs, 'sk-test-key', 'grok-3-mini', 'be funny');
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].name, 'X');

  const call = mockFetch.calls[0];
  assert.strictEqual(call.url, 'https://api.x.ai/v1/chat/completions');
  assert.strictEqual(call.opts.method, 'POST');
  assert.strictEqual(call.opts.headers['Authorization'], 'Bearer sk-test-key');
  const body = JSON.parse(call.opts.body);
  assert.strictEqual(body.model, 'grok-3-mini');
  assert.strictEqual(body.response_format.type, 'json_object');
}

// 401 -> LlmError{kind:'auth'}
{
  globalThis.fetch = mockFetch({ ok: false, status: 401, json: async () => ({}) });
  await assert.rejects(
    () => xaiCluster([], 'bad', 'grok-3-mini', ''),
    err => err instanceof LlmError && err.kind === 'auth'
  );
}

// 429 -> LlmError{kind:'rate_limit'}
{
  globalThis.fetch = mockFetch({ ok: false, status: 429, json: async () => ({}) });
  await assert.rejects(
    () => xaiCluster([], 'k', 'grok-3-mini', ''),
    err => err instanceof LlmError && err.kind === 'rate_limit'
  );
}

// fetch throws -> LlmError{kind:'network'}
{
  globalThis.fetch = async () => { throw new Error('ENETDOWN'); };
  await assert.rejects(
    () => xaiCluster([], 'k', 'grok-3-mini', ''),
    err => err instanceof LlmError && err.kind === 'network'
  );
}

console.log('byok/xai.test.js passed');
```

- [ ] **Step 2: Run (expect FAIL)**

Run: `node lib/llm/byok/xai.test.js`

Expected: `Cannot find module './xai.js'`.

- [ ] **Step 3: Write the implementation**

Create `lib/llm/byok/xai.js`:

```js
import { buildMessages } from '../prompt.js';
import { parseClusters } from '../parse.js';
import { LlmError } from '../errors.js';

export async function xaiCluster(tabs, apiKey, model, customPrompt) {
  const messages = buildMessages(tabs, customPrompt);
  let res;
  try {
    res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: 'json_object' }
      })
    });
  } catch (e) {
    throw new LlmError('network', e.message, e);
  }
  if (res.status === 401 || res.status === 403) {
    throw new LlmError('auth', 'xAI rejected the API key', null);
  }
  if (res.status === 429) {
    throw new LlmError('rate_limit', 'xAI rate limit hit', null);
  }
  if (!res.ok) {
    throw new LlmError('unknown', `xAI returned ${res.status}`, null);
  }
  const data = await res.json();
  return parseClusters(data.choices?.[0]?.message?.content ?? '');
}
```

- [ ] **Step 4: Run (expect PASS)**

Run: `node lib/llm/byok/xai.test.js`

Expected: `byok/xai.test.js passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/llm/byok/xai.js lib/llm/byok/xai.test.js
git commit -m "feat: add xAI BYOK adapter"
```

### Task 2.8: Create `lib/llm/byok/openai.js` + test

**Files:**
- Create: `lib/llm/byok/openai.js`
- Create: `lib/llm/byok/openai.test.js`

- [ ] **Step 1: Write the test**

Create `lib/llm/byok/openai.test.js`:

```js
import assert from 'node:assert';
import { openaiCluster } from './openai.js';
import { LlmError } from '../errors.js';

const CLUSTERS_RESPONSE = JSON.stringify({
  clusters: [{ name: 'X', emoji: '🧪', tabIds: [1], vibe: 'v', confidence: 0.9 }]
});

function mockFetch(responseInit) {
  return async (url, opts) => {
    mockFetch.calls.push({ url, opts });
    return responseInit;
  };
}
mockFetch.calls = [];

// Happy path
{
  mockFetch.calls = [];
  globalThis.fetch = mockFetch({
    ok: true, status: 200,
    json: async () => ({ choices: [{ message: { content: CLUSTERS_RESPONSE } }] })
  });
  const out = await openaiCluster([{id:1,title:'A',url:'https://a.com'}], 'sk-test', 'gpt-4o-mini', '');
  assert.strictEqual(out[0].name, 'X');
  const call = mockFetch.calls[0];
  assert.strictEqual(call.url, 'https://api.openai.com/v1/chat/completions');
  assert.strictEqual(call.opts.headers['Authorization'], 'Bearer sk-test');
  const body = JSON.parse(call.opts.body);
  assert.strictEqual(body.model, 'gpt-4o-mini');
  assert.strictEqual(body.response_format.type, 'json_object');
}

// 401 -> auth
{
  globalThis.fetch = mockFetch({ ok: false, status: 401, json: async () => ({}) });
  await assert.rejects(
    () => openaiCluster([], 'bad', 'gpt-4o-mini', ''),
    err => err instanceof LlmError && err.kind === 'auth'
  );
}

// 429 -> rate_limit
{
  globalThis.fetch = mockFetch({ ok: false, status: 429, json: async () => ({}) });
  await assert.rejects(
    () => openaiCluster([], 'k', 'gpt-4o-mini', ''),
    err => err instanceof LlmError && err.kind === 'rate_limit'
  );
}

// fetch throws -> network
{
  globalThis.fetch = async () => { throw new Error('boom'); };
  await assert.rejects(
    () => openaiCluster([], 'k', 'gpt-4o-mini', ''),
    err => err instanceof LlmError && err.kind === 'network'
  );
}

console.log('byok/openai.test.js passed');
```

- [ ] **Step 2: Run (expect FAIL)**

Run: `node lib/llm/byok/openai.test.js`

Expected: module not found.

- [ ] **Step 3: Write the implementation**

Create `lib/llm/byok/openai.js`:

```js
import { buildMessages } from '../prompt.js';
import { parseClusters } from '../parse.js';
import { LlmError } from '../errors.js';

export async function openaiCluster(tabs, apiKey, model, customPrompt) {
  const messages = buildMessages(tabs, customPrompt);
  let res;
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: 'json_object' }
      })
    });
  } catch (e) {
    throw new LlmError('network', e.message, e);
  }
  if (res.status === 401 || res.status === 403) throw new LlmError('auth', 'OpenAI rejected the API key', null);
  if (res.status === 429) throw new LlmError('rate_limit', 'OpenAI rate limit hit', null);
  if (!res.ok) throw new LlmError('unknown', `OpenAI returned ${res.status}`, null);
  const data = await res.json();
  return parseClusters(data.choices?.[0]?.message?.content ?? '');
}
```

- [ ] **Step 4: Run (expect PASS)**

Run: `node lib/llm/byok/openai.test.js`

- [ ] **Step 5: Commit**

```bash
git add lib/llm/byok/openai.js lib/llm/byok/openai.test.js
git commit -m "feat: add OpenAI BYOK adapter"
```

### Task 2.9: Create `lib/llm/byok/anthropic.js` + test

**Files:**
- Create: `lib/llm/byok/anthropic.js`
- Create: `lib/llm/byok/anthropic.test.js`

- [ ] **Step 1: Write the test**

Create `lib/llm/byok/anthropic.test.js`:

```js
import assert from 'node:assert';
import { anthropicCluster } from './anthropic.js';
import { LlmError } from '../errors.js';

const CLUSTERS_JSON = JSON.stringify({
  clusters: [{ name: 'X', emoji: '🧪', tabIds: [1], vibe: 'v', confidence: 0.9 }]
});

function mockFetch(responseInit) {
  return async (url, opts) => {
    mockFetch.calls.push({ url, opts });
    return responseInit;
  };
}
mockFetch.calls = [];

// Happy path: separates system from messages, sets required headers
{
  mockFetch.calls = [];
  globalThis.fetch = mockFetch({
    ok: true, status: 200,
    json: async () => ({ content: [{ type: 'text', text: CLUSTERS_JSON }] })
  });
  const out = await anthropicCluster(
    [{id:1,title:'A',url:'https://a.com'}],
    'sk-ant-test', 'claude-haiku-4-5-20251001', 'be witty'
  );
  assert.strictEqual(out[0].name, 'X');
  const call = mockFetch.calls[0];
  assert.strictEqual(call.url, 'https://api.anthropic.com/v1/messages');
  assert.strictEqual(call.opts.headers['x-api-key'], 'sk-ant-test');
  assert.strictEqual(call.opts.headers['anthropic-version'], '2023-06-01');
  assert.strictEqual(call.opts.headers['anthropic-dangerous-direct-browser-access'], 'true');
  const body = JSON.parse(call.opts.body);
  assert.strictEqual(body.model, 'claude-haiku-4-5-20251001');
  assert.ok(body.system.includes('be witty'), 'system goes in dedicated field');
  assert.ok(Array.isArray(body.messages));
  assert.strictEqual(body.messages.find(m => m.role === 'system'), undefined,
    'no system role in messages array');
  assert.ok(typeof body.max_tokens === 'number');
}

// 401 -> auth
{
  globalThis.fetch = mockFetch({ ok: false, status: 401, json: async () => ({}) });
  await assert.rejects(
    () => anthropicCluster([], 'bad', 'claude-haiku-4-5-20251001', ''),
    err => err instanceof LlmError && err.kind === 'auth'
  );
}

// 429 -> rate_limit
{
  globalThis.fetch = mockFetch({ ok: false, status: 429, json: async () => ({}) });
  await assert.rejects(
    () => anthropicCluster([], 'k', 'claude-haiku-4-5-20251001', ''),
    err => err instanceof LlmError && err.kind === 'rate_limit'
  );
}

// fetch throws -> network
{
  globalThis.fetch = async () => { throw new Error('boom'); };
  await assert.rejects(
    () => anthropicCluster([], 'k', 'claude-haiku-4-5-20251001', ''),
    err => err instanceof LlmError && err.kind === 'network'
  );
}

console.log('byok/anthropic.test.js passed');
```

- [ ] **Step 2: Run (expect FAIL)**

Run: `node lib/llm/byok/anthropic.test.js`

- [ ] **Step 3: Write the implementation**

Create `lib/llm/byok/anthropic.js`:

```js
import { buildMessages } from '../prompt.js';
import { parseClusters } from '../parse.js';
import { LlmError } from '../errors.js';

export async function anthropicCluster(tabs, apiKey, model, customPrompt) {
  const allMessages = buildMessages(tabs, customPrompt);
  // Anthropic separates `system` from `messages`
  const systemMsg = allMessages.find(m => m.role === 'system')?.content || '';
  const userMessages = allMessages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role, content: m.content }));

  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        // Required for direct-from-browser calls (per Anthropic docs).
        'anthropic-dangerous-direct-browser-access': 'true',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemMsg,
        messages: userMessages
      })
    });
  } catch (e) {
    throw new LlmError('network', e.message, e);
  }
  if (res.status === 401 || res.status === 403) throw new LlmError('auth', 'Anthropic rejected the API key', null);
  if (res.status === 429) throw new LlmError('rate_limit', 'Anthropic rate limit hit', null);
  if (!res.ok) throw new LlmError('unknown', `Anthropic returned ${res.status}`, null);
  const data = await res.json();
  // Anthropic returns content as an array of typed blocks
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  return parseClusters(text);
}
```

- [ ] **Step 4: Run (expect PASS)**

Run: `node lib/llm/byok/anthropic.test.js`

- [ ] **Step 5: Commit**

```bash
git add lib/llm/byok/anthropic.js lib/llm/byok/anthropic.test.js
git commit -m "feat: add Anthropic BYOK adapter (with browser-access header)"
```

### Task 2.10: Create `lib/llm/byok/google.js` + test

**Files:**
- Create: `lib/llm/byok/google.js`
- Create: `lib/llm/byok/google.test.js`

- [ ] **Step 1: Write the test**

Create `lib/llm/byok/google.test.js`:

```js
import assert from 'node:assert';
import { googleCluster } from './google.js';
import { LlmError } from '../errors.js';

const CLUSTERS_JSON = JSON.stringify({
  clusters: [{ name: 'X', emoji: '🧪', tabIds: [1], vibe: 'v', confidence: 0.9 }]
});

function mockFetch(responseInit) {
  return async (url, opts) => {
    mockFetch.calls.push({ url, opts });
    return responseInit;
  };
}
mockFetch.calls = [];

// Happy path: API key in URL, system instruction separate, JSON mime hint set
{
  mockFetch.calls = [];
  globalThis.fetch = mockFetch({
    ok: true, status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text: CLUSTERS_JSON }] } }] })
  });
  const out = await googleCluster(
    [{id:1,title:'A',url:'https://a.com'}],
    'AIzaTEST', 'gemini-2.5-flash', 'be witty'
  );
  assert.strictEqual(out[0].name, 'X');
  const call = mockFetch.calls[0];
  assert.ok(call.url.startsWith('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'));
  assert.ok(call.url.includes('key=AIzaTEST'));
  const body = JSON.parse(call.opts.body);
  assert.ok(body.systemInstruction.parts[0].text.includes('be witty'));
  assert.strictEqual(body.generationConfig.responseMimeType, 'application/json');
  assert.strictEqual(body.contents[0].role, 'user');
}

// 401/403 -> auth
{
  globalThis.fetch = mockFetch({ ok: false, status: 403, json: async () => ({}) });
  await assert.rejects(
    () => googleCluster([], 'bad', 'gemini-2.5-flash', ''),
    err => err instanceof LlmError && err.kind === 'auth'
  );
}

// 429 -> rate_limit
{
  globalThis.fetch = mockFetch({ ok: false, status: 429, json: async () => ({}) });
  await assert.rejects(
    () => googleCluster([], 'k', 'gemini-2.5-flash', ''),
    err => err instanceof LlmError && err.kind === 'rate_limit'
  );
}

// fetch throws -> network
{
  globalThis.fetch = async () => { throw new Error('boom'); };
  await assert.rejects(
    () => googleCluster([], 'k', 'gemini-2.5-flash', ''),
    err => err instanceof LlmError && err.kind === 'network'
  );
}

console.log('byok/google.test.js passed');
```

- [ ] **Step 2: Run (expect FAIL)**

Run: `node lib/llm/byok/google.test.js`

- [ ] **Step 3: Write the implementation**

Create `lib/llm/byok/google.js`:

```js
import { buildMessages } from '../prompt.js';
import { parseClusters } from '../parse.js';
import { LlmError } from '../errors.js';

export async function googleCluster(tabs, apiKey, model, customPrompt) {
  const allMessages = buildMessages(tabs, customPrompt);
  const systemMsg = allMessages.find(m => m.role === 'system')?.content || '';
  const userText = allMessages.filter(m => m.role === 'user').map(m => m.content).join('\n');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemMsg }] },
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });
  } catch (e) {
    throw new LlmError('network', e.message, e);
  }
  if (res.status === 401 || res.status === 403) throw new LlmError('auth', 'Google rejected the API key', null);
  if (res.status === 429) throw new LlmError('rate_limit', 'Google rate limit hit', null);
  if (!res.ok) throw new LlmError('unknown', `Google returned ${res.status}`, null);
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text).join('\n');
  return parseClusters(text);
}
```

- [ ] **Step 4: Run (expect PASS)**

Run: `node lib/llm/byok/google.test.js`

- [ ] **Step 5: Commit**

```bash
git add lib/llm/byok/google.js lib/llm/byok/google.test.js
git commit -m "feat: add Google Gemini BYOK adapter"
```

### Task 2.11: Create `lib/llm/byok-provider.js` + test

**Files:**
- Create: `lib/llm/byok-provider.js`
- Create: `lib/llm/byok-provider.test.js`

- [ ] **Step 1: Write the test**

Create `lib/llm/byok-provider.test.js`:

```js
import assert from 'node:assert';
import { byokCluster } from './byok-provider.js';
import { ApiKeyMissingError } from './errors.js';

// Stub the underlying fetches; we only assert routing here.
let lastUrl = null;
globalThis.fetch = async (url, opts) => {
  lastUrl = url;
  return {
    ok: true, status: 200,
    json: async () => {
      // Return a shape that satisfies whichever adapter is hit.
      // OpenAI/xAI shape:
      if (url.includes('openai.com') || url.includes('x.ai')) {
        return { choices: [{ message: { content: '{"clusters":[{"name":"R","emoji":"🧪","tabIds":[1],"vibe":"v","confidence":1}]}' } }] };
      }
      // Anthropic shape:
      if (url.includes('anthropic.com')) {
        return { content: [{ type: 'text', text: '{"clusters":[{"name":"R","emoji":"🧪","tabIds":[1],"vibe":"v","confidence":1}]}' }] };
      }
      // Google shape:
      return { candidates: [{ content: { parts: [{ text: '{"clusters":[{"name":"R","emoji":"🧪","tabIds":[1],"vibe":"v","confidence":1}]}' }] } }] };
    }
  };
};

const baseTabs = [{id:1, title:'a', url:'https://a.com'}];
const settings = (provider) => ({
  byokProvider: provider,
  byokModels: { xai:'grok-3-mini', openai:'gpt-4o-mini', anthropic:'claude-haiku-4-5-20251001', google:'gemini-2.5-flash' },
  apiKeys: { xai:'x', openai:'o', anthropic:'a', google:'g' },
  customPrompt: ''
});

// Routes to xAI
{
  await byokCluster(baseTabs, settings('xai'));
  assert.ok(lastUrl.includes('api.x.ai'));
}
// Routes to OpenAI
{
  await byokCluster(baseTabs, settings('openai'));
  assert.ok(lastUrl.includes('api.openai.com'));
}
// Routes to Anthropic
{
  await byokCluster(baseTabs, settings('anthropic'));
  assert.ok(lastUrl.includes('api.anthropic.com'));
}
// Routes to Google
{
  await byokCluster(baseTabs, settings('google'));
  assert.ok(lastUrl.includes('generativelanguage.googleapis.com'));
}

// Missing key -> ApiKeyMissingError
{
  const s = settings('xai');
  s.apiKeys = {};
  await assert.rejects(
    () => byokCluster(baseTabs, s),
    err => err instanceof ApiKeyMissingError && err.provider === 'xai'
  );
}

// Unknown provider -> generic Error
{
  const s = settings('xai');
  s.byokProvider = 'unknown_thing';
  s.apiKeys = { unknown_thing: 'k' };
  await assert.rejects(() => byokCluster(baseTabs, s), /Unknown BYOK provider/);
}

console.log('byok-provider.test.js passed');
```

- [ ] **Step 2: Run (expect FAIL)**

Run: `node lib/llm/byok-provider.test.js`

- [ ] **Step 3: Write the implementation**

Create `lib/llm/byok-provider.js`:

```js
import { ApiKeyMissingError } from './errors.js';
import { xaiCluster } from './byok/xai.js';
import { openaiCluster } from './byok/openai.js';
import { anthropicCluster } from './byok/anthropic.js';
import { googleCluster } from './byok/google.js';

const PROVIDERS = {
  xai: xaiCluster,
  openai: openaiCluster,
  anthropic: anthropicCluster,
  google: googleCluster
};

export async function byokCluster(tabs, settings) {
  const { byokProvider, byokModels, apiKeys } = settings;
  const key = apiKeys?.[byokProvider];
  if (!key) throw new ApiKeyMissingError(byokProvider);
  const fn = PROVIDERS[byokProvider];
  if (!fn) throw new Error(`Unknown BYOK provider: ${byokProvider}`);
  return fn(tabs, key, byokModels[byokProvider], settings.customPrompt);
}
```

- [ ] **Step 4: Run (expect PASS)**

Run: `node lib/llm/byok-provider.test.js`

- [ ] **Step 5: Commit**

```bash
git add lib/llm/byok-provider.js lib/llm/byok-provider.test.js
git commit -m "feat: add BYOK dispatcher"
```

### Task 2.12: Create `lib/llm/puter-provider.js` + test

**Files:**
- Create: `lib/llm/puter-provider.js`
- Create: `lib/llm/puter-provider.test.js`

- [ ] **Step 1: Write the test**

Create `lib/llm/puter-provider.test.js`:

```js
import assert from 'node:assert';
import { puterCluster, PUTER_DASHBOARD_URL } from './puter-provider.js';
import { PuterNotSignedIn, PuterOutOfCredits } from './errors.js';

// Build a fake window.puter for each scenario.
function setupPuter({ signedIn, chatImpl }) {
  globalThis.window = {
    puter: {
      auth: { isSignedIn: async () => signedIn },
      ai: { chat: chatImpl }
    }
  };
}

// Dashboard URL is exported and stable
assert.strictEqual(PUTER_DASHBOARD_URL, 'https://puter.com/dashboard');

// Not signed in -> PuterNotSignedIn
{
  setupPuter({ signedIn: false, chatImpl: async () => { throw new Error('should not be called'); } });
  await assert.rejects(
    () => puterCluster([], { puterModel: 'x-ai/grok-3-mini', customPrompt: '' }),
    err => err instanceof PuterNotSignedIn
  );
}

// usage-limited-chat delegate -> PuterOutOfCredits
{
  setupPuter({
    signedIn: true,
    chatImpl: async () => {
      const e = new Error('Permission denied');
      e.delegate = 'usage-limited-chat';
      e.code = 'error_400_from_delegate';
      throw e;
    }
  });
  await assert.rejects(
    () => puterCluster([], { puterModel: 'x-ai/grok-3-mini', customPrompt: '' }),
    err => err instanceof PuterOutOfCredits
  );
}

// error_400_from_delegate alone (no delegate field) also wrapped
{
  setupPuter({
    signedIn: true,
    chatImpl: async () => {
      const e = new Error('something');
      e.code = 'error_400_from_delegate';
      throw e;
    }
  });
  await assert.rejects(
    () => puterCluster([], { puterModel: 'x', customPrompt: '' }),
    err => err instanceof PuterOutOfCredits
  );
}

// Other errors pass through unchanged
{
  setupPuter({
    signedIn: true,
    chatImpl: async () => { throw new Error('weird crash'); }
  });
  await assert.rejects(
    () => puterCluster([], { puterModel: 'x', customPrompt: '' }),
    err => err.message === 'weird crash' && !(err instanceof PuterOutOfCredits)
  );
}

// Happy path: model arg is always passed; stream is never true; result parses
{
  let receivedOptions = null;
  let receivedTestMode = null;
  setupPuter({
    signedIn: true,
    chatImpl: async (messages, testMode, options) => {
      receivedOptions = options;
      receivedTestMode = testMode;
      return { message: { content: '{"clusters":[{"name":"X","emoji":"🧪","tabIds":[1],"vibe":"v","confidence":0.9}]}' } };
    }
  });
  const out = await puterCluster(
    [{id:1,title:'A',url:'https://a.com'}],
    { puterModel: 'x-ai/grok-3-mini', customPrompt: 'p' }
  );
  assert.strictEqual(out[0].name, 'X');
  assert.strictEqual(receivedTestMode, false, 'real call uses testMode=false');
  assert.strictEqual(receivedOptions.model, 'x-ai/grok-3-mini',
    'model must always be explicit (Puter default is gpt-5-nano)');
  assert.notStrictEqual(receivedOptions.stream, true,
    'stream must not be true — Puter issue #2410 hangs on errors');
}

// SDK missing -> generic Error
{
  globalThis.window = {};
  await assert.rejects(
    () => puterCluster([], { puterModel: 'x', customPrompt: '' }),
    /Puter SDK not loaded/
  );
}

console.log('puter-provider.test.js passed');
```

- [ ] **Step 2: Run (expect FAIL)**

Run: `node lib/llm/puter-provider.test.js`

- [ ] **Step 3: Write the implementation**

Create `lib/llm/puter-provider.js`:

```js
import { buildMessages } from './prompt.js';
import { parseClusters } from './parse.js';
import { PuterNotSignedIn, PuterOutOfCredits } from './errors.js';

export const PUTER_DASHBOARD_URL = 'https://puter.com/dashboard';

export async function puterCluster(tabs, settings) {
  if (typeof window === 'undefined' || !window.puter) {
    throw new Error('Puter SDK not loaded');
  }
  const isSignedIn = await window.puter.auth.isSignedIn();
  if (!isSignedIn) {
    // Do NOT call puter.auth.signIn() here. By the time this runs we're mid-async
    // after the click that triggered clustering, so the user-gesture context is
    // gone and the popup will be blocked. Sign-in only happens in the options
    // page, where it's bound to a direct click handler.
    throw new PuterNotSignedIn();
  }
  const messages = buildMessages(tabs, settings.customPrompt);
  try {
    const res = await window.puter.ai.chat(messages, false, {
      // Puter's default model is gpt-5-nano; we always pass our chosen model explicitly.
      model: settings.puterModel,
      response_format: { type: 'json_object' }
      // Do NOT set stream: true — Puter issue #2410 makes streaming hang on errors.
    });
    const content = res?.message?.content ?? res?.content ?? '';
    return parseClusters(typeof content === 'string' ? content : JSON.stringify(content));
  } catch (err) {
    if (err?.delegate === 'usage-limited-chat' || err?.code === 'error_400_from_delegate') {
      throw new PuterOutOfCredits(err);
    }
    throw err;
  }
}
```

- [ ] **Step 4: Run (expect PASS)**

Run: `node lib/llm/puter-provider.test.js`

- [ ] **Step 5: Commit**

```bash
git add lib/llm/puter-provider.js lib/llm/puter-provider.test.js
git commit -m "feat: add Puter provider with credit-error wrap"
```

### Task 2.13: Create `lib/llm/index.js` (top-level entry) + test

**Files:**
- Create: `lib/llm/index.js`
- Create: `lib/llm/index.test.js`

- [ ] **Step 1: Write the test**

Create `lib/llm/index.test.js`:

```js
import assert from 'node:assert';
import { clusterTabs } from './index.js';
import { ApiKeyMissingError, PuterNotSignedIn } from './errors.js';

// Routes provider='puter' -> puterCluster
{
  globalThis.window = {
    puter: {
      auth: { isSignedIn: async () => true },
      ai: { chat: async () => ({ message: { content: '{"clusters":[{"name":"P","emoji":"🪐","tabIds":[1],"vibe":"v","confidence":1}]}' } }) }
    }
  };
  const out = await clusterTabs(
    [{id:1,title:'A',url:'https://a.com'}],
    { provider: 'puter', puterModel: 'x-ai/grok-3-mini', customPrompt: '' }
  );
  assert.strictEqual(out[0].name, 'P');
}

// Routes provider='puter' when not signed in -> PuterNotSignedIn
{
  globalThis.window = {
    puter: { auth: { isSignedIn: async () => false }, ai: { chat: async () => ({}) } }
  };
  await assert.rejects(
    () => clusterTabs([], { provider: 'puter', puterModel: 'x', customPrompt: '' }),
    err => err instanceof PuterNotSignedIn
  );
}

// Routes provider='byok' with no key -> ApiKeyMissingError
{
  await assert.rejects(
    () => clusterTabs([], {
      provider: 'byok',
      byokProvider: 'openai',
      byokModels: { openai: 'gpt-4o-mini' },
      apiKeys: {},
      customPrompt: ''
    }),
    err => err instanceof ApiKeyMissingError && err.provider === 'openai'
  );
}

console.log('index.test.js passed');
```

- [ ] **Step 2: Run (expect FAIL)**

Run: `node lib/llm/index.test.js`

- [ ] **Step 3: Write the implementation**

Create `lib/llm/index.js`:

```js
import { puterCluster, PUTER_DASHBOARD_URL } from './puter-provider.js';
import { byokCluster } from './byok-provider.js';

export {
  ApiKeyMissingError,
  PuterNotSignedIn,
  PuterOutOfCredits,
  ClusterParseError,
  LlmError
} from './errors.js';
export { MODELS, PROVIDERS, PROVIDER_LABELS } from './models.js';
export { PUTER_DASHBOARD_URL };

export async function clusterTabs(tabs, settings) {
  if (settings.provider === 'puter') return puterCluster(tabs, settings);
  return byokCluster(tabs, settings);
}
```

- [ ] **Step 4: Run (expect PASS)**

Run: `node lib/llm/index.test.js`

- [ ] **Step 5: Commit**

```bash
git add lib/llm/index.js lib/llm/index.test.js
git commit -m "feat: add LLM module entry point"
```

### Task 2.14: Run the full LLM test suite

- [ ] **Step 1: Run every test in lib/llm/**

Run:

```bash
for f in lib/llm/*.test.js lib/llm/byok/*.test.js; do
  echo "--- $f ---"
  node "$f" || exit 1
done
```

Expected: every test prints `<file> passed`. Any failure halts.

### Task 2.15: Write `docs/maintenance/puter-sdk-updates.md`

**Files:**
- Create: `docs/maintenance/puter-sdk-updates.md`

- [ ] **Step 1: Write the doc**

Create `docs/maintenance/puter-sdk-updates.md`:

```markdown
# Puter SDK Update Process

The Puter.js v2 SDK is vendored at `lib/puter.js`. MV3 CSP forbids loading remote scripts, so we ship a pinned copy. This doc describes how to keep it current.

## Cadence

- **Quarterly check** (every 90 days), or
- **On-demand** when Puter announces a v2 patch in their changelog: <https://docs.puter.com/>

## Pinned version

Live values are in `lib/puter.VERSION`. Read that file as the source of truth.

## Update steps

1. Download the latest SDK:
   ```bash
   curl -fsSL https://js.puter.com/v2/ -o lib/puter.js
   ```

2. Update `lib/puter.VERSION` with the new SHA-256, byte count, and date:
   ```bash
   echo "url: https://js.puter.com/v2/"   >  lib/puter.VERSION
   echo "fetched_at: $(date -u +%Y-%m-%d)" >> lib/puter.VERSION
   echo "sha256: $(sha256sum lib/puter.js | cut -d' ' -f1)" >> lib/puter.VERSION
   echo "bytes: $(wc -c < lib/puter.js)"   >> lib/puter.VERSION
   ```

3. Diff for new permissions or hostnames Puter started calling:
   ```bash
   git diff lib/puter.js | head -200
   ```
   Look for new domains (`api.puter.com`, `*.puter.com`, etc). If Puter added an endpoint, update **both** `host_permissions` AND `connect-src` in `manifest.json`.

4. Run the smoke test (next section).

5. Commit:
   ```bash
   git add lib/puter.js lib/puter.VERSION manifest.json
   git commit -m "chore: bump Puter SDK to $(date -u +%Y-%m-%d)"
   ```

## Smoke test checklist

Load the unpacked extension in Chrome (`chrome://extensions` → Developer mode → Load unpacked).

- [ ] **Cold install** — uninstall any existing copy first; install fresh; the options page should auto-open with the welcome / setup gate.
- [ ] **Sign in to Puter** — click the Puter sign-in button; complete OAuth in the popup; confirm `puter.auth.isSignedIn()` returns true (DevTools console on options page).
- [ ] **Cluster ~10 tabs** — open ten varied tabs; click the action; confirm clusters render with names + emojis.
- [ ] **Test connection (Puter)** — go to options → Provider section → click "Test"; confirm ✓ shows AND a `puter.auth.getMonthlyUsage()` call before/after shows zero credit delta (`testMode=true` doesn't bill).
- [ ] **Out-of-credits path** — easiest simulation: in DevTools console on the popup, before clicking the action, monkey-patch:
   ```js
   const orig = window.puter.ai.chat;
   window.puter.ai.chat = async () => {
     const e = new Error('Permission denied'); e.delegate = 'usage-limited-chat'; e.code = 'error_400_from_delegate'; throw e;
   };
   ```
   Then click the action — confirm the popup shows the "out of Puter credits" UI with both "Open Puter Dashboard" and "Open Settings" buttons working. Restore: `window.puter.ai.chat = orig`.
- [ ] **listModels drift check** — in DevTools console:
   ```js
   const ms = await window.puter.ai.listModels('xai');
   console.log(ms.map(m => m.id));
   ```
   Confirm the default Grok model ID in `lib/llm/models.js` (`MODELS.puter.default`) still appears in the returned list. If it's gone, pick the new cheapest Grok and bump `models.js`.
- [ ] **Sign out** — click Puter sign-out in options; confirm the popup goes back to the setup-required state on next open.

## Automation hook

Schedule a recurring agent every 90 days:

```
/schedule weekly-bump
```

The agent fetches `https://js.puter.com/v2/`, computes its SHA-256, compares against `lib/puter.VERSION`, and opens a PR running steps 1–4 above if they differ.
```

- [ ] **Step 2: Commit**

```bash
git add docs/maintenance/puter-sdk-updates.md
git commit -m "docs: add Puter SDK update process"
```

---

## Stream 3 — Manifest, Background Refactor, v2 Migration Doc

**Owner brief:** Removes the `autoqa.teachx.ai` proxy, replaces it with the new action protocol (`getTabsForCluster`, `commitClusters`), updates the manifest's host_permissions and CSP, and adds the v1→v2 migration that flips `setupComplete=false` on update.

**Depends on:** Stream 2 (uses the new module shape conceptually, but background.js does NOT import from `lib/llm/` — it just stops doing the cluster fetch).

### Task 3.1: Update `manifest.json`

**Files:**
- Modify: `manifest.json`

- [ ] **Step 1: Read current manifest**

Open `manifest.json`. Confirm current `host_permissions` is `["https://autoqa.teachx.ai/*"]` and CSP is `"script-src 'self'; object-src 'none'; connect-src 'self' https://autoqa.teachx.ai;"`.

- [ ] **Step 2: Replace host_permissions**

Replace the `host_permissions` line with:

```json
  "host_permissions": [
    "https://api.x.ai/*",
    "https://api.openai.com/*",
    "https://api.anthropic.com/*",
    "https://generativelanguage.googleapis.com/*",
    "https://api.puter.com/*",
    "https://*.puter.com/*"
  ],
```

- [ ] **Step 3: Replace the CSP string**

Replace the `extension_pages` value with:

```
script-src 'self'; object-src 'none'; connect-src 'self' https://api.x.ai https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com https://api.puter.com https://*.puter.com;
```

- [ ] **Step 4: Validate JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8'))"`

Expected: no output (valid JSON).

### Task 3.2: Update `manifest.test.js`

**Files:**
- Modify: `manifest.test.js`

- [ ] **Step 1: Read current test (~50 lines)**

Open `manifest.test.js`. Note its existing assertions.

- [ ] **Step 2: Add new assertions**

After the existing `permissions` checks, add:

```js
// host_permissions includes all four BYOK providers + Puter
const expectedHosts = [
  'https://api.x.ai/*',
  'https://api.openai.com/*',
  'https://api.anthropic.com/*',
  'https://generativelanguage.googleapis.com/*',
  'https://api.puter.com/*',
  'https://*.puter.com/*'
];
for (const h of expectedHosts) {
  if (!manifest.host_permissions || !manifest.host_permissions.includes(h)) {
    errors.push(`host_permissions missing ${h}`);
  }
}

// Legacy proxy host is gone
if (manifest.host_permissions?.some(h => h.includes('autoqa.teachx.ai'))) {
  errors.push('host_permissions still includes legacy autoqa.teachx.ai');
}

// CSP connect-src lists all expected hosts and not the legacy one
const csp = manifest.content_security_policy?.extension_pages || '';
if (csp.includes('autoqa.teachx.ai')) {
  errors.push('CSP still references legacy autoqa.teachx.ai');
}
for (const host of ['api.x.ai', 'api.openai.com', 'api.anthropic.com', 'generativelanguage.googleapis.com', 'api.puter.com']) {
  if (!csp.includes(host)) {
    errors.push(`CSP connect-src missing ${host}`);
  }
}
```

- [ ] **Step 3: Run the test**

Run: `node manifest.test.js`

Expected: prints "manifest validation passed" (or whatever the existing success log is). If it prints errors, fix `manifest.json` until clean.

- [ ] **Step 4: Commit (manifest + test together)**

```bash
git add manifest.json manifest.test.js
git commit -m "feat: replace proxy hostname with BYOK + Puter hosts"

Removes autoqa.teachx.ai from host_permissions and CSP. Adds the four
BYOK provider hosts and Puter. script-src stays at 'self' — Puter SDK
is vendored, no remote scripts.
```

### Task 3.3: Refactor `background.js` — remove proxy, add new action protocol

**Files:**
- Modify: `background.js`

- [ ] **Step 1: Read current background.js**

Open `background.js`. Note `PROXY_URL` constant, `cluster` action handler, `handleClusterRequest` function, `fetchWithRetry`, and the existing `keep`/`nuke`/`save`/`undo`/`getReadingLists`/`deleteReadingList`/`resume`/`resetState` handlers (all of which stay).

- [ ] **Step 2: Delete the `PROXY_URL` constant and `fetchWithRetry`**

At the top, remove:

```js
const PROXY_URL = 'https://autoqa.teachx.ai/hackathon/preview/chapter-11/cluster';
```

And remove the entire `fetchWithRetry` function definition (around lines 104–119).

- [ ] **Step 3: Replace the `cluster` action handler with `getTabsForCluster`**

Find this block in `chrome.runtime.onMessage.addListener`:

```js
  if (message.action === 'cluster') {
    console.log('[background] cluster action received — calling handleClusterRequest');
    handleClusterRequest()
      .then(() => sendResponse({ok: true}))
      .catch(err => { console.error('[background] cluster error:', err); sendResponse({ok: false, error: err.message}); });
    return true;
  }
```

Replace with:

```js
  if (message.action === 'getTabsForCluster') {
    handleGetTabsForCluster()
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ok: false, error: err.message}));
    return true;
  }
  if (message.action === 'commitClusters') {
    handleCommitClusters(message.clusters, message.sig)
      .then(() => sendResponse({ok: true}))
      .catch(err => sendResponse({ok: false, error: err.message}));
    return true;
  }
```

- [ ] **Step 4: Delete `handleClusterRequest` and replace with two new handlers**

Delete the entire `handleClusterRequest` function (lines ~121–200).

Add these two new handlers in its place (above `markProcessed`):

```js
async function handleGetTabsForCluster() {
  const allTabs = await chrome.tabs.query({});
  const selfUrl = chrome.runtime.getURL('');
  let filtered = allTabs.filter(t =>
    t.id && typeof t.id === 'number' &&
    !t.pinned &&
    !t.url.startsWith('chrome://') &&
    !t.url.startsWith('about:') &&
    !(t.url && t.url.startsWith(selfUrl))
  );

  const { [PROCESSED_KEY]: processed = [] } = await chrome.storage.session.get(PROCESSED_KEY);
  const processedSet = new Set(processed);
  filtered = filtered.filter(t => !processedSet.has(t.id));

  const currentIds = filtered.map(t => t.id);
  const currentSig = tabSignature(currentIds);

  const { [LAST_TABS_KEY]: lastSig } = await chrome.storage.session.get(LAST_TABS_KEY);
  const cached = await chrome.storage.session.get(SESSION_KEY);
  const hasCachedClusters = cached[SESSION_KEY]?.type === 'clusters' && (cached[SESSION_KEY]?.clusters?.length ?? 0) > 0;

  if (currentSig === lastSig && hasCachedClusters) {
    return { ok: true, cached: true, payload: cached[SESSION_KEY] };
  }

  // Whitelist tab fields the LLM should see (used to be Pydantic-driven; now LLM-driven).
  const allowed = ['id', 'title', 'url'];
  const sanitized = filtered.map(t => {
    const o = {};
    for (const k of allowed) if (k in t) o[k] = t[k];
    return o;
  });

  return { ok: true, cached: false, tabs: sanitized, sig: currentSig };
}

async function handleCommitClusters(clusters, sig) {
  if (!Array.isArray(clusters)) throw new Error('clusters must be an array');
  const payload = { type: 'clusters', clusters };
  await chrome.storage.session.set({ [SESSION_KEY]: payload, [LAST_TABS_KEY]: sig });
  // Tab grouping is best-effort; never fail the commit on a grouping error.
  createTabGroups(clusters).catch(err => console.warn('[background] tab grouping failed:', err));
}
```

- [ ] **Step 5: Add v1→v2 migration to `onInstalled`**

The `onInstalled` listener doesn't currently exist in `background.js` — it ends with the `onClicked` listener. Add this block immediately before `if (typeof module !== 'undefined') module.exports = ...`:

```js
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html?welcome=1') });
  }
  // REMOVE-IN-V3: v1->v2 forced re-setup. v1 had no provider/key/Puter config,
  // so existing setupComplete (if any) is meaningless. Treating users as fresh
  // install is correct. See docs/maintenance/v2-migration.md for removal criteria.
  if (details.reason === 'update') {
    chrome.storage.sync.set({ setupComplete: false });
  }
});
```

- [ ] **Step 6: Update the `module.exports` line**

Find:

```js
if (typeof module !== 'undefined') module.exports = {handleClusterRequest, handleKeep, handleNuke, handleSave, fetchWithRetry, markProcessed, tabSignature, createTabGroups};
```

Replace with:

```js
if (typeof module !== 'undefined') module.exports = {handleGetTabsForCluster, handleCommitClusters, handleKeep, handleNuke, handleSave, markProcessed, tabSignature, createTabGroups};
```

- [ ] **Step 7: Verify the file syntax is valid**

Run: `node --check background.js`

Expected: no output (no syntax errors).

### Task 3.4: Update `background.test.js` for new action protocol

**Files:**
- Modify: `background.test.js`

- [ ] **Step 1: Read the test file**

Open `background.test.js`. Find the test that asserts `handleClusterRequest` (the proxy POST). It will need to be replaced.

- [ ] **Step 2: Replace the cluster-request test with two tests for the new actions**

Find the existing test that exercises `handleClusterRequest` (calls fetch on `PROXY_URL`). Delete it. Replace with two tests:

```js
// --- Test: handleGetTabsForCluster returns sanitized tabs and sig (cache miss) ---
sessionStore = {};
mockTabs = [
  { id: 1, title: 'A', url: 'https://a.com', pinned: false, favIconUrl: 'fav.png', windowId: 1 },
  { id: 2, title: 'B', url: 'https://b.com', pinned: false },
  { id: 3, title: 'pinned', url: 'https://c.com', pinned: true },     // excluded
  { id: 4, title: 'chrome', url: 'chrome://newtab/', pinned: false }, // excluded
];
{
  const { handleGetTabsForCluster } = require('./background.js');
  const result = await handleGetTabsForCluster();
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.cached, false);
  assert.strictEqual(result.tabs.length, 2, 'pinned + chrome:// are filtered out');
  // Field whitelist: only id/title/url survive
  assert.deepStrictEqual(Object.keys(result.tabs[0]).sort(), ['id', 'title', 'url']);
  assert.ok(typeof result.sig === 'string');
}

// --- Test: handleGetTabsForCluster returns cached payload on signature match ---
sessionStore = {
  tb_last_tab_ids: '1,2',
  tb_cluster_state: { type: 'clusters', clusters: [{ name: 'X', emoji: '🧪', tabIds: [1], vibe: 'v', confidence: 1 }] }
};
mockTabs = [
  { id: 1, title: 'A', url: 'https://a.com', pinned: false },
  { id: 2, title: 'B', url: 'https://b.com', pinned: false }
];
{
  const { handleGetTabsForCluster } = require('./background.js');
  const result = await handleGetTabsForCluster();
  assert.strictEqual(result.cached, true);
  assert.strictEqual(result.payload.type, 'clusters');
  assert.strictEqual(result.payload.clusters[0].name, 'X');
}

// --- Test: handleCommitClusters writes to session and updates signature ---
sessionStore = {};
{
  const { handleCommitClusters } = require('./background.js');
  await handleCommitClusters([{ name: 'C', emoji: '📦', tabIds: [1], vibe: 'v', confidence: 1 }], 'sig-abc');
  assert.strictEqual(sessionStore.tb_cluster_state.clusters[0].name, 'C');
  assert.strictEqual(sessionStore.tb_last_tab_ids, 'sig-abc');
}
```

- [ ] **Step 3: Add a test for the v1→v2 migration (onInstalled with reason='update')**

Append to the test file:

```js
// --- Test: onInstalled with reason='update' flips setupComplete to false ---
{
  // Stash the listener registered by background.js
  let registeredListener = null;
  const origAddListener = chrome.runtime.onInstalled.addListener;
  chrome.runtime.onInstalled = { addListener: (fn) => { registeredListener = fn; } };
  // Re-require background.js to re-register
  delete require.cache[require.resolve('./background.js')];
  require('./background.js');
  assert.ok(registeredListener, 'onInstalled listener registered');

  // Simulate update
  let setCalls = [];
  chrome.storage.sync = {
    set: (obj) => { setCalls.push(obj); return Promise.resolve(); }
  };
  registeredListener({ reason: 'update' });
  assert.deepStrictEqual(setCalls[0], { setupComplete: false });

  // Simulate install (should open options with welcome=1, NOT touch setupComplete via update path)
  setCalls = [];
  let createdTabs = [];
  chrome.tabs.create = (opts) => { createdTabs.push(opts); return Promise.resolve(); };
  registeredListener({ reason: 'install' });
  assert.ok(createdTabs[0].url.includes('options.html?welcome=1'));
}
```

- [ ] **Step 4: Run the updated test**

Run: `node background.test.js`

Expected: all assertions pass.

If failures relate to legacy assertions about `PROXY_URL` or `handleClusterRequest`, delete those legacy assertions — they no longer apply.

- [ ] **Step 5: Commit**

```bash
git add background.js background.test.js
git commit -m "refactor: replace proxy fetch with getTabsForCluster + commitClusters"

Background no longer holds the LLM call; it provides tab data and stores
results. Adds onInstalled with v1->v2 setupComplete reset. PROXY_URL,
handleClusterRequest, and fetchWithRetry are gone.
```

### Task 3.5: Write `docs/maintenance/v2-migration.md`

**Files:**
- Create: `docs/maintenance/v2-migration.md`

- [ ] **Step 1: Write the doc**

Create `docs/maintenance/v2-migration.md`:

```markdown
# v1 → v2 Migration: Forced Re-Setup

## What it does

`background.js` registers `chrome.runtime.onInstalled` and, on `details.reason === 'update'`, writes `setupComplete: false` to `chrome.storage.sync`. This makes the popup show the setup gate and the options page show the welcome section on next open.

```js
// REMOVE-IN-V3:
if (details.reason === 'update') {
  chrome.storage.sync.set({ setupComplete: false });
}
```

## Why

v1 used a maintainer-operated proxy at `autoqa.teachx.ai`. v2 retired it. v1 users have:
- No `provider` setting (puter / byok)
- No API keys in `chrome.storage.local`
- No `puterModel` / `byokModels` selections

They have no valid v2 config to inherit. Treating them as fresh installs is the correct UX — they'd hit broken state on first cluster otherwise.

## When to remove

Delete the `if (details.reason === 'update')` branch (search for `REMOVE-IN-V3:`) in either:
- **v3 release**, OR
- Any release at least **2 release cycles after v2 ships** AND most users have rolled over.

The cost of leaving the branch is one storage write per update event — negligible. So when in doubt, leave it for one more cycle.

## Verification before removal

Confirm via either:
- **Field telemetry** showing existing users have `setupComplete=true` in `chrome.storage.sync` reliably, OR
- **Anecdotal evidence** from at least 2 release cycles where no support requests mention "extension stopped working after update".

If neither applies, leave for another cycle.

## Removal checklist

- [ ] Delete the `if (details.reason === 'update')` branch in `background.js`
- [ ] Delete the corresponding test in `background.test.js`
- [ ] Delete this file (`docs/maintenance/v2-migration.md`)
- [ ] Update `context.md` to remove the open follow-up entry referencing this migration
```

- [ ] **Step 2: Commit**

```bash
git add docs/maintenance/v2-migration.md
git commit -m "docs: document v1->v2 forced re-setup and removal criteria"
```

---

## Stream 4 — Popup Wiring (LLM Call + Setup Gate)

**Owner brief:** Loads the vendored Puter SDK in `popup.html`, replaces the popup's `cluster` action call with the new `getTabsForCluster` → `clusterTabs()` → `commitClusters` flow, adds the setup-required idle state, and surfaces the new error taxonomy.

**Depends on:** Streams 2 (uses `lib/llm/index.js` and `lib/puter.js`) and 3 (uses new background action protocol).

### Task 4.1: Add Puter script tag and setup-required view to `popup.html`

**Files:**
- Modify: `popup.html`

- [ ] **Step 1: Add Puter SDK script tag (synchronous, before popup.js)**

In `popup.html`, find the line `<script type="module" src="popup.js"></script>` (line ~100). Immediately above it, add:

```html
  <script src="lib/puter.js"></script>
```

The result should be:

```html
  <script src="lib/puter.js"></script>
  <script type="module" src="popup.js"></script>
```

The Puter SDK loads synchronously (no `type="module"`, no `defer`) so `window.puter` exists before `popup.js` runs.

- [ ] **Step 2: Add the setup-required view inside `<div id="app">`**

Add this block immediately after `<div id="app">` and before `<!-- Idle View -->`:

```html
    <!-- Setup Required View (shown when settings.setupComplete is false) -->
    <section id="view-setup-required" class="view hidden">
      <div class="setup-required-content">
        <div class="mascot-wrap">
          <div class="mascot">⚖️</div>
        </div>
        <h2>Set up Tab Bankruptcy first</h2>
        <p>Choose how to talk to your AI before declaring bankruptcy on your tabs.</p>
        <button id="btn-open-setup" class="btn-primary">Open Settings</button>
      </div>
    </section>
```

- [ ] **Step 3: Update the error view to support multiple action buttons**

Find the existing error view:

```html
    <section id="view-error" class="view hidden">
      <div class="error-content">
        <div class="error-icon">⚠️</div>
        <h2>Something went wrong</h2>
        <p id="error-message">Grok unavailable. Try again?</p>
        <button id="btn-retry" class="btn-primary">Retry</button>
      </div>
    </section>
```

Replace with:

```html
    <section id="view-error" class="view hidden">
      <div class="error-content">
        <div class="error-icon">⚠️</div>
        <h2>Something went wrong</h2>
        <p id="error-message">Try again?</p>
        <div id="error-actions" class="error-actions">
          <button id="btn-retry" class="btn-primary">Retry</button>
          <button id="btn-open-settings" class="btn-secondary hidden">Open Settings</button>
          <button id="btn-open-puter-dashboard" class="btn-secondary hidden">Open Puter Dashboard</button>
        </div>
      </div>
    </section>
```

### Task 4.2: Refactor `popup.js` cluster flow to use the LLM module

**Files:**
- Modify: `popup.js`

- [ ] **Step 1: Add new imports at the top**

Find the existing import:

```js
import { playNuke, playKeep, playSave, playCompletion, loadMute } from './lib/audio.js';
```

Add immediately after:

```js
import {
  clusterTabs,
  PUTER_DASHBOARD_URL,
  ApiKeyMissingError,
  PuterNotSignedIn,
  PuterOutOfCredits,
  ClusterParseError,
  LlmError
} from './lib/llm/index.js';
```

- [ ] **Step 2: Add a SETUP_REQUIRED state to STATES**

Find:

```js
const STATES = { IDLE: 'idle', LOADING: 'loading', TRIAGE: 'triage', COMPLETION: 'completion', ERROR: 'error' };
```

Replace with:

```js
const STATES = { SETUP_REQUIRED: 'setup-required', IDLE: 'idle', LOADING: 'loading', TRIAGE: 'triage', COMPLETION: 'completion', ERROR: 'error' };
```

- [ ] **Step 3: Replace the `startLoading` function's cluster invocation**

Find the body of `startLoading()` — specifically the block at the end:

```js
  console.log('[popup] sending {action: "cluster"} to background');
  // Send cluster request to background
  chrome.runtime.sendMessage({ action: 'cluster' }, (resp) => {
    console.log('[popup] cluster request response:', resp);
  });
```

Replace with:

```js
  runClusterFlow().catch(err => {
    console.error('[popup] cluster flow error:', err);
    handleClusterError(err);
  });
```

Then add this new function just below `startLoading()`:

```js
async function runClusterFlow() {
  // 1. Ask background for tabs (or cached payload)
  const tabResp = await new Promise(resolve => {
    chrome.runtime.sendMessage({ action: 'getTabsForCluster' }, resolve);
  });
  if (!tabResp?.ok) throw new Error(tabResp?.error || 'Failed to get tabs');
  if (tabResp.cached) {
    renderClusters(tabResp.payload);
    return;
  }
  // 2. Load merged settings (sync + local)
  const sync = await new Promise(r => chrome.storage.sync.get(null, r));
  const local = await new Promise(r => chrome.storage.local.get(['apiKeys'], r));
  const settings = {
    provider: sync.provider || 'puter',
    puterModel: sync.puterModel || 'x-ai/grok-3-mini',
    byokProvider: sync.byokProvider || 'xai',
    byokModels: sync.byokModels || { xai:'grok-3-mini', openai:'gpt-4o-mini', anthropic:'claude-haiku-4-5-20251001', google:'gemini-2.5-flash' },
    customPrompt: sync.customPrompt || '',
    apiKeys: local.apiKeys || {}
  };
  // 3. Run the LLM
  const clusters = await clusterTabs(tabResp.tabs, settings);
  // 4. Commit clusters back to background
  await new Promise(resolve => {
    chrome.runtime.sendMessage(
      { action: 'commitClusters', clusters, sig: tabResp.sig },
      resolve
    );
  });
  // 5. Render
  renderClusters({ type: 'clusters', clusters });
}

function handleClusterError(err) {
  const provider = err?.provider || '';
  if (err instanceof PuterNotSignedIn) {
    showError({
      message: 'You need to sign in to Puter to cluster tabs. Set it up in Settings, or switch to your own API key.',
      showSettings: true
    });
  } else if (err instanceof PuterOutOfCredits) {
    showError({
      message: "You're out of Puter credits. Top up at puter.com/dashboard, or switch to BYOK in Settings.",
      showPuterDashboard: true,
      showSettings: true
    });
  } else if (err instanceof ApiKeyMissingError) {
    showError({
      message: `No API key for ${provider}. Add one in Settings.`,
      showSettings: true
    });
  } else if (err instanceof LlmError && err.kind === 'auth') {
    showError({ message: err.message + '. Update it in Settings.', showSettings: true });
  } else if (err instanceof LlmError && err.kind === 'rate_limit') {
    showError({ message: err.message + '. Try again in a moment.' });
  } else if (err instanceof LlmError && err.kind === 'network') {
    showError({ message: `Couldn't reach the model. Retry?` });
  } else if (err instanceof ClusterParseError) {
    showError({ message: 'Model returned an unexpected response. Try again?' });
  } else {
    showError({ message: err?.message || 'Unknown error' });
  }
}
```

- [ ] **Step 4: Replace the existing `showError` function**

Find:

```js
function showError(msg) {
  if (loadingInterval) {
    clearInterval(loadingInterval);
    loadingInterval = null;
  }
  const errEl = document.getElementById('error-message');
  if (errEl) errEl.textContent = msg || 'Grok unavailable. Try again?';
  setState(STATES.ERROR);
}
```

Replace with:

```js
function showError(opts) {
  if (loadingInterval) {
    clearInterval(loadingInterval);
    loadingInterval = null;
  }
  const message = typeof opts === 'string' ? opts : (opts?.message || 'Something went wrong.');
  const showSettings = typeof opts === 'object' && !!opts?.showSettings;
  const showPuterDashboard = typeof opts === 'object' && !!opts?.showPuterDashboard;
  const errEl = document.getElementById('error-message');
  if (errEl) errEl.textContent = message;
  const settingsBtn = document.getElementById('btn-open-settings');
  const dashBtn = document.getElementById('btn-open-puter-dashboard');
  if (settingsBtn) settingsBtn.classList.toggle('hidden', !showSettings);
  if (dashBtn) dashBtn.classList.toggle('hidden', !showPuterDashboard);
  setState(STATES.ERROR);
}
```

- [ ] **Step 5: Wire the new error-action buttons in `init()`**

In `init()`, after the existing `btn-retry` listener block (search for `btn-retry`), add:

```js
  const btnOpenSettings = document.getElementById('btn-open-settings');
  if (btnOpenSettings) {
    btnOpenSettings.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }
  const btnOpenDash = document.getElementById('btn-open-puter-dashboard');
  if (btnOpenDash) {
    btnOpenDash.addEventListener('click', () => {
      chrome.tabs.create({ url: PUTER_DASHBOARD_URL });
    });
  }
```

- [ ] **Step 6: Add the setup gate logic in `init()`**

In `init()`, find the existing block:

```js
  // Idle
  updateIdleTabCount();
  console.log('[popup] setState -> IDLE');
  setState(STATES.IDLE);
```

Replace with:

```js
  // Check setup gate
  const setupCheck = await new Promise(r => chrome.storage.sync.get(['setupComplete'], r));
  if (!setupCheck.setupComplete) {
    setState(STATES.SETUP_REQUIRED);
    const btnOpenSetup = document.getElementById('btn-open-setup');
    if (btnOpenSetup) {
      btnOpenSetup.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
      });
    }
    return; // skip idle wiring; user must complete setup first
  }

  // Idle
  updateIdleTabCount();
  setState(STATES.IDLE);
```

- [ ] **Step 7: Update `handleMessage` — remove the old cluster reply path**

Find:

```js
function handleMessage(msg) {
  console.log('[popup] handleMessage received:', msg);
  if (msg.type === 'clusters') {
    console.log('[popup] clusters received:', msg.clusters?.length || 0, 'clusters');
    if (msg.warning) showWarning(msg.warning);
    renderClusters(msg);
  } else if (msg.type === 'error') {
    console.error('[popup] error from background:', msg.message);
    showError(msg.message);
  } else if (msg.type === 'warning') {
    console.warn('[popup] warning:', msg.message);
    showWarning(msg.message);
  } else if (msg.type === 'actionDone') {
    console.log('[popup] actionDone, resolvedClusters:', resolvedClusters, 'total:', totalClusters);
    if (resolvedClusters >= totalClusters) {
      triggerConfetti();
      showCompletion();
    }
  }
}
```

Replace with (the LLM is now in-popup so background no longer pushes `clusters`/`error` messages — keep the listener for `actionDone` in case other code still uses it; remove the cluster/error/warning branches):

```js
function handleMessage(msg) {
  if (msg?.type === 'actionDone') {
    if (resolvedClusters >= totalClusters) {
      triggerConfetti();
      showCompletion();
    }
  }
}
```

- [ ] **Step 8: Verify the file syntax is valid**

Run: `node --check popup.js`

Expected: no output.

### Task 4.3: Update `popup.test.js`

**Files:**
- Modify: `popup.test.js`

- [ ] **Step 1: Read existing test file**

Open `popup.test.js`. Note assertions that reference the old `cluster` action — these will be removed.

- [ ] **Step 2: Remove tests asserting the old `cluster` action**

Search for `'cluster'` (the action name) in `popup.test.js`. Delete any test block whose assertion relies on `chrome.runtime.sendMessage` being called with `{action: 'cluster'}`. We're testing in-popup LLM now.

- [ ] **Step 3: Add tests for the new flow**

Append:

```js
// --- Test: setup gate hides Declare button when setupComplete is false ---
{
  // Reset DOM
  document.body.innerHTML = `
    <section id="view-setup-required" class="view hidden"><button id="btn-open-setup"></button></section>
    <section id="view-idle" class="view hidden"><button id="btn-declare"></button></section>
  `;
  // Mock chrome.storage.sync.get to return setupComplete:false
  chrome.storage.sync.get = (keys, cb) => cb({ setupComplete: false });
  chrome.runtime.openOptionsPage = () => { chrome.runtime.openOptionsPage.called = true; };
  // Trigger init (the test harness for popup.js typically re-imports and dispatches DOMContentLoaded)
  // ... existing test setup pattern ...
  // After init, view-setup-required should be active and view-idle should be hidden.
  // (Adjust according to the existing test framework pattern in this file.)
}

// --- Test: setup gate skipped when setupComplete is true ---
{
  chrome.storage.sync.get = (keys, cb) => cb({ setupComplete: true });
  // ... after init, view-idle should be active ...
}
```

If the existing test file is too sparse to extend cleanly, add a minimal smoke test instead:

```js
// --- Smoke: setup-required view exists in DOM after init when setupComplete=false ---
const assert = require('assert');
const fs = require('fs');
const popupHtml = fs.readFileSync('popup.html', 'utf8');
assert.ok(popupHtml.includes('view-setup-required'), 'popup.html has setup-required view');
assert.ok(popupHtml.includes('btn-open-setup'), 'popup.html has open-setup button');
console.log('popup setup-required HTML present');
```

- [ ] **Step 4: Run the test**

Run: `node popup.test.js`

Expected: all assertions pass. If the existing test file is structured around mocked chrome.* and a `require('./popup.js')`, you may need to mock `chrome.storage.sync.get` and `chrome.storage.local.get` to return `{}` so init doesn't blow up.

- [ ] **Step 5: Commit popup HTML + JS + tests together**

```bash
git add popup.html popup.js popup.test.js
git commit -m "feat: move LLM call into popup; add setup gate and error UI"

Popup now performs the LLM call directly via lib/llm/index.js, using
either the vendored Puter SDK or BYOK adapters. Adds a setup-required
view shown when settings.setupComplete is false. Replaces the old single
'try again' error UI with a taxonomy-aware view supporting Puter dashboard
and Settings actions.
```

### Task 4.4: Add `popup.css` styling for setup-required view

**Files:**
- Modify: `popup.css`

- [ ] **Step 1: Append styling**

At the end of `popup.css`, append:

```css
/* Setup required view */
.setup-required-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 48px 24px;
  gap: 16px;
}
.setup-required-content h2 {
  margin: 0;
  font-size: 22px;
}
.setup-required-content p {
  margin: 0;
  opacity: 0.8;
  max-width: 320px;
}

/* Multi-button error actions */
.error-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: stretch;
  margin-top: 16px;
}
.btn-secondary {
  background: transparent;
  border: 1px solid currentColor;
  padding: 10px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
}
.btn-secondary.hidden {
  display: none;
}
```

- [ ] **Step 2: Commit**

```bash
git add popup.css
git commit -m "style: add setup-required view and multi-button error actions"
```

---

## Stream 5 — Options Page (Welcome + Provider Config + Key Entry)

**Owner brief:** Adds the welcome / first-run setup section, the always-visible provider config (Puter + 4 BYOK sub-cards), key entry (Test/Clear), Puter sign-in/out, and writes `setupComplete` based on validity rules from spec §7.2.

**Depends on:** Stream 2 (uses `lib/llm/index.js` and `lib/puter.js`).

### Task 5.1: Add Puter script tag to `options.html`

**Files:**
- Modify: `options.html`

- [ ] **Step 1: Add Puter SDK script tag**

In `options.html`, find `<script src="options.js"></script>` (line ~102). Immediately above it, add:

```html
  <script src="lib/puter.js"></script>
```

The result should be:

```html
  <script src="lib/puter.js"></script>
  <script src="options.js"></script>
```

### Task 5.2: Add the Welcome / AI Provider sections to `options.html`

**Files:**
- Modify: `options.html`

- [ ] **Step 1: Insert Welcome section above existing sections**

Find `<!-- Custom Prompt -->` section. Insert this block immediately above it (after `</header>`):

```html
    <!-- Welcome (shown when ?welcome=1 OR setupComplete=false) -->
    <section id="welcome-section" class="section hidden">
      <div class="section-header">
        <span class="section-icon">👋</span>
        <div>
          <h2>Welcome to Tab Bankruptcy</h2>
          <p class="section-subtitle">Pick how you want to call the AI before declaring bankruptcy.</p>
        </div>
      </div>
      <div class="welcome-body">
        <p class="welcome-note">Choose a provider in the AI Provider section below. When you're ready, finish setup.</p>
        <button id="btn-finish-setup" class="btn btn-primary" disabled>Finish Setup</button>
        <p id="finish-setup-hint" class="hint">Sign in to Puter or add at least one BYOK key to enable.</p>
      </div>
    </section>

    <!-- AI Provider -->
    <section id="provider-section" class="section">
      <div class="section-header">
        <span class="section-icon">🤖</span>
        <div>
          <h2>AI Provider</h2>
          <p class="section-subtitle">Default is Puter (sign in once, pay-as-you-go). Power users can BYOK.</p>
        </div>
      </div>

      <div class="provider-radio-row">
        <label><input type="radio" name="provider" value="puter" checked /> <span>Puter (recommended)</span></label>
        <label><input type="radio" name="provider" value="byok" /> <span>Bring your own key (BYOK)</span></label>
      </div>

      <!-- Puter subsection -->
      <div id="puter-config" class="provider-subsection">
        <div class="puter-status">
          <span id="puter-status-text">Checking sign-in…</span>
          <button id="btn-puter-signin" class="btn btn-primary">Sign in to Puter</button>
          <button id="btn-puter-signout" class="btn btn-secondary hidden">Sign out</button>
        </div>
        <label class="select-row">
          <span class="select-title">Default model</span>
          <select id="puter-model"></select>
        </label>
        <button id="btn-puter-test" class="btn btn-secondary">Test connection</button>
        <span id="puter-test-result" class="test-result"></span>
      </div>

      <!-- BYOK subsection -->
      <div id="byok-config" class="provider-subsection hidden">
        <p class="hint">Keys never leave this device.</p>
        <div id="byok-cards"></div>
      </div>
    </section>
```

- [ ] **Step 2: Verify HTML parses**

Run: `node -e "const h=require('fs').readFileSync('options.html','utf8'); console.log(h.length>1000?'ok':'short')"`

Expected: `ok`.

### Task 5.3: Implement options.js — provider sub-rendering, sign-in, key entry

**Files:**
- Modify: `options.js`

- [ ] **Step 1: Add new imports / globals at the top**

The existing `options.js` is a script (not a module — `<script src=>`). To use the LLM module from a script, load it via dynamic import. Add at the top of `options.js`:

```js
let LLM = null; // populated lazily via dynamic import on first use

async function loadLlm() {
  if (LLM) return LLM;
  LLM = await import(chrome.runtime.getURL('lib/llm/index.js'));
  return LLM;
}
```

- [ ] **Step 2: Add bootstrapping in `DOMContentLoaded`**

Find the existing:

```js
document.addEventListener('DOMContentLoaded', () => {
  initPromptEditor();
  initMuteToggle();
  initThemeToggle();
});
```

Replace with:

```js
document.addEventListener('DOMContentLoaded', async () => {
  initPromptEditor();
  initMuteToggle();
  initThemeToggle();
  await initProviderConfig();
  await initWelcomeGate();
});
```

- [ ] **Step 3: Add `initProviderConfig` function**

Append to `options.js`:

```js
async function initProviderConfig() {
  const { MODELS, PROVIDERS, PROVIDER_LABELS } = await loadLlm();

  const radios = document.querySelectorAll('input[name="provider"]');
  const puterConfig = $('puter-config');
  const byokConfig = $('byok-config');

  // Load saved provider
  const sync = await new Promise(r => chrome.storage.sync.get(null, r));
  const provider = sync.provider || 'puter';
  document.querySelector(`input[name="provider"][value="${provider}"]`).checked = true;
  toggleProviderSubsections(provider);

  radios.forEach(r => r.addEventListener('change', async () => {
    const v = document.querySelector('input[name="provider"]:checked').value;
    await new Promise(res => chrome.storage.sync.set({ provider: v }, res));
    toggleProviderSubsections(v);
    refreshFinishSetupGate();
  }));

  // Puter model dropdown
  const puterModelSelect = $('puter-model');
  puterModelSelect.innerHTML = '';
  for (const opt of MODELS.puter.options) {
    const o = document.createElement('option');
    o.value = opt.id; o.textContent = opt.label;
    puterModelSelect.appendChild(o);
  }
  puterModelSelect.value = sync.puterModel || MODELS.puter.default;
  puterModelSelect.addEventListener('change', () => {
    chrome.storage.sync.set({ puterModel: puterModelSelect.value });
  });

  // Puter sign-in/out
  await refreshPuterStatus();
  $('btn-puter-signin').addEventListener('click', async () => {
    if (!window.puter) { alert('Puter SDK not loaded'); return; }
    try {
      await window.puter.auth.signIn();
      await refreshPuterStatus();
      refreshFinishSetupGate();
    } catch (e) {
      alert('Sign-in failed: ' + (e?.message || e));
    }
  });
  $('btn-puter-signout').addEventListener('click', async () => {
    if (!window.puter) return;
    try {
      await window.puter.auth.signOut();
      await refreshPuterStatus();
      // If Puter was active, signing out invalidates setup
      if (provider === 'puter') {
        await new Promise(r => chrome.storage.sync.set({ setupComplete: false }, r));
      }
      refreshFinishSetupGate();
    } catch (e) {
      alert('Sign-out failed: ' + (e?.message || e));
    }
  });

  // Puter Test
  $('btn-puter-test').addEventListener('click', async () => {
    const resultEl = $('puter-test-result');
    resultEl.textContent = '…';
    try {
      if (!window.puter) throw new Error('Puter SDK not loaded');
      // testMode=true: no credit consumption
      await window.puter.ai.chat([{role:'user', content:'ping'}], true, { model: puterModelSelect.value });
      resultEl.textContent = '✓ OK';
    } catch (e) {
      resultEl.textContent = '✗ ' + (e?.message || e);
    }
  });

  // BYOK cards
  await renderByokCards(MODELS, PROVIDERS, PROVIDER_LABELS, sync);
}

function toggleProviderSubsections(provider) {
  const puterConfig = $('puter-config');
  const byokConfig = $('byok-config');
  puterConfig.classList.toggle('hidden', provider !== 'puter');
  byokConfig.classList.toggle('hidden', provider !== 'byok');
}

async function refreshPuterStatus() {
  const text = $('puter-status-text');
  const signinBtn = $('btn-puter-signin');
  const signoutBtn = $('btn-puter-signout');
  if (!window.puter) {
    text.textContent = 'Puter SDK not loaded';
    return;
  }
  try {
    const isIn = await window.puter.auth.isSignedIn();
    if (isIn) {
      let username = '';
      try { username = (await window.puter.auth.getUser())?.username || ''; } catch {}
      text.textContent = username ? `Signed in as ${username}` : 'Signed in';
      signinBtn.classList.add('hidden');
      signoutBtn.classList.remove('hidden');
    } else {
      text.textContent = 'Not signed in';
      signinBtn.classList.remove('hidden');
      signoutBtn.classList.add('hidden');
    }
  } catch {
    text.textContent = 'Not signed in';
    signinBtn.classList.remove('hidden');
    signoutBtn.classList.add('hidden');
  }
}

async function renderByokCards(MODELS, PROVIDERS, PROVIDER_LABELS, sync) {
  const container = $('byok-cards');
  container.innerHTML = '';
  const local = await new Promise(r => chrome.storage.local.get(['apiKeys'], r));
  const apiKeys = local.apiKeys || {};
  const byokModels = sync.byokModels || {};
  const activeByokProvider = sync.byokProvider || 'xai';

  for (const provider of PROVIDERS) {
    const card = document.createElement('div');
    card.className = 'byok-card';
    const modelDefault = byokModels[provider] || MODELS[provider].default;
    card.innerHTML = `
      <div class="byok-card-header">
        <label class="byok-active">
          <input type="radio" name="byokProvider" value="${provider}" ${activeByokProvider === provider ? 'checked' : ''}>
          <strong>${PROVIDER_LABELS[provider]}</strong>
          <span class="byok-active-tag">active</span>
        </label>
      </div>
      <label class="byok-key-row">
        <span>API key</span>
        <span class="byok-key-input">
          <input type="password" data-provider="${provider}" class="byok-key" placeholder="(no key set)" value="${apiKeys[provider] || ''}">
          <button type="button" class="btn btn-text byok-show" data-provider="${provider}">show</button>
        </span>
      </label>
      <label class="byok-model-row">
        <span>Model</span>
        <select class="byok-model" data-provider="${provider}"></select>
      </label>
      <div class="byok-actions">
        <button type="button" class="btn btn-secondary byok-test" data-provider="${provider}">Test</button>
        <button type="button" class="btn btn-text byok-clear" data-provider="${provider}">Clear</button>
        <span class="test-result" data-provider="${provider}"></span>
      </div>
      <p class="hint">Keys never leave this device.</p>
    `;
    const sel = card.querySelector('.byok-model');
    for (const opt of MODELS[provider].options) {
      const o = document.createElement('option');
      o.value = opt.id; o.textContent = opt.label;
      sel.appendChild(o);
    }
    sel.value = modelDefault;
    container.appendChild(card);
  }

  // Wire all interactions
  container.querySelectorAll('.byok-key').forEach(input => {
    input.addEventListener('input', async () => {
      const p = input.dataset.provider;
      const local = await new Promise(r => chrome.storage.local.get(['apiKeys'], r));
      const keys = local.apiKeys || {};
      const v = input.value.trim();
      if (v) keys[p] = v; else delete keys[p];
      await new Promise(r => chrome.storage.local.set({ apiKeys: keys }, r));
      refreshFinishSetupGate();
      maybeFlipSetupCompleteFalse(p);
    });
  });
  container.querySelectorAll('.byok-show').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = container.querySelector(`.byok-key[data-provider="${btn.dataset.provider}"]`);
      input.type = input.type === 'password' ? 'text' : 'password';
      btn.textContent = input.type === 'password' ? 'show' : 'hide';
    });
  });
  container.querySelectorAll('.byok-model').forEach(sel => {
    sel.addEventListener('change', async () => {
      const p = sel.dataset.provider;
      const sync = await new Promise(r => chrome.storage.sync.get(['byokModels'], r));
      const m = sync.byokModels || {};
      m[p] = sel.value;
      await new Promise(r => chrome.storage.sync.set({ byokModels: m }, r));
    });
  });
  container.querySelectorAll('input[name="byokProvider"]').forEach(r => {
    r.addEventListener('change', async () => {
      const v = container.querySelector('input[name="byokProvider"]:checked').value;
      await new Promise(res => chrome.storage.sync.set({ byokProvider: v }, res));
      refreshFinishSetupGate();
    });
  });
  container.querySelectorAll('.byok-test').forEach(btn => {
    btn.addEventListener('click', async () => {
      const p = btn.dataset.provider;
      const result = container.querySelector(`.test-result[data-provider="${p}"]`);
      result.textContent = '…';
      try {
        const local = await new Promise(r => chrome.storage.local.get(['apiKeys'], r));
        const key = (local.apiKeys || {})[p];
        if (!key) throw new Error('No key set');
        const sync = await new Promise(r => chrome.storage.sync.get(['byokModels'], r));
        const model = (sync.byokModels || {})[p] || MODELS[p].default;
        await testByokConnection(p, key, model);
        result.textContent = '✓ OK';
      } catch (e) {
        result.textContent = '✗ ' + (e?.message || e);
      }
    });
  });
  container.querySelectorAll('.byok-clear').forEach(btn => {
    btn.addEventListener('click', async () => {
      const p = btn.dataset.provider;
      const local = await new Promise(r => chrome.storage.local.get(['apiKeys'], r));
      const keys = local.apiKeys || {};
      delete keys[p];
      await new Promise(r => chrome.storage.local.set({ apiKeys: keys }, r));
      const input = container.querySelector(`.byok-key[data-provider="${p}"]`);
      if (input) input.value = '';
      refreshFinishSetupGate();
      maybeFlipSetupCompleteFalse(p);
    });
  });
}

// Tiny 1-token call to verify a BYOK provider key works.
async function testByokConnection(provider, key, model) {
  const messages = [{ role: 'user', content: 'ping' }];
  if (provider === 'xai' || provider === 'openai') {
    const url = provider === 'xai'
      ? 'https://api.x.ai/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, max_tokens: 1 })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return;
  }
  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model, max_tokens: 1, messages })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return;
  }
  if (provider === 'google') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        generationConfig: { maxOutputTokens: 1 }
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return;
  }
  throw new Error(`Unknown provider: ${provider}`);
}

// If the user clears the key for the active BYOK provider, flip setupComplete=false.
async function maybeFlipSetupCompleteFalse(clearedProvider) {
  const sync = await new Promise(r => chrome.storage.sync.get(['provider', 'byokProvider'], r));
  if (sync.provider === 'byok' && sync.byokProvider === clearedProvider) {
    const local = await new Promise(r => chrome.storage.local.get(['apiKeys'], r));
    const k = (local.apiKeys || {})[clearedProvider];
    if (!k) {
      await new Promise(r => chrome.storage.sync.set({ setupComplete: false }, r));
    }
  }
}
```

- [ ] **Step 4: Add `initWelcomeGate` and `refreshFinishSetupGate` functions**

Append to `options.js`:

```js
async function initWelcomeGate() {
  const params = new URLSearchParams(window.location.search);
  const sync = await new Promise(r => chrome.storage.sync.get(['setupComplete'], r));
  const showWelcome = params.get('welcome') === '1' || !sync.setupComplete;
  $('welcome-section').classList.toggle('hidden', !showWelcome);
  refreshFinishSetupGate();

  $('btn-finish-setup').addEventListener('click', async () => {
    await new Promise(r => chrome.storage.sync.set({ setupComplete: true }, r));
    $('welcome-section').classList.add('hidden');
  });
}

async function refreshFinishSetupGate() {
  const btn = $('btn-finish-setup');
  const hint = $('finish-setup-hint');
  if (!btn) return;
  const sync = await new Promise(r => chrome.storage.sync.get(['provider', 'byokProvider'], r));
  const local = await new Promise(r => chrome.storage.local.get(['apiKeys'], r));
  const provider = sync.provider || 'puter';
  let valid = false;
  let why = '';
  if (provider === 'puter') {
    if (window.puter) {
      try { valid = await window.puter.auth.isSignedIn(); } catch {}
    }
    why = valid ? '' : 'Sign in to Puter to enable.';
  } else {
    const keys = local.apiKeys || {};
    const candidates = ['xai','openai','anthropic','google'].filter(p => !!keys[p]);
    if (candidates.length > 0) {
      // If active byokProvider has no key, auto-pick the first one with a key (Grok-preferred).
      const active = sync.byokProvider || 'xai';
      if (!keys[active]) {
        await new Promise(r => chrome.storage.sync.set({ byokProvider: candidates[0] }, r));
      }
      valid = true;
    }
    why = valid ? '' : 'Add at least one BYOK key to enable.';
  }
  btn.disabled = !valid;
  hint.textContent = why;
  hint.style.display = why ? '' : 'none';
}
```

- [ ] **Step 5: Verify the file syntax is valid**

Run: `node --check options.js`

Expected: no output.

### Task 5.4: Update `options.test.js`

**Files:**
- Modify: `options.test.js`

- [ ] **Step 1: Read the test file**

Open `options.test.js`. Note its existing pattern (likely jest-style or assert-based with mocked chrome.*).

- [ ] **Step 2: Add tests for the new functions**

Append (adapt to the existing test framework conventions in the file — if it uses `test()` blocks, follow that; if assert-based, follow that):

```js
// --- Test: HTML contains the new welcome and provider sections ---
{
  const fs = require('fs');
  const html = fs.readFileSync('options.html', 'utf8');
  if (!html.includes('id="welcome-section"')) throw new Error('options.html missing welcome-section');
  if (!html.includes('id="provider-section"')) throw new Error('options.html missing provider-section');
  if (!html.includes('id="puter-config"')) throw new Error('options.html missing puter-config');
  if (!html.includes('id="byok-config"')) throw new Error('options.html missing byok-config');
  if (!html.includes('id="byok-cards"')) throw new Error('options.html missing byok-cards container');
  if (!html.includes('id="btn-finish-setup"')) throw new Error('options.html missing finish setup button');
  console.log('options HTML structure ok');
}

// --- Test: Puter SDK script tag is present and loaded BEFORE options.js ---
{
  const fs = require('fs');
  const html = fs.readFileSync('options.html', 'utf8');
  const puterIdx = html.indexOf('lib/puter.js');
  const optionsIdx = html.indexOf('options.js');
  if (puterIdx === -1) throw new Error('lib/puter.js not loaded in options.html');
  if (puterIdx > optionsIdx) throw new Error('lib/puter.js must load BEFORE options.js');
  console.log('options Puter script ordering ok');
}
```

- [ ] **Step 3: Run the test**

Run: `node options.test.js`

Expected: all assertions pass plus existing tests continue to pass.

- [ ] **Step 4: Commit**

```bash
git add options.html options.js options.test.js
git commit -m "feat: add provider config + welcome / first-run gate"

Adds Puter sign-in/out and model selection, four BYOK provider sub-cards
with key entry / Test / Clear, and a welcome section gating setupComplete.
Keys live in chrome.storage.local; provider/model selections in
chrome.storage.sync. Includes auto-flip of setupComplete=false when the
active provider's key is cleared or the user signs out of Puter.
```

### Task 5.5: Add `options.css` styling for new sections

**Files:**
- Modify: `options.css`

- [ ] **Step 1: Append styling**

At the end of `options.css`, append:

```css
/* Welcome section */
#welcome-section.hidden { display: none; }
.welcome-body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

/* Provider radio row */
.provider-radio-row {
  display: flex;
  gap: 24px;
  margin-bottom: 16px;
}
.provider-radio-row label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

/* Provider subsections */
.provider-subsection.hidden { display: none; }
.provider-subsection {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
}
.puter-status {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}
.test-result {
  font-size: 14px;
  margin-left: 8px;
}

/* BYOK cards */
.byok-card {
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.byok-card-header { display: flex; align-items: center; gap: 8px; }
.byok-active { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.byok-active-tag {
  font-size: 11px;
  text-transform: uppercase;
  background: rgba(0, 200, 100, 0.15);
  color: #50d090;
  padding: 2px 6px;
  border-radius: 4px;
  display: none;
}
.byok-active input:checked ~ .byok-active-tag { display: inline-block; }
.byok-key-row, .byok-model-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.byok-key-row span:first-child, .byok-model-row span:first-child { width: 64px; opacity: 0.7; }
.byok-key-input {
  display: flex;
  flex: 1;
  gap: 4px;
}
.byok-key {
  flex: 1;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.15);
  background: rgba(0,0,0,0.2);
  color: inherit;
  font-family: monospace;
}
.btn-text {
  background: transparent;
  border: none;
  color: inherit;
  opacity: 0.7;
  cursor: pointer;
  padding: 6px 8px;
}
.byok-actions { display: flex; align-items: center; gap: 8px; }

/* Light mode adjustments */
body.light-mode .provider-subsection { background: rgba(0,0,0,0.03); }
body.light-mode .byok-card { border-color: rgba(0,0,0,0.1); }
body.light-mode .byok-key { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.15); }
```

- [ ] **Step 2: Commit**

```bash
git add options.css
git commit -m "style: add welcome / provider config layout"
```

---

## Cross-Stream Verification

After all five streams have landed, run this verification before declaring v2 done.

### Task V.1: Full test suite

- [ ] **Step 1: Run all root-level tests**

```bash
for f in *.test.js; do
  echo "--- $f ---"
  node "$f" || exit 1
done
```

Expected: all pass.

- [ ] **Step 2: Run all lib tests**

```bash
for f in lib/*.test.js lib/llm/*.test.js lib/llm/byok/*.test.js; do
  echo "--- $f ---"
  node "$f" || exit 1
done
```

Expected: all pass.

### Task V.2: Manual smoke test in Chrome

- [ ] **Step 1: Reload the unpacked extension**

`chrome://extensions` → find Tab Bankruptcy → click reload.

- [ ] **Step 2: First-run gate**

Uninstall the extension completely, then load unpacked again. Expected: a new tab opens to `options.html?welcome=1` with the welcome section visible.

- [ ] **Step 3: Puter happy path**

In options:
- Click "Sign in to Puter" → complete OAuth → status shows "Signed in as ...".
- Pick the cheapest Grok model from dropdown (or accept default).
- Click "Test connection" → expect "✓ OK" (and no Puter credit consumption).
- Click "Finish Setup" → welcome section disappears.

Open the extension popup. Click "Declare Bankruptcy" with ~10 tabs open. Expect clusters render within ~5s.

- [ ] **Step 4: BYOK happy path (use OpenAI as the easiest one)**

In options, switch provider to BYOK. Add an OpenAI API key to the OpenAI card. Click Test → ✓ OK. Click "Finish Setup".

Open popup. Cluster ~10 tabs. Expect clusters render.

- [ ] **Step 5: Out-of-credits Puter path**

In options DevTools console:

```js
const orig = window.puter.ai.chat;
window.puter.ai.chat = async () => {
  const e = new Error('Permission denied'); e.delegate = 'usage-limited-chat'; e.code = 'error_400_from_delegate';
  throw e;
};
```

Switch back to Puter provider. Open popup, click Declare Bankruptcy. Expect the error view with the "out of Puter credits" message and BOTH action buttons working ("Open Puter Dashboard" → opens `puter.com/dashboard`, "Open Settings" → opens options page).

Restore: `window.puter.ai.chat = orig;`.

- [ ] **Step 6: Setup-required gate after sign-out**

In options, while Puter is the active provider, click "Sign out". Open popup → expect the "Set up Tab Bankruptcy first" view with "Open Settings" button.

- [ ] **Step 7: Reading list save still works**

Sign back in / re-finish setup. Cluster tabs. Click "Save & Close" on a cluster. Open Chrome's Reading List (side panel) → expect the saved tabs are present with `[clusterName]` prefix.

- [ ] **Step 8: Undo still works for nuke and save**

Cluster tabs. Click Nuke → in the 5s undo window click Undo → expect tabs reopen. Repeat for Save → click Undo → expect entries removed from Reading List.

### Task V.3: Schedule follow-ups

After the manual smoke test passes:

- [ ] **Step 1: Offer the Puter SDK drift cron**

Tell the user: "Want me to `/schedule` an agent every 90 days to check Puter SDK drift and open a PR if `lib/puter.js` is stale?"

- [ ] **Step 2: Offer the v2-migration cleanup**

Tell the user: "Want me to `/schedule` a one-shot agent in 2 release cycles to delete the `REMOVE-IN-V3:` block in `background.js`?"

---

## Self-Review Notes

Spec coverage check:
- §3.1 (LLM call relocates) → Stream 4 Tasks 4.1–4.3
- §3.2 (new action protocol) → Stream 3 Task 3.3 + Stream 4 Task 4.2
- §4 (manifest changes) → Stream 3 Tasks 3.1, 3.2
- §5.1, §5.2 (storage schema) → consumed by Streams 4, 5 (tests in 4.3, 5.4)
- §6.1–§6.7 (LLM module) → Stream 2 Tasks 2.3–2.13
- §6.8 (Puter quirks guardrails) → encoded in Tasks 2.12 (puter-provider), 2.13 (index)
- §7.1 (onInstalled) → Stream 3 Task 3.3 Step 5
- §7.2 (welcome section) → Stream 5 Tasks 5.2, 5.3
- §7.3 (provider config) → Stream 5 Tasks 5.2, 5.3, 5.5
- §7.4 (edge cases) → Stream 5 Task 5.3 (`maybeFlipSetupCompleteFalse`, sign-out branch in `btn-puter-signout`)
- §8 (legacy removal) → Stream 1 Tasks 1.1–1.4
- §9.1 (Puter update doc) → Stream 2 Task 2.15
- §9.2 (v2 migration doc) → Stream 3 Task 3.5
- §10 (testing) → tests inline with each implementation task
- §11 (dispatching plan) → reflected in stream topology table at top

Type consistency: `clusterTabs(tabs, settings)` signature is used identically across `lib/llm/index.js`, `popup.js` `runClusterFlow`, and the test files. `settings` shape is consistent everywhere.

Placeholder scan: no TBD/TODO/"add appropriate error handling"/"similar to" patterns. Model IDs in `lib/llm/models.js` are the only ones with a documented "verify at impl time" caveat — that's an honest constraint, not a placeholder.

---

## Plan complete.
