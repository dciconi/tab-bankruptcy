# Advanced Bankruptcy Features Implementation Plan

Date: 2026-05-08

## Goals

- Keep BYOK limited to the predetermined provider hosts already listed in the manifest.
- Improve the triage workflow with tab previews, search and filters, action shortcuts, and one-click bankruptcy modes.
- Expand Save & Close destinations beyond Chrome Reading List while preserving Reading List as the default.
- Add a permanent local archive for nuked tabs, searchable from the extension, with restore flows and a deeper undo history.

## Constraints

- This is a plain Manifest V3 extension with no build step.
- The popup is a full tab, not `default_popup`.
- LLM calls happen in `popup.js`; background owns tab mutations, reading-list writes, bookmarks, downloads, and archive storage.
- Arbitrary BYOK hosts are intentionally out of scope because they require broad host permissions that complicate Chrome Web Store review.
- Existing session cache and processed-tab behavior must remain intact.

## Implementation Steps

1. Update permissions.
   - Add required permissions for bookmarks and file downloads.
   - Keep BYOK host permissions restricted to xAI, OpenAI, Anthropic, Google, and Puter.

2. Extend background actions.
   - Enrich tab snapshots with favicon, last-accessed time, and window id while keeping LLM input limited to title/url/id.
   - Add Save & Close destinations: Reading List, Bookmarks, and exports as TXT/CSV/JSON.
   - Add local archive storage for nuked and saved metadata as needed for previews, undo, and restore.
   - Add archive query and restore actions.
   - Track a bounded undo stack, targeting the last 10 actions.

3. Upgrade popup workflow.
   - Add top controls for bankruptcy modes, search, filters, save destination, export format, tags, archive access, and undo.
   - Implement hover preview cards using captured tab metadata.
   - Implement triage filtering without re-running clustering.
   - Add keyboard shortcuts: `N` nuke, `S` save/close, `K` keep, `U` undo last action.
   - Add one-click modes:
     - Quick Nuke: nuke all visible clusters.
     - Smart Save: save all visible clusters using current destination.
     - Archive Everything: save all visible clusters to the permanent archive and close them.
     - Keep Top 10: keep up to the 10 most recently active visible tabs, nuke the rest.

4. Add options for user-defined save tags.
   - Add a tags setting with a comma-separated editable list.

5. Document user-visible changes.
   - Add a concise README Change Log entry for the new workflow, save destinations, and archive.

6. Verify.
   - Run focused Node tests that the repository supports.
   - Manually inspect the popup/options HTML/CSS structure where automated coverage is limited.
