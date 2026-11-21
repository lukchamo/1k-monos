# CLAUDE.md · Laboratorio de inversionistas determinísticos

Producto de **CooWeb / LuchoIA**. Laboratorio educativo donde 10–30 inversionistas virtuales con reglas fijas compiten en largo y corto sobre mercados reales. La IA solo convierte noticias en JSON etiquetado; **las reglas deciden**. Contexto completo: `docs/PRD.md` (producto), `docs/SPEC.md` (técnica), `docs/ALGORITMOS.md` (reglas y resultados), `docs/DECISIONES.md` (por qué es así).

## Reglas de oro (no negociables)

1. **Determinismo.** Mismas entradas + mismo `config_hash` = mismo resultado al céntimo. Nada de `Math.random()`, `Date.now()` ni orden de iteración no garantizado dentro del motor. El azar solo existe en los monos, con generador y semilla explícitos.
2. **Point-in-time.** Ninguna regla lee un dato con fecha posterior a su instante de decisión. La señal se calcula al cierre de t y gana el retorno de t+1. `worker/test/point-in-time.test.ts` lo vigila: si lo rompes, falla.
3. **`outcome` aislado.** El resultado ex-post de una noticia (`news_outcomes`, `outcome`) nunca es entrada de una decisión. Solo sirve para calibrar una versión nueva de la taxonomía.
4. **`effective_at` lo calcula el Worker, nunca el LLM.** Hora desconocida = desde la apertura siguiente.
5. **Costes siempre.** 10 pb por unidad de cambio de posición y coste diario de estar corto. Un backtest sin costes no se publica.
6. **Versionado.** Cambiar un parámetro, un peso o un prompt crea una versión nueva (regla, `tax-x.y`, `extract-x.y`). Cada intento cuenta en el número de pruebas del DSR.
7. **Puerta de paridad.** El motor TS debe reproducir la referencia Python (`research/`) posición a posición. Si cambias una regla, cámbiala en los dos lados, regenera el golden (`python research/golden.py`) y deja los tests en verde. No se despliega con la paridad rota.
8. **No es asesoramiento.** Reglas públicas e iguales para todos. Nunca perfilar al usuario ni decirle qué hacer con su dinero (CNMV). Validar con un abogado antes de cobrar o publicar señales.

## Mapa del repositorio

```
docs/        PRD, SPEC (exportados de los docs), ALGORITMOS, DECISIONES, MCP
research/    referencia Python: exp30.py (30 inversionistas), backtest.py (v1 + El Lector),
             build_news.py (esquema y scoring de noticias), golden.py (genera la paridad), data/ (precios)
shared/      taxonomy.json (tax-1.0), news_event.schema.json, sample_events.json (9 noticias reales),
             golden/ (resultados dorados que el TS debe reproducir), schema.sql (copia de la migración D1)
worker/      Cloudflare Worker en TypeScript
  src/engine/    motor puro y sin APIs de Workers: series, panel, investors, backtest, stats, registry, explain
  src/news/      tipos NewsEvent, scoring (impacto, presión, El Lector), validación contra la taxonomía
  src/ingest/    precios (validación cruzada) y noticias (Firecrawl → IA vía AI Gateway → D1)
  src/do/        InvestorDO: un Durable Object por inversionista, con SQLite propio
  src/workflows/ BacktestWorkflow: backtest bajo demanda
  src/mcp.ts     MCP propio (JSON-RPC sobre HTTP): ranking, explicar_decision, correr_backtest, presion_noticias, comparar_versiones
  migrations/    esquema D1
  src/guard.ts   guardarraíles de la API: validación, límite de ritmo, token, saneado de texto de terceros
  test/          paridad, point-in-time, noticias, validación, guardarraíles
web/         Next.js 16 (App Router) en Cloudflare Workers con OpenNext
  app/           portada, /inversionistas/[id], /noticias, /metodo, /experimentos, /aviso, /api/live
  lib/api.ts     lectura de la API por service binding (LAB_API); si falla, sirve data/snapshot.json
  lib/microui.ts micro-interfaces declarativas leídas de Cloudflare Artifacts (validador estricto)
  microui/       especificaciones de ejemplo
scripts/     pentest.sh
```

## Comandos

```bash
# referencia Python (numpy, pandas, jsonschema)
python research/exp30.py           # el experimento de 30
python research/golden.py          # regenera shared/golden/*.json

# worker
cd worker && npm install
npm run check                      # typecheck + 208 tests (paridad incluida)
npm run db:migrate:local && npm run db:seed:local
npm run dev:local                  # sin Workers AI (no requiere login); token MCP local: dev-token
npx wrangler deploy --dry-run      # valida bindings y empaquetado

# web
cd web && npm install
LAB_API_URL=http://localhost:8787 npm run dev          # desarrollo
NODE_ENV=production npx opennextjs-cloudflare build    # build para Workers (NODE_ENV=production es obligatorio)
npx opennextjs-cloudflare preview --port 8788          # la web en el runtime real de Workers

# seguridad
TOKEN=<token> scripts/pentest.sh                       # contra la API (8787) y la web (8788) locales
```

## Web: reglas

- **Caché: ISR por tiempo** (`export const revalidate`). No actives `cacheComponents` ni `use cache`: en Workers cuelga renders (opennextjs-cloudflare #1318).
- Server Components por defecto. Solo son de cliente `CurvesChart` y `LivePulse`.
- Todo dato llega por `getLab()` (una llamada a `/v1/lab`). No añadas llamadas por componente.
- **El aviso «no es una recomendación» va en todas las páginas.** Ningún texto aconseja qué hacer con el dinero.
- Contenido de terceros (noticias, micro-interfaces) siempre como texto, nunca como HTML.
- Antes de escribir código de Next, lee la guía correspondiente en `web/node_modules/next/dist/docs/`.
- Las skills de Vercel (`.agents/skills/`) aplican: sin cascadas de `await`, datos mínimos hacia el cliente, nada de barrel imports.

## Convenciones

- Español en interfaz, docs y mensajes; taxonomía y nombres de campos en inglés para interoperar.
- El motor (`src/engine`, `src/news/scoring.ts`) es TypeScript puro: se prueba en Node con Vitest. Lo que toca bindings vive fuera.
- Nombres de inversionistas: los de `LINEUP` (`"Elástico 10 z1.5"`); ids en slug (`elastico-10-z1-5`).
- Cada decisión guarda su `reason_json` (`src/engine/explain.ts`). Si añades una regla, añade su explicación.
- Desviación estándar móvil con ddof = 1 (pandas); de una muestra completa, ddof = 0 (numpy). Mantén eso o rompes la paridad.
- Sin Ajv en el Worker (usa `new Function`, prohibido en Workers): la validación está en `src/news/validate.ts`.

## Estado y siguiente paso

Funciona y está probado: motor completo con paridad exacta, scoring de noticias, D1, Durable Objects, Workflow de backtest y MCP (probados de punta a punta en `wrangler dev`). También: API pública con guardarraíles, web en Next 16 probada en workerd y pentest de humo en verde (`docs/SEGURIDAD.md`). Pendiente de la fase 1: segunda fuente de precios para acciones (Yahoo vía Firecrawl, como en la PoC), confirmar mapeos de símbolos de Twelve Data, el prompt de extracción contra noticias reales, el dashboard conectado a la API y la racha como multiplicador de tamaño (no como asignador).
