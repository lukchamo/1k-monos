/**
 * De etiquetas a señal, sin IA: impacto de cada entidad de cada noticia y presión por activo.
 * Port de research/build_news.py. El LLM solo llenó el JSON; desde aquí todo es determinístico.
 */
import taxonomy from "../../../shared/taxonomy.json";
import type { NewsEvent, NewsEntity } from "./types";

export const TAXONOMY = taxonomy as unknown as Taxonomy;

export interface Taxonomy {
  version: string;
  source_tiers: Record<string, { weight: number }>;
  horizons: Record<string, { half_life_hours: number }>;
  event_types: Record<string, { group: string; weight: number; default_horizon: string }>;
  scoring: { dead_zone: number; lector_thresholds: { long: number; short: number } };
}

const HOUR = 3_600_000;

/**
 * Apertura de NYSE (9:30 en Nueva York) en UTC para una fecha YYYY-MM-DD.
 * Horario de verano de EE. UU.: del segundo domingo de marzo al primer domingo de noviembre.
 * (La PoC usaba 14:30 UTC fijo; en noviembre-marzo coincide.)
 */
export function nyseOpenUtc(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const nthSunday = (month: number, n: number) => {
    const first = new Date(Date.UTC(y, month - 1, 1)).getUTCDay();
    return 1 + ((7 - first) % 7) + 7 * (n - 1);
  };
  const dstStart = Date.UTC(y, 2, nthSunday(3, 2));
  const dstEnd = Date.UTC(y, 10, nthSunday(11, 1));
  const day = Date.UTC(y, m - 1, d);
  const edt = day >= dstStart && day < dstEnd;
  return new Date(Date.UTC(y, m - 1, d, edt ? 13 : 14, 30));
}

/** primera apertura estrictamente posterior a `dt` dentro de las sesiones dadas */
export function nextOpen(dt: Date, sessions: string[]): Date {
  for (const s of sessions) {
    const o = nyseOpenUtc(s);
    if (o.getTime() > dt.getTime()) return o;
  }
  return new Date(dt.getTime() + 24 * HOUR);
}

/**
 * Primer instante en que un inversionista puede actuar con la noticia. Lo calcula el Worker, nunca el LLM.
 * Hora desconocida = conservador: cuenta desde la apertura siguiente al final de ese día.
 */
export function effectiveAt(publishedAt: string, timeKnown: boolean, sessions: string[]): Date {
  const pub = new Date(publishedAt);
  const ref = timeKnown ? pub : new Date(pub.getTime() + 23 * HOUR + 59 * 60_000);
  return nextOpen(ref, sessions);
}

/** impacto de una entidad de un evento en el instante `at`; 0 si el evento aún no existe para nadie */
export function impact(ev: NewsEvent, ent: NewsEntity, at: Date, tax: Taxonomy = TAXONOMY): number {
  const eff = new Date(ev.timing.effective_at);
  if (at.getTime() < eff.getTime()) return 0; // point-in-time: el futuro no existe
  const s = ent.sentiment;
  if (Math.abs(s) < tax.scoring.dead_zone) return 0;
  const sig = ev.signal;
  const wSrc = tax.source_tiers[ev.source.tier].weight;
  const wEvt = tax.event_types[ev.classification.event_type].weight;
  const hl = tax.horizons[sig.horizon].half_life_hours;
  const ageH = (at.getTime() - eff.getTime()) / HOUR;
  const decay = 0.5 ** (ageH / hl);
  return (
    s *
    ent.confidence *
    ent.relevance *
    (0.5 + 0.5 * sig.novelty) *
    wSrc *
    wEvt *
    (1 - 0.5 * sig.hype) *
    (0.5 + sig.surprise) *
    (1 - 0.5 * sig.uncertainty) *
    decay
  );
}

/** presión de noticias de un activo en [−1, 1] = tanh(Σ impactos vigentes) */
export function pressure(events: NewsEvent[], symbol: string, at: Date, tax: Taxonomy = TAXONOMY): number {
  let tot = 0;
  for (const ev of events) for (const ent of ev.entities) if (ent.symbol === symbol) tot += impact(ev, ent, at, tax);
  return Math.tanh(tot);
}

/** El Lector: largo con presión ≥ +0,30, corto con ≤ −0,30 */
export function lector(p: number, tax: Taxonomy = TAXONOMY): -1 | 0 | 1 {
  const th = tax.scoring.lector_thresholds;
  return p >= th.long ? 1 : p <= th.short ? -1 : 0;
}

/** qué eventos empujan la presión de un activo en `at` (para el reason_json y el MCP) */
export function pressureBreakdown(events: NewsEvent[], symbol: string, at: Date, tax: Taxonomy = TAXONOMY) {
  return events
    .flatMap((ev) =>
      ev.entities
        .filter((e) => e.symbol === symbol)
        .map((e) => ({ event_id: ev.event_id, title: ev.content.title, event_type: ev.classification.event_type, impact: impact(ev, e, at, tax) })),
    )
    .filter((x) => x.impact !== 0)
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
}
