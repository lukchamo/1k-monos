/**
 * Laboratorio de inversionistas determinísticos · Worker principal (CooWeb / LuchoIA)
 *
 * fetch:     API de lectura para el dashboard + /mcp
 * scheduled: noticias cada 15 min; precios y decisiones de cada inversionista tras el cierre de EE. UU.
 */
import type { Env } from "./env";
import { configHash, ENGINE_VERSION, LINEUP } from "./engine/registry";
import { ECONOMIES, GROUPS, INDICATORS, SEGMENTS, UNIVERSE } from "./engine/universe";
import { curves, decisionReason, labStatus, latestNews, newsFor, paperPositions, marketData, playgroundData, ranking } from "./data/store";
import { allow, backtestParams, BadInput, cleanText, DISCLAIMER, fail, json, preflight, readJson, safeUrl, tokenOk, v } from "./guard";
import { lector, pressure, pressureBreakdown } from "./news/scoring";
import { ingestArticles, ingestNews, type RawArticle } from "./ingest/news";
import { coinGecko, ingestPrices, twelveData, type PriceSource } from "./ingest/prices";
import { mcp } from "./mcp";
import { verifyAccessJwt } from "./access";
import { sendDigest, trackRecord } from "./digest";
import { notifyAll, subscribe, unsubscribe } from "./push";
import { renderPromo } from "./promo";

const KNOWN_SYMBOLS = new Set<string>([...UNIVERSE, INDICATORS.vix, INDICATORS.tnx]);
const KNOWN_INVESTORS = new Set(LINEUP.map((s) => s.id));


export { InvestorDO } from "./do/investor";
export { BacktestWorkflow } from "./workflows/backtest";

const CRON_NEWS = "*/15 * * * *";
// de lunes a viernes con nombres: en Cloudflare el día 1 es domingo, así que "1-5" corría en domingo y se saltaba el viernes
const CRON_CLOSE = "30 22 * * MON-FRI"; // 22:30 UTC: después del cierre de NYSE en invierno (21:00) y en verano (20:00)

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

/** cierre de un día: precios con dos fuentes; si el día queda completo, deciden todos y sale el resumen */
async function closeDay(env: Env, date: string, primary: PriceSource, check: PriceSource) {
  const day = await ingestPrices(env, date, [...UNIVERSE, INDICATORS.vix, INDICATORS.tnx], primary, check);
  if (day.status !== "complete") {
    console.warn("día incompleto, no se opera", day);
    return { ...day, decided: 0 };
  }
  // cada inversionista decide en su propio Durable Object
  const done = await Promise.all(
    LINEUP.map((s) => env.INVESTOR.get(env.INVESTOR.idFromName(s.id)).decide(s.id, date).then(() => 1, (e) => (console.error(s.id, e), 0))),
  );
  // con todos decididos: llamadas de consenso, verificación de las anteriores y correo al autor
  await sendDigest(env, date).catch((e) => console.error(JSON.stringify({ level: "error", message: "resumen diario", error: String(e) })));
  MEMO.clear();
  return { ...day, decided: done.reduce<number>((a, b) => a + b, 0) };
}

/** una fuente de precios hecha con los cierres que llegan en la petición (ingesta manual) */
function givenSource(name: string, closes: Record<string, number | null>): PriceSource {
  return { name, close: async (_env, symbol) => closes[symbol] ?? null };
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

/**
 * Memoria por isolate para las lecturas públicas: cien visitas a la vez comparten una sola consulta
 * a D1. Solo guarda datos públicos e iguales para todos. Vive fuera del motor: no afecta al determinismo.
 */
const MEMO = new Map<string, { at: number; value: Promise<unknown> }>();
function memo<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = MEMO.get(key);
  if (hit && now - hit.at < ttlMs) return hit.value as Promise<T>;
  if (MEMO.size > 200) MEMO.clear(); // las claves salen de listas blancas, pero por si acaso
  const value = load();
  MEMO.set(key, { at: now, value });
  value.catch(() => MEMO.get(key)?.value === value && MEMO.delete(key)); // un fallo no se queda guardado
  return value;
}
/**
 * Caché del borde para las respuestas caras de calcular (el mercado completo, las posiciones de un
 * inversionista). La memoria de arriba muere con cada isolate; esta la comparten todos los del
 * punto de presencia. La clave es la URL sin parámetros que no conozcamos.
 */
