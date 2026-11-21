/**
 * Guardarraíles de la API pública. Todo lo que entra por HTTP pasa por aquí antes de tocar D1,
 * los Durable Objects o el modelo. Reglas: validar por lista blanca, acotar tamaños, no filtrar
 * detalles internos en los errores y limitar el ritmo por IP.
 */
/** lo mínimo que este módulo necesita del entorno: así se prueba en Node sin tipos de Workers */
interface Limiter {
  limit(o: { key: string }): Promise<{ success: boolean }>;
}
interface Env {
  RL_READ?: Limiter;
  RL_HEAVY?: Limiter;
  RL_WRITE?: Limiter;
}
interface BacktestParams {
  start: string;
  end: string;
  monkeys?: number;
  seed?: number;
}

export const DISCLAIMER =
  "Laboratorio educativo y experimental con reglas iguales para todos. No es una recomendación ni asesoramiento de inversión.";

const SECURITY_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "cross-origin-resource-policy": "cross-origin",
  "permissions-policy": "interest-cohort=()",
  // la API pública es de solo lectura y sin cookies: cualquier origen puede leerla
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-max-age": "86400",
};

export type CachePolicy = "none" | "short" | "long";
const CACHE: Record<CachePolicy, string> = {
  none: "no-store",
  // datos que cambian con cada cron de noticias (15 min)
  short: "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
  // datos que cambian una vez al día (cierre) o con cada corrida
  long: "public, max-age=120, s-maxage=600, stale-while-revalidate=3600",
};

export function json(data: unknown, status = 200, cache: CachePolicy = "none", extra: Record<string, string> = {}): Response {
  return Response.json(data, { status, headers: { ...SECURITY_HEADERS, "cache-control": CACHE[cache], ...extra } });
}

export const fail = (status: number, error: string, extra: Record<string, string> = {}) => json({ error }, status, "none", extra);

export function preflight(): Response {
  return new Response(null, { status: 204, headers: SECURITY_HEADERS });
}

// ── validación por lista blanca ──────────────────────────────────────────────
const RE = {
  symbol: /^[A-Z0-9^][A-Z0-9.\-=^]{0,11}$/,
  slug: /^[a-z0-9][a-z0-9-]{0,63}$/,
  runId: /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/,
  date: /^\d{4}-\d{2}-\d{2}$/,
  segment: /^[\p{L}\p{N} ._,-]{1,48}$/u,
};

export class BadInput extends Error {}

function check(kind: keyof typeof RE, v: unknown, name: string): string {
  if (typeof v !== "string" || !RE[kind].test(v)) throw new BadInput(`parámetro inválido: ${name}`);
  return v;
}

