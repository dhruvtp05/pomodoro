# Purrmodoro

**Pomodoro Study App** — a Chrome extension for focus sessions with tab blocking and a cat companion.

## Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `extension` folder
5. Reload the extension after updates

## Project structure

```
extension/
├── manifest.json
├── background/
│   └── service-worker.js      # Session logic, tab blocking, storage
├── pages/
│   ├── popup/                 # Main popup UI
│   ├── sidepanel/             # Companion side panel
│   ├── stats/                 # Session history & daily stats
│   ├── shop/                  # Cat breed shop
│   └── blocked/               # Blocked-tab warning page
├── lib/
│   ├── assets.js              # Extension asset URL helper
│   ├── cats.js                # Breed data & sprite paths
│   ├── stats.js               # Stats formatting helpers
│   └── urlWhitelist.js        # URL pattern matching
├── styles/
│   ├── common.css             # Shared UI styles
│   ├── popup.css
│   ├── sidepanel.css
│   ├── stats.css
│   ├── shop.css
│   └── blocked.css
└── assets/
    ├── cats/                  # Breed mood sprites
    ├── icons/                 # UI & app mark icons
    └── icon-*.png             # Extension icons
```

## Features

- Focus sessions with URL-pattern whitelisting
- Tab blocking for non-whitelisted sites
- Side panel cat companion with live mood
- 9 cat breeds with happy / neutral / sad sprites
- Session history, daily stats, and kibble shop
