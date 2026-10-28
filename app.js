/* ============================================================
   CareSync — AI Health Companion for Medication Adherence
   Static single-page app · data persisted in localStorage
   ============================================================ */
(function () {
'use strict';

/* ---------------- helpers ---------------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const KEY = 'caresync.v1';
const GRACE_MS = 60 * 60 * 1000;          // 60 min grace window before a dose counts as missed
const COLORS = { teal:'#14b8a6', indigo:'#6366f1', amber:'#f59e0b', rose:'#f43f5e', violet:'#8b5cf6' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (n, base = new Date()) => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };
const todayKey = () => dateKey(new Date());
const uid = () => Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function schedDate(key, time) { return new Date(`${key}T${time}:00`); }

function fmtTime(t) {
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${pad(m)} ${ap}`;
}
function fmtDate(key, long = false) {
  const d = new Date(`${key}T00:00:00`);
  return d.toLocaleDateString('en-US', long
    ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
    : { weekday: 'short', day: 'numeric', month: 'short' });
}
function fmtClock(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
function fmtRel(ts) {
  const s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}
function humanize(s) { return String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1); }

/* ---------------- state ---------------- */
let state = null;
const load = () => { try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch { return null; } };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };

function makeSyncCode() {
  const cs = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const blk = () => Array.from({ length: 4 }, () => cs[Math.floor(Math.random() * cs.length)]).join('');
  return `CS-${blk()}-${blk()}`;
}

function seed() {
  const s = {
    meds: [
      { id: uid(), name: 'Metformin',  strength: '500 mg',  amount: '1 tablet',  times: ['08:00', '20:00'], pills: 42, refillSize: 60, start: dateKey(addDays(-14)), notes: 'Take with food', color: 'teal' },
      { id: uid(), name: 'Lisinopril', strength: '10 mg',   amount: '1 tablet',  times: ['08:00'],          pills: 18, refillSize: 30, start: dateKey(addDays(-14)), notes: 'Check blood pressure', color: 'indigo' },
      { id: uid(), name: 'Atorvastatin', strength: '20 mg', amount: '1 tablet',  times: ['21:00'],          pills: 26, refillSize: 30, start: dateKey(addDays(-14)), notes: 'Avoid grapefruit', color: 'violet' },
      { id: uid(), name: 'Vitamin D3', strength: '1000 IU', amount: '1 capsule', times: ['09:00'],          pills: 6,  refillSize: 30, start: dateKey(addDays(-14)), notes: 'After breakfast', color: 'amber' }
    ],
    logs: {},
    effects: [
      { id: uid(), ts: new Date(addDays(-2, new Date(Date.now() - 9 * 3600e3))).toISOString(), medId: null, type: 'Symptom', severity: 2, note: 'Slight nausea about 30 minutes after the morning Metformin dose. Settled after eating.' },
      { id: uid(), ts: new Date(addDays(-5, new Date(Date.now() - 18 * 3600e3))).toISOString(), medId: null, type: 'Mood', severity: 3, note: 'Felt unusually tired in the afternoon — worth mentioning at the next check-up.' }
    ],
    caregivers: [
      { id: uid(), name: 'Anita Sharma', relation: 'Daughter', contact: '+91 98765 43210', level: 'critical' },
      { id: uid(), name: 'Dr. Meera Rao', relation: 'Doctor', contact: 'meera.rao@clinic.example', level: 'weekly' }
    ],
    settings: { share: true, syncCode: makeSyncCode(), lastSync: new Date(Date.now() - 4 * 60000).toISOString() },
    chat: []
  };

  // ---- simulate 13 days of adherence history ----
  for (let i = 13; i >= 1; i--) {
    const d = addDays(-i);
    const key = dateKey(d);
    const quality = 0.74 + Math.random() * 0.26;               // 74% – 100%
    s.logs[key] = {};
    s.meds.forEach(med => {
      if (key < med.start) return;
      med.times.forEach(time => {
        const r = Math.random();
        if (r < quality) s.logs[key][`${med.id}@${time}`] = { status: 'taken', at: schedDate(key, time).toISOString() };
        else if (r < quality + (1 - quality) * 0.45) s.logs[key][`${med.id}@${time}`] = { status: 'skipped', at: schedDate(key, time).toISOString() };
        // remainder stays untouched → counts as missed
      });
    });
  }

  // ---- partial history for today ----
  const now = Date.now();
  s.logs[todayKey()] = {};
  s.meds.forEach(med => {
    med.times.forEach(time => {
      const when = schedDate(todayKey(), time).getTime();
      if (when < now - 5 * 60000 && Math.random() < 0.82) {
        s.logs[todayKey()][`${med.id}@${time}`] = { status: 'taken', at: new Date(when + 4 * 60000).toISOString() };
      }
    });
  });

  s.chat = [{ role: 'bot', ts: new Date().toISOString(),
    text: "Hi, I'm your CareSync companion. I can see your schedule, adherence, refills and journal in real time. Ask me anything — like <b>“what's my next dose?”</b> or <b>“how am I doing?”</b>" }];
  return s;
}

/* ---------------- dose slots & status ---------------- */
function getSlots(key) {
  const out = [];
  state.meds.forEach(med => {
    if (med.start && key < med.start) return;
    med.times.forEach(time => out.push({ med, time, key: `${med.id}@${time}` }));
  });
  return out.sort((a, b) => a.time.localeCompare(b.time));
}

function slotStatus(key, slot) {
  const log = state.logs[key] && state.logs[key][slot.key];
  if (log) return log.status;                                  // taken | skipped
  const t = schedDate(key, slot.time).getTime();
  const now = Date.now();
  if (now < t) return 'upcoming';
  if (now - t <= GRACE_MS) return 'due';
  return 'missed';
}

function dayStats(key) {
  const stats = { taken: 0, skipped: 0, missed: 0, due: 0, upcoming: 0, total: 0, counted: 0, pct: null };
  getSlots(key).forEach(slot => {
    const st = slotStatus(key, slot);
    stats[st]++; stats.total++;
    if (st === 'taken' || st === 'skipped' || st === 'missed') stats.counted++;
  });
  stats.pct = stats.counted ? Math.round((stats.taken / stats.counted) * 100) : null;
  return stats;
}

function rangeStats(days) {
  const acc = { taken: 0, skipped: 0, missed: 0, counted: 0 };
  const list = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = dateKey(addDays(-i));
    const s = dayStats(key);
    acc.taken += s.taken; acc.skipped += s.skipped; acc.missed += s.missed; acc.counted += s.counted;
    list.push({ key, ...s });
  }
  acc.pct = acc.counted ? Math.round((acc.taken / acc.counted) * 100) : null;
  acc.list = list;
  return acc;
}

