const clientImportMetaEnv = import.meta.env as Record<string, string | undefined>;

function getOptionalEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = clientImportMetaEnv[name];
    if (value) {
      return value;
    }
  }

  return undefined;
}

export const clientEnv = {
  apiBaseUrl: getOptionalEnv('VITE_API_BASE_URL')?.replace(/\/+$/, ''),
  turnstileSiteKey: getOptionalEnv('VITE_TURNSTILE_SITE_KEY'),
};
