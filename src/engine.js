/* Heat pump cycle engine — steady-state moving-boundary model.
   Units: psia, °F, Btu/lb, lb/h, Btu/h, CFM, lb/ft3. */
(function (root) {
'use strict';
const PATM = 14.696, GC = 32.174;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function lin(xs, ys, x) {
  const n = xs.length; let i;
  if (x <= xs[0]) i = 0; else if (x >= xs[n - 1]) i = n - 2;
  else { let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; } i = lo; }
  const t = (x - xs[i]) / (xs[i + 1] - xs[i]);
  return ys[i] + t * (ys[i + 1] - ys[i]);
}
function bisect(f, a, b, it = 50) {
  let fa = f(a), fb = f(b);
  if (fa * fb > 0) return Math.abs(fa) < Math.abs(fb) ? a : b;
  for (let k = 0; k < it; k++) { const m = 0.5 * (a + b), fm = f(m); if (fa * fm <= 0) { b = m; fb = fm; } else { a = m; fa = fm; } if (b - a < 1e-7) break; }
  return 0.5 * (a + b);
}

/* ---------------- Refrigerant properties ---------------- */
function Fluid(name, D) {
  const S = D.sat; this.name = name; this.Tc = D.Tc; this.Pc = D.Pc;
  const T = S.map(r => r[0]), lnP = S.map(r => Math.log(r[1])), hl = S.map(r => r[2]), rl = S.map(r => r[4]), g = S.map(r => r[8]);
  const Td = T.map((t, i) => t + g[i] / 2), Tb = T.map((t, i) => t - g[i] / 2);
  this.Pmin = S[0][1]; this.Pmax = S[S.length - 1][1]; this.Tmin = T[0]; this.Tmax = T[T.length - 1];
  this.tMid = P => lin(lnP, T, Math.log(P));
  this.glide = P => lin(lnP, g, Math.log(P));
  this.tDew = P => lin(lnP, Td, Math.log(P));
  this.tBub = P => lin(lnP, Tb, Math.log(P));
  this.pDew = t => Math.exp(lin(Td, lnP, t));
  this.pBub = t => Math.exp(lin(Tb, lnP, t));
  this.hLiqT = t => lin(T, hl, t);
  this.rhoLiqT = t => lin(T, rl, t);
  this.hBub = P => this.hLiqT(this.tBub(P));
  this.rhoBub = P => this.rhoLiqT(this.tBub(P));
  this.liqTfromH = h => lin(hl, T, h);
  const lp = D.supP.map(Math.log), SH = D.supSH, G = D.sup;
  this.vap = (P, sh) => {
    const x = Math.log(P); let i;
    if (x <= lp[0]) i = 0; else if (x >= lp[lp.length - 1]) i = lp.length - 2; else { i = 0; while (lp[i + 1] < x) i++; }
    const tx = (x - lp[i]) / (lp[i + 1] - lp[i]);
    const s = Math.max(0, sh); let j;
    if (s >= SH[SH.length - 1]) j = SH.length - 2; else { j = 0; while (SH[j + 1] < s) j++; }
    const ty = (s - SH[j]) / (SH[j + 1] - SH[j]);
    const out = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      const a = G[i][j][k] + ty * (G[i][j + 1][k] - G[i][j][k]);
      const b = G[i + 1][j][k] + ty * (G[i + 1][j + 1][k] - G[i + 1][j][k]);
      out[k] = a + tx * (b - a);
    }
    return { h: out[0], s: out[1], rho: out[2] };
  };
  this.hDew = P => this.vap(P, 0).h;
  this.rhoDew = P => this.vap(P, 0).rho;
  this.shFromH = (P, h) => bisect(s => this.vap(P, s).h - h, 0, 400, 40);
  this.isenH = (P1, sh1, P2) => { const s1 = this.vap(P1, sh1).s; const sh2 = bisect(s => this.vap(P2, s).s - s1, 0, 400, 40); return this.vap(P2, sh2).h; };
  this.state = (P, h) => {
    const hb = this.hBub(P), hd = this.hDew(P), tb = this.tBub(P), td = this.tDew(P);
    if (h <= hb) { const T = this.liqTfromH(h); return { phase: 'liq', T, x: 0, sc: tb - T, sh: 0, rho: this.rhoLiqT(T), tb, td }; }
    if (h >= hd) { const sh = this.shFromH(P, h); return { phase: 'vap', T: td + sh, x: 1, sh, sc: 0, rho: this.vap(P, sh).rho, tb, td }; }
    const x = (h - hb) / (hd - hb), rl = this.rhoBub(P), rv = this.rhoDew(P);
    return { phase: '2ph', T: tb + x * (td - tb), x, sh: 0, sc: 0, rho: 1 / (x / rv + (1 - x) / rl), tb, td };
  };
  // mean two-phase density using Zivi slip void fraction
  this.rhoTP = (P, x1, x2) => {
    const rl = this.rhoBub(P), rv = this.rhoDew(P), N = 10; let s = 0;
    const a = Math.min(x1, x2), b = Math.max(x1, x2);
    if (b - a < 1e-6) { const x = Math.max(a, 1e-4); const al = 1 / (1 + (1 - x) / x * Math.pow(rv / rl, 2 / 3)); return al * rv + (1 - al) * rl; }
    for (let k = 0; k < N; k++) { const x = Math.max(1e-4, a + (b - a) * (k + 0.5) / N); const al = 1 / (1 + (1 - x) / x * Math.pow(rv / rl, 2 / 3)); s += al * rv + (1 - al) * rl; }
    return s / N;
  };
}