function streakDays() {
  let streak = 0;
  for (let i = 0; i < 90; i++) {
    const s = dayStats(dateKey(addDays(-i)));
    if (s.counted === 0) continue;                             // empty day — don't break the streak
    if (s.taken === s.counted) streak++;
    else break;
  }
  return streak;
}

function allStats() {
  const acc = { taken: 0, counted: 0 };
  Object.values(state.logs).forEach(day => Object.values(day).forEach(l => {
    if (l.status === 'taken') acc.taken++;
    acc.counted++;
  }));
  acc.pct = acc.counted ? Math.round((acc.taken / acc.counted) * 100) : null;
  return acc;
}

function refillInfo(med) {
  const perDay = med.times.length || 1;
  const daysLeft = Math.floor(med.pills / perDay);
  const threshold = Math.max(3, Math.round(med.refillSize * 0.2));
  const low = med.pills <= threshold || daysLeft <= 3;
  const pct = clamp(Math.round((med.pills / Math.max(1, med.refillSize)) * 100), 0, 100);
  return { daysLeft, low, pct, level: pct <= 40 ? 'low' : pct <= 70 ? 'warn' : 'ok' };
}

function nextDose() {
  const tk = todayKey();
  const now = Date.now();
  const today = getSlots(tk).filter(s => ['upcoming', 'due'].includes(slotStatus(tk, s)))
    .sort((a, b) => schedDate(tk, a.time) - schedDate(tk, b.time));
  if (today.length) {
    const s = today[0];
    return { slot: s, key: tk, at: schedDate(tk, s.time) };
  }
  const tm = dateKey(addDays(1));
  const tomorrow = getSlots(tm)[0];
  return tomorrow ? { slot: tomorrow, key: tm, at: schedDate(tm, tomorrow.time) } : null;
}

/* ---------------- toasts ---------------- */
function toast(title, msg, type = 'info', ttl = 4600) {
  const wrap = $('#toastWrap');
  const el = document.createElement('div');
  el.className = `toast t-${type}`;
  el.innerHTML = `<div><strong>${esc(title)}</strong><p>${esc(msg)}</p></div>`;
  wrap.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, ttl);
}

/* ---------------- sync helpers ---------------- */
function pushSync() { state.settings.lastSync = new Date().toISOString(); }

/* ---------------- render: hero ---------------- */
function renderHero() {
  const overall = allStats();
  const stats = dayStats(todayKey());
  $('#statDoses').textContent = overall.counted;
  $('#statAdherence').textContent = overall.pct === null ? '—' : overall.pct + '%';
  $('#statStreak').textContent = streakDays();
  $('#statCaregivers').textContent = state.caregivers.length;

  const nd = nextDose();
  if (nd) {
    const med = nd.slot.med;
    $('#hvMed').textContent = `${med.name} ${med.strength}`.trim();
    $('#hvTime').textContent = `${fmtTime(nd.slot.time)} · ${fmtDate(nd.key)}`;
    const diff = nd.at - Date.now();
    $('#hvCount').textContent = diff <= 0 ? 'Due now'
      : diff < 3600e3 ? `in ${Math.round(diff / 60000)} min`
      : diff < 86400e3 ? `in ${Math.floor(diff / 3600e3)} h ${Math.round((diff % 3600e3) / 60000)} m`
      : 'tomorrow';
  } else {
    $('#hvMed').textContent = 'No doses scheduled';
    $('#hvTime').textContent = '—'; $('#hvCount').textContent = '—';
  }
  $('#hvTodayText').textContent = `${stats.taken} / ${stats.total} taken`;
  $('#hvTodayBar').style.width = (stats.total ? (stats.taken / stats.total) * 100 : 0) + '%';
  $('#hvSync').textContent = fmtRel(state.settings.lastSync);

  const left = stats.total - stats.taken;
  const misses = stats.missed;
  $('#hvAlert').textContent = misses ? `${misses} missed dose${misses > 1 ? 's' : ''} today`
    : left ? `${left} dose${left > 1 ? 's' : ''} left today` : 'all caught up';
}

/* ---------------- render: dashboard ---------------- */
function renderDashboard() {
  const tk = todayKey();
  const today = dayStats(tk);
  const week = rangeStats(7);
  const streak = streakDays();
  const lows = state.meds.filter(m => refillInfo(m).low);

  $('#kpiToday').textContent = today.pct === null ? '—' : today.pct + '%';
  $('#kpiTodaySub').textContent = today.total ? `${today.taken} of ${today.total} doses taken` : 'No doses scheduled today';
  $('#kpiTodayBar').style.width = (today.pct || 0) + '%';

  $('#kpiWeek').textContent = week.pct === null ? '—' : week.pct + '%';
  $('#kpiWeekSub').textContent = `${week.taken} of ${week.counted} doses in 7 days`;
  $('#kpiWeekBar').style.width = (week.pct || 0) + '%';

  $('#kpiStreak').textContent = streak;
  $('#kpiStreakSub').textContent = streak ? `${streak} perfect day${streak > 1 ? 's' : ''} in a row` : 'No perfect day yet — today counts too';
  $('#kpiStreakBar').style.width = clamp((streak / 7) * 100, 4, 100) + '%';

  $('#kpiRefills').textContent = lows.length;
  $('#kpiRefillsSub').textContent = lows.length ? `${lows.length} of ${state.meds.length} medications running low` : `All ${state.meds.length} medications stocked`;
  $('#kpiRefillsBar').style.width = (state.meds.length ? (lows.length / state.meds.length) * 100 : 0) + '%';

  // ring
  const pct = today.pct || 0;
  const C = 2 * Math.PI * 52;
  const ring = $('#ringFill');
  ring.style.strokeDasharray = C;
  ring.style.strokeDashoffset = C * (1 - pct / 100);
  ring.style.stroke = pct >= 80 ? '#14b8a6' : pct >= 50 ? '#f59e0b' : '#f43f5e';
  $('#ringPct').textContent = (today.pct === null ? '—' : today.pct + '%');
  $('#ringSub').textContent = `today · ${today.taken}/${today.total} doses`;
  $('#legTaken').textContent = today.taken;
  $('#legDue').textContent = today.due + today.upcoming;
  $('#legMissed').textContent = today.missed + today.skipped;

  $('#todayDate').textContent = fmtDate(tk, true);
  renderTodayList();
  drawWeekChart();
}

