/**
 * Laboratorio de inversionistas determinísticos · Worker principal (CooWeb / LuchoIA)
 *
 * fetch:     API de lectura para el dashboard + /mcp
 * scheduled: noticias cada 15 min; precios y decisiones de cada inversionista tras el cierre de EE. UU.
 */
import type { Env } from "./env";
import { configHash, ENGINE_VERSION, LINEUP } from "./engine/registry";
import { ECONOMIES, GROUPS, INDICATORS, SEGMENTS, UNIVERSE } from "./engine/universe";
import { curves, decisionReason, labStatus, latestNews, newsFor, paperPositions, ranking } from "./data/store";
import { allow, backtestParams, BadInput, DISCLAIMER, fail, json, preflight, readJson, tokenOk, v } from "./guard";
import { lector, pressure, pressureBreakdown } from "./news/scoring";
import { ingestNews } from "./ingest/news";
import { coinGecko, ingestPrices, twelveData } from "./ingest/prices";
import { mcp } from "./mcp";

const KNOWN_SYMBOLS = new Set<string>([...UNIVERSE, INDICATORS.vix, INDICATORS.tnx]);
const KNOWN_INVESTORS = new Set(LINEUP.map((s) => s.id));


export { InvestorDO } from "./do/investor";
export { BacktestWorkflow } from "./workflows/backtest";

const CRON_NEWS = "*/15 * * * *";
const CRON_CLOSE = "30 22 * * 1-5"; // 22:30 UTC: después del cierre de NYSE en invierno (21:00) y en verano (20:00)

/** consultas de noticias por mercado (una búsqueda por tema, no por activo) */
const NEWS_QUERIES = [
  "Nvidia OR Microsoft OR Palantir OR CoreWeave OR Tesla stock",
  "SpaceX OR Anthropic shares",
  "Bitcoin OR Ethereum OR Solana ETF flows",
  "Federal Reserve rates inflation Treasury yields",
  "oil prices OPEC",
  "Santander OR IBEX OR euro zone stocks",
  "emerging markets Brazil Mexico China stocks",
];

async function sessions(env: Env): Promise<string[]> {
  const { results } = await env.DB.prepare("SELECT date FROM market_days ORDER BY date").all<{ date: string }>();
  const out = results.map((r) => r.date);
  // añade los próximos días hábiles para que una noticia del viernes noche cuente desde el lunes
  const last = new Date(`${out.at(-1) ?? new Date().toISOString().slice(0, 10)}T12:00:00Z`);
  for (let i = 1, added = 0; added < 5; i++) {
    const d = new Date(last.getTime() + i * 86_400_000);
    if (d.getUTCDay() % 6 !== 0) {
      out.push(d.toISOString().slice(0, 10));
      added++;
    }
  }
  return out;
}

/** el segmento existe o es el global: lista blanca sobre lo que el motor conoce */
function segmentOf(raw: string | null): string {
  if (!raw || raw === "_global") return "_global";
  const s = v.segment(raw);
  if (!(s in GROUPS)) throw new BadInput("segmento desconocido");
  return s;
}

function symbolOf(raw: string | null): string {
  const s = v.symbol(raw);
  if (!KNOWN_SYMBOLS.has(s)) throw new BadInput("símbolo fuera del universo del laboratorio");
  return s;
}

function investorOf(raw: string | null): string {
  const s = v.slug(raw);
  if (!KNOWN_INVESTORS.has(s)) throw new BadInput("inversionista desconocido");
  return s;
}

const lineup = (env: Env) =>
  Promise.all(LINEUP.map(async (s) => ({ id: s.id, name: s.name, family: s.family, version: s.version, rule: s.rule, config_hash: await configHash(s, env.TAXONOMY_VERSION) })));

