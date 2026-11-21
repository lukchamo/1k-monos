/**
 * Cuenta de práctica con dinero ficticio: añades saldo, abres posiciones en largo o en corto con o
 * sin apalancamiento y las cierras cuando quieras. Imita una cuenta de margen como la de Neverless:
 * todo tu patrimonio respalda todas las posiciones a la vez.
 *
 * Puro y determinístico: cada operación devuelve una cuenta nueva. No toca la red ni el reloj.
 */

export interface Rules {
  /** diferencial compra-venta, ida y vuelta; se paga la mitad al abrir y la mitad al cerrar */
  spreadPct: number;
  /** interés anual del dinero prestado (lo invertido en largo que excede tu patrimonio) */
  borrowAnnual: number;
  /** coste anual de mantener cortos */
  shortAnnual: number;
  /** tope de apalancamiento de la cuenta: invertido ≤ patrimonio × maxLeverage */
  maxLeverage: number;
  /** si patrimonio / invertido cae por debajo de esto, el bróker cierra todo */
  maintenance: number;
  minOrder: number;
}

/** Neverless publica comisión 0 y hasta 5×. Diferencial, intereses y margen de mantenimiento son supuestos. */
export const NEVERLESS_RULES: Rules = { spreadPct: 0.001, borrowAnnual: 0.08, shortAnnual: 0.08, maxLeverage: 5, maintenance: 0.1, minOrder: 1 };

export interface Position {
  id: number;
  symbol: string;
  side: 1 | -1;
  /** importe de la posición al abrirla (tu dinero × apalancamiento) */
  size: number;
  entry: number;
  openedOn: string;
  leverage: number;
}
export interface Closed extends Position {
  exit: number;
  closedOn: string;
  pnl: number; // resultado neto, con el diferencial de salida
  reason: "manual" | "liquidación";
}
export interface Account {
  v: 1;
  currency: "EUR" | "USD";
  cash: number; // saldo: lo aportado más todo lo ganado o perdido ya cerrado, menos costes
  deposited: number;
  costs: number; // diferencial e intereses pagados
  nextId: number;
  positions: Position[];
  closed: Closed[];
  liquidatedOn: string | null;
}

export type Prices = Record<string, number | null | undefined>;

export const newAccount = (deposit = 200, currency: Account["currency"] = "EUR"): Account => ({
  v: 1,
  currency,
  cash: deposit,
  deposited: deposit,
  costs: 0,
  nextId: 1,
  positions: [],
  closed: [],
  liquidatedOn: null,
});

/** valor actual de una posición y lo que gana o pierde */
export function mark(p: Position, price: number | null | undefined) {
  const px = price ?? p.entry;
  const notional = p.size * (px / p.entry);
  return { notional, pnl: p.side * (notional - p.size), price: px };
}

export function summary(a: Account, prices: Prices) {
  let pnl = 0;
  let exposure = 0;
  let longs = 0;
  let shorts = 0;
  for (const p of a.positions) {
    const m = mark(p, prices[p.symbol]);
    pnl += m.pnl;
    exposure += m.notional;
    if (p.side > 0) longs += m.notional;
    else shorts += m.notional;
  }
  const equity = a.cash + pnl;
  return {
    equity, // patrimonio: saldo más lo que ganan o pierden las posiciones abiertas
    pnl,
    exposure, // invertido: suma del valor de todas las posiciones
    longs,
    shorts,
    /** cuánto más puedes abrir antes de tocar el tope de apalancamiento */
    buyingPower: Math.max(0, equity * 5 - exposure),
    leverage: equity > 0 ? exposure / equity : 0,
    result: equity - a.deposited,
  };
}

const es = (v: number) => v.toFixed(2).replace(".", ",");

export class OrderError extends Error {}

export function deposit(a: Account, amount: number): Account {
  if (!(amount > 0) || amount > 1_000_000) throw new OrderError("Importe no válido.");
  return { ...a, cash: a.cash + amount, deposited: a.deposited + amount };
}

/** abre una posición: `amount` es tu dinero y `leverage` lo multiplica */
export function open(a: Account, o: { symbol: string; side: 1 | -1; amount: number; leverage: number; date: string }, prices: Prices, r: Rules): Account {
  const price = prices[o.symbol];
  if (!price) throw new OrderError("Este activo no cotiza en esta fecha.");
  if (!(o.amount > 0)) throw new OrderError("Escribe un importe mayor que cero.");
  if (!(o.leverage >= 1 && o.leverage <= r.maxLeverage)) throw new OrderError(`El apalancamiento va de 1× a ${r.maxLeverage}×.`);
  const size = o.amount * o.leverage;
  if (size < r.minOrder) throw new OrderError(`La orden mínima es de ${r.minOrder}.`);
  const s = summary(a, prices);
  if (s.equity <= 0) throw new OrderError("No queda patrimonio en la cuenta. Añade saldo.");
  if (s.exposure + size > s.equity * r.maxLeverage + 1e-9)
    throw new OrderError(`No alcanza: con tu patrimonio puedes tener invertido hasta ${es(s.equity * r.maxLeverage)} y ya tienes ${es(s.exposure)}.`);
  const cost = size * (r.spreadPct / 2);
  return {
    ...a,
    cash: a.cash - cost,
    costs: a.costs + cost,
    nextId: a.nextId + 1,
    positions: [...a.positions, { id: a.nextId, symbol: o.symbol, side: o.side, size, entry: price, openedOn: o.date, leverage: o.leverage }],
  };
}

