const core = require("./core.cjs");
const columns = [
  "date",
  "kind",
  "amount",
  "account",
  "to",
  "category",
  "interest",
  "payee",
  "notes",
];
function parseCSV(text) {
  text = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [],
    value = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else if (!quoted && value.length)
        throw Error("Unexpected quote in CSV.");
      else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(value);
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
      value = "";
    } else value += c;
  }
  if (quoted) throw Error("CSV contains an unclosed quote.");
  row.push(value);
  if (row.some((v) => v !== "")) rows.push(row);
  return rows;
}
function signature(t) {
  return JSON.stringify([
    t.date,
    t.kind,
    t.amount,
    t.account,
    t.to || null,
    t.category || null,
    t.interest || 0,
    t.payee || "",
    t.notes || "",
  ]);
}
function preview(text, state) {
  if (text.length > 10e6) throw Error("CSV must be smaller than 10 MB.");
  const rows = parseCSV(text);
  if (!rows.length) throw Error("CSV is empty.");
  const header = rows.shift().map((s) => s.trim().toLowerCase());
  for (const c of ["date", "kind", "amount", "account"])
    if (!header.includes(c)) throw Error(`Missing CSV column: ${c}.`);
  if (rows.length > 10000) throw Error("Import supports at most 10,000 rows.");
  const find = (items, name) => {
    const found = items.filter(
      (a) => a.name.toLowerCase() === name.toLowerCase(),
    );
    if (found.length !== 1)
      throw Error(`Name must match exactly one existing item: ${name}`);
    return found[0].id;
  };
  const seen = new Set(state.transactions.map(signature));
  return rows.map((row, i) => {
    try {
      if (row.length !== header.length)
        throw Error("Column count does not match the header.");
      const r = Object.fromEntries(
        header.map((h, i) => [h, row[i]?.trim() || ""]),
      );
      const t = {
        date: r.date,
        kind: r.kind.toLowerCase(),
        amount: core.money(r.amount),
        account: find(state.accounts, r.account),
        to: r.to ? find(state.accounts, r.to) : null,
        category: r.category ? find(state.categories, r.category) : null,
        interest: r.interest ? core.money(r.interest) : 0,
        payee: r.payee || "",
        notes: r.notes || "",
      };
      core.change({ ...state, transactions: [] }, "transaction", t);
      const key = signature(t),
        duplicate = seen.has(key);
      seen.add(key);
      return { line: i + 2, transaction: t, duplicate, error: null };
    } catch (e) {
      return {
        line: i + 2,
        error: e.message,
        duplicate: false,
        transaction: null,
      };
    }
  });
}
function exportCSV(state) {
  const name = (list, key) => list.find((a) => a.id === key)?.name || "";
  const escape = (s) => '"' + String(s).replaceAll('"', '""') + '"';
  return (
    "\uFEFF" +
    [
      columns.join(","),
      ...state.transactions.map((t) =>
        [
          t.date,
          t.kind,
          (t.amount / 100).toFixed(2),
          name(state.accounts, t.account),
          name(state.accounts, t.to),
          name(state.categories, t.category),
          ((t.interest || 0) / 100).toFixed(2),
          t.payee,
          t.notes,
        ]
          .map(escape)
          .join(","),
      ),
    ].join("\r\n")
  );
}
module.exports = { parseCSV, preview, exportCSV };