/* ---------------- Psychrometrics (IP) ---------------- */
const Psy = {
  pws(T) { const c = (T - 32) / 1.8; const kPa = c >= 0 ? 0.61094 * Math.exp(17.625 * c / (c + 243.04)) : 0.61115 * Math.exp(22.452 * c / (272.55 + c)); return kPa * 0.145038; },
  Ws(T) { const p = Psy.pws(T); return 0.621945 * p / (PATM - p); },
  W_DBWB(db, wb) { const ws = Psy.Ws(wb); return wb >= 32 ? ((1093 - 0.556 * wb) * ws - 0.240 * (db - wb)) / (1093 + 0.444 * db - wb) : ((1220 - 0.04 * wb) * ws - 0.240 * (db - wb)) / (1220 + 0.444 * db - 0.48 * wb); },
  h(T, W) { return 0.240 * T + W * (1061 + 0.444 * T); },
  T_hW(h, W) { return (h - 1061 * W) / (0.240 + 0.444 * W); },
  hs(T) { return Psy.h(T, Psy.Ws(T)); },
  RH(T, W) { const pw = W * PATM / (0.621945 + W); return pw / Psy.pws(T); },
  dew(W) { const pw = W * PATM / (0.621945 + W); return bisect(t => Psy.pws(t) - pw, -60, 200, 50); },
  WB(db, W) { return bisect(wb => Psy.W_DBWB(db, wb) - W, -40, db, 50); },
  v(T, W) { return 0.370486 * (T + 459.67) * (1 + 1.607858 * W) / PATM; },
  full(T, W) { const rh = Psy.RH(T, W); return { db: T, W, wb: Psy.WB(T, W), rh: rh * 100, dp: Psy.dew(W), h: Psy.h(T, W), gr: W * 7000 }; },
};

/* ---------------- Equipment catalogue ---------------- */
const COIL = {
  tf: { name: 'Tube & fin', NTUe: 0.85, NTUc: 1.15, NTUcId: 1.5, NTUeOd: 1.1, volE: 0.034, volC: 0.085, dpE: 4, dpC: 5, cfmId: 400, cfmOd: 900 },
  mc: { name: 'Microchannel', NTUe: 1.0, NTUc: 1.4, NTUcId: 1.75, NTUeOd: 1.3, volE: 0.013, volC: 0.026, dpE: 5, dpC: 6, cfmId: 400, cfmOd: 820 },
  water: { name: 'Coaxial (water)', NTUe: 2.3, NTUc: 2.3, NTUcId: 2.3, NTUeOd: 2.3, volE: 0.045, volC: 0.045, dpE: 6, dpC: 6 },
};
function lineIDs(tons) {
  const liq = tons <= 5 ? 0.311 : 0.430;
  const vap = tons <= 2 ? 0.555 : tons <= 3 ? 0.666 : tons <= 4 ? 0.785 : tons <= 7.5 ? 1.025 : 1.265;
  return { liq, vap, liqOD: tons <= 5 ? '3/8"' : '1/2"', vapOD: tons <= 2 ? '5/8"' : tons <= 3 ? '3/4"' : tons <= 4 ? '7/8"' : tons <= 7.5 ? '1-1/8"' : '1-3/8"' };
}
const area = d => Math.PI / 4 * (d / 12) ** 2;
const effCF = (NTU, Cr) => Cr < 1e-6 ? 1 - Math.exp(-NTU) : 1 - Math.exp(Math.pow(NTU, 0.22) / Cr * (Math.exp(-Cr * Math.pow(NTU, 0.78)) - 1));

