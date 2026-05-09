# Future Features

Ideas considered and intentionally deferred. Each entry notes why it's
parked so we don't relitigate the same trade-off later.

## Bookmarks destination for Save & Close

Today, **Save & Close** writes to Chrome's built-in Reading List. Adding
Bookmarks as a second destination — auto-creating folders like
*"Bankrupted – May 2026"* — would require the `bookmarks` permission and
a new install-time disclosure ("Read and change your bookmarks").

**Status:** deferred. Revisit once the v2 stable cut is shipped and we
have telemetry on whether testers actually want a second destination.

## Smart Save mode

A one-click "Bankruptcy Mode" that asks the LLM to triage your tabs
directly into `{keep, save, nuke}` instead of into named clusters, then
applies the result without a triage step.

**Status:** deferred. It changes the LLM response contract for all five
provider adapters (Puter + 4 BYOK), which is a meaningful surface to
test. The deterministic Bankruptcy Modes (Quick Nuke / Archive
Everything / Keep Top 10) ship first.

## Smart tagging on Save

A user-editable tag list in Settings (e.g. "Work", "Research", "Later")
that surfaces as a per-cluster picker before Save, then folds the
selected tag into the Reading List title prefix
(`[ClusterName · #tag]`).

**Status:** deferred. The Save flow already prefixes with the cluster
name; adding a manual tag step is friction without a clear win until
the archive view exists to filter on it.

## Tab preview screenshots on hover

Killed, not deferred. Chrome's `tabs.captureVisibleTab` only captures
the **active** tab — it cannot screenshot background tabs, so the
"hover any tab → see a thumbnail" UX isn't deliverable with the current
extension API surface. Favicon + last-active time is the substitute.
