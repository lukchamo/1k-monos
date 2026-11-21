/**
 * Backtest bajo demanda como Workflow: crea la corrida, corre el laboratorio completo y guarda el
 * libro mayor en D1. Cada paso se reintenta solo; el resultado queda ligado al config_hash del elenco.
 */
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import type { Env } from "../env";
import { loadPanel, saveLab } from "../data/store";
import { configHash, contextFromPanel, ENGINE_VERSION, LINEUP, runLab } from "../engine/registry";

export interface BacktestParams {
  start: string;
  end: string;
  monkeys?: number;
  seed?: number;
}

export class BacktestWorkflow extends WorkflowEntrypoint<Env, BacktestParams> {
  async run(event: WorkflowEvent<BacktestParams>, step: WorkflowStep) {
    const p = event.payload;
    const runId = event.instanceId;
    const seed = p.seed ?? 7;

    const hash = await step.do("registrar corrida", async () => {
      const hashes = await Promise.all(LINEUP.map((s) => configHash(s, this.env.TAXONOMY_VERSION)));
      const all = await configHash(
        { id: "lineup", name: "lineup", family: "Control", version: hashes.join(","), rule: { kind: "compra_y_mantener" } },
        this.env.TAXONOMY_VERSION,
      );
      const now = new Date().toISOString();
      await this.env.DB.batch([
        this.env.DB
          .prepare(
            "INSERT OR REPLACE INTO runs (run_id, mode, start_date, end_date, engine_version, taxonomy_version, config_hash, n_trials, status, created_at) VALUES (?1, 'backtest', ?2, ?3, ?4, ?5, ?6, ?7, 'running', ?8)",
          )
          .bind(runId, p.start, p.end, ENGINE_VERSION, this.env.TAXONOMY_VERSION, all, LINEUP.filter((s) => s.family !== "Control").length, now),
        ...LINEUP.map((s, i) =>
          this.env.DB
            .prepare("INSERT OR REPLACE INTO investors (id, name, family, rule_version, params_json, config_hash) VALUES (?1, ?2, ?3, ?4, ?5, ?6)")
            .bind(s.id, s.name, s.family, s.version, JSON.stringify(s.rule), hashes[i]),
        ),
      ]);
      return all;
    });

    const summary = await step.do("correr laboratorio", { retries: { limit: 2, delay: "30 seconds" }, timeout: "10 minutes" }, async () => {
      const c = contextFromPanel(await loadPanel(this.env.DB, p.end));
      const lab = runLab(c, { start: p.start, end: p.end, monkeys: p.monkeys ?? 2000, seed });
      await saveLab(this.env.DB, runId, c, lab, seed);
      const best = Object.values(lab.investors)
        .filter((r) => r.spec.family !== "Control")
        .sort((a, b) => b.metrics.totalReturn - a.metrics.totalReturn)[0];
      return { best: best.spec.name, best_return: best.metrics.totalReturn, best_dsr: best.dsr, best_of_n_p95: lab.monkeys.bestOfNp95 };
    });

    await step.do("cerrar corrida", async () => {
      await this.env.DB.prepare("UPDATE runs SET status = 'complete' WHERE run_id = ?1").bind(runId).run();
      return true;
    });
    return { run_id: runId, config_hash: hash, ...summary };
  }
}
