import type { AbilitySelectionStrategy } from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import type {
  AbilityConfig,
  CombatResourceDefinition,
} from '@shared/engine/battle-v5/core/configs';
import type {
  SectAbilityId,
  SectAbilityRole,
  SectMethodId,
} from './definitions';

export interface SectMethodModifierProjection {
  methodId: SectMethodId;
  methodName: string;
  level: number;
  modifiers: import('@shared/engine/battle-v5/core/configs').AttributeModifierConfig[];
}

export interface SectCombatProjection {
  defaultAttack?: AbilityConfig;
  abilities: AbilityConfig[];
  methodModifiers: SectMethodModifierProjection[];
  resources: CombatResourceDefinition[];
  selectionStrategy?: AbilitySelectionStrategy;
}

export interface SectCompiledAbility {
  config: AbilityConfig;
  summary?: string;
  detailRows: string[];
  notes: string[];
}

export interface SectCompiledBuild {
  defaultAbilityId: SectAbilityId;
  abilities: Record<SectAbilityId, SectCompiledAbility>;
  resources: CombatResourceDefinition[];
  passives: AbilityConfig[];
}

export interface ResolvedSectAbility {
  id: SectAbilityId;
  name: string;
  baseName: string;
  role: SectAbilityRole;
  summary: string;
  unlocked: boolean;
  unlockRequirements: string[];
  manaCost: number;
  cooldown: number;
  detailRows: string[];
  notes: string[];
  config: AbilityConfig;
}
