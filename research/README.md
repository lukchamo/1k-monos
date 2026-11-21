# research/ · la referencia en Python

Aquí nacieron todos los números de la PoC. Es la **fuente de verdad** del comportamiento: el Worker en TypeScript debe reproducirla exactamente (ver `worker/test/parity.test.ts`).

| Script | Qué hace | Salida |
| --- | --- | --- |
| `exp30.py` | El experimento de 30: 28 tesis en 7 familias + Compra y mantén + El Mono, 23 activos, 2.000 monos, mejor de N, DSR, ranking por segmento y economía | `out/exp30.json` |
| `backtest.py` | Backtest v1 (16 activos, 7 inversionistas, 500 monos), construye el esquema NewsEvent v1, valida las 9 noticias y corre la demo de El Lector | `shared/news_event.schema.json`, `shared/sample_events.json`, `out/results.json`, `out/curves.csv`, `out/pressure_series.csv` |
| `build_news.py` | Esquema JSON, las 9 noticias reales, `next_open`, `impact`, `pressure` (lo importa `backtest.py`) | — |
| `export.py` | Datasets del dashboard de la PoC (requiere haber corrido `backtest.py`) | `out/ds_*.json` |
| `racha_diag.py` | Variantes de la racha (semanal, mensual, sin costes) y el meta-modelo de igual peso | consola |
| `golden.py` | Resultados dorados para la paridad con TypeScript | `shared/golden/*.json` |

```bash
pip install -r requirements.txt
python backtest.py && python exp30.py && python golden.py
```

**Datos (`data/`):** cierres ajustados diarios de Yahoo Finance obtenidos vía el catálogo de Firecrawl (`prices_a/b/c.csv`, formato `SÍMBOLO,fecha,cierre_ajustado`) y cierres semanales de Twelve Data para el contraste (`td_weekly.csv`, diferencia máxima 0,4 %). Del 1-ago-2025 al 20-nov-2026; cripto incluye fines de semana (el motor los alinea al calendario de EE. UU.).

Si cambias una regla aquí, cámbiala igual en `worker/src/engine/`, corre `python golden.py` y deja `npm run check` en verde.
