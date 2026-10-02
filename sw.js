/*
 * sw.js — service worker : application installable et utilisable hors ligne.
 * Fichiers de l'application : cache d'abord. R (webR) et ses paquets : cache séparé, conservé entre versions.
 * Changer VERSION à chaque publication pour forcer la mise à jour des fichiers de l'application.
 */
const VERSION = 'console-r-v7';
const RUNTIME = 'console-r-runtime';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css', 'js/app.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== RUNTIME).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) {
    // Les fichiers d'une version donnée de webR et des paquets ne changent pas : cache d'abord.
    // L'index du dépôt (PACKAGES) et le reste (polices) : réseau d'abord, cache en secours.
    const stable = (url.hostname.endsWith('r-wasm.org') || url.hostname.endsWith('r-universe.dev')) && !url.pathname.includes('/latest/') && !/PACKAGES(\.\w+)?$/.test(url.pathname);
    const net = () => fetch(req).then((res) => {
      if (res.status === 200 || res.type === 'opaque') { const copy = res.clone(); caches.open(RUNTIME).then((c) => c.put(req, copy)); }
      return res;
    });
    e.respondWith(stable ? caches.match(req).then((hit) => hit || net()) : net().catch(() => caches.match(req)));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  })).catch(() => caches.match('index.html')));
});
