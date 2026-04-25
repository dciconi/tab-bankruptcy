# Tab Bankruptcy — Chrome Extension

One-click AI clustering and triage for your open tabs. Declare bankruptcy on tab debt.

![Tab Bankruptcy](../assets/mascot_reaper.png)

---

## Features

| Feature | Description |
|---------|-------------|
| 🪦 **Declare Bankruptcy** | One click sends all tabs to Grok for clustering |
| 🗂️ **Smart Clusters** | Tabs grouped by topic with witty names + emojis |
| ✅ **Keep** | Leave tabs open (green checkmark) |
| 📥 **Save & Close** | Persist cluster to a named reading list |
| 💥 **Nuke** | Close immediately with particle explosion |
| 🔁 **Undo Toast** | 5-second undo window after any action |
| 🎉 **Confetti** | Celebration on completing all clusters |
| 🔊 **Sound Effects** | Web Audio: click, whoosh, cha-ching, fanfare |
| 📚 **Reading Lists** | IndexedDB storage, "Open All" in Settings |
| ⌨️ **Keyboard Nav** | Tab/Arrows, K/S/N, Enter to expand |
| ♿ **Accessibility** | ARIA labels, focus states, reduced motion |

---

## Installation

### Load Unpacked (Developer Mode)

1. Open **chrome://extensions**
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `tab-bankruptcy/` folder (this directory)
5. Pin the extension to your toolbar

### First Run

1. Open 8–12 mixed tabs (work, shopping, fun)
2. Click the extension icon
3. See tab count + **"Declare Bankruptcy"** button
4. Click → Loading (≤4s) → Triage view with ClusterCards
5. Try Keep / Save / Nuke on clusters
6. Resolve all → Confetti + Bankruptcy Receipt

---

## Architecture

```
popup.html/js/css  ← UI (Idle → Loading → Triage → Completion)
        ↕ chrome.runtime.sendMessage
background.js       ← Service worker: tab query → proxy /cluster → actions
        ↓ POST {tabs}
Proxy (https://autoqa.teachx.ai/...)
        ↓ calls xAI Grok
        ← returns {clusters: [...]}
lib/
  audio.js          ← Web Audio API (no audio files)
  storage.js        ← IndexedDB reading lists CRUD
```

**Key points:**

- **Manifest V3** — service worker, no background page
- **Proxy API** — extension never touches `api.x.ai` directly (no key exposure)
- **CSP** — `script-src 'self'; object-src 'none'; connect-src 'self' https://autoqa.teachx.ai`
- **Permissions** — `tabs`, `storage`, `tabGroups`

See root [context.md](../context.md) for proxy contract details.

---

## File Structure

```
tab-bankruptcy/
├── manifest.json          # MV3 manifest (permissions, CSP, icons)
├── background.js          # onMessage handlers: cluster/keep/nuke/save/resume
├── background.test.js
├── popup.html             # 4 views: idle, loading, triage, completion
├── popup.js               # State machine, ClusterCard render, button handlers
├── popup.css              # Dark theme, animations, confetti, reduced-motion
├── popup.test.js
├── options.html           # Settings: model info, prompt editor, reading lists
├── options.js             # chrome.storage.sync + IndexedDB via background
├── options.css
├── options.test.js
├── lib/
│   ├── audio.js           # playClick, playNuke, playKeep, playSave, playCompletion
│   ├── audio.test.js
│   ├── storage.js         # saveReadingList, getReadingLists, deleteReadingList
│   └── storage.test.js
├── assets/icons/
│   ├── icon48.png
│   └── icon128.png
├── manifest.test.js
├── popup.css.test.js
└── test/fixtures/         # mock tab data
```

---

## Development

### Run Tests

```bash
# From tab-bankruptcy/ or project root
node background.test.js
node popup.test.js
node lib/storage.test.js
node lib/audio.test.js
```

Tests use Node + mocks (chrome.* APIs are mocked). Some async tests may show env limitations — the runtime code is correct.

### Key Constants

| Constant | Value |
|----------|-------|
| `PROXY_URL` (background.js) | `https://autoqa.teachx.ai/hackathon/preview/chapter-11/cluster` |
| Proxy contract | `POST {tabs:[...]}` → `GET {clusters:[{name,emoji,tabIds,vibe,confidence}]}` |
| Loading messages | 4 escalating: "Scanning…", "You monster…", "This is for your own good.", "POOF." |
| Undo window | 5 seconds |

### Build

No compilation step — the extension is plain HTML/CSS/JS.

**To package:**

```bash
# Zip for distribution (exclude tests)
zip -r tab-bankruptcy.zip . -x "*.test.js" "test/*"
```

**Or pack in Chrome:**

1. `chrome://extensions` → **Pack extension**
2. Select this folder → produces `.crx`

Upload the zip or crx to the Chrome Web Store via Developer Dashboard.

---

## Proxy API (for reference)

**Request:**

```json
POST /cluster
{
  "tabs": [
    {"id": 1, "title": "React Docs", "url": "https://react.dev", ...}
  ]
}
```

**Response:**

```json
{
  "clusters": [
    {
      "name": "React Hook Wizards",
      "emoji": "🪝",
      "tabIds": [1, 2, 3],
      "vibe": "Deep dives into useState and useEffect",
      "confidence": 0.92
    }
  ]
}
```

The proxy holds `XAI_API_KEY` server-side. Extension never sees it.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Extension doesn't load | Check `chrome://extensions` for errors; reload manifest |
| No clusters appear | Verify proxy is running; check DevTools Console in background |
| Sound doesn't play | Check mute toggle in Settings; browser may block autoplay |
| Reading lists empty | IndexedDB created on first Save; check browser storage settings |
| Keyboard nav not working | Focus must be on popup (click into it first) |

---

## License

Hackathon project — internal use.

---

**Version:** 1.0.0  
**Manifest:** MV3  
**Last updated:** 2026-04-11
