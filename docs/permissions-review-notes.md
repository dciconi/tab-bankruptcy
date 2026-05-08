# Permissions Review Notes

Date: 2026-05-08

This file tracks the Chrome extension permissions used by Tab Bankruptcy and the reason each one is required for Chrome Web Store review.

## API Permissions

| Permission | Used For | Why It Is Required |
| --- | --- | --- |
| `tabs` | Reading open tab metadata, grouping tabs, closing selected tabs, reopening restored tabs. | The core feature clusters and triages the user's current tabs. The extension needs tab IDs, titles, URLs, favicons, window IDs, and last active timestamps to display clusters, previews, archive records, and restore actions. |
| `activeTab` | Capturing a preview screenshot for an active tab on hover when Chrome allows it. | Hover previews include a screenshot only for tabs Chrome permits the extension to capture. Inactive tabs fall back to metadata previews. |
| `storage` | Saving settings, BYOK key records, cached cluster state, processed tab IDs, permanent archive entries, and undo history. | The extension must remember provider settings, user-defined tags, archive contents, and recent actions across popup sessions. |
| `tabGroups` | Creating native Chrome tab groups for generated clusters. | Clustered tabs are grouped in Chrome so users can visually inspect and manage them outside the extension page. |
| `readingList` | Saving tabs to Chrome Reading List. | Reading List is the default Save & Close destination. |
| `bookmarks` | Saving tabs to bookmark folders such as `Bankrupted - May 2026`. | Users can choose Bookmarks as an alternate Save & Close destination. |
| `downloads` | Exporting saved tab lists as `.txt`, `.csv`, or `.json`. | Users can choose Export as a Save & Close destination, which writes a local file through Chrome downloads. |
| `windows` | Restoring archived tabs into a new window. | The archive restore workflow supports restoring to the current window or opening restored tabs in a new Chrome window. |

## Required Host Permissions

| Host Permission | Used For | Why It Is Required |
| --- | --- | --- |
| `https://api.x.ai/*` | BYOK requests to xAI/Grok. | Users who choose BYOK with xAI send tab-clustering prompts directly to xAI using their own API key. |
| `https://api.openai.com/*` | BYOK requests to OpenAI. | Users who choose BYOK with OpenAI send tab-clustering prompts directly to OpenAI using their own API key. |
| `https://api.anthropic.com/*` | BYOK requests to Anthropic. | Users who choose BYOK with Anthropic send tab-clustering prompts directly to Anthropic using their own API key. |
| `https://generativelanguage.googleapis.com/*` | BYOK requests to Google Gemini. | Users who choose BYOK with Gemini send tab-clustering prompts directly to Google using their own API key. |
| `https://api.puter.com/*` | Puter AI calls and Puter account/session checks. | Puter is the default provider option and requires API access for sign-in checks and model calls. |
| `https://*.puter.com/*` | Puter SDK support traffic. | The vendored Puter SDK may contact Puter subdomains for account and model service traffic. |

## Content Security Policy Network Allowances

The extension page CSP allows `connect-src` to:

- `self`
- `https://api.x.ai`
- `https://api.openai.com`
- `https://api.anthropic.com`
- `https://generativelanguage.googleapis.com`
- `https://api.puter.com`
- `https://*.puter.com`
- `wss://api.puter.com`
- `wss://*.puter.com`

BYOK network access is intentionally limited to the predetermined provider hosts listed above. Custom arbitrary API hosts are not supported because they would require broader host permissions.

## Data Handling Summary

- BYOK keys are stored locally in `chrome.storage.local`.
- Tab titles and URLs are sent to the selected AI provider only when the user starts clustering.
- The permanent archive is stored locally in `chrome.storage.local`.
- Reading List, Bookmarks, Downloads, and restore actions run only after explicit user actions in the triage workflow.
- The extension does not run content scripts and does not read page contents.
