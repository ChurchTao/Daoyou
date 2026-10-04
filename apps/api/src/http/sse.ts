import type { Response } from 'express';

type SseEvent = { data: string; event?: string; id?: string; retry?: number };

export async function streamSseEvents(
  response: Response,
  handler: (
    stream: { writeSSE: (event: SseEvent) => Promise<void> },
    isAborted: () => boolean,
    signal: AbortSignal,
  ) => Promise<void>,
): Promise<void> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  response.once('close', abort);
  response.status(200).set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  response.flushHeaders();
  const stream = {
    async writeSSE(event: SseEvent): Promise<void> {
      controller.signal.throwIfAborted();
      const fields = [
        ...(event.event === undefined ? [] : [`event: ${event.event}`]),
        ...(event.id === undefined ? [] : [`id: ${event.id}`]),
        ...(event.retry === undefined ? [] : [`retry: ${event.retry}`]),
        ...event.data.split(/\r\n|\r|\n/).map((line) => `data: ${line}`),
      ];
      await new Promise<void>((resolve, reject) => {
        response.write(`${fields.join('\n')}\n\n`, (error) =>
          error ? reject(error) : resolve(),
        );
      });
    },
  };
  try {
    await handler(stream, () => controller.signal.aborted, controller.signal);
  } finally {
    response.removeListener('close', abort);
    controller.abort();
    if (!response.destroyed) response.end();
  }
}
