# Tiller Finance Dashboard — Design Doc
_2026-04-02_

## What We're Building

A clean, open-sourceable ambient budget dashboard that reads from a Tiller Google Sheet via Apps Script and displays on a tablet without interaction. No build tooling, no framework, no dependencies.

---

## Repo Structure

```
tiller-finance-dashboard/
├── README.md
├── apps-script/
│   └── Code.gs
├── dashboard/
│   └── index.html
├── config.example.js
└── docs/
    └── superpowers/specs/
        └── 2026-04-02-tiller-dashboard-design.md
```

---

## Architecture

**4-file project. No build step.**

| File | Role |
|---|---|
| `config.example.js` | Single user-editable config — rename to `config.js` to activate |
| `apps-script/Code.gs` | Runs inside Tiller Google Sheet, deployed as Web App, returns one JSON blob |
| `dashboard/index.html` | Self-contained HTML/CSS/JS — loads `config.js`, fetches data, renders dashboard |
| `README.md` | Setup guide |

---

## Data Flow

```
Tiller Google Sheet (Transactions, Categories, Balances tabs)
  └─ Code.gs (Apps Script Web App — no auth, read-only, CORS enabled)
       └─ returns JSON: { categories, balances, totalSpent, totalBudget, asOf, ... }
            └─ dashboard/index.html fetches on load + every CONFIG.refreshIntervalMinutes
                 └─ falls back to localStorage cache if fetch fails (shows stale indicator)
```

### Apps Script JSON Shape

```json
{
  "asOf": "2026-04-01T14:22:00.000Z",
  "month": "April 2026",
  "daysInMonth": 30,
  "dayOfMonth": 1,
  "categories": {
    "Groceries": { "spent": 1340, "budget": 1900 }
  },
  "totalBudget": 8875,
  "totalSpent": 3421,
  "balances": {
    "My Credit Card - xxxx1234": 2665.36
  }
}
```

---

## Dashboard Layout

```
┌─────────────────────────────────────┐
│  RUNWAY    │  SPENT      │ REMAINING │  ← 3-col metric row
├─────────────────────────────────────┤
│  [cat]  ●  │  [cat]  ●   │           │  ← category watch grid (2-col)
│  [cat]  ●  │  [cat]  ●   │           │
│  [cat]  ●  │  [cat]  ●   │           │
├─────────────────────────────────────┤
│  GOALS                               │
│  [payoff goal card]  [savings goal]  │  ← goals grid (2-col)
└─────────────────────────────────────┘
         last updated 2:22 PM
```

Target resolution: **1024×768 tablet**, ambient/kiosk display. Hosted on Synology NAS via Web Station.

---

## Status Logic

### Category Cards

| Status | Condition | Color |
|---|---|---|
| Green (on track) | `spent / budget < pctMonthElapsed + yellowThreshold` | `#4ade80` |
| Yellow (pacing high) | Over pace but under budget — only if `showPacingTag: true` | `#fbbf24` |
| Red (over budget) | `spent >= budget` | `#f87171` |

Progress bar fills proportionally, color matches status.

### Runway Metric

```
dailyBurnRate = totalSpent / dayOfMonth
runwayDays = remainingBudget / dailyBurnRate
```

- Green: `runwayDays >= daysLeft`
- Yellow: `runwayDays < daysLeft` but > 5
- Red: `runwayDays < 5`

### Goal Cards — `payoff` Type

- Shows: balance remaining, required monthly payment, months until deadline
- Progress bar: `paid / total`
- Deadline: `startDate + months`
- On-track: `amountPaid >= requiredMonthlyPayment * monthsElapsed`

### Goal Cards — `savings` Type

- Shows: current balance, monthly contribution, months to target
- Progress bar: `currentBalance / targetAmount`
- Months to target: `(targetAmount - currentBalance) / monthlyContribution`

---

## Theming

Controlled entirely by `CONFIG.theme`. `data-theme` attribute on `<html>`, CSS custom properties throughout — no hardcoded colors anywhere.

### Dark (default)

| Token | Value |
|---|---|
| Background | `#0f1117` |
| Surface | `#1a1d27` |
| Border | `rgba(255,255,255,0.08)` |
| Text primary | `#f0f0f5` |
| Text secondary | `#8b8fa8` |
| Green / Yellow / Red / Blue | `#4ade80` / `#fbbf24` / `#f87171` / `#60a5fa` |

### Light

| Token | Value |
|---|---|
| Background | `#f8f7f4` |
| Surface | `#ffffff` |
| Border | `rgba(0,0,0,0.08)` |
| Text primary | `#1a1a2e` |
| Text secondary | `#6b6f85` |
| Green / Yellow / Red / Blue | `#16a34a` / `#d97706` / `#dc2626` / `#2563eb` |

Both themes must pass WCAG AA contrast on all text.

---

## Font

**Geist** from Google Fonts, `system-ui` fallback.

---

## Design Quality

`dashboard/index.html` is built using the **`frontend-design` skill** — no Impeccable. Key principles:
- No Inter/Arial (Geist instead)
- No pure black/gray — all colors tinted
- No cards nested in cards
- Purposeful color that encodes meaning
- Large numbers, high contrast, readable at tablet distance

---

## Data Loading

- On load: fetch Apps Script URL from `CONFIG.appsScriptUrl`
- If fetch fails: show last cached data from `localStorage` with a stale indicator
- Auto-refresh every `CONFIG.refreshIntervalMinutes`
- While refreshing: subtle "refreshing..." indicator — do NOT blank the screen
- Tiller transaction lag (2–3 days) noted subtly in the UI

---

## Config

`config.example.js` is the **only file users edit**. Rename to `config.js` to activate.

Key config sections:
- `appsScriptUrl` — deployed Web App URL
- `budgetCalculation` — `'sum_categories'` or `'manual'`
- `watchCategories` — array of category objects with thresholds
- `goals` — array with `payoff` and `savings` types, `balanceSource: 'manual' | 'tiller'`
- `theme`, `refreshIntervalMinutes`, `showLastUpdated`, currency settings

Config is the single source of truth — nothing that belongs in config is hardcoded in `index.html` or `Code.gs`.

---

## Key Constraints

- Per-person budget categories (e.g. individual fun money) are intentionally separate — never combined
- Payoff goal cards support manual balance for cards not yet in Tiller — `balanceSource: 'manual'`
- Goals are defined entirely in config — not pulled from Tiller
- System must be ambient/automatic, not opt-in
- Apps Script URL is filled in by user post-deploy — clear placeholder in config

---

## Commit Sequence

1. Create repo structure
2. Write `config.example.js`
3. Write `apps-script/Code.gs`
4. Write `dashboard/index.html` (using `frontend-design` skill)
5. Write `README.md`
6. Single commit: `feat: initial dashboard implementation`
