/**
 * Los inversionistas: cada uno es una función pura (datos hasta t) → posición en t ∈ {-1, 0, +1}.
 * Port 1:1 de research/exp30.py. La posición decidida al cierre de t se aplica al retorno de t+1
 * (eso lo hace el motor, no el inversionista).
 */
import { BETA_HI } from "./universe";
import { diff, log, pctChange, rollingMax, rollingMin, rollingStd, shift, sma, type Series } from "./series";

/** posiciones [activo][sesión] */
export type Positions = Float64Array[];

export interface Ctx {
  dates: string[];
  symbols: string[]; // universo operable, en orden canónico
  C: Series[]; // cierres por activo (NaN = no cotiza)
  vix: Series;
  tnx: Series;
}

const T = (c: Ctx) => c.dates.length;

/** +1 si `long`, -1 si `short`, 0 si no */
function signal(c: Ctx, long: (a: number, t: number) => boolean, short: (a: number, t: number) => boolean): Positions {
  return c.C.map((_, a) => {
    const p = new Float64Array(T(c));
    for (let t = 0; t < p.length; t++) p[t] = long(a, t) ? 1 : short(a, t) ? -1 : 0;
    return p;
  });
}

/** máquina de estados: entra con una condición y sale con otra (Elástico, Cazador) */
function stateful(
  c: Ctx,
  entryLong: (a: number, t: number) => boolean,
  entryShort: (a: number, t: number) => boolean,
  exitLong: (a: number, t: number) => boolean,
  exitShort: (a: number, t: number) => boolean,
): Positions {
  return c.C.map((close, a) => {
    const out = new Float64Array(T(c));
    let p = 0;
    for (let t = 0; t < out.length; t++) {
      if (Number.isNaN(close[t])) p = 0;
      else {
        if (p === 1 && exitLong(a, t)) p = 0;
        else if (p === -1 && exitShort(a, t)) p = 0;
        if (p === 0 && entryLong(a, t)) p = 1;
        else if (p === 0 && entryShort(a, t)) p = -1;
      }
      out[t] = p;
    }
    return out;
  });
}

/** La Tendencia: largo si cierre > SMA(n) y el retorno de r sesiones es positivo; corto al revés */
export function momentum(c: Ctx, nSma: number, nRet: number): Positions {
  const m = c.C.map((x) => sma(x, nSma));
  const r = c.C.map((x) => pctChange(x, nRet));
  return signal(
    c,
    (a, t) => c.C[a][t] > m[a][t] && r[a][t] > 0,
    (a, t) => c.C[a][t] < m[a][t] && r[a][t] < 0,
  );
}

/** z = (cierre − SMA n) / desviación n (ddof 1) */
export function zscore(x: Series, n: number): Series {
  const m = sma(x, n);
  const s = rollingStd(x, n);
  return x.map((v, t) => (v - m[t]) / s[t]);
}

/** El Elástico (reversión a la media): entra contra el estiramiento y sale al volver a la media */
export function elastico(c: Ctx, n: number, thr: number): Positions {
  const z = c.C.map((x) => zscore(x, n));
  return stateful(
    c,
    (a, t) => z[a][t] < -thr,
    (a, t) => z[a][t] > thr,
    (a, t) => z[a][t] >= 0,
    (a, t) => z[a][t] <= 0,
  );
}

/** El Cazador (ruptura de canal): entra al romper el máximo/mínimo de nIn y sale con el canal contrario de nOut */
export function cazador(c: Ctx, nIn: number, nOut: number): Positions {
  const prev = c.C.map((x) => shift(x, 1));
  const hi = prev.map((x) => rollingMax(x, nIn));
  const lo = prev.map((x) => rollingMin(x, nIn));
  const hx = prev.map((x) => rollingMax(x, nOut));
  const lx = prev.map((x) => rollingMin(x, nOut));
  return stateful(
    c,
    (a, t) => c.C[a][t] > hi[a][t],
    (a, t) => c.C[a][t] < lo[a][t],
    (a, t) => c.C[a][t] < lx[a][t],
    (a, t) => c.C[a][t] > hx[a][t],
  );
}

/**
 * El Macro (régimen de riesgo). Miedo = VIX > SMA20(VIX)·(1+banda); calma = VIX < SMA20·(1−banda);
 * tipos subiendo = diff(20) del bono a 10 años > 0.
 */
export function macro(c: Ctx, band: number, ratesOnly = false): Positions {
  const v20 = sma(c.vix, 20);
  const up = diff(c.tnx, 20);
  return c.symbols.map((s) => {
    const p = new Float64Array(T(c));
    const hi = BETA_HI.has(s);
    for (let t = 0; t < p.length; t++) {
      const off = c.vix[t] > v20[t] * (1 + band);
      const on = c.vix[t] < v20[t] * (1 - band);
      const rising = up[t] > 0;
      if (ratesOnly) {
        p[t] = s === "TLT" || s === "GLD" ? (rising ? -1 : 1) : hi ? (rising ? -1 : 1) : 0;
      } else if (s === "GLD") p[t] = off ? 1 : 0;
      else if (s === "TLT") p[t] = rising ? -1 : off ? 1 : 0;
      else if (hi) p[t] = off ? -1 : on ? 1 : 0;
      else p[t] = on ? 1 : 0;
    }
    return p;
  });
}

/** El Abogado del Diablo: si la suma de posiciones del grupo es ≥ k, se pone corto; si es ≤ −k, largo */
export function abogado(c: Ctx, group: Positions[], k: number): Positions {
  return c.C.map((_, a) => {
    const p = new Float64Array(T(c));
    for (let t = 0; t < p.length; t++) {
      let s = 0;
      for (const g of group) s += g[a][t];
      p[t] = s >= k ? -1 : s <= -k ? 1 : 0;
    }
    return p;
  });
}

