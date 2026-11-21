-- COPIA de worker/migrations/0001_init.sql (la migración es la fuente; no editar aquí)
-- Laboratorio de inversionistas determinísticos · esquema D1 v1
-- D1 = libro mayor que consulta el dashboard y el MCP. Cada inversionista además guarda su estado en su
-- propio Durable Object (SQLite interno). El JSON crudo de cada noticia y la respuesta del modelo van a R2.

-- ---------- catálogo y precios ----------
CREATE TABLE IF NOT EXISTS assets (
  symbol      TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  asset_class TEXT NOT NULL,            -- equity | etf | crypto | index | rate
  segment     TEXT,                     -- p. ej. 'EE. UU. tecnología e IA'
  economy     TEXT,                     -- Desarrolladas | Emergentes | Cripto | Materias primas y refugio
  vol_tier    TEXT,
  tradable    INTEGER NOT NULL DEFAULT 1,
  listed_on   TEXT                      -- primera sesión: evita el sesgo de supervivencia (SpaceX 2026-06-12)
);

CREATE TABLE IF NOT EXISTS prices_daily (
  symbol    TEXT NOT NULL,
  date      TEXT NOT NULL,              -- YYYY-MM-DD, calendario de EE. UU.
  close     REAL,
  adj_close REAL NOT NULL,
  volume    REAL,
  source    TEXT NOT NULL,              -- fuente primaria
  check_source TEXT,                    -- fuente de contraste
  check_diff   REAL,                    -- |primaria − contraste| / primaria
  PRIMARY KEY (symbol, date)
);

-- un día solo se opera si todos los precios llegaron y cuadran entre fuentes
CREATE TABLE IF NOT EXISTS market_days (
  date        TEXT PRIMARY KEY,
  status      TEXT NOT NULL,            -- complete | incomplete
  missing     TEXT,                     -- JSON con símbolos que faltan o discrepan
  ingested_at TEXT NOT NULL
);

-- ---------- noticias: columnas indexadas + JSON completo ----------
CREATE TABLE IF NOT EXISTS news_events (
  event_id          TEXT PRIMARY KEY,   -- sha256(url canónica + published_at)
  published_at      TEXT NOT NULL,
  effective_at      TEXT NOT NULL,      -- lo calcula el Worker, nunca el LLM
  source_tier       TEXT NOT NULL,
  event_type        TEXT NOT NULL,
  direction         TEXT,
  surprise          REAL, novelty REAL, hype REAL, uncertainty REAL,
  horizon           TEXT,
  cluster_id        TEXT,
  story_rank        INTEGER,
  taxonomy_version  TEXT NOT NULL,
  prompt_version    TEXT NOT NULL,
  model             TEXT,
  cost_usd          REAL,
  json              TEXT NOT NULL,
  r2_key            TEXT
);
CREATE INDEX IF NOT EXISTS idx_news_eff ON news_events(effective_at);

CREATE TABLE IF NOT EXISTS news_entities (
  event_id   TEXT NOT NULL,
  symbol     TEXT NOT NULL,
  role       TEXT, relevance REAL, sentiment REAL, confidence REAL,
  PRIMARY KEY (event_id, symbol)
);
CREATE INDEX IF NOT EXISTS idx_news_ent_sym ON news_entities(symbol);

CREATE TABLE IF NOT EXISTS news_tags (
  event_id TEXT NOT NULL,
  kind     TEXT NOT NULL,               -- theme | macro_factor | secondary_event
  value    TEXT NOT NULL
);

-- NUNCA se lee para decidir: solo para calibrar pesos en una versión nueva de la taxonomía
CREATE TABLE IF NOT EXISTS news_outcomes (
  event_id   TEXT NOT NULL,
  symbol     TEXT NOT NULL,
  ret_1d REAL, ret_5d REAL, ret_20d REAL,
  abn_1d REAL, abn_5d REAL, abn_20d REAL, -- retorno anormal frente a su referencia
  divergence INTEGER,                    -- la reacción fue contraria al sentimiento
  PRIMARY KEY (event_id, symbol)
);

