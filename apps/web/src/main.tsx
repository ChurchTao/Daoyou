import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import './index.css';
import { registerPreloadErrorRecovery } from './lib/appVersion';
import { initializePwaInstallCapture } from './lib/pwaInstall';
import { router } from './router';

if (import.meta.env.PROD) {
  registerPreloadErrorRecovery();
}
initializePwaInstallCapture();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
