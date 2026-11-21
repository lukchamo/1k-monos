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

| D-18 | **Resumen diario solo para el autor.** Tras cada cierre, el laboratorio envía por correo a una única dirección (secreto `DIGEST_TO`) los activos donde al menos la mitad neta de los inversionistas coincide, y verifica las llamadas anteriores con el cierre siguiente. | El autor quiere seguir el experimento sin abrir la web, y comprobar si el consenso acierta. | No es un servicio de señales: un destinatario, nunca usuarios (D-16). El historial de aciertos sí es público en `/v1/calls`, como un resultado más del experimento. Abrirlo a terceros exigiría consulta legal previa. |

## Diferencias conocidas entre la PoC y producción

- **Fuentes de precios.** La PoC usó Yahoo Finance vía Firecrawl, contrastado con Twelve Data. El Worker trae Twelve Data y CoinGecko con API REST; falta enchufar la segunda fuente de acciones antes de exigir la validación cruzada en todo el universo.
- **Sesiones futuras.** El Worker añade los 5 días hábiles siguientes sin calendario de festivos de NYSE. Añadir festivos antes de producción.
- **Extracción.** El prompt `extract-1.0` y el modelo están puestos, pero sin probar contra noticias reales: medir la tasa de JSON válidos al primer intento (meta ≥ 95 %) y el coste por noticia.
