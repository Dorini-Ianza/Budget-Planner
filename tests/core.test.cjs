const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const c = require("../electron/core.cjs");
const { Store } = require("../electron/store.cjs");
const csv = require("../electron/csv.cjs");
function fixture() {
  let s = c.initial();
  for (const a of [
    { id: "bank", name: "Bank", type: "bank", opening: 10000000 },
    { id: "card", name: "Card", type: "card", opening: -2000000 },
    { id: "loan", name: "Loan", type: "loan", opening: -5000000 },
    { id: "savings", name: "Savings", type: "savings", opening: 0 },
  ])
    s = c.change(s, "account", { ...a, openingDate: "2026-01-01" });
  return s;
}
function tx(s, p) {
  return c.change(s, "transaction", {
    kind: "expense",
    date: "2026-01-10",
    amount: 10000,
    account: "bank",
    category: s.categories[0].id,
    payee: "Test",
    notes: "",
    ...p,
  });
}
test("money converts decimal rupees to safe integer cents", () => {
  assert.equal(c.money("10.29"), 1029);
  assert.equal(c.money("-10.01"), -1001);
  for (const v of ["NaN", "1.009", "1e3", "", Infinity])
    assert.throws(() => c.money(v));
});
test("opening debt is liability, not spending", () => {
  const s = fixture(),
    v = c.snapshot(s, "2026-01");
  assert.equal(v.spent, 0);
  assert.equal(v.debts, 7000000);
  assert.equal(v.net, 3000000);
});
test("card purchase and repayment do not double count spending", () => {
  let s = tx(fixture(), { account: "card", amount: 50000 });
  s = tx(s, { kind: "payment", amount: 50000, to: "card", interest: 0 });
  assert.equal(c.snapshot(s, "2026-01").spent, 50000);
  assert.equal(c.balances(s).card, -2000000);
  assert.equal(c.balances(s).bank, 9950000);
});
test("loan payment splits principal and interest", () => {
  const s = tx(fixture(), {
    kind: "payment",
    to: "loan",
    amount: 100000,
    interest: 10000,
  });
  const v = c.snapshot(s, "2026-01");
  assert.equal(v.spent, 10000);
  assert.equal(v.balances.loan, -4910000);
  assert.equal(v.balances.bank, 9900000);
});
test("transfer is atomic and does not change net worth or income", () => {
  const s = tx(fixture(), { kind: "transfer", to: "savings", amount: 200000 });
  assert.equal(c.balances(s).bank, 9800000);
  assert.equal(c.balances(s).savings, 200000);
  assert.equal(c.snapshot(s, "2026-01").income, 0);
  assert.equal(c.snapshot(s, "2026-01").spent, 0);
  assert.throws(() => tx(s, { kind: "transfer", to: "bank" }));
});
test("refund reduces spending and card debt", () => {
  let s = tx(fixture(), { account: "card", amount: 50000 });
  s = tx(s, { kind: "refund", account: "card", amount: 20000 });
  assert.equal(c.snapshot(s, "2026-01").spent, 30000);
  assert.equal(c.balances(s).card, -2030000);
});
test("editing and deleting transactions recalculates balances", () => {
  let s = tx(fixture(), {});
  s = tx(s, { id: s.transactions[0].id, amount: 5000 });
  assert.equal(s.transactions.length, 1);
  assert.equal(c.balances(s).bank, 9995000);
  s = c.change(s, "deleteTransaction", { id: s.transactions[0].id });
  assert.equal(c.balances(s).bank, 10000000);
});
test("positive and negative rollover cross year boundaries and historical edits", () => {
  let s = fixture(),
    cat = s.categories[0].id;
  s = c.change(s, "budget", {
    month: "2026-12",
    category: cat,
    amount: 200000,
  });
  s = tx(s, { date: "2026-12-10", amount: 170000 });
  s = c.change(s, "budget", {
    month: "2027-01",
    category: cat,
    amount: 200000,
  });
  let b = c.budgetRows(s, "2027-01")[0];
  assert.equal(b.carry, 30000);
  assert.equal(b.available, 230000);
  s = tx(s, { id: s.transactions[0].id, date: "2026-12-10", amount: 250000 });
  b = c.budgetRows(s, "2027-01")[0];
  assert.equal(b.carry, -50000);
  assert.equal(b.available, 150000);
});
test("copy only copies allocations, preserves destination overrides and recomputes rollover", () => {
  let s = fixture(),
    cat = s.categories[0].id;
  s = c.change(s, "budget", { month: "2026-01", category: cat, amount: 10000 });
  s = c.change(s, "budget", {
    month: "2026-02",
    category: cat,
    amount: 500,
    carryOverride: 1000,
  });
  s = c.change(s, "copyBudget", { month: "2026-02" });
  const b = c.budgetRows(s, "2026-02")[0];
  assert.equal(b.planned, 10000);
  assert.equal(b.carry, 1000);
  s = c.change(s, "budget", {
    month: "2026-02",
    category: cat,
    amount: 10000,
    carryOverride: null,
  });
  assert.equal(c.budgetRows(s, "2026-02")[0].carry, 10000);
});
test("end of month and leap year schedules retain anchor day", () => {
  const r = { start: "2028-01-31", frequency: "monthly" };
  assert.equal(c.dueDate(r, 1), "2028-02-29");
  assert.equal(c.dueDate(r, 2), "2028-03-31");
  assert.equal(
    c.dueDate({ start: "2028-02-29", frequency: "yearly" }, 1),
    "2029-02-28",
  );
});
function scheduled() {
  let s = fixture();
  return c.change(s, "schedule", {
    id: "bill",
    name: "Electricity",
    start: "2026-02-10",
    frequency: "monthly",
    kind: "expense",
    amount: 10000,
    account: "bank",
    category: s.categories[0].id,
  });
}
test("recording a scheduled item settles just one occurrence and cannot duplicate", () => {
  let s = scheduled();
  s = c.change(s, "settle", {
    id: "bill",
    due: "2026-02-10",
    date: "2026-02-10",
  });
  assert.equal(c.occurrences(s, "2026-02-28").length, 0);
  assert.throws(() => c.change(s, "settle", { id: "bill", due: "2026-02-10" }));
  assert.equal(c.occurrences(s, "2026-03-10").length, 1);
  s = c.change(s, "deleteTransaction", { id: s.transactions[0].id });
  assert.equal(c.occurrences(s, "2026-02-28").length, 1);
});
test("invalid schedule occurrence cannot create a transaction", () =>
  assert.throws(() =>
    c.change(scheduled(), "settle", { id: "bill", due: "2026-02-11" }),
  ));
