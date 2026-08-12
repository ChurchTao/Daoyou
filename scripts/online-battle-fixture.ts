import { BattleRoster } from '@shared/engine/battle-v5/core/BattleRoster';
import { AttributeType, type TeamSlot } from '@shared/engine/battle-v5/core/types';
import { createBattleMatchState } from '@shared/engine/battle-v5/match/BattleMatchStateMachine';
import type { BattleMatchStateV1 } from '@shared/engine/battle-v5/match/types';
import {
  captureBattleCheckpoint,
  createBattleBlueprint,
} from '@shared/engine/battle-v5/persistence/BattleStateCodec';
import type { BattleSaveV1 } from '@shared/engine/battle-v5/persistence/types';
import { BattleRuntime } from '@shared/engine/battle-v5/runtime/BattleRuntime';
import { Unit } from '@shared/engine/battle-v5/units/Unit';

export function createOnlineBattleFixture(
  matchId: string,
  teamSize: 1 | 2 | 3 | 4,
  options: { readonly onePlayerPerUnit?: boolean } = {},
): BattleMatchStateV1 {
  const runtime = new BattleRuntime();
  try {
    const units = ['alpha', 'beta'].flatMap((teamId) =>
      Array.from({ length: teamSize }, (_, slot) => new Unit(
        `${teamId}-${slot}`,
        `${teamId}-${slot}`,
        slot === 0 ? { [AttributeType.SPEED]: 10 } : {},
        { runtime, teamId, slot: slot as TeamSlot },
      )),
    );
    const roster = new BattleRoster(units);
    const blueprint = createBattleBlueprint(matchId, roster);
    const battle: BattleSaveV1 = {
      version: 'battle_save_v1',
      blueprint,
      checkpoint: captureBattleCheckpoint({
        blueprint,
        roster,
        runtime,
        round: 0,
        checkpointRevision: 0,
      }),
    };
    const controllers = options.onePlayerPerUnit
      ? blueprint.teams.flatMap((team) => team.units.map((unit) => ({
          playerId: `player-${unit.id}`,
          teamId: team.id,
          unitIds: [unit.id],
        })))
      : blueprint.teams.map((team) => ({
          playerId: `player-${team.id}`,
          teamId: team.id,
          unitIds: team.units.map((unit) => unit.id),
        }));
    return createBattleMatchState({
      matchId,
      battle,
      controllers,
      now: Date.now(),
      planningTimeoutMs: 30_000,
    });
  } finally {
    runtime.dispose();
  }
}

export function basicIntentsForPlayer(
  state: BattleMatchStateV1,
  playerId: string,
) {
  const controller = state.controllers.find((entry) => entry.playerId === playerId);
  if (!controller) throw new Error(`Unknown fixture controller: ${playerId}`);
  const target = state.controllers.find((entry) => entry.teamId !== controller.teamId)
    ?.unitIds.find((unitId) => state.battle.checkpoint.units[unitId]?.hp > 0);
  if (!target) throw new Error('Fixture controller has no living enemy target');
  return Object.fromEntries(controller.unitIds
    .filter((unitId) => state.battle.checkpoint.units[unitId]?.hp > 0)
    .map((unitId) => [
      unitId,
      { kind: 'basic_attack' as const, targetUnitId: target },
    ]));
}
