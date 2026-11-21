import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { PROMO_VIDEOS, renderPromo } from "../src/promo";

describe("correo de promoción", () => {
  const m = renderPromo("https://1kmonos.com");
  it("enlaza los tutoriales y cada vídeo, y lleva el aviso", () => {
    expect(m.html).toContain("https://1kmonos.com/tutoriales");
    for (const v of PROMO_VIDEOS) expect(m.html).toContain(`/1kmonos/${v.id}.mp4`);
    expect(m.text).toContain("No es una recomendación de inversión");
    expect(m.html).toContain("No es una recomendación de inversión");
  });
  it("no promete ganancias ni dice qué hacer con el dinero", () => {
    expect(m.text + m.html).not.toMatch(/garantizad|gana dinero|invierte ya|compra ya/i);
  });
  it("solo enlaza al sitio y a Cloudinary", () => {
    const hosts = new Set([...m.html.matchAll(/(?:href|src)="https:\/\/([^/"]+)/g)].map((x) => x[1]));
    expect([...hosts].sort()).toEqual(["1kmonos.com", "res.cloudinary.com"]);
  });
  if (process.env.PREVIEW) it("vista previa", () => writeFileSync(process.env.PREVIEW!, m.html));
});
