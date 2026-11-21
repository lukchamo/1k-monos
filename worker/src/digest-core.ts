/**
 * Resumen privado para el autor del laboratorio (parte pura: selección y texto, sin bindings). Tras cada cierre mira en qué activos coincide una
 * mayoría clara de inversionistas (una «llamada» en largo o en corto), verifica las llamadas
 * anteriores con el cierre siguiente y lo envía por correo a una única dirección configurada.
 *
 * No es un servicio de señales: un solo destinatario (el secreto DIGEST_TO), nunca usuarios.
 * La selección es determinística: mismas decisiones, mismas llamadas.
 */
import { DISCLAIMER } from "./guard";

export const CALL_THRESHOLD = 0.5; // al menos la mitad de los inversionistas, netos, en la misma dirección
export const MAX_CALLS = 6;

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

export function renderDigest(d: Digest, siteUrl: string): { subject: string; text: string; html: string } {
  const lines: string[] = [];
  lines.push(`Mira Luis, esto dejó el laboratorio al cierre del ${d.date}.`, "");
  if (d.calls.length) {
    lines.push("POSICIONES ANALIZADAS");
    for (const c of d.calls)
      lines.push(
        `- Analizamos ${c.symbol}: posición en ${side(c.direction)}. ${c.direction > 0 ? c.n_long : c.n_short} de ${c.n_total} inversionistas coinciden` +
          `${c.entry_close ? `, con el cierre en ${c.entry_close}` : ""}. La verificamos con el cierre de la próxima sesión.`,
      );
  } else {
    lines.push("Hoy no hay ningún activo con una mayoría clara: los inversionistas no se ponen de acuerdo.");
  }
  lines.push("");
  if (d.verified.length) {
    lines.push("VERIFICACIÓN DE LAS ANTERIORES");
    for (const v of d.verified) lines.push(`- ${v.symbol} en ${side(v.direction)} (${v.date}): ${pct(v.ret)} → ${v.hit ? "acertó" : "falló"}`);
    lines.push("");
  }
  if (d.record.total) lines.push(`Historial: ${d.record.hits} aciertos de ${d.record.total} llamadas verificadas${d.record.avg_ret != null ? `, ${pct(d.record.avg_ret)} de media por llamada` : ""}.`, "");
  lines.push(`Detalle: ${siteUrl}`, "", "Esto es el registro de un experimento con reglas fijas y dinero ficticio. No es una recomendación de inversión.", DISCLAIMER);
  const text = lines.join("\n");

  const row = (cells: string[]) => `<tr>${cells.map((c) => `<td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${c}</td>`).join("")}</tr>`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;color:#111">
<p>Mira Luis, esto dejó el laboratorio al cierre del <b>${esc(d.date)}</b>.</p>
${
  d.calls.length
    ? `<h3 style="margin:18px 0 6px">Posiciones analizadas</h3><table style="border-collapse:collapse;width:100%;font-size:14px">${d.calls
        .map((c) => row([`<b>${esc(c.symbol)}</b>`, `<span style="color:${c.direction > 0 ? "#15803d" : "#b91c1c"}">en ${side(c.direction)}</span>`, `${c.direction > 0 ? c.n_long : c.n_short} de ${c.n_total} coinciden`, c.entry_close ? `cierre ${c.entry_close}` : ""]))
        .join("")}</table><p style="font-size:13px;color:#555">Las verificamos con el cierre de la próxima sesión.</p>`
    : "<p>Hoy no hay ningún activo con una mayoría clara.</p>"
}
${
  d.verified.length
    ? `<h3 style="margin:18px 0 6px">Verificación de las anteriores</h3><table style="border-collapse:collapse;width:100%;font-size:14px">${d.verified
        .map((v) => row([`<b>${esc(v.symbol)}</b>`, `en ${side(v.direction)} (${esc(v.date)})`, pct(v.ret), v.hit ? "✅ acertó" : "❌ falló"]))
        .join("")}</table>`
    : ""
}
${d.record.total ? `<p><b>Historial:</b> ${d.record.hits} aciertos de ${d.record.total} llamadas verificadas${d.record.avg_ret != null ? `, ${pct(d.record.avg_ret)} de media` : ""}.</p>` : ""}
<p><a href="${esc(siteUrl)}">Ver el laboratorio</a></p>
<p style="font-size:12px;color:#666">Registro de un experimento con reglas fijas y dinero ficticio. No es una recomendación de inversión.</p></div>`;

  const subject = d.calls.length
    ? `1K Monos · ${d.date}: ${d.calls.slice(0, 3).map((c) => `${c.symbol} en ${side(c.direction)}`).join(", ")}${d.calls.length > 3 ? "…" : ""}`
    : `1K Monos · ${d.date}: sin consenso hoy`;
  return { subject, text, html };
}

