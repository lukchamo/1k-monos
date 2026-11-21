import { describe, expect, it } from "vitest";
import { noticeFor, parseSubscription } from "../src/push-core";

const keys = { p256dh: "B".repeat(87), auth: "a".repeat(22) };

describe("avisos · suscripción", () => {
  it("acepta los servicios de push conocidos", () => {
    for (const endpoint of ["https://fcm.googleapis.com/fcm/send/abc", "https://updates.push.services.mozilla.com/wpush/v2/x", "https://web.push.apple.com/Qx", "https://wns2-par02p.notify.windows.com/w/?token=x"])
      expect(parseSubscription({ endpoint, keys }).endpoint).toContain("https://");
  });
  it("rechaza cualquier otro destino (evita que nos hagan llamar a sitios arbitrarios)", () => {
    for (const endpoint of ["https://evil.com/x", "http://fcm.googleapis.com/x", "https://fcm.googleapis.com.evil.com/x", "https://169.254.169.254/latest", "https://user:pw@fcm.googleapis.com/x", "https://fcm.googleapis.com:8443/x", "javascript:alert(1)", ""])
      expect(() => parseSubscription({ endpoint, keys })).toThrow();
  });
  it("rechaza claves mal formadas", () => {
    const endpoint = "https://fcm.googleapis.com/fcm/send/abc";
    expect(() => parseSubscription({ endpoint, keys: { ...keys, auth: "<script>" } })).toThrow();
    expect(() => parseSubscription({ endpoint, keys: { ...keys, p256dh: "corta" } })).toThrow();
    expect(() => parseSubscription({ endpoint })).toThrow();
  });
});

describe("avisos · texto", () => {
  const call = { date: "2026-11-20", symbol: "TLT", direction: 1 as const, score: 0.32, n_long: 12, n_short: 3, n_total: 28, entry_close: 88 };
  it("describe lo registrado y siempre dice que no es una recomendación", () => {
    const n = noticeFor({ date: "2026-11-20", calls: [call], verified: [], record: { total: 0, hits: 0, avg_ret: null } }, "https://lab.test")!;
    expect(n.body).toContain("TLT en largo");
    expect(n.body).toContain("no una recomendación");
    expect(n.body).not.toMatch(/compra|vende|invierte/i);
  });
  it("sin llamadas no hay aviso", () => {
    expect(noticeFor({ date: "d", calls: [], verified: [], record: { total: 0, hits: 0, avg_ret: null } }, "x")).toBeNull();
  });
});
