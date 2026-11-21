export const SITE = {
  name: "1K Monos",
  tagline: "Laboratorio abierto de inversionistas determinísticos",
  description:
    "Treinta inversionistas virtuales con reglas fijas compiten contra miles de monos que operan al azar, sobre mercados reales. Abierto, auditable y experimental. No es una recomendación de inversión.",
  repo: "https://github.com/lukchamo/1k-monos",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://1kmonos.com",
  disclaimerShort: "Laboratorio experimental. Nada de lo que ves aquí es una recomendación de inversión.",
} as const;

export const FAMILY_COLOR: Record<string, string> = {
  Momentum: "#5fb2ff",
  Reversión: "#ffd84d",
  Ruptura: "#ff9a52",
  Macro: "#b89cff",
  Antagonista: "#ff7096",
  Intuición: "#4fe0b5",
  Racha: "#9aa7b8",
  Control: "#f2f4f7",
};

export const FAMILY_BLURB: Record<string, string> = {
  Momentum: "Sigue la tendencia: compra lo que sube, vende lo que baja.",
  Reversión: "Apuesta a que lo que se estiró demasiado vuelve a su media.",
  Ruptura: "Entra cuando el precio rompe su máximo o mínimo reciente.",
  Macro: "Mira el miedo (VIX) y los tipos de interés, no el precio del activo.",
  Antagonista: "Lleva la contraria cuando demasiadas tesis coinciden.",
  Intuición: "Busca en su memoria los días más parecidos a hoy y copia lo que funcionó.",
  Racha: "Copia al inversionista que mejor viene. Es la advertencia del laboratorio.",
  Control: "No decide nada: compra todo y lo mantiene. Sirve de vara de medir.",
};
