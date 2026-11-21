"use client";

import { useState } from "react";
import { liquidationPrice, NEVERLESS_RULES as R, newAccount } from "@/lib/paper";

const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const pct = (v: number) => `${Math.abs(v).toFixed(v % 1 === 0 ? 0 : 1).replace(".", ",")} %`;

/**
 * Calculadora para empezar: eliges cuánto pones, si vas en largo o en corto y el apalancamiento, y
 * mueves el precio. Todo sale en euros. Usa las mismas reglas que el playground.
 */
export function MoneyGuide() {
  const [amount, setAmount] = useState(50);
  const [side, setSide] = useState<1 | -1>(1);
  const [lev, setLev] = useState(1);
  const [move, setMove] = useState(10);

  const size = amount * lev;
  const lp = liquidationPrice(newAccount(amount), { side, size, entry: 100 }, {}, R);
  const liqMove = lp ? lp / 100 - 1 : null; // movimiento del precio que liquida la cuenta
  const liquidated = liqMove !== null && (side > 0 ? move / 100 <= liqMove : move / 100 >= liqMove);
  const spread = size * R.spreadPct;
  const pnl = side * size * (move / 100) - spread;
  const left = liquidated ? Math.max(0, amount + side * size * liqMove! - spread) : Math.max(0, amount + pnl);
  const perDay = ((side > 0 ? Math.max(0, size - amount) * R.borrowAnnual : size * R.shortAnnual) / 365);
  const good = left - amount >= 0;

  return (
    <div className="card grid gap-0 overflow-hidden lg:grid-cols-2">
      <div className="space-y-5 p-4 sm:p-5">
        <div className="space-y-2">
          <p className="text-sm text-ink-2">1. ¿Cuánto pones?</p>
          <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Cuánto pones">
            {[20, 50, 100, 200].map((a) => (
              <button key={a} type="button" aria-pressed={amount === a} onClick={() => setAmount(a)} className={`num rounded-lg border py-2.5 text-sm ${amount === a ? "border-brand bg-brand/10 text-brand" : "border-line hover:border-ink-2"}`}>
                {a} €
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-ink-2">2. ¿Crees que sube o que baja?</p>
          <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Dirección">
            <button type="button" aria-pressed={side === 1} onClick={() => setSide(1)} className={`rounded-lg border py-2.5 text-sm font-medium ${side === 1 ? "border-up bg-up/15 text-up" : "border-line text-ink-2 hover:text-ink"}`}>Largo · gano si sube</button>
            <button type="button" aria-pressed={side === -1} onClick={() => setSide(-1)} className={`rounded-lg border py-2.5 text-sm font-medium ${side === -1 ? "border-down bg-down/15 text-down" : "border-line text-ink-2 hover:text-ink"}`}>Corto · gano si baja</button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-ink-2">3. ¿Lo multiplicas con apalancamiento?</p>
          <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Apalancamiento">
            {[1, 2, 3, 4, 5].map((l) => (
              <button key={l} type="button" aria-pressed={lev === l} onClick={() => setLev(l)} className={`num rounded-lg border py-2.5 text-sm ${lev === l ? "border-brand bg-brand/10 text-brand" : "border-line hover:border-ink-2"}`}>
                {l}×
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-3">{lev === 1 ? "1× es sin préstamo: solo arriesgas lo que pones." : `Pones ${eur.format(amount)} y te prestan ${eur.format(size - amount)}. Operas con ${eur.format(size)}.`}</p>
        </div>

        <label className="block space-y-2">
          <span className="flex items-baseline justify-between text-sm text-ink-2">
            4. Mueve el precio
            <span className={`num text-base font-semibold ${move > 0 ? "text-up" : move < 0 ? "text-down" : "text-ink"}`}>{move > 0 ? "sube" : move < 0 ? "baja" : "igual"} {move !== 0 ? pct(move) : ""}</span>
          </span>
          <input type="range" min={-30} max={30} step={1} value={move} onChange={(e) => setMove(Number(e.target.value))} aria-label="Cuánto se mueve el precio, en porcentaje" className="w-full accent-[#ffd84d]" />
          <span className="flex justify-between text-xs text-ink-3"><span>baja 30 %</span><span>igual</span><span>sube 30 %</span></span>
        </label>
      </div>

      <div className="flex flex-col gap-4 border-t border-line bg-surface-2 p-4 sm:p-5 lg:border-l lg:border-t-0" aria-live="polite">
        <p className="eyebrow">Lo que pasa con tu dinero</p>
        {liquidated ? (
          <div>
            <p className="num text-4xl font-semibold tracking-tight text-down">{eur.format(left)}</p>
            <p className="mt-2 text-sm text-ink">
              <strong className="text-down">Liquidado.</strong> Con {lev}×, cuando el precio {side > 0 ? "baja" : "sube"} un {pct(liqMove! * 100)} se cierra todo. De tus {eur.format(amount)} quedan unos {eur.format(left)}.
            </p>
          </div>
        ) : (
          <div>
            <p className={`num text-4xl font-semibold tracking-tight ${good ? "text-up" : "text-down"}`}>{eur.format(left)}</p>
            <p className="mt-2 text-sm text-ink">
              Pusiste {eur.format(amount)} y {good ? "ganas" : "pierdes"} <strong className={good ? "text-up" : "text-down"}>{eur.format(Math.abs(left - amount))}</strong>.
            </p>
          </div>
        )}
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-ink-2">Tamaño de la posición</dt><dd className="num">{eur.format(size)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-ink-2">Comisión</dt><dd className="num">{eur.format(0)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-ink-2">Abrir y cerrar (diferencial)</dt><dd className="num">{eur.format(spread)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-ink-2">Interés por cada día abierta</dt><dd className="num">{perDay > 0 ? eur.format(perDay) : "nada"}</dd></div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-2">Te liquidan si el precio</dt>
            <dd className="num">{liqMove === null ? "no aplica" : `${side > 0 ? "baja" : "sube"} un ${pct(liqMove * 100)}`}</dd>
          </div>
        </dl>
        <p className="mt-auto text-xs text-ink-3">Comisión cero como publica Neverless. El diferencial, el interés y el margen de liquidación son estimados. Es dinero ficticio, no una recomendación.</p>
      </div>
    </div>
  );
}
