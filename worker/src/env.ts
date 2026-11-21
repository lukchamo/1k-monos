import type { InvestorDO } from "./do/investor";
import type { BacktestParams } from "./workflows/backtest";

export interface Env {
  DB: D1Database;
  RAW: R2Bucket; // texto crudo de noticias y respuestas del modelo
  INVESTOR: DurableObjectNamespace<InvestorDO>;
  BACKTEST: Workflow<BacktestParams>;
  AI: Ai;
  // límites de ritmo por IP (binding ratelimits). Opcionales: sin ellos no se limita (tests)
  RL_READ?: RateLimit;
  RL_HEAVY?: RateLimit;
  RL_WRITE?: RateLimit;

  // vars
  TAXONOMY_VERSION: string;
  PROMPT_VERSION: string;
  AI_GATEWAY_ID: string;
  EXTRACT_MODEL: string;

  // secretos (wrangler secret put …)
  FIRECRAWL_API_KEY?: string;
  TWELVE_DATA_API_KEY?: string;
  MCP_TOKEN?: string; // las herramientas que escriben (correr_backtest) exigen este token
}
