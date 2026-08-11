import type { BattleRoster } from '../core/BattleRoster';
import type { BattleEndEvent, BattleInitEvent } from '../core/events';
import {
  captureBattleCheckpoint,
  createBattleBlueprint,
} from '../persistence/BattleStateCodec';
import type { BattleSaveV1 } from '../persistence/types';
import type { BattleRuntime } from '../runtime/BattleRuntime';
import { BattleStateRecorder } from '../systems/state/BattleStateRecorder';
import type { BattleStateFrame } from '../systems/state/types';
import type { TerminalTeamVictoryResult } from '../systems/TeamVictorySystem';
import type { Unit } from '../units/Unit';
import type {
  BattleStateTimelineV3,
  CombatSequenceV3,
} from '../v3/types';
import { BattleResolutionContext } from './BattleResolutionContext';

export interface BattleInitializationV1 {
  readonly save: BattleSaveV1;
  readonly sequences: CombatSequenceV3[];
  readonly stateTimeline: BattleStateTimelineV3;
}

/** Creates the only authoritative round-zero save for a new battle. */
export function initializeBattle(input: {
  battleId: string;
  roster: BattleRoster;
  runtime: BattleRuntime;
}): BattleInitializationV1 {
  assertRuntimeMatchesRoster(input.roster, input.runtime);
  const blueprint = createBattleBlueprint(input.battleId, input.roster);
  const context = new BattleResolutionContext(input.runtime);
  const recorder = new BattleStateRecorder();
  const units = input.roster.getAllUnits();
  try {
    context.runFrame({ phase: 'battle_init', turn: 0 }, (sequence) => {
      input.runtime.events.publish<BattleInitEvent>({
        type: 'BattleInitEvent',
        timestamp: input.runtime.clock.now(),
        player: units[0],
        opponent: units.find((unit) => unit.teamId !== units[0].teamId)!,
        units,
      });
      recorder.record(
        'battle_init',
        0,
        units,
        undefined,
        sequence.id,
      );
    });
    const sequences = context.getSequences();
    const stateTimeline = timelineFromFrames(units, recorder.getFrames());
    const save: BattleSaveV1 = {
      version: 'battle_save_v1',
      blueprint,
      checkpoint: captureBattleCheckpoint({
        blueprint,
        roster: input.roster,
        runtime: input.runtime,
        round: 0,
        checkpointRevision: 0,
      }),
      lifecycle: {
        version: 'battle_lifecycle_v1',
        initialized: true,
        ended: false,
        initialSequences: sequences,
        initialStateTimeline: stateTimeline,
      },
    };
    return { save, sequences, stateTimeline };
  } finally {
    context.destroy();
  }
}

/** Emits the terminal lifecycle event inside the active round fact scope. */
export function recordBattleEnd(input: {
  context: BattleResolutionContext;
  recorder: BattleStateRecorder;
  roster: BattleRoster;
  runtime: BattleRuntime;
  outcome: TerminalTeamVictoryResult;
  round: number;
}): void {
  if (!input.outcome.battleEnded) {
    throw new Error('Cannot finalize a battle that has not ended');
  }
  const actor = resolveWinnerActor(input.roster, input.outcome);
  input.context.runFrame(
    {
      phase: 'battle_end',
      turn: input.round,
      actor: { id: actor.id, name: actor.name },
    },
    (sequence) => {
      input.runtime.events.publish<BattleEndEvent>({
        type: 'BattleEndEvent',
        timestamp: input.runtime.clock.now(),
        winner: actor.id,
        winnerTeamId: input.outcome.winnerTeamId,
        turns: input.round,
      });
      input.recorder.record(
        'battle_end',
        input.round,
        input.roster.getAllUnits(),
        actor.id,
        sequence.id,
      );
    },
  );
}

function resolveWinnerActor(
  roster: BattleRoster,
  outcome: TerminalTeamVictoryResult,
): Unit {
  const team = roster.getTeam(outcome.winnerTeamId);
  return roster.getLivingUnits(outcome.winnerTeamId)[0]
    ?? roster.getUnit(team.unitIds[0]);
}

function timelineFromFrames(
  units: Unit[],
  frames: BattleStateFrame[],
): BattleStateTimelineV3 {
  return {
    unitIds: units.map((unit) => unit.id),
    unitNames: Object.fromEntries(units.map((unit) => [unit.id, unit.name])),
    frames: frames.map((frame, index) => {
      if (!frame.sourceSequenceId) {
        throw new Error('Battle lifecycle frame has no source sequence');
      }
      return {
        ...frame,
        frameId: index + 1,
        sourceSequenceId: frame.sourceSequenceId,
      };
    }),
  };
}

function assertRuntimeMatchesRoster(
  roster: BattleRoster,
  runtime: BattleRuntime,
): void {
  if (roster.getAllUnits().some((unit) => unit.runtime !== runtime)) {
    throw new Error('All battle units must belong to the supplied runtime');
  }
}
