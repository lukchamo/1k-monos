"""Experimento: 30 inversionistas (28 de tesis + 2 controles), intuición por analogía,
racha por mercado y rankings por segmento/economía. Señal al cierre t, ejecución t+1."""
from pathlib import Path
HERE = Path(__file__).resolve().parent
DATA, OUT, SHARED = HERE / "data", HERE / "out", HERE.parent / "shared"
OUT.mkdir(exist_ok=True)
import json, math
from statistics import NormalDist
import numpy as np, pandas as pd

START, END = '2025-11-20', '2026-11-20'
COST = 0.001
HIGH = {'CRWV', 'SPCX', 'COIN', 'PLTR', 'TSLA'}
CRYPTO = {'BTC-USD', 'ETH-USD', 'SOL-USD'}
SEG = {
 'EE. UU. índices': ['SPY', 'QQQ'],
 'EE. UU. tecnología e IA': ['MSFT', 'NVDA', 'TSLA', 'PLTR', 'CRWV', 'SPCX'],
 'Cripto': ['BTC-USD', 'ETH-USD', 'SOL-USD', 'COIN'],
 'Refugio y tipos': ['GLD', 'TLT'],
 'Materias primas': ['USO'],
 'Europa': ['SAN.MC', 'EWP', 'FEZ'],
 'Asia desarrollada': ['EWJ'],
 'Emergentes': ['EEM', 'EWZ', 'EWW', 'FXI'],
}
ECON = {'Desarrolladas': SEG['EE. UU. índices'] + SEG['EE. UU. tecnología e IA'] + SEG['Europa'] + SEG['Asia desarrollada'],
        'Emergentes': SEG['Emergentes'], 'Cripto': SEG['Cripto'], 'Materias primas y refugio': SEG['Materias primas'] + SEG['Refugio y tipos']}
U = [a for s in SEG.values() for a in s]
BETA_HI = {'NVDA', 'TSLA', 'PLTR', 'CRWV', 'SPCX', 'COIN', 'BTC-USD', 'ETH-USD', 'SOL-USD', 'EWZ', 'FXI'}

rows = []
for f in [DATA / 'prices_a.csv', DATA / 'prices_b.csv', DATA / 'prices_c.csv']:
    for l in open(f).read().strip().split('\n'):
        s, d, c = l.split(',')[:3]
        rows.append((s, d, float(c)))
raw = pd.DataFrame(rows, columns=['s', 'd', 'c']).pivot_table(index='d', columns='s', values='c')
raw.index = pd.to_datetime(raw.index)
cal = raw['SPY'].dropna().index
px = raw.reindex(cal).ffill()
for s in ['SPCX']:
    px.loc[px.index < raw[s].first_valid_index(), s] = np.nan
R = px[U].pct_change()
win = (px.index >= START) & (px.index <= END)
D = px.index[win]
C = px[U]
vix, tnx = px['^VIX'], px['^TNX']

def sma(x, n): return x.rolling(n, min_periods=n).mean()
def sgn(cond_long, cond_short):
    return pd.DataFrame(np.where(cond_long, 1.0, np.where(cond_short, -1.0, 0.0)), index=C.index, columns=U)

def momentum(n_sma, n_ret):
    return sgn((C > sma(C, n_sma)) & (C.pct_change(n_ret) > 0), (C < sma(C, n_sma)) & (C.pct_change(n_ret) < 0))

def stateful(entry_long, entry_short, exit_long, exit_short):
    out = np.zeros(C.shape)
    el, es, xl, xs = (x.values for x in (entry_long, entry_short, exit_long, exit_short))
    for j in range(C.shape[1]):
        p = 0.0
        for i in range(C.shape[0]):
            if np.isnan(C.values[i, j]): p = 0.0
            else:
                if p == 1 and xl[i, j]: p = 0.0
                elif p == -1 and xs[i, j]: p = 0.0
                if p == 0 and el[i, j]: p = 1.0
                elif p == 0 and es[i, j]: p = -1.0
            out[i, j] = p
    return pd.DataFrame(out, index=C.index, columns=U)

def meanrev(n, thr):
    z = (C - sma(C, n)) / C.rolling(n, min_periods=n).std()
    return stateful(z < -thr, z > thr, z >= 0, z <= 0)

