/** Lectura y escritura en D1. Todo lo que el dashboard y el MCP consultan vive aquí. */
import { buildPanel, type Panel } from "../engine/panel";
import { equity, type Metrics } from "../engine/backtest";
import type { Ctx } from "../engine/investors";
import type { LabResult } from "../engine/registry";
import type { NewsEvent } from "../news/types";

export async function loadPanel(db: D1Database, asOf?: string): Promise<Panel> {
  const q = asOf
    ? db.prepare("SELECT symbol, date, adj_close AS close FROM prices_daily WHERE date <= ?1 ORDER BY date").bind(asOf)
    : db.prepare("SELECT symbol, date, adj_close AS close FROM prices_daily ORDER BY date");
  const { results } = await q.all<{ symbol: string; date: string; close: number }>();
  return buildPanel(results);
}

/** solo días marcados como completos: si falló la ingesta, el sistema no inventa, no opera */
export async function isCompleteDay(db: D1Database, date: string): Promise<boolean> {
  const row = await db.prepare("SELECT status FROM market_days WHERE date = ?1").bind(date).first<{ status: string }>();
  return row?.status === "complete";
}

async function batched(db: D1Database, stmts: D1PreparedStatement[], size = 400) {
  for (let i = 0; i < stmts.length; i += size) await db.batch(stmts.slice(i, i + size));
}

export async function saveLab(db: D1Database, runId: string, c: Ctx, lab: LabResult, seed: number): Promise<void> {
  const mInsert = db.prepare(
    "INSERT OR REPLACE INTO metrics (run_id, investor_id, segment, total_return, sharpe, max_dd, trades, pct_vs_monkeys, dsr) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
  );
  const eInsert = db.prepare("INSERT OR REPLACE INTO equity_daily (run_id, investor_id, date, equity) VALUES (?1, ?2, ?3, ?4)");
  const stmts: D1PreparedStatement[] = [];
  for (const r of Object.values(lab.investors)) {
    const m: Metrics = r.metrics;
    stmts.push(mInsert.bind(runId, r.spec.id, "_global", m.totalReturn, m.sharpeAnnual, m.maxDrawdown, r.trades, r.pctMonkeys, r.dsr));
    for (const [seg, v] of Object.entries(r.segments)) stmts.push(mInsert.bind(runId, r.spec.id, seg, v, null, null, null, null, null));
    equity(r.daily).forEach((v, i) => stmts.push(eInsert.bind(runId, r.spec.id, c.dates[lab.window[i]], v)));
  }
  const mk = lab.monkeys;
  stmts.push(
    db
      .prepare("INSERT OR REPLACE INTO monkey_stats (run_id, segment, n, seed, p05, p50, p95, best_of_n_p95) VALUES (?1, '_global', ?2, ?3, ?4, ?5, ?6, ?7)")
      .bind(runId, mk.n, seed, mk.p05, mk.p50, mk.p95, mk.bestOfNp95),
  );
  await batched(db, stmts);
}

export async function ranking(db: D1Database, runId?: string, segment = "_global") {
  const run =
    runId ??
    (await db.prepare("SELECT run_id FROM runs WHERE status = 'complete' ORDER BY created_at DESC LIMIT 1").first<{ run_id: string }>())?.run_id;
  if (!run) return { run_id: null, rows: [] };
  const { results } = await db
    .prepare(
      `SELECT m.investor_id, i.name, i.family, m.total_return, m.sharpe, m.max_dd, m.trades, m.pct_vs_monkeys, m.dsr
       FROM metrics m LEFT JOIN investors i ON i.id = m.investor_id
       WHERE m.run_id = ?1 AND m.segment = ?2 ORDER BY m.total_return DESC`,
    )
    .bind(run, segment)
    .all();
  const mk = await db.prepare("SELECT * FROM monkey_stats WHERE run_id = ?1 AND segment = '_global'").bind(run).first();
  return { run_id: run, segment, monkeys: mk, rows: results };
}

