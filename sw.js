// Pana Moto: guarda la app para abrir rápido y funcionar con poca señal.
// Siempre intenta la versión más nueva primero (red), y usa la guardada si no hay conexión.
const VERSION = "pm-v22";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./badge-96.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Archivos de la app: red primero, copia guardada si no hay señal
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req, {cache: "no-cache"}).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
    );
    return;
  }

  // Librería del mapa y fuentes: guardadas primero (no cambian)
  if (/leaflet|fonts\.(googleapis|gstatic)\.com/.test(url.href)) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy));
        return res;
      }))
    );
  }
});

// Avisos (push): se muestran cuando la app está cerrada o en segundo plano
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data.json(); } catch { d = { title: "Pana Moto", body: e.data ? e.data.text() : "" }; }
  e.waitUntil((async () => {
    const wins = await clients.matchAll({ type: "window", includeUncontrolled: true });
    if (wins.some(w => w.visibilityState === "visible" && w.focused)) return; // la app ya está en pantalla
    await self.registration.showNotification(d.title || "Pana Moto", {
      body: d.body || "", icon: "icon-192.png", badge: "badge-96.png", tag: d.tag || undefined,
      renotify: !!d.tag, vibrate: [200, 100, 200], data: { url: d.url || "./" }
    });
  })());
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil((async () => {
    const wins = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) { if ("focus" in w) return w.focus(); }
    return clients.openWindow(e.notification.data?.url || "./");
  })());
});
