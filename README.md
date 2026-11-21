# Laboratorio de inversionistas determinísticos

**CooWeb / LuchoIA** · paquete de arranque · 21-nov-2026

Entre 10 y 30 inversionistas virtuales, cada uno con una tesis y una regla fija, compiten en largo y corto sobre mercados reales. La IA solo convierte noticias en datos etiquetados; las decisiones son determinísticas, auditables y se miden contra el azar (2.000 monos y Sharpe deflactado) antes de arriesgar un euro.

> Laboratorio educativo con reglas iguales para todos. No es asesoramiento de inversión.

## Qué hay dentro

| Carpeta | Contenido |
| --- | --- |
| `docs/` | **PRD** y **SPEC** (Markdown + Word, con sus gráficos), **ALGORITMOS** (cada inversionista con su regla exacta y resultados), **DECISIONES**, contratos del **MCP** |
| `research/` | La referencia en Python que produjo todos los números: `exp30.py` (30 inversionistas), `backtest.py` (v1 + El Lector), `build_news.py` (esquema y scoring de noticias), `racha_diag.py`, `golden.py`, y los precios reales en `data/` |
| `shared/` | Taxonomía `tax-1.0`, JSON Schema NewsEvent v1, las 9 noticias reales etiquetadas, los resultados dorados y el esquema SQL |
| `worker/` | El Cloudflare Worker en TypeScript: motor con paridad exacta, noticias, D1, Durable Objects, Workflow de backtest y MCP |
| `CLAUDE.md` | Reglas de oro y mapa para seguir construyendo con Claude Code |

## Arranque en 5 minutos

```bash
# 1) la referencia (Python 3.11+)
pip install -r research/requirements.txt
python research/exp30.py          # ~10 s: imprime el ranking de los 30
python research/golden.py         # regenera shared/golden/

# 2) el Worker (Node 22+)
cd worker
npm install
npm run check                     # typecheck + 199 tests: paridad con Python, point-in-time, noticias
npm run db:migrate:local
npm run db:seed:local             # 8.483 precios + 9 noticias de la PoC
npm run dev:local                 # http://localhost:8787 (token local: dev-token)
```

Probar con el servidor local en marcha:

```bash
curl -X POST localhost:8787/v1/backtest -H 'authorization: Bearer dev-token' \
     -H 'content-type: application/json' -d '{"start":"2025-11-20","end":"2026-11-20"}'
curl localhost:8787/v1/ranking                      # cuando el Workflow termine
curl -X POST localhost:8787/mcp -H 'content-type: application/json' \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"presion_noticias","arguments":{"simbolo":"NVDA","instante":"2026-11-13T21:00:00Z"}}}'
```

## Desplegar en Cloudflare

```bash
cd worker
npx wrangler d1 create lab-inversionistas          # pegar el database_id en wrangler.jsonc
npx wrangler r2 bucket create lab-inversionistas-raw
# crear el AI Gateway "lab-inversionistas" en el panel de Cloudflare
npx wrangler secret put FIRECRAWL_API_KEY
npx wrangler secret put TWELVE_DATA_API_KEY
npx wrangler secret put MCP_TOKEN
npm run db:migrate:remote
npm run deploy                                     # corre typecheck + tests antes de desplegar
```

Crons: noticias cada 15 min; precios y decisiones de cada inversionista a las 22:30 UTC de lunes a viernes.

## Qué está probado y qué falta

| Pieza | Estado |
| --- | --- |
| Motor (7 familias, 28 tesis + 2 controles), métricas, DSR | ✅ Paridad exacta con Python: mismas posiciones en 29 inversionistas × 23 activos × 330 sesiones |
| No mirar el futuro | ✅ Test point-in-time: con precios cortados en 4 fechas, todos deciden igual |
| Noticias: effective_at, impacto, presión, El Lector, validación | ✅ Paridad con Python en 76 instantes |
| D1, Durable Objects, Workflow de backtest, MCP | ✅ Probados de punta a punta en `wrangler dev`: el Workflow reproduce +6,18 % del Elástico 10 z1.5 |
| Ingesta de precios | 🟡 Twelve Data + CoinGecko; falta la segunda fuente de acciones y confirmar mapeos de símbolos |
| Ingesta y extracción de noticias | 🟡 Código listo (Firecrawl → Workers AI vía AI Gateway → validación); falta probar el prompt con noticias reales |
| Dashboard conectado a la API | ⬜ La PoC existe como artefacto; falta apuntarla a `/v1/*` |
| Racha como multiplicador de tamaño | ⬜ Definida en el PRD; la PoC solo tiene el asignador (que pierde) |

## Lo que dicen los datos (20-nov-2025 → 20-nov-2026)

- El mejor fue **El Elástico 10 z1.5**: +6,2 %, peor caída −8,8 %, mejor que el 94 % de los monos. Comprar y mantener: −8,8 %.
- **Nadie ha demostrado ventaja todavía:** el mejor de 28 monos gana +20,9 % (p95) y el DSR del Elástico es 19 % (se exige ≥ 95 %).
- Copiar al que va en racha fue lo peor del año (−19 % a −21 %).
- El promedio de las 25 tesis perdió solo −2,3 %: muchas opiniones juntas valen más que el ganador de turno.

Detalle completo en `docs/ALGORITMOS.md`. Enlaces vivos: [PRD](https://claude.ai/artifact/BWvMWCuFWWv4SdQNz1qRGH) · [Spec](https://claude.ai/artifact/QyuSrtTRkNCxw3CjtRaH5G) · [Dashboard PoC](https://claude.ai/artifact/3rNGQZFSu6fJSdELyZNfVu)
