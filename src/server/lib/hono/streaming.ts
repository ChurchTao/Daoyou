import type { AppEnv } from '@server/lib/hono/types';
import type { Context } from 'hono';
import { streamSSE, type SSEStreamingApi } from 'hono/streaming';

export type SseEventHandler = (
  stream: SSEStreamingApi,
  isAborted: () => boolean,
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
  let aborted = false;
  const markAborted = () => {
    aborted = true;
  };

  if (c.req.raw.signal.aborted) {
    aborted = true;
  } else {
    c.req.raw.signal.addEventListener('abort', markAborted, { once: true });
  }

  return streamSSE(c, async (stream) => {
    stream.onAbort(markAborted);
    await handler(stream, () => aborted);
  });
}
