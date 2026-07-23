import type { AbilitySelectionStrategy } from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import type {
  AbilityConfig,
  AbilityCostConfig,
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

/**
 * 节点对既有神通的跨配置修正说明。
 *
 * 只用于无法从最终 AbilityConfig 反推的监听器语义；普通倍率、Buff、资源与
 * 队列效果必须继续由 AbilityConfig 分析器生成。
 */
export interface AbilityPresentationModifier {
  sourceId: string;
  abilityId: SectAbilityId;
  factRows: string[];
}

export interface SectCompiledBuild {
  abilities: Record<SectAbilityId, SectCompiledAbility>;
  resources: CombatResourceDefinition[];
  abilityPresentationModifiers?: AbilityPresentationModifier[];
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
  costs: AbilityCostConfig[];
  costText: string;
  cooldown: number;
  detailRows: string[];
  notes: string[];
  config: AbilityConfig;
}

export interface ResolvedSectPathAbilityPreview {
  id: SectAbilityId;
  name: string;
  summary: string;
  changeSummary: string;
  unlocked: boolean;
  unlockRequirements: string[];
  baseline: ResolvedSectAbility;
  pathBase: ResolvedSectAbility;
  current?: ResolvedSectAbility;
}

export interface ResolvedSectNodePreview {
  id: string;
  name: string;
  description: string;
}

export interface ResolvedSectPathPreview {
  pathId: string;
  learned: boolean;
  active: boolean;
  activeMeridianSlot?: 1 | 2 | 3;
  nodes: ResolvedSectNodePreview[];
  abilities: ResolvedSectPathAbilityPreview[];
}
