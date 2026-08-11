import type { State } from 'boardgame.io';
import { SocketIO } from './boardgameio-server';
import { BattleBoardgameStateConflictError } from './BattleBoardgameStorage';

/** Exposes only the server-side broadcast primitive needed by the timeout worker. */
export class BattleBoardgameTransport extends SocketIO {
  private readonly wrappedQueues = new WeakSet<object>();

  constructor(
    private readonly onStateConflict: (
      conflict: BattleBoardgameStateConflictError,
    ) => Promise<void>,
  ) {
    super();
  }

  override getMatchQueue(
    matchID: string,
  ): ReturnType<InstanceType<typeof SocketIO>['getMatchQueue']> {
    const queue = super.getMatchQueue(matchID);
    if (this.wrappedQueues.has(queue)) return queue;
    this.wrappedQueues.add(queue);
    const add = queue.add.bind(queue);
    queue.add = ((task, options) => add(async () => {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          return await task();
        } catch (error) {
          if (!(error instanceof BattleBoardgameStateConflictError)) throw error;
          await this.onStateConflict(error);
          if (attempt === 3) return undefined;
        }
      }
      return undefined;
    }, options)) as typeof queue.add;
    return queue;
  }

  runMatchTask<T>(matchID: string, task: () => Promise<T>): Promise<T | undefined> {
    return this.getMatchQueue(matchID).add(task);
  }

  publishMatchState(matchID: string, state: State): void {
    this.pubSub.publish(`MATCH-${matchID}`, {
      type: 'update',
      args: [matchID, state],
    });
  }
}
