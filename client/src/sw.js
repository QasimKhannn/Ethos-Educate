import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

const migrationCacheName = 'ethos-service-worker-release';
const migrationRequest = new Request('/__ethos_service_worker_release_v1__');
let shouldClaimClients = false;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const migrationCache = await caches.open(migrationCacheName);
        const migrationComplete = await migrationCache.match(migrationRequest);

        if (migrationComplete != null) {
          return;
        }

        shouldClaimClients = true;
        await self.skipWaiting();
      } catch {
        shouldClaimClients = true;
        await self.skipWaiting();
      }
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'SKIP_WAITING') {
    return;
  }

  shouldClaimClients = true;
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      if (!shouldClaimClients) {
        return;
      }

      await self.clients.claim();

      try {
        const migrationCache = await caches.open(migrationCacheName);
        await migrationCache.put(migrationRequest, new Response('complete'));
      } catch {
        return;
      }
    })(),
  );
});
