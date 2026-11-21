/**
 * MCP propio (JSON-RPC 2.0 sobre HTTP, sin estado). Cinco herramientas, contratos en docs/MCP.md.
 * Para terceros es de solo lectura: `correr_backtest` exige el token MCP_TOKEN.
 * Si más adelante se necesita sesión o streaming, migrar al SDK de MCP de Cloudflare sin tocar los contratos.
 */
import type { Env } from "./env";
import { decisionReason, newsFor, ranking } from "./data/store";
import { backtestParams, BadInput, DISCLAIMER, fail, json, readJson, tokenOk, v } from "./guard";
import { GROUPS, INDICATORS, UNIVERSE } from "./engine/universe";
import { LINEUP } from "./engine/registry";

const SYMBOLS = new Set<string>([...UNIVERSE, INDICATORS.vix, INDICATORS.tnx]);
const INVESTORS = new Set(LINEUP.map((s) => s.id));
const sym = (x: unknown) => {
  const s = v.symbol(x, "simbolo");
  if (!SYMBOLS.has(s)) throw new BadInput("símbolo fuera del universo del laboratorio");
  return s;
};
const inv = (x: unknown) => {
  const s = v.slug(x, "inversionista");
  if (!INVESTORS.has(s)) throw new BadInput("inversionista desconocido");
  return s;
};
const seg = (x: unknown) => {
  if (x === undefined || x === null || x === "_global") return "_global";
  const s = v.segment(x, "segmento");
  if (!(s in GROUPS)) throw new BadInput("segmento desconocido");
  return s;
};
const MAX_BATCH = 10;
import { lector, pressure, pressureBreakdown } from "./news/scoring";

const PROTOCOL = "2025-06-18";
const SERVER = { name: "laboratorio-inversionistas", version: "1.0.0" };

type Json = Record<string, unknown>;
interface Tool {
  name: string;
  description: string;
  inputSchema: Json;
  write?: boolean;
  run: (env: Env, args: any) => Promise<unknown>;
}

