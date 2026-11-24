/**
 * Resumen privado para el autor del laboratorio (parte pura: selección y texto, sin bindings). Tras cada cierre mira en qué activos coincide una
 * mayoría clara de inversionistas (una «llamada» en largo o en corto), verifica las llamadas
 * anteriores con el cierre siguiente y lo envía por correo a una única dirección configurada.
 *
 * No es un servicio de señales: un solo destinatario (el secreto DIGEST_TO), nunca usuarios.
 * La selección es determinística: mismas decisiones, mismas llamadas.
 */
import { DISCLAIMER } from "./guard";
import { neverless, neverlessLine } from "./brokers";

// Diferencia neta mínima entre largos y cortos, sobre el total. El elenco está partido a propósito
// (tendencia contra reversión), así que el acuerdo rara vez pasa de un tercio: con 0,5 no salía ninguna.
export const CALL_THRESHOLD = 0.25;
export const MAX_CALLS = 5;

export interface Call {
  date: string;
  symbol: string;
  direction: 1 | -1;
  score: number;
  n_long: number;
  n_short: number;
  n_total: number;
  entry_close: number | null;
}
export interface Verified extends Call {
  verified_date: string;
  exit_close: number;
  ret: number;
  hit: 0 | 1;
}
/** reparto de votos de un activo: cuántos inversionistas están en largo, en corto o fuera */
export interface Vote {
  symbol: string;
  n_long: number;
  n_short: number;
  n_total: number;
  score: number;
  close: number | null;
}
export interface Digest {
  date: string;
  calls: Call[];
  /** todos los activos, no solo los que llegan a llamada: para ver qué dice el laboratorio de lo que sí se puede operar */
  board?: Vote[];
  verified: Verified[];
  record: { total: number; hits: number; avg_ret: number | null };
}

/** votos por activo, en orden estable: más acuerdo primero, luego alfabético. Pura. */
export function voteBoard(rows: { symbol: string; position: number }[], closes: Record<string, number>): Vote[] {
  const by = new Map<string, { l: number; s: number; n: number }>();
  for (const r of rows) {
    const c = by.get(r.symbol) ?? { l: 0, s: 0, n: 0 };
    c.n++;
    if (r.position > 0) c.l++;
    else if (r.position < 0) c.s++;
    by.set(r.symbol, c);
  }
  return [...by]
    .map(([symbol, c]) => ({ symbol, n_long: c.l, n_short: c.s, n_total: c.n, score: c.n ? (c.l - c.s) / c.n : 0, close: closes[symbol] ?? null }))
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score) || (a.symbol < b.symbol ? -1 : 1));
}

/** de las posiciones de un día a las llamadas de consenso. Pura: se prueba sin base de datos. */
export function pickCalls(date: string, rows: { symbol: string; position: number }[], closes: Record<string, number>): Call[] {
  return voteBoard(rows, closes)
    .filter((v) => Math.abs(v.score) >= CALL_THRESHOLD)
    .slice(0, MAX_CALLS)
    .map((v) => ({ date, symbol: v.symbol, direction: v.score > 0 ? 1 : -1, score: v.score, n_long: v.n_long, n_short: v.n_short, n_total: v.n_total, entry_close: v.close }));
}

/** cómo se lee un reparto de votos, sin convertirlo en consejo */
export function reading(v: Vote): string {
  if (Math.abs(v.score) >= CALL_THRESHOLD) return v.score > 0 ? "mayoría en largo" : "mayoría en corto";
  if (v.n_long === v.n_short) return "empate";
  return v.score > 0 ? "algo más en largo, sin mayoría" : "algo más en corto, sin mayoría";
}

/** los activos del laboratorio que están en Neverless, con su reparto de votos */
export function brokerBoard(board: Vote[]): (Vote & { ticker: string; kind: string })[] {
  return board.flatMap((v) => {
    const a = neverless(v.symbol);
    return a ? [{ ...v, ticker: a.ticker, kind: a.kind }] : [];
  });
}

