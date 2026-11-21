import type { Metadata } from "next";
import Link from "next/link";
import { getLab } from "@/lib/api";
import { FAMILY_BLURB, FAMILY_COLOR, SITE } from "@/lib/site";
import { int, pct } from "@/lib/format";

export const revalidate = 3600;
export const metadata: Metadata = { title: "Cómo funciona", description: "El método del laboratorio: reglas fijas, sin mirar el futuro y con la suerte medida." };

const STEPS = [
  { n: "1", t: "Llegan precios y noticias", d: "Tras el cierre de Wall Street se guardan los precios del día. Cada 15 minutos se buscan noticias de los mercados del experimento." },
  { n: "2", t: "La IA etiqueta, no opina", d: "Un modelo de lenguaje convierte cada noticia en un formulario fijo: activo, dirección, sorpresa, horizonte. Un validador rechaza lo que no encaja." },
  { n: "3", t: "Las reglas deciden", d: "Cada inversionista aplica su regla a los datos disponibles hasta ese cierre. La decisión se ejecuta en la sesión siguiente, con comisiones." },
  { n: "4", t: "Se mide contra el azar", d: "Miles de monos operan al azar el mismo periodo. Un inversionista solo «gana» si supera lo que consigue el mejor mono por pura suerte." },
];

const RULES = [
  ["Determinismo", "Mismas entradas, mismo resultado al céntimo. No hay azar dentro del motor, salvo en los monos, que usan una semilla pública."],
  ["Sin mirar el futuro", "Ninguna regla lee un dato posterior a su momento de decisión. Un test corta los precios en varias fechas y comprueba que todos deciden igual."],
  ["Costes siempre", "Cada cambio de posición paga 10 puntos básicos y estar en corto tiene un coste diario. Sin costes, operar mucho parece genial."],
  ["Todo versionado", "Cambiar un parámetro, un peso o una instrucción del modelo crea una versión nueva. Cada intento cuenta en el control de suerte."],
  ["Dos motores que coinciden", "La referencia en Python y el motor en TypeScript deben dar las mismas posiciones, activo por activo y día por día. Si no coinciden, no se publica."],
  ["Reglas iguales para todos", "No hay perfiles ni consejos personalizados. El laboratorio enseña cómo se comportan las reglas, no qué hacer con tu dinero."],
];

export default async function MethodPage() {
  const { ranking, investors, status } = await getLab();
  const mk = ranking.monkeys;
  const families = [...new Set(investors.map((i) => i.family))];
  const nTrials = status.last_run?.n_trials ?? investors.length;

  return (
    <div className="mx-auto max-w-4xl space-y-14 px-4 pt-10">
      <header className="space-y-4">
        <p className="eyebrow">Método</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Cómo funciona el laboratorio</h1>
        <p className="text-lg text-ink-2">
          La pregunta es sencilla: si pruebas muchas ideas de inversión, alguna va a salir bien por casualidad. ¿Cómo distingues una buena idea de un mono con
          suerte? Este laboratorio lo mide en abierto.
        </p>
      </header>

      <ol className="grid gap-4 sm:grid-cols-2">
        {STEPS.map((s) => (
          <li key={s.n} className="card p-5">
            <span className="num text-sm text-brand">Paso {s.n}</span>
            <h2 className="mt-1 font-medium">{s.t}</h2>
            <p className="mt-2 text-sm text-ink-2">{s.d}</p>
          </li>
        ))}
      </ol>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Por qué hay monos</h2>
        <div className="space-y-3 text-ink-2">
          <p>
            Un mono es un inversionista que decide tirando una moneda. Soltamos {mk ? int(mk.n) : "miles"} a operar el mismo periodo y con los
            mismos costes. Su resultado mediano fue {pct(mk?.p50)}; uno de cada veinte superó {pct(mk?.p95)}.
          </p>
          <p>
            Pero aquí se prueban {nTrials} ideas a la vez. Si eliges la mejor de {nTrials} monos, lo normal es que haya ganado hasta{" "}
            <strong className="text-brand">{pct(mk?.best_of_n_p95)}</strong> sin saber nada. Ese es el listón: quien no lo supera no ha demostrado nada.
          </p>
          <p>
            La columna «¿Es real?» del ranking es el Sharpe deflactado: la probabilidad de que la ventaja de un inversionista no sea suerte, descontando cuántas
            ideas se probaron. Se exige un 95 % antes de tomarse en serio un resultado.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Las familias de inversionistas</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {families.map((f) => (
            <li key={f} className="card flex gap-3 p-4">
              <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: FAMILY_COLOR[f] }} aria-hidden="true" />
              <div>
                <h3 className="font-medium">
                  {f} <span className="num text-sm text-ink-3">× {investors.filter((i) => i.family === f).length}</span>
                </h3>
                <p className="mt-1 text-sm text-ink-2">{FAMILY_BLURB[f]}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Reglas que no se negocian</h2>
        <dl className="divide-y divide-line rounded-[14px] border border-line bg-surface">
          {RULES.map(([t, d]) => (
            <div key={t} className="grid gap-1 p-4 sm:grid-cols-[14rem_1fr] sm:gap-6">
              <dt className="font-medium">{t}</dt>
              <dd className="text-sm text-ink-2">{d}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Compruébalo tú</h2>
        <p className="text-ink-2">
          El motor, los datos del experimento, los tests y esta web están en el repositorio. También hay una API pública de solo lectura y un servidor MCP para
          consultar el laboratorio desde un asistente de IA.
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          <a href={SITE.repo} target="_blank" rel="noreferrer" className="rounded-lg bg-brand px-4 py-2.5 font-medium text-brand-ink hover:brightness-110">Repositorio</a>
          <a href={`${SITE.repo}/blob/main/docs/ALGORITMOS.md`} target="_blank" rel="noreferrer" className="rounded-lg border border-line px-4 py-2.5 hover:border-ink-2">Las reglas, una a una</a>
          <Link href="/aviso" className="rounded-lg border border-line px-4 py-2.5 hover:border-ink-2">Aviso legal</Link>
        </div>
      </section>
    </div>
  );
}
