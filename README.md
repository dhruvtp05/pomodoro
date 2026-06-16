<p align="center">
  <img src="extension/assets/icon-128.png" alt="Purrmodoro" width="96" height="96" />
</p>

<h1 align="center">Purrmodoro</h1>

<p align="center">
  <strong>A Pomodoro study companion for Chrome — focus with tab blocking, earn kibble, and keep your cat happy.</strong>
</p>

<p align="center">
  <a href="#install">Install</a> ·
  <a href="#screenshots">Screenshots</a> ·
  <a href="#features">Features</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#chrome-web-store-listing">Store listing</a>
</p>

---

## About

**Purrmodoro** is a Manifest V3 Chrome extension that combines Pomodoro focus sessions with gentle accountability: you choose which sites are allowed, everything else gets blocked until the timer ends. A cat companion reacts to your focus, grows with your progress, and gives you a reason to finish sessions without distractions.

Built for students and anyone who opens “just one more tab” too often.

- **Version:** 1.3.0
- **Manifest:** V3
- **Data:** Everything stays on your device — no accounts, no cloud sync, no analytics

---

## Screenshots

Add PNG or JPG files to [`docs/screenshots/`](docs/screenshots/) using the filenames below, then commit. These paths also work on GitHub and in Chrome Web Store assets.

| | |
|:---:|:---:|
| **Focus popup** — presets, whitelist, cat stats | **Side panel** — live timer & companion |
| ![Focus popup](docs/screenshots/popup.png) | ![Side panel](docs/screenshots/sidepanel.png) |
| **Stats** — history, daily summary, streak | **Shop** — unlock cat breeds with kibble |
| ![Stats](docs/screenshots/stats.png) | ![Shop](docs/screenshots/shop.png) |
| **Blocked page** — shown when visiting a non-allowed site during focus | **Onboarding** — first-run setup |
| ![Blocked page](docs/screenshots/blocked.png) | ![Onboarding](docs/screenshots/onboarding.png) |

**Recommended capture size:** 1280×800 (store) or 1280×720 (README). Chrome: open the popup or side panel → right-click → Inspect → device toolbar, or use a screenshot tool.

**Files to add:**

| File | What to capture |
|------|-----------------|
| `docs/screenshots/popup.png` | Main popup with cat panel, presets, and allowed sites |
| `docs/screenshots/sidepanel.png` | Side panel during an active session |
| `docs/screenshots/stats.png` | Stats page with session history |
| `docs/screenshots/shop.png` | Cat shop with breeds |
| `docs/screenshots/blocked.png` | Blocked tab warning during focus |
| `docs/screenshots/onboarding.png` | First-run onboarding (optional) |

---

## Features

### Focus & breaks
- **Pomodoro presets** — 25 / 50 / 90 min focus; 5 / 15 min breaks
- **Custom duration** — any length from 1–180 minutes
- **Auto break** — optional 5-minute break after a completed focus session
- **Background timer** — sessions keep running when the popup is closed

### Tab blocking
- **URL-pattern whitelist** — pick allowed sites from your open tabs before each session
- **Smart blocking** — non-whitelisted navigation redirects to a friendly blocked page
- **Breaks are free** — blocking pauses during break sessions so you can relax

### Cat companion
- **Live mood** — happy, neutral, or sad based on focus and interruptions
- **Kibble & levels** — complete uninterrupted focus sessions to earn rewards
- **9 breeds** — Tabby (free), Siamese, Persian, Bengal, Maine Coon, Ragdoll, Scottish Fold, Russian Blue, Abyssinian
- **Side panel** — keep your cat and timer visible while you work

### Progress & habits
- **Daily streak** — build a streak with perfect (zero-interruption) focus sessions
- **Session history** — review past sessions with duration, interruptions, and kibble earned
- **Daily stats** — sessions completed, focus minutes, and interruptions at a glance

### Polish
- **Notifications** — alerts when focus or break sessions end (optional sound)
- **Onboarding** — quick first-run tour for new users

---

## How it works

1. **Open Purrmodoro** from the toolbar and pick focus length (or a break).
2. **Select allowed websites** from your open tabs — only those patterns stay reachable during focus.
3. **Start the session** — the timer runs in the background; your cat’s mood updates as you go.
4. **Stay on task** — visiting other sites shows the blocked page and counts as an interruption.
5. **Finish clean** — uninterrupted focus earns kibble, levels your cat, and extends your streak.
6. **Take a break** — blocking turns off; mood recovers while you browse freely.

