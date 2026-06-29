import type { Context } from 'hono';

function firstForwardedIp(value?: string | null): string | undefined {
  const first = value?.split(',')[0]?.trim();
  return first || undefined;
}

function normalizedHeaderIp(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

export function getRequestIp(context: Context): string | undefined {
  return (
    normalizedHeaderIp(context.req.header('cf-connecting-ip')) ??
    firstForwardedIp(context.req.header('x-forwarded-for')) ??
    normalizedHeaderIp(context.req.header('x-real-ip'))
  );
}
