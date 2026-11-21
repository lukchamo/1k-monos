import { dayTime, directionLabel, eventLabel } from "@/lib/format";
import type { NewsItem } from "@/lib/types";

const DIR_TONE: Record<string, string> = { bullish: "text-up border-up/40", bearish: "text-down border-down/40" };

function Sentiment({ v }: { v: number }) {
  const w = Math.min(1, Math.abs(v)) * 50;
  return (
    <span className="relative inline-block h-1.5 w-12 rounded-full bg-flat align-middle" aria-hidden="true">
      <span className={`absolute inset-y-0 rounded-full ${v >= 0 ? "bg-up" : "bg-down"}`} style={v >= 0 ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }} />
    </span>
  );
}

export function NewsCard({ ev }: { ev: NewsItem }) {
  const dir = ev.signal?.direction ?? "";
  return (
    <article className="card flex min-w-0 flex-col gap-3 p-4">
      <header className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
        <span className={`rounded-full border px-2 py-0.5 ${DIR_TONE[dir] ?? "border-line text-ink-2"}`}>{directionLabel(dir)}</span>
        <span>{eventLabel(ev.event_type)}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={ev.published_at}>{dayTime(ev.published_at)}</time>
      </header>
      <h3 className="text-[0.95rem] font-medium leading-snug">{ev.title}</h3>
      <p className="text-sm text-ink-2">{ev.summary_es}</p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {ev.entities.map((e) => (
          <li key={e.symbol} className="flex items-center gap-1.5" title={`Sentimiento ${e.sentiment.toFixed(2)} · confianza ${Math.round(e.confidence * 100)} %`}>
            <span className="num text-ink">{e.symbol}</span>
            <Sentiment v={e.sentiment} />
          </li>
        ))}
      </ul>
      <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs text-ink-3">
        {ev.source?.url ? (
          <a href={ev.source.url} target="_blank" rel="noreferrer noopener nofollow" className="underline underline-offset-2 hover:text-ink">
            {ev.source.name ?? "Fuente"}
          </a>
        ) : (
          <span>{ev.source?.name ?? "Fuente"}</span>
        )}
        <span title="Desde cuándo pueden usarla las reglas: la apertura siguiente a su publicación">
          Cuenta desde <time dateTime={ev.effective_at}>{dayTime(ev.effective_at)}</time>
        </span>
      </footer>
    </article>
  );
}
