/* Service worker: يخزّن ملفات الواجهة فقط ليفتح التطبيق بسرعة. طلبات الخادم (Supabase) لا تُخزَّن أبداً. */
const CACHE = "we-books-v3.14.0";
const SHELL = ["./", "index.html", "app.css?v=3.14.0", "config.js", "js/icons.js?v=3.14.0", "img/logo-we.png", "img/logo-union.png", "js/art.js?v=3.14.0", "js/core.js?v=3.14.0", "js/docs.js?v=3.14.0", "js/app.js?v=3.14.0", "js/employee.js?v=3.14.0", "js/admin.js?v=3.14.0", "js/reports.js?v=3.14.0", "js/insights.js?v=3.14.0", "js/pickup.js?v=3.14.0",
  "fonts/cairo-arabic-400-normal.woff2", "fonts/cairo-arabic-700-normal.woff2", "icons/icon-192.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  // الشبكة أولاً للصفحة وملف الإعداد (لتصل التحديثات فوراً)، والتخزين أولاً لباقي الأصول
  if (e.request.mode === "navigate" || u.pathname.endsWith("config.js")) {
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); } return res; })));
});
