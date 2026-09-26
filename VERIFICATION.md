# Pocket Plan 1.0 — verification report

Verified on this Windows 11 x64 computer on 25 September 2026.

## Result

The NSIS installer completed with exit code 0. Pocket Plan is installed at `C:\Users\dorin\AppData\Local\Programs\pocket-plan\Pocket Plan.exe`. Desktop and Start menu shortcuts both resolve to that executable. The installed application opens without a terminal or development server and was successfully opened with browser networking disabled.

The real financial profile is `C:\Users\dorin\AppData\Roaming\pocket-plan`. It is separate from the source repository and the isolated test profiles. Installation verification left its financial data unchanged and restored the startup preference.

## Checks passed

**24 calculation/storage tests** in `tests/core.test.cjs` cover:

- Exact minor-unit conversion and invalid values.
- Opening liabilities, net position, card purchases and repayments without double counting.
- Principal/interest splits, atomic transfers, refunds, edits and deletion.
- Positive/negative rollover across a year boundary, historical edits, allocation copying and explicit overrides.
- End-of-month/leap-year recurrence, weekly end dates and pausing schedules.
- Valid occurrence settlement, duplicate prevention and reopening a deleted payment.
- Notification thresholds, missed-time catch-up, saved delivery history, snooze, dismissal and paid suppression.
- Goal earmarks, excessive releases and chronological validation.
- CSV quoting/multiline roundtrip, duplicates within a file and against existing records, invalid data rejection, all-or-nothing import and 10,000-row import.
- SQLite restart, complete backup/restore, safety backup, invalid restore rejection and fourteen-date automatic backup rotation.
- Archived history and card statement fields.

**13 desktop workflows** in `tests/ui.cjs` passed against both the development executable and the installed application:

1. First account and onboarding.
2. Card starting balance, limit, statement balance and minimum payment entry.
3. Manual expense and card repayment with balance assertions.
4. Category budget and income planning.
5. Scheduled repayment confirmation and removal from unpaid items.
6. Savings allocation without creating money.
7. Transaction search, edit and deletion.
8. Every screen renders without horizontal window overflow.
9. Export, CSV preview/import/duplicate rejection, backup and restore through the desktop bridge. File pickers were supplied test paths by the test driver; financial operations used the real application handlers and SQLite database.
10. Windows reports a notification as shown; closing the window leaves it hidden in the background.
11. Data survives process restart.
12. All screens remain usable at a 1000 × 680 content size; screenshots reviewed.
13. An automatic scheduled notification arrives while hidden, persists its delivery date, and is not repeated after restarting on the same day.

No renderer exceptions were captured. TypeScript checking and the production renderer build passed. The installed clean-start screen and smaller-window settings screen were visually inspected.

**Installation checks** in `tests/installation.cjs` verified offline opening, packaged-app status, enabling/disabling Windows sign-in registration through the actual settings screen, and unchanged financial data. The `--background` startup path was exercised in the desktop suite. Windows itself was not rebooted or signed out during verification.

## Corrections made during review

- Explicit accessible form labels so helper text and the LKR prefix do not confuse field identification.
- Goal contribution date no longer inherits a target date.
- Card statement/reference fields persist correctly.
- Notification delivery is recorded only after Windows emits its `show` event.
- Correct reminder thresholds and restart deduplication.
- Bulk import validates once before its atomic commit; monthly spending uses precomputed totals.
- Historical goal releases cannot precede allocations; aggregate money calculations stay within exact integer range.
- Refresh balances when the window regains focus and periodically while open.
- Fixed Windows packaging configuration and verified the generated installer.

## Operational limits

Windows must be awake and allow notifications; Do Not Disturb can suppress banners. The application must be running in the tray or started at sign-in. Fully quitting stops reminders. Startup is an opt-in setting. The locally built installer is unsigned. Data/backups are local and unencrypted. Interest and statement figures are manually entered; reference rates do not calculate charges. These are documented V1 boundaries.

## Build artifact

- `release/Pocket Plan Setup 1.0.0.exe` — 113,699,041 bytes.
- SHA-256: `2187A0C973229A280A9A97CB600439E14F6961514E8C29EC638A42FAA1ED57E1`.
- Machine-readable desktop/installation results and screenshots are in `test-results/` (excluded from Git).
