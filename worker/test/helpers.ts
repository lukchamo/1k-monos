import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { buildPanel, parsePriceCsv, type Panel } from "../src/engine/panel";

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(here, "../..");

export function loadPanel(): Panel {
  const rows = ["prices_a.csv", "prices_b.csv", "prices_c.csv"].flatMap((f) =>
    parsePriceCsv(readFileSync(resolve(ROOT, "research/data", f), "utf8")),
  );
  return buildPanel(rows);
}

export function loadJson<T = any>(rel: string): T {
  return JSON.parse(readFileSync(resolve(ROOT, rel), "utf8"));
}

export const posString = (p: Float64Array) => Array.from(p, (x) => (x > 0 ? "+" : x < 0 ? "-" : "0")).join("");
