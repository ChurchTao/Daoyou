import type { AbilityConfig, AttributeModifierConfig, EffectConfig, ListenerConfig } from '../contracts/battle';
import type { EquipmentSlot } from '@/types/constants';
import type { CreationOutcomeKind, CreationProductType, RolledAffix } from '../types';
import type { BalanceMetrics } from '../balancing/PBU';

export interface ArtifactDomainConfig {
  slot?: EquipmentSlot;
  equipPolicy: 'single_slot';
  persistencePolicy: 'inventory_bound';
  progressionPolicy: 'reforgeable';
}

export interface GongFaDomainConfig {
  equipPolicy: 'single_manual';
  persistencePolicy: 'inventory_bound';
  progressionPolicy: 'comprehension';
}

interface BaseProductModel<
  TProductType extends CreationProductType,
  TOutcomeKind extends CreationOutcomeKind,
> {
  productType: TProductType;
  outcomeKind: TOutcomeKind;
  slug: string;
  name: string;
  description?: string;
  tags: string[];
  affixes: RolledAffix[];
  abilityTags: string[];
  balanceMetrics?: BalanceMetrics;
}

export interface ActiveSkillBattleProjection {
  projectionKind: 'active_skill';
  abilityTags: string[];
  mpCost: number;
  cooldown: number;
  priority: number;
  targetPolicy: NonNullable<AbilityConfig['targetPolicy']>;
  effects: EffectConfig[];
  listeners?: ListenerConfig[];
}

export interface ArtifactBattleProjection {
  projectionKind: 'artifact_passive';
  abilityTags: string[];
  listeners: ListenerConfig[];
  modifiers?: AttributeModifierConfig[];
}

export interface GongFaBattleProjection {
  projectionKind: 'gongfa_passive';
  abilityTags: string[];
  listeners: ListenerConfig[];
  modifiers?: AttributeModifierConfig[];
}

export interface SkillProductModel
  extends BaseProductModel<'skill', 'active_skill'> {
  /** Battle projection is the single source of truth for all battle-facing fields. */
  battleProjection: ActiveSkillBattleProjection;
}

export interface ArtifactProductModel
  extends BaseProductModel<'artifact', 'artifact'> {
  artifactConfig: ArtifactDomainConfig;
  battleProjection: ArtifactBattleProjection;
}

export interface GongFaProductModel
  extends BaseProductModel<'gongfa', 'gongfa'> {
  gongfaConfig: GongFaDomainConfig;
  battleProjection: GongFaBattleProjection;
}

export type CreationProductModel =
  | SkillProductModel
  | ArtifactProductModel
  | GongFaProductModel;

/** Artifact domain policy constants — match the literal types in ArtifactDomainConfig */
export const ARTIFACT_POLICIES = {
  EQUIP: 'single_slot',
  PERSISTENCE: 'inventory_bound',
  PROGRESSION: 'reforgeable',
} as const satisfies {
  EQUIP: ArtifactDomainConfig['equipPolicy'];
  PERSISTENCE: ArtifactDomainConfig['persistencePolicy'];
  PROGRESSION: ArtifactDomainConfig['progressionPolicy'];
};

/** GongFa domain policy constants — match the literal types in GongFaDomainConfig */
export const GONGFA_POLICIES = {
  EQUIP: 'single_manual',
  PERSISTENCE: 'inventory_bound',
  PROGRESSION: 'comprehension',
} as const satisfies {
  EQUIP: GongFaDomainConfig['equipPolicy'];
  PERSISTENCE: GongFaDomainConfig['persistencePolicy'];
  PROGRESSION: GongFaDomainConfig['progressionPolicy'];
};