const pct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1).replace(".", ",")} %`;
const side = (d: number) => (d > 0 ? "largo" : "corto");
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const playgroundLink = (site: string, c: Call) => `${site}/playground?activo=${encodeURIComponent(c.symbol)}&lado=${c.direction > 0 ? "largo" : "corto"}&desde=ultimo`;

/** pasos para probar una llamada en el playground, con dinero ficticio */
function steps(c: Call): string[] {
  const dir = c.direction > 0 ? "largo" : "corto";
  return [
    `Abre el enlace de ${c.symbol} (el botón amarillo de este correo): el playground ya viene con ${c.symbol} elegido, en ${dir} y en el último cierre.`,
    `Comprueba que está marcado «${c.direction > 0 ? "Largo · sube" : "Corto · baja"}».`,
    "En «Cuánto pones de tu dinero» escribe 50. Deja el apalancamiento en 1×.",
    `Pulsa el botón «Abrir ${dir} en ${c.symbol.replace("-USD", "")}».`,
    "Listo. Cuando llegue el siguiente cierre te escribimos con el resultado y lo verás en «Tus posiciones abiertas».",
  ];
}

const GLOSSARY: [string, string][] = [
  ["Largo", "apuestas a que el precio sube. Si sube, ganas; si baja, pierdes."],
  ["Corto", "apuestas a que el precio baja. Si baja, ganas; si sube, pierdes."],
  ["Apalancamiento", "operas con más dinero del que pones, prestado. Multiplica ganancias y pérdidas. Para empezar, 1× (sin préstamo)."],
  ["Liquidación", "si con apalancamiento pierdes demasiado, se cierra todo y te quedas sin lo que pusiste."],
];

export function renderDigest(d: Digest, siteUrl: string): { subject: string; text: string; html: string } {
  // ── texto plano ──
  const lines: string[] = [];
  lines.push(`Mira Luis, esto dejó el laboratorio al cierre del ${d.date}.`, "");
  if (d.calls.length) {
    lines.push("POSICIONES ANALIZADAS");
    for (const c of d.calls)
      lines.push(
        `- Analizamos ${c.symbol}: posición en ${side(c.direction)}. ${c.direction > 0 ? c.n_long : c.n_short} de ${c.n_total} inversionistas coinciden` +
          `${c.entry_close ? `, con el cierre en ${c.entry_close}` : ""}. La verificamos con el cierre de la próxima sesión. ${neverlessLine(c.symbol)}`,
      );
    lines.push("", "CÓMO PROBARLO PASO A PASO (dinero ficticio)");
    for (const c of d.calls) {
      lines.push("", `${c.symbol} en ${side(c.direction)}: ${playgroundLink(siteUrl, c)}`);
      steps(c).forEach((t, i) => lines.push(`  ${i + 1}. ${t}`));
    }
    lines.push("", "PALABRAS CLAVE");
    for (const [k, v] of GLOSSARY) lines.push(`- ${k}: ${v}`);
  } else {
    lines.push("Hoy no hay ningún activo donde una dirección gane con claridad: los inversionistas están repartidos.");
  }
  lines.push("");
  const nb = brokerBoard(d.board ?? []);
  if (nb.length) {
    lines.push("LO QUE DICE EL LABORATORIO DE LO QUE ESTÁ EN NEVERLESS");
    for (const v of nb) lines.push(`- ${v.ticker} (${v.kind}): ${v.n_long} en largo, ${v.n_short} en corto, ${v.n_total - v.n_long - v.n_short} fuera → ${reading(v)}`);
    lines.push("Es el reparto de votos, no una señal: solo cuenta como llamada cuando hay mayoría clara.", "");
  }
  if (d.verified.length) {
    lines.push("VERIFICACIÓN DE LAS ANTERIORES");
    for (const v of d.verified) lines.push(`- ${v.symbol} en ${side(v.direction)} (${v.date}): ${pct(v.ret)} → ${v.hit ? "acertó" : "falló"}`);
    lines.push("");
  }
  if (d.record.total) lines.push(`Historial: ${d.record.hits} aciertos de ${d.record.total} llamadas verificadas${d.record.avg_ret != null ? `, ${pct(d.record.avg_ret)} de media por llamada` : ""}.`, "");
  lines.push(
    "ANTES DE FIARTE",
    "Ningún inversionista del laboratorio ha demostrado todavía una ventaja que no pueda ser suerte. Pruébalo primero con dinero ficticio.",
    "",
    `Detalle: ${siteUrl}`,
    "",
    "Esto es el registro de un experimento con reglas fijas y dinero ficticio. No es una recomendación de inversión.",
    DISCLAIMER,
  );
  const text = lines.join("\n");

  // ── HTML con la marca de 1K Monos (tablas y estilos en línea: es lo que entienden los clientes de correo) ──
  const C = { bg: "#0a0c0f", card: "#11151a", line: "#232a33", ink: "#eef1f5", ink2: "#a7b0bd", ink3: "#717c8b", brand: "#ffd84d", up: "#4fd68a", down: "#ff6b6b" };
  const h2 = (t: string) => `<tr><td style="padding:26px 24px 8px;font:600 13px/1.3 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:${C.ink3}">${t}</td></tr>`;
  const callCard = (c: Call) => {
    const col = c.direction > 0 ? C.up : C.down;
    return `<tr><td style="padding:6px 24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.card};border:1px solid ${C.line};border-radius:12px">
