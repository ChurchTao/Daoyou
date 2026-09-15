import type { SkillDef } from '../core/index.ts';
import type {
  CombatV6PanelContribution,
  CombatV6ProjectionDiagnostic,
} from '../projection/types.ts';

export type ManualSlotV1 = 1 | 2 | 3 | 4;

export interface ManualBuildV1 {
  slots: Array<{ slot: ManualSlotV1; manualId: string }>;
}

export interface CultivatorManualStateV1 {
  version: 1;
  revision: number;
  learned: Array<{ manualId: string; level: number; unlockedLevel: number }>;
  build: ManualBuildV1;
}

export type CombatV6CapabilityStackPolicy = 'stack' | 'unique' | 'highest';

export interface CombatV6CapabilityContribution {
  capabilityKey: string;
  sourceType: 'manual' | 'equipment' | 'sect' | 'meridian';
  sourceId: string;
  stackPolicy: CombatV6CapabilityStackPolicy;
  priority: number;
  strength?: number;
  passiveIds: string[];
}

export interface CharacterManualDefV1 {
  id: string;
  realm: '炼气' | '筑基' | '金丹' | '元婴';
  rarity: 'common' | 'rare';
  name: string;
  description: string;
  progressionId: string;
  dropWeight: number;
  effects: Array<{
    attribute: keyof import('@shared/types/cultivator').Attributes;
    valuePerLevel: number;
  }>;
  skill: SkillDef;
}

export interface CharacterManualProjectionV1 {
  attributeBonuses: Partial<import('@shared/types/cultivator').Attributes>;
  skills: SkillDef[];
  passiveSkillIds: string[];
  skillLevels: Record<string, number>;
  panel: CombatV6PanelContribution[];
  unitTags: string[];
  capabilities: CombatV6CapabilityContribution[];
  diagnostics: CombatV6ProjectionDiagnostic[];
}

export type CompileCharacterManualsV1Result =
  | { ok: true; projection: CharacterManualProjectionV1 }
  | { ok: false; diagnostics: CombatV6ProjectionDiagnostic[] };

export type ResolveCombatCapabilitiesV1Result =
  | {
      ok: true;
      contributions: CombatV6CapabilityContribution[];
      passiveIds: string[];
      diagnostics: CombatV6ProjectionDiagnostic[];
    }
  | { ok: false; diagnostics: CombatV6ProjectionDiagnostic[] };

export type ManualStateChangeResult =
  | {
      ok: true;
      state: CultivatorManualStateV1;
      cost: { experience: number; insight: number };
      diagnostics: CombatV6ProjectionDiagnostic[];
    }
  | { ok: false; diagnostics: CombatV6ProjectionDiagnostic[] };
