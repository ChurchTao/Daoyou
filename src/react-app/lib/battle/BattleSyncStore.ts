import type { BattleServerMessageV2 } from '@shared/contracts/onlineBattle';
import { expandBattlePresentationWindow } from '@shared/online-battle/BattlePresentation';
import type { BattleMatchClientView } from './battleMatchClient';

type StateEvent = Exclude<
  BattleServerMessageV2,
  { type: 'time.pong' | 'battle.error' | 'battle.resume_ok' }
>;

/** Applies only monotonic authoritative server state; animation never mutates it. */
export class BattleSyncStore {
  private view: BattleMatchClientView | undefined;

  current(): BattleMatchClientView | undefined {
    return this.view;
  }

  apply(message: StateEvent, estimatedServerNow: number): BattleMatchClientView | undefined {
    if (message.type === 'battle.snapshot') {
      if (
        this.view &&
        message.payload.clientEventSeq < this.view.clientEventSeq
      ) return this.view;
      const { roundResult, ...payload } = message.payload;
      this.view = {
        ...payload,
        presentationWindow: roundResult
          ? expandBattlePresentationWindow(roundResult)
          : undefined,
        serverNow: estimatedServerNow,
      };
      return this.view;
    }
    if (message.type === 'command.ack') {
      if (!this.view) return undefined;
      this.view = {
        ...this.view,
        serverNow: estimatedServerNow,
        commandReceipt: {
          requestId: message.payload.requestId,
          status: message.payload.status,
          reason: message.payload.reason as NonNullable<BattleMatchClientView['commandReceipt']>['reason'],
          matchRevision: message.payload.revision,
          checkpointRevision: this.view.checkpointRevision,
          receivedAt: message.payload.serverNow,
        },
        ownCommitted:
          message.payload.commandType === 'round.submit' &&
              message.payload.status !== 'rejected'
            ? true
            : this.view.ownCommitted,
      };
      return this.view;
    }
    return this.view;
  }

  refreshClock(estimatedServerNow: number): BattleMatchClientView | undefined {
    if (!this.view) return undefined;
    this.view = { ...this.view, serverNow: estimatedServerNow };
    return this.view;
  }
}
