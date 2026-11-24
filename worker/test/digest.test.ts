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

import { brokerBoard, moveInFavor, reading, renderFollowUp, voteBoard, type FollowUp } from "../src/digest-core";
import { neverless, neverlessLine, NEVERLESS } from "../src/brokers";
import { UNIVERSE } from "../src/engine/universe";

describe("Neverless · qué se puede operar", () => {
  it("cubre el universo salvo USO y FEZ, y no inventa símbolos", () => {
    expect(UNIVERSE.filter((s) => !neverless(s)).sort()).toEqual(["FEZ", "USO"]);
    for (const s of Object.keys(NEVERLESS)) expect(UNIVERSE).toContain(s);
  });
  it("da la sigla de la app y avisa cuando no es el mismo instrumento", () => {
    expect(neverless("ETH-USD")).toMatchObject({ ticker: "ETH", kind: "cripto" });
    expect(neverlessLine("GLD")).toMatch(/XAU.*Ojo/);
    expect(neverlessLine("SAN.MC")).toMatch(/ADR/);
    expect(neverlessLine("TLT")).toMatch(/catálogo web/);
    expect(neverlessLine("USO")).toMatch(/No está/);
  });
});

describe("tablero de votos y seguimiento", () => {
  const rows = [
    ...Array.from({ length: 6 }, () => ({ symbol: "ETH-USD", position: -1 })),
    ...Array.from({ length: 2 }, () => ({ symbol: "ETH-USD", position: 1 })),
    { symbol: "NVDA", position: 1 },
    { symbol: "NVDA", position: -1 },
    { symbol: "USO", position: 1 },
  ];
  const board = voteBoard(rows, { "ETH-USD": 1700, NVDA: 165 });
  it("ordena por acuerdo y describe el reparto sin aconsejar", () => {
    expect(board.map((v) => v.symbol)).toEqual(["USO", "ETH-USD", "NVDA"]);
    expect(reading(board[1])).toBe("mayoría en corto");
    expect(reading(board[2])).toBe("empate");
  });
  it("el tablero del bróker deja fuera lo que no está en Neverless", () => {
    expect(brokerBoard(board).map((v) => v.ticker)).toEqual(["ETH", "NVDA"]);
  });
  const f: FollowUp = {
    date: "2026-11-23",
    at: "2026-11-24T09:30:00.000Z",
    moment: "mañana",
    open: [
      { date: "2026-11-23", symbol: "ETH-USD", direction: -1, score: -0.29, n_long: 9, n_short: 17, n_total: 28, entry_close: 1700, now: 1615 },
      { date: "2026-11-23", symbol: "TLT", direction: 1, score: 0.25, n_long: 11, n_short: 4, n_total: 28, entry_close: 81.69, now: null },
    ],
    board,
  };
  it("mide el movimiento a favor de la dirección de la llamada", () => {
    expect(moveInFavor(f.open[0])).toBeCloseTo(0.05, 6);
    expect(moveInFavor(f.open[1])).toBeNull();
  });
  it("el correo dice que no hay decisiones nuevas y lleva el aviso", () => {
    const m = renderFollowUp(f, "https://lab.test");
    expect(m.subject).toContain("seguimiento 09:30 UTC");
    expect(m.text).toContain("No hay decisiones nuevas");
    expect(m.text).toContain("+5,0 % a favor");
    expect(m.text).toContain("sin precio");
    expect(m.html).toContain("No es una recomendación de inversión");
    expect(m.text).not.toMatch(/deberías|te recomiendo|compra ya/i);
  });
});
