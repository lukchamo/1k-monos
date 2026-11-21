/**
 * POINT-IN-TIME: ninguna regla puede usar un dato posterior a su instante de decisión.
 * Prueba: correr el laboratorio con los precios cortados en la fecha t debe dar, en t, exactamente
 * la misma posición que con todos los precios. Si el futuro se cuela, este test lo detecta.
 */
import { describe, expect, it } from "vitest";
import { contextFromPanel, LINEUP, runLab } from "../src/engine/registry";
import { truncatePanel } from "../src/engine/panel";
import { loadPanel } from "./helpers";

const START = "2025-11-20";
const END = "2026-11-20";
const panel = loadPanel();
const full = runLab(contextFromPanel(panel), { start: START, end: END, monkeys: 0 });
const cuts = ["2026-02-13", "2026-06-12", "2026-09-30", "2026-11-13"];

describe.each(cuts)("corte en %s", (asOf) => {
  const cut = truncatePanel(panel, asOf);
  const t = cut.dates.length - 1;
  const part = runLab(contextFromPanel(cut), { start: START, end: asOf, monkeys: 0 });

  it.each(LINEUP.map((s) => s.name))("%s decide igual sin ver el futuro", (name) => {
    const a = full.investors[name].positions.map((p) => p[t]);
    const b = part.investors[name].positions.map((p) => p[t]);
    expect(b).toEqual(a);
  });
});
