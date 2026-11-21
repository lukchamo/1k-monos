"use client";

import { useEffect, useState } from "react";

type State = "checking" | "unsupported" | "ios-install" | "off" | "on" | "denied" | "working" | "error";

function keyBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
  const raw = atob((b64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const post = (action: string, body: unknown) => fetch(`/api/push/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

/** Botón para recibir un aviso del navegador cuando el laboratorio registra llamadas nuevas. */
export function PushToggle() {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        // en iPhone los avisos solo existen si la web está añadida a la pantalla de inicio
        const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
        setState(ios ? "ios-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setState("denied");
      try {
        const reg = await navigator.serviceWorker.getRegistration("/");
        const sub = await reg?.pushManager.getSubscription();
        setState(sub ? "on" : "off");
      } catch {
        setState("off");
      }
    })();
  }, []);

  async function turnOn() {
    setState("working");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const res = await fetch("/api/push/key");
      if (!res.ok) throw new Error("sin clave");
      const { key } = (await res.json()) as { key: string };
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
      const ok = await post("subscribe", sub.toJSON());
      if (!ok.ok) {
        await sub.unsubscribe();
        throw new Error("no se pudo guardar");
      }
      setState("on");
    } catch {
      setState("error");
    }
  }

  async function turnOff() {
    setState("working");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await post("unsubscribe", { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setState("error");
    }
  }

  const note: Record<State, string> = {
    checking: "",
    working: "",
    off: "Un aviso en este dispositivo cuando el laboratorio registre posiciones nuevas. Sin correo ni cuenta.",
    on: "Avisos activados en este dispositivo.",
    denied: "Los avisos están bloqueados para esta web. Actívalos en los permisos del navegador y recarga.",
    unsupported: "Este navegador no admite avisos.",
    "ios-install": "En iPhone: pulsa Compartir → «Añadir a pantalla de inicio», abre 1K Monos desde ahí y activa los avisos.",
    error: "No se pudo completar. Inténtalo de nuevo en un momento.",
  };

  const canToggle = state === "off" || state === "on" || state === "error";
  return (
    <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" aria-live="polite">
      <div className="min-w-0 space-y-1">
        <p className="flex items-center gap-2 font-medium">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={state === "on" ? "text-brand" : "text-ink-2"}>
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          Avísame cuando detecte algo
        </p>
        <p className="text-sm text-ink-2">{note[state] || "Comprobando…"}</p>
        <p className="text-xs text-ink-3">Los avisos describen lo que pasó en el experimento. No son una recomendación de inversión.</p>
      </div>
      {canToggle || state === "working" ? (
        <button
          type="button"
          onClick={state === "on" ? turnOff : turnOn}
          disabled={state === "working"}
          className={`shrink-0 rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-60 ${state === "on" ? "border border-line hover:border-ink-2" : "bg-brand text-brand-ink hover:brightness-110"}`}
        >
          {state === "working" ? "Un momento…" : state === "on" ? "Desactivar avisos" : "Activar avisos"}
        </button>
      ) : null}
    </div>
  );
}
