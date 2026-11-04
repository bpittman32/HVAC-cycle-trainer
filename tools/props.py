"""Generate refrigerant property tables (IP units) from a Peng-Robinson EOS with
Mathias-Copeman alpha fitted to published PT-chart anchor points.
Blends are treated as pseudo-pure fluids; glide is applied as a temperature
offset between bubble and dew at a given pressure."""
import json, math
import numpy as np
from scipy.optimize import least_squares

R = 8.314462618  # J/mol/K

def F2K(f): return (f - 32) / 1.8 + 273.15
def K2F(k): return (k - 273.15) * 1.8 + 32
def psig2Pa(p): return (p + 14.696) * 6894.757
def Pa2psia(p): return p / 6894.757

# Anchor data: (psig, mid-glide temperature °F)
FLUIDS = {
  'R-410A': dict(Tc=344.49, Pc=4.901e6, M=72.585, w=0.296, cp=(22.0, 0.120, 0.0),
                 glide=lambda F: 0.2, anchors=[(48.6,0),(118.0,40),(317.0,100),(418.0,120),(201.0,70)]),
  'R-32':   dict(Tc=351.26, Pc=5.782e6, M=52.024, w=0.277, cp=(19.5, 0.078, 0.0),
                 glide=lambda F: 0.0, anchors=[(49.2,0),(120.4,40),(325.0,100),(203.5,70)]),
  'R-454B': dict(Tc=351.0, Pc=5.27e6, M=62.6, w=0.29, cp=(18.0, 0.118, 0.0),
                 glide=lambda F: 2.1, anchors=[(0,-58.1),(100,35.2),(310,103.0),(360,113.8),(60,11.9)]),
  'R-407C': dict(Tc=359.35, Pc=4.632e6, M=86.2, w=0.363, cp=(25.0, 0.147, 0.0),
                 glide=lambda F: max(4.0, 11.6 - 0.024*(F)), anchors=[(29.5,5.75),(80.7,45.3),(226,104.6),(300,124.5)]),
  'R-404A': dict(Tc=345.27, Pc=3.729e6, M=97.6, w=0.293, cp=(30.0, 0.187, 0.0),
                 glide=lambda F: 0.8, anchors=[(32.6,0),(85.4,40),(234.6,100)]),
}

class PR:
    def __init__(s, Tc, Pc, M, w, cp, c1=None, c2=0.0, c3=0.0):
        s.Tc, s.Pc, s.M = Tc, Pc, M/1000.0
        s.cp = cp
        s.c1 = c1 if c1 is not None else 0.37464 + 1.54226*w - 0.26992*w*w
        s.c2 = c2; s.c3 = c3
        s.ac = 0.45724 * R*R*Tc*Tc / Pc
        s.b = 0.07780 * R*Tc / Pc
    def alpha(s, T):
        m = 1 - math.sqrt(T/s.Tc)
        f = 1 + s.c1*m + s.c2*m*m + s.c3*m**3
        dm = -0.5/math.sqrt(T*s.Tc)
        return f*f, 2*f*(s.c1 + 2*s.c2*m + 3*s.c3*m*m)*dm
    def Zroots(s, T, P):
        al, _ = s.alpha(T)
        A = s.ac*al*P/(R*T)**2; B = s.b*P/(R*T)
        r = np.roots([1, -(1-B), A-3*B*B-2*B, -(A*B-B*B-B**3)])
        r = sorted([x.real for x in r if abs(x.imag) < 1e-9 and x.real > B])
        return r, A, B
    def lnphi(s, Z, A, B):
        return Z-1-math.log(Z-B) - A/(2*math.sqrt(2)*B)*math.log((Z+(1+math.sqrt(2))*B)/(Z+(1-math.sqrt(2))*B))
    def psat(s, T):
        Tr = T/s.Tc
        P = s.Pc*math.exp(5.373*(1+0.3)*(1-1/Tr))
        for _ in range(200):
            r, A, B = s.Zroots(T, P)
            if len(r) < 2:
                # nudge toward two-phase region
                P *= 1.02 if r[0] > 0.3 else 0.98
                continue
            fl = s.lnphi(r[0], A, B); fv = s.lnphi(r[-1], A, B)
            d = fl - fv
            P *= math.exp(d)
            if abs(d) < 1e-10: break
        return P
    def h_s(s, T, P, phase):
        r, A, B = s.Zroots(T, P)
        Z = r[0] if phase == 'l' else r[-1]
        al, dal = s.alpha(T)
        a = s.ac*al; da = s.ac*dal
        L = math.log((Z+(1+math.sqrt(2))*B)/(Z+(1-math.sqrt(2))*B))
        hdep = R*T*(Z-1) + (T*da - a)/(2*math.sqrt(2)*s.b)*L
        sdep = R*math.log(Z-B) + da/(2*math.sqrt(2)*s.b)*L
        c0, c1, c2 = s.cp; T0 = 233.15
        hig = c0*(T-T0) + c1/2*(T*T-T0*T0) + c2/3*(T**3-T0**3)
        sig = c0*math.log(T/T0) + c1*(T-T0) + c2/2*(T*T-T0*T0) - R*math.log(P/101325.0)
        rho = P*s.M/(Z*R*T)
        return (hig+hdep)/s.M, (sig+sdep)/s.M, rho  # J/kg, J/kg/K, kg/m3

