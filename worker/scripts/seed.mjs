// Genera seed/prices.sql con los precios y las 9 noticias de la PoC para sembrar D1.
// Uso: node scripts/seed.mjs && npx wrangler d1 execute lab-inversionistas --local --file seed/prices.sql
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const files = ["prices_a.csv", "prices_b.csv", "prices_c.csv"].map((f) => new URL(`../../research/data/${f}`, import.meta.url));
const rows = files.flatMap((f) => readFileSync(f, "utf8").trim().split("\n").map((l) => l.split(",").slice(0, 3)));
const esc = (s) => `'${String(s).replace(/'/g, "''")}'`;
const out = ["DELETE FROM prices_daily;", "DELETE FROM market_days;"];
for (let i = 0; i < rows.length; i += 500) {
  const chunk = rows.slice(i, i + 500).map(([s, d, c]) => `(${esc(s)},${esc(d)},${Number(c)},'yahoo-firecrawl')`);
  out.push(`INSERT OR REPLACE INTO prices_daily (symbol, date, adj_close, source) VALUES ${chunk.join(",")};`);
}
const days = [...new Set(rows.filter(([s]) => s === "SPY").map(([, d]) => d))].sort();
for (let i = 0; i < days.length; i += 500)
  out.push(`INSERT OR REPLACE INTO market_days (date, status, missing, ingested_at) VALUES ${days.slice(i, i + 500).map((d) => `(${esc(d)},'complete','{}','seed')`).join(",")};`);
// noticias de la demo (9 reales, extraídas siguiendo el esquema)
const events = JSON.parse(readFileSync(new URL("../../shared/sample_events.json", import.meta.url), "utf8"));
out.push("DELETE FROM news_events;", "DELETE FROM news_entities;", "DELETE FROM news_tags;");
for (const ev of events) {
  const s = ev.signal, x = ev.extraction;
  out.push(`INSERT INTO news_events (event_id, published_at, effective_at, source_tier, event_type, direction, surprise, novelty, hype, uncertainty, horizon, taxonomy_version, prompt_version, model, json) VALUES (${[ev.event_id, ev.timing.published_at, ev.timing.effective_at, ev.source.tier, ev.classification.event_type, s.direction].map(esc).join(",")},${s.surprise},${s.novelty},${s.hype},${s.uncertainty},${[s.horizon, x.taxonomy_version, x.prompt_version, x.model, JSON.stringify(ev)].map(esc).join(",")});`);
  for (const e of ev.entities)
    out.push(`INSERT INTO news_entities (event_id, symbol, role, relevance, sentiment, confidence) VALUES (${esc(ev.event_id)},${esc(e.symbol)},${esc(e.role)},${e.relevance},${e.sentiment},${e.confidence});`);
}
mkdirSync(new URL("../seed/", import.meta.url), { recursive: true });
writeFileSync(new URL("../seed/prices.sql", import.meta.url), out.join("\n") + "\n");
console.log(`seed/prices.sql · ${rows.length} precios · ${days.length} sesiones · ${events.length} noticias`);
