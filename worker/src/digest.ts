/** Resumen privado: la parte que toca D1 y el correo. La lógica pura vive en digest-core.ts. */
import type { Env } from "./env";
import { pickCalls, renderDigest, type Digest, type Verified } from "./digest-core";
import { noticeFor, notifyAll } from "./push";

export async function buildDigest(db: D1Database, date: string): Promise<Digest> {
  // 1) verificar las llamadas pendientes con la primera sesión completa posterior a cada una
  const { results: pending } = await db
    .prepare("SELECT date, symbol, direction, entry_close FROM calls WHERE verified_date IS NULL AND date < ?1")
    .bind(date)
    .all<{ date: string; symbol: string; direction: number; entry_close: number | null }>();
  for (const p of pending) {
    const next = await db
      .prepare(
        `SELECT p.date, p.adj_close AS close FROM prices_daily p JOIN market_days m ON m.date = p.date
         WHERE p.symbol = ?1 AND p.date > ?2 AND p.date <= ?3 AND m.status = 'complete' ORDER BY p.date LIMIT 1`,
      )
      .bind(p.symbol, p.date, date)
      .first<{ date: string; close: number }>();
    if (!next || !p.entry_close) continue;
    const ret = p.direction * (next.close / p.entry_close - 1);
    await db
      .prepare("UPDATE calls SET verified_date = ?1, exit_close = ?2, ret = ?3, hit = ?4 WHERE date = ?5 AND symbol = ?6")
      .bind(next.date, next.close, ret, ret > 0 ? 1 : 0, p.date, p.symbol)
      .run();
  }

  // 2) llamadas de hoy: solo tesis, sin el control de comprar y mantener
  const { results: rows } = await db
    .prepare(
      `SELECT s.symbol, s.position FROM signals s JOIN investors i ON i.id = s.investor_id
       WHERE s.run_id = 'paper' AND s.date = ?1 AND i.family != 'Control'`,
    )
    .bind(date)
    .all<{ symbol: string; position: number }>();
  const { results: px } = await db.prepare("SELECT symbol, adj_close AS close FROM prices_daily WHERE date = ?1").bind(date).all<{ symbol: string; close: number }>();
  const calls = pickCalls(date, rows, Object.fromEntries(px.map((r) => [r.symbol, r.close])));
  if (calls.length)
    await db.batch(
      calls.map((c) =>
        db
          .prepare("INSERT OR IGNORE INTO calls (date, symbol, direction, score, n_long, n_short, n_total, entry_close) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)")
          .bind(c.date, c.symbol, c.direction, c.score, c.n_long, c.n_short, c.n_total, c.entry_close),
      ),
    );

  // 3) lo verificado en esta pasada y el historial
  const { results: verified } = await db.prepare("SELECT * FROM calls WHERE verified_date = ?1 ORDER BY ret DESC").bind(date).all<Verified>();
  const rec = await db.prepare("SELECT COUNT(*) AS total, COALESCE(SUM(hit), 0) AS hits, AVG(ret) AS avg_ret FROM calls WHERE verified_date IS NOT NULL").first<Digest["record"]>();
  return { date, calls, verified, record: rec ?? { total: 0, hits: 0, avg_ret: null } };
}

export async function trackRecord(db: D1Database, limit = 60) {
  const { results } = await db.prepare("SELECT * FROM calls ORDER BY date DESC, ABS(score) DESC LIMIT ?1").bind(limit).all();
  const rec = await db.prepare("SELECT COUNT(*) AS total, COALESCE(SUM(hit), 0) AS hits, AVG(ret) AS avg_ret FROM calls WHERE verified_date IS NOT NULL").first();
  return { record: rec, calls: results };
}

/** construye y, si hay destinatario y remitente configurados, envía. Devuelve qué hizo. */
export async function sendDigest(env: Env, date: string, send = true): Promise<{ digest: Digest; sent: boolean; reason?: string; push?: unknown }> {
  const digest = await buildDigest(env.DB, date);
  if (!send) return { digest, sent: false, reason: "solo vista previa" };
  const site = env.SITE_URL ?? "https://1kmonos.com";
  // aviso del navegador a quien se suscribió en la web (solo si hay llamadas nuevas)
  const notice = noticeFor(digest, site);
  const push = notice ? await notifyAll(env, notice).catch((e) => ({ error: String(e) })) : { skipped: "sin llamadas nuevas" };
  if (!env.EMAIL || !env.DIGEST_TO || !env.DIGEST_FROM) return { digest, sent: false, reason: "correo sin configurar (EMAIL, DIGEST_TO, DIGEST_FROM)", push };
  const m = renderDigest(digest, site);
  await env.EMAIL.send({ to: env.DIGEST_TO, from: { email: env.DIGEST_FROM, name: "1K Monos" }, subject: m.subject, text: m.text, html: m.html });
  return { digest, sent: true, push };
}
