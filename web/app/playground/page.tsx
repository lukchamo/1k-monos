import type { Metadata } from "next";
import Link from "next/link";
import { Trading } from "@/components/Trading";

export const metadata: Metadata = {
  title: "Playground",
  description: "Cuenta de práctica con dinero ficticio: añade saldo, abre posiciones en largo o en corto con o sin apalancamiento y mira qué habría pasado, con precios reales.",
};

const STEPS = [
  ["1", "Elige qué operar", "Bitcoin, Nvidia, oro… Verás el precio real de ese día y qué hacen los inversionistas del laboratorio."],
  ["2", "Largo o corto", "Largo si crees que sube. Corto si crees que baja. Decide cuánto pones y si lo multiplicas."],
  ["3", "Avanza el tiempo", "Pulsa «Avanzar un día» y mira cómo le va a tu posición con lo que pasó de verdad."],
  ["4", "Cierra cuando quieras", "Al cerrar, la ganancia o la pérdida pasa a tu saldo. Vuelve a empezar las veces que haga falta."],
];

export default function PlaygroundPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 pt-8 sm:pt-10">
      <header className="max-w-3xl space-y-3">
        <p className="eyebrow">Playground · dinero ficticio</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Practica como si fuera tu cuenta</h1>
        <p className="text-ink-2">
          Una cuenta de práctica que funciona como la de Neverless: añades saldo, eliges un activo y abres una posición en largo o en corto, con o sin
          apalancamiento. Los precios son los reales de cada día y el dinero es de mentira.
        </p>
      </header>

      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(([n, t, d]) => (
          <li key={n} className="card p-4">
            <span className="num grid size-6 place-items-center rounded-full bg-brand text-xs font-semibold text-brand-ink">{n}</span>
            <h2 className="mt-2 font-medium">{t}</h2>
            <p className="mt-1 text-sm text-ink-2">{d}</p>
          </li>
        ))}
      </ol>

      <Trading />

      <section className="card space-y-2 p-5 text-sm text-ink-2">
        <h2 className="font-medium text-ink">En qué se parece a Neverless y en qué no</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Igual que publican: sin comisión por orden, sin comisión por cambio de divisa, largos y cortos, y hasta 5× usando toda tu cuenta como respaldo.</li>
          <li>Supuestos nuestros, porque no los publican: un diferencial del 0,1 %, un 8 % anual por el dinero prestado y por los cortos, y liquidación cuando tu patrimonio baja del 10 % de lo invertido.</li>
          <li>Los precios son de cierre diario: aquí no hay movimiento dentro del día ni órdenes con precio límite.</li>
          <li>No está conectado a Neverless ni a ningún bróker. Nada de lo que hagas aquí mueve dinero real.</li>
        </ul>
        <p>
          ¿Prefieres que lo haga solo? El <Link href="/simulador" className="underline underline-offset-2 hover:text-ink">simulador</Link> sigue a un inversionista del
          laboratorio en piloto automático.
        </p>
      </section>

      <p className="max-w-3xl text-sm text-ink-3">Esto es un experimento educativo. No es una recomendación de inversión ni una invitación a operar con dinero real.</p>
    </div>
  );
}