/** noticias vigentes para un activo hasta `at` (point-in-time: effective_at ≤ at) */
export async function newsFor(db: D1Database, symbol: string, at: Date, lookbackDays = 60): Promise<NewsEvent[]> {
  const from = new Date(at.getTime() - lookbackDays * 86_400_000).toISOString();
  const { results } = await db
    .prepare(
      `SELECT e.json FROM news_events e JOIN news_entities n ON n.event_id = e.event_id
       WHERE n.symbol = ?1 AND e.effective_at <= ?2 AND e.effective_at >= ?3`,
    )
    .bind(symbol, at.toISOString(), from)
    .all<{ json: string }>();
  return results.map((r) => JSON.parse(r.json) as NewsEvent);
}

export async function saveNewsEvent(db: D1Database, ev: NewsEvent, r2Key: string | null, costUsd: number | null) {
  const s = ev.signal;
  const stmts = [
    db
      .prepare(
        `INSERT OR IGNORE INTO news_events (event_id, published_at, effective_at, source_tier, event_type, direction, surprise, novelty, hype,
         uncertainty, horizon, taxonomy_version, prompt_version, model, cost_usd, json, r2_key)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)`,
      )
      .bind(
        ev.event_id, ev.timing.published_at, ev.timing.effective_at, ev.source.tier, ev.classification.event_type, s.direction,
        s.surprise, s.novelty, s.hype, s.uncertainty, s.horizon, String(ev.extraction.taxonomy_version ?? ""),
        String(ev.extraction.prompt_version ?? ""), String(ev.extraction.model ?? ""), costUsd, JSON.stringify(ev), r2Key,
      ),
    ...ev.entities.map((e) =>
      db
        .prepare("INSERT OR IGNORE INTO news_entities (event_id, symbol, role, relevance, sentiment, confidence) VALUES (?1, ?2, ?3, ?4, ?5, ?6)")
        .bind(ev.event_id, e.symbol, e.role, e.relevance, e.sentiment, e.confidence),
    ),
    ...[
      ...(ev.classification.themes ?? []).map((v) => ["theme", v]),
      ...(ev.classification.macro_factors ?? []).map((v) => ["macro_factor", v]),
      ...(ev.classification.secondary_event_types ?? []).map((v) => ["secondary_event", v]),
    ].map(([k, v]) => db.prepare("INSERT INTO news_tags (event_id, kind, value) VALUES (?1, ?2, ?3)").bind(ev.event_id, k, v)),
  ];
  await db.batch(stmts);
}

// ── lecturas del dashboard público ───────────────────────────────────────────

async function latestRun(db: D1Database, runId?: string): Promise<string | null> {
  if (runId) return runId;
  return (await db.prepare("SELECT run_id FROM runs WHERE status = 'complete' ORDER BY created_at DESC LIMIT 1").first<{ run_id: string }>())?.run_id ?? null;
}

/** curvas de capital de una corrida, compactas: { dates, series: { investor_id: [equity…] } } */
export async function curves(db: D1Database, runId?: string) {
  const run = await latestRun(db, runId);
  if (!run) return { run_id: null, dates: [], series: {} };
  const { results } = await db
    .prepare("SELECT investor_id, date, equity FROM equity_daily WHERE run_id = ?1 ORDER BY date")
    .bind(run)
    .all<{ investor_id: string; date: string; equity: number }>();
  const dates: string[] = [];
  const idx = new Map<string, number>();
  for (const r of results) if (!idx.has(r.date)) idx.set(r.date, dates.push(r.date) - 1);
  const series: Record<string, (number | null)[]> = {};
  for (const r of results) {
    const s = (series[r.investor_id] ??= new Array(dates.length).fill(null));
    s[idx.get(r.date)!] = Math.round(r.equity * 1e4) / 1e4;
  }
  return { run_id: run, dates, series };
}

