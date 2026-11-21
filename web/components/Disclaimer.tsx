import Link from "next/link";

/** Aviso fijo en todas las páginas. Es texto, no un modal: siempre visible, nunca estorba. */
export function DisclaimerBar() {
  return (
    <div role="note" aria-label="Aviso" className="border-b border-brand/30 bg-brand/10 text-[0.8rem] text-ink">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-1.5 sm:py-2">
        <span className="rounded bg-brand px-1.5 py-0.5 font-mono text-[0.68rem] font-semibold uppercase tracking-wider text-brand-ink">Experimento</span>
        <span>
          <span className="hidden sm:inline">Esto es un laboratorio para aprender a interpretar mercados. </span>
          <strong>No es una recomendación de inversión.</strong>
        </span>
        <Link href="/aviso" className="underline decoration-brand/60 underline-offset-2 hover:decoration-brand">
          <span className="sm:hidden">Aviso</span>
          <span className="hidden sm:inline">Leer el aviso completo</span>
        </Link>
      </div>
    </div>
  );
}

export function DisclaimerNote({ className = "" }: { className?: string }) {
  return (
    <p className={`text-sm text-ink-3 ${className}`}>
      Rendimientos simulados con reglas públicas e iguales para todos. Los resultados pasados no anticipan los futuros. Nada de esto es asesoramiento
      financiero ni una invitación a comprar o vender.
    </p>
  );
}
