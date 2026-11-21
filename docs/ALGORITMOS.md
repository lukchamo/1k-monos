# Algoritmos: los inversionistas, el motor y el control de suerte

Catálogo de todo lo que ya funciona en la PoC. Cada regla existe dos veces y da **exactamente** lo mismo en las dos: la referencia en Python (`research/exp30.py`) y el port en TypeScript (`worker/src/engine/`). La puerta de paridad (`worker/test/parity.test.ts`) lo comprueba posición a posición en 23 activos × 330 sesiones.

Datos del experimento: cierres ajustados diarios de Yahoo Finance (vía Firecrawl), contrastados con Twelve Data, del 20-nov-2025 al 20-nov-2026 (252 sesiones de operación, con calentamiento desde el 1-ago-2025).

## 1. Reglas comunes a todos

| Regla | Detalle |
| --- | --- |
| Posición | −1 (corto), 0 (fuera) o +1 (largo) por activo. Sin apalancamiento. |
| Tiempo | La señal se calcula **al cierre de t** con datos hasta t. Gana o pierde el retorno de **t+1**. |
| Capital | Igual en cada activo, compuesto por activo, sin rebalanceo. La cartera es la media de las curvas. |
| Coste de operar | 10 pb por unidad de cambio de posición (pasar de −1 a +1 cuesta 20 pb). |
| Coste de estar corto | 2 % anual por defecto; 8 % en CRWV, SPCX, COIN, PLTR y TSLA; 10 % en cripto. Se cobra /252 por sesión. |
| Calendario | Sesiones de EE. UU. (fechas de SPY). Lo demás se alinea y se rellena hacia delante (Madrid en festivo de EE. UU., cripto en fin de semana). |
| Activo que aún no cotiza | NaN: posición 0 forzada (SpaceX antes del 12-jun-2026). |

```
retorno_diario(a, t+1) = P(t)·r(t+1) − |P(t) − P(t−1)|·0,001 − [P(t) < 0]·coste_corto(a)/252
```

## 2. Las familias

### La Tendencia (momentum) · `momentum(nSma, nRet)`
- **Tesis:** lo que sube sigue subiendo.
- **Regla:** largo si `cierre > SMA(nSma)` **y** `retorno(nRet) > 0`; corto si `cierre < SMA(nSma)` **y** `retorno(nRet) < 0`; si no, fuera. Sin estado.
- **Variantes:** 20/10, 50/20, 100/20, 50/60, 30/5.

### El Elástico (reversión a la media) · `elastico(n, z)`
- **Tesis:** lo que se estira demasiado vuelve a su media.
- **Regla:** `z = (cierre − SMA n) / desviación n` (desviación muestral, ddof = 1).
  - Fuera → largo si `z < −umbral`; fuera → corto si `z > +umbral`.
  - Largo → fuera cuando `z ≥ 0`; corto → fuera cuando `z ≤ 0`.
  - **Tiene estado:** mantiene la posición hasta volver a la media. Si el activo no cotiza, vuelve a 0.
- **Variantes:** 10 z1.5, 20 z1.0, 20 z1.5, 20 z2.0, 40 z1.5, 10 z2.0.
- **El que funcionó:** `Elástico 10 z1.5` fue el mejor del año (+6,2 %, Sharpe 0,49, peor caída −8,8 %, mejor que el 94 % de los monos). Ojo: su DSR es 19 %, lejos del 95 % exigido. Es el mejor candidato, no una ventaja demostrada.

### El Cazador (ruptura de canal) · `cazador(nIn, nOut)`
- **Tesis:** cuando el precio rompe su rango, empieza un movimiento.
- **Regla:** canal de entrada = máximo y mínimo de los **nIn cierres anteriores** (sin incluir hoy). Largo al superar el máximo, corto al perforar el mínimo. Sale del largo al perforar el mínimo de nOut, del corto al superar el máximo de nOut. Tiene estado.
- **Variantes:** 10/5, 20/10, 40/20, 55/20, 5/3.

