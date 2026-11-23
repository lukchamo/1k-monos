import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetAccessKeyCache, verifyAccessJwt } from "../src/access";

const cfg = { teamDomain: "equipo.cloudflareaccess.com", aud: "aud-de-prueba" };
const NOW = Date.UTC(2026, 10, 23, 12);
const enc = (o: unknown) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");

let pair: CryptoKeyPair;
let other: CryptoKeyPair;
let jwks: { keys: (JsonWebKey & { kid: string })[] };
let loads = 0;
const load = async () => (loads++, jwks);

async function sign(claims: Record<string, unknown>, header: Record<string, unknown> = { alg: "RS256", kid: "k1" }, key = pair.privateKey) {
  const body = `${enc(header)}.${enc(claims)}`;
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(body));
  return `${body}.${Buffer.from(sig).toString("base64url")}`;
}
const good = (extra: Record<string, unknown> = {}) => ({ iss: `https://${cfg.teamDomain}`, aud: [cfg.aud], exp: NOW / 1000 + 600, sub: "u1", email: "persona@example.com", ...extra });

beforeAll(async () => {
  const gen = () => crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  [pair, other] = await Promise.all([gen(), gen()]);
  jwks = { keys: [{ ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid: "k1" }] };
});
beforeEach(() => {
  resetAccessKeyCache();
  loads = 0;
});

describe("Cloudflare Access · JWT", () => {
  it("acepta un token válido y devuelve la identidad", async () => {
    expect(await verifyAccessJwt(await sign(good()), cfg, { now: NOW, load })).toEqual({ email: "persona@example.com", sub: "u1" });
  });
  it("guarda las claves: dos verificaciones, una sola descarga", async () => {
    const t = await sign(good());
    await verifyAccessJwt(t, cfg, { now: NOW, load });
    await verifyAccessJwt(t, cfg, { now: NOW, load });
    expect(loads).toBe(1);
  });
  it("rechaza lo que no es de esta aplicación o está caducado", async () => {
    const cases = [
      good({ aud: ["otra-app"] }),
      good({ iss: "https://atacante.cloudflareaccess.com" }),
      good({ exp: NOW / 1000 - 1 }),
      good({ exp: undefined }),
      good({ nbf: NOW / 1000 + 3600 }),
    ];
    for (const c of cases) expect(await verifyAccessJwt(await sign(c), cfg, { now: NOW, load })).toBeNull();
  });
  it("rechaza firmas ajenas, alg none y tokens manipulados", async () => {
    expect(await verifyAccessJwt(await sign(good(), { alg: "RS256", kid: "k1" }, other.privateKey), cfg, { now: NOW, load })).toBeNull();
    expect(await verifyAccessJwt(await sign(good(), { alg: "RS256", kid: "desconocida" }), cfg, { now: NOW, load })).toBeNull();
    expect(await verifyAccessJwt(`${enc({ alg: "none", kid: "k1" })}.${enc(good())}.`, cfg, { now: NOW, load })).toBeNull();
    expect(await verifyAccessJwt(`${enc({ alg: "HS256", kid: "k1" })}.${enc(good())}.${enc("x")}`, cfg, { now: NOW, load })).toBeNull();
    const [h, , s] = (await sign(good())).split(".");
    expect(await verifyAccessJwt(`${h}.${enc(good({ email: "otro@example.com" }))}.${s}`, cfg, { now: NOW, load })).toBeNull();
  });
  it("rechaza entradas vacías, basura y configuración incompleta", async () => {
    for (const t of [null, undefined, "", "a.b", "a.b.c", "x".repeat(9000)]) expect(await verifyAccessJwt(t, cfg, { now: NOW, load })).toBeNull();
    const t = await sign(good());
    expect(await verifyAccessJwt(t, { teamDomain: "", aud: cfg.aud }, { now: NOW, load })).toBeNull();
    expect(await verifyAccessJwt(t, { teamDomain: cfg.teamDomain, aud: "" }, { now: NOW, load })).toBeNull();
  });
  it("si no se pueden descargar las claves, no autoriza", async () => {
    const fails = async () => {
      throw new Error("sin red");
    };
    expect(await verifyAccessJwt(await sign(good()), cfg, { now: NOW, load: fails })).toBeNull();
  });
});
