import 'regenerator-runtime/runtime';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { initializeI18n } from './locales/i18n';
import App from './App';
import './style.css';
import './mobile.css';
import { ApiErrorBoundaryProvider } from './hooks/ApiErrorBoundaryContext';
import 'katex/dist/katex.min.css';
import 'katex/dist/contrib/copy-tex.js';

const staleChunkReloadKey = 'ethos-stale-chunk-reload-at';
const staleChunkReloadCooldown = 60 * 1000;
const serviceWorkerUpdateInterval = 5 * 60 * 1000;

registerSW({
  immediate: true,
  onRegisteredSW: (_serviceWorkerUrl, registration) => {
    if (registration == null) {
      return;
    }

    window.setInterval(() => {
      void registration.update();
    }, serviceWorkerUpdateInterval);
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
