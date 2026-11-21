/**
 * Motor de backtest. Regla de oro: la posición decidida al cierre de t gana o pierde el retorno de t+1.
 * Coste por cambio de posición y coste diario de estar corto. Capital igual por activo, sin rebalanceo.
 */
import type { Ctx, Positions } from "./investors";
import { COSTS } from "./universe";
import { meanStd, pctChange } from "./series";

/** índices del calendario dentro de [start, end] (fechas YYYY-MM-DD, ambas incluidas) */
export function windowIndex(dates: string[], start: string, end: string): number[] {
  const out: number[] = [];
  dates.forEach((d, i) => {
    if (d >= start && d <= end) out.push(i);
  });
  return out;
}

/** retorno diario neto por activo dentro de la ventana: [activo][i] con i sobre `win` */
export function dailyMatrix(pos: Positions, c: Ctx, win: number[]): Float64Array[] {
  return c.C.map((close, a) => {
    const R = pctChange(close, 1);
    const fee = COSTS.borrowAnnual(c.symbols[a]) / 252;
    const out = new Float64Array(win.length);
    win.forEach((t, i) => {
      const avail = Number.isNaN(close[t]) ? 0 : 1;
      const P = (t - 1 >= 0 ? pos[a][t - 1] : 0) * avail; // decidido ayer al cierre
      const P0 = (t - 2 >= 0 ? pos[a][t - 2] : 0) * avail; // lo que había antes
      const r = Number.isNaN(R[t]) ? 0 : R[t];
      out[i] = P * r - Math.abs(P - P0) * COSTS.perUnitTurnover - (P < 0 ? fee : 0);
    });
    return out;
  });
}

/** capital (base 1) de una cartera con el mismo capital en cada activo de `cols` */
export function equity(dm: Float64Array[], cols?: number[]): Float64Array {
  const idx = cols ?? dm.map((_, a) => a);
  const n = dm[0]?.length ?? 0;
  const eq = new Float64Array(n);
  if (!idx.length) return eq.fill(1);
  const acc = new Float64Array(idx.length).fill(1);
  for (let i = 0; i < n; i++) {
    let s = 0;
    idx.forEach((a, j) => {
      acc[j] *= 1 + dm[a][i];
      s += acc[j];
    });
    eq[i] = s / idx.length;
  }
  return eq;
}

export interface Metrics {
  totalReturn: number;
  sharpeDaily: number;
  sharpeAnnual: number;
  maxDrawdown: number;
  returns: Float64Array;
}

export function metrics(dm: Float64Array[], cols?: number[]): Metrics {
  const eq = equity(dm, cols);
  const r = new Float64Array(eq.length);
  let prev = 1;
  let peak = -Infinity; // como la referencia: máximo acumulado de la propia curva, sin el 1 inicial
  let dd = 0;
  for (let i = 0; i < eq.length; i++) {
    r[i] = (eq[i] - prev) / prev;
    prev = eq[i];
    peak = Math.max(peak, eq[i]);
    dd = Math.min(dd, eq[i] / peak - 1);
  }
  const { mean, std } = meanStd(r);
  const sr = std > 0 ? mean / std : 0;
  return {
    totalReturn: eq.length ? eq[eq.length - 1] - 1 : 0,
    sharpeDaily: sr,
    sharpeAnnual: sr * Math.sqrt(252),
    maxDrawdown: dd,
    returns: r,
  };
}

/** número de cambios de posición (activo × sesión) dentro de la ventana */
export function trades(pos: Positions, win: number[]): number {
  let n = 0;
  for (const p of pos) for (let i = 1; i < win.length; i++) if (p[win[i]] !== p[win[i - 1]]) n++;
  return n;
}
