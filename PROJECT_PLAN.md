# Pocket Plan — approved scope

Windows desktop application, Electron + React/TypeScript + SQLite. LKR only in V1. Fully manual entry; no bank access, credentials, or card numbers. Installable, desktop and Start menu shortcuts, offline operation.

## Delivery stages

1. SQLite persistence, validation and money/date calculation engine.
2. Accounts (cash, bank, savings, card and loan), transactions, refunds, transfers and split principal/interest repayments.
3. Monthly budgets with positive/negative rollover, historical recalculation, allocation copy, explicit rollover adjustment; savings earmarks.
4. Recurring bills/income/debt payments, occurrence settlement, snooze/dismiss and persisted desktop notifications; optional startup/tray operation.
5. Reports, validated CSV preview/import/export, rotating backups and guarded restore.
6. Unit/integration/UI tests, packaging, installed launch verification and user guide.

## Required verification

Money uses safe integer minor units. Transfers are atomic and excluded from income/expense. Opening debt excluded from spending. Principal and interest separated. Rollover crosses years and recalculates after changes. Goal allocations do not create money. Import and restore validate all data before committing. Recurring settlement cannot duplicate, including after edits. Notifications stop for settled occurrences, survive restart, and respect snooze/privacy. Restore has a safety backup. No personal financial data in source control. Test the packaged app and clean restart, not only a development server.