/* Default switch settings by refrigerant (psig) */
function defaultSwitches(F) {
  const r5 = p => Math.round(p / 5) * 5;
  const g = t => F.pDew(t) - PATM;
  const hpsSat = F.name === 'R-404A' || F.name === 'R-407C' ? 140 : 149;
  return { hpsOpen: r5(g(hpsSat)), hpsClose: r5(g(hpsSat - 25)), lpsOpen: r5(Math.max(g(-15), 3)), lpsClose: r5(g(20)), asc: 300, lpsBypass: 90, maxTrips: 3 };
}

/* ---------------- Context builder ---------------- */
function buildCtx(cfg, FL) {
  const F = FL[cfg.refrigerant], tons = cfg.tons, heat = cfg.mode === 'heat';
  const idC = COIL[cfg.indoor.type], odC = COIL[cfg.outdoor.type];
  const water = cfg.outdoor.type === 'water';
  const L = cfg.lineLen, ids = lineIDs(tons);
  // airflows
  const idCfmNom = idC.cfmId * tons;
  let idCfm;
  const esp = cfg.blower.esp;
  if (cfg.blower.type === 'ecm') { const maxEsp = 0.9; idCfm = cfg.blower.cfm * (esp <= maxEsp ? 1 : Math.max(0.3, 1 - 0.9 * (esp - maxEsp))); }
  else idCfm = cfg.blower.cfm * Math.max(0.3, 1 - 0.42 * (esp - 0.5));
  idCfm *= cfg.faults?.idAirflow ?? 1;
  idCfm = Math.max(idCfm, 0.04 * idC.cfmId * tons);          // leakage/natural draft floor
  const odCfmNom = (odC.cfmOd || 900) * tons, odCfm = Math.max(0.04 * odCfmNom, odCfmNom * cfg.odFan.pct / 100 * (cfg.faults?.odAirflow ?? 1));
  const idAir = heat ? { db: cfg.cond.idDB, W: Psy.W_DBWB(cfg.cond.idDB, cfg.cond.idWB) } : { db: cfg.cond.idDB, W: Psy.W_DBWB(cfg.cond.idDB, cfg.cond.idWB) };
  const odAir = { db: cfg.cond.odDB, W: Psy.W_DBWB(cfg.cond.odDB, Math.min(cfg.cond.odWB, cfg.cond.odDB)) };
  const air = (a, cfm) => { const v = Psy.v(a.db, a.W), ma = cfm * 60 / v; return { kind: 'air', T: a.db, W: a.W, h: Psy.h(a.db, a.W), ma, C: ma * (0.240 + 0.444 * a.W), cfm }; };
  const gpmNom = 3 * tons, gpm = Math.max(0.1 * tons, cfg.water.gpm);
  const wtr = { kind: 'water', T: cfg.water.ewt, C: gpm * 500, gpm, ma: gpm * 500 };
  const idStream = air(idAir, idCfm), odStream = water ? wtr : air(odAir, odCfm);
  // coil UA
  const sz = s => s / 100;
  const idNomC = idCfmNom * 60 / 13.5 * 0.244, odNomC = water ? gpmNom * 500 : odCfmNom * 60 / 13.7 * 0.242;
  const fouling = cfg.faults || {};
  const idUA = (heat ? idC.NTUcId : idC.NTUe) * idNomC * sz(cfg.indoor.size) * Math.pow(idStream.C / idNomC, 0.5) * (fouling.idUA ?? 1);
  const odUA = (heat ? odC.NTUeOd : odC.NTUc) * odNomC * sz(cfg.outdoor.size) * Math.pow(odStream.C / odNomC, water ? 0.6 : 0.5) * (fouling.odUA ?? 1);
  const idVol = (heat ? idC.volC : idC.volE) * tons * sz(cfg.indoor.size);
  const odVol = (heat ? odC.volE : odC.volC) * tons * sz(cfg.outdoor.size);
  const ctx = {
    F, cfg, tons, heat, water, ids,
    evap: heat ? { stream: odStream, UA: odUA, vol: odVol, dp: odC.dpE, name: 'outdoor' } : { stream: idStream, UA: idUA, vol: idVol, dp: idC.dpE, name: 'indoor' },
    cond: heat ? { stream: idStream, UA: idUA, vol: idVol, dp: idC.dpC * 0.8, name: 'indoor' } : { stream: odStream, UA: odUA, vol: odVol, dp: odC.dpC, name: 'outdoor' },
    idStream, odStream, idCfm, odCfm, idCfmNom, odCfmNom,
    Vll: area(ids.liq) * L, Vvl: area(ids.vap) * L,
    Vcomp: cfg.matched.Vcomp || 0, VcompH: cfg.matched.VcompH || 0, Vshell: 0.04 * tons, Vdl: 0.006 * tons, Vacc: 0.035 * tons, oil: 0.12 * tons,
    mNom: cfg.matched.mNom, rhoSucNom: cfg.matched.rhoSucNom,
    disp: cfg.matched.disp,
  };
  // compressor speed
  const c = cfg.comp; let spd = 1;
  if (c.type === 'two') spd = c.stage === 'low' ? 0.67 : 1;
  else if (c.type === 'inv') spd = c.speed / 100;
  ctx.speed = spd * (fouling.compSpeed ?? 1);
  ctx.meter = heat ? cfg.outdoor : cfg.indoor;
  ctx.meterK = heat ? cfg.matched.out : cfg.matched.in;
  return ctx;
}

