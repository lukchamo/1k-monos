/** Universo del experimento de 30 (23 activos operables + 2 indicadores) y sus segmentos. */

export const SEGMENTS: Record<string, string[]> = {
  "EE. UU. índices": ["SPY", "QQQ"],
  "EE. UU. tecnología e IA": ["MSFT", "NVDA", "TSLA", "PLTR", "CRWV", "SPCX"],
  Cripto: ["BTC-USD", "ETH-USD", "SOL-USD", "COIN"],
  "Refugio y tipos": ["GLD", "TLT"],
  "Materias primas": ["USO"],
  Europa: ["SAN.MC", "EWP", "FEZ"],
  "Asia desarrollada": ["EWJ"],
  Emergentes: ["EEM", "EWZ", "EWW", "FXI"],
};

export const ECONOMIES: Record<string, string[]> = {
  Desarrolladas: [
    ...SEGMENTS["EE. UU. índices"],
    ...SEGMENTS["EE. UU. tecnología e IA"],
    ...SEGMENTS["Europa"],
    ...SEGMENTS["Asia desarrollada"],
  ],
  Emergentes: SEGMENTS["Emergentes"],
  Cripto: SEGMENTS["Cripto"],
  "Materias primas y refugio": [...SEGMENTS["Materias primas"], ...SEGMENTS["Refugio y tipos"]],
};

/** orden canónico de los activos: el mismo que la referencia Python */
export const UNIVERSE: string[] = Object.values(SEGMENTS).flat();

/** indicadores que se leen pero no se operan */
export const INDICATORS = { vix: "^VIX", tnx: "^TNX" } as const;

/** activos de beta alta: el Macro los pone cortos cuando hay miedo */
export const BETA_HI = new Set(["NVDA", "TSLA", "PLTR", "CRWV", "SPCX", "COIN", "BTC-USD", "ETH-USD", "SOL-USD", "EWZ", "FXI"]);

const HIGH_BORROW = new Set(["CRWV", "SPCX", "COIN", "PLTR", "TSLA"]);
const CRYPTO = new Set(["BTC-USD", "ETH-USD", "SOL-USD"]);

export const COSTS = {
  /** 10 pb por unidad de cambio de posición (comisión + deslizamiento) */
  perUnitTurnover: 0.001,
  /** coste anual de estar corto, cobrado por día de calendario bursátil (/252) */
  borrowAnnual(symbol: string): number {
    return CRYPTO.has(symbol) ? 0.1 : HIGH_BORROW.has(symbol) ? 0.08 : 0.02;
  },
};

/** segmentos + economías: todos los grupos con ranking propio */
export const GROUPS: Record<string, string[]> = { ...SEGMENTS, ...ECONOMIES };
