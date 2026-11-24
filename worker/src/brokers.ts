/**
 * Qué activos del laboratorio se pueden operar en Neverless y con qué sigla.
 *
 * Fuente: el catálogo público de neverless.com/assets, leído el 24-nov-2026 (1.507 valores y cripto
 * y metales aparte). Es una foto: el catálogo cambia y la app puede no enseñar lo mismo a todas las
 * cuentas, así que cada ficha dice «búscalo por la sigla» y no promete nada. No es una recomendación:
 * solo evita proponer un paso a paso con algo que no existe en el bróker.
 */
export type BrokerKind = "accion" | "cripto" | "etf" | "metal" | "adr";

export interface BrokerAsset {
  /** sigla con la que se busca en la app */
  ticker: string;
  kind: BrokerKind;
  /** aviso cuando no es el mismo instrumento que mide el laboratorio */
  note?: string;
}

export const NEVERLESS_CHECKED = "2026-11-24";

const same = (kind: BrokerKind, ...symbols: string[]): [string, BrokerAsset][] => symbols.map((s) => [s, { ticker: s, kind }]);

export const NEVERLESS: Record<string, BrokerAsset> = Object.fromEntries([
  ...same("accion", "MSFT", "NVDA", "TSLA", "PLTR", "CRWV", "SPCX", "COIN"),
  ...same("etf", "SPY", "QQQ", "TLT", "EWP", "EWJ", "EEM", "EWZ", "EWW", "FXI"),
  ["BTC-USD", { ticker: "BTC", kind: "cripto" }],
  ["ETH-USD", { ticker: "ETH", kind: "cripto" }],
  ["SOL-USD", { ticker: "SOL", kind: "cripto" }],
  ["GLD", { ticker: "XAU", kind: "metal", note: "el laboratorio mide el ETF GLD; en Neverless hay oro directo (XAU), que se mueve casi igual pero no es lo mismo" }],
  ["SAN.MC", { ticker: "SAN", kind: "adr", note: "el laboratorio mide Santander en Madrid, en euros; en Neverless está el ADR de Nueva York, en dólares" }],
]);

/** los que no aparecen en el catálogo: USO (petróleo) y FEZ (Euro Stoxx 50) */
export const neverless = (symbol: string): BrokerAsset | null => NEVERLESS[symbol] ?? null;

const KIND_LABEL: Record<BrokerKind, string> = { accion: "acción", cripto: "cripto", etf: "ETF", metal: "metal", adr: "ADR" };

/** una línea para el correo: dónde está en Neverless, o que no está */
export function neverlessLine(symbol: string): string {
  const a = neverless(symbol);
  if (!a) return "No está en el catálogo de Neverless.";
  const base = `En Neverless: busca ${a.ticker} (${KIND_LABEL[a.kind]}).`;
  if (a.note) return `${base} Ojo: ${a.note}.`;
  if (a.kind === "etf") return `${base} Aparece en su catálogo web; si tu app no lo muestra, tu cuenta no tiene ese ETF.`;
  return base;
}