/* ---------------- Coil zone helpers ---------------- */
function fracForQ(Q, UA, st, Cr, Thot, Tcold, heating) {
  // fraction of coil (air & area) needed to transfer Q between refrigerant (capacity Cr) and stream
  if (Q <= 0) return 0;
  const dT = heating ? Thot - st.T : st.T - Tcold;   // condenser: refrigerant hot; evaporator: air hot
  if (dT <= 0.01) return 5 + Q / 1e4;
  const q = f => { const Ca = f * st.C; const Cmin = Math.min(Ca, Cr), Cmax = Math.max(Ca, Cr); const NTU = f * UA / Cmin; return effCF(NTU, Cmin / Cmax) * Cmin * dT; };
  if (q(5) < Q) return 5 + (Q - q(5)) / Math.max(q(5) / 5, 1);
  return bisect(f => q(f) - Q, 1e-6, 5, 45);
}

/* ---------------- Cycle residuals ---------------- */
function cycle(ctx, x, detail) {
  const { F, cfg } = ctx; const [Te, Tc, wc, we] = x;
  const out = {};
  const PeOut = F.pDew(Te), PcIn = F.pDew(Tc);
  const mN = ctx.mNom, rN = ctx.rhoSucNom;
  const es = ctx.evap.stream, cs = ctx.cond.stream;
  const hdE = F.hDew(PeOut), hbE = F.hBub(PeOut);
  const cpv = (F.vap(PeOut, 10).h - hdE) / 10;
  const fsh = we > 0 ? Math.min(we / 100, 0.98) : 0;
  let xEo = we >= 0 ? 1 : clamp(1 + we / 100, 0.3, 1);
  const kv = 2.5 * (cfg.lineLen / 25) * rN / (mN * mN), kRV = 1.5 * rN / (mN * mN), kAcc = 1.0 * rN / (mN * mN);
  const sucRestr = (cfg.faults?.suctionRestr ?? 0) * 8 * kv;
  let m = mN, Ps = PeOut, rhoS = 1, shS = 0, wet = false, hEo = hdE, SH = 0, dPs = 0, Pd = PcIn, PR = 2, etaV = 0.9, dPd = 0;
  for (let k = 0; k < 6; k++) {
    if (we > 0) {
      const Ca = fsh * es.C, Cr = m * cpv, Cmin = Math.min(Ca, Cr), Cmax = Math.max(Ca, Cr);
      const eps = effCF(fsh * ctx.evap.UA / Cmin, Cmin / Cmax);
      hEo = hdE + eps * Cmin * Math.max(0, es.T - Te) / m;
    } else hEo = hbE + xEo * (hdE - hbE);
    const rhoEo = F.state(PeOut, hEo).rho;
    dPs = ((ctx.heat ? 0 : kv) + kRV + kAcc + sucRestr) * m * m / rhoEo;
    Ps = Math.max(F.Pmin * 1.01, PeOut - dPs);
    const st = F.state(Ps, hEo);
    wet = st.phase !== 'vap'; shS = st.sh; rhoS = st.rho;
    dPd = (ctx.heat ? kv * m * m / (F.rhoDew(PcIn) * 0.85) : 0) + 1.0 * (m / mN) ** 2;
    Pd = PcIn + dPd; PR = Pd / Ps;
    etaV = clamp(0.985 - 0.014 * PR, 0.3, 0.97);
    m = Math.max(1, rhoS * ctx.disp * ctx.speed * etaV);
  }
  SH = we > 0 ? F.shFromH(PeOut, hEo) : 0;
  // compression
  const h1 = hEo, shSuc = wet ? 0 : shS;
  const hsucEff = wet ? F.hDew(Ps) : h1;
  const h2s = F.isenH(Ps, shSuc, Pd);
  let etaIs = clamp(0.78 - 0.022 * (PR - 2.9) ** 2, 0.3, 0.785);
  if (cfg.comp.type === 'inv') etaIs *= 1 - 0.18 * (ctx.speed - 0.85) ** 2;
  if (cfg.comp.type === 'two' && ctx.speed < 0.9) etaIs *= 0.97;
  etaIs *= cfg.faults?.compEff ?? 1;
  const etaMot = cfg.comp.type === 'inv' ? 0.88 : 0.9;
  const Wel = m * (h2s - hsucEff) / etaIs / etaMot;
  const hDis = h1 + Wel * (1 - 0.07) / m;
  // condenser
  const Pco = PcIn - ctx.cond.dp * (m / mN) ** 1.8;
  const hdC = F.hDew(PcIn), tdC = F.tDew(PcIn), tbCo = F.tBub(Pco), hbCo = F.hBub(Pco);
  const disSt = F.state(PcIn, hDis);
  const f3 = wc > 0 ? Math.min(wc / 100, 0.98) : 0;
  let hCo, xCo = 0, SC = 0, Tliq;
  if (wc > 0) {
    const cpl = (F.hLiqT(tbCo) - F.hLiqT(tbCo - 10)) / 10;
    const Ca = f3 * cs.C, Cr = m * cpl, Cmin = Math.min(Ca, Cr), Cmax = Math.max(Ca, Cr);
    const eps = effCF(f3 * ctx.cond.UA / Cmin, Cmin / Cmax);
    hCo = hbCo - eps * Cmin * Math.max(0, tbCo - cs.T) / m;
    Tliq = F.liqTfromH(hCo); SC = tbCo - Tliq;
  } else { xCo = clamp(-wc / 100, 0, 0.95); hCo = hbCo + xCo * (F.hDew(Pco) - hbCo); Tliq = F.state(Pco, hCo).T; }
  const Q1 = m * Math.max(0, hDis - hdC);
  const f1 = fracForQ(Q1, ctx.cond.UA, cs, Q1 / Math.max(0.5, disSt.T - tdC), disSt.T, 0, true);
  const hEnd2 = wc > 0 ? hbCo : hCo, Tend2 = wc > 0 ? tbCo : Tliq;
  const Q2 = m * Math.max(0, hdC - hEnd2);
  const eps2 = 1 - Math.exp(-ctx.cond.UA / cs.C);
  const f2 = Q2 / Math.max(1, eps2 * cs.C * Math.max(0.05, 0.5 * (tdC + Tend2) - cs.T));
  const r2 = 1 - (f1 + f2 + f3);
  // liquid line, metering, evaporator inlet
  const Pmi = Pco - 1.5 * (cfg.lineLen / 25) * (m / mN) ** 1.8 - (cfg.faults?.liquidRestr ?? 0) * 60 * (m / mN) ** 2;
  const PeIn = PeOut + ctx.evap.dp * (m / mN) ** 1.8;
  const hEi = hCo, eiSt = F.state(PeIn, hEi);
  const Tout2 = we >= 0 ? Te : F.state(PeOut, hEo).T;
  const Ttp = 0.5 * (eiSt.T + Tout2);
  const QtpReq = m * Math.max(0, Math.min(hEo, hdE) - hEi);
  const epsE = 1 - Math.exp(-ctx.evap.UA / es.C);
  let qtp1, wetCoil = false;
  if (es.kind === 'air') {
    const qd = epsE * es.C * (es.T - Ttp), qw = epsE * es.ma * (es.h - Psy.hs(Ttp));
    wetCoil = qw > qd; qtp1 = Math.max(qd, qw);
  } else qtp1 = epsE * es.C * (es.T - Ttp);
  const ftp = QtpReq / Math.max(1, qtp1);
  const r1 = 1 - (ftp + fsh);
  // metering
  const mode = cfg.chargeMode;
  let r3, r4, mMeter = 0, open = null;
  const upSt = F.state(Pmi, hCo);
  const dP = Math.max(0.1, Pmi - PeIn);
  const SHv = we >= 0 ? SH : we / 3;              // continuous "superheat signal" for flooded coil
  const SCv = wc >= 0 ? SC : wc / 3;
  if (mode === 'sandbox' || mode === 'size') r3 = (SHv - cfg.shTarget) / 10;
  else {
    const M = ctx.meter, K = ctx.meterK, rho = upSt.rho;
    const tpPen = upSt.phase === '2ph' ? Math.max(0.15, 1 - 1.2 * upSt.x) : 1;
    if (M.meter === 'piston') {
      const d = M.piston || K.piston;
      mMeter = 3600 * 0.52 * area(d) * Math.sqrt(2 * GC * rho * dP * 144) * tpPen;
    } else {
      const eev = M.meter === 'eev';
      const stat = eev ? M.eevSH - 0.3 : M.txvSet, G = eev ? 0.6 : 6;
      const Kf = (eev ? K.eevK : K.txvK) * (cfg.faults?.meterCap ?? 1);
      let o = (SHv - stat) / G;
      if (cfg.faults?.txvStuck != null) o = cfg.faults.txvStuck + 0.0005 * o;
      open = o < 0 ? 0.004 * o : o > 1 ? 1 + 0.004 * (o - 1) : o;
      mMeter = 3600 * Kf * open * Math.sqrt(2 * GC * rho * dP * 144) * tpPen;
    }
    r3 = (mMeter - m) / mN;
  }
  // charge inventory
  const sC = Math.max(1e-6, f1 + f2 + f3), sE = Math.max(1e-6, ftp + fsh);
  const rhoDes = 0.5 * (disSt.rho + F.rhoDew(PcIn));
  const rhoC2 = F.rhoTP(PcIn, 1, xCo);
  const rhoC3 = F.rhoLiqT(0.5 * (tbCo + Tliq));
  const mCond = ctx.cond.vol * (f1 * rhoDes + f2 * rhoC2 + f3 * rhoC3) / sC;
  const xEi = eiSt.phase === '2ph' ? eiSt.x : eiSt.phase === 'liq' ? 0 : 1;
  const rhoE2 = F.rhoTP(PeOut, xEi, xEo);
  const rhoE3 = 0.5 * (F.rhoDew(PeOut) + F.state(PeOut, hEo).rho);
  const mEvap = ctx.evap.vol * (ftp * rhoE2 + fsh * rhoE3) / sE;
  const mLL = ctx.Vll * upSt.rho;
  const mVL = ctx.Vvl * (ctx.heat ? disSt.rho : F.state(PeOut, hEo).rho);
  const accLiq = we < 0 ? ctx.Vacc * F.rhoBub(Ps) * clamp(-we / 15, 0, 0.85) : 0;
  const mComp = ctx.Vcomp * (ctx.heat ? rhoS : F.rhoLiqT(Tliq)) + ctx.VcompH * (ctx.heat ? F.rhoLiqT(Tliq) : rhoS);
  const mShell = ctx.Vshell * rhoS + ctx.Vdl * disSt.rho + ctx.Vacc * rhoS + ctx.oil + accLiq + mComp;
  const inv = mCond + mEvap + mLL + mVL + mShell;
  if (mode === 'sandbox') r4 = (SCv - cfg.scTarget) / 10;
  else r4 = (inv - cfg.charge) / cfg.charge * 5;
  const res = [r1, r2, r3, r4];
  if (!detail) return res;
  Object.assign(out, { res, Te, Tc, SC, SH, zc: wc >= 0 ? SC : -xCo * 100, ze: we >= 0 ? SH : -(1 - xEo) * 100,
    PeOut, PeIn, PcIn, Pco, Pmi, Ps, Pd, PR, dPs, dPd, m, h1, hDis, hCo, hEi, hEo, Wel, etaIs, etaV, shSuc, wet, disSt, upSt, eiSt,
    Tliq, xCo, xEo, f: { f1, f2, f3, ftp, fsh }, inv, mMeter, open, qtp1, wetCoil, epsE, eps2, Ttp,
    mParts: { cond: mCond, evap: mEvap, liquidLine: mLL, vaporLine: mVL, compressorAcc: mShell } });
  return out;
}

