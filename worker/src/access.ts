/**
 * Verificación del JWT de Cloudflare Access (cabecera Cf-Access-Jwt-Assertion).
 *
 * El MCP privado vive en un hostname protegido por Access (Zero Trust) con Managed OAuth: el cliente
 * MCP hace el flujo OAuth contra Access, la persona entra con un código de un solo uso y Access
 * reenvía cada petición con un JWT firmado. Aquí se comprueba firma, emisor, audiencia y caducidad.
 * Sin tipos de Workers: se prueba en Node.
 */
export interface AccessConfig {
  /** dominio del equipo, p. ej. "mi-equipo.cloudflareaccess.com" */
  teamDomain: string;
  /** etiqueta AUD de la aplicación de Access */
  aud: string;
}

export interface AccessIdentity {
  email: string | null;
  sub: string;
}

type Jwk = JsonWebKey & { kid?: string };
type KeyLoader = (url: string) => Promise<{ keys?: Jwk[] }>;

const KEYS_TTL_MS = 10 * 60 * 1000;
let cache: { url: string; at: number; keys: Jwk[] } | null = null;

const defaultLoader: KeyLoader = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`claves de Access: HTTP ${r.status}`);
  return (await r.json()) as { keys?: Jwk[] };
};

function b64url(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function parse(part: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(new TextDecoder().decode(b64url(part)));
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

/** devuelve la identidad si el JWT es válido para esta aplicación; null en cualquier otro caso */
export async function verifyAccessJwt(token: string | null | undefined, cfg: AccessConfig, opts: { now?: number; load?: KeyLoader } = {}): Promise<AccessIdentity | null> {
  if (!token || token.length > 8192 || !cfg.teamDomain || !cfg.aud) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const header = parse(parts[0]);
  const claims = parse(parts[1]);
  if (!header || !claims) return null;
  // solo RS256: nunca "none" ni un algoritmo elegido por quien envía el token
  if (header.alg !== "RS256" || typeof header.kid !== "string") return null;

  const now = Math.floor((opts.now ?? Date.now()) / 1000);
  if (claims.iss !== `https://${cfg.teamDomain}`) return null;
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(cfg.aud)) return null;
  if (typeof claims.exp !== "number" || claims.exp <= now) return null;
  if (typeof claims.nbf === "number" && claims.nbf > now + 60) return null;

  const url = `https://${cfg.teamDomain}/cdn-cgi/access/certs`;
  const load = opts.load ?? defaultLoader;
  const find = (keys: Jwk[]) => keys.find((k) => k.kid === header.kid && k.kty === "RSA");
  let jwk = cache && cache.url === url && Date.now() - cache.at < KEYS_TTL_MS ? find(cache.keys) : undefined;
  if (!jwk) {
    // clave desconocida o caché vencida: se recargan (Access rota las claves)
    try {
      const keys = (await load(url)).keys ?? [];
      cache = { url, at: Date.now(), keys };
      jwk = find(keys);
    } catch {
      return null;
    }
  }
  if (!jwk) return null;

  try {
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64url(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if (!ok) return null;
  } catch {
    return null;
  }
  return { email: typeof claims.email === "string" ? claims.email : null, sub: typeof claims.sub === "string" ? claims.sub : "" };
}

/** solo para tests */
export function resetAccessKeyCache(): void {
  cache = null;
}
