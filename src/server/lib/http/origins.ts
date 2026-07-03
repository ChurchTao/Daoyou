function splitOrigins(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function getPublicWebOrigins() {
  return splitOrigins(process.env.PUBLIC_WEB_ORIGINS);
}

export function isAllowedPublicWebOrigin(origin: string | undefined | null) {
  if (!origin) {
    return true;
  }

  return getPublicWebOrigins().includes(origin);
}

export function resolveCorsOrigin(origin: string) {
  return isAllowedPublicWebOrigin(origin) ? origin : '';
}