/** últimas noticias etiquetadas. Nunca devuelve `outcome` (regla de oro 3) ni el texto crudo. */
export async function latestNews(db: D1Database, limit = 30, symbol?: string) {
  const q = symbol
    ? db
        .prepare(
          `SELECT e.json FROM news_events e JOIN news_entities n ON n.event_id = e.event_id
           WHERE n.symbol = ?2 ORDER BY e.published_at DESC LIMIT ?1`,
        )
        .bind(limit, symbol)
    : db.prepare("SELECT json FROM news_events ORDER BY published_at DESC LIMIT ?1").bind(limit);
  const { results } = await q.all<{ json: string }>();
  return results.map((r) => {
    const ev = JSON.parse(r.json) as NewsEvent & Record<string, unknown>;
    return {
      event_id: ev.event_id,
      title: ev.content?.title ?? "",
      summary_es: ev.content?.summary_es ?? "",
      source: { name: ev.source?.name, url: ev.source?.url, tier: ev.source?.tier },
      published_at: ev.timing?.published_at,
      effective_at: ev.timing?.effective_at,
      event_type: ev.classification?.event_type,
      themes: ev.classification?.themes ?? [],
      signal: ev.signal,
      entities: (ev.entities ?? []).map((e) => ({ symbol: e.symbol, role: e.role, relevance: e.relevance, sentiment: e.sentiment, confidence: e.confidence })),
      extraction: { model: ev.extraction?.model, prompt_version: ev.extraction?.prompt_version, taxonomy_version: ev.extraction?.taxonomy_version },
    };
  });
}

/** pulso del laboratorio: qué fue lo último que escuchó y decidió */
export async function labStatus(db: D1Database) {
  const [day, news, run, paper, counts, review] = await db.batch([
    db.prepare("SELECT date, status, ingested_at FROM market_days ORDER BY date DESC LIMIT 1"),
    db.prepare("SELECT MAX(published_at) AS last_published, MAX(effective_at) AS last_effective, COUNT(*) AS total FROM news_events"),
    db.prepare("SELECT run_id, start_date, end_date, engine_version, taxonomy_version, config_hash, n_trials, created_at FROM runs WHERE status = 'complete' ORDER BY created_at DESC LIMIT 1"),
    db.prepare("SELECT MAX(date) AS last_date, COUNT(DISTINCT investor_id) AS investors FROM signals WHERE run_id = 'paper'"),
    db.prepare("SELECT (SELECT COUNT(*) FROM prices_daily) AS prices, (SELECT COUNT(*) FROM market_days WHERE status = 'complete') AS sessions"),
    db.prepare("SELECT COUNT(*) AS pending FROM news_review_queue"),
  ]);
  return {
    market_day: day.results[0] ?? null,
    news: news.results[0] ?? null,
    last_run: run.results[0] ?? null,
    paper: paper.results[0] ?? null,
    counts: counts.results[0] ?? null,
    review_queue: review.results[0] ?? null,
  };
}

/** posiciones de paper trading del último día decidido (o de `date`): inversionista × activo */
export async function paperPositions(db: D1Database, date?: string) {
  const d = date ?? (await db.prepare("SELECT MAX(date) AS d FROM signals WHERE run_id = 'paper'").first<{ d: string | null }>())?.d;
  if (!d) return { date: null, rows: [] };
  const { results } = await db
    .prepare("SELECT investor_id, symbol, position FROM signals WHERE run_id = 'paper' AND date = ?1 ORDER BY investor_id, symbol")
    .bind(d)
    .all<{ investor_id: string; symbol: string; position: number }>();
  const by: Record<string, Record<string, number>> = {};
  for (const r of results) (by[r.investor_id] ??= {})[r.symbol] = r.position;
  return { date: d, rows: Object.entries(by).map(([investor_id, positions]) => ({ investor_id, positions })) };
}

/** por qué decidió: la razón guardada de un inversionista en un activo (última fecha o `date`) */
export async function decisionReason(db: D1Database, investor: string, symbol: string, date?: string, runId = "paper") {
  const row = await db
    .prepare(
      `SELECT date, position, reason_json FROM signals WHERE run_id = ?1 AND investor_id = ?2 AND symbol = ?3
       ${date ? "AND date = ?4" : ""} ORDER BY date DESC LIMIT 1`,
    )
    .bind(...[runId, investor, symbol, ...(date ? [date] : [])])
    .first<{ date: string; position: number; reason_json: string }>();
  if (!row) return null;
  let reason: unknown = null;
  try {
    reason = JSON.parse(row.reason_json);
  } catch {
    /* razón corrupta: se devuelve sin ella */
  }
  return { date: row.date, position: row.position, reason };
}
