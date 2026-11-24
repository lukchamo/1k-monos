/** Lectura de la respuesta del gráfico diario de Yahoo. Pura: se prueba en Node. */

/** parte pura de la fuente de Yahoo: elige la vela de `date` y comprueba que está cerrada */
export function yahooClose(res: any, date: string, nowSec: number): number | null {
  const ts: number[] = res?.timestamp ?? [];
  const off: number = res?.meta?.gmtoffset ?? 0;
  const day = (t: number) => new Date((t + off) * 1000).toISOString().slice(0, 10);
  const i = ts.findIndex((t) => day(t) === date);
  if (i < 0) return null;
  const hasLater = ts.some((t) => day(t) > date);
  // sin vela posterior, solo vale si la sesión de ese día ya terminó
  const end: number | undefined = res?.meta?.currentTradingPeriod?.regular?.end;
  const closed = hasLater || (typeof end === "number" && day(end) === date && nowSec >= end && res?.meta?.instrumentType !== "CRYPTOCURRENCY");
  if (!closed) return null;
  const v = res?.indicators?.adjclose?.[0]?.adjclose?.[i] ?? res?.indicators?.quote?.[0]?.close?.[i];
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}
