import type { Response } from 'express';

/** Keep cancellation attached while an operation is preparing its response. */
export async function withRequestAbort<T>(
  response: Response,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  response.once('close', abort);
  if (response.destroyed) abort();
  try {
    return await operation(controller.signal);
  } finally {
    response.removeListener('close', abort);
    controller.abort();
  }
}
