(() => {
const C = window.TRACKER_CONFIG, DEMO = !C.apiUrl;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => C.currency + ' ' + Number(n || 0).toLocaleString('en-GB', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const money0 = n => '<span class="cur">' + C.currency + '</span> ' + Math.round(Number(n || 0)).toLocaleString('en-GB');
const store = { get(k) { try { return sessionStorage.getItem(k); } catch { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch {} }, del(k) { try { sessionStorage.removeItem(k); } catch {} } };
let S = { role: null, code: null, pledges: [], payments: [] };

/* ------------------------------------------------------------ data layer */
const DKEY = 'cop_tracker_demo_v1';
function demoSeed() {
  const names = ['Akosua Mensah','Kwame Boateng','Efua Owusu','Yaw Asante','Abena Darko','Kofi Annan Jr','Ama Serwaa','Nana Yaw Sarpong','Esi Quaye','Kojo Antwi','Adwoa Frimpong','Samuel Tetteh','Grace Ofori','Daniel Acheampong'];
  const amts = [2000,1500,500,1000,3000,800,600,2500,400,1200,750,5000,300,1000];
  const pledges = names.map((n, i) => ({ PledgeID: 'P' + String(i + 1).padStart(4, '0'), Timestamp: new Date(Date.now() - (14 - i) * 864e5).toISOString(), Name: n, Phone: '024' + String(1000000 + i * 91357).slice(0, 7), Amount: amts[i], Note: '', Source: i % 3 ? 'Form' : 'Manual' }));
  const pay = []; let k = 0;
  const add = (pi, frac, daysAgo, m) => { k++; pay.push({ ReceiptNo: 'RCP-' + String(k).padStart(4, '0'), PledgeID: pledges[pi].PledgeID, Date: new Date(Date.now() - daysAgo * 864e5).toISOString().slice(0, 10), Amount: Math.round(pledges[pi].Amount * frac), Method: m, Reference: '', RecordedBy: 'Treasurer' }); };
  add(0, 1, 12, 'MoMo'); add(1, .5, 11, 'Cash'); add(2, 1, 10, 'Cash'); add(3, .4, 9, 'MoMo'); add(4, .3, 8, 'Bank transfer'); add(5, 1, 7, 'MoMo'); add(1, .25, 5, 'MoMo'); add(7, .6, 4, 'Cash'); add(3, .3, 3, 'MoMo'); add(9, .5, 2, 'MoMo'); add(11, .2, 1, 'Cash'); add(4, .3, 1, 'MoMo');
  return { pledges, payments: pay };
}
const demoLoad = () => { try { const j = localStorage.getItem(DKEY); if (j) return JSON.parse(j); } catch {} const d = demoSeed(); demoSave(d); return d; };
const demoSave = d => { try { localStorage.setItem(DKEY, JSON.stringify(d)); } catch {} };

async function api(req) {
  if (DEMO) return demoApi(req);
  const r = await fetch(C.apiUrl, { method: 'POST', body: JSON.stringify(req) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'Request failed');
  return j;
}
function demoApi(r) {
  const role = r.code === 'treasurer' ? 'treasurer' : r.code === 'view' ? 'viewer' : null;
  if (!role) throw new Error('Invalid passcode');
  const d = demoLoad();
  if (r.action !== 'load') {
    if (role !== 'treasurer') throw new Error('Treasurer access required');
    if (r.action === 'addPledge') d.pledges.push({ PledgeID: 'P' + String(d.pledges.length + 1).padStart(4, '0'), Timestamp: new Date().toISOString(), Name: r.name, Phone: r.phone || '', Amount: +r.amount, Note: r.note || '', Source: 'Manual' });
    if (r.action === 'addPayment') d.payments.push({ ReceiptNo: 'RCP-' + String(d.payments.length + 1).padStart(4, '0'), PledgeID: r.pledgeId, Date: r.date, Amount: +r.amount, Method: r.method, Reference: r.reference || '', RecordedBy: 'Treasurer' });
    demoSave(d);
  }
  return Promise.resolve({ ok: true, role, pledges: d.pledges, payments: d.payments });
}

/* ------------------------------------------------------------ calculations */
const valid = () => S.payments.filter(p => String(p.Method).toUpperCase() !== 'VOID');
function model() {
  const by = {}; valid().forEach(p => { (by[p.PledgeID] = by[p.PledgeID] || []).push(p); });
  const rows = S.pledges.map(pl => {
    const ps = (by[pl.PledgeID] || []).sort((a, b) => String(a.ReceiptNo).localeCompare(b.ReceiptNo));
    const paid = ps.reduce((s, p) => s + Number(p.Amount), 0), pledged = Number(pl.Amount) || 0;
    const bal = pledged - paid;
    return { ...pl, pledged, paid, bal, pays: ps, status: paid <= 0 ? 'none' : bal > 0.005 ? 'part' : 'paid' };
  });
  return { rows, T: { pledged: rows.reduce((s, r) => s + r.pledged, 0), received: rows.reduce((s, r) => s + r.paid, 0), out: rows.reduce((s, r) => s + Math.max(0, r.bal), 0), n: rows.length, none: rows.filter(r => r.status === 'none').length, part: rows.filter(r => r.status === 'part').length, paidN: rows.filter(r => r.status === 'paid').length } };
}

/* ------------------------------------------------------------ render */
function render() {
  const { rows, T } = model();
  const pct = T.pledged ? Math.min(100, T.received / T.pledged * 100) : 0;
  $('#kpis').innerHTML = [
    ['', 'Total pledged', money0(T.pledged), T.n + ' pledgers'],
    ['g', 'Money received', money0(T.received), 'across ' + valid().length + ' payments'],
    ['r', 'Outstanding pledges', money0(T.out), (T.n - T.paidN) + ' still owing'],
    ['o', 'Fulfilled', pct.toFixed(1) + '%', T.paidN + ' fully paid' + (C.target ? ' · target ' + money0(C.target) : '')]
  ].map(k => `<div class="kpi ${k[0]}"><div class="l">${k[1]}</div><div class="v">${k[2]}</div><div class="s">${k[3]}</div></div>`).join('');
  $('#progress').style.width = pct + '%';
  $('#pl1').innerHTML = money0(T.received) + ' received'; $('#pl2').innerHTML = money0(T.out) + ' outstanding';
  chartWeeks(); statusBlock(T);
  const q = $('#q').value.trim().toLowerCase(), f = $('#flt').value;
  const list = rows.filter(r => (!q || (r.Name + ' ' + r.Phone).toLowerCase().includes(q)) && (f === 'all' || (f === 'open' ? r.status !== 'paid' : r.status === f)));
  const lab = { none: 'NOT STARTED', part: 'PART-PAID', paid: 'PAID' };
  $('#tbody').innerHTML = list.length ? list.map(r => `<tr class="row" data-id="${esc(r.PledgeID)}"><td><b>${esc(r.Name)}</b><div class="mini"><i style="width:${r.pledged ? Math.min(100, r.paid / r.pledged * 100) : 0}%"></i></div></td><td>${esc(r.Phone) || '<span style="color:var(--mute)">—</span>'}</td><td class="n">${money(r.pledged)}</td><td class="n">${money(r.paid)}</td><td class="n"><b>${money(Math.max(0, r.bal))}</b></td><td><span class="pill ${r.status}">${lab[r.status]}</span></td></tr>`).join('') : `<tr><td colspan="6" class="empty">No pledgers match.</td></tr>`;
  const nm = Object.fromEntries(S.pledges.map(p => [p.PledgeID, p.Name]));
  const rc = valid().slice().sort((a, b) => String(b.ReceiptNo).localeCompare(String(a.ReceiptNo))).slice(0, 15);
  $('#rbody').innerHTML = rc.length ? rc.map(p => `<tr><td><b>${esc(p.ReceiptNo)}</b></td><td>${esc(String(p.Date).slice(0, 10))}</td><td>${esc(nm[p.PledgeID] || p.PledgeID)}</td><td>${esc(p.Method)}</td><td class="n">${money(p.Amount)}</td><td class="n"><button class="btn sm" data-rcp="${esc(p.ReceiptNo)}">PDF</button></td></tr>`).join('') : `<tr><td colspan="6" class="empty">No payments recorded yet.</td></tr>`;
  document.querySelectorAll('.tonly').forEach(e => e.classList.toggle('hidden', S.role !== 'treasurer'));
}
function statusBlock(T) {
  const tot = T.n || 1, seg = [['paid', 'Fully paid', T.paidN, 'var(--green)'], ['part', 'Part-paid', T.part, 'var(--gold)'], ['none', 'Not started', T.none, 'var(--red)']];
  $('#status').innerHTML = `<div style="display:flex;height:26px;border-radius:99px;overflow:hidden;margin-bottom:14px">${seg.map(s => `<i style="flex:${s[2]};background:${s[3]}"></i>`).join('')}</div>` +
    seg.map(s => `<div style="display:flex;align-items:center;gap:10px;margin:8px 0"><i style="width:14px;height:14px;border-radius:4px;background:${s[3]}"></i><span style="flex:1;font-weight:600">${s[1]}</span><b style="font-family:Anton;font-size:20px">${s[2]}</b><span style="color:var(--mute);width:48px;text-align:right">${(s[2] / tot * 100).toFixed(0)}%</span></div>`).join('');
}
function chartWeeks() {
  const ps = valid(); if (!ps.length) { $('#chart').innerHTML = '<div class="empty">No payments yet.</div>'; return; }
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
  const t = S.role === 'treasurer';
  $('#pBody').innerHTML = `<div class="sum"><div><b>${money0(r.pledged)}</b><span>Pledged</span></div><div><b style="color:var(--green)">${money0(r.paid)}</b><span>Paid</span></div><div><b style="color:var(--red)">${money0(Math.max(0, r.bal))}</b><span>Balance</span></div></div>
  <div style="font-size:13px;color:var(--mute);margin-bottom:8px">${esc(r.Phone) || 'No phone recorded'} · ${esc(r.Source)} · ${esc(String(r.Timestamp).slice(0, 10))}${r.Note ? '<br><i>“' + esc(r.Note) + '”</i>' : ''}</div>
  <table class="hist"><thead><tr><th>Receipt</th><th>Date</th><th>Method</th><th class="n">Amount</th><th></th></tr></thead><tbody>${r.pays.length ? r.pays.map(p => `<tr><td><b>${esc(p.ReceiptNo)}</b></td><td>${esc(String(p.Date).slice(0, 10))}</td><td>${esc(p.Method)}</td><td class="n">${money(p.Amount)}</td><td class="n"><button class="btn sm" data-rcp="${esc(p.ReceiptNo)}">PDF</button> <button class="btn sm ghost" data-wa="${esc(p.ReceiptNo)}">WhatsApp</button></td></tr>`).join('') : '<tr><td colspan="5" class="empty">No payments yet.</td></tr>'}</tbody></table>
  ${t ? `<button class="btn gold" style="width:100%;margin-top:14px" data-pay="${esc(r.PledgeID)}" ${r.bal <= 0 ? 'disabled' : ''}>+ Record payment</button>` : ''}`;
  openD($('#dPledge'));
}
function payDialog(id) {
  const r = model().rows.find(x => x.PledgeID === id);
  $('#dPledge').close();
  $('#yTitle').textContent = 'PAYMENT · ' + r.Name.toUpperCase();
  $('#ySum').innerHTML = `<div><b>${money0(r.pledged)}</b><span>Pledged</span></div><div><b>${money0(r.paid)}</b><span>Paid so far</span></div><div><b style="color:var(--red)">${money0(Math.max(0, r.bal))}</b><span>Balance</span></div>`;
  $('#yAmt').value = r.bal > 0 ? r.bal : ''; $('#yAmt').max = Math.max(0, r.bal);
  $('#yDate').value = new Date().toISOString().slice(0, 10); $('#yRef').value = ''; $('#yErr').textContent = '';
  $('#fPay').dataset.id = id; openD($('#dPay'));
}

/* ------------------------------------------------------------ receipts */
const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function words(n) { if (n < 20) return ones[n]; if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? '-' + ones[n % 10] : ''); if (n < 1000) return ones[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + words(n % 100) : ''); if (n < 1e6) return words(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? (n % 1000 < 100 ? ' and ' : ' ') + words(n % 1000) : ''); return words(Math.floor(n / 1e6)) + ' million' + (n % 1e6 ? ' ' + words(n % 1e6) : ''); }
function amountWords(a) { const c = Math.floor(a), p = Math.round((a - c) * 100); return (words(c) || 'zero').replace(/^./, x => x.toUpperCase()) + ' Ghana cedis' + (p ? ' and ' + words(p) + ' pesewas' : '') + ' only'; }
let logoData = null;
function loadLogo() { return logoData ? Promise.resolve(logoData) : new Promise(res => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 300; c.getContext('2d').drawImage(i, 0, 0, 300, 300); logoData = c.toDataURL('image/png'); res(logoData); }; i.onerror = () => res(null); i.src = 'logo.png'; }); }
function receiptInfo(no) {
  const p = S.payments.find(x => x.ReceiptNo === no), pl = S.pledges.find(x => x.PledgeID === p.PledgeID);
  const upTo = valid().filter(x => x.PledgeID === p.PledgeID && String(x.ReceiptNo) <= String(no)).reduce((s, x) => s + Number(x.Amount), 0);
  return { p, pl, paidToDate: upTo, balance: Number(pl.Amount) - upTo };
}
async function receiptPDF(no) {
  const { p, pl, paidToDate, balance } = receiptInfo(no);
  const { jsPDF } = window.jspdf, d = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' });
  const W = 148, royal = [10, 52, 128], gold = [255, 205, 70], ink = [15, 33, 71], mute = [92, 108, 141];
  d.setFillColor(...royal); d.rect(0, 0, W, 38, 'F'); d.setFillColor(...gold); d.rect(0, 38, W, 2.2, 'F');
  const lg = await loadLogo(); if (lg) d.addImage(lg, 'PNG', 8, 6, 26, 26);
  d.setTextColor(255); d.setFont('helvetica', 'bold'); d.setFontSize(13); d.text(C.churchLine1, 40, 15);
  d.setFontSize(8); d.setFont('helvetica', 'normal'); d.text(C.churchLine2, 40, 20.5);
  d.setFillColor(...gold); d.roundedRect(40, 24, 50, 7, 3.5, 3.5, 'F'); d.setTextColor(...royal); d.setFont('helvetica', 'bold'); d.setFontSize(8.5); d.text(C.assembly, 65, 28.8, { align: 'center' });
  d.setTextColor(...ink); d.setFontSize(18); d.text('OFFICIAL RECEIPT', 74, 55, { align: 'center' });
  d.setFontSize(9.5); d.setFont('helvetica', 'normal'); d.setTextColor(...mute); d.text(C.project, 74, 61, { align: 'center' });
  const row = (y, l, v, bold) => { d.setFontSize(8); d.setTextColor(...mute); d.setFont('helvetica', 'bold'); d.text(l.toUpperCase(), 14, y); d.setTextColor(...ink); d.setFontSize(bold ? 11 : 10); d.setFont('helvetica', bold ? 'bold' : 'normal'); d.text(String(v), 62, y); };
  d.setDrawColor(219, 228, 243); d.line(14, 66, W - 14, 66);
  row(75, 'Receipt No.', p.ReceiptNo, true); row(83, 'Date', String(p.Date).slice(0, 10)); row(91, 'Received from', pl.Name, true);
  if (pl.Phone) row(99, 'Phone', pl.Phone);
  row(107, 'Payment method', p.Method + (p.Reference ? '  (' + p.Reference + ')' : ''));
  d.setFillColor(238, 243, 251); d.roundedRect(14, 115, W - 28, 26, 3, 3, 'F');
  d.setFontSize(8); d.setTextColor(...mute); d.setFont('helvetica', 'bold'); d.text('AMOUNT RECEIVED', 20, 122);
  d.setFontSize(20); d.setTextColor(...royal); d.text(money(p.Amount).replace('GH₵', 'GHS'), 20, 132);
  d.setFontSize(8); d.setFont('helvetica', 'italic'); d.setTextColor(...ink); d.text(d.splitTextToSize(amountWords(Number(p.Amount)), W - 40), 20, 138);
  const sy = 152; [['Pledge total', Number(pl.Amount)], ['Paid to date', paidToDate], ['Balance', Math.max(0, balance)]].forEach((x, i) => {
    const cx = 14 + i * ((W - 28) / 3); d.setFontSize(7.5); d.setTextColor(...mute); d.setFont('helvetica', 'bold'); d.text(x[0].toUpperCase(), cx, sy);
    d.setFontSize(11); d.setTextColor(...(i === 2 ? (balance > 0.005 ? [192, 57, 43] : [31, 157, 92]) : ink)); d.text(money(x[1]).replace('GH₵', 'GHS'), cx, sy + 6);
  });
  d.setFontSize(8.5); d.setFont('helvetica', 'bold'); d.setTextColor(...(balance > 0.005 ? [192, 57, 43] : [31, 157, 92])); d.text(balance > 0.005 ? 'Part payment — thank you. Balance outstanding.' : 'PLEDGE FULLY PAID — God bless you!', 14, 170);
  d.setDrawColor(...ink); d.line(14, 190, 66, 190); d.setFontSize(8); d.setTextColor(...mute); d.setFont('helvetica', 'normal'); d.text('Received by (Treasurer)', 14, 194.5);
  d.setFont('helvetica', 'italic'); d.setFontSize(8.5); d.text('"For all things come from You, and of Your own have we given You." — 1 Chronicles 29:14', 74, 202, { align: 'center', maxWidth: W - 24 });
  d.setFillColor(...royal); d.rect(0, 205 - 1.2, W, 1.2, 'F');
  return d;
}
async function downloadReceipt(no) { const { p, pl } = receiptInfo(no); const d = await receiptPDF(no); d.save(`${no}_${pl.Name.replace(/\s+/g, '_')}.pdf`); toast('Receipt ' + no + ' downloaded'); }
function waLink(no) {
  const { p, pl, paidToDate, balance } = receiptInfo(no); let ph = String(pl.Phone || '').replace(/\D/g, '');
  if (ph.startsWith('0')) ph = '233' + ph.slice(1);
  const msg = `Dear ${pl.Name}, thank you for your payment of ${money(p.Amount)} towards the ${C.assembly.toLowerCase().replace(/(^|\s)\S/g, x => x.toUpperCase())} building project (Receipt ${no}, ${String(p.Date).slice(0, 10)}). ` + (balance > 0.005 ? `Pledge ${money(pl.Amount)} · paid to date ${money(paidToDate)} · balance ${money(balance)}.` : 'Your pledge is now fully paid. God bless you richly!') + ' Your receipt is attached.';
  return 'https://wa.me/' + ph + '?text=' + encodeURIComponent(msg);
}

/* ------------------------------------------------------------ events */
function toast(t) { const e = document.createElement('div'); e.className = 'toast'; e.textContent = t; document.body.append(e); setTimeout(() => e.remove(), 2800); }
async function load() { const j = await api({ action: 'load', code: S.code }); S.role = j.role; S.pledges = j.pledges; S.payments = j.payments; render(); }
async function enter(code) {
  S.code = code; await load(); store.set('code', code);
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
  $('#roleBadge').textContent = S.role === 'treasurer' ? 'TREASURER' : 'VIEW ONLY';
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
  const lines = [['Name', 'Phone', 'Pledged', 'Paid', 'Balance', 'Status']].concat(model().rows.map(r => [r.Name, r.Phone, r.pledged, r.paid, Math.max(0, r.bal), r.status]));
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.map(l => l.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\n')], { type: 'text/csv' })); a.download = 'pledges.csv'; a.click();
};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-rcp],[data-wa],[data-pay],tr.row'); if (!t) return;
  if (t.dataset.rcp) return downloadReceipt(t.dataset.rcp);
  if (t.dataset.wa) { window.open(waLink(t.dataset.wa), '_blank'); toast('Download the PDF too and attach it in WhatsApp'); return; }
  if (t.dataset.pay) return payDialog(t.dataset.pay);
  if (t.classList.contains('row')) pledgeDialog(t.dataset.id);
});
$('#addPledge').onclick = () => { $('#fAdd').reset(); $('#aErr').textContent = ''; openD($('#dAdd')); };
$('#fAdd').addEventListener('submit', async e => {
  e.preventDefault();
  try { const j = await api({ action: 'addPledge', code: S.code, name: $('#aName').value.trim(), phone: $('#aPhone').value.trim(), amount: $('#aAmt').value, note: $('#aNote').value.trim() }); S.pledges = j.pledges; S.payments = j.payments; render(); $('#dAdd').close(); toast('Pledge saved'); }
  catch (er) { $('#aErr').textContent = er.message; }
});
$('#fPay').addEventListener('submit', async e => {
  e.preventDefault(); const id = e.target.dataset.id, btn = $('#yBtn'); $('#yErr').textContent = ''; btn.disabled = true;
  try {
    const before = new Set(S.payments.map(p => p.ReceiptNo));
    const j = await api({ action: 'addPayment', code: S.code, pledgeId: id, amount: $('#yAmt').value, date: $('#yDate').value, method: $('#yMethod').value, reference: $('#yRef').value.trim() });
    S.pledges = j.pledges; S.payments = j.payments; render(); $('#dPay').close();
    const np = S.payments.find(p => !before.has(p.ReceiptNo)); if (np) { await downloadReceipt(np.ReceiptNo); pledgeDialog(id); }
  } catch (er) { $('#yErr').textContent = er.message; }
  btn.disabled = false;
});
const saved = store.get('code'); if (saved) enter(saved).catch(() => store.del('code'));
})();