<tr><td style="padding:16px 18px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="font:700 22px/1.2 ui-monospace,Menlo,monospace;color:${C.ink}">${esc(c.symbol.replace("-USD", ""))}</td>
    <td align="right"><span style="display:inline-block;padding:5px 12px;border-radius:999px;border:1px solid ${col};color:${col};font:700 13px/1 system-ui,sans-serif;text-transform:uppercase;letter-spacing:.06em">${c.direction > 0 ? "Largo ↑" : "Corto ↓"}</span></td>
  </tr></table>
  <p style="margin:10px 0 0;font:14px/1.5 system-ui,sans-serif;color:${C.ink2}">${c.n_long} inversionistas en largo y ${c.n_short} en corto, de ${c.n_total}.${c.entry_close ? ` Cierre: <b style="color:${C.ink}">${c.entry_close}</b>.` : ""}</p>
  <p style="margin:8px 0 0;font:13px/1.5 system-ui,sans-serif;color:${neverless(c.symbol) ? C.ink2 : C.down}">${esc(neverlessLine(c.symbol))}</p>
  <ol style="margin:12px 0 0;padding-left:20px;font:14px/1.6 system-ui,sans-serif;color:${C.ink}">${steps(c).map((t) => `<li style="margin-bottom:4px">${esc(t)}</li>`).join("")}</ol>
  <p style="margin:14px 0 2px"><a href="${esc(playgroundLink(siteUrl, c))}" style="display:inline-block;background:${C.brand};color:#1a1500;font:600 14px/1 system-ui,sans-serif;text-decoration:none;padding:12px 18px;border-radius:8px">Probar ${esc(c.symbol.replace("-USD", ""))} en ${side(c.direction)} con dinero ficticio</a></p>
