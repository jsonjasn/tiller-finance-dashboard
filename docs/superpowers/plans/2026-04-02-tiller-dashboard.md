# Tiller Finance Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-contained ambient budget dashboard that reads from a Tiller Google Sheet via Apps Script and displays live spending data on a tablet — no interactions, no build step.

**Architecture:** 4 files. `config.example.js` is the only file users touch. `apps-script/Code.gs` runs inside the Tiller Google Sheet as a deployed Web App, returning one JSON blob. `dashboard/index.html` is fully self-contained — loads `config.js` (user-created copy of `config.example.js`, placed in the `dashboard/` folder alongside `index.html`), fetches data, and renders. No framework, no bundler.

**Tech Stack:** Vanilla HTML/CSS/JS (ES6+), Google Apps Script (V8 runtime), Geist font via Google Fonts. Hosting: any static file server (e.g. Synology Web Station serving the `dashboard/` folder).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `config.example.js` | Create | User-facing config template — the only file end users edit |
| `apps-script/Code.gs` | Create | Reads Tiller sheet, returns JSON blob, handles CORS |
| `dashboard/index.html` | Create | Self-contained dashboard — HTML + CSS + JS in one file |
| `README.md` | Create | Setup guide for Apps Script deploy + dashboard config |

> **Note on config.js placement:** `config.example.js` lives at repo root as a template. Users copy it to `dashboard/config.js` (alongside `index.html`) so the `dashboard/` folder can be served as a standalone static site. `index.html` loads it with `<script src="config.js"></script>`.

---

## Task 1: Scaffold Repo Structure

**Files:**
- Create: `apps-script/` (directory)
- Create: `dashboard/` (directory)

- [ ] **Step 1: Create directories**

```bash
mkdir -p apps-script dashboard
```

- [ ] **Step 2: Verify structure**

```bash
ls -la
```

Expected output includes `apps-script/` and `dashboard/` directories alongside `spec.md`.

---

## Task 2: Write `config.example.js`

**Files:**
- Create: `config.example.js`

- [ ] **Step 1: Create the file**

```javascript
// config.example.js
// ─────────────────────────────────────────────────────────
// SETUP: Copy this file to dashboard/config.js and fill in
// your values. dashboard/config.js is loaded by index.html.
// ─────────────────────────────────────────────────────────

const CONFIG = {

  // ── Connection ──────────────────────────────────────────
  // Your deployed Apps Script Web App URL.
  // See README for how to deploy.
  appsScriptUrl: 'YOUR_APPS_SCRIPT_URL_HERE',

  // ── Runway / Top Metrics ─────────────────────────────────
  // How to calculate total monthly budget for the runway metric.
  //   'sum_categories' = sum all budgeted Expense categories from your sheet
  //   'manual'         = use the manualMonthlyBudget value below
  budgetCalculation: 'sum_categories',
  manualMonthlyBudget: 5000,

  // ── Category Watch Cards ─────────────────────────────────
  // These appear as colored status cards in the main grid.
  // Each name must match your Tiller Categories tab exactly (case-sensitive).
  //
  //   showPacingTag:   show a "pacing high" yellow warning (true/false)
  //   yellowThreshold: flag yellow if spending is this % ahead of month pace
  //                    e.g. 0.15 = warn when spending is 15% ahead of pace
  watchCategories: [
    {
      name: 'Groceries',
      showPacingTag: true,
      yellowThreshold: 0.15,
    },
    {
      name: 'Dining Out',
      showPacingTag: true,
      yellowThreshold: 0.15,
    },
    {
      name: 'Entertainment',
      showPacingTag: false, // only show red (over budget), not yellow
    },
    {
      name: 'Auto & Gas',
      showPacingTag: true,
      yellowThreshold: 0.15,
    },
  ],

  // ── Goals ────────────────────────────────────────────────
  // Goals are not pulled from Tiller — define them here.
  //
  // Two goal types:
  //   'payoff'  — paying down a balance to zero (e.g. 0% interest promo card)
  //   'savings' — building up to a target amount
  //
  // balanceSource:
  //   'manual' — use manualBalance below (good for new accounts not yet in Tiller)
  //   'tiller' — pull current balance from Balances tab by tillerAccountName
  goals: [
    {
      id: 'payoff_example',
      type: 'payoff',
      label: 'Vacation Card',
      totalAmount: 3000,       // original charge / total to pay off
      monthlyPayment: 167,     // required monthly payment
      startDate: '2026-01-01', // when the promo period started
      months: 18,              // length of 0% promo period
      balanceSource: 'manual',
      manualBalance: 3000,
      tillerAccountName: '',   // e.g. 'Chase Sapphire - xxxx1234'
    },
    {
      id: 'savings_example',
      type: 'savings',
      label: 'Emergency Fund',
      targetAmount: 10000,
      monthlyContribution: 250,
      balanceSource: 'manual',
      manualBalance: 0,
      tillerAccountName: '',   // e.g. 'Marcus Savings - xxxx5678'
    },
  ],

  // ── Display ──────────────────────────────────────────────
  theme: 'dark',               // 'dark' | 'light'
                               // dark  = recommended for ambient tablet display
                               // light = better for bright rooms / daytime
  refreshIntervalMinutes: 5,   // how often the dashboard auto-refreshes
  showLastUpdated: true,       // show "last updated X:XX PM" footer
  currencyLocale: 'en-US',
  currencyCode: 'USD',
};
```

