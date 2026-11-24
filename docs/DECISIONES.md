# Decisiones

Registro de lo decidido y por qué. Una decisión nueva va al final; si una se revoca, se marca y se enlaza la que la sustituye.

| # | Decisión | Por qué | Consecuencia |
| --- | --- | --- | --- |
| D-01 | **La IA solo lee; las reglas deciden.** El LLM convierte cada noticia en un JSON NewsEvent v1 y no toma posiciones. | Los agentes que deciden con un LLM (Alpha Arena, AI Hedge Fund) no se pueden auditar ni repetir, y en público fueron erráticos. | Cada decisión es reproducible y explicable con su `reason_json`. La "corazonada" del LLM se registra aparte y empieza con peso 0 (RF-12). |
| D-02 | **Señal al cierre de t, retorno de t+1.** | Es la forma más simple de no mirar el futuro con datos diarios. | Nunca se opera intradía en el MVP. |
| D-03 | **Costes en todo backtest:** 10 pb por unidad de cambio; corto 2 % / 8 % / 10 % anual. | Sin costes, las reglas que operan mucho parecen geniales. | El Macro ±5 % (1.567 cambios) queda en evidencia; la racha diaria pierde incluso sin costes. |
| D-04 | **Control de suerte obligatorio:** 2.000 monos, umbral del mejor de N y Sharpe deflactado. | Con 28 tesis, el mejor por azar ya debería tener Sharpe 1,36. | Ningún inversionista se declara ganador por superar al mono medio. Meta: DSR ≥ 95 % en 3 meses de paper trading. |
| D-05 | **La racha ajusta tamaño, no dirección** (0,5×–1,5×, mensual, mínimo 20 operaciones). | Copiar al mejor reciente fue lo peor del año (−19 % a −21 %). | El asignador de la PoC se conserva solo para la paridad y como advertencia. |
| D-06 | **La intuición es memoria de situaciones parecidas** (k vecinos sobre 6 números), no un LLM. | Es determinística, medible y fue 2.ª del año. | En producción la huella suma etiquetas de noticias. |
| D-07 | **Python es la referencia; TypeScript, la producción, con puerta de paridad.** | Investigar es más rápido en pandas; producir en Workers exige TS. Dos implementaciones que no coinciden son un bug esperando. | `research/golden.py` genera el contrato; `worker/test/parity.test.ts` exige posiciones idénticas en 29 inversionistas × 23 activos × 330 sesiones. Hoy: 199 tests en verde. |
| D-08 | **Los monos usan un generador propio en TS (mulberry32, semilla 7)**, no el PCG64 de numpy. | Replicar PCG64 no aporta nada. | Los monos no entran en la paridad exacta; se exige la misma distribución (p05/p50/p95 y umbral del mejor de 28 dentro de bandas). |
| D-09 | **Un Durable Object por inversionista.** | Su estado es suyo y nadie más lo escribe; cada uno decide en paralelo. | El Abogado y la Racha recalculan sus dependencias dentro de su DO (barato y determinístico). |
| D-10 | **D1 como libro mayor; R2 para el texto crudo.** | El dashboard y el MCP consultan por fecha, inversionista y segmento: es relacional. | El JSON completo de cada noticia vive en D1 (columna `json`) y el texto original en R2. |
| D-11 | **Un día sin precios completos no se opera.** | El sistema no inventa. | `market_days.status = 'incomplete'` y los DO responden "día incompleto". |
| D-12 | **effective_at con horario real de NYSE** (9:30 de Nueva York, con horario de verano de EE. UU.). | La PoC usaba 14:30 UTC fijo, que falla de marzo a noviembre. | En noviembre ambos coinciden, así que la paridad con la PoC se mantiene. |
| D-13 | **Validación propia del JSON, sin Ajv.** | Ajv compila con `new Function`, prohibido en Workers. | `src/news/validate.ts` comprueba enums contra la taxonomía y rangos. Alternativa futura: `@cfworker/json-schema`. |
| D-14 | **MCP propio sin estado (JSON-RPC sobre HTTP).** | Cinco herramientas de lectura no necesitan sesión. | Si hace falta sesión o streaming, migrar al SDK de MCP de Cloudflare sin cambiar los contratos de `docs/MCP.md`. |
| D-15 | **Máximo 3 variantes por familia en producción** y una calibración al mes por familia. | Cada variante es una prueba más que encarece el DSR. | El elenco de 28 es de investigación; el de producción será más corto. |
| D-16 | **Laboratorio educativo con reglas iguales para todos.** | En España, recomendar personalizado es asesoramiento y exige autorización de la CNMV. | Nada de perfilar usuarios ni decir qué hacer con su dinero. Consulta legal antes de cobrar. |
| D-17 | **Producto de CooWeb / LuchoIA.** | Decisión de negocio. | Entidad que lo lanza: pendiente (ver preguntas abiertas del PRD). |

