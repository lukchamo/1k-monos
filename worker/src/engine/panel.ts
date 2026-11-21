/**
 * Panel de precios: calendario de sesiones de EE. UU. (las fechas de SPY), cierres ajustados
 * alineados a ese calendario y rellenados hacia delante, como `raw.reindex(cal).ffill()`.
 * Un activo que aún no cotizaba (SpaceX antes del 12-jun-2026) queda en NaN: no se puede operar.
 */
import { filled, type Series } from "./series";

export interface PriceRow {
  symbol: string;
  date: string; // YYYY-MM-DD
  close: number; // cierre ajustado
}

export interface Panel {
  dates: string[];
  close: Record<string, Series>;
}

/** CSV "SYM,YYYY-MM-DD,adj_close" (las columnas extra se ignoran) */
export function parsePriceCsv(text: string): PriceRow[] {
  const rows: PriceRow[] = [];
  for (const line of text.trim().split("\n")) {
    if (!line) continue;
    const [symbol, date, c] = line.split(",");
    rows.push({ symbol, date, close: Number(c) });
  }
  return rows;
}

export function buildPanel(rows: PriceRow[], calendarSymbol = "SPY"): Panel {
  const bySym = new Map<string, Map<string, number[]>>();
  for (const r of rows) {
    if (!bySym.has(r.symbol)) bySym.set(r.symbol, new Map());
    const m = bySym.get(r.symbol)!;
    if (!m.has(r.date)) m.set(r.date, []);
    m.get(r.date)!.push(r.close);
  }
  const cal = bySym.get(calendarSymbol);
  if (!cal) throw new Error(`falta el símbolo de calendario ${calendarSymbol}`);
  const dates = [...cal.keys()].filter((d) => cal.get(d)!.some((v) => !Number.isNaN(v))).sort();
  const close: Record<string, Series> = {};
  for (const [sym, m] of bySym) {
    const s = filled(dates.length);
    let last = Number.NaN;
    dates.forEach((d, t) => {
      const v = m.get(d);
      if (v && v.length) {
        const mean = v.reduce((a, b) => a + b, 0) / v.length; // pivot_table(aggfunc=mean)
        if (!Number.isNaN(mean)) last = mean;
      }
      s[t] = last; // ffill sobre el calendario de EE. UU.
    });
    close[sym] = s;
  }
  return { dates, close };
}

/** recorta el panel hasta la fecha `asOf` incluida: lo que se sabía al cierre de ese día */
export function truncatePanel(p: Panel, asOf: string): Panel {
  const n = p.dates.filter((d) => d <= asOf).length;
  const close: Record<string, Series> = {};
  for (const [k, v] of Object.entries(p.close)) close[k] = v.slice(0, n);
  return { dates: p.dates.slice(0, n), close };
}
