// ─── Service Worker · Piano Alimentare Familiare ──────────────────
// Strategia: cache-first per gli asset noti, con caching dinamico
// delle librerie esterne (React, Babel) al primo caricamento online.
// Così l'app funziona davvero offline dopo la prima apertura.

const CACHE = "piano-alimentare-v4";

// Asset locali dell'app
const LOCAL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
];

// Librerie esterne necessarie (vengono cachate al primo avvio online)
const CDN_ASSETS = [
  "https://unpkg.com/react@18/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
  "https://unpkg.com/@babel/standalone/babel.min.js",
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(async cache => {
      // Gli asset locali sono obbligatori
      await cache.addAll(LOCAL_ASSETS);
      // I CDN sono "best effort": se uno fallisce non blocca l'installazione
      await Promise.allSettled(
        CDN_ASSETS.map(url =>
          fetch(url, { mode: "cors" })
            .then(res => { if (res.ok) return cache.put(url, res); })
            .catch(() => {})
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  // Gestiamo solo le richieste GET
  if (req.method !== "GET") return;

  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;

      return fetch(req)
        .then(res => {
          // Cacha dinamicamente le risposte valide (incluse le librerie CDN)
          if (res && res.ok && (res.type === "basic" || res.type === "cors")) {
            const copy = res.clone();
            caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => {
          // Offline e non in cache: per le navigazioni torna alla home
          if (req.mode === "navigate") return caches.match("./index.html");
          return new Response("", { status: 504, statusText: "Offline" });
        });
    })
  );
});
