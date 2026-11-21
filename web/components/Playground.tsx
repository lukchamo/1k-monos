"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BROKERS, monkeyPositions, simulate, type Fees } from "@/lib/sim";

interface Data {
  investor: { id: string; name: string; family: string };
  dates: string[];
  symbols: string[];
  closes: (number | null)[][];
  positions: number[][];
}
interface Option {
  id: string;
  name: string;
  family: string;
}

const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const pctFmt = new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" });
const dateFmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmtDate = (d: string) => dateFmt.format(new Date(`${d}T00:00:00Z`));
const signed = (v: number) => `${v >= 0 ? "+" : "−"}${eur.format(Math.abs(v))}`;
const tone = (v: number) => (Math.abs(v) < 0.005 ? "text-ink-2" : v > 0 ? "text-up" : "text-down");

const W = 960;
const H = 320;
const PAD = { l: 58, r: 12, t: 12, b: 24 };
const MONKEY = "__mono";
const SPEEDS = [
  { label: "Lento", ms: 220 },
  { label: "Normal", ms: 90 },
  { label: "Rápido", ms: 25 },
];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-ink-2">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-ink-3">{hint}</span> : null}
    </label>
  );
}

const inputCls = "w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink focus:border-brand";

function Pct({ label, value, onChange, step = 0.05, max = 20 }: { label: string; value: number; onChange: (v: number) => void; step?: number; max?: number }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-ink-3">{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={max}
          step={step}
          value={Number((value * 100).toFixed(3))}
          onChange={(e) => onChange(Math.min(max, Math.max(0, Number(e.target.value) || 0)) / 100)}
          className={`${inputCls} num`}
        />
        <span className="text-sm text-ink-3">%</span>
      </span>
    </label>
  );
}

