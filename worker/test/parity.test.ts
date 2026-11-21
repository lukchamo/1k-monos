/**
 * PUERTA DE PARIDAD: el motor en TypeScript debe reproducir la referencia Python (research/golden.py)
 * posición a posición y retorno a retorno. Si este test falla, el port tiene un bug: no se despliega.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { contextFromPanel, LINEUP, runLab, type LabResult } from "../src/engine/registry";
import { rollingStd, sma } from "../src/engine/series";
import { zscore } from "../src/engine/investors";
import { loadJson, loadPanel, posString } from "./helpers";

const G = loadJson("shared/golden/exp30.golden.json");
const panel = loadPanel();
const ctx = contextFromPanel(panel);
let lab: LabResult;

beforeAll(() => {
  lab = runLab(ctx, { start: G.window.start, end: G.window.end, monkeys: 2000, seed: 7 });
});

describe("datos", () => {
  it("mismo calendario, ventana y universo que la referencia", () => {
    expect(panel.dates).toEqual(G.calendar);
    expect(lab.window.map((i) => panel.dates[i])).toEqual(G.window_dates);
    expect(ctx.symbols).toEqual(G.universe);
  });

  it("indicadores idénticos (SMA, desviación ddof=1, z)", () => {
    for (const [sym, byDate] of Object.entries<any>(G.indicator_samples)) {
      const x = ctx.C[ctx.symbols.indexOf(sym)];
      const m = sma(x, 20);
      const s = rollingStd(x, 20);
      const z = zscore(x, 20);
      for (const [d, v] of Object.entries<any>(byDate)) {
        const t = panel.dates.indexOf(d);
        // null = NaN (aún no cotizaba); error relativo porque BTC cotiza en decenas de miles
        const same = (got: number, want: number | null, rel: number) =>
          want === null
            ? expect(got).toBeNaN()
            : expect(Math.abs(got - want)).toBeLessThanOrEqual(rel * Math.max(1, Math.abs(want)));
        same(x[t], v.close, 1e-15);
        same(m[t], v.sma20, 1e-12);
        same(s[t], v.std20, 1e-11);
        same(z[t], v.z20, 1e-9);
      }
    }
  });
});

describe("inversionistas", () => {
  const names = LINEUP.map((s) => s.name);

  it("el elenco coincide con la referencia (sin El Mono, que usa otro RNG)", () => {
    expect(names.sort()).toEqual(Object.keys(G.investors).sort());
  });

  it.each(names)("%s: mismas posiciones en cada activo y sesión", (name) => {
    const g = G.investors[name];
    const r = lab.investors[name];
    ctx.symbols.forEach((sym, a) => {
      expect(posString(r.positions[a]), `${name} · ${sym}`).toBe(g.positions[sym]);
    });
  });

  it.each(names)("%s: mismo retorno, Sharpe, caída máxima, operaciones y DSR", (name) => {
    const g = G.investors[name];
    const r = lab.investors[name];
    expect(r.metrics.totalReturn).toBeCloseTo(g.total_return, 10);
    expect(r.metrics.sharpeDaily).toBeCloseTo(g.sharpe_daily, 10);
    expect(r.metrics.maxDrawdown).toBeCloseTo(g.max_drawdown, 10);
    expect(r.trades).toBe(g.trades);
    if (g.dsr === null) expect(r.dsr).toBeNull();
    else expect(r.dsr!).toBeCloseTo(g.dsr, 8);
    for (const [seg, v] of Object.entries<number>(g.segments)) expect(r.segments[seg], seg).toBeCloseTo(v, 10);
  });

  it("Sharpe esperado del mejor por azar (emax) igual", () => {
    expect(lab.nThesis).toBe(G.n_thesis);
    expect(lab.emaxDaily).toBeCloseTo(G.emax_sr_daily, 10);
  });

  it("El Elástico 10 z1.5 sigue siendo el mejor del año: +6,18 %", () => {
    const thesis = Object.values(lab.investors).filter((r) => r.spec.family !== "Control");
    const best = thesis.sort((a, b) => b.metrics.totalReturn - a.metrics.totalReturn)[0];
    expect(best.spec.name).toBe("Elástico 10 z1.5");
    expect(best.metrics.totalReturn * 100).toBeCloseTo(6.1823, 3);
  });
});

describe("monos (RNG propio: misma distribución, no los mismos números)", () => {
  // La referencia da p05/p50/p95 = −17,1/−6,5/+6,7 % y, según la semilla, un mejor-de-28 p95 entre +21 y +30 %.
  it("la distribución de 2.000 monos coincide con la de la referencia", () => {
    expect(lab.monkeys.p05 * 100).toBeGreaterThan(-19);
    expect(lab.monkeys.p05 * 100).toBeLessThan(-15);
    expect(lab.monkeys.p50 * 100).toBeGreaterThan(-8);
    expect(lab.monkeys.p50 * 100).toBeLessThan(-5);
    expect(lab.monkeys.p95 * 100).toBeGreaterThan(5);
    expect(lab.monkeys.p95 * 100).toBeLessThan(9);
  });
  it("el umbral del mejor de 28 monos (p95) cae en la banda de la referencia", () => {
    expect(lab.monkeys.bestOfNp95 * 100).toBeGreaterThan(17);
    expect(lab.monkeys.bestOfNp95 * 100).toBeLessThan(35);
  });
});

describe("bordes", () => {
  it("un elenco de una sola tesis corre sin DSR (no hay 'mejor de N')", async () => {
    const { withDependencies } = await import("../src/engine/registry");
    const lab1 = runLab(ctx, { start: G.window.start, end: G.window.end, monkeys: 0, lineup: withDependencies("elastico-10-z1-5") });
    const r = lab1.investors["Elástico 10 z1.5"];
    expect(r.dsr).toBeNull();
    expect(r.metrics.totalReturn).toBeCloseTo(G.investors["Elástico 10 z1.5"].total_return, 12);
  });

  it("el Abogado y la Racha arrastran a sus dependencias y dan lo mismo que en el elenco completo", async () => {
    const { withDependencies } = await import("../src/engine/registry");
    for (const id of ["abogado-4-de-tesis", "racha-con-perdon"]) {
      const lu = withDependencies(id);
      const self = lu[lu.length - 1];
      const lab1 = runLab(ctx, { start: G.window.start, end: G.window.end, monkeys: 0, lineup: lu });
      ctx.symbols.forEach((sym, a) => expect(posString(lab1.investors[self.name].positions[a])).toBe(G.investors[self.name].positions[sym]));
    }
  });
});

