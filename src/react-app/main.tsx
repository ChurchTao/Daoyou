import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { resolveApiUrl } from './lib/api/url';
import { router } from './router';
import './index.css';

const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  if (typeof input === 'string' && input.startsWith('/api/')) {
    init = { ...init, credentials: init?.credentials ?? 'include' };
    const raw = localStorage.getItem('daoyou_llm_config');
    if (raw) {
      try {
        const cfg = JSON.parse(raw);
        const headers = new Headers(init?.headers);
        headers.set('x-llm-provider', cfg.provider);
        headers.set('x-llm-api-key', cfg.apiKey);
        if (cfg.baseUrl) headers.set('x-llm-base-url', cfg.baseUrl);
        headers.set('x-llm-model', cfg.model);
        headers.set('x-llm-fast-model', cfg.fastModel);
        init = { ...init, headers };
      } catch {
        // ignore invalid json
      }
    }

    input = resolveApiUrl(input);
  }
  return originalFetch(input, init);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
