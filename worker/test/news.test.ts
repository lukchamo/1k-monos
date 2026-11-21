/** Paridad del scoring de noticias con research/build_news.py y reglas de tiempo. */
import { describe, expect, it } from "vitest";
import { effectiveAt, impact, lector, nyseOpenUtc, pressure } from "../src/news/scoring";
import type { NewsEvent } from "../src/news/types";
import { loadJson, loadPanel } from "./helpers";

const G = loadJson("shared/golden/news.golden.json");
const events = loadJson<NewsEvent[]>("shared/sample_events.json");
const sessions = [...loadPanel().dates, "2026-11-23", "2026-11-24"];

describe("tiempo", () => {
  it("effective_at recalculado por el Worker = el de la referencia", () => {
    for (const ev of events) {
      const eff = effectiveAt(ev.timing.published_at, ev.timing.time_known, sessions);
      expect(eff.toISOString().replace(".000Z", "Z")).toBe(G.effective_at[ev.event_id]);
    }
  });

  it("la noticia de Reuters del viernes 20-nov a las 22:00 no existe hasta el lunes a la apertura", () => {
    const ev = events.find((e) => e.timing.published_at === "2026-11-20T22:00:00Z")!;
    const ent = ev.entities[0];
    expect(impact(ev, ent, new Date("2026-11-23T14:29:59Z"))).toBe(0);
    expect(impact(ev, ent, new Date("2026-11-23T14:30:00Z"))).not.toBe(0);
  });

  it("apertura de NYSE con horario de verano de EE. UU.", () => {
    expect(nyseOpenUtc("2026-07-15").toISOString()).toBe("2026-07-15T13:30:00.000Z");
    expect(nyseOpenUtc("2026-11-02").toISOString()).toBe("2026-11-02T14:30:00.000Z"); // el horario de verano acabó el 1-nov
    expect(nyseOpenUtc("2026-03-09").toISOString()).toBe("2026-03-09T13:30:00.000Z"); // empezó el 8-mar
  });
});

describe("presión", () => {
  it("misma presión que la referencia en 76 instantes × todos los activos", () => {
    for (const [iso, bySym] of Object.entries<Record<string, number>>(G.pressure)) {
      for (const [sym, want] of Object.entries(bySym)) {
        expect(pressure(events, sym, new Date(iso)), `${sym} @ ${iso}`).toBeCloseTo(want, 12);
      }
    }
  });

  it("la renuncia de Huang llevó la presión de NVDA a −0,57 al cierre del 13-nov: El Lector corto", () => {
    const p = pressure(events, "NVDA", new Date("2026-11-13T21:00:00Z"));
    expect(p).toBeCloseTo(-0.57, 2);
    expect(lector(p)).toBe(-1);
  });
});