def breakout(n_in, n_out):
    hi, lo = C.shift(1).rolling(n_in, min_periods=n_in).max(), C.shift(1).rolling(n_in, min_periods=n_in).min()
    hx, lx = C.shift(1).rolling(n_out, min_periods=n_out).max(), C.shift(1).rolling(n_out, min_periods=n_out).min()
    return stateful(C > hi, C < lo, C < lx, C > hx)

def macro(band, rates_only=False):
    v20 = sma(vix, 20)
    off = (vix > v20 * (1 + band)).values[:, None]
    on = (vix < v20 * (1 - band)).values[:, None]
    up = (tnx.diff(20) > 0).values[:, None]
    cols = np.array(U)
    hi = np.isin(cols, list(BETA_HI))[None, :]
    gld, tlt = (cols == 'GLD')[None, :], (cols == 'TLT')[None, :]
    if rates_only:
        p = np.where(tlt, np.where(up, -1.0, 1.0), np.where(gld, np.where(up, -1.0, 1.0), np.where(up, -1.0, 1.0) * hi))
    else:
        p = np.where(gld, np.where(off, 1.0, 0.0), np.where(tlt, np.where(up, -1.0, np.where(off, 1.0, 0.0)),
             np.where(hi, np.where(off, -1.0, np.where(on, 1.0, 0.0)), np.where(on, 1.0, 0.0))))
    return pd.DataFrame(p, index=C.index, columns=U)

INV = {}
for a, b in [(20, 10), (50, 20), (100, 20), (50, 60), (30, 5)]: INV[f'Tendencia {a}/{b}'] = ('Momentum', momentum(a, b))
for a, b in [(10, 1.5), (20, 1.0), (20, 1.5), (20, 2.0), (40, 1.5), (10, 2.0)]: INV[f'Elástico {a} z{b}'] = ('Reversión', meanrev(a, b))
for a, b in [(10, 5), (20, 10), (40, 20), (55, 20), (5, 3)]: INV[f'Cazador {a}/{b}'] = ('Ruptura', breakout(a, b))
for band in [0.03, 0.05, 0.10]: INV[f'Macro VIX±{int(band*100)}%'] = ('Macro', macro(band))
INV['Macro solo tipos'] = ('Macro', macro(0, rates_only=True))
BASE = list(INV)
def against(names, k):
    s = sum(INV[n][1] for n in names)
    return pd.DataFrame(np.where(s >= k, -1.0, np.where(s <= -k, 1.0, 0.0)), index=C.index, columns=U)
INV['Abogado (4 de tesis)'] = ('Antagonista', against(['Tendencia 50/20', 'Elástico 20 z1.5', 'Cazador 20/10', 'Macro VIX±5%'], 2))
INV['Abogado (contra momentum)'] = ('Antagonista', against([n for n in BASE if n.startswith('Tendencia')], 3))
INV['Abogado (contra todos)'] = ('Antagonista', against(BASE, 8))

# ---------- intuición por analogía (k vecinos en el pasado) ----------
lr = np.log(C)
std20 = lr.diff().rolling(20, min_periods=20).std()
std60 = lr.diff().rolling(60, min_periods=60).std()
F = np.stack([((C.pct_change(5)) / (std20 * math.sqrt(5))).values,
              ((C.pct_change(20)) / (std20 * math.sqrt(20))).values,
              ((C - sma(C, 20)) / C.rolling(20, min_periods=20).std()).values,
              (std20 / std60 - 1).values,
              np.repeat(((vix / sma(vix, 20)) - 1).values[:, None], len(U), 1),
              np.repeat(tnx.diff(20).values[:, None], len(U), 1)], axis=2)  # (T, A, 6)
Y = (C.shift(-5) / C - 1).values  # objetivo: retorno a 5 días, conocido en t+5
def intuition(k):
    T, A, _ = F.shape
    out = np.zeros((T, A))
    idx = {d: i for i, d in enumerate(C.index)}
    for d in D:
        t = idx[d]
        pool_t = t - 5  # solo ejemplos cuyo resultado ya se conoce
        P = F[:pool_t + 1].reshape(-1, 6); y = Y[:pool_t + 1].reshape(-1)
        ok = ~np.isnan(P).any(1) & ~np.isnan(y)
        P, y = P[ok], y[ok]
        if len(y) < 200: continue
        mu, sd = P.mean(0), P.std(0) + 1e-9
        Pn = (P - mu) / sd
        q = (F[t] - mu) / sd
        for j in range(A):
            if np.isnan(q[j]).any(): continue
            dist = ((Pn - q[j]) ** 2).sum(1)
            nn = np.argpartition(dist, k)[:k]
            up = (y[nn] > 0).mean()
            out[t, j] = 1.0 if up >= 0.6 else -1.0 if up <= 0.4 else 0.0
    return pd.DataFrame(out, index=C.index, columns=U)