function renderTodayList() {
  const tk = todayKey();
  const wrap = $('#todayList');
  const slots = getSlots(tk);
  if (!slots.length) {
    wrap.innerHTML = `<div class="empty-note">No medications scheduled yet.<br>Add one in the <a href="#meds" style="color:var(--brand-700);font-weight:700">Medications</a> section to start tracking.</div>`;
    return;
  }
  const statusLabel = { taken: 'Taken', skipped: 'Skipped', missed: 'Missed', due: 'Due now', upcoming: 'Upcoming' };
  wrap.innerHTML = slots.map(slot => {
    const st = slotStatus(tk, slot);
    const med = slot.med;
    const log = state.logs[tk] && state.logs[tk][slot.key];
    const actions = (st === 'taken' || st === 'skipped')
      ? `<button class="dose-btn done" data-act="undo" data-mid="${med.id}" data-time="${slot.time}">Undo</button>`
      : `<button class="dose-btn" data-act="take" data-mid="${med.id}" data-time="${slot.time}">Taken</button>
         <button class="dose-btn skip" data-act="skip" data-mid="${med.id}" data-time="${slot.time}">Skip</button>`;
    const extra = log && log.status === 'taken' && st === 'taken' ? ` · ${fmtClock(log.at)}` : '';
    return `<div class="dose-item">
      <div class="dose-time">${fmtTime(slot.time).replace(' ', '<br>')}</div>
      <div class="dose-color" style="background:${COLORS[med.color] || COLORS.teal}"></div>
      <div class="dose-info">
        <strong>${esc(med.name)} ${esc(med.strength)}</strong>
        <span>${esc(med.amount || '')}${med.notes ? ' · ' + esc(med.notes) : ''}</span>
      </div>
      <span class="dose-status st-${st}">${statusLabel[st]}${extra}</span>
      <div class="dose-actions">${actions}</div>
    </div>`;
  }).join('');
}

/* ---------------- week chart ---------------- */
function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawWeekChart() {
  const canvas = $('#weekChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 900, cssH = 260;
  canvas.width = cssW * dpr; canvas.height = cssH * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const pad = { l: 40, r: 12, t: 24, b: 36 };
  const w = cssW - pad.l - pad.r, h = cssH - pad.t - pad.b;
  const days = rangeStats(7).list;

  ctx.font = '500 11px Inter, sans-serif';
  for (let g = 0; g <= 100; g += 25) {
    const y = pad.t + h - (g / 100) * h;
    ctx.strokeStyle = '#eef2f7'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + w, y); ctx.stroke();
    ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(g + '%', pad.l - 8, y);
  }

  // goal line
  const gy = pad.t + h - 0.8 * h;
  ctx.save(); ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 5]);
  ctx.beginPath(); ctx.moveTo(pad.l, gy); ctx.lineTo(pad.l + w, gy); ctx.stroke(); ctx.restore();
  ctx.fillStyle = '#b45309'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  ctx.fillText('Goal 80%', pad.l + 4, gy - 4);

  const slot = w / 7;
  days.forEach((d, i) => {
    const bw = Math.min(46, slot * 0.5);
    const x = pad.l + i * slot + (slot - bw) / 2;
    const val = d.pct;
    const barH = val === null ? 4 : Math.max(4, (val / 100) * h);
    const y = pad.t + h - barH;

    ctx.fillStyle = val === null ? '#e2e8f0' : val >= 80 ? '#14b8a6' : val >= 60 ? '#f59e0b' : '#f43f5e';
    if (val !== null) {
      const g = ctx.createLinearGradient(0, y, 0, pad.t + h);
      const base = val >= 80 ? ['#14b8a6', '#2dd4bf'] : val >= 60 ? ['#f59e0b', '#fbbf24'] : ['#f43f5e', '#fb7185'];
      g.addColorStop(0, base[0]); g.addColorStop(1, base[1]);
      ctx.fillStyle = g;
    }
    roundRect(ctx, x, y, bw, barH, 7); ctx.fill();

    ctx.fillStyle = '#0f172a'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.font = '700 11px Inter, sans-serif';
    ctx.fillText(val === null ? '–' : val + '%', x + bw / 2, y - 6);

    ctx.fillStyle = '#94a3b8'; ctx.textBaseline = 'top'; ctx.font = '500 11px Inter, sans-serif';
    const dt = new Date(`${d.key}T00:00:00`);
    ctx.fillText(i === 6 ? 'Today' : dt.toLocaleDateString('en-US', { weekday: 'short' }), x + bw / 2, pad.t + h + 9);
  });
}