-- extracciones que fallaron dos veces la validación: revisión humana, no entran en ninguna señal
CREATE TABLE IF NOT EXISTS news_review_queue (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  url        TEXT NOT NULL,
  error      TEXT NOT NULL,
  r2_key     TEXT,
  created_at TEXT NOT NULL
);

-- ---------- inversionistas, corridas y libro mayor ----------
CREATE TABLE IF NOT EXISTS investors (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  family       TEXT NOT NULL,
  rule_version TEXT NOT NULL,
  params_json  TEXT NOT NULL,
  config_hash  TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'champion'   -- champion | challenger | retired
);

CREATE TABLE IF NOT EXISTS runs (
  run_id           TEXT PRIMARY KEY,
  mode             TEXT NOT NULL,       -- backtest | paper | montecarlo
  start_date       TEXT NOT NULL,
  end_date         TEXT NOT NULL,
  engine_version   TEXT NOT NULL,
  taxonomy_version TEXT NOT NULL,
  config_hash      TEXT NOT NULL,       -- hash del elenco completo
  n_trials         INTEGER NOT NULL,    -- cuántas variantes se probaron: entra en el DSR
  status           TEXT NOT NULL DEFAULT 'running',
  created_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS signals (
  run_id      TEXT NOT NULL,
  investor_id TEXT NOT NULL,
  date        TEXT NOT NULL,
  symbol      TEXT NOT NULL,
  position    INTEGER NOT NULL,         -- −1 | 0 | 1, decidido al cierre de `date`
  reason_json TEXT NOT NULL,            -- los números que produjeron la decisión
  PRIMARY KEY (run_id, investor_id, date, symbol)
);

CREATE TABLE IF NOT EXISTS trades (
  run_id TEXT NOT NULL, investor_id TEXT NOT NULL, date TEXT NOT NULL, symbol TEXT NOT NULL,
  from_pos INTEGER NOT NULL, to_pos INTEGER NOT NULL, price REAL, cost REAL
);

CREATE TABLE IF NOT EXISTS equity_daily (
  run_id TEXT NOT NULL, investor_id TEXT NOT NULL, date TEXT NOT NULL,
  equity REAL NOT NULL, long_exp REAL, short_exp REAL,
  PRIMARY KEY (run_id, investor_id, date)
);

CREATE TABLE IF NOT EXISTS metrics (
  run_id         TEXT NOT NULL,
  investor_id    TEXT NOT NULL,
  segment        TEXT NOT NULL DEFAULT '_global',
  total_return   REAL NOT NULL,
  sharpe         REAL,
  max_dd         REAL,
  trades         INTEGER,
  pct_vs_monkeys REAL,
  dsr            REAL,
  PRIMARY KEY (run_id, investor_id, segment)
);

-- controles de suerte por corrida y segmento
CREATE TABLE IF NOT EXISTS monkey_stats (
  run_id TEXT NOT NULL, segment TEXT NOT NULL DEFAULT '_global',
  n INTEGER NOT NULL, seed INTEGER NOT NULL,
  p05 REAL, p50 REAL, p95 REAL, best_of_n_p95 REAL,
  PRIMARY KEY (run_id, segment)
);
-- Llamadas de consenso: cuando una mayoría clara de inversionistas coincide en un activo al cierre
-- de `date`. Se verifican con el cierre de la sesión siguiente. Es un registro del experimento
-- para su autor, no una señal para terceros.
CREATE TABLE IF NOT EXISTS calls (
  date          TEXT NOT NULL,          -- cierre en el que se decidió
  symbol        TEXT NOT NULL,
  direction     INTEGER NOT NULL,       -- 1 largo | −1 corto
  score         REAL NOT NULL,          -- (largos − cortos) / inversionistas, de −1 a 1
  n_long        INTEGER NOT NULL,
  n_short       INTEGER NOT NULL,
  n_total       INTEGER NOT NULL,
  entry_close   REAL,
  verified_date TEXT,                   -- sesión siguiente
  exit_close    REAL,
  ret           REAL,                   -- retorno de la llamada: direction × (exit/entry − 1)
  hit           INTEGER,                -- 1 si ret > 0
  PRIMARY KEY (date, symbol)
);