export const v = {
  symbol: (x: unknown, name = "symbol") => check("symbol", typeof x === "string" ? x.toUpperCase() : x, name),
  slug: (x: unknown, name = "investor") => check("slug", x, name),
  runId: (x: unknown, name = "run") => check("runId", x, name),
  segment: (x: unknown, name = "segment") => check("segment", x, name),
  date(x: unknown, name = "date"): string {
    const s = check("date", x, name);
    const d = new Date(`${s}T00:00:00Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) throw new BadInput(`fecha inválida: ${name}`);
    if (s < "2015-01-01" || s > "2100-01-01") throw new BadInput(`fecha fuera de rango: ${name}`);
    return s;
  },
  instant(x: unknown, name = "at"): Date {
    if (typeof x !== "string" || x.length > 40) throw new BadInput(`instante inválido: ${name}`);
    const d = new Date(x);
    if (Number.isNaN(d.getTime()) || d.getUTCFullYear() < 2015 || d.getUTCFullYear() > 2100) throw new BadInput(`instante inválido: ${name}`);
    return d;
  },
  int(x: unknown, name: string, min: number, max: number, dflt: number): number {
    if (x === undefined || x === null || x === "") return dflt;
    const n = typeof x === "number" ? x : Number(x);
    if (!Number.isInteger(n) || n < min || n > max) throw new BadInput(`${name} debe ser un entero entre ${min} y ${max}`);
    return n;
  },
};

// ── cuerpo de las peticiones ─────────────────────────────────────────────────
export const MAX_BODY_BYTES = 16 * 1024;

/** lee JSON con tope de tamaño real (no se fía de content-length) */
export async function readJson(req: Request, max = MAX_BODY_BYTES): Promise<unknown> {
  const ct = req.headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(ct)) throw new BadInput("content-type debe ser application/json");
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > max) throw new BadInput("cuerpo demasiado grande");
  if (!req.body) throw new BadInput("falta el cuerpo");
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      throw new BadInput("cuerpo demasiado grande");
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    buf.set(c, o);
    o += c.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(buf));
  } catch {
    throw new BadInput("JSON inválido");
  }
}

// ── autenticación ────────────────────────────────────────────────────────────
/** comparación en tiempo constante: compara los SHA-256 para no filtrar ni la longitud */
export async function tokenOk(req: Request, secret: string | undefined): Promise<boolean> {
  if (!secret || secret.length < 16) return false; // un secreto corto o ausente nunca autoriza
  const got = req.headers.get("authorization")?.match(/^Bearer\s+(.{1,512})$/i)?.[1];
  if (!got) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(got)), crypto.subtle.digest("SHA-256", enc.encode(secret))]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

// ── límite de ritmo ──────────────────────────────────────────────────────────
export type Bucket = "read" | "heavy" | "write";

/** true si la petición puede pasar. Sin binding (tests, dev antiguo) no limita. */
export async function allow(env: Env, req: Request, bucket: Bucket): Promise<boolean> {
  const rl = bucket === "read" ? env.RL_READ : bucket === "heavy" ? env.RL_HEAVY : env.RL_WRITE;
  if (!rl) return true;
  // Cloudflare pone cf-connecting-ip en toda petición que llega de internet y el cliente no puede
  // quitarla. Si falta, la llamada viene de otro Worker por service binding (la web): no se limita.
  const ip = req.headers.get("cf-connecting-ip");
  if (!ip) return true;
  try {
    return (await rl.limit({ key: `${bucket}:${ip}` })).success;
  } catch {
    return true; // si el limitador falla, no tiramos la API de lectura
  }
}

// ── texto que viene de fuera (noticias) ──────────────────────────────────────
/** quita caracteres de control e invisibles que se usan para esconder instrucciones */
export function cleanText(s: unknown, max: number): string {
  return String(s ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F​-‏‪-‮⁠-⁤﻿]/g, "")
    .replace(/<[^>]{0,200}>/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, max);
}

/** solo http(s) público: nada de javascript:, data:, IPs privadas ni localhost */
export function safeUrl(u: unknown): string | null {
  try {
    const url = new URL(String(u));
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const h = url.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || /^(\d{1,3}\.){3}\d{1,3}$/.test(h) || h.includes(":")) return null;
    if (url.username || url.password) return null;
    return url.toString().slice(0, 2048);
  } catch {
    return null;
  }
}

/**
 * Salida del modelo que acaba en pantalla. El resumen es descriptivo: si suena a consejo
 * ("compra", "vende ya", "deberías invertir"), se descarta entero y la noticia va a revisión.
 */
const ADVICE = /\b(compra(r|d)?\s+(ya|ahora|acciones)|vende(r|d)?\s+(ya|ahora|todo)|deber[ií]as?\s+(comprar|vender|invertir)|recomendamos|te\s+recomiendo|inversi[oó]n\s+segura|garantizad[oa]s?|buy\s+now|sell\s+now|you\s+should\s+(buy|sell|invest)|guaranteed\s+returns?)\b/i;

export function soundsLikeAdvice(s: string): boolean {
  return ADVICE.test(s);
}

/** parámetros de un backtest, acotados: un rango absurdo o un millón de monos no llegan al motor */
export function backtestParams(b: Record<string, unknown>): BacktestParams {
  const start = v.date(b.start ?? b.inicio, "start");
  const end = v.date(b.end ?? b.fin, "end");
  if (start >= end) throw new BadInput("start debe ser anterior a end");
  if ((Date.parse(end) - Date.parse(start)) / 86_400_000 > 366 * 5) throw new BadInput("el rango máximo es de 5 años");
  return { start, end, monkeys: v.int(b.monkeys ?? b.monos, "monkeys", 0, 5000, 2000), seed: v.int(b.seed ?? b.semilla, "seed", 0, 2 ** 31 - 1, 7) };
}