- [ ] **Step 2: Verify it parses as valid JS**

```bash
node -e "$(cat config.example.js); console.log('CONFIG keys:', Object.keys(CONFIG))"
```

Expected output:
```
CONFIG keys: [ 'appsScriptUrl', 'budgetCalculation', 'manualMonthlyBudget', 'watchCategories', 'goals', 'theme', 'refreshIntervalMinutes', 'showLastUpdated', 'currencyLocale', 'currencyCode' ]
```

---

## Task 3: Write `apps-script/Code.gs`

**Files:**
- Create: `apps-script/Code.gs`

This file runs inside the Tiller Google Sheet. Deploy as: **Execute as: Me**, **Who has access: Anyone**.

**Tiller sheet structure (confirmed):**
- `Transactions`: Row 1 blank, Row 2 headers, data from Row 3. Columns: `(blank)=0, Date=1, Description=2, Notes=3, Category=4, Amount=5, Account=6, ...`
- `Categories`: Headers in Row 1. Columns: `Category=0, Group=1, Type=2, Hide=3, budget cols start at E (index 4) = Jan 2026`
- `Balances`: Headers in Row 1. Columns: `Account=0, Balance=1, ...`

**Budget column formula:** `colIndex = 4 + (year - 2026) * 12 + monthIndex` where monthIndex is 0 = January.

- [ ] **Step 1: Write Code.gs**

