(() => {
const C = window.TRACKER_CONFIG, DEMO = !C.apiUrl;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => C.currency + ' ' + Number(n || 0).toLocaleString('en-GB', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const money0 = n => '<span class="cur">' + C.currency + '</span> ' + Math.round(Number(n || 0)).toLocaleString('en-GB');
const store = { get(k) { try { return sessionStorage.getItem(k); } catch { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch {} }, del(k) { try { sessionStorage.removeItem(k); } catch {} } };
let S = { role: null, token: null, user: null, pledges: [], payments: [], offerings: [], deposits: [], log: [], releases: [], users: [] };
const phoneOf = p => { const d = String(p ?? '').replace(/[^0-9+]/g, ''); return d.length === 9 && !d.startsWith('+') ? '0' + d : d; };

/* ------------------------------------------------------------ data layer */
const DKEY = 'cop_tracker_demo_v1';
function demoSeed() {
  const names = ['Akosua Mensah','Kwame Boateng','Efua Owusu','Yaw Asante','Abena Darko','Kofi Annan Jr','Ama Serwaa','Nana Yaw Sarpong','Esi Quaye','Kojo Antwi','Adwoa Frimpong','Samuel Tetteh','Grace Ofori','Daniel Acheampong'];
  const amts = [2000,1500,500,1000,3000,800,600,2500,400,1200,750,5000,300,1000];
  const pledges = names.map((n, i) => ({ PledgeID: 'P' + String(i + 1).padStart(4, '0'), Timestamp: new Date(Date.now() - (14 - i) * 864e5).toISOString(), Name: n, Phone: '024' + String(1000000 + i * 91357).slice(0, 7), Amount: amts[i], Note: '', Source: i % 3 ? 'Form' : 'Manual', Months: [3, 6, 1, 4, 6, 2, 3, 6, 1, 4, 3, 6, 2, 4][i] }));
  const pay = []; let k = 0;
  const add = (pi, frac, daysAgo, m) => { k++; pay.push({ ReceiptNo: 'RCP-' + String(k).padStart(4, '0'), PledgeID: pledges[pi].PledgeID, Date: new Date(Date.now() - daysAgo * 864e5).toISOString().slice(0, 10), Amount: Math.round(pledges[pi].Amount * frac), Method: m, Reference: '', RecordedBy: 'Clara Sakyi Snr' }); };
  add(0, 1, 12, 'MoMo'); add(1, .5, 11, 'Cash'); add(2, 1, 10, 'Cash'); add(3, .4, 9, 'MoMo'); add(4, .3, 8, 'Bank transfer'); add(5, 1, 7, 'MoMo'); add(1, .25, 5, 'MoMo'); add(7, .6, 4, 'Cash'); add(3, .3, 3, 'MoMo'); add(9, .5, 2, 'MoMo'); add(11, .2, 1, 'Cash'); add(4, .3, 1, 'MoMo');
  const offerings = [{ OfferingNo: 'SO-0001', Date: new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10), Name: '', Amount: 650, Method: 'Cash', Note: 'Sunday seed offering' }, { OfferingNo: 'SO-0002', Date: new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10), Name: 'Nana Yaw Sarpong', Amount: 300, Method: 'MoMo', Note: '' }];
  return { pledges, payments: pay, offerings };
}
const demoLoad = () => { try { const j = localStorage.getItem(DKEY); if (j) { const d = JSON.parse(j); if (!d.offerings) { d.offerings = demoSeed().offerings; demoSave(d); } if (!d.deposits) { d.deposits = []; d.files = {}; demoSave(d); } return d; } } catch {} const d = demoSeed(); demoSave(d); return d; };
const demoSave = d => { try { localStorage.setItem(DKEY, JSON.stringify(d)); } catch {} };

const sessionExpired = () => { store.del('token'); toast('Session expired. Please sign in again.'); setTimeout(() => location.reload(), 1300); };
async function api(req) {
  if (DEMO) { const lag = Number(new URLSearchParams(location.search).get('lag')) || 0; if (lag) await new Promise(r => setTimeout(r, lag)); try { return await demoApi(req); } catch (er) { if (er.auth) sessionExpired(); throw er; } }
  const r = await fetch(C.apiUrl, { method: 'POST', body: JSON.stringify(req) });
  const j = await r.json();
  if (!j.ok) { if (j.auth) sessionExpired(); const er = new Error(j.error || 'Request failed'); er.mustChange = j.mustChange; throw er; }
  return j;
}

/* ---- demo backend (sample data only, in this browser) ---- */
const DEMO_USERS = [{ u: 'jones', name: 'Jones Owusu Twumasi', title: 'IT Specialist', it: true }, { u: 'clara', name: 'Clara Sakyi Snr', title: '' }, { u: 'isaac', name: 'Isaac Commey', title: '' }];
const DEMO_RELEASES = [['2.0', 'Named user accounts, activity log, software-update record.'], ['1.5', 'Edit seed offerings, clear validation messages.'], ['1.4', 'Faster saves.'], ['1.3', 'Edit, remove, void controls.'], ['1.2', 'Instalment months.'], ['1.1', 'Seed offering and phone numbers.'], ['1.0', 'Dashboard launched.']].map(([v, s]) => ({ Version: v, Date: '2026-11-23', UpdatedBy: 'Jones Owusu Twumasi (IT Specialist)', Summary: s }));
function demoApi(r) {
  const d = demoLoad();
  d.pw = d.pw || { jones: 'demo1234', clara: 'demo1234', isaac: 'demo1234' }; d.must = d.must || { clara: true }; d.log = d.log || [];
  const lg = (name, action, target, detail) => d.log.push({ Timestamp: new Date().toISOString(), User: name, Action: action, Target: target || '', Detail: detail || '' });
  const fail = (m, extra) => { const er = new Error(m); Object.assign(er, extra); throw er; };
  if (r.action === 'login') {
    const u = String(r.username || '').trim().toLowerCase(), user = DEMO_USERS.find(x => x.u === u);
    if (!user || d.pw[u] !== r.password) { lg(u || '(blank)', 'LOGIN FAILED'); demoSave(d); fail('Wrong username or password.'); }
    lg(user.name, 'LOGIN'); demoSave(d);
    return Promise.resolve({ ok: true, token: 'demo-' + u, user: { ...user, mustChange: !!d.must[u] } });
  }
  const u = String(r.token || '').replace('demo-', ''), user = DEMO_USERS.find(x => x.u === u);
  if (!user) fail('Session expired. Please sign in again.', { auth: true });
  if (d.must[u] && r.action !== 'changePassword' && r.action !== 'logout') fail('Please change your temporary password first.', { mustChange: true });
  if (r.action === 'logout') { lg(user.name, 'LOGOUT'); demoSave(d); return Promise.resolve({ ok: true }); }
  if (r.action === 'changePassword') { if (d.pw[u] !== r.oldPassword) fail('Your current password is wrong.'); if (String(r.newPassword || '').length < 8) fail('New password must be at least 8 characters.'); d.pw[u] = r.newPassword; delete d.must[u]; lg(user.name, 'PASSWORD CHANGED', user.name); demoSave(d); return Promise.resolve({ ok: true }); }
  if (r.action === 'resetPassword') { if (!user.it) fail('Only the IT specialist can reset passwords.'); const t = DEMO_USERS.find(x => x.u === r.username); if (!t) fail('User not found'); const temp = 'temp' + Math.random().toString(36).slice(2, 8); d.pw[t.u] = temp; d.must[t.u] = true; lg(user.name, 'PASSWORD RESET', t.name, 'new temporary password issued'); demoSave(d); return Promise.resolve({ ok: true, tempPassword: temp }); }
  if (r.action === 'load') return Promise.resolve({ ok: true, role: 'admin', me: { ...user, mustChange: false }, pledges: d.pledges, payments: d.payments, offerings: d.offerings, deposits: d.deposits, log: user.it ? d.log.slice().reverse().slice(0, 300) : [], releases: user.it ? DEMO_RELEASES : [], users: user.it ? DEMO_USERS.map(x => ({ u: x.u, name: x.name })) : [] });
  const who = user.name, last = arr => arr[arr.length - 1];
  if (r.action === 'addPledge') { d.pledges.push({ PledgeID: 'P' + String(d.pledges.length + 1).padStart(4, '0'), Timestamp: new Date().toISOString(), Name: r.name, Phone: r.phone || '', Amount: +r.amount, Note: r.note || '', Source: 'Manual', Months: Math.max(1, parseInt(r.months, 10) || 1) }); lg(who, 'ADD PLEDGE', last(d.pledges).PledgeID, r.name + ' · GHS ' + r.amount); }
  else if (r.action === 'addPayment') { d.payments.push({ ReceiptNo: 'RCP-' + String(d.payments.length + 1).padStart(4, '0'), PledgeID: r.pledgeId, Date: r.date, Amount: +r.amount, Method: r.method, Reference: r.reference || '', RecordedBy: who }); lg(who, 'ADD PAYMENT', last(d.payments).ReceiptNo, r.pledgeId + ' · GHS ' + r.amount); }
  else if (r.action === 'addOffering') { d.offerings.push({ OfferingNo: 'SO-' + String(d.offerings.length + 1).padStart(4, '0'), Date: r.date, Name: r.name || '', Amount: +r.amount, Method: r.method, Note: r.note || '', RecordedBy: who }); lg(who, 'ADD SEED OFFERING', last(d.offerings).OfferingNo, 'GHS ' + r.amount); }
  else if (r.action === 'editPledge') { const p = d.pledges.find(x => x.PledgeID === r.id); if (!p) fail('Pledge not found'); const chg = []; if (r.name != null && String(r.name).trim() && String(r.name).trim() !== p.Name) { chg.push('name ' + p.Name + ' -> ' + String(r.name).trim()); p.Name = String(r.name).trim(); } if (r.phone != null) p.Phone = String(r.phone); if (+r.amount > 0 && +r.amount !== +p.Amount) { chg.push('amount ' + p.Amount + ' -> ' + r.amount); p.Amount = +r.amount; } if (parseInt(r.months, 10) > 0) p.Months = parseInt(r.months, 10); if (r.note != null) p.Note = String(r.note); lg(who, 'EDIT PLEDGE', r.id, chg.join('; ') || 'details updated'); }
  else if (r.action === 'deletePledge') { const p = d.pledges.find(x => x.PledgeID === r.id); if (!p) fail('Pledge not found'); if (d.payments.some(x => x.PledgeID === r.id && !isVoid(x))) fail('This pledge has payments. Void them first.'); p.Status = 'REMOVED'; lg(who, 'REMOVE PLEDGE', r.id, p.Name + (r.reason ? ' · ' + r.reason : '')); }
  else if (r.action === 'voidPayment') { const p = d.payments.find(x => x.ReceiptNo === r.receiptNo); if (!p) fail('Receipt not found'); p.Status = 'VOID'; lg(who, 'VOID PAYMENT', r.receiptNo, 'GHS ' + p.Amount + (r.reason ? ' · ' + r.reason : '')); }
  else if (r.action === 'editOffering') { const o = d.offerings.find(x => x.OfferingNo === r.offeringNo); if (!o) fail('Seed offering not found'); if (!(+r.amount > 0)) fail('Amount must be positive'); const old = o.Amount; o.Amount = +r.amount; if (r.name != null) o.Name = r.name; if (r.method) o.Method = r.method; if (r.date) o.Date = r.date; if (r.note != null) o.Note = r.note; lg(who, 'EDIT SEED OFFERING', r.offeringNo, old !== o.Amount ? 'amount ' + old + ' -> ' + o.Amount : 'details updated'); }
  else if (r.action === 'voidOffering') { const o = d.offerings.find(x => x.OfferingNo === r.offeringNo); if (!o) fail('Seed offering not found'); o.Status = 'VOID'; lg(who, 'VOID SEED OFFERING', r.offeringNo, 'GHS ' + o.Amount); }
  else if (r.action === 'addDeposit') {
    if (!(+r.amount > 0)) fail('Amount must be positive'); if (!String(r.bank || '').trim()) fail('Enter the bank name'); if (!r.receiptB64) fail('Attach the bank receipt (photo or PDF)');
    const no = 'BD-' + String(d.deposits.length + 1).padStart(4, '0'); d.files = d.files || {}; d.files[no] = { name: r.receiptName, mime: r.receiptMime, b64: r.receiptB64 };
    d.deposits.push({ DepositNo: no, Date: r.date, Amount: +r.amount, Bank: String(r.bank).trim(), Reference: r.reference || '', Note: r.note || '', ReceiptName: r.receiptName, ReceiptMime: r.receiptMime, HasReceipt: true, RecordedBy: who }); lg(who, 'ADD BANK DEPOSIT', no, 'GHS ' + r.amount + ' · ' + r.bank);
  }
  else if (r.action === 'getDepositReceipt') { const f = (d.files || {})[r.depositNo]; if (!f) fail('Receipt not found'); return Promise.resolve({ ok: true, ...f }); }
  else if (r.action === 'voidDeposit') { const x = d.deposits.find(y => y.DepositNo === r.depositNo); if (!x) fail('Deposit not found'); x.Status = 'VOID'; lg(who, 'VOID BANK DEPOSIT', r.depositNo, 'GHS ' + x.Amount + (r.reason ? ' · ' + r.reason : '')); }
  else fail('Unknown action');
  demoSave(d);
  const created = r.action === 'addDeposit' ? { DepositNo: last(d.deposits).DepositNo } :r.action === 'addPledge' ? { PledgeID: last(d.pledges).PledgeID } : r.action === 'addPayment' ? { ReceiptNo: last(d.payments).ReceiptNo } : r.action === 'addOffering' ? { OfferingNo: last(d.offerings).OfferingNo } : {};
  return Promise.resolve({ ok: true, created });
}

/* ------------------------------------------------------------ calculations */
const isVoid = x => String(x.Status || '').toUpperCase() === 'VOID' || String(x.Method || '').toUpperCase() === 'VOID';
const valid = () => S.payments.filter(p => !isVoid(p));
function setData(j) { S.pledges = (j.pledges || []).filter(p => String(p.Status || '').toUpperCase() !== 'REMOVED'); S.payments = j.payments || []; S.offerings = (j.offerings || []).filter(o => !isVoid(o)); S.deposits = (j.deposits || []).filter(x => !isVoid(x)); }
// Money position: everything received (pledge payments + seed offerings) against everything banked.
function cash() {
  const byM = {}; const add = (m, a) => { const k = String(m || 'Other'); byM[k] = (byM[k] || 0) + Number(a || 0); };
  valid().forEach(p => add(p.Method, p.Amount)); S.offerings.forEach(o => add(o.Method, o.Amount));
  const received = Object.values(byM).reduce((s, v) => s + v, 0), deposited = S.deposits.reduce((s, x) => s + Number(x.Amount || 0), 0);
  return { byM, received, deposited, left: received - deposited };
}
function model() {
  const by = {}; valid().forEach(p => { (by[p.PledgeID] = by[p.PledgeID] || []).push(p); });
  const rows = S.pledges.map(pl => {
    const ps = (by[pl.PledgeID] || []).sort((a, b) => String(a.ReceiptNo).localeCompare(b.ReceiptNo));
    const paid = ps.reduce((s, p) => s + Number(p.Amount), 0), pledged = Number(pl.Amount) || 0;
    const bal = pledged - paid;
    const months = Math.max(1, parseInt(pl.Months, 10) || 1);
    return { ...pl, pledged, paid, bal, months, monthly: pledged / months, pays: ps, status: paid <= 0 ? 'none' : bal > 0.005 ? 'part' : 'paid' };
  });
  return { rows, T: { pledged: rows.reduce((s, r) => s + r.pledged, 0), received: rows.reduce((s, r) => s + r.paid, 0), out: rows.reduce((s, r) => s + Math.max(0, r.bal), 0), n: rows.length, none: rows.filter(r => r.status === 'none').length, part: rows.filter(r => r.status === 'part').length, paidN: rows.filter(r => r.status === 'paid').length } };
}

/* ------------------------------------------------------------ render */
function render() {
  const { rows, T } = model();
  const pct = T.pledged ? Math.min(100, T.received / T.pledged * 100) : 0;
  const seed = S.offerings.reduce((s, o) => s + Number(o.Amount || 0), 0), raised = T.received + seed;
  $('#kpis').innerHTML = [
    ['g', 'Total raised', money0(raised), 'pledge payments + seed offering'],
    ['', 'Total expected', money0(T.pledged + seed), 'all pledges ' + money0(T.pledged) + ' + seed ' + money0(seed)],
    ['', 'Total pledged', money0(T.pledged), T.n + ' pledgers'],
    ['', 'Pledge payments', money0(T.received), valid().length + ' payments · ' + pct.toFixed(1) + '% of pledges'],
    ['o', 'Seed offering', money0(seed), S.offerings.length + ' entries (not a pledge)'],
    ['r', 'Outstanding pledges', money0(T.out), (T.n - T.paidN) + ' still owing'],
    ['g', 'Deposited in bank', money0(cash().deposited), S.deposits.length + ' deposit' + (S.deposits.length === 1 ? '' : 's') + ' with receipts'],
    [cash().left > 0.005 ? 'o' : 'g', 'Left to deposit', money0(Math.max(0, cash().left)), cash().left < -0.005 ? 'deposits exceed money recorded by ' + money(-cash().left) : 'money received but not yet banked']
  ].map(k => `<div class="kpi ${k[0]}"><div class="l">${k[1]}</div><div class="v">${k[2]}</div><div class="s">${k[3]}</div></div>`).join('');
  $('#progress').style.width = pct + '%';
  $('#pl1').innerHTML = money0(T.received) + ' paid on pledges'; $('#pl2').innerHTML = money0(T.out) + ' outstanding';
  chartWeeks(); statusBlock(T); depPanels();
  const q = $('#q').value.trim().toLowerCase(), f = $('#flt').value;
  const list = rows.filter(r => (!q || (r.Name + ' ' + r.Phone).toLowerCase().includes(q)) && (f === 'all' || (f === 'open' ? r.status !== 'paid' : r.status === f)));
  const lab = { none: 'NOT STARTED', part: 'PART-PAID', paid: 'PAID' };
  const cnt = {}; rows.forEach(r => { const k = 'n:' + r.Name.trim().toLowerCase(); cnt[k] = (cnt[k] || 0) + 1; const p = phoneOf(r.Phone); if (p) cnt['p:' + p] = (cnt['p:' + p] || 0) + 1; });
  const isDup = r => cnt['n:' + r.Name.trim().toLowerCase()] > 1 || (phoneOf(r.Phone) && cnt['p:' + phoneOf(r.Phone)] > 1);
  $('#tbody').innerHTML = list.length ? list.map(r => `<tr class="row" data-id="${esc(r.PledgeID)}"><td><b>${esc(r.Name)}</b>${isDup(r) ? ' <span class="pill part" title="Another pledge has the same name or phone">POSSIBLE DUPLICATE</span>' : ''}<div class="mini"><i style="width:${r.pledged ? Math.min(100, r.paid / r.pledged * 100) : 0}%"></i></div></td><td>${esc(phoneOf(r.Phone)) || '<span style="color:var(--mute)">—</span>'}</td><td class="n">${money(r.pledged)}</td><td style="white-space:nowrap;font-size:13px">${r.months} mo × ${money0(r.monthly)}</td><td class="n">${money(r.paid)}</td><td class="n"><b>${money(Math.max(0, r.bal))}</b></td><td><span class="pill ${r.status}">${lab[r.status]}</span></td></tr>`).join('') : `<tr><td colspan="7" class="empty">No pledgers match.</td></tr>`;
  $('#sbody').innerHTML = S.offerings.length ? S.offerings.slice().reverse().map(o => `<tr><td><b>${esc(o.OfferingNo)}</b></td><td>${esc(String(o.Date).slice(0, 10))}</td><td>${esc(o.Name) || '<span style="color:var(--mute)">Anonymous / congregation</span>'}</td><td>${esc(o.Method)}</td><td class="n">${money(o.Amount)}</td><td class="n" style="white-space:nowrap">${pend(o.OfferingNo) ? '<span style="color:var(--mute)">saving…</span>' : '<button class="btn sm" data-rcp="' + esc(o.OfferingNo) + '">PDF</button>' + (S.role === 'admin' ? ' <button class="btn sm ghost" data-eo="' + esc(o.OfferingNo) + '">Edit</button> <button class="btn sm ghost" data-voido="' + esc(o.OfferingNo) + '">Void</button>' : '')}</td></tr>`).join('') : `<tr><td colspan="6" class="empty">No seed offering recorded yet.</td></tr>`;
  const nm = Object.fromEntries(S.pledges.map(p => [p.PledgeID, p.Name]));
  const rc = valid().slice().sort((a, b) => String(b.ReceiptNo).localeCompare(String(a.ReceiptNo))).slice(0, 15);
  $('#rbody').innerHTML = rc.length ? rc.map(p => `<tr><td><b>${pend(p.ReceiptNo) ? '…' : esc(p.ReceiptNo)}</b></td><td>${esc(String(p.Date).slice(0, 10))}</td><td>${esc(nm[p.PledgeID] || '')}</td><td>${esc(p.Method)}</td><td class="n">${money(p.Amount)}</td><td class="n">${pend(p.ReceiptNo) ? '<span style="color:var(--mute)">saving…</span>' : '<button class="btn sm" data-rcp="' + esc(p.ReceiptNo) + '">PDF</button>'}</td></tr>`).join('') : `<tr><td colspan="6" class="empty">No payments recorded yet.</td></tr>`;
  renderLog();
  document.querySelectorAll('.tonly').forEach(e => e.classList.toggle('hidden', S.role !== 'admin'));
}
const when = ts => { const d = new Date(ts); return isNaN(d) ? String(ts) : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); };
function renderLog() {
  const sel = $('#lu'), cur = sel.value, names = [...new Set((S.log || []).map(l => l.User))].sort();
  sel.innerHTML = '<option value="">Everyone</option>' + names.map(n => '<option>' + esc(n) + '</option>').join(''); sel.value = names.includes(cur) ? cur : '';
  const q = $('#lq').value.trim().toLowerCase();
  const rows = (S.log || []).filter(l => (!sel.value || l.User === sel.value) && (!q || (l.User + ' ' + l.Action + ' ' + l.Target + ' ' + l.Detail).toLowerCase().includes(q)));
  $('#lbody').innerHTML = rows.length ? rows.map(l => `<tr><td style="white-space:nowrap">${esc(when(l.Timestamp))}</td><td><b>${esc(l.User)}</b></td><td style="white-space:nowrap">${esc(l.Action)}</td><td>${esc(l.Target)}</td><td style="font-size:13px;color:var(--mute)">${esc(l.Detail)}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">No activity yet.</td></tr>';
  $('#relbody').innerHTML = (S.releases || []).map(r => `<tr><td><b>v${esc(r.Version)}</b></td><td style="white-space:nowrap">${esc(String(r.Date).slice(0, 10))}</td><td>${esc(r.UpdatedBy)}</td><td style="font-size:13px">${esc(r.Summary)}</td></tr>`).join('');
}
function statusBlock(T) {
  const tot = T.n || 1, seg = [['paid', 'Fully paid', T.paidN, 'var(--green)'], ['part', 'Part-paid', T.part, 'var(--gold)'], ['none', 'Not started', T.none, 'var(--red)']];
  $('#status').innerHTML = `<div style="display:flex;height:26px;border-radius:99px;overflow:hidden;margin-bottom:14px">${seg.map(s => `<i style="flex:${s[2]};background:${s[3]}"></i>`).join('')}</div>` +
    seg.map(s => `<div style="display:flex;align-items:center;gap:10px;margin:8px 0"><i style="width:14px;height:14px;border-radius:4px;background:${s[3]}"></i><span style="flex:1;font-weight:600">${s[1]}</span><b style="font-family:Anton;font-size:20px">${s[2]}</b><span style="color:var(--mute);width:48px;text-align:right">${(s[2] / tot * 100).toFixed(0)}%</span></div>`).join('');
}
function chartWeeks() {
  const ps = valid().concat(S.offerings.map(o => ({ Date: o.Date, Amount: o.Amount }))); if (!ps.length) { $('#chart').innerHTML = '<div class="empty">No payments yet.</div>'; return; }
  const wk = d => { const t = new Date(String(d).slice(0, 10) + 'T00:00:00'); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return t.toISOString().slice(0, 10); };
  const m = {}; ps.forEach(p => { const k = wk(p.Date); m[k] = (m[k] || 0) + Number(p.Amount); });
  const ks = Object.keys(m).sort().slice(-8), mx = Math.max(...ks.map(k => m[k])), W = 520, H = 220, bw = W / ks.length;
  $('#chart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Money received per week">${ks.map((k, i) => { const h = (m[k] / mx) * 150, x = i * bw + bw * .16, w = bw * .68; return `<rect x="${x}" y="${170 - h}" width="${w}" height="${h}" rx="6" fill="#2e86de"/><text x="${x + w / 2}" y="${162 - h}" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor">${Math.round(m[k]).toLocaleString('en-GB')}</text><text x="${x + w / 2}" y="195" text-anchor="middle" font-size="11" fill="var(--mute)">${k.slice(5).split('-').reverse().join('/')}</text>`; }).join('')}<text x="0" y="215" font-size="10" fill="var(--mute)">week starting (dd/mm) · ${C.currency}</text></svg>`;
}

/* ------------------------------------------------------------ dialogs */
const openD = d => d.showModal();
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if ((e.target === d || e.target.hasAttribute('data-close')) && !(d.id === 'dPw' && pwForced)) d.close(); }));
function pledgeDialog(id) {
  const r = model().rows.find(x => x.PledgeID === id); if (!r) return;
  $('#pTitle').textContent = r.Name.toUpperCase();
  const t = S.role === 'admin';
  const allPays = S.payments.filter(p => p.PledgeID === id).sort((x, y) => String(x.ReceiptNo).localeCompare(String(y.ReceiptNo)));
  $('#pBody').innerHTML = `<div class="sum"><div><b>${money0(r.pledged)}</b><span>Pledged</span></div><div><b style="color:var(--green)">${money0(r.paid)}</b><span>Paid</span></div><div><b style="color:var(--red)">${money0(Math.max(0, r.bal))}</b><span>Balance</span></div></div>
  <div style="font-size:13px;color:var(--mute);margin-bottom:8px">${esc(phoneOf(r.Phone)) || 'No phone recorded'} · <b>${r.months} month${r.months > 1 ? 's' : ''}</b> × ${money0(r.monthly)} · ${esc(r.Source)} · ${esc(String(r.Timestamp).slice(0, 10))}${r.Note ? '<br><i>“' + esc(r.Note) + '”</i>' : ''}</div>
  <table class="hist"><thead><tr><th>Receipt</th><th>Date</th><th>Method</th><th class="n">Amount</th><th></th></tr></thead><tbody>${allPays.length ? allPays.map(p => isVoid(p) ? `<tr style="opacity:.55;text-decoration:line-through"><td>${esc(p.ReceiptNo)}</td><td>${esc(String(p.Date).slice(0, 10))}</td><td>${esc(p.Method)}</td><td class="n">${money(p.Amount)}</td><td class="n" style="text-decoration:none"><span class="pill none">VOID</span></td></tr>` : pend(p.ReceiptNo) ? `<tr><td>…</td><td>${esc(String(p.Date).slice(0, 10))}</td><td>${esc(p.Method)}</td><td class="n">${money(p.Amount)}</td><td class="n"><span style="color:var(--mute)">saving…</span></td></tr>` : `<tr><td><b>${esc(p.ReceiptNo)}</b></td><td>${esc(String(p.Date).slice(0, 10))}</td><td>${esc(p.Method)}</td><td class="n">${money(p.Amount)}</td><td class="n" style="white-space:nowrap"><button class="btn sm" data-rcp="${esc(p.ReceiptNo)}">PDF</button> <button class="btn sm ghost" data-wa="${esc(p.ReceiptNo)}">WhatsApp</button>${t ? ' <button class="btn sm ghost" data-voidp="' + esc(p.ReceiptNo) + '">Void</button>' : ''}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">No payments yet.</td></tr>'}</tbody></table>
  ${t ? `<button class="btn gold" style="width:100%;margin-top:14px" data-pay="${esc(r.PledgeID)}" ${r.bal <= 0 ? 'disabled' : ''}>+ Record payment</button>
  <div style="display:flex;gap:10px;margin-top:10px"><button class="btn ghost" style="flex:1" data-edit="${esc(r.PledgeID)}">Edit details</button><button class="btn ghost" style="flex:1;color:var(--red);border-color:var(--red)" data-del="${esc(r.PledgeID)}" ${r.pays.length ? 'disabled title="Void its payments first"' : ''}>Remove pledge</button></div>${r.pays.length ? '<div style="font-size:12px;color:var(--mute);margin-top:6px">To remove this pledge, first void its payments.</div>' : ''}` : ''}`;
  openD($('#dPledge'));
}
function payDialog(id) {
  const r = model().rows.find(x => x.PledgeID === id);
  $('#dPledge').close();
  $('#yTitle').textContent = 'PAYMENT · ' + r.Name.toUpperCase();
  $('#ySum').innerHTML = `<div><b>${money0(r.pledged)}</b><span>Pledged</span></div><div><b>${money0(r.paid)}</b><span>Paid so far</span></div><div><b style="color:var(--red)">${money0(Math.max(0, r.bal))}</b><span>Balance</span></div>`;
  $('#yAmt').value = r.bal > 0 ? (Math.round(r.bal * 100) / 100) : ''; $('#yAmt').removeAttribute('max');
  $('#yDate').value = new Date().toISOString().slice(0, 10); $('#yRef').value = ''; $('#yErr').textContent = '';
  $('#fPay').dataset.id = id; openD($('#dPay'));
}

function confirmAction(title, text, okLabel) {
  return new Promise(res => {
    $('#cTitle').textContent = title; $('#cText').innerHTML = text; $('#cReason').value = ''; $('#cYes').textContent = okLabel || 'Confirm';
    const d = $('#dConfirm'); let done = false;
    const fin = v => { if (done) return; done = true; $('#fConfirm').removeEventListener('submit', onS); $('#cNo').removeEventListener('click', onN); d.removeEventListener('close', onC); if (d.open) d.close(); res(v); };
    const onS = e => { e.preventDefault(); fin($('#cReason').value.trim() || ''); }, onN = () => fin(null), onC = () => fin(null);
    $('#fConfirm').addEventListener('submit', onS); $('#cNo').addEventListener('click', onN); d.addEventListener('close', onC); d.showModal();
  });
}
function applyLocal(req, created) {
  const num = v => Number(v), mo = v => Math.max(1, parseInt(v, 10) || 1);
  if (req.action === 'addPledge') S.pledges.push({ PledgeID: created.PledgeID, Timestamp: new Date().toISOString(), Name: req.name, Phone: req.phone || '', Amount: num(req.amount), Note: req.note || '', Source: 'Manual', Months: mo(req.months) });
  else if (req.action === 'addPayment') S.payments.push({ ReceiptNo: created.ReceiptNo, PledgeID: req.pledgeId, Date: req.date, Amount: num(req.amount), Method: req.method, Reference: req.reference || '', RecordedBy: S.user.name });
  else if (req.action === 'addOffering') S.offerings.push({ OfferingNo: created.OfferingNo, Date: req.date, Name: req.name || '', Amount: num(req.amount), Method: req.method, Note: req.note || '', RecordedBy: S.user.name });
  else if (req.action === 'editPledge') { const p = S.pledges.find(x => x.PledgeID === req.id); if (p) { if (req.name) p.Name = req.name; p.Phone = req.phone ?? p.Phone; if (num(req.amount) > 0) p.Amount = num(req.amount); p.Months = mo(req.months); p.Note = req.note ?? p.Note; } }
  else if (req.action === 'deletePledge') S.pledges = S.pledges.filter(x => x.PledgeID !== req.id);
  else if (req.action === 'voidPayment') { const p = S.payments.find(x => x.ReceiptNo === req.receiptNo); if (p) p.Status = 'VOID'; }
  else if (req.action === 'editOffering') { const o = S.offerings.find(x => x.OfferingNo === req.offeringNo); if (o) { o.Amount = num(req.amount); if (req.name != null) o.Name = req.name; if (req.method) o.Method = req.method; if (req.date) o.Date = req.date; if (req.note != null) o.Note = req.note; } }
  else if (req.action === 'voidOffering') S.offerings = S.offerings.filter(o => o.OfferingNo !== req.offeringNo);
  else if (req.action === 'addDeposit') S.deposits.push({ DepositNo: created.DepositNo, Date: req.date, Amount: num(req.amount), Bank: req.bank, Reference: req.reference || '', Note: req.note || '', ReceiptName: req.receiptName, ReceiptMime: req.receiptMime, HasReceipt: true, RecordedBy: S.user.name });
  else if (req.action === 'voidDeposit') S.deposits = S.deposits.filter(x => x.DepositNo !== req.depositNo);
}
// Everything shows on screen instantly and syncs in the background. Adds get a temporary id until the server assigns the real number.
const pend = id => String(id).startsWith('tmp');
let tmpN = 0;
async function mutate(req, okMsg) {
  const full = { ...req, token: S.token };
  if (req.action.startsWith('add')) {
    const tmp = 'tmp' + (++tmpN);
    applyLocal(req, { PledgeID: tmp, ReceiptNo: tmp, OfferingNo: tmp, DepositNo: tmp }); render(); toast('Saving…');
    try {
      const j = await api(full), c = j.created || {};
      if (req.action === 'addPledge') { const p = S.pledges.find(x => x.PledgeID === tmp); if (p) p.PledgeID = c.PledgeID; S.payments.forEach(y => { if (y.PledgeID === tmp) y.PledgeID = c.PledgeID; }); }
      if (req.action === 'addPayment') { const y = S.payments.find(x => x.ReceiptNo === tmp); if (y) y.ReceiptNo = c.ReceiptNo; }
      if (req.action === 'addOffering') { const o = S.offerings.find(x => x.OfferingNo === tmp); if (o) o.OfferingNo = c.OfferingNo; }
      if (req.action === 'addDeposit') { const x = S.deposits.find(y => y.DepositNo === tmp); if (x) x.DepositNo = c.DepositNo; }
      render(); toast(okMsg); return c;
    } catch (er) {
      S.pledges = S.pledges.filter(x => x.PledgeID !== tmp); S.payments = S.payments.filter(x => x.ReceiptNo !== tmp); S.offerings = S.offerings.filter(x => x.OfferingNo !== tmp); S.deposits = S.deposits.filter(x => x.DepositNo !== tmp);
      render(); throw er;
    }
  }
  const snap = JSON.stringify({ p: S.pledges, y: S.payments, o: S.offerings, d: S.deposits });
  applyLocal(req); render(); toast(okMsg);
  api(full).catch(er => { const s = JSON.parse(snap); S.pledges = s.p; S.payments = s.y; S.offerings = s.o; S.deposits = s.d; render(); toast('Not saved: ' + er.message + ' (change undone)'); });
  return {};
}
function editSeedDialog(no) {
  const o = S.offerings.find(x => x.OfferingNo === no); if (!o) return;
  $('#fSeed').reset(); $('#fSeed').dataset.edit = no; $('#sTitle').textContent = 'EDIT SEED OFFERING ' + no; $('#sBtn').textContent = 'Save changes'; $('#sHelp').classList.add('hidden');
  $('#sAmt').value = o.Amount; $('#sDate').value = String(o.Date).slice(0, 10); $('#sMethod').value = o.Method; $('#sName').value = o.Name || ''; $('#sNote').value = o.Note || ''; $('#sErr').textContent = '';
  openD($('#dSeed'));
}
function editDialog(id) {
  const p = S.pledges.find(x => x.PledgeID === id); $('#dPledge').close();
  $('#eName').value = p.Name; $('#ePhone').value = phoneOf(p.Phone); $('#eAmt').value = p.Amount; $('#eMonths').value = Math.max(1, parseInt(p.Months, 10) || 1); $('#eNote').value = p.Note || ''; $('#eErr').textContent = '';
  $('#fEdit').dataset.id = id; openD($('#dEdit'));
}

/* ------------------------------------------------------------ receipts */
const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function words(n) { if (n < 20) return ones[n]; if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? '-' + ones[n % 10] : ''); if (n < 1000) return ones[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + words(n % 100) : ''); if (n < 1e6) return words(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? (n % 1000 < 100 ? ' and ' : ' ') + words(n % 1000) : ''); return words(Math.floor(n / 1e6)) + ' million' + (n % 1e6 ? ' ' + words(n % 1e6) : ''); }
function amountWords(a) { const c = Math.floor(a), p = Math.round((a - c) * 100); return (words(c) || 'zero').replace(/^./, x => x.toUpperCase()) + ' Ghana cedis' + (p ? ' and ' + words(p) + ' pesewas' : '') + ' only'; }
let logoData = null;
function loadLogo() { return logoData ? Promise.resolve(logoData) : new Promise(res => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 300; c.getContext('2d').drawImage(i, 0, 0, 300, 300); logoData = c.toDataURL('image/png'); res(logoData); }; i.onerror = () => res(null); i.src = 'logo.png'; }); }
function receiptInfo(no) {
  if (String(no).startsWith('SO-')) {
    const o = S.offerings.find(x => x.OfferingNo === no);
    return { seed: true, p: { ReceiptNo: o.OfferingNo, Date: o.Date, Amount: o.Amount, Method: o.Method, Reference: o.Note, RecordedBy: o.RecordedBy }, pl: { Name: o.Name || 'Congregation (seed offering)', Phone: '', Amount: 0 }, paidToDate: 0, balance: 0 };
  }
  const p = S.payments.find(x => x.ReceiptNo === no), pl = S.pledges.find(x => x.PledgeID === p.PledgeID);
  const upTo = valid().filter(x => x.PledgeID === p.PledgeID && String(x.ReceiptNo) <= String(no)).reduce((s, x) => s + Number(x.Amount), 0);
  return { p, pl, paidToDate: upTo, balance: Number(pl.Amount) - upTo };
}
async function receiptPDF(no) {
  const { p, pl, paidToDate, balance, seed } = receiptInfo(no);
  const { jsPDF } = window.jspdf, d = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' });
  const W = 148, royal = [10, 52, 128], gold = [255, 205, 70], ink = [15, 33, 71], mute = [92, 108, 141];
  d.setFillColor(...royal); d.rect(0, 0, W, 38, 'F'); d.setFillColor(...gold); d.rect(0, 38, W, 2.2, 'F');
  const lg = await loadLogo(); if (lg) d.addImage(lg, 'PNG', 8, 6, 26, 26);
  d.setTextColor(255); d.setFont('helvetica', 'bold'); d.setFontSize(13); d.text(C.churchLine1, 40, 15);
  d.setFontSize(8); d.setFont('helvetica', 'normal'); d.text(C.churchLine2, 40, 20.5);
  d.setFillColor(...gold); d.roundedRect(40, 24, 50, 7, 3.5, 3.5, 'F'); d.setTextColor(...royal); d.setFont('helvetica', 'bold'); d.setFontSize(8.5); d.text(C.assembly, 65, 28.8, { align: 'center' });
  d.setTextColor(...ink); d.setFontSize(18); d.text(seed ? 'SEED OFFERING RECEIPT' : 'OFFICIAL RECEIPT', 74, 55, { align: 'center' });
  d.setFontSize(9.5); d.setFont('helvetica', 'normal'); d.setTextColor(...mute); d.text(C.project, 74, 61, { align: 'center' });
  const row = (y, l, v, bold) => { d.setFontSize(8); d.setTextColor(...mute); d.setFont('helvetica', 'bold'); d.text(l.toUpperCase(), 14, y); d.setTextColor(...ink); d.setFontSize(bold ? 11 : 10); d.setFont('helvetica', bold ? 'bold' : 'normal'); d.text(String(v), 62, y); };
  d.setDrawColor(219, 228, 243); d.line(14, 66, W - 14, 66);
  row(75, 'Receipt No.', p.ReceiptNo, true); row(83, 'Date', String(p.Date).slice(0, 10)); row(91, 'Received from', pl.Name, true);
  if (pl.Phone) row(99, 'Phone', phoneOf(pl.Phone));
  row(107, 'Payment method', p.Method + (p.Reference ? '  (' + p.Reference + ')' : ''));
  d.setFillColor(238, 243, 251); d.roundedRect(14, 115, W - 28, 26, 3, 3, 'F');
  d.setFontSize(8); d.setTextColor(...mute); d.setFont('helvetica', 'bold'); d.text('AMOUNT RECEIVED', 20, 122);
  d.setFontSize(20); d.setTextColor(...royal); d.text(money(p.Amount).replace('GH₵', 'GHS'), 20, 132);
  d.setFontSize(8); d.setFont('helvetica', 'italic'); d.setTextColor(...ink); d.text(d.splitTextToSize(amountWords(Number(p.Amount)), W - 40), 20, 138);
  const sy = 152; if (!seed) [['Pledge total', Number(pl.Amount)], ['Paid to date', paidToDate], ['Balance', Math.max(0, balance)]].forEach((x, i) => {
    const cx = 14 + i * ((W - 28) / 3); d.setFontSize(7.5); d.setTextColor(...mute); d.setFont('helvetica', 'bold'); d.text(x[0].toUpperCase(), cx, sy);
    d.setFontSize(11); d.setTextColor(...(i === 2 ? (balance > 0.005 ? [192, 57, 43] : [31, 157, 92]) : ink)); d.text(money(x[1]).replace('GH₵', 'GHS'), cx, sy + 6);
  });
  d.setFontSize(8.5); d.setFont('helvetica', 'bold'); d.setTextColor(...(balance > 0.005 ? [192, 57, 43] : [31, 157, 92])); if (seed) d.text('Seed offering — thank you and God bless you!', 14, 158); else d.text(balance > 0.005 ? 'Part payment — thank you. Balance outstanding.' : 'PLEDGE FULLY PAID — God bless you!', 14, 170);
  d.setDrawColor(...ink); d.line(14, 190, 66, 190); d.setFontSize(8); d.setTextColor(...mute); d.setFont('helvetica', 'normal'); d.text('Received by: ' + (p.RecordedBy || '—'), 14, 194.5);
  d.setFont('helvetica', 'italic'); d.setFontSize(8.5); d.text('"For all things come from You, and of Your own have we given You." — 1 Chronicles 29:14', 74, 202, { align: 'center', maxWidth: W - 24 });
  d.setFillColor(...royal); d.rect(0, 205 - 1.2, W, 1.2, 'F');
  return d;
}
async function downloadReceipt(no) { const { p, pl } = receiptInfo(no); const d = await receiptPDF(no); d.save(`${no}_${pl.Name.replace(/[^A-Za-z0-9]+/g, '_')}.pdf`); toast('Receipt ' + no + ' downloaded'); }
function waLink(no) {
  const { p, pl, paidToDate, balance, seed } = receiptInfo(no); let ph = phoneOf(pl.Phone).replace(/\D/g, '');
  if (ph.startsWith('0')) ph = '233' + ph.slice(1);
  const msg = seed ? `Thank you for your seed offering of ${money(p.Amount)} towards the building project (Receipt ${no}). God bless you richly!` : `Dear ${pl.Name}, thank you for your payment of ${money(p.Amount)} towards the ${C.assembly.toLowerCase().replace(/(^|\s)\S/g, x => x.toUpperCase())} building project (Receipt ${no}, ${String(p.Date).slice(0, 10)}). ` + (balance > 0.005 ? `Pledge ${money(pl.Amount)} · paid to date ${money(paidToDate)} · balance ${money(balance)}.` : 'Your pledge is now fully paid. God bless you richly!') + ' Your receipt is attached.';
  return 'https://wa.me/' + ph + '?text=' + encodeURIComponent(msg);
}

/* ------------------------------------------------------------ events */
function toast(t) { const e = document.createElement('div'); e.className = 'toast'; e.textContent = t; document.body.append(e); setTimeout(() => e.remove(), 2800); }
async function load() { const j = await api({ action: 'load', token: S.token }); S.user = j.me; S.role = 'admin'; setData(j); S.log = j.log || []; S.releases = j.releases || []; S.users = j.users || []; render(); }
async function showApp() {
  await load();
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
  $('#roleBadge').textContent = S.user.name.toUpperCase() + (S.user.it ? ' · IT SPECIALIST' : '');
  $('#hdrSub').textContent = C.assembly + ' · ' + C.project; $('#demoBanner').classList.toggle('hidden', !DEMO);
  document.querySelectorAll('.itonly').forEach(e => e.classList.toggle('hidden', !S.user.it));
}
$('#demoHint').classList.toggle('hidden', !DEMO);
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault(); $('#loginErr').textContent = ''; $('#loginBtn').disabled = true; $('#loginBtn').textContent = 'Checking…';
  try {
    const j = await api({ action: 'login', username: $('#uname').value.trim(), password: $('#code').value });
    S.token = j.token; S.user = j.user; store.set('token', j.token); $('#code').value = '';
    if (j.user.mustChange) openPw(true); else await showApp();
  } catch (er) { $('#loginErr').textContent = er.message; }
  $('#loginBtn').disabled = false; $('#loginBtn').textContent = 'Sign in';
});
$('#logout').onclick = () => { const t = S.token; store.del('token'); (t ? api({ action: 'logout', token: t }).catch(() => {}) : Promise.resolve()).finally(() => location.reload()); };

/* ---- passwords ---- */
let pwForced = false;
function openPw(force) {
  pwForced = !!force; $('#fPw').reset(); $('#pwErr').textContent = '';
  $('#pwTitle').textContent = force ? 'SET YOUR OWN PASSWORD' : 'CHANGE PASSWORD'; $('#pwX').classList.toggle('hidden', !!force);
  $('#pwHelp').textContent = force ? 'Welcome, ' + S.user.name + '. For security, replace the temporary password with your own (at least 8 characters). Only you should know it.' : 'Use at least 8 characters. Only you should know it.';
  $('#pwOld').placeholder = force ? 'The temporary password you were given' : '';
  openD($('#dPw'));
}
$('#dPw').addEventListener('cancel', e => { if (pwForced) e.preventDefault(); });
$('#chgPw').onclick = () => openPw(false);
$('#fPw').addEventListener('submit', async e => {
  e.preventDefault(); const o = $('#pwOld').value, n = $('#pwNew').value;
  if (!ok('#pwErr', [[o, 'Enter your current password.', '#pwOld'], [n.length >= 8, 'The new password must be at least 8 characters.', '#pwNew'], [n === $('#pwNew2').value, 'The two new passwords do not match.', '#pwNew2'], [n !== o, 'Choose a password different from the old one.', '#pwNew']])) return;
  const btn = $('#pwBtn'); btn.disabled = true;
  try { await api({ action: 'changePassword', token: S.token, oldPassword: o, newPassword: n }); const wasForced = pwForced; pwForced = false; $('#dPw').close(); toast('Password changed'); if (wasForced) await showApp(); else load().catch(() => {}); }
  catch (er) { $('#pwErr').textContent = er.message; }
  btn.disabled = false;
});
$('#resetPw').onclick = () => { $('#rUser').innerHTML = (S.users || []).filter(u => u.u !== S.user.u).map(u => '<option value="' + esc(u.u) + '">' + esc(u.name) + '</option>').join(''); $('#rOut').classList.add('hidden'); $('#rErr').textContent = ''; $('#rBtn').textContent = 'Issue temporary password'; openD($('#dReset')); };
$('#fReset').addEventListener('submit', async e => {
  e.preventDefault(); const btn = $('#rBtn'); btn.disabled = true; $('#rErr').textContent = '';
  try { const j = await api({ action: 'resetPassword', token: S.token, username: $('#rUser').value }); $('#rPw').textContent = j.tempPassword; $('#rOut').classList.remove('hidden'); btn.textContent = 'Issue another'; load().catch(() => {}); }
  catch (er) { $('#rErr').textContent = er.message; }
  btn.disabled = false;
});
$('#lu').onchange = $('#lq').oninput = renderLog;
$('#refresh').onclick = async () => { try { await load(); toast('Updated'); } catch (e) { toast(e.message); } };
$('#q').oninput = $('#flt').onchange = render;
$('#print').onclick = () => print();
$('#csv').onclick = () => {
  const lines = [['Name', 'Phone', 'Pledged', 'Months', 'Monthly', 'Paid', 'Balance', 'Status']].concat(model().rows.map(r => [r.Name, phoneOf(r.Phone), r.pledged, r.months, r.monthly.toFixed(2), r.paid, Math.max(0, r.bal), r.status]));
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.map(l => l.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\n')], { type: 'text/csv' })); a.download = 'pledges.csv'; a.click();
};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-rcp],[data-wa],[data-pay],[data-edit],[data-del],[data-voidp],[data-voido],[data-eo],[data-vdep],[data-voidd],tr.row'); if (!t) return;
  if (t.dataset.vdep) return viewDepositReceipt(t.dataset.vdep);
  if (t.dataset.voidd) { const x = S.deposits.find(y => y.DepositNo === t.dataset.voidd); return confirmAction('VOID BANK DEPOSIT', 'Void deposit <b>' + esc(x.DepositNo) + '</b> (' + money(x.Amount) + ', ' + esc(x.Bank) + ')? The amount goes back into "left to deposit". The row and its receipt file stay on record marked VOID. Record the correct deposit afterwards if needed.', 'Void deposit').then(r => { if (r !== null) mutate({ action: 'voidDeposit', depositNo: x.DepositNo, reason: r }, x.DepositNo + ' voided').catch(er => toast(er.message)); }); }
  if (t.dataset.eo) return editSeedDialog(t.dataset.eo);
  if (t.dataset.edit) return editDialog(t.dataset.edit);
  if (t.dataset.del) { const p = S.pledges.find(x => x.PledgeID === t.dataset.del); $('#dPledge').close(); return confirmAction('REMOVE PLEDGE', 'Remove the pledge of <b>' + esc(p.Name) + '</b> (' + money(p.Amount) + ')? It disappears from the totals. The row stays in the Sheet marked REMOVED.', 'Remove').then(r => { if (r !== null) mutate({ action: 'deletePledge', id: p.PledgeID, reason: r }, 'Pledge removed').catch(er => toast(er.message)); }); }
  if (t.dataset.voidp) { const p = S.payments.find(x => x.ReceiptNo === t.dataset.voidp); $('#dPledge').close(); return confirmAction('VOID PAYMENT', 'Void receipt <b>' + esc(p.ReceiptNo) + '</b> (' + money(p.Amount) + ')? The amount is taken out of the totals and the pledge balance goes back up. The receipt stays in the Sheet marked VOID. Record the correct payment afterwards if needed.', 'Void payment').then(r => { if (r !== null) mutate({ action: 'voidPayment', receiptNo: p.ReceiptNo, reason: r }, 'Receipt ' + p.ReceiptNo + ' voided').catch(er => toast(er.message)); }); }
  if (t.dataset.voido) { const o = S.offerings.find(x => x.OfferingNo === t.dataset.voido); return confirmAction('VOID SEED OFFERING', 'Void <b>' + esc(o.OfferingNo) + '</b> (' + money(o.Amount) + ')? It is taken out of the total raised. The row stays in the Sheet marked VOID.', 'Void entry').then(r => { if (r !== null) mutate({ action: 'voidOffering', offeringNo: o.OfferingNo, reason: r }, o.OfferingNo + ' voided').catch(er => toast(er.message)); }); }
  if (t.dataset.rcp) return downloadReceipt(t.dataset.rcp);
  if (t.dataset.wa) { window.open(waLink(t.dataset.wa), '_blank'); toast('Download the PDF too and attach it in WhatsApp'); return; }
  if (t.dataset.pay) return payDialog(t.dataset.pay);
  if (t.classList.contains('row')) { if (pend(t.dataset.id)) return toast('Still saving this pledge, one moment…'); pledgeDialog(t.dataset.id); }
});
$('#fEdit').addEventListener('submit', e => {
  e.preventDefault(); const id = e.target.dataset.id;
  if (!ok('#eErr', [[$('#eName').value.trim(), 'Enter the name.', '#eName'], [pos('#eAmt'), 'Enter a pledge amount greater than 0.', '#eAmt'], [months('#eMonths'), 'Instalment months must be a whole number from 1 to 24.', '#eMonths']])) return;
  $('#dEdit').close();
  mutate({ action: 'editPledge', id, name: $('#eName').value.trim(), phone: $('#ePhone').value.trim(), amount: $('#eAmt').value, months: $('#eMonths').value, note: $('#eNote').value.trim() }, 'Pledge updated');
});
const failed = er => toast('Not saved: ' + er.message);
// Shows a clear message under the form instead of a silent browser tooltip. Returns true when everything is fine.
function ok(errSel, checks) {
  for (const [good, msg, sel] of checks) if (!good) { $(errSel).textContent = msg; if (sel) $(sel).focus(); return false; }
  $(errSel).textContent = ''; return true;
}
const pos = sel => Number($(sel).value) > 0, months = sel => { const n = Number($(sel).value); return Number.isInteger(n) && n >= 1 && n <= 24; };
$('#addSeed').onclick = () => { $('#fSeed').reset(); delete $('#fSeed').dataset.edit; $('#sTitle').textContent = 'SEED CASH OFFERING'; $('#sBtn').textContent = 'Save & create receipt'; $('#sHelp').classList.remove('hidden'); $('#sDate').value = new Date().toISOString().slice(0, 10); $('#sErr').textContent = ''; openD($('#dSeed')); };
$('#fSeed').addEventListener('submit', e => {
  e.preventDefault();
  if (!ok('#sErr', [[pos('#sAmt'), 'Enter the amount (greater than 0).', '#sAmt'], [$('#sDate').value, 'Choose the date.', '#sDate']])) return;
  $('#dSeed').close();
  const editNo = e.target.dataset.edit;
  if (editNo) { mutate({ action: 'editOffering', offeringNo: editNo, name: $('#sName').value.trim(), amount: $('#sAmt').value, date: $('#sDate').value, method: $('#sMethod').value, note: $('#sNote').value.trim() }, editNo + ' updated'); return; }
  mutate({ action: 'addOffering', name: $('#sName').value.trim(), amount: $('#sAmt').value, date: $('#sDate').value, method: $('#sMethod').value, note: $('#sNote').value.trim() }, 'Seed offering recorded')
    .then(c => { if (c.OfferingNo) downloadReceipt(c.OfferingNo); }).catch(failed);
});
/* ------------------------------------------------------------ bank deposits */
function depPanels() {
  const c = cash();
  $('#depSummary').innerHTML = 'Received <b>' + money(c.received) + '</b> · Deposited <b>' + money(c.deposited) + '</b> · Left to deposit <b style="color:' + (c.left > 0.005 ? 'var(--red)' : 'var(--green)') + '">' + money(Math.max(0, c.left)) + '</b>' + (c.left < -0.005 ? ' <span class="pill part">DEPOSITS EXCEED RECORDED MONEY BY ' + money(-c.left) + '</span>' : '');
  const sum = (a, b, d) => `<div><b>${a}</b><span>${b}</span></div>`;
  $('#ddSum').innerHTML = sum(money0(c.deposited), 'Deposited') + sum(S.deposits.length, 'Deposits') + sum(money0(Math.max(0, c.left)), 'Left to deposit');
  const rows = S.deposits.slice().sort((a, b) => String(b.DepositNo).localeCompare(String(a.DepositNo)));
  $('#ddBody').innerHTML = rows.length ? rows.map(x => `<tr><td><b>${pend(x.DepositNo) ? '…' : esc(x.DepositNo)}</b></td><td>${esc(String(x.Date).slice(0, 10))}</td><td>${esc(x.Bank)}${x.Note ? '<div class="mini" style="height:auto;background:none;color:var(--mute);font-size:11px">' + esc(x.Note) + '</div>' : ''}</td><td>${esc(x.Reference) || '<span style="color:var(--mute)">—</span>'}</td><td class="n">${money(x.Amount)}</td><td class="n" style="white-space:nowrap">${pend(x.DepositNo) ? '<span style="color:var(--mute)">saving…</span>' : (x.HasReceipt ? '<button class="btn sm" data-vdep="' + esc(x.DepositNo) + '">View receipt</button>' : '<span class="pill none">NO RECEIPT</span>') + ' <button class="btn sm ghost" data-voidd="' + esc(x.DepositNo) + '">Void</button>'}</td></tr>`).join('') : '<tr><td colspan="6" class="empty">No bank deposit recorded yet.</td></tr>';
  $('#dlSum').innerHTML = sum(money0(c.received), 'Received') + sum(money0(c.deposited), 'Deposited') + sum(money0(Math.max(0, c.left)), 'Left to deposit');
  const meth = Object.entries(c.byM).sort((a, b) => b[1] - a[1]);
  $('#dlBody').innerHTML = '<div style="font-size:13px;color:var(--mute);margin-bottom:8px">Received = pledge payments + seed offerings (voided entries excluded), minus every bank deposit recorded.</div><table><thead><tr><th>Received by method</th><th class="n">Amount</th></tr></thead><tbody>' + (meth.length ? meth.map(([m, v]) => `<tr><td>${esc(m)}</td><td class="n">${money(v)}</td></tr>`).join('') : '<tr><td colspan="2" class="empty">Nothing received yet.</td></tr>') + `<tr><td><b>Total received</b></td><td class="n"><b>${money(c.received)}</b></td></tr><tr><td>Less: deposited in bank</td><td class="n">− ${money(c.deposited)}</td></tr><tr><td><b>Left to deposit</b></td><td class="n"><b style="color:${c.left > 0.005 ? 'var(--red)' : 'var(--green)'}">${money(c.left)}</b></td></tr></tbody></table>` + (c.left < -0.005 ? '<div class="err">Deposits are higher than the money recorded. Check for a missing payment or a wrong deposit amount.</div>' : '');
}
$('#btnDeposited').onclick = () => { depPanels(); openD($('#dDeposited')); };
$('#btnLeft').onclick = () => { depPanels(); openD($('#dLeft')); };
let depFile = null;
$('#btnDeposit').onclick = () => {
  $('#fDeposit').reset(); depFile = null; $('#dpErr').textContent = ''; $('#dpFileInfo').textContent = ''; $('#dpDate').value = new Date().toISOString().slice(0, 10);
  const c = cash(); $('#dpHelp').innerHTML = 'Left to deposit now: <b>' + money(Math.max(0, c.left)) + '</b>. Enter what was actually paid in and attach the bank receipt.';
  openD($('#dDeposit'));
};
const b64of = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(new Error('Could not read the file')); r.readAsDataURL(blob); });
async function prepReceipt(f) {
  if (f.type === 'application/pdf') { if (f.size > 2.2 * 1048576) throw new Error('PDF is too large (limit about 2 MB). Take a photo of the receipt instead.'); return { b64: await b64of(f), mime: 'application/pdf', name: f.name, size: f.size }; }
  if (!/^image\//.test(f.type)) throw new Error('Attach a photo (JPG/PNG) or a PDF of the bank receipt.');
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('This photo format cannot be read here. Use JPG or PNG, or a PDF.')); i.src = url; });
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight)), cv = document.createElement('canvas');
    cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.82));
    return { b64: await b64of(blob), mime: 'image/jpeg', name: f.name.replace(/\.[^.]+$/, '') + '.jpg', size: blob.size };
  } finally { URL.revokeObjectURL(url); }
}
$('#dpFile').addEventListener('change', async () => {
  const f = $('#dpFile').files[0]; depFile = null; $('#dpFileInfo').textContent = '';
  if (!f) return;
  $('#dpFileInfo').textContent = 'Preparing…';
  try { depFile = await prepReceipt(f); $('#dpFileInfo').textContent = '✓ ' + depFile.name + ' · ' + Math.round(depFile.size / 1024) + ' KB ready'; }
  catch (er) { $('#dpFileInfo').textContent = ''; $('#dpErr').textContent = er.message; $('#dpFile').value = ''; }
});
$('#fDeposit').addEventListener('submit', e => {
  e.preventDefault();
  if (!ok('#dpErr', [[pos('#dpAmt'), 'Enter the amount deposited (greater than 0).', '#dpAmt'], [$('#dpDate').value, 'Choose the date of the deposit.', '#dpDate'], [$('#dpBank').value.trim(), 'Enter the bank name.', '#dpBank'], [depFile, 'Attach the bank receipt (photo or PDF).', '#dpFile']])) return;
  const f = depFile; $('#dDeposit').close();
  mutate({ action: 'addDeposit', amount: $('#dpAmt').value, date: $('#dpDate').value, bank: $('#dpBank').value.trim(), reference: $('#dpRef').value.trim(), note: $('#dpNote').value.trim(), receiptB64: f.b64, receiptMime: f.mime, receiptName: f.name }, 'Deposit recorded').catch(failed);
});
async function viewDepositReceipt(no) {
  const w = window.open('', '_blank'); toast('Opening receipt…');
  try {
    const j = await api({ action: 'getDepositReceipt', token: S.token, depositNo: no });
    const bin = atob(j.b64), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    const u = URL.createObjectURL(new Blob([a], { type: j.mime }));
    if (w) w.location = u; else window.open(u, '_blank');
    setTimeout(() => URL.revokeObjectURL(u), 120000);
  } catch (er) { if (w) w.close(); toast('Could not open: ' + er.message); }
}
$('#addPledge').onclick = () => { $('#fAdd').reset(); $('#aErr').textContent = ''; openD($('#dAdd')); };
$('#fAdd').addEventListener('submit', e => {
  e.preventDefault();
  if (!ok('#aErr', [[$('#aName').value.trim(), 'Enter the name.', '#aName'], [pos('#aAmt'), 'Enter a pledge amount greater than 0.', '#aAmt'], [months('#aMonths'), 'Instalment months must be a whole number from 1 to 24.', '#aMonths']])) return;
  $('#dAdd').close();
  mutate({ action: 'addPledge', name: $('#aName').value.trim(), phone: $('#aPhone').value.trim(), amount: $('#aAmt').value, months: $('#aMonths').value, note: $('#aNote').value.trim() }, 'Pledge saved').catch(failed);
});
$('#fPay').addEventListener('submit', e => {
  e.preventDefault(); const id = e.target.dataset.id;
  if (!ok('#yErr', [[pos('#yAmt'), 'Enter the amount received (greater than 0).', '#yAmt'], [$('#yDate').value, 'Choose the payment date.', '#yDate']])) return;
  const row = model().rows.find(x => x.PledgeID === id); if (row && Number($('#yAmt').value) > row.bal + 0.005) toast('Note: this is more than the balance of ' + money(Math.max(0, row.bal)));
  $('#dPay').close();
  const p = mutate({ action: 'addPayment', pledgeId: id, amount: $('#yAmt').value, date: $('#yDate').value, method: $('#yMethod').value, reference: $('#yRef').value.trim() }, 'Payment recorded');
  pledgeDialog(id);
  p.then(c => { if ($('#dPledge').open) pledgeDialog(id); if (c.ReceiptNo) downloadReceipt(c.ReceiptNo); }).catch(er => { failed(er); if ($('#dPledge').open) pledgeDialog(id); });
});
const saved = store.get('token'); if (saved) { S.token = saved; showApp().catch(() => store.del('token')); }
})();

/* live date & time */
(function () {
  const el = document.getElementById('clock'); if (!el) return;
  const tick = () => { const d = new Date(); el.innerHTML = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) + '<br>' + d.toLocaleTimeString('en-GB'); };
  tick(); setInterval(tick, 1000);
})();
