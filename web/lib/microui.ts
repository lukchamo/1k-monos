import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import bundledIndex from "@/microui/index.json";
import podio from "@/microui/podio.json";
import monos from "@/microui/monos-vs-tesis.json";
import pulso from "@/microui/pulso-noticias.json";

/**
 * Micro-interfaces: pequeñas vistas declarativas que escriben agentes (o personas) y que la web
 * pinta con los datos del laboratorio. Viven como archivos JSON en un repositorio Git de
 * Cloudflare Artifacts, así cada cambio queda versionado y firmado por quien lo hizo.
 *
 * Guardarraíl: una micro-interfaz NO es código. Es un JSON que solo puede elegir entre cuatro
 * bloques conocidos y leer rutas de un conjunto cerrado de datos. Nada de HTML, scripts ni URLs.
 */

export type Format = "pct" | "int" | "num" | "text";
export type Block =
  | { type: "text"; text: string }
  | { type: "stat"; label: string; source: string; format?: Format }
  | { type: "bars"; title?: string; source: string; label: string; value: string; format?: Format; limit?: number; max?: number }
  | { type: "table"; title?: string; source: string; limit?: number; columns: { label: string; field: string }[] };

export interface MicroUI {
  id: string;
  title: string;
  author: string;
  description: string;
  blocks: Block[];
}

export interface Commit {
  hash: string;
  message: string;
  author: string;
  date: string | null;
}

export interface MicroUISet {
  /** de dónde salieron: el repositorio de Artifacts o las especificaciones del repo de GitHub */
  origin: "artifacts" | "bundled";
  items: MicroUI[];
  history: Commit[];
  rejected: string[];
}

const ROOTS = new Set(["ranking", "news", "status", "positions"]);
const PATH = /^[a-z_]+(\.[a-z0-9_]+){0,5}$/;
const FIELD = /^[a-z_]+(\.[a-z0-9_]+){0,3}$/;
const FORMATS = new Set(["pct", "int", "num", "text"]);
const MAX_BLOCKS = 8;
const MAX_ITEMS = 12;
const MAX_BYTES = 16_000;

const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.length > 0 && v.length <= max ? v : null);
const path = (v: unknown): string | null => (typeof v === "string" && PATH.test(v) && ROOTS.has(v.split(".")[0]) ? v : null);
const field = (v: unknown): string | null => (typeof v === "string" && FIELD.test(v) ? v : null);
const limit = (v: unknown, dflt: number) => (Number.isInteger(v) && (v as number) > 0 && (v as number) <= 20 ? (v as number) : dflt);
const fmt = (v: unknown): Format | undefined => (typeof v === "string" && FORMATS.has(v) ? (v as Format) : undefined);

/** valida una especificación entera; devuelve null si algo no encaja (se rechaza completa, no se «arregla») */
export function parseMicroUI(raw: unknown): MicroUI | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" && /^[a-z0-9-]{1,40}$/.test(o.id) ? o.id : null;
  const title = str(o.title, 80);
  const author = str(o.author, 40);
  const description = str(o.description, 240);
  if (!id || !title || !author || !description || !Array.isArray(o.blocks) || o.blocks.length === 0 || o.blocks.length > MAX_BLOCKS) return null;
  const blocks: Block[] = [];
  for (const b of o.blocks as Record<string, unknown>[]) {
    if (!b || typeof b !== "object") return null;
    if (b.type === "text") {
      const text = str(b.text, 400);
      if (!text) return null;
      blocks.push({ type: "text", text });
    } else if (b.type === "stat") {
      const label = str(b.label, 40);
      const source = path(b.source);
      if (!label || !source) return null;
      blocks.push({ type: "stat", label, source, format: fmt(b.format) });
    } else if (b.type === "bars") {
      const source = path(b.source);
      const label = field(b.label);
      const value = field(b.value);
      if (!source || !label || !value) return null;
      blocks.push({ type: "bars", title: str(b.title, 80) ?? undefined, source, label, value, format: fmt(b.format), limit: limit(b.limit, 8), max: typeof b.max === "number" && b.max > 0 ? b.max : undefined });
    } else if (b.type === "table") {
      const source = path(b.source);
      if (!source || !Array.isArray(b.columns) || b.columns.length === 0 || b.columns.length > 5) return null;
      const columns: { label: string; field: string }[] = [];
      for (const c of b.columns as Record<string, unknown>[]) {
        const l = str(c?.label, 30);
        const f = field(c?.field);
        if (!l || !f) return null;
        columns.push({ label: l, field: f });
      }
      blocks.push({ type: "table", title: str(b.title, 80) ?? undefined, source, limit: limit(b.limit, 5), columns });
    } else {
      return null;
    }
  }
  return { id, title, author, description, blocks };
}

