const { randomUUID } = require("node:crypto");
const id = () => randomUUID();
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const monthOf = (d) => d.slice(0, 7);
function dateOK(s) {
  return (
    typeof s === "string" &&
    /^20\d\d-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s
  );
}
function monthOK(s) {
  return typeof s === "string" && /^20\d\d-(0[1-9]|1[0-2])$/.test(s);
}
function shiftMonth(m, n) {
  const [y, k] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, k - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
function days(a, b) {
  return Math.round((Date.parse(a) - Date.parse(b)) / 86400000);
}
function money(v) {
  const s = String(v).trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(s))
    throw Error("Enter an amount with at most two decimal places.");
  const n = Math.round(Number(s) * 100);
  minor(n);
  return n;
}
function minor(n) {
  if (!Number.isSafeInteger(n) || Math.abs(n) > 1e13)
    throw Error("Amount is outside the supported range.");
}
function requireThat(ok, message) {
  if (!ok) throw Error(message);
}
function label(s) {
  requireThat(
    typeof s === "string" && s.trim().length > 0 && s.length <= 120,
    "Enter a name (1–120 characters).",
  );
}
function initial() {
  return {
    version: 1,
    settings: {
      onboarded: false,
      currency: "LKR",
      reminders: true,
      startup: false,
      privacy: false,
      reminderDays: [7, 3, 0],
    },
    accounts: [],
    categories: [
      "Housing",
      "Groceries",
      "Transport",
      "Utilities",
      "Health",
      "Dining & fun",
      "Shopping",
      "Interest & fees",
      "Other",
    ].map((name, i) => ({
      id: id(),
      name,
      color: [
        "#527f68",
        "#b79861",
        "#798bad",
        "#a083a6",
        "#699ca0",
        "#d08c71",
        "#8b9570",
        "#92939a",
        "#7e9b87",
      ][i],
      archived: false,
      order: i,
    })),
    transactions: [],
    budgets: [],
    incomePlans: [],
    schedules: [],
    goals: [],
    goalEntries: [],
    reminderState: {},
  };
}
function validate(s) {
  requireThat(
    s && s.version === 1,
    "This file is not a supported Pocket Plan backup.",
  );
  for (const key of [
    "accounts",
    "categories",
    "transactions",
    "budgets",
    "incomePlans",
    "schedules",
    "goals",
    "goalEntries",
  ])
    requireThat(
      Array.isArray(s[key]) && s[key].length <= 100000,
      `Invalid ${key} data.`,
    );
  requireThat(
    s.settings &&
      s.settings.currency === "LKR" &&
      ["onboarded", "reminders", "startup", "privacy"].every(
        (k) => typeof s.settings[k] === "boolean",
      ),
    "Invalid settings.",
  );
  requireThat(
    Array.isArray(s.settings.reminderDays) &&
      s.settings.reminderDays.length <= 10 &&
      s.settings.reminderDays.every(
        (n) => Number.isInteger(n) && n >= 0 && n <= 90,
      ),
    "Invalid reminder timing.",
  );
  for (const k of [
    "accounts",
    "categories",
    "transactions",
    "schedules",
    "goals",
    "goalEntries",
  ]) {
    const keys = new Set();
    for (const o of s[k]) {
      requireThat(
        o &&
          typeof o.id === "string" &&
          /^[\w-]{1,100}$/.test(o.id) &&
          !keys.has(o.id),
        `Invalid or duplicate ${k} ID.`,
      );
      keys.add(o.id);
    }
  }
  const account = (k) => s.accounts.find((a) => a.id === k);
  const cat = (k) => s.categories.some((a) => a.id === k);
  for (const a of s.accounts) {
    label(a.name);
    requireThat(
      ["cash", "bank", "savings", "card", "loan"].includes(a.type),
      "Invalid account type.",
    );
    minor(a.opening);
    requireThat(dateOK(a.openingDate), "Invalid opening date.");
    requireThat(typeof a.archived === "boolean", "Invalid account status.");
    if (a.limit != null) {
      minor(a.limit);
      requireThat(a.limit >= 0, "Credit limit cannot be negative.");
    }
    if (a.rate != null)
      requireThat(
        Number.isFinite(a.rate) && a.rate >= 0 && a.rate <= 1000,
        "Invalid interest rate.",
      );
  }
  for (const a of s.accounts)
    for (const key of ["statement", "minimum"])
      if (a[key] != null) {
        minor(a[key]);
        requireThat(
          a[key] >= 0,
          "Statement balances and minimum payments cannot be negative.",
        );
      }
  for (const c of s.categories) {
    label(c.name);
    requireThat(
      /^#[\da-fA-F]{6}$/.test(c.color) &&
        typeof c.archived === "boolean" &&
        Number.isInteger(c.order),
      "Invalid category.",
    );
  }
  const occurrences = new Set();
  for (const t of s.transactions) {
    requireThat(
      ["expense", "income", "refund", "transfer", "payment"].includes(t.kind),
      "Invalid transaction type.",
    );
    minor(t.amount);
    requireThat(t.amount > 0, "Amount must be greater than zero.");
    requireThat(dateOK(t.date), "Enter a valid transaction date.");
    requireThat(account(t.account), "Choose an account.");
    requireThat(
      t.date >= account(t.account).openingDate,
      "Transaction date is before the account opening date.",
    );
    if (["transfer", "payment"].includes(t.kind)) {
      requireThat(
        account(t.to) && t.to !== t.account,
        "Choose a different destination account.",
      );
      requireThat(
        t.date >= account(t.to).openingDate,
        "Transaction date is before the destination opening date.",
      );
    }
    if (t.kind === "payment") {
      requireThat(
        ["card", "loan"].includes(account(t.to).type),
        "Payment destination must be a credit card or debt.",
      );
      requireThat(
        !["card", "loan"].includes(account(t.account).type),
        "Pay debts from a cash, bank, or savings account.",
      );
      minor(t.interest);
      requireThat(
        t.interest >= 0 && t.interest < t.amount,
        "Interest must be less than the total payment.",
      );
      if (t.interest > 0)
        requireThat(
          cat(t.category),
          "Select a category for interest and fees.",
        );
    }
    if (["expense", "refund"].includes(t.kind))
      requireThat(cat(t.category), "Choose a category.");
    requireThat(
      typeof t.payee === "string" &&
        t.payee.length <= 120 &&
        typeof t.notes === "string" &&
        t.notes.length <= 2000,
      "Payee or notes are too long.",
    );
    if (t.occurrence) {
      requireThat(
        typeof t.occurrence === "string" && !occurrences.has(t.occurrence),
        "This scheduled payment has already been recorded.",
      );
      const [sid, due] = t.occurrence.split("@");
      requireThat(
        s.schedules.some((r) => r.id === sid) && dateOK(due),
        "Invalid scheduled transaction link.",
      );
      occurrences.add(t.occurrence);
    }
  }
  const budgetKeys = new Set();
  for (const b of s.budgets) {
    requireThat(cat(b.category) && monthOK(b.month), "Invalid budget.");
    minor(b.amount);
    requireThat(b.amount >= 0, "Budget cannot be negative.");
    if (b.carryOverride != null) minor(b.carryOverride);
    const key = b.month + b.category;
    requireThat(!budgetKeys.has(key), "Duplicate budget.");
    budgetKeys.add(key);
  }
  const incomeKeys = new Set();
  for (const p of s.incomePlans) {
    requireThat(
      monthOK(p.month) && !incomeKeys.has(p.month),
      "Invalid income plan.",
    );
    minor(p.amount);
    requireThat(p.amount >= 0, "Planned income cannot be negative.");
    incomeKeys.add(p.month);
  }
  for (const r of s.schedules) {
    label(r.name);
    requireThat(
      dateOK(r.start) && (!r.end || (dateOK(r.end) && r.end >= r.start)),
      "Invalid schedule dates.",
    );
    requireThat(
      ["once", "weekly", "monthly", "yearly"].includes(r.frequency) &&
        typeof r.active === "boolean",
      "Invalid schedule.",
    );
    requireThat(
      ["expense", "income", "payment", "transfer"].includes(r.kind),
      "Invalid scheduled transaction type.",
    );
    minor(r.amount);
    requireThat(
      r.amount > 0 && account(r.account),
      "Invalid scheduled amount or account.",
    );
    requireThat(
      r.start >= account(r.account).openingDate,
      "Schedule starts before the account opening date.",
    );
    if (["expense"].includes(r.kind))
      requireThat(cat(r.category), "Choose a category.");
    if (["transfer", "payment"].includes(r.kind))
      requireThat(
        account(r.to) &&
          r.to !== r.account &&
          r.start >= account(r.to).openingDate,
        "Invalid scheduled destination.",
      );
    if (r.kind === "payment") {
      requireThat(
        ["card", "loan"].includes(account(r.to).type) &&
          !["card", "loan"].includes(account(r.account).type),
        "Choose a bank/cash/savings source and a debt destination.",
      );
      minor(r.interest);
      requireThat(
        r.interest >= 0 && r.interest < r.amount,
        "Invalid scheduled interest.",
      );
      if (r.interest)
        requireThat(cat(r.category), "Choose an interest category.");
    }
  }
  for (const g of s.goals) {
    label(g.name);
    minor(g.target);
    requireThat(
      g.target > 0 &&
        account(g.account) &&
        !["card", "loan"].includes(account(g.account).type),
      "Choose a cash, bank or savings account for the goal.",
    );
    requireThat(!g.date || dateOK(g.date), "Invalid goal date.");
  }
  for (const e of s.goalEntries) {
    requireThat(
      s.goals.some((g) => g.id === e.goal) && dateOK(e.date),
      "Invalid goal entry.",
    );
    minor(e.amount);
    requireThat(e.amount !== 0, "Enter a nonzero allocation.");
    requireThat(
      typeof e.notes === "string" && e.notes.length <= 2000,
      "Invalid allocation note.",
    );
  }
  const goalBalances = new Map();
  for (const e of [...s.goalEntries].sort((a, b) =>
    a.date.localeCompare(b.date),
  )) {
    const value = (goalBalances.get(e.goal) || 0) + e.amount;
    requireThat(
      value >= 0,
      "A goal cannot release money before it was allocated.",
    );
    goalBalances.set(e.goal, value);
  }
  // Bound aggregate arithmetic as well as individual inputs to exact integer cents.
  const aggregate = [
    ...s.accounts.map((a) => a.opening),
    ...s.transactions.map((t) => t.amount),
    ...s.budgets.flatMap((b) => [b.amount, b.carryOverride || 0]),
    ...s.goalEntries.map((e) => e.amount),
  ].reduce((n, v) => n + Math.abs(v), 0);
  requireThat(
    Number.isSafeInteger(aggregate),
    "Combined amounts exceed the exact calculation limit.",
  );
  requireThat(
    s.reminderState &&
      typeof s.reminderState === "object" &&
      !Array.isArray(s.reminderState),
    "Invalid reminder history.",
  );
  for (const [k, v] of Object.entries(s.reminderState)) {
    requireThat(
      k.length < 250 && v && typeof v === "object",
      "Invalid reminder.",
    );
    if (v.last) requireThat(dateOK(v.last), "Invalid notification date.");
    if (v.snooze) requireThat(Number.isFinite(v.snooze), "Invalid snooze.");
    if (v.dismissed != null)
      requireThat(typeof v.dismissed === "boolean", "Invalid dismissal.");
  }
  return s;
}
function balances(s, at = today()) {
  const out = Object.fromEntries(
    s.accounts.map((a) => [a.id, a.openingDate <= at ? a.opening : 0]),
  );
  for (const t of s.transactions.filter((t) => t.date <= at)) {
    if (t.kind === "income" || t.kind === "refund") out[t.account] += t.amount;
    else out[t.account] -= t.amount;
    if (t.kind === "transfer") out[t.to] += t.amount;
    if (t.kind === "payment") out[t.to] += t.amount - t.interest;
  }
  return out;
}
function spending(t) {
  return t.kind === "expense"
    ? t.amount
    : t.kind === "refund"
      ? -t.amount
      : t.kind === "payment"
        ? t.interest
        : 0;
}
function budgetRows(s, month) {
  requireThat(monthOK(month), "Invalid month.");
  const spendByMonth = new Map();
  const plans = new Map(s.budgets.map((b) => [`${b.category}@${b.month}`, b]));
  for (const t of s.transactions) {
    const key = `${t.category}@${monthOf(t.date)}`;
    spendByMonth.set(key, (spendByMonth.get(key) || 0) + spending(t));
  }
  return [...s.categories]
    .sort((a, b) => a.order - b.order)
    .map((c) => {
      const months = [
        ...s.budgets.filter((b) => b.category === c.id).map((b) => b.month),
        ...s.transactions
          .filter((t) => t.category === c.id)
          .map((t) => monthOf(t.date)),
        month,
      ]
        .filter((m) => m <= month)
        .sort();
      let carry = 0,
        result;
      for (let m = months[0]; m <= month; m = shiftMonth(m, 1)) {
        const b = plans.get(`${c.id}@${m}`);
        if (b?.carryOverride != null) carry = b.carryOverride;
        const spent = spendByMonth.get(`${c.id}@${m}`) || 0;
        const planned = b?.amount || 0;
        result = {
          ...c,
          carry,
          planned,
          spent,
          available: carry + planned,
          remaining: carry + planned - spent,
          override: b?.carryOverride ?? null,
        };
        carry = result.remaining;
      }
      return result;
    });
}
function dueDate(r, n) {
  if (r.frequency === "once") return n === 0 ? r.start : null;
  if (r.frequency === "weekly")
    return new Date(Date.parse(r.start) + n * 7 * 86400000)
      .toISOString()
      .slice(0, 10);
  const m = shiftMonth(
    monthOf(r.start),
    n * (r.frequency === "yearly" ? 12 : 1),
  );
  const [y, k] = m.split("-").map(Number);
  const day = Math.min(
    Number(r.start.slice(8)),
    new Date(Date.UTC(y, k, 0)).getUTCDate(),
  );
  return `${m}-${String(day).padStart(2, "0")}`;
}
function occurrences(s, through = today(), includePaid = false) {
  const out = [];
  for (const r of s.schedules.filter((r) => r.active)) {
    for (let n = 0; n < 6000; n++) {
      const due = dueDate(r, n);
      if (!due || due > through || (r.end && due > r.end)) break;
      const key = `${r.id}@${due}`,
        paid = s.transactions.find((t) => t.occurrence === key),
        state = s.reminderState[key] || {};
      if (includePaid || !paid)
        out.push({ ...r, due, key, paid: paid?.id || null, ...state });
    }
  }
  return out.sort((a, b) => a.due.localeCompare(b.due));
}
function notificationCandidates(s, now = new Date()) {
  if (!s.settings.reminders) return [];
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const horizon = new Date(Date.parse(day) + 90 * 86400000)
    .toISOString()
    .slice(0, 10);
  return occurrences(s, horizon).filter((o) => {
    if (o.dismissed || o.snooze > now.getTime() || o.last === day) return false;
    const delta = days(o.due, day);
    if (delta < 0) return true;
    const threshold = [...s.settings.reminderDays]
      .sort((a, b) => a - b)
      .find((n) => n >= delta);
    if (threshold == null) return false;
    const thresholdDate = new Date(Date.parse(o.due) - threshold * 86400000)
      .toISOString()
      .slice(0, 10);
    return !o.last || o.last < thresholdDate;
  });
}
function snapshot(s, month = monthOf(today())) {
  const b = balances(s);
  const tx = s.transactions.filter((t) => monthOf(t.date) === month);
  const assets = s.accounts
    .filter((a) => !["card", "loan"].includes(a.type))
    .reduce((n, a) => n + b[a.id], 0);
  const debts = s.accounts
    .filter((a) => ["card", "loan"].includes(a.type))
    .reduce((n, a) => n - b[a.id], 0);
  return {
    balances: b,
    assets,
    debts,
    net: assets - debts,
    income: tx
      .filter((t) => t.kind === "income")
      .reduce((n, t) => n + t.amount, 0),
    spent: tx.reduce((n, t) => n + spending(t), 0),
    budget: budgetRows(s, month),
    upcoming: occurrences(
      s,
      new Date(Date.parse(today()) + 30 * 86400000).toISOString().slice(0, 10),
    ),
    goals: s.goals.map((g) => ({
      ...g,
      saved: s.goalEntries
        .filter((e) => e.goal === g.id && e.date <= today())
        .reduce((n, e) => n + e.amount, 0),
    })),
  };
}
function change(original, action, p = {}) {
  const s = structuredClone(original);
  if (action === "account") {
    const row = {
      id: p.id || id(),
      name: p.name?.trim(),
      type: p.type,
      opening: p.opening,
      openingDate: p.openingDate,
      limit: p.limit ?? null,
      rate: p.rate ?? null,
      statement: p.statement ?? null,
      minimum: p.minimum ?? null,
      archived: !!p.archived,
    };
    const idx = s.accounts.findIndex((a) => a.id === row.id);
    if (idx >= 0)
      requireThat(
        row.type === s.accounts[idx].type,
        "An existing account type cannot be changed.",
      );
    idx < 0 ? s.accounts.push(row) : (s.accounts[idx] = row);
  } else if (action === "category") {
    const row = {
      id: p.id || id(),
      name: p.name?.trim(),
      color: p.color || "#527f68",
      archived: !!p.archived,
      order: p.order ?? s.categories.length,
    };
    const idx = s.categories.findIndex((a) => a.id === row.id);
    idx < 0 ? s.categories.push(row) : (s.categories[idx] = row);
  } else if (action === "categoryMove") {
    const ordered = [...s.categories].sort((a, b) => a.order - b.order);
    const i = ordered.findIndex((c) => c.id === p.id);
    const j = i + p.direction;
    requireThat(
      i >= 0 && j >= 0 && j < ordered.length,
      "Category cannot move further.",
    );
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    ordered.forEach((c, n) => (c.order = n));
  } else if (action === "transaction") {
    const existing = s.transactions.find((t) => t.id === p.id);
    const row = {
      id: p.id || id(),
      kind: p.kind,
      date: p.date,
      amount: p.amount,
      account: p.account,
      to: p.to || null,
      category: p.category || null,
      interest: p.kind === "payment" ? p.interest || 0 : 0,
      payee: p.payee || "",
      notes: p.notes || "",
      occurrence: existing?.occurrence || p.occurrence || null,
    };
    const idx = s.transactions.findIndex((t) => t.id === row.id);
    idx < 0 ? s.transactions.push(row) : (s.transactions[idx] = row);
  } else if (action === "deleteTransaction") {
    requireThat(
      s.transactions.some((t) => t.id === p.id),
      "Transaction not found.",
    );
    s.transactions = s.transactions.filter((t) => t.id !== p.id);
  } else if (action === "budget") {
    requireThat(monthOK(p.month), "Invalid month.");
    s.budgets = s.budgets.filter(
      (b) => !(b.month === p.month && b.category === p.category),
    );
    s.budgets.push({
      month: p.month,
      category: p.category,
      amount: p.amount,
      carryOverride: p.carryOverride ?? null,
    });
  } else if (action === "incomePlan") {
    s.incomePlans = s.incomePlans.filter((b) => b.month !== p.month);
    s.incomePlans.push({ month: p.month, amount: p.amount });
  } else if (action === "copyBudget") {
    requireThat(monthOK(p.month), "Invalid month.");
    const from = shiftMonth(p.month, -1);
    for (const c of s.categories.filter((c) => !c.archived)) {
      const old = s.budgets.find(
        (b) => b.month === from && b.category === c.id,
      );
      const current = s.budgets.find(
        (b) => b.month === p.month && b.category === c.id,
      );
      s.budgets = s.budgets.filter((b) => b !== current);
      s.budgets.push({
        month: p.month,
        category: c.id,
        amount: old?.amount || 0,
        carryOverride: current?.carryOverride ?? null,
      });
    }
    const inc = s.incomePlans.find((i) => i.month === from);
    if (inc) {
      s.incomePlans = s.incomePlans.filter((i) => i.month !== p.month);
      s.incomePlans.push({ month: p.month, amount: inc.amount });
    }
  } else if (action === "schedule") {
    const row = {
      id: p.id || id(),
      name: p.name?.trim(),
      kind: p.kind,
      amount: p.amount,
      account: p.account,
      to: p.to || null,
      category: p.category || null,
      interest: p.kind === "payment" ? p.interest || 0 : 0,
      start: p.start,
      end: p.end || null,
      frequency: p.frequency,
      active: p.active !== false,
    };
    const idx = s.schedules.findIndex((r) => r.id === row.id);
    idx < 0 ? s.schedules.push(row) : (s.schedules[idx] = row);
  } else if (action === "settle") {
    const r = s.schedules.find((r) => r.id === p.id);
    requireThat(r && r.active, "Schedule not found.");
    requireThat(
      occurrences(s, p.due).some((o) => o.key === `${r.id}@${p.due}`),
      "This occurrence is invalid or already paid.",
    );
    return change(s, "transaction", {
      ...r,
      id: undefined,
      payee: r.name,
      date: p.date || today(),
      occurrence: `${r.id}@${p.due}`,
      amount: p.amount ?? r.amount,
      interest: p.interest ?? r.interest,
    });
  } else if (action === "reminder") {
    requireThat(
      typeof p.key === "string" &&
        s.schedules.some((r) => p.key.startsWith(`${r.id}@`)),
      "Reminder not found.",
    );
    s.reminderState[p.key] = { ...s.reminderState[p.key], ...p.value };
  } else if (action === "goal") {
    const row = {
      id: p.id || id(),
      name: p.name?.trim(),
      target: p.target,
      account: p.account,
      date: p.date || null,
    };
    const idx = s.goals.findIndex((g) => g.id === row.id);
    idx < 0 ? s.goals.push(row) : (s.goals[idx] = row);
  } else if (action === "goalEntry") {
    requireThat(
      s.goals.some((g) => g.id === p.goal),
      "Goal not found.",
    );
    s.goalEntries.push({
      id: id(),
      goal: p.goal,
      amount: p.amount,
      date: p.date,
      notes: p.notes || "",
    });
    const total = s.goalEntries
      .filter((e) => e.goal === p.goal)
      .reduce((n, e) => n + e.amount, 0);
    requireThat(
      total >= 0,
      "You cannot release more than this goal has allocated.",
    );
  } else if (action === "settings")
    s.settings = { ...s.settings, ...p, currency: "LKR" };
  else if (action === "import") {
    requireThat(
      Array.isArray(p.rows) && p.rows.length <= 10000,
      "Import supports at most 10,000 rows.",
    );
    for (const row of p.rows)
      s.transactions.push({
        id: id(),
        kind: row.kind,
        date: row.date,
        amount: row.amount,
        account: row.account,
        to: row.to || null,
        category: row.category || null,
        interest: row.kind === "payment" ? row.interest || 0 : 0,
        payee: row.payee || "",
        notes: row.notes || "",
        occurrence: null,
      });
  } else throw Error("Unknown action.");
  validate(s);
  return s;
}
module.exports = {
  id,
  today,
  dateOK,
  monthOK,
  monthOf,
  shiftMonth,
  days,
  money,
  initial,
  validate,
  balances,
  spending,
  budgetRows,
  dueDate,
  occurrences,
  notificationCandidates,
  snapshot,
  change,
};
