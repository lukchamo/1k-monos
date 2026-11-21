import { day, pct } from "@/lib/format";
import type { Calls } from "@/lib/types";

const side = (d: number) => (d > 0 ? "Largo" : "Corto");

/** llamadas de consenso y cómo salieron al cierre siguiente */
export function CallsTable({ data }: { data: Calls }) {
  const rec = data.record;
  return (
    <div className="space-y-3">
      {rec && rec.total ? (
        <p className="text-sm text-ink-2">
          Verificadas hasta ahora: <span className="num text-ink">{rec.hits} de {rec.total}</span> acertaron la dirección
          {rec.avg_ret != null ? <>, con <span className="num text-ink">{pct(rec.avg_ret)}</span> de media por llamada</> : null}. Son muy pocas para sacar conclusiones.
        </p>
      ) : null}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <caption className="sr-only">Llamadas de consenso del laboratorio y su verificación</caption>
          <thead className="text-left text-xs text-ink-3">
            <tr className="border-b border-line">
              <th scope="col" className="px-3 py-3 font-medium md:px-4">Cierre</th>
              <th scope="col" className="px-2 py-3 font-medium">Activo</th>
              <th scope="col" className="px-2 py-3 font-medium">Dirección</th>
              <th scope="col" className="hidden px-2 py-3 text-right font-medium sm:table-cell">Largos / cortos</th>
              <th scope="col" className="px-3 py-3 text-right font-medium md:px-4">Al día siguiente</th>
            </tr>
          </thead>
          <tbody>
            {data.calls.map((c) => (
              <tr key={`${c.date}-${c.symbol}`} className="border-b border-line/70 last:border-0">
                <td className="num whitespace-nowrap px-3 py-2.5 text-ink-2 md:px-4">{day(c.date)}</td>
                <td className="num px-2 py-2.5">{c.symbol.replace("-USD", "")}</td>
                <td className={`px-2 py-2.5 ${c.direction > 0 ? "text-up" : "text-down"}`}>{side(c.direction)}</td>
                <td className="num hidden px-2 py-2.5 text-right text-ink-2 sm:table-cell">{c.n_long} / {c.n_short}</td>
                <td className="num px-3 py-2.5 text-right md:px-4">
                  {c.ret == null ? <span className="text-ink-3">pendiente</span> : <span className={c.hit ? "text-up" : "text-down"}>{pct(c.ret)} {c.hit ? "✓" : "✗"}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
