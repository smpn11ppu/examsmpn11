/* CBTKU PWA service worker.
 * Security design: never cache /api responses, exam pages, authentication data, or answers.
 * If offline, show an explicit offline page instead of pretending the exam can continue.
 */
'use strict';

const CBTKU_CACHE = 'cbtku-pwa-shell-v1';
const SHELL_FILES = [
  '/offline.html',
  '/manifest.webmanifest',
  '/pwa-192.png',
  '/pwa-512.png',
  '/pwa-512-maskable.png',
  '/apple-touch-icon.png',
  '/logo-smpn11-ppu.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CBTKU_CACHE)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith('cbtku-pwa-') && key !== CBTKU_CACHE)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // API traffic must always reach the server. Never cache login, exam questions, answer saves,
  // violation locks, recovery tokens, scores, or other authenticated API responses.
  if (url.pathname.startsWith('/api/') || request.headers.has('authorization')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const offlinePage = await caches.match('/offline.html');
        return offlinePage || new Response('Koneksi internet diperlukan untuk menggunakan CBTKU.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      })
    );
    return;
  }

  if (SHELL_FILES.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CBTKU_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      }))
    );
  }
});
