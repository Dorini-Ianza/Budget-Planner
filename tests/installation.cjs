const { _electron: electron } = require("@playwright/test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const exe = process.env.POCKET_PLAN_EXE;
if (!exe) throw Error("POCKET_PLAN_EXE is required.");
const env = { ...process.env };
delete env.POCKET_PLAN_DATA;
(async () => {
  let app;
  let original;
  try {
    app = await electron.launch({
      executablePath: exe,
      args: [],
      env,
      timeout: 60000,
    });
    const page = await app.firstWindow();
    await page
      .getByRole("heading", { name: "Your money, in balance." })
      .waitFor();
    await page.context().setOffline(true);
    await page.reload();
    await page
      .getByRole("heading", { name: "Your money, in balance." })
      .waitFor();
    const initial = await page.evaluate(() => window.budget.get());
    assert.equal(initial.ok, true);
    assert.equal(initial.value.packaged, true);
    original = initial.value.state.settings.startup;
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    const startup = page.getByLabel("Start reminders at Windows sign-in", {
      exact: false,
    });
    await startup.check();
    let native = await app.evaluate(({ app }) =>
      app.getLoginItemSettings({
        path: process.execPath,
        args: ["--background"],
      }),
    );
    assert.equal(native.openAtLogin, true);
    assert.equal(
      (await page.evaluate(() => window.budget.get())).value.state.settings
        .startup,
      true,
    );
    await startup.uncheck();
    native = await app.evaluate(({ app }) =>
      app.getLoginItemSettings({
        path: process.execPath,
        args: ["--background"],
      }),
    );
    assert.equal(native.openAtLogin, false);
    if (original) await startup.check();
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    await page.screenshot({
      path: path.resolve("test-results/installed-clean.png"),
      fullPage: true,
    });
    const end = await page.evaluate(() => window.budget.get());
    assert.deepEqual(end.value.state, initial.value.state);
    fs.writeFileSync(
      "test-results/installation.json",
      JSON.stringify(
        {
          installed: true,
          offlineLaunch: true,
          windowsStartupEnableAndDisable: true,
          financialDataUnchanged: true,
          dataPath: end.value.dataPath,
          exe,
        },
        null,
        2,
      ),
    );
    console.log(
      "PASS installed app opens offline; Windows startup registration enables and disables correctly; financial data unchanged.",
    );
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    if (app) {
      if (original !== undefined) {
        const pages = app.windows();
        if (pages[0])
          await pages[0]
            .evaluate(
              async (value) =>
                window.budget.act("settings", { startup: value }),
              original,
            )
            .catch(() => {});
      }
      await app.close().catch(() => {});
    }
  }
})();
