/**
 * Estadística para separar habilidad de suerte: normal (cdf e inversa), asimetría y curtosis
 * con las mismas fórmulas que pandas, y el Sharpe deflactado (DSR) de Bailey y López de Prado.
 */

/** inversa de la normal estándar: algoritmo AS241 de Wichura (el mismo que statistics.NormalDist de Python) */
export function normInv(p: number): number {
  if (!(p > 0 && p < 1)) throw new RangeError("p debe estar en (0, 1)");
  const q = p - 0.5;
  let num: number;
  let den: number;
  if (Math.abs(q) <= 0.425) {
    const r = 0.180625 - q * q;
    num =
      (((((((2.5090809287301226727e3 * r + 3.3430575583588128105e4) * r + 6.7265770927008700853e4) * r +
        4.5921953931549871457e4) * r + 1.3731693765509461125e4) * r + 1.9715909503065514427e3) * r +
        1.3314166789178437745e2) * r + 3.387132872796366608) * q;
    den =
      ((((((5.2264952788528545610e3 * r + 2.8729085735721942674e4) * r + 3.9307895800092710610e4) * r +
        2.1213794301586595867e4) * r + 5.3941960214247511077e3) * r + 6.8718700749205790830e2) * r +
        4.2313330701600911252e1) * r + 1.0;
    return num / den;
  }
  let r = q <= 0 ? p : 1 - p;
  r = Math.sqrt(-Math.log(r));
  if (r <= 5) {
    r -= 1.6;
    num =
      ((((((7.7454501427834140764e-4 * r + 2.27238449892691845833e-2) * r + 2.4178072517745061177e-1) * r +
        1.27045825245236838258) * r + 3.64784832476320460504) * r + 5.7694972214606914055) * r +
        4.6303378461565452959) * r + 1.42343711074968357734;
    den =
      ((((((1.05075007164441684324e-9 * r + 5.475938084995344946e-4) * r + 1.51986665636164571966e-2) * r +
        1.4810397642748007459e-1) * r + 6.8976733498510000455e-1) * r + 1.6763848301838038494) * r +
        2.05319162663775882187) * r + 1.0;
  } else {
    r -= 5;
    num =
      ((((((2.01033439929228813265e-7 * r + 2.71155556874348757815e-5) * r + 1.2426609473880784386e-3) * r +
        2.6532189526576123093e-2) * r + 2.9656057182850489123e-1) * r + 1.7848265399172913358) * r +
        5.4637849111641143699) * r + 6.6579046435011037772;
    den =
      ((((((2.04426310338993978564e-15 * r + 1.4215117583164458887e-7) * r + 1.8463183175100546818e-5) * r +
        7.868691311456132591e-4) * r + 1.4875361290850615025e-2) * r + 1.3692988092273580531e-1) * r +
        5.9983220655588793769e-1) * r + 1.0;
  }
  const x = num / den;
  return q < 0 ? -x : x;
}

/** erfc con error < 1e-15: serie de Taylor de erf en |x| < 2 y fracción continua (Lentz) fuera */
export function erfc(x: number): number {
  if (Number.isNaN(x)) return Number.NaN;
  if (Math.abs(x) < 2) {
    let term = x;
    let sum = x;
    const x2 = x * x;
    for (let n = 1; n < 200; n++) {
      term *= -x2 / n;
      const add = term / (2 * n + 1);
      sum += add;
      if (Math.abs(add) < 1e-17 * Math.abs(sum)) break;
    }
    return 1 - (2 / Math.sqrt(Math.PI)) * sum;
  }
  if (x < 0) return 2 - erfc(-x);
  // erfc(x) = exp(-x²)/√π · 1/(x + 1/2/(x + 1/(x + 3/2/(x + …))))
  const tiny = 1e-300;
  let f = x;
  let C = x;
  let D = 0;
  for (let n = 1; n < 500; n++) {
    const a = n / 2;
    D = x + a * D;
    D = Math.abs(D) < tiny ? tiny : D;
    C = x + a / C;
    C = Math.abs(C) < tiny ? tiny : C;
    D = 1 / D;
    const delta = C * D;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-16) break;
  }
  return Math.exp(-x * x) / Math.sqrt(Math.PI) / f;
}

export function normCdf(z: number): number {
  return 0.5 * erfc(-z / Math.SQRT2);
}

/** asimetría ajustada de Fisher-Pearson, igual que pandas Series.skew() */
export function skew(v: ArrayLike<number>): number {
  const n = v.length;
  let s = 0;
  for (let i = 0; i < n; i++) s += v[i];
  const m = s / n;
  let m2 = 0;
  let m3 = 0;
  for (let i = 0; i < n; i++) {
    const d = v[i] - m;
    m2 += d * d;
    m3 += d * d * d;
  }
  if (m2 === 0) return 0;
  return ((n * Math.sqrt(n - 1)) / (n - 2)) * (m3 / m2 ** 1.5);
}

/** curtosis en exceso insesgada, igual que pandas Series.kurt() */
export function kurt(v: ArrayLike<number>): number {
  const n = v.length;
  let s = 0;
  for (let i = 0; i < n; i++) s += v[i];
  const m = s / n;
  let m2 = 0;
  let m4 = 0;
  for (let i = 0; i < n; i++) {
    const d2 = (v[i] - m) ** 2;
    m2 += d2;
    m4 += d2 * d2;
  }
  if (m2 === 0) return 0;
  const adj = (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
  return (n * (n + 1) * (n - 1) * m4) / ((n - 2) * (n - 3) * m2 ** 2) - adj;
}

const EULER_GAMMA = 0.5772156649;

/**
 * Sharpe máximo esperado por azar entre N pruebas con varianza V de sus Sharpe (diarios):
 * emax = √V·((1−γ)·Φ⁻¹(1−1/N) + γ·Φ⁻¹(1−1/(N·e)))
 */
export function expectedMaxSharpe(nTrials: number, srVariance: number): number {
  return (
    Math.sqrt(srVariance) *
    ((1 - EULER_GAMMA) * normInv(1 - 1 / nTrials) + EULER_GAMMA * normInv(1 - 1 / (nTrials * Math.E)))
  );
}

/**
 * Sharpe deflactado: probabilidad de que el Sharpe real supere al mejor que daría el azar.
 * `sr` y `emax` son diarios; `returns` es la serie diaria de la cartera.
 */
export function deflatedSharpe(sr: number, emax: number, returns: ArrayLike<number>): number {
  const T = returns.length;
  const sk = skew(returns);
  const ku = kurt(returns) + 3;
  const denom = Math.sqrt(Math.max(1e-12, 1 - sk * sr + ((ku - 1) / 4) * sr * sr));
  return normCdf(((sr - emax) * Math.sqrt(T - 1)) / denom);
}

/** percentil con interpolación lineal (np.percentile por defecto) */
export function percentile(values: ArrayLike<number>, p: number): number {
  const v = Float64Array.from(values).sort();
  if (!v.length) return Number.NaN;
  const pos = ((v.length - 1) * p) / 100;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}
