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
