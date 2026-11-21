import assert from "node:assert/strict";
import { test } from "node:test";
import { BROKERS, monkeyPositions, simulate, type Fees } from "./sim.ts";

const FREE: Fees = { commissionPct: 0, commissionFixed: 0, spreadPct: 0, fxPct: 0, borrowAnnual: 0, shortAnnual: 0, minOrder: 0 };
const dates = ["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08"];

test("un activo que sube un 10 % al día, en largo y sin costes", () => {
  const r = simulate({ dates, closes: [[100, 110, 121, 133.1]], positions: [[1, 1, 1, 1]], capital: 200, leverage: 1, fees: FREE });
  assert.equal(r.days[0].equity, 200);
  assert.ok(Math.abs(r.days[3].equity - 266.2) < 1e-9);
  assert.equal(r.orders, 1);
  assert.equal(r.costs.total, 0);
});

test("en corto gana cuando el precio cae y pierde cuando sube", () => {
  const down = simulate({ dates, closes: [[100, 90, 90, 90]], positions: [[-1, -1, -1, -1]], capital: 200, leverage: 1, fees: FREE });
  assert.ok(Math.abs(down.days[1].equity - 220) < 1e-9);
  const up = simulate({ dates, closes: [[100, 110, 110, 110]], positions: [[-1, -1, -1, -1]], capital: 200, leverage: 1, fees: FREE });
  assert.ok(Math.abs(up.days[1].equity - 180) < 1e-9);
});

test("el apalancamiento multiplica ganancias y pérdidas", () => {
  const x1 = simulate({ dates, closes: [[100, 105, 105, 105]], positions: [[1, 1, 1, 1]], capital: 200, leverage: 1, fees: FREE });
  const x3 = simulate({ dates, closes: [[100, 105, 105, 105]], positions: [[1, 1, 1, 1]], capital: 200, leverage: 3, fees: FREE });
  assert.ok(Math.abs(x1.days[1].equity - 210) < 1e-9);
  assert.ok(Math.abs(x3.days[1].equity - 230) < 1e-9);
});

test("con 5× una caída del 20 % liquida la cuenta; sin apalancamiento no", () => {
  const closes = [[100, 80, 80, 80]];
  const x5 = simulate({ dates, closes, positions: [[1, 1, 1, 1]], capital: 200, leverage: 5, fees: FREE });
  assert.equal(x5.liquidatedOn, "2026-01-06");
  assert.equal(x5.days[3].equity, 0);
  const x1 = simulate({ dates, closes, positions: [[1, 1, 1, 1]], capital: 200, leverage: 1, fees: FREE });
  assert.equal(x1.liquidatedOn, null);
});

test("la comisión fija se cobra por orden y solo cuando cambia la decisión", () => {
  const r = simulate({ dates, closes: [[100, 100, 100, 100]], positions: [[1, 1, 0, 1]], capital: 200, leverage: 1, fees: { ...FREE, commissionFixed: 1 } });
  assert.equal(r.orders, 3); // entra, sale, vuelve a entrar
  assert.ok(Math.abs(r.costs.commission - 3) < 1e-9);
  assert.ok(Math.abs(r.days[3].equity - 197) < 1e-9);
  assert.ok(r.days[3].gross === 200);
});

test("las órdenes por debajo del mínimo no se ejecutan", () => {
  const closes = Array.from({ length: 23 }, () => [100, 100, 100, 100]);
  const positions = Array.from({ length: 23 }, () => [1, 1, 1, 1]);
  const r = simulate({ dates, closes, positions, capital: 200, leverage: 1, fees: { ...FREE, minOrder: 10 } }); // 200/23 = 8,70 € por activo
  assert.equal(r.orders, 0);
  assert.equal(r.skipped, 23);
});

test("los intereses cuentan los días naturales, fin de semana incluido", () => {
  const d = ["2026-01-09", "2026-01-12"]; // viernes a lunes: 3 días
  const r = simulate({ dates: d, closes: [[100, 100]], positions: [[1, 1]], capital: 200, leverage: 3, fees: { ...FREE, borrowAnnual: 0.1 } });
  assert.ok(Math.abs(r.costs.financing - 400 * 0.1 * (3 / 365)) < 1e-9);
});

test("es determinístico y el mono depende solo de su semilla", () => {
  assert.deepEqual(monkeyPositions(3, 20, 7), monkeyPositions(3, 20, 7));
  assert.notDeepEqual(monkeyPositions(3, 20, 7), monkeyPositions(3, 20, 8));
  for (const row of monkeyPositions(5, 30, 1)) for (const v of row) assert.ok(v === -1 || v === 0 || v === 1);
});

test("ningún perfil de bróker tiene costes negativos", () => {
  for (const b of BROKERS) for (const v of Object.values(b.fees)) assert.ok(v >= 0);
});
