// Graba un vídeo de media/video.html fotograma a fotograma y lo codifica con ffmpeg.
// Uso: node media/render.mjs <reel1|reel2|tour> <vertical|horizontal> [fps]
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
const { chromium } = createRequire(import.meta.url)("playwright");

const [video = "reel1", format = "vertical", fpsArg = "30"] = process.argv.slice(2);
const fps = Number(fpsArg);
const size = format === "vertical" ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };
const out = new URL(`./out/${video}-${format}.mp4`, import.meta.url).pathname;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
await page.goto(new URL(`./video.html?v=${video}`, import.meta.url).href, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
const duration = await page.evaluate(() => window.DURATION);
const frames = Math.round(duration * fps);

const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-",
  "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-r", String(fps), out], { stdio: ["pipe", "inherit", "inherit"] });
for (let i = 0; i < frames; i++) {
  await page.evaluate((t) => window.setT(t), i / fps);
  const jpg = await page.screenshot({ type: "jpeg", quality: 93 });
  if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once("drain", r));
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
// una imagen de portada, tomada donde ya se lee el titular
await page.evaluate(() => window.setT(2.2));
await page.screenshot({ path: out.replace(".mp4", ".jpg"), type: "jpeg", quality: 88 });
await browser.close();
console.log(`${out} · ${duration.toFixed(1)} s · ${frames} fotogramas`);
