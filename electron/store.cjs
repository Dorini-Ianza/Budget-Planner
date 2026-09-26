const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const core = require("./core.cjs");
const entities = [
  "accounts",
  "categories",
  "transactions",
  "budgets",
  "incomePlans",
  "schedules",
  "goals",
  "goalEntries",
];
class Store {
  constructor(dir) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
    this.db = new DatabaseSync(path.join(dir, "pocket-plan.db"));
    this.db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS records (entity TEXT NOT NULL, position INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(entity,position));",
    );
    const version = this.db
      .prepare("SELECT value FROM meta WHERE key='version'")
      .get();
    if (!version) this.save(core.initial());
    this.read();
  }
  read() {
    const s = {};
    for (const r of this.db.prepare("SELECT * FROM meta").all())
      s[r.key] = JSON.parse(r.value);
    for (const key of entities)
      s[key] = this.db
        .prepare("SELECT payload FROM records WHERE entity=? ORDER BY position")
        .all(key)
        .map((r) => JSON.parse(r.payload));
    return core.validate(s);
  }
  save(s) {
    core.validate(s);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.exec("DELETE FROM records; DELETE FROM meta;");
      const put = this.db.prepare("INSERT INTO records VALUES (?,?,?)");
      for (const key of entities)
        s[key].forEach((r, i) => put.run(key, i, JSON.stringify(r)));
      const meta = this.db.prepare("INSERT INTO meta VALUES (?,?)");
      for (const key of ["version", "settings", "reminderState"])
        meta.run(key, JSON.stringify(s[key]));
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  change(action, p) {
    const s = core.change(this.read(), action, p);
    this.save(s);
    return s;
  }
  backup(file) {
    const content = JSON.stringify(
      {
        format: "pocket-plan-backup",
        exportedAt: new Date().toISOString(),
        data: this.read(),
      },
      null,
      2,
    );
    fs.writeFileSync(file + ".tmp", content, { encoding: "utf8", mode: 0o600 });
    fs.renameSync(file + ".tmp", file);
    return file;
  }
  autoBackup(force = false) {
    const dir = path.join(this.dir, "backups");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `daily-${core.today()}.json`);
    if (force || !fs.existsSync(file)) this.backup(file);
    const files = fs
      .readdirSync(dir)
      .filter((f) => /^daily-.*\.json$/.test(f))
      .sort();
    for (const old of files.slice(0, -14)) fs.unlinkSync(path.join(dir, old));
    return file;
  }
  restore(file) {
    const raw = fs.readFileSync(file, "utf8");
    if (raw.length > 50e6) throw Error("Backup is too large.");
    const backup = JSON.parse(raw);
    if (backup.format !== "pocket-plan-backup")
      throw Error("Choose a Pocket Plan backup JSON file.");
    const data = core.validate(backup.data);
    const safety = path.join(this.dir, `before-restore-${Date.now()}.json`);
    this.backup(safety);
    this.save(data);
    return safety;
  }
  close() {
    this.db.close();
  }
}
module.exports = { Store };
