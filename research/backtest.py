"""Backtest PoC: 7 inversionistas determinísticos (+500 monos) sobre 16 activos reales.
Señal al cierre de t -> posición para el retorno de t+1 (sin look-ahead).
Datos: Yahoo Finance vía Firecrawl (cierres ajustados diarios)."""
from pathlib import Path
HERE = Path(__file__).resolve().parent
DATA, OUT, SHARED = HERE / "data", HERE / "out", HERE.parent / "shared"
OUT.mkdir(exist_ok=True)
import json, math, sys
from datetime import datetime, timezone
import numpy as np, pandas as pd
sys.path.insert(0, str(HERE))
import build_news as bn

START, END = '2025-11-20', '2026-11-20'
COST = 0.001  # 10 pb por unidad de cambio de posición (comisión + deslizamiento)
BORROW = {'default': 0.02, 'high': 0.08, 'crypto': 0.10}  # coste anual de estar corto
HIGH = {'CRWV', 'SPCX', 'COIN', 'PLTR', 'TSLA'}
CRYPTO = {'BTC-USD', 'ETH-USD', 'SOL-USD'}
UNIVERSE = ['SPY', 'QQQ', 'MSFT', 'NVDA', 'TSLA', 'PLTR', 'CRWV', 'SPCX', 'COIN',
            'BTC-USD', 'ETH-USD', 'SOL-USD', 'GLD', 'TLT', 'USO', 'SAN.MC']
META = {
 'SPY': ('S&P 500 (ETF)', 'Índice EE. UU.', 'baja'), 'QQQ': ('Nasdaq 100 (ETF)', 'Índice EE. UU.', 'media'),
 'MSFT': ('Microsoft', 'Megacap IA', 'media'), 'NVDA': ('Nvidia', 'Megacap IA', 'alta'),
 'TSLA': ('Tesla', 'Alta beta', 'alta'), 'PLTR': ('Palantir', 'Alta beta IA', 'alta'),
 'CRWV': ('CoreWeave', 'Infraestructura IA', 'muy alta'), 'SPCX': ('SpaceX', 'IPO 2026', 'muy alta'),
 'COIN': ('Coinbase', 'Acción cripto', 'muy alta'), 'BTC-USD': ('Bitcoin', 'Cripto', 'alta'),
 'ETH-USD': ('Ethereum', 'Cripto', 'muy alta'), 'SOL-USD': ('Solana', 'Cripto', 'muy alta'),
 'GLD': ('Oro (ETF)', 'Refugio', 'baja'), 'TLT': ('Bonos EE. UU. 20+ años (ETF)', 'Tipos de interés', 'baja'),
 'USO': ('Petróleo (ETF)', 'Materias primas', 'media'), 'SAN.MC': ('Banco Santander', 'Europa (Madrid)', 'media'),
}
BETA_HI = {'NVDA', 'TSLA', 'PLTR', 'CRWV', 'SPCX', 'COIN', 'BTC-USD', 'ETH-USD', 'SOL-USD'}

# ---------- datos ----------
rows = []
for f in [DATA / 'prices_a.csv', DATA / 'prices_b.csv']:
    for l in open(f).read().strip().split('\n'):
        s, d, c = l.split(',')
        rows.append((s, d, float(c)))
raw = pd.DataFrame(rows, columns=['sym', 'date', 'close']).pivot_table(index='date', columns='sym', values='close')
raw.index = pd.to_datetime(raw.index)
cal = raw['SPY'].dropna().index  # calendario de sesiones EE. UU.
px = raw.reindex(cal).ffill()
# SPCX y ANT no existen antes de su salida: no rellenar hacia atrás
for s in ['SPCX', 'ANT']:
    first = raw[s].first_valid_index()
    px.loc[px.index < first, s] = np.nan
ret = px.pct_change()
win = (px.index >= START) & (px.index <= END)
dates = px.index[win]

# ---------- indicadores ----------
def sma(s, n): return s.rolling(n, min_periods=n).mean()
ind = {}
for a in UNIVERSE:
    c = px[a]
    ind[a] = dict(c=c, sma20=sma(c, 20), sma50=sma(c, 50), std20=c.rolling(20, min_periods=20).std(),
                  ret20=c.pct_change(20), hi20=c.shift(1).rolling(20, min_periods=20).max(),
                  lo20=c.shift(1).rolling(20, min_periods=20).min(), hi10=c.shift(1).rolling(10, min_periods=10).max(),
                  lo10=c.shift(1).rolling(10, min_periods=10).min())
