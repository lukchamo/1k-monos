/** Lectura de la respuesta del gráfico diario de Yahoo. Pura: se prueba en Node. */

/** parte pura de la fuente de Yahoo: elige la vela de `date` y comprueba que está cerrada */
export function yahooClose(res: any, date: string, nowSec: number): number | null {
  const ts: number[] = res?.timestamp ?? [];
  const off: number = res?.meta?.gmtoffset ?? 0;
  const day = (t: number) => new Date((t + off) * 1000).toISOString().slice(0, 10);
  const i = ts.findIndex((t) => day(t) === date);
  if (i < 0) return null;
  const hasLater = ts.some((t) => day(t) > date);
  // sin vela posterior vale si el periodo de negociación vigente ya es de un día posterior (Madrid o cripto
  // pasada la medianoche) o si la sesión de ese mismo día ya terminó (Nueva York por la noche)
  const end: number | undefined = res?.meta?.currentTradingPeriod?.regular?.end;
  const crypto = res?.meta?.instrumentType === "CRYPTOCURRENCY";
  const closed = hasLater || (typeof end === "number" && (day(end) > date || (day(end) === date && nowSec >= end && !crypto)));
  if (!closed) return null;
  let v: unknown = res?.indicators?.adjclose?.[0]?.adjclose?.[i] ?? res?.indicators?.quote?.[0]?.close?.[i];
  // algunas bolsas dejan la vela del último día sin cierre durante horas: vale el último precio si es de esa sesión
  const rmt: number | undefined = res?.meta?.regularMarketTime;
  if (typeof v !== "number" && typeof rmt === "number" && day(rmt) === date) v = res?.meta?.regularMarketPrice;
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}
