import type { AbilityConfig, AttributeModifierConfig, EffectConfig, ListenerConfig } from '../../contracts/battle';
import { CreationOutcomeKind, RolledAffix } from '../../types';
import { RuleDecisionMeta } from '../core';

export type CompositionProjectionKind =
  | 'active_skill'
  | 'artifact_passive'
  | 'gongfa_passive';

export interface SkillProjectionPolicy {
  kind: 'active_skill';
  cooldown: number;
  mpCost: number;
  priority: number;
  abilityTags: string[];
  targetPolicy: NonNullable<AbilityConfig['targetPolicy']>;
  effects: EffectConfig[];
  listeners?: ListenerConfig[];
}

export interface PassiveProjectionPolicy {
  kind: 'artifact_passive' | 'gongfa_passive';
  abilityTags: string[];
  listeners: ListenerConfig[];
  modifiers?: AttributeModifierConfig[];
}

export type ProjectionPolicy = SkillProjectionPolicy | PassiveProjectionPolicy;

export interface CompositionDecision extends RuleDecisionMeta {
  outcomeKind: CreationOutcomeKind;
  name: string;
  description?: string;
  outcomeTags: string[];
  affixes: RolledAffix[];
  defaultsApplied: string[];
  /** Populated by EnergyConversionRules before ProjectionRules runs */
  energyConversion?: {
    mpCost: number;
    priority: number;
  };
  projectionPolicy?: ProjectionPolicy;
}