vix, tnx = px['^VIX'], px['^TNX']
vix20, tnx_chg20 = sma(vix, 20), tnx.diff(20)

# ---------- reglas (cada una: dict activo -> serie de posiciones -1/0/+1 en el cierre de t) ----------
def rule_buyhold(a):
    return pd.Series(np.where(px[a].notna(), 1.0, 0.0), index=px.index)

def rule_momentum(a):
    i = ind[a]
    long = (i['c'] > i['sma50']) & (i['ret20'] > 0)
    short = (i['c'] < i['sma50']) & (i['ret20'] < 0)
    return pd.Series(np.where(long, 1.0, np.where(short, -1.0, 0.0)), index=px.index)

def rule_meanrev(a):
    i = ind[a]; z = (i['c'] - i['sma20']) / i['std20']
    pos, out = 0.0, []
    for v in z.values:
        if np.isnan(v): pos = 0.0
        elif pos == 0 and v < -1.5: pos = 1.0
        elif pos == 0 and v > 1.5: pos = -1.0
        elif pos == 1 and v >= 0: pos = 0.0
        elif pos == -1 and v <= 0: pos = 0.0
        out.append(pos)
    return pd.Series(out, index=px.index)

def rule_breakout(a):
    i = ind[a]; pos, out = 0.0, []
    for c, h20, l20, h10, l10 in zip(i['c'].values, i['hi20'].values, i['lo20'].values, i['hi10'].values, i['lo10'].values):
        if np.isnan(h20) or np.isnan(c): pos = 0.0
        else:
            if pos == 1 and c < l10: pos = 0.0
            elif pos == -1 and c > h10: pos = 0.0
            if pos == 0 and c > h20: pos = 1.0
            elif pos == 0 and c < l20: pos = -1.0
        out.append(pos)
    return pd.Series(out, index=px.index)

regime = pd.Series(np.where(vix > vix20 * 1.05, -1, np.where(vix < vix20 * 0.95, 1, 0)), index=px.index)
regime[vix20.isna()] = 0
def rule_macro(a):
    risk_off, risk_on = regime == -1, regime == 1
    rates_up = tnx_chg20 > 0
    if a == 'GLD':
        p = np.where(risk_off, 1.0, 0.0)
    elif a == 'TLT':
        p = np.where(rates_up, -1.0, np.where(risk_off, 1.0, 0.0))
    elif a in BETA_HI:
        p = np.where(risk_off, -1.0, np.where(risk_on, 1.0, 0.0))
    else:
        p = np.where(risk_off, 0.0, np.where(risk_on, 1.0, 0.0))
    s = pd.Series(p, index=px.index)
    s[px[a].isna()] = 0.0
    return s

INVESTORS = [
 ('buyhold', 'Compra y mantén', 'Control', 'Siempre largo en todo. Si nadie le gana, ninguna tesis aporta.', rule_buyhold),
 ('momentum', 'La Tendencia', 'Momentum', 'Largo si el precio está sobre su media de 50 días y subió en 20 días; corto si ocurre lo contrario.', rule_momentum),
 ('meanrev', 'El Elástico', 'Reversión a la media', 'Compra caídas de más de 1,5 desviaciones bajo la media de 20 días y vende subidas equivalentes; sale al volver a la media.', rule_meanrev),
 ('breakout', 'El Cazador', 'Ruptura de canal', 'Largo al romper el máximo de 20 días, corto al romper el mínimo; sale con el canal de 10 días contrario.', rule_breakout),
 ('macro', 'El Macro', 'Régimen de riesgo (VIX + tipos)', 'Con VIX sobre su media: corto en alta beta y largo en oro. Con VIX bajo su media: largo en riesgo. Tipos subiendo: corto en bonos largos.', rule_macro),
]

pos = {k: {a: f(a) for a in UNIVERSE} for k, _, _, _, f in INVESTORS}
# Antagonista: va contra el consenso fuerte de los 4 de tesis
def antag(a):
    s = sum(pos[k][a] for k in ['momentum', 'meanrev', 'breakout', 'macro'])
    p = np.where(s >= 2, -1.0, np.where(s <= -2, 1.0, 0.0))
    out = pd.Series(p, index=px.index); out[px[a].isna()] = 0.0
    return out
pos['antagonist'] = {a: antag(a) for a in UNIVERSE}
INVESTORS.append(('antagonist', 'El Abogado del Diablo', 'Antagonista', 'Cuando al menos 2 de los 4 inversionistas de tesis coinciden en una dirección, toma la contraria.', None))