/* ---------------- medications ---------------- */
function renderMeds() {
  const grid = $('#medGrid');
  if (!state.meds.length) {
    grid.innerHTML = `<div class="empty-note" style="grid-column:1/-1">No medications yet — add your first one using the form.</div>`;
    return;
  }
  grid.innerHTML = state.meds.map(med => {
    const r = refillInfo(med);
    const width = `${Math.max(r.pct, 2)}%`;
    return `<div class="med-card c-${med.color}" data-id="${med.id}">
      <div class="med-top">
        <div>
          <h4>${esc(med.name)}</h4>
          <div class="med-strength">${esc([med.strength, med.amount].filter(Boolean).join(' · '))}</div>
        </div>
        ${r.low ? '<span class="badge-low">Refill due</span>' : ''}
      </div>
      <div class="med-times">${med.times.map(t => `<span class="time-pill">${fmtTime(t)}</span>`).join('')}</div>
      <div class="med-notes">${med.notes ? esc(med.notes) : ''}</div>
      <div class="refill-block">
        <div class="refill-row"><span>Supply left</span><b>${med.pills} pills · ≈${r.daysLeft} d</b></div>
        <div class="refill-row"><span>Refill size</span><b>${med.refillSize}</b></div>
        <div class="refill-bar refill-${r.level}"><span style="width:${width}"></span></div>
        <div class="med-actions">
          <button class="btn btn-primary btn-sm" data-act="refill">Refill</button>
          <button class="btn btn-ghost btn-sm" data-act="edit">Edit</button>
          <button class="btn btn-ghost btn-sm" data-act="delete">Delete</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function parseTimes(raw) {
  const parts = String(raw || '').split(/[,;\s]+/).filter(Boolean);
  if (!parts.length) return null;
  const out = [];
  for (const p of parts) {
    const m = p.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (!m) return null;
    out.push(`${pad(Number(m[1]))}:${m[2]}`);
  }
  return [...new Set(out)].sort();
}

let editingId = null;

function resetMedForm() {
  editingId = null;
  $('#medForm').reset();
  $('#medStart').value = todayKey();
  $('#medErrors').classList.remove('show');
  $('#medFormTitle').textContent = 'Add Medication';
  $('#medFormTag').textContent = 'New';
  $('#medSubmit').textContent = 'Add Medication';
  $('#medCancel').classList.add('hidden');
}

function loadMedForm(med) {
  editingId = med.id;
  $('#medName').value = med.name;
  $('#medStrength').value = med.strength || '';
  $('#medAmount').value = med.amount || '';
  $('#medTimes').value = med.times.join(', ');
  $('#medPills').value = med.pills;
  $('#medRefillSize').value = med.refillSize;
  $('#medStart').value = med.start || todayKey();
  $('#medColor').value = med.color;
  $('#medNotes').value = med.notes || '';
  $('#medFormTitle').textContent = 'Edit Medication';
  $('#medFormTag').textContent = 'Editing';
  $('#medSubmit').textContent = 'Save changes';
  $('#medCancel').classList.remove('hidden');
  $('#medForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ---------------- caregivers & alerts ---------------- */
function renderCaregivers() {
  const list = $('#caregiverList');
  $('#cgCount').textContent = state.caregivers.length;
  $('#syncCode').textContent = state.settings.syncCode;
  $('#shareToggle').checked = !!state.settings.share;
  $('#lastSync').textContent = fmtRel(state.settings.lastSync);

  if (!state.caregivers.length) {
    list.innerHTML = `<div class="empty-note">No caregivers linked yet. Share your sync code below.</div>`;
    return;
  }
  const levels = { all: 'All activity', critical: 'Misses & alerts', weekly: 'Weekly' };
  const palette = ['#14b8a6', '#6366f1', '#f59e0b', '#8b5cf6', '#f43f5e'];
  list.innerHTML = state.caregivers.map((cg, i) => {
    const initials = cg.name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
    return `<div class="cg-item">
      <div class="cg-avatar" style="background:${palette[i % palette.length]}">${esc(initials)}</div>
      <div class="cg-info"><strong>${esc(cg.name)}</strong><span>${esc(cg.relation)} · ${esc(cg.contact || 'no contact')}</span></div>
      <span class="cg-level">${levels[cg.level] || 'Alerts'}</span>
      <button class="cg-remove" data-id="${cg.id}" title="Unlink caregiver">✕</button>
    </div>`;
  }).join('');
}

function buildAlerts() {
  const out = [];
  const now = Date.now();

  for (let i = 0; i < 7; i++) {
    const key = dateKey(addDays(-i));
    getSlots(key).forEach(slot => {
      if (slotStatus(key, slot) !== 'missed') return;
      out.push({
        sev: 'critical', icon: '⚠️',
        title: `Missed dose — ${slot.med.name}`,
        desc: `${fmtTime(slot.time)} dose on ${fmtDate(key)} was not taken.`,
        ts: schedDate(key, slot.time).getTime()
      });
    });
  }

  state.meds.forEach(med => {
    const r = refillInfo(med);
    if (r.low) out.push({
      sev: 'warn', icon: '💊',
      title: `Refill due — ${med.name}`,
      desc: `Only ${med.pills} pills left (≈${r.daysLeft} days of supply at ${med.times.length}× daily).`,
      ts: now - 60000
    });
  });

  state.effects.filter(e => e.severity >= 4).forEach(e => {
    const med = state.meds.find(m => m.id === e.medId);
    out.push({
      sev: 'warn', icon: '🩺',
      title: `Severe side effect logged (severity ${e.severity})`,
      desc: `${e.note}${med ? ` — linked to ${med.name}.` : ''}`,
      ts: new Date(e.ts).getTime()
    });
  });

  const today = dayStats(todayKey());
  if (today.total && today.counted === today.total && today.taken === today.total && today.missed === 0) {
    out.push({ sev: 'good', icon: '✅', title: 'All doses taken today', desc: 'Perfect adherence so far — care team notified.', ts: now - 120000 });
  }

  if (!state.settings.share) {
    out.unshift({ sev: 'info', icon: '🔒', title: 'Sharing paused', desc: 'Adherence data is not being shared with your care team.', ts: now });
  }

  return out.sort((a, b) => b.ts - a.ts).slice(0, 12);
}

function renderAlerts() {
  const feed = $('#alertFeed');
  const alerts = buildAlerts();
  if (!alerts.length) {
    feed.innerHTML = `<div class="empty-note">Nothing to report — no missed doses, low refills or severe symptoms. 🎉</div>`;
    return;
  }
  feed.innerHTML = alerts.map(a => `<div class="alert-item alert-${a.sev}">
      <div class="alert-ico">${a.icon}</div>
      <div class="alert-body">
        <strong>${esc(a.title)}</strong>
        <p>${esc(a.desc)}</p>
        <time>${fmtRel(a.ts)}</time>
      </div>
    </div>`).join('');
}

/* ---------------- journal ---------------- */
const SEV_LABEL = { 1: 'Minimal', 2: 'Mild', 3: 'Moderate', 4: 'Severe', 5: 'Extreme' };
const SEV_COLOR = { 1: '#22c55e', 2: '#14b8a6', 3: '#f59e0b', 4: '#f97316', 5: '#f43f5e' };

function renderEffOptions() {
  const sel = $('#effMed');
  const cur = sel.value;
  sel.innerHTML = `<option value="">— General —</option>` +
    state.meds.map(m => `<option value="${m.id}">${esc(m.name)} ${esc(m.strength)}</option>`).join('');
  if (cur) sel.value = cur;
}

function renderEffects() {
  const list = $('#effList');
  const items = [...state.effects].sort((a, b) => new Date(b.ts) - new Date(a.ts));
  $('#effCount').textContent = `${items.length} logged`;
  if (!items.length) {
    list.innerHTML = `<div class="empty-note">No entries yet. Log symptoms, mood or vitals notes on the left.</div>`;
    return;
  }
  list.innerHTML = items.map(e => {
    const med = state.meds.find(m => m.id === e.medId);
    const d = new Date(e.ts);
    return `<div class="eff-item">
      <div class="eff-sev" style="background:${SEV_COLOR[e.severity]}">${e.severity}</div>
      <div class="eff-body">
        <div class="eff-meta">
          <strong>${esc(e.type)}</strong>
          <span class="eff-tag">${SEV_LABEL[e.severity]}</span>
          ${med ? `<span class="eff-tag">${esc(med.name)}</span>` : ''}
        </div>
        <p>${esc(e.note)}</p>
        <time>${d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })} · ${fmtClock(e.ts)}</time>
      </div>
      <button class="eff-del" data-id="${e.id}" title="Delete entry">✕</button>
    </div>`;
  }).join('');
}

/* ---------------- master render ---------------- */
function renderAll() {
  renderHero();
  renderDashboard();
  renderMeds();
  renderEffOptions();
  renderEffects();
  renderCaregivers();
  renderAlerts();
}

/* ---------------- reminders ---------------- */
const fired = new Set();
let firstTick = true;
let greetedDue = false;

function tick() {
  const tk = todayKey();
  getSlots(tk).forEach(slot => {
    const st = slotStatus(tk, slot);
    if (st !== 'due' && st !== 'missed') return;
    const id = `${tk}|${slot.key}|${st}`;
    if (fired.has(id)) return;
    fired.add(id);
    const med = slot.med;
    if (firstTick && st === 'missed') return;                  // don't spam on page load
    if (firstTick && st === 'due' && greetedDue) return;
    if (st === 'due') {
      greetedDue = true;
      toast('Dose due now', `${med.name} ${med.strength} — scheduled at ${fmtTime(slot.time)}.`, 'warn', 6500);
      notify(`${med.name} ${med.strength}`, `Scheduled for ${fmtTime(slot.time)} — take ${med.amount || 'your dose'} now.`);
    } else {
      toast('Missed dose detected', `${med.name} ${fmtTime(slot.time)} is past its grace window. Log it or take it now.`, 'danger', 7000);
      notify('Missed dose', `${med.name} — ${fmtTime(slot.time)} was not logged.`);
      pushSync(); save(); renderCaregivers(); renderAlerts();
    }
  });
  firstTick = false;
  renderHero();
}

function notify(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification(title, { body, icon: document.querySelector('link[rel=icon]').href }); } catch {}
  }
}

/* ---------------- AI companion ---------------- */
function chatRender() {
  const box = $('#chatMessages');
  box.innerHTML = state.chat.map(m => `<div class="msg msg-${m.role === 'user' ? 'user' : 'bot'}">${m.role === 'user' ? esc(m.text) : m.text}<span class="msg-time">${fmtClock(m.ts)}</span></div>`).join('');
  box.scrollTop = box.scrollHeight;
}

function pushMsg(role, text) {
  state.chat.push({ role, text, ts: new Date().toISOString() });
  if (state.chat.length > 80) state.chat = state.chat.slice(-80);
  save();
  chatRender();
}

function listScheduleLines() {
  const tk = todayKey();
  const slots = getSlots(tk);
  if (!slots.length) return 'You have <b>no doses</b> scheduled today.';
  return '<ul>' + slots.map(s => {
    const st = slotStatus(tk, s);
    const mark = st === 'taken' ? '✅' : st === 'skipped' ? '⏭️' : st === 'missed' ? '❌' : st === 'due' ? '⏰' : '🔵';
    return `<li>${mark} <b>${fmtTime(s.time)}</b> — ${esc(s.med.name)} ${esc(s.med.strength)} <i>(${st})</i></li>`;
  }).join('') + '</ul>';
}

function companionReply(raw) {
  const t = raw.toLowerCase().trim();
  const tk = todayKey();
  const stats = dayStats(tk);
  const week = rangeStats(7);

  const has = (re) => re.test(t);
  const medMentioned = state.meds.find(m => m.name && t.includes(m.name.toLowerCase()));

  // --- intents, most specific first ---
  if (has(/^(hi|hello|hey|yo|good (morning|afternoon|evening))\b/)) {
    const nd = nextDose();
    return `Hello! 💚 Here's where things stand: you've taken <b>${stats.taken}/${stats.total}</b> doses today, adherence this week is <b>${week.pct ?? '—'}%</b>, and your streak is <b>${streakDays()} days</b>.` +
      (nd ? ` Next up: <b>${esc(nd.slot.med.name)}</b> at <b>${fmtTime(nd.slot.time)}</b>.` : '');
  }

  if (has(/(thank|thx|appreciate)/)) return `Anytime! 💚 I'll keep watching the schedule and your care team stays in the loop.`;

  if (has(/\b(bye|goodbye|see you|good ?night)\b/)) return `Take care! 👋 I'll nudge you at your next dose time and keep your caregiver synced.`;

  if (has(/what can you (do|help)|\bhelp\b|commands/)) {
    return `I'm your adherence companion. I can: <ul>
      <li>Show <b>today's schedule</b> and your <b>next dose</b></li>
      <li>Summarise <b>adherence</b> — today, 7 days, streak</li>
      <li>Coach you after a <b>missed dose</b></li>
      <li>Check <b>refill</b> supply for every medication</li>
      <li>Log how you feel when you report a <b>side effect</b></li>
      <li>Tell you who's <b>synced</b> as your caregiver</li></ul>`;
  }

  if (has(/miss(ed|ing)|forgot|skip(ped)?|double dose|took two/)) {
    const missed = getSlots(tk).filter(s => slotStatus(tk, s) === 'missed');
    let line = `I'm sorry — missing happens to everyone. Here's the safe routine: `;
    line += `if it's still close to the scheduled time, take it when you remember; if the next dose is near, <b>skip the missed one and resume normally</b> — never double up. Take a look at your leaflet or prescriber's instructions for medicine-specific advice.`;
    if (missed.length) line += `<ul>${missed.map(s => `<li>⚠️ <b>${esc(s.med.name)}</b> at ${fmtTime(s.time)} is unlogged</li>`).join('')}</ul>Your caregiver has already been notified.`;
    else line += ` Good news — you have <b>no missed doses</b> today.`;
    return line;
  }

  if (has(/dizz|nausea|vomit|headache|rash|pain|ache|swelling|breath|shortness|side effect|sick|blurry|palpitat|bleed/)) {
    const medName = medMentioned ? medMentioned.name : 'your medication';
    return `I'm sorry you're feeling that. Here's what I suggest for <b>${esc(medName)}</b>:<ul>
      <li>Log it in the <b>Side-Effect Journal</b> with a severity rating so we can spot patterns</li>
      <li>Note when it started relative to the dose — timing helps your doctor</li>
      <li>Don't stop prescribed medication without talking to your prescriber</li></ul>
      🚨 <b>Seek urgent care now</b> if you have trouble breathing, chest pain, facial/tongue swelling, a spreading rash, or confusion. This companion is educational support, not a medical diagnosis.`;
  }

  if (has(/refill|running out|pills left|how many.*left|supply/)) {
    const lows = state.meds.filter(m => refillInfo(m).low);
    const rows = state.meds.map(m => {
      const r = refillInfo(m);
      return `<li>${r.low ? '🔴' : '🟢'} <b>${esc(m.name)}</b> — ${m.pills} pills, ≈${r.daysLeft} days</li>`;
    }).join('');
    return `${lows.length ? `🔴 <b>${lows.length} medication${lows.length > 1 ? 's' : ''} need a refill:</b> ${lows.map(m => m.name).join(', ')}.` : `🟢 All refills look healthy.`} Full picture:<ul>${rows}</ul>Tap <b>Refill</b> on a medication card after you pick it up and I'll reset the counter.`;
  }

  if (has(/caregiver|family|sync|share|shared|daughter|son|wife|husband|nurse|doctor|team/)) {
    const names = state.caregivers.map(c => `${c.name} (${c.relation})`).join(', ');
    return state.settings.share
      ? `Yes — <b>${state.caregivers.length} caregiver${state.caregivers.length === 1 ? '' : 's'}</b> linked: ${esc(names || 'none')}. Sharing is <b>on</b>, last synced <b>${fmtRel(state.settings.lastSync)}</b>. Missed doses, low refills and severe side effects are pushed to them automatically.`
      : `Sharing is currently <b>paused</b> 🔒 — your last sync was ${fmtRel(state.settings.lastSync)}. Flip “Share adherence data” on in the Caregiver Sync panel to resume alerts.`;
  }

  if (has(/remind|notification|alarm|alert time|wake|ping/)) {
    const on = 'Notification' in window && Notification.permission === 'granted';
    return `Reminders fire when a dose enters its <b>60-minute grace window</b>, and again as a missed-dose alert. Browser notifications are <b>${on ? 'enabled ✅' : 'not enabled yet — click “Enable browser reminders” on the dashboard'}</b>. Even without them, toasts appear inside the app.`;
  }

  if (medMentioned) {
    const m = medMentioned;
    const r = refillInfo(m);
    return `<b>${esc(m.name)} ${esc(m.strength)}</b> — ${esc(m.amount || 'dose')} at <b>${m.times.map(fmtTime).join(', ')}</b>. ${m.notes ? `Instructions: <i>${esc(m.notes)}</i>. ` : ''}Supply: ${m.pills} pills (≈${r.daysLeft} days) ${r.low ? '🔴 <b>refill due</b>' : '🟢'}. Your adherence for it is part of today's ${stats.pct ?? '—'}% score.`;
  }

  if (has(/how am i|doing|adherence|streak|progress|stat|report|score|week|better/)) {
    return `<b>Today:</b> ${stats.pct === null ? 'no doses counted yet' : stats.pct + '%'} (${stats.taken} taken, ${stats.skipped} skipped, ${stats.missed} missed, ${stats.due + stats.upcoming} pending).<br>
      <b>7 days:</b> ${week.pct ?? '—'}% across ${week.counted} doses.<br>
      <b>Streak:</b> ${streakDays()} perfect day${streakDays() === 1 ? '' : 's'}. ${week.pct >= 80 ? '📈 You\'re above the 80% goal — keep it up!' : 'You\'re below the 80% goal — let\'s plan a consistent routine.'}`;
  }

  if (has(/next|upcoming|what.*(dose|take|medicine|pill)|schedule|today|remind me/)) {
    const nd = nextDose();
    if (!nd) return `You have nothing scheduled. Add a medication to start tracking.`;
    const when = nd.key === tk ? 'today' : 'tomorrow';
    const diff = nd.at - Date.now();
    const left = diff <= 0 ? 'it\'s due right now' : diff < 3600e3 ? `${Math.round(diff / 60000)} minutes away` : `${Math.floor(diff / 3600e3)} hours away`;
    return `Your next dose is <b>${esc(nd.slot.med.name)} ${esc(nd.slot.med.strength)}</b> (${esc(nd.slot.med.amount || '')}) at <b>${fmtTime(nd.slot.time)} ${when}</b> — ${left}.<br>Today so far: ${stats.taken}/${stats.total} taken.<br><br>${listScheduleLines()}`;
  }

  if (has(/anxious|worried|stress|scared|nervous|depress|overwhelm|sad/)) {
    return `That's completely understandable, and you're not managing it alone — your care team sees your progress too. A few things that help: keep doses tied to a daily anchor (breakfast, bedtime), use the journal to offload worries, and bring recurring concerns to your next appointment. Would you like me to summarise your week for your next visit?`;
  }

  if (has(/doctor|appointment|visit|check-?up/) ) {
    return `For your next appointment, I can compile: 7-day adherence (${week.pct ?? '—'}%), the streak, all journal entries (including any severity ≥ 4), and current refill status. Log anything new in the journal and it'll be included.`;
  }

  return `I can help with your schedule, adherence, missed doses, refills, side effects and caregiver sync. Try: <b>“what's my next dose?”</b>, <b>“how am I doing?”</b>, <b>“any refills due?”</b> or <b>“I feel dizzy”</b>. (I offer educational support — please confirm medical decisions with your prescriber.)`;
}