function settle(a: Account, p: Position, price: number, date: string, r: Rules, reason: Closed["reason"]): Account {
  const m = mark(p, price);
  const cost = m.notional * (r.spreadPct / 2);
  const pnl = m.pnl - cost;
  return {
    ...a,
    cash: a.cash + pnl,
    costs: a.costs + cost,
    positions: a.positions.filter((x) => x.id !== p.id),
    closed: [{ ...p, exit: price, closedOn: date, pnl, reason }, ...a.closed].slice(0, 200),
  };
}

export function close(a: Account, id: number, prices: Prices, date: string, r: Rules): Account {
  const p = a.positions.find((x) => x.id === id);
  if (!p) throw new OrderError("Esa posición ya no está abierta.");
  return settle(a, p, prices[p.symbol] ?? p.entry, date, r, "manual");
}

/**
 * Pasa el tiempo de un cierre al siguiente: se cobran los intereses de esos días naturales y, si el
 * patrimonio ya no cubre el margen mínimo, el bróker cierra todas las posiciones.
 */
export function advance(a: Account, prices: Prices, date: string, calendarDays: number, r: Rules): Account {
  if (!a.positions.length) return a;
  const s = summary(a, prices);
  const borrowed = Math.max(0, s.longs - s.equity);
  const interest = (borrowed * r.borrowAnnual + s.shorts * r.shortAnnual) * (Math.max(1, calendarDays) / 365);
  let next: Account = interest > 0 ? { ...a, cash: a.cash - interest, costs: a.costs + interest } : a;
  const after = summary(next, prices);
  if (after.exposure > 0 && (after.equity <= 0 || after.equity / after.exposure < r.maintenance)) {
    for (const p of next.positions) next = settle(next, p, prices[p.symbol] ?? p.entry, date, r, "liquidación");
    next = { ...next, cash: Math.max(0, next.cash), liquidatedOn: date };
  }
  return next;
}

/** precio al que esta posición, ella sola, dejaría la cuenta en el margen mínimo (aproximado) */
export function liquidationPrice(a: Account, p: Pick<Position, "side" | "size" | "entry">, prices: Prices, r: Rules, extra = 0): number | null {
  const s = summary(a, prices);
  // patrimonio y exposición del resto se suponen quietos; se resuelve para el precio de esta posición
  const equity0 = s.equity;
  const others = s.exposure;
  // equity(x) = equity0 + side·size·(x−1); exposure(x) = others + size·x; equity = m·exposure
  const denom = p.side * p.size - r.maintenance * p.size;
  if (Math.abs(denom) < 1e-12) return null;
  const x = (r.maintenance * (others + extra) - equity0 + p.side * p.size) / denom;
  if (!Number.isFinite(x) || x <= 0) return null;
  if ((p.side > 0 && x >= 1) || (p.side < 0 && x <= 1)) return null; // ya estaría liquidada
  return p.entry * x;
}

/** lectura segura de una cuenta guardada en el navegador: si no encaja, se descarta */
export function parseAccount(raw: unknown): Account | null {
  const a = raw as Account | null;
  if (!a || typeof a !== "object" || a.v !== 1) return null;
  const num = (x: unknown) => typeof x === "number" && Number.isFinite(x);
  if (!num(a.cash) || !num(a.deposited) || !num(a.costs) || !num(a.nextId) || !Array.isArray(a.positions) || !Array.isArray(a.closed)) return null;
  if (a.currency !== "EUR" && a.currency !== "USD") return null;
  const okPos = (p: Position) => p && typeof p.symbol === "string" && /^[A-Z0-9.^=-]{1,12}$/.test(p.symbol) && (p.side === 1 || p.side === -1) && num(p.size) && p.size > 0 && num(p.entry) && p.entry > 0 && num(p.id) && typeof p.openedOn === "string";
  if (a.positions.length > 100 || !a.positions.every(okPos) || !a.closed.every((c) => okPos(c) && num(c.pnl) && num(c.exit))) return null;
  return { v: 1, currency: a.currency, cash: a.cash, deposited: a.deposited, costs: a.costs, nextId: a.nextId, positions: a.positions, closed: a.closed.slice(0, 200), liquidatedOn: typeof a.liquidatedOn === "string" ? a.liquidatedOn : null };
}
