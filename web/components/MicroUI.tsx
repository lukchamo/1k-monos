import { int, num, pct } from "@/lib/format";
import { read, type Block, type Format, type MicroUI } from "@/lib/microui";

function show(v: unknown, f?: Format): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return f === "pct" ? pct(v) : f === "int" ? int(Math.round(v)) : f === "num" ? num(v) : Number.isInteger(v) ? int(v) : num(v);
  if (typeof v === "string") return v.slice(0, 140);
  if (typeof v === "boolean") return v ? "sí" : "no";
  return "—";
}

function BlockView({ block, data }: { block: Block; data: unknown }) {
  switch (block.type) {
    case "text":
      return <p className="text-sm text-ink-2">{block.text}</p>;
    case "stat":
      return (
        <div className="rounded-lg bg-surface-2 px-3 py-2.5">
          <p className="text-xs text-ink-3">{block.label}</p>
          <p className="num mt-0.5 break-words text-sm font-semibold leading-snug">{show(read(data, block.source), block.format)}</p>
        </div>
      );
    case "bars": {
      const rows = read(data, block.source);
      if (!Array.isArray(rows)) return null;
      const items = rows.slice(0, block.limit ?? 8).map((r) => ({ label: show(read(r, block.label)), value: read(r, block.value) }));
      const nums = items.map((i) => (typeof i.value === "number" ? i.value : 0));
      const scale = block.max ?? Math.max(...nums.map(Math.abs), 1e-9);
      return (
        <div className="space-y-2">
          {block.title ? <p className="text-xs text-ink-3">{block.title}</p> : null}
          <ul className="space-y-1.5">
            {items.map((it, i) => (
              <li key={`${it.label}-${i}`} className="grid grid-cols-[minmax(0,7rem)_1fr_3.5rem] sm:grid-cols-[minmax(0,9rem)_1fr_3.5rem] items-center gap-2 text-xs">
                <span className="truncate text-ink-2">{it.label}</span>
                <span className="h-2 overflow-hidden rounded-full bg-flat" aria-hidden="true">
                  <span className={`block h-full rounded-full ${nums[i] >= 0 ? "bg-up" : "bg-down"}`} style={{ width: `${Math.min(100, (Math.abs(nums[i]) / scale) * 100)}%` }} />
                </span>
                <span className="num text-right">{show(it.value, block.format)}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case "table": {
      const rows = read(data, block.source);
      if (!Array.isArray(rows)) return null;
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-ink-3">
              <tr>{block.columns.map((c) => <th key={c.field} scope="col" className="py-1.5 pr-3 font-normal">{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {rows.slice(0, block.limit ?? 5).map((r, i) => (
                <tr key={i} className="border-t border-line/60">
                  {block.columns.map((c) => <td key={c.field} className="max-w-[16rem] truncate py-1.5 pr-3">{show(read(r, c.field))}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
  }
}

export function MicroUICard({ ui, data }: { ui: MicroUI; data: unknown }) {
  const stats = ui.blocks.filter((b) => b.type === "stat");
  const rest = ui.blocks.filter((b) => b.type !== "stat");
  return (
    <article className="card flex min-w-0 flex-col gap-4 p-4 sm:p-5">
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-medium">{ui.title}</h2>
          <span className="num shrink-0 rounded-full border border-line px-2 py-0.5 text-[0.7rem] text-ink-3">{ui.author}</span>
        </div>
        <p className="text-sm text-ink-2">{ui.description}</p>
      </header>
      {stats.length ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {stats.map((b, i) => <BlockView key={i} block={b} data={data} />)}
        </div>
      ) : null}
      {rest.map((b, i) => <BlockView key={i} block={b} data={data} />)}
    </article>
  );
}
