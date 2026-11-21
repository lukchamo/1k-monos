/** Avisos del navegador: la parte pura (validación de la suscripción y texto del aviso). */
import type { PushSubscription } from "@block65/webcrypto-web-push";
import { BadInput } from "./guard";
import type { Digest } from "./digest-core";

export const MAX_SUBS = 5000;

/**
 * Lista blanca de servicios de push. El endpoint lo manda el navegador del visitante y el Worker
 * hará peticiones a esa URL: sin esta lista sería una puerta para hacernos llamar a cualquier sitio.
 */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^[a-z0-9-]+\.notify\.windows\.com$/, /^web\.push\.apple\.com$/, /^[a-z0-9-]+\.push\.apple\.com$/];
const B64URL = /^[A-Za-z0-9_-]+$/;

export function parseSubscription(raw: unknown): PushSubscription {
  const o = raw as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
  if (!o || typeof o !== "object") throw new BadInput("suscripción inválida");
  const { endpoint, keys } = o;
  if (typeof endpoint !== "string" || endpoint.length > 1024) throw new BadInput("endpoint inválido");
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new BadInput("endpoint inválido");
  }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || !PUSH_HOSTS.some((re) => re.test(url.hostname)))
    throw new BadInput("servicio de avisos no admitido");
  const p256dh = keys?.p256dh;
  const auth = keys?.auth;
  if (typeof p256dh !== "string" || typeof auth !== "string" || !B64URL.test(p256dh) || !B64URL.test(auth) || p256dh.length < 80 || p256dh.length > 100 || auth.length < 16 || auth.length > 32)
    throw new BadInput("claves de la suscripción inválidas");
  return { endpoint: url.toString(), expirationTime: null, keys: { p256dh, auth } };
}

export interface Notice {
  title: string;
  body: string;
  url: string;
  tag: string;
}

export function noticeFor(d: Digest, siteUrl: string): Notice | null {
  if (!d.calls.length) return null;
  const side = (x: number) => (x > 0 ? "largo" : "corto");
  const list = d.calls.map((c) => `${c.symbol} en ${side(c.direction)}`).join(", ");
  const hits = d.verified.length ? ` Ayer: ${d.verified.filter((v) => v.hit).length} de ${d.verified.length} acertaron.` : "";
  return {
    title: `1K Monos · cierre del ${d.date}`,
    body: `El laboratorio registró: ${list}.${hits} Es un experimento, no una recomendación.`.slice(0, 300),
    url: `${siteUrl}/#llamadas`,
    tag: `cierre-${d.date}`,
  };
}

