/**
 * Correo de promoción de los tutoriales y vídeos, con la marca de 1K Monos. Contenido fijo:
 * no admite texto de fuera, así que no hay nada que sanear. Va solo al autor (DIGEST_TO).
 */
import { DISCLAIMER } from "./guard";

const CDN = "https://res.cloudinary.com/dh26q79sh/video/upload";
const video = (id: string) => `${CDN}/q_auto/1kmonos/${id}.mp4`;
const poster = (id: string) => `${CDN}/so_2.2,w_560,q_auto/1kmonos/${id}.jpg`;

export const PROMO_VIDEOS = [
  { id: "reel-monos-vertical", kind: "Reel", title: "¿Buena idea o suerte?", text: "2.000 monos invierten al azar contra 28 inversionistas con reglas. El mejor inversionista ganó un 6,2 %; el mejor de 28 monos, un 27,3 % por pura suerte.", wide: "reel-monos-horizontal" },
  { id: "reel-caso-real-vertical", kind: "Reel", title: "Un corto en Ethereum con 50 € de mentira", text: "Caso real del 19 de noviembre de 2026: 17 de 28 inversionistas en corto en Ethereum. Al cierre siguiente, +7,7 %. Y por qué un día no demuestra nada.", wide: "reel-caso-real-horizontal" },
  { id: "tutorial-recorrido", kind: "Tutorial", title: "Cómo usar 1K Monos en un minuto", text: "Recorrido por el ranking, las posiciones, el playground, el simulador, los avisos y el MCP.", wide: null },
] as const;