function sendChat(text) {
  const clean = text.trim();
  if (!clean) return;
  pushMsg('user', clean);
  const box = $('#chatMessages');
  const typing = document.createElement('div');
  typing.className = 'msg msg-bot typing';
  typing.innerHTML = '<i></i><i></i><i></i>';
  box.appendChild(typing);
  box.scrollTop = box.scrollHeight;
  setTimeout(() => {
    typing.remove();
    pushMsg('bot', companionReply(clean));
  }, 450 + Math.random() * 500);
}

/* ---------------- actions ---------------- */
function markDose(mid, time, action) {
  const status = { take: 'taken', skip: 'skipped', undo: 'undo' }[action] || action;
  const tk = todayKey();
  state.logs[tk] = state.logs[tk] || {};
  const slotKey = `${mid}@${time}`;
  const med = state.meds.find(m => m.id === mid);

  if (status === 'undo') {
    const prev = state.logs[tk][slotKey];
    delete state.logs[tk][slotKey];
    if (med && prev && prev.status === 'taken') med.pills += 1;   // revert pill decrement
    toast('Entry removed', `${med ? med.name : 'Dose'} — log reverted.`, 'info');
  } else {
    const already = state.logs[tk][slotKey];
    state.logs[tk][slotKey] = { status, at: new Date().toISOString() };
    if (!already && status === 'taken' && med) med.pills = Math.max(0, med.pills - 1);
    if (status === 'taken') toast('Dose logged ✅', `${med.name} ${med.strength} taken at ${fmtClock(Date.now())}.`, 'success');
    else toast('Dose skipped', `${med.name} — recorded as skipped. Your caregiver will see this.`, 'warn');
    if (med && refillInfo(med).low) {
      setTimeout(() => toast('Refill running low', `${med.name} has ${med.pills} pills left — order a refill soon.`, 'danger', 6000), 700);
    }
  }
  pushSync(); save(); renderAll(); tick();
}

