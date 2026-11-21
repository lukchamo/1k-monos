// Service worker de 1K Monos: solo recibe avisos y abre la web al tocarlos. No guarda nada en caché.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch (_) {
    d = {};
  }
  const title = typeof d.title === "string" ? d.title.slice(0, 80) : "1K Monos";
  const body = typeof d.body === "string" ? d.body.slice(0, 300) : "Hay novedades en el laboratorio.";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: typeof d.tag === "string" ? d.tag.slice(0, 40) : "1k-monos",
      data: { url: typeof d.url === "string" ? d.url : "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // solo se abre una dirección de esta misma web, venga lo que venga en el aviso
  let target = "/";
  try {
    const u = new URL(event.notification.data && event.notification.data.url ? event.notification.data.url : "/", self.location.origin);
    if (u.origin === self.location.origin) target = u.pathname + u.search + u.hash;
  } catch (_) {
    target = "/";
  }
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if ("focus" in c) return c.navigate(target).then((w) => (w || c).focus());
      return self.clients.openWindow(target);
    }),
  );
});
