/**
 * Resumen privado para el autor del laboratorio (parte pura: selección y texto, sin bindings). Tras cada cierre mira en qué activos coincide una
 * mayoría clara de inversionistas (una «llamada» en largo o en corto), verifica las llamadas
 * anteriores con el cierre siguiente y lo envía por correo a una única dirección configurada.
 *
 * No es un servicio de señales: un solo destinatario (el secreto DIGEST_TO), nunca usuarios.
 * La selección es determinística: mismas decisiones, mismas llamadas.
 */
import { DISCLAIMER } from "./guard";

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
export interface Digest {
  date: string;
  calls: Call[];
  verified: Verified[];
  record: { total: number; hits: number; avg_ret: number | null };
}

/** de las posiciones de un día a las llamadas de consenso. Pura: se prueba sin base de datos. */
export function pickCalls(date: string, rows: { symbol: string; position: number }[], closes: Record<string, number>): Call[] {
  const by = new Map<string, { l: number; s: number; n: number }>();
  for (const r of rows) {
    const c = by.get(r.symbol) ?? { l: 0, s: 0, n: 0 };
    c.n++;
    if (r.position > 0) c.l++;
    else if (r.position < 0) c.s++;
    by.set(r.symbol, c);
  }
  const out: Call[] = [];
  for (const [symbol, c] of by) {
    const score = c.n ? (c.l - c.s) / c.n : 0;
    if (Math.abs(score) < CALL_THRESHOLD) continue;
    out.push({ date, symbol, direction: score > 0 ? 1 : -1, score, n_long: c.l, n_short: c.s, n_total: c.n, entry_close: closes[symbol] ?? null });
  }
  // orden total y estable: más acuerdo primero, luego alfabético
  return out.sort((a, b) => Math.abs(b.score) - Math.abs(a.score) || (a.symbol < b.symbol ? -1 : 1)).slice(0, MAX_CALLS);
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
          `${c.entry_close ? `, con el cierre en ${c.entry_close}` : ""}. La verificamos con el cierre de la próxima sesión.`,
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