### El Macro (régimen de riesgo) · `macro(banda, soloTipos)`
- **Tesis:** el miedo del mercado (VIX) y los tipos mandan.
- **Regla:** miedo = `VIX > SMA20(VIX)·(1+banda)`; calma = `VIX < SMA20(VIX)·(1−banda)`; tipos subiendo = `diff20(bono 10 años) > 0`.
  - Oro: largo con miedo. Bonos largos (TLT): corto si los tipos suben; si no, largo con miedo.
  - Beta alta (NVDA, TSLA, PLTR, CRWV, SPCX, COIN, cripto, EWZ, FXI): corto con miedo, largo con calma.
  - Resto: largo con calma.
  - *Solo tipos:* TLT, oro y beta alta cortos si los tipos suben, largos si bajan.
- **Variantes:** VIX ±3 %, ±5 %, ±10 %, solo tipos. Lección: con ±5 % opera demasiado (1.567 cambios); ±10 % fue el mejor Macro.

### El Abogado del Diablo (antagonista) · `abogado(grupo, k)`
- **Tesis:** cuando todos coinciden, el consenso suele estar en el precio.
- **Regla:** suma las posiciones del grupo en cada activo. Si la suma es ≥ k, se pone corto; si es ≤ −k, largo; si no, fuera. No es un inverso puro (perdería los costes dos veces): solo actúa cuando hay acuerdo.
- **Variantes:** contra 4 de tesis (k = 2), contra las 5 Tendencias (k = 3), contra las 20 base (k = 8).

### La Intuición por analogía (k vecinos) · `intuicion(k)`
- **Tesis:** "esto ya lo vi": situaciones parecidas acaban parecido.
- **Huella de 6 números** por activo y día:
  1. retorno 5 días / (vol20·√5)
  2. retorno 20 días / (vol20·√20)
  3. z de 20 días
  4. vol20 / vol60 − 1 (vol = desviación de los log-retornos diarios)
  5. VIX / SMA20(VIX) − 1
  6. diff20 del bono a 10 años
- **Regla:** el conjunto de comparación son todas las huellas pasadas de **cualquier activo** cuyo resultado a 5 días ya se conoce (hasta t−5). Se estandariza con media y desviación de ese conjunto (ddof = 0), se buscan las k más cercanas (distancia euclídea) y se mira cuántas subieron en los 5 días siguientes: ≥ 60 % → largo, ≤ 40 % → corto. Mínimo 200 ejemplos.
- **Resultado:** k = 25 quedó 2.º (+1,6 %) y fue el mejor en cripto (+48,3 % frente a −48,1 % de comprar y mantener). k = 75 diluye la señal (−3,3 %).
- **En producción:** la huella suma etiquetas de noticias (`event_type`, temas, factores macro).

### La Racha · `racha(score, ventana)`
- **Tesis probada:** copiar cada día, en cada mercado, al inversionista base que mejor va.
- **Regla de la PoC:** cada sesión y segmento elige al mejor de los 20 base por retorno de la ventana (`ret`) o por tasa de acierto bayesiana con perdón (`beta`: `(10 + aciertos) / (20 + aciertos + fallos)`), y copia su posición.
- **Resultado: lo peor del año** (−18,7 % a −20,6 %, peor que el 98 % de los monos). Sin costes sigue perdiendo −13,7 %: el ganador reciente devuelve lo ganado.
- **Regla para producción (PRD):** la racha **no decide**; solo multiplica el tamaño entre 0,5× y 1,5×, se recalcula una vez al mes y exige al menos 20 operaciones. Una mala racha baja el peso pero nunca lo lleva a 0.

### El Lector (noticias) · `worker/src/news/scoring.ts`
- **Regla:** largo con presión ≥ +0,30, corto con ≤ −0,30.
- **Impacto** de cada entidad de cada noticia en el instante t:

```
impacto = s · c · r · (0,5 + 0,5·novedad) · w_fuente · w_evento · (1 − 0,5·hype)
          · (0,5 + sorpresa) · (1 − 0,5·incertidumbre) · 0,5^(horas desde effective_at / vida media)
presión(activo, t) = tanh( Σ impactos con effective_at ≤ t )
```

  - s: sentimiento hacia el activo (|s| < 0,15 cuenta como 0); c: confianza; r: relevancia.
  - Pesos de fuente: tier1 1,0 · tier2 0,85 · tier3 0,6 · tier4 0,3. Vida media: intradía 6 h · días 48 h · semanas 240 h · meses 720 h.
  - `effective_at` = primera apertura de NYSE estrictamente posterior a la publicación. Si la hora no se conoce, cuenta desde la apertura siguiente al final de ese día.
- **Demo con 9 noticias reales:** la renuncia de Jensen Huang llevó la presión de NVDA a −0,57 al cierre del 13-nov (corto acertado). El Lector acertó 4 de 5 señales. Son demasiado pocas para concluir nada.

### Controles
- **Compra y mantén:** siempre largo. En el año, −8,8 %.
- **El Mono:** largo, corto o fuera al azar, re-sorteado cada 5 sesiones. Se generan 2.000 para la distribución (p05 −17,1 %, p50 −6,5 %, p95 +6,7 %).

## 3. Separar habilidad de suerte

- **Percentil frente a los monos:** % de monos que ganaron menos.
- **Umbral del mejor de N monos:** con 28 tesis, el p95 del mejor de 28 monos (remuestreo de 5.000) es **+20,9 %**. Superar al mono medio no prueba nada; hay que superar al mejor mono de un grupo del mismo tamaño.
- **Sharpe deflactado (DSR, Bailey y López de Prado):**

```
emax = √V · ((1 − γ)·Φ⁻¹(1 − 1/N) + γ·Φ⁻¹(1 − 1/(N·e)))      γ = 0,5772…, V = varianza de los Sharpe diarios de las N tesis
DSR  = Φ( (SR − emax)·√(T − 1) / √(1 − asimetría·SR + (curtosis − 1)/4 · SR²) )
```

  Con N = 28, el mejor por azar debería tener Sharpe anual 1,36. Meta del MVP: DSR ≥ 95 % en 3 meses de paper trading. Nadie la cumple todavía.

## 4. Resultados del experimento de 30 (20-nov-2025 → 20-nov-2026)