```javascript
// apps-script/Code.gs
// Deployed as a Web App inside the Tiller Google Sheet.
// Returns spending data for the current month as JSON.

function doGet(e) {
  var result = ContentService.createTextOutput(JSON.stringify(getData()));
  result.setMimeType(ContentService.MimeType.JSON);
  return result;
}

function getData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var now = new Date();
  var year = now.getFullYear();
  var month = now.getMonth(); // 0 = January
  var day = now.getDate();
  var daysInMonth = new Date(year, month + 1, 0).getDate();

  // ── Categories tab ──────────────────────────────────────
  // Col E (index 4) = Jan 2026 budget; offset by month
  var budgetColIndex = 4 + (year - 2026) * 12 + month;

  var catSheet = ss.getSheetByName('Categories');
  var catRows = catSheet.getDataRange().getValues();

  var categoryType = {};   // name -> 'Income' | 'Expense' | 'Transfer'
  var categoryBudget = {}; // name -> budget amount (positive number)

  for (var i = 1; i < catRows.length; i++) {
    var name = String(catRows[i][0]).trim();
    var type = String(catRows[i][2]).trim();
    var budget = catRows[i][budgetColIndex];
    if (!name) continue;
    categoryType[name] = type;
    categoryBudget[name] = Math.abs(Number(budget) || 0);
  }

  // ── Transactions tab ────────────────────────────────────
  // Row 0 = blank, Row 1 = headers, data starts Row 2 (index 2)
  var txSheet = ss.getSheetByName('Transactions');
  var txRows = txSheet.getDataRange().getValues();

  var spending = {}; // category name -> total spent (positive)

  for (var j = 2; j < txRows.length; j++) {
    var row = txRows[j];
    var txDate = row[1];
    var category = String(row[4]).trim();
    var amount = Number(row[5]);

    if (!txDate || !category || isNaN(amount)) continue;
    if (amount >= 0) continue;
    if (categoryType[category] !== 'Expense') continue;

    var d = new Date(txDate);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;

    spending[category] = (spending[category] || 0) + Math.abs(amount);
  }

  // ── Build categories result ─────────────────────────────
  var categories = {};
  var totalBudget = 0;
  var totalSpent = 0;

  for (var cat in categoryBudget) {
    if (categoryType[cat] !== 'Expense') continue;
    if (categoryBudget[cat] === 0) continue;
    var spent = spending[cat] || 0;
    categories[cat] = {
      spent: round2(spent),
      budget: categoryBudget[cat]
    };
    totalBudget += categoryBudget[cat];
    totalSpent += spent;
  }

  // ── Balances tab ────────────────────────────────────────
  var balSheet = ss.getSheetByName('Balances');
  var balRows = balSheet.getDataRange().getValues();
  var balances = {};

  for (var k = 1; k < balRows.length; k++) {
    var acct = String(balRows[k][0]).trim();
    var bal = Number(balRows[k][1]);
    if (acct) balances[acct] = round2(bal);
  }

  // ── Assemble response ───────────────────────────────────
  var MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

  return {
    asOf: now.toISOString(),
    month: MONTHS[month] + ' ' + year,
    daysInMonth: daysInMonth,
    dayOfMonth: day,
    categories: categories,
    totalBudget: round2(totalBudget),
    totalSpent: round2(totalSpent),
    balances: balances
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// ── Manual test ─────────────────────────────────────────────
// Run testGetData() from the Apps Script editor to verify output.
function testGetData() {
  Logger.log(JSON.stringify(getData(), null, 2));
}
```

- [ ] **Step 2: Verify the file exists and is non-empty**

```bash
wc -l apps-script/Code.gs
```

Expected: line count > 50.

- [ ] **Step 3: Deployment reminder (manual step)**

This file must be pasted into the Apps Script editor and deployed manually:
1. Open your Tiller Google Sheet
2. Extensions → Apps Script
3. Replace any existing code with the contents of `Code.gs`
4. Click Deploy → New deployment → Web app
5. Execute as: **Me**, Who has access: **Anyone**
6. Copy the deployment URL — this goes into `CONFIG.appsScriptUrl`
7. Run `testGetData()` in the editor and check Logger output matches the expected JSON shape

---

## Task 4: Write `dashboard/index.html`

**Files:**
- Create: `dashboard/index.html`

> **REQUIRED:** Invoke the `frontend-design` skill before writing this file. The skill drives all visual and structural decisions for the HTML/CSS. Pass it the full context below.

**Context to pass to frontend-design:**

> Build a single self-contained `dashboard/index.html` with no external dependencies except Geist from Google Fonts. It loads `config.js` from the same directory (`<script src="config.js"></script>`). Full dark/light theme via `data-theme` on `<html>` and CSS custom properties only — no hardcoded colors. Designed for ambient tablet display at 1024×768, no interactions needed.
>
> **Layout (top to bottom):**
> 1. 3-column metric row: RUNWAY | SPENT | REMAINING
> 2. 2-column category watch card grid
> 3. 2-column goals grid
> 4. Footer: "last updated X:XX PM" + subtle Tiller data lag note
>
> **Color tokens (dark theme — default):** bg `#0f1117`, surface `#1a1d27`, border `rgba(255,255,255,0.08)`, text-primary `#f0f0f5`, text-secondary `#8b8fa8`, green `#4ade80`, yellow `#fbbf24`, red `#f87171`, blue `#60a5fa`
>
> **Color tokens (light theme):** bg `#f8f7f4`, surface `#ffffff`, border `rgba(0,0,0,0.08)`, text-primary `#1a1a2e`, text-secondary `#6b6f85`, green `#16a34a`, yellow `#d97706`, red `#dc2626`, blue `#2563eb`
>
> **JS architecture — implement these exact functions:**

