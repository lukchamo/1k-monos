"""Convierte los resultados del backtest en datasets JSON {rows, meta} para el dashboard."""
from pathlib import Path
HERE = Path(__file__).resolve().parent
DATA, OUT, SHARED = HERE / "data", HERE / "out", HERE.parent / "shared"
OUT.mkdir(exist_ok=True)
import json, math
import pandas as pd

R = json.load(open(OUT / 'results.json'))
EV = json.load(open(SHARED / 'sample_events.json'))
SC = json.load(open(SHARED / 'news_event.schema.json'))
UNI = json.load(open(OUT / 'universe.json'))
CODE = [{"label": f, "value": open(HERE / f).read(), "type": "code", "lang": "python"} for f in ['backtest.py', 'build_news.py', 'export.py']]
INPUT = {"label": "Entrada", "value": "Cierres diarios ajustados de Yahoo Finance vía Firecrawl (20-nov-2025 a 20-nov-2026), cruzados con cierres semanales de Twelve Data; 9 noticias reales de Firecrawl (búsqueda de noticias con filtro de fecha)."}
NAMES = {'buyhold': ('Compra y mantén', 'Control'), 'monkey': ('El Mono', 'Control aleatorio'), 'momentum': ('La Tendencia', 'Momentum'),
         'meanrev': ('El Elástico', 'Reversión a la media'), 'breakout': ('El Cazador', 'Ruptura de canal'),
         'macro': ('El Macro', 'Régimen de riesgo'), 'antagonist': ('El Abogado del Diablo', 'Antagonista')}
RULES = {
 'buyhold': 'Siempre largo en los 16 activos, con el mismo capital en cada uno.',
 'monkey': 'Largo, corto o fuera al azar, re-sorteado cada 5 sesiones (semilla 7).',
 'momentum': 'Largo si el cierre está sobre la media de 50 días y subió en 20 días; corto si está debajo y bajó.',
 'meanrev': 'Compra si cae 1,5 desviaciones bajo la media de 20 días, vende en corto si sube 1,5; sale al volver a la media.',
 'breakout': 'Largo al superar el máximo de 20 días, corto al perforar el mínimo; sale con el canal de 10 días contrario.',
 'macro': 'VIX 5% sobre su media de 20 días: corto en alta beta, largo en oro. VIX 5% debajo: largo en riesgo. Tipos a 10 años subiendo: corto en bonos largos.',
 'antagonist': 'Si 2 o más de los 4 inversionistas de tesis coinciden en una dirección, toma la contraria.',
}
PENDING = [
 ('lector', 'El Lector', 'Noticias', 'Largo si la presión de noticias del activo supera +0,30; corto si baja de -0,30. Presión = tanh de la suma de impactos con decaimiento.', 'Necesita la ingesta de noticias fechadas de todo el año (fase 2). Abajo se muestra con 9 noticias reales.'),
 ('liquidez', 'El Rotador', 'Rotación de liquidez', 'Corto en los pares de una mega-salida a bolsa durante su semana de colocación y en desbloqueos de acciones (lockups); largo cuando termina la oferta.', 'Necesita el calendario de salidas a bolsa y desbloqueos (eventos ipo_*, lockup_expiry, liquidity_supply).'),
 ('valor', 'El Valorista', 'Valor', 'Largo en lo más barato por múltiplos frente a su propia historia, corto en lo más caro; rebalanceo mensual.', 'Necesita fundamentales trimestrales con fecha de publicación (point-in-time).'),
]

def r2(x, n=2):
    return None if x is None or (isinstance(x, float) and math.isnan(x)) else round(x, n)

def dump(name, rows, extra=None):
    meta = CODE + [INPUT] + (extra or [])
    json.dump({"rows": rows, "meta": meta}, open(OUT / f'ds_{name}.json', 'w'), ensure_ascii=False)
    return name

order = ['buyhold', 'monkey', 'momentum', 'meanrev', 'breakout', 'macro', 'antagonist']
lb = []
for k in order:
    m = R['results'][k]
    lb.append(dict(id=k, nombre=NAMES[k][0], estilo=NAMES[k][1], regla=RULES[k], estado='calculado',
                   retorno_pct=r2(m['total_return'] * 100, 4), sharpe=r2(m['sharpe']), max_dd_pct=r2(m['max_dd'] * 100, 1),
                   operaciones=m['trades'], percentil_monos=r2(m['pct_vs_monkeys'] * 100, 0),
                   exp_larga_pct=r2(m['long_exposure'] * 100, 0), exp_corta_pct=r2(m['short_exposure'] * 100, 0),
                   capital_final=r2(100000 * (1 + m['total_return']), 0), nota=None))
for k, n, e, rule, note in PENDING:
    lb.append(dict(id=k, nombre=n, estilo=e, regla=rule, estado='pendiente', retorno_pct=None, sharpe=None, max_dd_pct=None,
                   operaciones=None, percentil_monos=None, exp_larga_pct=None, exp_corta_pct=None, capital_final=None, nota=note))
dump('ranking', lb)

cur = pd.read_csv(OUT / 'curves.csv', index_col=0)
rows = []
for d, row in cur.iterrows():
    for k in order:
        rows.append(dict(fecha=d[:10], inversor=k, nombre=NAMES[k][0], capital=round(float(row[k]), 0)))
