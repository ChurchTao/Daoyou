import type { AbilityConfig, EffectConfig, ListenerConfig } from '../contracts/battle';
import type { EquipmentSlot } from '@/types/constants';
import type { CreationOutcomeKind, CreationProductType, RolledAffix } from '../types';

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
}

export interface GongFaBattleProjection {
  projectionKind: 'gongfa_passive';
  abilityTags: string[];
  listeners: ListenerConfig[];
}

export interface SkillProductModel
  extends BaseProductModel<'skill', 'active_skill'> {
  mpCost: number;
  cooldown: number;
  priority: number;
  targetPolicy: NonNullable<AbilityConfig['targetPolicy']>;
  effects: EffectConfig[];
  listeners?: ListenerConfig[];
  battleProjection: ActiveSkillBattleProjection;
}

export interface ArtifactProductModel
  extends BaseProductModel<'artifact', 'artifact'> {
  slot?: EquipmentSlot;
  equipPolicy: 'single_slot';
  persistencePolicy: 'inventory_bound';
  progressionPolicy: 'reforgeable';
  artifactConfig: ArtifactDomainConfig;
  battleProjection: ArtifactBattleProjection;
}

export interface GongFaProductModel
  extends BaseProductModel<'gongfa', 'gongfa'> {
  equipPolicy: 'single_manual';
  persistencePolicy: 'inventory_bound';
  progressionPolicy: 'comprehension';
  gongfaConfig: GongFaDomainConfig;
  battleProjection: GongFaBattleProjection;
}

export type CreationProductModel =
  | SkillProductModel
  | ArtifactProductModel
  | GongFaProductModel;