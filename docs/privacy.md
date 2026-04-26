---
layout: default
title: Privacy Policy
description: What Tab Bankruptcy does (and doesn't) with your data
permalink: /privacy/
---

<!-- IMPORTANT: This file is published as the canonical privacy policy at
     https://dciconi.github.io/tab-bankruptcy/privacy/ via GitHub Pages.
     A byte-for-byte copy below the frontmatter is also kept at the repo
     root (PRIVACY.md) so it ships inside the extension zip. The privacy-
     sync-test in manifest.test.js fails CI if the two diverge. Edit
     both, or edit one and copy. -->

# Tab Bankruptcy — Privacy Policy

**Last updated:** 2026-04-26

## Summary

Tab Bankruptcy is a Chrome extension that clusters your open tabs into thematic groups using an AI provider you choose. The developer of this extension does **not** operate any backend server, does **not** collect telemetry, and does **not** receive your data. Your tab metadata and any API keys you provide stay on your device, except for the request you explicitly send to your chosen AI provider when you click "Declare Bankruptcy".

## Data the extension handles

The extension reads the following data **on your device** in order to function:

| Data | When | Where it stays | Why |
|---|---|---|---|
| Open tab URLs and titles | When you click "Declare Bankruptcy" | Sent to your chosen AI provider for clustering; stored in `chrome.storage.session` while triage is open | The AI needs the titles + URLs to group similar tabs |
| Pinned/Chrome internal tabs | Always | Filtered out before any data leaves the extension | Privacy + relevance |
| Saved BYOK API keys | When you save them in Settings | `chrome.storage.local` only (per-device, never synced via Chrome Sync) | Auth for direct LLM calls |
| Puter session cookies | When you sign in to Puter | Managed by puter.com on its own domain | Auth for Puter SDK calls |
| Cluster results | Across triage UI | `chrome.storage.session` (cleared when Chrome closes); cleared on Reset | Recovery if you reopen the popup |
| Action history (kept / saved / nuked tab IDs) | Across triage | `chrome.storage.session`; cleared on Reset | Don't re-cluster tabs you already triaged |
| Settings (provider, model, theme, sound, custom prompt) | When you change them | `chrome.storage.sync` — these CAN sync across your Chrome profiles | Convenience |

## Data sent off your device

When you click "Declare Bankruptcy", the extension sends one HTTPS request containing your filtered tab data to **one** of the following providers, depending on which you've selected in Settings:

- **Puter** (default): `https://api.puter.com/drivers/call`
- **xAI**: `https://api.x.ai/v1/chat/completions`
- **OpenAI**: `https://api.openai.com/v1/chat/completions`
- **Anthropic**: `https://api.anthropic.com/v1/messages`
- **Google**: `https://generativelanguage.googleapis.com/v1beta/models/...`

The request body contains, for each open tab: `id`, `title`, `url`. Nothing else — no cookies, no browsing history, no form data, no credentials beyond the API key needed to authenticate the request itself.

The provider you've chosen processes that request under **their** privacy policy:

- Puter: <https://puter.com/privacy>
- xAI: <https://x.ai/legal/privacy-policy>
- OpenAI: <https://openai.com/policies/privacy-policy>
- Anthropic: <https://www.anthropic.com/legal/privacy>
- Google: <https://policies.google.com/privacy>

The developer of Tab Bankruptcy receives no part of this request and has no access to your responses.

## Data the developer collects

**None.** There is no telemetry, no analytics, no error reporting, and no backend server. The developer cannot see who installed the extension, how often it's used, or what tabs you cluster.

## Third-party SDK

The extension bundles a vendored copy of the [Puter.js](https://puter.com) SDK (AGPL-3.0) at `lib/puter.js`. When you choose "Puter" as your provider, this SDK opens an authenticated session with `api.puter.com`. The SDK may also open a Socket.IO connection to `wss://api.puter.com` for real-time events from features the extension does not use; this connection is governed by Puter's own privacy practices.

## Permissions and why we ask for them

| Permission | Used for |
|---|---|
| `tabs` | Read open tab titles + URLs to send to the AI; close tabs on "Nuke"; update active tab on actions |
| `tabGroups` | Render returned clusters as native Chrome tab groups |
| `storage` | Persist your settings, BYOK keys (local only), and triage state |
| `alarms` | Keep the service worker alive during the LLM call (otherwise MV3 idles it mid-request) |
| `readingList` | Save URLs to Chrome's built-in Reading List on "Save & Close" |
| `host_permissions` for the five LLM-provider hosts | The `fetch` calls themselves; without these the request is blocked |

## Limited Use disclosure

Tab Bankruptcy uses the data described above **only** to provide the user-facing clustering functionality. The data is not sold, not used for advertising, not used to train models on the developer's behalf, and not retained by the developer. The data flow is:

> User opens the popup → user clicks "Declare Bankruptcy" → extension sends tab metadata to the AI provider the user selected → provider returns clusters → extension displays clusters → user triages → state persists in browser-local storage until cleared.

The extension does not transmit user data to any party other than the user's chosen LLM provider.

## Reset and deletion

Click **Reset everything** in the options page to wipe every preference, BYOK key, Puter session, cached cluster, and triage history from this device. The reset is local; it does not affect data already received by the LLM provider you chose, which is governed by their retention policy.

## Contact

Issues, questions, or removal requests: open an issue at <https://github.com/dciconi/tab-bankruptcy/issues>.

## Changes to this policy

If this policy changes, the new version will be committed to this repository and the **Last updated** date above will reflect the change.
