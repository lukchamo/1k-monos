/**
 * Simulador de cartera con dinero ficticio. Sigue día a día las posiciones de un inversionista
 * (o de un mono) y descuenta lo que cobraría un bróker: comisión, diferencial, cambio de divisa
 * e intereses del apalancamiento y de los cortos.
 *
 * Es puro y determinístico: mismas entradas, mismo resultado. No usa la hora ni el azar
 * (el mono recibe su semilla). Vive en la web: no forma parte del motor del laboratorio.
 */

export interface Fees {
  /** comisión por orden, como fracción del importe operado (0,001 = 0,1 %) */
  commissionPct: number;
  /** comisión fija por orden, en euros */
  commissionFixed: number;
  /** diferencial entre compra y venta, ida y vuelta, como fracción; se paga la mitad en cada orden */
  spreadPct: number;
  /** comisión de cambio de divisa sobre el importe operado en activos que no cotizan en euros */
  fxPct: number;
  /** interés anual sobre el dinero prestado para apalancarse */
  borrowAnnual: number;
  /** coste anual de mantener una posición en corto */
  shortAnnual: number;
  /** importe mínimo de una orden, en euros; por debajo no se ejecuta */
  minOrder: number;
}

export interface SimInput {
  dates: string[];
  /** cierres por activo y día; null si ese día no cotiza */
  closes: (number | null)[][];
  /** posición decidida al cierre de cada día: −1 corto, 0 fuera, 1 largo */
  positions: number[][];
  capital: number;
  leverage: number;
  fees: Fees;
}

export interface SimDay {
  date: string;
  equity: number;
  /** la misma cartera sin ningún coste, para ver cuánto se comen las comisiones */
  gross: number;
  exposure: number; // importe total invertido (largos + cortos), en euros
  /** costes pagados desde el primer día hasta este */
  paid: number;
  orders: number;
}

export interface SimResult {
  days: SimDay[];
  costs: { commission: number; spread: number; fx: number; financing: number; total: number };
  orders: number;
  skipped: number; // órdenes que no llegaron al mínimo
  liquidatedOn: string | null;
  /** importe por activo al final de cada día (para el panel de posiciones) */
  holdings: number[][];
}

const DAY_MS = 86_400_000;

export function simulate(input: SimInput): SimResult {
  const { dates, closes, positions, capital, fees } = input;
  const L = Math.max(1, input.leverage);
  const nA = closes.length;
  const nT = dates.length;
  const hold = new Array<number>(nA).fill(0); // importe actual por activo (con signo)
  const costs = { commission: 0, spread: 0, fx: 0, financing: 0, total: 0 };
  const days: SimDay[] = [];
  const holdings: number[][] = [];
  let equity = capital;
  let gross = capital; // cartera gemela sin costes
  const holdGross = new Array<number>(nA).fill(0);
  let orders = 0;
  let skipped = 0;
  let liquidatedOn: string | null = null;
  const skippedSign = new Array<number>(nA).fill(0); // para contar una vez cada orden que no llegó al mínimo

  for (let t = 0; t < nT; t++) {
    // 1) el mercado se mueve de t−1 a t: las posiciones abiertas ganan o pierden
    if (t > 0) {
      const calendarDays = Math.max(1, Math.round((Date.parse(dates[t]) - Date.parse(dates[t - 1])) / DAY_MS));
      let longs = 0;
      let shorts = 0;
      for (let a = 0; a < nA; a++) {
        const p0 = closes[a][t - 1];
        const p1 = closes[a][t];
        const r = p0 && p1 ? p1 / p0 - 1 : 0;
        if (hold[a] !== 0) {
          equity += hold[a] * r;
          hold[a] *= 1 + r;
          if (hold[a] > 0) longs += hold[a];
          else shorts -= hold[a];
        }
        if (holdGross[a] !== 0) {
          gross += holdGross[a] * r;
          holdGross[a] *= 1 + r;
        }
      }
      // 2) intereses: por el dinero prestado y por los cortos, por días naturales (el fin de semana también cuenta)
      const borrowed = Math.max(0, longs - equity);
      const fin = (borrowed * fees.borrowAnnual + shorts * fees.shortAnnual) * (calendarDays / 365);
      if (fin > 0) {
        equity -= fin;
        costs.financing += fin;
      }
    }

    // 3) liquidación: sin apalancamiento no aplica; con él, el bróker cierra todo cuando el colchón se agota
    const exposureNow = hold.reduce((s, h) => s + Math.abs(h), 0);
    if (!liquidatedOn && (equity <= 0 || (L > 1 && exposureNow > 0 && equity / exposureNow < 1 / (2 * L)))) {
      liquidatedOn = dates[t];
      equity = equity < 1e-6 ? 0 : equity; // lo que quede tras cerrar todo; nunca negativo
      hold.fill(0);
    }

    // 4) al cierre de t se ajusta la cartera a lo que decide el inversionista
    let dayOrders = 0;
    if (!liquidatedOn) {
      const slice = (equity * L) / nA; // cada activo recibe la misma porción del capital
      const sliceGross = (gross * L) / nA;
      for (let a = 0; a < nA; a++) {
        const tradable = closes[a][t] != null;
        const target = tradable ? positions[a][t] * slice : 0;
        const delta = Math.abs(target - hold[a]);
        if (tradable) holdGross[a] = positions[a][t] * sliceGross;
        // solo se opera cuando cambia la decisión, no para reequilibrar céntimos cada día
        const changed = Math.sign(target) !== Math.sign(hold[a]);
        if (!tradable || !changed) continue;
        if (delta < fees.minOrder) {
          if (delta > 0 && skippedSign[a] !== Math.sign(target)) {
            skipped++;
            skippedSign[a] = Math.sign(target);
          }
          continue;
        }
        skippedSign[a] = 0;
        const commission = delta * fees.commissionPct + fees.commissionFixed;
        const spread = delta * (fees.spreadPct / 2);
        const fx = delta * fees.fxPct;
        equity -= commission + spread + fx;
        costs.commission += commission;
        costs.spread += spread;
        costs.fx += fx;
        hold[a] = target;
        dayOrders++;
      }
      orders += dayOrders;
    }

    days.push({ date: dates[t], equity: Math.max(0, equity), gross, exposure: hold.reduce((s, h) => s + Math.abs(h), 0), paid: costs.commission + costs.spread + costs.fx + costs.financing, orders: dayOrders });
    holdings.push(hold.slice());
  }
  costs.total = costs.commission + costs.spread + costs.fx + costs.financing;
  return { days, costs, orders, skipped, liquidatedOn, holdings };
}

