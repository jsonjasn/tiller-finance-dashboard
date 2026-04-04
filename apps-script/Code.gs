// apps-script/Code.gs
// Deployed as a Web App inside the Tiller Google Sheet.
// Returns spending data for the current month as JSON.
//
// Deploy settings:
//   Execute as: Me
//   Who has access: Anyone
//
// Security: "Anyone" access means anyone with the URL can read your
// budget data. This is read-only and non-sensitive for most use cases.

function doGet(e) {
  try {
    var result = ContentService.createTextOutput(JSON.stringify(getData()));
    result.setMimeType(ContentService.MimeType.JSON);
    return result;
  } catch (err) {
    var error = ContentService.createTextOutput(JSON.stringify({ error: err.message }));
    error.setMimeType(ContentService.MimeType.JSON);
    return error;
  }
}

function getData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var now = new Date();
  var year = now.getFullYear();
  var month = now.getMonth(); // 0 = January
  var day = now.getDate();
  var daysInMonth = new Date(year, month + 1, 0).getDate();

  // ── Categories tab ──────────────────────────────────────
  // Tiller Categories columns: Category=0, Group=1, Type=2, Hide=3
  // Budget columns start at col E (index 4) = January 2026
  // Formula: budgetColIndex = 4 + (year - 2026) * 12 + month
  var budgetColIndex = 4 + (year - 2026) * 12 + month;
  if (budgetColIndex < 0) {
    throw new Error('Budget column index is negative — this sheet was set up before January 2026. Check the budget column mapping in Code.gs.');
  }

  var catSheet = ss.getSheetByName('Categories');
  if (!catSheet) throw new Error('Sheet not found: "Categories". Check the tab name in your Tiller spreadsheet.');
  var catRows = catSheet.getDataRange().getValues();

  var categoryType = {};
  var categoryBudget = {};
  var categoryGroup = {};  // name -> group string
  var groupBudget = { Bills: 0, Living: 0, Discretionary: 0 };

  for (var i = 1; i < catRows.length; i++) {
    var name = String(catRows[i][0]).trim();
    var group = String(catRows[i][1]).trim();
    var type = String(catRows[i][2]).trim();
    var budget = catRows[i][budgetColIndex];
    if (!name) continue;
    categoryType[name] = type;
    categoryGroup[name] = group;
    categoryBudget[name] = Math.abs(Number(budget) || 0);
    if (type === 'Expense' && groupBudget.hasOwnProperty(group)) {
      groupBudget[group] += Math.abs(Number(budget) || 0);
    }
  }

  // ── Transactions tab ────────────────────────────────────
  // Tiller Transactions columns: blank=0, Date=1, Description=2,
  //   Notes=3, Category=4, Amount=5, Account=6, ...
  // Row 0 = blank, Row 1 = headers, data starts Row 2 (index 2)
  var txSheet = ss.getSheetByName('Transactions');
  if (!txSheet) throw new Error('Sheet not found: "Transactions". Check the tab name in your Tiller spreadsheet.');
  var txRows = txSheet.getDataRange().getValues();

  var spending = {};
  // groupSpending[monthKey] = { Bills: 0, Living: 0, Discretionary: 0 }
  // monthKey = 'YYYY-M' (e.g. '2026-3' for April, month index 3)
  var groupSpending = {};

  // Pre-populate entries for current month and past 6 months
  for (var m = 0; m <= 6; m++) {
    var mIdx = month - m;
    var mYear = year;
    if (mIdx < 0) { mIdx += 12; mYear -= 1; }
    var key = mYear + '-' + mIdx;
    groupSpending[key] = { Bills: 0, Living: 0, Discretionary: 0 };
  }

  for (var j = 2; j < txRows.length; j++) {
    var row = txRows[j];
    var txDate = row[1];
    var category = String(row[4]).trim();
    var amount = Number(row[5]);

    if (!txDate || !category || isNaN(amount)) continue;
    if (amount >= 0) continue;
    if (categoryType[category] !== 'Expense') continue;

    var d = (txDate instanceof Date) ? txDate : new Date(txDate);
    var dYear = d.getFullYear();
    var dMonth = d.getMonth();
    var dDay = d.getDate();

    // Current month: full spending for categories result
    if (dYear === year && dMonth === month) {
      spending[category] = (spending[category] || 0) + Math.abs(amount);
    }

    // Group spending: current month + past 6, up to same day-of-month
    var key = dYear + '-' + dMonth;
    if (groupSpending.hasOwnProperty(key) && dDay <= day) {
      var grp = categoryGroup[category];
      if (grp && groupSpending[key].hasOwnProperty(grp)) {
        groupSpending[key][grp] += Math.abs(amount);
      }
    }
  }

  // ── Build categories result ─────────────────────────────
  // Include all Expense categories that have a non-zero budget
  var categories = {};
  var totalBudget = 0;
  var totalSpent = 0;

  for (var cat in categoryBudget) {
    if (categoryType[cat] !== 'Expense') continue;
    if (categoryBudget[cat] === 0) continue; // skip unbudgeted categories — no budget means no tracking
    var spent = spending[cat] || 0;
    categories[cat] = {
      spent: round2(spent),
      budget: round2(categoryBudget[cat])
    };
    totalBudget += categoryBudget[cat];
    totalSpent += spent;
  }

  // ── Build groups result ─────────────────────────────────
  var TARGET_GROUPS = ['Bills', 'Living', 'Discretionary'];
  var currentKey = year + '-' + month;

  // Last month key
  var lmIdx = month - 1;
  var lmYear = year;
  if (lmIdx < 0) { lmIdx = 11; lmYear -= 1; }
  var lastMonthKey = lmYear + '-' + lmIdx;

  var groups = {};
  TARGET_GROUPS.forEach(function(grp) {
    var sixMonthTotal = 0;
    var sixMonthCount = 0;
    for (var m = 1; m <= 6; m++) {
      var mIdx = month - m;
      var mYear = year;
      if (mIdx < 0) { mIdx += 12; mYear -= 1; }
      var k = mYear + '-' + mIdx;
      if (groupSpending[k]) {
        sixMonthTotal += groupSpending[k][grp] || 0;
        sixMonthCount++;
      }
    }
    var sixMonthAvg = sixMonthCount > 0 ? sixMonthTotal / sixMonthCount : 0;
    var lastMonthSpent = (groupSpending[lastMonthKey] && groupSpending[lastMonthKey][grp]) || 0;
    var currentSpent = (groupSpending[currentKey] && groupSpending[currentKey][grp]) || 0;

    groups[grp] = {
      spent: round2(currentSpent),
      budget: round2(groupBudget[grp]),
      lastMonth: round2(lastMonthSpent),
      sixMonthAvg: round2(sixMonthAvg)
    };
  });

  // ── Balances tab ────────────────────────────────────────
  // Standard Tiller Balances columns: Account=0, Balance=1, ...
  // Row 0 is the header row
  var balSheet = ss.getSheetByName('Balances');
  if (!balSheet) throw new Error('Sheet not found: "Balances". Check the tab name in your Tiller spreadsheet.');
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
    balances: balances,
    groups: groups
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// ── Manual test ─────────────────────────────────────────────
// Run testGetData() from the Apps Script editor to verify output.
// Check Logs (View → Logs) after running.
// NOTE: Must be run from a script bound to a Tiller spreadsheet (not standalone).
function testGetData() {
  Logger.log(JSON.stringify(getData(), null, 2));
}
