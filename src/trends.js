/* ---------- trend history & charts ---------- */
const HIST_MAX = 5400;                       // 3 h of simulated time at 2 s
const HIST = { t: [], v: {} };
const TREND_COLORS = ['#3987e5','#d95926','#199e70','#c98500','#d55181','#008300','#9085e9','#e66767'];
let histAcc = 0;
function histRecord(t, d, force) {
  if (!force && t - (HIST.t[HIST.t.length - 1] ?? -1e9) < 2) return;
  HIST.t.push(t);
  const keys = ['lowP','highP','Tsuc','Tliq','Tdis','SH','SC','amps','Ps','Pd'];
  for (let i = 1; i <= 9; i++) keys.push('P' + i, 'T' + i);
  for (const k of keys) { (HIST.v[k] = HIST.v[k] || []).push(d[k]); }
  if (HIST.t.length > HIST_MAX) { HIST.t.shift(); for (const k in HIST.v) HIST.v[k].shift(); }
}
function histClear() { HIST.t.length = 0; for (const k in HIST.v) HIST.v[k].length = 0; }
const clockTxt = t => { const m = Math.floor(t / 60), s = Math.floor(t % 60); return m >= 60 ? `${Math.floor(m/60)}:${String(m%60).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`; };
/* series: [{key, label, color}]; kind 'P' (psig) or 'T' (°F); win seconds or 0 = all */
function drawTrend(cv, series, kind, win, hover) {
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight || 180;
  if (!W) return null;
  cv.width = W * dpr; cv.height = H * dpr; const x = cv.getContext('2d'); x.scale(dpr, dpr);
  const css = getComputedStyle(document.documentElement), col = n => css.getPropertyValue(n).trim();
  const L = 48, R = 14, T = 10, B = 24;
  const n = HIST.t.length; x.clearRect(0, 0, W, H);
  x.font = '11px IBM Plex Mono, monospace'; x.fillStyle = col('--muted');
  if (n < 2 || !series.length) { x.fillText(series.length ? 'Collecting data…' : 'Pick a series to chart.', L, H / 2); return null; }
  const tEnd = HIST.t[n - 1], tStart = win ? Math.max(HIST.t[0], tEnd - win) : HIST.t[0];
  let i0 = 0; while (i0 < n - 1 && HIST.t[i0] < tStart) i0++;
  const conv = v => kind === 'P' ? v - PATM : v;
  let lo = Infinity, hi = -Infinity;
  for (const s of series) { const a = HIST.v[s.key] || []; for (let i = i0; i < n; i++) { const v = conv(a[i]); if (isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } } }
  if (!isFinite(lo)) { x.fillText('No data for this reading yet.', L, H / 2); return null; }
  const pad = Math.max((hi - lo) * 0.08, kind === 'P' ? 5 : 2); lo -= pad; hi += pad;
  const span = tEnd - tStart || 1;
  const X = t => L + (t - tStart) / span * (W - L - R), Y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  // recessive grid + ticks
  const step = (() => { const raw = (hi - lo) / 4, p = Math.pow(10, Math.floor(Math.log10(raw))); return [1,2,5,10].map(k => k * p).find(k => k >= raw); })();
  x.strokeStyle = col('--line'); x.lineWidth = 1; x.textAlign = 'right'; x.textBaseline = 'middle';
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) { const y = Y(v); x.beginPath(); x.moveTo(L, y); x.lineTo(W - R, y); x.stroke(); x.fillText(+v.toFixed(1), L - 6, y); }
  x.textAlign = 'center'; x.textBaseline = 'top';
  for (let k = 0; k <= 4; k++) { const t = tStart + span * k / 4; x.fillText(clockTxt(t), X(t), H - B + 6); }
  x.save(); x.translate(10, T + (H - T - B) / 2); x.rotate(-Math.PI / 2); x.textBaseline = 'middle'; x.fillText(kind === 'P' ? 'psig' : '°F', 0, 0); x.restore();
  // lines (2px), endpoint marker
  const stride = Math.max(1, Math.floor((n - i0) / 700));
  for (const s of series) {
    const a = HIST.v[s.key] || []; x.strokeStyle = s.color; x.lineWidth = 2; x.lineJoin = 'round'; x.beginPath(); let started = false;
    for (let i = i0; i < n; i += stride) { const v = conv(a[i]); if (!isFinite(v)) { started = false; continue; } const px = X(HIST.t[i]), py = Y(v); started ? x.lineTo(px, py) : x.moveTo(px, py); started = true; }
    const lv = conv(a[n - 1]); if (started && isFinite(lv)) x.lineTo(X(tEnd), Y(lv)); x.stroke();
    if (isFinite(lv)) { x.fillStyle = col('--panel2'); x.beginPath(); x.arc(X(tEnd), Y(lv), 4, 0, 7); x.fill(); x.fillStyle = s.color; x.beginPath(); x.arc(X(tEnd), Y(lv), 3, 0, 7); x.fill(); }
  }
  // crosshair
  let readout = null;
  if (hover != null && hover >= L && hover <= W - R) {
    const th = tStart + (hover - L) / (W - L - R) * span;
    let i = i0; while (i < n - 1 && HIST.t[i + 1] <= th) i++;
    if (i + 1 < n && Math.abs(HIST.t[i + 1] - th) < Math.abs(HIST.t[i] - th)) i++;
    const px = X(HIST.t[i]); x.strokeStyle = col('--muted'); x.lineWidth = 1; x.beginPath(); x.moveTo(px, T); x.lineTo(px, H - B); x.stroke();
    readout = { t: HIST.t[i], px, rows: series.map(s => { const v = conv((HIST.v[s.key] || [])[i]); if (isFinite(v)) { x.fillStyle = s.color; x.beginPath(); x.arc(px, Y(v), 4, 0, 7); x.fill(); } return { label: s.label, color: s.color, v }; }) };
  }
  return readout;
}
function attachTrendHover(wrap, redraw) {
  const cv = wrap.querySelector('canvas'), tip = wrap.querySelector('.ttip');
  const show = r => { if (!r) { tip.style.display = 'none'; return; }
    tip.replaceChildren(); const h = document.createElement('div'); h.className = 'tt-h'; h.textContent = 't = ' + clockTxt(r.t); tip.appendChild(h);
    for (const row of r.rows) { const d = document.createElement('div'); d.className = 'tt-r'; const sw = document.createElement('i'); sw.style.background = row.color; const b = document.createElement('b'); b.textContent = isFinite(row.v) ? row.v.toFixed(1) : '—'; const sp = document.createElement('span'); sp.textContent = row.label; d.append(sw, b, sp); tip.appendChild(d); }
    tip.style.display = 'block'; const left = r.px + 12 + tip.offsetWidth > cv.clientWidth ? r.px - 12 - tip.offsetWidth : r.px + 12; tip.style.left = left + 'px'; };
  cv.onpointermove = ev => { const rect = cv.getBoundingClientRect(); wrap.dataset.hx = ev.clientX - rect.left; show(redraw(+wrap.dataset.hx)); };
  cv.onpointerleave = () => { delete wrap.dataset.hx; tip.style.display = 'none'; redraw(null); };
}