export function Playground({ options, defaultId }: { options: Option[]; defaultId: string }) {
  const [strategy, setStrategy] = useState(defaultId);
  const [seed, setSeed] = useState(7);
  const [capital, setCapital] = useState(200);
  const [brokerId, setBrokerId] = useState("neverless");
  const [fees, setFees] = useState<Fees>(BROKERS[0].fees);
  const [leverage, setLeverage] = useState(1);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [live, setLive] = useState<string | null>(null);
  const lastDay = useRef<string | null>(null);

  const broker = BROKERS.find((b) => b.id === brokerId) ?? BROKERS[0];
  // el mono usa los precios del primer inversionista: solo cambia quién decide
  const sourceId = strategy === MONKEY ? defaultId : strategy;

  // carga de datos; si el laboratorio procesa un cierre nuevo, se recarga solo
  useEffect(() => {
    let alive = true;
    setError(null);
    fetch(`/api/playground?investor=${sourceId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Data) => {
        if (!alive) return;
        setData(d);
        setCursor((c) => (c === 0 || c >= d.dates.length - 2 ? d.dates.length - 1 : Math.min(c, d.dates.length - 1)));
        lastDay.current = d.dates[d.dates.length - 1] ?? null;
      })
      .catch(() => alive && setError("No se pudieron cargar los datos del laboratorio. Inténtalo de nuevo en un momento."));
    return () => {
      alive = false;
    };
  }, [sourceId, live]);

  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/live");
        if (!r.ok) return;
        const p = (await r.json()) as { market_day: string | null };
        if (p.market_day && lastDay.current && p.market_day > lastDay.current) setLive(p.market_day);
      } catch {
        /* sin red: se queda como está */
      }
    };
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const positions = useMemo(() => {
    if (!data) return null;
    return strategy === MONKEY ? monkeyPositions(data.symbols.length, data.dates.length, seed) : data.positions;
  }, [data, strategy, seed]);

  const sim = useMemo(() => {
    if (!data || !positions) return null;
    return simulate({ dates: data.dates, closes: data.closes, positions, capital, leverage: Math.min(leverage, broker.maxLeverage), fees });
  }, [data, positions, capital, leverage, fees, broker.maxLeverage]);

  // comprar todo y no tocar nada, con el mismo bróker: la vara de medir
  const hold = useMemo(() => {
    if (!data) return null;
    return simulate({ dates: data.dates, closes: data.closes, positions: data.closes.map((c) => c.map(() => 1)), capital, leverage: 1, fees });
  }, [data, capital, fees]);

  const n = data?.dates.length ?? 0;
  useEffect(() => {
    if (!playing || !n) return;
    const id = setInterval(() => {
      setCursor((c) => {
        if (c >= n - 1) {
          setPlaying(false);
          return c;
        }
        return c + 1;
      });
    }, SPEEDS[speed].ms);
    return () => clearInterval(id);
  }, [playing, n, speed]);

  const chart = useMemo(() => {
    if (!sim || !hold) return null;
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < sim.days.length; i++)
      for (const v of [sim.days[i].equity, sim.days[i].gross, hold.days[i].equity]) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    const pad = (hi - lo) * 0.08 || 1;
    lo = Math.max(0, lo - pad);
    hi += pad;
    const x = (i: number) => PAD.l + (i / Math.max(1, sim.days.length - 1)) * (W - PAD.l - PAD.r);
    const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
    const path = (vals: number[], upTo: number) => vals.slice(0, upTo + 1).map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");
    const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) / 4) * i);
    return { x, y, path, ticks };
  }, [sim, hold]);

  if (error) return <p className="card p-5 text-sm text-ink-2">{error}</p>;
  if (!data || !sim || !hold || !chart) return <p className="card p-5 text-sm text-ink-2">Cargando el simulador…</p>;

  const c = Math.min(cursor, n - 1);
  const day = sim.days[c];
  const atEnd = c === n - 1;
  const result = day.equity - capital;
  const costsSoFar = day.paid; // costes pagados hasta este día
  const holdNow = hold.days[c].equity;
  const lev = Math.min(leverage, broker.maxLeverage);
  const rows = data.symbols
    .map((s, a) => ({ s, pos: positions![a][c], held: sim.holdings[c][a] }))
    .filter((r) => r.pos !== 0 || Math.abs(r.held) > 0.005)
    .sort((a, b) => Math.abs(b.held) - Math.abs(a.held) || (a.s < b.s ? -1 : 1));
  const families = [...new Set(options.map((o) => o.family))];
  const pickBroker = (id: string) => {
    const b = BROKERS.find((x) => x.id === id) ?? BROKERS[0];
    setBrokerId(b.id);
    setFees(b.fees);
    setLeverage((l) => Math.min(l, b.maxLeverage));
  };
  const setFee = (k: keyof Fees) => (v: number) => setFees((f) => ({ ...f, [k]: v }));

  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
      {/* ── controles ── */}
      <div className="card h-fit space-y-4 p-4">
        <Field label="Dinero ficticio" hint="Entre 10 y 100.000 €">
          <span className="flex items-center gap-2">
            <input type="number" inputMode="numeric" min={10} max={100000} step={10} value={capital} onChange={(e) => setCapital(Math.min(100000, Math.max(10, Number(e.target.value) || 10)))} className={`${inputCls} num`} />
            <span className="text-sm text-ink-3">€</span>
          </span>
        </Field>

        <Field label="A quién sigues">
          <select value={strategy} onChange={(e) => { setStrategy(e.target.value); setPlaying(false); }} className={inputCls}>
            <option value={MONKEY}>🐒 Un mono al azar</option>
            {families.map((f) => (
              <optgroup key={f} label={f}>
                {options.filter((o) => o.family === f).map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        {strategy === MONKEY ? (
          <Field label="Semilla del mono" hint="Cada número es un mono distinto, siempre el mismo.">
            <span className="flex gap-2">
              <input type="number" inputMode="numeric" min={1} max={99999} value={seed} onChange={(e) => setSeed(Math.min(99999, Math.max(1, Math.floor(Number(e.target.value)) || 1)))} className={`${inputCls} num`} />
              <button type="button" onClick={() => setSeed((s) => (s % 99999) + 1)} className="shrink-0 rounded-lg border border-line px-3 text-sm hover:border-ink-2">Otro mono</button>
            </span>
          </Field>
        ) : null}

        <Field label="Bróker" hint={broker.note}>
          <select value={brokerId} onChange={(e) => pickBroker(e.target.value)} className={inputCls}>
            {BROKERS.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </Field>

        <div className="space-y-1.5">
          <span className="text-sm text-ink-2">Apalancamiento</span>
          <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Apalancamiento">
            {[1, 2, 3, 5].map((l) => (
              <button
                key={l}
                type="button"
                disabled={l > broker.maxLeverage}
                aria-pressed={lev === l}
                onClick={() => setLeverage(l)}
                className={`num rounded-lg border py-2 text-sm disabled:cursor-not-allowed disabled:opacity-35 ${lev === l ? "border-brand bg-brand/10 text-brand" : "border-line hover:border-ink-2"}`}
              >
                {l}×
              </button>
            ))}
          </div>
          <span className="block text-xs text-ink-3">
            {lev === 1 ? "Sin apalancamiento: solo inviertes tu dinero." : `Inviertes ${lev} veces tu dinero con un préstamo. Las ganancias y las pérdidas se multiplican, y pagas intereses.`}
          </span>
        </div>

        <details className="rounded-lg border border-line p-3">
          <summary className="cursor-pointer text-sm text-ink-2">Ajustar los costes a mano</summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Pct label="Comisión por orden" value={fees.commissionPct} onChange={setFee("commissionPct")} max={5} />
            <label className="block space-y-1">
              <span className="text-xs text-ink-3">Fija por orden</span>
              <span className="flex items-center gap-1.5">
                <input type="number" inputMode="decimal" min={0} max={50} step={0.1} value={fees.commissionFixed} onChange={(e) => setFee("commissionFixed")(Math.min(50, Math.max(0, Number(e.target.value) || 0)))} className={`${inputCls} num`} />
                <span className="text-sm text-ink-3">€</span>
              </span>
            </label>
            <Pct label="Diferencial compra-venta" value={fees.spreadPct} onChange={setFee("spreadPct")} max={5} />
            <Pct label="Cambio de divisa" value={fees.fxPct} onChange={setFee("fxPct")} max={5} />
            <Pct label="Interés del préstamo (anual)" value={fees.borrowAnnual} onChange={setFee("borrowAnnual")} step={0.5} max={50} />
            <Pct label="Coste de estar en corto (anual)" value={fees.shortAnnual} onChange={setFee("shortAnnual")} step={0.5} max={50} />
            <label className="col-span-2 block space-y-1">
              <span className="text-xs text-ink-3">Orden mínima</span>
              <span className="flex items-center gap-1.5">
                <input type="number" inputMode="decimal" min={0} max={1000} step={1} value={fees.minOrder} onChange={(e) => setFee("minOrder")(Math.min(1000, Math.max(0, Number(e.target.value) || 0)))} className={`${inputCls} num`} />
                <span className="text-sm text-ink-3">€</span>
              </span>
            </label>
          </div>
        </details>
      </div>

      {/* ── resultado ── */}
      <div className="min-w-0 space-y-4">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            { k: "Tu cartera", v: eur.format(day.equity), sub: `${signed(result)} · ${pctFmt.format(result / capital).replace("-", "−")}`, t: tone(result) },
            { k: "Se llevaron los costes", v: eur.format(Math.max(0, costsSoFar)), sub: atEnd ? `${sim.orders} órdenes en total` : "hasta este día", t: costsSoFar > 0.005 ? "text-down" : "text-ink-2" },
            { k: "Sin hacer nada", v: eur.format(holdNow), sub: "comprar todo y esperar", t: tone(holdNow - capital) },
            { k: "Invertido ahora", v: eur.format(day.exposure), sub: day.exposure > day.equity + 0.01 ? `${(day.exposure / Math.max(day.equity, 0.01)).toFixed(1).replace(".", ",")}× tu dinero` : "sin préstamo", t: "text-ink" },
          ].map((s) => (
            <div key={s.k} className="card p-3 sm:p-4">
              <p className="eyebrow">{s.k}</p>
              <p className={`num mt-1.5 text-xl font-semibold tracking-tight sm:text-2xl ${s.t}`}>{s.v}</p>
              <p className="mt-1 text-xs text-ink-3">{s.sub}</p>
            </div>
          ))}
        </div>

        {sim.liquidatedOn && sim.liquidatedOn <= day.date ? (
          <p className="card border-down/50 p-4 text-sm">
            <strong className="text-down">Cuenta liquidada el {fmtDate(sim.liquidatedOn)}.</strong>{" "}
            <span className="text-ink-2">Con {lev}× las pérdidas agotaron tu dinero y el bróker cerró todas las posiciones. Así termina mucho apalancamiento en la vida real.</span>
          </p>
        ) : null}

        <div className="card p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => { if (atEnd) setCursor(0); setPlaying((p) => !p); }} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-ink hover:brightness-110">
              {playing ? "Pausar" : atEnd ? "Repetir desde el inicio" : "Reproducir"}
            </button>
            <div className="flex gap-1" role="group" aria-label="Velocidad">
              {SPEEDS.map((s, i) => (
                <button key={s.label} type="button" aria-pressed={speed === i} onClick={() => setSpeed(i)} className={`rounded-lg border px-2.5 py-2 text-xs ${speed === i ? "border-ink text-ink" : "border-line text-ink-2 hover:text-ink"}`}>
                  {s.label}
                </button>
              ))}
            </div>
            <span className="ml-auto flex items-center gap-2 text-xs text-ink-2">
              {atEnd ? <span className="pulse-dot inline-block size-2 rounded-full bg-up" aria-hidden="true" /> : null}
              <span className="num">{fmtDate(day.date)}</span>
              {atEnd ? <span>· último cierre, a la escucha</span> : null}
            </span>
          </div>

          <div className="-mx-1 overflow-x-auto px-1">
            <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[620px] select-none sm:min-w-0" role="img" aria-label="Evolución de tu cartera ficticia comparada con la misma cartera sin costes y con comprar y mantener">
              {chart.ticks.map((t) => (
                <g key={t}>
                  <line x1={PAD.l} x2={W - PAD.r} y1={chart.y(t)} y2={chart.y(t)} stroke="#232a33" />
                  <text x={PAD.l - 6} y={chart.y(t) + 4} textAnchor="end" fontSize="11" fill="#717c8b" className="num">{Math.round(t)} €</text>
                </g>
              ))}
              <line x1={PAD.l} x2={W - PAD.r} y1={chart.y(capital)} y2={chart.y(capital)} stroke="#717c8b" strokeDasharray="3 4" />
              <g fill="none" strokeLinejoin="round" strokeLinecap="round">
                <path d={chart.path(hold.days.map((d) => d.equity), c)} stroke="#f2f4f7" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.7" />
                <path d={chart.path(sim.days.map((d) => d.gross), c)} stroke="#717c8b" strokeWidth="1.5" />
                <path d={chart.path(sim.days.map((d) => d.equity), c)} stroke="#ffd84d" strokeWidth="2.25" />
              </g>
              <circle cx={chart.x(c)} cy={chart.y(day.equity)} r="4" fill="#ffd84d" stroke="#0a0c0f" strokeWidth="1.5" />
              <text x={PAD.l} y={H - 6} fontSize="11" fill="#717c8b">{fmtDate(data.dates[0])}</text>
              <text x={W - PAD.r} y={H - 6} textAnchor="end" fontSize="11" fill="#717c8b">{fmtDate(data.dates[n - 1])}</text>
            </svg>
          </div>

          <input type="range" min={0} max={n - 1} value={c} onChange={(e) => { setPlaying(false); setCursor(Number(e.target.value)); }} aria-label="Día de la simulación" className="mt-2 w-full accent-[#ffd84d]" />

          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-2">
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-brand" aria-hidden="true" />Tu cartera, con costes</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-ink-3" aria-hidden="true" />La misma sin costes</span>
            <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t border-dashed border-ink" aria-hidden="true" />Comprar todo y esperar</span>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="card p-4">
            <h3 className="font-medium">Qué sugiere hoy</h3>
            <p className="mt-1 text-xs text-ink-3">Decisión al cierre del {fmtDate(day.date)} y cuánto dinero hay en cada activo.</p>
            {rows.length ? (
              <ul className="mt-3 divide-y divide-line/70 text-sm">
                {rows.slice(0, 12).map((r) => (
                  <li key={r.s} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="num">{r.s.replace("-USD", "")}</span>
                    <span className={r.pos > 0 ? "text-up" : r.pos < 0 ? "text-down" : "text-ink-3"}>{r.pos > 0 ? "Largo" : r.pos < 0 ? "Corto" : "Salir"}</span>
                    <span className="num ml-auto text-ink-2">{Math.abs(r.held) > 0.005 ? eur.format(Math.abs(r.held)) : "sin ejecutar"}</span>
                  </li>
                ))}
                {rows.length > 12 ? <li className="py-1.5 text-xs text-ink-3">y {rows.length - 12} más</li> : null}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-ink-2">Hoy no sugiere ninguna posición: todo en efectivo.</p>
            )}
          </div>

          <div className="card p-4">
            <h3 className="font-medium">Lo que cobró el bróker</h3>
            <p className="mt-1 text-xs text-ink-3">En todo el periodo, con {eur.format(capital)} y {lev}×.</p>
            <dl className="mt-3 space-y-1.5 text-sm">
              {[
                ["Comisiones", sim.costs.commission],
                ["Diferencial compra-venta", sim.costs.spread],
                ["Cambio de divisa", sim.costs.fx],
                ["Intereses (préstamo y cortos)", sim.costs.financing],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-3">
                  <dt className="text-ink-2">{k}</dt>
                  <dd className="num">{eur.format(v as number)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 border-t border-line pt-1.5 font-medium">
                <dt>Total</dt>
                <dd className="num">{eur.format(sim.costs.total)} <span className="font-normal text-ink-3">({pctFmt.format(sim.costs.total / capital).replace("+", "")} de tu dinero)</span></dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-ink-3">
              {sim.orders} órdenes ejecutadas{sim.skipped ? ` y ${sim.skipped} que no llegaron al mínimo de ${eur.format(fees.minOrder)}` : ""}. Tu dinero se reparte a partes iguales entre {data.symbols.length} activos:{" "}
              {eur.format((capital * lev) / data.symbols.length)} por activo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
