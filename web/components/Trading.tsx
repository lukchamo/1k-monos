"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { advance, close, deposit, liquidationPrice, mark, NEVERLESS_RULES as R, newAccount, open, OrderError, parseAccount, summary, type Account, type Prices } from "@/lib/paper";

interface Market {
  dates: string[];
  symbols: string[];
  closes: (number | null)[][];
  long: number[][];
  short: number[][];
  investors: number;
}

const NAMES: Record<string, string> = {
  "BTC-USD": "Bitcoin", "ETH-USD": "Ethereum", "SOL-USD": "Solana", COIN: "Coinbase", SPY: "S&P 500 (SPY)", QQQ: "Nasdaq 100 (QQQ)", MSFT: "Microsoft", NVDA: "Nvidia", TSLA: "Tesla",
  PLTR: "Palantir", CRWV: "CoreWeave", SPCX: "SpaceX", GLD: "Oro (GLD)", TLT: "Bonos EE. UU. 20 años (TLT)", USO: "Petróleo (USO)", "SAN.MC": "Santander", EWP: "España (EWP)",
  FEZ: "Eurozona (FEZ)", EWJ: "Japón (EWJ)", EEM: "Emergentes (EEM)", EWZ: "Brasil (EWZ)", EWW: "México (EWW)", FXI: "China (FXI)",
};
const GROUPS: [string, string[]][] = [
  ["Cripto", ["BTC-USD", "ETH-USD", "SOL-USD", "COIN"]],
  ["Acciones", ["NVDA", "MSFT", "TSLA", "PLTR", "CRWV", "SPCX", "SAN.MC"]],
  ["Índices y fondos", ["SPY", "QQQ", "FEZ", "EWP", "EWJ", "EEM", "EWZ", "EWW", "FXI"]],
  ["Oro, bonos y petróleo", ["GLD", "TLT", "USO"]],
];
const STARTS = [
  { label: "Hace 1 mes", back: 21 },
  { label: "Hace 3 meses", back: 63 },
  { label: "Hace 6 meses", back: 126 },
  { label: "Desde el inicio", back: 9999 },
  { label: "Último cierre", back: 0 },
];
const KEY = "1kmonos.playground.v1";
const short = (s: string) => s.replace("-USD", "");
const dateFmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmtDate = (d: string) => dateFmt.format(new Date(`${d}T00:00:00Z`));
const priceFmt = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const pctFmt = new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" });
const tone = (v: number) => (Math.abs(v) < 0.005 ? "text-ink-2" : v > 0 ? "text-up" : "text-down");
const inputCls = "w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-ink focus:border-brand";

const W = 720;
const H = 240;
const PAD = { l: 8, r: 8, t: 10, b: 10 };