/* ---------- chart in the readings panel ---------- */
const PC = { kind: 'P', win: 900, sel: '' };
function portLabel(i) { return `${i} · ${PORTSHORT[physHeat() ? 'heat' : 'cool'][i - 1]}`; }
function probeSeries() {
  if (!selected) return [];
  if (selected.kind === 'tp') return [{ key: PC.kind + selected.id, label: portLabel(selected.id), color: TREND_COLORS[0] }];
  if (selected.id === 'comp') return PC.kind === 'P'
    ? [{ key: 'Ps', label: 'Suction', color: TREND_COLORS[0] }, { key: 'Pd', label: 'Discharge', color: TREND_COLORS[1] }]
    : [{ key: 'T9', label: 'Suction gas', color: TREND_COLORS[0] }, { key: 'Tdis', label: 'Discharge line', color: TREND_COLORS[1] }];
  return [];
}
function updateProbeChart() {
  const box = $('probeChart'); if (!box) return;
  const show = selected && (selected.kind === 'tp' || selected.id === 'comp');
  const selKey = show ? selected.kind + selected.id : '';
  if (!show) { box.innerHTML = ''; PC.sel = ''; return; }
  if (PC.sel !== selKey) {
    PC.sel = selKey;
    const isTp = selected.kind === 'tp';
    box.innerHTML = `<div class="pchart"><div class="pc-bar"><span class="seg" role="group" aria-label="Chart pressure or temperature"><button data-pk="P">Pressure</button><button data-pk="T">Temperature</button></span>
      <select id="pcWin" aria-label="Time window"><option value="300">Last 5 min</option><option value="900">Last 15 min</option><option value="3600">Last hour</option><option value="0">All</option></select>
      ${isTp ? '<button class="btn" id="pcAdd"></button>' : ''}</div>
      <div class="chartwrap" id="pcWrap"><canvas style="height:170px"></canvas><div class="ttip"></div></div><div class="legend2" id="pcLegend"></div></div>`;
    box.querySelectorAll('[data-pk]').forEach(b => b.addEventListener('click', () => { PC.kind = b.dataset.pk; updateProbeChart(); }));
    $('pcWin').value = String(PC.win); $('pcWin').addEventListener('change', e => { PC.win = +e.target.value; drawProbeChart(); });
    if (isTp) $('pcAdd').addEventListener('click', () => { toggleTrend('port' + selected.id); updateProbeChart(); });
    attachTrendHover($('pcWrap'), hx => drawTrend($('pcWrap').querySelector('canvas'), probeSeries(), PC.kind, PC.win, hx));
  }
  box.querySelectorAll('[data-pk]').forEach(b => b.classList.toggle('on', b.dataset.pk === PC.kind));
  const add = $('pcAdd'); if (add) add.textContent = TR.sel.includes('port' + selected.id) ? 'Remove from Trends' : 'Add to Trends';
  const ser = probeSeries();
  $('pcLegend').innerHTML = ser.length > 1 ? ser.map(s => `<span><i style="background:${s.color}"></i>${esc(s.label)}</span>`).join('') : '';
  drawProbeChart();
}
function drawProbeChart() { const w = $('pcWrap'); if (!w) return; drawTrend(w.querySelector('canvas'), probeSeries(), PC.kind, PC.win, w.dataset.hx != null ? +w.dataset.hx : null); }

