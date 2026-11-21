"""Genera los resultados dorados (golden) que el port en TypeScript debe reproducir.

Es la puerta de paridad: si el Worker no da exactamente las mismas posiciones y los
mismos retornos que esta referencia en Python, el port tiene un bug.

Salida: shared/golden/exp30.golden.json y shared/golden/news.golden.json
Uso:    python research/golden.py
"""
import contextlib
import io
import json
import math
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
SHARED = HERE.parent / "shared"
GOLD = SHARED / "golden"
GOLD.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(HERE))

with contextlib.redirect_stdout(io.StringIO()):
    import exp30 as E  # noqa: E402  (corre el experimento completo)
import build_news as bn  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402


def pos_string(df: pd.DataFrame, asset: str) -> str:
    """Posiciones de un activo en todo el calendario como texto: '+' largo, '-' corto, '0' fuera."""
    v = df[asset].values
    return "".join("+" if x > 0 else "-" if x < 0 else "0" for x in v)


def r17(x: float):
    """float con los 17 dígitos; NaN se escribe como null (JSON válido)"""
    x = float(x)
    return None if math.isnan(x) else float(repr(x))


investors = {}
for name, (fam, pos) in E.INV.items():
    if name == "El Mono":
        continue  # el RNG de numpy (PCG64) no se replica en TS: los monos no entran en la paridad
    tot, sr_d, dd, r = E.metrics(E.DM[name])
    row = next(x for x in E.res if x["nombre"] == name)
    investors[name] = {
        "family": fam,
        "positions": {a: pos_string(pos, a) for a in E.U},
        "total_return": r17(tot),
        "sharpe_daily": r17(sr_d),
        "max_drawdown": r17(dd),
        "trades": int(row["trades"]),
        "dsr": r17(row["dsr"] / 100) if fam != "Control" else None,
        "segments": {g: r17(E.equity_from(E.DM[name], E.COLS[g])[-1] - 1) for g in E.COLS},
    }

SRs = [E.metrics(E.DM[n])[1] for n in E.thesis]
gold = {
    "generated_by": "research/golden.py",
    "window": {"start": E.START, "end": E.END},
    "calendar": [d.strftime("%Y-%m-%d") for d in E.C.index],
    "window_dates": [d.strftime("%Y-%m-%d") for d in E.D],
    "universe": E.U,
    "segments": E.SEG,
    "economies": E.ECON,
    "costs": {"per_unit_turnover": E.COST, "borrow_annual": {a: E.borrow(a) for a in E.U}},
    "n_thesis": E.NT,
    "sr_variance": r17(np.var(SRs)),
    "emax_sr_daily": r17(E.emax),
    "investors": investors,
    # muestras de indicadores para depurar el port paso a paso
    "indicator_samples": {
        a: {
            d.strftime("%Y-%m-%d"): {
                "close": r17(E.C.loc[d, a]),
                "sma20": r17(E.sma(E.C[a], 20).loc[d]),
                "std20": r17(E.C[a].rolling(20, min_periods=20).std().loc[d]),
                "z20": r17(((E.C[a] - E.sma(E.C[a], 20)) / E.C[a].rolling(20, min_periods=20).std()).loc[d]),
            }
            for d in E.D[::50]
        }
        for a in ["SPY", "NVDA", "BTC-USD", "SAN.MC", "SPCX"]
    },
}
(GOLD / "exp30.golden.json").write_text(json.dumps(gold, ensure_ascii=False, allow_nan=False))

# ---------- noticias: effective_at, impacto y presión en instantes fijos ----------
events = json.load(open(SHARED / "sample_events.json"))
symbols = sorted({e["symbol"] for ev in events for e in ev["entities"]})
t0 = datetime(2026, 11, 5, 0, 0, tzinfo=timezone.utc)
instants = [t0 + timedelta(hours=6 * i) for i in range(4 * 19)]  # cada 6 h del 5 al 23-nov
news = {
    "taxonomy_version": bn.TAX["version"],
    "effective_at": {ev["event_id"]: ev["timing"]["effective_at"] for ev in events},
    "pressure": {
        t.strftime("%Y-%m-%dT%H:%M:%SZ"): {s: r17(bn.pressure(events, s, t)) for s in symbols} for t in instants
    },
}
(GOLD / "news.golden.json").write_text(json.dumps(news, ensure_ascii=False, indent=1, allow_nan=False))

best = max(investors.items(), key=lambda kv: kv[1]["total_return"] if kv[1]["family"] != "Control" else -9)
print(f"golden ok · {len(investors)} inversionistas · {len(gold['calendar'])} sesiones · "
      f"mejor {best[0]} {best[1]['total_return']*100:.4f}% · {len(news['pressure'])} instantes de noticias")