</td></tr></table></td></tr>`;
  };
  const verifiedRows = d.verified
    .map(
      (v) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid ${C.line};font:600 14px ui-monospace,Menlo,monospace;color:${C.ink}">${esc(v.symbol.replace("-USD", ""))}</td>` +
        `<td style="padding:8px 0;border-bottom:1px solid ${C.line};font:13px system-ui,sans-serif;color:${C.ink2}">en ${side(v.direction)} · ${esc(v.date)}</td>` +
        `<td align="right" style="padding:8px 0;border-bottom:1px solid ${C.line};font:600 14px ui-monospace,Menlo,monospace;color:${v.hit ? C.up : C.down}">${pct(v.ret)} ${v.hit ? "✓" : "✗"}</td></tr>`,
    )
    .join("");
  const boardRows = nb
    .map((v) => {
      const col = Math.abs(v.score) < CALL_THRESHOLD ? C.ink2 : v.score > 0 ? C.up : C.down;
      const td = `padding:7px 0;border-bottom:1px solid ${C.line}`;
      return (
        `<tr><td style="${td};font:600 14px ui-monospace,Menlo,monospace;color:${C.ink}">${esc(v.ticker)} <span style="font:12px system-ui,sans-serif;color:${C.ink3}">${esc(v.kind)}</span></td>` +
        `<td style="${td};font:13px ui-monospace,Menlo,monospace;color:${C.ink2}">${v.n_long}↑ ${v.n_short}↓ ${v.n_total - v.n_long - v.n_short}·</td>` +
        `<td align="right" style="${td};font:13px system-ui,sans-serif;color:${col}">${esc(reading(v))}</td></tr>`
      );
    })
    .join("");
  const boardBlock = nb.length
    ? h2("Lo que dice el laboratorio de lo que está en Neverless") +
      `<tr><td style="padding:0 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${boardRows}</table>` +
      `<p style="margin:10px 0 0;font:13px/1.5 system-ui,sans-serif;color:${C.ink3}">↑ en largo · ↓ en corto · «·» fuera. Es el reparto de votos, no una señal: solo cuenta como llamada cuando hay mayoría clara. Los ETF salen en el catálogo web de Neverless; si tu app no los muestra, tu cuenta no los tiene.</p></td></tr>`
    : "";
  const html = `<!doctype html><html lang="es"><body style="margin:0;padding:0;background:${C.bg}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${C.bg};border:1px solid ${C.line};border-radius:16px;overflow:hidden">
<tr><td style="padding:20px 24px;border-bottom:1px solid ${C.line}">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td><img src="${esc(siteUrl)}/icon-192.png" width="36" height="36" alt="" style="display:block;border-radius:9px"></td>
    <td style="padding-left:10px;font:700 18px/1 system-ui,sans-serif;color:${C.ink}">1K <span style="color:${C.brand}">Monos</span></td>
  </tr></table>
</td></tr>
<tr><td style="padding:10px 24px;background:#2a2410;font:13px/1.4 system-ui,sans-serif;color:${C.ink}"><b style="background:${C.brand};color:#1a1500;padding:2px 6px;border-radius:4px;font-size:11px;letter-spacing:.06em">EXPERIMENTO</b>&nbsp; No es una recomendación de inversión.</td></tr>
<tr><td style="padding:24px 24px 4px;font:600 24px/1.25 system-ui,sans-serif;color:${C.ink}">Mira Luis, esto dejó el laboratorio al cierre del ${esc(d.date)}</td></tr>
<tr><td style="padding:6px 24px 0;font:15px/1.55 system-ui,sans-serif;color:${C.ink2}">${
    d.calls.length
      ? `Analizamos los ${d.calls[0].n_total} inversionistas y en ${d.calls.length === 1 ? "este activo" : `estos ${d.calls.length} activos`} una dirección gana con claridad. Abajo tienes el paso a paso para probarlo sin arriesgar nada.`
      : "Hoy no hay ningún activo donde una dirección gane con claridad: los inversionistas están repartidos."
  }</td></tr>
${d.calls.length ? h2("Posiciones analizadas y cómo probarlas") + d.calls.map(callCard).join("") : ""}
${
  d.calls.length
    ? h2("Palabras clave") +
      `<tr><td style="padding:0 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${GLOSSARY.map(([k, v]) => `<tr><td valign="top" style="padding:6px 12px 6px 0;font:600 14px system-ui,sans-serif;color:${C.brand};white-space:nowrap">${k}</td><td style="padding:6px 0;font:14px/1.5 system-ui,sans-serif;color:${C.ink2}">${v}</td></tr>`).join("")}</table></td></tr>`
    : ""
}
${boardBlock}
${d.verified.length ? h2("Verificación de las anteriores") + `<tr><td style="padding:0 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${verifiedRows}</table></td></tr>` : ""}
${d.record.total ? `<tr><td style="padding:14px 24px 0;font:14px/1.5 system-ui,sans-serif;color:${C.ink2}"><b style="color:${C.ink}">Historial:</b> ${d.record.hits} aciertos de ${d.record.total} llamadas verificadas${d.record.avg_ret != null ? `, ${pct(d.record.avg_ret)} de media` : ""}. Son muy pocas para sacar conclusiones.</td></tr>` : ""}
${h2("Antes de fiarte")}
<tr><td style="padding:0 24px;font:14px/1.6 system-ui,sans-serif;color:${C.ink2}">Ningún inversionista del laboratorio ha demostrado todavía una ventaja que no pueda ser suerte. Por eso el paso a paso es con dinero ficticio: mira cómo sale varias veces antes de pensar en nada más.</td></tr>
<tr><td style="padding:22px 24px"><a href="${esc(siteUrl)}" style="color:${C.brand};font:600 14px system-ui,sans-serif">Ver el laboratorio →</a></td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid ${C.line};font:12px/1.5 system-ui,sans-serif;color:${C.ink3}">Registro de un experimento con reglas fijas y dinero ficticio. No es una recomendación de inversión ni asesoramiento financiero. Recibes este correo porque eres el autor del laboratorio.</td></tr>
</table></td></tr></table></body></html>`;

  const subject = d.calls.length
    ? `1K Monos · ${d.date}: ${d.calls.slice(0, 3).map((c) => `${c.symbol} en ${side(c.direction)}`).join(", ")}${d.calls.length > 3 ? "…" : ""}`
    : `1K Monos · ${d.date}: sin consenso hoy`;
  return { subject, text, html };
}


// ── seguimiento entre cierres ────────────────────────────────────────────────
export interface OpenCall extends Call {
  /** último precio conocido, o null si no se pudo leer */
  now: number | null;
}
export interface FollowUp {
  /** fecha del último cierre con decisiones */
  date: string;
  /** instante del correo, ISO */
  at: string;
  moment: "mañana" | "apertura";
  open: OpenCall[];
  board: Vote[];
}

/** cuánto lleva una llamada a favor (positivo) o en contra desde su cierre de entrada */
export const moveInFavor = (c: OpenCall): number | null => (c.now && c.entry_close ? c.direction * (c.now / c.entry_close - 1) : null);

/**
 * Correo de seguimiento: NO trae decisiones nuevas (el laboratorio decide una vez, al cierre).
 * Enseña cómo van las llamadas abiertas con el último precio y recuerda el reparto de votos.
 */
export function renderFollowUp(f: FollowUp, siteUrl: string): { subject: string; text: string; html: string } {
  const C = { bg: "#0a0c0f", card: "#11151a", line: "#232a33", ink: "#eef1f5", ink2: "#a7b0bd", ink3: "#717c8b", brand: "#ffd84d", up: "#4fd68a", down: "#ff6b6b" };
  const hhmm = f.at.slice(11, 16);
  const title = f.moment === "mañana" ? "a media mañana" : "tras la apertura de Nueva York";
  const nb = brokerBoard(f.board);
  const lines: string[] = [`Mira Luis, así van ${title} las llamadas del cierre del ${f.date} (${hhmm} UTC).`, "", "No hay decisiones nuevas: el laboratorio decide una vez al día, al cierre. Esto es solo seguimiento.", ""];
  if (f.open.length) {
    lines.push("LLAMADAS ABIERTAS");
    for (const c of f.open) {
      const m = moveInFavor(c);
      lines.push(`- ${c.symbol} en ${side(c.direction)}: entrada ${c.entry_close ?? "?"}, ahora ${c.now ?? "sin precio"}${m === null ? "" : ` → ${pct(m)} ${m >= 0 ? "a favor" : "en contra"}`}. ${neverlessLine(c.symbol)}`);
    }
  } else lines.push("No hay llamadas abiertas.");
  if (nb.length) {
    lines.push("", "REPARTO DE VOTOS DE LO QUE ESTÁ EN NEVERLESS");
    for (const v of nb) lines.push(`- ${v.ticker} (${v.kind}): ${v.n_long} en largo, ${v.n_short} en corto → ${reading(v)}`);
  }
  lines.push("", "Los precios de acciones y ETF de EE. UU. solo se mueven con su mercado abierto (15:30–22:00 en España); fuera de ese horario verás el último cierre.", "", `Detalle: ${siteUrl}`, "", DISCLAIMER);

  const td = `padding:8px 0;border-bottom:1px solid ${C.line}`;
  const openRows = f.open
    .map((c) => {
      const m = moveInFavor(c);
      const col = m === null ? C.ink3 : m >= 0 ? C.up : C.down;
      return (
        `<tr><td style="${td};font:600 14px ui-monospace,Menlo,monospace;color:${C.ink}">${esc(c.symbol.replace("-USD", ""))} <span style="font:12px system-ui,sans-serif;color:${c.direction > 0 ? C.up : C.down}">${side(c.direction)}</span></td>` +
        `<td style="${td};font:13px ui-monospace,Menlo,monospace;color:${C.ink2}">${c.entry_close ?? "?"} → ${c.now ?? "sin precio"}</td>` +
        `<td align="right" style="${td};font:600 14px ui-monospace,Menlo,monospace;color:${col}">${m === null ? "—" : `${pct(m)} ${m >= 0 ? "a favor" : "en contra"}`}</td></tr>` +
        `<tr><td colspan="3" style="padding:2px 0 8px;font:12px/1.4 system-ui,sans-serif;color:${neverless(c.symbol) ? C.ink3 : C.down}">${esc(neverlessLine(c.symbol))}</td></tr>`
      );
    })
    .join("");
  const boardRows = nb
    .map((v) => {
      const col = Math.abs(v.score) < CALL_THRESHOLD ? C.ink2 : v.score > 0 ? C.up : C.down;
      return (
        `<tr><td style="${td};font:600 14px ui-monospace,Menlo,monospace;color:${C.ink}">${esc(v.ticker)} <span style="font:12px system-ui,sans-serif;color:${C.ink3}">${esc(v.kind)}</span></td>` +
        `<td style="${td};font:13px ui-monospace,Menlo,monospace;color:${C.ink2}">${v.n_long}↑ ${v.n_short}↓</td>` +
        `<td align="right" style="${td};font:13px system-ui,sans-serif;color:${col}">${esc(reading(v))}</td></tr>`
      );
    })
    .join("");
  const h2 = (t: string) => `<tr><td style="padding:24px 24px 8px;font:600 13px/1.3 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:${C.ink3}">${t}</td></tr>`;
  const html = `<!doctype html><html lang="es"><body style="margin:0;padding:0;background:${C.bg}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${C.bg};border:1px solid ${C.line};border-radius:16px;overflow:hidden">