| D-18 | **Resumen diario solo para el autor.** Tras cada cierre, el laboratorio envía por correo a una única dirección (secreto `DIGEST_TO`) los activos donde largos y cortos se separan al menos un 25 % del elenco (máximo cinco), y verifica las llamadas anteriores con el cierre siguiente. | El autor quiere seguir el experimento sin abrir la web, y comprobar si el consenso acierta. | No es un servicio de señales: un destinatario, nunca usuarios (D-16). El historial de aciertos sí es público en `/v1/calls`, como un resultado más del experimento. Abrirlo a terceros exigiría consulta legal previa. |

| D-19 | **Avisos del navegador abiertos a cualquiera** (decisión del autor, 21-nov-2026). Quien visita la web puede activar un aviso cuando el laboratorio registra llamadas nuevas. | El autor quiere enterarse en el móvil sin abrir la web. Las llamadas ya son públicas en `/v1/calls`. | El texto del aviso solo describe y siempre dice que no es una recomendación. Aun así, avisar a terceros de posiciones en largo y corto se acerca a publicar señales: **pendiente de consulta legal** (D-16) antes de darle difusión. No se guarda ningún dato personal: solo la dirección técnica que da el navegador. |

| D-20 | **Simulador con dinero ficticio en la web** (`/simulador`). Sigue día a día a un inversionista o a un mono con un capital elegido, costes de bróker y apalancamiento opcional. | Ver el efecto de comisiones, intereses y apalancamiento sobre poco capital enseña más que el ranking. | Vive en la web (`web/lib/sim.ts`), fuera del motor: no afecta a la paridad ni al DSR. De Neverless solo se afirma lo que publica (comisión 0, divisa 0, hasta 5×); su diferencial e intereses son supuestos editables. No ejecuta órdenes reales ni se conecta a ningún bróker. |

| D-21 | **Playground manual** (`/playground`): cuenta de práctica donde el usuario añade saldo, elige activo y abre largos o cortos con hasta 5×, sobre los precios reales de cada día, avanzando el tiempo a su ritmo. El correo al autor enlaza cada llamada con el playground ya preparado. | El autor quiere practicar «como en Neverless» antes de pensar en dinero real. | Vive en la web (`web/lib/paper.ts`), fuera del motor. Nunca muestra precios futuros. La cuenta se guarda solo en el navegador. Las reglas de margen de Neverless que no son públicas (diferencial, intereses, margen de mantenimiento) son supuestos declarados en pantalla. |

| D-22 | **Tutoriales y vídeos** (`/tutoriales`): un tutorial interactivo dentro de la web y cinco vídeos (dos reels en vertical y en ancho, y un recorrido) alojados en Cloudinary. Los vídeos se generan desde `media/video.html` con una línea de tiempo en JavaScript y se graban fotograma a fotograma. | Explicar el laboratorio al público y tener material para promocionarlo. | Los vídeos solo usan datos del experimento real y dicen en pantalla que no es una recomendación. El caso del corto en Ethereum incluye que un día no demuestra nada. Si cambian los datos, se cambian los guiones y se vuelve a grabar. Promocionar el proyecto en redes sigue sujeto a D-16 y D-19: consulta legal antes de darle difusión amplia. |

