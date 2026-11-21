const pctFmt = new Intl.NumberFormat("es-ES", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: "exceptZero" });
const pct0Fmt = new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const intFmt = new Intl.NumberFormat("es-ES", { useGrouping: "always" });
const dateFmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dateTimeFmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

export const pct = (v: number | null | undefined) => (v == null ? "—" : pctFmt.format(v).replace("-", "−"));
export const pct0 = (v: number | null | undefined) => (v == null ? "—" : pct0Fmt.format(v));
export const num = (v: number | null | undefined) => (v == null ? "—" : numFmt.format(v).replace("-", "−"));
export const int = (v: number | null | undefined) => (v == null ? "—" : intFmt.format(v));
export const day = (iso: string | null | undefined) => (iso ? dateFmt.format(new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso)) : "—");
export const dayTime = (iso: string | null | undefined) => (iso ? `${dateTimeFmt.format(new Date(iso))} UTC` : "—");
export const tone = (v: number | null | undefined) => (v == null || v === 0 ? "text-ink-2" : v > 0 ? "text-up" : "text-down");

const EVENT_ES: Record<string, string> = {
  earnings: "Resultados",
  guidance: "Previsiones",
  executive_change: "Cambio de directivos",
  election_policy: "Política y elecciones",
  export_controls_trade: "Controles de exportación",
  market_selloff: "Caída de mercado",
  monetary_policy: "Política monetaria",
  macro_data: "Dato macro",
  regulation: "Regulación",
  m_and_a: "Fusiones y compras",
  product_launch: "Lanzamiento",
  etf_flows: "Flujos de ETF",
  analyst_rating: "Opinión de analistas",
  geopolitics: "Geopolítica",
  ipo: "Salida a bolsa",
};
export const eventLabel = (t: string) => EVENT_ES[t] ?? t.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

const DIRECTION_ES: Record<string, string> = { bullish: "Alcista", bearish: "Bajista", neutral: "Neutral", mixed: "Mixta" };
export const directionLabel = (d?: string) => (d ? (DIRECTION_ES[d] ?? d) : "—");

/** la regla de cada inversionista, dicha en una frase */
export function ruleText(rule: { kind: string } & Record<string, unknown>): string {
  const r = rule as Record<string, string | number | boolean | string[]>;
  switch (rule.kind) {
    case "momentum":
      return `Compra si el precio está por encima de su media de ${r.nSma} sesiones y sube en las últimas ${r.nRet}; vende en corto si pasa lo contrario.`;
    case "elastico":
      return `Mide cuánto se ha alejado el precio de su media de ${r.n} sesiones. Si se estira más de ${r.z} desviaciones, apuesta a que vuelve; sale cuando cruza la media.`;
    case "cazador":
      return `Compra cuando el precio rompe su máximo de ${r.nIn} sesiones y vende en corto cuando rompe el mínimo; sale con el extremo contrario de ${r.nOut} sesiones.`;
    case "macro":
      return r.ratesOnly
        ? "Solo mira los tipos de interés a 10 años: con tipos bajando toma riesgo, con tipos subiendo lo reduce."
        : `Mira el índice del miedo (VIX) y los tipos a 10 años. Opera cuando el VIX se mueve más de un ${Math.round(Number(r.band) * 100)} % respecto a su media.`;
    case "abogado":
      return `Abogado del diablo: cuando al menos ${r.k} de las ${(r.against as string[]).length} tesis que vigila coinciden, toma la posición contraria.`;
    case "intuicion":
      return `Describe el día de hoy con 6 números, busca los ${r.k} días más parecidos de su memoria y repite lo que habría funcionado entonces.`;
    case "racha":
      return `Cada día copia al inversionista con mejor resultado en las últimas ${r.look} sesiones${r.score === "beta" ? ", perdonando una mala racha corta" : ""}.`;
    case "compra_y_mantener":
      return "Compra todos los activos el primer día y no vuelve a tocar nada.";
    default:
      return "Regla fija y pública. El detalle está en el repositorio.";
  }
}
