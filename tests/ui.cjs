// End-to-end tests run the real Electron app with an isolated SQLite profile.
const { _electron: electron } = require("@playwright/test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, ".."),
  data = path.join(root, ".test-data", "ui-" + Date.now());
fs.mkdirSync(data, { recursive: true });
const exe = process.env.POCKET_PLAN_EXE || require("electron");
const packaged = !!process.env.POCKET_PLAN_EXE;
let app, page;
const errors = [];
const report = [];
const click = async (name) =>
  page.getByRole("button", { name, exact: true }).click();
const fill = async (label, value) =>
  page.getByLabel(label, { exact: true }).fill(value);
const select = async (label, value) =>
  page.getByLabel(label, { exact: true }).selectOption(value);
const save = async () => {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
};
async function start(background = false) {
  app = await electron.launch({
    executablePath: exe,
    args: [
      ...(packaged ? [] : [root]),
      ...(background ? ["--background"] : []),
    ],
    env: { ...process.env, POCKET_PLAN_DATA: data },
    timeout: 60000,
  });
  page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  await page
    .getByRole("heading", { name: "Your money, in balance." })
    .waitFor();
}
async function state() {
  const r = await page.evaluate(() => window.budget.get("2026-09"));
  assert.equal(r.ok, true, r.error);
  return r.value;
}
async function step(name, fn) {
  await fn();
  report.push(name);
  console.log("PASS " + name);
}
(async () => {
  try {
    await start();
    await step(
      "onboarding creates a bank account and finishes setup",
      async () => {
        await click("Add your first account");
        await fill("Account nickname", "Everyday bank");
        await fill("Starting balance", "100000");
        await fill("Opening date", "2026-01-01");
        await save();
        await click("Finish setup");
        const d = await state();
        assert.equal(d.state.accounts[0].opening, 10000000);
        assert.equal(d.state.settings.onboarded, true);
      },
    );
    await step(
      "credit card details are optional and manually editable",
      async () => {
        await click("Accounts & debt");
        await click("Add account or debt");
        await fill("Account nickname", "Everyday card");
        await select("Account type", "card");
        await fill("Starting amount owed", "20000");
        await fill("Opening date", "2026-01-01");
        await fill("Credit limit (optional)", "100000");
        await fill("Last statement balance (optional)", "22000");
        await fill("Minimum payment (optional)", "2000");
        await save();
        const d = await state();
        assert.equal(d.state.accounts[1].minimum, 200000);
        assert.equal(d.state.accounts[1].statement, 2200000);
      },
    );
    await step(
      "manual expense and credit repayment update balances correctly",
      async () => {
        await click("Add transaction");
        await fill("Amount", "1500.25");
        await fill("Date", "2026-09-10");
        await fill("Payee / description (optional)", "Weekly groceries");
        await select("Account", (await state()).state.accounts[1].id);
        await select(
          "Category",
          (await state()).state.categories.find((c) => c.name === "Groceries")
            .id,
        );
        await save();
        await click("Add transaction");
        await select("Type", "payment");
        await fill("Total payment", "2000");
        await select("To account", (await state()).state.accounts[1].id);
        await fill("Date", "2026-09-15");
        await save();
        const d = await state();
        assert.equal(d.summary.spent, 150025);
        assert.equal(d.summary.balances[d.state.accounts[1].id], -1950025);
      },
    );
    await step(
      "budget allocations and rollover are entered in the UI",
      async () => {
        await click("Monthly budget");
        await page.getByLabel("Budget month").fill("2026-09");
        await click("Edit Groceries budget");
        await fill("New monthly allocation", "20000");
        await save();
        await click("Edit income plan");
        await fill("Expected income this month", "150000");
        await save();
        const d = await state();
        assert.equal(
          d.summary.budget.find((c) => c.name === "Groceries").remaining,
          1849975,
        );
      },
    );
    await step(
      "scheduled card repayment records once and disappears from unpaid items",
      async () => {
        await click("Accounts & debt");
        await click("Plan repayment");
        await fill("Payment or income name", "September card payment");
        await select("Repeats", "once");
        await fill("First due date", "2026-09-25");
        await save();
        await click("Payments");
        await click("Record paid");
        await fill("Actual date", "2026-09-25");
        await click("Confirm and record");
        await page.getByRole("dialog").waitFor({ state: "hidden" });
        const d = await state();
        assert.equal(
          d.state.transactions.filter((t) => t.occurrence).length,
          1,
        );
        assert.equal(d.summary.upcoming.length, 0);
      },
    );
    await step("savings earmarks do not change account money", async () => {
      await click("Savings goals");
      await click("New savings goal");
      await fill("Goal name", "Emergency fund");
      await fill("Target amount", "50000");
      await save();
      await click("Allocate or release money");
      await fill("Amount", "10000");
      await save();
      const d = await state();
      assert.equal(d.summary.goals[0].saved, 1000000);
      assert.equal(d.summary.balances[d.state.accounts[0].id], 9600000);
    });
    await step("transaction search, edit and delete work", async () => {
      await click("Transactions");
      await page.getByLabel("Budget month").fill("2026-09");
      await page.getByLabel("Search transactions").fill("Weekly groceries");
      await click("Edit Weekly groceries");
      await fill("Amount", "1600.25");
      await save();
      assert.equal((await state()).summary.spent, 160025);
      await click("Delete Weekly groceries");
      await click("Delete transaction");
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      assert.equal((await state()).summary.spent, 0);
    });
    await step(
      "all screens render without horizontal window overflow",
      async () => {
        for (const name of [
          "Overview",
          "Monthly budget",
          "Transactions",
          "Accounts & debt",
          "Payments",
          "Savings goals",
          "Reports",
          "Settings",
        ]) {
          await click(name);
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            true,
            name,
          );
        }
      },
    );
    await step(
      "CSV file preview, duplicate detection, export, and guarded backup restore",
      async () => {
        await click("Settings");
        const backup = path.join(data, "ui-backup.json"),
          exported = path.join(data, "ui-export.csv"),
          imported = path.join(data, "ui-import.csv");
        await app.evaluate(({ dialog }, file) => {
          dialog.showSaveDialog = async () => ({
            canceled: false,
            filePath: file,
          });
        }, backup);
        await click("Back up now");
        await page
          .getByRole("status")
          .filter({ hasText: "Saved to" })
          .waitFor();
        assert.equal(
          JSON.parse(fs.readFileSync(backup, "utf8")).format,
          "pocket-plan-backup",
        );
        await app.evaluate(({ dialog }, file) => {
          dialog.showSaveDialog = async () => ({
            canceled: false,
            filePath: file,
          });
        }, exported);
        await click("Export CSV");
        await page
          .getByRole("status")
          .filter({ hasText: "ui-export.csv" })
          .waitFor();
        assert.ok(
          fs.readFileSync(exported, "utf8").includes("September card payment"),
        );
        fs.writeFileSync(
          imported,
          "date,kind,amount,account,to,category,interest,payee,notes\n2026-09-20,income,75000,Everyday bank,,,0,Salary,Monthly pay",
        );
        await app.evaluate(({ dialog }, file) => {
          dialog.showOpenDialog = async () => ({
            canceled: false,
            filePaths: [file],
          });
        }, imported);
        await click("Import CSV");
        await page.getByRole("dialog", { name: "Review CSV import" }).waitFor();
        await click("Import 1 transactions");
        await page.getByRole("dialog").waitFor({ state: "hidden" });
        assert.equal((await state()).summary.income, 7500000);
        await click("Import CSV");
        await page.getByRole("dialog").waitFor();
        assert.equal(
          await page
            .getByRole("button", { name: "Import 0 transactions", exact: true })
            .isDisabled(),
          true,
        );
        await click("Cancel");
        await app.evaluate(({ dialog }, file) => {
          dialog.showOpenDialog = async () => ({
            canceled: false,
            filePaths: [file],
          });
          dialog.showMessageBox = async () => ({ response: 1 });
        }, backup);
        await click("Restore backup");
        await page
          .getByRole("status")
          .filter({ hasText: "Restored successfully" })
          .waitFor();
        assert.equal((await state()).summary.income, 0);
        assert.ok(
          fs.readdirSync(data).some((f) => f.startsWith("before-restore-")),
        );
      },
    );
    await step(
      "desktop notification and background tray lifecycle",
      async () => {
        await click("Settings");
        await click("Send a test notification");
        await page
          .getByRole("status")
          .filter({ hasText: "test notification was sent" })
          .waitFor();
        await new Promise((resolve) => setTimeout(resolve, 1500));
        assert.ok(
          fs
            .readFileSync(path.join(data, "notifications.log"), "utf8")
            .includes("shown"),
          "Windows must report a shown notification",
        );
        await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].close(),
        );
        assert.equal(
          await app.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()[0].isVisible(),
          ),
          false,
        );
        await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].show(),
        );
      },
    );
    await step("SQLite data survives application restart", async () => {
      const before = (await state()).state;
      await app.close();
      await start();
      assert.deepEqual((await state()).state, before);
    });
    await step(
      "small-window layout remains usable on every screen",
      async () => {
        await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].setContentSize(1000, 680),
        );
        for (const name of [
          "Overview",
          "Monthly budget",
          "Transactions",
          "Accounts & debt",
          "Payments",
          "Savings goals",
          "Reports",
          "Settings",
        ]) {
          await click(name);
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            true,
            name,
          );
        }
        await page.screenshot({
          path: path.join(
            root,
            "test-results",
            packaged ? "packaged-settings-small.png" : "settings-small.png",
          ),
          fullPage: true,
        });
        await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].setSize(1320, 900),
        );
      },
    );
    await step(
      "scheduled notification arrives while hidden and is not duplicated after restart",
      async () => {
        const result = await page.evaluate(async () => {
          const { value: d } = await window.budget.get();
          const now = new Date();
          const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
          return window.budget.act(
            "schedule",
            {
              id: "background-check",
              name: "Background reminder test",
              kind: "expense",
              amount: 10000,
              account: d.state.accounts[0].id,
              category: d.state.categories[0].id,
              start: day,
              frequency: "once",
            },
            day.slice(0, 7),
          );
        });
        assert.equal(result.ok, true, result.error);
        await app.close();
        await start(true);
        assert.equal(
          await app.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()[0].isVisible(),
          ),
          false,
        );
        let delivered = false;
        for (const deadline = Date.now() + 20000; Date.now() < deadline;) {
          const current = await state();
          delivered = Object.entries(current.state.reminderState).some(
            ([k, v]) => k.startsWith("background-check@") && v.last,
          );
          if (delivered) break;
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        assert.equal(
          delivered,
          true,
          "Scheduled notification must have a persisted delivery date",
        );
        const shown = fs.readFileSync(
          path.join(data, "notifications.log"),
          "utf8",
        );
        await app.close();
        await start(true);
        await new Promise((resolve) => setTimeout(resolve, 12000));
        assert.equal(
          fs.readFileSync(path.join(data, "notifications.log"), "utf8"),
          shown,
        );
        await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].show(),
        );
      },
    );
    await click("Overview");
    await page.screenshot({
      path: path.join(
        root,
        "test-results",
        packaged ? "packaged-overview.png" : "overview.png",
      ),
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    console.log("PASS no renderer exceptions");
    fs.writeFileSync(
      path.join(
        root,
        "test-results",
        packaged ? "packaged-ui.json" : "ui.json",
      ),
      JSON.stringify({ passed: report, errors, data, exe }, null, 2),
    );
  } catch (e) {
    console.error(e);
    if (page)
      await page
        .screenshot({
          path: path.join(root, "test-results", "failure.png"),
          fullPage: true,
        })
        .catch(() => {});
    process.exitCode = 1;
  } finally {
    if (app) await app.close().catch(() => {});
  }
})();