export function Trading() {
  const [mk, setMk] = useState<Market | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<Account>(() => newAccount(200));
  const [cursor, setCursor] = useState<number | null>(null);
  const [symbol, setSymbol] = useState("BTC-USD");
  const [side, setSide] = useState<1 | -1>(1);
  const [amount, setAmount] = useState(50);
  const [lev, setLev] = useState(1);
  const [add, setAdd] = useState(100);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [playing, setPlaying] = useState(false);
  const loaded = useRef(false);

  // carga el mercado y lo que hubiera guardado en este navegador
  useEffect(() => {
    let alive = true;
    fetch("/api/market")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Market) => {
        if (!alive) return;
        setMk(d);
        let start = Math.max(0, d.dates.length - 1 - 63);
        try {
          const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as { account?: unknown; date?: unknown } | null;
          const acc = parseAccount(saved?.account);
          const at = typeof saved?.date === "string" ? d.dates.indexOf(saved.date) : -1;
          if (acc && at >= 0) {
            setAccount(acc);
            start = at;
          }
        } catch {
          /* sin almacenamiento o dato corrupto: se empieza de cero */
        }
        // enlace directo desde el correo: /playground?activo=TLT&lado=largo&desde=ultimo
        const q = new URLSearchParams(window.location.search);
        const want = (q.get("activo") ?? "").toUpperCase();
        if (d.symbols.includes(want)) setSymbol(want);
        if (q.get("lado") === "corto") setSide(-1);
        if (q.get("lado") === "largo") setSide(1);
        if (q.get("desde") === "ultimo") start = d.dates.length - 1;
        setCursor(start);
        loaded.current = true;
      })
      .catch(() => alive && setError("No se pudo cargar el mercado. Inténtalo de nuevo en un momento."));
    return () => {
      alive = false;
    };
  }, []);

  // guarda la cuenta en este navegador (no sale de aquí)
  useEffect(() => {
    if (!loaded.current || !mk || cursor === null) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ account, date: mk.dates[cursor] }));
    } catch {
      /* navegador sin almacenamiento: la cuenta dura lo que dure la pestaña */
    }
  }, [account, cursor, mk]);

  const idx = useMemo(() => new Map((mk?.symbols ?? []).map((s, i) => [s, i])), [mk]);
  const pricesAt = (t: number): Prices => Object.fromEntries((mk?.symbols ?? []).map((s, i) => [s, mk!.closes[i][t]]));

  const step = (days: number) => {
    if (!mk || cursor === null) return;
    let acc = account;
    let t = cursor;
    for (let k = 0; k < days && t < mk.dates.length - 1; k++) {
      t++;
      const gap = Math.round((Date.parse(mk.dates[t]) - Date.parse(mk.dates[t - 1])) / 86_400_000);
      acc = advance(acc, pricesAt(t), mk.dates[t], gap, R);
    }
    if (acc.liquidatedOn && acc.liquidatedOn !== account.liquidatedOn) setMsg({ ok: false, text: `Liquidación el ${fmtDate(acc.liquidatedOn)}: las pérdidas dejaron tu patrimonio por debajo del margen mínimo y se cerraron todas las posiciones.` });
    setAccount(acc);
    setCursor(t);
  };

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => step(1), 350);
    return () => clearInterval(id);
  });
  useEffect(() => {
    if (mk && cursor !== null && cursor >= mk.dates.length - 1) setPlaying(false);
  }, [cursor, mk]);

  if (error) return <p className="card p-5 text-sm text-ink-2">{error}</p>;
  if (!mk || cursor === null) return <p className="card p-5 text-sm text-ink-2">Cargando el mercado…</p>;

  const t = cursor;
  const date = mk.dates[t];
  const atEnd = t === mk.dates.length - 1;
  const prices = pricesAt(t);
  const s = summary(account, prices);
  const cur = account.currency === "EUR" ? "€" : "$";
  const money = (v: number) => `${priceFmt.format(v)} ${cur}`;
  const signed = (v: number) => `${v >= 0 ? "+" : "−"}${priceFmt.format(Math.abs(v))} ${cur}`;
  const a = idx.get(symbol) ?? 0;
  const price = mk.closes[a][t];
  const prev = t > 0 ? mk.closes[a][t - 1] : null;
  const dayMove = price && prev ? price / prev - 1 : 0;
  const nLong = mk.long[a][t];
  const nShort = mk.short[a][t];
  const size = amount * lev;
  const room = Math.max(0, s.equity * R.maxLeverage - s.exposure);
  const draft = price ? { side, size, entry: price } : null;
  const liq = draft && size > 0 ? liquidationPrice(account, draft, prices, R, size) : null;

  const run = (f: () => Account, okText: string) => {
    try {
      setAccount(f());
      setMsg({ ok: true, text: okText });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof OrderError ? e.message : "No se pudo completar la operación." });
    }
  };
  const restart = (back: number) => {
    setPlaying(false);
    setAccount(newAccount(200, account.currency));
    setCursor(Math.max(0, mk.dates.length - 1 - back));
    setMsg({ ok: true, text: "Cuenta nueva con 200 de saldo." });
  };

  // gráfico del activo elegido: solo hasta el día en el que estás, nunca el futuro
  const from = Math.max(0, t - 119);
  const serie = mk.closes[a].slice(from, t + 1).map((v) => v ?? NaN);
  const vals = serie.filter((v) => Number.isFinite(v));
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const x = (i: number) => PAD.l + (i / Math.max(1, serie.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo || 1)) * (H - PAD.t - PAD.b);
  let started = false;
  const path = serie.map((v, i) => (Number.isFinite(v) ? `${started ? "L" : ((started = true), "M")}${x(i).toFixed(1)} ${y(v).toFixed(1)}` : "")).join("");
  const mine = account.positions.filter((p) => p.symbol === symbol);

  return (
    <div className="space-y-4">
      {/* ── cuenta ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { k: "Patrimonio", v: money(s.equity), sub: `${signed(s.result)} desde que empezaste`, c: tone(s.result) },
          { k: "Saldo", v: money(account.cash), sub: `${money(account.deposited)} aportados`, c: "text-ink" },
          { k: "Invertido", v: money(s.exposure), sub: s.exposure > 0 ? `${s.leverage.toFixed(1).replace(".", ",")}× tu patrimonio` : "nada abierto", c: "text-ink" },
          { k: "Puedes abrir aún", v: money(room), sub: `tope de ${R.maxLeverage}× en la cuenta`, c: "text-ink" },
        ].map((c) => (
          <div key={c.k} className="card p-3 sm:p-4">
            <p className="eyebrow">{c.k}</p>
            <p className={`num mt-1.5 text-xl font-semibold tracking-tight sm:text-2xl ${c.c}`}>{c.v}</p>
            <p className="mt-1 text-xs text-ink-3">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* ── el tiempo ── */}
      <div className="card flex flex-wrap items-center gap-2 p-3 sm:p-4">
        <div className="mr-auto min-w-0">
          <p className="eyebrow">Estás en</p>
          <p className="num mt-0.5 text-lg font-semibold">{fmtDate(date)}</p>
          <p className="text-xs text-ink-3">{atEnd ? "Último cierre real. La cuenta sigue viva: avanzará cuando el laboratorio reciba el siguiente." : "Precios reales de ese día. Avanza para ver qué pasó después."}</p>
        </div>
        <button type="button" disabled={atEnd} onClick={() => step(1)} className="rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-ink hover:brightness-110 disabled:opacity-40">Avanzar un día</button>
        <button type="button" disabled={atEnd} onClick={() => step(5)} className="rounded-lg border border-line px-3 py-2.5 text-sm hover:border-ink-2 disabled:opacity-40">Una semana</button>
        <button type="button" disabled={atEnd} onClick={() => setPlaying((p) => !p)} className="rounded-lg border border-line px-3 py-2.5 text-sm hover:border-ink-2 disabled:opacity-40">{playing ? "Pausar" : "Reproducir"}</button>
      </div>

      {msg ? (
        <p role="status" className={`card p-3 text-sm ${msg.ok ? "border-up/40 text-ink" : "border-down/50 text-ink"}`}>
          {msg.text}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        {/* ── orden ── */}
        <div className="card h-fit space-y-4 p-4">
          <h2 className="font-medium">Abrir una posición</h2>
          <label className="block space-y-1.5">
            <span className="text-sm text-ink-2">Qué quieres operar</span>
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className={inputCls}>
              {GROUPS.map(([g, list]) => (
                <optgroup key={g} label={g}>
                  {list.filter((x) => idx.has(x)).map((x) => (
                    <option key={x} value={x}>{NAMES[x] ?? x}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <div className="flex items-baseline justify-between gap-3">
            <span className="num text-2xl font-semibold">{price ? priceFmt.format(price) : "—"}</span>
            <span className={`num text-sm ${tone(dayMove)}`}>{pctFmt.format(dayMove).replace("-", "−")} hoy</span>
          </div>

          <div className="rounded-lg bg-surface-2 p-3">
            <p className="text-xs text-ink-3">Qué hacen los {mk.investors} inversionistas del laboratorio con {short(symbol)}</p>
            <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-flat" aria-hidden="true">
              <span className="bg-up" style={{ width: `${(nLong / mk.investors) * 100}%` }} />
              <span className="ml-auto bg-down" style={{ width: `${(nShort / mk.investors) * 100}%` }} />
            </div>
            <p className="mt-2 flex justify-between text-xs">
              <span className="text-up">{nLong} en largo</span>
              <span className="text-ink-3">{mk.investors - nLong - nShort} fuera</span>
              <span className="text-down">{nShort} en corto</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Dirección">
            <button type="button" aria-pressed={side === 1} onClick={() => setSide(1)} className={`rounded-lg border py-2.5 text-sm font-medium ${side === 1 ? "border-up bg-up/15 text-up" : "border-line text-ink-2 hover:text-ink"}`}>Largo · sube</button>
            <button type="button" aria-pressed={side === -1} onClick={() => setSide(-1)} className={`rounded-lg border py-2.5 text-sm font-medium ${side === -1 ? "border-down bg-down/15 text-down" : "border-line text-ink-2 hover:text-ink"}`}>Corto · baja</button>
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm text-ink-2">Cuánto pones de tu dinero</span>
            <span className="flex items-center gap-2">
              <input type="number" inputMode="decimal" min={1} step={10} value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))} className={`${inputCls} num`} />
              <span className="text-sm text-ink-3">{cur}</span>
            </span>
            <span className="flex gap-1.5">
              {[0.25, 0.5, 1].map((f) => (
                <button key={f} type="button" onClick={() => setAmount(Math.max(0, Math.floor(((room / lev) * f) * 100) / 100))} className="rounded-md border border-line px-2 py-1 text-xs text-ink-2 hover:text-ink">{f === 1 ? "Máx." : `${f * 100} %`}</button>
              ))}
            </span>
          </label>

          <div className="space-y-1.5">
            <span className="text-sm text-ink-2">Apalancamiento</span>
            <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Apalancamiento">
              {[1, 2, 3, 4, 5].map((l) => (
                <button key={l} type="button" aria-pressed={lev === l} onClick={() => setLev(l)} className={`num rounded-lg border py-2 text-sm ${lev === l ? "border-brand bg-brand/10 text-brand" : "border-line hover:border-ink-2"}`}>{l}×</button>
              ))}
            </div>
          </div>

          <dl className="space-y-1 rounded-lg border border-line p-3 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-ink-2">Tamaño de la posición</dt><dd className="num">{money(size)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink-2">Comisión</dt><dd className="num">{money(0)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink-2">Diferencial (estimado)</dt><dd className="num">{money(size * (R.spreadPct / 2))}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink-2">Te liquidan si llega a</dt><dd className="num">{liq ? priceFmt.format(liq) : "no aplica"}</dd></div>
          </dl>

          <button
            type="button"
            disabled={!price}
            onClick={() => run(() => open(account, { symbol, side, amount, leverage: lev, date }, prices, R), `Abierto: ${side > 0 ? "largo" : "corto"} en ${short(symbol)} por ${money(size)} a ${price ? priceFmt.format(price) : ""}.`)}
            className={`w-full rounded-lg py-3 text-sm font-semibold disabled:opacity-40 ${side > 0 ? "bg-up text-[#04200f]" : "bg-down text-[#2a0606]"}`}
          >
            {side > 0 ? "Abrir largo" : "Abrir corto"} en {short(symbol)}
          </button>
          <p className="text-xs text-ink-3">Dinero ficticio. Lo que hacen los inversionistas del laboratorio es un dato del experimento, no una recomendación.</p>
        </div>

        <div className="min-w-0 space-y-4">
          {/* ── precio ── */}
          <div className="card p-3 sm:p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-medium">{NAMES[symbol] ?? symbol}</h2>
              <span className="text-xs text-ink-3">Últimas {serie.length} sesiones, hasta el {fmtDate(date)}</span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-auto w-full select-none" role="img" aria-label={`Precio de ${NAMES[symbol] ?? symbol} hasta el día en el que estás`}>
              <path d={path} fill="none" stroke="#ffd84d" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {mine.map((p) => (
                <g key={p.id}>
                  <line x1={PAD.l} x2={W - PAD.r} y1={y(Math.min(hi, Math.max(lo, p.entry)))} y2={y(Math.min(hi, Math.max(lo, p.entry)))} stroke={p.side > 0 ? "#4fd68a" : "#ff6b6b"} strokeDasharray="4 4" strokeWidth="1" />
                </g>
              ))}
              {Number.isFinite(serie[serie.length - 1]) ? <circle cx={x(serie.length - 1)} cy={y(serie[serie.length - 1])} r="4" fill="#ffd84d" stroke="#0a0c0f" strokeWidth="1.5" /> : null}
            </svg>
            <p className="mt-1 flex justify-between text-xs text-ink-3">
              <span className="num">mín. {priceFmt.format(lo)}</span>
              {mine.length ? <span>línea discontinua: tu precio de entrada</span> : null}
              <span className="num">máx. {priceFmt.format(hi)}</span>
            </p>
          </div>

          {/* ── posiciones ── */}
          <div className="card p-4">
            <h2 className="font-medium">Tus posiciones abiertas</h2>
            {account.positions.length ? (
              <ul className="mt-3 space-y-2">
                {account.positions.map((p) => {
                  const m = mark(p, prices[p.symbol]);
                  return (
                    <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-line p-3 text-sm">
                      <span className="min-w-0">
                        <span className="num font-medium">{short(p.symbol)}</span>{" "}
                        <span className={p.side > 0 ? "text-up" : "text-down"}>{p.side > 0 ? "Largo" : "Corto"}</span>{" "}
                        <span className="num text-ink-3">{p.leverage}×</span>
                        <span className="block text-xs text-ink-3">{money(p.size)} a {priceFmt.format(p.entry)} · {fmtDate(p.openedOn)}</span>
                      </span>
                      <span className="ml-auto text-right">
                        <span className={`num block font-medium ${tone(m.pnl)}`}>{signed(m.pnl)}</span>
                        <span className="num block text-xs text-ink-3">ahora {priceFmt.format(m.price)} · {pctFmt.format(m.pnl / p.size * p.leverage).replace("-", "−")}</span>
                      </span>
                      <button type="button" onClick={() => run(() => close(account, p.id, prices, date, R), `Cerrado ${short(p.symbol)}: ${signed(m.pnl - m.notional * (R.spreadPct / 2))}.`)} className="rounded-lg border border-line px-3 py-2 text-sm hover:border-ink-2">Cerrar</button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-2">No tienes nada abierto. Elige un activo, la dirección y cuánto pones.</p>
            )}
          </div>

          {account.closed.length ? (
            <div className="card p-4">
              <h2 className="font-medium">Operaciones cerradas</h2>
              <ul className="mt-3 divide-y divide-line/70 text-sm">
                {account.closed.slice(0, 12).map((c) => (
                  <li key={`${c.id}-${c.closedOn}`} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-2">
                    <span>
                      <span className="num">{short(c.symbol)}</span> <span className={c.side > 0 ? "text-up" : "text-down"}>{c.side > 0 ? "largo" : "corto"}</span>{" "}
                      <span className="text-xs text-ink-3">{fmtDate(c.openedOn)} → {fmtDate(c.closedOn)}{c.reason === "liquidación" ? " · liquidada" : ""}</span>
                    </span>
                    <span className={`num ${tone(c.pnl)}`}>{signed(c.pnl)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-ink-3">Costes pagados hasta ahora (diferencial e intereses): <span className="num text-ink-2">{money(account.costs)}</span></p>
            </div>
          ) : null}

          {/* ── cuenta ── */}
          <div className="card grid gap-4 p-4 sm:grid-cols-3">
            <label className="block space-y-1.5">
              <span className="text-sm text-ink-2">Añadir saldo</span>
              <span className="flex gap-2">
                <input type="number" inputMode="decimal" min={1} step={50} value={add} onChange={(e) => setAdd(Math.max(0, Number(e.target.value) || 0))} className={`${inputCls} num`} />
                <button type="button" onClick={() => run(() => deposit(account, add), `Añadidos ${money(add)} de saldo ficticio.`)} className="shrink-0 rounded-lg border border-line px-3 text-sm hover:border-ink-2">Añadir</button>
              </span>
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm text-ink-2">Moneda de la cuenta</span>
              <select value={account.currency} onChange={(e) => setAccount({ ...account, currency: e.target.value === "USD" ? "USD" : "EUR" })} className={inputCls}>
                <option value="EUR">Euro (€)</option>
                <option value="USD">Dólar ($)</option>
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm text-ink-2">Empezar de nuevo</span>
              <select value="" onChange={(e) => e.target.value !== "" && restart(Number(e.target.value))} className={inputCls}>
                <option value="">Elige desde cuándo…</option>
                {STARTS.map((o) => (
                  <option key={o.label} value={o.back}>{o.label}</option>
                ))}
              </select>
            </label>
            <p className="text-xs text-ink-3 sm:col-span-3">La cuenta se guarda solo en este navegador. La moneda cambia el símbolo; no se aplica tipo de cambio (Neverless no cobra por cambiar divisa).</p>
          </div>
        </div>
      </div>
    </div>
  );
}
