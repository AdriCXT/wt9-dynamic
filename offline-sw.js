/* Offline-Speicher: Seite kommt immer frisch aus dem Netz; nur offline (oder bei sehr langsamem Netz) aus dem Handy-Speicher. */
const CACHE = "alltag-v1";
const STATIC = /\/(sounds|icons)\/|manifest\.webmanifest$/;
const FONTS = /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|www\.gstatic\.com\/firebasejs\/)/;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("alltag-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));

self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.pathname.includes("/push/")) return;               // OneSignal nicht anfassen

  /* Seite selbst: zuerst frisch aus dem Netz, nur offline / nach 5 s ohne Antwort aus dem Speicher */
  const root = new URL("./", self.registration.scope).pathname;
  if (r.mode === "navigate" && u.origin === location.origin && (u.pathname === root || u.pathname === root + "index.html")) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const key = new URL("./", self.registration.scope).href;
      const net = fetch(r, { cache: "no-store" }).then(res => { if (res.ok) c.put(key, res.clone()); return res; });
      const slow = new Promise(res => setTimeout(res, 5000)).then(() => c.match(key));
      try {
        const first = await Promise.race([net, slow]);
        if (first) return first;
        return await net;
      } catch (err) {
        return (await c.match(key)) || Response.error();
      }
    }));
    return;
  }

  /* Töne, Icons, Schriften: einmal laden, dann immer aus dem Speicher */
  if ((u.origin === location.origin && STATIC.test(u.pathname)) || FONTS.test(r.url)) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(r);
      if (hit) return hit;
      const res = await fetch(r);
      if (res.ok || res.type === "opaque") c.put(r, res.clone());
      return res;
    }));
  }
});
