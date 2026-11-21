import type { Metadata } from "next";
import { getLab } from "@/lib/api";
import { dayTime } from "@/lib/format";
import { NewsCard } from "@/components/News";

export const revalidate = 120;
export const metadata: Metadata = { title: "Noticias etiquetadas", description: "Las noticias que el laboratorio ha leído y cómo las etiquetó la IA." };

export default async function NewsPage() {
  const { news, status } = await getLab();
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 pt-10">
      <header className="max-w-3xl space-y-3">
        <p className="eyebrow">Lo que escuchan los modelos</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Noticias etiquetadas</h1>
        <p className="text-ink-2">
          Cada 15 minutos el laboratorio busca noticias de sus mercados. Un modelo de lenguaje las convierte en etiquetas con un formato fijo, un
          validador las revisa y solo entonces pueden usarlas las reglas, nunca antes de la apertura siguiente a su publicación.
        </p>
        <p className="text-sm text-ink-3">
          {status.news?.total ?? news.length} noticias leídas · última publicada el {dayTime(status.news?.last_published)} · versión de etiquetas {status.taxonomy}
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {news.map((ev) => (
          <NewsCard key={ev.event_id} ev={ev} />
        ))}
      </div>
      <p className="max-w-3xl text-sm text-ink-3">
        Los titulares y enlaces pertenecen a sus medios. El resumen lo escribe un modelo y puede contener errores: sirve para explicar la etiqueta, no
        para informarse. Ninguna noticia aquí es una señal para operar.
      </p>
    </div>
  );
}
