# Despliegue en Cloudflare

Dos Workers en la misma cuenta: `laboratorio-inversionistas` (la API) y `1k-monos-web` (la web). La web habla con la API por service binding, así que **la API se despliega primero**.

## 1. Recursos (una sola vez)

```bash
cd worker
npx wrangler d1 create lab-inversionistas            # pega el database_id en worker/wrangler.jsonc
npx wrangler r2 bucket create lab-inversionistas-raw
npx wrangler r2 bucket create 1k-monos-web-cache     # caché ISR de la web
# AI Gateway: crea "lab-inversionistas" en el panel (AI → AI Gateway) y activa Guardrails
npx wrangler secret put MCP_TOKEN                    # 32+ caracteres aleatorios
npx wrangler secret put FIRECRAWL_API_KEY
npx wrangler secret put TWELVE_DATA_API_KEY
```

## 2. La API

```bash
cd worker
npm run db:migrate:remote
npm run deploy                 # corre typecheck y tests antes de publicar
```

Siembra los precios del experimento y lanza la primera corrida:

```bash
node scripts/seed.mjs
npx wrangler d1 execute lab-inversionistas --remote --file seed/prices.sql
curl -X POST https://<tu-api>/v1/backtest -H "authorization: Bearer $MCP_TOKEN" \
     -H 'content-type: application/json' -d '{"start":"2025-11-20","end":"2026-11-20"}'
curl -X POST https://<tu-api>/v1/decide -H "authorization: Bearer $MCP_TOKEN" \
     -H 'content-type: application/json' -d '{"date":"2026-11-20"}'
```

## 3. La web

```bash
cd web
NODE_ENV=production npm run deploy     # opennextjs-cloudflare build + deploy (también llena la caché en R2)
```

Si la API aún no tiene datos, la web sirve la foto de `web/data/snapshot.json` y lo dice en pantalla. Para refrescar esa foto: `LAB_API_URL=https://<tu-api> npm run snapshot`.

## 4. Despliegue continuo con Workers Builds

En el panel: Workers → cada Worker → Settings → Builds → conectar el repositorio de GitHub.

| Worker | Directorio raíz | Build | Deploy |
| --- | --- | --- | --- |
| `laboratorio-inversionistas` | `worker` | `npm run check` | `npx wrangler deploy` |
| `1k-monos-web` | `web` | `npx opennextjs-cloudflare build` | `npx opennextjs-cloudflare deploy` |

Añade `NODE_ENV=production` a las variables de build de la web.

## 5. Dominio

Con el dominio en Cloudflare (ver [DOMINIOS.md](DOMINIOS.md)), añade a cada `wrangler.jsonc`:

```jsonc
"routes": [{ "pattern": "1kmonos.com", "custom_domain": true }]          // web
"routes": [{ "pattern": "api.1kmonos.com", "custom_domain": true }]      // API
```

y cambia `NEXT_PUBLIC_SITE_URL` en `web/wrangler.jsonc`.

## 6. Observabilidad

Ya viene activada en los dos `wrangler.jsonc` (logs, logs de invocación y trazas). Se consulta en Workers → Observability. Consultas útiles: `level = "error"` y `$workers.outcome != "ok"`.

## 7. Cloudflare Artifacts (experimental)

Las micro-interfaces de `/experimentos` pueden vivir en un repositorio Git de Artifacts (plan Workers Paid, beta abierta).

```bash
npx wrangler artifacts namespaces create lab-1k-monos       # o desde el panel
# crea el repositorio "microui" y sube el contenido de web/microui/ a la rama main
```

Después descomenta el bloque `"artifacts"` de `web/wrangler.jsonc` y vuelve a desplegar. Sin el binding, la página usa las vistas de `web/microui/`. Los nombres exactos de los comandos de Artifacts pueden cambiar durante la beta: comprueba `npx wrangler artifacts --help`.

## Cómo está montada la caché

- **Estáticos** (`/_next/static/*`): los sirve Cloudflare sin invocar el Worker, con caché de un año e inmutable (`web/public/_headers`).
- **Páginas**: ISR por tiempo. Portada 5 min, noticias 2 min, inversionistas 10 min, método 1 h.
- **Caché incremental en R2** con caché regional delante: una página ya generada se sirve desde el punto de presencia.
- **Cola en Durable Objects**: una sola regeneración por página aunque lleguen muchas visitas a la vez.
- **Interceptación de caché**: una página en caché se responde sin arrancar el servidor de Next.
- **Datos**: una sola llamada a `/v1/lab` por render, compartida 30 s dentro del mismo isolate.
- **Indicador en vivo**: `/api/live` se cachea 20 s en el borde; mil pestañas abiertas son una consulta.

No usamos Cache Components (`use cache`) de Next 16: en Workers todavía provoca renders que se quedan colgados (opennextjs-cloudflare #1318). Cuando se cierre, la migración es directa.
