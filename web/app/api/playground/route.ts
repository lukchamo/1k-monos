import { labFetch } from "@/lib/api";

/** Cierres y posiciones diarias de un inversionista para el simulador. Se cachea en el borde 5 minutos. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("investor") ?? "";
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) return Response.json({ error: "inversionista inválido" }, { status: 400 });
  const res = await labFetch(`/v1/playground?investor=${id}`);
  if (!res) return Response.json({ error: "el laboratorio no responde" }, { status: 503 });
  return new Response(await res.text(), {
    status: res.status,
    headers: { "content-type": "application/json", "cache-control": res.ok ? "public, max-age=60, s-maxage=300, stale-while-revalidate=600" : "no-store" },
  });
}
