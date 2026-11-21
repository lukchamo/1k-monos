# Despliegue en Cloudflare

## Lo que ya está desplegado (cuenta CooWeb, 21-nov-2026)

| Pieza | Dónde |
| --- | --- |
| Web | https://1k-monos-web.lc-45e.workers.dev |
| API y MCP | https://laboratorio-inversionistas.lc-45e.workers.dev |
| Base de datos D1 | `lab-inversionistas` (8.483 precios, 330 sesiones, 9 noticias, una corrida y las decisiones del 20-nov) |
| Buckets R2 | `lab-inversionistas-raw`, `1k-monos-web-cache` |
| AI Gateway | `lab-inversionistas` |
| Artifacts | namespace `lab-1k-monos`, repositorio `microui` con tres vistas |
| Despliegue continuo | Workers Builds conectado a `lukchamo/1k-monos`: cada push a `ccr-c7c96330-eqn0wu` compila y publica los dos Workers |
| Observabilidad | Logs, logs de invocación y trazas activos en los dos Workers |

Pendiente de tu parte:

- **Rotar `MCP_TOKEN`.** Se generó durante el despliegue y quedó escrito en la conversación de trabajo. `npx wrangler secret put MCP_TOKEN` en `worker/`.
- **`FIRECRAWL_API_KEY` y `TWELVE_DATA_API_KEY`.** Sin ellas el laboratorio no escucha noticias ni precios nuevos: enseña el experimento hasta el 20-nov-2026. La ingesta está en pausa, no rota.
- **Rama de producción.** Cuando exista `main`, cambia la rama de los dos disparadores en Workers → Settings → Builds.
- **Dominio** (sección 5).

El resto de este documento explica cómo repetirlo desde cero.

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

## 6 bis. Correo diario al autor

Tras cada cierre con decisiones, el Worker envía un resumen a la dirección del secreto `DIGEST_TO` usando Cloudflare Email Service (binding `EMAIL`). El remitente es la variable `DIGEST_FROM` y debe pertenecer a un dominio dado de alta en Email Service; hoy es provisional (`laboratorio@unifyflow.app`) hasta tener dominio propio.

```bash
npx wrangler secret put DIGEST_TO          # tu correo; no se guarda en el repositorio
# enviar o previsualizar a mano el de una fecha
curl -X POST https://<tu-api>/v1/digest -H "authorization: Bearer $MCP_TOKEN" \
     -H 'content-type: application/json' -d '{"date":"2026-11-20","send":false}'
```

Sin precios nuevos (falta `TWELVE_DATA_API_KEY`) no hay cierres nuevos y por tanto no hay correos automáticos.

## 6 ter. Avisos del navegador (Web Push)

La web ofrece «Avísame cuando detecte algo». Las suscripciones se guardan en D1 (`push_subs`) y el aviso sale junto al correo, tras cada cierre con llamadas nuevas. Hace falta un par de claves VAPID: la pública va en `VAPID_PUBLIC_KEY` (`worker/wrangler.jsonc`) y la privada en el secreto `VAPID_PRIVATE_KEY`. Si cambias las claves, todas las suscripciones existentes dejan de funcionar.

```bash
# enviar un aviso de prueba a todos los suscritos
curl -X POST https://<tu-api>/v1/push/test -H "authorization: Bearer $MCP_TOKEN" -H 'content-type: application/json' -d '{}'
```

En iPhone los avisos solo funcionan si la web está añadida a la pantalla de inicio.

## 7. Cloudflare Artifacts (experimental)

Las micro-interfaces de `/experimentos` viven en un repositorio Git de Artifacts (plan Workers Paid, beta abierta): namespace `lab-1k-monos`, repositorio `microui`, rama `main`. La web lo lee con el binding `ARTIFACTS` de `web/wrangler.jsonc`; si falla, usa las vistas de `web/microui/`.

Para publicar una vista nueva, pide un token de escritura del repositorio (panel de Artifacts, o `POST /accounts/{id}/artifacts/namespaces/lab-1k-monos/tokens`) y usa Git normal:

```bash
git clone https://x:<token>@<account_id>.artifacts.cloudflare.net/git/lab-1k-monos/microui.git
# añade mi-vista.json, inclúyela en index.json, commit y push
```

La página se actualiza sola en su siguiente regeneración (5 minutos como mucho). Artifacts se factura por uso.

## Cómo está montada la caché

- **Estáticos** (`/_next/static/*`): los sirve Cloudflare sin invocar el Worker, con caché de un año e inmutable (`web/public/_headers`).
- **Páginas**: ISR por tiempo. Portada 5 min, noticias 2 min, inversionistas 10 min, método 1 h.
- **Caché incremental en R2** con caché regional delante: una página ya generada se sirve desde el punto de presencia.
- **Cola en Durable Objects**: una sola regeneración por página aunque lleguen muchas visitas a la vez.
- **Interceptación de caché**: una página en caché se responde sin arrancar el servidor de Next.
- **Datos**: una sola llamada a `/v1/lab` por render, compartida 30 s dentro del mismo isolate.
- **Indicador en vivo**: `/api/live` se cachea 20 s en el borde; mil pestañas abiertas son una consulta.

No usamos Cache Components (`use cache`) de Next 16: en Workers todavía provoca renders que se quedan colgados (opennextjs-cloudflare #1318). Cuando se cierre, la migración es directa.