/* ---------------- Newton solver ---------------- */
function gauss(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-12) M[c][c] = 1e-12;
    for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  const x = Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r]; }
  return x;
}
const nrm = v => Math.sqrt(v.reduce((a, b) => a + (isFinite(b) ? b * b : 1e6), 0));

function newton(ctx, x0, bounds) {
  const cl = x => x.map((v, i) => clamp(v, bounds[i][0], bounds[i][1]));
  let x = cl(x0), F = cycle(ctx, x), n = nrm(F);
  const lim = [6, 6, 10, 10];
  for (let it = 0; it < 70 && n > 2e-6; it++) {
    const J = [[], [], [], []];
    for (let j = 0; j < 4; j++) {
      const xp = x.slice(); let h = 0.02; xp[j] += h;
      if (xp[j] > bounds[j][1]) { xp[j] = x[j] - h; h = -h; }
      const Fp = cycle(ctx, xp);
      for (let i = 0; i < 4; i++) J[i][j] = (Fp[i] - F[i]) / h;
    }
    let dx = gauss(J, F.map(v => -v));
    if (dx.some(v => !isFinite(v))) break;
    let s = 1; dx.forEach((v, i) => { if (Math.abs(v) > lim[i]) s = Math.min(s, lim[i] / Math.abs(v)); });
    dx = dx.map(v => v * s);
    let lam = 1, ok = false;
    for (let k = 0; k < 8; k++) {
      const xn = cl(x.map((v, i) => v + lam * dx[i])); const Fn = cycle(ctx, xn); const nn = nrm(Fn);
      if (nn < n) { x = xn; F = Fn; n = nn; ok = true; break; }
      lam /= 2;
    }
    if (!ok) { const xn = cl(x.map((v, i) => v + 0.05 * dx[i])); x = xn; F = cycle(ctx, x); n = nrm(F); }
  }
  return { x, n };
}

