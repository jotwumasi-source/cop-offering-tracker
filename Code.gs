/**
 * COP English Assembly - Offering Tracker backend (Google Apps Script)
 * Bound to the Google Sheet that receives the pledge form responses.
 *
 * ACCESS: three named accounts (jones, clara, isaac). Each signs in with a username and a personal
 * password; passwords are stored only as salted hashes. Every action is written to the ActivityLog
 * sheet under the person's name. Software updates are recorded in the Releases sheet under the IT specialist.
 *
 * SETUP (once, or after adding a user to USERS):
 *   1. Paste this file in Extensions -> Apps Script and save.
 *   2. Run setup()  -> View > Execution log shows each new user's one-time temporary password.
 *   3. Deploy -> Manage deployments -> edit -> New version -> Deploy (same URL).
 */

const PLEDGES = 'Pledges';
const PAYMENTS = 'Payments';
const OFFERINGS = 'Offerings';
const ACTIVITY = 'ActivityLog';
const RELEASES_SHEET = 'Releases';
const FORM_SHEET = 'Form Responses 1';
const O_HEAD = ['OfferingNo', 'Date', 'Name', 'Amount', 'Method', 'Note', 'RecordedBy', 'Timestamp', 'Status'];
const P_HEAD = ['PledgeID', 'Timestamp', 'Name', 'Phone', 'Amount', 'Note', 'Source', 'FormTs', 'Months', 'Status'];
const Y_HEAD = ['ReceiptNo', 'PledgeID', 'Date', 'Amount', 'Method', 'Reference', 'RecordedBy', 'Timestamp', 'Status'];
const A_HEAD = ['Timestamp', 'User', 'Action', 'Target', 'Detail'];
const R_HEAD = ['Version', 'Date', 'UpdatedBy', 'Summary'];

// The only people who can sign in. All three have full administrative rights.
const USERS = [
  { u: 'jones', name: 'Jones Owusu Twumasi', title: 'IT Specialist', it: true },
  { u: 'clara', name: 'Clara Sakyi Snr', title: '' },
  { u: 'isaac', name: 'Isaac Commey', title: '' }
];
const IT_NAME = 'Jones Owusu Twumasi (IT Specialist)';

// Software update history. Every release is tied to the IT specialist.
const RELEASES = [
  { v: '1.0', date: '2026-11-23', summary: 'Dashboard launched: pledges, payments, instalments, PDF receipts, Google Sheet backend.' },
  { v: '1.1', date: '2026-11-23', summary: 'Seed cash offering, phone numbers from the pledge form, total raised.' },
  { v: '1.2', date: '2026-11-23', summary: 'Instalment months on the form and dashboard; Treasurer renamed Financial Secretary.' },
  { v: '1.3', date: '2026-11-23', summary: 'Edit, remove and void controls; possible-duplicate flag.' },
  { v: '1.4', date: '2026-11-23', summary: 'Faster saves: instant on-screen updates, lighter backend.' },
  { v: '1.5', date: '2026-11-23', summary: 'Edit seed offerings, clear validation messages, overpayment allowed.' },
  { v: '2.0', date: '2026-11-23', summary: 'Named user accounts with personal passwords, activity log with every action tied to a name, software-update record. Old shared passcodes cancelled.' }
];

function setup() {
  const ss = SpreadsheetApp.getActive();
  [[PLEDGES, P_HEAD], [PAYMENTS, Y_HEAD], [OFFERINGS, O_HEAD], [ACTIVITY, A_HEAD], [RELEASES_SHEET, R_HEAD]].forEach(([n, h]) => sheet_(n, h));
  const props = PropertiesService.getScriptProperties();
  const db = dbGet_();
  USERS.forEach(user => {
    if (db[user.u]) return;
    const pw = tempPw_(), salt = Utilities.getUuid();
    db[user.u] = { salt: salt, hash: hash_(salt, pw), must: true, r: HASH_ROUNDS };
    Logger.log('NEW USER ' + user.u + '  (' + user.name + ')  temporary password: ' + pw + '   (must be changed at first sign-in)');
    log_('System', 'USER CREATED', user.name, 'username ' + user.u);
  });
  dbSet_(db);
  ['VIEW_CODE', 'FINSEC_CODE', 'TREASURER_CODE'].forEach(k => props.deleteProperty(k)); // old shared passcodes are cancelled
  Logger.log('Old shared passcodes cancelled. Users: ' + Object.keys(db).join(', '));
  ensureHeaders_();
  ensureReleases_();
}

