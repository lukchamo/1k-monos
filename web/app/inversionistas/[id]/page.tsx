import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDecision, getLab, staticInvestorIds } from "@/lib/api";
import { FAMILY_BLURB, FAMILY_COLOR } from "@/lib/site";
import { day, int, num, pct, ruleText, tone } from "@/lib/format";
import { CurvesChart } from "@/components/CurvesChart";
import { DisclaimerNote } from "@/components/Disclaimer";

export const revalidate = 600;
// solo existen los inversionistas del elenco: cualquier otro id es un 404, sin render bajo demanda
export const dynamicParams = false;

export function generateStaticParams() {
  return staticInvestorIds().map((id) => ({ id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const inv = (await getLab()).investors.find((i) => i.id === id);
  return inv ? { title: inv.name, description: ruleText(inv.rule) } : {};
}

const WORD: Record<string, string> = { "1": "Comprado", "-1": "En corto", "0": "Fuera" };
const WORD_TONE: Record<string, string> = { "1": "text-up", "-1": "text-down", "0": "text-ink-3" };

export default async function InvestorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lab = await getLab();
  const inv = lab.investors.find((i) => i.id === id);
  if (!inv) notFound();

  const row = lab.ranking.rows.find((r) => r.investor_id === id);
  const pos = lab.positions.rows.find((r) => r.investor_id === id)?.positions ?? {};
  const symbols = Object.values(lab.universe.segments).flat();
  const rank = lab.ranking.rows.findIndex((r) => r.investor_id === id) + 1;
  const hold = lab.ranking.rows.find((r) => r.family === "Control");
  const color = FAMILY_COLOR[inv.family] ?? "#888";

  // una razón de ejemplo: el primer activo en el que tiene posición (o el primero del universo)
  const sample = symbols.find((s) => pos[s]) ?? symbols[0];
  const decision = await getDecision(id, sample);

  const values = lab.curves.series[id];
  const series = [inv, ...(hold && hold.investor_id !== id ? [lab.investors.find((i) => i.id === hold.investor_id)!] : [])].flatMap((i) => {
    const v = lab.curves.series[i.id];
    return v ? [{ id: i.id, name: i.name, family: i.family, color: FAMILY_COLOR[i.family] ?? "#888", values: v.map((x) => x ?? 1) }] : [];
  });

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 pt-8 sm:space-y-12 sm:pt-10">
      <header className="space-y-4">
        <Link href="/#ranking" className="text-sm text-ink-3 hover:text-ink">← Volver al ranking</Link>
        <div className="flex flex-wrap items-center gap-3">
          <span className="size-3 rounded-full" style={{ background: color }} aria-hidden="true" />
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{inv.name}</h1>
          <span className="rounded-full border border-line px-2.5 py-0.5 text-sm text-ink-2">{inv.family}</span>
        </div>
        <p className="max-w-3xl text-base text-ink-2 sm:text-lg">{ruleText(inv.rule)}</p>
        <p className="max-w-3xl text-sm text-ink-3">{FAMILY_BLURB[inv.family]}</p>
      </header>

      {row ? (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
          {[
            ["Puesto", `${rank} de ${lab.ranking.rows.length}`, ""],
            ["Resultado", pct(row.total_return), tone(row.total_return)],
            ["Sharpe", num(row.sharpe), ""],
            ["Peor caída", pct(row.max_dd), ""],
            ["Operaciones", int(row.trades), ""],
            ["¿Es real?", row.dsr == null ? "—" : `${Math.round(row.dsr * 100)} %`, ""],
          ].map(([k, v, t]) => (
            <div key={k} className="card p-4">
              <dt className="eyebrow">{k}</dt>
              <dd className={`num mt-1.5 text-xl font-semibold ${t}`}>{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {values && series.length ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Su capital frente a no hacer nada</h2>
          <CurvesChart dates={lab.curves.dates} series={series} defaults={series.map((s) => s.id)} />
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Qué tiene ahora</h2>
        <p className="text-sm text-ink-2">Decidido al cierre del {day(lab.positions.date)}.</p>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {symbols.map((s) => {
            const p = String(pos[s] ?? 0);
            return (
              <li key={s} className="card flex items-center justify-between px-3 py-2 text-sm">
                <span className="num">{s.replace("-USD", "")}</span>
                <span className={`text-xs ${WORD_TONE[p]}`}>{WORD[p]}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {decision?.reason ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Por qué decidió así en {sample}</h2>
          <p className="text-sm text-ink-2">Cada decisión guarda los números exactos que la produjeron. Esta es la del {day(decision.date)}:</p>
          <dl className="card grid gap-x-8 gap-y-2 p-5 text-sm sm:grid-cols-2">
            {Object.entries(decision.reason)
              .filter(([k]) => !["investor", "symbol", "date", "version"].includes(k))
              .map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-line/60 py-1.5">
                  <dt className="text-ink-3">{k}</dt>
                  <dd className="num break-all text-right">{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
                </div>
              ))}
          </dl>
        </section>
      ) : null}

      <section className="card space-y-2 p-5 text-sm text-ink-2">
        <p>
          Versión <span className="num text-ink">{inv.version}</span> · huella de configuración <span className="num text-ink">{inv.config_hash}</span>
        </p>
        <p>Cambiar un solo parámetro crea una versión nueva, y cada versión probada sube el listón de la suerte para todos.</p>
        <DisclaimerNote />
      </section>
    </div>
  );
}