INV['Intuición k=25'] = ('Intuición', intuition(25))
INV['Intuición k=75'] = ('Intuición', intuition(75))

# ---------- motor ----------
def borrow(a): return 0.10 if a in CRYPTO else 0.08 if a in HIGH else 0.02
FEE = np.array([borrow(a) / 252 for a in U])
Rw = R.reindex(D).fillna(0.0).values
def daily_matrix(pos):
    P = pos.shift(1).reindex(D).fillna(0.0).values
    P0 = pos.shift(2).reindex(D).fillna(0.0).values
    avail = ~np.isnan(C.reindex(D).values)
    P = P * avail; P0 = P0 * avail
    return P * Rw - np.abs(P - P0) * COST - (P < 0) * FEE  # (T, A) retorno diario por activo
def equity_from(daily, cols=None):
    m = daily if cols is None else daily[:, cols]
    return (m.shape[1] and (1 + m).cumprod(0).mean(1))  # capital igual por activo, sin rebalanceo
COLS = {g: [U.index(a) for a in v] for g, v in {**SEG, **ECON}.items()}
DM = {n: daily_matrix(p) for n, (_, p) in INV.items()}

# ---------- racha: asignadores por segmento ----------
def racha(kind, look):
    out = pd.DataFrame(0.0, index=C.index, columns=U)
    seg_daily = {n: {g: DM[n][:, COLS[g]].mean(1) for g in SEG} for n in BASE}
    pos_idx = {d: i for i, d in enumerate(C.index)}
    for ti, d in enumerate(D):
        if ti < look: continue
        for g, assets in SEG.items():
            best, best_score = None, -1e9
            for n in BASE:
                h = seg_daily[n][g][ti - look + 1: ti + 1]  # P&L conocido hasta el cierre de hoy
                if kind == 'ret':
                    score = np.prod(1 + h) - 1
                else:  # racha con perdón: tasa de acierto bayesiana con prior Beta(10,10)
                    w, l = (h > 0).sum(), (h < 0).sum()
                    score = (10 + w) / (20 + w + l) + 1e-6 * h.sum()
                if score > best_score: best, best_score = n, score
            out.loc[d, assets] = INV[best][1].loc[d, assets]
    return out
INV['Racha 20 días'] = ('Racha', racha('ret', 20))
INV['Racha 60 días'] = ('Racha', racha('ret', 60))
INV['Racha con perdón'] = ('Racha', racha('beta', 60))
for n in ['Racha 20 días', 'Racha 60 días', 'Racha con perdón']: DM[n] = daily_matrix(INV[n][1])

INV['Compra y mantén'] = ('Control', pd.DataFrame(np.where(C.notna(), 1.0, 0.0), index=C.index, columns=U))
DM['Compra y mantén'] = daily_matrix(INV['Compra y mantén'][1])
rng = np.random.default_rng(7)
def monkey():
    n = len(C.index); b = (n + 4) // 5
    m = np.repeat(rng.integers(-1, 2, size=(b, len(U))), 5, axis=0)[:n].astype(float)
    return pd.DataFrame(m, index=C.index, columns=U)
INV['El Mono'] = ('Control', monkey()); DM['El Mono'] = daily_matrix(INV['El Mono'][1])

# ---------- métricas ----------
def metrics(daily, cols=None):
    eq = equity_from(daily, cols)
    r = np.diff(np.concatenate([[1.0], eq])) / np.concatenate([[1.0], eq[:-1]])
    tot = eq[-1] - 1
    sr_d = r.mean() / r.std() if r.std() > 0 else 0
    dd = (eq / np.maximum.accumulate(eq) - 1).min()
    return tot, sr_d, dd, r
