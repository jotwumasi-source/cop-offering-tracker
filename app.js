(() => {
const C = window.TRACKER_CONFIG, DEMO = !C.apiUrl;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => C.currency + ' ' + Number(n || 0).toLocaleString('en-GB', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const money0 = n => '<span class="cur">' + C.currency + '</span> ' + Math.round(Number(n || 0)).toLocaleString('en-GB');
const store = { get(k) { try { return sessionStorage.getItem(k); } catch { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch {} }, del(k) { try { sessionStorage.removeItem(k); } catch {} } };
let S = { role: null, code: null, pledges: [], payments: [], offerings: [] };
const phoneOf = p => { const d = String(p ?? '').replace(/[^0-9+]/g, ''); return d.length === 9 && !d.startsWith('+') ? '0' + d : d; };

/* ------------------------------------------------------------ data layer */
const DKEY = 'cop_tracker_demo_v1';
function demoSeed() {
  const names = ['Akosua Mensah','Kwame Boateng','Efua Owusu','Yaw Asante','Abena Darko','Kofi Annan Jr','Ama Serwaa','Nana Yaw Sarpong','Esi Quaye','Kojo Antwi','Adwoa Frimpong','Samuel Tetteh','Grace Ofori','Daniel Acheampong'];
  const amts = [2000,1500,500,1000,3000,800,600,2500,400,1200,750,5000,300,1000];
  const pledges = names.map((n, i) => ({ PledgeID: 'P' + String(i + 1).padStart(4, '0'), Timestamp: new Date(Date.now() - (14 - i) * 864e5).toISOString(), Name: n, Phone: '024' + String(1000000 + i * 91357).slice(0, 7), Amount: amts[i], Note: '', Source: i % 3 ? 'Form' : 'Manual', Months: [3, 6, 1, 4, 6, 2, 3, 6, 1, 4, 3, 6, 2, 4][i] }));
  const pay = []; let k = 0;
  const add = (pi, frac, daysAgo, m) => { k++; pay.push({ ReceiptNo: 'RCP-' + String(k).padStart(4, '0'), PledgeID: pledges[pi].PledgeID, Date: new Date(Date.now() - daysAgo * 864e5).toISOString().slice(0, 10), Amount: Math.round(pledges[pi].Amount * frac), Method: m, Reference: '', RecordedBy: 'Financial Secretary' }); };
  add(0, 1, 12, 'MoMo'); add(1, .5, 11, 'Cash'); add(2, 1, 10, 'Cash'); add(3, .4, 9, 'MoMo'); add(4, .3, 8, 'Bank transfer'); add(5, 1, 7, 'MoMo'); add(1, .25, 5, 'MoMo'); add(7, .6, 4, 'Cash'); add(3, .3, 3, 'MoMo'); add(9, .5, 2, 'MoMo'); add(11, .2, 1, 'Cash'); add(4, .3, 1, 'MoMo');
  const offerings = [{ OfferingNo: 'SO-0001', Date: new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10), Name: '', Amount: 650, Method: 'Cash', Note: 'Sunday seed offering' }, { OfferingNo: 'SO-0002', Date: new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10), Name: 'Nana Yaw Sarpong', Amount: 300, Method: 'MoMo', Note: '' }];
  return { pledges, payments: pay, offerings };
}
const demoLoad = () => { try { const j = localStorage.getItem(DKEY); if (j) { const d = JSON.parse(j); if (!d.offerings) { d.offerings = demoSeed().offerings; demoSave(d); } return d; } } catch {} const d = demoSeed(); demoSave(d); return d; };
const demoSave = d => { try { localStorage.setItem(DKEY, JSON.stringify(d)); } catch {} };

async function api(req) {
  if (DEMO) { const lag = Number(new URLSearchParams(location.search).get('lag')) || 0; if (lag) await new Promise(r => setTimeout(r, lag)); return demoApi(req); }
  const r = await fetch(C.apiUrl, { method: 'POST', body: JSON.stringify(req) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'Request failed');
  return j;
}
function demoApi(r) {
  const role = r.code === 'finsec' ? 'finsec' : r.code === 'view' ? 'viewer' : null;
  if (!role) throw new Error('Invalid passcode');
  const d = demoLoad();
  if (r.action !== 'load') {
    if (role !== 'finsec') throw new Error('Financial Secretary access required');
    if (r.action === 'addPledge') d.pledges.push({ PledgeID: 'P' + String(d.pledges.length + 1).padStart(4, '0'), Timestamp: new Date().toISOString(), Name: r.name, Phone: r.phone || '', Amount: +r.amount, Note: r.note || '', Source: 'Manual', Months: Math.max(1, parseInt(r.months, 10) || 1) });
    if (r.action === 'addPayment') d.payments.push({ ReceiptNo: 'RCP-' + String(d.payments.length + 1).padStart(4, '0'), PledgeID: r.pledgeId, Date: r.date, Amount: +r.amount, Method: r.method, Reference: r.reference || '', RecordedBy: 'Financial Secretary' });
    if (r.action === 'addOffering') d.offerings.push({ OfferingNo: 'SO-' + String(d.offerings.length + 1).padStart(4, '0'), Date: r.date, Name: r.name || '', Amount: +r.amount, Method: r.method, Note: r.note || '' });
    if (r.action === 'editPledge') { const p = d.pledges.find(x => x.PledgeID === r.id); if (!p) throw new Error('Pledge not found'); if (r.name != null && String(r.name).trim()) p.Name = String(r.name).trim(); if (r.phone != null) p.Phone = String(r.phone); if (+r.amount > 0) p.Amount = +r.amount; if (parseInt(r.months, 10) > 0) p.Months = parseInt(r.months, 10); if (r.note != null) p.Note = String(r.note); }
    if (r.action === 'deletePledge') { const p = d.pledges.find(x => x.PledgeID === r.id); if (!p) throw new Error('Pledge not found'); if (d.payments.some(x => x.PledgeID === r.id && !isVoid(x))) throw new Error('This pledge has payments. Void them first.'); p.Status = 'REMOVED'; }
    if (r.action === 'voidPayment') { const p = d.payments.find(x => x.ReceiptNo === r.receiptNo); if (!p) throw new Error('Receipt not found'); p.Status = 'VOID'; }
    if (r.action === 'editOffering') { const o = d.offerings.find(x => x.OfferingNo === r.offeringNo); if (!o) throw new Error('Seed offering not found'); if (!(+r.amount > 0)) throw new Error('Amount must be positive'); o.Amount = +r.amount; if (r.name != null) o.Name = r.name; if (r.method) o.Method = r.method; if (r.date) o.Date = r.date; if (r.note != null) o.Note = r.note; }
    if (r.action === 'voidOffering') { const o = d.offerings.find(x => x.OfferingNo === r.offeringNo); if (!o) throw new Error('Seed offering not found'); o.Status = 'VOID'; }
    demoSave(d);
  }
  if (r.action === 'load') return Promise.resolve({ ok: true, role, pledges: d.pledges, payments: d.payments, offerings: d.offerings });
  const last = arr => arr[arr.length - 1];
  const created = r.action === 'addPledge' ? { PledgeID: last(d.pledges).PledgeID } : r.action === 'addPayment' ? { ReceiptNo: last(d.payments).ReceiptNo } : r.action === 'addOffering' ? { OfferingNo: last(d.offerings).OfferingNo } : {};
  return Promise.resolve({ ok: true, role, created });
}

/* ------------------------------------------------------------ calculations */
const isVoid = x => String(x.Status || '').toUpperCase() === 'VOID' || String(x.Method || '').toUpperCase() === 'VOID';
const valid = () => S.payments.filter(p => !isVoid(p));
function setData(j) { S.pledges = (j.pledges || []).filter(p => String(p.Status || '').toUpperCase() !== 'REMOVED'); S.payments = j.payments || []; S.offerings = (j.offerings || []).filter(o => !isVoid(o)); }
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
    ['', 'Total pledged', money0(T.pledged), T.n + ' pledgers'],
    ['', 'Pledge payments', money0(T.received), valid().length + ' payments · ' + pct.toFixed(1) + '% of pledges'],
    ['o', 'Seed offering', money0(seed), S.offerings.length + ' entries (not a pledge)'],
    ['r', 'Outstanding pledges', money0(T.out), (T.n - T.paidN) + ' still owing']
  ].map(k => `<div class="kpi ${k[0]}"><div class="l">${k[1]}</div><div class="v">${k[2]}</div><div class="s">${k[3]}</div></div>`).join('');
  $('#progress').style.width = pct + '%';
  $('#pl1').innerHTML = money0(T.received) + ' paid on pledges'; $('#pl2').innerHTML = money0(T.out) + ' outstanding';
  chartWeeks(); statusBlock(T);
  const q = $('#q').value.trim().toLowerCase(), f = $('#flt').value;
  const list = rows.filter(r => (!q || (r.Name + ' ' + r.Phone).toLowerCase().includes(q)) && (f === 'all' || (f === 'open' ? r.status !== 'paid' : r.status === f)));
  const lab = { none: 'NOT STARTED', part: 'PART-PAID', paid: 'PAID' };
  const cnt = {}; rows.forEach(r => { const k = 'n:' + r.Name.trim().toLowerCase(); cnt[k] = (cnt[k] || 0) + 1; const p = phoneOf(r.Phone); if (p) cnt['p:' + p] = (cnt['p:' + p] || 0) + 1; });
  const isDup = r => cnt['n:' + r.Name.trim().toLowerCase()] > 1 || (phoneOf(r.Phone) && cnt['p:' + phoneOf(r.Phone)] > 1);
  $('#tbody').innerHTML = list.length ? list.map(r => `<tr class="row" data-id="${esc(r.PledgeID)}"><td><b>${esc(r.Name)}</b>${isDup(r) ? ' <span class="pill part" title="Another pledge has the same name or phone">POSSIBLE DUPLICATE</span>' : ''}<div class="mini"><i style="width:${r.pledged ? Math.min(100, r.paid / r.pledged * 100) : 0}%"></i></div></td><td>${esc(phoneOf(r.Phone)) || '<span style="color:var(--mute)">—</span>'}</td><td class="n">${money(r.pledged)}</td><td style="white-space:nowrap;font-size:13px">${r.months} mo × ${money0(r.monthly)}</td><td class="n">${money(r.paid)}</td><td class="n"><b>${money(Math.max(0, r.bal))}</b></td><td><span class="pill ${r.status}">${lab[r.status]}</span></td></tr>`).join('') : `<tr><td colspan="7" class="empty">No pledgers match.</td></tr>`;
  $('#sbody').innerHTML = S.offerings.length ? S.offerings.slice().reverse().map(o => `<tr><td><b>${esc(o.OfferingNo)}</b></td><td>${esc(String(o.Date).slice(0, 10))}</td><td>${esc(o.Name) || '<span style="color:var(--mute)">Anonymous / congregation</span>'}</td><td>${esc(o.Method)}</td><td class="n">${money(o.Amount)}</td><td class="n" style="white-space:nowrap">${pend(o.OfferingNo) ? '<span style="color:var(--mute)">saving…</span>' : '<button class="btn sm" data-rcp="' + esc(o.OfferingNo) + '">PDF</button>' + (S.role === 'finsec' ? ' <button class="btn sm ghost" data-eo="' + esc(o.OfferingNo) + '">Edit</button> <button class="btn sm ghost" data-voido="' + esc(o.OfferingNo) + '">Void</button>' : '')}</td></tr>`).join('') : `<tr><td colspan="6" class="empty">No seed offering recorded yet.</td></tr>`;
  const nm = Object.fromEntries(S.pledges.map(p => [p.PledgeID, p.Name]));
  const rc = valid().slice().sort((a, b) => String(b.ReceiptNo).localeCompare(String(a.ReceiptNo))).slice(0, 15);
  $('#rbody').innerHTML = rc.length ? rc.map(p => `<tr><td><b>${pend(p.ReceiptNo) ? '…' : esc(p.ReceiptNo)}</b></td><td>${esc(String(p.Date).slice(0, 10))}</td><td>${esc(nm[p.PledgeID] || '')}</td><td>${esc(p.Method)}</td><td class="n">${money(p.Amount)}</td><td class="n">${pend(p.ReceiptNo) ? '<span style="color:var(--mute)">saving…</span>' : '<button class="btn sm" data-rcp="' + esc(p.ReceiptNo) + '">PDF</button>'}</td></tr>`).join('') : `<tr><td colspan="6" class="empty">No payments recorded yet.</td></tr>`;
  document.querySelectorAll('.tonly').forEach(e => e.classList.toggle('hidden', S.role !== 'finsec'));
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
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d || e.target.hasAttribute('data-close')) d.close(); }));
function pledgeDialog(id) {
  const r = model().rows.find(x => x.PledgeID === id); if (!r) return;
  $('#pTitle').textContent = r.Name.toUpperCase();
  const t = S.role === 'finsec';
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
  else if (req.action === 'addPayment') S.payments.push({ ReceiptNo: created.ReceiptNo, PledgeID: req.pledgeId, Date: req.date, Amount: num(req.amount), Method: req.method, Reference: req.reference || '', RecordedBy: 'Financial Secretary' });
  else if (req.action === 'addOffering') S.offerings.push({ OfferingNo: created.OfferingNo, Date: req.date, Name: req.name || '', Amount: num(req.amount), Method: req.method, Note: req.note || '' });
  else if (req.action === 'editPledge') { const p = S.pledges.find(x => x.PledgeID === req.id); if (p) { if (req.name) p.Name = req.name; p.Phone = req.phone ?? p.Phone; if (num(req.amount) > 0) p.Amount = num(req.amount); p.Months = mo(req.months); p.Note = req.note ?? p.Note; } }
  else if (req.action === 'deletePledge') S.pledges = S.pledges.filter(x => x.PledgeID !== req.id);
  else if (req.action === 'voidPayment') { const p = S.payments.find(x => x.ReceiptNo === req.receiptNo); if (p) p.Status = 'VOID'; }
  else if (req.action === 'editOffering') { const o = S.offerings.find(x => x.OfferingNo === req.offeringNo); if (o) { o.Amount = num(req.amount); if (req.name != null) o.Name = req.name; if (req.method) o.Method = req.method; if (req.date) o.Date = req.date; if (req.note != null) o.Note = req.note; } }
  else if (req.action === 'voidOffering') S.offerings = S.offerings.filter(o => o.OfferingNo !== req.offeringNo);
}
// Everything shows on screen instantly and syncs in the background. Adds get a temporary id until the server assigns the real number.
const pend = id => String(id).startsWith('tmp');
let tmpN = 0;
async function mutate(req, okMsg) {
  const full = { ...req, code: S.code };
  if (req.action.startsWith('add')) {
    const tmp = 'tmp' + (++tmpN);
    applyLocal(req, { PledgeID: tmp, ReceiptNo: tmp, OfferingNo: tmp }); render(); toast('Saving…');
    try {
      const j = await api(full), c = j.created || {};
      if (req.action === 'addPledge') { const p = S.pledges.find(x => x.PledgeID === tmp); if (p) p.PledgeID = c.PledgeID; S.payments.forEach(y => { if (y.PledgeID === tmp) y.PledgeID = c.PledgeID; }); }
      if (req.action === 'addPayment') { const y = S.payments.find(x => x.ReceiptNo === tmp); if (y) y.ReceiptNo = c.ReceiptNo; }
      if (req.action === 'addOffering') { const o = S.offerings.find(x => x.OfferingNo === tmp); if (o) o.OfferingNo = c.OfferingNo; }
      render(); toast(okMsg); return c;
    } catch (er) {
      S.pledges = S.pledges.filter(x => x.PledgeID !== tmp); S.payments = S.payments.filter(x => x.ReceiptNo !== tmp); S.offerings = S.offerings.filter(x => x.OfferingNo !== tmp);
      render(); throw er;
    }
  }
  const snap = JSON.stringify({ p: S.pledges, y: S.payments, o: S.offerings });
  applyLocal(req); render(); toast(okMsg);
  api(full).catch(er => { const s = JSON.parse(snap); S.pledges = s.p; S.payments = s.y; S.offerings = s.o; render(); toast('Not saved: ' + er.message + ' (change undone)'); });
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
    return { seed: true, p: { ReceiptNo: o.OfferingNo, Date: o.Date, Amount: o.Amount, Method: o.Method, Reference: o.Note }, pl: { Name: o.Name || 'Congregation (seed offering)', Phone: '', Amount: 0 }, paidToDate: 0, balance: 0 };
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
  d.setDrawColor(...ink); d.line(14, 190, 66, 190); d.setFontSize(8); d.setTextColor(...mute); d.setFont('helvetica', 'normal'); d.text('Received by (Financial Secretary)', 14, 194.5);
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
async function load() { const j = await api({ action: 'load', code: S.code }); S.role = j.role; setData(j); render(); }
async function enter(code) {
  S.code = code; await load(); store.set('code', code);
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
  $('#roleBadge').textContent = S.role === 'finsec' ? 'FINANCIAL SECRETARY' : 'VIEW ONLY';
  $('#hdrSub').textContent = C.assembly + ' · ' + C.project; $('#demoBanner').classList.toggle('hidden', !DEMO);
}
$('#demoHint').classList.toggle('hidden', !DEMO);
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault(); $('#loginErr').textContent = ''; $('#loginBtn').disabled = true; $('#loginBtn').textContent = 'Checking…';
  try { await enter($('#code').value.trim()); } catch (er) { $('#loginErr').textContent = er.message; }
  $('#loginBtn').disabled = false; $('#loginBtn').textContent = 'Open dashboard';
});
$('#logout').onclick = () => { store.del('code'); location.reload(); };
$('#refresh').onclick = async () => { try { await load(); toast('Updated'); } catch (e) { toast(e.message); } };
$('#q').oninput = $('#flt').onchange = render;
$('#print').onclick = () => print();
$('#csv').onclick = () => {
  const lines = [['Name', 'Phone', 'Pledged', 'Months', 'Monthly', 'Paid', 'Balance', 'Status']].concat(model().rows.map(r => [r.Name, phoneOf(r.Phone), r.pledged, r.months, r.monthly.toFixed(2), r.paid, Math.max(0, r.bal), r.status]));
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.map(l => l.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\n')], { type: 'text/csv' })); a.download = 'pledges.csv'; a.click();
};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-rcp],[data-wa],[data-pay],[data-edit],[data-del],[data-voidp],[data-voido],[data-eo],tr.row'); if (!t) return;
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
const saved = store.get('code'); if (saved) enter(saved).catch(() => store.del('code'));
})();