# Mono: posiciones aleatorias -1/0/+1 re-sorteadas cada 5 sesiones
def monkey_positions(seed):
    rng = np.random.default_rng(seed)
    n = len(px.index); blocks = (n + 4) // 5
    out = {}
    for a in UNIVERSE:
        draw = np.repeat(rng.integers(-1, 2, size=blocks), 5)[:n].astype(float)
        s = pd.Series(draw, index=px.index); s[px[a].isna()] = 0.0
        out[a] = s
    return out
pos['monkey'] = monkey_positions(7)
INVESTORS.insert(1, ('monkey', 'El Mono', 'Control aleatorio', 'Posiciones al azar (largo, corto o fuera) re-sorteadas cada semana. Semilla fija 7.', None))

# ---------- motor ----------
N = len(UNIVERSE)
CAP = 100_000.0
def borrow_rate(a):
    return BORROW['crypto'] if a in CRYPTO else BORROW['high'] if a in HIGH else BORROW['default']

def run(posd):
    """devuelve equity diaria total, pnl por activo, nº operaciones, exposición"""
    sleeve = CAP / N
    eq_assets, pnl, trades, long_days, short_days = {}, {}, 0, 0, 0
    for a in UNIVERSE:
        p = posd[a].shift(1).reindex(dates).fillna(0.0)  # posición vigente durante el día t
        r = ret[a].reindex(dates).fillna(0.0)
        prev = posd[a].shift(2).reindex(dates).fillna(0.0)
        dpos = (p - prev).abs()
        fee = np.where(p < 0, borrow_rate(a) / 252, 0.0)
        daily = p * r - dpos * COST - fee
        e = sleeve * (1 + daily).cumprod()
        eq_assets[a] = e
        pnl[a] = float(e.iloc[-1] - sleeve)
        trades += int((dpos > 0).sum())
        long_days += int((p > 0).sum()); short_days += int((p < 0).sum())
    eq = pd.DataFrame(eq_assets).sum(axis=1)
    tot_slots = len(dates) * N
    return eq, pnl, trades, long_days / tot_slots, short_days / tot_slots

def metrics(eq):
    r = eq.pct_change().dropna()
    tot = eq.iloc[-1] / CAP - 1
    vol = r.std() * math.sqrt(252)
    sharpe = (r.mean() * 252) / vol if vol > 0 else 0.0
    dd = (eq / eq.cummax() - 1).min()
    hit = (r > 0).sum() / max(1, (r != 0).sum())
    return dict(total_return=tot, vol=vol, sharpe=sharpe, max_dd=dd, hit_rate=hit)

results, curves = {}, {}
for k, *_ in INVESTORS:
    eq, pnl, tr, lg, sh = run(pos[k])
    m = metrics(eq); m.update(trades=tr, long_exposure=lg, short_exposure=sh, pnl=pnl)
    results[k], curves[k] = m, eq

# 500 monos para medir suerte
mk = []
for sd in range(1000, 1500):
    eq, *_ = run(monkey_positions(sd))
    mk.append(eq.iloc[-1] / CAP - 1)
mk = np.array(mk)
for k in results:
    results[k]['pct_vs_monkeys'] = float((mk < results[k]['total_return']).mean())

# ---------- posiciones de hoy (cierre del 20-nov-2026, para la sesión del 23-nov) ----------
last = dates[-1]
today_pos = {k: {a: float(pos[k][a].loc[last]) for a in UNIVERSE} for k in pos}

# ---------- noticias: esquema, eventos y presión ----------
sessions = [d.strftime('%Y-%m-%d') for d in px.index] + ['2026-11-23', '2026-11-24']
events = bn.make_events(sessions)
schema = bn.build_schema()
try:
    import jsonschema
    for e in events: jsonschema.validate(e, schema)
    valid = True
except ImportError:
    valid = None
at = datetime(2026, 11, 23, 14, 30, tzinfo=timezone.utc)  # decisión para la apertura del lunes 23-nov
press_syms = sorted({en['symbol'] for e in events for en in e['entities']})
press = {s: bn.pressure(events, s, at) for s in press_syms}
th = bn.TAX['scoring']['lector_thresholds']
lector = {s: (1 if v >= th['long'] else -1 if v <= th['short'] else 0) for s, v in press.items()}

