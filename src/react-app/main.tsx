import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import './index.css';
import { resolveApiUrl } from './lib/api/url';
import { registerPreloadErrorRecovery } from './lib/appVersion';
import { readStoredLlmConfig } from './lib/llmConfig';
import { initializePwaInstallCapture } from './lib/pwaInstall';
import { router } from './router';

if (import.meta.env.PROD) {
  registerPreloadErrorRecovery();
}
initializePwaInstallCapture();

const originalFetch = window.fetch;
window.fetch = (async (input, init) => {
  if (typeof input === 'string' && input.startsWith('/api/')) {
    init = { ...init, credentials: init?.credentials ?? 'include' };
    const cfg = readStoredLlmConfig();
    if (cfg) {
      const headers = new Headers(init?.headers);
      headers.set('x-llm-provider', cfg.provider);
      headers.set('x-llm-api-key', cfg.apiKey);
      headers.set('x-llm-model', cfg.model);
      init = { ...init, headers };
    }

    input = resolveApiUrl(input);
  }
  return originalFetch(input, init);
}) as typeof window.fetch;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
