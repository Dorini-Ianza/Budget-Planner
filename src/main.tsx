import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  CalendarClock,
  Target,
  ChartNoAxesCombined,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  X,
  Search,
  Ellipsis,
  Download,
  Upload,
  ShieldCheck,
  Leaf,
  Bell,
  CreditCard,
  Pencil,
  Trash2,
  Archive,
  Copy,
  RefreshCw,
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import "./styles.css";
declare global {
  interface Window {
    budget: any;
  }
}
type Row = Record<string, any>;
const fmt = (n: number = 0) =>
  new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
  }).format(n / 100);
const plain = (n: number = 0) => (n / 100).toFixed(2);
const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const shift = (m: string, n: number) => {
  const [y, k] = m.split("-").map(Number);
  return new Date(Date.UTC(y, k - 1 + n, 1)).toISOString().slice(0, 7);
};
const money = (v: any) => {
  const s = String(v ?? "").trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(s))
    throw Error("Enter an amount with at most two decimal places.");
  const n = Math.round(Number(s) * 100);
  if (!Number.isSafeInteger(n)) throw Error("Amount is too large.");
  return n;
};
const monthName = (m: string) =>
  new Date(m + "-02").toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
const dateLabel = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const nav = [
  ["dashboard", "Overview", LayoutDashboard],
  ["budget", "Monthly budget", Wallet],
  ["transactions", "Transactions", ArrowLeftRight],
  ["accounts", "Accounts & debt", CreditCard],
  ["payments", "Payments", CalendarClock],
  ["goals", "Savings goals", Target],
  ["reports", "Reports", ChartNoAxesCombined],
  ["settings", "Settings", Settings],
] as const;
function Field({ label, children, hint }: any) {
  const id = React.useId();
  const annotate = (node: any): any => {
    if (!React.isValidElement(node)) return node;
    const el = node as React.ReactElement<any>;
    return React.cloneElement(
      el,
      ["input", "select", "textarea"].includes(el.type as string)
        ? {
            "aria-labelledby": id,
            "aria-describedby": hint ? id + "-hint" : undefined,
          }
        : el.props.children
          ? { children: React.Children.map(el.props.children, annotate) }
          : {},
    );
  };
  return (
    <label className="field">
      <span id={id}>{label}</span>
      {React.Children.map(children, annotate)}
      {hint && <small id={id + "-hint"}>{hint}</small>}
    </label>
  );
}
function Stat({ label, value, note, negative = false }: any) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong className={negative ? "danger" : ""}>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
function Empty({ title, text, action, onClick }: any) {
  return (
    <div className="empty">
      <Leaf size={30} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="primary" onClick={onClick}>
          <Plus size={16} />
          {action}
        </button>
      )}
    </div>
  );
}
function Modal({ title, onClose, children }: any) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const focus = () =>
      ref.current?.querySelector<HTMLElement>("input,select,button")?.focus();
    focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const els = [
          ...ref.current!.querySelectorAll<HTMLElement>(
            'button,input,select,textarea,[tabindex="0"]',
          ),
        ].filter((e) => !(e as HTMLInputElement).disabled);
        if (e.shiftKey && document.activeElement === els[0]) {
          e.preventDefault();
          els.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === els.at(-1)) {
          e.preventDefault();
          els[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, []);
  return (
    <div className="overlay">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
        ref={ref}
      >
        <div className="modal-head">
          <div>
            <span className="eyebrow">POCKET PLAN</span>
            <h2>{title}</h2>
          </div>
          <button className="icon" aria-label="Close dialog" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function App() {
  const [data, setData] = useState<any>(null),
    [month, setMonth] = useState(localDate().slice(0, 7)),
    [page, setPage] = useState("dashboard"),
    [modal, setModal] = useState<any>(null),
    [form, setForm] = useState<Row>({}),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState(""),
    [accountFilter, setAccountFilter] = useState(""),
    [categoryFilter, setCategoryFilter] = useState(""),
    [allDates, setAllDates] = useState(false),
    [preview, setPreview] = useState<any>(null),
    [includeDuplicates, setIncludeDuplicates] = useState(false),
    [dateFrom, setDateFrom] = useState(""),
    [dateTo, setDateTo] = useState("");
  const read = async (m = month) => {
    const r = await window.budget.get(m);
    if (!r.ok) throw Error(r.error);
    setData(r.value);
  };
  useEffect(() => {
    read().catch((e) => setError(e.message));
  }, [month]);
  useEffect(
    () =>
      window.budget.onNavigate((p: string) => {
        setPage(p);
        read().catch((e) => setError(e.message));
      }),
    [month],
  );
  useEffect(() => {
    const refresh = () => read().catch((e) => setError(e.message));
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [month]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 6000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  async function act(action: string, payload: Row, message = "Saved") {
    const r = await window.budget.act(action, payload, month);
    if (!r.ok) throw Error(r.error);
    setData(r.value);
    if (message) setToast(message);
    return r.value;
  }
  async function run(fn: () => Promise<any>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function open(type: string, row: Row = {}) {
    setError("");
    let defaults: Row = {};
    const s = data?.state;
    const first =
      s?.accounts.find(
        (a: Row) => !a.archived && !["card", "loan"].includes(a.type),
      )?.id || "";
    const cat = s?.categories.find((a: Row) => !a.archived)?.id || "";
    if (type === "account")
      defaults = {
        name: "",
        type: "bank",
        opening: "0.00",
        openingDate: localDate(),
        limit: "",
        rate: "",
        statement: "",
        minimum: "",
      };
    if (type === "transaction")
      defaults = {
        kind: "expense",
        date: localDate(),
        amount: "",
        account: first,
        to: "",
        category: cat,
        interest: "0.00",
        payee: "",
        notes: "",
      };
    if (type === "schedule")
      defaults = {
        name: "",
        kind: "expense",
        amount: "",
        account: first,
        to: "",
        category: cat,
        interest: "0.00",
        start: localDate(),
        end: "",
        frequency: "monthly",
        active: true,
      };
    if (type === "goal")
      defaults = { name: "", target: "", account: first, date: "" };
    if (type === "goalEntry")
      defaults = { amount: "", date: localDate(), notes: "", direction: "add" };
    if (type === "category") defaults = { name: "", color: "#527f68" };
    if (type === "incomePlan")
      defaults = {
        amount: plain(
          s.incomePlans.find((p: Row) => p.month === month)?.amount || 0,
        ),
      };
    if (type === "settle")
      defaults = {
        date: localDate(),
        amount: plain(row.amount),
        interest: plain(row.interest || 0),
      };
    const merged = { ...defaults, ...row };
    if (type === "goalEntry") {
      merged.date = localDate();
      merged.amount = "";
      merged.notes = "";
      merged.direction = "add";
    }
    setForm(merged);
    setModal({ type, row });
  }
  const f = (key: string, value: any) =>
    setForm((v) => ({ ...v, [key]: value }));
  function input(key: string, type = "text", required = true) {
    return (
      <input
        type={type}
        value={form[key] ?? ""}
        onChange={(e) => f(key, e.target.value)}
        required={required}
        step={type === "number" ? "0.01" : undefined}
        maxLength={type === "text" ? 120 : undefined}
      />
    );
  }
  function amount(key: string) {
    return (
      <div className="money-input">
        <span>LKR</span>
        {input(key, "number")}
      </div>
    );
  }
  function options(key: string, items: Row[], placeholder = "Select…") {
    return (
      <select
        value={form[key] || ""}
        onChange={(e) => f(key, e.target.value)}
        required
      >
        <option value="">{placeholder}</option>
        {items.map((a) => (
          <option value={a.id} key={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    );
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    await run(async () => {
      const p = { ...form };
      const type = modal.type;
      if (type === "account") {
        p.opening =
          money(p.opening) * (p.type === "card" || p.type === "loan" ? -1 : 1);
        for (const k of ["limit", "statement", "minimum"])
          p[k] = p[k] === "" ? null : money(p[k]);
        p.rate = p.rate === "" ? null : Number(p.rate);
      }
      if (
        [
          "transaction",
          "schedule",
          "settle",
          "budget",
          "incomePlan",
          "goalEntry",
        ].includes(type)
      )
        p.amount = money(p.amount);
      if (["transaction", "schedule", "settle"].includes(type))
        p.interest = money(p.interest || "0");
      if (type === "budget") {
        p.month = month;
        p.carryOverride =
          p.carryOverride === "" ? null : money(p.carryOverride);
      }
      if (type === "incomePlan") p.month = month;
      if (type === "goal") p.target = money(p.target);
      if (type === "goalEntry") {
        p.goal = modal.row.id;
        p.amount *= p.direction === "release" ? -1 : 1;
      }
      if (type === "settle") {
        p.id = modal.row.id;
        p.due = modal.row.due;
      }
      if (type === "delete") {
        await act(
          "deleteTransaction",
          { id: modal.row.id },
          "Transaction deleted",
        );
      } else if (type === "copy") {
        await act("copyBudget", { month }, "Previous allocations copied");
      } else await act(type, p);
      setModal(null);
    });
  }
  async function file(action: string) {
    await run(async () => {
      const r = await window.budget.file(action);
      if (!r.ok) throw Error(r.error);
      if (r.value?.preview) {
        setPreview(r.value.preview);
        setIncludeDuplicates(false);
      }
      if (r.value?.message) setToast(r.value.message);
      await read();
    });
  }
  if (!data)
    return (
      <div className="loading">
        <Leaf />
        <h2>Pocket Plan</h2>
        <p>{error || "Opening your local planner…"}</p>
        {error && (
          <button onClick={() => read().catch((e) => setError(e.message))}>
            Try again
          </button>
        )}
      </div>
    );
  const { state: s, summary: v } = data;
  const active = s.accounts.filter((a: Row) => !a.archived),
    cats = s.categories
      .filter((c: Row) => !c.archived)
      .sort((a: Row, b: Row) => a.order - b.order);
  const accountName = (id: string) =>
    s.accounts.find((a: Row) => a.id === id)?.name || "—";
  const categoryName = (id: string) =>
    s.categories.find((a: Row) => a.id === id)?.name || "—";
  const budget = v.budget.filter(
    (b: Row) => !b.archived || b.spent || b.remaining,
  );
  const allocated = budget.reduce((n: number, b: Row) => n + b.planned, 0),
    remaining = budget.reduce((n: number, b: Row) => n + b.remaining, 0),
    carry = budget.reduce((n: number, b: Row) => n + b.carry, 0),
    plannedIncome =
      s.incomePlans.find((i: Row) => i.month === month)?.amount || 0;
  const saved = v.goals.reduce((n: number, g: Row) => n + g.saved, 0);
  const upcoming = v.upcoming.filter((o: Row) => !o.dismissed);
  const debtAccounts = s.accounts.filter((a: Row) =>
    ["card", "loan"].includes(a.type),
  );
  const transactions = [...s.transactions]
    .filter(
      (t: Row) =>
        (allDates || t.date.slice(0, 7) === month) &&
        (!filter || t.kind === filter) &&
        (!accountFilter ||
          t.account === accountFilter ||
          t.to === accountFilter) &&
        (!categoryFilter || t.category === categoryFilter) &&
        (!dateFrom || t.date >= dateFrom) &&
        (!dateTo || t.date <= dateTo) &&
        `${t.payee} ${t.notes} ${accountName(t.account)} ${categoryName(t.category)}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a: Row, b: Row) => b.date.localeCompare(a.date));
  const editAccount = (a: Row) =>
    open("account", {
      ...a,
      opening: plain(
        ["card", "loan"].includes(a.type) ? -a.opening : a.opening,
      ),
      limit: a.limit == null ? "" : plain(a.limit),
      rate: a.rate ?? "",
      statement: a.statement == null ? "" : plain(a.statement),
      minimum: a.minimum == null ? "" : plain(a.minimum),
    });
  const editTransaction = (t: Row) =>
    open("transaction", {
      ...t,
      amount: plain(t.amount),
      interest: plain(t.interest),
    });
  const scheduleFor = (a: Row) =>
    open("schedule", {
      kind: "payment",
      name: `${a.name} payment`,
      to: a.id,
      category:
        s.categories.find((c: Row) => c.name === "Interest & fees")?.id ||
        cats[0]?.id,
      amount: a.minimum ? plain(a.minimum) : "",
      frequency: "monthly",
    });
  const txTable = (rows: Row[], compact = false) => (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Transaction</th>
            <th>Date</th>
            {!compact && <th>Account</th>}
            <th>Category / type</th>
            <th className="right">Amount</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((t: Row) => (
            <tr key={t.id}>
              <td>
                <div className="tx-name">
                  <span
                    className={`tx-icon ${t.kind === "income" || t.kind === "refund" ? "positive" : ""}`}
                  >
                    {t.kind === "income" || t.kind === "refund" ? (
                      <ArrowDownLeft size={16} />
                    ) : t.kind === "payment" || t.kind === "transfer" ? (
                      <ArrowLeftRight size={16} />
                    ) : (
                      <ArrowUpRight size={16} />
                    )}
                  </span>
                  <div>
                    <b>
                      {t.payee ||
                        (
                          {
                            income: "Income",
                            expense: "Expense",
                            refund: "Refund",
                            transfer: "Account transfer",
                            payment: "Debt repayment",
                          } as Row
                        )[t.kind]}
                    </b>
                    <small>
                      {t.notes ||
                        (t.to
                          ? `To ${accountName(t.to)}`
                          : accountName(t.account))}
                    </small>
                  </div>
                </div>
              </td>
              <td>{dateLabel(t.date)}</td>
              {!compact && <td>{accountName(t.account)}</td>}
              <td>
                <span className="tag">
                  {["transfer", "payment", "income"].includes(t.kind)
                    ? t.kind
                    : categoryName(t.category)}
                </span>
              </td>
              <td
                className={`right numeric ${["income", "refund"].includes(t.kind) ? "positive" : ""}`}
              >
                {["income", "refund"].includes(t.kind) ? "+" : ""}
                {fmt(t.amount)}
              </td>
              <td>
                <div className="row-actions">
                  <button
                    aria-label={`Edit ${t.payee || t.kind}`}
                    className="icon"
                    onClick={() => editTransaction(t)}
                  >
                    <Pencil size={14} />
                  </button>
                  {!compact && (
                    <button
                      aria-label={`Delete ${t.payee || t.kind}`}
                      className="icon"
                      onClick={() => open("delete", t)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const title = nav.find((n) => n[0] === page)?.[1] || "Overview";
  return (
    <>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand">
            <span className="brand-mark">
              <Leaf size={24} />
            </span>
            <div>
              Pocket Plan<small>MAKE ROOM FOR WHAT MATTERS</small>
            </div>
          </div>
          <span className="nav-label">YOUR MONEY, AT A GLANCE</span>
          <nav>
            {nav.map(([key, name, Icon]) => (
              <button
                key={key}
                className={page === key ? "nav-item active" : "nav-item"}
                onClick={() => {
                  setPage(key);
                  setError("");
                }}
              >
                <Icon size={19} />
                <span>{name}</span>
                {key === "payments" && upcoming.length > 0 && (
                  <b aria-hidden="true">{upcoming.length}</b>
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="private-note">
              <ShieldCheck size={19} />
              <div>
                Just yours.<small>Offline. Stored on this computer.</small>
              </div>
            </div>
            <div className="profile">
              <span>D</span>
              <div>
                My personal planner<small>LKR · Sri Lankan rupee</small>
              </div>
            </div>
          </div>
        </aside>
        <main>
          <header>
            <div className="breadcrumb">
              My workspace <span>/</span> {title}
            </div>
            <div className="header-right">
              <span className="local-status">
                <i /> Saved locally
              </span>
              <button
                className="icon notification"
                aria-label="Upcoming payments"
                onClick={() => setPage("payments")}
              >
                <Bell size={20} />
                {upcoming.length > 0 && <i />}
              </button>
            </div>
          </header>
          <div className="content">
            <div className="page-heading">
              <div>
                <span className="eyebrow">
                  {page === "dashboard"
                    ? "A LITTLE CLARITY, EVERY DAY"
                    : "YOUR PERSONAL PLANNER"}
                </span>
                <h1>
                  {page === "dashboard" ? "Your money, in balance." : title}
                </h1>
                <p>
                  {
                    (
                      {
                        dashboard:
                          "A clear view of today. A thoughtful plan for tomorrow.",
                        budget:
                          "Give every rupee a purpose. Unused amounts carry forward.",
                        transactions:
                          "The small details that make the big picture.",
                        accounts:
                          "Your balances and what you owe, all in one place.",
                        payments: "Stay a step ahead of bills and repayments.",
                        goals: "Make space for the things you’re saving for.",
                        reports:
                          "Look back, spot patterns, and plan with confidence.",
                        settings: "Your planner, your preferences, your data.",
                      } as Row
                    )[page]
                  }
                </p>
              </div>
              <div className="heading-actions">
                {["dashboard", "budget", "transactions", "reports"].includes(
                  page,
                ) && (
                  <div className="month-control">
                    <button
                      aria-label="Previous month"
                      onClick={() => setMonth(shift(month, -1))}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <input
                      aria-label="Budget month"
                      type="month"
                      min="2000-01"
                      max="2099-12"
                      value={month}
                      onChange={(e) =>
                        e.target.value && setMonth(e.target.value)
                      }
                    />
                    <button
                      aria-label="Next month"
                      onClick={() => setMonth(shift(month, 1))}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
                <button
                  className="primary"
                  onClick={() =>
                    active.length ? open("transaction") : open("account")
                  }
                >
                  <Plus size={17} />
                  Add transaction
                </button>
              </div>
            </div>
            {error && !modal && (
              <div role="alert" className="error">
                {error}
                <button className="icon" onClick={() => setError("")}>
                  <X size={16} />
                </button>
              </div>
            )}
            {!s.settings.onboarded && (
              <section className="welcome">
                <div>
                  <span className="eyebrow">WELCOME TO YOUR FRESH START</span>
                  <h2>Let’s give your money a home.</h2>
                  <p>
                    Add your bank balance, cash, or an existing debt. You choose
                    the starting amounts. No bank login or card details needed.
                  </p>
                </div>
                <div>
                  <button className="primary" onClick={() => open("account")}>
                    <Plus size={17} />
                    Add your {s.accounts.length ? "next" : "first"} account
                  </button>
                  {s.accounts.length > 0 && (
                    <button
                      onClick={() =>
                        run(() =>
                          act(
                            "settings",
                            { onboarded: true },
                            "You’re ready to start planning",
                          ),
                        )
                      }
                    >
                      Finish setup <Check size={16} />
                    </button>
                  )}
                </div>
              </section>
            )}
            {page === "dashboard" && (
              <>
                <section className="overview-grid">
                  <div className="balance-card">
                    <span className="eyebrow">
                      AVAILABLE ACROSS YOUR ACCOUNTS
                    </span>
                    <div className="hero-amount">{fmt(v.assets)}</div>
                    <p>Cash, bank & savings · as of today</p>
                    <div className="balance-footer">
                      <div>
                        <small>Outstanding debt</small>
                        <b>{fmt(v.debts)}</b>
                      </div>
                      <div>
                        <small>Net position</small>
                        <b>{fmt(v.net)}</b>
                      </div>
                      <span className="hero-leaf">
                        <Leaf size={64} strokeWidth={1} />
                      </span>
                    </div>
                  </div>
                  <div className="month-stats">
                    <Stat
                      label="Income received"
                      value={fmt(v.income)}
                      note={monthName(month)}
                    />
                    <Stat
                      label="Spent this month"
                      value={fmt(v.spent)}
                      note="Includes interest; excludes principal"
                    />
                    <Stat
                      label="Budget remaining"
                      value={fmt(remaining)}
                      negative={remaining < 0}
                      note={`Includes ${fmt(carry)} rollover`}
                    />
                  </div>
                </section>
                <div className="two-column">
                  <section className="panel">
                    <div className="section-heading">
                      <div>
                        <h2>Your spending plan</h2>
                        <p>A little structure goes a long way.</p>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => setPage("budget")}
                      >
                        View budget <ArrowRight size={15} />
                      </button>
                    </div>
                    {allocated || v.spent || carry ? (
                      <div className="category-list">
                        {[...budget]
                          .sort((a: Row, b: Row) => b.available - a.available)
                          .slice(0, 5)
                          .map((b: Row) => (
                            <div className="category-progress" key={b.id}>
                              <div>
                                <span>
                                  <i style={{ background: b.color }} />
                                  {b.name}
                                </span>
                                <b>
                                  {fmt(b.spent)}{" "}
                                  <small>of {fmt(b.available)}</small>
                                </b>
                              </div>
                              <div className="progress">
                                <i
                                  style={{
                                    width: `${Math.min(100, Math.max(0, b.available > 0 ? (b.spent / b.available) * 100 : b.spent > 0 ? 100 : 0))}%`,
                                    background:
                                      b.remaining < 0 ? "#b9584b" : b.color,
                                  }}
                                />
                              </div>
                              <small
                                className={b.remaining < 0 ? "danger" : ""}
                              >
                                {b.remaining < 0
                                  ? `${fmt(-b.remaining)} over budget`
                                  : `${fmt(b.remaining)} remaining`}
                              </small>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <Empty
                        title="A plan starts with one category"
                        text="Set your monthly limits and watch your progress here."
                        action="Plan this month"
                        onClick={() => setPage("budget")}
                      />
                    )}
                  </section>
                  <section className="panel">
                    <div className="section-heading">
                      <div>
                        <h2>Coming up next</h2>
                        <p>Your next 30 days, and anything overdue.</p>
                      </div>
                      <CalendarClock size={20} />
                    </div>
                    {upcoming.length ? (
                      <div className="payment-list">
                        {upcoming.slice(0, 4).map((o: Row) => (
                          <div className="payment-row" key={o.key}>
                            <div className="date-tile">
                              <small>
                                {new Date(
                                  o.due + "T12:00:00",
                                ).toLocaleDateString("en-GB", {
                                  month: "short",
                                })}
                              </small>
                              <b>{o.due.slice(8)}</b>
                            </div>
                            <div className="grow">
                              <b>{o.name}</b>
                              <small
                                className={o.due < localDate() ? "danger" : ""}
                              >
                                {o.due < localDate()
                                  ? "Overdue"
                                  : accountName(o.account)}
                              </small>
                            </div>
                            <b>{fmt(o.amount)}</b>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Empty
                        title="Nothing on the horizon"
                        text="Add bills or repayments and we’ll help you remember them."
                      />
                    )}
                    <button
                      className="wide subtle"
                      onClick={() => setPage("payments")}
                    >
                      Manage payments <ArrowRight size={15} />
                    </button>
                  </section>
                </div>
                <section className="panel">
                  <div className="section-heading">
                    <div>
                      <h2>Recent activity</h2>
                      <p>The latest entries in {monthName(month)}.</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setPage("transactions")}
                    >
                      All transactions <ArrowRight size={15} />
                    </button>
                  </div>
                  {transactions.length ? (
                    txTable(transactions.slice(0, 5), true)
                  ) : (
                    <Empty
                      title="Your story starts here"
                      text="Record your first income or expense to bring your planner to life."
                      action="Add transaction"
                      onClick={() =>
                        active.length ? open("transaction") : open("account")
                      }
                    />
                  )}
                </section>
              </>
            )}
            {page === "budget" && (
              <>
                <div className="stats-row">
                  <Stat
                    label="Planned income"
                    value={fmt(plannedIncome)}
                    note={
                      <button
                        className="text-button"
                        onClick={() => open("incomePlan")}
                      >
                        Edit income plan <Pencil size={12} />
                      </button>
                    }
                  />
                  <Stat
                    label="New allocations"
                    value={fmt(allocated)}
                    note={
                      allocated > plannedIncome
                        ? "Allocations exceed planned income"
                        : "This month’s category limits"
                    }
                    negative={allocated > plannedIncome}
                  />
                  <Stat
                    label="Carried forward"
                    value={fmt(carry)}
                    note="Positive and negative balances roll over"
                  />
                  <Stat
                    label="Remaining to spend"
                    value={fmt(remaining)}
                    note="Allocation + rollover − spending"
                    negative={remaining < 0}
                  />
                </div>
                <section className="panel">
                  <div className="section-heading">
                    <div>
                      <h2>Your monthly allocations</h2>
                      <p>
                        Changes to past transactions automatically update
                        rollover.
                      </p>
                    </div>
                    <button onClick={() => open("copy")}>
                      <Copy size={15} />
                      Copy previous month
                    </button>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th className="right">Rollover</th>
                          <th className="right">Planned</th>
                          <th className="right">Spent</th>
                          <th className="right">Remaining</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {budget.map((b: Row) => (
                          <tr key={b.id}>
                            <td>
                              <span
                                className="category-dot"
                                style={{ background: b.color }}
                              />
                              {b.name}
                              {b.archived && <small>Archived</small>}
                            </td>
                            <td className="right numeric">
                              {fmt(b.carry)}
                              {b.override !== null && <small>Adjusted</small>}
                            </td>
                            <td className="right numeric">{fmt(b.planned)}</td>
                            <td className="right numeric">{fmt(b.spent)}</td>
                            <td
                              className={`right numeric ${b.remaining < 0 ? "danger" : "positive"}`}
                            >
                              {fmt(b.remaining)}
                            </td>
                            <td>
                              <button
                                aria-label={`Edit ${b.name} budget`}
                                className="icon"
                                onClick={() =>
                                  open("budget", {
                                    category: b.id,
                                    name: b.name,
                                    amount: plain(b.planned),
                                    carryOverride:
                                      b.override === null
                                        ? ""
                                        : plain(b.override),
                                  })
                                }
                              >
                                <Pencil size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="panel-foot">
                    <span>
                      Rollover allocates your existing money; it doesn’t change
                      account balances.
                    </span>
                    <button
                      className="text-button"
                      onClick={() => open("category")}
                    >
                      <Plus size={14} />
                      New category
                    </button>
                  </div>
                </section>
              </>
            )}
            {page === "transactions" && (
              <section className="panel">
                <div className="filter-bar">
                  <div className="search">
                    <Search size={17} />
                    <input
                      aria-label="Search transactions"
                      placeholder="Search payee, notes, category…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <select
                    aria-label="Filter transaction type"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="">All types</option>
                    {["expense", "income", "refund", "transfer", "payment"].map(
                      (t) => (
                        <option key={t}>{t}</option>
                      ),
                    )}
                  </select>
                  <select
                    aria-label="Filter account"
                    value={accountFilter}
                    onChange={(e) => setAccountFilter(e.target.value)}
                  >
                    <option value="">All accounts</option>
                    {s.accounts.map((a: Row) => (
                      <option value={a.id} key={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Filter category"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <option value="">All categories</option>
                    {s.categories.map((c: Row) => (
                      <option value={c.id} key={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={allDates}
                      onChange={(e) => setAllDates(e.target.checked)}
                    />
                    All months
                  </label>
                </div>
                <div className="date-filters">
                  <label>
                    From{" "}
                    <input
                      aria-label="Transactions from"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </label>
                  <label>
                    To{" "}
                    <input
                      aria-label="Transactions to"
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </label>
                  <span>{transactions.length} entries</span>
                  <button
                    className="text-button"
                    onClick={() => {
                      setSearch("");
                      setFilter("");
                      setAccountFilter("");
                      setCategoryFilter("");
                      setDateFrom("");
                      setDateTo("");
                    }}
                  >
                    Clear filters
                  </button>
                </div>
                {transactions.length ? (
                  txTable(transactions)
                ) : (
                  <Empty
                    title="No transactions yet"
                    text="Add an entry, or change the filters to see more."
                    action="Add transaction"
                    onClick={() =>
                      active.length ? open("transaction") : open("account")
                    }
                  />
                )}
              </section>
            )}
            {page === "accounts" && (
              <>
                <div className="stats-row">
                  <Stat
                    label="Cash, bank & savings"
                    value={fmt(v.assets)}
                    note="Current account balances"
                  />
                  <Stat
                    label="Debt outstanding"
                    value={fmt(v.debts)}
                    note="Credit cards and loans"
                  />
                  <Stat
                    label="Net position"
                    value={fmt(v.net)}
                    note="Assets minus debt"
                    negative={v.net < 0}
                  />
                </div>
                <div className="section-heading">
                  <h2>Your accounts</h2>
                  <button onClick={() => open("account")}>
                    <Plus size={16} />
                    Add account or debt
                  </button>
                </div>
                <div className="account-grid">
                  {s.accounts.map((a: Row) => {
                    const debt = ["card", "loan"].includes(a.type);
                    return (
                      <section
                        className={`panel account-card ${a.archived ? "archived" : ""}`}
                        key={a.id}
                      >
                        <div className="section-heading">
                          <span className="account-symbol">
                            {debt ? (
                              <CreditCard size={22} />
                            ) : (
                              <Wallet size={22} />
                            )}
                          </span>
                          <span className="tag">
                            {a.type}
                            {a.archived ? " · archived" : ""}
                          </span>
                          <button
                            aria-label={`Edit ${a.name}`}
                            className="icon"
                            onClick={() => editAccount(a)}
                          >
                            <Pencil size={16} />
                          </button>
                        </div>
                        <h2>{a.name}</h2>
                        <strong className="account-amount">
                          {fmt(debt ? -v.balances[a.id] : v.balances[a.id])}
                        </strong>
                        <p>
                          {debt ? "Current amount owed" : "Current balance"}
                        </p>
                        {a.limit != null && (
                          <div className="detail-line">
                            <span>Available credit</span>
                            <b>{fmt(a.limit + v.balances[a.id])}</b>
                          </div>
                        )}
                        {a.statement != null && (
                          <div className="detail-line">
                            <span>Last statement balance</span>
                            <b>{fmt(a.statement)}</b>
                          </div>
                        )}
                        {a.minimum != null && (
                          <div className="detail-line">
                            <span>Minimum payment</span>
                            <b>{fmt(a.minimum)}</b>
                          </div>
                        )}
                        {a.rate != null && (
                          <div className="detail-line">
                            <span>Reference interest rate</span>
                            <b>{a.rate}%</b>
                          </div>
                        )}
                        <div className="account-footer">
                          <button
                            className="text-button"
                            onClick={() => {
                              setAccountFilter(a.id);
                              setAllDates(true);
                              setPage("transactions");
                            }}
                          >
                            View entries <ArrowRight size={14} />
                          </button>
                          {debt && !a.archived && (
                            <button
                              className="text-button"
                              onClick={() => scheduleFor(a)}
                            >
                              Plan repayment
                            </button>
                          )}
                        </div>
                      </section>
                    );
                  })}
                </div>
                {!s.accounts.length && (
                  <section className="panel">
                    <Empty
                      title="Bring your balances together"
                      text="Add cash, bank accounts, savings, credit cards, or loans. Just names and amounts."
                      action="Add account"
                      onClick={() => open("account")}
                    />
                  </section>
                )}
                <div className="info-note">
                  <ShieldCheck size={18} />
                  <span>
                    No card numbers, PINs or bank access. Interest is entered
                    manually; the app never assumes what your lender charged.
                  </span>
                </div>
              </>
            )}
            {page === "payments" && (
              <>
                <div className="section-heading">
                  <div>
                    <h2>Upcoming & overdue</h2>
                    <p>
                      Record payments when they happen. A reminder never changes
                      a balance.
                    </p>
                  </div>
                  <button onClick={() => open("schedule")}>
                    <Plus size={16} />
                    Schedule payment or income
                  </button>
                </div>
                <section className="panel">
                  {v.upcoming.length ? (
                    <div className="payment-list full">
                      {v.upcoming.map((o: Row) => (
                        <div
                          className={`payment-row ${o.dismissed ? "archived" : ""}`}
                          key={o.key}
                        >
                          <div className="date-tile">
                            <small>
                              {new Date(o.due + "T12:00:00").toLocaleDateString(
                                "en-GB",
                                { month: "short" },
                              )}
                            </small>
                            <b>{o.due.slice(8)}</b>
                          </div>
                          <div className="grow">
                            <b>{o.name}</b>
                            <small>
                              {accountName(o.account)}{" "}
                              {o.to ? `→ ${accountName(o.to)}` : ""} · {o.kind}
                            </small>
                            <small
                              className={o.due < localDate() ? "danger" : ""}
                            >
                              {dateLabel(o.due)}
                              {o.due < localDate() ? " · Overdue" : ""}
                              {o.dismissed ? " · Reminder dismissed" : ""}
                              {o.snooze > Date.now()
                                ? " · Snoozed for 24 hours"
                                : ""}
                            </small>
                          </div>
                          <b className="payment-amount">{fmt(o.amount)}</b>
                          <div className="row-actions">
                            <button
                              className="primary small"
                              onClick={() =>
                                open("settle", {
                                  ...o,
                                  amount: plain(o.amount),
                                  interest: plain(o.interest),
                                })
                              }
                            >
                              <Check size={14} />
                              {o.kind === "income" ? "Received" : "Record paid"}
                            </button>
                            <button
                              className="small"
                              onClick={() =>
                                run(() =>
                                  act(
                                    "reminder",
                                    {
                                      key: o.key,
                                      value: {
                                        snooze: Date.now() + 86400000,
                                        last: null,
                                        dismissed: false,
                                      },
                                    },
                                    "Snoozed for 24 hours",
                                  ),
                                )
                              }
                            >
                              Snooze
                            </button>
                            <button
                              className="icon"
                              aria-label={`${o.dismissed ? "Restore" : "Dismiss"} ${o.name} reminder`}
                              onClick={() =>
                                run(() =>
                                  act(
                                    "reminder",
                                    {
                                      key: o.key,
                                      value: { dismissed: !o.dismissed },
                                    },
                                    o.dismissed
                                      ? "Reminder restored"
                                      : "Reminder dismissed",
                                  ),
                                )
                              }
                            >
                              {o.dismissed ? (
                                <RefreshCw size={16} />
                              ) : (
                                <X size={16} />
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      title="All caught up"
                      text="Scheduled payments for the next 30 days and overdue items appear here."
                    />
                  )}
                </section>
                <section className="panel">
                  <div className="section-heading">
                    <div>
                      <h2>Your schedules</h2>
                      <p>
                        Monthly dates such as the 31st use the last day in
                        shorter months.
                      </p>
                    </div>
                  </div>
                  {s.schedules.length ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Repeats</th>
                            <th>Starts</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {s.schedules.map((r: Row) => (
                            <tr key={r.id}>
                              <td>
                                <b>{r.name}</b>
                                <small>{accountName(r.account)}</small>
                              </td>
                              <td>{r.frequency}</td>
                              <td>{dateLabel(r.start)}</td>
                              <td className="numeric">{fmt(r.amount)}</td>
                              <td>
                                <span className="tag">
                                  {r.active ? "Active" : "Paused"}
                                </span>
                              </td>
                              <td>
                                <button
                                  className="icon"
                                  aria-label={`Edit schedule ${r.name}`}
                                  onClick={() =>
                                    open("schedule", {
                                      ...r,
                                      amount: plain(r.amount),
                                      interest: plain(r.interest),
                                    })
                                  }
                                >
                                  <Pencil size={15} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty
                      title="One less thing to remember"
                      text="Set up bills, salary, subscriptions and debt repayments."
                      action="Add schedule"
                      onClick={() => open("schedule")}
                    />
                  )}
                </section>
                <div className="info-note">
                  <Bell size={18} />
                  <span>
                    Reminders run in the system tray when enabled. Windows must
                    be awake. Missed reminders are checked when the app resumes.
                  </span>
                  <button
                    className="text-button"
                    onClick={() => setPage("settings")}
                  >
                    Reminder settings
                  </button>
                </div>
              </>
            )}
            {page === "goals" && (
              <>
                <div className="stats-row">
                  <Stat
                    label="Earmarked for goals"
                    value={fmt(saved)}
                    note="Included in your account balances"
                  />
                  <Stat
                    label="Account money not earmarked"
                    value={fmt(v.assets - saved)}
                    note="Before planned bills and spending"
                    negative={v.assets - saved < 0}
                  />
                  <Stat
                    label="Active goals"
                    value={s.goals.length}
                    note="Small steps add up"
                  />
                </div>
                <div className="section-heading">
                  <h2>Something to look forward to</h2>
                  <button onClick={() => open("goal")}>
                    <Plus size={16} />
                    New savings goal
                  </button>
                </div>
                <div className="account-grid">
                  {v.goals.map((g: Row) => {
                    const total = v.goals
                      .filter((x: Row) => x.account === g.account)
                      .reduce((n: number, x: Row) => n + x.saved, 0);
                    return (
                      <section className="panel goal-card" key={g.id}>
                        <div className="section-heading">
                          <span className="account-symbol">
                            <Target size={22} />
                          </span>
                          <button
                            className="icon"
                            aria-label={`Edit goal ${g.name}`}
                            onClick={() =>
                              open("goal", { ...g, target: plain(g.target) })
                            }
                          >
                            <Pencil size={16} />
                          </button>
                        </div>
                        <h2>{g.name}</h2>
                        <p>
                          {accountName(g.account)}
                          {g.date ? ` · Target ${dateLabel(g.date)}` : ""}
                        </p>
                        <strong className="account-amount">
                          {fmt(g.saved)}
                        </strong>
                        <small>of {fmt(g.target)}</small>
                        <div className="progress">
                          <i
                            style={{
                              width: `${Math.min(100, (g.saved / g.target) * 100)}%`,
                            }}
                          />
                        </div>
                        <div className="detail-line">
                          <span>
                            {Math.round((g.saved / g.target) * 100)}% of the way
                            there
                          </span>
                          <b>{fmt(Math.max(0, g.target - g.saved))} to go</b>
                        </div>
                        {total > v.balances[g.account] && (
                          <p className="danger">
                            Allocations exceed the money currently in this
                            account.
                          </p>
                        )}
                        <button
                          className="wide"
                          onClick={() => open("goalEntry", g)}
                        >
                          <Plus size={15} />
                          Allocate or release money
                        </button>
                      </section>
                    );
                  })}
                </div>
                {!s.goals.length && (
                  <section className="panel">
                    <Empty
                      title="Start with something that matters"
                      text="An emergency fund, a trip, or a fresh start. Earmark money you already have."
                      action="Create a goal"
                      onClick={() => open("goal")}
                    />
                  </section>
                )}
                <section className="panel">
                  <div className="section-heading">
                    <h2>Allocation history</h2>
                  </div>
                  {s.goalEntries.length ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Goal</th>
                            <th>Note</th>
                            <th className="right">Allocation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...s.goalEntries].reverse().map((e: Row) => (
                            <tr key={e.id}>
                              <td>{dateLabel(e.date)}</td>
                              <td>
                                {
                                  s.goals.find((g: Row) => g.id === e.goal)
                                    ?.name
                                }
                              </td>
                              <td>{e.notes || "—"}</td>
                              <td className="right numeric">{fmt(e.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="muted pad">
                      Allocating money marks it for a goal. It does not create a
                      transaction or move funds between accounts.
                    </p>
                  )}
                </section>
              </>
            )}
            {page === "reports" && (
              <>
                <div className="stats-row">
                  <Stat
                    label="Income received"
                    value={fmt(v.income)}
                    note={monthName(month)}
                  />
                  <Stat
                    label="Net expenses"
                    value={fmt(v.spent)}
                    note="Expenses + interest − refunds"
                  />
                  <Stat
                    label="Income less expenses"
                    value={fmt(v.income - v.spent)}
                    negative={v.income - v.spent < 0}
                    note="Excludes opening balances and transfers"
                  />
                </div>
                <div className="two-column">
                  <section className="panel">
                    <div className="section-heading">
                      <div>
                        <h2>Six months in perspective</h2>
                        <p>Income and expenses, side by side.</p>
                      </div>
                    </div>
                    <div className="chart-legend">
                      <span>
                        <i />
                        Income
                      </span>
                      <span>
                        <i />
                        Expenses
                      </span>
                    </div>
                    <div className="bar-chart">
                      {(() => {
                        const rows = Array.from({ length: 6 }, (_, i) => {
                          const m = shift(month, i - 5),
                            tx = s.transactions.filter((t: Row) =>
                              t.date.startsWith(m),
                            );
                          return {
                            m,
                            income: tx
                              .filter((t: Row) => t.kind === "income")
                              .reduce((n: number, t: Row) => n + t.amount, 0),
                            spent: tx.reduce(
                              (n: number, t: Row) =>
                                n +
                                (t.kind === "expense"
                                  ? t.amount
                                  : t.kind === "refund"
                                    ? -t.amount
                                    : t.kind === "payment"
                                      ? t.interest
                                      : 0),
                              0,
                            ),
                          };
                        });
                        const max = Math.max(
                          1,
                          ...rows.flatMap((r) => [r.income, Math.abs(r.spent)]),
                        );
                        return rows.map((r) => (
                          <div className="chart-month" key={r.m}>
                            <div className="bars">
                              <div
                                title={`Income ${fmt(r.income)}`}
                                style={{
                                  height: `${Math.max(1, (r.income / max) * 100)}%`,
                                }}
                              />
                              <div
                                title={`Expenses ${fmt(r.spent)}`}
                                style={{
                                  height: `${Math.max(1, (Math.abs(r.spent) / max) * 100)}%`,
                                }}
                              />
                            </div>
                            <b>
                              {new Date(r.m + "-02").toLocaleDateString(
                                "en-GB",
                                { month: "short" },
                              )}
                            </b>
                            <small>{fmt(r.income)}</small>
                            <small>{fmt(r.spent)}</small>
                          </div>
                        ));
                      })()}
                    </div>
                  </section>
                  <section className="panel">
                    <div className="section-heading">
                      <div>
                        <h2>Where your money went</h2>
                        <p>{monthName(month)} · net category spending</p>
                      </div>
                    </div>
                    <div className="category-list">
                      {budget
                        .filter((b: Row) => b.spent !== 0)
                        .sort((a: Row, b: Row) => b.spent - a.spent)
                        .map((b: Row) => (
                          <div className="category-progress" key={b.id}>
                            <div>
                              <span>
                                <i style={{ background: b.color }} />
                                {b.name}
                              </span>
                              <b>{fmt(b.spent)}</b>
                            </div>
                            <div className="progress">
                              <i
                                style={{
                                  background: b.color,
                                  width: `${Math.min(100, Math.max(0, (b.spent / Math.max(1, v.spent)) * 100))}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      {!v.spent && (
                        <Empty
                          title="No spending to chart yet"
                          text="Record expenses to see your category breakdown."
                        />
                      )}
                    </div>
                  </section>
                </div>
              </>
            )}
            {page === "settings" && (
              <>
                <div className="two-column">
                  <section className="panel">
                    <div className="section-heading">
                      <div>
                        <h2>Desktop reminders</h2>
                        <p>A gentle nudge before payments are due.</p>
                      </div>
                      <Bell size={21} />
                    </div>
                    <div className="settings-list">
                      {[
                        [
                          "reminders",
                          "Enable desktop reminders",
                          "Keep the planner in the system tray when its window is closed.",
                        ],
                        [
                          "startup",
                          "Start reminders at Windows sign-in",
                          "Launch quietly in the background. Applies to the installed app.",
                        ],
                        [
                          "privacy",
                          "Hide payment details in notifications",
                          "Show a private reminder without account names or amounts.",
                        ],
                      ].map(([k, label, help]) => (
                        <label className="setting" key={k}>
                          <div>
                            <b>{label}</b>
                            <small>{help}</small>
                          </div>
                          <input
                            type="checkbox"
                            checked={s.settings[k]}
                            onChange={(e) =>
                              run(() =>
                                act("settings", { [k]: e.target.checked }),
                              )
                            }
                          />
                        </label>
                      ))}
                      <div className="setting">
                        <div>
                          <b>Remind me before the due date</b>
                          <small>
                            Overdue items are checked daily. Missed reminders
                            are caught up.
                          </small>
                        </div>
                        <select
                          aria-label="Reminder timing"
                          value={s.settings.reminderDays.join(",")}
                          onChange={(e) =>
                            run(() =>
                              act("settings", {
                                reminderDays: e.target.value
                                  .split(",")
                                  .map(Number),
                              }),
                            )
                          }
                        >
                          <option value="7,3,0">
                            7 days, 3 days & due day
                          </option>
                          <option value="3,1,0">3 days, 1 day & due day</option>
                          <option value="1,0">1 day & due day</option>
                          <option value="0">Due day only</option>
                        </select>
                      </div>
                      <button
                        onClick={() =>
                          run(async () => {
                            const r =
                              await window.budget.system("testNotification");
                            if (!r.ok) throw Error(r.error);
                            setToast(r.value);
                          })
                        }
                      >
                        <Bell size={16} />
                        Send a test notification
                      </button>
                    </div>
                  </section>
                  <section className="panel">
                    <div className="section-heading">
                      <div>
                        <h2>Your data stays with you</h2>
                        <p>LKR · local storage · no connected bank accounts</p>
                      </div>
                      <ShieldCheck size={21} />
                    </div>
                    <div className="settings-list">
                      <p>
                        Automatic local backups keep the last 14 backup days.
                        Save a separate backup somewhere safe to protect against
                        computer loss.
                      </p>
                      <div className="button-grid">
                        <button onClick={() => file("backup")}>
                          <Download size={16} />
                          Back up now
                        </button>
                        <button onClick={() => file("restore")}>
                          <RefreshCw size={16} />
                          Restore backup
                        </button>
                        <button onClick={() => file("export")}>
                          <Download size={16} />
                          Export CSV
                        </button>
                        <button onClick={() => file("import")}>
                          <Upload size={16} />
                          Import CSV
                        </button>
                      </div>
                      <details>
                        <summary>CSV format and import guidance</summary>
                        <p>
                          Headers: date, kind, amount, account, to, category,
                          interest, payee, notes. Dates use YYYY-MM-DD. Amounts
                          use rupees with a decimal point, without currency
                          symbols or thousands separators. Account and category
                          names must match existing items.
                        </p>
                        <p>
                          Types: expense, income, refund, transfer, payment.
                          Export a CSV for a template. Possible duplicates are
                          skipped by default. Backups also preserve budgets,
                          schedules and goals; CSV only contains transactions.
                        </p>
                      </details>
                      <small className="data-path">{data.dataPath}</small>
                      <button
                        className="text-button"
                        onClick={() =>
                          run(async () => {
                            const r = await window.budget.system("openData");
                            if (!r.ok) throw Error(r.error);
                          })
                        }
                      >
                        Open data folder <ArrowUpRight size={14} />
                      </button>
                    </div>
                  </section>
                </div>
                <section className="panel">
                  <div className="section-heading">
                    <div>
                      <h2>Make categories your own</h2>
                      <p>
                        Archive categories to hide them from new entries while
                        keeping history.
                      </p>
                    </div>
                    <button onClick={() => open("category")}>
                      <Plus size={16} />
                      Add category
                    </button>
                  </div>
                  <div className="category-settings">
                    {[...s.categories]
                      .sort((a: Row, b: Row) => a.order - b.order)
                      .map((c: Row, i: number) => (
                        <div
                          key={c.id}
                          className={c.archived ? "archived" : ""}
                        >
                          <span
                            className="category-dot"
                            style={{ background: c.color }}
                          />
                          <b>{c.name}</b>
                          {c.archived && <small>Archived</small>}
                          <button
                            className="icon"
                            disabled={i === 0}
                            aria-label={`Move ${c.name} up`}
                            onClick={() =>
                              run(() =>
                                act("categoryMove", {
                                  id: c.id,
                                  direction: -1,
                                }),
                              )
                            }
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            className="icon"
                            disabled={i === s.categories.length - 1}
                            aria-label={`Move ${c.name} down`}
                            onClick={() =>
                              run(() =>
                                act("categoryMove", { id: c.id, direction: 1 }),
                              )
                            }
                          >
                            <ArrowDown size={14} />
                          </button>
                          <button
                            className="icon"
                            aria-label={`Edit category ${c.name}`}
                            onClick={() => open("category", c)}
                          >
                            <Pencil size={14} />
                          </button>
                        </div>
                      ))}
                  </div>
                </section>
                <p className="footer-note">
                  Pocket Plan 1.0 · Built for your everyday peace of mind.
                </p>
              </>
            )}
          </div>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {toast}
          <button
            className="icon"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {modal && (
        <Modal
          title={
            (
              {
                account: form.id ? "Edit account" : "Add an account",
                transaction: form.id ? "Edit transaction" : "Add a transaction",
                budget: `Plan ${form.name}`,
                incomePlan: "Plan monthly income",
                category: form.id ? "Edit category" : "New category",
                schedule: form.id ? "Edit schedule" : "Schedule a payment",
                goal: form.id ? "Edit savings goal" : "Create a savings goal",
                goalEntry: `Allocate to ${form.name}`,
                settle: "Confirm this payment",
                delete: "Delete this transaction?",
                copy: "Copy previous allocations?",
              } as Row
            )[modal.type]
          }
          onClose={() => !busy && setModal(null)}
        >
          <form onSubmit={save}>
            <div className="modal-body">
              {error && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}
              {modal.type === "account" && (
                <>
                  <div className="form-grid">
                    <Field label="Account nickname">{input("name")}</Field>
                    <Field label="Account type">
                      <select
                        value={form.type}
                        disabled={!!form.id}
                        onChange={(e) => f("type", e.target.value)}
                      >
                        {[
                          ["bank", "Bank account"],
                          ["cash", "Cash"],
                          ["savings", "Savings"],
                          ["card", "Credit card"],
                          ["loan", "Loan / personal debt"],
                        ].map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field
                      label={
                        ["card", "loan"].includes(form.type)
                          ? "Starting amount owed"
                          : "Starting balance"
                      }
                      hint="Enter the balance before transactions on the opening date."
                    >
                      {amount("opening")}
                    </Field>
                    <Field label="Opening date">
                      {input("openingDate", "date")}
                    </Field>
                    {form.type === "card" && (
                      <>
                        <Field label="Credit limit (optional)">
                          {input("limit", "number", false)}
                        </Field>
                        <Field label="Last statement balance (optional)">
                          {input("statement", "number", false)}
                        </Field>
                        <Field label="Minimum payment (optional)">
                          {input("minimum", "number", false)}
                        </Field>
                      </>
                    )}
                    {["card", "loan"].includes(form.type) && (
                      <Field
                        label="Annual interest rate % (optional)"
                        hint="For reference only. Enter actual interest as it is charged."
                      >
                        {input("rate", "number", false)}
                      </Field>
                    )}
                  </div>
                  {form.id && (
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={!!form.archived}
                        onChange={(e) => f("archived", e.target.checked)}
                      />
                      Archive this account
                    </label>
                  )}
                  <div className="info-note">
                    {["card", "loan"].includes(form.type)
                      ? "No card details needed. After saving, use “Plan repayment” to set a due date and reminder."
                      : "Balances are calculated from your opening amount and recorded transactions."}
                  </div>
                </>
              )}
              {["transaction", "schedule"].includes(modal.type) && (
                <>
                  <div className="form-grid">
                    {modal.type === "schedule" && (
                      <Field label="Payment or income name">
                        {input("name")}
                      </Field>
                    )}
                    <Field label="Type">
                      <select
                        value={form.kind}
                        onChange={(e) => f("kind", e.target.value)}
                      >
                        {[
                          ["expense", "Expense"],
                          ["income", "Income"],
                          ...(modal.type === "transaction"
                            ? [["refund", "Refund"]]
                            : []),
                          ["transfer", "Transfer between accounts"],
                          ["payment", "Credit card / debt repayment"],
                        ].map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field
                      label={
                        form.kind === "payment" ? "Total payment" : "Amount"
                      }
                    >
                      {amount("amount")}
                    </Field>
                    <Field
                      label={
                        ["transfer", "payment"].includes(form.kind)
                          ? "From account"
                          : "Account"
                      }
                    >
                      {options(
                        "account",
                        s.accounts.filter(
                          (a: Row) =>
                            (!a.archived || a.id === form.account) &&
                            (form.kind !== "payment" ||
                              !["card", "loan"].includes(a.type)),
                        ),
                      )}
                    </Field>
                    {["transfer", "payment"].includes(form.kind) && (
                      <Field label="To account">
                        {options(
                          "to",
                          s.accounts.filter(
                            (a: Row) =>
                              a.id !== form.account &&
                              (!a.archived || a.id === form.to) &&
                              (form.kind !== "payment" ||
                                ["card", "loan"].includes(a.type)),
                          ),
                        )}
                      </Field>
                    )}
                    {["expense", "refund", "payment"].includes(form.kind) && (
                      <Field
                        label={
                          form.kind === "payment"
                            ? "Interest / fees category"
                            : "Category"
                        }
                      >
                        {options(
                          "category",
                          s.categories.filter(
                            (c: Row) => !c.archived || c.id === form.category,
                          ),
                        )}
                      </Field>
                    )}
                    {form.kind === "payment" && (
                      <Field
                        label="Interest / fees included"
                        hint="Use 0 if interest was already recorded as a card expense."
                      >
                        {amount("interest")}
                      </Field>
                    )}
                    {modal.type === "transaction" ? (
                      <>
                        <Field label="Date">{input("date", "date")}</Field>
                        <Field label="Payee / description (optional)">
                          {input("payee", "text", false)}
                        </Field>
                        <Field label="Notes (optional)">
                          <textarea
                            value={form.notes}
                            maxLength={2000}
                            onChange={(e) => f("notes", e.target.value)}
                          />
                        </Field>
                      </>
                    ) : (
                      <>
                        <Field label="First due date">
                          {input("start", "date")}
                        </Field>
                        <Field label="Repeats">
                          <select
                            value={form.frequency}
                            onChange={(e) => f("frequency", e.target.value)}
                          >
                            {["once", "weekly", "monthly", "yearly"].map(
                              (r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ),
                            )}
                          </select>
                        </Field>
                        <Field label="End date (optional)">
                          {input("end", "date", false)}
                        </Field>
                        {form.id && (
                          <label className="check">
                            <input
                              type="checkbox"
                              checked={form.active}
                              onChange={(e) => f("active", e.target.checked)}
                            />
                            Schedule active
                          </label>
                        )}
                      </>
                    )}
                  </div>
                  {form.kind === "payment" && (
                    <div className="info-note">
                      Principal reduces your debt. Only new interest and fees
                      count as spending. Paying a card does not count purchases
                      twice.
                    </div>
                  )}
                  {modal.type === "schedule" && form.id && (
                    <div className="info-note">
                      Editing a schedule affects unpaid occurrences. For a new
                      statement or changed payment series, pause this schedule
                      and create a new one to preserve past due dates.
                    </div>
                  )}
                </>
              )}
              {modal.type === "budget" && (
                <>
                  <Field label="New monthly allocation">
                    {amount("amount")}
                  </Field>
                  <Field
                    label="Override starting rollover (optional)"
                    hint="Leave blank for automatic rollover. Enter 0 to reset this month’s carry. A negative amount carries overspending."
                  >
                    {input("carryOverride", "number", false)}
                  </Field>
                  <p className="muted">
                    This changes the budget allocation, not the amount of money
                    in your accounts.
                  </p>
                </>
              )}
              {modal.type === "incomePlan" && (
                <Field
                  label="Expected income this month"
                  hint="A plan only. Record income separately when it is received."
                >
                  {amount("amount")}
                </Field>
              )}
              {modal.type === "category" && (
                <>
                  <Field label="Category name">{input("name")}</Field>
                  <Field label="Category colour">
                    {input("color", "color")}
                  </Field>
                  {form.id && (
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={form.archived}
                        onChange={(e) => f("archived", e.target.checked)}
                      />
                      Archive category
                    </label>
                  )}
                </>
              )}
              {modal.type === "goal" && (
                <>
                  <Field label="Goal name">{input("name")}</Field>
                  <div className="form-grid">
                    <Field label="Target amount">{amount("target")}</Field>
                    <Field label="Money is held in">
                      {options(
                        "account",
                        s.accounts.filter(
                          (a: Row) =>
                            (!a.archived || a.id === form.account) &&
                            !["card", "loan"].includes(a.type),
                        ),
                      )}
                    </Field>
                    <Field label="Target date (optional)">
                      {input("date", "date", false)}
                    </Field>
                  </div>
                  <p className="muted">
                    A goal earmarks existing funds. Use a transfer transaction
                    to actually move money between accounts.
                  </p>
                </>
              )}
              {modal.type === "goalEntry" && (
                <>
                  <Field label="Action">
                    <select
                      value={form.direction}
                      onChange={(e) => f("direction", e.target.value)}
                    >
                      <option value="add">Allocate money to this goal</option>
                      <option value="release">
                        Release money from this goal
                      </option>
                    </select>
                  </Field>
                  <div className="form-grid">
                    <Field label="Amount">{amount("amount")}</Field>
                    <Field label="Date">{input("date", "date")}</Field>
                  </div>
                  <Field label="Note (optional)">
                    {input("notes", "text", false)}
                  </Field>
                </>
              )}
              {modal.type === "settle" && (
                <>
                  <p>
                    Record <b>{modal.row.name}</b>, due{" "}
                    {dateLabel(modal.row.due)}. Adjust the amount to match what
                    actually happened.
                  </p>
                  <div className="form-grid">
                    <Field label="Amount received / paid">
                      {amount("amount")}
                    </Field>
                    <Field label="Actual date">{input("date", "date")}</Field>
                    {modal.row.kind === "payment" && (
                      <Field label="Interest / fees included">
                        {amount("interest")}
                      </Field>
                    )}
                  </div>
                  <p className="muted">
                    This creates one transaction and clears the reminder for
                    this occurrence.
                  </p>
                </>
              )}
              {modal.type === "delete" && (
                <p>
                  Delete <b>{modal.row.payee || modal.row.kind}</b> for{" "}
                  {fmt(modal.row.amount)}? Balances and rollover will be
                  recalculated. If this is a scheduled payment, its reminder
                  will become unpaid again.
                </p>
              )}
              {modal.type === "copy" && (
                <p>
                  Replace {monthName(month)}’s planned allocations and planned
                  income with {monthName(shift(month, -1))}’s plan? Your
                  transactions and rollover adjustments will be preserved.
                </p>
              )}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                onClick={() => setModal(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={modal.type === "delete" ? "destructive" : "primary"}
                disabled={busy}
              >
                {busy
                  ? "Saving…"
                  : modal.type === "delete"
                    ? "Delete transaction"
                    : modal.type === "copy"
                      ? "Copy allocations"
                      : modal.type === "settle"
                        ? "Confirm and record"
                        : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {preview && (
        <Modal title="Review CSV import" onClose={() => setPreview(null)}>
          <div className="modal-body">
            <p>
              {preview.length} rows ·{" "}
              {preview.filter((r: Row) => r.error).length} errors ·{" "}
              {preview.filter((r: Row) => r.duplicate).length} possible
              duplicates.
            </p>
            <label className="check">
              <input
                type="checkbox"
                checked={includeDuplicates}
                onChange={(e) => setIncludeDuplicates(e.target.checked)}
              />
              Include possible duplicates
            </label>
            <div className="import-preview">
              {preview.map((r: Row) => (
                <div key={r.line} className={r.error ? "danger" : ""}>
                  Row {r.line}:{" "}
                  {r.error ||
                    `${r.transaction.date} · ${r.transaction.payee || r.transaction.kind} · ${fmt(r.transaction.amount)}${r.duplicate ? " · Possible duplicate" : ""}`}
                </div>
              ))}
            </div>
            {error && (
              <div role="alert" className="error">
                {error}
              </div>
            )}
            <p className="muted">
              All rows must be valid before importing. Nothing is saved until
              you confirm.
            </p>
          </div>
          <div className="modal-actions">
            <button onClick={() => setPreview(null)}>Cancel</button>
            <button
              className="primary"
              disabled={
                busy ||
                preview.some((r: Row) => r.error) ||
                !preview.some((r: Row) => includeDuplicates || !r.duplicate)
              }
              onClick={() =>
                run(async () => {
                  const rows = preview
                    .filter((r: Row) => includeDuplicates || !r.duplicate)
                    .map((r: Row) => r.transaction);
                  await act(
                    "import",
                    { rows },
                    `Imported ${rows.length} transactions`,
                  );
                  setPreview(null);
                })
              }
            >
              Import{" "}
              {
                preview.filter(
                  (r: Row) => !r.error && (includeDuplicates || !r.duplicate),
                ).length
              }{" "}
              transactions
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
