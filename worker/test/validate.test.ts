/** El JSON del LLM se valida contra la taxonomía cerrada antes de tocar ninguna señal. */
import { describe, expect, it } from "vitest";
import { validateNewsEvent } from "../src/news/validate";
import { loadJson } from "./helpers";

const events = loadJson<any[]>("shared/sample_events.json");

describe("validación NewsEvent v1", () => {
  it.each(events.map((e) => [e.content.title.slice(0, 50), e]))("válida: %s", (_t, ev) => {
    expect(validateNewsEvent(ev)).toEqual([]);
  });

  it("rechaza valores fuera de la taxonomía y rangos imposibles", () => {
    const bad = structuredClone(events[1]);
    bad.classification.event_type = "ceo_drama"; // no existe en tax-1.0
    bad.entities[0].sentiment = -1.4;
    bad.signal.horizon = "years";
    bad.content.summary_es = "x".repeat(401);
    const errs = validateNewsEvent(bad);
    expect(errs).toHaveLength(4);
    expect(errs.join(" ")).toMatch(/event_type.*ceo_drama/);
  });

  it("exige al menos una entidad y el bloque de extracción", () => {
    const bad = structuredClone(events[0]);
    bad.entities = [];
    delete bad.extraction;
    expect(validateNewsEvent(bad).length).toBe(2);
  });
});
