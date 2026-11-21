import { describe, expect, it } from "vitest";
import { backtestParams, BadInput, cleanText, readJson, safeUrl, soundsLikeAdvice, tokenOk, v } from "../src/guard";

const req = (headers: Record<string, string>, body?: string) => new Request("https://lab.test/x", { method: "POST", headers, body });

describe("guardarraíles · validación", () => {
  it("símbolos por lista blanca de caracteres", () => {
    expect(v.symbol("nvda")).toBe("NVDA");
    expect(v.symbol("BTC-USD")).toBe("BTC-USD");
    expect(v.symbol("^VIX")).toBe("^VIX");
    for (const bad of ["", "NVDA'; DROP TABLE prices_daily;--", "../etc", "A".repeat(13), "NV DA", "<script>", null, 7])
      expect(() => v.symbol(bad)).toThrow(BadInput);
  });
  it("fechas reales y en rango", () => {
    expect(v.date("2026-11-20")).toBe("2026-11-20");
    for (const bad of ["2026-13-01", "2026-02-30", "20261120", "1999-01-01", "2026-11-20T00:00", "' OR 1=1"]) expect(() => v.date(bad)).toThrow(BadInput);
  });
  it("enteros acotados", () => {
    expect(v.int(undefined, "n", 1, 10, 5)).toBe(5);
    expect(v.int("7", "n", 1, 10, 5)).toBe(7);
    for (const bad of ["11", "0", "1.5", "abc", "1e9"]) expect(() => v.int(bad, "n", 1, 10, 5)).toThrow(BadInput);
  });
  it("backtest: rango y monos acotados", () => {
    expect(backtestParams({ start: "2025-11-20", end: "2026-11-20" })).toEqual({ start: "2025-11-20", end: "2026-11-20", monkeys: 2000, seed: 7 });
    expect(() => backtestParams({ start: "2026-11-20", end: "2025-11-20" })).toThrow(BadInput);
    expect(() => backtestParams({ start: "2015-01-01", end: "2026-11-20" })).toThrow(BadInput);
    expect(() => backtestParams({ start: "2025-11-20", end: "2026-11-20", monkeys: 1_000_000 })).toThrow(BadInput);
  });
});

describe("guardarraíles · token", () => {
  it("solo autoriza el token exacto y nunca un secreto ausente o corto", async () => {
    const secret = "un-secreto-largo-de-verdad-123";
    expect(await tokenOk(req({ authorization: `Bearer ${secret}` }), secret)).toBe(true);
    expect(await tokenOk(req({ authorization: `Bearer ${secret}x` }), secret)).toBe(false);
    expect(await tokenOk(req({ authorization: secret }), secret)).toBe(false);
    expect(await tokenOk(req({}), secret)).toBe(false);
    expect(await tokenOk(req({ authorization: "Bearer undefined" }), undefined)).toBe(false);
    expect(await tokenOk(req({ authorization: "Bearer corto" }), "corto")).toBe(false);
  });
});

describe("guardarraíles · cuerpo", () => {
  it("exige JSON y corta por tamaño real", async () => {
    expect(await readJson(req({ "content-type": "application/json" }, '{"a":1}'))).toEqual({ a: 1 });
    await expect(readJson(req({ "content-type": "text/plain" }, "{}"))).rejects.toThrow(BadInput);
    await expect(readJson(req({ "content-type": "application/json" }, "{mal"))).rejects.toThrow(BadInput);
    await expect(readJson(req({ "content-type": "application/json" }, JSON.stringify({ a: "x".repeat(20_000) })))).rejects.toThrow(BadInput);
  });
});

describe("guardarraíles · contenido de terceros", () => {
  it("limpia caracteres invisibles y etiquetas", () => {
    expect(cleanText("Hola​ <b>mundo</b>‮\u0000", 50)).toBe("Hola mundo");
    expect(cleanText("x".repeat(500), 10)).toHaveLength(10);
  });
  it("solo URLs http(s) públicas", () => {
    expect(safeUrl("https://www.reuters.com/a")).toBe("https://www.reuters.com/a");
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "http://localhost/x", "http://169.254.169.254/latest", "https://user:pw@evil.com", "http://[::1]/", "nope"])
      expect(safeUrl(bad)).toBeNull();
  });
  it("detecta resúmenes que suenan a consejo", () => {
    expect(soundsLikeAdvice("Nvidia cae un 5 % tras los resultados.")).toBe(false);
    expect(soundsLikeAdvice("Compra ya acciones de Nvidia, rentabilidad garantizada.")).toBe(true);
    expect(soundsLikeAdvice("You should buy this stock now")).toBe(true);
  });
});