function solveCtx(ctx, guess) {
  const F = ctx.F;
  const Tei = ctx.evap.stream.T, Tci = ctx.cond.stream.T;
  const bounds = [[F.Tmin + 3, Tei - 0.3], [Tci + 0.3, F.Tmax - 1.5], [-94, 98], [-50, 98]];
  const starts = [];
  if (guess) starts.push(guess);
  starts.push([Tei - 30, Tci + 22, 12, 6], [Tei - 45, Tci + 15, 3, 30], [Tei - 20, Tci + 35, 35, 3], [Tei - 60, Tci + 10, -5, 60], [Tei - 12, Tci + 45, 60, -5], [Tei - 25, Tci + 25, 20, -10]);
  let best = null;
  for (const s of starts) {
    const r = newton(ctx, s, bounds);
    if (!best || r.n < best.n) best = r;
    if (r.n < 1e-4) break;
  }
  return best;
}

/* ---------------- Electrical ---------------- */
function electrical(cfg, ctx, c, running) {
  const V = cfg.elec.volts * (cfg.faults?.voltage ?? 1), pf = 0.92, tons = cfg.tons;
  const e = { V };
  const fanW = (base, cfm, nom) => base * Math.pow(cfm / nom, 3);
  // indoor blower
  const esp = cfg.blower.esp;
  const effB = cfg.blower.type === 'ecm' ? 0.26 : 0.16;
  const bW = cfg.blowerOn ? 0.1175 * ctx.idCfm * Math.max(0.1, esp + 0.15) / effB : 0;
  e.blower = { W: bW, A: bW / (V * (cfg.blower.type === 'ecm' ? 0.65 : 0.88)), type: cfg.blower.type };
  if (cfg.blower.type === 'psc' && cfg.blowerOn) { const C = cfg.elec.blowerCap * (cfg.faults?.blowerCapPct ?? 1); const Vc = V * 1.45; e.blower.capV = Vc; e.blower.capA = 377 * C * 1e-6 * Vc * 0.5; e.blower.capRated = cfg.elec.blowerCap; e.blower.capMeas = e.blower.capA * 2652 / Vc; }
  // outdoor fan
  const odOn = running && !ctx.water;
  const ofW = odOn ? fanW(60 * tons, ctx.odCfm, ctx.odCfmNom) * (cfg.faults?.odAirflow === 0 ? 0 : 1) + (odOn ? 15 : 0) : 0;
  e.odFan = { W: ofW, A: ofW / (V * 0.86) };
  if (odOn) { const C = cfg.elec.fanCap * (cfg.faults?.fanCapPct ?? 1), Vc = V * 1.5; e.odFan.capV = Vc; e.odFan.capA = 377 * C * 1e-6 * Vc; e.odFan.capRated = cfg.elec.fanCap; e.odFan.capMeas = e.odFan.capA * 2652 / Vc; }
  // compressor
  const W = running && c ? c.Wel / 3.412 : 0;
  const inv = cfg.comp.type === 'inv';
  const comp = { W, type: cfg.comp.type };
  if (inv) { comp.A = W / (V * 0.97); comp.hz = Math.round(ctx.speed * 75); }
  else {
    const capPct = cfg.faults?.compCapPct ?? 1;
    const ampsBoost = 1 + 0.6 * Math.max(0, 1 - capPct);
    comp.A = W / (V * pf) * ampsBoost; comp.C = comp.A;
    const Vc = V * (1.32 + 0.12 * Math.max(0, 1 - W / (cfg.matched.Wnom || W || 1)));
    const C = cfg.elec.compCap * capPct;
    comp.capV = running ? Vc : 0;
    comp.S = running ? 377 * C * 1e-6 * Vc : 0;
    comp.R = running ? Math.sqrt(Math.max(0, comp.C * comp.C - comp.S * comp.S * 0.55)) : 0;
    comp.capRated = cfg.elec.compCap; comp.capMeas = comp.S > 0 ? comp.S * 2652 / Vc : 0;
  }
  comp.RLA = cfg.matched.RLA; comp.LRA = Math.round(cfg.matched.RLA * 5.2);
  e.comp = comp;
  e.odUnitA = comp.A + e.odFan.A;
  e.totalW = W + ofW + bW;
  return e;
}

