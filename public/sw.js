const CACHE = 'ninja-tournament-v2';
const scopeUrl = new URL(self.registration.scope);
const shellUrl = new URL('./index.html', scopeUrl).toString();
const CORE = [
  shellUrl,
  new URL('./manifest.webmanifest', scopeUrl).toString(),
  new URL('./icons/ninja-tournament.svg', scopeUrl).toString()
];

async function precacheBuiltShell() {
  const cache = await caches.open(CACHE);
  const response = await fetch(shellUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Unable to precache app shell: ${response.status}`);

  const html = await response.clone().text();
  await cache.put(shellUrl, response);

  // Vite fingerprints production JS/CSS names. Discover those names from the
  // generated HTML at install time so offline boot stays valid after every build.
  const assets = new Set(CORE.slice(1));
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/gi)) {
    assets.add(new URL(match[1], shellUrl).toString());
  }
  await cache.addAll([...assets]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheBuiltShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(event.request);
        if (response.ok) await cache.put(shellUrl, response.clone());
        return response;
      } catch {
        return (await cache.match(shellUrl)) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(event.request);
    if (cached) return cached;

    try {
      const response = await fetch(event.request);
      // Wait for cache persistence before resolving an uncached request. This
      // prevents a fast online->offline transition from racing cache.put().
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    } catch {
      return Response.error();
    }
  })());
});
