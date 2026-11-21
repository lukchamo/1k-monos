import type { Metadata } from "next";
import Link from "next/link";
import { CHAPTERS, MONEY_GUIDES, VIDEOS, type VideoItem } from "@/lib/tutorial";
import { MoneyGuide } from "@/components/MoneyGuide";
import { TutorialPlayer } from "@/components/TutorialPlayer";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Tutoriales",
  description: "Cómo funciona y cómo se usa 1K Monos: un tutorial interactivo paso a paso y vídeos cortos con casos reales.",
};

function Video({ v }: { v: VideoItem }) {
  return (
    <figure className="card overflow-hidden">
      <video controls preload="none" playsInline poster={v.poster} className={`block w-full bg-black ${v.format === "vertical" ? "aspect-[9/16]" : "aspect-video"}`}>
        <source src={v.url} type="video/mp4" />
        Tu navegador no reproduce vídeo. <a href={v.url}>Descárgalo aquí</a>.
      </video>
      <figcaption className="space-y-1 p-4">
        <p className="font-medium">{v.title}</p>
        <p className="text-sm text-ink-2">{v.text}</p>
        <p className="flex flex-wrap gap-x-3 text-xs text-ink-3">
          <span className="num">{v.seconds} s</span>
          <span>Con voz y texto en pantalla</span>
          <a href={v.url} download className="underline underline-offset-2 hover:text-ink">Descargar</a>
        </p>
      </figcaption>
    </figure>
  );
}

export default function TutorialsPage() {
  const vertical = VIDEOS.filter((v) => v.format === "vertical");
  const horizontal = VIDEOS.filter((v) => v.format === "horizontal");
  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 pt-8 sm:pt-10">
      <header className="max-w-3xl space-y-3">
        <p className="eyebrow">Tutoriales</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Cómo funciona y cómo se usa</h1>
        <p className="text-ink-2">
          Empieza por el tutorial interactivo: avanza solo, pero puedes pausarlo y tocar los puntos amarillos para ver qué es cada cosa. Más abajo tienes
          vídeos cortos con casos reales del experimento.
        </p>
      </header>

      <section className="space-y-4" aria-labelledby="t-dinero">
        <div className="max-w-3xl space-y-1.5">
          <h2 id="t-dinero" className="text-2xl font-semibold tracking-tight">Lo más fácil: míralo en euros</h2>
          <p className="text-ink-2">Elige cuánto pones y mueve el precio. Verás cuánto dinero tendrías, cuánto cuesta y cuándo te liquidarían.</p>
        </div>
        <MoneyGuide />
        <div className="grid gap-4 md:grid-cols-2">
          {MONEY_GUIDES.map((g) => (
            <article key={g.title} className="card space-y-3 p-4 sm:p-5">
              <h3 className="font-medium">{g.title}</h3>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-2">
                {g.steps.map((t) => <li key={t}>{t}</li>)}
              </ol>
              <p className="rounded-lg bg-surface-2 p-3 text-sm text-ink">{g.result}</p>
            </article>
          ))}
        </div>
        <Link href="/playground" className="inline-block rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-ink hover:brightness-110">Hacerlo en el playground →</Link>
      </section>

      <section className="space-y-4" aria-labelledby="t-interactivo">
        <h2 id="t-interactivo" className="text-2xl font-semibold tracking-tight">Tutorial interactivo</h2>
        <TutorialPlayer chapters={CHAPTERS} />
      </section>

      <section className="space-y-4" aria-labelledby="t-cortos">
        <div className="max-w-3xl space-y-1.5">
          <h2 id="t-cortos" className="text-2xl font-semibold tracking-tight">Vídeos cortos</h2>
          <p className="text-ink-2">Para ver en el móvil o compartir. Los datos son los del experimento real.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vertical.map((v) => <Video key={v.id} v={v} />)}
          <div className="card flex flex-col justify-center gap-3 p-5 sm:col-span-2 lg:col-span-3">
            <h3 className="font-medium">Qué cuenta cada uno</h3>
            <ul className="list-disc space-y-2 pl-5 text-sm text-ink-2">
              <li><strong className="text-ink">Los monos.</strong> Soltamos 2.000 monos a invertir al azar y 28 inversionistas con reglas. El mejor inversionista ganó un 6,2 %; el mejor de 28 monos, un 27,3 % por pura suerte.</li>
              <li><strong className="text-ink">Tu primera operación.</strong> Largo, corto, apalancamiento y liquidación con 50 € de mentira, con las cuentas en euros.</li>
              <li><strong className="text-ink">Un caso real.</strong> El 19 de noviembre de 2026, 17 de 28 inversionistas estaban en corto en Ethereum. Al cierre siguiente, ese corto ganó un 7,7 %. Un día no demuestra nada, y el vídeo lo dice.</li>
            </ul>
            <Link href="/playground?activo=ETH-USD&lado=corto" className="self-start rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-ink hover:brightness-110">Repetir el caso en el playground →</Link>
          </div>
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="t-ancho">
        <div className="max-w-3xl space-y-1.5">
          <h2 id="t-ancho" className="text-2xl font-semibold tracking-tight">Para pantalla grande</h2>
          <p className="text-ink-2">El recorrido completo por la plataforma y los vídeos anteriores en formato ancho.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {horizontal.map((v, i) => (
            <div key={v.id} className={i === 0 ? "md:col-span-2" : ""}>
              <Video v={v} />
            </div>
          ))}
        </div>
      </section>

      <section className="card space-y-2 p-5 text-sm text-ink-2">
        <h2 className="font-medium text-ink">Hechos con HTML y JavaScript</h2>
        <p>
          Los vídeos no salen de un editor: son páginas web con una línea de tiempo en JavaScript, grabadas fotograma a fotograma. El código está en{" "}
          <a className="underline underline-offset-2 hover:text-ink" href={`${SITE.repo}/tree/main/media`} target="_blank" rel="noreferrer">la carpeta media del repositorio</a>, por si
          quieres cambiar un texto o un dato y volver a generarlos.
        </p>
      </section>

      <p className="max-w-3xl text-sm text-ink-3">Todo lo que ves aquí es un experimento educativo con dinero ficticio. No es una recomendación de inversión.</p>
    </div>
  );
}
