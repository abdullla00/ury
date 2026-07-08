# URYMosaic — Agent Documentation

## Overview

**URYMosaic** is the Vue 3 Kitchen Display System (KDS) for URY. It shows live Kitchen Order Tickets (KOTs) for a production unit (Kitchen, Bar, Expo) and lets staff serve, recall, mark ready, and manage wall-mode TV displays.

- **URL:** `/URYMosaic/<production_unit>` (e.g. `/URYMosaic/Kitchen`, `/URYMosaic/Expo`)
- **Frappe page:** `ury/www/URYMosaic.html`
- **Build output:** `ury/public/URYMosaic/`

Prep/billing UX lives here only. The React POS **Orders** tab remains billing-focused; POS only links out via **Open KDS** toasts.

---

## Tech Stack

| Concern | Library |
|---|---|
| UI | Vue 3 (Composition API + `<script setup>`) |
| Build | Vite 4 |
| Real-time | socket.io-client 4 |
| Styling | Tailwind CSS 3 |
| Backend | frappe-js-sdk |
| Routing | vue-router 4 (`createWebHistory('/URYMosaic/')`) |
| i18n | `src/locales/{en,ar,fr}.json` via `mosaic-i18n.js` |

---

## Project Structure

```
URYMosaic/
├── src/
│   ├── main.js
│   ├── App.vue                 ← <router-view />
│   ├── router/index.js         ← /:production? → KotBoard
│   ├── components/
│   │   ├── KotBoard.vue        ← Root board (tabs, wall mode, socket)
│   │   ├── KotCard*.vue        ← Card, header, items, menu
│   │   ├── KotServeSheet.vue   ← Serve / confirm cancel
│   │   ├── KotRecallSheet.vue
│   │   ├── KotStatusTabs.vue
│   │   ├── KotStationSwitcher.vue
│   │   ├── KotStatsBar.vue
│   │   ├── KotToolbar.vue
│   │   ├── KotSettingsPanel.vue
│   │   ├── KotOnboarding.vue
│   │   ├── KotAudioGate.vue
│   │   ├── KotConnectionBadge.vue
│   │   ├── KotLoginModal.vue
│   │   └── KotToast.vue
│   ├── composables/
│   │   ├── useKotData.js       ← kot_list, ready_kot_list, expo filter
│   │   ├── useKotSocket.js     ← socket + 30s poll fallback
│   │   ├── useKotTimer.js      ← elapsed / delay notify
│   │   ├── useKotActions.js    ← serve, recall, mark ready, item ready
│   │   └── useKotCardStyle.js
│   ├── utils/
│   │   ├── frappe-client.js
│   │   ├── kot-format.js
│   │   ├── mosaic-settings.js
│   │   └── mosaic-i18n.js
│   └── locales/{en,ar,fr}.json
├── e2e/                        ← Playwright smoke tests
├── QA.md                       ← Manual 23-step verification matrix
├── index.html
├── vite.config.js
└── package.json
```

---

## Key APIs (`ury.ury.api.ury_kot_display`)

| Endpoint | Purpose |
|---|---|
| `kot_list` | Active KOTs + branch meta (alert time, audio, reprint) |
| `ready_kot_list` | Tickets in Ready status |
| `serve_kot` | Mark served (from Ready or To cook) |
| `confirm_cancel_kot` | Acknowledge cancellation |
| `recall_kot` | Move served ticket back to To cook |
| `mark_kot_ready` | Move ticket to Ready tab |
| `mark_kot_item_ready` | Per-item `marked_ready` on server |
| `get_production_units` | Station switcher list |

Socket channel: `kot_update_{branch}_{production}` — must match backend publish in `ury_kot.py`.

---

## Tabs & Keyboard

| Key | Action |
|---|---|
| `1` | All |
| `2` | To cook |
| `3` | Ready |
| `4` | Completed |
| `w` | Toggle wall mode |
| `/` | Focus search |
| `Enter` | Open serve sheet |
| `r` (Completed) | Recall |
| Arrows | Navigate cards |

---

## Settings (localStorage via `mosaic-settings.js`)

- Wall default, station switcher, font size (normal/large)
- Locale (`mosaicLocale` in `mosaic-i18n.js`): en / ar / fr with RTL for Arabic
- Pinned KOTs, onboarding done, audio gate

---

## Build & Test

```bash
# From bench root
yarn ury-mosaic-build

# From URYMosaic/
yarn build
yarn playwright test   # requires MOSAIC_BASE_URL (default http://localhost:8004/URYMosaic/Kitchen)
```

---

## Safe Modification Rules

1. **Do not change socket channel naming** without updating `publish_kot_realtime_for_name` in `ury_kot.py`.
2. **Production unit in URL** is case-sensitive and must match `URY Production Unit` doctype names.
3. **Expo mode** (`/URYMosaic/Expo`) shows all stations — filter is client-side in `useKotData.js`.
4. **Authentication:** unauthenticated users see `KotLoginModal`; redirect `/login?redirect-to=URYMosaic/{production}`.
5. **POS handoff:** `OrderPanel` and guest `TableOrder` open `/URYMosaic/{kds_production_unit}` from branch/POS profile config.
