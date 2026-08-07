import { restoreBattleSave } from '../persistence/BattleStateCodec';
import type { BattleSaveV1 } from '../persistence/types';
import type { TeamId, TeamSlot, UnitId } from '../core/types';

export interface BattlePublicUnitStateV1 {
  readonly unitId: UnitId;
  readonly teamId: TeamId;
  readonly slot: TeamSlot;
  readonly name: string;
  readonly alive: boolean;
  readonly hp: { readonly current: number; readonly max: number; readonly percent: number };
  readonly mp: { readonly current: number; readonly max: number; readonly percent: number };
  readonly shield: number;
}

export interface BattlePublicSnapshotV1 {
  readonly version: 'battle_public_snapshot_v1';
  readonly battleId: string;
  readonly round: number;
  readonly checkpointRevision: number;
  readonly units: readonly BattlePublicUnitStateV1[];
}

/**
 * Build the deliberately small state projection used by all players. It
 * exposes enough information to render both teams, while keeping the
 * serialized blueprint, ability configs, runtime tags and internal buffs out
 * of the network view.
 */
export function createBattlePublicSnapshot(
  save: BattleSaveV1,
): BattlePublicSnapshotV1 {
  const restored = restoreBattleSave(save);
  try {
    const teamByUnitId = new Map(
      save.blueprint.teams.flatMap((team) =>
        team.units.map((unit) => [unit.id, team.id] as const),
      ),
    );
    return {
      version: 'battle_public_snapshot_v1',
      battleId: save.checkpoint.battleId,
      round: save.checkpoint.round,
      checkpointRevision: save.checkpoint.checkpointRevision,
      units: restored.roster.getAllUnits().map((unit) => {
        const snapshot = unit.getSnapshot();
        const teamId = teamByUnitId.get(unit.id);
        if (!teamId) throw new Error(`Missing team for battle unit ${unit.id}`);
        return {
          unitId: unit.id,
          teamId,
          slot: unit.slot,
          name: unit.name,
          alive: snapshot.isAlive,
          hp: {
            current: Math.round(snapshot.currentHp),
            max: snapshot.maxHp,
            percent: Math.round(snapshot.hpPercent * 10000) / 100,
          },
          mp: {
            current: Math.round(snapshot.currentMp),
            max: snapshot.maxMp,
            percent: Math.round(snapshot.mpPercent * 10000) / 100,
          },
          shield: Math.round(snapshot.currentShield),
        };
      }),
    };
  } finally {
    restored.runtime.dispose();
  }
}
