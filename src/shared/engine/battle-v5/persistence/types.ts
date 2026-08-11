import type { RealmStage, RealmType } from '@shared/types/constants';
import type { SpiritualRoot } from '@shared/types/cultivator';
import type {
  AbilityConfig,
  AttributeModifierConfig,
  BuffConfig,
  CombatResourceDefinition,
  DelayedEffectParams,
} from '../core/configs';
import type { SerializableBattleRuntimeStateV1 } from '../core/runtimeState';
import type { AttributeType, TeamId, TeamSlot, UnitId } from '../core/types';
import type { BattleRuntimeCursorV1 } from '../runtime/BattleRuntime';
import type {
  BattleStateTimelineV3,
  CombatOriginV3,
  CombatSequenceV3,
} from '../v3/types';

export interface BattleBuffBlueprintV1 {
  config: BuffConfig;
  sourceUnitId?: UnitId;
  layers?: number;
  duration?: number;
}

export interface BattleUnitBlueprintV1 {
  id: UnitId;
  name: string;
  slot: TeamSlot;
  baseAttributes: Partial<Record<AttributeType, number>>;
  modifiers: AttributeModifierConfig[];
  abilityConfigs: AbilityConfig[];
  /** Configured sect/basic attack. Missing legacy saves use BasicAttack. */
  defaultAttackConfig?: AbilityConfig;
  combatResources: CombatResourceDefinition[];
  tags: string[];
  spiritualRoots: SpiritualRoot[];
  realm?: RealmType;
  realmStage?: RealmStage;
  realmRank?: number;
  startingBuffs: BattleBuffBlueprintV1[];
}

export interface BattleTeamBlueprintV1 {
  id: TeamId;
  units: BattleUnitBlueprintV1[];
}

export interface BattleBlueprintV1 {
  version: 'battle_blueprint_v1';
  battleId: string;
  revision: number;
  teams: [BattleTeamBlueprintV1, BattleTeamBlueprintV1];
}

export type SerializedBattleBuffV1 = {
  id: string;
  sourceUnitId?: UnitId;
  attributionOwnerId?: UnitId;
  origin?: CombatOriginV3;
  layer: number;
  duration: number;
  maxDuration: number;
} & (
  | { kind: 'data'; config: BuffConfig }
  | {
      kind: 'delayed';
      params: DelayedEffectParams;
      remainingTurns: number;
      triggerCount: number;
    }
);

export interface BattleUnitCheckpointV1 {
  unitId: UnitId;
  hp: number;
  mp: number;
  shield: number;
  cooldowns: Record<string, number>;
  combatResources: Record<string, number>;
  tags: string[];
  buffs: SerializedBattleBuffV1[];
  recentRemovedBuffs: SerializedBattleBuffV1[];
  runtimeState: SerializableBattleRuntimeStateV1;
}

export interface BattleCheckpointV1 {
  version: 'battle_checkpoint_v1';
  battleId: string;
  blueprintRevision: number;
  checkpointRevision: number;
  round: number;
  phase: 'planning';
  runtime: BattleRuntimeCursorV1;
  units: Record<UnitId, BattleUnitCheckpointV1>;
}

export interface BattleSaveV1 {
  version: 'battle_save_v1';
  blueprint: BattleBlueprintV1;
  checkpoint: BattleCheckpointV1;
  /** Missing only on legacy/test saves created before lifecycle initialization. */
  lifecycle?: {
    version: 'battle_lifecycle_v1';
    initialized: true;
    ended: boolean;
    initialSequences: CombatSequenceV3[];
    initialStateTimeline: BattleStateTimelineV3;
  };
}
