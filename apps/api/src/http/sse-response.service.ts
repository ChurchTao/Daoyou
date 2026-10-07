import { Inject, Injectable, type MessageEvent } from '@nestjs/common';
import { runWithContext } from '@server/lib/http/context.js';
import { EMPTY, Observable } from 'rxjs';
import type { GameRequest } from './request.js';
import { RequestWorkService } from './request-work.service.js';

type StreamProducer<EVENT extends object> = (
  emit: (event: EVENT) => Promise<void>,
  signal: AbortSignal,
) => Promise<void>;

@Injectable()
export class SseResponseService {
  constructor(
    @Inject(RequestWorkService) private readonly work: RequestWorkService,
  ) {}

  /**
   * Runs fallible setup before Nest subscribes to the returned stream.
   * These routes must not pass through an interceptor: a global interceptor
   * makes Nest commit the event-stream headers before that setup finishes.
   */
  async stream<EVENT extends object>(
    request: GameRequest,
    signal: AbortSignal | undefined,
    setup: (signal: AbortSignal) => Promise<StreamProducer<EVENT>>,
  ): Promise<Observable<MessageEvent>> {
    const lifetime = signal ?? new AbortController().signal;
    const release = this.work.begin();
    let released = false;
    const finish = () => {
      if (released) return;
      released = true;
      release();
    };
    try {
      const produce = await runWithContext(request.gameContext, () =>
        setup(lifetime),
      );
      if (lifetime.aborted) {
        finish();
        return EMPTY;
      }
      return new Observable((subscriber) => {
        void runWithContext(request.gameContext, () =>
          produce(async (event) => {
            if (!subscriber.closed) subscriber.next({ data: event });
          }, lifetime),
        )
          .then(() => {
            if (!subscriber.closed) subscriber.complete();
          })
          .catch((error: unknown) => {
            if (!subscriber.closed) subscriber.error(error);
          })
          .finally(finish);
      });
    } catch (error) {
      finish();
      throw error;
    }
  }
}