export function renderPromo(site: string): { subject: string; text: string; html: string } {
  const subject = "1K Monos · ya están los tutoriales y los vídeos para compartir";
  const text = [
    "Mira Luis, ya están publicados los tutoriales de 1K Monos.",
    "",
    `TUTORIAL INTERACTIVO: ${site}/tutoriales`,
    "Seis pasos que avanzan solos. Puedes pausarlo y tocar los puntos amarillos para ver qué es cada cosa.",
    "",
    "VÍDEOS",
    ...PROMO_VIDEOS.flatMap((v) => ["", `${v.kind}: ${v.title}`, v.text, `Vertical u original: ${video(v.id)}`, ...(v.wide ? [`Pantalla ancha: ${video(v.wide)}`] : [])]),
    "",
    "CÓMO USARLOS",
    "1. Abre cada enlace y pulsa «Descargar» en el reproductor (o mantén pulsado el vídeo en el móvil).",
    "2. Los dos reels van en vertical para Instagram, TikTok o Shorts. No llevan sonido: añade música desde la propia app.",
    "3. En el texto de la publicación pon el enlace 1kmonos.com y deja claro que es un experimento con dinero ficticio.",
    "",
    "Todos los datos de los vídeos son del experimento real. No es una recomendación de inversión.",
    DISCLAIMER,
  ].join("\n");

  const C = { bg: "#0a0c0f", card: "#11151a", line: "#232a33", ink: "#eef1f5", ink2: "#a7b0bd", ink3: "#717c8b", brand: "#ffd84d" };
  const h2 = (t: string) => `<tr><td style="padding:26px 24px 8px;font:600 13px/1.3 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:${C.ink3}">${t}</td></tr>`;
  const btn = (href: string, label: string, primary = true) =>
    `<a href="${href}" style="display:inline-block;margin:0 8px 8px 0;${primary ? `background:${C.brand};color:#1a1500` : `border:1px solid ${C.line};color:${C.ink}`};font:600 14px/1 system-ui,sans-serif;text-decoration:none;padding:12px 16px;border-radius:8px">${label}</a>`;
  const card = (v: (typeof PROMO_VIDEOS)[number]) => `<tr><td style="padding:6px 24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.card};border:1px solid ${C.line};border-radius:12px"><tr>
<td width="132" valign="top" style="padding:14px 0 14px 14px"><a href="${video(v.id)}"><img src="${poster(v.id)}" width="118" alt="Portada del vídeo: ${v.title}" style="display:block;width:118px;border-radius:8px;border:1px solid ${C.line}"></a></td>
<td valign="top" style="padding:14px 16px">
  <p style="margin:0;font:600 11px/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:${C.brand}">${v.kind}</p>
  <p style="margin:6px 0 0;font:600 17px/1.3 system-ui,sans-serif;color:${C.ink}">${v.title}</p>
  <p style="margin:6px 0 12px;font:14px/1.5 system-ui,sans-serif;color:${C.ink2}">${v.text}</p>
  ${btn(video(v.id), v.wide ? "Ver en vertical" : "Ver el vídeo")}${v.wide ? btn(video(v.wide), "Pantalla ancha", false) : ""}
</td></tr></table></td></tr>`;

  const html = `<!doctype html><html lang="es"><body style="margin:0;padding:0;background:${C.bg}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${C.bg};border:1px solid ${C.line};border-radius:16px;overflow:hidden">
<tr><td style="padding:20px 24px;border-bottom:1px solid ${C.line}">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td><img src="${site}/icon-192.png" width="36" height="36" alt="" style="display:block;border-radius:9px"></td>
    <td style="padding-left:10px;font:700 18px/1 system-ui,sans-serif;color:${C.ink}">1K <span style="color:${C.brand}">Monos</span></td>
  </tr></table>
</td></tr>
<tr><td style="padding:10px 24px;background:#2a2410;font:13px/1.4 system-ui,sans-serif;color:${C.ink}"><b style="background:${C.brand};color:#1a1500;padding:2px 6px;border-radius:4px;font-size:11px;letter-spacing:.06em">EXPERIMENTO</b>&nbsp; No es una recomendación de inversión.</td></tr>
<tr><td style="padding:26px 24px 4px;font:700 28px/1.2 system-ui,sans-serif;color:${C.ink}">¿Le gana una buena idea a <span style="color:${C.brand}">2.000 monos</span>?</td></tr>
<tr><td style="padding:8px 24px 0;font:15px/1.55 system-ui,sans-serif;color:${C.ink2}">Mira Luis, ya están publicados los tutoriales de 1K Monos y los vídeos para promocionarlo. Aquí tienes todo, listo para ver y compartir.</td></tr>
${h2("Empieza por aquí")}
<tr><td style="padding:0 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.card};border:1px solid ${C.line};border-radius:12px"><tr><td style="padding:16px 18px">
  <p style="margin:0;font:600 17px/1.3 system-ui,sans-serif;color:${C.ink}">Tutorial interactivo</p>
  <p style="margin:6px 0 12px;font:14px/1.5 system-ui,sans-serif;color:${C.ink2}">Seis pasos que avanzan solos, como un vídeo que puedes tocar: pausa, salta y pulsa los puntos amarillos para ver qué es cada cosa.</p>
  ${btn(`${site}/tutoriales`, "Abrir los tutoriales")}${btn(`${site}/playground`, "Probar el playground", false)}
</td></tr></table></td></tr>
${h2("Vídeos para compartir")}
${PROMO_VIDEOS.map(card).join("")}
${h2("Cómo usarlos")}
<tr><td style="padding:0 24px"><ol style="margin:0;padding-left:20px;font:14px/1.7 system-ui,sans-serif;color:${C.ink}">
  <li>Abre cada vídeo y pulsa «Descargar» en el reproductor. En el móvil, mantén pulsado el vídeo.</li>
  <li>Los dos reels van en vertical para Instagram, TikTok o Shorts. No llevan sonido: añade la música desde la propia app.</li>
  <li>En el texto de la publicación pon <b>1kmonos.com</b> y di que es un experimento con dinero ficticio.</li>
</ol></td></tr>
<tr><td style="padding:22px 24px"><a href="${site}" style="color:${C.brand};font:600 14px system-ui,sans-serif">Ver el laboratorio →</a></td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid ${C.line};font:12px/1.5 system-ui,sans-serif;color:${C.ink3}">Todos los datos de los vídeos son del experimento real, con dinero ficticio. No es una recomendación de inversión ni asesoramiento financiero. Recibes este correo porque eres el autor del laboratorio.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}
