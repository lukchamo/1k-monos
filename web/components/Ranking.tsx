import Link from "next/link";
import { FAMILY_COLOR } from "@/lib/site";
import { int, num, pct, tone } from "@/lib/format";
import type { Monkeys, RankRow } from "@/lib/types";

type Line = { kind: "investor"; row: RankRow; pos: number } | { kind: "marker"; label: string; hint: string; value: number };

/** mezcla a los inversionistas con las marcas de los monos, ordenado por retorno */
function lines(rows: RankRow[], monkeys: Monkeys | null, nTrials: number): Line[] {
  const out: Line[] = rows.map((row, i) => ({ kind: "investor", row, pos: i + 1 }));
  if (monkeys) {
    out.push(
      { kind: "marker", label: `El mejor de ${nTrials} monos`, hint: "Lo que se consigue por pura suerte probando tantas ideas. Para decir «esto funciona» hay que superar esta línea.", value: monkeys.best_of_n_p95 },
      { kind: "marker", label: "Mono con suerte (top 5 %)", hint: "Un mono entre veinte termina por encima de este resultado.", value: monkeys.p95 },
      { kind: "marker", label: "Mono mediano", hint: "La mitad de los monos lo hace mejor y la otra mitad peor.", value: monkeys.p50 },
    );
  }
  return out.sort((a, b) => (b.kind === "investor" ? b.row.total_return : b.value) - (a.kind === "investor" ? a.row.total_return : a.value));
}

function Meter({ value, threshold, label }: { value: number | null; threshold?: number; label: string }) {
  if (value == null) return <span className="text-ink-3">—</span>;
  const v = Math.max(0, Math.min(1, value));
  return (
    <span className="flex items-center justify-end gap-2" title={label}>
      <span className="relative hidden h-1.5 w-16 overflow-hidden rounded-full bg-flat sm:block" aria-hidden="true">
        <span className="absolute inset-y-0 left-0 rounded-full bg-ink-2" style={{ width: `${v * 100}%` }} />
        {threshold ? <span className="absolute inset-y-0 w-px bg-brand" style={{ left: `${threshold * 100}%` }} /> : null}
      </span>
      <span className="num w-10 text-right">{Math.round(v * 100)} %</span>
    </span>
  );
}

export function Ranking({ rows, monkeys, nTrials }: { rows: RankRow[]; monkeys: Monkeys | null; nTrials: number }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <caption className="sr-only">Ranking de inversionistas virtuales comparados con los monos que operan al azar</caption>
        <thead className="text-left text-xs text-ink-3">
          <tr className="border-b border-line">
            <th scope="col" className="px-4 py-3 font-medium">#</th>
            <th scope="col" className="px-2 py-3 font-medium">Inversionista</th>
            <th scope="col" className="px-2 py-3 text-right font-medium">Resultado</th>
            <th scope="col" className="px-2 py-3 text-right font-medium" title="Retorno por unidad de riesgo, anualizado">Sharpe</th>
            <th scope="col" className="px-2 py-3 text-right font-medium">Peor caída</th>
            <th scope="col" className="px-2 py-3 text-right font-medium">Operaciones</th>
            <th scope="col" className="px-2 py-3 text-right font-medium" title="A qué porcentaje de los monos supera">Gana a los monos</th>
            <th scope="col" className="px-4 py-3 text-right font-medium" title="Probabilidad de que la ventaja sea real y no suerte (Sharpe deflactado). Se exige 95 %.">
              ¿Es real?
            </th>
          </tr>
        </thead>
        <tbody>
          {lines(rows, monkeys, nTrials).map((l) =>
            l.kind === "marker" ? (
              <tr key={l.label} className="border-b border-dashed border-brand/40 bg-brand/[0.06]">
                <td className="px-4 py-2 text-base" aria-hidden="true">🐒</td>
                <td className="px-2 py-2" colSpan={1}>
                  <span className="font-medium text-brand">{l.label}</span>
                </td>
                <td className="num px-2 py-2 text-right text-brand">{pct(l.value)}</td>
                <td className="px-2 py-2 text-xs text-ink-3" colSpan={5}>{l.hint}</td>
              </tr>
            ) : (
              <tr key={l.row.investor_id} className="border-b border-line/70 last:border-0 hover:bg-surface-2">
                <td className="num px-4 py-2.5 text-ink-3">{l.pos}</td>
                <td className="px-2 py-2.5">
                  <Link href={`/inversionistas/${l.row.investor_id}`} className="group flex items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: FAMILY_COLOR[l.row.family] ?? "#888" }} aria-hidden="true" />
                    <span className="font-medium group-hover:text-brand">{l.row.name}</span>
                    <span className="text-xs text-ink-3">{l.row.family}</span>
                  </Link>
                </td>
                <td className={`num px-2 py-2.5 text-right font-medium ${tone(l.row.total_return)}`}>{pct(l.row.total_return)}</td>
                <td className="num px-2 py-2.5 text-right text-ink-2">{num(l.row.sharpe)}</td>
                <td className="num px-2 py-2.5 text-right text-ink-2">{pct(l.row.max_dd)}</td>
                <td className="num px-2 py-2.5 text-right text-ink-2">{int(l.row.trades)}</td>
                <td className="px-2 py-2.5 text-right text-ink-2">
                  <Meter value={l.row.pct_vs_monkeys == null ? null : l.row.pct_vs_monkeys / 100} label="Porcentaje de monos a los que supera" />
                </td>
                <td className="px-4 py-2.5 text-right text-ink-2">
                  <Meter value={l.row.dsr} threshold={0.95} label="Sharpe deflactado: se exige 95 %" />
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}
