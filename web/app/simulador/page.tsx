import type { Metadata } from "next";
import { getLab } from "@/lib/api";
import { Playground } from "@/components/Playground";

export const revalidate = 600;
export const metadata: Metadata = {
  title: "Simulador",
  description: "Prueba con dinero ficticio cómo habría ido seguir a un inversionista del laboratorio o a un mono, con comisiones reales y con o sin apalancamiento.",
};

export default async function SimulatorPage() {
  const { investors, ranking } = await getLab();
  // por defecto, el primero del ranking que no sea el control
  const best = ranking.rows.find((r) => r.family !== "Control")?.investor_id ?? investors[0]?.id ?? "";
  const options = investors.filter((i) => i.family !== "Control").map((i) => ({ id: i.id, name: i.name, family: i.family }));

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 pt-8 sm:pt-10">
      <header className="max-w-3xl space-y-3">
        <p className="eyebrow">Simulador · dinero ficticio</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">¿Y si lo hubieras seguido con 200 €?</h1>
        <p className="text-ink-2">
          Elige a un inversionista del laboratorio, o a un mono, y mira qué habría pasado con tu dinero día a día: con las comisiones del bróker, con o sin
          apalancamiento. Usa los precios reales del experimento y sigue escuchando: cuando entra un cierre nuevo, la simulación avanza sola.
        </p>
      </header>

      <Playground options={options} defaultId={best} />

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["Es dinero de mentira", "Nada de esto se ejecuta en ningún bróker. Es una cuenta ficticia para entender cómo se comportan las reglas y cuánto pesan los costes."],
          ["Los costes son aproximados", "De Neverless usamos lo que publica (comisión cero, cambio de divisa gratis, hasta 5×). Su diferencial y sus intereses no son públicos: son supuestos que puedes cambiar."],
          ["El pasado no se repite", "Que una regla haya ganado en este periodo no dice que vaya a ganar después. Compárala siempre con el mono y con no hacer nada."],
        ].map(([t, d]) => (
          <div key={t} className="card p-5">
            <h2 className="font-medium">{t}</h2>
            <p className="mt-2 text-sm text-ink-2">{d}</p>
          </div>
        ))}
      </section>

      <p className="max-w-3xl text-sm text-ink-3">
        Cómo se calcula: al cierre de cada día la cartera se ajusta a lo que decide el inversionista y gana o pierde con el movimiento del día siguiente. El
        dinero se reparte a partes iguales entre todos los activos. Con apalancamiento, el bróker cierra todo si tu dinero cae por debajo de un colchón
        mínimo. Esto es un experimento educativo, no una recomendación de inversión.
      </p>
    </div>
  );
}