/** lee una ruta con puntos sin tocar prototipos ni salirse del objeto */
export function read(data: unknown, dotted: string): unknown {
  let cur: unknown = data;
  for (const key of dotted.split(".")) {
    if (cur === null || typeof cur !== "object" || key === "__proto__" || key === "constructor" || key === "prototype") return undefined;
    if (!Object.prototype.hasOwnProperty.call(cur, key)) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

interface ArtifactsRepo {
  readFile(args: { ref: string; path: string }): Promise<Blob | null>;
  log(opts?: { ref?: string; limit?: number }): Promise<unknown>;
  [Symbol.dispose]?: () => void;
}

const REPO = "microui";
const BUNDLED: unknown[] = [podio, monos, pulso];

function bundled(): MicroUISet {
  const items = BUNDLED.map(parseMicroUI).filter((x): x is MicroUI => x !== null);
  return { origin: "bundled", items, history: [], rejected: [] };
}

async function text(repo: ArtifactsRepo, p: string): Promise<string | null> {
  const blob = await repo.readFile({ ref: "main", path: p });
  if (!blob || blob.size > MAX_BYTES) return null;
  return blob.text();
}

export async function getMicroUIs(): Promise<MicroUISet> {
  let repo: ArtifactsRepo | null = null;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const artifacts = (env as { ARTIFACTS?: { get(name: string): Promise<ArtifactsRepo> } }).ARTIFACTS;
    if (!artifacts) return bundled();
    repo = await artifacts.get(REPO);
    const idx = JSON.parse((await text(repo, "index.json")) ?? "null") as { items?: unknown } | null;
    const names = Array.isArray(idx?.items) ? (idx.items as unknown[]).filter((n): n is string => typeof n === "string" && /^[a-z0-9-]{1,40}\.json$/.test(n)).slice(0, MAX_ITEMS) : [];
    if (!names.length) return bundled();
    const items: MicroUI[] = [];
    const rejected: string[] = [];
    const files = await Promise.all(names.map((n) => text(repo!, n).catch(() => null)));
    files.forEach((f, i) => {
      let ui: MicroUI | null = null;
      try {
        ui = f ? parseMicroUI(JSON.parse(f)) : null;
      } catch {
        ui = null;
      }
      if (ui) items.push(ui);
      else rejected.push(names[i]);
    });
    const rawLog = await repo.log({ ref: "main", limit: 8 }).catch(() => []);
    const list = Array.isArray(rawLog) ? rawLog : ((rawLog as { commits?: unknown[] })?.commits ?? []);
    const history: Commit[] = (list as Record<string, unknown>[]).slice(0, 8).map((c) => {
      const a = c.author as Record<string, unknown> | string | undefined;
      const ts = (typeof a === "object" ? a?.timestamp : undefined) ?? c.timestamp ?? c.date;
      return {
        hash: String(c.hash ?? c.oid ?? c.sha ?? "").slice(0, 7),
        message: String(c.message ?? "").split("\n")[0].slice(0, 120),
        author: String((typeof a === "object" ? a?.name : a) ?? "").slice(0, 40),
        date: typeof ts === "number" ? new Date(ts * (ts < 1e12 ? 1000 : 1)).toISOString() : typeof ts === "string" ? ts : null,
      };
    });
    return items.length ? { origin: "artifacts", items, history, rejected } : bundled();
  } catch (err) {
    console.error(JSON.stringify({ level: "warn", message: "Artifacts no disponible, usando micro-interfaces del repositorio", error: String(err) }));
    return bundled();
  } finally {
    repo?.[Symbol.dispose]?.();
  }
}

export const BUNDLED_INDEX = bundledIndex;
