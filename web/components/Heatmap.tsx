import Link from "next/link";
import type { Investor, Positions, Universe } from "@/lib/types";

// clases cortas a propósito: son 667 celdas y cada carácter se multiplica en el HTML
const HM: Record<string, string> = { "1": "hm u", "-1": "hm d", "0": "hm z" };

function summary(pos: Record<string, number> | undefined, symbols: string[]): string {
  const long = symbols.filter((s) => pos?.[s] === 1);
  const short = symbols.filter((s) => pos?.[s] === -1);
  return `Comprado: ${long.join(", ") || "nada"}. En corto: ${short.join(", ") || "nada"}.`;
}

/** qué tiene cada inversionista en cada activo tras el último cierre: verde largo, rojo corto, gris fuera */
export function Heatmap({ positions, investors, universe }: { positions: Positions; investors: Investor[]; universe: Universe }) {
  const symbols = Object.values(universe.segments).flat();
  const byId = new Map(positions.rows.map((r) => [r.investor_id, r.positions]));
  const segments = Object.entries(universe.segments);

  return (
    <div className="card overflow-x-auto p-4">
      <table className="w-full min-w-[900px] table-fixed border-separate border-spacing-[3px] text-xs" aria-describedby="hm-leyenda">
        <caption className="sr-only">Posición de cada inversionista en cada activo</caption>
        <colgroup>
          <col className="w-44" />
        </colgroup>
        <thead>
          <tr>
            <td />
            {segments.map(([seg, syms]) => (
              <th key={seg} scope="colgroup" colSpan={syms.length} className="px-1 pb-1 text-left align-bottom font-normal text-ink-3">
                <span className="block truncate" title={seg}>{seg}</span>
              </th>
            ))}
          </tr>
          <tr>
            <td />
            {symbols.map((s) => (
              <th key={s} scope="col" className="num h-16 w-7 align-bottom font-normal text-ink-2">
                <span className="inline-block origin-bottom-left translate-x-4 -rotate-60 whitespace-nowrap">{s.replace("-USD", "")}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {investors.map((inv) => {
            const pos = byId.get(inv.id);
            return (
              <tr key={inv.id}>
                <th scope="row" className="whitespace-nowrap pr-3 text-left font-normal">
                  <Link href={`/inversionistas/${inv.id}`} className="text-ink-2 hover:text-brand">
                    {inv.name}
                  </Link>
                </th>
                {symbols.map((s) => (
                  <td key={s} className={HM[String(pos?.[s] ?? 0)] ?? "hm z"} />
                ))}
                {/* una sola frase por fila para lectores de pantalla, en vez de 23 celdas mudas */}
                <td className="sr-only">{summary(pos, symbols)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div id="hm-leyenda" className="mt-4 flex flex-wrap gap-4 text-xs text-ink-2">
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-[3px] bg-up" aria-hidden="true" />Comprado (largo)</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-[3px] bg-down" aria-hidden="true" />Vendido en corto</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-[3px] bg-flat" aria-hidden="true" />Fuera</span>
      </div>
    </div>
  );
}
