import 'regenerator-runtime/runtime';
import { createRoot } from 'react-dom/client';
import { initializeI18n } from './locales/i18n';
import App from './App';
import './style.css';
import './mobile.css';
import { ApiErrorBoundaryProvider } from './hooks/ApiErrorBoundaryContext';
import 'katex/dist/katex.min.css';
import 'katex/dist/contrib/copy-tex.js';

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
