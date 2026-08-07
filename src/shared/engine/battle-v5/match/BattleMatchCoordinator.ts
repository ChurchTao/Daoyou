import { resolveBattleRound } from '../round/BattleRoundResolver';
import type { BattleRoundResolutionV1 } from '../round/types';
import {
  applyBattleRoundResolution,
  transitionBattleMatch,
} from './BattleMatchStateMachine';
import type {
  BattleMatchCommandV1,
  BattleMatchStateV1,
} from './types';

export interface BattleMatchRepositoryPort {
  load(matchId: string): Promise<BattleMatchStateV1 | null>;
  save(
    state: BattleMatchStateV1,
    expectedRevision: number,
  ): Promise<boolean>;
  recordResolution?(matchId: string, resolution: BattleRoundResolutionV1): Promise<void>;
}

export interface BattleMatchLockPort {
  runExclusive<T>(matchId: string, operation: () => Promise<T>): Promise<T>;
}

export interface BattleMatchPublisherPort {
  publish(event: BattleMatchCoordinatorEventV1): Promise<void>;
}

export type BattleMatchCoordinatorEventV1 =
  | {
      /** Internal durable notification; never send this payload directly to clients. */
      type: 'match_state_persisted';
      matchId: string;
      revision: number;
      status: BattleMatchStateV1['status'];
    }
  | {
      type: 'resolution_failed';
      matchId: string;
      commandSetId: string;
      error: string;
    };

export interface BattleMatchCoordinatorOptions {
  readonly repository: BattleMatchRepositoryPort;
  readonly lock: BattleMatchLockPort;
  readonly publisher?: BattleMatchPublisherPort;
  readonly now?: () => number;
}

export class BattleMatchCoordinator {
  private readonly now: () => number;

  constructor(private readonly options: BattleMatchCoordinatorOptions) {
    this.now = options.now ?? (() => Date.now());
  }

  async dispatch(command: BattleMatchCommandV1): Promise<BattleMatchStateV1> {
    const matchId = await this.findMatchId(command);
    return this.options.lock.runExclusive(matchId, async () => {
      const current = await this.requireMatch(matchId);
      const transition = transitionBattleMatch(current, command, this.now());
      if (transition.duplicateRequest) return current;
      await this.saveOrThrow(transition.state, current.revision);
      await this.publishState(transition.state);
      return this.resolveEffects(transition.state);
    });
  }

  async resumeResolving(matchId: string): Promise<BattleMatchStateV1> {
    return this.options.lock.runExclusive(matchId, async () => {
      const current = await this.requireMatch(matchId);
      if (current.status !== 'resolving' || !current.resolving) return current;
      return this.resolveEffects(current);
    });
  }

  async resolveExpired(matchId: string): Promise<BattleMatchStateV1> {
    return this.options.lock.runExclusive(matchId, async () => {
      const current = await this.requireMatch(matchId);
      if (
        current.status !== 'planning' ||
        !current.planning ||
        this.now() < current.planning.deadlineAt
      ) {
        return current;
      }
      const timeoutCommand: BattleMatchCommandV1 = {
        type: 'resolve_planning_timeout',
        matchId,
        requestId: `timeout:${matchId}:${current.planning.round}:${current.planning.checkpointRevision}`,
        expectedMatchRevision: current.revision,
        expectedCheckpointRevision: current.battle.checkpoint.checkpointRevision,
      };
      const transition = transitionBattleMatch(current, timeoutCommand, this.now());
      await this.saveOrThrow(transition.state, current.revision);
      await this.publishState(transition.state);
      return this.resolveEffects(transition.state);
    });
  }

  private async resolveEffects(
    state: BattleMatchStateV1,
  ): Promise<BattleMatchStateV1> {
    if (state.status !== 'resolving' || !state.resolving) return state;
    let resolution: BattleRoundResolutionV1;
    try {
      resolution = resolveBattleRound(
        state.battle,
        state.resolving.commandSet,
      );
    } catch (error) {
      await this.options.publisher?.publish({
        type: 'resolution_failed',
        matchId: state.matchId,
        commandSetId: state.resolving.commandSet.commandSetId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
    const next = applyBattleRoundResolution(state, resolution, this.now());
    await this.saveOrThrow(next, state.revision);
    await this.options.repository.recordResolution?.(state.matchId, resolution);
    await this.publishState(next);
    return next;
  }

  private async findMatchId(command: BattleMatchCommandV1): Promise<string> {
    return command.matchId;
  }

  private async requireMatch(matchId: string): Promise<BattleMatchStateV1> {
    const state = await this.options.repository.load(matchId);
    if (!state) throw new Error(`Unknown battle match: ${matchId}`);
    return state;
  }

  private async saveOrThrow(
    state: BattleMatchStateV1,
    expectedRevision: number,
  ): Promise<void> {
    if (!(await this.options.repository.save(state, expectedRevision))) {
      throw new Error('Battle match revision conflict');
    }
  }

  private async publishState(state: BattleMatchStateV1): Promise<void> {
    await this.options.publisher?.publish({
      type: 'match_state_persisted',
      matchId: state.matchId,
      revision: state.revision,
      status: state.status,
    });
  }
}
