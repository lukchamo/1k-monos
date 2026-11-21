import assert from "node:assert/strict";
import { test } from "node:test";
import { advance, close, deposit, liquidationPrice, newAccount, open, OrderError, parseAccount, summary, type Rules } from "./paper.ts";

const FREE: Rules = { spreadPct: 0, borrowAnnual: 0, shortAnnual: 0, maxLeverage: 5, maintenance: 0.1, minOrder: 1 };
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test("largo sin apalancamiento: sube un 10 %, ganas un 10 % de lo invertido", () => {
  let a = open(newAccount(200), { symbol: "BTC-USD", side: 1, amount: 100, leverage: 1, date: "d0" }, { "BTC-USD": 50000 }, FREE);
  near(summary(a, { "BTC-USD": 55000 }).equity, 210);
  a = close(a, 1, { "BTC-USD": 55000 }, "d1", FREE);
  near(a.cash, 210);
  assert.equal(a.positions.length, 0);
  near(a.closed[0].pnl, 10);
});

test("corto: gana cuando baja, pierde cuando sube", () => {
  const a = open(newAccount(200), { symbol: "TSLA", side: -1, amount: 100, leverage: 1, date: "d0" }, { TSLA: 400 }, FREE);
  near(summary(a, { TSLA: 360 }).equity, 210);
  near(summary(a, { TSLA: 440 }).equity, 190);
});

test("con 5× el mismo movimiento pesa cinco veces", () => {
  const a = open(newAccount(200), { symbol: "NVDA", side: 1, amount: 100, leverage: 5, date: "d0" }, { NVDA: 100 }, FREE);
  near(summary(a, { NVDA: 102 }).equity, 210);
  near(summary(a, { NVDA: 102 }).exposure, 510);
});

test("no deja pasar del tope de apalancamiento de la cuenta", () => {
  const a = newAccount(200);
  assert.throws(() => open(a, { symbol: "X", side: 1, amount: 250, leverage: 5, date: "d" }, { X: 10 }, FREE), OrderError);
  assert.throws(() => open(a, { symbol: "X", side: 1, amount: 100, leverage: 6, date: "d" }, { X: 10 }, FREE), OrderError);
  assert.throws(() => open(a, { symbol: "X", side: 1, amount: 0, leverage: 1, date: "d" }, { X: 10 }, FREE), OrderError);
  assert.throws(() => open(a, { symbol: "X", side: 1, amount: 50, leverage: 1, date: "d" }, { X: null }, FREE), OrderError);
  assert.equal(open(a, { symbol: "X", side: 1, amount: 200, leverage: 5, date: "d" }, { X: 10 }, FREE).positions.length, 1);
});

test("el diferencial se paga mitad al abrir y mitad al cerrar", () => {
  const r = { ...FREE, spreadPct: 0.01 };
  let a = open(newAccount(200), { symbol: "X", side: 1, amount: 100, leverage: 1, date: "d0" }, { X: 10 }, r);
  near(a.cash, 199.5);
  a = close(a, 1, { X: 10 }, "d1", r);
  near(a.cash, 199);
  near(a.costs, 1);
});

test("los intereses solo se cobran sobre lo prestado y sobre los cortos", () => {
  const r = { ...FREE, borrowAnnual: 0.1, shortAnnual: 0.2 };
  const sin = advance(open(newAccount(200), { symbol: "X", side: 1, amount: 200, leverage: 1, date: "d0" }, { X: 10 }, r), { X: 10 }, "d1", 1, r);
  near(sin.costs, 0);
  const con = advance(open(newAccount(200), { symbol: "X", side: 1, amount: 200, leverage: 3, date: "d0" }, { X: 10 }, r), { X: 10 }, "d3", 3, r);
  near(con.costs, 400 * 0.1 * (3 / 365));
  const corto = advance(open(newAccount(200), { symbol: "X", side: -1, amount: 100, leverage: 1, date: "d0" }, { X: 10 }, r), { X: 10 }, "d1", 1, r);
  near(corto.costs, 100 * 0.2 * (1 / 365));
});

test("liquidación: con 5× una caída del 19 % cierra todo y el saldo no queda negativo", () => {
  let a = open(newAccount(200), { symbol: "X", side: 1, amount: 200, leverage: 5, date: "d0" }, { X: 100 }, FREE);
  a = advance(a, { X: 95 }, "d1", 1, FREE);
  assert.equal(a.liquidatedOn, null);
  a = advance(a, { X: 81 }, "d2", 1, FREE);
  assert.equal(a.liquidatedOn, "d2");
  assert.equal(a.positions.length, 0);
  assert.equal(a.closed[0].reason, "liquidación");
  assert.ok(a.cash >= 0 && a.cash < 20);
});

test("el precio de liquidación estimado coincide con la regla", () => {
  const prices = { X: 100 };
  const a = open(newAccount(200), { symbol: "X", side: 1, amount: 200, leverage: 5, date: "d0" }, prices, FREE);
  const lp = liquidationPrice({ ...a, positions: [] }, a.positions[0], prices, FREE)!;
  // en ese precio: patrimonio / invertido = 10 %
  const s = summary(a, { X: lp });
  near(s.equity / s.exposure, 0.1);
  assert.ok(lp > 80 && lp < 100);
});

test("añadir saldo sube el patrimonio y lo aportado", () => {
  const a = deposit(newAccount(200), 300);
  assert.equal(a.cash, 500);
  assert.equal(a.deposited, 500);
  assert.throws(() => deposit(a, -5), OrderError);
});

test("una cuenta guardada que no encaja se descarta", () => {
  assert.equal(parseAccount(null), null);
  assert.equal(parseAccount({ v: 2 }), null);
  assert.equal(parseAccount({ ...newAccount(), cash: "mucho" }), null);
  assert.equal(parseAccount({ ...newAccount(), positions: [{ symbol: "<script>", side: 1, size: 1, entry: 1, id: 1, openedOn: "d" }] }), null);
  assert.deepEqual(parseAccount(JSON.parse(JSON.stringify(newAccount(150, "USD")))), newAccount(150, "USD"));
});

test("precio de liquidación de una posición nueva: 5× largo ≈ −11 %, 5× corto ≈ +9 %, 1× largo no aplica", () => {
  const a = newAccount(50);
  const at = (side: 1 | -1, lev: number) => liquidationPrice(a, { side, size: 50 * lev, entry: 100 }, {}, FREE);
  near(at(1, 5)! / 100, 200 / 225);
  near(at(-1, 5)! / 100, 300 / 275);
  assert.equal(at(1, 1), null);
  assert.ok(at(-1, 1)! > 180); // un corto sin apalancamiento también se liquida si el precio casi se duplica
});