// ---------------------------------------------------------------- users and sessions
function dbGet_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('USERS_DB') || '{}'); } catch (e) { return {}; } }
function dbSet_(db) { PropertiesService.getScriptProperties().setProperty('USERS_DB', JSON.stringify(db)); }
function hex_(bytes) { return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join(''); }
const HASH_ROUNDS = 300; // new passwords; accounts created earlier keep their stored round count (default 2000)
function hash_(salt, pw, rounds) {
  let h = salt + ':' + pw;
  for (let i = 0; i < (rounds || HASH_ROUNDS); i++) h = hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h, Utilities.Charset.UTF_8));
  return h;
}
function tempPw_() {
  const al = 'abcdefghjkmnpqrstuvwxyz23456789', hx = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  let s = ''; for (let i = 0; i < 12; i++) s += al[parseInt(hx.substr(i * 2, 2), 16) % al.length];
  return s;
}
function userOf_(u) { return USERS.find(x => x.u === u); }
function publicUser_(u, rec) { const x = userOf_(u); return { u: x.u, name: x.name, title: x.title, it: !!x.it, mustChange: !!(rec && rec.must) }; }

function login_(req) {
  const u = String(req.username || '').trim().toLowerCase(), pw = String(req.password || '');
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get('fail_' + u) || 0);
  if (fails >= 5) return { ok: false, error: 'Too many wrong attempts. Try again in 15 minutes.' };
  const rec = dbGet_()[u], user = userOf_(u);
  if (!rec || !user || hash_(rec.salt, pw, rec.r || 2000) !== rec.hash) {
    cache.put('fail_' + u, String(fails + 1), 900);
    log_(u || '(blank)', 'LOGIN FAILED', '', '');
    return { ok: false, error: 'Wrong username or password.' };
  }
  cache.remove('fail_' + u);
  const token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  cache.put('tok_' + token, u, 21600); // 6 hours
  log_(user.name, 'LOGIN', '', '');
  return { ok: true, token: token, user: publicUser_(u, rec) };
}

function me_(token) {
  if (!token) return null;
  const u = CacheService.getScriptCache().get('tok_' + token);
  if (!u || !userOf_(u)) return null;
  return Object.assign(publicUser_(u, dbGet_()[u]), { token: token });
}

// ---------------------------------------------------------------- sheets helpers
function sheet_(name, head) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#0a3480').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

// Adds any missing column headers to existing sheets (safe to run repeatedly).
function ensureHeaders_() {
  const ss = SpreadsheetApp.getActive();
  [[PLEDGES, P_HEAD], [PAYMENTS, Y_HEAD], [OFFERINGS, O_HEAD]].forEach(([n, h]) => {
    const sh = ss.getSheetByName(n); if (!sh) return;
    const cur = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
    h.forEach(k => { if (cur.indexOf(k) < 0) { sh.getRange(1, cur.length + 1).setValue(k).setFontWeight('bold').setBackground('#0a3480').setFontColor('#ffffff'); cur.push(k); } });
  });
}

function log_(user, action, target, detail) {
  try { sheet_(ACTIVITY, A_HEAD).appendRow([new Date(), user, action, target || '', detail || '']); } catch (e) {}
}

// Records each software release under the IT specialist (once per version).
function ensureReleases_() {
  const sh = sheet_(RELEASES_SHEET, R_HEAD);
  const have = {};
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(r => { have[String(r[0])] = 1; });
  RELEASES.forEach(r => {
    if (have[r.v]) return;
    sh.appendRow([r.v, r.date, IT_NAME, r.summary]);
    sh.getRange(sh.getLastRow(), 1).setNumberFormat('@').setValue(r.v);
    log_(IT_NAME.replace(' (IT Specialist)', ''), 'SOFTWARE UPDATE', 'v' + r.v, r.summary);
  });
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
  const cT = 0, cA = col(/amount/i), cN = col(/name/i), cNote = col(/note|prayer/i), cPh = col(/phone|whatsapp/i), cM = col(/month|instal/i);
  let n = ps.getLastRow();
  v.forEach(r => {
    const ts = r[cT] instanceof Date ? r[cT].toISOString() : String(r[cT]);
    if (!ts || seen[ts]) return;
    const amt = parseFloat(String(r[cA]).replace(/[^0-9.]/g, '')) || 0;
    n++;
    const mm = cM >= 0 ? (parseInt(String(r[cM]).replace(/[^0-9]/g, ''), 10) || 1) : 1;
    const ph = cPh >= 0 ? String(r[cPh] || '').replace(/[^0-9+]/g, '') : '';
    const pid = 'P' + String(n - 1).padStart(4, '0');
    ps.appendRow([pid, ts, String(r[cN] || '').trim(), '', amt, cNote >= 0 ? r[cNote] : '', 'Form', ts, mm]);
    ps.getRange(ps.getLastRow(), 4).setNumberFormat('@').setValue(ph);
    log_('Pledge form', 'NEW PLEDGE (FORM)', pid, String(r[cN] || '').trim() + ' · GHS ' + amt + ' · ' + mm + ' mo');
  });
}

