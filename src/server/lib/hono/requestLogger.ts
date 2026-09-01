import type { MiddlewareHandler } from 'hono';

const SLOW_REQUEST_THRESHOLD_MS = 1_000;
const SKIPPED_PATHS = new Set(['/api/health-check']);

export const requestLogger = (): MiddlewareHandler => {
  return async (context, next) => {
    const startedAt = performance.now();

    await next();

    const path = context.req.path;
    if (SKIPPED_PATHS.has(path)) return;

    const durationMs = Math.round(performance.now() - startedAt);
    const status = context.res.status;
    if (status < 400 && durationMs < SLOW_REQUEST_THRESHOLD_MS) return;

    console.info(
      `[HTTP] ${context.req.method.padEnd(7)} ${path} → ${status} (${durationMs}ms)`,
    );
  };
};
