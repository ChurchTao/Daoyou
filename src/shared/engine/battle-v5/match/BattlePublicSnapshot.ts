import { restoreBattleSave } from '../persistence/BattleStateCodec';
import type { BattleSaveV1 } from '../persistence/types';
import type { TeamId, TeamSlot, UnitId } from '../core/types';
import { getActionStateViews } from '../core/runtimeState';

export interface BattlePublicEffectStateV1 {
  readonly id: string;
  readonly label: string;
  readonly statusType: 'buff' | 'debuff' | 'control';
  readonly layers: number;
  readonly remainingActions: number;
  readonly permanent: boolean;
}

export interface BattlePublicCombatResourceStateV1 {
  readonly id: string;
  readonly name: string;
  readonly icon?: string;
  readonly current: number;
  readonly max: number;
}

export interface BattlePublicActionStateV1 {
  readonly id: string;
  readonly type: 'rest' | 'queued_action' | 'ability_mode';
  readonly label: string;
  readonly remainingActions: number;
}

export interface BattlePublicUnitStateV1 {
  readonly unitId: UnitId;
  readonly teamId: TeamId;
  readonly slot: TeamSlot;
  readonly name: string;
  readonly alive: boolean;
  readonly hp: { readonly current: number; readonly max: number; readonly percent: number };
  readonly mp: { readonly current: number; readonly max: number; readonly percent: number };
  readonly shield: number;
  readonly effects: readonly BattlePublicEffectStateV1[];
  readonly combatResources: readonly BattlePublicCombatResourceStateV1[];
  readonly actionStates: readonly BattlePublicActionStateV1[];
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
          effects: unit.buffs
            .getAllBuffs()
            .filter((buff) => buff.statusVisibility === 'player')
            .map((buff) => ({
              id: buff.id,
              label: buff.name,
              statusType: buff.type,
              layers: buff.getLayer(),
              remainingActions: buff.isPermanent() ? -1 : buff.getDuration(),
              permanent: buff.isPermanent(),
            })),
          combatResources: snapshot.combatResources.map((resource) => ({
            id: resource.id,
            name: resource.name,
            ...(resource.icon ? { icon: resource.icon } : {}),
            current: resource.current,
            max: resource.max,
          })),
          actionStates: getActionStateViews(unit).map((state) => ({
            id: [
              state.type,
              state.sourceAbility?.id ?? state.ability?.id ?? state.name,
            ].join(':'),
            type: state.type,
            label: state.name,
            remainingActions: state.remainingActions,
          })),
        };
      }),
    };
  } finally {
    restored.runtime.dispose();
  }
}
