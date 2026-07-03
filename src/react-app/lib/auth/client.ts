import { i18nClient } from '@better-auth/i18n/client';
import { emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { clientEnv } from '@app/lib/env';

export const authClient = createAuthClient({
  baseURL: clientEnv.apiBaseUrl,
  basePath: '/api/auth',
  fetchOptions: {
    credentials: 'include',
  },
  plugins: [i18nClient(), emailOTPClient()],
});
