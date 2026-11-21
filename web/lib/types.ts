export interface RankRow {
  investor_id: string;
  name: string;
  family: string;
  total_return: number;
  sharpe: number | null;
  max_dd: number | null;
  trades: number | null;
  pct_vs_monkeys: number | null;
  dsr: number | null;
}
export interface Monkeys {
  n: number;
  seed: number;
  p05: number;
  p50: number;
  p95: number;
  best_of_n_p95: number;
}
export interface Ranking {
  run_id: string | null;
  segment?: string;
  monkeys: Monkeys | null;
  rows: RankRow[];
}
export interface Curves {
  run_id: string | null;
  dates: string[];
  series: Record<string, (number | null)[]>;
}
export interface NewsItem {
  event_id: string;
  title: string;
  summary_es: string;
  source: { name?: string; url?: string; tier?: string };
  published_at: string;
  effective_at: string;
  event_type: string;
  themes: string[];
  signal: { direction?: string; surprise?: number; novelty?: number; magnitude?: string; horizon?: string; hype?: number; uncertainty?: number };
  entities: { symbol: string; role?: string; relevance: number; sentiment: number; confidence: number }[];
  extraction: { model?: string; prompt_version?: string; taxonomy_version?: string };
}
export interface Positions {
  date: string | null;
  rows: { investor_id: string; positions: Record<string, number> }[];
}
export type Rule = { kind: string } & Record<string, unknown>;
export interface Investor {
  id: string;
  name: string;
  family: string;
  version: string;
  rule: Rule;
  config_hash: string;
}
export interface Status {
  market_day: { date: string; status: string; ingested_at: string } | null;
  news: { last_published: string | null; last_effective: string | null; total: number } | null;
  last_run: { run_id: string; start_date: string; end_date: string; engine_version: string; taxonomy_version: string; config_hash: string; n_trials: number; created_at: string } | null;
  paper: { last_date: string | null; investors: number } | null;
  counts: { prices: number; sessions: number } | null;
  review_queue: { pending: number } | null;
  engine: string;
  taxonomy: string;
  now: string;
}
export interface Universe {
  segments: Record<string, string[]>;
  economies: Record<string, string[]>;
  indicators: Record<string, string>;
}
export interface CallRow {
  date: string;
  symbol: string;
  direction: number;
  score: number;
  n_long: number;
  n_short: number;
  n_total: number;
  entry_close: number | null;
  verified_date: string | null;
  exit_close: number | null;
  ret: number | null;
  hit: number | null;
}
export interface Calls {
  record: { total: number; hits: number; avg_ret: number | null } | null;
  calls: CallRow[];
}
export interface Lab {
  /** true si los datos vienen de la API en este render; false si es la foto empaquetada */
  live: boolean;
  taken_at: string;
  status: Status;
  ranking: Ranking;
  curves: Curves;
  news: NewsItem[];
  positions: Positions;
  investors: Investor[];
  universe: Universe;
  calls?: Calls;
}
