import { describe, expect, it } from "vitest";
import { pickCalls, renderDigest, type Digest } from "../src/digest-core";

const rows = (symbol: string, long: number, short: number, flat: number) => [
  ...Array.from({ length: long }, () => ({ symbol, position: 1 })),
  ...Array.from({ length: short }, () => ({ symbol, position: -1 })),
  ...Array.from({ length: flat }, () => ({ symbol, position: 0 })),
];

describe("resumen · llamadas de consenso", () => {
  it("solo llama cuando hay mayoría neta clara", () => {
    const calls = pickCalls("2026-11-20", [...rows("NVDA", 20, 4, 4), ...rows("SPY", 10, 9, 9), ...rows("TLT", 2, 22, 4)], { NVDA: 125.5, TLT: 88 });
    expect(calls.map((c) => [c.symbol, c.direction])).toEqual([["TLT", -1], ["NVDA", 1]]);
    expect(calls[1]).toMatchObject({ n_long: 20, n_short: 4, n_total: 28, entry_close: 125.5 });
  });
  it("es determinística: mismo resultado sea cual sea el orden de entrada", () => {
    const a = [...rows("NVDA", 20, 0, 8), ...rows("MSFT", 20, 0, 8), ...rows("AMD", 20, 0, 8)];
    expect(pickCalls("d", a, {})).toEqual(pickCalls("d", [...a].reverse(), {}));
    expect(pickCalls("d", a, {}).map((c) => c.symbol)).toEqual(["AMD", "MSFT", "NVDA"]);
  });
  it("nunca más de cinco", () => {
    const many = "ABCDEFGHIJ".split("").flatMap((s) => rows(s, 28, 0, 0));
    expect(pickCalls("d", many, {})).toHaveLength(5);
  });
});

describe("resumen · correo", () => {
  const d: Digest = {
    date: "2026-11-20",
    calls: [{ date: "2026-11-20", symbol: "NVDA", direction: 1, score: 0.6, n_long: 20, n_short: 3, n_total: 28, entry_close: 125.5 }],
    verified: [{ date: "2026-11-19", symbol: "TLT", direction: -1, score: -0.7, n_long: 2, n_short: 22, n_total: 28, entry_close: 90, verified_date: "2026-11-20", exit_close: 88, ret: 0.0222, hit: 1 }],
    record: { total: 1, hits: 1, avg_ret: 0.0222 },
  };
  it("dice qué se analizó, en qué dirección y cómo quedó lo anterior", () => {
    const m = renderDigest(d, "https://lab.test");
    expect(m.subject).toContain("NVDA en largo");
    expect(m.text).toContain("Mira Luis");
    expect(m.text).toContain("Analizamos NVDA: posición en largo");
    expect(m.text).toContain("TLT en corto (2026-11-19): +2,2 % → acertó");
    expect(m.text).toContain("No es una recomendación de inversión");
  });
  it("escapa el HTML de lo que no controla", () => {
    const m = renderDigest({ ...d, calls: [{ ...d.calls[0], symbol: "<b>X" }] }, "https://lab.test");
    expect(m.html).not.toContain("<b>X");
  });
});
