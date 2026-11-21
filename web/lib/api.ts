import "server-only";
import { cache } from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import snapshot from "@/data/snapshot.json";
import type { Lab, NewsItem, Status } from "./types";

const SNAPSHOT = snapshot as unknown as Omit<Lab, "live">;
const TIMEOUT_MS = 4000;

type Fetcher = (path: string) => Promise<Response>;

/**
 * Cómo se llega a la API del laboratorio, por orden de preferencia:
 * 1. Service binding LAB_API (Worker a Worker, sin salir a internet).
 * 2. LAB_API_URL (build y desarrollo local).
 * Si no hay ninguna, o falla, la web sirve la foto empaquetada y lo dice en pantalla.
 */
async function fetcher(): Promise<Fetcher | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const svc = (env as { LAB_API?: { fetch: typeof fetch } }).LAB_API;
    if (svc) return (path) => svc.fetch(`https://lab.internal${path}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    // sin contexto de Cloudflare (build o `next dev` sin bindings)
  }
  const base = process.env.LAB_API_URL;
  if (base) return (path) => fetch(`${base}${path}`, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  return null;
}

async function getJson<T>(f: Fetcher, path: string): Promise<T> {
  const res = await f(path);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return (await res.json()) as T;
}

type LabPayload = Omit<Lab, "live" | "taken_at">;

// Memoria por isolate: si veinte páginas se regeneran a la vez, comparten una sola llamada a la API.
// Solo guarda datos públicos e iguales para todos, nunca nada de una petición concreta.
const MEMO_MS = 30_000;
let memo: { at: number; value: Promise<Lab> } | null = null;

async function loadLab(): Promise<Lab> {
  const f = await fetcher();
  if (!f) return { ...SNAPSHOT, live: false };
  try {
    const d = await getJson<LabPayload>(f, "/v1/lab");
    // una API recién desplegada y sin corridas todavía no tiene nada que enseñar: mejor la foto
    if (!d.ranking?.rows?.length) return { ...SNAPSHOT, live: false };
    return { live: true, taken_at: d.status.now, status: d.status, ranking: d.ranking, curves: d.curves, news: d.news, positions: d.positions, investors: d.investors, universe: d.universe, calls: d.calls };
  } catch (err) {
    console.error(JSON.stringify({ level: "warn", message: "API del laboratorio no disponible, sirviendo la foto", error: String(err) }));
    return { ...SNAPSHOT, live: false };
  }
}

/**
 * Todo lo que pinta la web, en una sola llamada. React.cache evita repetirla dentro de un render;
 * la memoria por isolate, entre renders cercanos. La frescura real la gobierna el ISR de cada página.
 */
export const getLab = cache((): Promise<Lab> => {
  const now = Date.now();
  if (!memo || now - memo.at > MEMO_MS) {
    const value = loadLab();
    memo = { at: now, value };
    // un fallo no se queda en memoria: la siguiente petición vuelve a intentarlo
    value.then((v) => { if (!v.live && memo?.value === value) memo = null; });
  }
  return memo.value;
});

/** pulso ligero para el indicador en vivo: solo estado y últimas noticias */
export async function getPulse(): Promise<{ live: boolean; status: Status; news: NewsItem[] }> {
  const f = await fetcher();
  if (f) {
    try {
      const [status, news] = await Promise.all([getJson<Status>(f, "/v1/status"), getJson<{ events: NewsItem[] }>(f, "/v1/news?limit=5")]);
      return { live: true, status, news: news.events };
    } catch {
      /* cae a la foto */
    }
  }
  return { live: false, status: SNAPSHOT.status, news: SNAPSHOT.news.slice(0, 5) };
}

export interface Decision {
  date: string;
  position: number;
  reason: Record<string, unknown> | null;
}

/** por qué decidió un inversionista en un activo (su última decisión de paper trading) */
export async function getDecision(investor: string, symbol: string): Promise<Decision | null> {
  const f = await fetcher();
  if (!f) return null;
  try {
    const res = await f(`/v1/decisions?investor=${encodeURIComponent(investor)}&symbol=${encodeURIComponent(symbol)}`);
    return res.ok ? ((await res.json()) as Decision) : null;
  } catch {
    return null;
  }
}

export function staticInvestorIds(): string[] {
  return SNAPSHOT.investors.map((i) => i.id);
}

/** llamada interna a la API para rutas de la web que reenvían (suscripciones a avisos) */
export async function labFetch(path: string, init?: { method?: string; body?: string; clientIp?: string | null; timeoutMs?: number }): Promise<Response | null> {
  const wait = init?.timeoutMs ?? TIMEOUT_MS;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init?.clientIp) headers["x-client-ip"] = init.clientIp;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const svc = (env as { LAB_API?: { fetch: typeof fetch } }).LAB_API;
    if (svc) return await svc.fetch(`https://lab.internal${path}`, { method: init?.method ?? "GET", headers, body: init?.body, signal: AbortSignal.timeout(wait) });
  } catch {
    /* sin binding: cae a la URL */
  }
  const base = process.env.LAB_API_URL;
  if (!base) return null;
  try {
    return await fetch(`${base}${path}`, { method: init?.method ?? "GET", headers, body: init?.body, signal: AbortSignal.timeout(wait), cache: "no-store" });
  } catch {
    return null;
  }
}