/** generador con semilla (mulberry32), el mismo tipo que usan los monos del laboratorio */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** un mono: cada semana tira una moneda de tres caras por activo (largo, corto o fuera) */
export function monkeyPositions(nAssets: number, nDays: number, seed: number, holdDays = 5): number[][] {
  const rnd = mulberry32(seed);
  const out: number[][] = Array.from({ length: nAssets }, () => new Array<number>(nDays).fill(0));
  for (let t = 0; t < nDays; t++)
    for (let a = 0; a < nAssets; a++) out[a][t] = t % holdDays === 0 ? Math.floor(rnd() * 3) - 1 : out[a][t - 1];
  return out;
}

export interface Broker {
  id: string;
  name: string;
  note: string;
  maxLeverage: number;
  fees: Fees;
}

/**
 * Perfiles de costes. De Neverless solo son públicos la comisión cero, el cambio de divisa gratis y
 * el máximo de 5×; su diferencial y el interés del apalancamiento no están publicados, así que esos
 * dos valores son supuestos y se pueden editar en pantalla. Los demás perfiles son genéricos.
 */
export const BROKERS: Broker[] = [
  {
    id: "neverless",
    name: "Neverless",
    note: "Comisión 0 y cambio de divisa 0 según su web (nov-2026). Diferencial e intereses: supuestos, no los publica.",
    maxLeverage: 5,
    fees: { commissionPct: 0, commissionFixed: 0, spreadPct: 0.001, fxPct: 0, borrowAnnual: 0.08, shortAnnual: 0.08, minOrder: 1 },
  },
  {
    id: "fijo",
    name: "Bróker con comisión fija",
    note: "Genérico: 1 € por orden y 0,5 % de cambio de divisa. Con poco capital, la comisión fija pesa mucho.",
    maxLeverage: 1,
    fees: { commissionPct: 0, commissionFixed: 1, spreadPct: 0.0005, fxPct: 0.005, borrowAnnual: 0, shortAnnual: 0.03, minOrder: 1 },
  },
  {
    id: "cfd",
    name: "Bróker de CFD",
    note: "Genérico: sin comisión, diferencial más ancho e interés diario por mantener posiciones apalancadas.",
    maxLeverage: 5,
    fees: { commissionPct: 0, commissionFixed: 0, spreadPct: 0.002, fxPct: 0.005, borrowAnnual: 0.09, shortAnnual: 0.06, minOrder: 1 },
  },
  {
    id: "laboratorio",
    name: "Costes del laboratorio",
    note: "Los mismos del ranking: 0,1 % por cada cambio de posición y un 5 % anual por estar en corto.",
    maxLeverage: 1,
    fees: { commissionPct: 0.001, commissionFixed: 0, spreadPct: 0, fxPct: 0, borrowAnnual: 0, shortAnnual: 0.05, minOrder: 0 },
  },
  {
    id: "gratis",
    name: "Sin costes",
    note: "Irreal a propósito: sirve para ver cuánto se llevan las comisiones.",
    maxLeverage: 5,
    fees: { commissionPct: 0, commissionFixed: 0, spreadPct: 0, fxPct: 0, borrowAnnual: 0, shortAnnual: 0, minOrder: 0 },
  },
];