function submitMedForm(e) {
  e.preventDefault();
  const errs = [];
  const name = $('#medName').value.trim();
  const times = parseTimes($('#medTimes').value);
  if (!name) errs.push('Medication name is required.');
  if (!times) errs.push('Enter valid times in 24-hour format, e.g. 08:00, 20:00.');
  if (times && times.length > 6) errs.push('A medication can have at most 6 times per day.');
  const box = $('#medErrors');
  if (errs.length) { box.innerHTML = errs.map(esc).join('<br>'); box.classList.add('show'); return; }
  box.classList.remove('show');

  const refillSize = clamp(parseInt($('#medRefillSize').value, 10) || 30, 1, 9999);
  const pillsRaw = $('#medPills').value.trim();
  const data = {
    name,
    strength: $('#medStrength').value.trim(),
    amount: $('#medAmount').value.trim(),
    times,
    pills: pillsRaw === '' ? refillSize : clamp(parseInt(pillsRaw, 10) || 0, 0, 9999),
    refillSize,
    start: $('#medStart').value || todayKey(),
    color: $('#medColor').value,
    notes: $('#medNotes').value.trim()
  };

  if (editingId) {
    const med = state.meds.find(m => m.id === editingId);
    Object.assign(med, data);
    toast('Medication updated', `${med.name} — schedule and details saved.`, 'success');
  } else {
    const med = { id: uid(), ...data };
    state.meds.push(med);
    toast('Medication added', `${med.name} scheduled at ${med.times.map(fmtTime).join(', ')}.`, 'success');
  }
  pushSync(); save(); resetMedForm(); renderAll();
}

