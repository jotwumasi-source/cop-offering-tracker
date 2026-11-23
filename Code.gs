/**
 * COP English Assembly - Offering Tracker backend (Google Apps Script)
 * Bound to the Google Sheet that receives the pledge form responses.
 *
 * SETUP (once):
 *   1. Open the Sheet -> Extensions -> Apps Script, paste this file.
 *   2. Run setup()  (authorise when asked). View > Logs shows the two passcodes.
 *   3. Deploy -> New deployment -> Web app -> Execute as: Me, Who has access: Anyone.
 *   4. Copy the Web app URL into config.js (apiUrl) in the GitHub repo.
 * Data never leaves your Google account; the dashboard only receives it after a valid passcode.
 */

const PLEDGES = 'Pledges';
const PAYMENTS = 'Payments';
const OFFERINGS = 'Offerings';
const FORM_SHEET = 'Form Responses 1';
const O_HEAD = ['OfferingNo', 'Date', 'Name', 'Amount', 'Method', 'Note', 'RecordedBy', 'Timestamp'];
const P_HEAD = ['PledgeID', 'Timestamp', 'Name', 'Phone', 'Amount', 'Note', 'Source', 'FormTs'];
const Y_HEAD = ['ReceiptNo', 'PledgeID', 'Date', 'Amount', 'Method', 'Reference', 'RecordedBy', 'Timestamp'];

function setup() {
  const ss = SpreadsheetApp.getActive();
  [[PLEDGES, P_HEAD], [PAYMENTS, Y_HEAD], [OFFERINGS, O_HEAD]].forEach(([n, h]) => {
    let sh = ss.getSheetByName(n) || ss.insertSheet(n);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#0a3480').setFontColor('#ffffff');
      sh.setFrozenRows(1);
    }
  });
  const props = PropertiesService.getScriptProperties();
  const code = () => Math.random().toString(36).slice(2, 8).toUpperCase();
  if (!props.getProperty('VIEW_CODE')) props.setProperty('VIEW_CODE', code());
  if (!props.getProperty('TREASURER_CODE')) props.setProperty('TREASURER_CODE', code() + code());
  Logger.log('VIEW code (leadership, read-only): ' + props.getProperty('VIEW_CODE'));
  Logger.log('TREASURER code (can record): ' + props.getProperty('TREASURER_CODE'));
  Logger.log('To change a code: Project Settings > Script properties.');
}

function role_(code) {
  const p = PropertiesService.getScriptProperties();
  if (!code) return null;
  if (code === p.getProperty('TREASURER_CODE')) return 'treasurer';
  if (code === p.getProperty('VIEW_CODE')) return 'viewer';
  return null;
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function rows_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  const v = sh.getDataRange().getValues();
  const h = v.shift();
  return v.map(r => { const o = {}; h.forEach((k, i) => { o[k] = r[i] instanceof Date ? r[i].toISOString() : r[i]; }); return o; });
}

// Pull new pledge-form responses into the Pledges sheet (idempotent via FormTs).
function syncForm_() {
  const ss = SpreadsheetApp.getActive();
  const fs = ss.getSheetByName(FORM_SHEET);
  const ps = ss.getSheetByName(PLEDGES);
  if (!fs || !ps || fs.getLastRow() < 2) return;
  const seen = {};
  rows_(PLEDGES).forEach(r => { if (r.FormTs) seen[r.FormTs] = 1; });
  const v = fs.getDataRange().getValues();
  const h = v.shift().map(String);
  const col = re => h.findIndex(x => re.test(x));
  const cT = 0, cA = col(/amount/i), cN = col(/name/i), cNote = col(/note|prayer/i), cPh = col(/phone|whatsapp/i);
  let n = ps.getLastRow();
  v.forEach(r => {
    const ts = r[cT] instanceof Date ? r[cT].toISOString() : String(r[cT]);
    if (!ts || seen[ts]) return;
    const amt = parseFloat(String(r[cA]).replace(/[^0-9.]/g, '')) || 0;
    n++;
    const ph = cPh >= 0 ? String(r[cPh] || '').replace(/[^0-9+]/g, '') : '';
    ps.appendRow(['P' + String(n - 1).padStart(4, '0'), ts, String(r[cN] || '').trim(), '', amt, cNote >= 0 ? r[cNote] : '', 'Form', ts]);
    ps.getRange(ps.getLastRow(), 4).setNumberFormat('@').setValue(ph);
  });
}

