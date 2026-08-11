import { RedisBattleBoardgameStorage } from './BattleBoardgameStorage';
import { BattleBoardgameTransport } from './BattleBoardgameTransport';

/** Single mutation boundary for every Redis-authoritative match operation. */
export class BattleMatchCoordinator {
  constructor(
    private readonly storage: RedisBattleBoardgameStorage,
    private readonly transport: BattleBoardgameTransport,
  ) {}

  acceptPlayer(matchId: string, playerId: string): Promise<boolean | undefined> {
    return this.runMutation(matchId, () => this.storage.acceptPlayer(matchId, playerId));
  }

  resolveExpired(matchId: string): Promise<boolean | undefined> {
    return this.runMutation(matchId, () => this.storage.resolveExpired(matchId));
  }

  reconcileDeadlineIndex(matchId: string): Promise<boolean | undefined> {
    return this.transport.runMatchTask(matchId, () =>
      this.storage.reconcileDeadlineIndex(matchId));
  }

  resumeResolving(matchId: string): Promise<boolean | undefined> {
    return this.runMutation(matchId, () => this.storage.resumeResolving(matchId));
  }

  retryResolution(matchId: string): Promise<boolean | undefined> {
    return this.runMutation(matchId, () => this.storage.retryResolution(matchId));
  }

  technicalAbort(matchId: string): Promise<boolean | undefined> {
    return this.runMutation(matchId, () => this.storage.technicalAbort(matchId));
  }

  expireWaiting(matchId: string): Promise<boolean | undefined> {
    return this.transport.runMatchTask(matchId, () => this.storage.expireWaiting(matchId));
  }

  private async runMutation(
    matchId: string,
    mutation: () => Promise<boolean>,
  ): Promise<boolean | undefined> {
    const changed = await this.transport.runMatchTask(matchId, mutation);
    if (changed) {
      const next = await this.storage.fetch(matchId, { state: true });
      this.transport.publishMatchState(matchId, next.state);
    }
    return changed;
  }
}