---

## Install

### From source (development)

1. Clone this repository
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the `extension` folder
6. Reload the extension after pulling updates

### Chrome Web Store

_Coming soon — link will go here after publication._

---

## Chrome Web Store listing

Copy-paste ready text for your store submission.

### Short description (≤132 characters)

```
Pomodoro focus timer with tab blocking and a cat companion. Earn kibble, build streaks, and stay on task.
```

_Char count: 103_

### Detailed description

```
Stay focused with Purrmodoro — a Pomodoro timer that blocks distracting tabs while a cat companion cheers you on.

HOW IT WORKS
• Start a focus session and choose which websites you’re allowed to visit
• Every other tab is blocked until the timer ends
• Complete sessions without interruptions to earn kibble and level up your cat
• Take breaks when you need them — blocking pauses automatically

FEATURES
• Focus presets (25 / 50 / 90 min) and custom durations
• Optional auto-break after focus sessions
• URL-pattern whitelist — pick allowed sites from your open tabs
• Side panel companion with live mood
• 9 unlockable cat breeds in the shop
• Daily streaks for perfect focus sessions
• Session history and daily stats
• Desktop notifications when sessions end

PRIVACY
All data is stored locally on your device. Purrmodoro does not collect, sell, or transmit your browsing data to any server.

Perfect for students, remote workers, and anyone fighting tab overload.
```

### Suggested category

**Productivity**

### Keywords

`pomodoro`, `focus`, `study`, `tab blocker`, `productivity`, `timer`, `distraction blocker`

---

## Privacy

Purrmodoro stores session history, stats, cat progress, and settings **locally** in `chrome.storage.local`. Tab URLs are used only to build your session whitelist and enforce blocking during active focus sessions. Nothing is sent to external servers.

A hosted privacy policy URL is required for Chrome Web Store submission — add `docs/privacy.md` or a `privacy.html` page when you publish.

---

## Project structure

```
extension/
├── manifest.json
├── background/
│   └── service-worker.js      # Sessions, blocking, notifications, storage
├── pages/
│   ├── popup/                 # Main popup — timer, whitelist, cat panel
│   ├── sidepanel/             # Companion side panel
│   ├── stats/                 # Session history & daily stats
│   ├── shop/                  # Cat breed shop
│   └── blocked/               # Blocked-tab warning page
├── lib/
│   ├── assets.js              # Extension asset URL helper
│   ├── cats.js                # Breed data & mood sprites
│   ├── nav.js                 # Shared page navigation
│   ├── settings.js            # User settings defaults
│   ├── stats.js               # Stats formatting helpers
│   ├── streak.js              # Daily streak logic
│   └── urlWhitelist.js        # URL pattern matching
├── styles/                    # Page-specific CSS
└── assets/
    ├── cats/                  # Breed mood SVG sprites
    ├── icons/                 # UI icons
    └── icon-*.png             # Extension icons (16 / 48 / 128)
```

---

## Tech stack

- **Chrome Extension Manifest V3**
- Vanilla HTML, CSS, and JavaScript (no build step)
- `chrome.storage.local` for persistence
- `chrome.alarms` for background timers
- `chrome.webNavigation` + `chrome.tabs` for whitelist blocking

---

## Permissions

| Permission | Why |
|------------|-----|
| `tabs` | List open tabs for whitelist selection; detect tab switches during focus |
| `webNavigation` | Redirect non-whitelisted pages during focus sessions |
| `<all_urls>` | Block navigation on any site during an active session |
| `storage` | Save sessions, stats, cat progress, and settings locally |
| `alarms` | Run the timer when the popup is closed |
| `notifications` | Alert when focus or break sessions complete |
| `sidePanel` | Show the companion panel alongside your browsing |

---

## Development

After editing files under `extension/`:

1. Go to `chrome://extensions`
2. Click the **Reload** button on Purrmodoro
3. Re-open the popup or side panel to see changes

**Reset onboarding:** In popup DevTools → Application → Local Storage → remove `onboardingComplete`, or reinstall the extension.

**Package for store upload:** Zip the contents of the `extension/` folder (not the repo root).

---

## License

_Add a license file (e.g. MIT) before open-sourcing publicly if you plan to accept contributions._

---

## Contributing

Issues and pull requests welcome once a license is added. For bugs, include Chrome version, steps to reproduce, and screenshots if possible.