| D-23 | **Voz en off en los vídeos y guía fácil en euros.** Los vídeos llevan narración generada con ElevenLabs y las escenas se alargan para ir al ritmo de la voz. `/tutoriales` suma una calculadora que traduce cada caso a euros y un vídeo guía con 50 € ficticios. | Con voz y con cantidades concretas se entiende sin saber de bolsa. | Los números de la guía y de la calculadora salen de las mismas reglas que el playground (`web/lib/paper.ts`), con un test que fija el precio de liquidación. Al preparar la guía apareció un error en ese cálculo en pantalla; está corregido. |

## Diferencias conocidas entre la PoC y producción

- **Fuentes de precios.** La PoC usó Yahoo Finance vía Firecrawl, contrastado con Twelve Data. El Worker trae Twelve Data y CoinGecko con API REST; falta enchufar la segunda fuente de acciones antes de exigir la validación cruzada en todo el universo.
- **Sesiones futuras.** El Worker añade los 5 días hábiles siguientes sin calendario de festivos de NYSE. Añadir festivos antes de producción.
- **Extracción.** El prompt `extract-1.0` y el modelo están puestos, pero sin probar contra noticias reales: medir la tasa de JSON válidos al primer intento (meta ≥ 95 %) y el coste por noticia.

## D-24 · MCP privado con Zero Trust, ingesta manual y prompt extract-1.1 (23-nov-2026)

- **MCP privado.** `mcp.1kmonos.com` va detrás de Cloudflare Access con Managed OAuth y código de un solo uso: el autor usa todas las herramientas sin token. El Worker solo valida el JWT de Access (`src/access.ts`). La puerta pública sigue siendo de lectura.
- **Ingesta manual (`POST /v1/ingest`, con token).** Sirve para cuando el cron no tiene claves de datos: recibe noticias ya buscadas o los cierres de un día con dos fuentes, y sigue el mismo camino que el cron (extracción versionada, validación, contraste de precios, decisiones y resumen). No abre un atajo: lo que no valida va a revisión y un día con discrepancia queda incompleto.
- **Prompt `extract-1.1`.** El 1.0 pedía usar «la taxonomía que se te da» sin incluirla; con las primeras noticias reales el modelo no devolvió la forma esperada y las seis fueron a revisión. El 1.1 incluye las listas cerradas, los símbolos del laboratorio y la forma del JSON. Las entidades fuera del universo se descartan antes de validar.
- **Cron de cierre.** `1-5` en Cloudflare es de domingo a jueves; pasa a `MON-FRI`.

## D-25 · Neverless en los correos y seguimiento entre cierres (24-nov-2026)

- **El correo dice dónde está cada activo en Neverless** (`src/brokers.ts`, foto del catálogo público). No cambia qué llamadas salen: las llamadas siguen siendo las de consenso sobre todo el universo, porque es lo que se verifica. Se añade un tablero con el reparto de votos de los activos que sí están en el bróker, descrito («mayoría en corto», «empate»), no convertido en señal.
- **Tres correos al día, no cuatro señales.** El laboratorio decide una vez, al cierre. Los dos correos nuevos (09:30 y 15:00 UTC, de lunes a viernes) son de seguimiento: cómo van las llamadas abiertas con el último precio. No escriben en la base ni verifican nada; la verificación sigue siendo con el cierre siguiente.
- **Precios del seguimiento:** cripto por CoinGecko y hasta seis símbolos por Twelve Data. Si un precio falla, el correo dice «sin precio» en vez de inventarlo.

