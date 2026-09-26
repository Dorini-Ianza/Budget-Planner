const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Tray,
  Menu,
  Notification,
  shell,
  nativeImage,
} = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { Store } = require("./store.cjs");
const core = require("./core.cjs");
const csv = require("./csv.cjs");
const APP_ID = "com.dorini.pocketplan";
app.setAppUserModelId(APP_ID);
if (process.env.POCKET_PLAN_DATA)
  app.setPath("userData", process.env.POCKET_PLAN_DATA);
const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
let win,
  tray,
  store,
  quitting = false,
  timer;
const liveNotifications = new Set();
const icon = path.join(__dirname, "icon.png");
function open(page) {
  if (!win || win.isDestroyed()) createWindow();
  win.show();
  win.focus();
  if (page) win.webContents.send("navigate", page);
}
function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 1000,
    minHeight: 680,
    title: "Pocket Plan",
    icon,
    backgroundColor: "#f7f8f5",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.setMenu(null);
  win.loadFile(path.join(__dirname, "../dist/index.html"));
  win.once("ready-to-show", () => {
    if (!process.argv.includes("--background")) win.show();
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.on("close", (e) => {
    if (!quitting && store.read().settings.reminders) {
      e.preventDefault();
      win.hide();
    }
  });
}
function setStartup(enabled) {
  if (app.isPackaged && !process.env.POCKET_PLAN_DATA)
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: process.execPath,
      args: ["--background"],
    });
}
function deliver(o, test = false) {
  if (!Notification.isSupported())
    throw Error("Windows notifications are not available.");
  const s = store.read();
  const n = new Notification({
    title: test
      ? "Pocket Plan reminders are ready"
      : s.settings.privacy
        ? "Payment reminder"
        : o.name,
    body: test
      ? "You will receive reminders here when payments are due."
      : s.settings.privacy
        ? "Open Pocket Plan to review upcoming payments."
        : `${new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR" }).format(o.amount / 100)} · ${o.due < core.today() ? "Overdue since" : "Due"} ${o.due}`,
    icon,
    timeoutType: "default",
  });
  liveNotifications.add(n);
  n.on("click", () => {
    open("payments");
    liveNotifications.delete(n);
  });
  n.on("close", () => liveNotifications.delete(n));
  n.on("failed", (_, error) => {
    liveNotifications.delete(n);
    fs.appendFileSync(
      path.join(store.dir, "notifications.log"),
      `${new Date().toISOString()} ${error}\n`,
    );
  });
  n.once("show", () => {
    fs.appendFileSync(
      path.join(store.dir, "notifications.log"),
      `${new Date().toISOString()} shown\n`,
    );
    if (!test)
      store.change("reminder", {
        key: o.key,
        value: { last: core.today(), snooze: 0 },
      });
  });
  n.show();
  return n;
}
function checkReminders() {
  try {
    const s = store.read();
    for (const o of core.notificationCandidates(s).slice(0, 3)) {
      deliver(o);
    }
  } catch (e) {
    fs.appendFileSync(
      path.join(store.dir, "notifications.log"),
      `${new Date().toISOString()} ${e.message}\n`,
    );
  }
}
function response(month) {
  const state = store.read();
  return {
    state,
    summary: core.snapshot(state, month),
    dataPath: store.dir,
    notificationsSupported: Notification.isSupported(),
    packaged: app.isPackaged,
  };
}
const actions = new Set([
  "account",
  "category",
  "categoryMove",
  "transaction",
  "deleteTransaction",
  "budget",
  "incomePlan",
  "copyBudget",
  "schedule",
  "settle",
  "reminder",
  "goal",
  "goalEntry",
  "settings",
  "import",
]);
function safe(handler) {
  return async (event, ...args) => {
    try {
      if (event.sender !== win?.webContents) throw Error("Untrusted window.");
      return { ok: true, value: await handler(...args) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
}
if (lock)
  app.whenReady().then(() => {
    store = new Store(app.getPath("userData"));
    store.autoBackup();
    createWindow();
    tray = new Tray(nativeImage.createFromPath(icon));
    tray.setToolTip("Pocket Plan • local budget planner");
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Open Pocket Plan", click: () => open() },
        { label: "Upcoming payments", click: () => open("payments") },
        { type: "separator" },
        {
          label: "Quit completely",
          click: () => {
            quitting = true;
            app.quit();
          },
        },
      ]),
    );
    tray.on("double-click", () => open());
    ipcMain.handle(
      "get",
      safe((month) => response(month)),
    );
    ipcMain.handle(
      "act",
      safe((action, payload, month) => {
        if (!actions.has(action)) throw Error("Unknown action.");
        store.change(action, payload);
        if (action === "settings") setStartup(store.read().settings.startup);
        store.autoBackup();
        return response(month);
      }),
    );
    ipcMain.handle(
      "file",
      safe(async (action) => {
        if (action === "backup" || action === "export") {
          const result = await dialog.showSaveDialog(win, {
            title:
              action === "backup"
                ? "Save a full backup"
                : "Export transactions",
            defaultPath: `Pocket-Plan-${core.today()}.${action === "backup" ? "json" : "csv"}`,
            filters: [
              {
                name: action === "backup" ? "Pocket Plan backup" : "CSV",
                extensions: [action === "backup" ? "json" : "csv"],
              },
            ],
          });
          if (result.canceled) return null;
          if (action === "backup") store.backup(result.filePath);
          else
            fs.writeFileSync(
              result.filePath,
              csv.exportCSV(store.read()),
              "utf8",
            );
          return { message: `Saved to ${result.filePath}` };
        }
        if (action === "restore" || action === "import") {
          const result = await dialog.showOpenDialog(win, {
            title:
              action === "restore"
                ? "Restore a Pocket Plan backup"
                : "Import transactions",
            properties: ["openFile"],
            filters: [
              {
                name: action === "restore" ? "Pocket Plan backup" : "CSV",
                extensions: [action === "restore" ? "json" : "csv"],
              },
            ],
          });
          if (result.canceled) return null;
          const file = result.filePaths[0];
          if (action === "import")
            return {
              preview: csv.preview(fs.readFileSync(file, "utf8"), store.read()),
            };
          const confirm = await dialog.showMessageBox(win, {
            type: "warning",
            buttons: ["Cancel", "Restore backup"],
            defaultId: 0,
            cancelId: 0,
            message: "Replace current data with this backup?",
            detail:
              "A safety backup of your current data will be saved before restoring.",
          });
          if (confirm.response !== 1) return null;
          const safety = store.restore(file);
          setStartup(store.read().settings.startup);
          return {
            message: `Restored successfully. Previous data saved to ${safety}`,
          };
        }
        throw Error("Unknown file action.");
      }),
    );
    ipcMain.handle(
      "system",
      safe(async (action) => {
        if (action === "testNotification") {
          deliver(null, true);
          return "A test notification was sent to Windows. Check Notification Centre if a banner does not appear.";
        }
        if (action === "openData") {
          await shell.openPath(store.dir);
          return null;
        }
        if (action === "quit") {
          quitting = true;
          app.quit();
          return null;
        }
        throw Error("Unknown system action.");
      }),
    );
    setStartup(store.read().settings.startup);
    timer = setInterval(checkReminders, 60000);
    setTimeout(checkReminders, 10000);
  });
app.on("second-instance", () => open());
app.on("activate", () => open());
app.on("window-all-closed", () => {
  if (!store?.read().settings.reminders) app.quit();
});
app.on("before-quit", () => {
  quitting = true;
  if (timer) clearInterval(timer);
});
app.on("will-quit", () => {
  if (store) {
    try {
      store.autoBackup(true);
      store.close();
    } catch {}
  }
});
process.on("uncaughtException", (e) => {
  dialog.showErrorBox("Pocket Plan needs attention", e.message);
  quitting = true;
  app.exit(1);
});
