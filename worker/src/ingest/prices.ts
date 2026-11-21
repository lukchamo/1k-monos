/**
 * Ingesta diaria de precios (cron tras el cierre de EE. UU.) con validación cruzada entre dos fuentes.
 * Si falta un precio o las fuentes discrepan más de MAX_DIFF, el día queda 'incomplete' y nadie opera.
 *
 * En la PoC la fuente primaria fue Yahoo Finance vía el catálogo de Firecrawl y el contraste Twelve Data
 * (diferencia máxima observada 0,4 % por ajuste de dividendos). Aquí quedan las dos fuentes con API REST
 * pública; los mapeos de símbolos marcados "verificar" hay que confirmarlos en la fase 1.
 */
import type { Env } from "../env";

export const MAX_DIFF = 0.005;

export interface PriceSource {
  name: string;
  /** cierre ajustado de `symbol` en `date` (YYYY-MM-DD), o null si no lo tiene */
  close(env: Env, symbol: string, date: string): Promise<number | null>;
}

const TWELVE_MAP: Record<string, string> = {
  "SAN.MC": "SAN:BME", // verificar
  "^VIX": "VIX", // verificar (índice)
  "^TNX": "TNX", // verificar (índice)
  "BTC-USD": "BTC/USD",
  "ETH-USD": "ETH/USD",
  "SOL-USD": "SOL/USD",
};

export const twelveData: PriceSource = {
  name: "twelvedata",
  async close(env, symbol, date) {
    if (!env.TWELVE_DATA_API_KEY) return null;
    const u = new URL("https://api.twelvedata.com/time_series");
    u.searchParams.set("symbol", TWELVE_MAP[symbol] ?? symbol);
    u.searchParams.set("interval", "1day");
    u.searchParams.set("start_date", date);
    u.searchParams.set("end_date", date);
    u.searchParams.set("apikey", env.TWELVE_DATA_API_KEY);
    const r = await fetch(u);
    if (!r.ok) return null;
    const j: any = await r.json();
    const v = j?.values?.find((x: any) => String(x.datetime).startsWith(date));
    return v ? Number(v.close) : null;
  },
};

const COINGECKO_IDS: Record<string, string> = { "BTC-USD": "bitcoin", "ETH-USD": "ethereum", "SOL-USD": "solana" };

/** CoinGecko responde sin clave: contraste para cripto */
export const coinGecko: PriceSource = {
  name: "coingecko",
  async close(_env, symbol, date) {
    const id = COINGECKO_IDS[symbol];
    if (!id) return null;
    const [y, m, d] = date.split("-");
    const r = await fetch(`https://api.coingecko.com/api/v3/coins/${id}/history?date=${d}-${m}-${y}&localization=false`);
    if (!r.ok) return null;
    const j: any = await r.json();
    return j?.market_data?.current_price?.usd ?? null;
  },
};

export async function ingestPrices(env: Env, date: string, symbols: string[], primary: PriceSource, check: PriceSource) {
  const missing: Record<string, string> = {};
  const stmts: D1PreparedStatement[] = [];
  for (const s of symbols) {
    const [a, b] = await Promise.all([primary.close(env, s, date), check.close(env, s, date)]);
    if (a === null) {
      missing[s] = "sin precio primario";
      continue;
    }
    const d = b === null ? null : Math.abs(a - b) / a;
    if (d !== null && d > MAX_DIFF) missing[s] = `discrepancia ${(d * 100).toFixed(2)} %`;
    stmts.push(
      env.DB.prepare(
        "INSERT OR REPLACE INTO prices_daily (symbol, date, adj_close, source, check_source, check_diff) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
      ).bind(s, date, a, primary.name, b === null ? null : check.name, d),
    );
  }
  const status = Object.keys(missing).length ? "incomplete" : "complete";
  stmts.push(
    env.DB.prepare("INSERT OR REPLACE INTO market_days (date, status, missing, ingested_at) VALUES (?1, ?2, ?3, ?4)").bind(
      date, status, JSON.stringify(missing), new Date().toISOString(),
    ),
  );
  await env.DB.batch(stmts);
  return { date, status, missing };
}
