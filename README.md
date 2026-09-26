# Pocket Plan

A private Windows desktop budget planner for LKR. All entries are manual. It does not ask for bank credentials, credit-card numbers, CVVs or PINs, and does not connect to financial services.

## Open the app

Install **Pocket Plan Setup 1.0.0.exe** from `release`, then use **Pocket Plan** on your desktop or Start menu. No command window, development server, Node installation or internet connection is needed for everyday use.

See [GETTING_STARTED.md](GETTING_STARTED.md) for accounts, budgets, debts, reminders and backups.

## Features

- Cash, bank, savings, credit-card and loan accounts with manually entered opening balances.
- Income, expenses, refunds, atomic transfers, and repayments with principal/interest separation.
- Monthly category budgets, positive/negative rollover, explicit rollover overrides and copying a previous plan.
- Editable categories, historical reports, search and filtering.
- One-off, weekly, monthly and annual schedules; one transaction per confirmed occurrence.
- Windows desktop notifications, privacy mode, snooze, dismiss, optional sign-in startup and tray operation.
- Savings earmarks with allocation/release history and warnings if funds are insufficient.
- SQLite storage, last 14 backup days, manual JSON backups, guarded restore and CSV preview/import/export.

## Development

Requires Windows x64, Node 24+, and pnpm. Versions are locked in `pnpm-lock.yaml`.

```text
pnpm install
pnpm build
pnpm start
pnpm test
pnpm test:ui
pnpm package
```

`pnpm dev` serves only the renderer and does not provide the desktop API; use a production build followed by `pnpm start` for complete local development. End-to-end tests launch Electron with isolated profiles under `.test-data`, never the real financial profile. `POCKET_PLAN_EXE` selects an installed executable for the same tests.

## Architecture

- `electron/core.cjs`: pure validation and financial/date calculations.
- `electron/store.cjs`: versioned SQLite records and atomic writes, backups and restoration.
- `electron/csv.cjs`: CSV parser, preview, duplicate checks and export.
- `electron/main.cjs`: Windows lifecycle, restricted IPC, local file dialogs, reminders and startup.
- `electron/preload.cjs`: narrow context-isolated bridge; the renderer has no Node access.
- `src/main.tsx` / `src/styles.css`: React/TypeScript interface, no external fonts or runtime network dependencies.
- `tests`: calculation/storage and real desktop UI checks.

All monetary values are integer minor units. SQLite stores versioned entity records and commits an entire validated change atomically. V1 rejects unknown future backup schema versions rather than silently modifying them. Future migrations must validate and back up before upgrading the schema.

## Deliberate V1 boundaries

Single user and LKR only. No cloud sync, mobile app, bank syncing, automatic interest calculation or database encryption. Windows sign-in protects access to the local profile; backups contain financial data in plain JSON. The locally built installer is not publisher-signed. Recurring amounts are fixed until manually edited; statement balances are reference amounts, and reminders use schedules you create.
