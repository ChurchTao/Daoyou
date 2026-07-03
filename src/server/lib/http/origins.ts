export function normalizeOrigin(value: string | undefined | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (url.pathname !== '/' || url.search || url.hash) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function splitOrigins(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((origin) => normalizeOrigin(origin))
    .filter((origin): origin is string => Boolean(origin));
}

export function getPublicWebOrigins() {
  return splitOrigins(process.env.PUBLIC_WEB_ORIGINS);
}

export function isAllowedPublicWebOrigin(origin: string | undefined | null) {
  if (!origin) {
    return true;
  }

  const normalized = normalizeOrigin(origin);
  return Boolean(normalized && getPublicWebOrigins().includes(normalized));
}

export function resolveCorsOrigin(origin: string) {
  const normalized = normalizeOrigin(origin);
  return normalized && isAllowedPublicWebOrigin(normalized) ? normalized : '';
}
