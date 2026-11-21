# MCP propio · contratos

Endpoint: `POST /mcp` del Worker. JSON-RPC 2.0 sobre HTTP, sin estado (`initialize`, `ping`, `tools/list`, `tools/call`; las notificaciones responden `202`). Protocolo `2025-06-18`. Cada respuesta de herramienta trae `content` (texto JSON) y `structuredContent` (el objeto).

**Permisos:** para terceros es de solo lectura. `correr_backtest` exige `Authorization: Bearer <MCP_TOKEN>`; sin token devuelve `isError: true`. Todas las respuestas llevan la misma advertencia: laboratorio educativo, no asesoramiento.

Conectar desde Claude: añadir un conector MCP remoto con la URL `https://<worker>/mcp`.

## `ranking`
Ranking de la última corrida completa (o de `run_id`), global o por segmento.

| Entrada | Tipo | Notas |
| --- | --- | --- |
| `segmento` | string | `_global` (por defecto), un mercado (`Cripto`, `Europa`…) o una economía (`Emergentes`…) |
| `run_id` | string | opcional |

Salida: `{ run_id, segment, monkeys: {n, seed, p05, p50, p95, best_of_n_p95}, rows: [{ investor_id, name, family, total_return, sharpe, max_dd, trades, pct_vs_monkeys, dsr }] }`, ordenado por retorno. En segmentos solo hay `total_return`.

## `explicar_decision`
Por qué un inversionista tomó una posición: los números exactos de su regla.

| Entrada | Tipo | Notas |
| --- | --- | --- |
| `inversionista` | string | id (`elastico-10-z1-5`) |
| `simbolo` | string | `NVDA`, `BTC-USD`, `SAN.MC`… |
| `fecha` | string | YYYY-MM-DD; por defecto la última |
| `run_id` | string | por defecto `paper` |

Salida (ejemplo real, `wrangler dev`, 20-nov-2026):

```json
{ "date": "2026-11-20", "position": 1,
  "reason": { "investor": "elastico-10-z1-5", "version": "1.0.0", "symbol": "NVDA", "close": 125.53,
              "previous": 1, "rule": "entra contra |z| > 1.5; sale al cruzar z = 0", "z": -2.13414, "sma": 158.44, "threshold": 1.5 } }
```

## `correr_backtest` (requiere token)
Lanza el `BacktestWorkflow` con el elenco completo.

| Entrada | Tipo | Notas |
| --- | --- | --- |
| `inicio`, `fin` | string | YYYY-MM-DD |
| `monos` | integer | por defecto 2.000 |
| `semilla` | integer | por defecto 7 |

Salida: `{ run_id, estado }`. El resultado queda en D1 (`runs`, `metrics`, `equity_daily`, `monkey_stats`) y se consulta con `ranking`. `GET /v1/backtest/<run_id>` da el estado del Workflow.

## `presion_noticias`
Presión de noticias de un activo en un instante, la señal de El Lector y las noticias que la empujan.

| Entrada | Tipo | Notas |
| --- | --- | --- |
| `simbolo` | string | |
| `instante` | string | ISO 8601; por defecto ahora |

Salida: `{ simbolo, instante, presion, lector: -1|0|1, noticias: [{ event_id, title, event_type, impact }] }`. Ejemplo: NVDA el 13-nov-2026 a las 21:00 UTC → presión −0,569, El Lector −1 (renuncia de Huang + elecciones).

## `comparar_versiones`
Campeón contra retador: dos corridas inversionista a inversionista.

| Entrada | Tipo | Notas |
| --- | --- | --- |
| `run_a`, `run_b` | string | ids de corrida |
| `segmento` | string | por defecto `_global` |

Salida: `{ run_a, run_b, filas: [{ investor_id, a_return, b_return, a_dsr, b_dsr, delta }] }`, ordenado por `delta`.

## API REST equivalente (dashboard)

| Método y ruta | Uso |
| --- | --- |
| `GET /health` | versión del motor y de la taxonomía |
| `GET /v1/investors` | elenco con reglas y `config_hash` |
| `GET /v1/ranking?segment=&run=` | igual que `ranking` |
| `GET /v1/pressure?symbol=&at=` | igual que `presion_noticias` |
| `GET /v1/decisions?investor=&symbol=` | historial del Durable Object del inversionista |
| `POST /v1/backtest` (token) | `{ start, end, monkeys?, seed? }` |
| `GET /v1/backtest/:id` | estado del Workflow |
| `POST /v1/decide` (token) | `{ date, investors? }` relanza las decisiones de paper trading de un día (idempotente) |
