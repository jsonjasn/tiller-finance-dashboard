# Tiller Finance Dashboard

An ambient budget dashboard that reads live data from your [Tiller](https://www.tillerhq.com/) Google Sheet and displays it on a tablet. No interactions, no login, no cloud service — just a static HTML file served on your local network.

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

> **Note:** "Anyone" access means anyone with the URL can read your budget totals. The data is read-only and non-sensitive for most use cases, but keep the URL private if you prefer.

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

## Hosting on a NAS or Local Server

Serve the `dashboard/` folder (which contains `index.html` and your `config.js`) from any static web server:

- **Synology NAS:** Install Web Station from Package Center, copy `dashboard/` contents to the web root
- **Raspberry Pi / Linux:** `python3 -m http.server 8080` from inside the `dashboard/` folder
- **Any static host:** GitHub Pages, Netlify, Vercel — just make sure `config.js` is not committed to a public repo

Point a browser at the URL and the dashboard will load and auto-refresh.

---

## Tablet Setup (Ambient Display)

**Chrome (Android or desktop):**
```
chrome --kiosk http://your-server-ip/
```

**iOS Safari:** Open the URL → Share → Add to Home Screen. The dashboard opens full-screen.

**Android:** Use a kiosk browser app pointed at your dashboard URL.

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

Tiller typically syncs transactions with a 1–3 day lag depending on your bank. The dashboard notes this in the footer. For same-day spending, check your bank directly.

---

## Contributing

Issues and PRs welcome. Please keep it simple — this project intentionally has no build step, no framework, and no dependencies.
