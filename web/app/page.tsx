import Link from "next/link";
import { getLab } from "@/lib/api";
import { FAMILY_COLOR, SITE } from "@/lib/site";
import { day, int, pct, pct0 } from "@/lib/format";
import { CurvesChart, type Serie } from "@/components/CurvesChart";
import { DisclaimerNote } from "@/components/Disclaimer";
import { Heatmap } from "@/components/Heatmap";
import { LivePulse } from "@/components/LivePulse";
import { NewsCard } from "@/components/News";
import { Ranking } from "@/components/Ranking";

// ISR: la portada se regenera como mucho cada 5 minutos; entre medias se sirve desde la caché
export const revalidate = 300;

const CURVE_STEP = 3; // una de cada tres sesiones: menos peso en la página, misma forma

function Stat({ label, value, hint, tone = "" }: { label: string; value: string; hint: string; tone?: string }) {
  return (
    <div className="card p-3 sm:p-4">
      <p className="eyebrow">{label}</p>
      <p className={`num mt-1.5 text-2xl font-semibold tracking-tight sm:mt-2 sm:text-3xl ${tone}`}>{value}</p>
      <p className="mt-1 text-[0.8rem] leading-snug text-ink-2 sm:mt-1.5 sm:text-sm">{hint}</p>
    </div>
  );
}

