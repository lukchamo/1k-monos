"use client";

import { useEffect, useRef, useState } from "react";

interface Pulse {
  live: boolean;
  now: string;
  market_day: string | null;
  last_news: string | null;
  news_total: number;
  paper_date: string | null;
  headline: string | null;
}

const POLL_MS = 30_000;
const rel = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

function ago(iso: string | null, now: number): string {
  if (!iso) return "sin datos";
  const s = Math.round((Date.parse(iso) - now) / 1000);
  const a = Math.abs(s);
  if (a < 90) return rel.format(Math.round(s / 1), "second");
  if (a < 5400) return rel.format(Math.round(s / 60), "minute");
  if (a < 129_600) return rel.format(Math.round(s / 3600), "hour");
  return rel.format(Math.round(s / 86_400), "day");
}

/**
 * Indicador en vivo: pregunta por el pulso del laboratorio cada 30 s mientras la pestaña está
 * visible. Arranca con el dato del servidor, así que no parpadea al hidratar.
 */
export function LivePulse({ initial }: { initial: Pulse }) {
  const [pulse, setPulse] = useState(initial);
  const [now, setNow] = useState(() => Date.parse(initial.now));
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/live", { headers: { accept: "application/json" } });
        if (!res.ok) return;
        const next = (await res.json()) as Pulse;
        if (alive) {
          setPulse(next);
          setNow(Date.now());
        }
      } catch {
        /* sin red: se queda con el último pulso */
      }
    };
    tick();
    timer.current = setInterval(tick, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      if (timer.current) clearInterval(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <div className="card flex flex-col gap-x-6 gap-y-1.5 px-4 py-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-y-2" aria-live="polite">
      <span className="flex items-center gap-2 font-medium">
        <span className={`inline-block size-2.5 rounded-full ${pulse.live ? "pulse-dot bg-up" : "bg-ink-3"}`} aria-hidden="true" />
        {pulse.live ? "Escuchando el mercado" : "Foto del experimento"}
      </span>
      <span className="text-ink-2">
        Última noticia etiquetada <span className="num text-ink">{ago(pulse.last_news, now)}</span>
      </span>
      <span className="text-ink-2">
        Último cierre procesado <span className="num text-ink">{pulse.market_day ?? "—"}</span>
      </span>
      <span className="text-ink-2">
        Noticias leídas <span className="num text-ink">{pulse.news_total}</span>
      </span>
      {pulse.headline ? <span className="line-clamp-2 text-ink-3 sm:basis-full sm:truncate md:basis-auto md:flex-1 md:text-right">«{pulse.headline}»</span> : null}
    </div>
  );
}
