import { createCombatUnitFromCultivator } from '@shared/engine/battle-v5/adapters/CultivatorCombatAdapter';
import { BattleRoster } from '@shared/engine/battle-v5/core/BattleRoster';
import { BattleRuntime } from '@shared/engine/battle-v5/runtime/BattleRuntime';
import { initializeBattle } from '@shared/engine/battle-v5/round/BattleLifecycleResolver';
import { createBattleMatchState } from '@shared/engine/battle-v5/match/BattleMatchStateMachine';
import type { BattleControllerV1, BattleMatchStateV1 } from '@shared/engine/battle-v5/match/types';
import { loadCultivatorCombatInput } from './cultivator/CultivatorCombatProjectionReader';

export interface OnlineBattleTeamInput {
  readonly cultivatorIds: readonly string[];
}

/** Builds a trusted match state from server-owned cultivator projections. */
export async function buildOnlineBattleMatchState(input: {
  readonly matchId: string;
  readonly teams: readonly [OnlineBattleTeamInput, OnlineBattleTeamInput];
  readonly now?: number;
}): Promise<BattleMatchStateV1> {
  const all = input.teams.flatMap((team) => team.cultivatorIds);
  if (all.length < 2 || all.length > 8 || new Set(all).size !== all.length) {
    throw new Error('Online battle requires 2-8 distinct cultivators');
  }
  if (input.teams.some((team) => team.cultivatorIds.length < 1 || team.cultivatorIds.length > 4)) {
    throw new Error('Each online battle team must contain 1-4 cultivators');
  }

  const loaded = await Promise.all(all.map((id) => loadCultivatorCombatInput(id)));
  if (loaded.some((value) => !value)) throw new Error('One or more cultivators are unavailable');
  const entries = loaded as NonNullable<(typeof loaded)[number]>[];
  const byId = new Map(entries.map((entry) => [entry.cultivator.id, entry]));
  const runtime = new BattleRuntime();
  try {
    const units = input.teams.flatMap((team, teamIndex) =>
      team.cultivatorIds.map((id, slot) => {
        const entry = byId.get(id)!;
        return createCombatUnitFromCultivator(entry.cultivator, false, runtime, {
          teamId: teamIndex === 0 ? 'alpha' : 'beta',
          slot: slot as 0 | 1 | 2 | 3,
        });
      }),
    );
    const roster = new BattleRoster(units);
    const battle = initializeBattle({
      battleId: input.matchId,
      roster,
      runtime,
    }).save;
    const controllerMap = new Map<string, BattleControllerV1>();
    const alphaIds = input.teams[0]!.cultivatorIds;
    for (const entry of entries) {
      const unitId = entry.cultivator.id ?? entry.cultivator.name;
      const teamId = alphaIds.includes(unitId) ? 'alpha' : 'beta';
      const current = controllerMap.get(entry.userId);
      if (current && current.teamId !== teamId) {
        throw new Error('A player cannot control both battle teams');
      }
      controllerMap.set(entry.userId, {
        playerId: entry.userId,
        teamId,
        unitIds: [...(current?.unitIds ?? []), unitId],
      });
    }
    return createBattleMatchState({ matchId: input.matchId, battle, controllers: [...controllerMap.values()], now: input.now ?? Date.now() });
  } finally {
    runtime.dispose();
  }
}
