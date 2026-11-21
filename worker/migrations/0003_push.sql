-- Suscripciones a avisos del navegador (Web Push). Solo guarda lo que el navegador entrega para
-- poder enviarle un aviso: ni correo, ni nombre, ni IP.
CREATE TABLE IF NOT EXISTS push_subs (
  endpoint   TEXT PRIMARY KEY,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_ok    TEXT,
  fails      INTEGER NOT NULL DEFAULT 0
);
