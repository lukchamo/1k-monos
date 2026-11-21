/**
 * reason_json: los números exactos que produjeron cada decisión. Sin esto no hay auditoría
 * ni respuesta del MCP a "¿por qué El Elástico entró corto en Nvidia?".
 */
import type { Ctx, Positions } from "./investors";
import { zscore } from "./investors";
import { diff, pctChange, rollingMax, rollingMin, shift, sma } from "./series";
import type { InvestorSpec } from "./registry";

const r6 = (x: number) => (Number.isFinite(x) ? Math.round(x * 1e6) / 1e6 : null);

export function explain(spec: InvestorSpec, c: Ctx, pos: Positions, t: number, a: number): Record<string, unknown> {
  const x = c.C[a];
  const base = {
    investor: spec.id,
    version: spec.version,
    date: c.dates[t],
    symbol: c.symbols[a],
    close: r6(x[t]),
    position: pos[a][t],
    previous: t > 0 ? pos[a][t - 1] : 0,
  };
  const r = spec.rule;
  switch (r.kind) {
    case "momentum":
      return { ...base, rule: `largo si cierre > SMA${r.nSma} y ret${r.nRet} > 0; corto al revés`, sma: r6(sma(x, r.nSma)[t]), ret: r6(pctChange(x, r.nRet)[t]) };
    case "elastico":
      return { ...base, rule: `entra contra |z| > ${r.z}; sale al cruzar z = 0`, z: r6(zscore(x, r.n)[t]), sma: r6(sma(x, r.n)[t]), threshold: r.z };
    case "cazador": {
      const prev = shift(x, 1);
      return {
        ...base,
        rule: `ruptura del canal de ${r.nIn}; salida con el canal contrario de ${r.nOut}`,
        channel_high: r6(rollingMax(prev, r.nIn)[t]),
        channel_low: r6(rollingMin(prev, r.nIn)[t]),
        exit_high: r6(rollingMax(prev, r.nOut)[t]),
        exit_low: r6(rollingMin(prev, r.nOut)[t]),
      };
    }
    case "macro": {
      const v20 = sma(c.vix, 20)[t];
      const vix = c.vix[t];
      return {
        ...base,
        rule: r.ratesOnly ? "solo tipos: corto en bonos y beta alta si el 10 años sube" : `régimen VIX ±${r.band * 100} %`,
        vix: r6(vix),
        vix_sma20: r6(v20),
        regime: vix > v20 * (1 + r.band) ? "miedo" : vix < v20 * (1 - r.band) ? "calma" : "neutral",
        tnx_diff20: r6(diff(c.tnx, 20)[t]),
      };
    }
    case "abogado":
      return { ...base, rule: `contra el consenso cuando |suma| ≥ ${r.k}`, against: r.against };
    case "intuicion":
      return { ...base, rule: `k=${r.k} vecinos; largo si ≥ 60 % subieron a 5 días, corto si ≤ 40 %` };
    case "racha":
      return { ...base, rule: `copia al mejor base del segmento (${r.score}, ${r.look} días)` };
    case "compra_y_mantener":
      return { ...base, rule: "siempre largo" };
  }
}
