# 1K Monos · laboratorio abierto de inversionistas determinísticos

> **Esto es un experimento, no un consejo.** Nada de lo que hay aquí es una recomendación de inversión. Es un laboratorio abierto para aprender a interpretar mercados y a desconfiar de los resultados bonitos.

Treinta inversionistas virtuales, cada uno con una regla fija y pública, operan en largo y en corto sobre 23 mercados reales. Los medimos contra 2.000 monos que compran y venden al azar. La IA solo convierte noticias en etiquetas; **las reglas deciden**. Todo es reproducible: mismas entradas, mismo resultado al céntimo.

Un proyecto de código abierto de **CooWeb / LuchoIA**, bajo licencia [MIT](LICENSE).

**En vivo:** [1kmonos.com](https://1kmonos.com) · **API:** [api.1kmonos.com](https://api.1kmonos.com/v1/lab)

![Portada de 1K Monos](docs/img/portada.png)

## Qué dicen los datos hoy (20-nov-2025 → 20-nov-2026)

- El mejor fue **Elástico 10 z1.5**: +6,2 %, mejor que el 94 % de los monos. Comprar y mantener: −8,8 %.
- **Nadie ha demostrado ventaja todavía.** El mejor de 28 monos gana +27,3 % por pura suerte, y la probabilidad de que la ventaja del Elástico sea real es del 19 % (se exige 95 %).
- Copiar al que va en racha fue lo peor del año (−19 % a −21 %).

## Cómo está hecho

```
web/       Next.js 16 (App Router) sobre Cloudflare Workers con OpenNext. ISR con caché en R2.
worker/    La API del laboratorio: motor determinístico, D1, Durable Objects, Workflows, MCP y crons.
research/  La referencia en Python que produjo los números. El motor TS debe coincidir con ella.
shared/    Taxonomía de noticias, esquema JSON, resultados dorados y esquema SQL.
docs/      PRD, SPEC, algoritmos, decisiones, seguridad, despliegue y dominios.
media/     Vídeos de promoción y tutorial hechos con HTML y JavaScript, y su grabador.
scripts/   pentest.sh: pruebas de seguridad de humo contra tu despliegue.
```

```
                 cada 15 min                    cierre de EE. UU.
 noticias ──► Firecrawl ──► IA (etiqueta) ──► validador ──┐
                                                          ▼
 precios ───────────────────────────────────────────►   D1   ◄── 29 Durable Objects (uno por inversionista)
                                                          ▲
        web (Next 16, ISR) ──service binding──► API ──────┘ ──► MCP para asistentes de IA
```

## Arranque en local

Necesitas Node 22 o superior. Python 3.11+ solo si quieres regenerar la referencia.

```bash
# 1) la API
cd worker && npm install
npm run check                 # typecheck + 221 tests (paridad con Python, sin mirar el futuro, guardarraíles)
npm run db:migrate:local && npm run db:seed:local
npm run dev:local             # http://localhost:8787

# 2) en otra terminal: una corrida y las decisiones del último día
curl -X POST localhost:8787/v1/backtest -H 'authorization: Bearer dev-token-local-1234567890' \
     -H 'content-type: application/json' -d '{"start":"2025-11-20","end":"2026-11-20"}'
curl -X POST localhost:8787/v1/decide -H 'authorization: Bearer dev-token-local-1234567890' \
     -H 'content-type: application/json' -d '{"date":"2026-11-20"}'

# 3) la web
cd ../web && npm install
LAB_API_URL=http://localhost:8787 npm run dev      # http://localhost:3000
```

Sin API, la web sirve una foto empaquetada del experimento (`web/data/snapshot.json`) y lo indica en pantalla.

## API pública (solo lectura)

| Ruta | Qué devuelve |
| --- | --- |
| `GET /v1/lab` | Todo lo que pinta la web en una llamada |
| `GET /v1/ranking?segment=` | Ranking con percentil frente a los monos y Sharpe deflactado |
| `GET /v1/curves` | Curvas de capital de la última corrida |
| `GET /v1/news?limit=&symbol=` | Noticias etiquetadas |
| `GET /v1/positions?date=` | Posiciones de paper trading por inversionista |
| `GET /v1/pressure?symbol=&at=` | Presión de noticias de un activo |
| `GET /v1/decisions?investor=&symbol=` | Por qué decidió un inversionista |
| `GET /v1/market` | Cierres y recuento diario de largos y cortos del laboratorio (lo usa el playground) |
| `GET /v1/playground?investor=` | Cierres y posiciones diarias de un inversionista (lo usa el simulador) |
| `GET /v1/calls` | Llamadas de consenso y su verificación al cierre siguiente |
| `POST /mcp` | Servidor MCP (JSON-RPC) con cinco herramientas. Ver [docs/MCP.md](docs/MCP.md) |

Las rutas que escriben (`POST /v1/backtest`, `POST /v1/decide`, `POST /v1/digest`) exigen token. Cómo conectar un asistente al MCP: [/mcp](https://1kmonos.com/mcp).

## Contribuir

Lee [CONTRIBUTING.md](CONTRIBUTING.md). Lo más útil: proponer un inversionista nuevo, encontrar un fallo en el método o mejorar cómo se explica. Los fallos de seguridad van por [SECURITY.md](SECURITY.md), no por un issue público.

## Documentación

[Algoritmos](docs/ALGORITMOS.md) · [Decisiones](docs/DECISIONES.md) · [Seguridad y guardarraíles](docs/SEGURIDAD.md) · [Despliegue en Cloudflare](docs/DESPLIEGUE.md) · [Dominios](docs/DOMINIOS.md) · [PRD](docs/PRD.md) · [Spec](docs/SPEC.md) · [MCP](docs/MCP.md)

## Aviso

Laboratorio educativo y experimental con reglas iguales para todos. No es asesoramiento financiero, fiscal ni legal. Los resultados son simulaciones y pueden contener errores. Los resultados pasados no anticipan los futuros.
