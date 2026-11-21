/**
 * Un Durable Object por inversionista. Su estado (posiciones y razones) es suyo y nadie más lo escribe.
 * Cada día hábil, tras el cierre de EE. UU., el cron le pide `decide(fecha)`: calcula su posición para
 * mañana con datos hasta hoy, la guarda en su SQLite y la publica en D1 (run 'paper').
 */
import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";
import { loadPanel, isCompleteDay } from "../data/store";
import { contextFromPanel, runLab, withDependencies, LINEUP } from "../engine/registry";
import { explain } from "../engine/explain";

export interface Decision {
  investor: string;
  date: string;
  positions: Record<string, number>;
  skipped?: string;
}

export class InvestorDO extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS signals (
        date TEXT NOT NULL, symbol TEXT NOT NULL, position INTEGER NOT NULL, reason_json TEXT NOT NULL,
        PRIMARY KEY (date, symbol))`);
      this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
    });
  }

  /** decide al cierre de `asOf` (YYYY-MM-DD). Idempotente: repetir la misma fecha da lo mismo. */
  async decide(investorId: string, asOf: string, paperStart = "2025-11-20"): Promise<Decision> {
    if (!(await isCompleteDay(this.env.DB, asOf))) {
      return { investor: investorId, date: asOf, positions: {}, skipped: "día incompleto: no se opera" };
    }
    const panel = await loadPanel(this.env.DB, asOf);
    const c = contextFromPanel(panel);
    const t = c.dates.length - 1;
    if (c.dates[t] !== asOf) return { investor: investorId, date: asOf, positions: {}, skipped: "no es sesión de EE. UU." };

    const lineup = withDependencies(investorId);
    const self = lineup[lineup.length - 1];
    const lab = runLab(c, { start: paperStart, end: asOf, monkeys: 0, lineup });
    const pos = lab.investors[self.name].positions;

    const positions: Record<string, number> = {};
    const d1 = this.env.DB.prepare(
      "INSERT OR REPLACE INTO signals (run_id, investor_id, date, symbol, position, reason_json) VALUES ('paper', ?1, ?2, ?3, ?4, ?5)",
    );
    const batch: D1PreparedStatement[] = [];
    c.symbols.forEach((sym, a) => {
      const reason = JSON.stringify(explain(self, c, pos, t, a));
      positions[sym] = pos[a][t];
      this.ctx.storage.sql.exec(
        "INSERT OR REPLACE INTO signals (date, symbol, position, reason_json) VALUES (?, ?, ?, ?)",
        asOf, sym, pos[a][t], reason,
      );
      batch.push(d1.bind(self.id, asOf, sym, pos[a][t], reason));
    });
    await this.env.DB.batch(batch);
    this.ctx.storage.sql.exec("INSERT OR REPLACE INTO meta (key, value) VALUES ('last_decision', ?)", asOf);
    return { investor: self.id, date: asOf, positions };
  }

  async lastDecision(): Promise<string | null> {
    const rows = this.ctx.storage.sql.exec<{ value: string }>("SELECT value FROM meta WHERE key = 'last_decision'").toArray();
    return rows[0]?.value ?? null;
  }

  async history(symbol: string, limit = 30) {
    return this.ctx.storage.sql
      .exec("SELECT date, position, reason_json FROM signals WHERE symbol = ? ORDER BY date DESC LIMIT ?", symbol, limit)
      .toArray();
  }
}

export const INVESTOR_IDS = LINEUP.map((s) => s.id);