async function route(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const p = url.pathname;
  const q = url.searchParams;
  const GET = req.method === "GET" || req.method === "HEAD";
  const POST = req.method === "POST";

  if (req.method === "OPTIONS") return preflight();
  if (!GET && !POST) return fail(405, "método no permitido", { allow: "GET, POST, OPTIONS" });
  if (url.search.length > 512) return fail(414, "consulta demasiado larga");

  if (GET && (p === "/" || p === "/health"))
    return json({ ok: true, engine: ENGINE_VERSION, taxonomy: env.TAXONOMY_VERSION, investors: LINEUP.length, aviso: DISCLAIMER }, 200, "short");

  if (p === "/mcp") {
    if (!(await allow(env, req, "heavy"))) return fail(429, "demasiadas peticiones", { "retry-after": "60" });
    return mcp(req, env);
  }

  // ── lectura pública ────────────────────────────────────────────────────────
  if (GET) {
    const heavy = p === "/v1/lab" || p === "/v1/curves" || p === "/v1/pressure" || p === "/v1/decisions";
    if (!(await allow(env, req, heavy ? "heavy" : "read"))) return fail(429, "demasiadas peticiones", { "retry-after": "60" });

    if (p === "/v1/status") return json({ ...(await labStatus(env.DB)), engine: ENGINE_VERSION, taxonomy: env.TAXONOMY_VERSION, now: new Date().toISOString(), aviso: DISCLAIMER }, 200, "short");

    // todo lo que pinta la web en una sola llamada: un viaje a D1 por render en vez de siete
    if (p === "/v1/lab") {
      const [status, rank, curve, news, positions, investors] = await Promise.all([
        labStatus(env.DB),
        ranking(env.DB),
        curves(env.DB),
        latestNews(env.DB, 30),
        paperPositions(env.DB),
        lineup(env),
      ]);
      return json(
        { status: { ...status, engine: ENGINE_VERSION, taxonomy: env.TAXONOMY_VERSION, now: new Date().toISOString() }, ranking: rank, curves: curve, news, positions, investors, universe: { segments: SEGMENTS, economies: ECONOMIES, indicators: INDICATORS }, aviso: DISCLAIMER },
        200,
        "short",
      );
    }

    if (p === "/v1/investors") return json(await lineup(env), 200, "long");

    if (p === "/v1/universe") return json({ segments: SEGMENTS, economies: ECONOMIES, indicators: INDICATORS }, 200, "long");

    if (p === "/v1/ranking")
      return json({ ...(await ranking(env.DB, q.get("run") ? v.runId(q.get("run")) : undefined, segmentOf(q.get("segment")))), aviso: DISCLAIMER }, 200, "long");

    if (p === "/v1/curves") return json(await curves(env.DB, q.get("run") ? v.runId(q.get("run")) : undefined), 200, "long");

    if (p === "/v1/news")
      return json({ events: await latestNews(env.DB, v.int(q.get("limit"), "limit", 1, 100, 30), q.get("symbol") ? symbolOf(q.get("symbol")) : undefined), aviso: DISCLAIMER }, 200, "short");

    if (p === "/v1/positions") return json(await paperPositions(env.DB, q.get("date") ? v.date(q.get("date")) : undefined), 200, "short");

    if (p === "/v1/pressure") {
      const symbol = symbolOf(q.get("symbol"));
      // sin ?at= se redondea al minuto: la respuesta es cacheable y determinística dentro del minuto
      const at = q.get("at") ? v.instant(q.get("at")) : new Date(Math.floor(Date.now() / 60_000) * 60_000);
      const evs = await newsFor(env.DB, symbol, at);
      const pr = pressure(evs, symbol, at);
      return json({ symbol, at: at.toISOString(), pressure: pr, lector: lector(pr), events: pressureBreakdown(evs, symbol, at) }, 200, "short");
    }

    if (p === "/v1/decisions") {
      const out = await decisionReason(env.DB, investorOf(q.get("investor")), symbolOf(q.get("symbol")), q.get("date") ? v.date(q.get("date")) : undefined);
      return out ? json(out, 200, "short") : fail(404, "sin decisión registrada");
    }

    const m = p.match(/^\/v1\/backtest\/([A-Za-z0-9_-]{1,64})$/);
    if (m) {
      try {
        const st = await (await env.BACKTEST.get(m[1])).status();
        return json({ status: st.status, output: st.output ?? null });
      } catch {
        return fail(404, "corrida no encontrada");
      }
    }
    return fail(404, "no encontrado");
  }

  // ── escritura: siempre con token y con límite propio ───────────────────────
  if (!(await allow(env, req, "write"))) return fail(429, "demasiadas peticiones", { "retry-after": "60" });
  if (p !== "/v1/backtest" && p !== "/v1/decide") return fail(404, "no encontrado");
  if (!(await tokenOk(req, env.MCP_TOKEN))) return fail(401, "no autorizado", { "www-authenticate": "Bearer" });
  const b = (await readJson(req)) as Record<string, unknown>;
  if (!b || typeof b !== "object" || Array.isArray(b)) throw new BadInput("el cuerpo debe ser un objeto JSON");

  if (p === "/v1/backtest") {
    const params = backtestParams(b);
    const inst = await env.BACKTEST.create({ params });
    return json({ run_id: inst.id }, 202);
  }

  // decisiones de paper trading para una fecha (relanzar un día o rellenar huecos). Idempotente.
  const date = v.date(b.date);
  const raw = b.investors ?? LINEUP.map((s) => s.id);
  if (!Array.isArray(raw) || raw.length > LINEUP.length) throw new BadInput("investors debe ser una lista de ids");
  const ids = raw.map((id) => investorOf(id as string));
  const out = await Promise.all(ids.map((id) => env.INVESTOR.get(env.INVESTOR.idFromName(id)).decide(id, date)));
  return json(out);
}

export default {
  async fetch(req, env): Promise<Response> {
    try {
      return await route(req, env);
    } catch (err) {
      if (err instanceof BadInput) return fail(400, err.message);
      // el detalle va al log (observabilidad), nunca al cliente
      console.error(JSON.stringify({ level: "error", path: new URL(req.url).pathname, message: String(err) }));
      return fail(500, "error interno");
    }
  },

  async scheduled(controller, env, ctx): Promise<void> {
    if (controller.cron === CRON_NEWS) {
      const s = await sessions(env);
      for (const q of NEWS_QUERIES) ctx.waitUntil(ingestNews(env, q, s).catch((e) => console.error("noticias", q, e)));
      return;
    }
    if (controller.cron === CRON_CLOSE) {
      const date = new Date(controller.scheduledTime).toISOString().slice(0, 10);
      const day = await ingestPrices(env, date, [...UNIVERSE, INDICATORS.vix, INDICATORS.tnx], twelveData, coinGecko);
      if (day.status !== "complete") {
        console.warn("día incompleto, no se opera", day);
        return;
      }
      // cada inversionista decide en su propio Durable Object
      await Promise.all(
        LINEUP.map((s) => env.INVESTOR.get(env.INVESTOR.idFromName(s.id)).decide(s.id, date).catch((e) => console.error(s.id, e))),
      );
    }
  },
} satisfies ExportedHandler<Env>;
