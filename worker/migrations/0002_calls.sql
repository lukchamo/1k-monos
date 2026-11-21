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
