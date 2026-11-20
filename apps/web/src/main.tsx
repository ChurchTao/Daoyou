import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import './index.css';
import { registerPreloadErrorRecovery } from './lib/appVersion';
import './lib/fonts';
import { initializeGameColorScheme } from './lib/game-setting';
import { initializePwaInstallCapture } from './lib/pwaInstall';
import { registerProductionServiceWorker } from './lib/serviceWorker';
import { router } from './router';

try {
  window.localStorage.removeItem('daoyou_llm_config');
} catch {
  // Storage may be unavailable; retiring the saved key must not block startup.
}

if (import.meta.env.PROD) {
  registerPreloadErrorRecovery();
  registerProductionServiceWorker();
}
initializePwaInstallCapture();
initializeGameColorScheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