```javascript
// Called on load and on each auto-refresh
async function fetchData() {
  try {
    const res = await fetch(CONFIG.appsScriptUrl);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    localStorage.setItem('tiller_cache', JSON.stringify(data));
    localStorage.removeItem('tiller_stale');
    return data;
  } catch (err) {
    const cached = localStorage.getItem('tiller_cache');
    if (cached) {
      localStorage.setItem('tiller_stale', '1');
      return JSON.parse(cached);
    }
    return null;
  }
}

function formatCurrency(n) {
  return new Intl.NumberFormat(CONFIG.currencyLocale, {
    style: 'currency',
    currency: CONFIG.currencyCode,
    maximumFractionDigits: 0
  }).format(n);
}

// Returns 'green' | 'yellow' | 'red'
function categoryStatus(cat, data) {
  const { spent, budget } = data.categories[cat.name] || { spent: 0, budget: 0 };
  if (budget === 0) return 'green';
  const pctElapsed = data.dayOfMonth / data.daysInMonth;
  const pctSpent = spent / budget;
  if (spent >= budget) return 'red';
  if (cat.showPacingTag && pctSpent > pctElapsed + (cat.yellowThreshold || 0.15)) return 'yellow';
  return 'green';
}

// Returns 'green' | 'yellow' | 'red'
function runwayStatus(data) {
  if (data.dayOfMonth === 0 || data.totalSpent === 0) return 'green';
  const totalBudget = CONFIG.budgetCalculation === 'manual'
    ? CONFIG.manualMonthlyBudget
    : data.totalBudget;
  const remaining = totalBudget - data.totalSpent;
  const daysLeft = data.daysInMonth - data.dayOfMonth;
  const dailyBurn = data.totalSpent / data.dayOfMonth;
  const runwayDays = dailyBurn > 0 ? remaining / dailyBurn : 999;
  if (runwayDays >= daysLeft) return 'green';
  if (runwayDays > 5) return 'yellow';
  return 'red';
}

function runwayDays(data) {
  if (data.dayOfMonth === 0 || data.totalSpent === 0) return data.daysInMonth - data.dayOfMonth;
  const totalBudget = CONFIG.budgetCalculation === 'manual'
    ? CONFIG.manualMonthlyBudget
    : data.totalBudget;
  const remaining = totalBudget - data.totalSpent;
  const dailyBurn = data.totalSpent / data.dayOfMonth;
  return dailyBurn > 0 ? Math.round(remaining / dailyBurn) : data.daysInMonth - data.dayOfMonth;
}

// Returns current balance for a goal (from Tiller or manual)
function goalBalance(goal, data) {
  if (goal.balanceSource === 'tiller' && data.balances && data.balances[goal.tillerAccountName] !== undefined) {
    return data.balances[goal.tillerAccountName];
  }
  return goal.manualBalance;
}

// For payoff goals: amount paid = totalAmount - currentBalance
function payoffProgress(goal, data) {
  const balance = goalBalance(goal, data);
  const paid = goal.totalAmount - balance;
  const start = new Date(goal.startDate);
  const now = new Date();
  const monthsElapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  const requiredPaid = goal.monthlyPayment * monthsElapsed;
  const deadlineDate = new Date(start);
  deadlineDate.setMonth(deadlineDate.getMonth() + goal.months);
  const monthsLeft = Math.max(0, Math.round((deadlineDate - now) / (1000 * 60 * 60 * 24 * 30.4)));
  return {
    balance,
    paid: Math.max(0, paid),
    pct: Math.min(1, Math.max(0, paid / goal.totalAmount)),
    onTrack: paid >= requiredPaid,
    monthsLeft,
    deadlineDate
  };
}

// For savings goals
function savingsProgress(goal, data) {
  const balance = goalBalance(goal, data);
  const monthsLeft = goal.monthlyContribution > 0
    ? Math.ceil((goal.targetAmount - balance) / goal.monthlyContribution)
    : null;
  return {
    balance,
    pct: Math.min(1, Math.max(0, balance / goal.targetAmount)),
    monthsLeft: Math.max(0, monthsLeft)
  };
}

// Main render — called after each successful fetch
function render(data, isStale) { /* renders all sections */ }

// Auto-refresh
function startRefresh() {
  setInterval(async () => {
    showRefreshing(true);
    const data = await fetchData();
    showRefreshing(false);
    if (data) render(data, !!localStorage.getItem('tiller_stale'));
  }, CONFIG.refreshIntervalMinutes * 60 * 1000);
}
```

