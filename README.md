# Offering Tracker — COP English Assembly

Pledge and payment dashboard. The page is static (GitHub Pages); all data lives in a **private Google Sheet** and is only sent to the browser after sign-in. No donor data is stored in this repository.

## Access
* Three named accounts only: **Jones Owusu Twumasi** (IT Specialist), **Clara Sakyi Snr**, **Isaac Commey**. Username (`jones`, `clara`, `isaac`) + personal password. All three have full administrative rights.
* First sign-in uses a one-time temporary password and **must** be replaced by the person's own password.
* Passwords are stored only as salted hashes. Sessions last 6 hours. Five wrong attempts lock that username for 15 minutes.
* Only the IT specialist can issue a new temporary password (Activity log → *Reset a password*).
* The old shared passcodes (view-only, Financial Secretary) are cancelled.

## Accountability
* **Activity log** (sheet `ActivityLog`, shown on the dashboard): every sign-in, failed sign-in, pledge, payment, edit, void, removal, seed offering and password change, with the person's name and time.
* **Software updates** (sheet `Releases`, shown on the dashboard): every release is recorded under Jones Owusu Twumasi, IT Specialist. When shipping an update, add it to `RELEASES` in `Code.gs`.
* Receipts carry the name of the person who recorded the payment.

## Go live / update
1. Paste `Code.gs` into the Sheet's Apps Script project (Extensions → Apps Script) and save.
2. Run **`setup`** after adding a user to `USERS` (the Execution log shows each new user's temporary password). Run **`selfTest`** to check hashing and sessions.
3. Deploy → Manage deployments → edit → New version → Deploy (the URL stays the same).
4. `config.js` holds the Web app URL (`apiUrl`). While empty, the site runs in demo mode (usernames jones / clara / isaac, password `demo1234`).

## Notes
* Mistaken entries are removed or voided, never silently deleted: rows stay in the Sheet marked REMOVED or VOID.
* Receipts are made in the browser (jsPDF); nothing is emailed or sent automatically.