/** Compra y mantén: largo siempre que el activo cotice */
export function compraYMantener(c: Ctx): Positions {
  return c.C.map((x) => x.map((v) => (Number.isNaN(v) ? 0 : 1)));
}

/**
 * La Intuición por analogía (k vecinos). Huella de 6 números por activo y día; busca las k situaciones
 * pasadas más parecidas de cualquier activo, solo entre las que ya tienen resultado conocido (t−5).
 * Si ≥ 60 % subieron en los 5 días siguientes, largo; si ≤ 40 %, corto.
 * Solo decide desde la sesión `fromIndex` (la referencia decide solo dentro de la ventana del backtest).
 */
export function intuicion(c: Ctx, k: number, fromIndex = 0): Positions {
  const n = T(c);
  const A = c.C.length;
  const v20 = sma(c.vix, 20);
  const dTnx = diff(c.tnx, 20);
  const F: Float64Array[][] = c.C.map((x) => {
    const lr = log(x);
    const r1 = diff(lr, 1);
    const s20 = rollingStd(r1, 20);
    const s60 = rollingStd(r1, 60);
    const p5 = pctChange(x, 5);
    const p20 = pctChange(x, 20);
    const z = zscore(x, 20);
    return Array.from({ length: n }, (_, t) =>
      Float64Array.of(
        p5[t] / (s20[t] * Math.sqrt(5)),
        p20[t] / (s20[t] * Math.sqrt(20)),
        z[t],
        s20[t] / s60[t] - 1,
        c.vix[t] / v20[t] - 1,
        dTnx[t],
      ),
    );
  });
  const Y = c.C.map((x) => x.map((v, t) => (t + 5 < n ? x[t + 5] / v - 1 : Number.NaN)));
  const out: Positions = c.C.map(() => new Float64Array(n));
  const bad = (f: Float64Array) => f.some(Number.isNaN);

  for (let t = Math.max(fromIndex, 0); t < n; t++) {
    const poolT = t - 5;
    if (poolT < 0) continue;
    // pool en orden (sesión, activo), como el reshape de numpy
    const P: Float64Array[] = [];
    const y: number[] = [];
    for (let s = 0; s <= poolT; s++)
      for (let a = 0; a < A; a++) {
        const f = F[a][s];
        if (bad(f) || Number.isNaN(Y[a][s])) continue;
        P.push(f);
        y.push(Y[a][s]);
      }
    if (y.length < 200) continue;
    const mu = new Float64Array(6);
    const sd = new Float64Array(6);
    for (const f of P) for (let j = 0; j < 6; j++) mu[j] += f[j];
    for (let j = 0; j < 6; j++) mu[j] /= P.length;
    for (const f of P) for (let j = 0; j < 6; j++) sd[j] += (f[j] - mu[j]) * (f[j] - mu[j]);
    for (let j = 0; j < 6; j++) sd[j] = Math.sqrt(sd[j] / P.length) + 1e-9;
    const Pn = P.map((f) => f.map((v, j) => (v - mu[j]) / sd[j]));

    for (let a = 0; a < A; a++) {
      const q = F[a][t].map((v, j) => (v - mu[j]) / sd[j]);
      if (bad(q)) continue;
      const nn = kSmallest(Pn, q, k);
      let ups = 0;
      for (const i of nn) if (y[i] > 0) ups++;
      const up = ups / k;
      out[a][t] = up >= 0.6 ? 1 : up <= 0.4 ? -1 : 0;
    }
  }
  return out;
}

/** índices de los k puntos más cercanos (distancia euclídea²) con un montículo máximo de tamaño k */
function kSmallest(P: Float64Array[], q: Float64Array, k: number): number[] {
  const heapD = new Float64Array(k);
  const heapI = new Int32Array(k);
  let size = 0;
  const up = (i: number) => {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heapD[p] >= heapD[i]) break;
      [heapD[p], heapD[i]] = [heapD[i], heapD[p]];
      [heapI[p], heapI[i]] = [heapI[i], heapI[p]];
      i = p;
    }
  };
  const down = (i: number) => {
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < size && heapD[l] > heapD[m]) m = l;
      if (r < size && heapD[r] > heapD[m]) m = r;
      if (m === i) break;
      [heapD[m], heapD[i]] = [heapD[i], heapD[m]];
      [heapI[m], heapI[i]] = [heapI[i], heapI[m]];
      i = m;
    }
  };
  for (let i = 0; i < P.length; i++) {
    const f = P[i];
    let d = 0;
    for (let j = 0; j < 6; j++) d += (f[j] - q[j]) * (f[j] - q[j]);
    if (size < k) {
      heapD[size] = d;
      heapI[size] = i;
      up(size++);
    } else if (d < heapD[0]) {
      heapD[0] = d;
      heapI[0] = i;
      down(0);
    }
  }
  return Array.from(heapI.subarray(0, size));
}

/**
 * El Mono: largo, corto o fuera al azar, re-sorteado cada `block` sesiones. Es un control, no una tesis.
 * Usa un generador propio (mulberry32) con semilla: reproducible en TS, distinto del PCG64 de numpy.
 */
export function monoMatrix(n: number, A: number, rng: () => number, block = 5): Positions {
  const out: Positions = Array.from({ length: A }, () => new Float64Array(n));
  for (let b = 0; b * block < n; b++)
    for (let a = 0; a < A; a++) {
      const v = Math.floor(rng() * 3) - 1;
      for (let t = b * block; t < Math.min(n, (b + 1) * block); t++) out[a][t] = v;
    }
  return out;
}

export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let r = Math.imul(s ^ (s >>> 15), 1 | s);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
