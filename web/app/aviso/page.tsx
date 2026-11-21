import type { Metadata } from "next";

export const metadata: Metadata = { title: "Aviso", description: "Esto es un laboratorio experimental. No es una recomendación de inversión." };

const POINTS = [
  ["No es una recomendación", "Nada de lo que se muestra aquí es una recomendación, una señal ni una invitación a comprar, vender o mantener ningún activo. No es asesoramiento financiero, fiscal ni legal."],
  ["Es un experimento", "Los inversionistas son programas con reglas fijas. Operan con dinero ficticio. Sus resultados son simulaciones con datos históricos y de paper trading, y pueden contener errores."],
  ["El pasado no anticipa el futuro", "Que una regla haya ganado en un periodo no dice que vaya a ganar en el siguiente. El propio laboratorio existe para mostrar cuánto de un buen resultado puede ser suerte."],
  ["Reglas iguales para todos", "El laboratorio no conoce tu situación ni la tiene en cuenta. No hay perfiles, ni carteras a medida, ni respuestas a qué deberías hacer con tu dinero."],
  ["La IA puede equivocarse", "Los modelos de lenguaje solo etiquetan noticias. Sus resúmenes y etiquetas pueden ser incorrectos o incompletos. Las noticias enlazadas pertenecen a sus medios."],
  ["Datos sin garantía", "Los precios y noticias vienen de terceros y pueden llegar tarde, incompletos o con errores. La web puede mostrar una foto anterior si la fuente de datos no responde."],
  ["Tú decides y tú respondes", "Si inviertes, hazlo con tu propio criterio o con un profesional autorizado. Los autores y colaboradores del proyecto no se hacen responsables de decisiones tomadas a partir de este contenido."],
];

export default function NoticePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 pt-10">
      <header className="space-y-4">
        <p className="eyebrow">Aviso</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Esto es un laboratorio, no un consejo</h1>
        <p className="text-lg text-ink-2">
          1K Monos es un proyecto educativo, abierto y experimental para aprender a interpretar mercados y a desconfiar de los resultados bonitos. Léelo así.
        </p>
      </header>
      <dl className="space-y-4">
        {POINTS.map(([t, d]) => (
          <div key={t} className="card p-5">
            <dt className="font-medium">{t}</dt>
            <dd className="mt-1.5 text-ink-2">{d}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-ink-3">
        Proyecto de código abierto de CooWeb y LuchoIA. El laboratorio no presta servicios de inversión ni está registrado ante ningún supervisor financiero,
        porque no asesora, no gestiona dinero y no recibe órdenes de nadie.
      </p>
    </div>
  );
}