<tr><td style="padding:20px 24px;border-bottom:1px solid ${C.line};font:700 18px/1 system-ui,sans-serif;color:${C.ink}">1K <span style="color:${C.brand}">Monos</span> <span style="font:600 11px ui-monospace,Menlo,monospace;color:${C.ink3};letter-spacing:.1em">&nbsp;· SEGUIMIENTO</span></td></tr>
<tr><td style="padding:10px 24px;background:#2a2410;font:13px/1.4 system-ui,sans-serif;color:${C.ink}"><b style="background:${C.brand};color:#1a1500;padding:2px 6px;border-radius:4px;font-size:11px;letter-spacing:.06em">EXPERIMENTO</b>&nbsp; No es una recomendación de inversión.</td></tr>
<tr><td style="padding:24px 24px 4px;font:600 22px/1.25 system-ui,sans-serif;color:${C.ink}">Mira Luis, así van ${title} las llamadas del ${esc(f.date)}</td></tr>
<tr><td style="padding:6px 24px 0;font:14px/1.55 system-ui,sans-serif;color:${C.ink2}">${esc(hhmm)} UTC. No hay decisiones nuevas: el laboratorio decide una vez al día, al cierre. Esto es solo seguimiento.</td></tr>
${h2("Llamadas abiertas")}
<tr><td style="padding:0 24px">${f.open.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${openRows}</table>` : `<p style="margin:0;font:14px system-ui,sans-serif;color:${C.ink2}">No hay llamadas abiertas.</p>`}</td></tr>
${nb.length ? h2("Reparto de votos de lo que está en Neverless") + `<tr><td style="padding:0 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${boardRows}</table></td></tr>` : ""}
<tr><td style="padding:16px 24px 0;font:13px/1.55 system-ui,sans-serif;color:${C.ink3}">Las acciones y los ETF de EE. UU. solo se mueven con su mercado abierto (15:30–22:00 en España); fuera de ese horario verás el último cierre. Ningún inversionista del laboratorio ha demostrado una ventaja que no pueda ser suerte.</td></tr>
<tr><td style="padding:20px 24px"><a href="${esc(siteUrl)}" style="color:${C.brand};font:600 14px system-ui,sans-serif">Ver el laboratorio →</a></td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid ${C.line};font:12px/1.5 system-ui,sans-serif;color:${C.ink3}">Registro de un experimento con reglas fijas y dinero ficticio. No es una recomendación de inversión ni asesoramiento financiero. Recibes este correo porque eres el autor del laboratorio.</td></tr>
</table></td></tr></table></body></html>`;
  const head = f.open
    .slice(0, 3)
    .map((c) => {
      const m = moveInFavor(c);
      return `${c.symbol.replace("-USD", "")} ${m === null ? "sin precio" : pct(m)}`;
    })
    .join(", ");
  return { subject: `1K Monos · seguimiento ${hhmm} UTC${head ? `: ${head}` : ""}`, text: lines.join("\n"), html };
}
