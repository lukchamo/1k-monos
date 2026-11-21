/**
 * Validación estricta del JSON que devuelve el LLM contra la taxonomía cerrada (tax-1.0).
 * Sin dependencias: Ajv genera código con `new Function`, que los Workers no permiten.
 * Un valor fuera de lista invalida el JSON → un reintento con el error como contexto → cola de revisión.
 */
import taxonomy from "../../../shared/taxonomy.json";

type Tax = typeof taxonomy & Record<string, unknown>;
const T = taxonomy as Tax;
const KINDS = ["wire", "regulatory_filing", "press_release", "news", "analysis", "blog", "social"];
const DIRECTIONS = ["bullish", "bearish", "neutral", "mixed"];
const SESSIONS = ["pre", "regular", "post", "closed", "unknown"];

export function validateNewsEvent(ev: any): string[] {
  const e: string[] = [];
  const obj = (v: unknown, path: string) => (v && typeof v === "object" && !Array.isArray(v) ? true : (e.push(`${path}: objeto requerido`), false));
  const str = (v: unknown, path: string) => typeof v === "string" && v.length > 0 || e.push(`${path}: texto requerido`);
  const inList = (v: unknown, list: readonly string[], path: string) => list.includes(v as string) || e.push(`${path}: '${v}' no está en la taxonomía`);
  const num = (v: unknown, lo: number, hi: number, path: string) =>
    (typeof v === "number" && v >= lo && v <= hi) || e.push(`${path}: número en [${lo}, ${hi}] requerido`);
  const iso = (v: unknown, path: string) => (typeof v === "string" && !Number.isNaN(Date.parse(v))) || e.push(`${path}: fecha ISO requerida`);

  if (!obj(ev, "evento")) return e;
  if (ev.schema_version !== "news-event-1.0") e.push("schema_version: debe ser news-event-1.0");
  str(ev.event_id, "event_id");
  if (obj(ev.source, "source")) {
    str(ev.source.name, "source.name");
    str(ev.source.url, "source.url");
    inList(ev.source.tier, Object.keys(T.source_tiers), "source.tier");
    inList(ev.source.kind, KINDS, "source.kind");
  }
  if (obj(ev.timing, "timing")) {
    iso(ev.timing.published_at, "timing.published_at");
    iso(ev.timing.effective_at, "timing.effective_at");
    if (typeof ev.timing.time_known !== "boolean") e.push("timing.time_known: booleano requerido");
    if (ev.timing.market_session !== undefined) inList(ev.timing.market_session, SESSIONS, "timing.market_session");
  }
  if (obj(ev.content, "content")) {
    str(ev.content.title, "content.title");
    str(ev.content.summary_es, "content.summary_es");
    if (typeof ev.content.summary_es === "string" && ev.content.summary_es.length > 400) e.push("content.summary_es: máximo 400 caracteres");
  }
  if (!Array.isArray(ev.entities) || ev.entities.length === 0) e.push("entities: al menos una entidad");
  else
    ev.entities.forEach((x: any, i: number) => {
      const p = `entities[${i}]`;
      if (!obj(x, p)) return;
      str(x.symbol, `${p}.symbol`);
      inList(x.role, T.entity_roles, `${p}.role`);
      if (x.asset_class !== undefined) inList(x.asset_class, T.asset_classes, `${p}.asset_class`);
      num(x.relevance, 0, 1, `${p}.relevance`);
      num(x.sentiment, -1, 1, `${p}.sentiment`);
      num(x.confidence, 0, 1, `${p}.confidence`);
    });
  if (obj(ev.classification, "classification")) {
    const c = ev.classification;
    inList(c.event_type, Object.keys(T.event_types), "classification.event_type");
    (c.secondary_event_types ?? []).forEach((v: unknown, i: number) => inList(v, Object.keys(T.event_types), `classification.secondary_event_types[${i}]`));
    (c.themes ?? []).forEach((v: unknown, i: number) => inList(v, T.themes, `classification.themes[${i}]`));
    (c.macro_factors ?? []).forEach((v: unknown, i: number) => inList(v, T.macro_factors, `classification.macro_factors[${i}]`));
  }
  if (obj(ev.signal, "signal")) {
    const s = ev.signal;
    inList(s.direction, DIRECTIONS, "signal.direction");
    inList(s.magnitude, T.magnitudes, "signal.magnitude");
    inList(s.horizon, Object.keys(T.horizons), "signal.horizon");
    for (const k of ["surprise", "novelty", "hype", "uncertainty"]) num(s[k], 0, 1, `signal.${k}`);
  }
  obj(ev.extraction, "extraction");
  return e;
}
