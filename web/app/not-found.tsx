import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-24">
      <p className="eyebrow">404</p>
      <h1 className="text-3xl font-semibold tracking-tight">Aquí no hay ningún mono</h1>
      <p className="text-ink-2">La página que buscas no existe o cambió de sitio.</p>
      <Link href="/" className="rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-ink">Volver al ranking</Link>
    </div>
  );
}
