function firstForwardedIp(value?: string | null): string | undefined {
  const first = value?.split(',')[0]?.trim();
  return first || undefined;
}

function normalizedHeaderIp(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

export function getRequestIp(headers: Headers): string | undefined {
  return (
    normalizedHeaderIp(headers.get('cf-connecting-ip')) ??
    firstForwardedIp(headers.get('x-forwarded-for')) ??
    normalizedHeaderIp(headers.get('x-real-ip'))
  );
}