test("notification thresholds, restart deduplication, catch-up, snooze, dismissal, paid state", () => {
  let s = scheduled();
  const at = (d) => new Date(d + "T12:00:00");
  assert.equal(c.notificationCandidates(s, at("2026-02-02")).length, 0);
  assert.equal(c.notificationCandidates(s, at("2026-02-03")).length, 1);
  s = c.change(s, "reminder", {
    key: "bill@2026-02-10",
    value: { last: "2026-02-03" },
  });
  assert.equal(
    c.notificationCandidates(JSON.parse(JSON.stringify(s)), at("2026-02-04"))
      .length,
    0,
  );
  assert.equal(c.notificationCandidates(s, at("2026-02-08")).length, 1);
  s = c.change(s, "reminder", {
    key: "bill@2026-02-10",
    value: { snooze: at("2026-02-10").getTime() },
  });
  assert.equal(c.notificationCandidates(s, at("2026-02-09")).length, 0);
  s = c.change(s, "reminder", {
    key: "bill@2026-02-10",
    value: { dismissed: true },
  });
  assert.equal(c.notificationCandidates(s, at("2026-02-11")).length, 0);
  s = c.change(s, "settle", {
    id: "bill",
    due: "2026-02-10",
    date: "2026-02-10",
  });
  assert.equal(c.notificationCandidates(s, at("2026-02-11")).length, 0);
});
test("goal allocation does not create money and cannot release too much", () => {
  let s = fixture();
  s = c.change(s, "goal", {
    id: "trip",
    name: "Trip",
    target: 100000,
    account: "bank",
  });
  s = c.change(s, "goalEntry", {
    goal: "trip",
    amount: 10000,
    date: "2026-01-01",
  });
  assert.equal(c.balances(s).bank, 10000000);
  assert.equal(c.snapshot(s).goals[0].saved, 10000);
  assert.throws(() =>
    c.change(s, "goalEntry", {
      goal: "trip",
      amount: -20000,
      date: "2026-01-02",
    }),
  );
});
test("CSV roundtrip preserves quotes, commas, multiline notes, and flags duplicates", () => {
  let s = tx(fixture(), {
    payee: 'Shop, "Central"',
    notes: "First line\nSecond line",
  });
  const output = csv.exportCSV(s);
  let rows = csv.preview(output, s);
  assert.equal(rows[0].error, null);
  assert.equal(rows[0].duplicate, true);
  assert.equal(rows[0].transaction.notes, "First line\nSecond line");
  const fresh = fixture();
  rows = csv.preview(output, fresh);
  assert.equal(rows[0].duplicate, false);
  s = c.change(fresh, "import", { rows: rows.map((r) => r.transaction) });
  assert.equal(s.transactions[0].amount, 10000);
});
test("invalid CSV row fails preview; invalid batch cannot partially mutate state", () => {
  const s = fixture(),
    before = JSON.stringify(s);
  const rows = csv.preview(
    "date,kind,amount,account\n2026-01-10,income,100,Bank\nnot-a-date,income,100,Bank",
    s,
  );
  assert.equal(rows[0].error, null);
  assert.ok(rows[1].error);
  assert.throws(() =>
    c.change(s, "import", {
      rows: [rows[0].transaction, { ...rows[0].transaction, amount: -1 }],
    }),
  );
  assert.equal(JSON.stringify(s), before);
});
test("date, amount, reference and interest validation", () => {
  const s = fixture();
  for (const p of [
    { date: "2026-02-30" },
    { date: "2025-12-31" },
    { amount: -1 },
    { amount: 0 },
    { amount: 1.5 },
    { account: "missing" },
    { kind: "payment", to: "card", interest: 10001 },
    { kind: "payment", to: "bank" },
  ])
    assert.throws(() => tx(s, p));
});
test("SQLite restart and validated backup restore preserve complete data with safety backup", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pocket-test-"));
  let db;
  try {
    db = new Store(dir);
    const s = tx(scheduled(), {});
    db.save(s);
    const file = path.join(dir, "backup.json");
    db.backup(file);
    db.close();
    db = new Store(dir);
    assert.deepEqual(db.read(), s);
    db.change("settings", { privacy: true });
    const safety = db.restore(file);
    assert.ok(fs.existsSync(safety));
    assert.deepEqual(db.read(), s);
    const bad = path.join(dir, "bad.json");
    const invalid = structuredClone(s);
    invalid.transactions[0].account = "missing";
    fs.writeFileSync(
      bad,
      JSON.stringify({ format: "pocket-plan-backup", data: invalid }),
    );
    assert.throws(() => db.restore(bad));
    assert.deepEqual(db.read(), s);
    const b = db.autoBackup();
    assert.ok(fs.existsSync(b));
  } finally {
    db?.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("archive preserves history and statement fields persist", () => {
  let s = tx(fixture(), {});
  s = c.change(s, "account", {
    ...s.accounts[1],
    archived: true,
    statement: 50000,
    minimum: 5000,
  });
  assert.equal(s.accounts[1].statement, 50000);
  s = c.change(s, "category", { ...s.categories[0], archived: true });
  assert.equal(c.snapshot(s, "2026-01").spent, 10000);
});
test("goal releases are validated in chronological order", () => {
  let s = fixture();
  s = c.change(s, "goal", {
    id: "g",
    name: "Fund",
    target: 10000,
    account: "bank",
  });
  s = c.change(s, "goalEntry", { goal: "g", amount: 1000, date: "2026-06-01" });
  assert.throws(() =>
    c.change(s, "goalEntry", { goal: "g", amount: -500, date: "2026-05-01" }),
  );
});
test("weekly schedule respects its end date and pausing stops reminders", () => {
  let s = fixture();
  s = c.change(s, "schedule", {
    id: "weekly",
    name: "Weekly bill",
    kind: "expense",
    amount: 1000,
    account: "bank",
    category: s.categories[0].id,
    start: "2026-01-01",
    frequency: "weekly",
    end: "2026-01-15",
  });
  assert.deepEqual(
    c.occurrences(s, "2026-02-01").map((o) => o.due),
    ["2026-01-01", "2026-01-08", "2026-01-15"],
  );
  s = c.change(s, "schedule", { ...s.schedules[0], active: false });
  assert.equal(c.occurrences(s, "2026-02-01").length, 0);
});
test("CSV duplicates within one file are flagged and malformed quotes are rejected", () => {
  const s = fixture();
  const text =
    "date,kind,amount,account\n2026-01-01,income,100,Bank\n2026-01-01,income,100,Bank";
  const rows = csv.preview(text, s);
  assert.deepEqual(
    rows.map((r) => r.duplicate),
    [false, true],
  );
  assert.throws(() => csv.parseCSV('date,notes\n2026-01-01,"unclosed'));
});
test("10,000-row import remains atomic and practical", () => {
  const s = fixture();
  const rows = Array.from({ length: 10000 }, () => ({
    date: "2026-01-01",
    kind: "income",
    amount: 100,
    account: "bank",
    payee: "Batch",
    notes: "",
  }));
  const start = Date.now(),
    result = c.change(s, "import", { rows });
  assert.equal(result.transactions.length, 10000);
  assert.equal(c.balances(result).bank, 11000000);
  assert.equal(s.transactions.length, 0);
  assert.ok(Date.now() - start < 5000);
});
test("automatic backup rotation keeps fourteen dates", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pocket-rotation-"));
  const db = new Store(dir);
  try {
    const backupDir = path.join(dir, "backups");
    fs.mkdirSync(backupDir);
    for (let i = 1; i <= 20; i++)
      fs.writeFileSync(
        path.join(
          backupDir,
          `daily-2020-01-${String(i).padStart(2, "0")}.json`,
        ),
        "{}",
      );
    db.autoBackup();
    assert.equal(fs.readdirSync(backupDir).length, 14);
    assert.ok(fs.existsSync(path.join(backupDir, `daily-${c.today()}.json`)));
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