const TOOLS: Tool[] = [
  {
    name: "ranking",
    description: "Ranking de inversionistas de la última corrida (o de run_id), global o por segmento, con percentil frente a los monos y Sharpe deflactado.",
    inputSchema: { type: "object", properties: { segmento: { type: "string", description: "p. ej. 'Cripto' o '_global'" }, run_id: { type: "string" } } },
    run: (env, a) => ranking(env.DB, a.run_id ? v.runId(a.run_id, "run_id") : undefined, seg(a.segmento)),
  },
  {
    name: "explicar_decision",
    description: "Por qué un inversionista tomó una posición en un activo una fecha: devuelve el reason_json con los números de la regla.",
    inputSchema: {
      type: "object",
      required: ["inversionista", "simbolo"],
      properties: { inversionista: { type: "string" }, simbolo: { type: "string" }, fecha: { type: "string", description: "YYYY-MM-DD; por defecto la última" }, run_id: { type: "string", description: "por defecto 'paper'" } },
    },
    run: async (env, a) =>
      (await decisionReason(env.DB, inv(a.inversionista), sym(a.simbolo), a.fecha ? v.date(a.fecha, "fecha") : undefined, a.run_id ? v.runId(a.run_id, "run_id") : "paper")) ?? {
        error: "sin decisión registrada",
      },
  },
  {
    name: "correr_backtest",
    description: "Lanza un backtest del elenco completo entre dos fechas (Workflow). Devuelve el id de la corrida.",
    inputSchema: {
      type: "object",
      required: ["inicio", "fin"],
      properties: { inicio: { type: "string" }, fin: { type: "string" }, monos: { type: "integer", default: 2000 }, semilla: { type: "integer", default: 7 } },
    },
    write: true,
    run: async (env, a) => {
      const inst = await env.BACKTEST.create({ params: backtestParams(a) });
      return { run_id: inst.id, estado: await inst.status() };
    },
  },
  {
    name: "presion_noticias",
    description: "Presión de noticias de un activo en un instante (tanh de la suma de impactos vigentes), la señal de El Lector y las noticias que la empujan.",
    inputSchema: { type: "object", required: ["simbolo"], properties: { simbolo: { type: "string" }, instante: { type: "string", description: "ISO 8601; por defecto ahora" } } },
    run: async (env, a) => {
      const at = a.instante ? v.instant(a.instante, "instante") : new Date();
      const s = sym(a.simbolo);
      const evs = await newsFor(env.DB, s, at);
      const p = pressure(evs, s, at);
      return { simbolo: s, instante: at.toISOString(), presion: p, lector: lector(p), noticias: pressureBreakdown(evs, s, at).slice(0, 10) };
    },
  },
  {
    name: "comparar_versiones",
    description: "Compara dos corridas (campeón contra retador) inversionista a inversionista en un segmento.",
    inputSchema: { type: "object", required: ["run_a", "run_b"], properties: { run_a: { type: "string" }, run_b: { type: "string" }, segmento: { type: "string" } } },
    run: async (env, a) => {
      const { results } = await env.DB.prepare(
        `SELECT x.investor_id, x.total_return AS a_return, y.total_return AS b_return, x.dsr AS a_dsr, y.dsr AS b_dsr,
                y.total_return - x.total_return AS delta
         FROM metrics x JOIN metrics y ON y.investor_id = x.investor_id AND y.segment = x.segment
         WHERE x.run_id = ?1 AND y.run_id = ?2 AND x.segment = ?3 ORDER BY delta DESC`,
      )
        .bind(v.runId(a.run_a, "run_a"), v.runId(a.run_b, "run_b"), seg(a.segmento))
        .all();
      return { run_a: a.run_a, run_b: a.run_b, filas: results };
    },
  },
];

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}
function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function handle(env: Env, msg: any, authorized: boolean) {
  const { id, method, params } = msg ?? {};
  switch (method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: params?.protocolVersion ?? PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER,
        instructions: DISCLAIMER,
      });
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) return rpcError(id, -32602, `herramienta desconocida: ${params?.name}`);
      if (tool.write && !authorized) return rpcResult(id, { isError: true, content: [{ type: "text", text: "Esta herramienta exige el token del laboratorio." }] });
      try {
        const args = params?.arguments ?? {};
        if (typeof args !== "object" || Array.isArray(args)) throw new BadInput("arguments debe ser un objeto");
        const out = await tool.run(env, args);
        return rpcResult(id, { content: [{ type: "text", text: JSON.stringify({ aviso: DISCLAIMER, ...(out as object) }) }], structuredContent: out });
      } catch (err) {
        // los errores de validación se devuelven; el resto se registra y no se filtra
        if (err instanceof BadInput) return rpcResult(id, { isError: true, content: [{ type: "text", text: err.message }] });
        console.error(JSON.stringify({ level: "error", tool: tool.name, message: String(err) }));
        return rpcResult(id, { isError: true, content: [{ type: "text", text: "error interno de la herramienta" }] });
      }
    }
    default:
      return id === undefined ? null : rpcError(id, -32601, `método no soportado: ${method}`);
  }
}

export async function mcp(req: Request, env: Env): Promise<Response> {
  if (req.method !== "POST") return fail(405, "MCP: usa POST con JSON-RPC 2.0", { allow: "POST" });
  const authorized = await tokenOk(req, env.MCP_TOKEN);
  let body: any;
  try {
    body = await readJson(req, 32 * 1024);
  } catch {
    return json(rpcError(null, -32700, "JSON inválido o demasiado grande"), 400);
  }
  const msgs = Array.isArray(body) ? body : [body];
  if (msgs.length > MAX_BATCH) return json(rpcError(null, -32600, `máximo ${MAX_BATCH} mensajes por lote`), 400);
  const out = (await Promise.all(msgs.map((m) => handle(env, m, authorized)))).filter(Boolean);
  if (!out.length) return new Response(null, { status: 202 }); // solo notificaciones
  return json(Array.isArray(body) ? out : out[0]);
}

export const MCP_TOOL_NAMES = TOOLS.map((t) => t.name);
