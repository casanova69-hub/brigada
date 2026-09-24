// Brigada de Salud — funcionamiento sin conexión
// Estrategia: abre SIEMPRE desde la copia guardada en el celular (rápido y sin señal).
// Si hay internet, revisa en segundo plano si hay versión nueva; la descarga y
// avisa a la app. La versión nueva se usa la próxima vez que se abra.
const CACHE = 'brigada-app';
const ARCHIVOS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });

function firma(resp){ return resp ? (resp.headers.get('etag') || resp.headers.get('last-modified') || '') : ''; }

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const esPagina = req.mode === 'navigate';
  const clave = esPagina ? './index.html' : req;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const guardada = await cache.match(clave, { ignoreSearch: true });
    const deRed = fetch(req, { cache: 'no-cache' }).then(async resp => {
      if (resp && resp.ok) {
        const cambio = guardada && firma(resp) && firma(resp) !== firma(guardada);
        await cache.put(clave, resp.clone());
        if (esPagina && cambio) {
          // marca para que la app avise (la revisa después de desbloquear)
          await cache.put('./__nueva-version', new Response(String(Date.now())));
          const cls = await self.clients.matchAll();
          cls.forEach(c => c.postMessage('nueva-version'));
        }
      }
      return resp;
    }).catch(() => null);
    if (guardada) { e.waitUntil(deRed); return guardada; }
    const r = await deRed;
    return r || new Response('Sin conexión y sin copia guardada. Abre la app una vez con internet.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  })());
});