function submitCgForm(e) {
  e.preventDefault();
  const name = $('#cgName').value.trim();
  const box = $('#cgErrors');
  if (!name) { box.innerHTML = 'Caregiver name is required.'; box.classList.add('show'); return; }
  box.classList.remove('show');
  const cg = {
    id: uid(), name, relation: $('#cgRelation').value,
    contact: $('#cgContact').value.trim(), level: $('#cgAlerts').value
  };
  state.caregivers.push(cg);
  $('#cgForm').reset();
  pushSync(); save(); renderCaregivers(); renderAlerts(); renderHero();
  toast('Caregiver linked', `${cg.name} (${cg.relation}) will now receive adherence alerts.`, 'success');
}

function submitEffForm(e) {
  e.preventDefault();
  const note = $('#effNote').value.trim();
  const box = $('#effErrors');
  if (!note) { box.innerHTML = 'Please describe what you noticed.'; box.classList.add('show'); return; }
  box.classList.remove('show');
  const severity = Number($('#effSeverity').value);
  const entry = { id: uid(), ts: new Date().toISOString(), medId: $('#effMed').value || null, type: $('#effType').value, severity, note };
  state.effects.push(entry);
  $('#effNote').value = '';
  pushSync(); save(); renderEffects(); renderAlerts();
  if (severity >= 4) toast('Escalated to care team', `Severity ${severity} (${SEV_LABEL[severity]}) — your caregivers have been alerted.`, 'danger', 6500);
  else toast('Entry saved', `${entry.type} logged · severity ${severity}.`, 'success');
}

