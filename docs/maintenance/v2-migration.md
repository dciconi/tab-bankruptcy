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
