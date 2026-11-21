import { labFetch } from "@/lib/api";

/** Precios de cierre y recuento diario de largos y cortos del laboratorio, para el playground. */
export async function GET() {
  const res = await labFetch("/v1/market", { timeoutMs: 20_000 });
  if (!res) return Response.json({ error: "el laboratorio no responde" }, { status: 503 });
  return new Response(await res.text(), {
    status: res.status,
    headers: { "content-type": "application/json", "cache-control": res.ok ? "public, max-age=60, s-maxage=300, stale-while-revalidate=600" : "no-store" },
  });
}