dump('curvas', rows)

rows = []
for k in order:
    for a, v in R['results'][k]['pnl'].items():
        rows.append(dict(inversor=k, nombre=NAMES[k][0], activo=a, pnl_usd=round(v, 0)))
dump('pnl_activo', rows)

dump('universo', [dict(activo=u['symbol'], nombre=u['name'], grupo=u['group'], volatilidad=u['vol_tier'], desde=u['first'],
                         retorno_pct=r2(u['ret_period'] * 100, 1), vol_anual_pct=r2(u['vol_annual'] * 100, 0),
                         max_dd_pct=r2(u['max_dd'] * 100, 1), ultimo_cierre=r2(u['last_close'], 2)) for u in UNI])

rows = []
for k in order:
    for a, v in R['today'][k].items():
        rows.append(dict(inversor=k, nombre=NAMES[k][0], activo=a, posicion=int(v)))
for u in UNI:
    a = u['symbol']
    rows.append(dict(inversor='lector', nombre='El Lector', activo=a, posicion=int(R['lector'].get(a, 0))))
dump('posiciones', rows)

dump('monos', [dict(mono=i + 1, retorno_pct=round(v * 100, 2)) for i, v in enumerate(R['monkeys']['all'])])

import sys; sys.path.insert(0, str(HERE)); import build_news as bn
from datetime import datetime, timezone
at = datetime(2026, 11, 23, 14, 30, tzinfo=timezone.utc)
rows = []
for e in EV:
    en = e['entities'][0]; o = e.get('outcome', {})
    rows.append(dict(event_id=e['event_id'], efectivo=e['timing']['effective_at'][:16].replace('T', ' ') + ' UTC',
                     publicado=e['timing']['published_at'][:10], fuente=e['source']['name'], tier=e['source']['tier'], url=e['source']['url'],
                     titular=e['content']['title'], resumen=e['content']['summary_es'], tipo_evento=e['classification']['event_type'],
                     temas=', '.join(e['classification']['themes']), factores_macro=', '.join(e['classification']['macro_factors']),
                     direccion=e['signal']['direction'], sorpresa=e['signal']['surprise'], novedad=e['signal']['novelty'],
                     hype=e['signal']['hype'], horizonte=e['signal']['horizon'], activo=en['symbol'], sentimiento=en['sentiment'],
                     impacto_lunes=round(bn.impact(e, en, at), 3),
                     reaccion_1d_pct=r2(o['ret_1d'] * 100, 1) if o else None,
                     divergencia=('sí' if o.get('reaction_divergence') else 'no') if o else 'aún no',
                     json=json.dumps(e, ensure_ascii=False, indent=2)))
dump('noticias', rows)

ps = pd.read_csv(OUT / 'pressure_series.csv')
dump('presion', [dict(fecha=r.date, activo=r.symbol, presion=round(r.pressure, 3), senal=int(r.signal),
                      ret_siguiente_pct=None if pd.isna(r.next_ret) else round(r.next_ret * 100, 2)) for r in ps.itertuples()])

WHO = {'computed_market_context': 'Worker (precios)', 'outcome': 'Worker (después, solo evaluación)', 'timing': 'Worker + fuente',
       'event_id': 'Worker', 'schema_version': 'Worker', 'extraction': 'Worker (registro)', 'dedup': 'Worker', 'source': 'Worker + IA'}
rows = []
for blk, spec in SC['properties'].items():
    who = WHO.get(blk, 'IA (desde el texto)')
    if spec.get('type') == 'object' and 'properties' in spec:
        for f, fs in spec['properties'].items():
            t = 'enum: ' + ', '.join(map(str, fs['enum']))[:90] if 'enum' in fs else fs.get('type', 'object')
            if fs.get('type') == 'number' and 'minimum' in fs: t = f"número [{fs['minimum']}, {fs['maximum']}]"
            if blk == 'timing' and f == 'effective_at': w = 'Worker (nunca la IA)'
            else: w = who
            rows.append(dict(bloque=blk, campo=f, tipo=t, llena=w, descripcion=fs.get('description', '')))
    elif spec.get('type') == 'array':
        it = spec['items'].get('properties', {})
        for f, fs in it.items():
            t = 'enum: ' + ', '.join(map(str, fs['enum']))[:90] if 'enum' in fs else fs.get('type', '')
            if fs.get('type') == 'number' and 'minimum' in fs: t = f"número [{fs['minimum']}, {fs['maximum']}]"
            rows.append(dict(bloque=blk + '[]', campo=f, tipo=t, llena=who, descripcion=fs.get('description', '')))
    else:
        rows.append(dict(bloque='raíz', campo=blk, tipo=str(spec.get('const', spec.get('type', ''))), llena=who, descripcion=spec.get('description', '')))
dump('esquema', rows, [{"label": "news_event.schema.json", "value": json.dumps(SC, ensure_ascii=False, indent=2), "type": "code", "lang": "json"}])
import os
for f in sorted(os.listdir(OUT)):
    if f.startswith('ds_'): print(f, os.path.getsize(OUT / f))
