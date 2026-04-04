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

  // --- Spending History Comparison ---
  // Which historical comparisons to show on group breakdown cards.
  // 'both'          = show last month and 6-month average (default)
  // 'last_month'    = show only vs last month
  // 'six_month_avg' = show only vs 6-month average
  historyComparison: 'both',

  // --- Branding ---
  // Customizes the browser tab title and the top-left wordmark on the dashboard.
  pageTitle: 'Budget Dashboard',
  headerWordmark: 'BUDGET DASHBOARD',

  showLastUpdated: true,       // show "last updated X:XX PM" footer
  currencyLocale: 'en-US',
  currencyCode: 'USD',
};
