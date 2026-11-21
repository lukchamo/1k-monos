/**
 * El elenco: 28 inversionistas de tesis + 2 controles, con parámetros versionados.
 * `runLab` corre el experimento completo de research/exp30.py y devuelve el ranking.
 */
import { dailyMatrix, equity, metrics, trades, windowIndex, type Metrics } from "./backtest";
import {
  abogado,
  cazador,
  compraYMantener,
  elastico,
  intuicion,
  macro,
  momentum,
  monoMatrix,
  mulberry32,
  type Ctx,
  type Positions,
} from "./investors";
import { deflatedSharpe, expectedMaxSharpe, percentile } from "./stats";
import { GROUPS, INDICATORS, SEGMENTS, UNIVERSE } from "./universe";
import type { Panel } from "./panel";

export const ENGINE_VERSION = "engine-1.0.0";

export type Family = "Momentum" | "Reversión" | "Ruptura" | "Macro" | "Antagonista" | "Intuición" | "Racha" | "Control";

export type Rule =
  | { kind: "momentum"; nSma: number; nRet: number }
  | { kind: "elastico"; n: number; z: number }
  | { kind: "cazador"; nIn: number; nOut: number }
  | { kind: "macro"; band: number; ratesOnly?: boolean }
  | { kind: "abogado"; against: string[]; k: number }
  | { kind: "intuicion"; k: number }
  | { kind: "racha"; score: "ret" | "beta"; look: number }
  | { kind: "compra_y_mantener" };

export interface InvestorSpec {
  id: string;
  name: string;
  family: Family;
  version: string;
  rule: Rule;
}

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function spec(name: string, family: Family, rule: Rule): InvestorSpec {
  return { id: slug(name), name, family, version: "1.0.0", rule };
}

const tendencias: [number, number][] = [[20, 10], [50, 20], [100, 20], [50, 60], [30, 5]];
const elasticos: [number, number][] = [[10, 1.5], [20, 1.0], [20, 1.5], [20, 2.0], [40, 1.5], [10, 2.0]];
const cazadores: [number, number][] = [[10, 5], [20, 10], [40, 20], [55, 20], [5, 3]];

const BASE: InvestorSpec[] = [
  ...tendencias.map(([a, b]) => spec(`Tendencia ${a}/${b}`, "Momentum", { kind: "momentum", nSma: a, nRet: b })),
  ...elasticos.map(([a, b]) => spec(`Elástico ${a} z${b.toFixed(1)}`, "Reversión", { kind: "elastico", n: a, z: b })),
  ...cazadores.map(([a, b]) => spec(`Cazador ${a}/${b}`, "Ruptura", { kind: "cazador", nIn: a, nOut: b })),
  ...[0.03, 0.05, 0.1].map((b) => spec(`Macro VIX±${Math.round(b * 100)}%`, "Macro", { kind: "macro", band: b })),
  spec("Macro solo tipos", "Macro", { kind: "macro", band: 0, ratesOnly: true }),
];
const baseNames = BASE.map((s) => s.name);

export const LINEUP: InvestorSpec[] = [
  ...BASE,
  spec("Abogado (4 de tesis)", "Antagonista", {
    kind: "abogado",
    against: ["Tendencia 50/20", "Elástico 20 z1.5", "Cazador 20/10", "Macro VIX±5%"],
    k: 2,
  }),
  spec("Abogado (contra momentum)", "Antagonista", {
    kind: "abogado",
    against: baseNames.filter((n) => n.startsWith("Tendencia")),
    k: 3,
  }),
  spec("Abogado (contra todos)", "Antagonista", { kind: "abogado", against: baseNames, k: 8 }),
  spec("Intuición k=25", "Intuición", { kind: "intuicion", k: 25 }),
  spec("Intuición k=75", "Intuición", { kind: "intuicion", k: 75 }),
  spec("Racha 20 días", "Racha", { kind: "racha", score: "ret", look: 20 }),
  spec("Racha 60 días", "Racha", { kind: "racha", score: "ret", look: 60 }),
  spec("Racha con perdón", "Racha", { kind: "racha", score: "beta", look: 60 }),
  spec("Compra y mantén", "Control", { kind: "compra_y_mantener" }),
];