def fit(name, d):
    anchors = [(F2K(t), psig2Pa(p)) for p, t in d['anchors']]
    def res(c):
        f = PR(d['Tc'], d['Pc'], d['M'], d['w'], d['cp'], c[0], 0.0, 0.0)
        return [math.log(f.psat(T)/P) for T, P in anchors]
    c0 = [0.37464 + 1.54226*d['w'] - 0.26992*d['w']**2]
    sol = least_squares(res, c0)
    f = PR(d['Tc'], d['Pc'], d['M'], d['w'], d['cp'], sol.x[0], 0.0, 0.0)
    # residual pressure correction: ln(P_true/P_PR) as polynomial in T(F)
    ts = np.array([t for p, t in d['anchors']]); lr = np.array([math.log(psig2Pa(p)/f.psat(F2K(t))) for p, t in d['anchors']])
    deg = 2 if len(ts) >= 4 else 1
    f.corr = np.polyfit(ts, lr, deg)
    errs = [(t, p, Pa2psia(f.psat(F2K(t))*math.exp(np.polyval(f.corr, t)))-14.696) for p, t in d['anchors']]
    return f, errs

J2BTU = 1/2326.0          # J/kg -> Btu/lb
S2IP = 1/4186.8           # J/kg/K -> Btu/lb/R
RHO2IP = 0.06242796       # kg/m3 -> lb/ft3

out = {}
for name, d in FLUIDS.items():
    f, errs = fit(name, d)
    print(name, ' '.join(f'{t}F:{p:.1f}→{e:.1f}' for t, p, e in errs))
    # reference: sat liquid at -40F => h=0, s=0
    Tref = F2K(-40); Pref = f.psat(Tref)
    h0, s0, _ = f.h_s(Tref, Pref, 'l')
    Tmax = min(f.Tc - 2.5, F2K(170))
    TF = np.arange(-90, K2F(Tmax), 2.0)
    sat = []
    for tf in TF:
        T = F2K(tf); P = f.psat(T); cf = math.exp(np.polyval(f.corr, max(min(tf, 140), -60)))
        hl, sl, rl = f.h_s(T, P, 'l'); hv, sv, rv = f.h_s(T, P, 'v')
        g = d['glide'](tf)
        sat.append([round(tf, 2), round(Pa2psia(P*cf), 4),
                    round((hl-h0)*J2BTU, 3), round((hv-h0)*J2BTU, 3),
                    round(rl*RHO2IP, 4), round(rv*RHO2IP, 5),
                    round((sl-s0)*S2IP, 5), round((sv-s0)*S2IP, 5), round(g, 2)])
    # liquid cp & vapour props on superheat grid: P log grid, superheat 0..200F
    Pgrid = np.exp(np.linspace(math.log(sat[0][1]), math.log(sat[-1][1]*0.98), 36))
    SH = np.array([0, 2, 5, 10, 15, 20, 30, 40, 55, 70, 90, 110, 135, 160, 190, 220])
    sup = []
    satP = np.array([r[1] for r in sat]); satT = np.array([r[0] for r in sat])
    for Pp in Pgrid:
        tmid = float(np.interp(Pp, satP, satT))
        tdew = tmid + d['glide'](tmid)/2
        row = []
        for sh in SH:
            T = F2K(tdew + sh); P = Pp*6894.757/math.exp(np.polyval(f.corr, max(min(tmid, 140), -60)))
            if sh < 0.5: T += 0.05
            h, s, rho = f.h_s(T, P, 'v')
            row.append([round((h-h0)*J2BTU, 3), round((s-s0)*S2IP, 5), round(rho*RHO2IP, 5)])
        sup.append(row)
    out[name] = dict(M=d['M'], Tc=round(K2F(f.Tc), 1), Pc=round(Pa2psia(f.Pc), 1),
                     sat=sat, supP=[round(p, 4) for p in Pgrid], supSH=SH.tolist(), sup=sup)

json.dump(out, open(__import__('os').path.join(__import__('os').path.dirname(__file__), '..', 'src', 'props.json'), 'w'), separators=(',', ':'))
print('size', len(json.dumps(out, separators=(',', ':'))))
# sanity: latent heat at 40F and cp vapour
for n, o in out.items():
    r = [x for x in o['sat'] if x[0] == 40][0]
    print(n, 'P40', round(r[1]-14.696, 1), 'hfg', round(r[3]-r[2], 1), 'hl', r[2], 'hv', r[3], 'rhol', r[4], 'rhov', r[5])