async function edgeCached(ctx: ExecutionContext, key: string, ttlSeconds: number, build: () => Promise<Response>): Promise<Response> {
  const cache = (caches as unknown as { default: Cache }).default;
  const req = new Request(`https://cache.1kmonos.internal/${key}`);
  try {
    const hit = await cache.match(req);
    if (hit) return hit;
  } catch {
    /* sin caché disponible (desarrollo): se calcula */
  }
  const res = await build();
  if (res.ok) {
    const copy = new Response(res.clone().body, res);
    copy.headers.set("cache-control", `public, max-age=${ttlSeconds}`);
    ctx.waitUntil(cache.put(req, copy).catch(() => {}));
  }
  return res;
}

const SHORT = 30_000;
const LONG = 120_000;

const lineup = (env: Env) =>
  Promise.all(LINEUP.map(async (s) => ({ id: s.id, name: s.name, family: s.family, version: s.version, rule: s.rule, config_hash: await configHash(s, env.TAXONOMY_VERSION) })));

async function route(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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

  // MCP privado: hostname detrás de Cloudflare Access (Zero Trust). Solo sirve el MCP y solo con
  // el JWT de Access válido; si falta (Access mal configurado o saltado), se cierra.
  if (env.MCP_PRIVATE_HOST && url.hostname === env.MCP_PRIVATE_HOST) {
    const who = await verifyAccessJwt(req.headers.get("cf-access-jwt-assertion"), { teamDomain: env.ACCESS_TEAM_DOMAIN ?? "", aud: env.ACCESS_AUD ?? "" });
    if (!who) return fail(403, "acceso restringido");
    if (!(await allow(env, req, "heavy"))) return fail(429, "demasiadas peticiones", { "retry-after": "60" });
    return mcp(req, env, true);
  }

  if (p === "/mcp") {
    if (!(await allow(env, req, "heavy"))) return fail(429, "demasiadas peticiones", { "retry-after": "60" });
    return mcp(req, env);
  }

  // ── lectura pública ────────────────────────────────────────────────────────
  if (GET) {
    const heavy = p === "/v1/lab" || p === "/v1/playground" || p === "/v1/market" || p === "/v1/curves" || p === "/v1/pressure" || p === "/v1/decisions";
    if (!(await allow(env, req, heavy ? "heavy" : "read"))) return fail(429, "demasiadas peticiones", { "retry-after": "60" });

    if (p === "/v1/status") return json({ ...(await memo("status", SHORT, () => labStatus(env.DB))), engine: ENGINE_VERSION, taxonomy: env.TAXONOMY_VERSION, now: new Date().toISOString(), aviso: DISCLAIMER }, 200, "short");

    // todo lo que pinta la web en una sola llamada: un viaje a D1 por render en vez de siete
    if (p === "/v1/lab") {
      const [status, rank, curve, news, positions, investors, calls] = await memo("lab", SHORT, () =>
        Promise.all([labStatus(env.DB), ranking(env.DB), curves(env.DB), latestNews(env.DB, 30), paperPositions(env.DB), lineup(env), trackRecord(env.DB, 30)]),
      );
      return json(
        { status: { ...status, engine: ENGINE_VERSION, taxonomy: env.TAXONOMY_VERSION, now: new Date().toISOString() }, ranking: rank, curves: curve, news, positions, investors, calls, universe: { segments: SEGMENTS, economies: ECONOMIES, indicators: INDICATORS }, aviso: DISCLAIMER },
        200,
        "short",
      );
    }

    if (p === "/v1/investors") return json(await memo("investors", LONG, () => lineup(env)), 200, "long");

    // historial de llamadas de consenso y su verificación (público: es parte del experimento)
    if (p === "/v1/calls") return json({ ...(await memo("calls", SHORT, () => trackRecord(env.DB))), aviso: DISCLAIMER }, 200, "short");

    // clave pública para suscribirse a los avisos del navegador
    if (p === "/v1/push/key") return env.VAPID_PUBLIC_KEY ? json({ key: env.VAPID_PUBLIC_KEY }, 200, "long") : fail(503, "avisos sin configurar");

    // cierres y recuento diario de largos y cortos del laboratorio, para el playground manual
    if (p === "/v1/market")
      return edgeCached(ctx, "market", 600, async () => {
        const out = await memo("market", LONG * 5, () => marketData(env.DB));
        return out ? json({ ...out, aviso: DISCLAIMER }, 200, "long") : fail(404, "todavía no hay ninguna corrida");
      });

    // cierres y posiciones diarias de un inversionista, para el simulador de la web
    if (p === "/v1/playground") {
      const id = investorOf(q.get("investor"));
      return edgeCached(ctx, `playground/${id}`, 600, async () => {
        const out = await memo(`playground:${id}`, LONG, () => playgroundData(env.DB, id));
        return out ? json({ ...out, aviso: DISCLAIMER }, 200, "long") : fail(404, "todavía no hay ninguna corrida");
      });
    }

    if (p === "/v1/universe") return json({ segments: SEGMENTS, economies: ECONOMIES, indicators: INDICATORS }, 200, "long");

    if (p === "/v1/ranking") {
      const run = q.get("run") ? v.runId(q.get("run")) : undefined;
      const seg = segmentOf(q.get("segment"));
      return json({ ...(await memo(`ranking:${run ?? ""}:${seg}`, LONG, () => ranking(env.DB, run, seg))), aviso: DISCLAIMER }, 200, "long");
    }

    if (p === "/v1/curves") {
      const run = q.get("run") ? v.runId(q.get("run")) : undefined;
      return json(await memo(`curves:${run ?? ""}`, LONG, () => curves(env.DB, run)), 200, "long");
    }

    if (p === "/v1/news") {
      const limit = v.int(q.get("limit"), "limit", 1, 100, 30);
      const symbol = q.get("symbol") ? symbolOf(q.get("symbol")) : undefined;
      return json({ events: await memo(`news:${limit}:${symbol ?? ""}`, SHORT, () => latestNews(env.DB, limit, symbol)), aviso: DISCLAIMER }, 200, "short");
    }

    if (p === "/v1/positions") {
      const date = q.get("date") ? v.date(q.get("date")) : undefined;
      return json(await memo(`positions:${date ?? ""}`, SHORT, () => paperPositions(env.DB, date)), 200, "short");
    }

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
  // suscripción a avisos: pública (no hay cuentas), acotada por el límite de escritura y la lista blanca de servicios
  if (p === "/v1/push/subscribe") return json(await subscribe(env.DB, await readJson(req, 4096)));
  if (p === "/v1/push/unsubscribe") return json(await unsubscribe(env.DB, await readJson(req, 4096)));

  if (p !== "/v1/backtest" && p !== "/v1/decide" && p !== "/v1/digest" && p !== "/v1/push/test" && p !== "/v1/promo" && p !== "/v1/ingest") return fail(404, "no encontrado");
  if (!(await tokenOk(req, env.MCP_TOKEN))) return fail(401, "no autorizado", { "www-authenticate": "Bearer" });
  const b = (await readJson(req, p === "/v1/ingest" ? 128 * 1024 : undefined)) as Record<string, unknown>;
  if (!b || typeof b !== "object" || Array.isArray(b)) throw new BadInput("el cuerpo debe ser un objeto JSON");

  // ingesta manual (cuando el cron no tiene claves de datos): noticias ya buscadas o cierres de un día.
  // Pasa por el mismo camino que el cron: extracción versionada, validación, dos fuentes de precio.
  if (p === "/v1/ingest") {
    const out: Record<string, unknown> = {};
    if (b.news !== undefined) {
      if (!Array.isArray(b.news) || b.news.length > 8) throw new BadInput("news debe ser una lista de hasta 8 artículos");
      const arts: RawArticle[] = b.news.map((n: any) => {
        const url = safeUrl(n?.url);
        if (!url) throw new BadInput("url de noticia inválida");
        const when = String(n?.published_at ?? "");
        const published_at = when.includes("T") ? v.instant(when, "published_at").toISOString() : v.date(when, "published_at");
        const text = cleanText(n?.text, 8000);
        if (text.length < 80) throw new BadInput("texto de noticia demasiado corto");
        return { url, title: cleanText(n?.title, 300), text, published_at, source_name: new URL(url).hostname.replace(/^www\./, "") };
      });
      out.news = await ingestArticles(env, arts, await sessions(env));
    }
    if (b.prices !== undefined) {
      const pr = b.prices as Record<string, unknown>;
      const date = v.date(pr?.date);
      if (date > new Date().toISOString().slice(0, 10)) throw new BadInput("no se ingesta un día futuro");
      const read = (raw: unknown, name: string) => {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new BadInput(`${name} debe ser un objeto símbolo → cierre`);
        const o: Record<string, number | null> = {};
        for (const [k, x] of Object.entries(raw)) {
          const sym = symbolOf(k as string);
          if (typeof x !== "number" || !Number.isFinite(x) || x <= 0) throw new BadInput(`cierre inválido: ${sym}`);
          o[sym] = x;
        }
        return o;
      };
      const src = (x: unknown, name: string) => (typeof x === "string" && /^[a-z0-9-]{2,24}$/.test(x) ? x : (() => { throw new BadInput(`${name} inválido`); })());
      out.prices = await closeDay(env, date, givenSource(src(pr.source, "source"), read(pr.closes, "closes")), givenSource(src(pr.check_source, "check_source"), read(pr.check, "check")));
    }
    MEMO.clear();
    return json(out);
  }

  if (p === "/v1/backtest") {
    const params = backtestParams(b);
    const inst = await env.BACKTEST.create({ params });
    return json({ run_id: inst.id }, 202);
  }

  // correo de promoción de los tutoriales, solo al autor
  if (p === "/v1/promo") {
    if (!env.EMAIL || !env.DIGEST_TO || !env.DIGEST_FROM) return fail(503, "correo sin configurar");
    const m = renderPromo(env.SITE_URL ?? "https://1kmonos.com");
    await env.EMAIL.send({ to: env.DIGEST_TO, from: { email: env.DIGEST_FROM, name: "1K Monos" }, subject: m.subject, text: m.text, html: m.html });
    return json({ sent: true, subject: m.subject });
  }

  if (p === "/v1/push/test")
    return json(await notifyAll(env, { title: "1K Monos · prueba", body: "Los avisos funcionan. Te avisaremos cuando el laboratorio registre algo nuevo. Es un experimento, no una recomendación.", url: env.SITE_URL ?? "/", tag: "prueba" }));

  // resumen privado de una fecha: lo construye, verifica las llamadas anteriores y lo envía (send: false = vista previa)
  if (p === "/v1/digest") {
    const out = await sendDigest(env, v.date(b.date), b.send !== false);
    MEMO.delete("calls");
    MEMO.delete("lab");
    return json(out);
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
  async fetch(req, env, ctx): Promise<Response> {
    try {
      return await route(req, env, ctx);
    } catch (err) {
      if (err instanceof BadInput) return fail(400, err.message);
      // el detalle va al log (observabilidad), nunca al cliente
      console.error(JSON.stringify({ level: "error", path: new URL(req.url).pathname, message: String(err) }));
      // base de datos saturada: es temporal, se dice así y se pide reintentar
      if (/overloaded|too many requests|queued|D1_ERROR.*(busy|reset|timeout)/i.test(String(err))) return fail(503, "servicio saturado, reintenta en unos segundos", { "retry-after": "5" });
      return fail(500, "error interno");
    }
  },

  async scheduled(controller, env, ctx): Promise<void> {
    if (controller.cron === CRON_NEWS) {
      // sin clave de búsqueda no hay nada que escuchar: se avisa una vez por ciclo, no una por consulta
      if (!env.FIRECRAWL_API_KEY) {
        console.warn(JSON.stringify({ level: "warn", message: "ingesta de noticias en pausa: falta el secreto FIRECRAWL_API_KEY" }));
        return;
      }
      const s = await sessions(env);
      for (const q of NEWS_QUERIES) ctx.waitUntil(ingestNews(env, q, s).catch((e) => console.error("noticias", q, e)));
      return;
    }
    // por si Cloudflare normaliza la expresión: basta con la hora del cierre
    if (controller.cron === CRON_CLOSE || controller.cron.startsWith("30 22 ")) {
      await closeDay(env, new Date(controller.scheduledTime).toISOString().slice(0, 10), twelveData, coinGecko);
    }
  },
} satisfies ExportedHandler<Env>;