MONK = []
for _ in range(2000):
    dm = daily_matrix(monkey())
    MONK.append({g: equity_from(dm, COLS[g])[-1] - 1 for g in COLS} | {'_all': equity_from(dm)[-1] - 1})
mk_all = np.array([m['_all'] for m in MONK])
thesis = [n for n, (fam, _) in INV.items() if fam != 'Control']
NT = len(thesis)
best_of = np.array([mk_all[rng.integers(0, len(mk_all), NT)].max() for _ in range(5000)])

res = []
SRs = {n: metrics(DM[n])[1] for n in thesis}
V = np.var(list(SRs.values()))
g = 0.5772156649
nd = NormalDist()
emax = math.sqrt(V) * ((1 - g) * nd.inv_cdf(1 - 1 / NT) + g * nd.inv_cdf(1 - 1 / (NT * math.e)))
for n, (fam, _) in INV.items():
    tot, sr, dd, r = metrics(DM[n])
    T = len(r); sk = pd.Series(r).skew(); ku = pd.Series(r).kurt() + 3
    denom = math.sqrt(max(1e-12, 1 - sk * sr + (ku - 1) / 4 * sr ** 2))
    dsr = nd.cdf((sr - emax) * math.sqrt(T - 1) / denom)
    res.append(dict(nombre=n, familia=fam, retorno=tot * 100, sharpe=sr * math.sqrt(252), max_dd=dd * 100,
                    pct_monos=(mk_all < tot).mean() * 100, dsr=dsr * 100,
                    trades=int(np.abs(np.diff(INV[n][1].reindex(D).fillna(0).values, axis=0)).astype(bool).sum())))
res.sort(key=lambda x: -x['retorno'])

seg_rows = []
for gname in COLS:
    mk = np.array([m[gname] for m in MONK])
    bo = np.array([mk[rng.integers(0, len(mk), NT)].max() for _ in range(3000)])
    vals = {n: equity_from(DM[n], COLS[gname])[-1] - 1 for n in INV}
    ranked = sorted(((v, n) for n, v in vals.items() if INV[n][0] != 'Control'), reverse=True)
    v_best, n_best = ranked[0]
    seg_rows.append(dict(segmento=gname, tipo='economía' if gname in ECON else 'mercado', activos=len(COLS[gname]),
                         compra_mantener=vals['Compra y mantén'] * 100, mejor=n_best, familia=INV[n_best][0], mejor_ret=v_best * 100,
                         pct_monos=(mk < v_best).mean() * 100, umbral_suerte_p95=np.percentile(bo, 95) * 100,
                         supera_suerte=bool(v_best > np.percentile(bo, 95))))
out = dict(n_tesis=NT, resultados=res, segmentos=seg_rows,
           monos=dict(p05=float(np.percentile(mk_all, 5) * 100), p50=float(np.percentile(mk_all, 50) * 100), p95=float(np.percentile(mk_all, 95) * 100)),
           mejor_de_n_monos=dict(p50=float(np.percentile(best_of, 50) * 100), p95=float(np.percentile(best_of, 95) * 100)),
           emax_sr_anual=emax * math.sqrt(252))
json.dump(out, open(OUT / 'exp30.json', 'w'), indent=1, ensure_ascii=False, default=float)
print('tesis:', NT, '| monos p05/p50/p95', [round(x, 1) for x in np.percentile(mk_all, [5, 50, 95]) * 100],
      '| mejor de', NT, 'monos p50/p95', [round(x, 1) for x in np.percentile(best_of, [50, 95]) * 100], '| Sharpe esperado del mejor por azar', round(emax * math.sqrt(252), 2))
for r in res:
    print(f"{r['nombre']:28s} {r['familia']:12s} ret {r['retorno']:6.1f}  sh {r['sharpe']:5.2f}  dd {r['max_dd']:6.1f}  pct {r['pct_monos']:5.1f}  dsr {r['dsr']:5.1f}  ops {r['trades']}")
print()
for s in seg_rows:
    print(f"{s['segmento']:28s} B&H {s['compra_mantener']:6.1f} | mejor {s['mejor']:24s} {s['mejor_ret']:6.1f} pct {s['pct_monos']:5.1f} umbral_suerte {s['umbral_suerte_p95']:6.1f} supera {s['supera_suerte']}")