function colOf_(sh, name) {
  const h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const i = h.indexOf(name);
  if (i < 0) throw new Error('Column missing: ' + name);
  return i + 1;
}

function isVoidRow_(r) { return String(r.Status || '').toUpperCase() === 'VOID' || String(r.Method || '').toUpperCase() === 'VOID'; }

function nextId_(sh, prefix, pad) {
  let max = 0;
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(r => {
    const m = String(r[0]).match(/(\d+)$/); if (m) max = Math.max(max, +m[1]);
  });
  return prefix + String(max + 1).padStart(pad, '0');
}

function payload_(me) {
  const log = rows_(ACTIVITY); const last = log.slice(-300).reverse();
  return {
    me: me, role: 'admin',
    pledges: rows_(PLEDGES), payments: rows_(PAYMENTS), offerings: rows_(OFFERINGS),
    log: last, releases: rows_(RELEASES_SHEET).reverse(),
    users: USERS.map(x => ({ u: x.u, name: x.name })),
    serverTime: new Date().toISOString()
  };
}

// ---------------------------------------------------------------- request handling
function handle_(req) {
  if (req.action === 'login') return login_(req);
  const me = me_(req.token);
  if (!me) return { ok: false, error: 'Session expired. Please sign in again.', auth: true };
  if (me.mustChange && req.action !== 'changePassword' && req.action !== 'logout') return { ok: false, error: 'Please change your temporary password first.', mustChange: true };

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = SpreadsheetApp.getActive();
    const ps = ss.getSheetByName(PLEDGES), ys = ss.getSheetByName(PAYMENTS);
    if (!ps || !ys) return { ok: false, error: 'Run setup() first' };
    let created = {};
    const who = me.name;

    if (req.action === 'logout') { CacheService.getScriptCache().remove('tok_' + req.token); log_(who, 'LOGOUT', '', ''); return { ok: true }; }

    if (req.action === 'changePassword') {
      const db = dbGet_(), rec = db[me.u];
      if (!rec || hash_(rec.salt, String(req.oldPassword || ''), rec.r || 2000) !== rec.hash) return { ok: false, error: 'Your current password is wrong.' };
      const np = String(req.newPassword || '');
      if (np.length < 8) return { ok: false, error: 'New password must be at least 8 characters.' };
      if (np === String(req.oldPassword)) return { ok: false, error: 'Choose a password different from the old one.' };
      const salt = Utilities.getUuid(); db[me.u] = { salt: salt, hash: hash_(salt, np), must: false, r: HASH_ROUNDS }; dbSet_(db);
      log_(who, 'PASSWORD CHANGED', who, '');
      return { ok: true };
    }
    if (req.action === 'resetPassword') {
      if (!me.it) return { ok: false, error: 'Only the IT specialist can reset passwords.' };
      const t = userOf_(String(req.username || ''));
      if (!t) return { ok: false, error: 'User not found' };
      const db = dbGet_(), pw = tempPw_(), salt = Utilities.getUuid();
      db[t.u] = { salt: salt, hash: hash_(salt, pw), must: true, r: HASH_ROUNDS }; dbSet_(db);
      CacheService.getScriptCache().remove('fail_' + t.u);
      log_(who, 'PASSWORD RESET', t.name, 'new temporary password issued');
      return { ok: true, tempPassword: pw };
    }

    if (req.action === 'load') { ensureHeaders_(); syncForm_(); ensureReleases_(); return Object.assign({ ok: true }, payload_(publicUser_(me.u, dbGet_()[me.u]))); }

    if (req.action === 'addPledge') {
      const amt = Number(req.amount);
      if (!req.name || !(amt > 0)) return { ok: false, error: 'Name and amount required' };
      const pid = nextId_(ps, 'P', 4); created = { PledgeID: pid };
      const mo = Math.max(1, parseInt(req.months, 10) || 1);
      ps.appendRow([pid, new Date().toISOString(), req.name, '', amt, req.note || '', 'Manual', '', mo]);
      ps.getRange(ps.getLastRow(), 4).setNumberFormat('@').setValue(String(req.phone || ''));
      log_(who, 'ADD PLEDGE', pid, req.name + ' · GHS ' + amt + ' · ' + mo + ' mo');
    } else if (req.action === 'editPledge') {
      const v = ps.getDataRange().getValues();
      const i = v.findIndex(x => x[0] === req.id);
      if (i < 1) return { ok: false, error: 'Pledge not found' };
      const mc = v[0].indexOf('Months') + 1, chg = [];
      if (req.name != null && String(req.name).trim() && String(req.name).trim() !== v[i][2]) { chg.push('name ' + v[i][2] + ' -> ' + String(req.name).trim()); }
      if (req.amount != null && Number(req.amount) > 0 && Number(req.amount) !== Number(v[i][4])) { chg.push('amount ' + v[i][4] + ' -> ' + Number(req.amount)); }
      if (req.months != null && parseInt(req.months, 10) > 0 && parseInt(req.months, 10) !== Number(v[i][mc - 1] || 1)) { chg.push('months ' + (v[i][mc - 1] || 1) + ' -> ' + parseInt(req.months, 10)); }
      if (req.phone != null && String(req.phone) !== String(v[i][3])) { chg.push('phone changed'); }
      if (req.note != null && String(req.note) !== String(v[i][5])) { chg.push('note changed'); }
      if (req.note != null) ps.getRange(i + 1, colOf_(ps, 'Note')).setValue(String(req.note));
      if (req.name != null && String(req.name).trim()) ps.getRange(i + 1, 3).setValue(String(req.name).trim());
      if (req.phone != null) ps.getRange(i + 1, 4).setNumberFormat('@').setValue(String(req.phone));
      if (req.amount != null && Number(req.amount) > 0) ps.getRange(i + 1, 5).setValue(Number(req.amount));
      if (req.months != null && parseInt(req.months, 10) > 0) ps.getRange(i + 1, mc).setValue(parseInt(req.months, 10));
      log_(who, 'EDIT PLEDGE', req.id, chg.join('; ') || 'no changes');
    } else if (req.action === 'addPayment') {
      const amt = Number(req.amount);
      if (!(amt > 0)) return { ok: false, error: 'Amount must be positive' };
      if (!ps.getDataRange().getValues().some(x => x[0] === req.pledgeId)) return { ok: false, error: 'Pledge not found' };
      const no = nextId_(ys, 'RCP-', 4); created = { ReceiptNo: no };
      ys.appendRow([no, req.pledgeId, req.date || new Date().toISOString().slice(0, 10), amt, req.method || 'Cash', req.reference || '', who, new Date().toISOString()]);
      log_(who, 'ADD PAYMENT', no, req.pledgeId + ' · GHS ' + amt + ' · ' + (req.method || 'Cash'));
    } else if (req.action === 'addOffering') {
      const amt = Number(req.amount);
      if (!(amt > 0)) return { ok: false, error: 'Amount must be positive' };
      const os = sheet_(OFFERINGS, O_HEAD);
      const sno = nextId_(os, 'SO-', 4); created = { OfferingNo: sno };
      os.appendRow([sno, req.date || new Date().toISOString().slice(0, 10), req.name || '', amt, req.method || 'Cash', req.note || '', who, new Date().toISOString()]);
      log_(who, 'ADD SEED OFFERING', sno, 'GHS ' + amt + ' · ' + (req.method || 'Cash') + (req.name ? ' · ' + req.name : ''));
    } else if (req.action === 'deletePledge') {
      const v = ps.getDataRange().getValues();
      const i = v.findIndex(x => x[0] === req.id);
      if (i < 1) return { ok: false, error: 'Pledge not found' };
      const pays = rows_(PAYMENTS).filter(p => p.PledgeID === req.id && !isVoidRow_(p));
      if (pays.length) return { ok: false, error: 'This pledge has payments. Void them first.' };
      ps.getRange(i + 1, colOf_(ps, 'Status')).setValue('REMOVED');
      if (req.reason) { const nc = colOf_(ps, 'Note'); ps.getRange(i + 1, nc).setValue((String(v[i][nc - 1] || '') + ' [removed: ' + req.reason + ']').trim()); }
      log_(who, 'REMOVE PLEDGE', req.id, v[i][2] + ' · GHS ' + v[i][4] + (req.reason ? ' · ' + req.reason : ''));
    } else if (req.action === 'voidPayment') {
      const v = ys.getDataRange().getValues();
      const i = v.findIndex(x => x[0] === req.receiptNo);
      if (i < 1) return { ok: false, error: 'Receipt not found' };
      ys.getRange(i + 1, colOf_(ys, 'Status')).setValue('VOID');
      if (req.reason) { const rc = colOf_(ys, 'Reference'); ys.getRange(i + 1, rc).setValue((String(v[i][rc - 1] || '') + ' [void: ' + req.reason + ']').trim()); }
      log_(who, 'VOID PAYMENT', req.receiptNo, v[i][1] + ' · GHS ' + v[i][3] + (req.reason ? ' · ' + req.reason : ''));
    } else if (req.action === 'editOffering') {
      const os = ss.getSheetByName(OFFERINGS);
      const v = os ? os.getDataRange().getValues() : [];
      const i = v.findIndex(x => x[0] === req.offeringNo);
      if (i < 1) return { ok: false, error: 'Seed offering not found' };
      const amt = Number(req.amount);
      if (!(amt > 0)) return { ok: false, error: 'Amount must be positive' };
      const ac = colOf_(os, 'Amount'), nc = colOf_(os, 'Note'), old = Number(v[i][ac - 1]);
      os.getRange(i + 1, ac).setValue(amt);
      if (req.name != null) os.getRange(i + 1, colOf_(os, 'Name')).setValue(String(req.name));
      if (req.method) os.getRange(i + 1, colOf_(os, 'Method')).setValue(String(req.method));
      if (req.date) { const dc = colOf_(os, 'Date'), cur = v[i][dc - 1]; const curS = cur instanceof Date ? cur.toISOString().slice(0, 10) : String(cur).slice(0, 10); if (curS !== String(req.date).slice(0, 10)) os.getRange(i + 1, dc).setValue(String(req.date).slice(0, 10)); }
      let note = req.note != null ? String(req.note) : String(v[i][nc - 1] || '');
      if (old !== amt) note = (note + ' [amount corrected ' + old + ' -> ' + amt + (req.reason ? ': ' + req.reason : '') + ' by ' + who + ']').trim();
      os.getRange(i + 1, nc).setValue(note);
      log_(who, 'EDIT SEED OFFERING', req.offeringNo, old !== amt ? 'amount ' + old + ' -> ' + amt : 'details updated');
    } else if (req.action === 'voidOffering') {
      const os = ss.getSheetByName(OFFERINGS);
      const v = os ? os.getDataRange().getValues() : [];
      const i = v.findIndex(x => x[0] === req.offeringNo);
      if (i < 1) return { ok: false, error: 'Seed offering not found' };
      os.getRange(i + 1, colOf_(os, 'Status')).setValue('VOID');
      if (req.reason) { const nc = colOf_(os, 'Note'); os.getRange(i + 1, nc).setValue((String(v[i][nc - 1] || '') + ' [void: ' + req.reason + ']').trim()); }
      log_(who, 'VOID SEED OFFERING', req.offeringNo, 'GHS ' + v[i][colOf_(os, 'Amount') - 1] + (req.reason ? ' · ' + req.reason : ''));
    } else return { ok: false, error: 'Unknown action' };
    return { ok: true, created: created };
  } finally { lock.releaseLock(); }
}

