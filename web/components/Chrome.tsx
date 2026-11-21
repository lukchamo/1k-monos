import Link from "next/link";
import { SITE } from "@/lib/site";

const NAV = [
  { href: "/#ranking", label: "Ranking" },
  { href: "/#posiciones", label: "Posiciones" },
  { href: "/noticias", label: "Noticias" },
  { href: "/metodo", label: "Método" },
  { href: "/experimentos", label: "Experimentos" },
];

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight" aria-label={`${SITE.name}, inicio`}>
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#ffd84d" />
        <circle cx="7" cy="14" r="4" fill="#1a1500" />
        <circle cx="25" cy="14" r="4" fill="#1a1500" />
        <circle cx="16" cy="16" r="9.5" fill="#1a1500" />
        <ellipse cx="16" cy="18.5" rx="6.2" ry="5.4" fill="#ffd84d" />
        <circle cx="13" cy="13.2" r="1.5" fill="#ffd84d" />
        <circle cx="19" cy="13.2" r="1.5" fill="#ffd84d" />
        <path d="M12.8 19.6c1.9 1.7 4.5 1.7 6.4 0" stroke="#1a1500" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </svg>
      <span>
        1K <span className="text-brand">Monos</span>
      </span>
    </Link>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Logo />
        <nav aria-label="Principal" className="ml-auto flex items-center gap-1 overflow-x-auto text-sm text-ink-2">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-md px-2.5 py-1.5 hover:bg-surface-2 hover:text-ink">
              {n.label}
            </Link>
          ))}
          <a
            href={SITE.repo}
            target="_blank"
            rel="noreferrer"
            className="ml-1 whitespace-nowrap rounded-md border border-line px-2.5 py-1.5 text-ink hover:border-brand hover:text-brand"
          >
            Código abierto
          </a>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm text-ink-2 md:grid-cols-3">
        <div className="space-y-3">
          <Logo />
          <p>{SITE.tagline}. Un experimento abierto de CooWeb y LuchoIA.</p>
        </div>
        <div className="space-y-2">
          <p className="eyebrow">Proyecto</p>
          <ul className="space-y-1.5">
            <li><Link className="hover:text-ink" href="/metodo">Cómo funciona</Link></li>
            <li><Link className="hover:text-ink" href="/experimentos">Micro-interfaces experimentales</Link></li>
            <li><a className="hover:text-ink" href={SITE.repo} target="_blank" rel="noreferrer">Repositorio en GitHub</a></li>
            <li><a className="hover:text-ink" href={`${SITE.repo}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noreferrer">Cómo contribuir</a></li>
          </ul>
        </div>
        <div className="space-y-2">
          <p className="eyebrow">Aviso</p>
          <p>
            Laboratorio educativo y experimental. No es una recomendación ni asesoramiento de inversión. Los modelos solo etiquetan noticias; las
            decisiones las toman reglas fijas y públicas. <Link className="underline underline-offset-2 hover:text-ink" href="/aviso">Aviso completo</Link>.
          </p>
        </div>
      </div>
    </footer>
  );
}