/* ---------------- Public API ---------------- */
function solve(cfg, FL, guess) {
  const ctx = buildCtx(cfg, FL);
  const r = solveCtx(ctx, guess);
  const c = cycle(ctx, r.x, true);
  c.converged = r.n < 2e-3; c.err = r.n; c.x = r.x; c.ctx = ctx;
  return c;
}

function match(cfg, FL) {
  // size compressor, factory charge and metering for the chosen refrigerant/tonnage/coils
  const F = FL[cfg.refrigerant], tons = cfg.tons, Qn = tons * 12000;
  const c = JSON.parse(JSON.stringify(cfg));
  c.faults = {}; c.blower.cfm = COIL[c.indoor.type].cfmId * tons; c.blower.esp = 0.5; c.odFan.pct = 100; c.water.gpm = 3 * tons;
  c.comp.stage = 'high'; c.comp.speed = 100;
  const Pe = F.pDew(46), rhoS = F.vap(Pe, 10).rho;
  const dh = F.vap(Pe, 10).h - F.hLiqT(105);
  let mNom = Qn / dh;
  c.matched = { disp: mNom / (rhoS * 0.94), mNom, rhoSucNom: rhoS, in: {}, out: {} };
  // cooling AHRI A
  c.mode = 'cool'; c.cond = { idDB: 80, idWB: 67, odDB: 95, odWB: 75 }; c.water.ewt = 86;
  c.chargeMode = 'sandbox'; c.shTarget = 10; c.scTarget = 10;
  let s, guess = null;
  for (let k = 0; k < 6; k++) {
    s = solve(c, FL, guess); guess = s.x;
    const Q = s.m * (s.hEo - s.hEi);
    c.matched.disp *= Math.pow(Qn / Q, 0.95);
    c.matched.mNom = s.m * Qn / Q; c.matched.rhoSucNom = s.disSt ? F.state(s.Ps, s.h1).rho : rhoS;
  }
  s = solve(c, FL, guess);
  const m = c.matched;
  m.Wnom = s.Wel / 3.412;
  m.RLA = Math.round((s.Wel / 3.412) * 1.15 / (cfg.elec.volts * 0.92) * 10) / 10;
  // indoor metering sized at A
  const sizeMeter = (st) => {
    const rho = st.upSt.rho, dP = st.Pmi - st.PeIn;
    const base = st.m / (3600 * Math.sqrt(2 * GC * rho * dP * 144));
    const d = Math.sqrt(base / 0.52 * 4 / Math.PI) * 12;
    return { piston: Math.round(d * 1000) / 1000, txvK: base / 0.72, eevK: base / 0.6 };
  };
  // heating charge requirement (sandbox SC 8 at H1)
  const h = JSON.parse(JSON.stringify(c));
  h.mode = 'heat'; h.cond = { idDB: 70, idWB: 60, odDB: 47, odWB: 43 }; h.water.ewt = 68; h.shTarget = 8; h.scTarget = 8;
  m.Vcomp = 0; m.VcompH = 0;
  const hs = solve(h, FL, null);
  const coolReq = s.inv, heatReq = hs.inv;
  // charge compensator: stores liquid in whichever mode needs less charge.
  // Heating keeps up to 15% surplus (normal extra subcooling in heat).
  m.Vcomp = Math.max(0, heatReq - coolReq) / F.rhoLiqT(s.Tliq);
  const surplus = Math.max(0, coolReq - 1.15 * heatReq);
  m.VcompH = surplus / (F.rhoLiqT(hs.Tliq) - F.state(hs.Ps, hs.h1).rho);
  m.charge = Math.round(Math.max(coolReq + m.VcompH * F.state(s.Ps, s.h1).rho, heatReq) * 10) / 10;
  m.coolReq = coolReq; m.heatReq = heatReq;
  c.chargeMode = 'size'; c.charge = m.charge; c.shTarget = 10;
  s = solve(c, FL, s.x);
  m.in = sizeMeter(s);
  m.idCfm = c.blower.cfm;
  // heating H1 — outdoor metering sized with factory charge
  c.mode = 'heat'; c.cond = { idDB: 70, idWB: 60, odDB: 47, odWB: 43 }; c.water.ewt = 68;
  c.chargeMode = 'size'; c.charge = m.charge; c.shTarget = 8;
  const sh = solve(c, FL, null);
  m.out = sizeMeter(sh);
  m.heatOK = sh.converged;
  return m;
}

const API = { Fluid, Psy, COIL, lineIDs, defaultSwitches, buildCtx, cycle, solve, match, electrical, PATM, clamp };
if (typeof module !== 'undefined') module.exports = API; else root.HPEngine = API;
})(this);