function doPost(e) {
  try { return out_(handle_(JSON.parse(e.postData.contents))); }
  catch (err) { return out_({ ok: false, error: String(err) }); }
}

function doGet() { return out_({ ok: true, service: 'COP offering tracker' }); }

// Run from the editor to check the password and session machinery without touching real accounts.
function selfTest() {
  const t0 = Date.now(); const salt = Utilities.getUuid(), h1 = hash_(salt, 'Correct-Horse-9'), h2 = hash_(salt, 'wrong');
  if (h1 === h2 || h1 !== hash_(salt, 'Correct-Horse-9')) throw new Error('hash check failed');
  const c = CacheService.getScriptCache(); c.put('tok_selftest', 'jones', 60);
  if (!me_('selftest') || me_('selftest').name !== 'Jones Owusu Twumasi') throw new Error('session check failed');
  c.remove('tok_selftest'); if (me_('selftest')) throw new Error('session expiry check failed');
  const pw = tempPw_(); if (pw.length !== 12) throw new Error('temp password check failed');
  const bad = handle_({ action: 'load', token: 'nope' }); if (bad.ok || !bad.auth) throw new Error('unauthenticated request was accepted');
  Logger.log('SELFTEST OK: hashing, sessions, expiry, temp passwords and auth gate all behave. Two password hashes took ' + (Date.now() - t0) + ' ms.');
}