/* ---------- Trends tab ---------- */
const TR = { kind: 'P', win: 900, sel: ['port9', 'port1'], slot: { port9: 0, port1: 1 } };
function trendEntities() {
  const ents = [];
  for (let i = 1; i <= 9; i++) ents.push({ id: 'port' + i, label: portLabel(i), P: 'P' + i, T: 'T' + i });
  ents.push({ id: 'lowP', label: 'Low-side gauge', P: 'lowP' }, { id: 'highP', label: 'High-side gauge', P: 'highP' },
            { id: 'Tsuc', label: 'Suction line (SH point)', T: 'Tsuc' }, { id: 'Tliq', label: 'Liquid line (SC point)', T: 'Tliq' },
            { id: 'Tdis', label: 'Discharge line', T: 'Tdis' }, { id: 'SH', label: 'Superheat', T: 'SH' }, { id: 'SC', label: 'Subcooling', T: 'SC' });
  return ents;
}
function toggleTrend(id) {
  const i = TR.sel.indexOf(id);
  if (i >= 0) { TR.sel.splice(i, 1); delete TR.slot[id]; }
  else {
    if (TR.sel.length >= 8) { logEvent('Trends hold up to eight series — remove one first.'); return; }
    const used = new Set(Object.values(TR.slot)); let k = 0; while (used.has(k)) k++;
    TR.sel.push(id); TR.slot[id] = k;
  }
  renderTrendPicks(); drawTrendsTab();
}
function trendSeries() {
  const ents = trendEntities();
  return TR.sel.map(id => ents.find(e => e.id === id)).filter(e => e && e[TR.kind]).map(e => ({ key: e[TR.kind], label: e.label, color: TREND_COLORS[TR.slot[e.id]] }));
}
function renderTrendPicks() {
  const box = $('trendPicks'); if (!box) return;
  box.innerHTML = trendEntities().filter(e => e[TR.kind]).map(e => { const on = TR.sel.includes(e.id);
    return `<label><input type="checkbox" data-te="${e.id}"${on ? ' checked' : ''}><span class="sw" style="background:${on ? TREND_COLORS[TR.slot[e.id]] : 'transparent'}"></span>${esc(e.label)}</label>`; }).join('');
  box.querySelectorAll('[data-te]').forEach(c => c.addEventListener('change', () => toggleTrend(c.dataset.te)));
  const ser = trendSeries();
  $('trendLegend').innerHTML = ser.map(s => `<span><i style="background:${s.color}"></i>${esc(s.label)}</span>`).join('');
}
function drawTrendsTab() { const w = $('trendWrap'); if (!w || !w.offsetParent) return; drawTrend($('trendCv'), trendSeries(), TR.kind, TR.win, w.dataset.hx != null ? +w.dataset.hx : null); }
function setupTrendsTab() {
  document.querySelectorAll('[data-tk]').forEach(b => b.addEventListener('click', () => { TR.kind = b.dataset.tk; document.querySelectorAll('[data-tk]').forEach(x => x.classList.toggle('on', x === b)); renderTrendPicks(); drawTrendsTab(); }));
  $('trendWin').addEventListener('change', e => { TR.win = +e.target.value; drawTrendsTab(); });
  $('trendClear').addEventListener('click', () => { histClear(); histRecord(S.t, disp, true); drawTrendsTab(); drawProbeChart(); });
  attachTrendHover($('trendWrap'), hx => drawTrend($('trendCv'), trendSeries(), TR.kind, TR.win, hx));
  renderTrendPicks();
}
