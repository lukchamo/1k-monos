import { labFetch } from "@/lib/api";

const ACTIONS = new Set(["key", "subscribe", "unsubscribe"]);
const MAX_BODY = 4096;

/**
 * Puente entre el navegador y la API para los avisos. Existe para que el navegador solo hable con
 * este mismo origen (la política de contenido no permite otros) y para pasar la IP del visitante
 * a la API, que es quien aplica el límite de ritmo.
 */
async function handle(req: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (!ACTIONS.has(action)) return Response.json({ error: "no encontrado" }, { status: 404 });
  const isKey = action === "key";
  if (isKey !== (req.method === "GET")) return Response.json({ error: "método no permitido" }, { status: 405 });

  let body: string | undefined;
  if (!isKey) {
    // solo peticiones de esta misma web: un sitio ajeno no puede suscribir a nadie en nombre de otro
    const origin = req.headers.get("origin");
    if (origin && new URL(origin).host !== new URL(req.url).host) return Response.json({ error: "origen no permitido" }, { status: 403 });
    body = await req.text();
    if (body.length > MAX_BODY) return Response.json({ error: "cuerpo demasiado grande" }, { status: 400 });
  }
  const res = await labFetch(`/v1/push/${action}`, { method: req.method, body, clientIp: req.headers.get("cf-connecting-ip") });
  if (!res) return Response.json({ error: "avisos no disponibles" }, { status: 503 });
  return new Response(await res.text(), { status: res.status, headers: { "content-type": "application/json", "cache-control": isKey ? "public, max-age=300" : "no-store" } });
}

export const GET = handle;
export const POST = handle;
