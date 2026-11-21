/**
 * Series temporales con NaN, misma semántica que pandas en la referencia Python:
 * - una ventana con algún NaN da NaN (min_periods = n);
 * - toda comparación con NaN es falsa;
 * - la desviación estándar móvil usa ddof = 1 (pandas), la de muestras completas ddof = 0 (numpy).
 */
export type Series = Float64Array;

export const nan = Number.NaN;

export function filled(n: number, v = nan): Series {
  return new Float64Array(n).fill(v);
}

/** x[t - k]; los primeros k quedan en NaN. k negativo mira al futuro (solo para objetivos ex-post). */
export function shift(x: Series, k: number): Series {
  const n = x.length;
  const out = filled(n);
  for (let t = 0; t < n; t++) {
    const s = t - k;
    if (s >= 0 && s < n) out[t] = x[s];
  }
  return out;
}

/** x[t] / x[t - k] - 1 (pandas pct_change sin relleno) */
export function pctChange(x: Series, k = 1): Series {
  const out = filled(x.length);
  for (let t = k; t < x.length; t++) out[t] = x[t] / x[t - k] - 1;
  return out;
}

/** x[t] - x[t - k] */
export function diff(x: Series, k = 1): Series {
  const out = filled(x.length);
  for (let t = k; t < x.length; t++) out[t] = x[t] - x[t - k];
  return out;
}

export function log(x: Series): Series {
  return x.map(Math.log);
}

function windowOk(x: Series, t: number, n: number): boolean {
  if (t + 1 < n) return false;
  for (let i = t - n + 1; i <= t; i++) if (Number.isNaN(x[i])) return false;
  return true;
}

/** media móvil simple de n sesiones (rolling(n, min_periods=n).mean()) */
export function sma(x: Series, n: number): Series {
  const out = filled(x.length);
  for (let t = 0; t < x.length; t++) {
    if (!windowOk(x, t, n)) continue;
    let s = 0;
    for (let i = t - n + 1; i <= t; i++) s += x[i];
    out[t] = s / n;
  }
  return out;
}

/** desviación estándar móvil con ddof = 1 (rolling(n).std() de pandas) */
export function rollingStd(x: Series, n: number): Series {
  const out = filled(x.length);
  for (let t = 0; t < x.length; t++) {
    if (!windowOk(x, t, n)) continue;
    let s = 0;
    for (let i = t - n + 1; i <= t; i++) s += x[i];
    const m = s / n;
    let ss = 0;
    for (let i = t - n + 1; i <= t; i++) ss += (x[i] - m) * (x[i] - m);
    out[t] = Math.sqrt(ss / (n - 1));
  }
  return out;
}

export function rollingMax(x: Series, n: number): Series {
  const out = filled(x.length);
  for (let t = 0; t < x.length; t++) {
    if (!windowOk(x, t, n)) continue;
    let m = -Infinity;
    for (let i = t - n + 1; i <= t; i++) if (x[i] > m) m = x[i];
    out[t] = m;
  }
  return out;
}

export function rollingMin(x: Series, n: number): Series {
  const out = filled(x.length);
  for (let t = 0; t < x.length; t++) {
    if (!windowOk(x, t, n)) continue;
    let m = Infinity;
    for (let i = t - n + 1; i <= t; i++) if (x[i] < m) m = x[i];
    out[t] = m;
  }
  return out;
}

/** media y desviación de una muestra completa con ddof = 0 (numpy) */
export function meanStd(v: ArrayLike<number>): { mean: number; std: number } {
  const n = v.length;
  let s = 0;
  for (let i = 0; i < n; i++) s += v[i];
  const mean = s / n;
  let ss = 0;
  for (let i = 0; i < n; i++) ss += (v[i] - mean) * (v[i] - mean);
  return { mean, std: Math.sqrt(ss / n) };
}
