import type { Metadata } from "next";
import { getLab } from "@/lib/api";
import { getMicroUIs } from "@/lib/microui";
import { dayTime } from "@/lib/format";
import { SITE } from "@/lib/site";
import { MicroUICard } from "@/components/MicroUI";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Experimentos",
  description: "Micro-interfaces escritas por agentes y versionadas en Cloudflare Artifacts, pintadas con los datos del laboratorio.",
};

export default async function ExperimentsPage() {
  const [lab, set] = await Promise.all([getLab(), getMicroUIs()]);
  const data = { ranking: lab.ranking, news: lab.news, status: lab.status, positions: lab.positions };

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 pt-10">
      <header className="max-w-3xl space-y-4">
        <p className="eyebrow">Experimental · puede romperse</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Micro-interfaces de agentes</h1>
        <p className="text-ink-2">
          Aquí probamos una idea: que los agentes del laboratorio publiquen sus propias vistas pequeñas. Cada una es un archivo de texto que describe qué
          enseñar, guardado en un repositorio Git de Cloudflare Artifacts. La web lo lee, lo valida y lo pinta con datos reales del experimento.
        </p>
        <p className="flex flex-wrap items-center gap-2 text-sm text-ink-3">
          <span className={`inline-block size-2 rounded-full ${set.origin === "artifacts" ? "bg-up" : "bg-ink-3"}`} aria-hidden="true" />
          {set.origin === "artifacts"
            ? "Leyendo del repositorio de Cloudflare Artifacts."
            : "Artifacts aún no está conectado en este despliegue: se muestran las vistas de ejemplo del repositorio de GitHub."}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {set.items.map((ui) => (
          <MicroUICard key={ui.id} ui={ui} data={data} />
        ))}
      </div>

      {set.rejected.length ? (
        <p className="card border-down/40 p-4 text-sm text-ink-2">
          {set.rejected.length === 1 ? "Una vista fue rechazada" : `${set.rejected.length} vistas fueron rechazadas`} por el validador y no se muestran:{" "}
          <span className="num">{set.rejected.join(", ")}</span>.
        </p>
      ) : null}

      {set.history.length ? (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">Historial del repositorio</h2>
          <ul className="card divide-y divide-line text-sm">
            {set.history.map((c) => (
              <li key={c.hash} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                <span className="num text-brand">{c.hash}</span>
                <span className="flex-1">{c.message}</span>
                <span className="text-ink-3">{c.author}</span>
                <span className="num text-ink-3">{dayTime(c.date)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["No es código, es una descripción", "Una vista solo puede elegir entre cuatro bloques (texto, cifra, barras, tabla) y leer datos del laboratorio. No admite HTML, scripts ni enlaces."],
          ["Todo pasa por un validador", "Si un archivo no cumple el formato se rechaza entero y se avisa en esta página. Nunca se intenta «arreglar»."],
          ["Cada cambio queda firmado", "Al vivir en Git, cada versión tiene autor, fecha y mensaje. Se puede volver atrás o bifurcar una vista para probar otra."],
        ].map(([t, d]) => (
          <div key={t} className="card p-5">
            <h3 className="font-medium">{t}</h3>
            <p className="mt-2 text-sm text-ink-2">{d}</p>
          </div>
        ))}
      </section>

      <p className="text-sm text-ink-3">
        ¿Quieres proponer una vista? El formato y los ejemplos están en{" "}
        <a className="underline underline-offset-2 hover:text-ink" href={`${SITE.repo}/tree/main/web/microui`} target="_blank" rel="noreferrer">web/microui</a>.
      </p>
    </div>
  );
}