export function contextFromPanel(p: Panel, symbols = UNIVERSE): Ctx {
  const need = [...symbols, INDICATORS.vix, INDICATORS.tnx];
  for (const s of need) if (!p.close[s]) throw new Error(`faltan precios de ${s}`);
  return {
    dates: p.dates,
    symbols,
    C: symbols.map((s) => p.close[s]),
    vix: p.close[INDICATORS.vix],
    tnx: p.close[INDICATORS.tnx],
  };
}

export interface LabOptions {
  start: string;
  end: string;
  monkeys?: number; // 2.000 en la referencia
  seed?: number;
  lineup?: InvestorSpec[];
}

export interface InvestorResult {
  spec: InvestorSpec;
  positions: Positions;
  daily: Float64Array[];
  metrics: Metrics;
  trades: number;
  dsr: number | null;
  pctMonkeys: number | null;
  segments: Record<string, number>;
}

export interface LabResult {
  window: number[];
  investors: Record<string, InvestorResult>;
  nThesis: number;
  emaxDaily: number;
  monkeys: { n: number; p05: number; p50: number; p95: number; bestOfNp95: number };
}

export function runLab(c: Ctx, opt: LabOptions): LabResult {
  const lineup = opt.lineup ?? LINEUP;
  const win = windowIndex(c.dates, opt.start, opt.end);
  const fromIndex = win[0];
  const cols: Record<string, number[]> = Object.fromEntries(
    Object.entries(GROUPS).map(([g, v]) => [g, v.map((s) => c.symbols.indexOf(s)).filter((i) => i >= 0)]),
  );
  const pos: Record<string, Positions> = {};
  const dm: Record<string, Float64Array[]> = {};

  const compute = (s: InvestorSpec): Positions => {
    const r = s.rule;
    switch (r.kind) {
      case "momentum":
        return momentum(c, r.nSma, r.nRet);
      case "elastico":
        return elastico(c, r.n, r.z);
      case "cazador":
        return cazador(c, r.nIn, r.nOut);
      case "macro":
        return macro(c, r.band, r.ratesOnly);
      case "abogado":
        return abogado(c, r.against.map((n) => pos[n]), r.k);
      case "intuicion":
        return intuicion(c, r.k, fromIndex);
      case "compra_y_mantener":
        return compraYMantener(c);
      case "racha":
        return racha(c, r.score, r.look, BASE.filter((b) => pos[b.name]).map((b) => b.name), pos, dm, win);
    }
  };

  for (const s of lineup) {
    pos[s.name] = compute(s);
    dm[s.name] = dailyMatrix(pos[s.name], c, win);
  }

  // monos: el control de suerte
  const rng = mulberry32(opt.seed ?? 7);
  const nMonkeys = opt.monkeys ?? 2000;
  const mkAll: number[] = [];
  for (let i = 0; i < nMonkeys; i++) {
    const m = monoMatrix(c.dates.length, c.symbols.length, rng);
    mkAll.push(equity(dailyMatrix(m, c, win)).at(-1)! - 1);
  }
  const thesis = lineup.filter((s) => s.family !== "Control");
  const NT = thesis.length;
  const bestOf: number[] = [];
  if (mkAll.length)
    for (let i = 0; i < 5000; i++) {
      let mx = -Infinity;
      for (let j = 0; j < NT; j++) mx = Math.max(mx, mkAll[Math.floor(rng() * mkAll.length)]);
      bestOf.push(mx);
    }

  const ms: Record<string, Metrics> = Object.fromEntries(lineup.map((s) => [s.name, metrics(dm[s.name])]));
  const srs = thesis.map((s) => ms[s.name].sharpeDaily);
  const meanSr = srs.reduce((a, b) => a + b, 0) / srs.length;
  const V = srs.reduce((a, b) => a + (b - meanSr) ** 2, 0) / srs.length;
  // con menos de 2 pruebas no hay 'mejor de N': el DSR no está definido (p. ej. un Durable Object que corre solo su regla)
  const emax = NT >= 2 ? expectedMaxSharpe(NT, V) : Number.NaN;

  const investors: Record<string, InvestorResult> = {};
  for (const s of lineup) {
    const m = ms[s.name];
    investors[s.name] = {
      spec: s,
      positions: pos[s.name],
      daily: dm[s.name],
      metrics: m,
      trades: trades(pos[s.name], win),
      dsr: s.family === "Control" || NT < 2 ? null : deflatedSharpe(m.sharpeDaily, emax, m.returns),
      pctMonkeys: mkAll.length ? (100 * mkAll.filter((x) => x < m.totalReturn).length) / mkAll.length : null,
      segments: Object.fromEntries(Object.entries(cols).map(([g, idx]) => [g, equity(dm[s.name], idx).at(-1)! - 1])),
    };
  }
  return {
    window: win,
    investors,
    nThesis: NT,
    emaxDaily: emax,
    monkeys: {
      n: mkAll.length,
      p05: percentile(mkAll, 5),
      p50: percentile(mkAll, 50),
      p95: percentile(mkAll, 95),
      bestOfNp95: percentile(bestOf, 95),
    },
  };
}

