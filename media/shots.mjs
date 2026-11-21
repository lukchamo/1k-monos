// Capturas de la plataforma para el vídeo de recorrido y el tutorial. Uso: node media/shots.mjs [base]
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.argv[2] ?? "https://1kmonos.com";
const out = new URL("./shots/", import.meta.url).pathname;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
const shot = async (name, path, prep) => {
  await p.goto(base + path, { waitUntil: "networkidle" });
  if (prep) await prep();
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}${name}.jpg`, type: "jpeg", quality: 88 });
  console.log(name);
};
const to = (sel) => async () => { await p.locator(sel).scrollIntoViewIfNeeded(); await p.evaluate((s) => { const e = document.querySelector(s); window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 110); }, sel); };
await shot("portada", "/");
await shot("ranking", "/", to("#ranking"));
await shot("posiciones", "/", to("#posiciones"));
await shot("avisos", "/", to("#llamadas"));
await shot("playground", "/playground?activo=ETH-USD&lado=corto", async () => { await p.getByText("Abrir una posición").waitFor(); await p.evaluate(() => window.scrollTo(0, 560)); });
await shot("simulador", "/simulador", async () => { await p.getByText("Tu cartera", { exact: true }).waitFor(); await p.evaluate(() => window.scrollTo(0, 250)); });
await shot("mcp", "/mcp");
await b.close();