export default async function Home() {
  const lab = await getLab();
  const { ranking, curves, status, news, positions, investors, universe } = lab;
  const rows = ranking.rows;
  const theses = rows.filter((r) => r.family !== "Control");
  const best = theses[0];
  const worst = theses[theses.length - 1];
  const hold = rows.find((r) => r.family === "Control");
  const mk = ranking.monkeys;
  const nTrials = status.last_run?.n_trials ?? theses.length;
  const beatsLuck = theses.filter((r) => mk && r.total_return > mk.best_of_n_p95).length;

  const idx = curves.dates.map((_, i) => i).filter((i) => i % CURVE_STEP === 0 || i === curves.dates.length - 1);
  const famOf = new Map(investors.map((i) => [i.id, i]));
  const series: Serie[] = rows.flatMap((r) => {
    const raw = curves.series[r.investor_id];
    if (!raw) return [];
    return [{ id: r.investor_id, name: r.name, family: r.family, color: FAMILY_COLOR[famOf.get(r.investor_id)?.family ?? r.family] ?? "#888", values: idx.map((i) => raw[i] ?? 1) }];
  });
  const defaults = [best?.investor_id, worst?.investor_id, hold?.investor_id].filter(Boolean) as string[];

  return (
    <div className="mx-auto max-w-6xl space-y-14 px-4 pt-8 sm:space-y-20 sm:pt-10">
      <section className="space-y-8">
        <div className="max-w-3xl space-y-5">
          <p className="eyebrow">Experimento abierto · en curso</p>
          <h1 className="text-balance text-[2.1rem] font-semibold leading-[1.1] tracking-tight sm:text-6xl sm:leading-[1.08]">
            ¿Le gana una buena idea a <span className="text-brand">{mk ? int(mk.n) : "miles de"} monos</span> lanzando dardos?
          </h1>
          <p className="text-pretty text-base text-ink-2 sm:text-lg">
            {investors.length} inversionistas virtuales, cada uno con una regla fija y pública, operan sobre {Object.values(universe.segments).flat().length}{" "}
            mercados reales. Los medimos contra monos que compran y venden al azar. Todo el código, los datos y las decisiones están a la vista.
          </p>
          <div className="flex flex-wrap gap-2.5 text-sm sm:gap-3">
            <a href="#ranking" className="rounded-lg bg-brand px-4 py-2.5 font-medium text-brand-ink hover:brightness-110">Ver el ranking</a>
            <Link href="/metodo" className="rounded-lg border border-line px-4 py-2.5 hover:border-ink-2">Cómo funciona</Link>
            <a href={SITE.repo} target="_blank" rel="noreferrer" className="rounded-lg border border-line px-4 py-2.5 hover:border-ink-2">Ver el código</a>
          </div>
        </div>

        <LivePulse
          initial={{
            live: lab.live,
            now: lab.taken_at,
            market_day: status.market_day?.date ?? null,
            last_news: status.news?.last_published ?? null,
            news_total: status.news?.total ?? 0,
            paper_date: status.paper?.last_date ?? null,
            headline: news[0]?.title ?? null,
          }}
        />

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Stat label="El mejor" value={pct(best?.total_return)} hint={`${best?.name ?? "—"} en el periodo`} tone={best && best.total_return >= 0 ? "text-up" : "text-down"} />
          <Stat label="Listón de la suerte" value={pct(mk?.best_of_n_p95)} hint={`Lo que gana el mejor de ${nTrials} monos`} tone="text-brand" />
          <Stat label="Superan la suerte" value={`${beatsLuck} de ${theses.length}`} hint={beatsLuck ? "Por ahora. Falta confirmarlo en vivo." : "Nadie ha demostrado ventaja todavía"} />
          <Stat label="Comprar y esperar" value={pct(hold?.total_return)} hint="No hacer nada, como referencia" tone={hold && hold.total_return >= 0 ? "text-up" : "text-down"} />
        </div>
      </section>

      <section id="ranking" className="scroll-mt-24 space-y-5">
        <div className="max-w-3xl space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Ranking contra los monos</h2>
          <p className="text-ink-2">
            Del {day(status.last_run?.start_date)} al {day(status.last_run?.end_date)}, con comisiones y coste de vender en corto incluidos. Las filas
            amarillas son los monos: quedar por encima del mono mediano no demuestra nada.
          </p>
        </div>
        <Ranking rows={rows} monkeys={mk} nTrials={nTrials} />
        <DisclaimerNote />
      </section>

      <section id="curvas" className="scroll-mt-24 space-y-5">
        <div className="max-w-3xl space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Cómo le fue a cada uno</h2>
          <p className="text-ink-2">Cada línea es el capital de un inversionista, empezando todos igual. Elige una familia para compararla con el resto.</p>
        </div>
        {series.length ? <CurvesChart dates={idx.map((i) => curves.dates[i])} series={series} defaults={defaults} /> : null}
      </section>

      <section id="posiciones" className="scroll-mt-24 space-y-5">
        <div className="max-w-3xl space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Qué tiene cada uno ahora</h2>
          <p className="text-ink-2">
            Posiciones decididas al cierre del {day(positions.date)}. Cada inversionista decide con los datos de ese día y nada posterior. Pulsa un nombre
            para ver su regla y por qué decidió así.
          </p>
        </div>
        {positions.rows.length ? <Heatmap positions={positions} investors={investors} universe={universe} /> : <p className="card p-6 text-ink-2">Todavía no hay decisiones registradas.</p>}
      </section>

      <section id="noticias" className="scroll-mt-24 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="max-w-3xl space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">Lo que están leyendo los modelos</h2>
            <p className="text-ink-2">
              La IA solo convierte cada noticia en etiquetas: a qué activo afecta, en qué dirección y con cuánta sorpresa. No decide ninguna operación.
            </p>
          </div>
          <Link href="/noticias" className="text-sm text-brand underline-offset-4 hover:underline">Todas las noticias</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {news.slice(0, 6).map((ev) => (
            <NewsCard key={ev.event_id} ev={ev} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { t: "Las reglas deciden, no la IA", d: "Mismas entradas, mismo resultado al céntimo. Cualquiera puede repetir el experimento y comprobarlo." },
          { t: "Nadie mira el futuro", d: "Cada decisión usa solo datos anteriores a ese momento. Un test automático lo vigila en cada cambio." },
          { t: "La suerte se mide", d: `Con ${nTrials} ideas probadas, alguna gana por azar. Por eso el listón es el mejor de ${nTrials} monos, no el mono medio.` },
        ].map((c) => (
          <div key={c.t} className="card p-5">
            <h3 className="font-medium">{c.t}</h3>
            <p className="mt-2 text-sm text-ink-2">{c.d}</p>
          </div>
        ))}
      </section>

      <section className="card flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl space-y-1.5">
          <h2 className="text-xl font-semibold tracking-tight">Es de código abierto. Rómpelo.</h2>
          <p className="text-ink-2">
            Propón un inversionista nuevo, discute una regla o encuentra un fallo en el método. Cada variante que se prueba cuenta en el control de suerte
            {mk ? `, y hoy el listón está en ${pct0(mk.best_of_n_p95)}` : ""}.
          </p>
        </div>
        <a href={SITE.repo} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-bg hover:bg-brand">
          Contribuir en GitHub
        </a>
      </section>
    </div>
  );
}
