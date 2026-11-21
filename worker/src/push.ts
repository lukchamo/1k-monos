/**
 * Avisos del navegador (Web Push, RFC 8291) cuando el laboratorio registra llamadas nuevas.
 * El aviso describe lo que pasó en el experimento; nunca dice qué hacer con el dinero.
 */
import { buildPushPayload } from "@block65/webcrypto-web-push";
import type { Env } from "./env";
import { BadInput } from "./guard";
import { MAX_SUBS, parseSubscription, type Notice } from "./push-core";

export { noticeFor } from "./push-core";

export async function subscribe(db: D1Database, raw: unknown): Promise<{ ok: true }> {
  const s = parseSubscription(raw);
  const n = await db.prepare("SELECT COUNT(*) AS n FROM push_subs").first<{ n: number }>();
  if ((n?.n ?? 0) >= MAX_SUBS) throw new BadInput("cupo de suscripciones completo");
  await db
    .prepare("INSERT INTO push_subs (endpoint, p256dh, auth, created_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(endpoint) DO UPDATE SET p256dh = ?2, auth = ?3, fails = 0")
    .bind(s.endpoint, s.keys.p256dh, s.keys.auth, new Date().toISOString())
    .run();
  return { ok: true };
}

export async function unsubscribe(db: D1Database, raw: unknown): Promise<{ ok: true }> {
  const endpoint = (raw as { endpoint?: unknown })?.endpoint;
  if (typeof endpoint !== "string" || endpoint.length > 1024) throw new BadInput("endpoint inválido");
  await db.prepare("DELETE FROM push_subs WHERE endpoint = ?1").bind(endpoint).run();
  return { ok: true };
}

/** envía un aviso a todos los suscritos. Las suscripciones caducadas (404/410) se borran. */
export async function notifyAll(env: Env, notice: Notice): Promise<{ sent: number; removed: number; failed: number; skipped?: string }> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return { sent: 0, removed: 0, failed: 0, skipped: "avisos sin configurar (VAPID)" };
  const vapid = { subject: env.SITE_URL ?? "https://1kmonos.com", publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
  const { results } = await env.DB.prepare("SELECT endpoint, p256dh, auth FROM push_subs WHERE fails < 5 LIMIT ?1").bind(MAX_SUBS).all<{ endpoint: string; p256dh: string; auth: string }>();
  let sent = 0;
  let removed = 0;
  let failed = 0;
  const now = new Date().toISOString();
  // de 20 en 20: un Worker tiene un tope de conexiones salientes simultáneas
  for (let i = 0; i < results.length; i += 20) {
    await Promise.all(
      results.slice(i, i + 20).map(async (r) => {
        try {
          const sub = parseSubscription({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } });
          const payload = await buildPushPayload({ data: notice as unknown as Record<string, string>, options: { ttl: 6 * 3600, urgency: "normal", topic: notice.tag.slice(0, 32) } }, sub, vapid);
          const res = await fetch(sub.endpoint, { method: payload.method, headers: payload.headers, body: payload.body, signal: AbortSignal.timeout(8000) });
          if (res.ok) {
            sent++;
            await env.DB.prepare("UPDATE push_subs SET last_ok = ?1, fails = 0 WHERE endpoint = ?2").bind(now, r.endpoint).run();
          } else if (res.status === 404 || res.status === 410) {
            removed++;
            await env.DB.prepare("DELETE FROM push_subs WHERE endpoint = ?1").bind(r.endpoint).run();
          } else {
            failed++;
            await env.DB.prepare("UPDATE push_subs SET fails = fails + 1 WHERE endpoint = ?1").bind(r.endpoint).run();
          }
        } catch {
          failed++;
          await env.DB.prepare("UPDATE push_subs SET fails = fails + 1 WHERE endpoint = ?1").bind(r.endpoint).run().catch(() => {});
        }
      }),
    );
  }
  return { sent, removed, failed };
}
