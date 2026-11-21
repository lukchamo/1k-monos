// Genera data/snapshot.json desde la API del laboratorio. La web lo usa como respaldo cuando la
// API no responde (y durante el build), y siempre lo marca en pantalla como "foto", no como dato vivo.
// Uso: LAB_API_URL=http://localhost:8787 node scripts/snapshot.mjs
import { writeFileSync } from "node:fs";

const base = process.env.LAB_API_URL ?? "http://localhost:8787";
const res = await fetch(`${base}/v1/lab`);
if (!res.ok) throw new Error(`/v1/lab → ${res.status}`);
const d = await res.json();
const round = (o) => JSON.parse(JSON.stringify(o, (_, v) => (typeof v === "number" && !Number.isInteger(v) ? Math.round(v * 1e5) / 1e5 : v)));
const { aviso: _aviso, ...rest } = d;
writeFileSync(new URL("../data/snapshot.json", import.meta.url), JSON.stringify(round({ taken_at: d.status.now, ...rest })));
console.log(`snapshot · ${d.ranking.rows.length} inversionistas · ${d.curves.dates.length} sesiones · ${d.news.length} noticias`);
