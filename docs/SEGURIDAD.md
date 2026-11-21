# Seguridad y guardarraíles

Qué protege al laboratorio, cómo se probó y qué queda pendiente. Última revisión: 21-nov-2026.

## Resultado del pentest

`scripts/pentest.sh` lanza 55 pruebas contra la API y la web. Se ejecutó en local (runtime real de Workers) y **contra producción** (`*.lc-45e.workers.dev`): todas correctas tras corregir el hallazgo de abajo.

| Bloque | Qué se intentó | Resultado |
| --- | --- | --- |
| Inyección | SQL en `symbol`, `investor`, `run` y por el MCP; rutas con `../`; segmentos inventados; límites y fechas absurdos; consulta de 2 KB | Todo rechazado con 400/404/414 antes de tocar la base de datos |
| Autenticación | Lanzar backtests y decisiones sin token, con token falso y con el literal `undefined`; métodos PUT y DELETE | 401 y 405 |
| Abuso de recursos | Un millón de monos, un rango de 11 años, cuerpo de 1 MB, cuerpo que no es JSON, lote MCP de 50 mensajes | 400 |
| Fuga de información | `outcome` de las noticias, trazas y SQL en errores, `.env`, `.git/config`, `wrangler.jsonc`, `worker.js` | Nada expuesto |
| Cabeceras | CSP, HSTS, nosniff, anti-iframe, política de referrer, sin `x-powered-by` | Presentes en web y API |
| XSS y redirecciones | HTML en la ruta y en la consulta; `//evil.com` | No se refleja ni redirige |
| Ritmo y carga | Ráfagas de 600 a 1.000 peticiones en paralelo | 429 cuando una IP se pasa; ningún error de servidor |

### Hallazgo en producción (corregido)

Con 1.000 peticiones simultáneas a `/v1/curves`, **455 devolvieron error 500**: cada petición consultaba la base de datos y D1 se saturaba. El límite de ritmo no lo evitaba porque el limitador de Cloudflare es aproximado: cuenta por punto de presencia y con retraso, así que una ráfaga en paralelo pasa antes de que salte.

Corrección: las lecturas públicas se guardan en memoria 30 a 120 segundos por isolate, de modo que cien visitas simultáneas comparten una sola consulta. Si aun así la base de datos se satura, la API responde 503 con `retry-after` en vez de 500. Repetida la prueba: 998 respuestas correctas, 2 limitadas, 0 errores.

Lección: el límite de ritmo de Workers frena el abuso sostenido, no una ráfaga corta. Para eso está la memoria de respuestas, y con dominio propio se suma la caché del borde. Si el tráfico crece, añadir una regla de rate limiting del WAF sobre el dominio.

Además: `npm audit` sin vulnerabilidades en la API. En la web quedan 3 avisos moderados (`glob`, `minimatch`) dentro de la herramienta de build de OpenNext; no llegan al código desplegado. Búsqueda de secretos en el repositorio: ninguno.

Esto es un pentest de humo automatizado, no una auditoría. Antes de manejar algo más que datos públicos conviene una revisión externa.

## Guardarraíles de la API (`worker/src/guard.ts`)

- **Lista blanca en todas las entradas.** Símbolos, inversionistas y segmentos deben existir en el universo del motor. Fechas reales y en rango. Enteros acotados.
- **SQL siempre con parámetros.** Ninguna consulta concatena texto del usuario.
- **Límite de ritmo por IP** en tres cubos: lectura (120/min), rutas pesadas y MCP (30/min), escritura (10/min). Las llamadas internas entre Workers no cuentan. Es un límite aproximado (ver el hallazgo de arriba).
- **Token en tiempo constante** para las rutas que escriben. Un secreto ausente o de menos de 16 caracteres nunca autoriza.
- **Tope de cuerpo de 16 KB** medido al leer, sin fiarse de `content-length`.
- **Backtests acotados:** 5 años y 5.000 monos como máximo.
- **Errores sin detalle.** El cliente recibe «error interno»; la traza va a los logs de Cloudflare.
- **Memoria de respuestas** en las lecturas públicas (30 a 120 s por isolate) y cabeceras de caché para el borde: una ráfaga de visitas no se convierte en una ráfaga de consultas.

## Guardarraíles de la IA (`worker/src/ingest/news.ts`)

La IA solo etiqueta noticias. Aun así, una noticia es texto de un desconocido que entra a un modelo, así que:

- **El texto de la noticia va como dato, no como instrucción**, y el modelo tiene orden explícita de no obedecer lo que diga.
- **Se limpia antes de entrar:** fuera caracteres invisibles y de control (los que se usan para esconder instrucciones), etiquetas HTML y todo lo que pase de 8.000 caracteres.
- **La salida pasa por un validador estricto:** solo valores de la taxonomía, rangos numéricos, formato fijo. Si falla dos veces, la noticia va a una cola de revisión y no se usa.
- **El modelo no controla lo importante:** cuándo empieza a contar una noticia (`effective_at`), a qué URL enlazamos y el resultado posterior (`outcome`) los pone el sistema.
- **Solo enlaces http(s) públicos.** Se descartan `javascript:`, `data:`, IPs privadas y `localhost`.
- **Filtro anti-consejo:** si el resumen suena a recomendación («compra ya», «rentabilidad garantizada»), se descarta.
- **Aunque todo falle, el daño es acotado:** una etiqueta manipulada solo mueve la señal de un inversionista (El Lector) en un experimento con dinero ficticio.

Pendiente: activar Guardrails de AI Gateway (clasificador de contenido en entrada y salida) cuando el gateway esté creado; es un ajuste del panel, no de código.

## Guardarraíles de la web

- **Cabeceras** en `web/next.config.ts`: CSP, HSTS con preload, nosniff, sin iframes, permisos de dispositivo cerrados.
- **Sin sesiones, cookies ni formularios.** No hay nada que robar en el navegador.
- **Contenido de terceros como texto.** Titulares y resúmenes los escapa React; los enlaces salen con `rel="noreferrer noopener nofollow"`.
- **La web no llama a internet para leer datos:** habla con la API por service binding.
- **Rutas dinámicas cerradas:** solo existen los inversionistas del elenco (`dynamicParams = false`).
- **Aviso en todas las páginas** y página `/aviso`.

Compromiso conocido: la CSP permite scripts en línea (`'unsafe-inline'`). Un nonce por petición lo evitaría, pero obliga a generar cada página en cada visita y desactiva la caché. Con una web sin datos de usuario, elegimos la caché.

## Guardarraíles de las micro-interfaces (`web/lib/microui.ts`)

Una micro-interfaz es un JSON, no código. Solo puede elegir entre cuatro bloques y leer rutas de cuatro conjuntos de datos públicos. No admite HTML, scripts ni URLs. Tamaño, número de bloques y de vistas acotados. Una especificación que no valida se rechaza entera y se avisa en la página.

## Observabilidad

Los dos Workers tienen activados logs, logs de invocación y trazas (`observability` en sus `wrangler.jsonc`), con mapas de fuente subidos. Los errores se registran como JSON con nivel y ruta para poder filtrarlos en el panel de Cloudflare (Workers → Observability).