| Inversionista | Familia | Retorno | Sharpe | Peor caída | % monos | DSR | Cambios |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Elástico 10 z1,5 | Reversión | +6,2 % | 0,49 | −8,8 % | 94 | 19,3 % | 921 |
| Intuición k=25 | Intuición | +1,6 % | 0,18 | −9,4 % | 85 | 12,0 % | 2.560 |
| Elástico 20 z2,0 | Reversión | −1,2 % | −0,03 | −7,8 % | 75 | 8,3 % | 401 |
| Macro VIX±10 % | Macro | −1,5 % | −0,09 | −11,5 % | 74 | 7,5 % | 1.049 |
| Elástico 10 z2,0 | Reversión | −2,3 % | −0,22 | −6,8 % | 71 | 5,8 % | 473 |
| Cazador 55/20 | Ruptura | −2,7 % | −0,16 | −18,0 % | 69 | 6,5 % | 223 |
| El Mono | Control | −3,0 % | −0,37 | −5,8 % | 68 | — | 751 |
| Intuición k=75 | Intuición | −3,3 % | −0,20 | −9,4 % | 66 | 6,0 % | 1.853 |
| Abogado (4 de tesis) | Antagonista | −3,4 % | −0,27 | −7,4 % | 66 | 5,3 % | 1.105 |
| Macro VIX±3 % | Macro | −3,9 % | −0,15 | −19,5 % | 63 | 6,6 % | 1.449 |
| Elástico 20 z1,5 | Reversión | −3,9 % | −0,19 | −11,4 % | 63 | 6,2 % | 558 |
| Cazador 40/20 | Ruptura | −4,6 % | −0,28 | −15,7 % | 60 | 5,1 % | 254 |
| Macro solo tipos | Macro | −5,3 % | −0,18 | −21,9 % | 56 | 6,2 % | 403 |
| Tendencia 50/20 | Momentum | −5,4 % | −0,31 | −17,0 % | 56 | 4,8 % | 865 |
| Abogado (contra todos) | Antagonista | −5,6 % | −0,86 | −5,6 % | 55 | 1,3 % | 494 |
| Tendencia 30/5 | Momentum | −5,7 % | −0,35 | −17,8 % | 54 | 4,5 % | 1.555 |
| Cazador 20/10 | Ruptura | −6,5 % | −0,44 | −16,9 % | 50 | 3,7 % | 477 |
| Tendencia 100/20 | Momentum | −7,4 % | −0,52 | −20,9 % | 44 | 3,1 % | 790 |
| Tendencia 50/60 | Momentum | −8,0 % | −0,55 | −23,9 % | 41 | 2,9 % | 715 |
| Elástico 40 z1,5 | Reversión | −8,0 % | −0,51 | −14,5 % | 41 | 3,1 % | 333 |
| Macro VIX±5 % | Macro | −8,1 % | −0,49 | −19,4 % | 40 | 3,2 % | 1.567 |
| Cazador 10/5 | Ruptura | −8,3 % | −0,56 | −19,5 % | 40 | 2,8 % | 885 |
| Elástico 20 z1,0 | Reversión | −8,4 % | −0,47 | −13,5 % | 39 | 3,4 % | 683 |
| Abogado (contra momentum) | Antagonista | −8,5 % | −0,52 | −13,5 % | 38 | 3,1 % | 1.154 |
| Compra y mantén | Control | −8,8 % | −0,36 | −20,5 % | 36 | — | 1 |
| Tendencia 20/10 | Momentum | −11,5 % | −0,75 | −24,5 % | 22 | 1,8 % | 1.252 |
| Racha 60 días | Racha | −18,7 % | −2,08 | −25,3 % | 2 | 0,0 % | 998 |
| Racha 20 días | Racha | −19,6 % | −1,98 | −26,0 % | 1 | 0,0 % | 1.346 |
| Cazador 5/3 | Ruptura | −20,1 % | −1,53 | −28,1 % | 1 | 0,2 % | 1.469 |
| Racha con perdón | Racha | −20,6 % | −2,47 | −24,8 % | 1 | 0,0 % | 1.016 |

Sharpe anualizado; "Cambios" = cambios de posición activo × sesión. Lectura del año: en un mercado de vaivenes ganó la reversión y perdió el momentum. Es un dato del régimen de 2026, no una ley. El promedio de las 25 tesis sin rachas (meta-modelo de igual peso) perdió −2,3 % frente a −8,8 % de comprar y mantener.

## 5. Dónde está cada cosa

| Pieza | Python (referencia) | TypeScript (producción) |
| --- | --- | --- |
| Indicadores (SMA, desviación, canales) | `research/exp30.py` | `worker/src/engine/series.ts` |
| Calendario y relleno de precios | `research/exp30.py` (datos) | `worker/src/engine/panel.ts` |
| Las 7 familias + controles | `research/exp30.py` | `worker/src/engine/investors.ts` |
| Elenco y parámetros versionados | `INV` en `exp30.py` | `worker/src/engine/registry.ts` (`LINEUP`) |
| Motor, métricas, operaciones | `daily_matrix`, `metrics` | `worker/src/engine/backtest.ts` |
| Normal, asimetría, curtosis, DSR | `exp30.py` | `worker/src/engine/stats.ts` |
| Noticias: effective_at, impacto, presión | `research/build_news.py` | `worker/src/news/scoring.ts` |
| reason_json de cada decisión | — | `worker/src/engine/explain.ts` |
| Variantes de racha y meta-modelo | `research/racha_diag.py` | — (diagnóstico) |
| Backtest v1 (16 activos, 7 inversionistas, El Lector) | `research/backtest.py` | — (sustituido por exp30) |
