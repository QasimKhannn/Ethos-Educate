import 'regenerator-runtime/runtime';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { initializeI18n } from './locales/i18n';
import { notifyServiceWorkerUpdate } from './utils/serviceWorkerUpdate';
import App from './App';
import './style.css';
import './mobile.css';
import { ApiErrorBoundaryProvider } from './hooks/ApiErrorBoundaryContext';
import 'katex/dist/katex.min.css';
import 'katex/dist/contrib/copy-tex.js';

const staleChunkReloadKey = 'ethos-stale-chunk-reload-at';
const staleChunkReloadCooldown = 60 * 1000;
const serviceWorkerUpdateInterval = 60 * 1000;

const updateServiceWorker = registerSW({
  immediate: true,
  onNeedRefresh: () => {
    notifyServiceWorkerUpdate(updateServiceWorker);
  },
  onRegisteredSW: (_serviceWorkerUrl, registration) => {
    if (registration == null) {
      return;
    }

    const checkForUpdate = () => {
      void registration.update();
    };

    checkForUpdate();
    window.setInterval(() => {
      checkForUpdate();
    }, serviceWorkerUpdateInterval);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkForUpdate();
      }
    });
  },
});

window.addEventListener('vite:preloadError', (event) => {
  const lastReloadAt = Number(sessionStorage.getItem(staleChunkReloadKey));

  if (Date.now() - lastReloadAt < staleChunkReloadCooldown) {
    return;
  }

  event.preventDefault();
  sessionStorage.setItem(staleChunkReloadKey, String(Date.now()));
  window.location.reload();
});

const container = document.getElementById('root');
const root = createRoot(container);

void initializeI18n()
  .catch(() => undefined)
  .finally(() => {
    root.render(
      <ApiErrorBoundaryProvider>
        <App />
      </ApiErrorBoundaryProvider>,
    );
  });