/**
 * La Racha como asignador por segmento: cada día elige, en cada mercado, al inversionista base con
 * mejor retorno ('ret') o mejor tasa de acierto bayesiana con perdón ('beta', prior Beta(10,10)).
 * Ojo: el PRD prohíbe usarla así en producción (copiar cada día pierde ~20 %); se mantiene para la paridad.
 */
export function racha(
  c: Ctx,
  kind: "ret" | "beta",
  look: number,
  base: string[],
  pos: Record<string, Positions>,
  dm: Record<string, Float64Array[]>,
  win: number[],
): Positions {
  const out: Positions = c.C.map(() => new Float64Array(c.dates.length));
  const segCols = Object.entries(SEGMENTS).map(([g, v]) => [g, v.map((s) => c.symbols.indexOf(s)).filter((i) => i >= 0)] as const);
  const segDaily: Record<string, Record<string, Float64Array>> = {};
  for (const n of base) {
    segDaily[n] = {};
    for (const [g, idx] of segCols) {
      const d = new Float64Array(win.length);
      for (let i = 0; i < win.length; i++) {
        let s = 0;
        for (const a of idx) s += dm[n][a][i];
        d[i] = s / idx.length;
      }
      segDaily[n][g] = d;
    }
  }
  for (let ti = look; ti < win.length; ti++) {
    for (const [g, idx] of segCols) {
      let best = base[0];
      let bestScore = -1e9;
      for (const n of base) {
        const h = segDaily[n][g].subarray(ti - look + 1, ti + 1);
        let score: number;
        if (kind === "ret") {
          let p = 1;
          for (const x of h) p *= 1 + x;
          score = p - 1;
        } else {
          let w = 0;
          let l = 0;
          let sum = 0;
          for (const x of h) {
            if (x > 0) w++;
            else if (x < 0) l++;
            sum += x;
          }
          score = (10 + w) / (20 + w + l) + 1e-6 * sum;
        }
        if (score > bestScore) {
          best = n;
          bestScore = score;
        }
      }
      for (const a of idx) out[a][win[ti]] = pos[best][a][win[ti]];
    }
  }
  return out;
}

/** hash de configuración: misma regla + parámetros + versiones = mismo resultado */
export async function configHash(s: InvestorSpec, taxonomyVersion: string): Promise<string> {
  const canon = JSON.stringify({ engine: ENGINE_VERSION, taxonomy: taxonomyVersion, id: s.id, version: s.version, rule: s.rule });
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canon));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

/** el inversionista y aquellos de los que depende (el Abogado mira a otros; la Racha, a los base) */
export function withDependencies(id: string, lineup: InvestorSpec[] = LINEUP): InvestorSpec[] {
  const self = lineup.find((s) => s.id === id || s.name === id);
  if (!self) throw new Error(`inversionista desconocido: ${id}`);
  const r = self.rule;
  const deps =
    r.kind === "abogado" ? lineup.filter((s) => r.against.includes(s.name)) : r.kind === "racha" ? BASE : [];
  return [...deps.filter((d) => d.name !== self.name), self];
}
