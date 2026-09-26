# Your Pocket Plan guide

## 1. Start with what you have

Open **Pocket Plan** from your desktop or Start menu. Select **Add your first account**.

- Give it a nickname, such as “Main bank”, “Cash” or “Everyday card”.
- Choose its type and enter the opening balance and date.
- For credit cards and loans, enter the amount you owe as a positive number. The app treats it as a liability.
- The opening balance is the amount **before** entries on the opening date. Avoid also importing the same opening balance as income or spending.
- Add any other accounts and choose **Finish setup**.

No real account numbers or credit-card details are necessary. You may enter an optional card limit, last statement balance, minimum payment and reference interest rate. These reference fields do not create spending or reminders by themselves.

## 2. Plan a month

Open **Monthly budget** and choose a month. Set planned income, then edit category allocations. Allocations exceeding planned income are highlighted.

Unused amounts and overspending carry forward automatically. For example, LKR 20,000 allocated plus LKR 3,000 unused from last month gives LKR 23,000 available. Spending LKR 25,000 leaves negative LKR 2,000 to carry forward.

In a category’s editor, leave **Override starting rollover** blank for automatic rollover. Enter `0` to reset carry for that month, or a specific positive/negative amount to reallocate it. This changes the plan, never an account balance. Editing an old transaction recalculates later rollover.

**Copy previous month** replaces planned amounts and planned income for the selected month. It preserves transactions and that month’s rollover overrides.

## 3. Record what happens

Use **Add transaction** for income, expenses, refunds, transfers and repayments. Amounts are entered in rupees, with up to two decimals.

- **Expense:** reduces an asset account or increases a card/debt balance; counts as spending.
- **Income:** increases the selected account and counts as received income.
- **Refund:** reverses spending and increases the account balance or reduces card debt.
- **Transfer:** moves funds between accounts; does not count as income or spending.
- **Credit card / debt repayment:** reduces a bank/cash/savings account and reduces debt. Only interest/fees included in the payment count as new spending.

For example, a LKR 10,000 loan payment with LKR 1,000 interest reduces debt by LKR 9,000 and records LKR 1,000 spending. If card interest was already entered as an expense, enter zero additional interest in the repayment so it is not counted twice.

Use **Transactions** to search, filter, edit or delete entries. Deleting a scheduled payment reopens its unpaid occurrence. Current account balances include entries through today. Monthly reports include all recorded entries dated in that month; use schedules rather than future transactions for bills that have not happened yet.

## 4. Set up payments and reminders

In **Accounts & debt**, select **Plan repayment** on a card or loan. Or open **Payments → Schedule payment or income**.

Choose the amount, source account, destination debt where applicable, first due date and recurrence. For a particular card statement, choose **once** and enter that statement’s due date and the amount you want to pay. You can choose a minimum payment or a full statement payment. Create a new one-off schedule for each changing statement, or use a monthly schedule for a fixed recurring amount.

Schedules never assume a payment happened. Select **Record paid** or **Received**, adjust the actual date/amount, then confirm. Each occurrence can only be recorded once.

Monthly schedules starting on the 31st use the final day in shorter months and return to the 31st when possible. To change a series after recording payments, pause the old schedule and create a new one. Existing transactions remain in history.

In **Settings**:

- Turn desktop reminders on or off.
- Enable **Start reminders at Windows sign-in** to start quietly after signing in.
- Choose reminder timing: default 7 days, 3 days and due day. Overdue items are reminded daily.
- Hide names and amounts with privacy mode.
- Send a test notification.

Closing the window keeps reminders running in the system tray when enabled. Double-click the tray icon to reopen. Its menu includes **Quit completely**, which stops reminders. A fully shut-down/sleeping computer cannot display notifications; the app checks missed reminders when it next runs. Windows notification settings and Do Not Disturb can suppress banners; check Notification Centre.

**Snooze** postpones an occurrence for 24 hours. **Dismiss** silences that occurrence without marking it paid; the circular-arrow control restores its reminders.

## 5. Set aside savings

Create a goal, choose the account holding the money and set a target. **Allocate or release money** earmarks existing funds; it does not move money or count as spending. Use a transfer transaction to move real money between accounts. The app warns if goal allocations exceed the selected account’s balance.

## 6. Back up and restore

**Settings → Back up now** saves a complete JSON backup, including budgets, transactions, debts, goals and reminder history. Keep an occasional copy on another drive or a backup location you control.

Automatic backups retain the last 14 backup days in the app’s data folder. Use **Open data folder** to see them. Real data is separate from the source-code project, so replacing the application does not replace your financial data.

**Restore backup** replaces current data after confirmation and first saves a `before-restore-…json` safety copy. Invalid backups are rejected. Restoring also restores reminder/startup preferences from that backup. If you restore an older backup, payments entered after that backup must be entered again.

**Export CSV** exports transactions only. **Import CSV** previews every row and flags duplicates before saving. Account/category names must match existing items. All rows must be valid; duplicates are skipped unless explicitly included. Use the CSV format help in Settings or an export as your template.

## 7. Keep history tidy

Rename or archive accounts from **Accounts & debt**. Manage, reorder or archive categories in **Settings**. Archiving hides items from new-entry choices and preserves balances and past records. Pause associated schedules separately if they should stop.

All amounts are LKR. Your app runs offline, and there are no subscriptions or bank connections.
