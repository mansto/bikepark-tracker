<div align="center">

# 🚵 Bikepark Tracker

**A sleek PWA for tracking bikepark ticket purchases per season — with Gravity Card amortization tracking and multi-user accounts.**

![PWA](https://img.shields.io/badge/PWA-ready-blueviolet?style=flat-square&logo=googlechrome)
![Vanilla JS](https://img.shields.io/badge/Vanilla-JS-f7df1e?style=flat-square&logo=javascript&logoColor=black)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-f38020?style=flat-square&logo=cloudflare&logoColor=white)
![GitHub Pages](https://img.shields.io/badge/GitHub-Pages-222?style=flat-square&logo=github)

</div>

---

## ✨ Features

| | |
|---|---|
| 🎿 **Ticket Counters** | Create custom ticket categories with color-coding and per-ticket pricing |
| 📅 **Season Management** | Organize tickets by season, switch between years, import tickets from previous seasons |
| 💰 **Gravity Card Tracking** | Set your Gravity Card price per season and track amortization status in real time |
| 🎫 **Mixed Ticket Types** | Support for both Gravity Card tickets and regular tickets — each tracked separately |
| 🔐 **User Accounts** | Login with username and password — each user sees only their own data |
| 🔄 **Real-time Sync** | Background polling keeps data synced across multiple devices |
| 📱 **Installable PWA** | Add to home screen on iOS and Android for a native app experience |
| ☁️ **Cloud Storage** | All data stored in Cloudflare KV — reliable across browser restarts and devices |

---

## 📸 App Overview

```
┌─────────────────────────────────────────┐
│   🔐 Login                              │  Username + password (admin-managed)
├─────────────────────────────────────────┤
│   📅 Season Selector                    │  Switch between years · manage seasons
├─────────────────────────────────────────┤
│   📊 Statistics Panel                   │  Total spent · Gravity Card vs regular tickets
│                                         │  Gravity Card amortization status (color-coded)
├─────────────────────────────────────────┤
│   🎿 Ticket Cards                       │  Per-ticket counter with GC/NORMAL badge
│                                         │  Color-coded · increment / decrement
└─────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Language | Vanilla JavaScript (ES2020+) |
| UI | HTML5 + CSS3, single-file SPA |
| Storage | Cloudflare Workers + KV (per-user data isolation) |
| Auth | PBKDF2-SHA-256 passwords · session tokens in KV (7-day TTL) |
| PWA | Service Worker (cache-first) + Web App Manifest |
| Build | Node.js build script — injects `API_URL` at build time |
| CI/CD | GitHub Actions → GitHub Pages |
| Fonts | Google Fonts — Bebas Neue, IBM Plex Mono |

---

## 📁 Project Structure

```
├── src/
│   ├── index.html      # Application (HTML + CSS + JS), uses __API_URL__ placeholder
│   ├── manifest.json   # PWA manifest
│   ├── sw.js           # Service Worker
│   ├── icon-192.jpg    # App icon
│   └── icon-512.jpg    # App icon (large)
├── dist/               # Built output (gitignored) — deployed to GitHub Pages
├── tools/              # Local admin scripts (gitignored)
│   └── manage.sh       # User management: create / delete / reset-password
├── worker.js           # Cloudflare Worker (auth endpoints + KV storage)
├── wrangler.toml       # Cloudflare Workers configuration
├── build.js            # Build script: injects API_URL + copies assets to dist/
├── package.json
├── .env.example        # Template for local development
└── .github/
    └── workflows/
        └── deploy.yml  # CI/CD: build + deploy to gh-pages on push to main
```

---

## 🗂️ Data Model

### Season Structure

```javascript
{
  seasons: {
    2024: {
      year: 2024,
      categories: [
        {
          id: "cat_abc123",
          name: "Example Bikepark Day Ticket",
          color: "#3a7bc0",
          price: 35,
          count: 5,
          sum: 175,
          reducesTheCurrentTotalOfTheGravityCardPrice: true  // GC ticket
        },
        {
          id: "cat_def456",
          name: "Another Park Half-Day Ticket",
          color: "#c0703a",
          price: 55,
          count: 2,
          sum: 110,
          reducesTheCurrentTotalOfTheGravityCardPrice: false  // Regular ticket
        }
      ],
      budget: {
        start: 599,   // Gravity Card price
        spent: 175    // Sum of all GC tickets (calculated)
      }
    },
    2025: { /* ... */ }
  },
  activeSeason: 2024
}
```

### Ticket Category Fields

- `id` — unique identifier (generated on creation)
- `name` — display name
- `color` — hex color from predefined palette
- `price` — cost per ticket in €
- `count` — number of times this ticket was used
- `sum` — total spending for this ticket (`price × count`)
- `reducesTheCurrentTotalOfTheGravityCardPrice` — boolean flag
  - `true` (default) — ticket counts toward Gravity Card amortization
  - `false` — regular ticket, tracked separately

---

## ☁️ Cloudflare Workers Setup

The app backend runs as a Cloudflare Worker with KV storage. All user accounts and app data are stored there.

### First-time setup

**1. Install Wrangler and log in**
```bash
npm install -g wrangler
wrangler login
```

**2. Create the KV namespace**
```bash
wrangler kv namespace create GRAVITY_KV
```
Copy the returned `id` into `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "GRAVITY_KV"
id = "your-kv-id-here"
```

**3. Deploy the Worker**
```bash
wrangler deploy
```
Note the Worker URL printed at the end — you'll need it as the `API_URL` secret.

### Worker API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/login` | — | Authenticate, receive session token |
| `POST` | `/logout` | session | Invalidate session |
| `GET` | `/` | session | Load the authenticated user's data |
| `PUT` | `/` | session | Save the authenticated user's data |

### KV data structure

```
users:{username}       → account (passwordHash, userId, createdAt)
user-data:{userId}     → app data ({ seasons: { [year]: { year, categories, budget } }, activeSeason })
sessions:{token}       → session record (7-day TTL)
```

---

## 🚀 Deployment (GitHub Actions)

On every push to `main`, GitHub Actions builds the app and deploys it to the `gh-pages` branch.

### Required GitHub Repository Secret

Go to **Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|--------|-------|
| `API_URL` | Worker URL from `wrangler deploy` |

### GitHub Pages configuration

After the first successful workflow run, go to **Settings → Pages** and set the source branch to `gh-pages`.

---

## 💻 Local Development

**1. Copy and fill in `.env`**
```bash
cp .env.example .env
# edit .env: set API_URL to your Worker URL
```

**2. Build**
```bash
npm install
npm run build
```

**3. Serve `dist/`**
```bash
npx serve dist
```

---

## 🔐 User Accounts

User registration and password management are handled via the local admin script (`tools/manage.sh`, not in repo) — there is no self-service registration in the app UI.

- **Login** — session token stored in `localStorage` with 7-day TTL
- **Logout** — button in the app header; invalidates the session on the server
- **Data isolation** — each user account has its own data; no cross-user access
- **Real-time sync** — background polling every 10 seconds keeps data synchronized across devices (only when tab is visible and no pending saves)

---

## 📅 Seasons

Organize your tickets by season (year). Each season has its own:

- **Ticket categories** — create tickets specific to that season
- **Gravity Card price** — set once per season
- **Statistics** — track spending and amortization status per season

**Season Management:**
- Create new seasons with optional ticket import from previous years
- Switch between seasons using prev/next buttons or the season manager
- Edit season details (year, Gravity Card price)
- Delete unused seasons (cannot delete the active season if it's the only one)

---

## 🎿 Tickets

Each ticket has:

- **Name** — e.g. *Day Ticket*, *Half-Day Ticket*
- **Color** — pick from 8 accent colors
- **Ticket price** — cost per ticket in €
- **Gravity Card flag** — checkbox indicating if this ticket counts toward Gravity Card amortization
  - **GC badge** (green) — ticket reduces Gravity Card balance
  - **NORMAL badge** (red) — regular ticket, tracked separately

Every `+` click increments the counter and adds the ticket price to the total. Every `−` click decrements and refunds. Only tickets marked as "Gravity Card" affect the Gravity Card balance calculation.

---

## 💳 Gravity Card Tracking

Set the Gravity Card price per season in the settings or during season creation. The statistics panel shows:

- **Total spent** — sum of all ticket usage
- **Gravity Card tickets** — spending that counts toward amortization
- **Regular tickets** — spending on non-Gravity Card tickets
- **Remaining balance** — Gravity Card price minus Gravity Card spending

| Status | Color |
|--------|-------|
| Balance still positive (card not yet amortized) | 🔴 Red |
| Balance at zero or below (card fully amortized) | 🟢 Green |
| No Gravity Card price set | ⚫ Gray |