# reacción del mercado a cada evento (outcome ex-post, solo para evaluar)
def outcome(ev):
    eff = pd.Timestamp(ev['timing']['effective_at'][:10])
    sym = ev['entities'][0]['symbol']
    if sym not in px or eff not in px.index: return None
    i = px.index.get_loc(eff)
    p0 = px[sym].iloc[i - 1]
    r1 = px[sym].iloc[i] / p0 - 1 if i < len(px) else None
    return dict(symbol=sym, ret_1d=float(r1), reaction_divergence=bool((r1 > 0) != (ev['entities'][0]['sentiment'] > 0)))
for e in events:
    o = outcome(e)
    if o: e['outcome'] = o

# ---------- salida ----------
json.dump(schema, open(SHARED / 'news_event.schema.json', 'w'), indent=2, ensure_ascii=False)
json.dump(events, open(SHARED / 'sample_events.json', 'w'), indent=2, ensure_ascii=False)
out = dict(results=results, today=today_pos, monkeys=dict(mean=float(mk.mean()), p05=float(np.percentile(mk, 5)), p50=float(np.percentile(mk, 50)), p95=float(np.percentile(mk, 95)), all=mk.tolist()),
           pressure=press, lector=lector, schema_valid=valid, period=[str(dates[0].date()), str(dates[-1].date())], n_days=len(dates))
json.dump(out, open(OUT / 'results.json', 'w'), indent=1, default=float)
pd.DataFrame(curves).to_csv(OUT / 'curves.csv')
# universo
uni = []
for a in UNIVERSE:
    s = px[a].reindex(dates).dropna(); r = s.pct_change().dropna()
    uni.append(dict(symbol=a, name=META[a][0], group=META[a][1], vol_tier=META[a][2], first=str(s.index[0].date()),
                    ret_period=float(s.iloc[-1] / s.iloc[0] - 1), vol_annual=float(r.std() * math.sqrt(252)),
                    max_dd=float((s / s.cummax() - 1).min()), last_close=float(s.iloc[-1])))
json.dump(uni, open(OUT / 'universe.json', 'w'), indent=1)
print('periodo', dates[0].date(), dates[-1].date(), len(dates), 'sesiones; schema valid:', valid)
for k, *_ in INVESTORS:
    m = results[k]
    print(f"{k:11s} ret {m['total_return']*100:6.1f}%  sharpe {m['sharpe']:5.2f}  dd {m['max_dd']*100:6.1f}%  trades {m['trades']:4d}  pct_monos {m['pct_vs_monkeys']*100:5.1f}  L {m['long_exposure']:.2f} S {m['short_exposure']:.2f}")
print('monos p05/p50/p95', np.percentile(mk, [5, 50, 95]).round(3))
print('presion', {k: round(v, 3) for k, v in press.items()})
for u in uni: print(u['symbol'], round(u['ret_period']*100,1), round(u['vol_annual']*100,1), round(u['max_dd']*100,1))

# ---------- demo de "El Lector" con las 9 noticias (no es un backtest: solo 2 semanas) ----------
from datetime import timedelta
demo_syms = ['NVDA', 'QQQ', 'GLD', 'TLT', 'CRWV', 'BTC-USD', 'SPCX']
demo_days = [d for d in px.index if pd.Timestamp('2026-11-04') <= d <= pd.Timestamp('2026-11-20')]
ser, lec_pnl = [], {s: 0.0 for s in demo_syms}
for i, d in enumerate(demo_days):
    close_t = datetime(d.year, d.month, d.day, 21, 0, tzinfo=timezone.utc)
    for s in demo_syms:
        p = bn.pressure(events, s, close_t)
        sig = 1 if p >= th['long'] else -1 if p <= th['short'] else 0
        nxt = px.index.get_loc(d) + 1
        r_next = float(px[s].iloc[nxt] / px[s].iloc[nxt - 1] - 1) if nxt < len(px) else None
        if r_next is not None:
            lec_pnl[s] += sig * r_next
        ser.append(dict(date=str(d.date()), symbol=s, pressure=round(p, 4), signal=sig, next_ret=r_next))
pd.DataFrame(ser).to_csv(OUT / 'pressure_series.csv', index=False)
print('lector demo signals:', [(r['date'], r['symbol'], r['signal'], round(r['next_ret']*100, 1) if r['next_ret'] is not None else None) for r in ser if r['signal'] != 0])
print('lector demo pnl (suma de retornos con señal):', {k: round(v*100, 1) for k, v in lec_pnl.items()})
print('presion lunes:', {k: round(v, 3) for k, v in press.items()}, 'lector:', lector)