function nextId_(sh, prefix, pad) {
  let max = 0;
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(r => {
    const m = String(r[0]).match(/(\d+)$/); if (m) max = Math.max(max, +m[1]);
  });
  return prefix + String(max + 1).padStart(pad, '0');
}

function payload_() {
  return { pledges: rows_(PLEDGES), payments: rows_(PAYMENTS), offerings: rows_(OFFERINGS), serverTime: new Date().toISOString() };
}

function handle_(req) {
  const r = role_(req.code);
  if (!r) return { ok: false, error: 'Invalid passcode' };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = SpreadsheetApp.getActive();
    const ps = ss.getSheetByName(PLEDGES), ys = ss.getSheetByName(PAYMENTS);
    if (!ps || !ys) return { ok: false, error: 'Run setup() first' };
    syncForm_();
    if (req.action === 'load') return Object.assign({ ok: true, role: r }, payload_());
    if (r !== 'treasurer') return { ok: false, error: 'Treasurer access required' };

    if (req.action === 'addPledge') {
      const amt = Number(req.amount);
      if (!req.name || !(amt > 0)) return { ok: false, error: 'Name and amount required' };
      ps.appendRow([nextId_(ps, 'P', 4), new Date().toISOString(), req.name, '', amt, req.note || '', 'Manual', '']);
      ps.getRange(ps.getLastRow(), 4).setNumberFormat('@').setValue(String(req.phone || ''));
    } else if (req.action === 'editPledge') {
      const v = ps.getDataRange().getValues();
      const i = v.findIndex(x => x[0] === req.id);
      if (i < 1) return { ok: false, error: 'Pledge not found' };
      if (req.name != null) ps.getRange(i + 1, 3).setValue(req.name);
      if (req.phone != null) ps.getRange(i + 1, 4).setNumberFormat('@').setValue(String(req.phone));
      if (req.amount != null && Number(req.amount) > 0) ps.getRange(i + 1, 5).setValue(Number(req.amount));
    } else if (req.action === 'addPayment') {
      const amt = Number(req.amount);
      if (!(amt > 0)) return { ok: false, error: 'Amount must be positive' };
      if (!ps.getDataRange().getValues().some(x => x[0] === req.pledgeId)) return { ok: false, error: 'Pledge not found' };
      const no = nextId_(ys, 'RCP-', 4);
      ys.appendRow([no, req.pledgeId, req.date || new Date().toISOString().slice(0, 10), amt, req.method || 'Cash', req.reference || '', req.by || 'Treasurer', new Date().toISOString()]);
    } else if (req.action === 'addOffering') {
      const amt = Number(req.amount);
      if (!(amt > 0)) return { ok: false, error: 'Amount must be positive' };
      const os = ss.getSheetByName(OFFERINGS) || ss.insertSheet(OFFERINGS);
      if (os.getLastRow() === 0) os.getRange(1, 1, 1, O_HEAD.length).setValues([O_HEAD]).setFontWeight('bold').setBackground('#0a3480').setFontColor('#ffffff');
      os.appendRow([nextId_(os, 'SO-', 4), req.date || new Date().toISOString().slice(0, 10), req.name || '', amt, req.method || 'Cash', req.note || '', req.by || 'Treasurer', new Date().toISOString()]);
    } else if (req.action === 'voidPayment') {
      const v = ys.getDataRange().getValues();
      const i = v.findIndex(x => x[0] === req.receiptNo);
      if (i < 1) return { ok: false, error: 'Receipt not found' };
      ys.getRange(i + 1, 5).setValue('VOID'); // kept for audit; amount stays, method marked VOID
    } else return { ok: false, error: 'Unknown action' };
    return Object.assign({ ok: true, role: r }, payload_());
  } finally { lock.releaseLock(); }
}

function doPost(e) {
  try { return out_(handle_(JSON.parse(e.postData.contents))); }
  catch (err) { return out_({ ok: false, error: String(err) }); }
}

function doGet() { return out_({ ok: true, service: 'COP offering tracker' }); }
