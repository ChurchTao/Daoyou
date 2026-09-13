import type { AppEnv } from '@server/lib/hono/types';
import type { Context } from 'hono';
import { streamSSE, type SSEStreamingApi } from 'hono/streaming';

export type SseEventHandler = (
  stream: SSEStreamingApi,
  isAborted: () => boolean,
  signal: AbortSignal,
) => Promise<void>;

/**
 * Wraps Hono's streamSSE with a shared client-disconnect signal.
 *
 * The returned handler receives an isAborted() helper that flips to true when
 * either the incoming request is aborted or Hono cancels the response stream.
 * Callers should use it to stop streaming work that no longer has a consumer.
 */
export function streamSseEvents(
  c: Context<AppEnv>,
  handler: SseEventHandler,
): Response {
  const controller = new AbortController();
  let aborted = false;
  const markAborted = () => {
    aborted = true;
    controller.abort();
  };

  if (c.req.raw.signal.aborted) {
    aborted = true;
    controller.abort();
  } else {
    c.req.raw.signal.addEventListener('abort', markAborted, { once: true });
  }

  return streamSSE(c, async (stream) => {
    stream.onAbort(markAborted);
    try {
      await handler(stream, () => aborted, controller.signal);
    } finally {
      c.req.raw.signal.removeEventListener('abort', markAborted);
      controller.abort();
    }
  });
}