/* ---------------- events ---------------- */
function bind() {
  // nav
  const nav = $('#navbar'), links = $('#navLinks');
  $('#navToggle').addEventListener('click', () => links.classList.toggle('open'));
  $$('.nav-link').forEach(a => a.addEventListener('click', () => links.classList.remove('open')));
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 12);
    const doc = document.documentElement;
    $('#scrollProgress').style.width = (window.scrollY / (doc.scrollHeight - doc.clientHeight) * 100) + '%';
  }, { passive: true });

  // today's dose actions
  $('#todayList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    markDose(btn.dataset.mid, btn.dataset.time, btn.dataset.act);
  });

  // meds grid (delegated)
  $('#medGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const card = btn.closest('.med-card');
    const med = state.meds.find(m => m.id === card.dataset.id);
    if (!med) return;
    const act = btn.dataset.act;
    if (act === 'refill') {
      med.pills = med.refillSize;
      pushSync(); save(); renderAll();
      toast('Refill recorded', `${med.name} reset to ${med.refillSize} pills.`, 'success');
    } else if (act === 'edit') {
      loadMedForm(med);
    } else if (act === 'delete') {
      if (confirm(`Delete ${med.name}? Its adherence history will be kept.`)) {
        state.meds = state.meds.filter(m => m.id !== med.id);
        if (editingId === med.id) resetMedForm();
        pushSync(); save(); renderAll();
        toast('Medication removed', `${med.name} is no longer scheduled.`, 'info');
      }
    }
  });

  $('#medForm').addEventListener('submit', submitMedForm);
  $('#medCancel').addEventListener('click', resetMedForm);

  // caregiver
  $('#cgForm').addEventListener('submit', submitCgForm);
  $('#caregiverList').addEventListener('click', (e) => {
    const btn = e.target.closest('.cg-remove');
    if (!btn) return;
    const cg = state.caregivers.find(c => c.id === btn.dataset.id);
    if (!cg) return;
    state.caregivers = state.caregivers.filter(c => c.id !== cg.id);
    pushSync(); save(); renderCaregivers(); renderHero();
    toast('Caregiver unlinked', `${cg.name} will no longer receive alerts.`, 'info');
  });
  $('#copySyncBtn').addEventListener('click', async () => {
    const code = state.settings.syncCode;
    try { await navigator.clipboard.writeText(code); toast('Sync code copied', `${code} — send it to your caregiver.`, 'success'); }
    catch { toast('Your sync code', code, 'info', 6000); }
  });
  $('#syncNowBtn').addEventListener('click', () => {
    pushSync(); save(); renderCaregivers(); renderAlerts(); renderHero();
    toast('Sync complete', `${state.caregivers.length} caregiver(s) updated · ${fmtClock(Date.now())}.`, 'success');
  });
  $('#sendReportBtn').addEventListener('click', () => {
    const week = rangeStats(7);
    pushSync(); save(); renderCaregivers();
    toast('Weekly report sent', `7-day adherence ${week.pct ?? '—'}% · ${week.taken}/${week.counted} doses · streak ${streakDays()} days.`, 'success', 6000);
  });
  $('#shareToggle').addEventListener('change', (e) => {
    state.settings.share = e.target.checked;
    pushSync(); save(); renderAlerts();
    toast(state.settings.share ? 'Sharing enabled' : 'Sharing paused',
      state.settings.share ? 'Your care team now receives live adherence alerts.' : 'No data will leave this device until you re-enable sharing.',
      state.settings.share ? 'success' : 'warn');
  });

  // journal
  $('#effForm').addEventListener('submit', submitEffForm);
  $('#effSeverity').addEventListener('input', (e) => {
    const v = Number(e.target.value);
    const out = $('#effSeverityVal');
    out.textContent = `${v} · ${SEV_LABEL[v]}`;
    out.className = `severity-badge sev-${v}`;
  });
  $('#effList').addEventListener('click', (e) => {
    const btn = e.target.closest('.eff-del');
    if (!btn) return;
    state.effects = state.effects.filter(x => x.id !== btn.dataset.id);
    save(); renderEffects(); renderAlerts();
    toast('Entry deleted', 'Journal entry removed.', 'info');
  });

  // chat
  $('#chatForm').addEventListener('submit', (e) => { e.preventDefault(); sendChat($('#chatInput').value); $('#chatInput').value = ''; });
  $('#chatChips').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip-btn');
    if (btn) sendChat(btn.dataset.q);
  });
  $('#clearChat').addEventListener('click', () => {
    state.chat = [{ role: 'bot', ts: new Date().toISOString(), text: 'Chat cleared. How can I help you with your schedule?' }];
    save(); chatRender();
  });

  // reminders permission
  $('#enableNotify').addEventListener('click', async () => {
    if (!('Notification' in window)) { toast('Not supported', 'This browser does not support notifications.', 'warn'); return; }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      $('#enableNotify').textContent = 'Reminders enabled ✅';
      toast('Reminders enabled', 'You will be notified at dose time.', 'success');
      notify('CareSync reminders on', 'We will ping you inside each 60-minute dose window.');
    } else {
      toast('Permission not granted', 'In-app toasts will still appear at dose time.', 'warn');
    }
  });

  // FAQ
  $$('.faq-q').forEach(q => q.addEventListener('click', () => {
    const item = q.parentElement, open = item.classList.contains('open');
    $$('.faq-item').forEach(i => { i.classList.remove('open'); i.querySelector('.faq-a').style.maxHeight = null; });
    if (!open) { item.classList.add('open'); const a = item.querySelector('.faq-a'); a.style.maxHeight = a.scrollHeight + 'px'; }
  }));

  // reveal + active link
  const io = new IntersectionObserver((entries) => entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('visible'); io.unobserve(en.target); } }), { threshold: 0.12 });
  $$('.reveal').forEach(el => io.observe(el));

  const sections = ['home', 'dashboard', 'meds', 'companion', 'caregiver', 'journal', 'faq'];
  const spy = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        $$('.nav-link').forEach(l => l.classList.toggle('active', l.getAttribute('href') === `#${en.target.id}`));
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(id => { const el = document.getElementById(id); if (el) spy.observe(el); });

  window.addEventListener('resize', () => { clearTimeout(window.__chartT); window.__chartT = setTimeout(drawWeekChart, 160); });
}

/* ---------------- init ---------------- */
function init() {
  state = load();
  if (!state || !state.meds) state = seed();
  if (!state.settings) state.settings = { share: true, syncCode: makeSyncCode(), lastSync: new Date().toISOString() };
  if (!Array.isArray(state.effects)) state.effects = [];
  if (!Array.isArray(state.caregivers)) state.caregivers = [];
  if (!Array.isArray(state.chat) || !state.chat.length) {
    state.chat = [{ role: 'bot', ts: new Date().toISOString(),
      text: "Hi, I'm your CareSync companion. Ask me about your schedule, adherence, refills or how you're feeling." }];
  }
  if (!state.logs) state.logs = {};
  save();

  resetMedForm();
  bind();
  $('#effSeverity').dispatchEvent(new Event('input'));
  renderAll();
  chatRender();

  if ('Notification' in window && Notification.permission === 'granted') $('#enableNotify').textContent = 'Reminders enabled ✅';

  tick();
  setInterval(tick, 30000);
  setInterval(() => { $('#lastSync').textContent = fmtRel(state.settings.lastSync); $('#hvSync').textContent = fmtRel(state.settings.lastSync); }, 30000);
}

document.addEventListener('DOMContentLoaded', init);
})();
