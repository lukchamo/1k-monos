"use client";

import { useMemo, useState } from "react";

export interface Serie {
  id: string;
  name: string;
  family: string;
  color: string;
  values: number[];
}

const W = 960;
const H = 380;
const PAD = { l: 56, r: 12, t: 12, b: 26 };

const pctFmt = new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" });
const dateFmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" });

/**
 * Curvas de capital de todos los inversionistas. Por defecto se ven todas en gris con la mejor,
 * la peor y «comprar y mantener» resaltadas; al elegir una familia o un nombre se resalta esa.
 */
export function CurvesChart({ dates, series, defaults }: { dates: string[]; series: Serie[]; defaults: string[] }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const { paths, y, x, ticks } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of series) for (const v of s.values) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    const pad = (hi - lo) * 0.06 || 0.01;
    lo -= pad;
    hi += pad;
    const x = (i: number) => PAD.l + (i / Math.max(1, dates.length - 1)) * (W - PAD.l - PAD.r);
    const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
    const paths = new Map(series.map((s) => [s.id, s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("")]));
    const step = (hi - lo) / 4;
    const ticks = Array.from({ length: 5 }, (_, i) => lo + step * i);
    return { paths, y, x, ticks };
  }, [dates.length, series]);

  const active = picked ? series.filter((s) => s.id === picked || s.family === picked) : series.filter((s) => defaults.includes(s.id));
  const activeIds = new Set(active.map((s) => s.id));
  const families = [...new Set(series.map((s) => s.family))];
  const hi = hover ?? dates.length - 1;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (dates.length - 1));
    setHover(Math.max(0, Math.min(dates.length - 1, i)));
  };

  return (
    <div className="card p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
        <button
          type="button"
          onClick={() => setPicked(null)}
          aria-pressed={picked === null}
          className={`rounded-full border px-3 py-1.5 sm:px-2.5 sm:py-1 ${picked === null ? "border-brand text-brand" : "border-line text-ink-2 hover:text-ink"}`}
        >
          Destacados
        </button>
        {families.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setPicked(picked === f ? null : f)}
            aria-pressed={picked === f}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 sm:px-2.5 sm:py-1 ${picked === f ? "border-ink text-ink" : "border-line text-ink-2 hover:text-ink"}`}
          >
            <span className="size-2 rounded-full" style={{ background: series.find((s) => s.family === f)?.color }} aria-hidden="true" />
            {f}
          </button>
        ))}
      </div>

      <div className="-mx-1 overflow-x-auto px-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full min-w-[620px] touch-pan-x select-none sm:min-w-0"
        role="img"
        aria-label="Evolución del capital de cada inversionista durante el experimento, partiendo de 1"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#232a33" strokeWidth="1" />
            <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#717c8b" className="num">
              {pctFmt.format(t - 1).replace("-", "−")}
            </text>
          </g>
        ))}
        <line x1={PAD.l} x2={W - PAD.r} y1={y(1)} y2={y(1)} stroke="#717c8b" strokeDasharray="3 4" strokeWidth="1" />
        {[0, Math.floor((dates.length - 1) / 2), dates.length - 1].map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === dates.length - 1 ? "end" : "middle"} fontSize="11" fill="#717c8b">
            {dateFmt.format(new Date(`${dates[i]}T00:00:00Z`))}
          </text>
        ))}
        <g fill="none" strokeLinejoin="round" strokeLinecap="round">
          {series.map((s) => (activeIds.has(s.id) ? null : <path key={s.id} d={paths.get(s.id)} stroke="#3a4350" strokeWidth="1" opacity="0.55" />))}
          {active.map((s) => (
            <path key={s.id} d={paths.get(s.id)} stroke={s.color} strokeWidth="2" strokeDasharray={s.family === "Control" ? "5 4" : undefined} />
          ))}
        </g>
        {hover !== null ? <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="#a7b0bd" strokeWidth="1" opacity="0.5" /> : null}
        {active.map((s) => (
          <circle key={s.id} cx={x(hi)} cy={y(s.values[hi])} r="3.5" fill={s.color} stroke="#0a0c0f" strokeWidth="1.5" />
        ))}
      </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
        <span className="num text-ink-3">{dateFmt.format(new Date(`${dates[hi]}T00:00:00Z`))}</span>
        {active
          .slice()
          .sort((a, b) => b.values[hi] - a.values[hi])
          .slice(0, 8)
          .map((s) => (
            <button key={s.id} type="button" onClick={() => setPicked(picked === s.id ? null : s.id)} className="flex items-center gap-1.5 hover:text-brand">
              <span className="h-0.5 w-3.5 rounded" style={{ background: s.color }} aria-hidden="true" />
              {s.name}
              <span className={`num ${s.values[hi] >= 1 ? "text-up" : "text-down"}`}>{pctFmt.format(s.values[hi] - 1).replace("-", "−")}</span>
            </button>
          ))}
      </div>
    </div>
  );
}
