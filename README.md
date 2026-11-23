# Offering Tracker — COP English Assembly

Pledge and payment dashboard. The page is static (GitHub Pages); all data lives in a **private Google Sheet** and is only sent to the browser after a valid passcode. No donor data is stored in this repository.

* **View-only passcode** – leadership sees totals, pledgers, balances, receipts.
* **Treasurer passcode** – also adds pledges, records instalments, creates receipts (PDF, branded) and WhatsApp messages.
* Receipts are numbered `RCP-0001…` and show amount, pledge total, paid-to-date and balance.
* Pledge-form submissions flow into the Sheet automatically.

## Go live (≈10 minutes)

1. Open the Google Form's **Responses → Link to Sheets** (creates the Sheet; tab is `Form Responses 1`).
2. In that Sheet: **Extensions → Apps Script**, paste `Code.gs`, save.
3. Run **`setup`** once (authorise). **View → Logs** shows the two passcodes (change them in *Project Settings → Script properties*: `VIEW_CODE`, `TREASURER_CODE`).
4. **Deploy → New deployment → Web app** → *Execute as: Me*, *Who has access: Anyone* → copy the Web app URL.
5. Put the URL in `config.js` (`apiUrl`), commit. Until then the site runs in **demo mode** (try passcodes `view` / `treasurer`).

Keep the Sheet itself private (do not share it); the passcodes protect the web page.

## Notes
* Mistaken payment: in the Sheet, set that row's `Method` to `VOID` (it is then excluded from totals but kept for audit).
* Phone numbers are not on the pledge form; add them from the dashboard row in the Sheet (`Pledges` → `Phone`) so WhatsApp links work.
* Receipts are made in the browser (jsPDF); nothing is emailed or sent automatically.