> The `render()` function calls smaller render helpers for each section. The HTML structure must match the layout above. All status colors come exclusively from CSS custom properties — never inline hex values in JS.

- [ ] **Step 1: Invoke frontend-design skill and implement `dashboard/index.html`**

Invoke the `frontend-design` skill with the full context above. Implement the complete file including all HTML structure, CSS custom properties for both themes, and all JS functions listed above.

- [ ] **Step 2: Verify the file loads without errors**

Open `dashboard/index.html` directly in a browser (file:// is fine for this test). Check the browser console — there should be no JS errors on load (a fetch error is expected since `CONFIG.appsScriptUrl` is a placeholder).

- [ ] **Step 3: Verify theme switching works**

In the browser console, run:
```javascript
document.documentElement.setAttribute('data-theme', 'light');
```
Confirm the dashboard switches to light colors. Run:
```javascript
document.documentElement.setAttribute('data-theme', 'dark');
```
Confirm it switches back.

- [ ] **Step 4: Verify rendering with mock data**

In the browser console, paste and run:
```javascript
const mock = {
  asOf: new Date().toISOString(),
  month: 'April 2026',
  daysInMonth: 30,
  dayOfMonth: 15,
  categories: {
    'Groceries':     { spent: 820, budget: 1200 },
    'Dining Out':    { spent: 310, budget: 400 },
    'Entertainment': { spent: 450, budget: 400 },
    'Auto & Gas':    { spent: 180, budget: 300 }
  },
  totalBudget: 5000,
  totalSpent: 2100,
  balances: {}
};
render(mock, false);
```

Expected: dashboard renders with:
- Groceries → green (820/1200, 68% spent at 50% of month = on track)
- Dining Out → yellow (310/400, 77.5% spent at 50% of month, over pace)
- Entertainment → red (450/400, over budget)
- Auto & Gas → green (180/300, 60% at 50% = on track)
- Runway metric shows days remaining and appropriate color

---

## Task 5: Write `README.md`

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write the README**

```markdown
# Tiller Finance Dashboard

An ambient budget dashboard that reads live data from your [Tiller](https://www.tillerhq.com/) Google Sheet and displays it on a tablet. No interactions, no login, no cloud service — just a static HTML file served on your local network.

![Dark mode dashboard showing budget categories and goals](docs/screenshot-dark.png)

---

## What You'll Need

- A Tiller subscription with the Foundation Template set up in Google Sheets
- A place to serve a static HTML file on your local network (NAS, Raspberry Pi, any web server)

---

## Setup: Apps Script

The dashboard reads data via a Google Apps Script Web App deployed inside your Tiller sheet.

1. Open your Tiller Google Sheet
2. Go to **Extensions → Apps Script**
3. Delete any existing code in the editor
4. Paste the contents of `apps-script/Code.gs`
5. Click **Deploy → New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Click **Deploy** and copy the Web App URL — you'll need it in the next step

> **Note:** "Anyone" access means anyone with the URL can read your budget totals. The data is read-only and non-sensitive for most use cases, but be aware if you share the URL.

---

## Setup: Dashboard

1. **Copy the config file:**
   ```bash
   cp config.example.js dashboard/config.js
   ```

2. **Edit `dashboard/config.js`:**
   - Set `appsScriptUrl` to your deployed Web App URL from the previous step
   - Set `watchCategories` to match your Tiller category names exactly (case-sensitive)
   - Configure `goals` as needed — see [Goal Configuration](#goal-configuration) below

3. **Open the dashboard:**
   - For local testing: open `dashboard/index.html` directly in a browser
   - For permanent display: serve the `dashboard/` folder from any static web server

---

## Hosting on Synology NAS

1. Open **Package Center** and install **Web Station**
2. In Web Station, create a new virtual host or use the default site
3. Copy the `dashboard/` folder contents (including your `config.js`) to the web root
4. Access the dashboard at `http://your-nas-ip/` or your configured path
5. Point a tablet browser at that URL and add it to the home screen for kiosk-style display

---

## Tablet Setup (Ambient Display)

**Chrome (Android or desktop):**
```
chrome --kiosk http://your-nas-ip/dashboard/
```

**iOS Safari:** Open the URL → Share → Add to Home Screen. The dashboard will open full-screen.

**Android:** Use a kiosk browser app (e.g. Fully Kiosk Browser) pointed at your dashboard URL.

---

## Goal Configuration

Goals are defined in `config.js` and are never pulled from Tiller automatically.

### `payoff` — paying down a balance to zero

```javascript
{
  id: 'my_card',
  type: 'payoff',
  label: 'Vacation Card',
  totalAmount: 3000,        // original charge
  monthlyPayment: 167,      // required monthly payment
  startDate: '2026-01-01',  // promo period start
  months: 18,               // promo period length
  balanceSource: 'manual',  // 'manual' | 'tiller'
  manualBalance: 3000,      // used when balanceSource is 'manual'
  tillerAccountName: '',    // account name from Balances tab (for 'tiller' mode)
}
```

### `savings` — building toward a target

```javascript
{
  id: 'emergency',
  type: 'savings',
  label: 'Emergency Fund',
  targetAmount: 10000,
  monthlyContribution: 250,
  balanceSource: 'tiller',
  manualBalance: 0,
  tillerAccountName: 'My Savings Account - xxxx1234',
}
```

**`balanceSource: 'manual'`** — use this for accounts not yet connected to Tiller. Update `manualBalance` manually as needed.

**`balanceSource: 'tiller'`** — the dashboard pulls the current balance from your Balances tab automatically. Set `tillerAccountName` to the account name exactly as it appears in Tiller.

---

## Data Freshness

Tiller typically syncs transactions with a 1–3 day lag depending on your bank. The dashboard notes this subtly in the footer. For day-of spending, check your bank directly.

---

## Contributing

Issues and PRs welcome. This project is intentionally simple — please keep it that way.
```

- [ ] **Step 2: Verify the README renders correctly**

```bash
node -e "const fs = require('fs'); const md = fs.readFileSync('README.md', 'utf8'); console.log('Lines:', md.split('\n').length, '| Sections:', (md.match(/^## /gm)||[]).length)"
```

Expected: Lines > 80, Sections = 6.

---

## Self-Review Checklist

After completing all tasks, verify:

- [ ] `config.example.js` has no personal names, account numbers, or hardcoded URLs
- [ ] `Code.gs` correctly offsets budget column for years beyond 2026
- [ ] `dashboard/index.html` has zero hardcoded hex colors in JS — all colors via CSS vars
- [ ] Both `data-theme="dark"` and `data-theme="light"` render without broken styles
- [ ] Mock data test produces correct green/yellow/red statuses per the status logic spec
- [ ] `README.md` has all 6 sections: what it is, prerequisites, Apps Script setup, dashboard setup, Synology hosting, goal config

---

## Suggested Commit

```
feat: initial dashboard implementation
```
