"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Chapter } from "@/lib/tutorial";

const STEP_MS = 9000;
const TICK_MS = 100;

/**
 * Tutorial interactivo: un vídeo que puedes tocar. Avanza solo por capítulos, pero en cada uno
 * puedes pausar, saltar y pulsar los puntos amarillos para leer qué es cada cosa.
 */
export function TutorialPlayer({ chapters }: { chapters: Chapter[] }) {
  const [i, setI] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [spot, setSpot] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const ch = chapters[i];

  const go = useCallback(
    (n: number) => {
      setI(((n % chapters.length) + chapters.length) % chapters.length);
      setElapsed(0);
      setSpot(null);
    },
    [chapters.length],
  );

  // el reloj del «vídeo»: se para si pausas, si abres un punto o si quien mira prefiere menos movimiento
  useEffect(() => {
    if (!playing || spot !== null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setElapsed((e) => e + TICK_MS);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [playing, spot]);

  useEffect(() => {
    if (elapsed >= STEP_MS) go(i + 1);
  }, [elapsed, i, go]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") go(i + 1);
    else if (e.key === "ArrowLeft") go(i - 1);
    else if (e.key === " " || e.key === "k") {
      e.preventDefault();
      setPlaying((p) => !p);
    } else if (e.key === "Escape") setSpot(null);
  };

  const open = spot !== null ? ch.spots[spot] : null;

  return (
    <div ref={root} tabIndex={0} onKeyDown={onKey} role="region" aria-label="Tutorial interactivo de 1K Monos" className="card overflow-hidden outline-none focus-visible:border-brand">
      {/* barra de capítulos, como las historias */}
      <div className="flex gap-1.5 p-3">
        {chapters.map((c, n) => (
          <button key={c.id} type="button" onClick={() => go(n)} aria-label={`Capítulo ${n + 1}: ${c.title}`} aria-current={n === i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
            <span className="block h-full bg-brand" style={{ width: n < i ? "100%" : n === i ? `${Math.min(100, (elapsed / STEP_MS) * 100)}%` : "0%" }} />
          </button>
        ))}
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        {/* la captura con sus puntos */}
        <div className="relative aspect-[16/10] bg-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={ch.id} src={ch.image} alt={`Captura de la sección «${ch.title}»`} width={1280} height={800} className="absolute inset-0 size-full object-cover object-top" />
          {ch.spots.map((s, n) => (
            <button
              key={`${ch.id}-${n}`}
              type="button"
              onClick={() => setSpot(spot === n ? null : n)}
              aria-expanded={spot === n}
              aria-label={`Explicación: ${s.title}`}
              style={{ left: `${s.x}%`, top: `${s.y}%` }}
              className="absolute grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
            >
              <span className={`absolute inline-block size-7 rounded-full bg-brand/30 ${spot === null ? "pulse-dot" : ""}`} aria-hidden="true" />
              <span className={`num relative grid size-5 place-items-center rounded-full text-[0.7rem] font-bold ${spot === n ? "bg-ink text-bg" : "bg-brand text-brand-ink"}`}>{n + 1}</span>
            </button>
          ))}
          {open ? (
            <div role="status" className="absolute inset-x-3 bottom-3 rounded-xl border border-brand/60 bg-bg/95 p-3 backdrop-blur sm:inset-x-auto sm:left-3 sm:max-w-sm">
              <p className="font-medium text-brand">{open.title}</p>
              <p className="mt-1 text-sm text-ink">{open.text}</p>
            </div>
          ) : null}
        </div>

        {/* la explicación */}
        <div className="flex flex-col gap-3 border-t border-line p-4 sm:p-5 lg:border-l lg:border-t-0">
          <p className="eyebrow">Paso {i + 1} de {chapters.length}</p>
          <h3 className="text-xl font-semibold tracking-tight">{ch.title}</h3>
          <p className="text-sm text-ink-2">{ch.lead}</p>
          <ol className="space-y-1.5 text-sm">
            {ch.spots.map((s, n) => (
              <li key={s.title}>
                <button type="button" onClick={() => setSpot(spot === n ? null : n)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2 ${spot === n ? "bg-surface-2" : ""}`}>
                  <span className="num grid size-5 shrink-0 place-items-center rounded-full bg-brand text-[0.7rem] font-bold text-brand-ink">{n + 1}</span>
                  {s.title}
                </button>
              </li>
            ))}
          </ol>
          <Link href={ch.href} className="mt-auto inline-block self-start rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-ink hover:brightness-110">
            {ch.cta} →
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line p-3">
        <button type="button" onClick={() => go(i - 1)} className="rounded-lg border border-line px-3 py-2 text-sm hover:border-ink-2">← Anterior</button>
        <button type="button" onClick={() => setPlaying((p) => !p)} aria-pressed={!playing} className="rounded-lg border border-line px-3 py-2 text-sm hover:border-ink-2">
          {playing ? "Pausar" : "Reproducir"}
        </button>
        <button type="button" onClick={() => go(i + 1)} className="rounded-lg border border-line px-3 py-2 text-sm hover:border-ink-2">Siguiente →</button>
        <span className="ml-auto hidden text-xs text-ink-3 sm:inline">Teclado: ← → para moverte, espacio para pausar</span>
      </div>
    </div>
  );
}
